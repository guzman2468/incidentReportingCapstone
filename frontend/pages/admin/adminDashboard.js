const incidents = [];

const rangeInDays = {
  day: 1,
  week: 7,
  month: 30,
  "six-months": 182,
  year: 365,
  "five-years": 1825,
};

const statusLabels = {
  NEW: "NEW",
  ASSIGNED: "ASSIGNED",
  IN_PROGRESS: "IN PROGRESS",
  RESOLVED: "RESOLVED",
  CLOSED: "CLOSED",
  CANCELLED: "CANCELLED",
};

const metadataStatusLabels = {
  NEW: "Submitted",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "Last updated",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

const summaryStatusLabels = {
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

const timeRangeLabels = {
  all: "all time",
  day: "past day",
  week: "past week",
  month: "past month",
  "six-months": "past 6 months",
  year: "past year",
  "five-years": "past 5 years",
};

const normalizeStatus = (status) => String(status || "").toUpperCase();

const formatDate = (dateValue) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "UNKNOWN DATE";
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
    .join(":") + ` ${meridiem}`;
  return `${dateText} ${timeText}`;
};

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

const isPastIncident = (incident) =>
  ["RESOLVED", "CLOSED", "CANCELLED"].includes(normalizeStatus(incident.status));

const getIncidentDate = (incident) => {
  const status = normalizeStatus(incident.status);
  if (status === "RESOLVED") {
    return incident.resolved_at || incident.updated_at || incident.created_at;
  }

  if (status === "CLOSED") {
    return incident.closed_at || incident.updated_at || incident.created_at;
  }

  if (status === "CANCELLED") {
    return incident.cancelled_at || incident.updated_at || incident.created_at;
  }

  if (status === "ASSIGNED") {
    return incident.assigned_at || incident.updated_at || incident.created_at;
  }

  if (status === "IN_PROGRESS") {
    return incident.updated_at || incident.created_at;
  }

  return incident.created_at;
};

const isWithinTimeRange = (dateValue, selectedRange) => {
  const days = rangeInDays[selectedRange];
  if (!days) return true;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return true;
  return date >= new Date(Date.now() - days * 86400000);
};

const getStatusClass = (status) => {
  const normalizedStatus = normalizeStatus(status);
  if (normalizedStatus === "NEW") return "awaiting";
  if (normalizedStatus === "ASSIGNED") return "assigned";
  if (normalizedStatus === "IN_PROGRESS") return "progress";
  if (normalizedStatus === "RESOLVED") return "resolved";
  return "closed";
};

const getIncidentSymbol = (status) => {
  const normalizedStatus = normalizeStatus(status);
  if (normalizedStatus === "NEW") return ["coral", "!"];
  if (normalizedStatus === "IN_PROGRESS") return ["amber", "✦"];
  if (normalizedStatus === "ASSIGNED") return ["blue", "↗"];
  return ["green", "✓"];
};

const getMetadataLabel = (incident) => {
  const status = normalizeStatus(incident.status);
  return metadataStatusLabels[status] || "Submitted";
};

const renderIncident = (incident) => {
  const status = normalizeStatus(incident.status);
  const [symbolColor, symbol] = getIncidentSymbol(status);
  const incidentDate = getIncidentDate(incident);
  const statusLabel = statusLabels[status] || status;
  const severity = String(incident.severity || "").toLowerCase();

  return `
    <article class="incident-row" tabindex="0" role="link"
      data-incident-id="${escapeHTML(incident.incident_reference)}"
      data-status="${escapeHTML(status)}">
      <div class="incident-symbol ${symbolColor}">${symbol}</div>
      <div class="incident-info">
        <strong>${escapeHTML(incident.title)}</strong>
        <span>${escapeHTML(incident.incident_reference)} · ${getMetadataLabel(incident)} ${escapeHTML(formatDate(incidentDate))}</span>
      </div>
      <span class="severity-pill severity-${escapeHTML(severity)}">${escapeHTML(incident.severity)}</span>
      <span class="status-pill ${getStatusClass(status)}">${escapeHTML(statusLabel)}</span>
      <span class="row-arrow">›</span>
    </article>`;
};

const getListIncidents = (past) =>
  incidents
    .filter((incident) => isPastIncident(incident) === past)
    .sort(
      (firstIncident, secondIncident) =>
        new Date(getIncidentDate(secondIncident)) -
        new Date(getIncidentDate(firstIncident)),
    );

const filterIncidents = (incidentList, searchId, statusFilterId, severityFilterId, timeFilterId) => {
  const query = document.getElementById(searchId).value.trim().toLowerCase();
  const selectedStatus = document.getElementById(statusFilterId).value.toUpperCase();
  const selectedSeverity = document.getElementById(severityFilterId).value.toUpperCase();
  const selectedRange = document.getElementById(timeFilterId).value;

  return incidentList.filter((incident) => {
    const status = normalizeStatus(incident.status);
    const severity = normalizeStatus(incident.severity);
    const incidentTitle = String(incident.title || "").toLowerCase();
    return (
      incidentTitle.startsWith(query) &&
      (selectedStatus === "ALL" || status === selectedStatus) &&
      (selectedSeverity === "ALL" || severity === selectedSeverity) &&
      isWithinTimeRange(getIncidentDate(incident), selectedRange)
    );
  });
};

const renderList = (listId, emptyId, matchingIncidents) => {
  document.getElementById(listId).innerHTML = matchingIncidents.map(renderIncident).join("");
  document.getElementById(emptyId).style.display = matchingIncidents.length ? "none" : "block";
};

const updateResolvedSummary = (pastIncidents) => {
  const status = document.getElementById("resolvedStatusFilter").value.toUpperCase();
  const selectedRange = document.getElementById("resolvedFilter").value;
  const matchingCount = pastIncidents.filter(
    (incident) => normalizeStatus(incident.status) === status && isWithinTimeRange(getIncidentDate(incident), selectedRange),
  ).length;
  document.getElementById("resolvedLabel").textContent =
    `${summaryStatusLabels[status] || status}: ${timeRangeLabels[selectedRange] || "all time"}`;
  document.getElementById("resolvedCount").textContent = matchingCount;
};

const updateDashboard = () => {
  const pastIncidents = getListIncidents(true);
  const activeIncidents = getListIncidents(false);
  renderList("pastIncidentList", "pastEmptyState", filterIncidents(pastIncidents, "pastSearch", "pastStatusFilter", "pastSeverityFilter", "pastFilter"));
  renderList("activeIncidentList", "activeEmptyState", filterIncidents(activeIncidents, "activeSearch", "activeStatusFilter", "activeSeverityFilter", "activeFilter"));
  document.getElementById("resolvedPastCount").textContent = pastIncidents.filter((incident) => normalizeStatus(incident.status) === "RESOLVED").length;
  document.getElementById("closedPastCount").textContent = pastIncidents.filter((incident) => normalizeStatus(incident.status) === "CLOSED").length;
  document.getElementById("pastIncidentCount").textContent = pastIncidents.length;
  const activeStatusCounts = activeIncidents.reduce((counts, incident) => {
    const status = normalizeStatus(incident.status);
    if (status === "IN_PROGRESS") counts.inProgress += 1;
    if (status === "NEW") counts.new += 1;
    if (status === "ASSIGNED") counts.assigned += 1;
    return counts;
  }, { inProgress: 0, new: 0, assigned: 0 });

  document.getElementById("activeIncidentCount").textContent = activeIncidents.length;
  document.getElementById("inProgressIncidentCount").textContent = activeStatusCounts.inProgress;
  document.getElementById("newIncidentCount").textContent = activeStatusCounts.new;
  document.getElementById("assignedIncidentCount").textContent = activeStatusCounts.assigned;
  const openIncidentRange = document.getElementById("openIncidentFilter").value;
  document.getElementById("openIncidentLabel").textContent =
    `Open incidents: ${timeRangeLabels[openIncidentRange] || "all time"}`;
  document.getElementById("openIncidentCount").textContent = activeIncidents.filter(
    (incident) => isWithinTimeRange(getIncidentDate(incident), openIncidentRange),
  ).length;
  updateResolvedSummary(pastIncidents);
};

const connectControls = () => {
  ["pastSearch", "pastStatusFilter", "pastSeverityFilter", "pastFilter", "activeSearch", "activeStatusFilter", "activeSeverityFilter", "activeFilter", "resolvedStatusFilter", "resolvedFilter"].forEach((id) => {
    document.getElementById(id).addEventListener(id.includes("Search") ? "input" : "change", updateDashboard);
  });
  document.getElementById("openIncidentFilter").addEventListener("change", updateDashboard);
};

const openIncident = (row) => {
  window.location.href = `adminIncidentOverview.html?id=${encodeURIComponent(row.dataset.incidentId)}`;
};

document.getElementById("currentDate").textContent = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
}).format(new Date()).toUpperCase();

document.addEventListener("click", (event) => {
  const row = event.target.closest(".incident-row");
  if (row) openIncident(row);
});

document.addEventListener("keydown", (event) => {
  const row = event.target.closest(".incident-row");
  if (row && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    openIncident(row);
  }
});

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

document.getElementById("logoutButton").addEventListener("click", window.logoutUser);

const loadAdminIncidents = async () => {
  try {
    const response = await fetch("/api/incidents/admin", {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Unable to load incidents.");
    incidents.splice(0, incidents.length, ...(await response.json()));
    updateDashboard();
  } catch (error) {
    console.error("Unable to load admin incidents.", error);
    document.querySelectorAll(".empty-state").forEach((emptyState) => {
      emptyState.textContent = "Unable to load incidents.";
      emptyState.style.display = "block";
    });
  }
};

connectControls();
await loadAdminIncidents();

connectIncidentRealtime({
  onEvent: loadAdminIncidents,
  onReconnect: loadAdminIncidents,
});
