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
// Read the selected incident reference from the admin dashboard URL.
const params = new URLSearchParams(window.location.search);
const incidentId = params.get("id")?.toUpperCase();
let selectedIncident = null;
let adminIncidents = [];
let selectedCoordinates = null;

// The admin overview is read-only for assignment; keep the field out of this view.
document.querySelector(".assignment-field")?.remove();

// Keep nearby incidents in the open space beneath the incident fields.
const nearbyCard = document.querySelector(".nearby-card");
const formFields = document.querySelector(".form-fields");
if (nearbyCard && formFields) {
  formFields.appendChild(nearbyCard);
  nearbyCard.querySelector(".section-heading p")?.remove();
}

let incidentMap = null;
let mapMarkers = null;
const nearbyMarkers = new Map();

const escapeHTML = (value) =>
  String(value ?? "").replace(
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

const distanceInMiles = (lat1, lon1, lat2, lon2) => {
  const earthRadius = 3958.8;
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  const safeA = Math.min(1, Math.max(0, a));
  return earthRadius * 2 * Math.atan2(Math.sqrt(safeA), Math.sqrt(1 - safeA));
};

const parseCoordinates = (location) => {
  const match = /^\s*(\d+(?:\.\d+)?)°\s*([NS])\s*,\s*(\d+(?:\.\d+)?)°\s*([EW])\s*$/i.exec(location || "");
  if (!match) return null;
  const latitude = Number(match[1]) * (match[2].toUpperCase() === "S" ? -1 : 1);
  const longitude = Number(match[3]) * (match[4].toUpperCase() === "W" ? -1 : 1);
  return { latitude, longitude };
};

const findNearbyIncidents = (radius) =>
  (selectedCoordinates
    ? adminIncidents
    .filter((item) => item.incident_reference !== selectedIncident?.incident_reference)
    .map((item) => ({ ...item, coordinates: parseCoordinates(item.location) }))
    .filter((item) => item.coordinates)
    .map((item) => ({
      ...item,
      distance: distanceInMiles(
        selectedCoordinates.latitude,
        selectedCoordinates.longitude,
        item.coordinates.latitude,
        item.coordinates.longitude,
      ),
    }))
    .filter((item) => item.distance <= radius)
    .sort((a, b) => a.distance - b.distance)
    : []);

const updateMap = (nearby) => {
  const mapElement = document.getElementById("incidentMap");
  if (!mapElement || typeof L === "undefined") {
    if (mapElement)
      mapElement.textContent =
        "The interactive map could not load. Check your internet connection and reload the page.";
    return;
  }

  if (!selectedCoordinates) {
    mapElement.textContent = "Coordinates are not available for this incident.";
    return;
  }

  const { latitude, longitude } = selectedCoordinates;
  document.getElementById("overviewCoordinates").textContent =
    `${Math.abs(latitude).toFixed(6)}° ${latitude >= 0 ? "N" : "S"}, ` +
    `${Math.abs(longitude).toFixed(6)}° ${longitude >= 0 ? "E" : "W"}`;

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
  nearbyMarkers.clear();
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
    color: "#fff",
    weight: 2,
    fillColor: "#087f83",
    fillOpacity: 1,
  })
    .bindPopup(
      `<strong>${escapeHTML(selectedIncident.incident_reference)} · ${escapeHTML(selectedIncident.title)}</strong><br>SELECTED INCIDENT`,
    )
    .addTo(mapMarkers);

  nearby.forEach((item) => {
    const nearbyMarker = L.circleMarker(
      [item.coordinates.latitude, item.coordinates.longitude],
      {
      radius: 6,
      color: "#fff",
      weight: 2,
      fillColor: "#ee806d",
      fillOpacity: 1,
      },
    )
      .bindPopup(
        `<strong>${escapeHTML(item.incident_reference)} · ${escapeHTML(item.title)}</strong><br>${item.distance.toFixed(1)} MILES AWAY`,
      )
      .addTo(mapMarkers);

    nearbyMarkers.set(item.incident_reference, nearbyMarker);
  });

  incidentMap.fitBounds(radiusCircle.getBounds(), {
    padding: [16, 16],
    maxZoom: 14,
  });
  window.setTimeout(() => incidentMap.invalidateSize(), 0);
};

const focusNearbyIncident = (incidentReference) => {
  const marker = nearbyMarkers.get(incidentReference);
  if (!marker || !incidentMap) return;

  incidentMap.setView(marker.getLatLng(), Math.max(incidentMap.getZoom(), 13));
  marker.openPopup();
};

