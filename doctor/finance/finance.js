"use strict";
const TRANSACTIONS_KEY = "dentaNuevaFinanceTransactions";
const APPOINTMENTS_KEY = "appointments";
const PATIENTS_KEY = "dentanueva_patients";
const FINANCE_API = "../../api/finance.php";
const PATIENT_RECORDS_API = "../../api/patient_records.php";
let transactions = [];
let patients = [];
let collectionPeriod = "today";
let revenueMode = "today";
let expenseData = [];
let currentDetailsTransaction = null;
const sampleProcedureData = [
  { name: "Dental Cleaning", amount: 18500 },
  { name: "Tooth Filling / Pasta", amount: 14200 },
  { name: "Tooth Extraction", amount: 11800 },
  { name: "Braces Adjustment", amount: 9600 },
  { name: "Root Canal", amount: 8200 },
  { name: "Consultation", amount: 5600 },
];
const sampleExpenseCategoryData = [
  { name: "Dental Supplies", amount: 18500, color: "#16803d" },
  { name: "Utilities", amount: 9200, color: "#2f80ed" },
  { name: "Staff Salaries", amount: 28500, color: "#f2994a" },
  { name: "Equipment Maintenance", amount: 7600, color: "#9b51e0" },
  { name: "Marketing", amount: 4800, color: "#27ae60" },
];
document.addEventListener("DOMContentLoaded", async () => {
  await Promise.all([loadPatients(), loadTransactions()]);
  setupEvents();
  renderFinance();
});
function setupEvents() {
  setupPatientSelector();
  const search = document.getElementById("transactionSearch");
  if (search) {
    search.addEventListener("input", renderTransactions);
  }
  const methodFilter = document.getElementById("paymentMethodFilter");
  if (methodFilter) {
    methodFilter.addEventListener("change", renderTransactions);
  }
  const dateFilter = document.getElementById("transactionDateFilter");
  if (dateFilter) {
    dateFilter.addEventListener("change", renderTransactions);
  }
  const revenueSwitch = document.getElementById("revenueSwitch");
  if (revenueSwitch) {
    revenueSwitch.addEventListener("click", toggleRevenueMode);
  }
  const monthlyRevenueSwitch = document.getElementById("monthlyRevenueSwitch");
  if (monthlyRevenueSwitch) {
    monthlyRevenueSwitch.addEventListener("click", () => {
      revenueMode = revenueMode === "today" ? "month" : "today";
      renderRevenueCard();
    });
  }
  document.querySelectorAll(".collection-tab").forEach((button) => {
    button.addEventListener("click", () => {
      collectionPeriod = button.dataset.period;
      document.querySelectorAll(".collection-tab").forEach((item) => {
        item.classList.remove("active");
      });
      button.classList.add("active");
      renderCollection();
    });
  });
  const recordButton = document.getElementById("recordPaymentButton");
  if (recordButton) {
    recordButton.addEventListener("click", openPaymentModal);
  }
  const closeButton = document.getElementById("closePaymentModal");
  if (closeButton) {
    closeButton.addEventListener("click", closePaymentModal);
  }
  const cancelButton = document.getElementById("cancelPaymentButton");
  if (cancelButton) {
    cancelButton.addEventListener("click", closePaymentModal);
  }
  const saveButton = document.getElementById("savePaymentButton");
  if (saveButton) {
    saveButton.addEventListener("click", savePayment);
  }
  const modal = document.getElementById("paymentModal");
  if (modal) {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closePaymentModal();
      }
    });
  }
  const detailsModal = document.getElementById("detailsModal");
  document
    .getElementById("closeDetailsBtn")
    ?.addEventListener("click", closeDetailsModal);
  document
    .getElementById("detailsCloseButton")
    ?.addEventListener("click", closeDetailsModal);
  document
    .getElementById("printReceiptBtn")
    ?.addEventListener("click", printReceipt);
  detailsModal?.addEventListener("click", (event) => {
    if (event.target === detailsModal) {
      closeDetailsModal();
    }
  });
}
async function loadTransactions() {
  try {
    const response = await fetch(FINANCE_API, {
      credentials: "same-origin",
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok || !result.success || !Array.isArray(result.data)) {
      throw new Error(result.message || "Finance transactions unavailable.");
    }
    transactions = result.data.map(normalizeTransaction);
  } catch (error) {
    console.error("Unable to load finance transactions from database:", error);
    transactions = [];
  }
}
async function loadPatients() {
  try {
    const response = await fetch(PATIENT_RECORDS_API, {
      credentials: "same-origin",
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok || !result.success || !Array.isArray(result.data)) {
      throw new Error(result.message || "Patients unavailable.");
    }
    patients = result.data;
  } catch (error) {
    console.error("Unable to load patients from database:", error);
    patients = [];
  }
}
function getPatientFullName(patient) {
  if (!patient) {
    return "";
  }
  return (
    [patient.firstName, patient.lastName].filter(Boolean).join(" ").trim() ||
    String(patient.fullName || patient.name || "").trim()
  );
}
function findPatientById(patientId) {
  if (!patientId) {
    return null;
  }
  return (
    patients.find(
      (patient) =>
        String(patient.id) === String(patientId) ||
        String(patient.patientId) === String(patientId),
    ) || null
  );
}
function findPatientByName(name) {
  if (!name) {
    return null;
  }
  const target = String(name).trim().toLowerCase();
  return (
    patients.find(
      (patient) => getPatientFullName(patient).toLowerCase() === target,
    ) || null
  );
}
function setupPatientSelector() {
  const patientInput = document.getElementById("paymentPatient");
  const datalist = document.getElementById("paymentPatientList");
  if (!patientInput || !datalist) {
    return;
  }
  datalist.innerHTML = "";
  patients
    .slice()
    .sort((a, b) => getPatientFullName(a).localeCompare(getPatientFullName(b)))
    .forEach((patient) => {
      const option = document.createElement("option");
      option.value = getPatientFullName(patient);
      option.label = `${getPatientFullName(patient)} · ${patient.patientId || patient.id || ""}`;
      datalist.appendChild(option);
    });
  patientInput.setAttribute("list", "paymentPatientList");
  patientInput.oninput = syncPaymentPatientId;
}
function syncPaymentPatientId() {
  const patientInput = document.getElementById("paymentPatient");
  const patientIdInput = document.getElementById("paymentPatientId");
  if (!patientInput || !patientIdInput) {
    return;
  }
  const patient = findPatientByName(patientInput.value);
  patientIdInput.value = patient ? patient.patientId || patient.id || "" : "";
  if (patient) {
    patientInput.value = getPatientFullName(patient);
  }
}
function getPaymentPatient() {
  const patientInput = document.getElementById("paymentPatient");
  const patientIdInput = document.getElementById("paymentPatientId");
  const patient =
    findPatientById(patientIdInput?.value) ||
    findPatientByName(patientInput?.value);
  if (!patient) {
    return null;
  }
  if (patientIdInput) {
    patientIdInput.value = patient.patientId || patient.id || "";
  }
  if (patientInput) {
    patientInput.value = getPatientFullName(patient);
  }
  return patient;
}
function normalizePaymentHistory(item, patientId, patientName) {
  if (Array.isArray(item.paymentHistory) && item.paymentHistory.length) {
    return item.paymentHistory.map((payment, index) => ({
      id: payment.id || `${item.id || "TXN"}-PAY-${index + 1}`,
      amount: Number(payment.amount) || 0,
      paymentMethod:
        payment.paymentMethod ||
        payment.method ||
        item.paymentMethod ||
        item.method ||
        "Cash",
      reference:
        payment.reference ||
        payment.referenceNumber ||
        payment.gcashReference ||
        payment.bankReference ||
        payment.cardReference ||
        "",
      referenceNumber: payment.referenceNumber || payment.reference || "",
      cashReceived: Number(payment.cashReceived) || 0,
      change: Number(payment.change) || Number(payment.changeAmount) || 0,
      changeAmount: Number(payment.changeAmount) || Number(payment.change) || 0,
      gcashReference: payment.gcashReference || "",
      bankReference: payment.bankReference || "",
      cardReference: payment.cardReference || "",
      date: payment.date || item.date || getTodayKey(),
      notes: payment.notes || item.notes || "",
      createdTime: payment.createdTime || item.createdTime || item.time || "",
      createdAt:
        payment.createdAt || item.createdAt || new Date().toISOString(),
    }));
  }
  const paid = Number(item.paid) || 0;
  if (paid <= 0) {
    return [];
  }
  return [
    {
      id: `${item.id || "TXN"}-PAY-1`,
      amount: paid,
      paymentMethod: item.paymentMethod || item.method || "Cash",
      reference: item.reference || item.referenceNumber || "",
      referenceNumber: item.referenceNumber || item.reference || "",
      cashReceived: Number(item.cashReceived) || 0,
      change: Number(item.change) || Number(item.changeAmount) || 0,
      changeAmount: Number(item.changeAmount) || Number(item.change) || 0,
      gcashReference: item.gcashReference || "",
      bankReference: item.bankReference || "",
      cardReference: item.cardReference || "",
      date: item.date || getTodayKey(),
      notes: item.notes || "",
      createdTime: item.createdTime || item.time || "",
      createdAt: item.createdAt || new Date().toISOString(),
    },
  ];
}
function normalizeTransaction(item) {
  const total = Number(item.total) || 0;
  const discount = Number(item.discount) || 0;
  const paid = Number(item.paid) || 0;
  const storedPatientId =
    item.patientId ||
    item.patientID ||
    item.patient_id ||
    item.patientReferenceId ||
    "";
  const linkedPatient =
    findPatientById(storedPatientId) ||
    findPatientByName(item.patient || item.patientName || "");
  const patientId =
    linkedPatient?.patientId || linkedPatient?.id || storedPatientId || "";
  const patientName = linkedPatient
    ? getPatientFullName(linkedPatient)
    : item.patientName || item.patient || "Unknown Patient";
  const paymentHistory = normalizePaymentHistory(item, patientId, patientName);
  const normalizedPaid = paymentHistory.length
    ? paymentHistory.reduce(
        (sum, payment) => sum + (Number(payment.amount) || 0),
        0,
      )
    : paid;
  const balance = Math.max(
    0,
    total - discount - Math.min(normalizedPaid, Math.max(total - discount, 0)),
  );
  const status =
    balance <= 0 ? "Paid" : normalizedPaid > 0 ? "Partial" : "Unpaid";
  return {
    ...item,
    id: item.id || `TXN-${Date.now()}`,
    invoice: item.invoice || item.invoiceNumber || `INV-${Date.now()}`,
    patientId,
    patient: patientName,
    patientName,
    service: item.service || item.type || "Consultation",
    date: item.date || getTodayKey(),
    time: item.time || item.start || "10:00",
    total,
    discount,
    paid: normalizedPaid,
    balance,
    method: item.method || item.paymentMethod || "Cash",
    paymentMethod: item.paymentMethod || item.method || "Cash",
    status,
    paymentHistory,
  };
}
async function saveTransactions() {
  try {
    const response = await fetch(FINANCE_API, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactions }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || "Finance transactions were not saved.");
    }
    return true;
  } catch (error) {
    console.error("Unable to save finance transactions to database:", error);
    return false;
  }
}
function renderFinance() {
  renderRevenueCard();
  renderSummaryCards();
  renderTransactions();
  renderProcedureChart();
  renderRevenueExpenseChart();
  renderExpenseChart();
  renderCollection();
  renderAuditTrail();
}
function toggleRevenueMode() {
  revenueMode = revenueMode === "today" ? "month" : "today";
  renderRevenueCard();
}
function renderRevenueCard() {
  const title = document.getElementById("revenueCardTitle");
  const amount = document.getElementById("revenueAmount");
  const subtitle = document.getElementById("revenueSubtitle");
  const switchText = document.getElementById("revenueSwitchText");
  const todayRevenue = getTodayRevenue();
  const monthRevenue = getMonthlyRevenue();
  if (revenueMode === "today") {
    title.textContent = "Today's Revenue";
    amount.textContent = formatMoney(todayRevenue);
    subtitle.textContent = "Today's collection";
    switchText.textContent = "Today";
  } else {
    title.textContent = "Monthly Revenue";
    amount.textContent = formatMoney(monthRevenue);
    subtitle.textContent = getCurrentMonthLabel();
    switchText.textContent = "This Month";
  }
  const monthlyRevenue = document.getElementById("monthlyRevenueAmount");
  if (monthlyRevenue) {
    monthlyRevenue.textContent = formatMoney(monthRevenue);
  }
}
function renderSummaryCards() {
  const outstanding = transactions.reduce(
    (sum, transaction) => sum + getBalance(transaction),
    0,
  );
  const outstandingElement = document.getElementById("outstandingBalance");
  if (outstandingElement) {
    outstandingElement.textContent = formatMoney(outstanding);
  }
  const count = transactions.filter(
    (transaction) => getBalance(transaction) > 0,
  ).length;
  const subtitle = document.getElementById("outstandingSubtitle");
  if (subtitle) {
    subtitle.textContent = `${count} active balance${count === 1 ? "" : "s"}`;
  }
  const expenses = getMonthlyExpenses();
  const expensesElement = document.getElementById("monthlyExpenses");
  if (expensesElement) {
    expensesElement.textContent = formatMoney(expenses);
  }
  const expenseChange = document.getElementById("expenseChange");
  if (expenseChange) {
    expenseChange.textContent = "0% vs last month";
  }
  const monthLabel = document.getElementById("currentMonthLabel");
  if (monthLabel) {
    monthLabel.textContent = getCurrentMonthLabel();
  }
}
function getFilteredTransactions() {
  const search = (document.getElementById("transactionSearch")?.value || "")
    .trim()
    .toLowerCase();
  const method = document.getElementById("paymentMethodFilter")?.value || "all";
  const dateFilter =
    document.getElementById("transactionDateFilter")?.value || "all";
  return transactions
    .filter((transaction) => {
      if (!search) {
        return true;
      }
      return (
        transaction.patient.toLowerCase().includes(search) ||
        transaction.invoice.toLowerCase().includes(search) ||
        transaction.service.toLowerCase().includes(search)
      );
    })
    .filter((transaction) => {
      if (method === "all") {
        return true;
      }
      return transaction.method === method;
    })
    .filter((transaction) => {
      if (dateFilter === "all") {
        return true;
      }
      const date = new Date(
        `${transaction.date}T${transaction.time || "00:00"}`,
      );
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dateFilter === "today") {
        return transaction.date === getTodayKey();
      }
      if (dateFilter === "month") {
        return (
          date.getFullYear() === today.getFullYear() &&
          date.getMonth() === today.getMonth()
        );
      }
      if (dateFilter === "week") {
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        return date >= sevenDaysAgo;
      }
      return true;
    })
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
}
function renderTransactions() {
  const body = document.getElementById("transactionsTableBody");
  if (!body) {
    return;
  }
  body.innerHTML = "";
  const filtered = getFilteredTransactions();
  const count = document.getElementById("transactionCount");
  if (count) {
    count.textContent = `${filtered.length} transaction${filtered.length === 1 ? "" : "s"}`;
  }
  if (!filtered.length) {
    body.innerHTML = `<tr><td colspan="9" class="empty-table">No transactions found.</td></tr>`;
    return;
  }
  filtered.forEach((transaction) => {
    const row = document.createElement("tr");
    const status = getPaymentStatus(transaction);
    row.innerHTML = `<td><div class="patient-cell"><div class="patient-avatar">${getInitials(transaction.patient)}</div><div><span class="patient-name">${escapeHtml(transaction.patient)}</span><span class="invoice-number">${escapeHtml(transaction.id)}</span></div></div></td><td>${escapeHtml(transaction.service)}</td><td><span class="date-main">${formatShortDate(transaction.date)}</span><span class="date-time">${formatTime(transaction.time)}</span></td><td class="money">${formatMoney(transaction.total)}</td><td class="discount-money">${formatMoney(transaction.discount)}</td><td class="money">${formatMoney(transaction.paid)}</td><td class="balance-money">${formatMoney(getBalance(transaction))}</td><td><span class="status-badge ${getStatusClass(status)}">${status}</span></td><td><div class="action-buttons"><button type="button" class="table-action" title="View" onclick="viewTransaction('${transaction.id}')"><i class="fa-regular fa-eye"></i></button><button type="button" class="table-action" title="Edit" onclick="editTransaction('${transaction.id}')"><i class="fa-solid fa-pen"></i></button><button type="button" class="table-action" title="Delete" onclick="deleteTransaction('${transaction.id}')"><i class="fa-regular fa-trash-can"></i></button></div></td>`;
    body.appendChild(row);
  });
}
function renderProcedureChart() {
  const container = document.getElementById("procedureChart");
  if (!container) {
    return;
  }
  container.innerHTML = "";
  let data = sampleProcedureData.map((item) => [item.name, item.amount]);
  if (!data.length) {
    container.innerHTML = "";
    return;
  }
  data.sort((a, b) => b[1] - a[1]);
  data = data.slice(0, 6);
  const max = Math.max(...data.map((item) => item[1]), 1);
  data.forEach(([name, value]) => {
    const row = document.createElement("div");
    row.className = "procedure-row";
    const percentage = (value / max) * 100;
    row.innerHTML = `<span class="procedure-name">${escapeHtml(shortenService(name))}</span><div class="procedure-bar-bg"><div class="procedure-bar" style="width:${percentage}%"></div></div><span class="procedure-value">${formatMoney(value)}</span>`;
    container.appendChild(row);
  });
}
function renderRevenueExpenseChart() {
  const svg = document.getElementById("revenueExpenseChart");
  if (!svg) {
    return;
  }
  svg.innerHTML = "";
  const months = Array.from({ length: 12 }, (_, index) =>
    new Date(new Date().getFullYear(), index, 1).toLocaleDateString("en-US", {
      month: "short",
    }),
  );
  const revenue = months.map((_, index) => getRevenueForMonth(index));
  const expenses = months.map(() => 0);
  const allValues = [...revenue, ...expenses];
  const maxValue = Math.max(...allValues, 1000);
  const width = 700;
  const height = 300;
  const left = 50;
  const right = 18;
  const top = 20;
  const bottom = 45;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const xStep = chartWidth / (months.length - 1);
  function yPosition(value) {
    return top + chartHeight - (value / maxValue) * chartHeight;
  }
  const gridCount = 5;
  for (let i = 0; i <= gridCount; i++) {
    const y = top + (chartHeight / gridCount) * i;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", left);
    line.setAttribute("x2", width - right);
    line.setAttribute("y1", y);
    line.setAttribute("y2", y);
    line.setAttribute("class", "chart-grid-line");
    svg.appendChild(line);
    const label = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text",
    );
    label.setAttribute("x", 4);
    label.setAttribute("y", y + 4);
    label.setAttribute("class", "chart-axis-label");
    label.textContent = formatCompactMoney(
      maxValue - (maxValue / gridCount) * i,
    );
    svg.appendChild(label);
  }
  months.forEach((month, index) => {
    const x = left + xStep * index;
    const label = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text",
    );
    label.setAttribute("x", x);
    label.setAttribute("y", height - 13);
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("class", "chart-axis-label");
    label.textContent = month;
    svg.appendChild(label);
  });
  function makePoints(data) {
    return data.map((value, index) => ({
      x: left + xStep * index,
      y: yPosition(value),
    }));
  }
  function makePath(points) {
    return points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");
  }
  const revenuePoints = makePoints(revenue);
  const expensePoints = makePoints(expenses);
  const revenuePath = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path",
  );
  revenuePath.setAttribute("d", makePath(revenuePoints));
  revenuePath.setAttribute("class", "revenue-line");
  svg.appendChild(revenuePath);
  const expensePath = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path",
  );
  expensePath.setAttribute("d", makePath(expensePoints));
  expensePath.setAttribute("class", "expense-line");
  svg.appendChild(expensePath);
  revenuePoints.forEach((point) => {
    const circle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle",
    );
    circle.setAttribute("cx", point.x);
    circle.setAttribute("cy", point.y);
    circle.setAttribute("r", 4);
    circle.setAttribute("class", "revenue-point");
    svg.appendChild(circle);
  });
  expensePoints.forEach((point) => {
    const circle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle",
    );
    circle.setAttribute("cx", point.x);
    circle.setAttribute("cy", point.y);
    circle.setAttribute("r", 4);
    circle.setAttribute("class", "expense-point");
    svg.appendChild(circle);
  });
}
function renderExpenseChart() {
  const list = document.getElementById("expenseCategoryList");
  const pie = document.getElementById("expensePieChart");
  if (!list || !pie) {
    return;
  }
  list.innerHTML = "";
  const total = sampleExpenseCategoryData.reduce(
    (sum, item) => sum + item.amount,
    0,
  );
  let currentPercent = 0;
  const gradients = [];
  if (!sampleExpenseCategoryData.length || total <= 0) {
    pie.style.background = "none";
    return;
  }
  sampleExpenseCategoryData.forEach((item) => {
    const percentage = (item.amount / total) * 100;
    const end = currentPercent + percentage;
    gradients.push(`${item.color} ${currentPercent}% ${end}%`);
    currentPercent = end;
    const itemElement = document.createElement("div");
    itemElement.className = "expense-category";
    itemElement.innerHTML = `<span class="expense-color" style="background:${item.color}"></span><span>${escapeHtml(item.name)}: ${formatMoney(item.amount)} (${percentage.toFixed(1)}%)</span>`;
    list.appendChild(itemElement);
  });
  pie.style.background = `conic-gradient(${gradients.join(",")})`;
}
function renderCollection() {
  const list = document.getElementById("collectionList");
  const totalElement = document.getElementById("collectionTotal");
  const totalLabel = document.getElementById("collectionTotalLabel");
  if (!list) {
    return;
  }
  list.innerHTML = "";
  const methods = [
    { name: "Cash", icon: "fa-money-bill-wave", className: "cash" },
    { name: "GCash", icon: "fa-mobile-screen-button", className: "gcash" },
    { name: "Bank Transfer", icon: "fa-building-columns", className: "bank" },
    { name: "Card", icon: "fa-credit-card", className: "card" },
  ];
  let grandTotal = 0;
  methods.forEach((method) => {
    const methodTransactions = transactions.filter((transaction) => {
      if (transaction.method !== method.name) {
        return false;
      }
      if (collectionPeriod === "today") {
        return transaction.date === getTodayKey();
      }
      return isCurrentMonth(transaction.date);
    });
    const amount = methodTransactions.reduce(
      (sum, transaction) => sum + transaction.paid,
      0,
    );
    grandTotal += amount;
    const item = document.createElement("div");
    item.className = "collection-item";
    item.innerHTML = `<div class="collection-icon ${method.className}"><i class="fa-solid ${method.icon}"></i></div><div class="collection-details"><span class="collection-name">${method.name}</span><span class="collection-transactions">${methodTransactions.length} transaction${methodTransactions.length === 1 ? "" : "s"}</span></div><span class="collection-amount">${formatMoney(amount)}</span>`;
    list.appendChild(item);
  });
  if (totalElement) {
    totalElement.textContent = formatMoney(grandTotal);
  }
  if (totalLabel) {
    totalLabel.textContent =
      collectionPeriod === "today"
        ? "Total Collected Today"
        : "Total Collected This Month";
  }
}
function renderAuditTrail() {
  const container = document.getElementById("auditTrail");
  if (!container) {
    return;
  }
  if (!transactions.length) {
    container.innerHTML = `<div class="audit-content">No financial activity recorded yet.</div>`;
    return;
  }
  const latest = transactions[0];
  container.innerHTML = `<div class="audit-content"><strong>Latest payment record:</strong><br>Patient: ${escapeHtml(latest.patient)}<br>Invoice: ${escapeHtml(latest.invoice)}<br>Amount: ${formatMoney(latest.paid)}<br>Date: ${formatLongDate(latest.date)}<br>Payment Method: ${escapeHtml(latest.method)}</div>`;
}
function openPaymentModal() {
  const modal = document.getElementById("paymentModal");
  if (!modal) {
    return;
  }
  document.getElementById("paymentPatient").value = "";
  document.getElementById("paymentService").value = "";
  document.getElementById("paymentTotal").value = "";
  document.getElementById("paymentDiscount").value = "0";
  document.getElementById("paymentPaid").value = "";
  modal.classList.add("show");
}
function closePaymentModal() {
  const modal = document.getElementById("paymentModal");
  if (modal) {
    modal.classList.remove("show");
  }
}
async function savePayment() {
  const patientRecord = getPaymentPatient();
  const patient = patientRecord ? getPatientFullName(patientRecord) : "";
  const patientId = patientRecord
    ? patientRecord.patientId || patientRecord.id || ""
    : "";
  const service = document.getElementById("paymentService").value.trim();
  const total = Number(document.getElementById("paymentTotal").value) || 0;
  const discount =
    Number(document.getElementById("paymentDiscount").value) || 0;
  const paid = Number(document.getElementById("paymentPaid").value) || 0;
  const method = document.getElementById("paymentMethod").value;
  if (!patientRecord || !patientId) {
    alert("Please select a valid patient from the patient list.");
    return;
  }
  if (!service) {
    alert("Please enter the service.");
    return;
  }
  if (total <= 0) {
    alert("Please enter a valid total.");
    return;
  }
  const transactionId = `TXN-${Date.now()}`;
  const transactionDate = getTodayKey();
  const transactionTime = getCurrentTime();
  const transaction = {
    id: transactionId,
    invoice: `INV-${new Date().getFullYear()}-${String(transactions.length + 850).padStart(4, "0")}`,
    patientId,
    patient,
    patientName: patient,
    service,
    date: transactionDate,
    time: transactionTime,
    total,
    discount,
    paid,
    balance: getBalance({ total, discount, paid }),
    method,
    paymentMethod: method,
    status: getPaymentStatus({ total, discount, paid }),
    paymentHistory:
      paid > 0
        ? [
            {
              id: `${transactionId}-PAY-1`,
              amount: paid,
              paymentMethod: method,
              reference: "",
              referenceNumber: "",
              cashReceived: method === "Cash" ? paid : 0,
              change: 0,
              changeAmount: 0,
              gcashReference: "",
              bankReference: "",
              cardReference: "",
              date: transactionDate,
              notes: "",
              createdTime: transactionTime,
              createdAt: new Date().toISOString(),
            },
          ]
        : [],
    createdAt: new Date().toISOString(),
  };
  transactions.unshift(transaction);
  const saved = await saveTransactions();
  if (!saved) {
    alert("The payment could not be saved to the database.");
    return;
  }
  closePaymentModal();
  renderFinance();
}
function viewTransaction(id) {
  const transaction = transactions.find((item) => item.id === id);
  if (!transaction) {
    return;
  }
  showTransactionDetails(transaction);
}
function getPaymentHistory(transaction) {
  const history = Array.isArray(transaction.paymentHistory)
    ? transaction.paymentHistory
    : [];
  if (history.length) {
    return history
      .map((payment, index) => ({
        id: payment.id || `${transaction.id}-${index + 1}`,
        amount: Number(payment.amount) || 0,
        paymentMethod: payment.paymentMethod || transaction.method || "Cash",
        date: payment.date || transaction.date,
        time: payment.createdTime || transaction.time || "",
      }))
      .filter((payment) => payment.amount > 0)
      .sort((a, b) =>
        `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`),
      );
  }
  return transaction.paid > 0
    ? [
        {
          id: `${transaction.id}-1`,
          amount: transaction.paid,
          paymentMethod: transaction.method || "Cash",
          date: transaction.date,
          time: transaction.time || "",
        },
      ]
    : [];
}
function showTransactionDetails(transaction) {
  currentDetailsTransaction = transaction;
  const balance = getBalance(transaction);
  document.getElementById("detailTransactionId").textContent =
    transaction.id || "-";
  document.getElementById("detailPatient").textContent =
    transaction.patient || "-";
  document.getElementById("detailService").textContent =
    transaction.service || "-";
  document.getElementById("detailTotal").textContent = formatMoney(
    transaction.total,
  );
  document.getElementById("detailDiscount").textContent = formatMoney(
    transaction.discount,
  );
  document.getElementById("detailPaid").textContent = formatMoney(
    transaction.paid,
  );
  document.getElementById("detailBalance").textContent = formatMoney(balance);
  document.getElementById("detailMethod").textContent =
    [
      ...new Set(
        getPaymentHistory(transaction).map((payment) => payment.paymentMethod),
      ),
    ].join(" + ") ||
    transaction.method ||
    "-";
  document.getElementById("detailDate").textContent = formatLongDate(
    transaction.date,
  );
  const status = getPaymentStatus(transaction);
  const detailStatus = document.getElementById("detailStatus");
  detailStatus.textContent = status;
  detailStatus.className = `status-badge ${getStatusClass(status)}`;
  document.getElementById("detailNotes").textContent =
    transaction.notes || "No notes.";
  renderPaymentHistory(transaction);
  document.getElementById("detailsModal").classList.add("show");
}
function renderPaymentHistory(transaction) {
  const history = getPaymentHistory(transaction);
  const list = document.getElementById("paymentHistoryList");
  const count = document.getElementById("paymentHistoryCount");
  if (!list || !count) {
    return;
  }
  count.textContent = `${history.length} payment${history.length === 1 ? "" : "s"}`;
  list.innerHTML = history.length
    ? history
        .map((payment, index) => {
          const icon =
            payment.paymentMethod === "GCash"
              ? "fa-mobile-screen-button"
              : payment.paymentMethod === "Bank Transfer"
                ? "fa-building-columns"
                : payment.paymentMethod === "Card"
                  ? "fa-credit-card"
                  : "fa-money-bill-wave";
          return `<div class="payment-history-item"><div class="payment-history-item-left"><div class="payment-history-method-icon"><i class="fa-solid ${icon}"></i></div><div class="payment-history-item-info"><strong>${escapeHtml(payment.paymentMethod)}</strong><span>${escapeHtml(formatLongDate(payment.date))}${payment.time ? ` · ${escapeHtml(formatTime(payment.time))}` : ""}</span></div></div><div class="payment-history-item-right"><strong>${escapeHtml(formatMoney(payment.amount))}</strong><span>Payment ${history.length - index}</span></div></div>`;
        })
        .join("")
    : `<div class="payment-history-empty"><div class="payment-history-empty-icon"><i class="fa-solid fa-clock-rotate-left"></i></div><strong>No payment history</strong><p>Additional payments will appear here.</p></div>`;
}
function closeDetailsModal() {
  document.getElementById("detailsModal")?.classList.remove("show");
  currentDetailsTransaction = null;
}
function printReceipt() {
  const transaction = currentDetailsTransaction;
  if (!transaction) {
    return;
  }
  const payment = getPaymentHistory(transaction)[0];
  const receiptWindow = window.open("", "_blank", "width=440,height=700");
  if (!receiptWindow) {
    alert("Please allow pop-ups to view the receipt.");
    return;
  }
  const totalCharge = Math.max(transaction.total - transaction.discount, 0);
  const fields = [
    ["Transaction ID", transaction.id],
    ["Payment ID", payment?.id || `${transaction.id}-1`],
    ["Patient", transaction.patient],
    ["Service", transaction.service],
    ["Date", formatLongDate(transaction.date)],
    ["Payment Method", payment?.paymentMethod || transaction.method],
    ["Status", getPaymentStatus(transaction)],
    ["Total Charge", formatMoney(totalCharge)],
  ];
  const receiptHtml = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Payment Receipt - ${escapeHtml(transaction.id)}</title><style>*{box-sizing:border-box}body{font-family:Poppins,Arial,sans-serif;color:#17211b;padding:18px;margin:0;background:#fff}.receipt-page{width:100%;max-width:380px;margin:0 auto;padding:20px;border:1px solid #dfe7e2}.receipt-header{text-align:center}.clinic-name{margin:0;font-size:17px;line-height:1.25}.receipt-subtitle{margin:3px 0;color:#7c8881;font-size:8px}.receipt-divider{margin:12px 0 14px;border-top:1px dashed #d4ddd7}.receipt-title{text-align:center;font-size:11px;margin:0}.receipt-details{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:15px}.receipt-detail-box{min-height:43px;padding:7px 8px;border:1px solid #e0e7e3}.receipt-detail-label{display:block;margin-bottom:3px;color:#7b8780;font-size:6.5px;text-transform:uppercase}.receipt-detail-value{display:block;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.receipt-total-box,.receipt-balance-box{display:flex;align-items:center;justify-content:space-between;margin-top:11px;padding:9px 10px;font-size:9px}.receipt-total-box{background:#eaf7ef}.receipt-balance-box{margin-top:6px;background:#fff8e9}.receipt-amount-paid,.receipt-remaining-balance{font-size:11px!important;font-weight:700!important}.receipt-footer{text-align:center;margin-top:14px;padding-top:12px;border-top:1px dashed #d4ddd7;color:#7e8983;font-size:6.5px;line-height:1.4}.receipt-actions{text-align:center;margin-top:14px}.receipt-print-button{padding:8px 14px;border:0;border-radius:6px;background:#16803d;color:#fff;font-size:9px;cursor:pointer}@media print{body{padding:0}.receipt-page{max-width:380px}.receipt-actions{display:none}}</style></head><body><div class="receipt-page"><header class="receipt-header"><h1 class="clinic-name">DentaNueva Dental Clinic</h1><p class="receipt-subtitle">Official Payment Receipt</p></header><div class="receipt-divider"></div><h2 class="receipt-title">PAYMENT RECEIPT</h2><section class="receipt-details">${fields.map(([label, value]) => `<div class="receipt-detail-box"><span class="receipt-detail-label">${label}</span><strong class="receipt-detail-value">${escapeHtml(value || "-")}</strong></div>`).join("")}</section><div class="receipt-total-box"><span>AMOUNT PAID</span><strong class="receipt-amount-paid">${formatMoney(payment?.amount || transaction.paid)}</strong></div><div class="receipt-balance-box"><span>Remaining Balance</span><strong class="receipt-remaining-balance">${formatMoney(getBalance(transaction))}</strong></div><footer class="receipt-footer">Thank you for your payment.<br>This receipt represents the selected payment transaction.</footer><div class="receipt-actions"><button class="receipt-print-button" onclick="window.focus();window.print()">Print Receipt</button></div></div></body></html>`;
  receiptWindow.document.open();
  receiptWindow.document.write(receiptHtml);
  receiptWindow.document.close();
}
function editTransaction(id) {
  const transaction = transactions.find((item) => item.id === id);
  if (!transaction) {
    return;
  }
  document.getElementById("paymentPatient").value = transaction.patient;
  document.getElementById("paymentPatientId").value =
    transaction.patientId || "";
  document.getElementById("paymentService").value = transaction.service;
  document.getElementById("paymentTotal").value = transaction.total;
  document.getElementById("paymentDiscount").value = transaction.discount;
  document.getElementById("paymentPaid").value = transaction.paid;
  document.getElementById("paymentMethod").value = transaction.method;
  const modal = document.getElementById("paymentModal");
  modal.classList.add("show");
  const saveButton = document.getElementById("savePaymentButton");
  saveButton.onclick = function editSave() {
    const patientRecord = getPaymentPatient();
    if (!patientRecord) {
      alert("Please select a valid patient from the patient list.");
      return;
    }
    transaction.patientId = patientRecord.patientId || patientRecord.id || "";
    transaction.patient = getPatientFullName(patientRecord);
    transaction.patientName = transaction.patient;
    transaction.service = document
      .getElementById("paymentService")
      .value.trim();
    transaction.total =
      Number(document.getElementById("paymentTotal").value) || 0;
    transaction.discount =
      Number(document.getElementById("paymentDiscount").value) || 0;
    transaction.paid =
      Number(document.getElementById("paymentPaid").value) || 0;
    transaction.method = document.getElementById("paymentMethod").value;
    transaction.paymentMethod = transaction.method;
    transaction.balance = getBalance(transaction);
    transaction.status = getPaymentStatus(transaction);
    if (
      !Array.isArray(transaction.paymentHistory) ||
      !transaction.paymentHistory.length
    ) {
      transaction.paymentHistory = normalizePaymentHistory(
        transaction,
        transaction.patientId,
        transaction.patient,
      );
    }
    saveTransactions();
    closePaymentModal();
    saveButton.onclick = savePayment;
    renderFinance();
  };
}
async function deleteTransaction(id) {
  const transaction = transactions.find((item) => item.id === id);
  if (!transaction) {
    return;
  }
  const confirmed = confirm(`Delete transaction for ${transaction.patient}?`);
  if (!confirmed) {
    return;
  }
  try {
    const response = await fetch(`${FINANCE_API}?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || "Transaction could not be deleted.");
    }
    transactions = transactions.filter((item) => item.id !== id);
    renderFinance();
  } catch (error) {
    console.error("Unable to delete finance transaction:", error);
  }
}
function getTodayKey() {
  const date = new Date();
  return (
    date.getFullYear() +
    "-" +
    String(date.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getDate()).padStart(2, "0")
  );
}
function getCurrentTime() {
  const date = new Date();
  return (
    String(date.getHours()).padStart(2, "0") +
    ":" +
    String(date.getMinutes()).padStart(2, "0")
  );
}
function isCurrentMonth(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth()
  );
}
function getTodayRevenue() {
  return transactions
    .filter((transaction) => transaction.date === getTodayKey())
    .reduce((sum, transaction) => sum + transaction.paid, 0);
}
function getMonthlyRevenue() {
  return transactions
    .filter((transaction) => isCurrentMonth(transaction.date))
    .reduce((sum, transaction) => sum + transaction.paid, 0);
}
function getMonthlyExpenses() {
  return expenseData.reduce((sum, item) => sum + item.amount, 0);
}
function getRevenueForMonth(monthIndex) {
  const currentYear = new Date().getFullYear();
  return transactions
    .filter((transaction) => {
      const date = new Date(`${transaction.date}T00:00:00`);
      return (
        date.getFullYear() === currentYear && date.getMonth() === monthIndex
      );
    })
    .reduce((sum, transaction) => sum + transaction.paid, 0);
}
function getBalance(transaction) {
  const totalAfterDiscount = Math.max(
    0,
    transaction.total - transaction.discount,
  );
  return Math.max(0, totalAfterDiscount - transaction.paid);
}
function getPaymentStatus(transaction) {
  const balance = getBalance(transaction);
  const total = Math.max(0, transaction.total - transaction.discount);
  if (balance <= 0) {
    return "Paid";
  }
  if (transaction.paid > 0 && transaction.paid < total) {
    return "Partial";
  }
  return "Unpaid";
}
function getStatusClass(status) {
  if (status === "Paid") {
    return "status-paid";
  }
  if (status === "Partial") {
    return "status-partial";
  }
  return "status-unpaid";
}
function formatMoney(amount) {
  return (
    "₱" +
    Number(amount || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}
function formatCompactMoney(amount) {
  if (amount >= 1000000) {
    return "₱" + (amount / 1000000).toFixed(1) + "M";
  }
  if (amount >= 1000) {
    return "₱" + (amount / 1000).toFixed(0) + "K";
  }
  return "₱" + Math.round(amount);
}
function formatShortDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function formatLongDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
function formatTime(time) {
  if (!time) {
    return "";
  }
  const parts = time.split(":");
  let hour = Number(parts[0]);
  const minute = parts[1] || "00";
  const suffix = hour >= 12 ? "PM" : "AM";
  if (hour === 0) {
    hour = 12;
  } else if (hour > 12) {
    hour -= 12;
  }
  return `${hour}:${minute} ${suffix}`;
}
function getCurrentMonthLabel() {
  return new Date().toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}
function getInitials(name) {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}
function shortenService(service) {
  const replacements = {
    "Dental Cleaning": "Cleaning",
    "Tooth Filling / Pasta": "Composite",
    "Tooth Extraction": "Extraction",
    "Braces Adjustment": "Braces",
  };
  return replacements[service] || service;
}
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
