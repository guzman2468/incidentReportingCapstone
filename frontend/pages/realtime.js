(function () {
  const reconnectDelays = [1000, 2000, 5000, 10000, 30000];

  // Pages provide callbacks that decide how their own incident data is refreshed.
  window.connectIncidentRealtime = function ({
    onEvent,
    onReconnect,
  } = {}) {
    let socket = null;
    let reconnectTimer = null;
    let reconnectAttempt = 0;
    let isPageActive = true;
    const receivedEventIds = new Set();

    // Reopen the WebSocket after a connection failure using increasing delays.
    const scheduleReconnect = () => {
      if (!isPageActive || reconnectTimer !== null) return;

      const delayIndex = Math.min(
        reconnectAttempt,
        reconnectDelays.length - 1,
      );
      const reconnectDelay = reconnectDelays[delayIndex];
      reconnectAttempt += 1;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        openConnection();
      }, reconnectDelay);
    };

    // The browser connects to FastAPI's WebSocket endpoint, not directly to Kafka.
    const openConnection = () => {
      if (!isPageActive) return;

      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(
        `${protocol}://${window.location.host}/api/realtime/incidents`,
      );

      socket.addEventListener("open", () => {
        const reconnected = reconnectAttempt > 0;
        reconnectAttempt = 0;

        // Load current data when the connection opens or is restored.
        if (reconnected && typeof onReconnect === "function") {
          Promise.resolve(onReconnect()).catch((error) => {
            console.error("Unable to recover real-time incident data.", error);
          });
        } else if (typeof onReconnect === "function") {
          Promise.resolve(onReconnect()).catch((error) => {
            console.error("Unable to synchronize real-time incident data.", error);
          });
        }
      });

      // FastAPI sends an authorized incident event through this WebSocket.
      socket.addEventListener("message", (messageEvent) => {
        let event;

        try {
          // WebSocket messages arrive as JSON text, so convert them to an object.
          event = JSON.parse(messageEvent.data);
        } catch (error) {
          console.error("Ignoring invalid incident WebSocket message.", error);
          return;
        }

        // Prevent the same event from causing multiple UI refreshes.
        if (!event.event_id || receivedEventIds.has(event.event_id)) return;
        receivedEventIds.add(event.event_id);

        // The page supplies this callback, such as loadAssignerIncidents or
        // displayIncident. The callback reloads authoritative data from the API.
        if (typeof onEvent === "function") {
          Promise.resolve(onEvent(event)).catch((error) => {
            console.error("Unable to refresh real-time incident data.", error);
          });
        }
      });

      // Close failed connections so the close handler can schedule a reconnect.
      socket.addEventListener("error", () => {
        socket.close();
      });

      // A closed connection is automatically reopened unless the page is closing.
      socket.addEventListener("close", () => {
        socket = null;
        scheduleReconnect();
      });
    };

    const closeConnection = () => {
      isPageActive = false;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (socket) socket.close();
    };

    // Stop reconnecting when the user leaves the page.
    window.addEventListener("pagehide", closeConnection, { once: true });
    openConnection();

    return closeConnection;
  };
})();
