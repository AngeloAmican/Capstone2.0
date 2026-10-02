const togglePasswordBtn = document.getElementById("togglePasswordBtn");
const passwordInput = document.getElementById("password");
const eyeIcon = document.getElementById("eyeIcon");
if (togglePasswordBtn) {
  togglePasswordBtn.addEventListener("click", function () {
    const type =
      passwordInput.getAttribute("type") === "password" ? "text" : "password";
    passwordInput.setAttribute("type", type);
    eyeIcon.classList.toggle("fa-eye");
    eyeIcon.classList.toggle("fa-eye-slash");
  });
}
const toggleConfirmBtn = document.getElementById("toggleConfirmBtn");
const confirmInput = document.getElementById("confirm_password");
const eyeIconConfirm = document.getElementById("eyeIconConfirm");
if (toggleConfirmBtn) {
  toggleConfirmBtn.addEventListener("click", function () {
    const type =
      confirmInput.getAttribute("type") === "password" ? "text" : "password";
    confirmInput.setAttribute("type", type);
    eyeIconConfirm.classList.toggle("fa-eye");
    eyeIconConfirm.classList.toggle("fa-eye-slash");
  });
}
document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.querySelector(".auth-form");
  const passwordField = document.getElementById("password");
  const confirmPasswordField = document.getElementById("confirm_password");
  const emailField = document.getElementById("email");
  const requirementsBox = document.getElementById("passwordRequirements");
  const lengthRule = document.getElementById("lengthRule");
  const upperRule = document.getElementById("upperRule");
  const numberRule = document.getElementById("numberRule");
  const specialRule = document.getElementById("specialRule");
  function checkPasswordRequirements(pwd) {
    const minLength = pwd.length >= 8;
    const hasUppercase = /[A-Z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecialChar = /[^a-zA-Z0-9]/.test(pwd);
    if (lengthRule) {
      lengthRule.className = minLength ? "valid" : "invalid";
    }
    if (upperRule) {
      upperRule.className = hasUppercase ? "valid" : "invalid";
    }
    if (numberRule) {
      numberRule.className = hasNumber ? "valid" : "invalid";
    }
    if (specialRule) {
      specialRule.className = hasSpecialChar ? "valid" : "invalid";
    }
    const allMet = minLength && hasUppercase && hasNumber && hasSpecialChar;
    if (requirementsBox) {
      requirementsBox.style.display = allMet ? "none" : "flex";
    }
    return allMet;
  }
  if (passwordField) {
    passwordField.addEventListener("input", () => {
      checkPasswordRequirements(passwordField.value);
      passwordField.setCustomValidity("");
    });
  }
  [confirmPasswordField, emailField].forEach((field) => {
    if (field) {
      field.addEventListener("input", () => {
        field.setCustomValidity("");
      });
    }
  });
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const firstname = document.getElementById("firstname").value.trim();
      const lastname = document.getElementById("lastname").value.trim();
      const email = emailField.value.trim().toLowerCase();
      const password = passwordField.value;
      const confirmPassword = confirmPasswordField.value;
      if (!checkPasswordRequirements(password)) {
        passwordField.setCustomValidity(
          "Please meet all password requirements listed below.",
        );
        passwordField.reportValidity();
        return;
      }
      if (password !== confirmPassword) {
        confirmPasswordField.setCustomValidity(
          "Passwords do not match. Please try again.",
        );
        confirmPasswordField.reportValidity();
        return;
      }
      const formData = new FormData(signupForm);
      formData.set("firstname", firstname);
      formData.set("lastname", lastname);
      formData.set("email", email);
      formData.set("password", password);
      formData.set("confirm_password", confirmPassword);
      const submitButton = signupForm.querySelector(".btn-submit");
      const originalButtonText = submitButton ? submitButton.textContent : "";
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Creating Account...";
      }
      try {
        const response = await fetch("signup.php", {
          method: "POST",
          body: formData,
          credentials: "same-origin",
        });
        const data = await response.json();
        if (!data.success) {
          if (data.message && data.message.toLowerCase().includes("email")) {
            emailField.setCustomValidity(data.message);
            emailField.reportValidity();
          } else {
            showSignupError(
              data.message || "Unable to create the account. Please try again.",
            );
          }
          return;
        }
        window.location.href = "../login/login.html";
      } catch (error) {
        console.error("Signup request error:", error);
        showSignupError("Unable to connect to the server. Please try again.");
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalButtonText;
        }
      }
    });
  }
  function showSignupError(message) {
    if (emailField) {
      emailField.setCustomValidity(message);
      emailField.reportValidity();
    }
  }
});