const updateNearbyIncidents = () => {
  const radius = Number(document.getElementById("radiusSelect").value);
  const nearby = findNearbyIncidents(radius);
  const list = document.getElementById("nearbyList");
  const empty = document.getElementById("nearbyEmpty");

  list.innerHTML = nearby
    .map(
      (item) => `<button type="button" class="nearby-row" data-nearby-incident="${escapeHTML(item.incident_reference)}">
    <span class="nearby-info">
      <strong>${escapeHTML(item.title)}</strong>
      <small>${escapeHTML(item.incident_reference)} · ${item.distance.toFixed(1)} MILES AWAY</small>
      <small>${escapeHTML(item.severity)} · ${escapeHTML(String(item.status || "").toUpperCase())}</small>
    </span></button>`,
    )
    .join("");
  empty.style.display = nearby.length ? "none" : "block";
  updateMap(nearby);
};

document.getElementById("radiusSelect").addEventListener("change", updateNearbyIncidents);

document.getElementById("nearbyList").addEventListener("click", (event) => {
  const nearbyRow = event.target.closest("[data-nearby-incident]");
  if (!nearbyRow) return;

  focusNearbyIncident(nearbyRow.dataset.nearbyIncident);
});

const renderIncident = () => {
  if (!selectedIncident) return;
  const status = String(selectedIncident.status || "").toUpperCase();
  const formatDateTime = (dateValue, fallback) => {
    if (!dateValue) return fallback;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return fallback;
    const dateText = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
    const hours = date.getHours();
    const hour12 = hours % 12 || 12;
    const meridiem = hours >= 12 ? "PM" : "AM";
    const timeText = [hour12, date.getMinutes(), date.getSeconds()]
      .map((part) => String(part).padStart(2, "0"))
      .join(":");
    return `${dateText} ${timeText} ${meridiem}`;
  };

  document.getElementById("titleField").textContent = selectedIncident.title;
  document.getElementById("descriptionField").textContent = selectedIncident.description;
  const severityField = document.getElementById("severityField");
  severityField.textContent = selectedIncident.severity;
  severityField.className = `readonly-field severity-value severity-${String(selectedIncident.severity).toLowerCase()}`;
  document.getElementById("incidentMeta").textContent = formatDateTime(selectedIncident.created_at, "UNKNOWN DATE");
  document.getElementById("assignedAt").textContent = formatDateTime(selectedIncident.assigned_at, "NOT ASSIGNED");
  document.getElementById("updatedAt").textContent = formatDateTime(selectedIncident.updated_at, "UNKNOWN DATE");
  document.getElementById("resolvedDate").textContent = formatDateTime(selectedIncident.resolved_at, "NOT RESOLVED");
  document.getElementById("closedAt").textContent = formatDateTime(
    status === "CLOSED" ? selectedIncident.closed_at : null,
    "NOT CLOSED",
  );
  document.getElementById("cancelledAt").textContent = formatDateTime(
    selectedIncident.cancelled_at,
    "NOT CANCELLED",
  );
  const isCancelled = status === "CANCELLED";
  document.getElementById("incidentMeta").closest("span").hidden = isCancelled;
  document.getElementById("assignedAt").closest("span").hidden = isCancelled;
  document.getElementById("updatedAt").closest("span").hidden = isCancelled;
  document.getElementById("resolvedDate").closest("span").hidden = isCancelled;
  document.getElementById("closedAtField").hidden = isCancelled;
  document.getElementById("cancelledAtField").hidden = !isCancelled;
  const statusBadge = document.getElementById("statusBadge");
  statusBadge.textContent = status.replaceAll("_", " ");
  let statusClass = "active-status";
  if (status === "RESOLVED") {
    statusClass = "resolved";
  } else if (status === "CLOSED") {
    statusClass = "closed";
  } else if (status === "IN_PROGRESS") {
    statusClass = "progress";
  }
  statusBadge.className = `status-badge ${statusClass}`;
  selectedCoordinates = parseCoordinates(selectedIncident.location);
  document.getElementById("overviewCoordinates").textContent = selectedIncident.location;
  updateNearbyIncidents();
};

