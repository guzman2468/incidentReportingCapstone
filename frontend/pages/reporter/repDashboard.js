const incidents = [];

const rangeInDays = {
  day: 1,
  week: 7,
  month: 30,
  "six-months": 182,
  year: 365,
  "five-years": 1825,
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

const statusLabels = {
  NEW: "NEW",
  IN_PROGRESS: "IN PROGRESS",
  RESOLVED: "RESOLVED",
  CLOSED: "CLOSED",
  CANCELLED: "CANCELLED",
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

const formatDate = (dateValue) => {
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

const getColumn = (incident) =>
  ["RESOLVED", "CLOSED", "CANCELLED"].includes(incident.status)
    ? "past"
    : "active";

const getStatusFilterValue = (status) =>
  status === "IN_PROGRESS" ? "progress" : status.toLowerCase();

const getStatusClass = (status) => {
  if (status === "NEW") return "awaiting";
  if (status === "ASSIGNED") return "assigned";
  if (status === "IN_PROGRESS") return "progress";
  if (status === "RESOLVED") return "resolved";
  return "closed";
};

const getIncidentTimestamp = (incident) => {
  if (incident.status === "NEW") return incident.created_at;
  if (incident.status === "ASSIGNED") return incident.assigned_at || incident.updated_at;
  if (incident.status === "IN_PROGRESS") return incident.updated_at;
  if (incident.status === "RESOLVED") return incident.resolved_at || incident.updated_at;
  if (incident.status === "CANCELLED") return incident.cancelled_at || incident.updated_at;
  return incident.updated_at;
};

const getIncidentTimestampLabel = (status) =>
  ({
    NEW: "Submitted",
    ASSIGNED: "Assigned",
    IN_PROGRESS: "Last updated",
    RESOLVED: "Resolved",
    CLOSED: "Closed",
    CANCELLED: "Cancelled",
  })[status] || "Last updated";

const getIncidentSymbol = (incident) => {
  if (incident.status === "NEW") {
    return { className: "coral", symbol: "!" };
  }

  if (incident.status === "IN_PROGRESS") {
    return { className: "amber", symbol: "✦" };
  }

  return { className: "green", symbol: "✓" };
};

const renderIncident = (incident) => {
  const { className, symbol } = getIncidentSymbol(incident);
  const statusLabel = statusLabels[incident.status] || incident.status;
  const severity = String(incident.severity || "").toLowerCase();
  const searchText = [
    incident.incident_reference,
    incident.title,
    incident.description,
    incident.severity,
    incident.location,
    statusLabel,
  ]
    .join(" ")
    .toLowerCase();

  return `
    <article
      class="incident-row"
      data-incident-reference="${escapeHTML(incident.incident_reference)}"
      data-search="${escapeHTML(searchText)}"
    >
      <div class="incident-symbol ${className}">${symbol}</div>
      <div class="incident-info">
        <strong>${escapeHTML(incident.title)}</strong>
        <span>${escapeHTML(incident.incident_reference)} · ${getIncidentTimestampLabel(incident.status)} ${escapeHTML(formatDate(getIncidentTimestamp(incident)))}</span>
      </div>
      <span class="severity-pill severity-${escapeHTML(severity)}">${escapeHTML(incident.severity || "Unknown")}</span>
      <span class="status-pill ${getStatusClass(incident.status)}">${escapeHTML(statusLabel)}</span>
      <span class="row-arrow">›</span>
    </article>
  `;
};

const isWithinTimeRange = (dateValue, selectedRange) => {
  const days = rangeInDays[selectedRange];
  if (!days) return true;

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return true;

  return date >= new Date(Date.now() - days * 86400000);
};

function connectIncidentControls(
  inputId,
  listId,
  emptyId,
  filterId,
  statusFilterId,
  severityFilterId,
) {
  const search = document.getElementById(inputId);
  const filter = document.getElementById(filterId);
  const statusFilter = document.getElementById(statusFilterId);
  const severityFilter = document.getElementById(severityFilterId);

  const applyFilters = () => {
    const query = search.value.trim().toLowerCase();
    const selectedRange = filter.value;
    const selectedStatus = statusFilter.value;
    const selectedSeverity = severityFilter.value;
    const rows = [...document.querySelectorAll(`#${listId} .incident-row`)];
    let visible = 0;

    rows.forEach((row) => {
      const incident = incidents.find(
        (item) => item.incident_reference === row.dataset.incidentReference,
      );
      const matchesSearch = row.dataset.search.includes(query);
      const matchesStatus =
        selectedStatus === "all" ||
        getStatusFilterValue(incident.status) === selectedStatus;
      const matchesSeverity =
        selectedSeverity === "all" ||
        String(incident.severity || "").toUpperCase() === selectedSeverity;
      const matchesTime = isWithinTimeRange(incident.created_at, selectedRange);
      const isVisible =
        matchesSearch && matchesStatus && matchesSeverity && matchesTime;

      row.style.display = isVisible ? "flex" : "none";
      if (isVisible) visible += 1;
    });

    document.getElementById(emptyId).style.display = visible ? "none" : "block";
  };

  search.oninput = applyFilters;
  filter.onchange = applyFilters;
  statusFilter.onchange = applyFilters;
  severityFilter.onchange = applyFilters;
  applyFilters();
}

const updateResolvedSummary = () => {
  const selectedRange = document.getElementById("resolvedFilter").value;
  const selectedStatus = document.getElementById("resolvedStatusFilter").value;
  const statusLabel = document.getElementById("resolvedStatusFilter").selectedOptions[0].textContent;

  document.getElementById("resolvedLabel").textContent =
    `${statusLabel}: ${timeRangeLabels[selectedRange] || "all time"}`;
  document.getElementById("resolvedCount").textContent = incidents.filter(
    (incident) =>
      incident.status === selectedStatus &&
      isWithinTimeRange(incident.created_at, selectedRange),
  ).length;
};

const renderDashboard = () => {
  const pastIncidents = incidents.filter(
    (incident) => getColumn(incident) === "past",
  );
  const activeIncidents = incidents.filter(
    (incident) => getColumn(incident) === "active",
  );

  document.getElementById("pastIncidentList").innerHTML = pastIncidents
    .map(renderIncident)
    .join("");
  document.getElementById("activeIncidentList").innerHTML = activeIncidents
    .map(renderIncident)
    .join("");
  document.getElementById("pastIncidentList").hidden = false;
  document.getElementById("activeIncidentList").hidden = false;

  document.getElementById("pastTotalCount").textContent = pastIncidents.length;
  document.getElementById("newActiveCount").textContent = activeIncidents.filter(
    (incident) => incident.status === "NEW",
  ).length;
  document.getElementById(
    "progressActiveCount",
  ).textContent = activeIncidents.filter(
    (incident) => incident.status === "IN_PROGRESS",
  ).length;
  document.getElementById("resolvedPastCount").textContent = pastIncidents.filter(
    (incident) => incident.status === "RESOLVED",
  ).length;
  document.getElementById("closedPastCount").textContent = pastIncidents.filter(
    (incident) => incident.status === "CLOSED",
  ).length;
  document.getElementById("cancelledPastCount").textContent = pastIncidents.filter(
    (incident) => incident.status === "CANCELLED",
  ).length;
  document.getElementById("activeTotalCount").textContent = activeIncidents.length;
  document.getElementById("assignedActiveCount").textContent = activeIncidents.filter(
    (incident) => incident.status === "ASSIGNED",
  ).length;
  const openIncidentRange = document.getElementById("openIncidentFilter").value;
  const openIncidentStatus = document.getElementById("openIncidentStatus").value;
  const openStatusLabel = document.getElementById("openIncidentStatus").selectedOptions[0].textContent;
  document.getElementById("openIncidentLabel").textContent =
    `${openStatusLabel}: ${timeRangeLabels[openIncidentRange] || "all time"}`;
  document.getElementById("openIncidentCount").textContent = activeIncidents.filter(
    (incident) =>
      (openIncidentStatus === "all" || incident.status === openIncidentStatus) &&
      isWithinTimeRange(incident.created_at, openIncidentRange),
  ).length;

  connectIncidentControls(
    "activeSearch",
    "activeIncidentList",
    "activeEmptyState",
    "activeFilter",
    "activeStatusFilter",
    "activeSeverityFilter",
  );
  connectIncidentControls(
    "pastSearch",
    "pastIncidentList",
    "pastEmptyState",
    "pastFilter",
    "pastStatusFilter",
    "pastSeverityFilter",
  );
  updateResolvedSummary();
};

const loadReporterIncidents = async () => {
  const response = await fetch("/api/incidents/mine");
  if (!response.ok) throw new Error("Unable to load incidents.");

  const loadedIncidents = await response.json();
  incidents.splice(0, incidents.length, ...loadedIncidents);
  renderDashboard();
};

document.getElementById("currentDate").textContent = new Intl.DateTimeFormat(
  "en-US",
  {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  },
)
  .format(new Date())
  .toUpperCase();

document.getElementById("resolvedFilter").addEventListener(
  "change",
  updateResolvedSummary,
);
document.getElementById("resolvedStatusFilter").addEventListener(
  "change",
  updateResolvedSummary,
);

document.getElementById("openIncidentFilter").addEventListener(
  "change",
  renderDashboard,
);
document.getElementById("openIncidentStatus").addEventListener(
  "change",
  renderDashboard,
);

document
  .querySelector(".dashboard-grid")
  .addEventListener("click", (event) => {
    const row = event.target.closest("[data-incident-reference]");
    if (!row) return;

    const incident = incidents.find(
      (item) => item.incident_reference === row.dataset.incidentReference,
    );
    if (!incident) return;

    const params = new URLSearchParams({
      reference: incident.incident_reference,
      title: incident.title,
      meta: `${incident.incident_reference} · Submitted ${formatDate(incident.created_at)}`,
      status: statusLabels[incident.status] || incident.status,
    });
    window.location.href = `repIncidentOverview.html?${params.toString()}`;
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

document
  .getElementById("logoutButton")
  .addEventListener("click", window.logoutUser);

try {
  await loadReporterIncidents();
} catch (error) {
  console.error("Unable to load reporter incidents.", error);
  document.getElementById("activeIncidentList").innerHTML = "";
  document.getElementById("pastIncidentList").innerHTML = "";
  document.getElementById("activeIncidentList").hidden = false;
  document.getElementById("pastIncidentList").hidden = false;
  document.getElementById("activeEmptyState").textContent =
    "Unable to load your incidents.";
  document.getElementById("pastEmptyState").textContent =
    "Unable to load your incidents.";
}
