let assignedIncidents = [];

// -----------------------------
// Date display
// -----------------------------
// Show the user's current date in the dashboard greeting.
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

const getSubmittedDateText = (metadata) => {
  const normalizedMetadata = metadata.toLowerCase();
  let dateMarker = "submitted";

  if (normalizedMetadata.includes("resolved")) {
    dateMarker = "resolved";
  } else if (normalizedMetadata.includes("closed")) {
    dateMarker = "closed";
  } else if (normalizedMetadata.includes("last updated")) {
    dateMarker = "last updated";
  } else if (normalizedMetadata.includes("assigned")) {
    dateMarker = "assigned";
  }

  const dateIndex = normalizedMetadata.indexOf(dateMarker);
  if (dateIndex === -1) return null;

  const afterDate = metadata.slice(dateIndex + dateMarker.length);
  const dateText = afterDate.replace(/^\s*:\s*/, "").trimStart();

  return dateText || null;
};

const getPastStatusCounts = (rows) =>
  rows.reduce(
    (counts, row) => {
      if (row.dataset.status === "closed") {
        counts.closed += 1;
      } else if (row.dataset.status === "cancelled") {
        counts.cancelled += 1;
      } else {
        counts.resolved += 1;
      }

      return counts;
    },
    {
      resolved: 0,
      closed: 0,
      cancelled: 0,
    },
  );

const updatePastCount = () => {
  const totalCount = document.getElementById("pastTotalCount");
  const resolvedCount = document.getElementById("resolvedPastCount");
  const closedCount = document.getElementById("closedPastCount");
  const cancelledCount = document.getElementById("cancelledPastCount");

  const rows = [
    ...document.querySelectorAll("#pastIncidentList .incident-row"),
  ];
  const counts = getPastStatusCounts(rows);

  totalCount.textContent = rows.length;
  resolvedCount.textContent = counts.resolved;
  closedCount.textContent = counts.closed;
  cancelledCount.textContent = counts.cancelled;
};

const updatePastDateLabels = () => {
  document
    .querySelectorAll("#pastIncidentList .incident-row")
    .forEach((row) => {
      let label = "Resolved";
      if (row.dataset.status === "closed") {
        label = "Closed";
      } else if (row.dataset.status === "cancelled") {
        label = "Cancelled";
      }
      row.querySelector(".date-label").textContent = label;
    });
};

function clearPastIncidentMockData() {
  document.getElementById("pastIncidentList").replaceChildren();
  const emptyState = document.getElementById("pastEmptyState");
  emptyState.textContent = "No past incidents to display.";
  emptyState.style.display = "block";
}