const loadAdminIncident = async () => {
  try {
    const response = await fetch("/api/incidents/admin", {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Unable to load incident.");
    adminIncidents = await response.json();
    selectedIncident = adminIncidents.find((item) => item.incident_reference === incidentId);
    if (!selectedIncident) throw new Error("Incident not found.");
    renderIncident();
  } catch (error) {
    console.error("Unable to load admin incident.", error);
    document.getElementById("titleField").textContent = "UNABLE TO LOAD INCIDENT";
  }
};

await loadAdminIncident();

connectIncidentRealtime({
  onEvent: (event) => {
    if (event.incident_reference === incidentId) {
      loadAdminIncident().catch((error) => console.error(error));
    }
  },
  onReconnect: () => {
    if (incidentId) loadAdminIncident().catch((error) => console.error(error));
  },
});

// -----------------------------
// Incident actions
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

// Add a note to the current incident while note persistence is unavailable.
document.getElementById("addNoteButton").addEventListener("click", () => {
  const noteInput = document.getElementById("noteInput");
  const noteText = noteInput.value.trim();

  if (!noteText) {
    noteInput.focus();
    return;
  }

  const note = document.createElement("div");
  // Notes added from this admin user are styled as the user's chat bubbles.
  // Notes loaded from other users can use the "other" class later.
  note.className = "note-item own";
  const noteHeader = document.createElement("strong");
  noteHeader.append(
    document.createTextNode(window.currentUserDisplayName || "User"),
    document.createTextNode(" "),
  );
  const noteTimestamp = document.createElement("small");
  noteTimestamp.textContent = "JUST NOW";
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

const getReportText = (id, fallback = "Not provided") => {
  const element = document.getElementById(id);
  return element?.textContent.trim() || fallback;
};

const addReportField = (doc, label, value, x, y, width) => {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(65, 86, 94);
  doc.text(label, x, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(24, 43, 53);
  const lines = doc.splitTextToSize(value, width);
  doc.text(lines, x, y + 16);

  return y + 16 + lines.length * 14 + 18;
};

const generateIncidentReport = () => {
  if (!window.jspdf?.jsPDF) {
    window.alert("The PDF generator is still loading. Please try again.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin * 2;
  let y = 58;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(24, 43, 53);
  doc.text("Incident Report", margin, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(116, 132, 138);
  doc.text("Incident Management Application", margin, y);
  y += 24;

  doc.setDrawColor(220, 231, 229);
  doc.line(margin, y, pageWidth - margin, y);
  y += 24;

  const status = getReportText("statusBadge");
  const submitted = getReportText("incidentMeta");
  const resolved = getReportText("resolvedDate");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(65, 86, 94);
  doc.text("STATUS", margin, y);
  doc.text("SUBMITTED", margin + 170, y);
  doc.text("RESOLVED DATE", margin + 340, y);
  y += 15;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(24, 43, 53);
  doc.text(status, margin, y);
  doc.text(submitted, margin + 170, y);
  doc.text(resolved, margin + 340, y);
  y += 34;

  y = addReportField(
    doc,
    "TITLE",
    getReportText("titleField"),
    margin,
    y,
    contentWidth,
  );
  y = addReportField(
    doc,
    "SEVERITY",
    getReportText(
      "severityField",
      document.querySelector(".severity-high")?.textContent.trim() ||
        "Not provided",
    ),
    margin,
    y,
    contentWidth,
  );
  y = addReportField(
    doc,
    "DESCRIPTION",
    getReportText("descriptionField"),
    margin,
    y,
    contentWidth,
  );
  y = addReportField(
    doc,
    "ASSIGNED AID PROVIDER",
    document.getElementById("aidProvider")?.selectedOptions[0]?.textContent ||
      "NOT ASSIGNED",
    margin,
    y,
    contentWidth,
  );
  y = addReportField(
    doc,
    "COORDINATES",
    getReportText("overviewCoordinates"),
    margin,
    y,
    contentWidth,
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(24, 43, 53);
  doc.text("NOTES", margin, y);
  y += 20;

  const notes = [...document.querySelectorAll("#notesList .note-item")];
  if (!notes.length) {
    y = addReportField(
      doc,
      "NOTE",
      "No notes have been added to this incident.",
      margin,
      y,
      contentWidth,
    );
  } else {
    notes.forEach((note) => {
      const author = note.querySelector("strong")?.textContent.trim() || "Note";
      const text = note.querySelector("p")?.textContent.trim() || "";
      y = addReportField(doc, author, text, margin, y, contentWidth);
      if (y > doc.internal.pageSize.getHeight() - 80) {
        doc.addPage();
        y = 58;
      }
    });
  }

  const slug =
    getReportText("titleField", "incident")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "incident";
  doc.save(`incident-report-${slug}.pdf`);
};

document
  .getElementById("generateReportButton")
  .addEventListener("click", generateIncidentReport);
