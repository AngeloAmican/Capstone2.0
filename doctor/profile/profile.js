document.addEventListener("DOMContentLoaded", () => {
  loadProfileModal();
});
let profileSuccessTimeout = null;
let profileModalLoadingPromise = null;
let currentDoctorData = null;
async function loadProfileModal() {
  const existingModal = document.getElementById("profileModalBackdrop");
  if (existingModal) {
    initProfileLogic();
    await loadDoctorProfile();
    return existingModal;
  }
  if (profileModalLoadingPromise) {
    return profileModalLoadingPromise;
  }
  profileModalLoadingPromise = (async () => {
    try {
      const response = await fetch("../profile/profile.html", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Unable to load profile modal.");
      }
      const html = await response.text();
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = html;
      const modal = tempDiv.querySelector("#profileModalBackdrop");
      if (!modal) {
        throw new Error("Profile modal markup was not found.");
      }
      document.body.appendChild(modal);
      initProfileLogic();
      await loadDoctorProfile();
      return modal;
    } catch (error) {
      console.error("Failed to load profile modal:", error);
      return null;
    } finally {
      profileModalLoadingPromise = null;
    }
  })();
  return profileModalLoadingPromise;
}
async function loadDoctorProfile() {
  try {
    const response = await fetch("../profile/profile.php", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });
    if (response.status === 401 || response.status === 403) {
      window.location.href = "../../login/login.html";
      return null;
    }
    if (!response.ok) {
      throw new Error("Unable to load doctor profile.");
    }
    const data = await response.json();
    if (!data.success || !data.user) {
      window.location.href = "../../login/login.html";
      return null;
    }
    currentDoctorData = data.user;
    currentDoctorData.role = "doctor";
    currentDoctorData.doctor_id = currentDoctorData.doctor_id || "";
    currentDoctorData.specialization =
      currentDoctorData.specialization || "General Dentistry";
    currentDoctorData.access_level = currentDoctorData.access_level || "doctor";
    currentDoctorData.status = currentDoctorData.status || "Active";
    updateSidebarProfile(currentDoctorData);
    return currentDoctorData;
  } catch (error) {
    console.error("Failed to load doctor profile:", error);
    return null;
  }
}
function getCurrentUser() {
  if (currentDoctorData && currentDoctorData.role === "doctor") {
    return currentDoctorData;
  }
  const nameEl = document.getElementById("activeDoctorName");
  if (!nameEl) {
    return null;
  }
  const user = {
    user_id: nameEl.dataset.userId || "",
    firstname: nameEl.dataset.firstname || "",
    lastname: nameEl.dataset.lastname || "",
    name: nameEl.textContent.trim(),
    role: nameEl.dataset.role || "doctor",
    doctor_id: nameEl.dataset.doctorId || "",
    specialization: nameEl.dataset.specialization || "",
    email: nameEl.dataset.email || "",
    contact: nameEl.dataset.contact || "",
    status: nameEl.dataset.status || "Active",
    profile_image: nameEl.dataset.profileImage || "",
  };
  if (user.role !== "doctor") {
    return null;
  }
  return user;
}
function isDoctorUser(user) {
  if (!user || typeof user !== "object") {
    return false;
  }
  return (
    String(user.role || "")
      .trim()
      .toLowerCase() === "doctor"
  );
}
function getDoctorId(currentUser = getCurrentUser()) {
  if (!currentUser) {
    return "";
  }
  return String(currentUser.doctor_id || "").trim();
}
function isValidDoctorId(doctorId) {
  return /^DOC-\d{4}$/.test(String(doctorId || "").trim());
}
function getDoctorInitials(name) {
  if (!name) {
    return "DR";
  }
  const cleanName = String(name)
    .trim()
    .replace(/^Dr\.\s*/i, "")
    .replace(/^Dr\s+/i, "");
  if (!cleanName) {
    return "DR";
  }
  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}
