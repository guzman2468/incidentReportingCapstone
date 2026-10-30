const incidents = [];

const listSettings = [
  {
    status: "past",
    listId: "pastList",
    searchId: "pastSearch",
    filterId: "pastFilter",
    severityFilterId: "pastSeverityFilter",
    statusFilterId: "pastStatusFilter",
    emptyId: "pastEmpty",
  },
  {
    status: "active",
    listId: "activeList",
    searchId: "activeSearch",
    filterId: "activeFilter",
    severityFilterId: "activeSeverityFilter",
    statusFilterId: "activeStatusFilter",
    emptyId: "activeEmpty",
  },
  {
    status: "new",
    listId: "newList",
    searchId: "newSearch",
    filterId: "newFilter",
    severityFilterId: "newSeverityFilter",
    emptyId: "newEmpty",
  },
];

const rangeInDays = {
  day: 1,
  week: 7,
  month: 30,
  "six-months": 182,
  year: 365,
  "five-years": 1825,
};

const summaryCardSettings = [
  { column: "past", statusId: "pastSummaryStatus", rangeId: "pastSummaryRange", countId: "pastCount", labelId: "pastSummaryLabel" },
  { column: "active", statusId: "activeSummaryStatus", rangeId: "activeSummaryRange", countId: "activeCount", labelId: "activeSummaryLabel" },
  { column: "new", rangeId: "newSummaryRange", countId: "newCount", labelId: "newSummaryLabel", fixedStatus: "NEW", fixedLabel: "New" },
];

function isWithinTimeRange(submitted, selectedRange) {
  const days = rangeInDays[selectedRange];
  if (!days) return true;

  const incidentDate = new Date(submitted);
  if (Number.isNaN(incidentDate.getTime())) return true;

  return incidentDate >= new Date(Date.now() - days * 86400000);
}

function getColumn(incident) {
  const status = incident.status.toLowerCase();
  if (["resolved", "closed", "cancelled"].includes(status)) return "past";
  if (status === "new") return "new";
  return "active";
}

function getIncidentTimestamp(incident) {
  const status = incident.status.toUpperCase();
  if (status === "NEW") return incident.created_at;
  if (status === "ASSIGNED") return incident.assigned_at || incident.updated_at;
  if (status === "IN_PROGRESS") return incident.updated_at;
  if (status === "RESOLVED") return incident.resolved_at || incident.updated_at;
  return incident.updated_at;
}

function getIncidentTimestampLabel(status) {
  return {
    NEW: "Submitted",
    ASSIGNED: "Assigned",
    IN_PROGRESS: "Last updated",
    RESOLVED: "Resolved",
    CLOSED: "Closed",
    CANCELLED: "Cancelled",
  }[status] || "Last updated";
}

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

function renderIncident(incident) {
  const normalizedStatus = incident.status.toUpperCase();
  const statusKey = normalizedStatus.toLowerCase();
  const statusClass = {
    new: "awaiting",
    assigned: "assigned",
    in_progress: "progress",
    resolved: "resolved",
    closed: "closed",
    cancelled: "closed",
  }[statusKey] || "closed";
  const statusLabel =
    {
      new: "New",
      assigned: "Assigned",
      active: "In progress",
      in_progress: "In progress",
      resolved: "Resolved",
      closed: "Closed",
    }[statusKey] || normalizedStatus;

  const severityClass = `severity-${String(incident.severity).toLowerCase()}`;

  return `
    <button type="button" class="incident-row"
      data-incident-id="${escapeHTML(incident.incident_reference)}"
      aria-label="Open ${escapeHTML(incident.title)}">
      <span class="incident-row-content">
        <strong>${escapeHTML(incident.title)}</strong>
        <small>${escapeHTML(incident.incident_reference)} · ${getIncidentTimestampLabel(normalizedStatus)} ${escapeHTML(formatDate(getIncidentTimestamp(incident)))}</small>
      </span>
      <span class="row-status">
        <span class="severity-pill ${severityClass}">${escapeHTML(incident.severity)}</span>
        <span class="status-pill status-${escapeHTML(statusClass)}">${escapeHTML(statusLabel.toUpperCase())}</span>
      </span>
      <span class="row-arrow" aria-hidden="true">›</span>
    </button>
  `;
}

