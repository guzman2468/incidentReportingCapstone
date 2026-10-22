// -----------------------------
// User menu
// -----------------------------
const userButton = document.getElementById('userButton');
const userDropdown = document.getElementById('userDropdown');

// Toggle the profile dropdown when the avatar is clicked.
userButton.addEventListener('click', () => {
  const isOpen = userDropdown.classList.toggle('open');
  userDropdown.setAttribute('aria-hidden', String(!isOpen));
  userButton.setAttribute('aria-expanded', String(isOpen));
});

// Close the dropdown when the user clicks anywhere else.
document.addEventListener('click', (event) => {
  if (!event.target.closest('.user-menu')) {
    userDropdown.classList.remove('open');
    userDropdown.setAttribute('aria-hidden', 'true');
    userButton.setAttribute('aria-expanded', 'false');
  }
});

// -----------------------------
// Submission form
// -----------------------------
const form = document.getElementById('incidentForm');
const cancelConfirm = document.getElementById('cancelConfirm');
const cancelConfirmBackdrop = document.getElementById('cancelConfirmBackdrop');


const closeCancelConfirm = () => {
  cancelConfirm.close();
  cancelConfirmBackdrop.hidden = true;
};

cancelConfirm.addEventListener('close', () => {
  cancelConfirmBackdrop.hidden = true;
});


// Show a styled confirmation dialog before leaving and discarding the form.
document.getElementById('cancelButton').addEventListener('click', (event) => {
  event.preventDefault();
  cancelConfirmBackdrop.hidden = false;
  cancelConfirm.showModal();
});

// Close the confirmation dialog and return to the form.
document.getElementById('keepEditing').addEventListener('click', () => {
  closeCancelConfirm();
});


// Leave the page only after the user explicitly confirms.
document.getElementById('discardChanges').addEventListener('click', () => {
  window.location.href = 'repDashboard.html';
});

// Clicking outside the dialog keeps the user on the form.
cancelConfirm.addEventListener('click', (event) => {
  const bounds = cancelConfirm.getBoundingClientRect();
  const clickedOutside = event.clientX < bounds.left
    || event.clientX > bounds.right
    || event.clientY < bounds.top
    || event.clientY > bounds.bottom;

  if (clickedOutside) {
    closeCancelConfirm();
  }
});


// Escape closes the confirmation dialog.
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && cancelConfirm.open) closeCancelConfirm();
});

// This is visual-only for now. Backend submission can be connected later.
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const toast = document.createElement('div');

  toast.className = 'toast';
  toast.textContent = 'Incident report ready to submit.';
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 2600);
});


// -----------------------------
// Location lookup
// -----------------------------
const locationButton = document.getElementById('locationButton');
const coordinates = document.getElementById('coordinates');
const mapCard = document.getElementById('mapCard');
const mapFrame = document.getElementById('mapFrame');

// Ask the browser for the user's current coordinates.
locationButton.addEventListener('click', () => {
  if (!navigator.geolocation) {
    coordinates.textContent = 'Location is not supported by this browser.';
    return;
  }

  locationButton.disabled = true;
  locationButton.textContent = 'Getting location...';
  coordinates.textContent = 'Waiting for permission...';

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      const latitudeDirection = latitude >= 0 ? 'N' : 'S';
      const longitudeDirection = longitude >= 0 ? 'E' : 'W';

      coordinates.textContent = `${Math.abs(latitude).toFixed(6)}° ${latitudeDirection}, `
        + `${Math.abs(longitude).toFixed(6)}° ${longitudeDirection}`;

      // Build a small OpenStreetMap view with a marker at the retrieved point.
      const mapPadding = 0.01;
      const left = longitude - mapPadding;
      const right = longitude + mapPadding;
      const bottom = latitude - mapPadding;
      const top = latitude + mapPadding;

      mapFrame.src = 'https://www.openstreetmap.org/export/embed.html'
        + `?bbox=${left},${bottom},${right},${top}`
        + `&layer=mapnik&marker=${latitude},${longitude}`;
        
      mapCard.hidden = false;
      locationButton.disabled = false;
      locationButton.textContent = 'Update location';
    },
    () => {
      coordinates.textContent = 'Unable to retrieve coordinates.';
      locationButton.disabled = false;
      locationButton.textContent = 'Try again';
    }
  );
});

document.getElementById('logoutButton').addEventListener('click', window.logoutUser);
