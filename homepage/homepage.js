document.addEventListener("DOMContentLoaded", () => {
  const navToggleBtn = document.getElementById("navToggleBtn");
  const navMenuWrapper = document.getElementById("navMenuWrapper");
  const navOverlay = document.getElementById("navOverlay");
  const pageBlurWrapper = document.getElementById("pageBlurWrapper");
  const navToggleIcon = document.getElementById("navToggleIcon");
  const navBrand = document.getElementById("navBrand");
  const homeNavbar = document.getElementById("homeNavbar");

  function toggleMobileMenu() {
    const isOpen = navMenuWrapper.classList.toggle("mobile-open");

    navToggleBtn?.setAttribute("aria-expanded", String(isOpen));

    if (navOverlay) {
      navOverlay.classList.toggle("active", isOpen);
    }

    if (pageBlurWrapper) {
      pageBlurWrapper.classList.toggle("is-blurred", isOpen);
    }

    if (navBrand) {
      navBrand.classList.toggle("hidden", isOpen);
    }

    if (homeNavbar) {
      homeNavbar.classList.toggle("nav-active-bg", isOpen);
    }

    if (navToggleIcon) {
      navToggleIcon.className = isOpen
        ? "fa-solid fa-xmark"
        : "fa-solid fa-bars";
    }
  }

  if (navToggleBtn) {
    navToggleBtn.addEventListener("click", toggleMobileMenu);
  }

  if (navOverlay) {
    navOverlay.addEventListener("click", toggleMobileMenu);
  }

  const mobileLinks = document.querySelectorAll(".nav-links a");

  mobileLinks.forEach((link) => {
    link.addEventListener("click", () => {
      if (navMenuWrapper.classList.contains("mobile-open")) {
        toggleMobileMenu();
      }
    });
  });

  const openLoginBtn = document.getElementById("openLoginBtn");
  const openAppointmentBtn = document.getElementById("openAppointmentBtn");
  const openAppointmentSectionBtn = document.getElementById(
    "openAppointmentSectionBtn",
  );
  const loginModalOverlay = document.getElementById("loginModalOverlay");
  const modalCloseBtn = document.getElementById("modalCloseBtn");
  const loginIframe = document.getElementById("loginIframe");
  let lastFocusedElement;

  function openLoginModal(event) {
    event.preventDefault();

    if (loginModalOverlay) {
      lastFocusedElement = document.activeElement;
      loginModalOverlay.classList.add("active");
      loginModalOverlay.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
      modalCloseBtn?.focus();
    }
  }

  function closeLoginModal() {
    if (!loginModalOverlay) {
      return;
    }

    loginModalOverlay.classList.remove("active");
    loginModalOverlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    lastFocusedElement?.focus();
  }

  if (openLoginBtn && loginModalOverlay) {
    openLoginBtn.addEventListener("click", openLoginModal);
  }

  if (openAppointmentBtn && loginModalOverlay) {
    openAppointmentBtn.addEventListener("click", openLoginModal);
  }

  if (openAppointmentSectionBtn && loginModalOverlay) {
    openAppointmentSectionBtn.addEventListener("click", openLoginModal);
  }

  if (modalCloseBtn && loginModalOverlay) {
    modalCloseBtn.addEventListener("click", closeLoginModal);
  }

  if (loginModalOverlay) {
    loginModalOverlay.addEventListener("click", (event) => {
      if (event.target === loginModalOverlay) {
        closeLoginModal();
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      loginModalOverlay?.classList.contains("active")
    ) {
      closeLoginModal();
    }
  });

  loginIframe?.addEventListener("load", () => {
    if (loginModalOverlay?.classList.contains("active")) {
      modalCloseBtn?.focus();
    }
  });

  const heroSlides = document.querySelectorAll(".hero-slide");
  const heroSlider = document.getElementById("heroSlider");
  const heroSliderDots = document.getElementById("heroSliderDots");
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );
  let currentHeroSlide = 0;
  let heroSlideInterval;

  function showHeroSlide(index) {
    if (!heroSlides.length) {
      return;
    }

    if (index < 0 || index >= heroSlides.length) {
      index = 0;
    }

    heroSlides.forEach((slide, slideIndex) => {
      slide.classList.toggle("active", slideIndex === index);
    });

    heroSliderDots?.querySelectorAll("button").forEach((dot, dotIndex) => {
      dot.classList.toggle("active", dotIndex === index);
      dot.setAttribute("aria-current", dotIndex === index ? "true" : "false");
    });

    currentHeroSlide = index;
  }

  function startHeroSlider() {
    clearInterval(heroSlideInterval);

    if (heroSlides.length > 1 && !prefersReducedMotion.matches) {
      heroSlideInterval = setInterval(() => {
        const nextSlide = (currentHeroSlide + 1) % heroSlides.length;
        showHeroSlide(nextSlide);
      }, 4500);
    }
  }

  if (heroSliderDots && heroSlides.length > 1) {
    heroSlides.forEach((_, slideIndex) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "hero-slider-dot";
      dot.setAttribute("aria-label", `Show hero image ${slideIndex + 1}`);
      dot.addEventListener("click", () => {
        showHeroSlide(slideIndex);
        startHeroSlider();
      });
      heroSliderDots.append(dot);
    });
  }

  heroSlider?.addEventListener("mouseenter", () =>
    clearInterval(heroSlideInterval),
  );
  heroSlider?.addEventListener("mouseleave", startHeroSlider);
  heroSlider?.addEventListener("focusin", () =>
    clearInterval(heroSlideInterval),
  );
  heroSlider?.addEventListener("focusout", startHeroSlider);
  prefersReducedMotion.addEventListener?.("change", startHeroSlider);

  if (heroSlides.length > 0) {
    showHeroSlide(0);
    startHeroSlider();
  }

  const navLinks = document.querySelectorAll(".nav-link");
  const sections = Array.from(navLinks)
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);
  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        navLinks.forEach((link) => {
          link.classList.toggle(
            "active",
            link.getAttribute("href") === `#${entry.target.id}`,
          );
        });
      });
    },
    { rootMargin: "-25% 0px -65% 0px" },
  );

  sections.forEach((section) => sectionObserver.observe(section));
});
