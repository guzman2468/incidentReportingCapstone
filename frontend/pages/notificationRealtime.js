(function () {
  if (
    typeof window.connectIncidentRealtime !== "function" ||
    !window.notificationBell
  ) {
    return;
  }

  window.connectIncidentRealtime({
    onEvent: (event) => window.notificationBell.recordEvent(event),
  });
})();
