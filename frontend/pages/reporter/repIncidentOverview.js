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
const params = new URLSearchParams(window.location.search);
const incidentReference = params.get("reference");
const updateConfirmDialog = document.getElementById("updateConfirmDialog");
const cancelIncidentUpdate = document.getElementById("cancelIncidentUpdate");
const confirmIncidentUpdate = document.getElementById("confirmIncidentUpdate");
const cancelIncidentButton = document.getElementById("cancelIncidentButton");
const cancelIncidentDialog = document.getElementById("cancelIncidentDialog");
const keepIncident = document.getElementById("keepIncident");
const confirmIncidentCancellation = document.getElementById(
  "confirmIncidentCancellation",
);

const formatLocalDateTime = (dateValue) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Unknown date";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    hourCycle: "h12",
  }).format(date);
};

const formatStatusDate = (dateValue, fallback) =>
  dateValue ? formatLocalDateTime(dateValue) : fallback;

const formatAssignmentName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/(^|[\s'-])\w/g, (character) => character.toUpperCase());

let currentIncident = null;

const severityOptions = ["LOW", "MEDIUM", "HIGH", "SEVERE", "CRITICAL"];

const updateButtonVisibility = () => {
  document.getElementById("updateIncidentButton").hidden =
    !document.getElementById("severityEditor") &&
    !document.getElementById("descriptionEditor");
};

const setReporterReadOnly = (isReadOnly) => {
  document.querySelectorAll(".edit-button").forEach((button) => {
    button.disabled = isReadOnly;
  });
  document.getElementById("updateIncidentButton").disabled = isReadOnly;
  document.getElementById("addNoteButton").disabled = isReadOnly;
  document.getElementById("noteInput").disabled = isReadOnly;
};

const createSeverityEditor = () => {
  const severityField = document.getElementById("severityField");
  if (!severityField) return;

  const severitySelect = document.createElement("select");
  severitySelect.id = "severityEditor";
  severitySelect.className = "incident-editor";
  severityOptions.forEach((severity) => {
    const option = document.createElement("option");
    option.value = severity;
    option.textContent = severity;
    option.selected = severity === currentIncident.severity;
    severitySelect.appendChild(option);
  });
  severityField.replaceWith(severitySelect);
  const editButton = document.getElementById("editSeverityButton");
  editButton.classList.add("active");
  editButton.setAttribute("aria-pressed", "true");
  severitySelect.focus();
};

const restoreSeverityField = () => {
  const severityEditor = document.getElementById("severityEditor");
  if (!severityEditor) return;

  const severityField = document.createElement("div");
  severityField.id = "severityField";
  severityField.className = `readonly-field severity-value severity-${currentIncident.severity.toLowerCase()}`;
  severityField.textContent = currentIncident.severity;
  severityEditor.replaceWith(severityField);
  const editButton = document.getElementById("editSeverityButton");
  editButton.classList.remove("active");
  editButton.setAttribute("aria-pressed", "false");
};

const createDescriptionEditor = () => {
  const descriptionField = document.getElementById("descriptionField");
  if (!descriptionField) return;

  const descriptionEditor = document.createElement("textarea");
  descriptionEditor.id = "descriptionEditor";
  descriptionEditor.className = "incident-editor description-editor";
  descriptionEditor.maxLength = 500;
  descriptionEditor.value = currentIncident.description;
  descriptionField.replaceWith(descriptionEditor);
  const editButton = document.getElementById("editDescriptionButton");
  editButton.classList.add("active");
  editButton.setAttribute("aria-pressed", "true");
  descriptionEditor.focus();
};

const restoreDescriptionField = () => {
  const descriptionEditor = document.getElementById("descriptionEditor");
  if (!descriptionEditor) return;

  const descriptionField = document.createElement("div");
  descriptionField.id = "descriptionField";
  descriptionField.className = "readonly-field description-field";
  descriptionField.textContent = currentIncident.description;
  descriptionEditor.replaceWith(descriptionField);
  const editButton = document.getElementById("editDescriptionButton");
  editButton.classList.remove("active");
  editButton.setAttribute("aria-pressed", "false");
};

const resetIncidentEditors = () => {
  if (!currentIncident) return;
  restoreSeverityField();
  restoreDescriptionField();
  updateButtonVisibility();
};

const setIncidentStatus = (status) => {
  const statusBadge = document.getElementById("statusBadge");
  statusBadge.textContent = status.toUpperCase();
  let statusClass = "active-status";
  if (status === "ASSIGNED") {
    statusClass = "assigned-status";
  } else if (status === "IN_PROGRESS") {
    statusClass = "progress-status";
  } else if (status === "RESOLVED" || status === "CLOSED") {
    statusClass = "";
  }
  statusBadge.className = `status-badge ${statusClass}`;
};

const setIncidentLocation = (location) => {
  document.getElementById("overviewCoordinates").textContent = location;

  const coordinateMatch = location.match(
    /^([\d.]+)°\s*([NS]),\s*([\d.]+)°\s*([EW])$/i,
  );
  if (!coordinateMatch) return;

  const latitude =
    Number(coordinateMatch[1]) *
    (coordinateMatch[2].toUpperCase() === "S" ? -1 : 1);
  const longitude =
    Number(coordinateMatch[3]) *
    (coordinateMatch[4].toUpperCase() === "W" ? -1 : 1);
  const padding = 0.01;
  const mapFrame = document.getElementById("mapFrame");

  mapFrame.src =
    "https://www.openstreetmap.org/export/embed.html" +
    `?bbox=${longitude - padding},${latitude - padding},` +
    `${longitude + padding},${latitude + padding}` +
    `&layer=mapnik&marker=${latitude},${longitude}`;
};

const loadIncident = async () => {
  if (!incidentReference) throw new Error("Incident reference is missing.");

  resetIncidentEditors();

  const response = await fetch(
    `/api/incidents/reference/${encodeURIComponent(incidentReference)}`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error("Unable to load incident.");

  const incident = await response.json();
  currentIncident = incident;
  document.getElementById("titleField").textContent = incident.title;
  document.getElementById("incidentMeta").textContent = formatLocalDateTime(
    incident.created_at,
  );
  document.getElementById("assignedAt").textContent = formatStatusDate(
    incident.assigned_at,
    "NOT ASSIGNED",
  );
  document.getElementById("updatedAt").textContent = formatLocalDateTime(
    incident.updated_at,
  );
  document.getElementById("resolvedDate").textContent = incident.resolved_at
    ? formatLocalDateTime(incident.resolved_at)
    : "NOT RESOLVED";
  const status = incident.status.toUpperCase();
  document.getElementById("closedAt").textContent = formatStatusDate(
    status === "CLOSED" ? incident.closed_at : null,
    "NOT CLOSED",
  );
  document.getElementById("cancelledAt").textContent = formatStatusDate(
    incident.cancelled_at,
    "NOT CANCELLED",
  );
  const isCancelled = status === "CANCELLED";
  const isReadOnlyStatus = ["CANCELLED", "RESOLVED", "CLOSED"].includes(
    status,
  );
  document.getElementById("incidentMeta").closest("span").hidden = false;
  document.getElementById("assignedAt").closest("span").hidden = false;
  document.getElementById("updatedAt").closest("span").hidden = false;
  document.getElementById("resolvedDate").closest("span").hidden = false;
  document.getElementById("closedAtField").hidden = false;
  document.getElementById("cancelledAtField").hidden = !isCancelled;
  document.getElementById("severityField").textContent = incident.severity;
  document.getElementById("severityField").className =
    `readonly-field severity-value severity-${incident.severity.toLowerCase()}`;
  document.getElementById("descriptionField").textContent = incident.description;
  document.getElementById("assignedProviderName").textContent =
    incident.assigned_provider_name
      ? formatAssignmentName(incident.assigned_provider_name)
      : "NOT ASSIGNED";
  document.getElementById("assignedTeamName").textContent =
    incident.assigned_team_name
      ? formatAssignmentName(incident.assigned_team_name)
      : "NOT ASSIGNED";
  setIncidentLocation(incident.location);
  setIncidentStatus(incident.status);
  cancelIncidentButton.hidden = !["NEW", "ASSIGNED", "IN_PROGRESS"].includes(
    status,
  );
  setReporterReadOnly(isReadOnlyStatus);
  document.getElementById("updateIncidentButton").hidden = !isReadOnlyStatus;
  cancelIncidentButton.disabled = isReadOnlyStatus;
  document.getElementById("incidentOverviewContent").hidden = false;
};

const showIncidentLoadError = (error) => {
  console.error("Unable to load incident overview.", error);
  document.getElementById("incidentOverviewContent").hidden = false;
  document.getElementById("titleField").textContent =
    "Unable to load this incident.";
};

const setLoadingState = () => {
  resetIncidentEditors();
  document.getElementById("incidentMeta").textContent = "Loading...";
  document.getElementById("assignedAt").textContent = "Loading...";
  document.getElementById("updatedAt").textContent = "Loading...";
  document.getElementById("resolvedDate").textContent = "Loading...";
  document.getElementById("closedAt").textContent = "Loading...";
  document.getElementById("cancelledAt").textContent = "Loading...";
  document.getElementById("incidentMeta").closest("span").hidden = false;
  document.getElementById("assignedAt").closest("span").hidden = false;
  document.getElementById("updatedAt").closest("span").hidden = false;
  document.getElementById("resolvedDate").closest("span").hidden = false;
  document.getElementById("closedAtField").hidden = false;
  document.getElementById("cancelledAtField").hidden = true;
  document.getElementById("statusBadge").textContent = "Loading...";
  document.getElementById("statusBadge").className = "status-badge";
  setReporterReadOnly(false);
  cancelIncidentButton.hidden = true;
  document.getElementById("titleField").textContent = "Loading...";
  document.getElementById("severityField").textContent = "Loading...";
  document.getElementById("severityField").className = "readonly-field";
  document.getElementById("descriptionField").textContent = "Loading...";
  document.getElementById("assignedProviderName").textContent = "Loading...";
  document.getElementById("assignedTeamName").textContent = "Loading...";
  document.getElementById("overviewCoordinates").textContent = "Loading...";
};

const reloadIncidentOverview = () => {
  setLoadingState();
  loadIncident().catch(showIncidentLoadError);
};

window.addEventListener("pageshow", reloadIncidentOverview);
window.addEventListener("pagehide", () => {
  setLoadingState();
});

// -----------------------------
// Visual-only actions
// -----------------------------
function showToast(message) {
  const toast = document.createElement("div");

  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 2600);
}

document
  .getElementById("logoutButton")
  .addEventListener("click", window.logoutUser);

document.getElementById("editSeverityButton").addEventListener("click", () => {
  if (document.getElementById("severityEditor")) {
    restoreSeverityField();
  } else {
    createSeverityEditor();
  }
  updateButtonVisibility();
});

document.getElementById("editDescriptionButton").addEventListener("click", () => {
  if (document.getElementById("descriptionEditor")) {
    restoreDescriptionField();
  } else {
    createDescriptionEditor();
  }
  updateButtonVisibility();
});

const submitIncidentUpdate = async () => {
  const descriptionEditor = document.getElementById("descriptionEditor");
  const severityEditor = document.getElementById("severityEditor");
  const description = descriptionEditor?.value.trim();
  const severity = severityEditor?.value;
  confirmIncidentUpdate.disabled = true;
  try {
    const response = await fetch(
      `/api/incidents/reference/${encodeURIComponent(incidentReference)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(descriptionEditor ? { description } : {}),
          ...(severityEditor ? { severity } : {}),
        }),
      },
    );
    if (!response.ok) throw new Error("Unable to update incident.");
    closeUpdateConfirmation();
    showToast("Incident updated successfully.");
    reloadIncidentOverview();
  } catch (error) {
    console.error("Unable to update incident.", error);
    showToast("Unable to update this incident.");
  } finally {
    confirmIncidentUpdate.disabled = false;
  }
};

const closeUpdateConfirmation = () => {
  if (updateConfirmDialog.open) updateConfirmDialog.close();
  updateConfirmDialog.hidden = true;
};

document.getElementById("updateIncidentButton").addEventListener("click", () => {
  const descriptionEditor = document.getElementById("descriptionEditor");
  if (descriptionEditor && !descriptionEditor.value.trim()) {
    descriptionEditor.focus();
    return;
  }

  updateConfirmDialog.hidden = false;
  updateConfirmDialog.showModal();
  cancelIncidentUpdate.focus();
});

cancelIncidentUpdate.addEventListener("click", closeUpdateConfirmation);
confirmIncidentUpdate.addEventListener("click", submitIncidentUpdate);
updateConfirmDialog.addEventListener("click", (event) => {
  if (event.target === updateConfirmDialog) closeUpdateConfirmation();
});

const closeCancellationConfirmation = () => {
  if (cancelIncidentDialog.open) cancelIncidentDialog.close();
  cancelIncidentDialog.hidden = true;
};

cancelIncidentButton.addEventListener("click", () => {
  cancelIncidentDialog.hidden = false;
  cancelIncidentDialog.showModal();
  keepIncident.focus();
});

keepIncident.addEventListener("click", closeCancellationConfirmation);
cancelIncidentDialog.addEventListener("click", (event) => {
  if (event.target === cancelIncidentDialog) closeCancellationConfirmation();
});

confirmIncidentCancellation.addEventListener("click", async () => {
  confirmIncidentCancellation.disabled = true;
  try {
    const response = await fetch(
      `/api/incidents/reference/${encodeURIComponent(incidentReference)}/cancel`,
      { method: "PATCH" },
    );
    if (!response.ok) throw new Error("Unable to cancel incident.");
    closeCancellationConfirmation();
    showToast("Incident cancelled.");
    reloadIncidentOverview();
  } catch (error) {
    console.error("Unable to cancel incident.", error);
    showToast("Unable to cancel this incident.");
  } finally {
    confirmIncidentCancellation.disabled = false;
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
  // Notes added from this reporter are styled as the user's chat bubbles.
  // Notes loaded from other users can use the "other" class later.
  note.className = "note-item own";
  note.innerHTML = `<strong>${window.currentUserDisplayName || "User"} <small>just now</small></strong><p></p>`;

  note.querySelector("p").textContent = noteText;
  const notesList = document.getElementById("notesList");
  notesList.appendChild(note);
  document.querySelector(".notes-empty").style.display = "none";
  noteInput.value = "";

  // Keep the newest note visible at the bottom of the scroll window.
  notesList.scrollTo({
    top: notesList.scrollHeight,
    behavior: "smooth",
  });
});

const followUpButton = document.getElementById("followUpButton");
if (followUpButton) {
  followUpButton.addEventListener("click", () => {
    showToast("Follow-up action will be available soon.");
  });
}

connectIncidentRealtime({
  onEvent: (event) => {
    if (event.incident_reference === incidentReference) {
      reloadIncidentOverview();
    }
  },
  onReconnect: reloadIncidentOverview,
});
