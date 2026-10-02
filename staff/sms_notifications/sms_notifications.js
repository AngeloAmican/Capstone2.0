document.addEventListener("DOMContentLoaded", () => {
  initializeSMSPage();
});

const APPOINTMENTS_API = "../../api/appointments.php";
const PATIENT_RECORD_API = "../../api/patient_records.php";
const SMS_PAGE_SIZE = 10;

let smsNotifications = [];
let patients = [];
let appointments = [];
let deleteNotificationId = null;
let toastTimeout = null;
let smsProcessingIds = new Set();
let simulateNextSMSFailureFlag = false;
let smsCurrentPage = 1;

async function initializeSMSPage() {
  await Promise.all([loadPatients(), loadAppointments()]);
  await loadSMSNotifications();
  loadSMSNotifications();
  cleanupOrphanedNotifications();
  syncAppointmentNotifications();
  setupSMSPageSorting();
  bindEvents();
  renderPage();
  processPendingSMSNotifications();
}

async function loadPatients() {
  try {
    const response = await fetch(PATIENT_RECORD_API, { credentials: "same-origin", cache: "no-store" });
    const result = await response.json();
    if (!response.ok || !result.success || !Array.isArray(result.data)) throw new Error(result.message || "Patients unavailable.");
    patients = result.data;
  } catch (error) {
    console.error("Unable to load patients from database:", error);
    patients = [];
  }
}

function getPatientId(patient) {
  return (
    patient?.patientId ||
    patient?.patient_id ||
    patient?.patientID ||
    patient?.id ||
    patient?.referenceId ||
    ""
  );
}

function getPatientName(patient) {
  if (!patient) return "";

  if (patient.fullName) return patient.fullName;
  if (patient.full_name) return patient.full_name;
  if (patient.patientName) return patient.patientName;
  if (patient.name) return patient.name;

  return [patient.firstName, patient.middleName, patient.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function getPatientPhone(patient) {
  return (
    patient?.phone ||
    patient?.phoneNumber ||
    patient?.contactNumber ||
    patient?.contact_number ||
    patient?.mobile ||
    patient?.mobileNumber ||
    ""
  );
}

async function loadAppointments() {
  try {
    const response = await fetch(APPOINTMENTS_API, { credentials: "same-origin", cache: "no-store" });
    const result = await response.json();
    if (!response.ok || !result.success || !Array.isArray(result.data)) throw new Error(result.message || "Appointments unavailable.");
    appointments = result.data;
  } catch (error) {
    console.error("Unable to load appointments from database:", error);
    appointments = [];
  }
}

async function loadSMSNotifications() {
  try {
    const response = await fetch("../../api/staff_notifications.php?type=sms", { credentials: "same-origin", cache: "no-store" });
    const result = await response.json();
    smsNotifications = response.ok && result.success && Array.isArray(result.data) ? result.data : [];
  } catch (error) {
    console.error("Unable to load SMS notifications:", error);
    smsNotifications = [];
  }
}

function saveSMSNotifications() {
  window.dentanuevaSMSNotifications = smsNotifications;
  void fetch("../../api/staff_notifications.php?type=sms", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notifications: smsNotifications }),
  });
}

function setupSMSPageSorting() {
  return;
}

function getSortValue() {
  return "newest";
}

function sortSMSNotifications(notifications) {
  const sorted = [...notifications];

  sorted.sort((a, b) => getNotificationDate(b) - getNotificationDate(a));

  return sorted;
}

function getNotificationDate(notification) {
  if (!notification) return 0;

  const createdAt = notification.createdAt;

  if (createdAt) {
    const createdDate = new Date(createdAt);

    if (!Number.isNaN(createdDate.getTime())) {
      return createdDate.getTime();
    }
  }

  const appointmentDate = notification.appointmentDate || "";

  const appointmentTime = notification.appointmentTime || "00:00";

  if (appointmentDate) {
    const appointmentDateTime = new Date(
      `${appointmentDate}T${appointmentTime}`,
    );

    if (!Number.isNaN(appointmentDateTime.getTime())) {
      return appointmentDateTime.getTime();
    }

    const fallbackDate = new Date(appointmentDate);

    if (!Number.isNaN(fallbackDate.getTime())) {
      return fallbackDate.getTime();
    }
  }

  return 0;
}

