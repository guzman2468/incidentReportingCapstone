(function () {
  const state = {
    incidents: new Map(),
    notifications: loadNotifications(),
    receivedEventIds: new Set(),
  };

  function getStorageKey() {
    return `incidentNotifications:${window.location.pathname}`;
  }

  function loadNotifications() {
    try {
      const savedNotifications = JSON.parse(
        localStorage.getItem(getStorageKey()) || "[]",
      );
      return Array.isArray(savedNotifications) ? savedNotifications : [];
    } catch (error) {
      console.warn("Unable to load incident notifications.", error);
      return [];
    }
  }

  function saveNotifications() {
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(state.notifications));
    } catch (error) {
      console.warn("Unable to save incident notifications.", error);
    }
  }

  function getElement(id) {
    return document.getElementById(id);
  }

  function render() {
    const button = getElement("notificationButton");
    const count = getElement("notificationCount");
    const list = getElement("notificationList");
    const emptyState = getElement("notificationEmpty");
    if (!button || !count || !list || !emptyState) return;

    const unreadCount = state.notifications.length;
    count.textContent = unreadCount;
    count.hidden = unreadCount === 0;
    button.setAttribute(
      "aria-label",
      unreadCount
        ? `${unreadCount} unread incident notifications`
        : "Open incident notifications",
    );

    emptyState.hidden = unreadCount !== 0;
    list.innerHTML = state.notifications
      .map(
        (notification) => `
          <div class="notification-item" role="button" tabindex="0" data-notification-id="${notification.id}" data-incident-reference="${escapeHTML(notification.incidentReference)}">
            <strong>${escapeHTML(notification.title)}</strong>
            <span>${escapeHTML(notification.incidentReference)} · ${escapeHTML(notification.message)}</span>
            <button type="button" class="notification-remove" data-notification-id="${notification.id}" aria-label="Remove notification">×</button>
          </div>
        `,
      )
      .join("");
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    );
  }

  function getIncidentMessage(event, incident) {
    const eventData = event.event_data || {};
    const updatedFields = [];
    const status = eventData.new_status || eventData.status;

    if (eventData.severity_updated) updatedFields.push("SEVERITY");
    if (eventData.description_updated) updatedFields.push("DESCRIPTION");

    if (updatedFields.length === 1) {
      return `had a ${updatedFields[0]} update`;
    }

    if (updatedFields.length > 1) {
      return `had ${updatedFields.join(" and ")} updates`;
    }

    if (status) {
      return `has been given the ${status} status`;
    }

    return "has received an update";
  }

  function recordEvent(event) {
    if (!event?.event_id || state.receivedEventIds.has(event.event_id)) return;

    state.receivedEventIds.add(event.event_id);
    const incident = state.incidents.get(event.incident_reference);
    const notification = {
      id: event.event_id,
      title: incident?.title || "Incident update",
      message: getIncidentMessage(event, incident),
      incidentReference:
        event.incident_reference || incident?.incident_reference || "",
    };

    state.notifications.unshift(notification);
    saveNotifications();
    render();
  }

  function setIncidents(incidents) {
    state.incidents = new Map(
      incidents.map((incident) => [incident.incident_reference, incident]),
    );
  }

  function closeDropdown() {
    const dropdown = getElement("notificationDropdown");
    const button = getElement("notificationButton");
    if (!dropdown || !button) return;
    dropdown.hidden = true;
    button.setAttribute("aria-expanded", "false");
  }

  function openIncident(incidentReference) {
    const encodedReference = encodeURIComponent(incidentReference || "");
    const pagePath = window.location.pathname;

    if (pagePath.includes("/reporter/")) {
      window.location.href = `repIncidentOverview.html?reference=${encodedReference}`;
      return;
    }

    if (pagePath.includes("/assigner/")) {
      window.location.href = `assignIncidentOverview.html?id=${encodedReference}`;
      return;
    }

    if (pagePath.includes("/admin/")) {
      window.location.href = `adminIncidentOverview.html?id=${encodedReference}`;
      return;
    }

    window.location.href = `aptmOverview.html?reference=${encodedReference}`;
  }

  function connect() {
    const button = getElement("notificationButton");
    const dropdown = getElement("notificationDropdown");
    const list = getElement("notificationList");
    if (!button || !dropdown || !list) return;

    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = !dropdown.hidden;
      dropdown.hidden = isOpen;
      button.setAttribute("aria-expanded", String(!isOpen));
    });

    list.addEventListener("click", (event) => {
      const removeButton = event.target.closest(".notification-remove");
      if (removeButton) {
        event.stopPropagation();
        state.notifications = state.notifications.filter(
          (notification) => notification.id !== removeButton.dataset.notificationId,
        );
        saveNotifications();
        render();
        return;
      }

      const item = event.target.closest(".notification-item");
      if (!item) return;
      openIncident(item.dataset.incidentReference);
    });

    list.addEventListener("keydown", (event) => {
      const item = event.target.closest(".notification-item");
      if (!item || event.target.closest(".notification-remove")) return;
      if (event.key !== "Enter" && event.key !== " ") return;

      event.preventDefault();
      openIncident(item.dataset.incidentReference);
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".notification-menu")) closeDropdown();
    });
  }

  window.notificationBell = {
    recordEvent,
    setIncidents,
  };

  connect();
  render();
})();
