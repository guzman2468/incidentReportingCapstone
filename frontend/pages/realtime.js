(function () {
  window.renderIncidentNotes = function (notes = []) {
    window.currentIncidentNotes = notes;
    const notesList = document.getElementById("notesList");
    if (!notesList) return;

    notesList.replaceChildren();
    if (!notes.length) {
      const emptyMessage = document.createElement("p");
      emptyMessage.className = "notes-empty";
      emptyMessage.textContent = "No notes have been added to this incident.";
      notesList.appendChild(emptyMessage);
      return;
    }

    notes.forEach((incidentNote) => {
      const note = document.createElement("div");
      const isCurrentUser =
        window.currentUser?.id &&
        String(window.currentUser.id) === String(incidentNote.author_id);
      note.className = `note-item ${isCurrentUser ? "own" : "other"}`;
      const author = document.createElement("strong");
      const formattedAuthorName = String(incidentNote.author_name || "User")
        .trim()
        .toLowerCase()
        .replace(/(^|[\s'-])\w/g, (character) => character.toUpperCase());
      const roleLabel = {
        REPORTER: "REPORTER",
        ASSIGNER: "ASSINGER",
        AID_PROVIDER_TEAM_MEMBER: "APTM",
        ADMIN: "ADMIN",
      }[incidentNote.author_role] || incidentNote.author_role || "USER";
      author.textContent = `${formattedAuthorName} (${roleLabel})`;
      const timestamp = document.createElement("small");
      timestamp.textContent = new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
        hourCycle: "h12",
      }).format(new Date(incidentNote.created_at));
      author.appendChild(document.createTextNode(" "));
      author.appendChild(timestamp);
      const message = document.createElement("p");
      message.textContent = incidentNote.note;
      note.append(author, message);
      notesList.appendChild(note);
    });
  };

  window.refreshIncidentNotes = async function (incidentReference) {
    const response = await fetch(
      `/api/incidents/reference/${encodeURIComponent(incidentReference)}/notes`,
      { cache: "no-store" },
    );
    if (!response.ok) throw new Error("Unable to refresh incident notes.");

    const notes = await response.json();
    window.renderIncidentNotes(notes);
    const notesList = document.getElementById("notesList");
    notesList?.scrollTo({
      top: notesList.scrollHeight,
      behavior: "smooth",
    });
  };

  window.addEventListener("current-user-loaded", () => {
    window.renderIncidentNotes(window.currentIncidentNotes || []);
  });

  document.addEventListener("click", async (event) => {
    const addNoteButton = event.target.closest("#addNoteButton");
    if (!addNoteButton) return;

    const noteInput = document.getElementById("noteInput");
    const note = noteInput?.value.trim();
    const noteInputError = document.getElementById("noteInputError");
    if (!note) {
      noteInput?.classList.add("input-error");
      if (noteInputError) noteInputError.textContent = "Note must not be empty";
      noteInput?.focus();
      return;
    }

    noteInput?.classList.remove("input-error");
    if (noteInputError) noteInputError.textContent = "";

    event.preventDefault();
    event.stopImmediatePropagation();
    addNoteButton.disabled = true;
    const params = new URLSearchParams(window.location.search);
    const incidentReference = params.get("reference") || params.get("id");

    try {
      const response = await fetch(
        `/api/incidents/reference/${encodeURIComponent(incidentReference)}/notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note }),
        },
      );
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.detail || "Unable to add note.");
      }
      noteInput.value = "";
      addNoteButton.disabled = false;
    } catch (error) {
      console.error("Unable to add incident note.", error);
      addNoteButton.disabled = false;
      window.alert(error.message);
    }
  }, true);

  document.addEventListener("input", (event) => {
    if (!event.target.matches("#noteInput")) return;
    const noteInputError = document.getElementById("noteInputError");
    const hasNote = Boolean(event.target.value.trim());
    event.target.classList.toggle("input-error", !hasNote && Boolean(noteInputError?.textContent));
    if (hasNote && noteInputError) noteInputError.textContent = "";
  });

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