function syncAppointmentNotifications() {
  if (!Array.isArray(appointments) || !appointments.length) {
    return;
  }

  if (!Array.isArray(patients) || !patients.length) {
    return;
  }

  let changed = false;

  appointments.forEach((appointment) => {
    if (!appointment) return;

    const patient = findPatientForAppointment(appointment);

    if (!patient) return;

    const patientName = getPatientName(patient);

    const phone = getPatientPhone(patient);

    if (!patientName || !phone) return;

    const appointmentId = getAppointmentId(appointment);

    if (!appointmentId) return;

    const appointmentDate = normalizeDateForInput(
      appointment.date ||
        appointment.appointmentDate ||
        appointment.scheduleDate ||
        appointment.dateOfAppointment ||
        "",
    );

    const appointmentTime = normalizeTimeForInput(
      appointment.start ||
        appointment.time ||
        appointment.appointmentTime ||
        appointment.scheduleTime ||
        "",
    );

    if (!appointmentDate) return;

    const appointmentStatus = getAppointmentStatus(appointment);

    const appointmentSnapshot = getAppointmentSnapshot(
      appointmentDate,
      appointmentTime,
      appointmentStatus,
    );

    const existingAutomaticNotifications = smsNotifications.filter(
      (notification) =>
        notification.source === "appointment" &&
        String(notification.appointmentId || "") === String(appointmentId),
    );

    const previousSnapshot = findLatestAppointmentSnapshot(
      existingAutomaticNotifications,
    );

    if (
      previousSnapshot &&
      hasAppointmentScheduleChanged(
        previousSnapshot,
        appointmentDate,
        appointmentTime,
      )
    ) {
      if (
        appointmentStatus !== "cancelled" &&
        appointmentStatus !== "completed"
      ) {
        const createdReschedule = createAutomaticNotificationIfMissing(
          appointment,
          patient,
          "Appointment Reschedule",
          appointmentDate,
          appointmentTime,
        );

        if (createdReschedule) {
          changed = true;
        }

        const removedReminder =
          removeUndeliveredReminderNotifications(appointmentId);

        if (removedReminder) {
          changed = true;
        }
      }
    }

    if (
      appointmentStatus === "scheduled" ||
      appointmentStatus === "confirmed"
    ) {
      const createdConfirmation = createAutomaticNotificationIfMissing(
        appointment,
        patient,
        "Appointment Confirmation",
        appointmentDate,
        appointmentTime,
      );

      if (createdConfirmation) {
        changed = true;
      }

      const reminderType = getReminderTypeForAppointment(
        appointmentDate,
        appointmentTime,
      );

      if (reminderType) {
        const reminderDueAt = getReminderDueAt(
          appointmentDate,
          appointmentTime,
        );

        if (reminderDueAt) {
          const createdReminder = createAutomaticNotificationIfMissing(
            appointment,
            patient,
            reminderType,
            appointmentDate,
            appointmentTime,
            reminderDueAt.toISOString(),
          );

          if (createdReminder) {
            changed = true;
          }
        }
      }
    }

    if (appointmentStatus === "cancelled") {
      const removedReminder =
        removeUndeliveredReminderNotifications(appointmentId);

      if (removedReminder) {
        changed = true;
      }

      const createdCancellation = createAutomaticNotificationIfMissing(
        appointment,
        patient,
        "Appointment Cancellation",
        appointmentDate,
        appointmentTime,
      );

      if (createdCancellation) {
        changed = true;
      }
    }

    updateAppointmentNotificationSnapshots(
      existingAutomaticNotifications,
      appointmentSnapshot,
    );
  });

  if (changed) {
    saveSMSNotifications();
  }
}

function getAppointmentStatus(appointment) {
  if (!appointment) return "";

  const rawStatus =
    appointment.status ||
    appointment.appointmentStatus ||
    appointment.appointment_status ||
    appointment.state ||
    "";

  const value = String(rawStatus)
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (
    value === "confirmed" ||
    value === "confirm" ||
    value === "scheduled" ||
    value === "schedule" ||
    value === "pending" ||
    value === "waiting"
  ) {
    return "scheduled";
  }

  if (value === "cancelled" || value === "canceled" || value === "cancel") {
    return "cancelled";
  }

  if (value === "completed" || value === "complete" || value === "done") {
    return "completed";
  }

  if (value === "checked in" || value === "checkedin" || value === "check in") {
    return "checkedin";
  }

  if (value === "in consultation" || value === "inconsultation") {
    return "in consultation";
  }

  if (value === "no show" || value === "noshow") {
    return "no-show";
  }

  return value;
}

function getAppointmentId(appointment) {
  return (
    appointment?.id ||
    appointment?.appointmentId ||
    appointment?.appointment_id ||
    appointment?.referenceId ||
    ""
  );
}

function getAppointmentSnapshot(date, time, status) {
  return {
    date: date || "",
    time: time || "",
    status: status || "",
  };
}

function findLatestAppointmentSnapshot(notifications) {
  if (!Array.isArray(notifications) || !notifications.length) {
    return null;
  }

  const sorted = [...notifications].sort(
    (a, b) => getNotificationDate(b) - getNotificationDate(a),
  );

  const notification = sorted.find((item) => item.appointmentSnapshot);

  if (!notification) return null;

  return notification.appointmentSnapshot;
}

function hasAppointmentScheduleChanged(
  previousSnapshot,
  currentDate,
  currentTime,
) {
  if (!previousSnapshot) return false;

  const previousDate = normalizeDateForInput(previousSnapshot.date || "");

  const previousTime = normalizeTimeForInput(previousSnapshot.time || "");

  const newDate = normalizeDateForInput(currentDate || "");

  const newTime = normalizeTimeForInput(currentTime || "");

  return previousDate !== newDate || previousTime !== newTime;
}

function updateAppointmentNotificationSnapshots(
  notifications,
  appointmentSnapshot,
) {
  if (!Array.isArray(notifications)) {
    return;
  }

  notifications.forEach((notification) => {
    notification.appointmentSnapshot = appointmentSnapshot;
  });
}

function getReminderTypeForAppointment(appointmentDate, appointmentTime) {
  const normalizedAppointmentDate = normalizeDateForInput(appointmentDate);

  if (!normalizedAppointmentDate) {
    return null;
  }

  const appointmentDateTime = createLocalDateTimeFromDateAndTime(
    normalizedAppointmentDate,
    appointmentTime,
  );

  if (!appointmentDateTime || Number.isNaN(appointmentDateTime.getTime())) {
    return null;
  }

  if (appointmentDateTime.getTime() <= Date.now()) {
    return null;
  }

  const today = getLocalDateOnly(new Date());

  const appointmentDay = getLocalDateOnly(appointmentDateTime);

  const difference = getDateDifferenceInDays(today, appointmentDay);

  if (difference === 0) {
    return "Same-Day Reminder";
  }

  if (difference > 0) {
    return "Appointment Reminder";
  }

  return null;
}

