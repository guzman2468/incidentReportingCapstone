"""Authenticated WebSocket connection management for real-time updates."""

import asyncio
import logging
from dataclasses import dataclass
from collections.abc import Mapping
from uuid import UUID

from fastapi import WebSocket
from sqlalchemy import text

from backend.database import SessionLocal
from backend.kafka.incident_event_consumer import IncidentEventRouter


logger = logging.getLogger(__name__)


GET_INCIDENT_STAKEHOLDER_IDS_QUERY = text(
    """
    SELECT DISTINCT users.id
    FROM public.users
    WHERE users.is_active = true
      AND users.role IN ('ADMIN', 'ASSIGNER')

    UNION

    SELECT incidents.reporter_id
    FROM public.incidents
    WHERE incidents.id = :incident_id
    """
)

GET_CURRENT_INCIDENT_TEAM_ID_QUERY = text(
    """
    SELECT assigned_team_id
    FROM public.incidents
    WHERE id = :incident_id
    """
)


GET_TEAM_STAKEHOLDER_IDS_QUERY = text(
    """
    SELECT DISTINCT team_members.user_id
    FROM public.team_members
    INNER JOIN public.users
        ON users.id = team_members.user_id
    WHERE team_members.team_id = :team_id
      AND users.is_active = true
      AND users.role = 'AID_PROVIDER_TEAM_MEMBER'
    """
)


@dataclass(frozen=True, slots=True)
class ConnectedUser:
    """Identity captured from the authenticated session at connection time."""

    user_id: UUID
    email: str
    role: str



# connection manager "implements" IncidentEventRouter in java terms
class ConnectionManager(IncidentEventRouter):
    """Track authenticated WebSocket connections and their server-side identity."""

    def __init__(self) -> None:
        self._connections: dict[WebSocket, ConnectedUser] = {}

    async def connect(
        self,
        websocket: WebSocket,
        user: ConnectedUser,
    ) -> None:
        """Accept and register an authenticated WebSocket connection."""

        await websocket.accept()
        self._connections[websocket] = user

    def disconnect(self, websocket: WebSocket) -> None:
        """Remove a connection after disconnect or an application error."""

        self._connections.pop(websocket, None)

    def get_user(self, websocket: WebSocket) -> ConnectedUser | None:
        """Return the server-trusted identity associated with a connection."""

        return self._connections.get(websocket)

    def get_connections(self) -> tuple[tuple[WebSocket, ConnectedUser], ...]:
        """Return a stable snapshot for future authorized event routing."""

        return tuple(self._connections.items())

    async def route_event(self, event: Mapping[str, object]) -> None:
        """Send an event only to connected users authorized to view it."""

        authorized_user_ids = await asyncio.to_thread(
            self._get_authorized_user_ids,
            event,
        )
        if not authorized_user_ids:
            return

        logger.info(
            "Routing %s for %s to %d authorized users",
            event.get("event_type"),
            event.get("event_id"),
            len(authorized_user_ids),
        )

        # create the websocket message with the data for the paritcular event that occured
        message = self._build_websocket_message(event)

        # walk through each active web socket and its connected users
        # if a user in the authorized users to view an update to an incident
        # we send the JSON-ified version of the built message, where the message contains relevant data
        # based on the event type. if an error occurs, then we disconnect the user that had an error. realtime.js handles reconnections
        for websocket, user in self.get_connections():
            if user.user_id not in authorized_user_ids:
                continue

            try:
                await websocket.send_json(message)
            except Exception:
                logger.info(
                    "Removing disconnected WebSocket for %s",
                    user.email,
                )
                self.disconnect(websocket)

    @staticmethod
    def _get_authorized_user_ids(event: Mapping[str, object]) -> set[UUID]:
        """Resolve stakeholder IDs from the authoritative incident records."""

        event_type = str(event.get("event_type", ""))
        event_data = event.get("event_data")
        if not isinstance(event_data, Mapping):
            return set()

        incident_id = event.get("incident_id")
        if incident_id is None:
            return set()

        with SessionLocal() as db:
            # grab all stakeholder userId's for a particular incident
            rows = db.execute(
                GET_INCIDENT_STAKEHOLDER_IDS_QUERY,
                {"incident_id": incident_id},
            ).scalars().all()

            if event_type in {"IncidentAssigned", "IncidentUpdated"}:
                team_id = event_data.get("team_id")
                if team_id is None:
                    incident_team_rows = db.execute(
                        GET_CURRENT_INCIDENT_TEAM_ID_QUERY,
                        {"incident_id": incident_id},
                    ).scalars().all()
                    team_id = incident_team_rows[0] if incident_team_rows else None

                if team_id is not None:
                    rows.extend(
                        db.execute(
                            GET_TEAM_STAKEHOLDER_IDS_QUERY,
                            {"team_id": team_id},
                        ).scalars().all()
                    )

        # jump here if IncidentSubmitted is the event_type, and after the execution of the statements in the with block
        # here, we take in the stakeholderIds and normalize to be UUID objects in python
        return {
            UUID(str(row))
            for row in rows
            if row is not None
        }

    @staticmethod
    def _build_websocket_message(
        event: Mapping[str, object],
    ) -> dict[str, object]:
        """Build a minimal browser message without exposing incident internals."""

        event_data = event.get("event_data")
        if not isinstance(event_data, Mapping):
            event_data = {}

        event_type = event.get("event_type")
        if event_type == "IncidentUpdated":
            relevant_event_data = {
                "old_status": event_data.get("old_status"),
                "new_status": event_data.get("new_status"),
            }
        else:
            relevant_event_data = {
                "status": event_data.get("status"),
            }

        return {
            "event_id": str(event.get("event_id", "")),
            "event_type": event_type,
            "incident_reference": event_data.get("incident_reference"),
            "event_data": relevant_event_data,
        }
