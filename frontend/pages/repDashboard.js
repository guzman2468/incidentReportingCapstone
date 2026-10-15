// -----------------------------
// Date display
// -----------------------------
// Show the user's current date in the dashboard greeting.
document.getElementById('currentDate').textContent = new Intl.DateTimeFormat('en-US', {
  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
}).format(new Date()).toUpperCase();

// -----------------------------
// Report modal
// -----------------------------
const modal = document.getElementById('reportModal');

// Open the report form and place the cursor in the first field.
const openModal = () => {
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.getElementById('reportTitle').focus();
};

// Close the report form.
const closeModal = () => {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
};

// Open the modal from the main report button.
// Close the modal with the close button or by clicking the backdrop.
document.getElementById('modalClose').addEventListener('click', closeModal);
modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });

// Allow Escape to close the modal.
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeModal(); });

// -----------------------------
// Incident search
// -----------------------------
// Connect one search input and one time filter to one incident list.
function connectIncidentControls(inputId, listId, emptyId, filterId) {
  const search = document.getElementById(inputId);
  const filter = document.getElementById(filterId);
  const rows = [...document.querySelectorAll(`#${listId} .incident-row`)];
  const emptyState = document.getElementById(emptyId);

  // Apply both controls only to this incident column.
  const applyFilters = () => {
    const query = search.value.trim().toLowerCase();
    const selectedRange = filter.value;
    const today = new Date();
    const rangeInDays = { day: 1, week: 7, month: 30, 'six-months': 182, year: 365, 'five-years': 1825 };
    const cutoff = rangeInDays[selectedRange] ? new Date(today.getTime() - rangeInDays[selectedRange] * 86400000) : null;
    let visible = 0;

    rows.forEach((row) => {
      const incidentDateText = row.querySelector('.incident-info span').textContent.match(/Submitted\s+(.+)$/i)?.[1];
      const incidentDate = incidentDateText ? new Date(incidentDateText) : null;
      const matchesSearch = row.dataset.search.includes(query);
      const matchesTime = !cutoff || !incidentDate || incidentDate >= cutoff;
      const isVisible = matchesSearch && matchesTime;
      row.style.display = isVisible ? 'flex' : 'none';
      if (isVisible) visible += 1;
    });

    emptyState.style.display = visible ? 'none' : 'block';
  };

  search.addEventListener('input', applyFilters);
  filter.addEventListener('change', applyFilters);
}

// Update the resolved summary card using its own independent time filter.
function connectResolvedSummary() {
  const filter = document.getElementById('resolvedFilter');
  const label = document.getElementById('resolvedLabel');
  const count = document.getElementById('resolvedCount');
  const rows = [...document.querySelectorAll('#pastIncidentList .incident-row')];
  const rangeInDays = { day: 1, week: 7, month: 30, 'six-months': 182, year: 365, 'five-years': 1825 };
  const labelByRange = {
    all: 'Resolved all time',
    day: 'Resolved today',
    week: 'Resolved this week',
    month: 'Resolved this month',
    'six-months': 'Resolved in the past 6 months',
    year: 'Resolved this year',
    'five-years': 'Resolved in the past 5 years'
  };

  const updateCount = () => {
    const selectedRange = filter.value;
    const today = new Date();
    const cutoff = rangeInDays[selectedRange]
      ? new Date(today.getTime() - rangeInDays[selectedRange] * 86400000)
      : null;

    label.textContent = labelByRange[selectedRange] || 'Resolved incidents';

    const matchingRows = rows.filter((row) => {
      const dateText = row.querySelector('.incident-info span').textContent.match(/Submitted\s+(.+)$/i)?.[1];
      const incidentDate = dateText ? new Date(dateText) : null;
      return !cutoff || !incidentDate || incidentDate >= cutoff;
    });

    count.textContent = matchingRows.length;
  };

  filter.addEventListener('change', updateCount);
  updateCount();
}

// Each incident category has its own independent search field.
connectIncidentControls('activeSearch', 'activeIncidentList', 'activeEmptyState', 'activeFilter');
connectIncidentControls('pastSearch', 'pastIncidentList', 'pastEmptyState', 'pastFilter');
connectResolvedSummary();

// -----------------------------
// Incident overview navigation
// -----------------------------
// Make every incident row open the same visual overview page, regardless of status.
document.querySelectorAll('.incident-row').forEach((row) => {
  row.setAttribute('role', 'link');
  row.setAttribute('tabindex', '0');

  const openIncident = () => {
    const title = row.querySelector('.incident-info strong').textContent;
    const meta = row.querySelector('.incident-info span').textContent;
    const status = row.querySelector('.status-pill')?.textContent || 'Open';
    const params = new URLSearchParams({ title, meta, status });
    window.location.href = `repIncidentOverview.html?${params.toString()}`;
  };

  row.addEventListener('click', openIncident);
  row.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openIncident();
    }
  });
});

// -----------------------------
// Visual-only report actions
// -----------------------------
// These buttons currently show feedback only; backend submission can be added later.
document.getElementById('saveDraft').addEventListener('click', () => { closeModal(); showToast('Draft saved — you can finish it anytime.'); });
document.getElementById('continueReport').addEventListener('click', () => { closeModal(); showToast('Report started — next step coming soon.'); });

// -----------------------------
// User menu
// -----------------------------
const userButton = document.getElementById('userButton');
const userDropdown = document.getElementById('userDropdown');

// Toggle the logout dropdown when the profile avatar is clicked.
userButton.addEventListener('click', () => {
  const isOpen = userDropdown.classList.toggle('open');
  userDropdown.setAttribute('aria-hidden', String(!isOpen));
  userButton.setAttribute('aria-expanded', String(isOpen));
});

// Close the dropdown when the user clicks outside the profile area.
document.addEventListener('click', (event) => {
  if (!event.target.closest('.user-menu')) {
    userDropdown.classList.remove('open');
    userDropdown.setAttribute('aria-hidden', 'true');
    userButton.setAttribute('aria-expanded', 'false');
  }
});

// Logout is a placeholder until authentication logic is connected.
document.getElementById('logoutButton').addEventListener('click', () => showToast('Log out selected.'));

// Display a temporary confirmation message at the bottom of the screen.
function showToast(message) {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#18343a;color:#fff;border-radius:8px;padding:12px 17px;font:12px DM Sans,sans-serif;box-shadow:0 10px 25px rgba(0,0,0,.16);z-index:10';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
}