function getReminderDueAt(appointmentDate, appointmentTime) {
  const normalizedDate = normalizeDateForInput(appointmentDate);

  const normalizedTime = normalizeTimeForInput(appointmentTime);

  if (!normalizedDate || !normalizedTime) {
    return null;
  }

  const appointmentDateTime = createLocalDateTimeFromDateAndTime(
    normalizedDate,
    normalizedTime,
  );

  if (!appointmentDateTime || Number.isNaN(appointmentDateTime.getTime())) {
    return null;
  }

  return new Date(appointmentDateTime.getTime() - 2 * 60 * 60 * 1000);
}

function createLocalDateFromDateString(dateString) {
  const normalized = normalizeDateForInput(dateString);

  if (!normalized) {
    return null;
  }

  const [year, month, day] = normalized.split("-").map(Number);

  return new Date(year, month - 1, day);
}

function createLocalDateTimeFromDateAndTime(dateString, timeString) {
  const normalizedDate = normalizeDateForInput(dateString);

  const normalizedTime = normalizeTimeForInput(timeString);

  if (!normalizedDate) {
    return null;
  }

  const [year, month, day] = normalizedDate.split("-").map(Number);

  const [hour, minute] = (normalizedTime || "00:00").split(":").map(Number);

  return new Date(year, month - 1, day, hour || 0, minute || 0, 0, 0);
}

function getLocalDateOnly(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }

  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getDateDifferenceInDays(startDate, endDate) {
  if (!startDate || !endDate) {
    return null;
  }

  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.round(
    (endDate.getTime() - startDate.getTime()) / millisecondsPerDay,
  );
}

function createAutomaticNotificationIfMissing(
  appointment,
  patient,
  notificationType,
  appointmentDate,
  appointmentTime,
  scheduledFor = null,
) {
  const appointmentId = getAppointmentId(appointment);

  if (!appointmentId) {
    return false;
  }

  const isReminder =
    notificationType === "Appointment Reminder" ||
    notificationType === "Same-Day Reminder";

  const alreadyExists = smsNotifications.some(
    (notification) =>
      notification.source === "appointment" &&
      String(notification.appointmentId || "") === String(appointmentId) &&
      String(notification.type || "") === String(notificationType),
  );

  if (alreadyExists) {
    return false;
  }

  const patientName = getPatientName(patient);

  const phone = getPatientPhone(patient);

  const message = generateAutomaticAppointmentMessage(
    patientName,
    appointmentDate,
    appointmentTime,
    notificationType,
  );

  const notification = {
    id: createID(),
    appointmentId,
    patientId: getPatientId(patient),
    patientName,
    phone,
    message,
    type: notificationType,
    appointmentType: notificationType,
    appointmentDate,
    appointmentTime,
    status: "Pending",
    deliveryStatus: "Pending",
    createdAt: new Date().toISOString(),
    sentAt: null,
    failedAt: null,
    failureReason: null,
    source: "appointment",
    scheduledFor: isReminder && scheduledFor ? scheduledFor : null,
    isScheduledReminder: isReminder,
    appointmentSnapshot: getAppointmentSnapshot(
      appointmentDate,
      appointmentTime,
      getAppointmentStatus(appointment),
    ),
  };

  smsNotifications.unshift(notification);

  return true;
}

function removeUndeliveredReminderNotifications(appointmentId) {
  let changed = false;

  smsNotifications = smsNotifications.filter((notification) => {
    const isSameAppointment =
      notification.source === "appointment" &&
      String(notification.appointmentId || "") === String(appointmentId);

    const isReminder =
      notification.type === "Appointment Reminder" ||
      notification.type === "Same-Day Reminder";

    const isUnsent =
      notification.status === "Pending" || notification.status === "Failed";

    if (isSameAppointment && isReminder && isUnsent) {
      changed = true;
      return false;
    }

    return true;
  });

  if (changed) {
    saveSMSNotifications();
  }

  return changed;
}

function cleanupOrphanedNotifications() {
  if (!Array.isArray(smsNotifications) || !smsNotifications.length) {
    return;
  }

  let changed = false;

  smsNotifications = smsNotifications.filter((notification) => {
    if (!notification) {
      changed = true;
      return false;
    }

    const notificationPatientId = notification.patientId || "";

    const notificationPatientName = notification.patientName || "";

    const matchedPatient = patients.some((patient) => {
      const patientId = getPatientId(patient);

      const patientName = getPatientName(patient);

      if (
        notificationPatientId &&
        patientId &&
        String(notificationPatientId) === String(patientId)
      ) {
        return true;
      }

      if (
        notificationPatientName &&
        patientName &&
        String(notificationPatientName).trim().toLowerCase() ===
          String(patientName).trim().toLowerCase()
      ) {
        return true;
      }

      return false;
    });

    if (!matchedPatient) {
      changed = true;
      return false;
    }

    if (notification.source === "appointment" && notification.appointmentId) {
      const appointmentStillExists = appointments.some(
        (appointment) =>
          String(getAppointmentId(appointment)) ===
          String(notification.appointmentId),
      );

      if (!appointmentStillExists) {
        changed = true;
        return false;
      }
    }

    return true;
  });

  if (changed) {
    saveSMSNotifications();
  }
}

