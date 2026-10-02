(() => {
  "use strict";

  const API = "../../api/appointments.php";

  async function request(options = {}, url = API) {
    const response = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
      ...options,
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || "Appointment request failed.");
    }
    return result.data;
  }

  window.DentaNuevaAppointmentDatabase = Object.freeze({
    async load(params = {}) {
      const url = new URL(API, window.location.href);
      Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") return;
        url.searchParams.set(key, String(value));
      });
      return (
        (await request(
          {
            method: "GET",
          },
          url,
        )) || []
      );
    },
    async save(appointments) {
      return request({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointments }),
      });
    },
    async reschedule(appointment) {
      return request({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reschedule: appointment }),
      });
    },
    async remove(id) {
      return request({
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    },
    async loadRescheduleRequests() {
      return (await request({}, `${API}?scope=reschedule_requests`)) || [];
    },
    async saveRescheduleRequests(requests) {
      return request({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reschedule_requests: requests }),
      });
    },
  });
})();
