(function() {
  var form = document.getElementById('loginForm');
  var submitBtn = form.querySelector('button[type="submit"]');
  var email = form.email;
  var password = form.password;

  function setError(input, message) {
    var error = document.getElementById(input.id + 'Error');
    input.classList.toggle('input-error', Boolean(message));
    error.textContent = message || '';
    return !message;
  }

  function validateEmail() {
    if (!email.value.trim()) return setError(email, 'Email is required.');
    if (!email.validity.valid) return setError(email, 'Enter an email in the format name@domain.extension.');
    if (!window.hasValidEmailExtension(email.value)) return setError(email, 'Enter an email with a valid extension, such as .com or .net.');
    return setError(email, '');
  }

  function validatePassword() {
    return setError(password, password.value ? '' : 'Password is required.');
  }

  function showLoginError(message, originalText) {
    setError(password, message || 'Unable to sign in with these credentials.');
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }

  async function handleLoginError(err, originalText) {
    if (err && typeof err.json === 'function') {
      try {
        var json = await err.json();
        showLoginError(json.detail || json.message, originalText);
      } catch {
        showLoginError('Unable to sign in right now. Please try again.', originalText);
      }
    } else {
      showLoginError('Unable to sign in right now. Please try again.', originalText);
    }
  }

  email.addEventListener('blur', validateEmail);
  email.addEventListener('input', validateEmail);
  password.addEventListener('blur', validatePassword);
  password.addEventListener('input', validatePassword);

  form.addEventListener('submit', function(e) {
    e.preventDefault();

    var emailIsValid = validateEmail();
    var passwordIsValid = validatePassword();
    if (!emailIsValid || !passwordIsValid) return;

    submitBtn.disabled = true;
    var originalText = submitBtn.textContent;
    submitBtn.textContent = 'Signing in...';

    var payload = {
      email: form.email.value.trim().toLowerCase(),
      password: form.password.value
    };

    fetch('/api/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function(res) {
        if (!res.ok) throw res;
        return res.json();
      })
      .then(function(data) {
        if (data?.success) {
          window.location.href = 'reporter/repDashboard.html';
        } else {
          showLoginError(data.message, originalText);
        }
      })
      .catch(function(err) {
        return handleLoginError(err, originalText);
      });
  });
})();
