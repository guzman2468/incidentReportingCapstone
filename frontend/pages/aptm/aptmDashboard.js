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
      } else {
        counts.resolved += 1;
      }

      return counts;
    },
    {
      resolved: 0,
      closed: 0,
    },
  );

const updatePastCount = () => {
  const resolvedCount = document.getElementById("resolvedPastCount");
  const closedCount = document.getElementById("closedPastCount");

  const rows = [
    ...document.querySelectorAll("#pastIncidentList .incident-row"),
  ];
  const counts = getPastStatusCounts(rows);

  resolvedCount.textContent = counts.resolved;
  closedCount.textContent = counts.closed;
};

const updatePastDateLabels = () => {
  document
    .querySelectorAll("#pastIncidentList .incident-row")
    .forEach((row) => {
      const label = row.dataset.status === "closed" ? "Closed" : "Resolved";
      row.querySelector(".date-label").textContent = label;
    });
};

// APTM incidents use their team-assignment date in the dashboard metadata.
const updateAssignedDateLabels = () => {
  document
    .querySelectorAll("#activeIncidentList .incident-info span")
    .forEach((metadata) => {
      metadata.textContent = metadata.textContent.replaceAll(
        "Submitted",
        "Assigned",
      );
    });
};

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
) {
  const search = document.getElementById(inputId);
  const filter = document.getElementById(filterId);

  const statusFilter = statusFilterId
    ? document.getElementById(statusFilterId)
    : null;

  const rows = [...document.querySelectorAll(`#${listId} .incident-row`)];
  const emptyState = document.getElementById(emptyId);

  const applyFilters = () => {
    const query = search.value.trim().toLowerCase();
    const selectedFilter = filter.value;
    const selectedStatus = statusFilter?.value;

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

      const matchesSearch = row.dataset.search.startsWith(query);
      const matchesTime = !cutoff || !incidentDate || incidentDate >= cutoff;

      const isVisible = matchesSearch && matchesStatus && matchesTime;

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
    const statusLabel = status === "closed" ? "Closed" : "Resolved";
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
);
connectIncidentControls(
  "pastSearch",
  "pastIncidentList",
  "pastEmptyState",
  "pastFilter",
  "pastStatusFilter",
);

connectResolvedSummary();
updatePastDateLabels();
updatePastCount();
updateAssignedDateLabels();

// -----------------------------
// Incident overview navigation
// -----------------------------
// Make every incident row open the same APTM overview page, regardless of status.
document.querySelectorAll(".incident-row").forEach((row) => {
  row.setAttribute("role", "link");
  row.setAttribute("tabindex", "0");

  const openIncident = () => {
    const title = row.querySelector(".incident-info strong").textContent;
    const meta = row.querySelector(".incident-info span").textContent;
    const status = row.querySelector(".status-pill")?.textContent || "Open";
    const params = new URLSearchParams({ title, meta, status });

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
