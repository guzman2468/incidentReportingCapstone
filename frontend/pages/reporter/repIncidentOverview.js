// -----------------------------
// User menu
// -----------------------------
const userButton = document.getElementById('userButton');
const userDropdown = document.getElementById('userDropdown');

userButton.addEventListener('click', () => {
  const isOpen = userDropdown.classList.toggle('open');
  userDropdown.setAttribute('aria-hidden', String(!isOpen));
  userButton.setAttribute('aria-expanded', String(isOpen));
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('.user-menu')) {
    userDropdown.classList.remove('open');
    userDropdown.setAttribute('aria-hidden', 'true');
    userButton.setAttribute('aria-expanded', 'false');
  }
});

// -----------------------------
// Incident data
// -----------------------------
// Read the selected incident's basic values from the dashboard URL.
const params = new URLSearchParams(window.location.search);
const title = params.get('title');
const meta = params.get('meta');
const status = params.get('status');

if (title) {
  document.getElementById('titleField').textContent = title;
}
if (meta) {
  const submitted = 'submitted';
  const submittedIndex = meta.toLowerCase().indexOf(submitted);
  const afterSubmitted = submittedIndex === -1 ? '' : meta.slice(submittedIndex + submitted.length);
  const dateText = afterSubmitted.trimStart();
  const submittedDate = dateText && dateText.length < afterSubmitted.length ? dateText : meta;
  document.getElementById('incidentMeta').textContent = submittedDate;
}
if (status) {
  const statusBadge = document.getElementById('statusBadge');
  statusBadge.textContent = status;
  if (status.toLowerCase() !== 'resolved') {
    statusBadge.className = 'status-badge active-status';
  }
}

document.getElementById('overviewCoordinates').textContent = '41.878100° N, 87.629800° W';

// -----------------------------
// Visual-only actions
// -----------------------------
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
}

document.getElementById('logoutButton').addEventListener('click', () => showToast('Log out selected.'));

// Add a note to the page for visual testing until persistence is connected.
document.getElementById('addNoteButton').addEventListener('click', () => {
  const noteInput = document.getElementById('noteInput');
  const noteText = noteInput.value.trim();
  if (!noteText) {
    noteInput.focus();
    return;
  }

  const note = document.createElement('div');
  // Notes added from this reporter are styled as the user's chat bubbles.
  // Notes loaded from other users can use the "other" class later.
  note.className = 'note-item own';
  note.innerHTML = `<strong>FirstName LastName <small>just now</small></strong><p></p>`;
  note.querySelector('p').textContent = noteText;
  const notesList = document.getElementById('notesList');
  notesList.appendChild(note);
  document.querySelector('.notes-empty').style.display = 'none';
  noteInput.value = '';

  // Keep the newest note visible at the bottom of the scroll window.
  notesList.scrollTo({ top: notesList.scrollHeight, behavior: 'smooth' });
});

document.getElementById('followUpButton').addEventListener('click', () => showToast('Follow-up action will be available soon.'));
