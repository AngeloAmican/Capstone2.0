const FINANCE_API = "../../api/finance.php";
const PATIENT_RECORD_API = "../../api/patient_records.php";
let CURRENT_PATIENT_ID = "";
let CURRENT_PATIENT_NAME = "";
let payments = [];
let currentFilter = "all";
let currentPayTransaction = null;
let currentReceiptPayment = null;
let paymentProcessConfirmed = false;
let patientPaymentVerificationEditing = false;
let patientPaymentVerificationPreviousState = null;
let patientPaymentVerificationState = {
  referenceNumber: "",
  cashReceived: 0,
  changeAmount: 0,
  method: "",
};
document.addEventListener("DOMContentLoaded", async function () {
  await resolveCurrentPatient();
  await syncPaymentsFromFinance();
  bindPaymentEvents();
  renderPayments();
  window.addEventListener("focus", function () {
    void resolveCurrentPatient().then(syncPaymentsFromFinance).then(renderPayments);
  });
});
async function resolveCurrentPatient() {
  CURRENT_PATIENT_ID = "";
  CURRENT_PATIENT_NAME = "";
  let currentUser = null;
  try {
    const response = await fetch(PATIENT_RECORD_API, { credentials: "same-origin", cache: "no-store" });
    const result = await response.json();
    if (!response.ok || !result.success || !result.data) throw new Error(result.message || "Patient unavailable.");
    currentUser = result.data;
  } catch (error) {
    console.error("Unable to load patient account:", error);
    return;
  }
  const userId = String(
    currentUser.id || currentUser.userId || currentUser.user_id || "",
  ).trim();
  const userEmail = String(currentUser.email || currentUser.emailAddress || "")
    .trim()
    .toLowerCase();
  const userPatientId = String(currentUser.patientId || "").trim();
  let patient = null;
  patient = currentUser;
  if (patient) {
    CURRENT_PATIENT_ID = String(
      patient.patientId || patient.id || userPatientId || "",
    ).trim();
    CURRENT_PATIENT_NAME = String(
      patient.name ||
        `${patient.firstName || ""} ${patient.lastName || ""}`.trim() ||
        currentUser.name ||
        currentUser.fullName ||
        "Patient",
    ).trim();
    if (
      CURRENT_PATIENT_ID &&
      String(currentUser.patientId || "").trim() !== CURRENT_PATIENT_ID
    ) {
      try {
        currentUser.patientId = CURRENT_PATIENT_ID;
      } catch (error) {}
    }
    return;
  }
  CURRENT_PATIENT_ID = userPatientId;
  CURRENT_PATIENT_NAME = String(
    currentUser.name ||
      currentUser.fullName ||
      `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim() ||
      "Patient",
  ).trim();
}
async function syncPaymentsFromFinance() {
  payments = [];
  let transactions = [];
  try {
    const response = await fetch(FINANCE_API, { credentials: "same-origin", cache: "no-store" });
    const result = await response.json();
    if (!response.ok || !result.success || !Array.isArray(result.data)) throw new Error(result.message || "Payments unavailable.");
    transactions = result.data;
  } catch (error) {
    transactions = [];
  }
  transactions.forEach(function (transaction) {
    const patientId = String(transaction.patientId || "").trim();
    if (!CURRENT_PATIENT_ID || patientId !== CURRENT_PATIENT_ID) {
      return;
    }
    const history = Array.isArray(transaction.paymentHistory)
      ? transaction.paymentHistory
      : [];
    if (history.length) {
      history.forEach(function (historyPayment, index) {
        const amount = Number(historyPayment.amount) || 0;
        if (amount <= 0) {
          return;
        }
        payments.push(
          normalizePayment({
            id:
              historyPayment.id ||
              `${transaction.id || "TXN"}-PAY-${index + 1}`,
            patientId: CURRENT_PATIENT_ID,
            patientName: transaction.patientName || CURRENT_PATIENT_NAME,
            transactionId: transaction.id || "",
            date:
              historyPayment.date ||
              transaction.date ||
              new Date().toISOString(),
            service: transaction.service || "Dental Service",
            amount: amount,
            totalCharge: Number(transaction.total) || 0,
            discount: Number(transaction.discount) || 0,
            paymentMethod:
              historyPayment.paymentMethod ||
              transaction.paymentMethod ||
              "Cash",
            status: getFinancePaymentStatus(transaction),
            reference:
              historyPayment.reference ||
              historyPayment.referenceNumber ||
              "N/A",
            notes: historyPayment.notes || transaction.notes || "",
            createdTime:
              historyPayment.createdTime || transaction.createdTime || "",
            createdAt: historyPayment.createdAt || transaction.createdAt || "",
            cashReceived: historyPayment.cashReceived,
            change: historyPayment.change,
            gcashReference: historyPayment.gcashReference,
            bankReference: historyPayment.bankReference,
            cardReference: historyPayment.cardReference,
          }),
        );
      });
      return;
    }
    const paid = Number(transaction.paid) || 0;
    payments.push(
      normalizePayment({
        id: `${transaction.id || "TXN"}-PAY-1`,
        patientId: CURRENT_PATIENT_ID,
        patientName: transaction.patientName || CURRENT_PATIENT_NAME,
        transactionId: transaction.id || "",
        date: transaction.date || new Date().toISOString(),
        service: transaction.service || "Dental Service",
        amount: paid,
        totalCharge: Number(transaction.total) || 0,
        discount: Number(transaction.discount) || 0,
        paymentMethod: transaction.paymentMethod || "Cash",
        status: getFinancePaymentStatus(transaction),
        reference: "N/A",
        notes: transaction.notes || "",
        createdTime: transaction.createdTime || "",
        createdAt: transaction.createdAt || "",
      }),
    );
  });
  payments.sort(function (a, b) {
    const dateA = new Date(`${a.date || ""}T${a.createdTime || "00:00:00"}`);
    const dateB = new Date(`${b.date || ""}T${b.createdTime || "00:00:00"}`);
    return dateB - dateA;
  });
}
function getFinancePaymentStatus(transaction) {
  const total = Number(transaction.total) || 0;
  const discount = Number(transaction.discount) || 0;
  const paid = Number(transaction.paid) || 0;
  const balance = Math.max(total - discount - paid, 0);
  if (balance <= 0) {
    return "paid";
  }
  if (paid > 0) {
    return "partial";
  }
  return "pending";
}
function loadPayments() {
  syncPaymentsFromFinance();
}
function normalizePayment(payment) {
  return {
    id: payment.id || "PAY-" + Date.now(),
    patientId: payment.patientId || CURRENT_PATIENT_ID,
    patientName: payment.patientName || CURRENT_PATIENT_NAME,
    transactionId: payment.transactionId || "",
    date: payment.date || new Date().toISOString(),
    service: payment.service || "Dental Service",
    amount: Number(payment.amount) || 0,
    totalCharge: Number(payment.totalCharge) || 0,
    discount: Number(payment.discount) || 0,
    paymentMethod: payment.paymentMethod || "Cash",
    status: normalizeStatus(payment.status),
    reference: payment.reference || "N/A",
    notes: payment.notes || "",
    createdTime: payment.createdTime || "",
    createdAt: payment.createdAt || "",
    cashReceived: Number(payment.cashReceived) || 0,
    change: Number(payment.change) || 0,
    gcashReference: payment.gcashReference || "",
    bankReference: payment.bankReference || "",
    cardReference: payment.cardReference || "",
  };
}
function normalizeStatus(status) {
  const value = String(status || "").toLowerCase();
  if (value === "paid" || value === "completed") {
    return "paid";
  }
  if (value === "partial" || value === "partially_paid") {
    return "partial";
  }
  return "pending";
}
function savePayments() {
  return true;
}
function bindPaymentEvents() {
  document.querySelectorAll(".payment-filter").forEach(function (button) {
    button.addEventListener("click", function () {
      document.querySelectorAll(".payment-filter").forEach(function (item) {
        item.classList.remove("active");
      });
      button.classList.add("active");
      currentFilter = button.dataset.filter || "all";
      resolveCurrentPatient();
      syncPaymentsFromFinance();
      renderPaymentHistory();
    });
  });
  const tableBody = document.getElementById("paymentTableBody");
  if (tableBody) {
    tableBody.addEventListener("click", function (event) {
      const viewButton = event.target.closest(".view-payment-btn");
      const payButton = event.target.closest(".pay-payment-btn");
      if (viewButton) {
        openPaymentById(viewButton.dataset.paymentId);
        return;
      }
      if (payButton) {
        openPayModalByTransaction(payButton.dataset.transactionId);
      }
    });
  }
  const mobileList = document.getElementById("paymentMobileList");
  if (mobileList) {
    mobileList.addEventListener("click", function (event) {
      const viewButton = event.target.closest(".view-payment-btn");
      const payButton = event.target.closest(".pay-payment-btn");
      if (viewButton) {
        openPaymentById(viewButton.dataset.paymentId);
        return;
      }
      if (payButton) {
        openPayModalByTransaction(payButton.dataset.transactionId);
      }
    });
  }
  const closeButton = document.getElementById("paymentModalClose");
  const overlay = document.getElementById("paymentModalOverlay");
  const receiptClose = document.getElementById("receiptModalClose");
  const receiptOverlay = document.getElementById("receiptModalOverlay");
  const receiptCloseButton = document.getElementById("receiptCloseButton");
  const printReceiptButton = document.getElementById("printReceiptButton");
  const payClose = document.getElementById("patientPayClose");
  const payOverlay = document.getElementById("patientPayOverlay");
  const payCancel = document.getElementById("patientPayCancel");
  const payMethod = document.getElementById("patientPayMethod");
  const payAmount = document.getElementById("patientPayAmount");
  const payForm = document.getElementById("patientPayForm");
  const patientVerificationClose = document.getElementById(
    "patientPaymentVerificationClose",
  );
  const patientVerificationOverlay = document.getElementById(
    "patientPaymentVerificationOverlay",
  );
  if (closeButton) {
    closeButton.addEventListener("click", closePaymentModal);
  }
  if (overlay) {
    overlay.addEventListener("click", closePaymentModal);
  }
  if (receiptClose) {
    receiptClose.addEventListener("click", closeReceiptModal);
  }
  if (receiptOverlay) {
    receiptOverlay.addEventListener("click", closeReceiptModal);
  }
  if (receiptCloseButton) {
    receiptCloseButton.addEventListener("click", closeReceiptModal);
  }
  if (printReceiptButton) {
    printReceiptButton.addEventListener("click", printCurrentReceipt);
  }
  if (payClose) {
    payClose.addEventListener("click", closePatientPayModal);
  }
  if (payOverlay) {
    payOverlay.addEventListener("click", closePatientPayModal);
  }
  if (payCancel) {
    payCancel.addEventListener("click", closePatientPayModal);
  }
  if (patientVerificationClose) {
    patientVerificationClose.addEventListener(
      "click",
      closePatientPaymentVerificationModal,
    );
  }
  if (patientVerificationOverlay) {
    patientVerificationOverlay.addEventListener(
      "click",
      closePatientPaymentVerificationModal,
    );
  }
  if (payMethod) {
    payMethod.addEventListener("change", function () {
      paymentProcessConfirmed = false;
      renderPatientPaymentProcess();
      updatePatientPaySubmitState();
    });
  }
  if (payAmount) {
    payAmount.addEventListener("input", function () {
      const remaining = getCurrentPayRemainingBalance();
      if (Number(payAmount.value) > remaining) {
        payAmount.value = remaining.toFixed(2);
      }
      paymentProcessConfirmed = false;
      renderPatientPaymentProcess();
      updatePatientPaySubmitState();
    });
  }
  if (payForm) {
    payForm.addEventListener("submit", function (event) {
      event.preventDefault();
      submitPatientPayment();
    });
  }
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closePatientPaymentVerificationModal();
      closeReceiptModal();
      closePaymentModal();
      closePatientPayModal();
    }
  });
}
function renderPayments() {
  resolveCurrentPatient();
  syncPaymentsFromFinance();
  renderSummary();
  renderPaymentHistory();
}
function getTransactionGroups() {
  const groups = {};
  payments.forEach(function (payment) {
    const id = payment.transactionId;
    if (!id) {
      return;
    }
    if (!groups[id]) {
      groups[id] = {
        transactionId: id,
        patientId: CURRENT_PATIENT_ID,
        patientName: payment.patientName || CURRENT_PATIENT_NAME,
        service: payment.service,
        totalCharge: Number(payment.totalCharge) || 0,
        discount: Number(payment.discount) || 0,
        payments: [],
      };
    }
    groups[id].payments.push(payment);
    groups[id].totalCharge = Math.max(
      groups[id].totalCharge,
      Number(payment.totalCharge) || 0,
    );
    groups[id].discount = Math.max(
      groups[id].discount,
      Number(payment.discount) || 0,
    );
  });
  Object.values(groups).forEach(function (group) {
    group.amountPaid = group.payments.reduce(function (total, payment) {
      return total + (Number(payment.amount) || 0);
    }, 0);
    group.balance = Math.max(
      group.totalCharge - group.discount - group.amountPaid,
      0,
    );
    group.payments.sort(function (a, b) {
      const dateA = new Date(`${a.date || ""}T${a.createdTime || "00:00:00"}`);
      const dateB = new Date(`${b.date || ""}T${b.createdTime || "00:00:00"}`);
      return dateB - dateA;
    });
  });
  return groups;
}
function getTransactionGroup(transactionId) {
  return getTransactionGroups()[transactionId] || null;
}
function renderSummary() {
  const totalPaid = payments.reduce(function (total, payment) {
    return total + (Number(payment.amount) || 0);
  }, 0);
  const groups = getTransactionGroups();
  const balance = Object.values(groups).reduce(function (total, group) {
    return total + group.balance;
  }, 0);
  setText("totalPaid", formatCurrency(totalPaid));
  setText("paymentCount", payments.length);
  setText("currentBalance", formatCurrency(balance));
  const balanceStatus = document.getElementById("balanceStatus");
  if (balanceStatus) {
    balanceStatus.textContent =
      balance > 0
        ? formatCurrency(balance) + " remaining"
        : "No outstanding balance";
  }
}
function renderPaymentHistory() {
  const tableBody = document.getElementById("paymentTableBody");
  const mobileList = document.getElementById("paymentMobileList");
  const emptyState = document.getElementById("paymentEmptyState");
  const count = document.getElementById("transactionCount");
  const filtered = getFilteredPayments();
  if (count) {
    count.textContent =
      filtered.length +
      (filtered.length === 1 ? " transaction" : " transactions");
  }
  if (filtered.length === 0) {
    if (tableBody) {
      tableBody.innerHTML = "";
    }
    if (mobileList) {
      mobileList.innerHTML = "";
    }
    if (emptyState) {
      emptyState.hidden = false;
    }
    return;
  }
  if (emptyState) {
    emptyState.hidden = true;
  }
  if (tableBody) {
    tableBody.innerHTML = filtered.map(createDesktopRow).join("");
  }
  if (mobileList) {
    mobileList.innerHTML = filtered.map(createMobileItem).join("");
  }
}
function getFilteredPayments() {
  const sorted = [...payments].sort(function (a, b) {
    const dateA = new Date(`${a.date || ""}T${a.createdTime || "00:00:00"}`);
    const dateB = new Date(`${b.date || ""}T${b.createdTime || "00:00:00"}`);
    return dateB - dateA;
  });
  if (currentFilter === "all") {
    return sorted;
  }
  return sorted.filter(function (payment) {
    return payment.status === currentFilter;
  });
}
function getPaymentBalance(payment) {
  const group = getTransactionGroup(payment.transactionId);
  if (!group) {
    return Math.max(
      Number(payment.totalCharge || 0) -
        Number(payment.discount || 0) -
        Number(payment.amount || 0),
      0,
    );
  }
  const totalCharge = Number(group.totalCharge) || 0;
  const discount = Number(group.discount) || 0;
  const transactionTotal = Math.max(totalCharge - discount, 0);
  const history = [...group.payments].sort(function (a, b) {
    const dateA = new Date(`${a.date || ""}T${a.createdTime || "00:00:00"}`);
    const dateB = new Date(`${b.date || ""}T${b.createdTime || "00:00:00"}`);
    return dateA - dateB;
  });
  let paidBeforeThisPayment = 0;
  for (let i = 0; i < history.length; i++) {
    if (String(history[i].id) === String(payment.id)) {
      break;
    }
    paidBeforeThisPayment += Number(history[i].amount) || 0;
  }
  const paymentAmount = Number(payment.amount) || 0;
  const paidAfterThisPayment = Math.min(
    transactionTotal,
    paidBeforeThisPayment + paymentAmount,
  );
  return Math.max(transactionTotal - paidAfterThisPayment, 0);
}
function createDesktopRow(payment) {
  const group = getTransactionGroup(payment.transactionId);
  const totalCharge = group
    ? group.totalCharge
    : Number(payment.totalCharge) || 0;
  const discount = group ? group.discount : Number(payment.discount) || 0;
  const amountPaid = Number(payment.amount) || 0;
  const balance = getPaymentBalance(payment);
  const status =
    balance <= 0
      ? getStatusData("paid")
      : amountPaid > 0
        ? getStatusData("partial")
        : getStatusData("pending");
  return `
    <tr>
      <td>
        <span class="transaction-id">${escapeHtml(payment.transactionId || "N/A")}</span>
        <span class="transaction-reference">${escapeHtml(payment.id || "N/A")}</span>
      </td>
      <td>
        <span class="service-name">${escapeHtml(payment.service)}</span>
      </td>
      <td>${formatDate(payment.date)}</td>
      <td>
        <span class="payment-amount">${formatCurrency(totalCharge)}</span>
      </td>
      <td>
        <span class="payment-discount">${formatCurrency(discount)}</span>
      </td>
      <td>
        <span class="payment-amount">${formatCurrency(amountPaid)}</span>
      </td>
      <td>
        <span class="payment-method">
          <i class="${getPaymentMethodIcon(payment.paymentMethod)}"></i>
          ${escapeHtml(payment.paymentMethod)}
        </span>
      </td>
      <td>
        <span class="payment-balance">${formatCurrency(balance)}</span>
      </td>
      <td>
        <span class="payment-status-badge ${status.className}">${status.label}</span>
      </td>
      <td>
        <div class="payment-action-group">
          <button
            type="button"
            class="view-payment-btn"
            data-payment-id="${escapeAttribute(payment.id)}"
            title="View payment"
          >
            <i class="fa-regular fa-eye"></i>
          </button>
          ${
            balance > 0
              ? `
                <button
                  type="button"
                  class="pay-payment-btn"
                  data-transaction-id="${escapeAttribute(payment.transactionId)}"
                  title="Pay remaining balance"
                >
                  <i class="fa-solid fa-plus"></i>
                </button>
              `
              : ""
          }
        </div>
      </td>
    </tr>
  `;
}
function createMobileItem(payment) {
  const group = getTransactionGroup(payment.transactionId);
  const totalCharge = group
    ? group.totalCharge
    : Number(payment.totalCharge) || 0;
  const discount = group ? group.discount : Number(payment.discount) || 0;
  const amountPaid = Number(payment.amount) || 0;
  const balance = getPaymentBalance(payment);
  const status =
    balance <= 0
      ? getStatusData("paid")
      : amountPaid > 0
        ? getStatusData("partial")
        : getStatusData("pending");
  return `
    <article class="mobile-payment-item">
      <div class="mobile-payment-top">
        <div>
          <div class="mobile-payment-id">${escapeHtml(payment.transactionId || "N/A")}</div>
          <div class="mobile-payment-date">${formatDate(payment.date)}</div>
        </div>
        <span class="payment-status-badge ${status.className}">
          ${status.label}
        </span>
      </div>
      <div class="mobile-payment-service">
        ${escapeHtml(payment.service)}
      </div>
      <div class="mobile-payment-details">
        <div class="mobile-payment-detail">
          <span>Total</span>
          <strong>${formatCurrency(totalCharge)}</strong>
        </div>
        <div class="mobile-payment-detail">
          <span>Discount</span>
          <strong>${formatCurrency(discount)}</strong>
        </div>
        <div class="mobile-payment-detail">
          <span>Paid</span>
          <strong>${formatCurrency(amountPaid)}</strong>
        </div>
        <div class="mobile-payment-detail">
          <span>Balance</span>
          <strong>${formatCurrency(balance)}</strong>
        </div>
        <div class="mobile-payment-detail">
          <span>Payment Method</span>
          <strong>${escapeHtml(payment.paymentMethod)}</strong>
        </div>
      </div>
      <div class="mobile-payment-bottom">
        <span class="transaction-reference">
          ${escapeHtml(payment.id || "N/A")}
        </span>
        <div class="mobile-payment-actions">
          <button
            type="button"
            class="view-payment-btn"
            data-payment-id="${escapeAttribute(payment.id)}"
            title="View payment"
          >
            <i class="fa-regular fa-eye"></i>
          </button>
          ${
            balance > 0
              ? `
                <button
                  type="button"
                  class="pay-payment-btn"
                  data-transaction-id="${escapeAttribute(payment.transactionId)}"
                  title="Pay remaining balance"
                >
                  <i class="fa-solid fa-plus"></i>
                </button>
              `
              : ""
          }
        </div>
      </div>
    </article>
  `;
}
function openPaymentById(id) {
  const payment = payments.find(function (item) {
    return item.id === id;
  });
  if (!payment) {
    return;
  }
  openPaymentModal(payment);
}
function openPaymentModal(payment) {
  const modal = document.getElementById("paymentModal");
  const body = document.getElementById("paymentModalBody");
  if (!modal || !body) {
    return;
  }
  const group = getTransactionGroup(payment.transactionId);
  const totalCharge = group
    ? group.totalCharge
    : Number(payment.totalCharge) || 0;
  const transactionPaid = group
    ? group.payments
        .slice()
        .sort(function (a, b) {
          const dateA = new Date(
            `${a.date || ""}T${a.createdTime || "00:00:00"}`,
          );
          const dateB = new Date(
            `${b.date || ""}T${b.createdTime || "00:00:00"}`,
          );
          return dateA - dateB;
        })
        .reduce(function (total, item) {
          const currentDate = new Date(
            `${item.date || ""}T${item.createdTime || "00:00:00"}`,
          );
          const selectedDate = new Date(
            `${payment.date || ""}T${payment.createdTime || "00:00:00"}`,
          );
          return currentDate <= selectedDate
            ? total + (Number(item.amount) || 0)
            : total;
        }, 0)
    : Number(payment.amount) || 0;
  const balance = getPaymentBalance(payment);
  const status =
    balance <= 0
      ? getStatusData("paid")
      : transactionPaid > 0
        ? getStatusData("partial")
        : getStatusData("pending");
  body.innerHTML = `
    <div class="modal-payment-id">
      <span>TRANSACTION ID</span>
      <strong>${escapeHtml(payment.transactionId || "N/A")}</strong>
    </div>
    <div class="modal-detail-grid">
      <div class="modal-detail-item">
        <span>DATE</span>
        <strong>${formatDate(payment.date)}</strong>
      </div>
      <div class="modal-detail-item">
        <span>STATUS</span>
        <strong>${status.label}</strong>
      </div>
      <div class="modal-detail-item">
        <span>PATIENT</span>
        <strong>${escapeHtml(payment.patientName)}</strong>
      </div>
      <div class="modal-detail-item">
        <span>SERVICE</span>
        <strong>${escapeHtml(payment.service)}</strong>
      </div>
      <div class="modal-detail-item">
        <span>PAYMENT METHOD</span>
        <strong>${escapeHtml(payment.paymentMethod)}</strong>
      </div>
      <div class="modal-detail-item">
        <span>REFERENCE NUMBER</span>
        <strong>${escapeHtml(payment.reference || "N/A")}</strong>
      </div>
      <div class="modal-detail-item">
        <span>TOTAL CHARGE</span>
        <strong>${formatCurrency(totalCharge)}</strong>
      </div>
      <div class="modal-detail-item">
        <span>DISCOUNT</span>
        <strong>${formatCurrency(payment.discount)}</strong>
      </div>
      <div class="modal-detail-item">
        <span>THIS PAYMENT</span>
        <strong>${formatCurrency(payment.amount)}</strong>
      </div>
      <div class="modal-detail-item">
        <span>TRANSACTION PAID</span>
        <strong>${formatCurrency(transactionPaid)}</strong>
      </div>
      <div class="modal-detail-item">
        <span>REMAINING BALANCE</span>
        <strong>${formatCurrency(balance)}</strong>
      </div>
      <div class="modal-detail-item">
        <span>NOTES</span>
        <strong>${escapeHtml(payment.notes || "No additional notes")}</strong>
      </div>
    </div>
    <div class="modal-total">
      <span>THIS PAYMENT AMOUNT</span>
      <strong>${formatCurrency(payment.amount)}</strong>
    </div>
    <div class="modal-receipt-action">
      <button
        type="button"
        class="modal-receipt-button"
        id="viewReceiptButton"
      >
        <i class="fa-solid fa-receipt"></i>
        View Receipt
      </button>
    </div>
    ${
      balance > 0
        ? `
          <div class="modal-pay-action">
            <button type="button" id="modalPayRemainingButton">
              <i class="fa-solid fa-plus"></i>
              Pay Remaining Balance
            </button>
          </div>
        `
        : ""
    }
  `;
  const viewReceiptButton = document.getElementById("viewReceiptButton");
  if (viewReceiptButton) {
    viewReceiptButton.addEventListener("click", function () {
      openReceiptModal(payment);
    });
  }
  const modalPayRemainingButton = document.getElementById(
    "modalPayRemainingButton",
  );
  if (modalPayRemainingButton) {
    modalPayRemainingButton.addEventListener("click", function () {
      closePaymentModal();
      openPayModalByTransaction(payment.transactionId);
    });
  }
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}
function openReceiptModal(payment) {
  const modal = document.getElementById("receiptModal");
  const body = document.getElementById("receiptModalBody");
  if (!modal || !body) {
    return;
  }
  currentReceiptPayment = payment;
  const balance = getPaymentBalance(payment);
  const group = getTransactionGroup(payment.transactionId);
  const transactionPaid = group
    ? group.amountPaid
    : Number(payment.amount) || 0;
  const status =
    balance <= 0
      ? getStatusData("paid")
      : transactionPaid > 0
        ? getStatusData("partial")
        : getStatusData("pending");
  body.innerHTML = `
    <div class="receipt-paper" id="receiptPaper">
      <div class="receipt-clinic">
        <div class="receipt-clinic-icon">
          <i class="fa-solid fa-tooth"></i>
        </div>
        <h3>DentaNueva Dental Clinic</h3>
        <p>Official Payment Receipt</p>
      </div>
      <div class="receipt-title">Payment Receipt</div>
      <div class="receipt-info">
        <div class="receipt-info-item">
          <span>Transaction ID</span>
          <strong>${escapeHtml(payment.transactionId || "N/A")}</strong>
        </div>
        <div class="receipt-info-item">
          <span>Payment ID</span>
          <strong>${escapeHtml(payment.id || "N/A")}</strong>
        </div>
        <div class="receipt-info-item">
          <span>Patient</span>
          <strong>${escapeHtml(payment.patientName)}</strong>
        </div>
        <div class="receipt-info-item">
          <span>Patient ID</span>
          <strong>${escapeHtml(payment.patientId)}</strong>
        </div>
        <div class="receipt-info-item">
          <span>Service</span>
          <strong>${escapeHtml(payment.service)}</strong>
        </div>
        <div class="receipt-info-item">
          <span>Date</span>
          <strong>${formatDate(payment.date)}</strong>
        </div>
        <div class="receipt-info-item">
          <span>Payment Method</span>
          <strong>${escapeHtml(payment.paymentMethod)}</strong>
        </div>
        <div class="receipt-info-item">
          <span>Reference Number</span>
          <strong>${escapeHtml(payment.reference || "N/A")}</strong>
        </div>
        <div class="receipt-info-item">
          <span>Status</span>
          <strong>${status.label}</strong>
        </div>
        <div class="receipt-info-item">
          <span>Total Charge</span>
          <strong>${formatCurrency(payment.totalCharge)}</strong>
        </div>
      </div>
      <div class="receipt-payment-total">
        <span>AMOUNT PAID</span>
        <strong>${formatCurrency(payment.amount)}</strong>
      </div>
      <div class="receipt-balance">
        <span>Remaining Balance</span>
        <strong>${formatCurrency(balance)}</strong>
      </div>
      <div class="receipt-footer">
        <p>${escapeHtml(payment.notes || "Thank you for your payment.")}</p>
        <p>This receipt represents the selected payment transaction.</p>
      </div>
    </div>
  `;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}
function closeReceiptModal() {
  const modal = document.getElementById("receiptModal");
  if (!modal) {
    return;
  }
  modal.hidden = true;
  currentReceiptPayment = null;
  if (
    document.getElementById("paymentModal")?.hidden !== false &&
    document.getElementById("patientPayModal")?.hidden !== false
  ) {
    document.body.style.overflow = "";
  }
}
function printCurrentReceipt() {
  if (!currentReceiptPayment) {
    return;
  }
  const payment = currentReceiptPayment;
  const balance = getPaymentBalance(payment);
  const group = getTransactionGroup(payment.transactionId);
  const transactionPaid = group
    ? group.amountPaid
    : Number(payment.amount) || 0;
  const status =
    balance <= 0
      ? getStatusData("paid")
      : transactionPaid > 0
        ? getStatusData("partial")
        : getStatusData("pending");
  const printWindow = window.open("", "_blank", "width=700,height=800");
  if (!printWindow) {
    showPaymentMessage("Please allow pop-ups to print the receipt.");
    return;
  }
  printWindow.document.write(`
    <!doctype html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Payment Receipt - ${escapeHtml(
        payment.transactionId || "N/A",
      )}</title>
      <style>
        * {
          box-sizing: border-box;
        }
        body {
          margin: 0;
          padding: 30px;
          background: #fff;
          color: #24332a;
          font-family: Arial, sans-serif;
        }
        .receipt {
          width: 100%;
          max-width: 620px;
          margin: 0 auto;
          padding: 25px;
          border: 1px solid #dfe7e2;
        }
        .clinic {
          text-align: center;
          padding-bottom: 18px;
          border-bottom: 1px dashed #cfd8d2;
        }
        .clinic h1 {
          margin: 0;
          font-size: 22px;
        }
        .clinic p {
          margin: 5px 0 0;
          color: #68756d;
          font-size: 12px;
        }
        .title {
          margin: 20px 0;
          text-align: center;
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .item {
          padding: 10px;
          border: 1px solid #e4ebe6;
        }
        .item span {
          display: block;
          margin-bottom: 5px;
          color: #7c8981;
          font-size: 9px;
          text-transform: uppercase;
        }
        .item strong {
          display: block;
          font-size: 11px;
          word-break: break-word;
        }
        .amount {
          margin-top: 15px;
          padding: 15px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #eaf7ef;
        }
        .amount span {
          font-size: 10px;
          font-weight: 700;
        }
        .amount strong {
          color: #16803d;
          font-size: 18px;
        }
        .balance {
          margin-top: 8px;
          padding: 12px;
          display: flex;
          justify-content: space-between;
          border: 1px solid #f0dfbd;
          background: #fff7e9;
        }
        .footer {
          margin-top: 20px;
          padding-top: 15px;
          border-top: 1px dashed #cfd8d2;
          text-align: center;
          color: #7c8981;
          font-size: 9px;
          line-height: 1.5;
        }
        @media print {
          body {
            padding: 0;
          }
          .receipt {
            border: 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="clinic">
          <h1>DentaNueva Dental Clinic</h1>
          <p>Official Payment Receipt</p>
        </div>
        <div class="title">Payment Receipt</div>
        <div class="grid">
          <div class="item">
            <span>Transaction ID</span>
            <strong>${escapeHtml(payment.transactionId || "N/A")}</strong>
          </div>
          <div class="item">
            <span>Payment ID</span>
            <strong>${escapeHtml(payment.id || "N/A")}</strong>
          </div>
          <div class="item">
            <span>Patient</span>
            <strong>${escapeHtml(payment.patientName)}</strong>
          </div>
          <div class="item">
            <span>Patient ID</span>
            <strong>${escapeHtml(payment.patientId)}</strong>
          </div>
          <div class="item">
            <span>Service</span>
            <strong>${escapeHtml(payment.service)}</strong>
          </div>
          <div class="item">
            <span>Date</span>
            <strong>${formatDate(payment.date)}</strong>
          </div>
          <div class="item">
            <span>Payment Method</span>
            <strong>${escapeHtml(payment.paymentMethod)}</strong>
          </div>
          <div class="item">
            <span>Reference Number</span>
            <strong>${escapeHtml(payment.reference || "N/A")}</strong>
          </div>
          <div class="item">
            <span>Status</span>
            <strong>${status.label}</strong>
          </div>
          <div class="item">
            <span>Total Charge</span>
            <strong>${formatCurrency(payment.totalCharge)}</strong>
          </div>
        </div>
        <div class="amount">
          <span>AMOUNT PAID</span>
          <strong>${formatCurrency(payment.amount)}</strong>
        </div>
        <div class="balance">
          <span>Remaining Balance</span>
          <strong>${formatCurrency(balance)}</strong>
        </div>
        <div class="footer">
          <div>${escapeHtml(
            payment.notes || "Thank you for your payment.",
          )}</div>
          <div>This receipt represents the selected payment transaction.</div>
        </div>
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(function () {
    printWindow.print();
  }, 300);
}
function openPayModalByTransaction(transactionId) {
  syncPaymentsFromFinance();
  const group = getTransactionGroup(transactionId);
  if (!group || group.balance <= 0) {
    return;
  }
  currentPayTransaction = group;
  resetPatientPaymentVerification();
  setText("payService", group.service);
  setText("payTotal", formatCurrency(group.totalCharge));
  setText("payAlreadyPaid", formatCurrency(group.amountPaid));
  setText("payRemainingBalance", formatCurrency(group.balance));
  const amountInput = document.getElementById("patientPayAmount");
  const methodInput = document.getElementById("patientPayMethod");
  const notesInput = document.getElementById("patientPayNotes");
  const processBox = document.getElementById("patientPayProcess");
  if (amountInput) {
    amountInput.value = group.balance.toFixed(2);
    amountInput.max = group.balance.toFixed(2);
    amountInput.disabled = true;
  }
  if (methodInput) {
    methodInput.value = "";
  }
  if (notesInput) {
    notesInput.value = "";
  }
  if (processBox) {
    processBox.hidden = true;
    processBox.innerHTML = "";
  }
  const hint = document.getElementById("patientPayAmountHint");
  if (hint) {
    hint.textContent = "Maximum payment: " + formatCurrency(group.balance);
  }
  updatePatientPaySubmitState();
  const modal = document.getElementById("patientPayModal");
  if (modal) {
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }
}
function renderPatientPaymentProcess() {
  const wrapper = document.getElementById("patientPayProcess");
  const methodInput = document.getElementById("patientPayMethod");
  const amountInput = document.getElementById("patientPayAmount");
  if (!wrapper || !methodInput || !amountInput || !currentPayTransaction) {
    return;
  }
  const method = methodInput.value;
  const amount = Number(amountInput.value) || 0;
  if (!method || amount <= 0) {
    wrapper.hidden = true;
    wrapper.innerHTML = "";
    closePatientPaymentVerificationModal();
    return;
  }
  const state = getPatientPaymentVerificationState();
  if (state.method !== method) {
    state.method = method;
    state.referenceNumber = "";
    state.cashReceived = 0;
    state.changeAmount = 0;
    paymentProcessConfirmed = false;
  }
  wrapper.hidden = true;
  wrapper.innerHTML = "";
  if (!paymentProcessConfirmed) {
    openPatientPaymentVerificationModal();
  } else {
    closePatientPaymentVerificationModal();
    showPatientPaymentProcessStatus();
  }
}
function getPatientPaymentVerificationState() {
  return patientPaymentVerificationState;
}
function getPatientPaymentVerificationElements() {
  return {
    modal: document.getElementById("patientPaymentVerificationModal"),
    box: document.getElementById("patientPaymentVerificationBox"),
    close: document.getElementById("patientPaymentVerificationClose"),
  };
}
function closePatientPaymentVerificationModal() {
  const elements = getPatientPaymentVerificationElements();
  if (patientPaymentVerificationEditing) {
    if (patientPaymentVerificationPreviousState) {
      patientPaymentVerificationState = {
        referenceNumber:
          patientPaymentVerificationPreviousState.referenceNumber,
        cashReceived: patientPaymentVerificationPreviousState.cashReceived,
        changeAmount: patientPaymentVerificationPreviousState.changeAmount,
        method: patientPaymentVerificationPreviousState.method,
      };
    }
    patientPaymentVerificationEditing = false;
    patientPaymentVerificationPreviousState = null;
    paymentProcessConfirmed = true;
    showPatientPaymentProcessStatus();
    updatePatientPaySubmitState();
  }
  if (elements.modal) {
    elements.modal.hidden = true;
  }
}
function openPatientPaymentVerificationModal() {
  const elements = getPatientPaymentVerificationElements();
  const methodInput = document.getElementById("patientPayMethod");
  const amountInput = document.getElementById("patientPayAmount");
  if (!elements.modal || !elements.box || !methodInput || !amountInput) {
    return;
  }
  const method = methodInput.value;
  const amount = Number(amountInput.value) || 0;
  if (!method || amount <= 0 || !currentPayTransaction) {
    closePatientPaymentVerificationModal();
    return;
  }
  const state = getPatientPaymentVerificationState();
  if (state.method !== method) {
    state.method = method;
    state.referenceNumber = "";
    state.cashReceived = 0;
    state.changeAmount = 0;
  }
  elements.box.innerHTML = "";
  elements.modal.hidden = false;
  renderPatientPaymentVerificationContent(method);
}
function renderPatientPaymentVerificationContent(method) {
  const elements = getPatientPaymentVerificationElements();
  const amountInput = document.getElementById("patientPayAmount");
  if (!elements.box || !amountInput) {
    return;
  }
  const state = getPatientPaymentVerificationState();
  const remaining = getCurrentPayRemainingBalance();
  const amountToPay = Math.min(Number(amountInput.value) || 0, remaining);
  const methodConfig = {
    Cash: [
      "fa-solid fa-money-bill-wave",
      "Cash Payment",
      "Enter the cash amount received from the patient.",
    ],
    GCash: [
      "fa-solid fa-mobile-screen-button",
      "GCash Payment",
      "Verify the GCash payment before submitting it.",
    ],
    "Bank Transfer": [
      "fa-solid fa-building-columns",
      "Bank Transfer",
      "Verify the transfer reference before submitting it.",
    ],
    Card: [
      "fa-regular fa-credit-card",
      "Card Payment",
      "Verify the card authorization before submitting it.",
    ],
  };
  const config = methodConfig[method];
  if (!config) {
    return;
  }
  elements.box.innerHTML = `
    <div class="patient-payment-verification-header">
      <div class="patient-payment-verification-icon">
        <i class="${config[0]}"></i>
      </div>
      <div>
        <span class="patient-payment-verification-label">
          PAYMENT VERIFICATION
        </span>
        <h3>${escapeHtml(config[1])}</h3>
        <p>${escapeHtml(config[2])}</p>
      </div>
    </div>
    <div class="patient-payment-verification-summary">
      <div>
        <span>Remaining Balance</span>
        <strong>${formatCurrency(remaining)}</strong>
      </div>
      <div>
        <span>Payment Amount</span>
        <strong id="patientVerificationPaymentAmount">
          ${formatCurrency(amountToPay)}
        </strong>
      </div>
    </div>
  `;
  if (method === "GCash") {
    elements.box.insertAdjacentHTML(
      "beforeend",
      `
        <div class="patient-payment-verification-qr">
          <div class="patient-payment-verification-qr-box">
            <i class="fa-solid fa-qrcode"></i>
          </div>
          <strong>Clinic GCash QR</strong>
          <span>
            Scan the clinic's GCash QR code to make your payment.
          </span>
        </div>
      `,
    );
  }
  if (method === "Bank Transfer") {
    elements.box.insertAdjacentHTML(
      "beforeend",
      `
        <div class="patient-payment-verification-bank">
          <div>
            <span>Account Name</span>
            <strong>DentaNueva Dental Clinic</strong>
          </div>
          <div>
            <span>Bank</span>
            <strong>DentaNueva Partner Bank</strong>
          </div>
          <div>
            <span>Account Number</span>
            <strong>XXXX-XXXX-XXXX</strong>
          </div>
        </div>
      `,
    );
  }
  if (method === "Cash") {
    const receivedValue =
      state.cashReceived > 0 ? state.cashReceived.toFixed(2) : "";
    elements.box.insertAdjacentHTML(
      "beforeend",
      `
        <div class="patient-payment-verification-fields">
          <div class="patient-payment-verification-field">
            <label for="patientVerificationAmountReceived">
              Cash Given
            </label>
            <div class="patient-payment-verification-amount">
              <span>₱</span>
              <input
                type="number"
                id="patientVerificationAmountReceived"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value="${receivedValue}"
              />
            </div>
          </div>
          <div class="patient-payment-verification-field">
            <label>Change</label>
            <div
              class="patient-payment-verification-static"
              id="patientVerificationChange"
            >
              ${formatCurrency(state.changeAmount)}
            </div>
          </div>
        </div>
      `,
    );
    const receivedInput = document.getElementById(
      "patientVerificationAmountReceived",
    );
    const changeOutput = document.getElementById("patientVerificationChange");
    if (receivedInput) {
      receivedInput.addEventListener("input", function () {
        paymentProcessConfirmed = false;
        const received = Number(receivedInput.value) || 0;
        const paymentAmount = Math.min(received, remaining);
        const change = Math.max(received - remaining, 0);
        state.cashReceived = received;
        state.changeAmount = change;
        if (changeOutput) {
          changeOutput.textContent = formatCurrency(change);
        }
        const paymentOutput = document.getElementById(
          "patientVerificationPaymentAmount",
        );
        if (paymentOutput) {
          paymentOutput.textContent = formatCurrency(paymentAmount);
        }
        updatePatientPaySubmitState();
      });
    }
  }
  if (method !== "Cash") {
    const referenceLabel =
      method === "GCash"
        ? "GCash Reference Number"
        : method === "Bank Transfer"
          ? "Transfer Reference Number"
          : "Authorization / Reference Number";
    const referenceId =
      method === "GCash"
        ? "patientVerificationGcashReference"
        : method === "Bank Transfer"
          ? "patientVerificationBankReference"
          : "patientVerificationCardReference";
    elements.box.insertAdjacentHTML(
      "beforeend",
      `
        <div class="patient-payment-verification-fields">
          <div class="patient-payment-verification-field">
            <label for="${referenceId}">
              ${referenceLabel}
            </label>
            <input
              type="text"
              id="${referenceId}"
              placeholder="Enter reference number"
              value="${escapeHtml(state.referenceNumber)}"
            />
          </div>
        </div>
      `,
    );
    const referenceInput = document.getElementById(referenceId);
    if (referenceInput) {
      referenceInput.addEventListener("input", function () {
        paymentProcessConfirmed = false;
        state.referenceNumber = referenceInput.value.trim();
        updatePatientPaySubmitState();
      });
    }
  }
  const confirmButton = document.createElement("button");
  confirmButton.type = "button";
  confirmButton.className =
    "primary-button patient-payment-verification-confirm";
  confirmButton.textContent =
    method === "Cash"
      ? "Confirm Cash"
      : method === "GCash"
        ? "Confirm GCash"
        : method === "Bank Transfer"
          ? "Confirm Transfer"
          : "Confirm Card";
  elements.box.appendChild(confirmButton);
  confirmButton.addEventListener("click", function () {
    const currentRemaining = getCurrentPayRemainingBalance();
    if (currentRemaining <= 0) {
      showPaymentMessage("This payment is already fully paid.");
      return;
    }
    if (method === "Cash") {
      const received =
        Number(
          document.getElementById("patientVerificationAmountReceived")?.value,
        ) || 0;
      if (received <= 0) {
        showPaymentMessage("Please enter the cash amount given.");
        return;
      }
      if (received < currentRemaining) {
        showPaymentMessage(
          "Cash given cannot be less than the remaining balance.",
        );
        return;
      }
      state.cashReceived = received;
      state.changeAmount = Math.max(received - currentRemaining, 0);
      paymentProcessConfirmed = true;
      patientPaymentVerificationEditing = false;
      patientPaymentVerificationPreviousState = null;
      closePatientPaymentVerificationModal();
      showPatientPaymentProcessStatus();
      updatePatientPaySubmitState();
      return;
    }
    const referenceId =
      method === "GCash"
        ? "patientVerificationGcashReference"
        : method === "Bank Transfer"
          ? "patientVerificationBankReference"
          : "patientVerificationCardReference";
    const reference = document.getElementById(referenceId)?.value.trim() || "";
    if (!reference) {
      showPaymentMessage(
        method === "GCash"
          ? "Please enter the GCash reference number."
          : method === "Bank Transfer"
            ? "Please enter the transfer reference number."
            : "Please enter the card authorization or reference number.",
      );
      return;
    }
    state.referenceNumber = reference;
    paymentProcessConfirmed = true;
    patientPaymentVerificationEditing = false;
    patientPaymentVerificationPreviousState = null;
    closePatientPaymentVerificationModal();
    showPatientPaymentProcessStatus();
    updatePatientPaySubmitState();
  });
}
function showPatientPaymentProcessStatus() {
  const wrapper = document.getElementById("patientPayProcess");
  const methodInput = document.getElementById("patientPayMethod");
  if (!wrapper || !methodInput || !paymentProcessConfirmed) {
    if (wrapper) {
      wrapper.hidden = true;
      wrapper.innerHTML = "";
    }
    return;
  }
  const state = getPatientPaymentVerificationState();
  const method = methodInput.value;
  const detail =
    method === "Cash"
      ? `Cash verified${
          state.changeAmount > 0
            ? ` · Change ${formatCurrency(state.changeAmount)}`
            : ""
        }`
      : `${method} verified${
          state.referenceNumber ? ` · Ref ${state.referenceNumber}` : ""
        }`;
  wrapper.hidden = false;
  wrapper.innerHTML = `
    <div class="patient-payment-process-status">
      <div>
        <i class="fa-solid fa-circle-check"></i>
        <span>${escapeHtml(detail)}</span>
      </div>
      <button
        type="button"
        id="patientEditPaymentProcess"
      >
        Edit
      </button>
    </div>
  `;
  const editButton = document.getElementById("patientEditPaymentProcess");
  if (editButton) {
    editButton.addEventListener("click", function () {
      patientPaymentVerificationEditing = true;
      patientPaymentVerificationPreviousState = {
        referenceNumber: patientPaymentVerificationState.referenceNumber,
        cashReceived: patientPaymentVerificationState.cashReceived,
        changeAmount: patientPaymentVerificationState.changeAmount,
        method: patientPaymentVerificationState.method,
      };
      paymentProcessConfirmed = false;
      openPatientPaymentVerificationModal();
      updatePatientPaySubmitState();
    });
  }
}
function resetPatientPaymentVerification() {
  paymentProcessConfirmed = false;
  patientPaymentVerificationEditing = false;
  patientPaymentVerificationPreviousState = null;
  patientPaymentVerificationState = {
    referenceNumber: "",
    cashReceived: 0,
    changeAmount: 0,
    method: "",
  };
  closePatientPaymentVerificationModal();
  const wrapper = document.getElementById("patientPayProcess");
  if (wrapper) {
    wrapper.hidden = true;
    wrapper.innerHTML = "";
  }
}
function attachReferenceProcess(inputId, buttonId, method) {
  const input = document.getElementById(inputId);
  const button = document.getElementById(buttonId);
  if (input) {
    input.addEventListener("input", function () {
      paymentProcessConfirmed = false;
      updatePatientPaySubmitState();
    });
  }
  if (button) {
    button.addEventListener("click", function () {
      const value = input?.value.trim() || "";
      if (!value) {
        showPaymentMessage(
          method === "GCash"
            ? "Please enter the GCash reference number."
            : method === "Bank Transfer"
              ? "Please enter the transfer reference number."
              : "Please enter the card authorization or reference number.",
        );
        return;
      }
      paymentProcessConfirmed = true;
      updatePatientPaySubmitState();
      showProcessConfirmed(
        button,
        method === "GCash"
          ? "GCash Confirmed"
          : method === "Bank Transfer"
            ? "Transfer Confirmed"
            : "Card Confirmed",
      );
    });
  }
}
function showProcessConfirmed(button, text) {
  if (!button) {
    return;
  }
  button.textContent = text;
  button.disabled = true;
  button.style.opacity = "0.7";
}
function updatePatientPaySubmitState() {
  const submit = document.getElementById("patientPaySubmit");
  const amountInput = document.getElementById("patientPayAmount");
  const methodInput = document.getElementById("patientPayMethod");
  if (!submit || !amountInput || !methodInput) {
    return;
  }
  const amount = Number(amountInput.value) || 0;
  const remaining = getCurrentPayRemainingBalance();
  submit.disabled = !(
    currentPayTransaction &&
    amount > 0 &&
    amount <= remaining &&
    methodInput.value &&
    paymentProcessConfirmed
  );
}
function getCurrentPayRemainingBalance() {
  return currentPayTransaction ? Number(currentPayTransaction.balance) || 0 : 0;
}
async function submitPatientPayment() {
  if (!currentPayTransaction) {
    return;
  }
  const amountInput = document.getElementById("patientPayAmount");
  const methodInput = document.getElementById("patientPayMethod");
  const notesInput = document.getElementById("patientPayNotes");
  const amount = Number(amountInput?.value) || 0;
  const method = methodInput?.value || "";
  const notes = notesInput?.value.trim() || "";
  const remaining = Number(currentPayTransaction.balance) || 0;
  const cashReceived =
    method === "Cash"
      ? Number(
          document.getElementById("patientVerificationAmountReceived")?.value,
        ) || 0
      : amount;
  const paymentAmount =
    method === "Cash" ? Math.min(cashReceived, remaining) : amount;
  if (paymentAmount <= 0) {
    showPaymentMessage("Please enter a valid payment amount.");
    return;
  }
  if (paymentAmount > remaining) {
    showPaymentMessage("Payment amount cannot exceed the remaining balance.");
    return;
  }
  if (!method) {
    showPaymentMessage("Please select a payment method.");
    return;
  }
  if (!paymentProcessConfirmed) {
    showPaymentMessage("Please complete the payment process first.");
    return;
  }
  let financeTransactions = [];
  try {
    const response = await fetch(FINANCE_API, { credentials: "same-origin", cache: "no-store" });
    const result = await response.json();
    if (!response.ok || !result.success || !Array.isArray(result.data)) throw new Error(result.message || "Finance transaction unavailable.");
    financeTransactions = result.data;
  } catch (error) {
    financeTransactions = [];
  }
  const transactionIndex = financeTransactions.findIndex(
    function (transaction) {
      return (
        String(transaction.id || "") ===
        String(currentPayTransaction.transactionId || "")
      );
    },
  );
  if (transactionIndex === -1) {
    showPaymentMessage("The Finance transaction could not be found.");
    return;
  }
  const transaction = financeTransactions[transactionIndex];
  if (String(transaction.patientId || "").trim() !== CURRENT_PATIENT_ID) {
    showPaymentMessage(
      "This transaction does not belong to the current patient account.",
    );
    return;
  }
  const total = Number(transaction.total) || 0;
  const discount = Number(transaction.discount) || 0;
  const transactionTotal = Math.max(total - discount, 0);
  const history = Array.isArray(transaction.paymentHistory)
    ? [...transaction.paymentHistory]
    : [];
  const currentPaid = Number(transaction.paid) || 0;
  const actualRemaining = Math.max(transactionTotal - currentPaid, 0);
  if (actualRemaining <= 0) {
    showPaymentMessage("This transaction has already been fully paid.");
    closePatientPayModal();
    syncPaymentsFromFinance();
    renderPayments();
    return;
  }
  if (paymentAmount > actualRemaining) {
    showPaymentMessage(
      "The payment amount is greater than the remaining balance.",
    );
    return;
  }
  const now = new Date();
  const paymentId = `${
    transaction.id || "TXN"
  }-PAY-${history.length + 1}-${Date.now()}`;
  const newHistoryPayment = {
    id: paymentId,
    patientId: CURRENT_PATIENT_ID,
    patientName: transaction.patientName || CURRENT_PATIENT_NAME,
    transactionId: transaction.id || "",
    date: now.toISOString(),
    service: transaction.service || "Dental Service",
    amount: paymentAmount,
    paymentMethod: method,
    reference: getPaymentReference(),
    notes: notes,
    createdTime: now.toTimeString().slice(0, 8),
    createdAt: now.toISOString(),
  };
  if (method === "Cash") {
    const cashReceived =
      Number(
        document.getElementById("patientVerificationAmountReceived")?.value,
      ) || 0;
    const actualCashPayment = Math.min(cashReceived, actualRemaining);
    newHistoryPayment.amount = actualCashPayment;
    newHistoryPayment.cashReceived = cashReceived;
    newHistoryPayment.change = Math.max(cashReceived - actualRemaining, 0);
  }
  if (method === "GCash") {
    newHistoryPayment.gcashReference =
      document
        .getElementById("patientVerificationGcashReference")
        ?.value.trim() || "";
  }
  if (method === "Bank Transfer") {
    newHistoryPayment.bankReference =
      document
        .getElementById("patientVerificationBankReference")
        ?.value.trim() || "";
  }
  if (method === "Card") {
    newHistoryPayment.cardReference =
      document
        .getElementById("patientVerificationCardReference")
        ?.value.trim() || "";
  }
  history.push(newHistoryPayment);
  const newPaid = Math.min(transactionTotal, currentPaid + paymentAmount);
  const newBalance = Math.max(transactionTotal - newPaid, 0);
  transaction.paymentHistory = history;
  transaction.paid = newPaid;
  transaction.balance = newBalance;
  transaction.paymentMethod = method;
  transaction.updatedAt = now.toISOString();
  transaction.updatedTime = now.toTimeString().slice(0, 8);
  if (newBalance <= 0) {
    transaction.status = "Paid";
  } else if (newPaid > 0) {
    transaction.status = "Partial";
  } else {
    transaction.status = "Pending";
  }
  financeTransactions[transactionIndex] = transaction;
  try {
    const response = await fetch(FINANCE_API, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactions: [transaction] }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || "Payment could not be saved.");
  } catch (error) {
    showPaymentMessage("Unable to save the payment. Please try again.");
    return;
  }
  const savedPayment = normalizePayment({
    id: newHistoryPayment.id,
    patientId: CURRENT_PATIENT_ID,
    patientName: transaction.patientName || CURRENT_PATIENT_NAME,
    transactionId: transaction.id || "",
    date: newHistoryPayment.date,
    service: transaction.service || "Dental Service",
    amount: newHistoryPayment.amount,
    totalCharge: total,
    discount: discount,
    paymentMethod: method,
    status: newBalance <= 0 ? "paid" : "partial",
    reference: newHistoryPayment.reference,
    notes: notes,
    createdTime: newHistoryPayment.createdTime,
    createdAt: newHistoryPayment.createdAt,
    cashReceived: newHistoryPayment.cashReceived,
    change: newHistoryPayment.change,
    gcashReference: newHistoryPayment.gcashReference,
    bankReference: newHistoryPayment.bankReference,
    cardReference: newHistoryPayment.cardReference,
  });
  payments.unshift(savedPayment);
  savePayments();
  syncPaymentsFromFinance();
  renderPayments();
  const updatedGroup = getTransactionGroup(transaction.id);
  const updatedPayment = payments.find(function (payment) {
    return String(payment.id) === String(savedPayment.id);
  });
  closePatientPayModal();
  showPaymentMessage(
    updatedGroup && updatedGroup.balance > 0
      ? "Payment recorded successfully. Remaining balance: " +
          formatCurrency(updatedGroup.balance)
      : "Payment recorded successfully. Transaction fully paid.",
  );
  if (updatedPayment) {
    setTimeout(function () {
      openReceiptModal(updatedPayment);
    }, 350);
  }
}
function getPaymentReference() {
  const method = document.getElementById("patientPayMethod")?.value || "";
  if (method === "GCash") {
    return (
      document
        .getElementById("patientVerificationGcashReference")
        ?.value.trim() || "N/A"
    );
  }
  if (method === "Bank Transfer") {
    return (
      document
        .getElementById("patientVerificationBankReference")
        ?.value.trim() || "N/A"
    );
  }
  if (method === "Card") {
    return (
      document
        .getElementById("patientVerificationCardReference")
        ?.value.trim() || "N/A"
    );
  }
  return "N/A";
}
function closePaymentModal() {
  const modal = document.getElementById("paymentModal");
  if (!modal) {
    return;
  }
  modal.hidden = true;
  if (
    document.getElementById("receiptModal")?.hidden !== false &&
    document.getElementById("patientPayModal")?.hidden !== false
  ) {
    document.body.style.overflow = "";
  }
}
function closePatientPayModal() {
  const modal = document.getElementById("patientPayModal");
  if (!modal) {
    return;
  }
  modal.hidden = true;
  currentPayTransaction = null;
  resetPatientPaymentVerification();
  if (
    document.getElementById("paymentModal")?.hidden !== false &&
    document.getElementById("receiptModal")?.hidden !== false
  ) {
    document.body.style.overflow = "";
  }
}
function getStatusData(status) {
  if (status === "paid") {
    return {
      className: "paid",
      label: "Paid",
    };
  }
  if (status === "partial") {
    return {
      className: "partial",
      label: "Partial",
    };
  }
  return {
    className: "pending",
    label: "Pending",
  };
}
function getPaymentMethodIcon(method) {
  const value = String(method || "").toLowerCase();
  if (value.includes("gcash")) {
    return "fa-solid fa-mobile-screen-button";
  }
  if (value.includes("card")) {
    return "fa-regular fa-credit-card";
  }
  if (value.includes("cash")) {
    return "fa-solid fa-money-bill-wave";
  }
  if (value.includes("bank")) {
    return "fa-solid fa-building-columns";
  }
  return "fa-solid fa-wallet";
}
function showPaymentMessage(message) {
  let toast = document.getElementById("paymentToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "paymentToast";
    toast.style.position = "fixed";
    toast.style.left = "50%";
    toast.style.bottom = "25px";
    toast.style.transform = "translateX(-50%)";
    toast.style.zIndex = "10001";
    toast.style.padding = "11px 16px";
    toast.style.borderRadius = "8px";
    toast.style.background = "#16803d";
    toast.style.color = "#fff";
    toast.style.fontFamily = "Inter, sans-serif";
    toast.style.fontSize = "12px";
    toast.style.fontWeight = "600";
    toast.style.boxShadow = "0 8px 25px rgba(0,0,0,.15)";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.display = "block";
  clearTimeout(toast._timer);
  toast._timer = setTimeout(function () {
    toast.style.display = "none";
  }, 3000);
}
function formatCurrency(amount) {
  const value = Number(amount) || 0;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
function escapeAttribute(value) {
  return escapeHtml(value);
}
window.DentaNuevaPayments = {
  patientId: CURRENT_PATIENT_ID,
  patientName: CURRENT_PATIENT_NAME,
  getPatient: function () {
    return {
      patientId: CURRENT_PATIENT_ID,
      patientName: CURRENT_PATIENT_NAME,
    };
  },
  getPayments: function () {
    syncPaymentsFromFinance();
    return [...payments];
  },
  addPayment: function (payment) {
    const newPayment = normalizePayment({
      ...payment,
      patientId: CURRENT_PATIENT_ID,
      patientName: CURRENT_PATIENT_NAME,
    });
    payments.unshift(newPayment);
    savePayments();
    renderPayments();
    return newPayment;
  },
  refresh: function () {
    syncPaymentsFromFinance();
    renderPayments();
  },
  payRemaining: function (transactionId) {
    openPayModalByTransaction(transactionId);
  },
};
