
const { incidents } = window.assignerDemoData;

const listSettings = [
  { status: 'past', listId: 'pastList', searchId: 'pastSearch', emptyId: 'pastEmpty', countId: 'pastColumnCount' },
  { status: 'active', listId: 'activeList', searchId: 'activeSearch', emptyId: 'activeEmpty', countId: 'activeColumnCount' },
  { status: 'new', listId: 'newList', searchId: 'newSearch', emptyId: 'newEmpty', countId: 'newColumnCount' }
];

function getColumn(incident) {
  if (['resolved', 'closed'].includes(incident.status)) return 'past';
  if (incident.status === 'new') return 'new';
  return 'active';
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function renderIncident(incident, column) {
  const symbolClass = column === 'past'
    ? 'past'
    : column === 'active' ? 'active' : '';

  const symbol = column === 'past'
    ? '✓'
    : column === 'active' ? '↻' : '!';

  const statusLabel = {
    new: 'New',
    active: 'In progress',
    resolved: 'Resolved',
    closed: 'Closed'
  }[incident.status] || incident.status;

  const severityClass = `severity-${String(incident.severity).toLowerCase()}`;

  return `
    <button type="button" class="incident-row"
      data-incident-id="${escapeHTML(incident.id)}"
      aria-label="Open ${escapeHTML(incident.title)}">
      <span class="incident-symbol ${symbolClass}">${symbol}</span>
      <span class="incident-row-content">
        <strong>${escapeHTML(incident.title)}</strong>
        <small>${escapeHTML(incident.id)} · ${escapeHTML(incident.submitted)}</small>
        <small>${escapeHTML(incident.type)} · ${escapeHTML(incident.county)} County</small>
        <span class="row-bottom">
          <span class="severity-pill ${severityClass}">
            ${escapeHTML(incident.severity)}
          </span>
          <span class="status-pill">${escapeHTML(statusLabel)}</span>
        </span>
        ${incident.assignedProvider ? `
          <small>Provider: ${escapeHTML(incident.assignedProvider)} · ${escapeHTML(incident.assignedCounty)} County</small>
        ` : ''}
      </span>
      <span class="row-arrow" aria-hidden="true">›</span>
    </button>
  `;
}

function renderDashboard() {
  listSettings.forEach((settings) => {
    const matchingIncidents = incidents.filter(
      (incident) => getColumn(incident) === settings.status
    );

    const searchInput = document.getElementById(settings.searchId);
    const query = searchInput.value.trim().toLowerCase();

    const filtered = matchingIncidents.filter((incident) => {
      const searchableText = [
        incident.id,
        incident.title,
        incident.description,
        incident.type,
        incident.county,
        incident.severity,
        incident.assignedProvider
      ].join(' ').toLowerCase();

      return searchableText.includes(query);
    });

    document.getElementById(settings.listId).innerHTML =
      filtered.map((incident) => renderIncident(incident, settings.status)).join('');

    document.getElementById(settings.countId).textContent =
      matchingIncidents.length;

    document.getElementById(settings.emptyId).style.display =
      filtered.length ? 'none' : 'block';
  });

  document.getElementById('newCount').textContent =
    incidents.filter((incident) => getColumn(incident) === 'new').length;

  document.getElementById('activeCount').textContent =
    incidents.filter((incident) => getColumn(incident) === 'active').length;

  document.getElementById('pastCount').textContent =
    incidents.filter((incident) => getColumn(incident) === 'past').length;

  document.getElementById('totalCount').textContent =
    `${incidents.length} incidents`;
}

// Each column has an independent search box.
listSettings.forEach(({ searchId }) => {
  document.getElementById(searchId).addEventListener('input', renderDashboard);
});

// Event delegation means newly rendered incident buttons still work.
document.querySelector('.incident-columns').addEventListener('click', (event) => {
  const button = event.target.closest('[data-incident-id]');
  if (!button) return;

  const id = button.dataset.incidentId;
  window.location.href =
    `assignIncidentOverview.html?id=${encodeURIComponent(id)}`;
});

// Profile dropdown.
const userButton = document.getElementById('userButton');
const userDropdown = document.getElementById('userDropdown');

userButton.addEventListener('click', () => {
  const isOpen = userDropdown.classList.toggle('open');
  userButton.setAttribute('aria-expanded', String(isOpen));
  userDropdown.setAttribute('aria-hidden', String(!isOpen));
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('.user-menu')) {
    userDropdown.classList.remove('open');
    userButton.setAttribute('aria-expanded', 'false');
    userDropdown.setAttribute('aria-hidden', 'true');
  }
});

document.getElementById('logoutButton').addEventListener('click', () => {
  const toast = document.createElement('div');

  toast.textContent = 'Log out selected.';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: #18343a;
    color: #fff;
    border-radius: 8px;
    padding: 12px 17px;
    font: 12px DM Sans, sans-serif;
    z-index: 10;
  `;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 2600);
});

document.getElementById('currentDate').textContent =
  new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date()).toUpperCase();

renderDashboard();
