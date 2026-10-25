const { incidents, providers } = window.assignerDemoData;

const params = new URLSearchParams(window.location.search);
const incidentId = params.get("id");

const providerSelect = document.getElementById("providerSelect");
const assignButton = document.getElementById("assignButton");
const confirmBackdrop = document.getElementById("confirmBackdrop");
const providerSelectError = document.getElementById("providerSelectError");

function setProviderError(message) {
  providerSelect.classList.toggle("input-error", Boolean(message));
  providerSelectError.textContent = message || "";
}

// Match the admin overview: nearby incidents live below the left-side fields.
const nearbyCard = document.querySelector(".nearby-card");
const formFields = document.querySelector(".form-fields");
if (nearbyCard && formFields) {
  formFields.appendChild(nearbyCard);
}

let incident = null;
let pendingProvider = null;
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

function displayIncident() {
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
  updateAvailableProviders();
  updateCurrentProvider();
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

let availableResponders = [];

function updateAvailableProviders() {
  const latitude = Number(incident.latitude);
  const longitude = Number(incident.longitude);
  const hasCoordinates =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;

  providerSelect.replaceChildren(new Option("Select a responder", ""));
  setProviderError("");

  if (!hasCoordinates) {
    availableResponders = [];
    return;
  }

  availableResponders = providers
    .filter((provider) => provider.available)
    .map((provider) => ({
      ...provider,
      distance: distanceInMiles(
        latitude,
        longitude,
        provider.latitude,
        provider.longitude,
      ),
    }))
    .sort((a, b) => a.distance - b.distance);

  if (!availableResponders.length) {
    return;
  }

  availableResponders.forEach((provider) => {
    providerSelect.add(
      new Option(`${provider.name} — ${provider.county} County`, provider.id),
    );
  });
}

function updateCurrentProvider() {
  const provider = incident.assignedProvider || "";
  const assignedCounty = incident.assignedCounty || "";
  let currentProviderText = "Not assigned";
  let assignmentSummaryText = "No provider has been assigned yet.";

  if (provider) {
    currentProviderText = provider;
    assignmentSummaryText = `Currently assigned to ${provider}`;

    if (assignedCounty) {
      currentProviderText += ` · ${assignedCounty} County`;
      assignmentSummaryText += ` in ${assignedCounty} County`;
    }

    assignmentSummaryText +=
      ". You can select another available responder to reassign this incident.";
  }

  document.getElementById("currentProvider").textContent = currentProviderText;
  const assignmentSummary = document.getElementById("assignmentSummary");
  if (assignmentSummary) assignmentSummary.textContent = assignmentSummaryText;

  const assignedResponder = availableResponders.find(
    (responder) => responder.name === provider,
  );
  providerSelect.value = assignedResponder?.id || "";

  const isPast = ["resolved", "closed"].includes(incident.status);

  providerSelect.disabled = isPast || !availableResponders.length;
  assignButton.disabled = isPast || !availableResponders.length;

  if (isPast) {
    assignButton.textContent = "Incident is closed";
  } else if (!availableResponders.length) {
    assignButton.textContent = "No responders available";
  } else {
    assignButton.innerHTML = "Assign responder <span>→</span>";
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
      <span class="nearby-icon">↗</span>
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

providerSelect.addEventListener("change", () => setProviderError(""));

// -------------------------------------
// Provider assignment and confirmation
// -------------------------------------

assignButton.addEventListener("click", () => {
  if (!incident || ["resolved", "closed"].includes(incident.status)) {
    return;
  }

  const selectedProvider = availableResponders.find(
    (provider) => provider.id === providerSelect.value,
  );

  if (!selectedProvider) {
    setProviderError("Please select a responder.");
    providerSelect.focus();
    return;
  }

  pendingProvider = selectedProvider;

  const isReassignment =
    Boolean(incident.assignedProvider) &&
    incident.assignedProvider !== selectedProvider.name;

  document.getElementById("confirmMessage").textContent = isReassignment
    ? `Reassign ${incident.id} from ${incident.assignedProvider} to ${selectedProvider.name} in ${selectedProvider.county} County?`
    : `Assign ${incident.id} to ${selectedProvider.name} in ${selectedProvider.county} County?`;

  confirmBackdrop.hidden = false;
  document.getElementById("confirmAssign").focus();
});

function closeConfirmation() {
  confirmBackdrop.hidden = true;
  pendingProvider = null;
}

document.getElementById("cancelAssign").addEventListener("click", () => {
  closeConfirmation();
});

document.getElementById("confirmAssign").addEventListener("click", () => {
  if (!incident || !pendingProvider) return;

  if (["resolved", "closed"].includes(incident.status)) {
    closeConfirmation();
    displayIncident();
    return;
  }

  const confirmedProvider = pendingProvider;
  incident.assignedProvider = confirmedProvider.name;
  incident.assignedCounty = confirmedProvider.county;
  incident.status = "active";

  // Update the assignment date for the demonstration.
  incident.assignedDate = new Date().toISOString();

  closeConfirmation();
  displayIncident();
});

// Close the dialog when the user clicks its backdrop.
confirmBackdrop.addEventListener("click", (event) => {
  if (event.target === confirmBackdrop) {
    closeConfirmation();
  }
});

// Escape also closes the confirmation dialog.
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !confirmBackdrop.hidden) {
    closeConfirmation();
  }
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
  displayIncident();
}
