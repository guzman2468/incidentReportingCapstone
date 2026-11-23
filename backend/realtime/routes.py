"""Authenticated WebSocket routes for real-time incident updates."""

import asyncio
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from slowapi.util import get_remote_address
from sqlalchemy import text

from backend.core.rate_limit import RATE_LIMIT_WEBSOCKET_CONNECT, check_manual_rate_limit
from backend.core.security import SESSION_COOKIE, get_session_email
from backend.database import SessionLocal
from backend.realtime.connection_manager import ConnectedUser, ConnectionManager


GET_REALTIME_USER_QUERY = text(
    """
    SELECT id, email, role
    FROM public.users
    WHERE email = :email
      AND is_active = true
    """
)


router = APIRouter(prefix="/api/realtime", tags=["realtime"])
connection_manager = ConnectionManager()


def get_authenticated_websocket_user(websocket: WebSocket) -> ConnectedUser | None:
    """Resolve the active user from the existing signed session cookie."""

    session_token = websocket.cookies.get(SESSION_COOKIE)
    email = get_session_email(session_token)
    if email is None:
        return None

    with SessionLocal() as db:
        row = db.execute(
            GET_REALTIME_USER_QUERY,
            {"email": email},
        ).mappings().one_or_none()

    if row is None:
        return None

    return ConnectedUser(
        user_id=UUID(str(row["id"])),
        email=str(row["email"]),
        role=str(row["role"]),
    )


@router.websocket("/incidents")
async def incident_realtime(websocket: WebSocket) -> None:
    """Keep an authenticated incident-update WebSocket connection open."""

    # Check attempts per IP before the database lookup used for authentication.
    retry_after = check_manual_rate_limit(
        RATE_LIMIT_WEBSOCKET_CONNECT,
        "websocket-connect",
        get_remote_address(websocket),
    )
    if retry_after is not None:
        await websocket.close(code=1013, reason="Too many connection attempts")
        return

    user = await asyncio.to_thread(
        get_authenticated_websocket_user,
        websocket,
    )
    if user is None:
        await websocket.close(code=1008, reason="Authentication required")
        return

    if not await connection_manager.connect(websocket, user):
        await websocket.close(code=1013, reason="Too many open connections")
        return

    try:
        while True:
            await websocket.receive()
    except WebSocketDisconnect:
        connection_manager.disconnect(websocket)
    except Exception:
        connection_manager.disconnect(websocket)
        raise