function renderDashboard() {
  listSettings.forEach((settings) => {
    const matchingIncidents = incidents.filter(
      (incident) => getColumn(incident) === settings.status,
    );

    const searchInput = document.getElementById(settings.searchId);
    const filterInput = document.getElementById(settings.filterId);
    const severityFilterInput = document.getElementById(settings.severityFilterId);
    const query = searchInput.value.trim().toLowerCase();
    const selectedRange = filterInput.value;
    const selectedSeverity = severityFilterInput.value;
    const selectedStatus = settings.statusFilterId
      ? document.getElementById(settings.statusFilterId).value
      : "all";

    const filtered = matchingIncidents.filter((incident) => {
      const searchableText = [
        incident.incident_reference,
        incident.title,
        incident.description,
        incident.location,
        incident.severity,
        incident.assignedProvider,
      ]
        .join(" ")
        .toLowerCase();

      return (
        searchableText.includes(query) &&
        (selectedStatus === "all" ||
          incident.status.toUpperCase() === selectedStatus) &&
        (selectedSeverity === "all" ||
          incident.severity.toUpperCase() === selectedSeverity) &&
        isWithinTimeRange(incident.created_at, selectedRange)
      );
    });

    document.getElementById(settings.listId).innerHTML = filtered
      .map(renderIncident)
      .join("");

    document.getElementById(settings.emptyId).style.display = filtered.length
      ? "none"
      : "block";
  });

  const countByStatus = (status) =>
    incidents.filter((incident) => incident.status.toUpperCase() === status).length;

  document.getElementById("pastTotalCount").textContent = getColumnIncidents("past").length;
  document.getElementById("pastResolvedCount").textContent = countByStatus("RESOLVED");
  document.getElementById("pastClosedCount").textContent = countByStatus("CLOSED");
  document.getElementById("pastCancelledCount").textContent = countByStatus("CANCELLED");
  document.getElementById("activeTotalCount").textContent = getColumnIncidents("active").length;
  document.getElementById("activeInProgressCount").textContent = countByStatus("IN_PROGRESS");
  document.getElementById("activeAssignedCount").textContent = countByStatus("ASSIGNED");
  document.getElementById("newTotalCount").textContent = getColumnIncidents("new").length;
  document.getElementById("newStatusCount").textContent = countByStatus("NEW");

  document.getElementById("newCount").textContent = incidents.filter(
    (incident) => getColumn(incident) === "new",
  ).length;

  document.getElementById("activeCount").textContent = incidents.filter(
    (incident) => getColumn(incident) === "active",
  ).length;

  document.getElementById("pastCount").textContent = incidents.filter(
    (incident) => getColumn(incident) === "past",
  ).length;

  document.getElementById("totalCount").textContent =
    `${incidents.length} incidents`;

  updateSummaryCards();
}

function updateSummaryCards() {
  summaryCardSettings.forEach((settings) => {
    const selectedStatus = settings.statusId
      ? document.getElementById(settings.statusId).value
      : settings.fixedStatus;
    const selectedRange = document.getElementById(settings.rangeId).value;
    const matchingCount = incidents.filter(
      (incident) =>
        getColumn(incident) === settings.column &&
        (selectedStatus === "all" || incident.status.toUpperCase() === selectedStatus) &&
        isWithinTimeRange(incident.created_at, selectedRange),
    ).length;
    const statusLabel = settings.statusId
      ? document.getElementById(settings.statusId).selectedOptions[0].textContent
      : settings.fixedLabel;
    const rangeLabel = document.getElementById(settings.rangeId).selectedOptions[0].textContent.toLowerCase();
    document.getElementById(settings.countId).textContent = matchingCount;
    document.getElementById(settings.labelId).textContent = `${statusLabel}: ${rangeLabel}`;
  });
}

function getColumnIncidents(column) {
  return incidents.filter((incident) => getColumn(incident) === column);
}

// Each column has an independent search box.
listSettings.forEach(({ searchId, filterId, severityFilterId, statusFilterId }) => {
  document.getElementById(searchId).addEventListener("input", renderDashboard);
  document.getElementById(filterId).addEventListener("change", renderDashboard);
  document
    .getElementById(severityFilterId)
    .addEventListener("change", renderDashboard);
  if (statusFilterId) {
    document
      .getElementById(statusFilterId)
      .addEventListener("change", renderDashboard);
  }
});

summaryCardSettings.forEach(({ statusId, rangeId }) => {
  if (statusId) {
    document.getElementById(statusId).addEventListener("change", updateSummaryCards);
  }
  document.getElementById(rangeId).addEventListener("change", updateSummaryCards);
});

// Event delegation means newly rendered incident buttons still work.
document
  .querySelector(".incident-columns")
  .addEventListener("click", (event) => {
    const button = event.target.closest("[data-incident-id]");
    if (!button) return;

    const id = button.dataset.incidentId;
    window.location.href = `assignIncidentOverview.html?id=${encodeURIComponent(id)}`;
  });

// Profile dropdown.
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

renderDashboard();

function formatDate(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Unknown date";

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
}

async function loadAssignerIncidents() {
  try {
    const response = await fetch("/api/incidents/assigner");
    if (!response.ok) throw new Error("Unable to load incidents.");

    const loadedIncidents = await response.json();
    incidents.splice(0, incidents.length, ...loadedIncidents);
    renderDashboard();
  } catch (error) {
    console.error("Unable to load assigner incidents.", error);
    document.querySelectorAll(".empty-state").forEach((emptyState) => {
      emptyState.textContent = "Unable to load incidents.";
      emptyState.style.display = "block";
    });
  }
}

await loadAssignerIncidents();