function getDoctorData() {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return {
      name: "Doctor",
      initials: "DR",
      image: "",
      role: "Doctor",
      specialization: "General Dentistry",
      doctorId: "No doctor ID available",
      accessLevel: "Doctor",
      email: "",
      contact: "",
      status: "Active",
    };
  }
  const firstname = currentUser.firstname || "";
  const lastname = currentUser.lastname || "";
  const name =
    currentUser.name || `${firstname} ${lastname}`.trim() || "Doctor";
  const doctorId = getDoctorId(currentUser);
  return {
    user_id: currentUser.user_id || "",
    name,
    firstname,
    lastname,
    initials: getDoctorInitials(name),
    image: currentUser.profile_image || "",
    role: currentUser.role || "doctor",
    specialization: currentUser.specialization || "General Dentistry",
    doctorId: doctorId || "No doctor ID available",
    accessLevel: currentUser.access_level || "doctor",
    email: currentUser.email || "",
    contact: currentUser.contact || "",
    status: currentUser.status || "Active",
  };
}
async function saveDoctorData(data) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return false;
  }
  try {
    const formData = new FormData();
    formData.append("action", "update_profile");
    formData.append("contact", data.contact || "");
    formData.append("specialization", data.specialization || "");
    const response = await fetch("../profile/profile.php", {
      method: "POST",
      body: formData,
      credentials: "same-origin",
      cache: "no-store",
    });
    if (response.status === 401 || response.status === 403) {
      window.location.href = "../../login/login.html";
      return false;
    }
    if (!response.ok) {
      throw new Error("Unable to save doctor profile.");
    }
    const result = await response.json();
    if (!result.success || !result.user) {
      return false;
    }
    currentDoctorData = result.user;
    currentDoctorData.role = "doctor";
    currentDoctorData.doctor_id =
      currentDoctorData.doctor_id || currentUser.doctor_id || "";
    currentDoctorData.specialization =
      currentDoctorData.specialization ||
      data.specialization ||
      "General Dentistry";
    currentDoctorData.access_level = currentDoctorData.access_level || "doctor";
    currentDoctorData.status = currentDoctorData.status || "Active";
    return true;
  } catch (error) {
    console.error("Failed to save doctor profile:", error);
    return false;
  }
}
function populateProfileModal(doctor) {
  const nameEl = document.getElementById("profileModalName");
  const roleEl = document.getElementById("profileModalRole");
  const statusEl = document.getElementById("profileModalStatus");
  const doctorIdEl = document.getElementById("profileModalDoctorId");
  const specializationEl = document.getElementById(
    "profileModalSpecialization",
  );
  const specializationInput = document.getElementById(
    "profileModalSpecializationInput",
  );
  const accessLevelEl = document.getElementById("profileModalAccessLevel");
  const emailEl = document.getElementById("profileModalEmail");
  const contactEl = document.getElementById("profileModalContact");
  const contactInput = document.getElementById("profileModalContactInput");
  const imageEl = document.getElementById("profileModalImage");
  const initialsEl = document.getElementById("profileModalInitials");
  if (nameEl) {
    nameEl.textContent = doctor.name;
  }
  if (roleEl) {
    roleEl.textContent = "Doctor";
  }
  if (statusEl) {
    statusEl.textContent = doctor.status;
  }
  if (doctorIdEl) {
    doctorIdEl.textContent = doctor.doctorId;
  }
  if (specializationEl) {
    specializationEl.textContent = doctor.specialization;
  }
  if (specializationInput) {
    specializationInput.value = doctor.specialization || "";
  }
  if (accessLevelEl) {
    accessLevelEl.textContent = "Doctor";
  }
  if (emailEl) {
    emailEl.textContent = doctor.email || "No email available";
  }
  if (contactEl) {
    contactEl.textContent = doctor.contact || "No contact number available";
  }
  if (contactInput) {
    contactInput.value = doctor.contact || "";
  }
  if (imageEl && initialsEl) {
    const initials = getDoctorInitials(doctor.name);
    if (doctor.image) {
      imageEl.src = doctor.image;
      imageEl.style.display = "block";
      initialsEl.textContent = initials;
      initialsEl.style.display = "none";
    } else {
      imageEl.removeAttribute("src");
      imageEl.style.display = "none";
      initialsEl.textContent = initials;
      initialsEl.style.display = "flex";
    }
  }
  clearProfileValidation();
}
function updateSidebarProfile(doctor) {
  const nameEl = document.getElementById("activeDoctorName");
  const imageEl = document.getElementById("activeDoctorImage");
  const initialsEl = document.getElementById("activeDoctorInitials");
  if (nameEl) {
    nameEl.textContent = doctor.name || "Doctor";
    nameEl.dataset.userId = doctor.user_id || "";
    nameEl.dataset.firstname = doctor.firstname || "";
    nameEl.dataset.lastname = doctor.lastname || "";
    nameEl.dataset.role = doctor.role || "doctor";
    nameEl.dataset.doctorId = doctor.doctor_id || "";
    nameEl.dataset.specialization = doctor.specialization || "";
    nameEl.dataset.email = doctor.email || "";
    nameEl.dataset.contact = doctor.contact || "";
    nameEl.dataset.status = doctor.status || "Active";
    nameEl.dataset.profileImage = doctor.profile_image || "";
  }
  if (!imageEl || !initialsEl) {
    return;
  }
  if (doctor.profile_image) {
    imageEl.src = doctor.profile_image;
    imageEl.style.display = "block";
    initialsEl.textContent = getDoctorInitials(doctor.name);
    initialsEl.style.display = "none";
  } else {
    imageEl.removeAttribute("src");
    imageEl.style.display = "none";
    initialsEl.textContent = getDoctorInitials(doctor.name);
    initialsEl.style.display = "flex";
  }
}
async function openProfileModal() {
  let backdrop = document.getElementById("profileModalBackdrop");
  if (!backdrop) {
    backdrop = await loadProfileModal();
  }
  if (!backdrop) {
    console.error("profileModalBackdrop was not found.");
    return;
  }
  initProfileLogic();
  const doctorData = await loadDoctorProfile();
  if (!doctorData) {
    return;
  }
  const card = backdrop.querySelector(".profile-modal-card");
  const doctor = getDoctorData();
  populateProfileModal(doctor);
  updateSidebarProfile(doctorData);
  if (card) {
    card.classList.remove("editing");
  }
  clearProfileValidation();
  hideProfileSaveSuccess();
  backdrop.classList.add("active");
  document.body.style.overflow = "hidden";
}
function closeProfileModal() {
  const backdrop = document.getElementById("profileModalBackdrop");
  if (!backdrop) {
    return;
  }
  const card = backdrop.querySelector(".profile-modal-card");
  if (card) {
    card.classList.remove("editing");
  }
  backdrop.classList.remove("active");
  clearProfileValidation();
  hideProfileSaveSuccess();
  document.body.style.overflow = "";
}
function startProfileEditing() {
  const backdrop = document.getElementById("profileModalBackdrop");
  if (!backdrop) {
    return;
  }
  const card = backdrop.querySelector(".profile-modal-card");
  const contactInput = document.getElementById("profileModalContactInput");
  const specializationInput = document.getElementById(
    "profileModalSpecializationInput",
  );
  if (!card || !contactInput || !specializationInput) {
    return;
  }
  const doctor = getDoctorData();
  contactInput.value = doctor.contact || "";
  specializationInput.value = doctor.specialization || "";
  clearProfileValidation();
  hideProfileSaveSuccess();
  card.classList.add("editing");
  setTimeout(() => {
    specializationInput.focus();
  }, 50);
}
function cancelProfileEditing() {
  const backdrop = document.getElementById("profileModalBackdrop");
  if (!backdrop) {
    return;
  }
  const card = backdrop.querySelector(".profile-modal-card");
  if (!card) {
    return;
  }
  const doctor = getDoctorData();
  populateProfileModal(doctor);
  card.classList.remove("editing");
  clearProfileValidation();
  hideProfileSaveSuccess();
}
function validateContact(contact) {
  return /^09\d{9}$/.test(contact);
}
function showFieldError(input, errorElement, message) {
  if (input) {
    input.classList.add("field-invalid");
    input.setAttribute("aria-invalid", "true");
  }
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.classList.add("show");
  }
}
function clearFieldError(input, errorElement) {
  if (input) {
    input.classList.remove("field-invalid");
    input.removeAttribute("aria-invalid");
  }
  if (errorElement) {
    errorElement.textContent = "";
    errorElement.classList.remove("show");
  }
}
function clearProfileValidation() {
  const contactInput = document.getElementById("profileModalContactInput");
  const contactError = document.getElementById("profileModalContactError");
  clearFieldError(contactInput, contactError);
}
function validateProfileFields() {
  const contactInput = document.getElementById("profileModalContactInput");
  const contactError = document.getElementById("profileModalContactError");
  const specializationInput = document.getElementById(
    "profileModalSpecializationInput",
  );
  if (!contactInput || !specializationInput) {
    return false;
  }
  clearProfileValidation();
  const contact = contactInput.value.trim();
  const specialization = specializationInput.value.trim();
  if (!specialization) {
    specializationInput.focus();
    return false;
  }
  if (!contact) {
    showFieldError(contactInput, contactError, "Contact number is required.");
    contactInput.focus();
    return false;
  }
  if (!validateContact(contact)) {
    showFieldError(
      contactInput,
      contactError,
      "Use a valid 11-digit number starting with 09.",
    );
    contactInput.focus();
    return false;
  }
  return true;
}
async function saveProfileChanges() {
  const backdrop = document.getElementById("profileModalBackdrop");
  if (!backdrop) {
    return;
  }
  const card = backdrop.querySelector(".profile-modal-card");
  const contactInput = document.getElementById("profileModalContactInput");
  const specializationInput = document.getElementById(
    "profileModalSpecializationInput",
  );
  const saveBtn = document.getElementById("profileSaveBtn");
  if (!card || !contactInput || !specializationInput) {
    return;
  }
  if (!validateProfileFields()) {
    return;
  }
  const contact = contactInput.value.trim();
  const specialization = specializationInput.value.trim();
  const doctor = getDoctorData();
  const updatedDoctor = {
    ...doctor,
    contact,
    specialization,
  };
  if (saveBtn) {
    saveBtn.disabled = true;
  }
  const saved = await saveDoctorData(updatedDoctor);
  if (!saved) {
    if (saveBtn) {
      saveBtn.disabled = false;
    }
    return;
  }
  const refreshedDoctor = getDoctorData();
  populateProfileModal(refreshedDoctor);
  updateSidebarProfile(currentDoctorData);
  card.classList.remove("editing");
  if (saveBtn) {
    setTimeout(() => {
      saveBtn.disabled = false;
    }, 300);
  }
  showProfileSaveSuccess();
}
function showProfileSaveSuccess() {
  const successEl = document.getElementById("profileSaveSuccess");
  if (!successEl) {
    return;
  }
  if (profileSuccessTimeout) {
    clearTimeout(profileSuccessTimeout);
  }
  successEl.classList.add("show");
  profileSuccessTimeout = setTimeout(() => {
    successEl.classList.remove("show");
    profileSuccessTimeout = null;
  }, 2500);
}
function hideProfileSaveSuccess() {
  const successEl = document.getElementById("profileSaveSuccess");
  if (profileSuccessTimeout) {
    clearTimeout(profileSuccessTimeout);
    profileSuccessTimeout = null;
  }
  if (successEl) {
    successEl.classList.remove("show");
  }
}
function initProfileLogic() {
  const backdrop = document.getElementById("profileModalBackdrop");
  if (!backdrop) {
    return;
  }
  if (backdrop.dataset.initialized === "true") {
    return;
  }
  backdrop.dataset.initialized = "true";
  const closeBtn = document.getElementById("profileModalClose");
  const editBtn = document.getElementById("profileEditBtn");
  const cancelBtn = document.getElementById("profileCancelBtn");
  const saveBtn = document.getElementById("profileSaveBtn");
  const contactInput = document.getElementById("profileModalContactInput");
  const specializationInput = document.getElementById(
    "profileModalSpecializationInput",
  );
  closeBtn?.addEventListener("click", closeProfileModal);
  editBtn?.addEventListener("click", startProfileEditing);
  cancelBtn?.addEventListener("click", cancelProfileEditing);
  saveBtn?.addEventListener("click", saveProfileChanges);
  specializationInput?.addEventListener("input", () => {
    specializationInput.value = specializationInput.value
      .replace(/\s+/g, " ")
      .replace(/^\s+/, "");
  });
  contactInput?.addEventListener("input", () => {
    contactInput.value = contactInput.value.replace(/\D/g, "").slice(0, 11);
    const contactError = document.getElementById("profileModalContactError");
    if (validateContact(contactInput.value.trim())) {
      clearFieldError(contactInput, contactError);
    }
  });
  contactInput?.addEventListener("blur", () => {
    const contact = contactInput.value.trim();
    const contactError = document.getElementById("profileModalContactError");
    if (!contact) {
      return;
    }
    if (!validateContact(contact)) {
      showFieldError(
        contactInput,
        contactError,
        "Use a valid 11-digit number starting with 09.",
      );
    }
  });
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      closeProfileModal();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && backdrop.classList.contains("active")) {
      closeProfileModal();
    }
  });
  const imageEl = document.getElementById("profileModalImage");
  imageEl?.addEventListener("error", () => {
    const initialsEl = document.getElementById("profileModalInitials");
    imageEl.removeAttribute("src");
    imageEl.style.display = "none";
    if (initialsEl) {
      initialsEl.textContent = getDoctorInitials(getDoctorData().name);
      initialsEl.style.display = "flex";
    }
  });
}
window.addEventListener("open-doctor-profile", () => {
  openProfileModal();
});
window.openProfileModal = openProfileModal;
window.closeProfileModal = closeProfileModal;
window.getDoctorData = getDoctorData;
window.getDoctorId = getDoctorId;
window.getLoggedInDoctor = getCurrentUser;
window.getDoctorInitials = getDoctorInitials;
