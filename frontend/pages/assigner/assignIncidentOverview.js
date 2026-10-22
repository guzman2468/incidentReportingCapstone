
const { incidents, providers } = window.assignerDemoData;

const params = new URLSearchParams(window.location.search);
const incidentId = params.get('id');

const providerSelect = document.getElementById('providerSelect');
const assignButton = document.getElementById('assignButton');
const confirmBackdrop = document.getElementById('confirmBackdrop');

let incident = null;
let pendingProvider = null;
let incidentMap = null;
let mapMarkers = null;

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

// -------------------------------------
// Load and display the selected incident
// -------------------------------------

function displayIncident() {
  incident = incidents.find((item) => item.id === incidentId);

  if (!incident) {
    document.querySelector('.overview-wrap').innerHTML = `
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

  document.getElementById('incidentNumber').textContent = incident.id;
  document.getElementById('incidentTitle').textContent = incident.title;
  document.getElementById('submittedDate').textContent =
    `Submitted ${incident.submitted || 'date unavailable'}`;

  document.getElementById('incidentDescription').textContent =
    incident.description || 'No description provided.';

  document.getElementById('incidentType').textContent =
    `Incident type: ${incident.type}`;

  document.getElementById('incidentCounty').textContent =
    `${incident.county} County`;

  document.getElementById('severityBadge').textContent =
    incident.severity || 'UNKNOWN';

  document.getElementById('severityBadge').className =
    `severity-badge severity-${String(incident.severity || '').toLowerCase()}`;

  updateStatusBadge();
  updateAvailableProviders();
  updateCurrentProvider();
  updateNearbyIncidents();
}

function updateStatusBadge() {
  const badge = document.getElementById('statusBadge');

  const labels = {
    new: 'New',
    active: 'In progress',
    resolved: 'Resolved',
    closed: 'Closed'
  };

  badge.textContent = labels[incident.status] || incident.status || 'New';
  badge.className = 'status-badge';

  if (['resolved', 'closed'].includes(incident.status)) {
    badge.classList.add(incident.status);
  } else if (incident.status === 'active') {
    badge.classList.add('active');
  }
}

let availableResponders = [];

function updateAvailableProviders() {
  const latitude = Number(incident.latitude);
  const longitude = Number(incident.longitude);
  const recommendation = document.getElementById('closestProviderHint');
  const hasCoordinates =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;

  providerSelect.replaceChildren(new Option('Select a responder...', ''));

  if (!hasCoordinates) {
    availableResponders = [];
    recommendation.textContent =
      'Responder distance cannot be calculated without valid incident coordinates.';
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
        provider.longitude
      )
    }))
    .sort((a, b) => a.distance - b.distance);

  if (!availableResponders.length) {
    recommendation.textContent =
      'No available county responders are listed for this demo.';
    return;
  }

  availableResponders.forEach((provider, index) => {
    const closestLabel = index === 0 ? ' (closest available)' : '';
    providerSelect.add(new Option(
      `${provider.name} — ${provider.county} County · ${provider.distance.toFixed(1)} mi${closestLabel}`,
      provider.id
    ));
  });

  const closestProvider = availableResponders[0];
  recommendation.textContent =
    `Closest available: ${closestProvider.name} in ${closestProvider.county} County, ` +
    `${closestProvider.distance.toFixed(1)} miles away.`;
}

function updateCurrentProvider() {
  const provider = incident.assignedProvider || '';
  const assignedCounty = incident.assignedCounty || '';

  document.getElementById('currentProvider').textContent =
    provider
      ? `${provider}${assignedCounty ? ` · ${assignedCounty} County` : ''}`
      : 'Not assigned';

  document.getElementById('assignmentSummary').textContent = provider
    ? `Currently assigned to ${provider}${assignedCounty ? ` in ${assignedCounty} County` : ''}. You can select another available responder to reassign this incident.`
    : 'No provider has been assigned yet.';

  const assignedResponder = availableResponders.find(
    (responder) => responder.name === provider
  );
  providerSelect.value = assignedResponder?.id || '';

  const isPast = ['resolved', 'closed'].includes(incident.status);

  providerSelect.disabled = isPast || !availableResponders.length;
  assignButton.disabled = isPast || !availableResponders.length;

  if (isPast) {
    assignButton.textContent = 'Incident is closed';
  } else if (!availableResponders.length) {
    assignButton.textContent = 'No responders available';
  } else {
    assignButton.innerHTML = 'Assign responder <span>→</span>';
  }
}

// -------------------------------------
// Map
// -------------------------------------

function updateMap(nearby = []) {
  const mapElement = document.getElementById('incidentMap');
  const latitude = Number(incident.latitude);
  const longitude = Number(incident.longitude);

  const hasCoordinates =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;

  if (!hasCoordinates) {
    document.getElementById('incidentCoordinates').textContent =
      'Location unavailable';

    mapElement.textContent = 'Map unavailable because this incident has no valid coordinates.';
    return;
  }

  const latitudeDirection = latitude >= 0 ? 'N' : 'S';
  const longitudeDirection = longitude >= 0 ? 'E' : 'W';

  document.getElementById('incidentCoordinates').textContent =
    `${Math.abs(latitude).toFixed(6)}° ${latitudeDirection}, ` +
    `${Math.abs(longitude).toFixed(6)}° ${longitudeDirection}`;

  if (typeof L === 'undefined') {
    mapElement.textContent =
      'The interactive map could not load. Check your internet connection and reload the page.';
    return;
  }

  if (!incidentMap) {
    incidentMap = L.map(mapElement).setView([latitude, longitude], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(incidentMap);
    mapMarkers = L.layerGroup().addTo(incidentMap);
  }

  mapMarkers.clearLayers();

  const radiusMiles = Number(document.getElementById('radiusSelect').value);
  const radiusCircle = L.circle([latitude, longitude], {
    radius: radiusMiles * 1609.344,
    color: '#087f83',
    weight: 1,
    fillColor: '#087f83',
    fillOpacity: 0.08
  }).addTo(mapMarkers);

  L.circleMarker([latitude, longitude], {
    radius: 8,
    color: '#ffffff',
    weight: 2,
    fillColor: '#087f83',
    fillOpacity: 1
  }).bindPopup(
    `<strong>${escapeHTML(incident.id)} · ${escapeHTML(incident.title)}</strong><br>` +
    `${escapeHTML(incident.county)} County · Selected incident`
  ).addTo(mapMarkers);

  nearby.forEach((other) => {
    L.circleMarker([Number(other.latitude), Number(other.longitude)], {
      radius: 6,
      color: '#ffffff',
      weight: 2,
      fillColor: '#ee806d',
      fillOpacity: 1
    }).bindPopup(
      `<strong>${escapeHTML(other.id)} · ${escapeHTML(other.title)}</strong><br>` +
      `${escapeHTML(other.county)} County · ${other.distance.toFixed(1)} miles away`
    ).addTo(mapMarkers);
  });

  incidentMap.fitBounds(radiusCircle.getBounds(), {
    padding: [16, 16],
    maxZoom: 14
  });
  window.setTimeout(() => incidentMap.invalidateSize(), 0);
}

// -------------------------------------
// Nearby incidents
// -------------------------------------

// Calculate the straight-line distance between two coordinates in miles.
function distanceInMiles(lat1, lon1, lat2, lon2) {
  const earthRadius = 3958.8;
  const toRadians = (degrees) => degrees * Math.PI / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
    Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) ** 2;

  const safeA = Math.min(1, Math.max(0, a));

  return earthRadius * 2 * Math.atan2(
    Math.sqrt(safeA),
    Math.sqrt(1 - safeA)
  );
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
        distance: distanceInMiles(
          latitude,
          longitude,
          otherLat,
          otherLon
        )
      };
    })
    .filter((other) => other && other.distance <= radius)
    .sort((a, b) => a.distance - b.distance);
}

function updateNearbyIncidents() {
  const list = document.getElementById('nearbyList');
  const empty = document.getElementById('nearbyEmpty');
  const radius = Number(document.getElementById('radiusSelect').value);
  const nearby = findNearbyIncidents(radius);

  if (nearby === null) {
    list.innerHTML = '';
    empty.textContent =
      'Nearby incidents cannot be calculated because this incident has no valid coordinates.';
    empty.style.display = 'block';
    updateMap();
    return;
  }

  list.innerHTML = nearby.map((other) => `
    <a class="nearby-row"
       href="assignIncidentOverview.html?id=${encodeURIComponent(other.id)}">
      <span class="nearby-icon">↗</span>
      <span class="nearby-info">
        <strong>${escapeHTML(other.title)}</strong>
        <small>
          ${escapeHTML(other.id)} · ${escapeHTML(other.county)} County · ${other.distance.toFixed(1)} miles away
        </small>
        <small>
          ${escapeHTML(other.type)} · ${escapeHTML(other.severity)} · ${escapeHTML(other.status)}
        </small>
      </span>
    </a>
  `).join('');

  empty.style.display = nearby.length ? 'none' : 'block';
  updateMap(nearby);
}

document.getElementById('radiusSelect').addEventListener(
  'change',
  updateNearbyIncidents
);

// -------------------------------------
// Provider assignment and confirmation
// -------------------------------------

assignButton.addEventListener('click', () => {
  if (!incident || ['resolved', 'closed'].includes(incident.status)) {
    return;
  }

  const selectedProvider = availableResponders.find(
    (provider) => provider.id === providerSelect.value
  );

  if (!selectedProvider) {
    providerSelect.reportValidity();
    providerSelect.focus();
    return;
  }

  pendingProvider = selectedProvider;

  const isReassignment =
    Boolean(incident.assignedProvider) &&
    incident.assignedProvider !== selectedProvider.name;

  document.getElementById('confirmMessage').textContent = isReassignment
    ? `Reassign ${incident.id} from ${incident.assignedProvider} to ${selectedProvider.name} in ${selectedProvider.county} County (${selectedProvider.distance.toFixed(1)} miles away)?`
    : `Assign ${incident.id} to ${selectedProvider.name} in ${selectedProvider.county} County (${selectedProvider.distance.toFixed(1)} miles away)?`;

  confirmBackdrop.hidden = false;
  document.getElementById('confirmAssign').focus();
});

function closeConfirmation() {
  confirmBackdrop.hidden = true;
  pendingProvider = null;
}

document.getElementById('cancelAssign').addEventListener('click', () => {
  closeConfirmation();
});

document.getElementById('confirmAssign').addEventListener('click', () => {
  if (!incident || !pendingProvider) return;

  if (['resolved', 'closed'].includes(incident.status)) {
    closeConfirmation();
    displayIncident();
    return;
  }

  const confirmedProvider = pendingProvider;
  incident.assignedProvider = confirmedProvider.name;
  incident.assignedCounty = confirmedProvider.county;
  incident.status = 'active';

  // Update the assignment date for the demonstration.
  incident.assignedDate = new Date().toISOString();

  closeConfirmation();
  displayIncident();
});

// Close the dialog when the user clicks its backdrop.
confirmBackdrop.addEventListener('click', (event) => {
  if (event.target === confirmBackdrop) {
    closeConfirmation();
  }
});

// Escape also closes the confirmation dialog.
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !confirmBackdrop.hidden) {
    closeConfirmation();
  }
});

// -------------------------------------
// Profile dropdown
// -------------------------------------

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
    z-index: 2001;
  `;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 2600);
});

// Initialize the page.
if (!incidentId) {
  document.querySelector('.overview-wrap').innerHTML = `
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