function findPatientForAppointment(appointment) {
  if (!appointment) {
    return null;
  }

  const appointmentPatientId =
    appointment.patientId ||
    appointment.patient_id ||
    appointment.patientID ||
    "";

  const appointmentPatientName =
    appointment.patient ||
    appointment.patientName ||
    appointment.patient_name ||
    appointment.fullName ||
    appointment.name ||
    "";

  if (appointmentPatientId) {
    const patientById = patients.find(
      (patient) =>
        String(getPatientId(patient)) === String(appointmentPatientId),
    );

    if (patientById) {
      return patientById;
    }
  }

  if (appointmentPatientName) {
    const normalizedName = String(appointmentPatientName).trim().toLowerCase();

    const patientByName = patients.find(
      (patient) =>
        String(getPatientName(patient)).trim().toLowerCase() === normalizedName,
    );

    if (patientByName) {
      return patientByName;
    }
  }

  return null;
}

function generateAutomaticAppointmentMessage(
  patientName,
  appointmentDate,
  appointmentTime,
  notificationType,
) {
  const formattedDate = appointmentDate ? formatDate(appointmentDate) : "";

  const formattedTime = appointmentTime ? formatTime(appointmentTime) : "";

  let message = "";

  switch (notificationType) {
    case "Appointment Confirmation":
      message = `Hello ${patientName}, your appointment at DentaNueva Dental Clinic has been confirmed`;

      if (formattedDate) {
        message += ` for ${formattedDate}`;
      }

      if (formattedTime) {
        message += ` at ${formattedTime}`;
      }

      message += ". Thank you!";
      break;

    case "Appointment Reminder":
      message = `Hello ${patientName}, this is a reminder that your appointment at DentaNueva Dental Clinic is scheduled for tomorrow`;

      if (formattedDate) {
        message += `, ${formattedDate}`;
      }

      if (formattedTime) {
        message += ` at ${formattedTime}`;
      }

      message += ". Please arrive 10 minutes early. Thank you!";
      break;

    case "Same-Day Reminder":
      message = `Hello ${patientName}, this is a reminder that your appointment at DentaNueva Dental Clinic is scheduled for today`;

      if (formattedTime) {
        message += ` at ${formattedTime}`;
      }

      message += ". Please arrive 10 minutes early. Thank you!";
      break;

    case "Appointment Reschedule":
      message = `Hello ${patientName}, your appointment at DentaNueva Dental Clinic has been rescheduled`;

      if (formattedDate) {
        message += ` to ${formattedDate}`;
      }

      if (formattedTime) {
        message += ` at ${formattedTime}`;
      }

      message +=
        ". Please take note of your new appointment schedule. Thank you!";
      break;

    case "Appointment Cancellation":
      message = `Hello ${patientName}, your appointment at DentaNueva Dental Clinic scheduled`;

      if (formattedDate) {
        message += ` for ${formattedDate}`;
      }

      if (formattedTime) {
        message += ` at ${formattedTime}`;
      }

      message +=
        " has been cancelled. Please contact the clinic if you need further assistance. Thank you!";
      break;

    default:
      message = `Hello ${patientName}, you have a notification from DentaNueva Dental Clinic. Thank you!`;
  }

  return message.substring(0, 320);
}

function processPendingSMSNotifications() {
  syncDueReminderNotifications();

  const currentTime = Date.now();

  const pendingNotifications = smsNotifications.filter((notification) => {
    if (!notification) {
      return false;
    }

    if (String(notification.status || "").toLowerCase() !== "pending") {
      return false;
    }

    if (
      notification.type === "Appointment Reminder" ||
      notification.type === "Same-Day Reminder"
    ) {
      if (!notification.scheduledFor) {
        return false;
      }

      const scheduledTime = new Date(notification.scheduledFor).getTime();

      if (Number.isNaN(scheduledTime) || currentTime < scheduledTime) {
        return false;
      }
    }

    return true;
  });

  pendingNotifications.forEach((notification) => {
    processSMSNotification(notification.id, false);
  });
}

function syncDueReminderNotifications() {
  if (!Array.isArray(appointments) || !appointments.length) {
    return;
  }

  if (!Array.isArray(patients) || !patients.length) {
    return;
  }

  let changed = false;

  appointments.forEach((appointment) => {
    if (!appointment) {
      return;
    }

    const status = getAppointmentStatus(appointment);

    if (status !== "scheduled") {
      return;
    }

    const appointmentId = getAppointmentId(appointment);

    if (!appointmentId) {
      return;
    }

    const patient = findPatientForAppointment(appointment);

    if (!patient) {
      return;
    }

    const appointmentDate = normalizeDateForInput(
      appointment.date ||
        appointment.appointmentDate ||
        appointment.scheduleDate ||
        appointment.dateOfAppointment ||
        "",
    );

    const appointmentTime = normalizeTimeForInput(
      appointment.start ||
        appointment.time ||
        appointment.appointmentTime ||
        appointment.scheduleTime ||
        "",
    );

    if (!appointmentDate || !appointmentTime) {
      return;
    }

    const reminderType = getReminderTypeForAppointment(
      appointmentDate,
      appointmentTime,
    );

    if (!reminderType) {
      return;
    }

    const reminderDueAt = getReminderDueAt(appointmentDate, appointmentTime);

    if (!reminderDueAt) {
      return;
    }

    const existingReminder = smsNotifications.some(
      (notification) =>
        notification.source === "appointment" &&
        String(notification.appointmentId || "") === String(appointmentId) &&
        (notification.type === "Appointment Reminder" ||
          notification.type === "Same-Day Reminder"),
    );

    if (!existingReminder) {
      const created = createAutomaticNotificationIfMissing(
        appointment,
        patient,
        reminderType,
        appointmentDate,
        appointmentTime,
        reminderDueAt.toISOString(),
      );

      if (created) {
        changed = true;
      }
    }
  });

  if (changed) {
    saveSMSNotifications();
  }
}

