// -----------------------------
// User menu
// -----------------------------
const userButton = document.getElementById("userButton");
const userDropdown = document.getElementById("userDropdown");

userButton.addEventListener("click", () => {
  const isOpen = userDropdown.classList.toggle("open");
  userDropdown.setAttribute("aria-hidden", String(!isOpen));
  userButton.setAttribute("aria-expanded", String(isOpen));
});

// Close the dropdown when the user clicks outside the profile area.
document.addEventListener("click", (event) => {
  if (!event.target.closest(".user-menu")) {
    userDropdown.classList.remove("open");
    userDropdown.setAttribute("aria-hidden", "true");
    userButton.setAttribute("aria-expanded", "false");
  }
});

// -----------------------------
// Incident data
// -----------------------------
// Read the selected incident's basic values from the APTM dashboard URL.
const params = new URLSearchParams(window.location.search);
const title = params.get("title");
const meta = params.get("meta");
const incidentStatus = params.get("status");

if (title) document.getElementById("titleField").textContent = title;

if (meta) {
  const submittedIndex = meta.toLowerCase().indexOf("submitted");
  const afterSubmitted =
    submittedIndex === -1
      ? ""
      : meta.slice(submittedIndex + "submitted".length);

  const dateText = afterSubmitted.trimStart();
  const incidentDate =
    dateText && dateText.length < afterSubmitted.length ? dateText : meta;

  document.getElementById("incidentMeta").textContent = incidentDate;
}

if (incidentStatus) {
  const statusBadge = document.getElementById("statusBadge");

  statusBadge.textContent = incidentStatus;

  if (incidentStatus.toLowerCase() !== "resolved") {
    statusBadge.className = "status-badge active-status";
  }
}

// -----------------------------
// Visual-only actions
// -----------------------------
const showToast = (message) => {
  const toast = document.createElement("div");

  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 2600);
};

document
  .getElementById("logoutButton")
  .addEventListener("click", window.logoutUser);

// Apply the selected incident status until persistence is connected.
document
  .getElementById("confirmStatusButton")
  .addEventListener("click", () => {
    const statusSelect = document.getElementById("incidentStatusSelect");
    const status = statusSelect.value;

    if (!status) {
      statusSelect.focus();
      showToast("Select a status first.");
      return;
    }

    document.getElementById("selectedStatus").textContent = status;
    const statusConfirmBackdrop = document.getElementById(
      "statusConfirmBackdrop",
    );

    statusConfirmBackdrop.hidden = false;
    document.getElementById("statusConfirm").showModal();
  });

const closeStatusConfirm = () => {
  document.getElementById("statusConfirm").close();
  document.getElementById("statusConfirmBackdrop").hidden = true;
};

document.getElementById("statusConfirm").addEventListener("close", () => {
  document.getElementById("statusConfirmBackdrop").hidden = true;
});

document
  .getElementById("cancelStatusButton")
  .addEventListener("click", closeStatusConfirm);

document
  .getElementById("applyStatusButton")
  .addEventListener("click", () => {
    const status = document.getElementById("incidentStatusSelect").value;

    closeStatusConfirm();
    document.getElementById("statusBadge").textContent = status;
    showToast(`Incident status updated to ${status}.`);
  });

// Clicking outside the dialog keeps the user on the incident overview.
document
  .getElementById("statusConfirm")
  .addEventListener("click", (event) => {
    const dialog = document.getElementById("statusConfirm");
    const bounds = dialog.getBoundingClientRect();

    const clickedOutside =
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom;

    if (clickedOutside) {
      closeStatusConfirm();
    }
  });

// Add a note to the page for visual testing until persistence is connected.
document.getElementById("addNoteButton").addEventListener("click", () => {
  const noteInput = document.getElementById("noteInput");
  const noteText = noteInput.value.trim();

  if (!noteText) {
    noteInput.focus();
    return;
  }

  const note = document.createElement("div");
  // Notes added from this APTM user are styled as the user's chat bubbles.
  // Notes loaded from other users can use the "other" class later.
  note.className = "note-item own";
  note.innerHTML =
    "<strong>" +
    (window.currentUserDisplayName || "User") +
    " <small>just now</small></strong><p></p>";
  note.querySelector("p").textContent = noteText;

  document.getElementById("notesList").appendChild(note);
  document.querySelector(".notes-empty").style.display = "none";

  noteInput.value = "";

  // Keep the newest note visible at the bottom of the scroll window.
  const notesList = document.getElementById("notesList");
  notesList.scrollTo({
    top: notesList.scrollHeight,
    behavior: "smooth",
  });
});
