(function() {
  // ==================================================
  // Email extension validation
  // Ensures addresses use a recognized top-level domain.
  // ==================================================
  var validExtensions = [
    'com', 'net', 'org', 'edu', 'gov', 'mil', 'int', 'info', 'biz', 'name', 'pro',
    'io', 'co', 'ai', 'app', 'dev', 'me', 'xyz', 'online', 'site', 'tech', 'cloud',
    'store', 'blog', 'club', 'live', 'news', 'travel', 'museum', 'jobs', 'mobi', 'tv',
    'us', 'uk', 'ca', 'au', 'nz', 'ie', 'de', 'fr', 'es', 'it', 'nl', 'be', 'ch', 'at',
    'se', 'no', 'dk', 'fi', 'pl', 'pt', 'gr', 'cz', 'hu', 'ro', 'ru', 'ua', 'in', 'jp',
    'cn', 'kr', 'sg', 'hk', 'tw', 'id', 'my', 'ph', 'th', 'vn', 'br', 'mx', 'ar', 'cl',
    'za', 'ae', 'sa', 'il', 'tr'
  ];

  window.hasValidEmailExtension = function(email) {
    var match = email.trim().match(/\.([a-zA-Z]{2,})$/);
    return Boolean(match && validExtensions.indexOf(match[1].toLowerCase()) !== -1);
  };

  // ==================================================
  // Password visibility toggle
  // Shows or hides password characters when the eye button is clicked.
  // ==================================================
  var toggles = document.querySelectorAll('.password-toggle');

  Array.prototype.forEach.call(toggles, function(toggle) {
    var input = document.getElementById(toggle.dataset.passwordTarget);

    toggle.addEventListener('click', function() {
      var isVisible = input.type === 'text';
      input.type = isVisible ? 'password' : 'text';
      toggle.setAttribute('aria-pressed', String(!isVisible));
      toggle.setAttribute('aria-label', isVisible ? 'Show password' : 'Hide password');
    });
  });
})();
