(() => {
  "use strict";

  const RESTRICTIONS_STORAGE_KEY = "dentanueva_appointment_restrictions";
  const NO_SHOW_WARNING_THRESHOLD = 2;
  const NO_SHOW_THRESHOLD = 3;
  const RESTRICTION_DAYS = 2;

  function normalizeStatus(status) {
    return String(status || "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "");
  }

  function getPatientId(appointment) {
    return String(
      appointment?.patientId ??
        appointment?.patientID ??
        appointment?.patient_id ??
        "",
    ).trim();
  }

  function getStoredRestrictions() {
    try {
      const parsed = JSON.parse(
        localStorage.getItem(RESTRICTIONS_STORAGE_KEY) || "{}",
      );
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {
      return {};
    }
  }

  function saveStoredRestrictions(restrictions) {
    localStorage.setItem(
      RESTRICTIONS_STORAGE_KEY,
      JSON.stringify(restrictions),
    );
  }

  function getNoShowCount(appointments, patientId) {
    const normalizedPatientId = String(patientId || "")
      .trim()
      .toLowerCase();
    if (!normalizedPatientId || !Array.isArray(appointments)) return 0;

    return appointments.filter((appointment) => {
      return (
        getPatientId(appointment).toLowerCase() === normalizedPatientId &&
        normalizeStatus(
          appointment?.status || appointment?.appointmentStatus,
        ) === "noshow"
      );
    }).length;
  }

  function addDays(date, days) {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    result.setDate(result.getDate() + days);
    return result;
  }

  function syncRestriction(appointments, patientId, now = new Date()) {
    const normalizedPatientId = String(patientId || "").trim();
    const noShowCount = getNoShowCount(appointments, normalizedPatientId);
    const restrictions = getStoredRestrictions();
    const current = restrictions[normalizedPatientId] || {};

    if (noShowCount < NO_SHOW_THRESHOLD) {
      if (restrictions[normalizedPatientId]) {
        delete restrictions[normalizedPatientId];
        saveStoredRestrictions(restrictions);
      }
      return {};
    }

    const previousTriggeredCount = Number(current.triggeredNoShowCount) || 0;
    const reachedThreshold =
      noShowCount >= NO_SHOW_THRESHOLD && noShowCount % NO_SHOW_THRESHOLD === 0;

    if (reachedThreshold && noShowCount > previousTriggeredCount) {
      const restrictedUntil = addDays(now, RESTRICTION_DAYS);
      restrictions[normalizedPatientId] = {
        triggeredNoShowCount: noShowCount,
        restrictedUntil: restrictedUntil.toISOString(),
      };
      saveStoredRestrictions(restrictions);
      return restrictions[normalizedPatientId];
    }

    return current;
  }

  function getRestriction(appointments, patientId, now = new Date()) {
    const restriction = syncRestriction(appointments, patientId, now);
    const noShowCount = getNoShowCount(appointments, patientId);
    const restrictedUntil = new Date(restriction?.restrictedUntil || "");
    const isRestricted =
      !Number.isNaN(restrictedUntil.getTime()) && restrictedUntil > now;

    return {
      isRestricted,
      isWarning: !isRestricted && noShowCount >= NO_SHOW_WARNING_THRESHOLD,
      noShowCount,
      restrictedUntil: isRestricted ? restrictedUntil : null,
      triggeredNoShowCount: Number(restriction?.triggeredNoShowCount) || 0,
    };
  }

  function formatRestrictionEnd(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  window.DentaNuevaAppointmentBehavior = Object.freeze({
    RESTRICTIONS_STORAGE_KEY,
    NO_SHOW_WARNING_THRESHOLD,
    NO_SHOW_THRESHOLD,
    RESTRICTION_DAYS,
    getNoShowCount,
    getRestriction,
    formatRestrictionEnd,
  });
})();
