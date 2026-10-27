// -----------------------------
// User menu
// -----------------------------
const userButton = document.getElementById("userButton");
const userDropdown = document.getElementById("userDropdown");

// Toggle the profile dropdown when the avatar is clicked.
userButton.addEventListener("click", () => {
  const isOpen = userDropdown.classList.toggle("open");
  userDropdown.setAttribute("aria-hidden", String(!isOpen));
  userButton.setAttribute("aria-expanded", String(isOpen));
});

// Close the dropdown when the user clicks anywhere else.
document.addEventListener("click", (event) => {
  if (!event.target.closest(".user-menu")) {
    userDropdown.classList.remove("open");
    userDropdown.setAttribute("aria-hidden", "true");
    userButton.setAttribute("aria-expanded", "false");
  }
});

// -----------------------------
// Submission form
// -----------------------------
const form = document.getElementById("incidentForm");
const cancelConfirm = document.getElementById("cancelConfirm");
const cancelConfirmBackdrop = document.getElementById("cancelConfirmBackdrop");
const successConfirm = document.getElementById("successConfirm");
const successConfirmBackdrop = document.getElementById(
  "successConfirmBackdrop",
);
const errorConfirm = document.getElementById("errorConfirm");
const errorConfirmBackdrop = document.getElementById("errorConfirmBackdrop");

const closeCancelConfirm = () => {
  cancelConfirm.close();
  cancelConfirmBackdrop.hidden = true;
};

cancelConfirm.addEventListener("close", () => {
  cancelConfirmBackdrop.hidden = true;
});

// Show a styled confirmation dialog before leaving and discarding the form.
document.getElementById("cancelButton").addEventListener("click", (event) => {
  event.preventDefault();
  cancelConfirmBackdrop.hidden = false;
  cancelConfirm.showModal();
});

// Close the confirmation dialog and return to the form.
document.getElementById("keepEditing").addEventListener("click", () => {
  closeCancelConfirm();
});

// Leave the page only after the user explicitly confirms.
document.getElementById("discardChanges").addEventListener("click", () => {
  window.location.href = "repDashboard.html";
});

// Clicking outside the dialog keeps the user on the form.
cancelConfirm.addEventListener("click", (event) => {
  const bounds = cancelConfirm.getBoundingClientRect();
  const clickedOutside =
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom;

  if (clickedOutside) {
    closeCancelConfirm();
  }
});

// Escape closes the confirmation dialog.
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && cancelConfirm.open) closeCancelConfirm();
  if (event.key === "Escape" && successConfirm.open) closeSuccessConfirm();
  if (event.key === "Escape" && errorConfirm.open) closeErrorConfirm();
});

const closeSuccessConfirm = () => {
  successConfirm.close();
  successConfirmBackdrop.hidden = true;
};

const closeErrorConfirm = () => {
  errorConfirm.close();
  errorConfirmBackdrop.hidden = true;
};

successConfirm.addEventListener("close", () => {
  successConfirmBackdrop.hidden = true;
});

errorConfirm.addEventListener("close", () => {
  errorConfirmBackdrop.hidden = true;
});

document.getElementById("successDone").addEventListener("click", () => {
  window.location.href = "repDashboard.html";
});

document.getElementById("errorDone").addEventListener("click", () => {
  closeErrorConfirm();
});

successConfirm.addEventListener("click", (event) => {
  const bounds = successConfirm.getBoundingClientRect();
  const clickedOutside =
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom;

  if (clickedOutside) closeSuccessConfirm();
});

errorConfirm.addEventListener("click", (event) => {
  const bounds = errorConfirm.getBoundingClientRect();
  const clickedOutside =
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom;

  if (clickedOutside) closeErrorConfirm();
});

const submitButton = form.querySelector('button[type="submit"]');
const requiredFields = form.querySelectorAll(
  "input[required], select[required], textarea[required]",
);

const setFieldError = (field, message) => {
  const error = document.getElementById(`${field.id}Error`);
  field.classList.toggle("input-error", Boolean(message));
  error.textContent = message || "";
  return !message;
};

const validateField = (field) => {
  const value = field.value.trim();

  if (!value) {
    if (field.id === "coordinates") {
      return setFieldError(field, "Location is required.");
    }

    const label = form.querySelector(`label[for="${field.id}"]`);
    const fieldName = label
      ? label.textContent.replace("*", "").trim()
      : field.name;
    return setFieldError(field, `${fieldName} is required.`);
  }

  return setFieldError(field, "");
};

requiredFields.forEach((field) => {
  field.addEventListener("blur", () => validateField(field));
  field.addEventListener("input", () => validateField(field));
  field.addEventListener("change", () => validateField(field));
});

const showSubmissionError = () => {
  errorConfirmBackdrop.hidden = false;
  errorConfirm.showModal();
};

const showSuccessMessage = () => {
  successConfirmBackdrop.hidden = false;
  successConfirm.showModal();
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const invalidFields = [...requiredFields].filter(
    (field) => !validateField(field),
  );
  if (invalidFields.length) {
    invalidFields[0].focus();
    return;
  }

  const location = document.getElementById("coordinates").value.trim();

  const formData = new FormData(form);
  const submission = {
    title: formData.get("title"),
    description: formData.get("description"),
    severity: formData.get("severity"),
    location,
  };

  submitButton.disabled = true;
  submitButton.textContent = "Submitting...";

  try {
    const response = await fetch("/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submission),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.detail || "Incident submission failed.");
    }

    showSuccessMessage();
    form.reset();
    coordinates.value = "";
    requiredFields.forEach((field) => setFieldError(field, ""));
    mapCard.hidden = true;
  } catch (error) {
    console.error("Incident submission failed.", error);
    showSubmissionError();
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = "Submit report <span>→</span>";
  }
});

// -----------------------------
// Location lookup
// -----------------------------
const locationButton = document.getElementById("locationButton");
const coordinates = document.getElementById("coordinates");
const mapCard = document.getElementById("mapCard");
const mapFrame = document.getElementById("mapFrame");

// Ask the browser for the user's current coordinates.
locationButton.addEventListener("click", () => {
  if (!navigator.geolocation) {
    coordinates.value = "";
    validateField(coordinates);
    return;
  }

  locationButton.disabled = true;
  locationButton.textContent = "Getting location...";
  coordinates.value = "";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      const latitudeDirection = latitude >= 0 ? "N" : "S";
      const longitudeDirection = longitude >= 0 ? "E" : "W";

      coordinates.value =
        `${Math.abs(latitude).toFixed(6)}° ${latitudeDirection}, ` +
        `${Math.abs(longitude).toFixed(6)}° ${longitudeDirection}`;
      validateField(coordinates);

      // Build a small OpenStreetMap view with a marker at the retrieved point.
      const mapPadding = 0.01;
      const left = longitude - mapPadding;
      const right = longitude + mapPadding;
      const bottom = latitude - mapPadding;
      const top = latitude + mapPadding;

      mapFrame.src =
        "https://www.openstreetmap.org/export/embed.html" +
        `?bbox=${left},${bottom},${right},${top}` +
        `&layer=mapnik&marker=${latitude},${longitude}`;

      mapCard.hidden = false;
      locationButton.disabled = false;
      locationButton.textContent = "Update location";
    },
    () => {
      coordinates.value = "";
      validateField(coordinates);
      locationButton.disabled = false;
      locationButton.textContent = "Try again";
    },
  );
});

document
  .getElementById("logoutButton")
  .addEventListener("click", window.logoutUser);
