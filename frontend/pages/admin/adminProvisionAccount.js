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

const form = document.getElementById('provisionForm');
const createButton = document.getElementById('createButton');
const formMessage = document.getElementById('formMessage');
const requiredFields = form.querySelectorAll('[required]');

function setError(field, message) {
  const error = document.getElementById(field.id + 'Error');
  field.classList.toggle('input-error', Boolean(message));
  error.textContent = message || '';
  return !message;
}

function showMessage(type, message) {
  formMessage.className = 'form-message ' + type;
  formMessage.textContent = message;
}

// Check one field against the same rules the signup page and backend use.
function validateField(field) {
  const label = form.querySelector('label[for="' + field.id + '"]').textContent.trim();
  const value = field.value.trim();

  if (field.id === 'role' && !value) return setError(field, 'Please select a role.');
  if (!value) return setError(field, field.id === 'confirmPassword' ? 'Please confirm the password.' : label + ' is required.');
  if (field.id === 'email' && !field.validity.valid) return setError(field, 'Enter an email in the format name@domain.extension.');
  if (field.id === 'email' && !window.hasValidEmailExtension(value)) return setError(field, 'Enter an email with a valid extension, such as .com or .net.');
  if (field.id === 'password' && field.value.length < 8) return setError(field, 'Password must be at least 8 characters.');
  if (field.id === 'confirmPassword' && field.value !== form.password.value) return setError(field, 'Passwords do not match.');
  return setError(field, '');
}

requiredFields.forEach((field) => {
  field.addEventListener('blur', () => validateField(field));
  field.addEventListener(field.tagName === 'SELECT' ? 'change' : 'input', () => validateField(field));
});

// Pull a readable message out of a FastAPI error response.
async function getErrorMessage(response) {
  try {
    const json = await response.json();
    if (Array.isArray(json.detail)) {
      return json.detail.map((error) => error.msg || 'Please check this field.').join(' ');
    }
    return json.detail || 'Unable to create the account. Please try again.';
  } catch {
    return 'The server returned an unreadable error. Please try again.';
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  formMessage.textContent = '';

  let isValid = true;
  requiredFields.forEach((field) => {
    if (!validateField(field)) isValid = false;
  });
  if (!isValid) return;

  createButton.disabled = true;
  createButton.textContent = 'Creating...';

  try {
    const response = await fetch('/api/users/createUser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: form.firstName.value.trim().toLowerCase(),
        last_name: form.lastName.value.trim().toLowerCase(),
        email: form.email.value.trim().toLowerCase(),
        password: form.password.value,
        role: form.role.value
      })
    });

    if (!response.ok) {
      const message = await getErrorMessage(response);
      if (response.status === 409) setError(form.email, message);
      else showMessage('error', message);
      return;
    }

    const created = await response.json();
    form.reset();
    showMessage('success', 'Account created for ' + created.email + '.');
  } catch (error) {
    console.error('Account creation failed.', error);
    showMessage('error', 'Unable to reach the server. Please try again.');
  } finally {
    createButton.disabled = false;
    createButton.innerHTML = '<span>+</span> Create account';
  }
});
