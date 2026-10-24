(function() {
  var form = document.getElementById('changePasswordForm');
  var currentPass = document.getElementById('currentPassword');
  var newPass = document.getElementById('newPassword');
  var confirmPass = document.getElementById('confirmPassword');
  var requiredInputs = form.querySelectorAll('input[required]');
  var successMessage = document.getElementById('changePasswordSuccess');
  var cancelButton = document.getElementById('cancelPasswordChangeButton');
  var userMenu = document.querySelector('.auth-topbar-user .user-menu');
  var userButton = document.getElementById('userButton');
  var userDropdown = document.getElementById('userDropdown');
  var errorMessages = {
    currentPassword: document.getElementById('currentPasswordError'),
    newPassword: document.getElementById('newPasswordError'),
    confirmPassword: document.getElementById('confirmPasswordError')
  };
  var mustChangePassword = false;

  userButton.addEventListener('click', function() {
    var isOpen = userDropdown.classList.toggle('open');
    userButton.setAttribute('aria-expanded', String(isOpen));
    userDropdown.setAttribute('aria-hidden', String(!isOpen));
  });

  document.addEventListener('click', function(event) {
    if (!event.target.closest('.user-menu')) {
      userDropdown.classList.remove('open');
      userButton.setAttribute('aria-expanded', 'false');
      userDropdown.setAttribute('aria-hidden', 'true');
    }
  });

  fetch('/api/users/currentUser')
    .then(function(response) {
      if (!response.ok) throw response;
      return response.json();
    })
    .then(function(user) {
      mustChangePassword = user.must_change_password;
      if (!mustChangePassword) {
        userMenu.hidden = false;
        cancelButton.hidden = false;
        cancelButton.addEventListener('click', function() {
          window.history.back();
        });
      }
    })
    .catch(function() {
      window.location.href = '/login';
    });

  function error(input, message) {
    input.classList.toggle('input-error', Boolean(message));
    var errorMessage = errorMessages[input.id];
    if (errorMessage) {
      errorMessage.textContent = message || '';
    }
    return !message;
  }

  function validateInput(input) {
    if (!input.value.trim()) {
      if (input === currentPass) {
        return error(input, 'Old password is required.');
      }
      else if (input === newPass) {
        return error(input, 'New password is required.');
      } else {
        return error(input, 'Please confirm your new password.');
      }
    }
    if (input === newPass && input.value.length < 8) {
      return error(input, 'Password must be at least 8 characters.');
    }
    if (input === confirmPass && input.value !== newPass.value) {
      return error(input, 'Passwords do not match.');
    }
    return error(input, '');
  }

  Array.prototype.forEach.call(requiredInputs, function(input) {
    input.addEventListener('blur', function() { validateInput(input); });
    input.addEventListener('input', function() { validateInput(input); });
  });

  form.addEventListener('submit', async function(event) {
    event.preventDefault();
    var valid = true;
    Array.prototype.forEach.call(requiredInputs, function(input) {
      if (!validateInput(input)) valid = false;
    });

    if (!valid) return;

    var button = form.querySelector('button');
    button.disabled = true;
    try {
      var response = await fetch('/api/users/changePassword', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: currentPass.value, new_password: newPass.value })
      });
      var data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Unable to change password.');

      if (mustChangePassword) {
        window.location.href = '/';
      } else {
        form.reset();
        Array.prototype.forEach.call(requiredInputs, function(input) {
          error(input, '');
        });
        successMessage.textContent = 'Password changed successfully.';
        button.disabled = false;
      }
    } catch (requestError) {
      error(currentPass, requestError.message);
      button.disabled = false;
    }
  });
})();
