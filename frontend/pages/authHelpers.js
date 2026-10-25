(function() {
  var appHeader = document.querySelector('header');
  var hasExistingBrand = appHeader?.querySelector('.auth-brand');

  if (appHeader && !hasExistingBrand) {
    var applicationTitle = document.createElement('div');
    applicationTitle.className = 'application-title';
    applicationTitle.textContent = 'Incident Management Application';
    appHeader.classList.add('application-header');
    appHeader.appendChild(applicationTitle);
  }

  // ==================================================
  // Email extension validation
  // Ensures addresses use a recognized top-level domain.
  // ==================================================
  var validExtensions = new Set([
    'com', 'net', 'org', 'edu', 'gov', 'mil', 'int', 'info', 'biz', 'name', 'pro',
    'io', 'co', 'ai', 'app', 'dev', 'me', 'xyz', 'online', 'site', 'tech', 'cloud',
    'store', 'blog', 'club', 'live', 'news', 'travel', 'museum', 'jobs', 'mobi', 'tv',
    'us', 'uk', 'ca', 'au', 'nz', 'ie', 'de', 'fr', 'es', 'it', 'nl', 'be', 'ch', 'at',
    'se', 'no', 'dk', 'fi', 'pl', 'pt', 'gr', 'cz', 'hu', 'ro', 'ru', 'ua', 'in', 'jp',
    'cn', 'kr', 'sg', 'hk', 'tw', 'id', 'my', 'ph', 'th', 'vn', 'br', 'mx', 'ar', 'cl',
    'za', 'ae', 'sa', 'il', 'tr'
  ]);

  window.hasValidEmailExtension = function(email) {
    var match = email.trim().match(/\.([a-zA-Z]{2,})$/);
    return Boolean(match && validExtensions.has(match[1].toLowerCase()));
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
      toggle.classList.toggle('is-visible', !isVisible);
      toggle.setAttribute('aria-pressed', String(!isVisible));
      toggle.setAttribute('aria-label', isVisible ? 'Show password' : 'Hide password');
    });
  });

  // ==================================================
  // Authenticated user display
  // Loads the current user for role-specific pages and updates shared UI.
  // ==================================================
  function formatRole(role) {
    return role
      .toLowerCase()
      .replaceAll('_', ' ')
      .replace(/\b\w/g, function(letter) { return letter.toUpperCase(); });
  }

  function getInitials(firstName, lastName) {
    return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
  }

  function formatName(name) {
    return name
      .trim()
      .toLowerCase()
      .replace(/(^|[\s'-])\w/g, function(letter) {
        return letter.toUpperCase();
      });
  }

  function getRoleWorkspace(role) {
    return {
      REPORTER: '/reporter/',
      ASSIGNER: '/assigner/',
      AID_PROVIDER_TEAM_MEMBER: '/aptm/',
      ADMIN: '/admin/'
    }[role];
  }

  if (document.getElementById('userButton')) {
    fetch('/api/users/currentUser')
      .then(function(response) {
        if (!response.ok) throw response;
        return response.json();
      })
      .then(function(user) {
        var workspace = getRoleWorkspace(user.role);
        var isPasswordChangePage = window.location.pathname === '/changePassword.html';
        if (workspace && !isPasswordChangePage && !window.location.pathname.startsWith(workspace)) {
          window.location.replace(workspace + {
            '/reporter/': 'repDashboard.html',
            '/assigner/': 'assignDashboard.html',
            '/aptm/': 'aptmDashboard.html',
            '/admin/': 'adminDashboard.html'
          }[workspace]);
          return;
        }

        var firstName = formatName(user.first_name);
        var lastName = formatName(user.last_name);
        var fullName = firstName + ' ' + lastName;
        var initials = getInitials(firstName, lastName);
        var role = user.role ? formatRole(user.role) : 'User';
        window.currentUser = user;
        window.currentUserDisplayName = fullName;
        var userButton = document.getElementById('userButton');

        userButton.textContent = initials;
        userButton.setAttribute('aria-label', 'Open user menu for ' + fullName);

        document.querySelectorAll('.user-summary strong').forEach(function(element) {
          element.textContent = fullName;
        });

        document.querySelectorAll('[data-user-name]').forEach(function(element) {
          var timestamp = element.querySelector('small');
          if (timestamp) {
            timestamp.insertAdjacentText('beforebegin', fullName + ' ');
          } else {
            element.textContent = fullName;
          }
        });

        document.querySelectorAll('[data-user-first-name]').forEach(function(element) {
          element.textContent = firstName;
        });

        document.querySelectorAll('[data-user-initials]').forEach(function(element) {
          element.textContent = initials;
        });

        document.querySelectorAll('.user-summary span, .role-label').forEach(function(element) {
          element.textContent = role;
        });
      })
      .catch(function() {
        window.location.href = '/login';
      });
  }

  document.addEventListener('click', function(event) {
    var changePasswordButton = event.target.closest('#changePasswordButton');
    if (changePasswordButton) {
      window.location.href = '/changePassword.html';
    }
  });

  window.logoutUser = async function() {
    var toast = document.createElement('div');
    toast.textContent = 'Logging out...';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #18343a;
      color: #fff;
      border-radius: 8px;
      padding: 12px 17px;
      font: 12px DM Sans, sans-serif;
      z-index: 2001;
    `;
    document.body.appendChild(toast);

    try {
      var response = await fetch('/api/users/logout', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Logout request failed.');
      }
      else {
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Logout request failed.', error);
      toast.textContent = 'Unable to log out. Please try again.';
      setTimeout(function() { toast.remove(); }, 2600);
    }
  };
})();