function formatTeamName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/(^|[\s'-])\w/g, (letter) => letter.toUpperCase());
}

async function loadCurrentTeamName() {
  const response = await fetch("/api/users/currentUser");
  if (!response.ok) throw new Error("Unable to load your team.");

  const user = await response.json();
  const teamName = document.getElementById("teamName");
  teamName.textContent = formatTeamName(user.team_name) || "No team assigned";
}

const formatIncidentDate = (dateValue) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "date unavailable";

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

const getIncidentStatus = (status) => {
  const normalizedStatus = String(status || "").toLowerCase();
  return normalizedStatus === "in_progress" ? "progress" : normalizedStatus;
};

const getIncidentTimestampLabel = (status) =>
  ({
    new: "Submitted",
    assigned: "Assigned",
    progress: "Last updated",
  })[status] || "Last updated";

const getIncidentTimestamp = (incident, status) => {
  if (status === "new") return incident.created_at;
  if (status === "assigned") return incident.assigned_at || incident.updated_at;
  return incident.updated_at || incident.created_at;
};

const getStatusClass = (status) => {
  if (status === "new") return "awaiting";
  if (status === "assigned") return "assigned";
  if (status === "progress") return "progress";
  if (status === "resolved") return "resolved";
  return "closed";
};

const getIncidentSymbolClass = (severity) => {
  const symbols = {
    LOW: "blue",
    MEDIUM: "amber",
    HIGH: "coral",
    SEVERE: "coral",
    CRITICAL: "coral",
  };

  return symbols[String(severity || "").toUpperCase()] || "blue";
};

function renderAssignedIncidents(incidents) {
  const list = document.getElementById("activeIncidentList");
  const assignedCount = document.getElementById("assignedCount");
  const progressCount = document.getElementById("progressCount");
  const teamName = document.getElementById("teamName");

  list.replaceChildren();
  assignedIncidents = incidents;
  document.getElementById("activeTotalCount").textContent = incidents.length;
  assignedCount.textContent = incidents.filter(
    (incident) => getIncidentStatus(incident.status) === "assigned",
  ).length;
  progressCount.textContent = incidents.filter(
    (incident) => getIncidentStatus(incident.status) === "progress",
  ).length;

  if (incidents[0]?.assigned_team_name) {
    teamName.textContent = formatTeamName(incidents[0].assigned_team_name);
  }

  incidents.forEach((incident) => {
    const status = getIncidentStatus(incident.status);
    const statusLabel = {
      new: "New",
      assigned: "Assigned",
      progress: "In progress",
    }[status] || status;
    const row = document.createElement("article");

    row.className = "incident-row";
    row.dataset.search = [
      incident.incident_reference,
      incident.title,
      incident.description,
      incident.location,
      incident.severity,
    ]
      .join(" ")
      .toLowerCase();
    row.dataset.status = status;
    row.dataset.severity = String(incident.severity || "").toUpperCase();
    row.innerHTML = `
      <div class="incident-symbol ${getIncidentSymbolClass(incident.severity)}">!</div>
      <div class="incident-info">
        <strong></strong>
        <span></span>
      </div>
      <span class="severity-pill severity-${String(incident.severity || "").toLowerCase()}">${incident.severity || "Unknown"}</span>
      <span class="status-pill ${getStatusClass(status)}">${statusLabel}</span>
      <span class="row-arrow">›</span>
    `;

    row.querySelector("strong").textContent = incident.title;
    row.querySelector(".incident-info span").textContent =
      `${incident.incident_reference} · ${getIncidentTimestampLabel(status)} ${formatIncidentDate(getIncidentTimestamp(incident, status))}`;
    list.appendChild(row);
  });

  connectIncidentNavigation();
  updateOpenSummary();
  document.getElementById("activeFilter").dispatchEvent(new Event("change"));
}

async function loadAssignedIncidents() {
  const response = await fetch("/api/incidents/assigned-to-me", {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Unable to load incidents assigned to your team.");
  }

  renderAssignedIncidents(await response.json());
}

// -----------------------------
// Incident search
// -----------------------------
// Connect one search input and one time filter to one incident list.
function connectIncidentControls(
  inputId,
  listId,
  emptyId,
  filterId,
  statusFilterId = null,
  severityFilterId = null,
) {
  const search = document.getElementById(inputId);
  const filter = document.getElementById(filterId);

  const statusFilter = statusFilterId
    ? document.getElementById(statusFilterId)
    : null;
  const severityFilter = severityFilterId
    ? document.getElementById(severityFilterId)
    : null;

  const emptyState = document.getElementById(emptyId);

  const applyFilters = () => {
    const rows = [...document.querySelectorAll(`#${listId} .incident-row`)];
    const query = search.value.trim().toLowerCase();
    const selectedFilter = filter.value;
    const selectedStatus = statusFilter?.value;
    const selectedSeverity = severityFilter?.value;

    const rangeInDays = {
      day: 1,
      week: 7,
      month: 30,
      "six-months": 182,
      year: 365,
      "five-years": 1825,
    };

    const days = rangeInDays[selectedFilter];
    const cutoff = days ? new Date(Date.now() - days * 86400000) : null;

    let visible = 0;

    rows.forEach((row) => {
      const metadata = row.querySelector(".incident-info span").textContent;
      const dateText = getSubmittedDateText(metadata);
      const incidentDate = dateText ? new Date(dateText) : null;

      const matchesStatus =
        !selectedStatus ||
        selectedStatus === "all" ||
        row.dataset.status === selectedStatus;
      const matchesSeverity =
        !selectedSeverity ||
        selectedSeverity === "all" ||
        row.dataset.severity === selectedSeverity;

      const matchesSearch = row.dataset.search.startsWith(query);
      const matchesTime = !cutoff || !incidentDate || incidentDate >= cutoff;

      const isVisible =
        matchesSearch && matchesStatus && matchesSeverity && matchesTime;

      row.style.display = isVisible ? "flex" : "none";
      if (isVisible) {
        visible += 1;
      }
    });

    emptyState.style.display = visible ? "none" : "block";
  };

  search.addEventListener("input", applyFilters);
  filter.addEventListener("change", applyFilters);

  if (statusFilter) statusFilter.addEventListener("change", applyFilters);
  if (severityFilter) severityFilter.addEventListener("change", applyFilters);
}

function updateOpenSummary() {
  const selectedStatus = document.getElementById("openIncidentStatus").value;
  const selectedRange = document.getElementById("openIncidentFilter").value;
  const rangeInDays = {
    day: 1,
    week: 7,
    month: 30,
    "six-months": 182,
    year: 365,
    "five-years": 1825,
  };
  const timeLabels = {
    all: "all time",
    day: "past day",
    week: "past week",
    month: "past month",
    "six-months": "past 6 months",
    year: "past year",
    "five-years": "past 5 years",
  };
  const cutoff = rangeInDays[selectedRange]
    ? new Date(Date.now() - rangeInDays[selectedRange] * 86400000)
    : null;
  const statusLabel = document.getElementById("openIncidentStatus").selectedOptions[0].textContent;
  const count = assignedIncidents.filter((incident) => {
    const status = getIncidentStatus(incident.status);
    const date = new Date(incident.assigned_at || incident.updated_at);
    return (
      (selectedStatus === "all" || status === selectedStatus) &&
      (!cutoff || Number.isNaN(date.getTime()) || date >= cutoff)
    );
  }).length;

  document.getElementById("openIncidentLabel").textContent =
    `${statusLabel}: ${timeLabels[selectedRange] || "all time"}`;
  document.getElementById("openIncidentCount").textContent = count;
}

// Update the resolved summary card using its own independent time filter.
function connectResolvedSummary() {
  const statusFilter = document.getElementById("resolvedStatusFilter");
  const filter = document.getElementById("resolvedFilter");
  const label = document.getElementById("resolvedLabel");
  const count = document.getElementById("resolvedCount");
  const rows = [
    ...document.querySelectorAll("#pastIncidentList .incident-row"),
  ];

  const ranges = {
    day: 1,
    week: 7,
    month: 30,
    "six-months": 182,
    year: 365,
    "five-years": 1825,
  };

  const timeLabels = {
    all: "all time",
    day: "today",
    week: "this week",
    month: "this month",
    "six-months": "in the past 6 months",
    year: "this year",
    "five-years": "in the past 5 years",
  };

  const update = () => {
    const selectedFilter = filter.value;
    const status = statusFilter.value;
    const days = ranges[selectedFilter];
    const cutoff = days ? new Date(Date.now() - days * 86400000) : null;
    let statusLabel = "Resolved";
    if (status === "closed") {
      statusLabel = "Closed";
    } else if (status === "cancelled") {
      statusLabel = "Cancelled";
    }
    const timeLabel = timeLabels[selectedFilter] || "all time";

    label.textContent = `${statusLabel} ${timeLabel}`;
    count.textContent = rows.filter((row) => {
      if (row.dataset.status !== status) return false;
      const metadata = row.querySelector(".incident-info span").textContent;
      const dateText = getSubmittedDateText(metadata);
      const date = dateText ? new Date(dateText) : null;

      return !cutoff || !date || date >= cutoff;
    }).length;
  };

  statusFilter.addEventListener("change", update);
  filter.addEventListener("change", update);
  update();
}

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

document.getElementById("openIncidentStatus").addEventListener(
  "change",
  updateOpenSummary,
);
document.getElementById("openIncidentFilter").addEventListener(
  "change",
  updateOpenSummary,
);

clearPastIncidentMockData();
connectResolvedSummary();
updatePastDateLabels();
updatePastCount();

try {
  await loadCurrentTeamName();
} catch (error) {
  console.error(error);
}

try {
  await loadAssignedIncidents();
} catch (error) {
  console.error(error);
  document.getElementById("activeEmptyState").textContent = error.message;
}

// -----------------------------
// Incident overview navigation
// -----------------------------
// Make every incident row open the same APTM overview page, regardless of status.
function connectIncidentNavigation() {
  document.querySelectorAll(".incident-row").forEach((row) => {
    if (row.dataset.navigationConnected === "true") return;

    row.dataset.navigationConnected = "true";
    row.setAttribute("role", "link");
    row.setAttribute("tabindex", "0");

    const openIncident = () => {
      const title = row.querySelector(".incident-info strong").textContent;
      const meta = row.querySelector(".incident-info span").textContent;
      const status = row.querySelector(".status-pill")?.textContent || "Open";
      const params = new URLSearchParams({
        reference: row.dataset.incidentReference || "",
        title,
        meta,
        status,
      });

      window.location.href = `aptmOverview.html?${params}`;
    };

    row.addEventListener("click", openIncident);
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openIncident();
      }
    });
  });
}

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

document
  .getElementById("logoutButton")
  .addEventListener("click", window.logoutUser);

connectIncidentRealtime({
  onEvent: loadAssignedIncidents,
  onReconnect: loadAssignedIncidents,
});
