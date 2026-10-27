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

const setIncidentStatus = (status) => {
  const statusBadge = document.getElementById("statusBadge");
  statusBadge.textContent = status.toUpperCase();
  statusBadge.className =
    status === "RESOLVED" || status === "CLOSED"
      ? "status-badge"
      : "status-badge active-status";
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

  const response = await fetch(
    `/api/incidents/reference/${encodeURIComponent(incidentReference)}`,
  );
  if (!response.ok) throw new Error("Unable to load incident.");

  const incident = await response.json();
  document.getElementById("titleField").textContent = incident.title;
  document.getElementById("incidentMeta").textContent = formatLocalDateTime(
    incident.created_at,
  );
  document.getElementById("resolvedDate").textContent = incident.resolved_at
    ? formatLocalDateTime(incident.resolved_at)
    : "Not resolved";
  document.getElementById("severityField").textContent = incident.severity;
  document.getElementById("severityField").className =
    `readonly-field severity-${incident.severity.toLowerCase()}`;
  document.getElementById("descriptionField").textContent = incident.description;
  setIncidentLocation(incident.location);
  setIncidentStatus(incident.status);
  document.getElementById("incidentOverviewContent").hidden = false;
};

const showIncidentLoadError = (error) => {
  console.error("Unable to load incident overview.", error);
  document.getElementById("incidentOverviewContent").hidden = false;
  document.getElementById("titleField").textContent =
    "Unable to load this incident.";
};

const setLoadingState = () => {
  document.getElementById("incidentMeta").textContent = "Loading...";
  document.getElementById("resolvedDate").textContent = "Loading...";
  document.getElementById("statusBadge").textContent = "Loading...";
  document.getElementById("statusBadge").className = "status-badge";
  document.getElementById("titleField").textContent = "Loading...";
  document.getElementById("severityField").textContent = "Loading...";
  document.getElementById("severityField").className = "readonly-field";
  document.getElementById("descriptionField").textContent = "Loading...";
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
