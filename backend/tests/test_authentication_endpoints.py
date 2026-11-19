import backend.api.routes.users as users_routes
from backend.services.users import (
    EmailAlreadyRegistered,
    InvalidCredentials,
)
from backend.core.security import create_session_token


def test_login_success_sets_session_cookie(client, monkeypatch):
    monkeypatch.setattr(
        users_routes,
        "authenticate_user",
        lambda _db, _login: {
            "email": "reporter@example.com",
            "role": "REPORTER",
            "must_change_password": False,
        },
    )

    response = client.post(
        "/api/users/login",
        json={"email": "reporter@example.com", "password": "Password123!"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "success": True,
        "role": "REPORTER",
        "must_change_password": False,
    }
    assert users_routes.SESSION_COOKIE in response.cookies


def test_login_rejects_invalid_credentials(client, monkeypatch):
    def reject_credentials(_db, _login):
        raise InvalidCredentials

    monkeypatch.setattr(users_routes, "authenticate_user", reject_credentials)

    response = client.post(
        "/api/users/login",
        json={"email": "unknown@example.com", "password": "wrong-password"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password."


def test_current_user_requires_session(client):
    response = client.get("/api/users/currentUser")

    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"


def test_register_reporter_success(client, monkeypatch):
    monkeypatch.setattr(
        users_routes,
        "create_user",
        lambda *_args, **_kwargs: {
            "success": True,
            "email": "newreporter@example.com",
        },
    )

    response = client.post(
        "/api/users/createUser",
        json={
            "first_name": "Test",
            "last_name": "Reporter",
            "email": "newreporter@example.com",
            "password": "Password123!",
        },
    )

    assert response.status_code == 201
    assert response.json()["email"] == "newreporter@example.com"


def test_register_reporter_rejects_duplicate(client, monkeypatch):
    def reject_duplicate(*_args, **_kwargs):
        raise EmailAlreadyRegistered

    monkeypatch.setattr(users_routes, "create_user", reject_duplicate)

    response = client.post(
        "/api/users/createUser",
        json={
            "first_name": "Test",
            "last_name": "Reporter",
            "email": "existing@example.com",
            "password": "Password123!",
        },
    )

    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]


def test_logout(client):
    client.cookies.set(
        users_routes.SESSION_COOKIE,
        create_session_token("reporter@example.com"),
    )

    response = client.post("/api/users/logout")

    assert response.status_code == 200
    assert response.json() == {"message": "Logged out"}


def test_change_password_success(client, monkeypatch):
    monkeypatch.setattr(
        users_routes,
        "get_active_profile",
        lambda _db, _email: {
            "role": "REPORTER",
            "email": "reporter@example.com",
        },
    )
    monkeypatch.setattr(users_routes, "change_password", lambda *_args: None)
    client.cookies.set(
        users_routes.SESSION_COOKIE,
        create_session_token("reporter@example.com"),
    )

    response = client.post(
        "/api/users/changePassword",
        json={
            "current_password": "OldPassword123!",
            "new_password": "NewPassword123!",
        },
    )

    assert response.status_code == 200
    assert response.json() == {"success": True}


def test_change_password_rejects_incorrect_password(client, monkeypatch):
    def reject_password(*_args):
        raise InvalidCredentials

    monkeypatch.setattr(users_routes, "change_password", reject_password)
    client.cookies.set(
        users_routes.SESSION_COOKIE,
        create_session_token("reporter@example.com"),
    )

    response = client.post(
        "/api/users/changePassword",
        json={
            "current_password": "WrongPassword123!",
            "new_password": "NewPassword123!",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Incorrect password."


def test_admin_create_user_success(client, monkeypatch):
    monkeypatch.setattr(
        users_routes,
        "get_active_profile",
        lambda _db, _email: {
            "role": "ADMIN",
            "email": "admin@example.com",
        },
    )
    monkeypatch.setattr(
        users_routes,
        "create_user",
        lambda *_args, **_kwargs: {
            "success": True,
            "email": "assigner@example.com",
        },
    )
    client.cookies.set(
        users_routes.SESSION_COOKIE,
        create_session_token("admin@example.com"),
    )

    response = client.post(
        "/api/users/adminCreateUser",
        json={
            "first_name": "Test",
            "last_name": "Assigner",
            "email": "assigner@example.com",
            "password": "Password123!",
            "role": "ASSIGNER",
        },
    )

    assert response.status_code == 201
    assert response.json()["email"] == "assigner@example.com"


def test_admin_create_user_rejects_non_admin(client, monkeypatch):
    monkeypatch.setattr(
        users_routes,
        "get_active_profile",
        lambda _db, _email: {
            "role": "REPORTER",
            "email": "reporter@example.com",
        },
    )
    client.cookies.set(
        users_routes.SESSION_COOKIE,
        create_session_token("reporter@example.com"),
    )

    response = client.post(
        "/api/users/adminCreateUser",
        json={
            "first_name": "Test",
            "last_name": "Assigner",
            "email": "assigner@example.com",
            "password": "Password123!",
            "role": "ASSIGNER",
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Admin access required"
