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
const params = new URLSearchParams(window.location.search);
const incidentReferencePattern = /^INC-\d{5}$/i;
const normalizeIncidentReference = (value) => {
  const candidate = String(value || "").trim().toUpperCase();
  return incidentReferencePattern.test(candidate) ? candidate : null;
};
const initialIncidentReference = normalizeIncidentReference(params.get("reference"));
const linkedIncidentTitle = params.get("title");
const linkedIncidentMeta = params.get("meta");
let incidentReference = initialIncidentReference;

function formatIncidentDate(dateValue) {
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
}

function formatIncidentStatus(status) {
  return {
    NEW: "NEW",
    ASSIGNED: "ASSIGNED",
    IN_PROGRESS: "IN PROGRESS",
    RESOLVED: "RESOLVED",
    CLOSED: "CLOSED",
    CANCELLED: "CANCELLED",
  }[String(status || "").toUpperCase()] || String(status || "").toUpperCase();
}

function getStatusColorClass(status) {
  return {
    NEW: "awaiting",
    ASSIGNED: "assigned",
    IN_PROGRESS: "progress",
    RESOLVED: "resolved",
    CLOSED: "closed",
    CANCELLED: "closed",
  }[String(status || "").toUpperCase()] || "awaiting";
}

function parseCoordinates(location) {
  const coordinatePattern =
    /^\s*(\d+(?:\.\d+)?)°\s*([NS])\s*,\s*(\d+(?:\.\d+)?)°\s*([EW])\s*$/i;
  const coordinateMatch = coordinatePattern.exec(String(location || ""));
  if (!coordinateMatch) return null;

  const latitude = Number(coordinateMatch[1]);
  const longitude = Number(coordinateMatch[3]);

  return {
    latitude: coordinateMatch[2].toUpperCase() === "S" ? -latitude : latitude,
    longitude:
      coordinateMatch[4].toUpperCase() === "W" ? -longitude : longitude,
  };
}

function renderIncident(incident) {
  document.getElementById("titleField").textContent = incident.title;
  document.getElementById("incidentMeta").textContent = formatIncidentDate(
    incident.created_at,
  );
  document.getElementById("assignedAt").textContent = incident.assigned_at
    ? formatIncidentDate(incident.assigned_at)
    : "NOT ASSIGNED";
  document.getElementById("updatedAt").textContent = formatIncidentDate(
    incident.updated_at,
  );
  document.getElementById("resolvedDate").textContent = incident.resolved_at
    ? formatIncidentDate(incident.resolved_at)
    : "NOT RESOLVED";
  document.getElementById("closedAt").textContent = incident.closed_at
    ? formatIncidentDate(incident.closed_at)
    : "NOT CLOSED";

  const severityField = document.getElementById("severityField");
  severityField.textContent = incident.severity;
  severityField.className =
    `readonly-field severity-value severity-${incident.severity.toLowerCase()}`;
  document.getElementById("descriptionField").textContent = incident.description;

  const statusBadge = document.getElementById("statusBadge");
  const formattedStatus = formatIncidentStatus(incident.status);
  const statusColorClass = getStatusColorClass(incident.status);
  statusBadge.textContent = formattedStatus;
  statusBadge.className = `status-badge ${statusColorClass}`;

  const coordinates = parseCoordinates(incident.location);
  document.getElementById("overviewCoordinates").textContent =
    incident.location;

  if (coordinates) {
    const { latitude, longitude } = coordinates;
    const mapFrame = document.getElementById("mapFrame");
    const bounds = `${longitude - 0.01},${latitude - 0.01},${longitude + 0.01},${latitude + 0.01}`;
    mapFrame.src =
      `https://www.openstreetmap.org/export/embed.html?bbox=${bounds}` +
      `&layer=mapnik&marker=${latitude},${longitude}`;
  }
}

async function loadIncident() {
  if (!incidentReference && linkedIncidentMeta) {
    const referenceMatch = /INC-\d{5}/i.exec(linkedIncidentMeta);
    incidentReference = normalizeIncidentReference(referenceMatch?.[0]);
  }

  if (!incidentReference && linkedIncidentTitle) {
    const assignedIncidentsResponse = await fetch(
      "/api/incidents/assigned-to-me",
      { cache: "no-store" },
    );
    if (assignedIncidentsResponse.ok) {
      const assignedIncidents = await assignedIncidentsResponse.json();
      const matchingIncident = assignedIncidents.find(
        (incident) => incident.title === linkedIncidentTitle,
      );
      incidentReference = normalizeIncidentReference(
        matchingIncident?.incident_reference,
      );
    }
  }

  if (!incidentReference) {
    throw new Error("Incident reference is missing from this dashboard link.");
  }

  const response = await fetch(
    `/api/incidents/assigned-to-me/${encodeURIComponent(incidentReference)}`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error("Unable to load this assigned incident.");
  }

  renderIncident(await response.json());
}

try {
  await loadIncident();
} catch (error) {
  console.error(error);
  document.getElementById("titleField").textContent =
    "Unable to load this incident.";
  document.getElementById("incidentMeta").textContent = error.message;
  document.getElementById("descriptionField").textContent = "No incident data available.";
  document.getElementById("severityField").textContent = "Unavailable";
  document.getElementById("overviewCoordinates").textContent = "Unavailable";
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
  .addEventListener("click", async () => {
    const status = document.getElementById("incidentStatusSelect").value;

    try {
      const response = await fetch(
        `/api/incidents/assigned-to-me/${encodeURIComponent(incidentReference)}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.detail || "Unable to update incident status.");
      }

      closeStatusConfirm();
      const formattedStatus = formatIncidentStatus(status);
      const statusColorClass = getStatusColorClass(status);
      document.getElementById("statusBadge").textContent = formattedStatus;
      document.getElementById("statusBadge").className =
        `status-badge ${statusColorClass}`;
      document.getElementById("statusSuccessMessage").textContent =
        `The incident is now ${formatIncidentStatus(status)}.`;
      const statusSuccessBackdrop = document.getElementById(
        "statusSuccessBackdrop",
      );
      statusSuccessBackdrop.hidden = false;
      statusSuccessBackdrop.showModal();
      document.getElementById("closeStatusSuccess").focus();
    } catch (error) {
      console.error("Unable to update incident status.", error);
      closeStatusConfirm();
      showToast(error.message);
    }
  });

const closeStatusSuccess = () => {
  const statusSuccessBackdrop = document.getElementById("statusSuccessBackdrop");
  if (statusSuccessBackdrop.open) statusSuccessBackdrop.close();
  statusSuccessBackdrop.hidden = true;
};

document
  .getElementById("closeStatusSuccess")
  .addEventListener("click", closeStatusSuccess);

document
  .getElementById("statusSuccessBackdrop")
  .addEventListener("click", (event) => {
    if (event.target.id === "statusSuccessBackdrop") {
      closeStatusSuccess();
    }
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

  const noteHeader = document.createElement("strong");
  noteHeader.append(
    document.createTextNode(window.currentUserDisplayName || "User"),
    document.createTextNode(" ")
  );

  const noteTimestamp = document.createElement("small");
  noteTimestamp.textContent = "just now";
  noteHeader.appendChild(noteTimestamp);

  const noteContent = document.createElement("p");
  noteContent.textContent = noteText;

  note.append(noteHeader, noteContent);

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

connectIncidentRealtime({
  onEvent: (event) => {
    if (event.incident_reference === incidentReference) {
      loadIncident().catch((error) => console.error(error));
    }
  },
  onReconnect: () => {
    if (incidentReference) loadIncident().catch((error) => console.error(error));
  },
});
