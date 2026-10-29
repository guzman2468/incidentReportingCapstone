const incidents = [];

const listSettings = [
  {
    status: "past",
    listId: "pastList",
    searchId: "pastSearch",
    filterId: "pastFilter",
    emptyId: "pastEmpty",
    countId: "pastColumnCount",
  },
  {
    status: "active",
    listId: "activeList",
    searchId: "activeSearch",
    filterId: "activeFilter",
    emptyId: "activeEmpty",
    countId: "activeColumnCount",
  },
  {
    status: "new",
    listId: "newList",
    searchId: "newSearch",
    filterId: "newFilter",
    emptyId: "newEmpty",
    countId: "newColumnCount",
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
  const normalizedStatus = incident.status.toLowerCase();
  const statusLabel =
    {
      new: "New",
      active: "In progress",
      resolved: "Resolved",
      closed: "Closed",
    }[normalizedStatus] || normalizedStatus;

  const severityClass = `severity-${String(incident.severity).toLowerCase()}`;

  return `
    <button type="button" class="incident-row"
      data-incident-id="${escapeHTML(incident.incident_reference)}"
      aria-label="Open ${escapeHTML(incident.title)}">
      <span class="incident-row-content">
        <strong>${escapeHTML(incident.title)}</strong>
        <small>${escapeHTML(incident.incident_reference)} · Submitted ${escapeHTML(formatDate(incident.created_at))}</small>
      </span>
      <span class="row-status">
        <span class="severity-pill ${severityClass}">${escapeHTML(incident.severity)}</span>
        <span class="status-pill status-${escapeHTML(normalizedStatus)}">${escapeHTML(statusLabel.toUpperCase())}</span>
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
    const query = searchInput.value.trim().toLowerCase();
    const selectedRange = filterInput.value;

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
        isWithinTimeRange(incident.created_at, selectedRange)
      );
    });

    document.getElementById(settings.listId).innerHTML = filtered
      .map(renderIncident)
      .join("");

    document.getElementById(settings.countId).textContent =
      matchingIncidents.length;

    document.getElementById(settings.emptyId).style.display = filtered.length
      ? "none"
      : "block";
  });

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
}

// Each column has an independent search box.
listSettings.forEach(({ searchId, filterId }) => {
  document.getElementById(searchId).addEventListener("input", renderDashboard);
  document.getElementById(filterId).addEventListener("change", renderDashboard);
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

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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