function processSMSNotification(notificationId, isRetry = false) {
  const notification = smsNotifications.find(
    (item) => String(item.id) === String(notificationId),
  );

  if (!notification) {
    return;
  }

  if (notification.status !== "Pending" && !isRetry) {
    return;
  }

  if (smsProcessingIds.has(String(notificationId))) {
    return;
  }

  if (
    notification.type === "Appointment Reminder" ||
    notification.type === "Same-Day Reminder"
  ) {
    if (!notification.scheduledFor) {
      return;
    }

    const scheduledTime = new Date(notification.scheduledFor).getTime();

    if (Number.isNaN(scheduledTime) || Date.now() < scheduledTime) {
      return;
    }
  }

  smsProcessingIds.add(String(notificationId));

  notification.status = "Pending";

  notification.deliveryStatus = "Pending";

  notification.failureReason = null;

  saveSMSNotifications();
  renderPage();

  sendSMSNotification(notification)
    .then(() => {
      updateSMSDeliveryStatus(notification.id, "Sent");

      showToast("SMS sent successfully.");
    })
    .catch((error) => {
      const reason = error?.message || "SMS delivery failed.";

      updateSMSDeliveryStatus(notification.id, "Failed", reason);

      showToast("SMS failed to send.", "!");
    })
    .finally(() => {
      smsProcessingIds.delete(String(notificationId));

      renderPage();
    });
}

function sendSMSNotification(notification) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (simulateNextSMSFailureFlag) {
        simulateNextSMSFailureFlag = false;

        reject(new Error("Local SMS simulation failed."));

        return;
      }

      if (!notification.phone || !String(notification.phone).trim()) {
        reject(new Error("No phone number is available."));

        return;
      }

      resolve({
        success: true,
        messageId: "LOCAL-" + Date.now(),
      });
    }, 1000);
  });
}

function retrySMSNotification(notificationId) {
  const notification = smsNotifications.find(
    (item) => String(item.id) === String(notificationId),
  );

  if (!notification) {
    return;
  }

  if (notification.status !== "Failed") {
    return;
  }

  if (
    notification.type === "Appointment Reminder" ||
    notification.type === "Same-Day Reminder"
  ) {
    if (!notification.scheduledFor) {
      return;
    }

    const scheduledTime = new Date(notification.scheduledFor).getTime();

    if (Number.isNaN(scheduledTime) || Date.now() < scheduledTime) {
      return;
    }
  }

  notification.status = "Pending";

  notification.deliveryStatus = "Pending";

  notification.failedAt = null;

  notification.failureReason = null;

  saveSMSNotifications();
  renderPage();

  showToast("SMS retry started.");

  processSMSNotification(notification.id, true);
}

function updateSMSDeliveryStatus(notificationId, status, failureReason = null) {
  const notification = smsNotifications.find(
    (item) => String(item.id) === String(notificationId),
  );

  if (!notification) {
    return false;
  }

  const normalizedStatus = String(status || "")
    .trim()
    .toLowerCase();

  if (normalizedStatus === "sent") {
    notification.status = "Sent";

    notification.deliveryStatus = "Sent";

    notification.sentAt = new Date().toISOString();

    notification.failedAt = null;

    notification.failureReason = null;
  } else if (normalizedStatus === "failed") {
    notification.status = "Failed";

    notification.deliveryStatus = "Failed";

    notification.failedAt = new Date().toISOString();

    notification.sentAt = null;

    notification.failureReason = failureReason || "SMS delivery failed.";
  } else {
    notification.status = "Pending";

    notification.deliveryStatus = "Pending";

    notification.sentAt = null;

    notification.failedAt = null;

    notification.failureReason = null;
  }

  saveSMSNotifications();
  renderPage();

  return true;
}

function renderPage() {
  renderNotifications();
}

function renderNotifications() {
  const tableBody = document.getElementById("notificationTableBody");

  const emptyState = document.getElementById("emptyState");

  const recordCount = document.getElementById("recordCount");

  if (!tableBody) {
    return;
  }

  const filtered = getFilteredNotifications();

  const sorted = sortSMSNotifications(filtered);

  const totalItems = sorted.length;

  const totalPages = Math.max(Math.ceil(totalItems / SMS_PAGE_SIZE), 1);

  if (smsCurrentPage > totalPages) {
    smsCurrentPage = totalPages;
  }

  if (smsCurrentPage < 1) {
    smsCurrentPage = 1;
  }

  const startIndex = (smsCurrentPage - 1) * SMS_PAGE_SIZE;

  const pageItems = sorted.slice(startIndex, startIndex + SMS_PAGE_SIZE);

  tableBody.innerHTML = "";

  if (recordCount) {
    recordCount.textContent = totalItems;
  }

  renderPagination(totalItems, totalPages);

  if (!sorted.length) {
    emptyState?.classList.add("show");

    return;
  }

  emptyState?.classList.remove("show");

  pageItems.forEach((notification) => {
    const row = document.createElement("tr");

    row.innerHTML = createNotificationRow(notification);

    tableBody.appendChild(row);
  });
}

