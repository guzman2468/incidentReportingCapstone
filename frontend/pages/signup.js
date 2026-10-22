(function() {
  var form = document.getElementById('signupForm');
  var submitBtn = form.querySelector('button[type="submit"]');
  var requiredInputs = form.querySelectorAll('input[required]');

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
    if (input.id === 'confirmPassword' && input.value !== form.password.value) return setError(input, 'Passwords do not match.');
    return setError(input, '');
  }

  Array.prototype.forEach.call(requiredInputs, function(input) {
    input.addEventListener('blur', function() { validateInput(input); });
    input.addEventListener('input', function() { validateInput(input); });
  });

  form.addEventListener('submit', function(e) {
    e.preventDefault();

    var isValid = true;
    Array.prototype.forEach.call(requiredInputs, function(input) {
      if (!validateInput(input)) isValid = false;
    });
    if (!isValid) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating...';

    setTimeout(function() {
      alert('Account created successfully. You can now sign in.');
      window.location.href = 'login.html';
    }, 900);
  });
})();
