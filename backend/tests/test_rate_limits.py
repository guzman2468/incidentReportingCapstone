import asyncio
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.responses import HTMLResponse, PlainTextResponse
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

import backend.core.middleware as middleware
import backend.realtime.routes as realtime_routes
from backend.core.rate_limit import (
    MAX_WEBSOCKET_CONNECTIONS_PER_USER,
    reset_manual_rate_limits,
)
from backend.realtime.connection_manager import ConnectedUser, ConnectionManager


@pytest.fixture(autouse=True)
def clear_manual_rate_limits():
    reset_manual_rate_limits()
    yield
    reset_manual_rate_limits()


@pytest.fixture
def page_client(monkeypatch):
    lookups = []

    def fake_get_authenticated_user(_request):
        lookups.append(1)
        return {"role": "ADMIN", "must_change_password": False}

    monkeypatch.setattr(middleware, "get_authenticated_user", fake_get_authenticated_user)

    app = FastAPI()
    app.middleware("http")(middleware.protect_role_pages)

    @app.get("/admin/adminDashboard.html")
    def admin_page():
        return HTMLResponse("<p>admin</p>")

    @app.get("/admin/adminDashboard.css")
    def admin_stylesheet():
        return PlainTextResponse("body {}")

    @app.get("/login.html")
    def login_page():
        return HTMLResponse("<p>login</p>")

    return TestClient(app), lookups


def test_protected_pages_block_requests_over_limit_before_session_lookup(page_client):
    client, lookups = page_client

    responses = [client.get("/admin/adminDashboard.html") for _ in range(61)]

    assert all(response.status_code == 200 for response in responses[:60])
    blocked_response = responses[-1]
    assert blocked_response.status_code == 429
    assert int(blocked_response.headers["Retry-After"]) >= 1
    assert blocked_response.headers["Cache-Control"].startswith("no-store")
    assert len(lookups) == 60


def test_page_limit_ignores_static_assets_and_public_pages(page_client):
    client, _lookups = page_client

    for _ in range(61):
        assert client.get("/admin/adminDashboard.css").status_code == 200
        assert client.get("/login.html").status_code == 200

    assert client.get("/admin/adminDashboard.html").status_code == 200


def test_websocket_connection_attempts_are_limited_per_client(monkeypatch):
    auth_lookups = []

    def fake_get_authenticated_websocket_user(_websocket):
        auth_lookups.append(1)
        return None

    monkeypatch.setattr(
        realtime_routes,
        "get_authenticated_websocket_user",
        fake_get_authenticated_websocket_user,
    )
    app = FastAPI()
    app.include_router(realtime_routes.router)
    client = TestClient(app)

    close_reasons = []
    for _ in range(31):
        with pytest.raises(WebSocketDisconnect) as disconnect:
            with client.websocket_connect("/api/realtime/incidents"):
                pass
        close_reasons.append((disconnect.value.code, disconnect.value.reason))

    assert all(reason == (1008, "Authentication required") for reason in close_reasons[:30])
    assert close_reasons[-1] == (1013, "Too many connection attempts")
    assert len(auth_lookups) == 30


def _fake_websocket():
    websocket = MagicMock()
    websocket.accept = AsyncMock()
    return websocket


def test_connection_manager_caps_open_connections_per_user():
    manager = ConnectionManager()
    user = ConnectedUser(uuid4(), "user@example.com", "REPORTER")
    other_user = ConnectedUser(uuid4(), "other@example.com", "REPORTER")
    websockets = [_fake_websocket() for _ in range(MAX_WEBSOCKET_CONNECTIONS_PER_USER)]

    for websocket in websockets:
        assert asyncio.run(manager.connect(websocket, user)) is True

    rejected_websocket = _fake_websocket()
    assert asyncio.run(manager.connect(rejected_websocket, user)) is False
    rejected_websocket.accept.assert_not_awaited()
    assert manager.get_user(rejected_websocket) is None

    assert asyncio.run(manager.connect(_fake_websocket(), other_user)) is True

    manager.disconnect(websockets[0])
    assert asyncio.run(manager.connect(_fake_websocket(), user)) is True


def test_connection_manager_counts_handshakes_in_progress_toward_cap():
    async def connect_simultaneously():
        manager = ConnectionManager()
        user = ConnectedUser(uuid4(), "user@example.com", "REPORTER")
        websockets = [
            _fake_websocket() for _ in range(MAX_WEBSOCKET_CONNECTIONS_PER_USER + 2)
        ]
        results = await asyncio.gather(
            *(manager.connect(websocket, user) for websocket in websockets)
        )
        return manager, user, results

    manager, user, results = asyncio.run(connect_simultaneously())

    assert results.count(True) == MAX_WEBSOCKET_CONNECTIONS_PER_USER
    assert manager.count_user_connections(user.user_id) == MAX_WEBSOCKET_CONNECTIONS_PER_USER


def test_connection_manager_releases_reservation_when_accept_fails():
    manager = ConnectionManager()
    user = ConnectedUser(uuid4(), "user@example.com", "REPORTER")
    websocket = _fake_websocket()
    websocket.accept.side_effect = RuntimeError("handshake failed")

    with pytest.raises(RuntimeError):
        asyncio.run(manager.connect(websocket, user))

    assert manager.count_user_connections(user.user_id) == 0