function renderPagination(totalItems, totalPages) {
  const paginationBar = document.getElementById("paginationBar");

  const paginationSummary = document.getElementById("paginationSummary");

  const paginationPageInfo = document.getElementById("paginationPageInfo");

  const prevPageBtn = document.getElementById("prevPageBtn");

  const nextPageBtn = document.getElementById("nextPageBtn");

  if (
    !paginationBar ||
    !paginationSummary ||
    !paginationPageInfo ||
    !prevPageBtn ||
    !nextPageBtn
  ) {
    return;
  }

  if (totalItems <= SMS_PAGE_SIZE) {
    paginationBar.style.display = "none";

    prevPageBtn.disabled = true;

    nextPageBtn.disabled = true;

    return;
  }

  paginationBar.style.display = "flex";

  const startItem = (smsCurrentPage - 1) * SMS_PAGE_SIZE + 1;

  const endItem = Math.min(smsCurrentPage * SMS_PAGE_SIZE, totalItems);

  paginationSummary.textContent = `Showing ${startItem}–${endItem} of ${totalItems} notifications`;

  paginationPageInfo.textContent = `Page ${smsCurrentPage} of ${totalPages}`;

  prevPageBtn.disabled = smsCurrentPage <= 1;

  nextPageBtn.disabled = smsCurrentPage >= totalPages;
}

function createNotificationRow(notification) {
  const initials = getInitials(notification.patientName);

  const statusClass = getStatusClass(notification.status);

  const typeClass = getTypeClass(notification.type);

  const appointmentDate = notification.appointmentDate
    ? formatDate(notification.appointmentDate)
    : "Not specified";

  const appointmentTime = notification.appointmentTime
    ? formatTime(notification.appointmentTime)
    : "Not specified";

  const message = notification.message || "";

  const preview =
    message.length > 85 ? message.substring(0, 85) + "..." : message;

  const isProcessing = smsProcessingIds.has(String(notification.id));

  let actions = `
    <button
      class="action-btn"
      type="button"
      title="View"
      data-action="view"
      data-id="${escapeAttribute(notification.id)}"
    >
      <i class="fa-solid fa-eye"></i>
    </button>
  `;

  if (notification.status === "Failed") {
    actions += `
      <button
        class="action-btn retry"
        type="button"
        title="Retry SMS"
        data-action="retry"
        data-id="${escapeAttribute(notification.id)}"
      >
        <i class="fa-solid fa-rotate-right"></i>
      </button>
    `;
  }

  actions += `
    <button
      class="action-btn delete"
      type="button"
      title="Delete"
      data-action="delete"
      data-id="${escapeAttribute(notification.id)}"
    >
      <i class="fa-solid fa-trash"></i>
    </button>
  `;

  return `
    <td>
      <div class="patient-cell">
        <div class="patient-avatar">
          ${escapeHTML(initials)}
        </div>

        <div class="patient-info">
          <div class="patient-name">
            ${escapeHTML(notification.patientName)}
          </div>

          <div class="patient-id">
            ${escapeHTML(notification.patientId || "No ID")}
          </div>
        </div>
      </div>
    </td>

    <td>
      ${escapeHTML(notification.phone || "-")}
    </td>

    <td class="message-cell">
      <div
        class="message-preview"
        title="${escapeAttribute(message)}"
      >
        ${escapeHTML(preview)}
      </div>
    </td>

    <td>
      <span class="type-badge ${typeClass}">
        ${escapeHTML(notification.type || "-")}
      </span>
    </td>

    <td>
      <div class="appointment-cell">
        <strong>
          ${escapeHTML(appointmentDate)}
        </strong>

        <span>
          ${escapeHTML(appointmentTime)}
        </span>
      </div>
    </td>

    <td>
      <span class="status-badge ${statusClass}">
        <span class="status-dot"></span>
        ${escapeHTML(isProcessing ? "Sending..." : notification.status)}
      </span>
    </td>

    <td>
      <div class="action-buttons">
        ${actions}
      </div>
    </td>
  `;
}

function isFutureScheduledReminder(notification) {
  if (!notification) {
    return false;
  }

  const isReminder =
    notification.type === "Appointment Reminder" ||
    notification.type === "Same-Day Reminder";

  if (!isReminder) {
    return false;
  }

  if (notification.status === "Sent" || notification.status === "Failed") {
    return false;
  }

  if (!notification.scheduledFor) {
    return true;
  }

  const scheduledTime = new Date(notification.scheduledFor).getTime();

  if (Number.isNaN(scheduledTime)) {
    return true;
  }

  return Date.now() < scheduledTime;
}

function getFilteredNotifications() {
  const search =
    document.getElementById("searchInput")?.value.trim().toLowerCase() || "";

  const status = document.getElementById("statusFilter")?.value || "all";

  const type = document.getElementById("typeFilter")?.value || "all";

  return smsNotifications.filter((notification) => {
    if (isFutureScheduledReminder(notification)) {
      return false;
    }

    const patientName = String(notification.patientName || "").toLowerCase();

    const phone = String(notification.phone || "").toLowerCase();

    const notificationStatus = String(notification.status || "");

    const notificationType = String(notification.type || "");

    const searchMatch =
      !search || patientName.includes(search) || phone.includes(search);

    const statusMatch = status === "all" || notificationStatus === status;

    const typeMatch = type === "all" || notificationType === type;

    return searchMatch && statusMatch && typeMatch;
  });
}

function handleTableAction(event) {
  const button = event.target.closest("[data-action]");

  if (!button) {
    return;
  }

  const action = button.dataset.action;

  const id = button.dataset.id;

  if (action === "view") {
    viewNotification(id);
  }

  if (action === "retry") {
    retrySMSNotification(id);
  }

  if (action === "delete") {
    openDeleteModal(id);
  }
}

