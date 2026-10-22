(function() {
  var form = document.getElementById('signupForm');
  var submitBtn = form.querySelector('button[type="submit"]');
  var requiredInputs = form.querySelectorAll('input[required]');
  var successMessage = document.getElementById('signupSuccess');

  function setError(input, message) {
    var error = document.getElementById(input.id + 'Error');
    input.classList.toggle('input-error', Boolean(message));
    error.textContent = message || '';
    return !message;
  }

  function validateInput(input) {
    var label = form.querySelector('label[for="' + input.id + '"]');
    var fieldName = label ? label.textContent.trim() : input.name;

    if (!input.value.trim()) return setError(input, input.id === 'confirmPassword' ? 'Please confirm your password.' : fieldName + ' is required.');
    if (input.id === 'email' && !input.validity.valid) return setError(input, 'Enter an email in the format name@domain.extension.');
    if (input.id === 'email' && !window.hasValidEmailExtension(input.value)) return setError(input, 'Enter an email with a valid extension, such as .com or .net.');
    if (input.id === 'password' && input.value.length < 8) return setError(input, 'Password must be at least 8 characters.');
    if (input.id === 'confirmPassword' && input.value !== form.password.value) return setError(input, 'Passwords do not match.');
    return setError(input, '');
  }

  Array.prototype.forEach.call(requiredInputs, function(input) {
    input.addEventListener('blur', function() { validateInput(input); });
    input.addEventListener('input', function() { validateInput(input); });
  });

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    var isValid = true;
    Array.prototype.forEach.call(requiredInputs, function(input) {
      if (!validateInput(input)) isValid = false;
    });
    if (!isValid) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating...';

    try {
      var createResponse = await fetch('/api/users/createUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: form.firstName.value.trim().toLowerCase(),
          last_name: form.lastName.value.trim().toLowerCase(),
          email: form.email.value.trim().toLowerCase(),
          password: form.password.value,
          role: 'REPORTER'
        })
      });
      if (!createResponse.ok) throw createResponse;
      await createResponse.json();

      var loginResponse = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.value.trim().toLowerCase(),
          password: form.password.value
        })
      });
      if (!loginResponse.ok) throw loginResponse;
      await loginResponse.json();

      successMessage.textContent = 'Account created! Logging you in...';
      setTimeout(function() {
        window.location.href = 'reporter/repDashboard.html';
      }, 700);
    } catch (err) {
      var message = 'Unable to create your account right now. Please try again.';
      if (err && typeof err.json === 'function') {
        try {
          var json = await err.json();
          if (Array.isArray(json.detail)) {
            message = json.detail.map(function(error) {
              return error.msg || 'Please check this field.';
            }).join(' ');
          } else {
            message = json.detail || message;
          }
        } catch {
          // The response body is optional; use a safe generic message when it is malformed.
          message = 'The server returned an unreadable error. Please try again.';
        }
      }
      setError(form.email, message);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create account';
    }
  });
})();
