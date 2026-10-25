const form = document.getElementById('provisionForm');
const submitButton = form.querySelector('button[type="submit"]');
const roleSelect = document.getElementById('role');
const aidProviderField = document.getElementById('aidProviderField');
const aidProviderSelect = document.getElementById('aidProvider');
const aidProviderTeamField = document.getElementById('aidProviderTeamField');
const aidProviderTeamSelect = document.getElementById('aidProviderTeam');
const aidProviderNameField = document.getElementById('aidProviderNameField');
const aidProviderNameInput = document.getElementById('aidProviderName');
const aidProviderDescriptionField = document.getElementById('aidProviderDescriptionField');
const aidProviderDescriptionInput = document.getElementById('aidProviderDescription');
const firstNameInput = document.getElementById('firstName');
const lastNameInput = document.getElementById('lastName');
const firstNameField = firstNameInput.closest('.field');
const lastNameField = lastNameInput.closest('.field');
let providersLoaded = false;

function formatDisplayName(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/(^|[\s'-])\w/g, (letter) => letter.toUpperCase());
}
const cancelConfirm = document.getElementById('cancelConfirm');
const cancelConfirmBackdrop = document.getElementById('cancelConfirmBackdrop');
const successDialog = document.getElementById('successDialog');
const successBackdrop = document.getElementById('successBackdrop');

function closeCancelConfirm() {
  cancelConfirm.close();
  cancelConfirmBackdrop.hidden = true;
}

cancelConfirm.addEventListener('close', () => {
  cancelConfirmBackdrop.hidden = true;
});

document.getElementById('cancelButton').addEventListener('click', (event) => {
  event.preventDefault();
  cancelConfirmBackdrop.hidden = false;
  cancelConfirm.showModal();
});

document.getElementById('keepEditing').addEventListener('click', closeCancelConfirm);

document.getElementById('discardChanges').addEventListener('click', () => {
  window.location.href = 'adminDashboard.html';
});

cancelConfirm.addEventListener('click', (event) => {
  const bounds = cancelConfirm.getBoundingClientRect();
  const clickedOutside = event.clientX < bounds.left
    || event.clientX > bounds.right
    || event.clientY < bounds.top
    || event.clientY > bounds.bottom;

  if (clickedOutside) closeCancelConfirm();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && cancelConfirm.open) closeCancelConfirm();
});

function closeSuccessDialog() {
  successDialog.close();
  successBackdrop.hidden = true;
}

successDialog.addEventListener('close', () => {
  successBackdrop.hidden = true;
});

document.getElementById('successDone').addEventListener('click', closeSuccessDialog);

function setError(input, message) {
  const error = document.getElementById(`${input.id}Error`);
  input.classList.toggle('input-error', Boolean(message));
  error.textContent = message || '';
  return !message;
}

function validateInput(input) {
  if (!input.value.trim()) {
    const label = input.labels[0].textContent.replace('*', '').trim();
    return setError(input, `${label} is required.`);
  }

  if (input.id === 'email' && !input.validity.valid) {
    return setError(input, 'Enter an email in the format name@domain.extension.');
  }

  if (input.id === 'email' && !window.hasValidEmailExtension(input.value)) {
    return setError(input, 'Enter an email with a valid extension, such as .com or .net.');
  }

  if (input.id === 'password' && input.value.length < 8) {
    return setError(input, 'Password must be at least 8 characters.');
  }

  return setError(input, '');
}

const liveInputs = [
  document.getElementById('firstName'),
  document.getElementById('lastName'),
  document.getElementById('email'),
  roleSelect,
  aidProviderSelect,
  aidProviderTeamSelect,
  aidProviderNameInput,
  document.getElementById('password')
];

liveInputs.forEach((input) => {
  input.addEventListener('blur', () => validateInput(input));
  input.addEventListener('input', () => validateInput(input));
  input.addEventListener('change', () => validateInput(input));
});

async function loadAidProviders() {
  aidProviderSelect.replaceChildren(new Option('Loading aid providers...', ''));
  aidProviderSelect.disabled = true;

  try {
    const response = await fetch('/api/aidProviders');
    if (!response.ok) throw new Error('Unable to load aid providers.');

    const providers = await response.json();
    aidProviderSelect.replaceChildren(new Option('Select aid provider', ''));

    providers.forEach((provider) => {
      aidProviderSelect.add(new Option(formatDisplayName(provider.name), provider.id));
    });

    providersLoaded = true;
    aidProviderSelect.disabled = providers.length === 0;

    if (!providers.length) {
      aidProviderSelect.replaceChildren(new Option('No active aid providers found', ''));
    }
  } catch (error) {
    console.error(error);
    aidProviderSelect.replaceChildren(new Option('Unable to load aid providers', ''));
    aidProviderSelect.disabled = true;
  }
}

async function loadAidProviderTeams(providerId) {
  aidProviderTeamSelect.replaceChildren(new Option('Loading teams...', ''));
  aidProviderTeamSelect.disabled = true;

  try {
    const response = await fetch(`/api/aidProviders/${providerId}/teams`);
    if (!response.ok) throw new Error('Unable to load aid provider teams.');

    const teams = await response.json();
    aidProviderTeamSelect.replaceChildren(new Option('Select team', ''));
    teams.forEach((team) => {
      aidProviderTeamSelect.add(new Option(team.name, team.id));
    });
    aidProviderTeamSelect.disabled = teams.length === 0;

    if (!teams.length) {
      aidProviderTeamSelect.replaceChildren(new Option('No active teams found', ''));
    }
  } catch (error) {
    console.error(error);
    aidProviderTeamSelect.replaceChildren(new Option('Unable to load teams', ''));
    aidProviderTeamSelect.disabled = true;
  }
}

function updateAidProviderField() {
  const needsProvider = roleSelect.value === 'AID_PROVIDER_TEAM_MEMBER';
  const needsTeam = roleSelect.value === 'AID_PROVIDER_TEAM_MEMBER';
  const needsProviderName = roleSelect.value === 'AID_PROVIDER';
  const needsPersonName = roleSelect.value !== 'AID_PROVIDER';
  aidProviderField.hidden = !needsProvider;
  aidProviderSelect.required = needsProvider;
  aidProviderTeamField.hidden = !needsTeam;
  aidProviderTeamSelect.required = needsTeam;
  aidProviderNameField.hidden = !needsProviderName;
  aidProviderNameInput.required = needsProviderName;
  aidProviderDescriptionField.hidden = !needsProviderName;
  firstNameInput.required = needsPersonName;
  lastNameInput.required = needsPersonName;
  firstNameField.hidden = !needsPersonName;
  lastNameField.hidden = !needsPersonName;

  if (needsProvider && !providersLoaded) {
    loadAidProviders();
  }

  if (needsTeam && aidProviderSelect.value) {
    loadAidProviderTeams(aidProviderSelect.value);
  }

  if (!needsProvider) {
    aidProviderSelect.value = '';
  }

  if (!needsProviderName) {
    aidProviderNameInput.value = '';
    aidProviderDescriptionInput.value = '';
  }

  if (!needsTeam) {
    aidProviderTeamSelect.value = '';
    aidProviderTeamSelect.replaceChildren(new Option('Select team', ''));
    aidProviderTeamSelect.disabled = true;
  }
}

roleSelect.addEventListener('change', updateAidProviderField);
aidProviderSelect.addEventListener('change', () => {
  aidProviderTeamSelect.value = '';
  if (roleSelect.value === 'AID_PROVIDER_TEAM_MEMBER' && aidProviderSelect.value) {
    loadAidProviderTeams(aidProviderSelect.value);
  }
});
updateAidProviderField();

form.addEventListener('submit', (event) => {
  event.preventDefault();

  let isValid = true;
  const providerRole = roleSelect.value === 'AID_PROVIDER_TEAM_MEMBER';
  const teamMemberRole = roleSelect.value === 'AID_PROVIDER_TEAM_MEMBER';
  const providerAccountRole = roleSelect.value === 'AID_PROVIDER';
  const personNameRole = !providerAccountRole;
  liveInputs
    .filter((input) => (input !== aidProviderSelect || providerRole)
      && (input !== aidProviderTeamSelect || teamMemberRole)
      && (input !== aidProviderNameInput || providerAccountRole)
      && (input.id !== 'firstName' && input.id !== 'lastName' || personNameRole))
    .forEach((input) => {
      if (!validateInput(input)) isValid = false;
    });

  if (!isValid) return;

  const data = new FormData(form);
  const role = data.get('role');

  submitButton.disabled = true;
  submitButton.textContent = 'Provisioning...';

  const endpoint = providerAccountRole
    ? '/api/aidProviders/accounts'
    : teamMemberRole
      ? '/api/aidProviders/teamMembers'
      : '/api/users/createUser';
  const payload = providerAccountRole
    ? {
      email: data.get('email').trim().toLowerCase(),
      password: data.get('password'),
      aid_provider_name: data.get('aidProviderName').trim(),
      aid_provider_description: data.get('aidProviderDescription').trim() || null
    }
    : teamMemberRole
      ? {
        first_name: data.get('firstName').trim().toLowerCase(),
        last_name: data.get('lastName').trim().toLowerCase(),
        email: data.get('email').trim().toLowerCase(),
        password: data.get('password'),
        aid_provider_id: data.get('aidProvider'),
        aid_provider_team_id: data.get('aidProviderTeam')
      }
      : {
      first_name: data.get('firstName').trim().toLowerCase(),
      last_name: data.get('lastName').trim().toLowerCase(),
      email: data.get('email').trim().toLowerCase(),
      password: data.get('password'),
      role,
      };

  fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(async (response) => {
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(Array.isArray(error.detail)
          ? error.detail.map((item) => item.msg).join(' ')
          : error.detail || 'Unable to provision this account.');
      }
      return response.json();
    })
    .then(() => {
      const displayName = providerAccountRole
        ? formatDisplayName(data.get('aidProviderName'))
        : `${formatDisplayName(data.get('firstName'))} ${formatDisplayName(data.get('lastName'))}`.trim();
      document.getElementById('successMessage').textContent =
        providerAccountRole
          ? `Aid provider ${displayName} was created successfully.`
          : `User ${displayName} was created successfully.`;
      form.reset();
      updateAidProviderField();
      successBackdrop.hidden = false;
      successDialog.showModal();
    })
    .catch((error) => {
      const isDuplicateProviderName = providerAccountRole
        && error.message.toLowerCase().includes('aid provider with that name');
      setError(
        isDuplicateProviderName ? aidProviderNameInput : document.getElementById('email'),
        error.message,
      );
    })
    .finally(() => {
      submitButton.disabled = false;
    submitButton.textContent = 'Provide application access';
    });
});