function viewNotification(id) {
  const notification = smsNotifications.find(
    (item) => String(item.id) === String(id),
  );

  if (!notification) {
    return;
  }

  const details = document.getElementById("notificationDetails");

  if (!details) {
    return;
  }

  details.innerHTML = `
    <div class="detail-row">
      <div class="detail-label">
        Patient
      </div>
      <div class="detail-value">
        ${escapeHTML(notification.patientName)}
      </div>
    </div>

    <div class="detail-row">
      <div class="detail-label">
        Patient ID
      </div>
      <div class="detail-value">
        ${escapeHTML(notification.patientId || "Not specified")}
      </div>
    </div>

    <div class="detail-row">
      <div class="detail-label">
        Phone Number
      </div>
      <div class="detail-value">
        ${escapeHTML(notification.phone || "Not specified")}
      </div>
    </div>

    <div class="detail-row">
      <div class="detail-label">
        Notification Type
      </div>
      <div class="detail-value">
        ${escapeHTML(notification.type || "Not specified")}
      </div>
    </div>

    <div class="detail-row">
      <div class="detail-label">
        Appointment
      </div>

      <div class="detail-value">
        ${
          notification.appointmentDate
            ? escapeHTML(formatDate(notification.appointmentDate))
            : "Date not specified"
        }

        ${
          notification.appointmentTime
            ? " at " + escapeHTML(formatTime(notification.appointmentTime))
            : ""
        }
      </div>
    </div>

    <div class="detail-row">
      <div class="detail-label">
        Status
      </div>

      <div class="detail-value">
        ${escapeHTML(notification.status)}
      </div>
    </div>

    <div class="detail-row">
      <div class="detail-label">
        Source
      </div>

      <div class="detail-value">
        ${
          notification.source === "appointment"
            ? "Automatic Appointment Workflow"
            : "Manual"
        }
      </div>
    </div>

    ${
      notification.scheduledFor
        ? `
          <div class="detail-row">
            <div class="detail-label">
              Scheduled For
            </div>

            <div class="detail-value">
              ${formatDateTime(notification.scheduledFor)}
            </div>
          </div>
        `
        : ""
    }

    <div class="detail-row">
      <div class="detail-label">
        Message
      </div>

      <div class="detail-value">
        ${escapeHTML(notification.message || "")}
      </div>
    </div>

    <div class="detail-row">
      <div class="detail-label">
        Created
      </div>

      <div class="detail-value">
        ${formatDateTime(notification.createdAt)}
      </div>
    </div>

    <div class="detail-row">
      <div class="detail-label">
        Sent At
      </div>

      <div class="detail-value">
        ${
          notification.sentAt
            ? formatDateTime(notification.sentAt)
            : "Not processed"
        }
      </div>
    </div>

    ${
      notification.failedAt
        ? `
          <div class="detail-row">
            <div class="detail-label">
              Failed At
            </div>

            <div class="detail-value">
              ${formatDateTime(notification.failedAt)}
            </div>
          </div>
        `
        : ""
    }

    ${
      notification.failureReason
        ? `
          <div class="detail-row">
            <div class="detail-label">
              Failure Reason
            </div>

            <div class="detail-value">
              ${escapeHTML(notification.failureReason)}
            </div>
          </div>
        `
        : ""
    }
  `;

  openModal("viewModal");
}

function openDeleteModal(id) {
  deleteNotificationId = id;

  openModal("deleteModal");
}

function confirmDelete() {
  if (!deleteNotificationId) {
    return;
  }

  smsNotifications = smsNotifications.filter(
    (item) => String(item.id) !== String(deleteNotificationId),
  );

  saveSMSNotifications();

  closeModal("deleteModal");

  deleteNotificationId = null;

  renderPage();

  showToast("Notification deleted.");
}

function openModal(id) {
  const modal = document.getElementById(id);

  if (!modal) {
    return;
  }

  modal.classList.add("show");
}

function closeModal(id) {
  if (id) {
    const modal = document.getElementById(id);

    if (modal) {
      modal.classList.remove("show");
    }

    return;
  }

  document
    .querySelectorAll(".modal-overlay")
    .forEach((modal) => modal.classList.remove("show"));
}

function bindEvents() {
  document
    .getElementById("closeViewModalBtn")
    ?.addEventListener("click", () => closeModal("viewModal"));

  document
    .getElementById("closeDetailsBtn")
    ?.addEventListener("click", () => closeModal("viewModal"));

  document
    .getElementById("cancelDeleteBtn")
    ?.addEventListener("click", () => closeModal("deleteModal"));

  document
    .getElementById("confirmDeleteBtn")
    ?.addEventListener("click", confirmDelete);

  document.getElementById("searchInput")?.addEventListener("input", () => {
    smsCurrentPage = 1;
    renderNotifications();
  });

  document.getElementById("statusFilter")?.addEventListener("change", () => {
    smsCurrentPage = 1;
    renderNotifications();
  });

  document.getElementById("typeFilter")?.addEventListener("change", () => {
    smsCurrentPage = 1;
    renderNotifications();
  });

  document.getElementById("prevPageBtn")?.addEventListener("click", () => {
    if (smsCurrentPage > 1) {
      smsCurrentPage--;
      renderNotifications();
    }
  });

  document.getElementById("nextPageBtn")?.addEventListener("click", () => {
    const filtered = getFilteredNotifications();

    const totalPages = Math.max(Math.ceil(filtered.length / SMS_PAGE_SIZE), 1);

    if (smsCurrentPage < totalPages) {
      smsCurrentPage++;
      renderNotifications();
    }
  });

  document
    .getElementById("notificationTableBody")
    ?.addEventListener("click", handleTableAction);

  document.querySelectorAll(".modal-overlay").forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        modal.classList.remove("show");
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
    }
  });

  window.addEventListener("storage", handleStorageChange);
}

