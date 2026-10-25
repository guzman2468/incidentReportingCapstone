const userButton = document.getElementById('userButton');
const userDropdown = document.getElementById('userDropdown');

// Toggle the profile dropdown when the avatar is clicked.
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

document.getElementById('logoutButton').addEventListener('click', window.logoutUser);

// Convert a role constant such as AID_PROVIDER_TEAM_MEMBER into readable text.
function formatRole(role) {
  return role
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

// Build one account row for either list.
function createAccountRow(account) {
  const row = document.createElement('div');
  row.className = 'nearby-row account-row';

  const icon = document.createElement('span');
  icon.className = 'nearby-icon';
  icon.textContent = (account.first_name.charAt(0) + account.last_name.charAt(0)).toUpperCase();

  const info = document.createElement('div');
  info.className = 'nearby-info';

  const name = document.createElement('strong');
  name.textContent = account.first_name + ' ' + account.last_name;

  const email = document.createElement('small');
  email.textContent = account.email;

  const badges = document.createElement('div');
  badges.className = 'account-badges';

  const role = document.createElement('span');
  role.className = 'role-badge';
  role.textContent = formatRole(account.role);

  const status = document.createElement('span');
  status.className = 'status-badge ' + (account.is_active ? 'resolved' : 'inactive');
  status.textContent = account.is_active ? 'Active' : 'Inactive';

  badges.append(role, status);
  info.append(name, email, badges);
  row.append(icon, info);
  return row;
}

// Fill a list with account rows, or show its empty message.
function renderList(accounts, listId, emptyId, countId) {
  const list = document.getElementById(listId);
  const empty = document.getElementById(emptyId);

  list.replaceChildren(...accounts.map(createAccountRow));
  empty.classList.toggle('show', accounts.length === 0);
  document.getElementById(countId).textContent = accounts.length;
}

function renderAccounts(accounts) {
  const sorted = [...accounts].sort((a, b) =>
    (a.last_name + a.first_name).localeCompare(b.last_name + b.first_name));
  const reporters = sorted.filter((account) => account.role === 'REPORTER');
  const staff = sorted.filter((account) => account.role !== 'REPORTER');

  renderList(staff, 'staffList', 'staffEmpty', 'staffCount');
  renderList(reporters, 'reporterList', 'reporterEmpty', 'reporterCount');

  document.getElementById('totalAccountsBadge').textContent =
    accounts.length + (accounts.length === 1 ? ' account' : ' accounts');
}

// Load every account from the admin-only users endpoint.
async function loadAccounts() {
  try {
    const response = await fetch('/api/users');
    if (!response.ok) throw new Error('Account request failed.');
    renderAccounts(await response.json());
  } catch (error) {
    console.error('Unable to load accounts.', error);
    renderAccounts([]);
    document.getElementById('staffEmpty').textContent = 'Unable to load accounts. Please refresh the page.';
    document.getElementById('reporterEmpty').textContent = 'Unable to load accounts. Please refresh the page.';
  }
}

loadAccounts();
