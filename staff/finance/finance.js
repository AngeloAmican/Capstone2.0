document.addEventListener("DOMContentLoaded", function () {
  const FINANCE_API = "../../api/finance.php";
  const PATIENT_RECORD_API = "../../api/patient_records.php";
  const SERVICE_DURATIONS = {
    Consultation: 30,
    "Dental Cleaning": 45,
    "Tooth Filling / Pasta": 45,
    "Tooth Extraction": 60,
    "Root Canal": 90,
    "Braces Adjustment": 30,
    "Teeth Whitening": 60,
    "Dental X-Ray": 15,
    "Scaling and Polishing": 45,
    "Denture Fitting": 60,
    "Wisdom Tooth Extraction": 75,
    "Dental Implant Consultation": 30,
    "Oral Prophylaxis": 45,
    "Retainer Fitting": 30,
  };
  const DEFAULT_SERVICE_SUGGESTIONS = [
    "Consultation",
    "Dental Cleaning",
    "Tooth Filling / Pasta",
    "Tooth Extraction",
    "Root Canal",
    "Braces Adjustment",
  ];
  const PAGE_SIZE = 10;
  let transactions = [];
  let patients = [];
  let editingTransactionId = null;
  let currentPage = 1;
  let currentDetailsTransaction = null;
  let selectedPatientId = "";
  let selectedOutstandingTransactionId = "";
  let paymentProcessConfirmed = false;
  let paymentProcessEditing = false;
  let appointmentPaymentMode = false;
  let additionalPaymentMode = false;
  let pendingAppointmentPayment = null;
  const paymentModal = document.getElementById("paymentModal");
  const detailsModal = document.getElementById("detailsModal");
  const paymentForm = document.getElementById("paymentForm");
  const recordPaymentBtn = document.getElementById("recordPaymentBtn");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const cancelPaymentBtn = document.getElementById("cancelPaymentBtn");
  const closeDetailsBtn = document.getElementById("closeDetailsBtn");
  const detailsCloseButton = document.getElementById("detailsCloseButton");
  const printReceiptBtn = document.getElementById("printReceiptBtn");
  const exportCsvBtn = document.getElementById("exportCsvBtn");
  const prevPageBtn = document.getElementById("prevPageBtn");
  const nextPageBtn = document.getElementById("nextPageBtn");
  const paginationInfo = document.getElementById("paginationInfo");
  const collectionDrawer = document.getElementById("collectionDrawer");
  const collectionDrawerOverlay = document.getElementById(
    "collectionDrawerOverlay",
  );
  const openCollectionDrawerBtn = document.getElementById(
    "openCollectionDrawerBtn",
  );
  const closeCollectionDrawerBtn = document.getElementById(
    "closeCollectionDrawerBtn",
  );
  const searchInput = document.getElementById("searchInput");
  const paymentMethodFilter = document.getElementById("paymentMethodFilter");
  const statusFilter = document.getElementById("statusFilter");
  const tableBody = document.getElementById("transactionsTableBody");
  const emptyState = document.getElementById("emptyState");
  const transactionIdInput = document.getElementById("transactionId");
  const patientNameInput = document.getElementById("patientName");
  const serviceNameInput = document.getElementById("serviceName");
  const paymentTotalInput = document.getElementById("paymentTotal");
  const paymentDiscountInput = document.getElementById("paymentDiscount");
  const paymentPaidInput = document.getElementById("paymentPaid");
  const paymentBalanceInput = document.getElementById("paymentBalance");
  const paymentDateInput = document.getElementById("paymentDate");
  const paymentMethodInput = document.getElementById("paymentMethod");
  const paymentStatusInput = document.getElementById("paymentStatus");
  const paymentNotesInput = document.getElementById("paymentNotes");
  const modalTitle = document.getElementById("modalTitle");
  const patientSelectWrapper = document.getElementById("patientSelectWrapper");
  const patientDropdown = document.getElementById("patientDropdown");
  const patientSelectArrow = document.querySelector(".patient-select-arrow");
  const serviceSelectWrapper = document.getElementById("serviceSelectWrapper");
  const serviceDropdown = document.getElementById("serviceDropdown");
  const serviceSelectArrow = document.querySelector(".service-select-arrow");
  const showMonthlyCollectionBtn = document.getElementById(
    "showMonthlyCollectionBtn",
  );
  const showTodayCollectionBtn = document.getElementById(
    "showTodayCollectionBtn",
  );
  const showCustomCollectionBtnToday = document.getElementById(
    "showCustomCollectionBtnToday",
  );
  const showCustomCollectionBtnMonthly = document.getElementById(
    "showCustomCollectionBtnMonthly",
  );
  const backToTodayFromCustomBtn = document.getElementById(
    "backToTodayFromCustomBtn",
  );
  const backToMonthlyFromCustomBtn = document.getElementById(
    "backToMonthlyFromCustomBtn",
  );
  const applyCustomRangeBtn = document.getElementById("applyCustomRangeBtn");
  const customDateFrom = document.getElementById("customDateFrom");
  const customDateTo = document.getElementById("customDateTo");
  const todayCollectionPage = document.getElementById("todayCollectionPage");
  const monthlyCollectionPage = document.getElementById(
    "monthlyCollectionPage",
  );
  const customCollectionPage = document.getElementById("customCollectionPage");
  const todayCollectionDescription = document.getElementById(
    "todayCollectionDescription",
  );
  const customCollectionDescription = document.getElementById(
    "customCollectionDescription",
  );
  const paymentHistoryCount = document.getElementById("paymentHistoryCount");
  const paymentHistoryList = document.getElementById("paymentHistoryList");
  const paymentHistoryEmpty = document.getElementById("paymentHistoryEmpty");
  const paymentProcessWrapper = document.getElementById(
    "paymentProcessWrapper",
  );
  const paymentProcessBox = document.getElementById("paymentProcessBox");
  const savePaymentBtn = document.getElementById("savePaymentBtn");
  void initialize();
  async function initialize() {
    await loadPatients();
    setupPatientSelector();
    setupServiceSelector();
    await loadTransactions();
    setDefaultPaymentDate();
    updateTodayCollectionDescription();
    updateMonthlyCollectionDescription();
    setDefaultCustomRange();
    renderTransactions();
    renderPaymentMethods();
    showTodayCollection();
    loadPatientFromUrl();
    updateSaveButtonState();
    if (window.lucide) {
      lucide.createIcons();
    }
    setupEventListeners();
    loadPendingPaymentFromAppointment();
  }
  function setupEventListeners() {
    recordPaymentBtn.addEventListener("click", function () {
      openPaymentModal();
    });
    closeModalBtn.addEventListener("click", function () {
      closePaymentModal();
    });
    cancelPaymentBtn.addEventListener("click", function () {
      closePaymentModal();
    });
    closeDetailsBtn.addEventListener("click", function () {
      closeDetailsModal();
    });
    detailsCloseButton.addEventListener("click", function () {
      closeDetailsModal();
    });
    const closePaymentVerificationBtn = document.getElementById(
      "closePaymentVerificationBtn",
    );
    if (closePaymentVerificationBtn) {
      closePaymentVerificationBtn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        closePaymentVerificationModal();
      });
    }
    if (printReceiptBtn) {
      printReceiptBtn.addEventListener("click", function () {
        printReceipt();
      });
    }
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener("click", function () {
        exportTransactionsToCSV();
      });
    }
    if (prevPageBtn) {
      prevPageBtn.addEventListener("click", function () {
        if (currentPage > 1) {
          currentPage--;
          renderTransactions();
        }
      });
    }
    if (nextPageBtn) {
      nextPageBtn.addEventListener("click", function () {
        const filtered = getFilteredTransactions();
        const totalPages = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);
        if (currentPage < totalPages) {
          currentPage++;
          renderTransactions();
        }
      });
    }
    openCollectionDrawerBtn.addEventListener("click", function () {
      openCollectionDrawer();
    });
    closeCollectionDrawerBtn.addEventListener("click", function () {
      closeCollectionDrawer();
    });
    collectionDrawerOverlay.addEventListener("click", function () {
      closeCollectionDrawer();
    });
    showMonthlyCollectionBtn.addEventListener("click", function () {
      showMonthlyCollection();
    });
    showTodayCollectionBtn.addEventListener("click", function () {
      showTodayCollection();
    });
    if (showCustomCollectionBtnToday) {
      showCustomCollectionBtnToday.addEventListener("click", function () {
        showCustomCollection();
      });
    }
    if (showCustomCollectionBtnMonthly) {
      showCustomCollectionBtnMonthly.addEventListener("click", function () {
        showCustomCollection();
      });
    }
    if (backToTodayFromCustomBtn) {
      backToTodayFromCustomBtn.addEventListener("click", function () {
        showTodayCollection();
      });
    }
    if (backToMonthlyFromCustomBtn) {
      backToMonthlyFromCustomBtn.addEventListener("click", function () {
        showMonthlyCollection();
      });
    }
    if (applyCustomRangeBtn) {
      applyCustomRangeBtn.addEventListener("click", function () {
        applyCustomCollectionRange();
      });
    }
    if (customDateFrom) {
      customDateFrom.addEventListener("change", function () {
        updateCustomCollectionDescription();
      });
    }

    if (customDateTo) {
      customDateTo.addEventListener("change", function () {
        updateCustomCollectionDescription();
      });
    }
    paymentForm.addEventListener("submit", function (event) {
      event.preventDefault();
      savePayment();
    });
    searchInput.addEventListener("input", function () {
      currentPage = 1;
      renderTransactions();
    });
    paymentMethodFilter.addEventListener("change", function () {
      currentPage = 1;
      renderTransactions();
    });
    statusFilter.addEventListener("change", function () {
      currentPage = 1;
      renderTransactions();
    });
    paymentTotalInput.addEventListener("input", function () {
      paymentProcessConfirmed = false;
      updatePaymentCalculation();
      renderPaymentProcessSection();
    });
    paymentDiscountInput.addEventListener("input", function () {
      paymentProcessConfirmed = false;
      updatePaymentCalculation();
      renderPaymentProcessSection();
    });
    paymentPaidInput.addEventListener("input", function () {
      updatePaymentCalculation();
    });
    paymentMethodInput.addEventListener("change", function () {
      paymentProcessConfirmed = false;
      renderPaymentProcessSection(true);
    });
    paymentModal.addEventListener("click", function (event) {
      if (event.target === paymentModal) {
        closePaymentModal();
      }
    });
    detailsModal.addEventListener("click", function (event) {
      if (event.target === detailsModal) {
        closeDetailsModal();
      }
    });
    if (patientNameInput) {
      patientNameInput.addEventListener("input", handlePatientInputChange);
      patientNameInput.addEventListener("focus", function () {
        if (!appointmentPaymentMode && !additionalPaymentMode) {
          openPatientDropdown();
        }
      });
      patientNameInput.addEventListener("keydown", handlePatientInputKeydown);
    }
    if (patientSelectArrow) {
      patientSelectArrow.addEventListener("click", function () {
        if (
          appointmentPaymentMode ||
          additionalPaymentMode ||
          !patientSelectWrapper
        ) {
          return;
        }
        if (patientSelectWrapper.classList.contains("open")) {
          closePatientDropdown();
        } else {
          patientNameInput?.focus();
          openPatientDropdown();
        }
      });
    }
    if (serviceNameInput) {
      serviceNameInput.addEventListener("input", handleServiceInputChange);
      serviceNameInput.addEventListener("focus", function () {
        if (!appointmentPaymentMode && !additionalPaymentMode) {
          openServiceDropdown();
        }
      });
      serviceNameInput.addEventListener("keydown", handleServiceInputKeydown);
    }
    if (serviceSelectArrow) {
      serviceSelectArrow.addEventListener("click", function () {
        if (
          appointmentPaymentMode ||
          additionalPaymentMode ||
          !serviceSelectWrapper
        ) {
          return;
        }
        if (serviceSelectWrapper.classList.contains("open")) {
          closeServiceDropdown();
        } else {
          serviceNameInput?.focus();
          openServiceDropdown();
        }
      });
    }
    document.addEventListener("mousedown", function (event) {
      if (
        patientSelectWrapper &&
        !patientSelectWrapper.contains(event.target)
      ) {
        closePatientDropdown();
      }
      if (
        serviceSelectWrapper &&
        !serviceSelectWrapper.contains(event.target)
      ) {
        closeServiceDropdown();
      }
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closePaymentModal();
        closeDetailsModal();
        closeCollectionDrawer();
        closePatientDropdown();
        closeServiceDropdown();
      }
    });
  }
  function loadPatients() {
    return fetch(PATIENT_RECORD_API, { credentials: "same-origin", cache: "no-store" })
      .then((response) => response.json().then((result) => ({ response, result })))
      .then(({ response, result }) => {
        if (!response.ok || !result.success || !Array.isArray(result.data)) {
          throw new Error(result.message || "Patients unavailable.");
        }
        patients = result.data.map(normalizePatient);
      })
      .catch((error) => {
        console.error("Unable to load patients from database:", error);
        patients = [];
      });
  }
  function normalizePatient(patient) {
    const normalized = { ...patient };
    if (!normalized.patientId) {
      normalized.patientId = normalized.id || "";
    }
    if (!normalized.id) {
      normalized.id = normalized.patientId || "";
    }
    return normalized;
  }
  function getPatientFullName(patient) {
    if (!patient) {
      return "";
    }
    if (patient.firstName || patient.lastName) {
      return [patient.firstName, patient.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();
    }
    return String(
      patient.fullName || patient.name || patient.patientName || "",
    ).trim();
  }
  function getPatientDisplayValue(patient) {
    if (!patient) {
      return "";
    }
    const name = getPatientFullName(patient);
    const patientId = patient.patientId || patient.id || "";
    if (!name) {
      return patientId;
    }
    if (!patientId) {
      return name;
    }
    return `${name} · ${patientId}`;
  }
  function getPatientMatches(query) {
    const trimmed = String(query || "")
      .trim()
      .toLowerCase();
    const sortedPatients = patients.slice().sort(function (a, b) {
      return getPatientFullName(a).localeCompare(getPatientFullName(b));
    });
    if (!trimmed) {
      return sortedPatients.slice(0, 5);
    }
    const cleanQuery = trimmed.split(" · ")[0].trim();
    return sortedPatients.filter(function (patient) {
      const name = getPatientFullName(patient).toLowerCase();
      const patientId = String(
        patient.patientId || patient.id || "",
      ).toLowerCase();
      const phone = String(
        patient.phone || patient.contactNumber || patient.contact || "",
      ).toLowerCase();
      const email = String(patient.email || "").toLowerCase();
      return (
        name.includes(cleanQuery) ||
        patientId.includes(cleanQuery) ||
        phone.includes(cleanQuery) ||
        email.includes(cleanQuery)
      );
    });
  }
  function findPatientById(patientId) {
    if (!patientId) {
      return null;
    }
    return (
      patients.find(function (patient) {
        return (
          String(patient.id || "") === String(patientId) ||
          String(patient.patientId || "") === String(patientId)
        );
      }) || null
    );
  }
  function findPatientByName(name) {
    if (!name) {
      return null;
    }
    const target = String(name).trim().split(" · ")[0].trim().toLowerCase();
    return (
      patients.find(function (patient) {
        return getPatientFullName(patient).toLowerCase() === target;
      }) || null
    );
  }
  function setupPatientSelector() {
    if (!patientNameInput || !patientDropdown) {
      return;
    }
    patientNameInput.removeAttribute("list");
    patientNameInput.setAttribute("aria-expanded", "false");
    refreshPatientSelector();
  }
  function refreshPatientSelector() {
    if (!patientNameInput || !patientDropdown) {
      return;
    }
    loadPatients();
    if (appointmentPaymentMode) {
      closePatientDropdown();
      return;
    }
    const currentPatientId = patientNameInput.dataset.patientId || "";
    const currentPatient = currentPatientId
      ? findPatientById(currentPatientId)
      : null;
    if (currentPatient) {
      patientNameInput.value = getPatientDisplayValue(currentPatient);
    } else if (!findPatientByName(patientNameInput.value)) {
      patientNameInput.value = "";
      patientNameInput.dataset.patientId = "";
      selectedPatientId = "";
      setFinancePatientId("");
    }
    renderPatientDropdown(patientNameInput.value);
  }
  function renderPatientDropdown(query = "") {
    if (!patientDropdown || appointmentPaymentMode || additionalPaymentMode) {
      return;
    }
    const matches = getPatientMatches(query);
    patientDropdown.innerHTML = "";
    if (!matches.length) {
      const empty = document.createElement("div");
      empty.className = "patient-dropdown-empty";
      empty.textContent = patients.length
        ? "No matching patient found."
        : "No patients available.";
      patientDropdown.appendChild(empty);
      return;
    }
    matches.forEach(function (patient, index) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "patient-dropdown-item";
      item.setAttribute("role", "option");
      const patientId = patient.patientId || patient.id || "";
      item.dataset.patientId = String(patientId);
      if (index === 0) {
        item.classList.add("active");
      }
      item.innerHTML = `<span class="patient-dropdown-name">${escapeHtml(getPatientFullName(patient))}</span><span class="patient-dropdown-id">${escapeHtml(String(patientId))}</span>`;
      item.addEventListener("mousedown", function (event) {
        event.preventDefault();
        selectPatientOption(patient);
      });
      item.addEventListener("click", function () {
        selectPatientOption(patient);
      });
      patientDropdown.appendChild(item);
    });
  }
  function openPatientDropdown() {
    if (
      appointmentPaymentMode ||
      additionalPaymentMode ||
      !patientSelectWrapper ||
      !patientNameInput
    ) {
      return;
    }
    renderPatientDropdown(patientNameInput.value);
    patientSelectWrapper.classList.add("open");
    patientNameInput.setAttribute("aria-expanded", "true");
  }
  function closePatientDropdown() {
    if (!patientSelectWrapper) {
      return;
    }
    patientSelectWrapper.classList.remove("open");
    if (patientNameInput) {
      patientNameInput.setAttribute("aria-expanded", "false");
    }
  }
  function selectPatientOption(patient) {
    if (
      appointmentPaymentMode ||
      additionalPaymentMode ||
      !patient ||
      !patientNameInput
    ) {
      return;
    }
    const patientId = patient.patientId || patient.id || "";
    selectedPatientId = String(patientId);
    selectedOutstandingTransactionId = "";
    paymentProcessConfirmed = false;
    if (!editingTransactionId) {
      paymentPaidInput.value = "";
    }
    patientNameInput.value = getPatientDisplayValue(patient);
    patientNameInput.dataset.patientId = String(patientId);
    setFinancePatientId(patientId);
    closePatientDropdown();
    if (!editingTransactionId) {
      loadOutstandingTransactionForCurrentSelection();
    }
    renderPaymentProcessSection();
    patientNameInput.focus();
  }
  function handlePatientInputChange() {
    if (appointmentPaymentMode || additionalPaymentMode || !patientNameInput) {
      return;
    }
    patientNameInput.dataset.patientId = "";
    selectedPatientId = "";
    selectedOutstandingTransactionId = "";
    paymentProcessConfirmed = false;
    paymentPaidInput.value = "";
    setFinancePatientId("");
    renderPatientDropdown(patientNameInput.value);
    openPatientDropdown();
  }
  function handlePatientInputKeydown(event) {
    if (appointmentPaymentMode || additionalPaymentMode || !patientNameInput) {
      return;
    }
    if (event.key === "Escape") {
      closePatientDropdown();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openPatientDropdown();
      const firstItem = patientDropdown?.querySelector(
        ".patient-dropdown-item",
      );
      firstItem?.focus();
      return;
    }
    if (event.key === "Enter") {
      const firstItem = patientDropdown?.querySelector(
        ".patient-dropdown-item",
      );
      if (firstItem && patientSelectWrapper?.classList.contains("open")) {
        event.preventDefault();
        const patient = findPatientById(firstItem.dataset.patientId);
        if (patient) {
          selectPatientOption(patient);
        }
      }
    }
  }
  function setFinancePatientId(patientId) {
    let hiddenPatientId = document.getElementById("financePatientId");
    if (!hiddenPatientId && patientNameInput?.parentElement) {
      hiddenPatientId = document.createElement("input");
      hiddenPatientId.type = "hidden";
      hiddenPatientId.id = "financePatientId";
      hiddenPatientId.name = "patientId";
      patientNameInput.parentElement.appendChild(hiddenPatientId);
    }
    if (hiddenPatientId) {
      hiddenPatientId.value = patientId || "";
    }
  }
  function getFinancePatientId() {
    const hiddenPatientId = document.getElementById("financePatientId");
    return (
      hiddenPatientId?.value ||
      selectedPatientId ||
      patientNameInput?.dataset.patientId ||
      (appointmentPaymentMode ? pendingAppointmentPayment?.patientId : "") ||
      ""
    );
  }
  function selectPatientById(patientId) {
    const patient = findPatientById(patientId);
    if (!patient || !patientNameInput) {
      return false;
    }
    const resolvedPatientId = patient.patientId || patient.id || "";
    selectedPatientId = String(resolvedPatientId);
    selectedOutstandingTransactionId = "";
    paymentProcessConfirmed = false;
    if (!editingTransactionId && !appointmentPaymentMode) {
      paymentPaidInput.value = "";
    }
    patientNameInput.value = getPatientDisplayValue(patient);
    patientNameInput.dataset.patientId = String(resolvedPatientId);
    setFinancePatientId(resolvedPatientId);
    if (!editingTransactionId && !appointmentPaymentMode) {
      loadOutstandingTransactionForCurrentSelection();
    }
    renderPaymentProcessSection();
    return true;
  }
  function loadPatientFromUrl() {
    if (appointmentPaymentMode) {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const patientId =
      params.get("patientId") || params.get("patient_id") || params.get("id");
    if (!patientId) {
      return;
    }
    loadPatients();
    selectPatientById(patientId);
  }
  function setupServiceSelector() {
    if (!serviceNameInput || !serviceDropdown) {
      return;
    }
    serviceNameInput.setAttribute("aria-expanded", "false");
    renderServiceDropdown(serviceNameInput.value);
  }
  function getServiceMatches(query) {
    const allServices = Object.keys(SERVICE_DURATIONS);
    const trimmed = String(query || "")
      .trim()
      .toLowerCase();
    if (!trimmed) {
      return DEFAULT_SERVICE_SUGGESTIONS.filter(function (name) {
        return allServices.includes(name);
      });
    }
    return allServices.filter(function (name) {
      return name.toLowerCase().includes(trimmed);
    });
  }
  function renderServiceDropdown(query = "") {
    if (!serviceDropdown || appointmentPaymentMode || additionalPaymentMode) {
      return;
    }
    const matches = getServiceMatches(query);
    serviceDropdown.innerHTML = "";
    if (!matches.length) {
      const empty = document.createElement("div");
      empty.className = "service-dropdown-empty";
      empty.textContent =
        "No matching service. You can keep this as a custom service name.";
      serviceDropdown.appendChild(empty);
      return;
    }
    matches.forEach(function (name, index) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "service-dropdown-item";
      item.setAttribute("role", "option");
      if (index === 0) {
        item.classList.add("active");
      }
      item.innerHTML = `<span class="service-dropdown-name">${escapeHtml(name)}</span>`;
      item.addEventListener("mousedown", function (event) {
        event.preventDefault();
        selectServiceOption(name);
      });
      item.addEventListener("click", function () {
        selectServiceOption(name);
      });
      serviceDropdown.appendChild(item);
    });
  }
  function openServiceDropdown() {
    if (
      appointmentPaymentMode ||
      additionalPaymentMode ||
      !serviceSelectWrapper ||
      !serviceNameInput
    ) {
      return;
    }
    renderServiceDropdown(serviceNameInput.value);
    serviceSelectWrapper.classList.add("open");
    serviceNameInput.setAttribute("aria-expanded", "true");
  }
  function closeServiceDropdown() {
    if (!serviceSelectWrapper) {
      return;
    }
    serviceSelectWrapper.classList.remove("open");
    if (serviceNameInput) {
      serviceNameInput.setAttribute("aria-expanded", "false");
    }
  }
  function selectServiceOption(name) {
    if (appointmentPaymentMode || additionalPaymentMode || !serviceNameInput) {
      return;
    }
    serviceNameInput.value = name;
    paymentProcessConfirmed = false;
    if (!editingTransactionId) {
      paymentPaidInput.value = "";
      loadOutstandingTransactionForCurrentSelection();
    }
    renderPaymentProcessSection();
    closeServiceDropdown();
    serviceNameInput.focus();
  }
  function handleServiceInputChange() {
    if (appointmentPaymentMode || additionalPaymentMode || !serviceNameInput) {
      return;
    }
    selectedOutstandingTransactionId = "";
    paymentProcessConfirmed = false;
    paymentPaidInput.value = "";
    renderServiceDropdown(serviceNameInput.value);
    openServiceDropdown();
    renderPaymentProcessSection();
  }
  function handleServiceInputKeydown(event) {
    if (appointmentPaymentMode || additionalPaymentMode || !serviceNameInput) {
      return;
    }
    if (event.key === "Escape") {
      closeServiceDropdown();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openServiceDropdown();
      const firstItem = serviceDropdown?.querySelector(
        ".service-dropdown-item",
      );
      firstItem?.focus();
      return;
    }
    if (event.key === "Enter") {
      const firstItem = serviceDropdown?.querySelector(
        ".service-dropdown-item",
      );
      if (firstItem && serviceSelectWrapper?.classList.contains("open")) {
        event.preventDefault();
        const serviceName = firstItem.querySelector(
          ".service-dropdown-name",
        )?.textContent;
        if (serviceName) {
          selectServiceOption(serviceName);
        }
      }
    }
  }
  function openCollectionDrawer() {
    if (!collectionDrawer || !collectionDrawerOverlay) {
      return;
    }
    showTodayCollection();
    collectionDrawer.classList.add("active");
    collectionDrawerOverlay.classList.add("active");
    document.body.style.overflow = "hidden";
    if (window.lucide) {
      lucide.createIcons();
    }
  }
  function closeCollectionDrawer() {
    if (!collectionDrawer || !collectionDrawerOverlay) {
      return;
    }
    collectionDrawer.classList.remove("active");
    collectionDrawerOverlay.classList.remove("active");
    document.body.style.overflow = "";
  }
  function loadTransactions() {
    return fetch(FINANCE_API, { credentials: "same-origin", cache: "no-store" })
      .then((response) => response.json().then((result) => ({ response, result })))
      .then(({ response, result }) => {
        if (!response.ok || !result.success || !Array.isArray(result.data)) throw new Error(result.message || "Transactions unavailable.");
        transactions = mergeDuplicateTransactions(result.data);
      })
      .catch((error) => {
        console.error("Unable to load finance transactions:", error);
        transactions = [];
      });
  }
  function mergeDuplicateTransactions(list) {
    const merged = new Map();
    list.forEach(function (rawTransaction) {
      const transaction = normalizeTransaction(rawTransaction);
      if (!transaction.id) {
        return;
      }
      if (!merged.has(transaction.id)) {
        merged.set(transaction.id, {
          ...transaction,
          paymentHistory: [],
          paid: 0,
        });
      }
      const target = merged.get(transaction.id);
      target.total = Math.max(
        Number(target.total) || 0,
        Number(transaction.total) || 0,
      );
      target.discount = Math.max(
        Number(target.discount) || 0,
        Number(transaction.discount) || 0,
      );
      target.patientId = target.patientId || transaction.patientId || "";
      target.patientName = target.patientName || transaction.patientName || "";
      target.service = target.service || transaction.service || "";
      target.appointmentId =
        target.appointmentId || transaction.appointmentId || "";
      target.appointmentDate =
        target.appointmentDate || transaction.appointmentDate || "";
      target.appointmentTime =
        target.appointmentTime || transaction.appointmentTime || "";
      target.dentistId = target.dentistId || transaction.dentistId || "";
      target.dentistName = target.dentistName || transaction.dentistName || "";
      target.date = transaction.date || target.date || "";
      target.paymentMethod =
        transaction.paymentMethod || target.paymentMethod || "";
      target.notes = transaction.notes || target.notes || "";
      target.createdTime = transaction.createdTime || target.createdTime || "";
      target.createdAt = transaction.createdAt || target.createdAt || "";
      const history = Array.isArray(transaction.paymentHistory)
        ? transaction.paymentHistory
        : [];
      if (history.length) {
        history.forEach(function (payment) {
          const paymentId = String(payment.id || "");
          const exists = target.paymentHistory.some(function (existingPayment) {
            return paymentId && String(existingPayment.id || "") === paymentId;
          });
          if (!exists) {
            target.paymentHistory.push({ ...payment });
          }
        });
      } else if (Number(transaction.paid) > 0) {
        const syntheticId = `${transaction.id}-LEGACY-${target.paymentHistory.length + 1}`;
        target.paymentHistory.push({
          id: syntheticId,
          amount: Number(transaction.paid) || 0,
          paymentMethod: transaction.paymentMethod || "",
          date: transaction.date || "",
          notes: transaction.notes || "",
          createdTime: transaction.createdTime || "",
          createdAt: transaction.createdAt || "",
        });
      }
    });
    return Array.from(merged.values()).map(function (transaction) {
      const paid = transaction.paymentHistory.reduce(function (sum, payment) {
        return sum + (Number(payment.amount) || 0);
      }, 0);
      const normalizedTotal = Math.max(Number(transaction.total) || 0, 0);
      const normalizedDiscount = Math.min(
        Math.max(Number(transaction.discount) || 0, 0),
        normalizedTotal,
      );
      const normalizedPaid = Math.min(
        Math.max(paid, 0),
        Math.max(normalizedTotal - normalizedDiscount, 0),
      );
      return normalizeTransaction({
        ...transaction,
        paid: normalizedPaid,
        balance: calculateBalance(
          normalizedTotal,
          normalizedDiscount,
          normalizedPaid,
        ),
        status: getTransactionStatus({
          total: normalizedTotal,
          discount: normalizedDiscount,
          paid: normalizedPaid,
        }),
      });
    });
  }
  function normalizeTransaction(transaction) {
    const oldAmount = Number(transaction.amount) || 0;
    const totalValue = Number(transaction.total);
    const discountValue = Number(transaction.discount);
    const paidValue = Number(transaction.paid);
    const normalizedTotal = Number.isFinite(totalValue)
      ? Math.max(totalValue, 0)
      : oldAmount;
    const normalizedDiscount = Number.isFinite(discountValue)
      ? Math.min(Math.max(discountValue, 0), normalizedTotal)
      : 0;
    const basePaid = Number.isFinite(paidValue)
      ? Math.min(
          Math.max(paidValue, 0),
          Math.max(normalizedTotal - normalizedDiscount, 0),
        )
      : Number.isFinite(totalValue)
        ? Math.max(normalizedTotal - normalizedDiscount, 0)
        : oldAmount;
    let patientId = transaction.patientId || "";
    if (!patientId && transaction.patientName) {
      const patient = findPatientByName(transaction.patientName);
      if (patient) {
        patientId = patient.patientId || patient.id || "";
      }
    }
    const paymentHistory = normalizePaymentHistory(transaction, {
      patientId: patientId,
      patientName: transaction.patientName || "",
      service: transaction.service || "",
      total: normalizedTotal,
      discount: normalizedDiscount,
      paid: basePaid,
      paymentMethod: transaction.paymentMethod || "",
      date: transaction.date || "",
      notes: transaction.notes || "",
      createdTime: transaction.createdTime || "",
      createdAt: transaction.createdAt || "",
    });
    const historyPaid = paymentHistory.reduce(function (sum, payment) {
      return sum + (Number(payment.amount) || 0);
    }, 0);
    const normalizedPaid = paymentHistory.length
      ? Math.min(
          Math.max(historyPaid, 0),
          Math.max(normalizedTotal - normalizedDiscount, 0),
        )
      : basePaid;
    const balance = calculateBalance(
      normalizedTotal,
      normalizedDiscount,
      normalizedPaid,
    );
    const status = getTransactionStatus({
      total: normalizedTotal,
      discount: normalizedDiscount,
      paid: normalizedPaid,
    });
    return {
      ...transaction,
      patientId: patientId,
      total: normalizedTotal,
      discount: normalizedDiscount,
      paid: normalizedPaid,
      balance: balance,
      status: status,
      paymentHistory: paymentHistory,
    };
  }
  function normalizePaymentHistory(transaction, fallback) {
    const history = Array.isArray(transaction.paymentHistory)
      ? transaction.paymentHistory
      : [];
    if (history.length) {
      return history
        .map(function (payment, index) {
          return {
            id: payment.id || `${transaction.id || "PAY"}-${index + 1}`,
            amount: Math.max(Number(payment.amount) || 0, 0),
            paymentMethod:
              payment.paymentMethod || fallback.paymentMethod || "",
            date: payment.date || fallback.date || "",
            notes: payment.notes || "",
            createdTime: payment.createdTime || fallback.createdTime || "",
            createdAt: payment.createdAt || fallback.createdAt || "",
          };
        })
        .filter(function (payment) {
          return payment.amount > 0;
        });
    }
    if (fallback.paid > 0) {
      return [
        {
          id: `${transaction.id || "PAY"}-1`,
          amount: fallback.paid,
          paymentMethod: fallback.paymentMethod || "",
          date: fallback.date || "",
          notes: fallback.notes || "",
          createdTime: fallback.createdTime || "",
          createdAt: fallback.createdAt || "",
        },
      ];
    }
    return [];
  }
  function createPaymentHistoryEntry(
    amount,
    paymentMethod,
    date,
    notes,
    createdTime,
    createdAt,
  ) {
    return {
      id: `PAY-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      amount: Math.max(Number(amount) || 0, 0),
      paymentMethod: paymentMethod || "",
      date: date || "",
      notes: notes || "",
      createdTime: createdTime || "",
      createdAt: createdAt || new Date().toISOString(),
    };
  }
  function getTransactionPaymentHistory(transaction) {
    const normalized = normalizeTransaction(transaction);
    return Array.isArray(normalized.paymentHistory)
      ? normalized.paymentHistory.slice().sort(function (a, b) {
          const dateA = new Date(
            `${a.date || ""}T${a.createdTime || "00:00:00"}`,
          );
          const dateB = new Date(
            `${b.date || ""}T${b.createdTime || "00:00:00"}`,
          );
          return dateB - dateA;
        })
      : [];
  }
  function getTransactionPaymentMethods(transaction) {
    const methods = getTransactionPaymentHistory(transaction)
      .map(function (payment) {
        return payment.paymentMethod || "";
      })
      .filter(Boolean);
    return [...new Set(methods)];
  }
  function getTransactionPaymentMethodLabel(transaction) {
    const methods = getTransactionPaymentMethods(transaction);
    if (!methods.length) {
      return transaction.paymentMethod || "-";
    }
    return methods.join(" + ");
  }
  function renderPaymentHistory(transaction) {
    if (!paymentHistoryList || !paymentHistoryCount) {
      return;
    }
    const history = getTransactionPaymentHistory(transaction);
    paymentHistoryList.innerHTML = "";
    paymentHistoryCount.textContent = `${history.length} ${
      history.length === 1 ? "payment" : "payments"
    }`;
    if (!history.length) {
      const empty = document.createElement("div");
      empty.className = "payment-history-empty";
      empty.innerHTML = `<div class="payment-history-empty-icon"><i data-lucide="history"></i></div><strong>No payment history</strong><p>Additional payments will appear here.</p>`;
      paymentHistoryList.appendChild(empty);
      if (window.lucide) lucide.createIcons();
      return;
    }
    history.forEach(function (payment, index) {
      const item = document.createElement("div");
      item.className = "payment-history-item";
      const icon =
        payment.paymentMethod === "GCash"
          ? "smartphone"
          : payment.paymentMethod === "Bank Transfer"
            ? "building-2"
            : payment.paymentMethod === "Card"
              ? "credit-card"
              : "banknote";
      item.innerHTML = `<div class="payment-history-item-left"><div class="payment-history-method-icon"><i data-lucide="${icon}"></i></div><div class="payment-history-item-info"><strong>${escapeHtml(payment.paymentMethod || "Payment")}</strong><span>${escapeHtml(formatDate(payment.date))}${
        payment.createdTime
          ? ` · ${escapeHtml(getTimeLabel(payment.createdTime))}`
          : ""
      }</span></div></div><div class="payment-history-item-right"><strong>${escapeHtml(
        formatCurrency(payment.amount),
      )}</strong><span>Payment ${history.length - index}</span></div>`;
      paymentHistoryList.appendChild(item);
    });
    if (window.lucide) lucide.createIcons();
  }
  function saveTransactions() {
    return fetch(FINANCE_API, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactions }),
    })
      .then((response) => response.json().then((result) => ({ response, result })))
      .then(({ response, result }) => {
        if (!response.ok || !result.success) throw new Error(result.message || "Transactions could not be saved.");
        return true;
      })
      .catch((error) => {
        console.error("Unable to save finance transactions:", error);
        return false;
      });
  }
  function createTransactionId() {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(100 + Math.random() * 900);
    return "TXN-" + timestamp + random;
  }
  function getTodayString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  function getMonthKey(dateString) {
    if (!dateString) {
      return "";
    }
    return dateString.substring(0, 7);
  }
  function getCurrentMonthKey() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }
  function formatCurrency(amount) {
    const number = Number(amount) || 0;
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(number);
  }
  function formatDate(dateString) {
    if (!dateString) {
      return "-";
    }
    const date = new Date(dateString + "T00:00:00");
    if (isNaN(date.getTime())) {
      return dateString;
    }
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  function formatShortDate(dateString) {
    if (!dateString) {
      return "-";
    }
    const date = new Date(dateString + "T00:00:00");
    if (isNaN(date.getTime())) {
      return dateString;
    }
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }
  function getInitials(name) {
    if (!name) {
      return "PT";
    }
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (
      parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
    ).toUpperCase();
  }
  function formatCollectionDate(dateString) {
    if (!dateString) {
      return "";
    }

    const date = new Date(dateString + "T00:00:00");

    if (isNaN(date.getTime())) {
      return dateString;
    }

    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  function updateTodayCollectionDescription() {
    if (!todayCollectionDescription) {
      return;
    }

    const today = formatCollectionDate(getTodayString());

    todayCollectionDescription.textContent = `Payment collection for ${today}.`;
  }

  function updateMonthlyCollectionDescription() {
    if (!monthlyCollectionDescription) {
      return;
    }

    const now = new Date();

    const monthName = now.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

    monthlyCollectionDescription.textContent = `Payment collection for ${monthName}.`;
  }

  function updateCustomCollectionDescription() {
    if (!customCollectionDescription || !customDateFrom || !customDateTo) {
      return;
    }

    const fromDate = customDateFrom.value;
    const toDate = customDateTo.value;

    if (!fromDate || !toDate) {
      customCollectionDescription.textContent =
        "Pick a date range to view collections.";
      return;
    }

    const formattedFrom = formatCollectionDate(fromDate);
    const formattedTo = formatCollectionDate(toDate);

    if (fromDate === toDate) {
      customCollectionDescription.textContent = `Payment collection for ${formattedFrom}.`;
      return;
    }

    customCollectionDescription.textContent = `Payment collection from ${formattedFrom} to ${formattedTo}.`;
  }
  function calculateBalance(total, discount, paid) {
    const normalizedTotal = Math.max(Number(total) || 0, 0);
    const normalizedDiscount = Math.min(
      Math.max(Number(discount) || 0, 0),
      normalizedTotal,
    );
    const normalizedPaid = Math.min(
      Math.max(Number(paid) || 0, 0),
      Math.max(normalizedTotal - normalizedDiscount, 0),
    );
    return Math.max(normalizedTotal - normalizedDiscount - normalizedPaid, 0);
  }
  function getTransactionStatus(transaction) {
    const total = Math.max(Number(transaction.total) || 0, 0);
    const discount = Math.min(
      Math.max(Number(transaction.discount) || 0, 0),
      total,
    );
    const paid = Math.min(
      Math.max(Number(transaction.paid) || 0, 0),
      Math.max(total - discount, 0),
    );
    const balance = calculateBalance(total, discount, paid);
    if (balance <= 0) {
      return "Paid";
    }
    if (paid > 0) {
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
  function createPaymentMethodTotals(filterType) {
    const methods = {
      Cash: { amount: 0, count: 0 },
      GCash: { amount: 0, count: 0 },
      "Bank Transfer": { amount: 0, count: 0 },
      Card: { amount: 0, count: 0 },
    };
    const today = getTodayString();
    const currentMonth = getCurrentMonthKey();
    transactions.forEach(function (transaction) {
      const normalized = normalizeTransaction(transaction);
      const history = getTransactionPaymentHistory(normalized);
      history.forEach(function (payment) {
        let includePayment = false;
        if (filterType === "today") {
          includePayment = payment.date === today;
        }
        if (filterType === "month") {
          includePayment = getMonthKey(payment.date) === currentMonth;
        }
        if (!includePayment) {
          return;
        }
        const method = payment.paymentMethod;
        if (methods[method]) {
          methods[method].amount += Number(payment.amount) || 0;
          methods[method].count++;
        }
      });
    });
    return methods;
  }
  function createCustomRangeTotals(fromDate, toDate) {
    const methods = {
      Cash: { amount: 0, count: 0 },
      GCash: { amount: 0, count: 0 },
      "Bank Transfer": { amount: 0, count: 0 },
      Card: { amount: 0, count: 0 },
    };
    transactions.forEach(function (transaction) {
      const normalized = normalizeTransaction(transaction);
      const history = getTransactionPaymentHistory(normalized);
      history.forEach(function (payment) {
        if (payment.date < fromDate || payment.date > toDate) {
          return;
        }
        const method = payment.paymentMethod;
        if (methods[method]) {
          methods[method].amount += Number(payment.amount) || 0;
          methods[method].count++;
        }
      });
    });
    return methods;
  }
  function renderPaymentMethods() {
    const todayMethods = createPaymentMethodTotals("today");
    const monthlyMethods = createPaymentMethodTotals("month");
    renderTodayCollection(todayMethods);
    renderMonthlyCollection(monthlyMethods);
    if (
      customDateFrom &&
      customDateTo &&
      customDateFrom.value &&
      customDateTo.value
    ) {
      renderCustomCollection(
        createCustomRangeTotals(customDateFrom.value, customDateTo.value),
      );
    }
  }
  function renderTodayCollection(methods) {
    document.getElementById("todayCashAmount").textContent = formatCurrency(
      methods.Cash.amount,
    );
    document.getElementById("todayGcashAmount").textContent = formatCurrency(
      methods.GCash.amount,
    );
    document.getElementById("todayBankAmount").textContent = formatCurrency(
      methods["Bank Transfer"].amount,
    );
    document.getElementById("todayCardAmount").textContent = formatCurrency(
      methods.Card.amount,
    );
    document.getElementById("todayCashCount").textContent = transactionText(
      methods.Cash.count,
    );
    document.getElementById("todayGcashCount").textContent = transactionText(
      methods.GCash.count,
    );
    document.getElementById("todayBankCount").textContent = transactionText(
      methods["Bank Transfer"].count,
    );
    document.getElementById("todayCardCount").textContent = transactionText(
      methods.Card.count,
    );
    const total =
      methods.Cash.amount +
      methods.GCash.amount +
      methods["Bank Transfer"].amount +
      methods.Card.amount;
    document.getElementById("todayPaymentMethodTotal").textContent =
      formatCurrency(total);
  }
  function renderMonthlyCollection(methods) {
    document.getElementById("monthlyCashAmount").textContent = formatCurrency(
      methods.Cash.amount,
    );
    document.getElementById("monthlyGcashAmount").textContent = formatCurrency(
      methods.GCash.amount,
    );
    document.getElementById("monthlyBankAmount").textContent = formatCurrency(
      methods["Bank Transfer"].amount,
    );
    document.getElementById("monthlyCardAmount").textContent = formatCurrency(
      methods.Card.amount,
    );
    document.getElementById("monthlyCashCount").textContent = transactionText(
      methods.Cash.count,
    );
    document.getElementById("monthlyGcashCount").textContent = transactionText(
      methods.GCash.count,
    );
    document.getElementById("monthlyBankCount").textContent = transactionText(
      methods["Bank Transfer"].count,
    );
    document.getElementById("monthlyCardCount").textContent = transactionText(
      methods.Card.count,
    );
    const total =
      methods.Cash.amount +
      methods.GCash.amount +
      methods["Bank Transfer"].amount +
      methods.Card.amount;
    document.getElementById("monthlyPaymentMethodTotal").textContent =
      formatCurrency(total);
  }
  function renderCustomCollection(methods) {
    document.getElementById("customCashAmount").textContent = formatCurrency(
      methods.Cash.amount,
    );
    document.getElementById("customGcashAmount").textContent = formatCurrency(
      methods.GCash.amount,
    );
    document.getElementById("customBankAmount").textContent = formatCurrency(
      methods["Bank Transfer"].amount,
    );
    document.getElementById("customCardAmount").textContent = formatCurrency(
      methods.Card.amount,
    );
    document.getElementById("customCashCount").textContent = transactionText(
      methods.Cash.count,
    );
    document.getElementById("customGcashCount").textContent = transactionText(
      methods.GCash.count,
    );
    document.getElementById("customBankCount").textContent = transactionText(
      methods["Bank Transfer"].count,
    );
    document.getElementById("customCardCount").textContent = transactionText(
      methods.Card.count,
    );
    const total =
      methods.Cash.amount +
      methods.GCash.amount +
      methods["Bank Transfer"].amount +
      methods.Card.amount;
    document.getElementById("customPaymentMethodTotal").textContent =
      formatCurrency(total);
  }
  function setDefaultCustomRange() {
    if (!customDateFrom || !customDateTo) {
      return;
    }

    const today = getTodayString();
    customDateFrom.value = today;
    customDateTo.value = today;
    customDateFrom.max = today;
    customDateTo.max = today;

    updateCustomCollectionDescription();
  }
  function showCustomCollection() {
    todayCollectionPage.classList.remove("active");
    monthlyCollectionPage.classList.remove("active");
    customCollectionPage.classList.add("active");

    updateCustomCollectionDescription();

    if (customDateFrom.value && customDateTo.value) {
      renderCustomCollection(
        createCustomRangeTotals(customDateFrom.value, customDateTo.value),
      );
    }

    if (window.lucide) {
      lucide.createIcons();
    }
  }
  function applyCustomCollectionRange() {
    const fromDate = customDateFrom.value;
    const toDate = customDateTo.value;
    if (!fromDate || !toDate) {
      showToast("Please select both dates.");
      return;
    }
    if (fromDate > toDate) {
      showToast("The 'From' date must be before the 'To' date.");
      return;
    }
    updateCustomCollectionDescription();

    renderCustomCollection(createCustomRangeTotals(fromDate, toDate));
  }
  function showMonthlyCollection() {
    todayCollectionPage.classList.remove("active");
    customCollectionPage.classList.remove("active");
    monthlyCollectionPage.classList.add("active");

    updateMonthlyCollectionDescription();

    if (window.lucide) {
      lucide.createIcons();
    }
  }
  function showTodayCollection() {
    monthlyCollectionPage.classList.remove("active");
    customCollectionPage.classList.remove("active");
    todayCollectionPage.classList.add("active");

    updateTodayCollectionDescription();

    if (window.lucide) {
      lucide.createIcons();
    }
  }
  function transactionText(count) {
    return `${count} ${count === 1 ? "transaction" : "transactions"}`;
  }
  function getFilteredTransactions() {
    const searchValue = searchInput.value.trim().toLowerCase();
    const methodValue = paymentMethodFilter.value;
    const dateValue = statusFilter.value;

    return transactions
      .map(function (transaction) {
        return normalizeTransaction(transaction);
      })
      .filter(function (transaction) {
        const patient = String(transaction.patientName || "").toLowerCase();
        const service = String(transaction.service || "").toLowerCase();
        const transactionId = String(transaction.id || "").toLowerCase();
        const patientId = String(transaction.patientId || "").toLowerCase();

        const matchesSearch =
          !searchValue ||
          patient.includes(searchValue) ||
          patientId.includes(searchValue) ||
          service.includes(searchValue) ||
          transactionId.includes(searchValue);

        const matchesMethod =
          methodValue === "all" ||
          getTransactionPaymentMethods(transaction).includes(methodValue);

        let matchesStatus = true;

        if (dateValue === "partial") {
          matchesStatus = transaction.status === "Partial";
        } else if (dateValue === "paid") {
          matchesStatus = transaction.status === "Paid";
        }

        return matchesSearch && matchesMethod && matchesStatus;
      })
      .sort(function (a, b) {
        const dateA = new Date(`${a.date}T${a.createdTime || "00:00:00"}`);
        const dateB = new Date(`${b.date}T${b.createdTime || "00:00:00"}`);
        return dateB - dateA;
      });
  }
  function renderPaginationBar(totalItems, totalPages) {
    if (!paginationInfo || !prevPageBtn || !nextPageBtn) {
      return;
    }
    const paginationBar =
      paginationInfo.closest(".pagination-bar") || paginationInfo.parentElement;
    if (totalItems < PAGE_SIZE) {
      if (paginationBar) {
        paginationBar.style.display = "none";
      }
      return;
    }
    if (paginationBar) {
      paginationBar.style.display = "flex";
    }
    const startItem = (currentPage - 1) * PAGE_SIZE + 1;
    const endItem = Math.min(currentPage * PAGE_SIZE, totalItems);
    paginationInfo.textContent = `Showing ${startItem}-${endItem} of ${totalItems} transactions`;
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;
  }
  function updateFinanceOverview() {
    const today = getTodayString();
    const currentMonth = getCurrentMonthKey();

    let todayCollection = 0;
    let monthlyCollection = 0;
    let outstandingBalance = 0;
    let todayTransactions = 0;

    transactions.forEach(function (transaction) {
      const normalized = normalizeTransaction(transaction);

      if (normalized.date === today) {
        todayTransactions++;
      }

      outstandingBalance += calculateBalance(
        normalized.total,
        normalized.discount,
        normalized.paid,
      );

      getTransactionPaymentHistory(normalized).forEach(function (payment) {
        const amount = Number(payment.amount) || 0;

        if (payment.date === today) {
          todayCollection += amount;
        }

        if (getMonthKey(payment.date) === currentMonth) {
          monthlyCollection += amount;
        }
      });
    });

    const todayCollectionValue = document.getElementById(
      "overviewTodayCollection",
    );

    const outstandingBalanceValue = document.getElementById(
      "overviewOutstandingBalance",
    );

    const todayTransactionsValue = document.getElementById(
      "overviewTodayTransactions",
    );

    const monthlyCollectionValue = document.getElementById(
      "overviewMonthlyCollection",
    );

    if (todayCollectionValue) {
      todayCollectionValue.textContent = formatCurrency(todayCollection);
    }

    if (outstandingBalanceValue) {
      outstandingBalanceValue.textContent = formatCurrency(outstandingBalance);
    }

    if (todayTransactionsValue) {
      todayTransactionsValue.textContent = String(todayTransactions);
    }

    if (monthlyCollectionValue) {
      monthlyCollectionValue.textContent = formatCurrency(monthlyCollection);
    }
  }
  function renderTransactions() {
    updateFinanceOverview();
    const filtered = getFilteredTransactions();
    const totalItems = filtered.length;
    const totalPages = Math.max(Math.ceil(totalItems / PAGE_SIZE), 1);
    if (currentPage > totalPages) {
      currentPage = totalPages;
    }
    if (currentPage < 1) {
      currentPage = 1;
    }
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(startIndex, startIndex + PAGE_SIZE);
    tableBody.innerHTML = "";
    document.getElementById("transactionCount").textContent = `${totalItems} ${
      totalItems === 1 ? "transaction" : "transactions"
    }`;
    renderPaginationBar(totalItems, totalPages);
    if (totalItems === 0) {
      emptyState.style.display = "flex";
      return;
    }
    emptyState.style.display = "none";
    pageItems.forEach(function (transaction) {
      const row = document.createElement("tr");
      const initials = getInitials(transaction.patientName);
      const status = getTransactionStatus(transaction);
      const statusClass = getStatusClass(status);
      const balance = calculateBalance(
        transaction.total,
        transaction.discount,
        transaction.paid,
      );
      const paymentMethodLabel = getTransactionPaymentMethodLabel(transaction);
      const additionalPaymentAction =
        balance > 0
          ? `<button class="action-button" title="Record Additional Payment" data-action="additional" data-id="${escapeHtml(
              transaction.id,
            )}"><i data-lucide="plus-circle"></i></button>`
          : "";
      row.innerHTML = `<td><div class="patient-cell"><div class="patient-avatar">${escapeHtml(
        initials,
      )}</div><div class="patient-info"><strong>${escapeHtml(
        transaction.patientName || "Unknown Patient",
      )}</strong><span>${escapeHtml(
        transaction.patientId || transaction.id || "-",
      )}</span></div></div></td><td><span class="service-name">${escapeHtml(
        transaction.service || "-",
      )}</span></td><td><div class="date-cell"><strong>${escapeHtml(
        formatShortDate(transaction.date),
      )}</strong><span>${escapeHtml(
        getTimeLabel(transaction.createdTime),
      )}</span></div></td><td class="amount-cell">${escapeHtml(
        formatCurrency(transaction.total),
      )}</td><td class="amount-cell discount-cell">${escapeHtml(
        formatCurrency(transaction.discount),
      )}</td><td class="amount-cell paid-cell">${escapeHtml(
        formatCurrency(transaction.paid),
      )}</td><td><span class="service-name payment-method-text">${escapeHtml(
        paymentMethodLabel,
      )}</span></td><td class="amount-cell balance-cell">${escapeHtml(
        formatCurrency(balance),
      )}</td><td><span class="status-badge ${statusClass}">${escapeHtml(
        status,
      )}</span></td><td class="action-cell"><button class="action-button" title="View Details" data-action="view" data-id="${escapeHtml(
        transaction.id,
      )}"><i data-lucide="eye"></i></button>${additionalPaymentAction}<button class="action-button delete-action-button" title="Delete Payment" data-action="delete" data-id="${escapeHtml(
        transaction.id,
      )}"><i data-lucide="trash-2"></i></button></td>`;
      tableBody.appendChild(row);
    });
    tableBody.querySelectorAll("[data-action]").forEach(function (button) {
      button.addEventListener("click", function () {
        handleTransactionAction(button.dataset.action, button.dataset.id);
      });
    });
    if (window.lucide) {
      lucide.createIcons();
    }
  }
  function handleTransactionAction(action, id) {
    const transaction = transactions.find(function (item) {
      return item.id === id;
    });
    if (!transaction) {
      return;
    }
    if (action === "view") {
      showTransactionDetails(transaction);
      return;
    }
    if (action === "additional") {
      openAdditionalPaymentModal(transaction);
      return;
    }
    if (action === "delete") {
      deleteTransaction(transaction.id);
    }
  }
  function getTimeLabel(timeString) {
    if (!timeString) {
      return "";
    }
    const parts = timeString.split(":");
    if (parts.length < 2) {
      return timeString;
    }
    let hour = parseInt(parts[0], 10);
    const minute = parts[1];
    const period = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${period}`;
  }
  function getOutstandingTransactions(patientId, service = "") {
    const targetPatientId = String(patientId || "");
    const targetService = String(service || "")
      .trim()
      .toLowerCase();
    return transactions
      .map(function (transaction) {
        return normalizeTransaction(transaction);
      })
      .filter(function (transaction) {
        const samePatient =
          String(transaction.patientId || "") === targetPatientId;
        const sameService =
          !targetService ||
          String(transaction.service || "")
            .trim()
            .toLowerCase() === targetService;
        return samePatient && sameService && Number(transaction.balance) > 0;
      })
      .sort(function (a, b) {
        const dateA = new Date(
          `${a.date || ""}T${a.createdTime || "00:00:00"}`,
        );
        const dateB = new Date(
          `${b.date || ""}T${b.createdTime || "00:00:00"}`,
        );
        return dateB - dateA;
      });
  }
  function findOutstandingTransaction(patientId, service = "") {
    const matches = getOutstandingTransactions(patientId, service);
    return matches.length ? matches[0] : null;
  }
  function loadOutstandingTransactionForCurrentSelection() {
    if (
      editingTransactionId ||
      appointmentPaymentMode ||
      additionalPaymentMode
    ) {
      return null;
    }
    const patientId = getFinancePatientId();
    if (!patientId) {
      selectedOutstandingTransactionId = "";
      return null;
    }
    const service = serviceNameInput.value.trim();
    const transaction = findOutstandingTransaction(patientId, service);
    if (!transaction) {
      if (selectedOutstandingTransactionId) {
        selectedOutstandingTransactionId = "";
      }
      return null;
    }
    selectedOutstandingTransactionId = transaction.id;
    serviceNameInput.value = transaction.service || service;
    paymentTotalInput.value = Number(transaction.total).toFixed(2);
    paymentDiscountInput.value = Number(transaction.discount).toFixed(2);
    paymentPaidInput.value = "";
    paymentBalanceInput.value = Number(transaction.balance).toFixed(2);
    paymentStatusInput.value = transaction.status;
    paymentProcessConfirmed = false;
    renderPaymentProcessSection();
    return transaction;
  }
  function getSelectedOutstandingTransaction() {
    if (!selectedOutstandingTransactionId) {
      return null;
    }
    const transaction = transactions.find(function (item) {
      return item.id === selectedOutstandingTransactionId;
    });
    if (!transaction) {
      selectedOutstandingTransactionId = "";
      return null;
    }
    const normalized = normalizeTransaction(transaction);
    if (normalized.balance <= 0) {
      selectedOutstandingTransactionId = "";
      return null;
    }
    return normalized;
  }
  function updatePaymentCalculation() {
    let total = Math.max(parseFloat(paymentTotalInput.value) || 0, 0);
    let discount = Math.max(parseFloat(paymentDiscountInput.value) || 0, 0);
    let paid = Math.max(parseFloat(paymentPaidInput.value) || 0, 0);
    const outstanding = appointmentPaymentMode
      ? null
      : getSelectedOutstandingTransaction();
    const basePaid =
      outstanding && !editingTransactionId ? outstanding.paid : 0;
    if (outstanding && !editingTransactionId) {
      total = outstanding.total;
      discount = outstanding.discount;
      paymentTotalInput.value = total.toFixed(2);
      paymentDiscountInput.value = discount.toFixed(2);
    }
    if (discount > total) {
      discount = total;
      paymentDiscountInput.value = total.toFixed(2);
    }
    const amountDue = Math.max(total - discount, 0);
    const remainingDue = Math.max(amountDue - basePaid, 0);
    if (paid > remainingDue) {
      paid = remainingDue;
      paymentPaidInput.value = paid.toFixed(2);
    }
    const balance = Math.max(remainingDue - paid, 0);
    const status = getTransactionStatus({
      total: total,
      discount: discount,
      paid: basePaid + paid,
    });
    paymentBalanceInput.value = balance.toFixed(2);
    paymentStatusInput.value = status;
    updateSaveButtonState();
    return {
      total: total,
      discount: discount,
      paid: basePaid + paid,
      balance: balance,
      status: status,
      basePaid: basePaid,
      additionalPaid: paid,
    };
  }
  function updateSaveButtonState() {
    if (!savePaymentBtn) {
      return;
    }
    const patientId = getFinancePatientId();
    const service = serviceNameInput?.value.trim() || "";
    const total = Number(paymentTotalInput?.value) || 0;
    const paid = Number(paymentPaidInput?.value) || 0;
    const method = paymentMethodInput?.value || "";
    const processReady = paymentProcessConfirmed;
    savePaymentBtn.disabled =
      !patientId ||
      !service ||
      total <= 0 ||
      paid <= 0 ||
      !method ||
      !processReady;
  }
  function resetPaymentProcess() {
    paymentProcessConfirmed = false;
    if (paymentProcessBox) {
      paymentProcessBox.innerHTML = "";
    }
    if (paymentProcessWrapper) {
      paymentProcessWrapper.style.display = "none";
    }
    updateSaveButtonState();
  }
  function renderPaymentProcessSection() {
    if (!paymentProcessWrapper || !paymentProcessBox) {
      return;
    }
    const method = paymentMethodInput?.value || "";
    if (!method || editingTransactionId) {
      paymentProcessWrapper.style.display = "none";
      paymentProcessBox.innerHTML = "";
      updateSaveButtonState();
      return;
    }
    paymentProcessWrapper.style.display = "block";
    paymentProcessBox.innerHTML = "";
    const calculation = updatePaymentCalculation();
    const amountDue = Math.max(
      calculation.balance + calculation.additionalPaid,
      0,
    );
    const amount = Math.max(Number(paymentPaidInput.value) || 0, 0);
    if (method === "Cash") {
      const row = document.createElement("div");
      row.className = "process-row";
      row.innerHTML = `<div class="process-field"><label>Amount to Pay</label><div class="process-static-amount">${escapeHtml(
        formatCurrency(amountDue),
      )}</div></div><div class="process-field"><label for="cashReceived">Amount Received</label><div class="amount-input"><span>₱</span><input type="number" id="cashReceived" min="0" step="0.01" placeholder="0.00" value="${
        amount > 0 ? amount.toFixed(2) : ""
      }"></div></div><div class="process-field"><label>Change</label><div class="process-static-amount" id="cashChange">${escapeHtml(
        formatCurrency(Math.max(amount - amountDue, 0)),
      )}</div></div>`;
      paymentProcessBox.appendChild(row);
      const cashReceivedInput = document.getElementById("cashReceived");
      const cashChange = document.getElementById("cashChange");
      const confirmButton = document.createElement("button");
      confirmButton.type = "button";
      confirmButton.className = "confirm-process-button";
      confirmButton.id = "confirmCashBtn";
      confirmButton.textContent = "Confirm Cash";
      paymentProcessBox.appendChild(confirmButton);
      cashReceivedInput?.addEventListener("input", function () {
        paymentProcessConfirmed = false;
        const received = Math.max(Number(cashReceivedInput.value) || 0, 0);
        paymentPaidInput.value = received.toFixed(2);
        const updated = updatePaymentCalculation();
        const remainingDue = Math.max(
          updated.balance + updated.additionalPaid,
          0,
        );
        if (cashChange) {
          cashChange.textContent = formatCurrency(
            Math.max(received - remainingDue, 0),
          );
        }
      });
      confirmButton.addEventListener("click", function () {
        const cashAmount = Math.max(Number(cashReceivedInput?.value) || 0, 0);
        if (cashAmount <= 0) {
          showToast("Please enter the amount received.");
          return;
        }
        const updated = updatePaymentCalculation();
        const remainingDue = Math.max(
          updated.balance + updated.additionalPaid,
          0,
        );
        if (remainingDue <= 0) {
          showToast("This payment is already fully paid.");
          return;
        }
        const paymentAmount = Math.min(cashAmount, remainingDue);
        const change = Math.max(cashAmount - remainingDue, 0);
        paymentPaidInput.value = paymentAmount.toFixed(2);
        updatePaymentCalculation();
        confirmPaymentProcess(
          `Cash Received: ${formatCurrency(
            cashAmount,
          )} · Change: ${formatCurrency(change)}`,
          paymentAmount,
        );
      });
      return;
    }
    if (method === "GCash") {
      const qr = document.createElement("div");
      qr.className = "qr-placeholder";
      qr.innerHTML = `<div class="qr-box"><i data-lucide="qr-code"></i></div><span>Scan the clinic's GCash QR code</span>`;
      paymentProcessBox.appendChild(qr);
      const row = document.createElement("div");
      row.className = "process-row";
      row.innerHTML = `<div class="process-field"><label>Amount to Pay</label><div class="process-static-amount">${escapeHtml(
        formatCurrency(amountDue),
      )}</div></div><div class="process-field"><label for="gcashReference">Reference Number</label><input type="text" id="gcashReference" placeholder="Enter GCash reference number"></div>`;
      paymentProcessBox.appendChild(row);
      const confirmButton = document.createElement("button");
      confirmButton.type = "button";
      confirmButton.className = "confirm-process-button";
      confirmButton.id = "confirmGcashBtn";
      confirmButton.textContent = "Confirm GCash";
      paymentProcessBox.appendChild(confirmButton);
      confirmButton.addEventListener("click", function () {
        const ref = document.getElementById("gcashReference")?.value.trim();
        if (!ref) {
          showToast("Please enter the GCash reference number.");
          return;
        }
        const updated = updatePaymentCalculation();
        if (updated.additionalPaid <= 0) {
          showToast("Please enter the payment amount.");
          return;
        }
        confirmPaymentProcess(`GCash Ref: ${ref}`, updated.additionalPaid);
      });
      if (window.lucide) {
        lucide.createIcons();
      }
      return;
    }
    if (method === "Bank Transfer") {
      const bankInfo = document.createElement("div");
      bankInfo.className = "bank-info-box";
      bankInfo.innerHTML = `<div><span>Payment Type</span><strong>Bank Transfer</strong></div><div><span>Amount to Pay</span><strong>${escapeHtml(
        formatCurrency(amountDue),
      )}</strong></div>`;
      paymentProcessBox.appendChild(bankInfo);
      const row = document.createElement("div");
      row.className = "process-row";
      row.innerHTML = `<div class="process-field"><label for="bankReference">Transfer Reference</label><input type="text" id="bankReference" placeholder="Enter transfer reference number"></div>`;
      paymentProcessBox.appendChild(row);
      const confirmButton = document.createElement("button");
      confirmButton.type = "button";
      confirmButton.className = "confirm-process-button";
      confirmButton.id = "confirmBankBtn";
      confirmButton.textContent = "Confirm Transfer";
      paymentProcessBox.appendChild(confirmButton);
      confirmButton.addEventListener("click", function () {
        const ref = document.getElementById("bankReference")?.value.trim();
        if (!ref) {
          showToast("Please enter the bank transfer reference number.");
          return;
        }
        const updated = updatePaymentCalculation();
        if (updated.additionalPaid <= 0) {
          showToast("Please enter the payment amount.");
          return;
        }
        confirmPaymentProcess(`Bank Ref: ${ref}`, updated.additionalPaid);
      });
      return;
    }
    if (method === "Card") {
      const row = document.createElement("div");
      row.className = "process-row";
      row.innerHTML = `<div class="process-field"><label>Amount to Pay</label><div class="process-static-amount">${escapeHtml(
        formatCurrency(amountDue),
      )}</div></div><div class="process-field"><label for="cardReference">Authorization / Reference</label><input type="text" id="cardReference" placeholder="Enter card authorization or reference number"></div>`;
      paymentProcessBox.appendChild(row);
      const confirmButton = document.createElement("button");
      confirmButton.type = "button";
      confirmButton.className = "confirm-process-button";
      confirmButton.id = "confirmCardBtn";
      confirmButton.textContent = "Confirm Card";
      paymentProcessBox.appendChild(confirmButton);
      confirmButton.addEventListener("click", function () {
        const ref = document.getElementById("cardReference")?.value.trim();
        if (!ref) {
          showToast("Please enter the card reference number.");
          return;
        }
        const updated = updatePaymentCalculation();
        if (updated.additionalPaid <= 0) {
          showToast("Please enter the payment amount.");
          return;
        }
        confirmPaymentProcess(`Card Ref: ${ref}`, updated.additionalPaid);
      });
    }
  }
  function confirmPaymentProcess(referenceText, paymentAmount) {
    if (Number.isFinite(Number(paymentAmount)) && Number(paymentAmount) >= 0) {
      paymentPaidInput.value = Number(paymentAmount).toFixed(2);
      updatePaymentCalculation();
    }
    paymentProcessConfirmed = true;
    const banner = document.createElement("div");
    banner.className = "process-confirmed-banner";
    banner.innerHTML = `<i data-lucide="check-circle"></i><span>Payment Process Confirmed - ${escapeHtml(
      referenceText,
    )}</span>`;
    paymentProcessBox.appendChild(banner);
    if (window.lucide) {
      lucide.createIcons();
    }
    document.querySelectorAll(".confirm-process-button").forEach(function (b) {
      b.disabled = true;
    });
    paymentProcessBox.querySelectorAll("input").forEach(function (i) {
      i.disabled = true;
    });
    updateSaveButtonState();
  }
  function setPaymentFieldsLocked(locked) {
    const isLocked = locked === true;
    if (patientNameInput) {
      patientNameInput.readOnly = isLocked;
      patientNameInput.setAttribute(
        "aria-readonly",
        isLocked ? "true" : "false",
      );
    }
    if (serviceNameInput) {
      serviceNameInput.readOnly = isLocked;
      serviceNameInput.setAttribute(
        "aria-readonly",
        isLocked ? "true" : "false",
      );
    }
    if (paymentTotalInput) {
      paymentTotalInput.readOnly = additionalPaymentMode;
    }
    if (paymentDiscountInput) {
      paymentDiscountInput.readOnly = additionalPaymentMode;
    }
    if (patientSelectWrapper) {
      patientSelectWrapper.classList.toggle("appointment-fixed", isLocked);
    }
    if (serviceSelectWrapper) {
      serviceSelectWrapper.classList.toggle("appointment-fixed", isLocked);
    }
    if (patientSelectArrow) {
      patientSelectArrow.style.pointerEvents = isLocked ? "none" : "";
      patientSelectArrow.style.opacity = isLocked ? "0.45" : "";
    }
    if (serviceSelectArrow) {
      serviceSelectArrow.style.pointerEvents = isLocked ? "none" : "";
      serviceSelectArrow.style.opacity = isLocked ? "0.45" : "";
    }
    if (isLocked) {
      closePatientDropdown();
      closeServiceDropdown();
    }
  }
  function setAppointmentPaymentMode(enabled) {
    appointmentPaymentMode = enabled === true;
    setPaymentFieldsLocked(appointmentPaymentMode || additionalPaymentMode);
  }
  function setAdditionalPaymentMode(enabled) {
    additionalPaymentMode = enabled === true;
    setPaymentFieldsLocked(appointmentPaymentMode || additionalPaymentMode);
  }
  function renderAppointmentPaymentInfo() {
    const panel = document.getElementById("appointmentPaymentInfo");
    if (!panel) {
      return;
    }
    if (!appointmentPaymentMode || !pendingAppointmentPayment) {
      panel.classList.remove("active");
      return;
    }
    const pending = pendingAppointmentPayment;
    const patient = pending.patientId
      ? findPatientById(pending.patientId)
      : null;
    const patientName =
      pending.patientName || getPatientFullName(patient) || "Unknown Patient";
    const patientId =
      pending.patientId || patient?.patientId || patient?.id || "-";
    const appointmentDate = pending.appointmentDate
      ? formatDate(pending.appointmentDate)
      : "-";
    const appointmentTime = pending.appointmentTime
      ? getTimeLabel(pending.appointmentTime)
      : "-";
    const dentistName = pending.dentistName || pending.dentistId || "-";
    const service = pending.service || "-";
    document.getElementById("appointmentInfoPatient").textContent = patientName;
    document.getElementById("appointmentInfoPatientId").textContent =
      `Patient ID: ${patientId}`;
    document.getElementById("appointmentInfoService").textContent = service;
    document.getElementById("appointmentInfoDate").textContent =
      `${appointmentDate} · ${appointmentTime}`;
    document.getElementById("appointmentInfoDentist").textContent = dentistName;
    panel.classList.add("active");
  }
  function loadPendingPaymentFromAppointment() {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("source") !== "appointment") {
        return false;
      }
      const pendingPayment = Object.fromEntries(params.entries());
      if (!pendingPayment || pendingPayment.source !== "appointment") {
        return false;
      }
      pendingAppointmentPayment = pendingPayment;
      setAppointmentPaymentMode(true);
      openPaymentModal();
      const patient = pendingPayment.patientId
        ? findPatientById(pendingPayment.patientId)
        : null;
      const resolvedPatientId = String(
        pendingPayment.patientId || patient?.patientId || patient?.id || "",
      );
      const resolvedPatientName =
        pendingPayment.patientName ||
        getPatientFullName(patient) ||
        "Unknown Patient";
      selectedPatientId = resolvedPatientId;
      patientNameInput.value = patient
        ? getPatientDisplayValue(patient)
        : resolvedPatientName;
      patientNameInput.dataset.patientId = resolvedPatientId;
      setFinancePatientId(resolvedPatientId);
      serviceNameInput.value = pendingPayment.service || "";
      paymentTotalInput.value = Number(pendingPayment.amount || 0).toFixed(2);
      paymentDiscountInput.value = "0.00";
      paymentPaidInput.value = "";
      paymentBalanceInput.value = Number(pendingPayment.amount || 0).toFixed(2);
      paymentDateInput.value = getTodayString();
      paymentMethodInput.value = "";
      paymentStatusInput.value = "Unpaid";
      paymentNotesInput.value = "";
      selectedOutstandingTransactionId = "";
      paymentProcessConfirmed = false;
      updatePaymentCalculation();
      resetPaymentProcess();
      renderPaymentProcessSection();
      updateSaveButtonState();
      closePatientDropdown();
      closeServiceDropdown();
      renderAppointmentPaymentInfo();
      return true;
    } catch (error) {
      console.error("Unable to load pending appointment payment:", error);
      pendingAppointmentPayment = null;
      setAppointmentPaymentMode(false);
      return false;
    }
  }
  function openAdditionalPaymentModal(transaction) {
    const normalized = normalizeTransaction(transaction);
    if (!normalized.id || normalized.balance <= 0) {
      showToast("This transaction has no remaining balance.");
      return;
    }
    paymentModal.classList.add("active");
    closePatientDropdown();
    closeServiceDropdown();
    loadPatients();
    pendingAppointmentPayment = null;
    editingTransactionId = null;
    setAppointmentPaymentMode(false);
    setAdditionalPaymentMode(true);
    selectedOutstandingTransactionId = normalized.id;
    transactionIdInput.value = normalized.id;
    modalTitle.textContent = "Record Additional Payment";
    const patient = normalized.patientId
      ? findPatientById(normalized.patientId)
      : null;
    const resolvedPatientId = String(
      normalized.patientId || patient?.patientId || patient?.id || "",
    );
    selectedPatientId = resolvedPatientId;
    patientNameInput.value = patient
      ? getPatientDisplayValue(patient)
      : normalized.patientName || "";
    patientNameInput.dataset.patientId = resolvedPatientId;
    setFinancePatientId(resolvedPatientId);
    serviceNameInput.value = normalized.service || "";
    paymentTotalInput.value = Number(normalized.total).toFixed(2);
    paymentDiscountInput.value = Number(normalized.discount).toFixed(2);
    paymentPaidInput.value = "";
    paymentBalanceInput.value = Number(normalized.balance).toFixed(2);
    paymentDateInput.value = getTodayString();
    paymentMethodInput.value = "";
    paymentStatusInput.value = normalized.status;
    paymentNotesInput.value = "";
    paymentProcessConfirmed = false;
    resetPaymentProcess();
    updatePaymentCalculation();
    renderPaymentProcessSection();
    updateSaveButtonState();
    renderAppointmentPaymentInfo();
  }
  function openPaymentModal(transaction = null) {
    if (transaction) {
      openAdditionalPaymentModal(transaction);
      return;
    }
    paymentModal.classList.add("active");
    closePatientDropdown();
    closeServiceDropdown();
    loadPatients();
    refreshPatientSelector();
    pendingAppointmentPayment = appointmentPaymentMode
      ? pendingAppointmentPayment
      : null;
    editingTransactionId = null;
    selectedOutstandingTransactionId = "";
    setAdditionalPaymentMode(false);
    modalTitle.textContent = "Record Payment";
    paymentForm.reset();
    transactionIdInput.value = "";
    paymentTotalInput.value = "";
    paymentDiscountInput.value = "0";
    paymentPaidInput.value = "";
    paymentBalanceInput.value = "0.00";
    paymentDateInput.value = getTodayString();
    paymentStatusInput.value = "Unpaid";
    selectedPatientId = "";
    setFinancePatientId("");
    patientNameInput.value = "";
    patientNameInput.removeAttribute("data-patient-id");
    serviceNameInput.value = "";
    if (!appointmentPaymentMode) {
      loadPatientFromUrl();
    }
    updatePaymentCalculation();
    resetPaymentProcess();
    renderPaymentProcessSection();
    setAppointmentPaymentMode(appointmentPaymentMode);
    renderAppointmentPaymentInfo();
    if (!appointmentPaymentMode) {
      setTimeout(function () {
        patientNameInput.focus();
        openPatientDropdown();
      }, 100);
    }
  }
  function closePaymentModal() {
    closePatientDropdown();
    closeServiceDropdown();
    paymentModal.classList.remove("active");
    paymentForm.reset();
    editingTransactionId = null;
    additionalPaymentMode = false;
    selectedPatientId = "";
    selectedOutstandingTransactionId = "";
    transactionIdInput.value = "";
    paymentBalanceInput.value = "0.00";
    setFinancePatientId("");
    patientNameInput.removeAttribute("data-patient-id");
    modalTitle.textContent = "Record Payment";
    pendingAppointmentPayment = null;
    setAdditionalPaymentMode(false);
    setAppointmentPaymentMode(false);
    renderAppointmentPaymentInfo();
    resetPaymentProcess();
  }
  function savePayment() {
    if (!editingTransactionId && !paymentProcessConfirmed) {
      showToast("Please complete the payment process first.");
      return;
    }
    if (!editingTransactionId && Number(paymentPaidInput.value) <= 0) {
      showToast(
        "Please complete the payment process to record the payment amount.",
      );
      return;
    }
    loadPatients();
    let patientId = getFinancePatientId();
    let patient = findPatientById(patientId);
    if (!appointmentPaymentMode && !patient) {
      patient = findPatientByName(patientNameInput.value.trim());
    }
    if (patient && !appointmentPaymentMode) {
      patientId = patient.patientId || patient.id || "";
      patientNameInput.value = getPatientDisplayValue(patient);
      selectedPatientId = patientId;
      patientNameInput.dataset.patientId = patientId;
      setFinancePatientId(patientId);
    }
    if (appointmentPaymentMode && pendingAppointmentPayment) {
      patientId = String(
        pendingAppointmentPayment.patientId || patientId || "",
      );
      patientNameInput.value =
        pendingAppointmentPayment.patientName || patientNameInput.value;
      patientNameInput.dataset.patientId = patientId;
      setFinancePatientId(patientId);
    }
    const patientName = appointmentPaymentMode
      ? String(pendingAppointmentPayment?.patientName || patientNameInput.value)
          .trim()
          .split(" · ")[0]
          .trim()
      : patient
        ? getPatientFullName(patient)
        : patientNameInput.value.trim().split(" · ")[0].trim();
    const service = serviceNameInput.value.trim();
    const calculation = updatePaymentCalculation();
    const total = calculation.total;
    const discount = calculation.discount;
    const paid = calculation.paid;
    const balance = calculation.balance;
    const status = calculation.status;
    const date = paymentDateInput.value;
    const paymentMethod = paymentMethodInput.value;
    const notes = paymentNotesInput.value.trim();
    if (!appointmentPaymentMode && !patient) {
      showToast("Please select a registered patient.");
      patientNameInput.focus();
      openPatientDropdown();
      return;
    }
    if (!patientId) {
      showToast("Patient ID could not be found.");
      return;
    }
    if (!patientName) {
      showToast("Please enter the patient name.");
      return;
    }
    if (!service) {
      showToast("Please enter the service.");
      return;
    }
    if (isNaN(total) || total <= 0) {
      showToast("Please enter a valid total amount.");
      return;
    }
    if (discount < 0 || discount > total) {
      showToast("Please enter a valid discount.");
      return;
    }
    if (isNaN(paid) || paid < 0) {
      showToast("Please enter a valid paid amount.");
      return;
    }
    if (!date) {
      showToast("Please select the payment date.");
      return;
    }
    if (date > getTodayString()) {
      showToast("Payment date cannot be in the future.");
      return;
    }
    if (!paymentMethod) {
      showToast("Please select a payment method.");
      return;
    }
    const now = new Date();
    const createdTime = now.toTimeString().substring(0, 8);
    let matchingTransaction = additionalPaymentMode
      ? getSelectedOutstandingTransaction()
      : appointmentPaymentMode
        ? null
        : getSelectedOutstandingTransaction();
    if (!appointmentPaymentMode && !matchingTransaction) {
      matchingTransaction = findOutstandingTransaction(patientId, service);
    }
    if (matchingTransaction) {
      const index = transactions.findIndex(function (item) {
        return item.id === matchingTransaction.id;
      });
      if (index === -1) {
        showToast("The outstanding payment record could not be found.");
        return;
      }
      const existing = normalizeTransaction(transactions[index]);
      const remainingDue = Math.max(
        existing.total - existing.discount - existing.paid,
        0,
      );
      const paymentAmount = Math.max(
        Number(calculation.additionalPaid) || 0,
        0,
      );
      if (paymentAmount <= 0) {
        showToast("Please enter the payment amount.");
        paymentPaidInput.focus();
        return;
      }
      if (paymentAmount > remainingDue) {
        showToast(
          "Payment amount cannot be greater than the remaining balance.",
        );
        paymentPaidInput.focus();
        return;
      }
      const newPaid = existing.paid + paymentAmount;
      const newBalance = calculateBalance(
        existing.total,
        existing.discount,
        newPaid,
      );
      const newStatus = getTransactionStatus({
        total: existing.total,
        discount: existing.discount,
        paid: newPaid,
      });
      const history = getTransactionPaymentHistory(existing);
      history.push(
        createPaymentHistoryEntry(
          paymentAmount,
          paymentMethod,
          date,
          notes,
          createdTime,
        ),
      );
      transactions[index] = {
        ...existing,
        paid: newPaid,
        balance: newBalance,
        date: date,
        paymentMethod: paymentMethod,
        status: newStatus,
        notes: notes,
        createdTime: createdTime,
        createdAt: new Date().toISOString(),
        paymentHistory: history,
      };
      showToast(
        newBalance <= 0
          ? "Payment completed and added to payment history."
          : "Additional payment added to payment history.",
      );
    } else {
      const paymentAmount = Math.max(
        Number(calculation.additionalPaid) || 0,
        0,
      );
      if (paymentAmount <= 0) {
        showToast("Please enter the payment amount.");
        return;
      }
      const newTransaction = {
        id: createTransactionId(),
        patientId: patientId,
        patientName: patientName,
        service: service,
        appointmentId: appointmentPaymentMode
          ? pendingAppointmentPayment?.appointmentId || ""
          : "",
        appointmentDate: appointmentPaymentMode
          ? pendingAppointmentPayment?.appointmentDate || ""
          : "",
        appointmentTime: appointmentPaymentMode
          ? pendingAppointmentPayment?.appointmentTime || ""
          : "",
        dentistId: appointmentPaymentMode
          ? pendingAppointmentPayment?.dentistId || ""
          : "",
        dentistName: appointmentPaymentMode
          ? pendingAppointmentPayment?.dentistName || ""
          : "",
        total: total,
        discount: discount,
        paid: paymentAmount,
        balance: calculateBalance(total, discount, paymentAmount),
        date: date,
        paymentMethod: paymentMethod,
        status: getTransactionStatus({
          total: total,
          discount: discount,
          paid: paymentAmount,
        }),
        notes: notes,
        createdTime: createdTime,
        createdAt: new Date().toISOString(),
        paymentHistory: [
          createPaymentHistoryEntry(
            paymentAmount,
            paymentMethod,
            date,
            notes,
            createdTime,
          ),
        ],
      };
      transactions.unshift(newTransaction);
      showToast("Payment recorded successfully.");
    }
    transactions = transactions.map(function (transaction) {
      return normalizeTransaction(transaction);
    });
    saveTransactions();
    window.dispatchEvent(
      new CustomEvent("dentaNuevaPaymentUpdated", {
        detail: {
          patientId: patientId,
          patientName: patientName,
          transactionId: matchingTransaction?.id || transactions[0]?.id || "",
          amount: Number(calculation.additionalPaid) || 0,
          paymentMethod: paymentMethod,
          date: date,
        },
      }),
    );
    closePaymentModal();
    renderPaymentMethods();
    currentPage = 1;
    renderTransactions();
  }
  function showTransactionDetails(transaction) {
    const normalized = normalizeTransaction(transaction);
    currentDetailsTransaction = normalized;
    const detailTransactionId = document.getElementById("detailTransactionId");
    const detailPatient = document.getElementById("detailPatient");
    const detailService = document.getElementById("detailService");
    const detailTotal = document.getElementById("detailTotal");
    const detailDiscount = document.getElementById("detailDiscount");
    const detailPaid = document.getElementById("detailPaid");
    const detailBalance = document.getElementById("detailBalance");
    const detailMethod = document.getElementById("detailMethod");
    const detailDate = document.getElementById("detailDate");
    const detailStatus = document.getElementById("detailStatus");
    const detailNotes = document.getElementById("detailNotes");
    if (detailTransactionId) {
      detailTransactionId.textContent = normalized.id || "-";
    }
    if (detailPatient) {
      detailPatient.textContent = normalized.patientName || "-";
    }
    if (detailService) {
      detailService.textContent = normalized.service || "-";
    }
    if (detailTotal) {
      detailTotal.textContent = formatCurrency(normalized.total);
    }
    if (detailDiscount) {
      detailDiscount.textContent = formatCurrency(normalized.discount);
    }
    if (detailPaid) {
      detailPaid.textContent = formatCurrency(normalized.paid);
    }
    if (detailBalance) {
      detailBalance.textContent = formatCurrency(normalized.balance);
    }
    if (detailMethod) {
      detailMethod.textContent = getTransactionPaymentMethodLabel(normalized);
    }
    if (detailDate) {
      detailDate.textContent = formatDate(normalized.date);
    }
    if (detailStatus) {
      detailStatus.textContent = normalized.status;
      detailStatus.className = `status-badge ${getStatusClass(
        normalized.status,
      )}`;
    }
    if (detailNotes) {
      detailNotes.textContent = normalized.notes || "No notes.";
    }
    renderPaymentHistory(normalized);
    detailsModal.classList.add("active");
    if (window.lucide) {
      lucide.createIcons();
    }
  }
  function closeDetailsModal() {
    detailsModal.classList.remove("active");
    currentDetailsTransaction = null;
  }
  function printReceipt() {
    if (!currentDetailsTransaction) {
      return;
    }
    const t = currentDetailsTransaction;
    const history = getTransactionPaymentHistory(t);
    const latestPayment = history.length ? history[0] : null;
    const paymentId = latestPayment?.id || `${t.id || "PAY"}-1`;
    const amountPaid = latestPayment
      ? Number(latestPayment.amount) || 0
      : Number(t.paid) || 0;
    const totalCharge = Math.max(
      (Number(t.total) || 0) - (Number(t.discount) || 0),
      0,
    );
    const balance = Math.max(totalCharge - (Number(t.paid) || 0), 0);
    const paymentMethod =
      latestPayment?.paymentMethod ||
      getTransactionPaymentMethodLabel(t) ||
      "-";
    let referenceNumber = "N/A";
    if (latestPayment?.notes) {
      const referenceMatch = latestPayment.notes.match(
        /(?:GCash Ref|Bank Ref|Card Ref):\s*(.+)$/i,
      );
      if (referenceMatch?.[1]) {
        referenceNumber = referenceMatch[1].trim();
      }
    }
    const receiptWindow = window.open("", "_blank", "width=560,height=820");
    if (!receiptWindow) {
      showToast("Please allow pop-ups to view the receipt.");
      return;
    }
    const receiptHtml = `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Receipt - ${escapeHtml(t.id || "")}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          * {
            box-sizing: border-box;
          }
          html,
          body {
            margin: 0;
            padding: 0;
            background: #ffffff;
          }
          body {
            font-family: "Poppins", sans-serif;
            color: #17211b;
            padding: 34px;
          }
          .receipt-page {
            width: 100%;
            max-width: 480px;
            margin: 0 auto;
            padding: 27px 27px 25px;
            border: 1px solid #dfe7e2;
            background: #ffffff;
          }
          .receipt-header {
            text-align: center;
          }
          .clinic-name {
            margin: 0;
            color: #17211b;
            font-size: 20px;
            font-weight: 800;
            line-height: 1.25;
            letter-spacing: -0.45px;
          }
          .receipt-subtitle {
            margin: 4px 0 0;
            color: #7c8881;
            font-size: 9.5px;
            font-weight: 400;
          }
          .receipt-divider {
            width: 100%;
            margin: 16px 0 18px;
            border-top: 1px dashed #d4ddd7;
          }
          .receipt-title {
            margin: 0;
            color: #1c2821;
            font-size: 13px;
            font-weight: 800;
            letter-spacing: 0.45px;
            text-align: center;
          }
          .receipt-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 9px;
            margin-top: 19px;
          }
          .receipt-detail-box {
            min-height: 51px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            padding: 8px 10px;
            border: 1px solid #e0e7e3;
            background: #ffffff;
          }
          .receipt-detail-label {
            display: block;
            margin-bottom: 4px;
            color: #7b8780;
            font-size: 7.5px;
            font-weight: 500;
            line-height: 1.2;
            letter-spacing: 0.1px;
            text-transform: uppercase;
          }
          .receipt-detail-value {
            display: block;
            overflow: hidden;
            color: #1e2922;
            font-size: 9.5px;
            font-weight: 700;
            line-height: 1.3;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .receipt-detail-value.status-paid {
            color: #16814b;
          }
          .receipt-total-box {
            min-height: 53px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
            margin-top: 15px;
            padding: 9px 12px;
            background: #eaf7ef;
          }
          .receipt-total-box span {
            color: #283a30;
            font-size: 10px;
            font-weight: 700;
          }
          .receipt-total-box strong {
            color: #08783f;
            font-size: 16px;
            font-weight: 800;
            white-space: nowrap;
          }
          .receipt-balance-box {
            min-height: 48px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
            margin-top: 8px;
            padding: 8px 12px;
            border: 1px solid #f0dfbd;
            background: #fff8e9;
          }
          .receipt-balance-box span {
            color: #303832;
            font-size: 10px;
            font-weight: 500;
          }
          .receipt-balance-box strong {
            color: #1e2922;
            font-size: 12px;
            font-weight: 800;
            white-space: nowrap;
          }
          .receipt-footer {
            margin-top: 20px;
            padding-top: 16px;
            border-top: 1px dashed #d4ddd7;
            text-align: center;
          }
          .receipt-footer p {
            margin: 0;
            color: #7e8983;
            font-size: 8px;
            font-weight: 400;
            line-height: 1.55;
          }
          .receipt-actions {
            display: flex;
            justify-content: center;
            margin-top: 20px;
          }
          .receipt-print-button {
            min-width: 150px;
            padding: 10px 18px;
            border: 0;
            border-radius: 6px;
            background: #16803d;
            color: #ffffff;
            font-family: "Poppins", sans-serif;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
          }
          .receipt-print-button:hover {
            background: #126b33;
          }
          @media print {
            @page {
              size: auto;
              margin: 0;
            }
            html,
            body {
              width: 100%;
              min-height: 100%;
              background: #ffffff;
            }
            body {
              padding: 0;
            }
            .receipt-page {
              max-width: none;
              margin: 0;
              border: 1px solid #dfe7e2;
            }
            .receipt-actions {
              display: none;
            }
          }
          @media (max-width: 520px) {
            body {
              padding: 18px;
            }
            .receipt-page {
              padding: 23px 20px 21px;
            }
            .clinic-name {
              font-size: 18px;
            }
            .receipt-details {
              gap: 7px;
            }
            .receipt-detail-box {
              min-height: 48px;
              padding: 7px 8px;
            }
            .receipt-detail-value {
              font-size: 8.8px;
            }
            .receipt-total-box strong {
              font-size: 15px;
            }
          }
        </style>
      </head>
      <body>
        <div class="receipt-page">
          <header class="receipt-header">
            <h1 class="clinic-name">DentaNueva Dental Clinic</h1>
            <p class="receipt-subtitle">Official Payment Receipt</p>
          </header>
          <div class="receipt-divider"></div>
          <h2 class="receipt-title">PAYMENT RECEIPT</h2>
          <section class="receipt-details">
            <div class="receipt-detail-box">
              <span class="receipt-detail-label">Transaction ID</span>
              <strong class="receipt-detail-value">${escapeHtml(
                t.id || "-",
              )}</strong>
            </div>
            <div class="receipt-detail-box">
              <span class="receipt-detail-label">Payment ID</span>
              <strong class="receipt-detail-value">${escapeHtml(
                paymentId,
              )}</strong>
            </div>
            <div class="receipt-detail-box">
              <span class="receipt-detail-label">Patient</span>
              <strong class="receipt-detail-value">${escapeHtml(
                t.patientName || "-",
              )}</strong>
            </div>
            <div class="receipt-detail-box">
              <span class="receipt-detail-label">Patient ID</span>
              <strong class="receipt-detail-value">${escapeHtml(
                t.patientId || "-",
              )}</strong>
            </div>
            <div class="receipt-detail-box">
              <span class="receipt-detail-label">Service</span>
              <strong class="receipt-detail-value">${escapeHtml(
                t.service || "-",
              )}</strong>
            </div>
            <div class="receipt-detail-box">
              <span class="receipt-detail-label">Date</span>
              <strong class="receipt-detail-value">${escapeHtml(
                formatDate(t.date),
              )}</strong>
            </div>
            <div class="receipt-detail-box">
              <span class="receipt-detail-label">Payment Method</span>
              <strong class="receipt-detail-value">${escapeHtml(
                paymentMethod,
              )}</strong>
            </div>
            <div class="receipt-detail-box">
              <span class="receipt-detail-label">Reference Number</span>
              <strong class="receipt-detail-value">${escapeHtml(
                referenceNumber,
              )}</strong>
            </div>
            <div class="receipt-detail-box">
              <span class="receipt-detail-label">Status</span>
              <strong class="receipt-detail-value ${
                t.status === "Paid" ? "status-paid" : ""
              }">${escapeHtml(t.status || "-")}</strong>
            </div>
            <div class="receipt-detail-box">
              <span class="receipt-detail-label">Total Charge</span>
              <strong class="receipt-detail-value">${escapeHtml(
                formatCurrency(totalCharge),
              )}</strong>
            </div>
          </section>
          <div class="receipt-total-box">
            <span>AMOUNT PAID</span>
            <strong>${escapeHtml(formatCurrency(amountPaid))}</strong>
          </div>
          <div class="receipt-balance-box">
            <span>Remaining Balance</span>
            <strong>${escapeHtml(formatCurrency(balance))}</strong>
          </div>
          <footer class="receipt-footer">
            <p>
              Thank you for your payment.<br>
              This receipt represents the selected payment transaction.
            </p>
          </footer>
          <div class="receipt-actions">
            <button
              type="button"
              class="receipt-print-button"
              onclick="window.focus(); window.print();"
            >
              Print Receipt
            </button>
          </div>
        </div>
      </body>
    </html>
  `;
    receiptWindow.document.open();
    receiptWindow.document.write(receiptHtml);
    receiptWindow.document.close();
  }
  function csvEscape(value) {
    const str = String(value ?? "");
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
  function exportTransactionsToCSV() {
    const filtered = getFilteredTransactions();
    if (filtered.length === 0) {
      showToast("No transactions to export.");
      return;
    }
    const headers = [
      "Transaction ID",
      "Patient ID",
      "Patient",
      "Service",
      "Date",
      "Total",
      "Discount",
      "Paid",
      "Balance",
      "Payment Method",
      "Status",
      "Notes",
    ];
    const rows = filtered.map(function (t) {
      const balance = calculateBalance(t.total, t.discount, t.paid);
      return [
        t.id,
        t.patientId || "",
        t.patientName,
        t.service,
        `'${formatDate(t.date)}`,
        t.total.toFixed(2),
        t.discount.toFixed(2),
        t.paid.toFixed(2),
        balance.toFixed(2),
        getTransactionPaymentMethodLabel(t),
        t.status,
        t.notes || "",
      ]
        .map(csvEscape)
        .join(",");
    });
    const csvContent = [headers.map(csvEscape).join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dentanueva-finance-${getTodayString()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  function deleteTransaction(id) {
    const transaction = transactions.find(function (item) {
      return item.id === id;
    });
    if (!transaction) {
      return;
    }
    const normalized = normalizeTransaction(transaction);
    const confirmed = window.confirm(
      `Delete this payment record?\n\n` +
        `Patient: ${normalized.patientName}\n` +
        `Patient ID: ${normalized.patientId || "-"}\n` +
        `Service: ${normalized.service}\n` +
        `Total: ${formatCurrency(normalized.total)}\n` +
        `Discount: ${formatCurrency(normalized.discount)}\n` +
        `Paid: ${formatCurrency(normalized.paid)}\n` +
        `Balance: ${formatCurrency(normalized.balance)}\n` +
        `Status: ${normalized.status}\n\n` +
        `This action cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }
    transactions = transactions.filter(function (item) {
      return item.id !== id;
    });
    saveTransactions();
    renderPaymentMethods();
    renderTransactions();
    showToast("Payment record deleted successfully.");
  }
  function setDefaultPaymentDate() {
    paymentDateInput.value = getTodayString();
    paymentDateInput.max = getTodayString();
  }
  function showToast(message) {
    let toast = document.querySelector(".finance-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "finance-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toast.hideTimer);
    toast.hideTimer = setTimeout(function () {
      toast.classList.remove("show");
    }, 2500);
  }
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  function getPaymentVerificationState() {
    if (!window.dentaNuevaFinancePaymentProcess) {
      window.dentaNuevaFinancePaymentProcess = {
        referenceNumber: "",
        cashReceived: 0,
        changeAmount: 0,
        method: "",
      };
    }
    return window.dentaNuevaFinancePaymentProcess;
  }
  function getPaymentVerificationElements() {
    return {
      modal: document.getElementById("paymentVerificationModal"),
      box: document.getElementById("paymentVerificationBox"),
      close: document.getElementById("closePaymentVerificationBtn"),
    };
  }
  function closePaymentVerificationModal() {
    const elements = getPaymentVerificationElements();
    if (elements.modal) {
      elements.modal.classList.remove("active");
    }
    if (paymentProcessEditing) {
      paymentProcessEditing = false;
      paymentProcessConfirmed = true;
      showPaymentProcessStatus();
      updateSaveButtonState();
    }
  }
  function showPaymentProcessStatus() {
    const method = paymentMethodInput?.value || "";
    if (!method || !paymentProcessConfirmed) {
      const existing = document.getElementById("paymentProcessStatus");
      if (existing) {
        existing.remove();
      }
      return;
    }
    const state = getPaymentVerificationState();
    const existing = document.getElementById("paymentProcessStatus");
    if (existing) {
      existing.remove();
    }
    const status = document.createElement("div");
    status.id = "paymentProcessStatus";
    status.className = "payment-process-status";
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
    status.innerHTML = `<i data-lucide="check-circle"></i><span>${escapeHtml(
      detail,
    )}</span><button type="button" id="editPaymentProcessBtn">Edit</button>`;
    paymentMethodInput?.parentElement?.appendChild(status);
    document
      .getElementById("editPaymentProcessBtn")
      ?.addEventListener("click", function () {
        paymentProcessEditing = true;
        paymentProcessConfirmed = false;
        openPaymentVerificationModal();
      });
    if (window.lucide) {
      lucide.createIcons();
    }
  }
  function resetPaymentProcess() {
    paymentProcessConfirmed = false;
    paymentProcessEditing = false;
    const state = getPaymentVerificationState();
    state.referenceNumber = "";
    state.cashReceived = 0;
    state.changeAmount = 0;
    state.method = "";
    closePaymentVerificationModal();
    document.getElementById("paymentProcessStatus")?.remove();
    if (paymentProcessBox) {
      paymentProcessBox.innerHTML = "";
    }
    if (paymentProcessWrapper) {
      paymentProcessWrapper.style.display = "none";
    }
    updateSaveButtonState();
  }
  function getCurrentPaymentDue() {
    const calculation = updatePaymentCalculation();
    return Math.max(calculation.balance + calculation.additionalPaid, 0);
  }
  function openPaymentVerificationModal() {
    const elements = getPaymentVerificationElements();
    const method = paymentMethodInput?.value || "";
    if (!elements.modal || !elements.box || !method || editingTransactionId) {
      closePaymentVerificationModal();
      return;
    }
    const state = getPaymentVerificationState();
    if (state.method !== method) {
      state.referenceNumber = "";
      state.cashReceived = 0;
      state.changeAmount = 0;
      state.method = method;
    }
    elements.box.innerHTML = "";
    elements.modal.classList.add("active");
    renderPaymentVerificationContent(method);
    if (window.lucide) {
      lucide.createIcons();
    }
  }
  function renderPaymentVerificationContent(method) {
    const elements = getPaymentVerificationElements();
    if (!elements.box) {
      return;
    }
    const state = getPaymentVerificationState();
    const amountDue = getCurrentPaymentDue();
    const currentAmount = Math.max(Number(paymentPaidInput.value) || 0, 0);
    const methodConfig = {
      Cash: [
        "banknote",
        "Cash Payment",
        "Enter the cash received from the patient.",
      ],
      GCash: [
        "smartphone",
        "GCash Payment",
        "Verify the GCash payment before recording it.",
      ],
      "Bank Transfer": [
        "building-2",
        "Bank Transfer",
        "Verify the transfer reference before recording it.",
      ],
      Card: [
        "credit-card",
        "Card Payment",
        "Verify the card authorization before recording it.",
      ],
    };
    const config = methodConfig[method];
    if (!config) {
      return;
    }
    const header = document.createElement("div");
    header.className = "payment-verification-header";
    header.innerHTML = `<div class="payment-verification-icon"><i data-lucide="${config[0]}"></i></div><div><span class="payment-verification-label">PAYMENT VERIFICATION</span><h3>${escapeHtml(
      config[1],
    )}</h3><p>${escapeHtml(config[2])}</p></div>`;
    elements.box.appendChild(header);
    const summary = document.createElement("div");
    summary.className = "payment-verification-summary";
    summary.innerHTML = `<div><span>Remaining Balance</span><strong id="verificationRemainingBalance">${escapeHtml(
      formatCurrency(amountDue),
    )}</strong></div><div><span>Payment Amount</span><strong id="verificationPaymentAmount">${escapeHtml(
      formatCurrency(currentAmount),
    )}</strong></div>`;
    elements.box.appendChild(summary);
    if (method === "GCash") {
      const qr = document.createElement("div");
      qr.className = "verification-qr-placeholder";
      qr.innerHTML = `<div class="verification-qr-box"><i data-lucide="qr-code"></i></div><strong>Clinic GCash QR</strong><span>Use the clinic's configured GCash QR code to receive payment.</span>`;
      elements.box.appendChild(qr);
    }
    if (method === "Bank Transfer") {
      const bankInfo = document.createElement("div");
      bankInfo.className = "verification-bank-info";
      bankInfo.innerHTML = `<div><span>Payment Type</span><strong>Bank Transfer</strong></div><div><span>Account Details</span><strong>Use the clinic's configured bank account.</strong></div>`;
      elements.box.appendChild(bankInfo);
    }
    const fields = document.createElement("div");
    fields.className = "payment-verification-fields";
    if (method === "Cash") {
      const receivedValue =
        state.cashReceived > 0
          ? state.cashReceived.toFixed(2)
          : currentAmount > 0
            ? currentAmount.toFixed(2)
            : "";
      fields.innerHTML = `<div class="verification-field"><label for="verificationAmountReceived">Amount Received</label><div class="verification-amount-input"><span>₱</span><input type="number" id="verificationAmountReceived" min="0" step="0.01" placeholder="0.00" value="${receivedValue}"></div></div><div class="verification-field"><label>Change</label><div class="verification-static-value" id="verificationChange">${escapeHtml(
        formatCurrency(state.changeAmount),
      )}</div></div>`;
      elements.box.appendChild(fields);
      const receivedInput = document.getElementById(
        "verificationAmountReceived",
      );
      const changeOutput = document.getElementById("verificationChange");
      const paymentOutput = document.getElementById(
        "verificationPaymentAmount",
      );
      receivedInput?.addEventListener("input", function () {
        paymentProcessConfirmed = false;
        const received = Math.max(Number(receivedInput.value) || 0, 0);
        const paymentAmount = Math.min(received, amountDue);
        const change = Math.max(received - amountDue, 0);
        state.cashReceived = received;
        state.changeAmount = change;
        paymentPaidInput.value = paymentAmount.toFixed(2);
        updatePaymentCalculation();
        if (paymentOutput) {
          paymentOutput.textContent = formatCurrency(paymentAmount);
        }
        if (changeOutput) {
          changeOutput.textContent = formatCurrency(change);
        }
        updateSaveButtonState();
      });
    } else {
      const referenceLabel =
        method === "GCash"
          ? "GCash Reference Number"
          : method === "Bank Transfer"
            ? "Transfer Reference Number"
            : "Authorization / Reference Number";
      const referenceId =
        method === "GCash"
          ? "verificationGcashReference"
          : method === "Bank Transfer"
            ? "verificationBankReference"
            : "verificationCardReference";
      fields.innerHTML = `<div class="verification-field"><label for="verificationPaymentAmountInput">Payment Amount</label><div class="verification-amount-input"><span>₱</span><input type="number" id="verificationPaymentAmountInput" min="0.01" max="${amountDue.toFixed(
        2,
      )}" step="0.01" placeholder="0.00" value="${
        currentAmount > 0 ? currentAmount.toFixed(2) : ""
      }"></div></div><div class="verification-field"><label for="${referenceId}">${referenceLabel}</label><input type="text" id="${referenceId}" placeholder="Enter reference number" value="${escapeHtml(
        state.referenceNumber,
      )}"></div>`;
      elements.box.appendChild(fields);
      const amountInput = document.getElementById(
        "verificationPaymentAmountInput",
      );
      const referenceInput = document.getElementById(referenceId);
      const paymentOutput = document.getElementById(
        "verificationPaymentAmount",
      );
      amountInput?.addEventListener("input", function () {
        paymentProcessConfirmed = false;
        const value = Math.min(
          Math.max(Number(amountInput.value) || 0, 0),
          amountDue,
        );
        paymentPaidInput.value = value.toFixed(2);
        updatePaymentCalculation();
        if (paymentOutput) {
          paymentOutput.textContent = formatCurrency(value);
        }
        updateSaveButtonState();
      });
      referenceInput?.addEventListener("input", function () {
        paymentProcessConfirmed = false;
        state.referenceNumber = referenceInput.value.trim();
        updateSaveButtonState();
      });
    }
    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.className =
      "confirm-process-button verification-confirm-button";
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
      const updated = updatePaymentCalculation();
      const remainingDue = Math.max(
        updated.balance + updated.additionalPaid,
        0,
      );
      const paymentAmount = Math.max(Number(paymentPaidInput.value) || 0, 0);
      if (remainingDue <= 0) {
        showToast("This payment is already fully paid.");
        return;
      }
      if (paymentAmount <= 0) {
        showToast("Please enter the payment amount.");
        return;
      }
      if (paymentAmount > remainingDue) {
        showToast(
          "Payment amount cannot be greater than the remaining balance.",
        );
        return;
      }
      if (method === "Cash") {
        const received = Math.max(
          Number(
            document.getElementById("verificationAmountReceived")?.value,
          ) || 0,
          0,
        );
        if (received < paymentAmount) {
          showToast("Amount received cannot be less than the payment amount.");
          return;
        }
        state.cashReceived = received;
        state.changeAmount = Math.max(received - paymentAmount, 0);
        state.referenceNumber = "";
        confirmPaymentProcess(
          `Cash Received: ${formatCurrency(
            received,
          )} · Change: ${formatCurrency(state.changeAmount)}`,
          paymentAmount,
          "",
        );
        return;
      }
      const referenceId =
        method === "GCash"
          ? "verificationGcashReference"
          : method === "Bank Transfer"
            ? "verificationBankReference"
            : "verificationCardReference";
      const ref = document.getElementById(referenceId)?.value.trim() || "";
      if (!ref) {
        showToast(
          `Please enter the ${
            method === "GCash"
              ? "GCash"
              : method === "Bank Transfer"
                ? "bank transfer"
                : "card"
          } reference number.`,
        );
        return;
      }
      state.referenceNumber = ref;
      confirmPaymentProcess(
        `${
          method === "GCash"
            ? "GCash Ref"
            : method === "Bank Transfer"
              ? "Bank Ref"
              : "Card Ref"
        }: ${ref}`,
        paymentAmount,
        ref,
      );
    });
    if (window.lucide) {
      lucide.createIcons();
    }
  }
  function renderPaymentProcessSection(openVerification = false) {
    if (paymentProcessWrapper) {
      paymentProcessWrapper.style.display = "none";
    }
    if (paymentProcessBox) {
      paymentProcessBox.innerHTML = "";
    }
    const method = paymentMethodInput?.value || "";
    if (!method || editingTransactionId) {
      closePaymentVerificationModal();
      document.getElementById("paymentProcessStatus")?.remove();
      updateSaveButtonState();
      return;
    }
    const state = getPaymentVerificationState();
    if (state.method !== method) {
      state.method = method;
      state.referenceNumber = "";
      state.cashReceived = 0;
      state.changeAmount = 0;
      paymentProcessConfirmed = false;
    }
    if (openVerification && !paymentProcessConfirmed) {
      openPaymentVerificationModal();
    } else {
      closePaymentVerificationModal();
      showPaymentProcessStatus();
    }
    updateSaveButtonState();
  }
  function confirmPaymentProcess(
    referenceText,
    paymentAmount,
    referenceNumber = "",
  ) {
    const state = getPaymentVerificationState();
    if (Number.isFinite(Number(paymentAmount)) && Number(paymentAmount) >= 0) {
      paymentPaidInput.value = Number(paymentAmount).toFixed(2);
      updatePaymentCalculation();
    }
    state.referenceNumber = referenceNumber || state.referenceNumber || "";
    paymentProcessConfirmed = true;
    paymentProcessEditing = false;
    closePaymentVerificationModal();
    showPaymentProcessStatus();
    updateSaveButtonState();
    showToast("Payment process verified.");
  }
  function createPaymentHistoryEntry(
    amount,
    paymentMethod,
    date,
    notes,
    createdTime,
    createdAt,
  ) {
    const state = getPaymentVerificationState();
    let historyNotes = notes || "";
    if (paymentMethod === "GCash" && state.referenceNumber) {
      historyNotes = `${historyNotes}${historyNotes ? " · " : ""}GCash Ref: ${
        state.referenceNumber
      }`;
    }
    if (paymentMethod === "Bank Transfer" && state.referenceNumber) {
      historyNotes = `${historyNotes}${historyNotes ? " · " : ""}Bank Ref: ${
        state.referenceNumber
      }`;
    }
    if (paymentMethod === "Card" && state.referenceNumber) {
      historyNotes = `${historyNotes}${historyNotes ? " · " : ""}Card Ref: ${
        state.referenceNumber
      }`;
    }
    return {
      id: `PAY-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      amount: Math.max(Number(amount) || 0, 0),
      paymentMethod: paymentMethod || "",
      referenceNumber: state.referenceNumber || "",
      cashReceived: Math.max(Number(state.cashReceived) || 0, 0),
      changeAmount: Math.max(Number(state.changeAmount) || 0, 0),
      date: date || "",
      notes: historyNotes,
      createdTime: createdTime || "",
      createdAt: createdAt || new Date().toISOString(),
    };
  }
  function normalizePaymentHistory(transaction, fallback) {
    const history = Array.isArray(transaction.paymentHistory)
      ? transaction.paymentHistory
      : [];
    if (history.length) {
      return history
        .map(function (payment, index) {
          return {
            id: payment.id || `${transaction.id || "PAY"}-${index + 1}`,
            amount: Math.max(Number(payment.amount) || 0, 0),
            paymentMethod:
              payment.paymentMethod || fallback.paymentMethod || "",
            referenceNumber:
              payment.referenceNumber || fallback.referenceNumber || "",
            cashReceived: Math.max(Number(payment.cashReceived) || 0, 0),
            changeAmount: Math.max(Number(payment.changeAmount) || 0, 0),
            date: payment.date || fallback.date || "",
            notes: payment.notes || "",
            createdTime: payment.createdTime || fallback.createdTime || "",
            createdAt: payment.createdAt || fallback.createdAt || "",
          };
        })
        .filter(function (payment) {
          return payment.amount > 0;
        });
    }
    if (fallback.paid > 0) {
      return [
        {
          id: `${transaction.id || "PAY"}-1`,
          amount: fallback.paid,
          paymentMethod: fallback.paymentMethod || "",
          referenceNumber: fallback.referenceNumber || "",
          cashReceived: Math.max(Number(fallback.cashReceived) || 0, 0),
          changeAmount: Math.max(Number(fallback.changeAmount) || 0, 0),
          date: fallback.date || "",
          notes: fallback.notes || "",
          createdTime: fallback.createdTime || "",
          createdAt: fallback.createdAt || "",
        },
      ];
    }
    return [];
  }
  function renderPaymentHistory(transaction) {
    if (!paymentHistoryList || !paymentHistoryCount) {
      return;
    }
    const history = getTransactionPaymentHistory(transaction);
    paymentHistoryList.innerHTML = "";
    paymentHistoryCount.textContent = `${history.length} ${
      history.length === 1 ? "payment" : "payments"
    }`;
    if (!history.length) {
      const empty = document.createElement("div");
      empty.className = "payment-history-empty";
      empty.innerHTML = `<div class="payment-history-empty-icon"><i data-lucide="history"></i></div><strong>No payment history</strong><p>Additional payments will appear here.</p>`;
      paymentHistoryList.appendChild(empty);
      if (window.lucide) {
        lucide.createIcons();
      }
      return;
    }
    history.forEach(function (payment, index) {
      const item = document.createElement("div");
      item.className = "payment-history-item";
      const icon =
        payment.paymentMethod === "GCash"
          ? "smartphone"
          : payment.paymentMethod === "Bank Transfer"
            ? "building-2"
            : payment.paymentMethod === "Card"
              ? "credit-card"
              : "banknote";
      const meta = [
        formatDate(payment.date),
        payment.createdTime ? getTimeLabel(payment.createdTime) : "",
        payment.referenceNumber ? `Ref: ${payment.referenceNumber}` : "",
        payment.paymentMethod === "Cash" && payment.changeAmount > 0
          ? `Change: ${formatCurrency(payment.changeAmount)}`
          : "",
      ]
        .filter(Boolean)
        .join(" · ");
      item.innerHTML = `<div class="payment-history-item-left"><div class="payment-history-method-icon"><i data-lucide="${icon}"></i></div><div class="payment-history-item-info"><strong>${escapeHtml(
        payment.paymentMethod || "Payment",
      )}</strong><span>${escapeHtml(
        meta,
      )}</span></div></div><div class="payment-history-item-right"><strong>${escapeHtml(
        formatCurrency(payment.amount),
      )}</strong><span>Payment ${history.length - index}</span></div>`;
      paymentHistoryList.appendChild(item);
    });
    if (window.lucide) {
      lucide.createIcons();
    }
  }
  function closePaymentModal() {
    closePaymentVerificationModal();
    closePatientDropdown();
    closeServiceDropdown();
    paymentModal.classList.remove("active");
    paymentForm.reset();
    editingTransactionId = null;
    additionalPaymentMode = false;
    selectedPatientId = "";
    selectedOutstandingTransactionId = "";
    transactionIdInput.value = "";
    paymentBalanceInput.value = "0.00";
    setFinancePatientId("");
    patientNameInput.removeAttribute("data-patient-id");
    modalTitle.textContent = "Record Payment";
    pendingAppointmentPayment = null;
    setAdditionalPaymentMode(false);
    setAppointmentPaymentMode(false);
    renderAppointmentPaymentInfo();
    resetPaymentProcess();
  }
});
