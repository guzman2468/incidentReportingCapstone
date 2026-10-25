const { incidents } = window.assignerDemoData;

const params = new URLSearchParams(window.location.search);
const incidentId = params.get("id");

const providerSelect = document.getElementById("providerSelect");
const teamSelect = document.getElementById("teamSelect");
const assignButton = document.getElementById("assignButton");
const providerSelectError = document.getElementById("providerSelectError");
const teamSelectError = document.getElementById("teamSelectError");
const assignmentMessage = document.getElementById("assignmentMessage");

function formatDisplayName(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/(^|[\s'-])\w/g, (letter) => letter.toUpperCase());
}

function setProviderError(message) {
  providerSelect.classList.toggle("input-error", Boolean(message));
  providerSelectError.textContent = message || "";
}

function setTeamError(message) {
  teamSelect.classList.toggle("input-error", Boolean(message));
  teamSelectError.textContent = message || "";
}

// Match the admin overview: nearby incidents live below the left-side fields.
const nearbyCard = document.querySelector(".nearby-card");
const formFields = document.querySelector(".form-fields");
if (nearbyCard && formFields) {
  formFields.appendChild(nearbyCard);
}

let incident = null;
let incidentMap = null;
let mapMarkers = null;

function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
}

// -------------------------------------
// Load and display the selected incident
// -------------------------------------

async function displayIncident() {
  incident = incidents.find((item) => item.id === incidentId);

  if (!incident) {
    document.querySelector(".overview-wrap").innerHTML = `
      <div class="incident-card">
        <h1>Incident not found</h1>
        <p class="hero-copy">
          This incident isn't included in the sample data.
        </p>
        <a class="secondary-button" href="assignDashboard.html">
          Back to dashboard
        </a>
      </div>
    `;
    return;
  }

  document.getElementById("incidentNumber").textContent = incident.id;
  document.getElementById("incidentTitle").textContent = incident.title;

  const assignedDate = incident.assignedDate
    ? new Date(incident.assignedDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";
  const dateLabel = assignedDate
    ? `Assigned ${assignedDate}`
    : `Submitted ${incident.submitted || "date unavailable"}`;

  document.getElementById("submittedDate").textContent =
    `${incident.id} · ${dateLabel}`;
  document.getElementById("resolvedDate").textContent =
    incident.resolvedDate || "Not resolved";

  document.getElementById("incidentDescription").textContent =
    incident.description || "No description provided.";

  document.getElementById("incidentType").textContent =
    `Incident type: ${incident.type}`;

  document.getElementById("incidentCounty").textContent =
    `${incident.county} County`;

  const severity = incident.severity || "UNKNOWN";

  document.getElementById("severityValue").textContent = severity;
  document.getElementById("severityValue").className =
    `severity-value severity-${String(severity).toLowerCase()}`;

  updateStatusBadge();
  await loadAidProviders();
  updateAvailableProviders();
  await updateCurrentProvider();
  updateNearbyIncidents();
}

function updateStatusBadge() {
  const badge = document.getElementById("statusBadge");

  const labels = {
    new: "New",
    active: "In progress",
    resolved: "Resolved",
    closed: "Closed",
  };

  badge.textContent = labels[incident.status] || incident.status || "New";
  badge.className = "status-badge";

  if (["resolved", "closed"].includes(incident.status)) {
    badge.classList.add(incident.status);
  } else if (incident.status === "active") {
    badge.classList.add("active");
  }
}

let providers = [];
let availableTeams = [];
let providersLoaded = false;

async function loadAidProviders() {
  if (providersLoaded) return;

  providerSelect.replaceChildren(new Option("Loading aid providers...", ""));
  providerSelect.disabled = true;

  try {
    const response = await fetch("/api/aidProviders");
    if (!response.ok) throw new Error("Unable to load aid providers.");

    providers = await response.json();
    providersLoaded = true;
    updateAvailableProviders();
  } catch (error) {
    console.error(error);
    providerSelect.replaceChildren(
      new Option("Unable to load aid providers", ""),
    );
    setProviderError("Unable to load aid providers.");
  }
}

async function loadAidProviderTeams(providerId) {
  teamSelect.replaceChildren(new Option("Loading teams...", ""));
  teamSelect.disabled = true;
  availableTeams = [];

  if (!providerId) {
    teamSelect.replaceChildren(new Option("Select a team", ""));
    return;
  }

  if (!/^[0-9a-f-]{36}$/i.test(providerId)) {
    teamSelect.replaceChildren(new Option("Invalid aid provider", ""));
    setTeamError("The selected aid provider is invalid.");
    return;
  }

  try {
    const encodedProviderId = encodeURIComponent(providerId);
    const response = await fetch(
      `/api/aidProviders/${encodedProviderId}/teams`,
    );
    if (!response.ok) throw new Error("Unable to load aid provider teams.");

    availableTeams = await response.json();
    teamSelect.replaceChildren(new Option("Select a team", ""));
    availableTeams.forEach((team) => {
      teamSelect.add(new Option(formatDisplayName(team.name), team.id));
    });
    teamSelect.disabled = availableTeams.length === 0;

    if (!availableTeams.length) {
      teamSelect.replaceChildren(new Option("No teams found", ""));
    }
  } catch (error) {
    console.error(error);
    teamSelect.replaceChildren(new Option("Unable to load teams", ""));
    setTeamError("Unable to load aid provider teams.");
  }
}

function updateAvailableProviders() {
  providerSelect.replaceChildren(new Option("Select an aid provider", ""));
  providers.forEach((provider) => {
    providerSelect.add(new Option(formatDisplayName(provider.name), provider.id));
  });
  providerSelect.disabled = !providers.length;
  setProviderError("");
}

async function updateCurrentProvider() {
  const provider = incident.assignedProvider || "";
  const assignedTeam = incident.assignedTeam || "";
  let currentProviderText = "Not assigned";
  let assignmentSummaryText = "No provider has been assigned yet.";

  if (provider) {
    currentProviderText = provider;
    assignmentSummaryText = `Currently assigned to ${provider}`;
    assignmentSummaryText += assignedTeam ? ` · ${assignedTeam}` : "";
    assignmentSummaryText += ". You can select another team to reassign this incident.";
  }

  document.getElementById("currentProvider").textContent = currentProviderText;
  const assignmentSummary = document.getElementById("assignmentSummary");
  if (assignmentSummary) assignmentSummary.textContent = assignmentSummaryText;

  const assignedProvider = providers.find(
    (availableProvider) =>
      availableProvider.name.toLowerCase() === provider.toLowerCase(),
  );
  providerSelect.value = assignedProvider?.id || "";
  await loadAidProviderTeams(providerSelect.value);
  const assignedTeamOption = availableTeams.find(
    (team) => team.name.toLowerCase() === assignedTeam.toLowerCase(),
  );
  teamSelect.value = assignedTeamOption?.id || "";

  const isPast = ["resolved", "closed"].includes(incident.status);
  const hasCompleteAssignment = providerSelect.value && teamSelect.value;

  providerSelect.disabled = isPast || !providers.length;
  teamSelect.disabled = isPast || !availableTeams.length;
  assignButton.disabled = isPast || !hasCompleteAssignment;

  if (isPast) {
    assignButton.textContent = "Incident is closed";
  } else {
    assignButton.textContent = "Assign to team";
  }
}

// -------------------------------------
// Map
// -------------------------------------

function updateMap(nearby = []) {
  const mapElement = document.getElementById("incidentMap");
  const latitude = Number(incident.latitude);
  const longitude = Number(incident.longitude);

  const hasCoordinates =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;

  if (!hasCoordinates) {
    document.getElementById("incidentCoordinates").textContent =
      "Location unavailable";

    mapElement.textContent =
      "Map unavailable because this incident has no valid coordinates.";
    return;
  }

  const latitudeDirection = latitude >= 0 ? "N" : "S";
  const longitudeDirection = longitude >= 0 ? "E" : "W";

  document.getElementById("incidentCoordinates").textContent =
    `${Math.abs(latitude).toFixed(6)}° ${latitudeDirection}, ` +
    `${Math.abs(longitude).toFixed(6)}° ${longitudeDirection}`;

  if (typeof L === "undefined") {
    mapElement.textContent =
      "The interactive map could not load. Check your internet connection and reload the page.";
    return;
  }

  if (!incidentMap) {
    incidentMap = L.map(mapElement).setView([latitude, longitude], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(incidentMap);
    mapMarkers = L.layerGroup().addTo(incidentMap);
  }

  mapMarkers.clearLayers();

  const radiusMiles = Number(document.getElementById("radiusSelect").value);
  const radiusCircle = L.circle([latitude, longitude], {
    radius: radiusMiles * 1609.344,
    color: "#087f83",
    weight: 1,
    fillColor: "#087f83",
    fillOpacity: 0.08,
  }).addTo(mapMarkers);

  L.circleMarker([latitude, longitude], {
    radius: 8,
    color: "#ffffff",
    weight: 2,
    fillColor: "#087f83",
    fillOpacity: 1,
  })
    .bindPopup(
      `<strong>${escapeHTML(incident.id)} · ${escapeHTML(incident.title)}</strong><br>` +
        `${escapeHTML(incident.county)} County · Selected incident`,
    )
    .addTo(mapMarkers);

  nearby.forEach((other) => {
    L.circleMarker([Number(other.latitude), Number(other.longitude)], {
      radius: 6,
      color: "#ffffff",
      weight: 2,
      fillColor: "#ee806d",
      fillOpacity: 1,
    })
      .bindPopup(
        `<strong>${escapeHTML(other.id)} · ${escapeHTML(other.title)}</strong><br>` +
          `${escapeHTML(other.county)} County`,
      )
      .addTo(mapMarkers);
  });

  incidentMap.fitBounds(radiusCircle.getBounds(), {
    padding: [16, 16],
    maxZoom: 14,
  });
  window.setTimeout(() => incidentMap.invalidateSize(), 0);
}

// -------------------------------------
// Nearby incidents
// -------------------------------------

// Calculate the straight-line distance between two coordinates in miles.
function distanceInMiles(lat1, lon1, lat2, lon2) {
  const earthRadius = 3958.8;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const safeA = Math.min(1, Math.max(0, a));

  return earthRadius * 2 * Math.atan2(Math.sqrt(safeA), Math.sqrt(1 - safeA));
}

function findNearbyIncidents(radius) {
  const latitude = Number(incident.latitude);
  const longitude = Number(incident.longitude);

  const hasCoordinates =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;

  if (!hasCoordinates) {
    return null;
  }

  return incidents
    .filter((other) => other.id !== incident.id)
    .map((other) => {
      const otherLat = Number(other.latitude);
      const otherLon = Number(other.longitude);

      if (
        !Number.isFinite(otherLat) ||
        !Number.isFinite(otherLon) ||
        Math.abs(otherLat) > 90 ||
        Math.abs(otherLon) > 180
      ) {
        return null;
      }

      return {
        ...other,
        distance: distanceInMiles(latitude, longitude, otherLat, otherLon),
      };
    })
    .filter((other) => other && other.distance <= radius)
    .sort((a, b) => a.distance - b.distance);
}

function updateNearbyIncidents() {
  const list = document.getElementById("nearbyList");
  const empty = document.getElementById("nearbyEmpty");
  const radius = Number(document.getElementById("radiusSelect").value);
  const nearby = findNearbyIncidents(radius);

  if (nearby === null) {
    list.innerHTML = "";
    empty.textContent =
      "Nearby incidents cannot be calculated because this incident has no valid coordinates.";
    empty.style.display = "block";
    updateMap();
    return;
  }

  list.innerHTML = nearby
    .map(
      (other) => `
    <div class="nearby-row">
      <span class="nearby-info">
        <strong>${escapeHTML(other.title)}</strong>
        <small>
          ${escapeHTML(other.id)} · ${escapeHTML(other.county)} County
        </small>
        <small>
          ${escapeHTML(other.type)} · ${escapeHTML(other.severity)} · ${escapeHTML(other.status)}
        </small>
      </span>
    </div>
  `,
    )
    .join("");

  empty.style.display = nearby.length ? "none" : "block";
  updateMap(nearby);
}

document
  .getElementById("radiusSelect")
  .addEventListener("change", updateNearbyIncidents);

providerSelect.addEventListener("change", async () => {
  setProviderError("");
  setTeamError("");
  teamSelect.value = "";
  await loadAidProviderTeams(providerSelect.value);
  const isPast = ["resolved", "closed"].includes(incident?.status);
  teamSelect.disabled = isPast || !availableTeams.length;
  assignButton.disabled =
    isPast || !providerSelect.value || !teamSelect.value;
});

teamSelect.addEventListener("change", () => {
  setTeamError("");
  const isPast = ["resolved", "closed"].includes(incident?.status);
  assignButton.disabled =
    isPast || !providerSelect.value || !teamSelect.value;
});

// -------------------------------------
// Provider assignment
// -------------------------------------

assignButton.addEventListener("click", () => {
  if (!incident || ["resolved", "closed"].includes(incident.status)) {
    return;
  }

  const selectedProvider = providers.find(
    (provider) => provider.id === providerSelect.value,
  );
  const selectedTeam = availableTeams.find(
    (team) => team.id === teamSelect.value,
  );

  if (!selectedProvider) {
    setProviderError("Please select an aid provider.");
    providerSelect.focus();
    return;
  }

  if (!selectedTeam) {
    setTeamError("Please select a team.");
    teamSelect.focus();
    return;
  }

  assignmentMessage.textContent = `Assign to team clicked for ${formatDisplayName(selectedProvider.name)} — ${formatDisplayName(selectedTeam.name)}.`;
  assignmentMessage.hidden = false;
});

// -------------------------------------
// Profile dropdown
// -------------------------------------

const userButton = document.getElementById("userButton");
const userDropdown = document.getElementById("userDropdown");

userButton.addEventListener("click", () => {
  const isOpen = userDropdown.classList.toggle("open");

  userButton.setAttribute("aria-expanded", String(isOpen));
  userDropdown.setAttribute("aria-hidden", String(!isOpen));
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".user-menu")) {
    userDropdown.classList.remove("open");
    userButton.setAttribute("aria-expanded", "false");
    userDropdown.setAttribute("aria-hidden", "true");
  }
});

document
  .getElementById("logoutButton")
  .addEventListener("click", window.logoutUser);

// Add notes to the incident timeline for the current page session.
document.getElementById("addNoteButton").addEventListener("click", () => {
  const noteInput = document.getElementById("noteInput");
  const noteText = noteInput.value.trim();

  if (!noteText) {
    noteInput.focus();
    return;
  }

  const note = document.createElement("div");
  note.className = "note-item own";

  const author = document.createElement("strong");
  author.textContent = window.currentUserDisplayName || "You";

  const timestamp = document.createElement("small");
  timestamp.textContent = "just now";
  author.append(" ", timestamp);

  const message = document.createElement("p");
  message.textContent = noteText;

  note.append(author, message);
  const notesList = document.getElementById("notesList");
  notesList.appendChild(note);
  noteInput.value = "";
  notesList.scrollTo({ top: notesList.scrollHeight, behavior: "smooth" });
});

// Initialize the page.
if (!incidentId) {
  document.querySelector(".overview-wrap").innerHTML = `
    <div class="incident-card">
      <h1>No incident selected</h1>
      <p class="hero-copy">Choose an incident from the dashboard to view its details.</p>
      <a class="secondary-button" href="assignDashboard.html">
        Back to dashboard
      </a>
    </div>
  `;
} else {
  try {
    await displayIncident();
  } catch (error) {
    console.error(error);
  }
}