function handleStorageChange(event) {
  if (event.key === PATIENTS_STORAGE_KEY) {
    loadPatients();
    loadAppointments();
    cleanupOrphanedNotifications();
    syncAppointmentNotifications();
    renderPage();
    processPendingSMSNotifications();
    return;
  }

  if (event.key === APPOINTMENTS_STORAGE_KEY) {
    loadAppointments();
    loadPatients();
    cleanupOrphanedNotifications();
    syncAppointmentNotifications();
    renderPage();
    processPendingSMSNotifications();
    return;
  }

  if (event.key === SMS_STORAGE_KEY) {
    loadSMSNotifications();
    renderPage();
    processPendingSMSNotifications();
  }
}

function createID() {
  return "SMS-" + Date.now() + "-" + Math.random().toString(36).substring(2, 8);
}

function getInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return "NA";
  }

  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getStatusClass(status) {
  if (status === "Sent") {
    return "status-sent";
  }

  if (status === "Failed") {
    return "status-failed";
  }

  return "status-pending";
}

function getTypeClass(type) {
  switch (type) {
    case "Appointment Confirmation":
      return "confirmation";

    case "Appointment Reminder":
      return "reminder";

    case "Same-Day Reminder":
      return "same-day";

    case "Appointment Reschedule":
      return "reschedule";

    case "Appointment Cancellation":
      return "cancellation";

    default:
      return "";
  }
}

function normalizeDateForInput(date) {
  if (!date) {
    return "";
  }

  const value = String(date).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return (
    parsed.getFullYear() +
    "-" +
    String(parsed.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(parsed.getDate()).padStart(2, "0")
  );
}

function normalizeTimeForInput(time) {
  if (!time) {
    return "";
  }

  const value = String(time).trim();

  if (/^\d{2}:\d{2}$/.test(value)) {
    return value;
  }

  if (/^\d{2}:\d{2}:\d{2}$/.test(value)) {
    return value.substring(0, 5);
  }

  const twelveHourMatch = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

  if (twelveHourMatch) {
    let hour = Number(twelveHourMatch[1]);

    const minute = twelveHourMatch[2];

    const suffix = twelveHourMatch[3].toUpperCase();

    if (suffix === "PM" && hour !== 12) {
      hour += 12;
    }

    if (suffix === "AM" && hour === 12) {
      hour = 0;
    }

    return String(hour).padStart(2, "0") + ":" + minute;
  }

  const parsed = new Date(`1970-01-01T${value}`);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return (
    String(parsed.getHours()).padStart(2, "0") +
    ":" +
    String(parsed.getMinutes()).padStart(2, "0")
  );
}

function formatDate(date) {
  const normalized = normalizeDateForInput(date);

  if (!normalized) {
    return "Date not specified";
  }

  const parts = normalized.split("-");

  const dateObject = new Date(
    Number(parts[0]),
    Number(parts[1]) - 1,
    Number(parts[2]),
  );

  return dateObject.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(time) {
  if (!time) {
    return "Time not specified";
  }

  const normalized = normalizeTimeForInput(time);

  if (!normalized) {
    return "Time not specified";
  }

  const parts = normalized.split(":");

  let hour = Number(parts[0]);

  const minute = parts[1];

  const suffix = hour >= 12 ? "PM" : "AM";

  hour = hour % 12 || 12;

  return `${hour}:${minute} ${suffix}`;
}

function formatDateTime(value) {
  if (!value) {
    return "Not specified";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not specified";
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHTML(value);
}

function showToast(message, icon = "✓") {
  const toast = document.getElementById("toast");

  const toastMessage = document.getElementById("toastMessage");

  const toastIcon = document.getElementById("toastIcon");

  if (!toast || !toastMessage || !toastIcon) {
    return;
  }

  if (icon === "!") {
    toastIcon.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i>';
  } else if (icon === "i") {
    toastIcon.innerHTML = '<i class="fa-solid fa-info"></i>';
  } else {
    toastIcon.innerHTML = '<i class="fa-solid fa-check"></i>';
  }

  toastMessage.textContent = message;

  toast.classList.add("show");

  clearTimeout(toastTimeout);

  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

window.simulateNextSMSFailure = function () {
  simulateNextSMSFailureFlag = true;

  const pendingNotification = smsNotifications.find(
    (notification) =>
      notification &&
      notification.status === "Pending" &&
      !smsProcessingIds.has(String(notification.id)) &&
      (notification.type === "Appointment Confirmation" ||
        notification.type === "Appointment Reschedule" ||
        notification.type === "Appointment Cancellation" ||
        ((notification.type === "Appointment Reminder" ||
          notification.type === "Same-Day Reminder") &&
          notification.scheduledFor &&
          Date.now() >= new Date(notification.scheduledFor).getTime())),
  );

  if (pendingNotification) {
    processSMSNotification(pendingNotification.id, false);
  }
};

setInterval(() => {
  loadAppointments();
  loadPatients();
  loadSMSNotifications();
  cleanupOrphanedNotifications();
  syncAppointmentNotifications();
  processPendingSMSNotifications();
  renderPage();
}, 60000);
