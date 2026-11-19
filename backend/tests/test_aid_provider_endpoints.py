import uuid

import backend.api.routes.aid_providers as provider_routes
from backend.core.security import create_session_token
from backend.services.aid_providers import InvalidAidProviderAssignment


def test_assigner_can_list_active_providers(client, monkeypatch):
    monkeypatch.setattr(
        provider_routes,
        "get_active_profile",
        lambda _db, _email: {
            "role": "ASSIGNER",
            "email": "assigner@example.com",
        },
    )
    monkeypatch.setattr(
        provider_routes,
        "get_active_aid_providers",
        lambda _db: [
            {
                "id": str(uuid.uuid4()),
                "name": "Red Cross",
                "description": "Emergency aid provider",
            }
        ],
    )
    client.cookies.set(
        "incident_session",
        create_session_token("assigner@example.com"),
    )

    response = client.get("/api/aidProviders")

    assert response.status_code == 200
    assert response.json()[0]["name"] == "Red Cross"


def test_reporter_cannot_list_assignment_options(client, monkeypatch):
    monkeypatch.setattr(
        provider_routes,
        "get_active_profile",
        lambda _db, _email: {
            "role": "REPORTER",
            "email": "reporter@example.com",
        },
    )
    client.cookies.set(
        "incident_session",
        create_session_token("reporter@example.com"),
    )

    response = client.get("/api/aidProviders")

    assert response.status_code == 403
    assert response.json()["detail"] == "Provider assignment access required"


def test_assigner_can_list_provider_teams(client, monkeypatch):
    provider_id = uuid.uuid4()
    monkeypatch.setattr(
        provider_routes,
        "get_active_profile",
        lambda _db, _email: {
            "role": "ASSIGNER",
            "email": "assigner@example.com",
        },
    )
    monkeypatch.setattr(
        provider_routes,
        "get_active_aid_provider_teams",
        lambda *_args: [
            {
                "id": str(uuid.uuid4()),
                "name": "Flood Response",
                "description": "Flood response team",
            }
        ],
    )
    client.cookies.set(
        "incident_session",
        create_session_token("assigner@example.com"),
    )

    response = client.get(f"/api/aidProviders/{provider_id}/teams")

    assert response.status_code == 200
    assert response.json()[0]["name"] == "Flood Response"


def test_admin_can_create_provider(client, monkeypatch):
    monkeypatch.setattr(
        provider_routes,
        "get_active_profile",
        lambda _db, _email: {
            "role": "ADMIN",
            "email": "admin@example.com",
        },
    )
    monkeypatch.setattr(
        provider_routes,
        "create_aid_provider",
        lambda *_args: {"success": True},
    )
    client.cookies.set(
        "incident_session",
        create_session_token("admin@example.com"),
    )

    response = client.post(
        "/api/aidProviders",
        json={
            "name": "Red Cross",
            "description": "Emergency aid provider",
        },
    )

    assert response.status_code == 201
    assert response.json() == {"success": True}


def test_admin_create_team_rejects_invalid_provider(client, monkeypatch):
    monkeypatch.setattr(
        provider_routes,
        "get_active_profile",
        lambda _db, _email: {
            "role": "ADMIN",
            "email": "admin@example.com",
        },
    )

    def reject_team(*_args):
        raise InvalidAidProviderAssignment(
            "The selected aid provider does not exist or is inactive."
        )

    monkeypatch.setattr(
        provider_routes,
        "create_aid_provider_team",
        reject_team,
    )
    client.cookies.set(
        "incident_session",
        create_session_token("admin@example.com"),
    )

    response = client.post(
        "/api/aidProviders/teams",
        json={
            "aid_provider_id": str(uuid.uuid4()),
            "name": "Flood Response",
            "description": "Flood response team",
        },
    )

    assert response.status_code == 400
    assert "does not exist" in response.json()["detail"]


def test_admin_create_team_member_rejects_invalid_team(client, monkeypatch):
    monkeypatch.setattr(
        provider_routes,
        "get_active_profile",
        lambda _db, _email: {
            "role": "ADMIN",
            "email": "admin@example.com",
        },
    )

    def reject_member(*_args):
        raise InvalidAidProviderAssignment(
            "The selected team does not belong to the selected aid provider."
        )

    monkeypatch.setattr(
        provider_routes,
        "create_aid_provider_team_member_account",
        reject_member,
    )
    client.cookies.set(
        "incident_session",
        create_session_token("admin@example.com"),
    )

    response = client.post(
        "/api/aidProviders/teamMembers",
        json={
            "first_name": "Test",
            "last_name": "Member",
            "email": "member@example.com",
            "password": "Password123!",
            "aid_provider_id": str(uuid.uuid4()),
            "aid_provider_team_id": str(uuid.uuid4()),
        },
    )

    assert response.status_code == 400
    assert "does not belong" in response.json()["detail"]
