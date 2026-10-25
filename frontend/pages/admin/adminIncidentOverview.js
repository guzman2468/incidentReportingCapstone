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
// Read the selected incident's basic values from the admin dashboard URL.
const params = new URLSearchParams(window.location.search);
const title = params.get("title");
const meta = params.get("meta");
const incidentStatus = params.get("status");

// The admin overview is read-only for assignment; keep the field out of this view.
document.querySelector(".assignment-field")?.remove();

// Keep nearby incidents in the open space beneath the incident fields.
const nearbyCard = document.querySelector(".nearby-card");
const formFields = document.querySelector(".form-fields");
if (nearbyCard && formFields) {
  formFields.appendChild(nearbyCard);
  nearbyCard.querySelector(".section-heading p")?.remove();
}

// The admin dashboard passes the incident summary in the URL. Reuse the
// overview's incident data so the map and nearby list stay in sync with the
// assignee overview's radius behavior.
const demoIncidents = window.assignerDemoData?.incidents || [];
const incidentId = /INC-\d+/i.exec(meta || "")?.[0]?.toUpperCase();
const selectedDemoIncident =
  demoIncidents.find((item) => item.id === incidentId) ||
  demoIncidents.find((item) => item.title === title) ||
  demoIncidents[0];
const selectedCoordinates = selectedDemoIncident
  ? {
      latitude: Number(selectedDemoIncident.latitude),
      longitude: Number(selectedDemoIncident.longitude),
    }
  : { latitude: 41.8781, longitude: -87.6298 };
let incidentMap = null;
let mapMarkers = null;

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

const findNearbyIncidents = (radius) =>
  demoIncidents
    .filter((item) => item.id !== selectedDemoIncident?.id)
    .map((item) => ({
      ...item,
      distance: distanceInMiles(
        selectedCoordinates.latitude,
        selectedCoordinates.longitude,
        Number(item.latitude),
        Number(item.longitude),
      ),
    }))
    .filter((item) => item.distance <= radius)
    .sort((a, b) => a.distance - b.distance);

const updateMap = (nearby) => {
  const mapElement = document.getElementById("incidentMap");
  if (!mapElement || typeof L === "undefined") {
    if (mapElement)
      mapElement.textContent =
        "The interactive map could not load. Check your internet connection and reload the page.";
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
      `<strong>${escapeHTML(incidentId || "Selected incident")} · ${escapeHTML(title || "Incident")}</strong><br>Selected incident`,
    )
    .addTo(mapMarkers);

  nearby.forEach((item) =>
    L.circleMarker([item.latitude, item.longitude], {
      radius: 6,
      color: "#fff",
      weight: 2,
      fillColor: "#ee806d",
      fillOpacity: 1,
    })
      .bindPopup(
        `<strong>${escapeHTML(item.id)} · ${escapeHTML(item.title)}</strong><br>${escapeHTML(item.county)} County · ${item.distance.toFixed(1)} miles away`,
      )
      .addTo(mapMarkers),
  );

  incidentMap.fitBounds(radiusCircle.getBounds(), {
    padding: [16, 16],
    maxZoom: 14,
  });
  window.setTimeout(() => incidentMap.invalidateSize(), 0);
};

const updateNearbyIncidents = () => {
  const radius = Number(document.getElementById("radiusSelect").value);
  const nearby = findNearbyIncidents(radius);
  const list = document.getElementById("nearbyList");
  const empty = document.getElementById("nearbyEmpty");

  list.innerHTML = nearby
    .map(
      (item) => `<div class="nearby-row">
    <span class="nearby-info">
      <strong>${escapeHTML(item.title)}</strong>
      <small>${escapeHTML(item.id)} · ${escapeHTML(item.county)} County · ${item.distance.toFixed(1)} miles away</small>
      <small>${escapeHTML(item.type)} · ${escapeHTML(item.severity)} · ${escapeHTML(item.status)}</small>
    </span></div>`,
    )
    .join("");
  empty.style.display = nearby.length ? "none" : "block";
  updateMap(nearby);
};

document
  .getElementById("radiusSelect")
  .addEventListener("change", updateNearbyIncidents);
updateNearbyIncidents();

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

// Add a note to the page for visual testing until persistence is connected.
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
      "Not assigned",
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
