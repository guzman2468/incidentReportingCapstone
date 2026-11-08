import uuid
from datetime import UTC, datetime

import backend.api.routes.incidents as incident_routes
from backend.core.security import create_session_token
from backend.services.incidents import (
    InvalidIncidentAssignment,
)


def test_assigner_queue_requires_authentication(client):
    response = client.get("/api/incidents/assigner")

    assert response.status_code == 401


def test_submit_incident_success(client, monkeypatch):
    monkeypatch.setattr(
        incident_routes,
        "get_active_profile",
        lambda _db, _email: {
            "role": "REPORTER",
            "email": "reporter@example.com",
        },
    )
    monkeypatch.setattr(
        incident_routes,
        "create_incident",
        lambda *_args: {
            "success": True,
            "incident_id": str(uuid.uuid4()),
            "incident_reference": "INC-00001",
        },
    )
    client.cookies.set(
        "incident_session",
        create_session_token("reporter@example.com"),
    )

    response = client.post(
        "/api/incidents",
        json={
            "title": "Flooding",
            "description": "Water entering the building.",
            "severity": "HIGH",
            "location": "Omaha",
        },
    )

    assert response.status_code == 201
    assert response.json()["success"] is True


def test_submit_incident_rejects_assigner(client, monkeypatch):
    monkeypatch.setattr(
        incident_routes,
        "get_active_profile",
        lambda _db, _email: {
            "role": "ASSIGNER",
            "email": "assigner@example.com",
        },
    )
    client.cookies.set(
        "incident_session",
        create_session_token("assigner@example.com"),
    )

    response = client.post(
        "/api/incidents",
        json={
            "title": "Flooding",
            "description": "Water entering the building.",
            "severity": "HIGH",
            "location": "Omaha",
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Reporter access required"


def test_assignment_success(client, monkeypatch):
    monkeypatch.setattr(
        incident_routes,
        "get_active_profile",
        lambda _db, _email: {
            "role": "ASSIGNER",
            "email": "assigner@example.com",
        },
    )
    monkeypatch.setattr(incident_routes, "assign_incident", lambda *_args: None)
    client.cookies.set(
        "incident_session",
        create_session_token("assigner@example.com"),
    )

    response = client.post(
        "/api/incidents/assign",
        json={
            "incident_reference": "INC-00001",
            "aid_provider_id": str(uuid.uuid4()),
            "team_id": str(uuid.uuid4()),
        },
    )

    assert response.status_code == 200
    assert response.json() == {"success": True}


def test_assignment_rejects_invalid_input(client, monkeypatch):
    monkeypatch.setattr(
        incident_routes,
        "get_active_profile",
        lambda _db, _email: {
            "role": "ASSIGNER",
            "email": "assigner@example.com",
        },
    )

    def reject_assignment(*_args):
        raise InvalidIncidentAssignment(
            "The selected aid provider team is invalid."
        )

    monkeypatch.setattr(incident_routes, "assign_incident", reject_assignment)
    client.cookies.set(
        "incident_session",
        create_session_token("assigner@example.com"),
    )

    response = client.post(
        "/api/incidents/assign",
        json={
            "incident_reference": "INC-00001",
            "aid_provider_id": str(uuid.uuid4()),
            "team_id": str(uuid.uuid4()),
        },
    )

    assert response.status_code == 400
    assert "invalid" in response.json()["detail"]


def incident_summary(reference="INC-00001", status="NEW"):
    timestamp = datetime.now(UTC)
    return {
        "incident_reference": reference,
        "title": "Flooding",
        "description": "Water entering the building.",
        "severity": "HIGH",
        "location": "Omaha",
        "status": status,
        "created_at": timestamp.isoformat(),
        "updated_at": timestamp.isoformat(),
        "assigned_at": None,
        "started_at": None,
        "resolved_at": None,
        "closed_at": None,
        "cancelled_at": None,
        "assigned_aid_provider_id": None,
        "assigned_team_id": None,
        "assigned_provider_name": None,
        "assigned_team_name": None,
    }


def test_reporter_can_list_and_get_own_incidents(client, monkeypatch):
    monkeypatch.setattr(
        incident_routes,
        "get_active_profile",
        lambda _db, _email: {
            "role": "REPORTER",
            "email": "reporter@example.com",
        },
    )
    monkeypatch.setattr(
        incident_routes,
        "get_reporter_incidents",
        lambda *_args: [incident_summary()],
    )
    monkeypatch.setattr(
        incident_routes,
        "get_reporter_incident",
        lambda *_args: incident_summary(),
    )
    client.cookies.set(
        "incident_session",
        create_session_token("reporter@example.com"),
    )

    list_response = client.get("/api/incidents/mine")
    detail_response = client.get("/api/incidents/reference/INC-00001")

    assert list_response.status_code == 200
    assert list_response.json()[0]["incident_reference"] == "INC-00001"
    assert detail_response.status_code == 200
    assert detail_response.json()["title"] == "Flooding"


def test_reporter_incident_detail_returns_not_found(client, monkeypatch):
    monkeypatch.setattr(
        incident_routes,
        "get_active_profile",
        lambda _db, _email: {
            "role": "REPORTER",
            "email": "reporter@example.com",
        },
    )
    monkeypatch.setattr(
        incident_routes,
        "get_reporter_incident",
        lambda *_args: None,
    )
    client.cookies.set(
        "incident_session",
        create_session_token("reporter@example.com"),
    )

    response = client.get("/api/incidents/reference/INC-99999")

    assert response.status_code == 404
    assert response.json()["detail"] == "Incident not found"


def test_assigner_can_list_incident_queue(client, monkeypatch):
    monkeypatch.setattr(
        incident_routes,
        "get_active_profile",
        lambda _db, _email: {
            "role": "ASSIGNER",
            "email": "assigner@example.com",
        },
    )
    monkeypatch.setattr(
        incident_routes,
        "get_assigner_incidents",
        lambda *_args: [incident_summary(status="NEW")],
    )
    client.cookies.set(
        "incident_session",
        create_session_token("assigner@example.com"),
    )

    response = client.get("/api/incidents/assigner")

    assert response.status_code == 200
    assert response.json()[0]["incident_reference"] == "INC-00001"


def test_admin_can_list_every_incident(client, monkeypatch):
    monkeypatch.setattr(
        incident_routes,
        "get_active_profile",
        lambda _db, _email: {
            "role": "ADMIN",
            "email": "admin@example.com",
        },
    )
    monkeypatch.setattr(
        incident_routes,
        "get_assigner_incidents",
        lambda *_args: [incident_summary(status="ASSIGNED")],
    )
    client.cookies.set(
        "incident_session",
        create_session_token("admin@example.com"),
    )

    response = client.get("/api/incidents/admin")

    assert response.status_code == 200
    assert response.json()[0]["status"] == "ASSIGNED"


def test_team_member_can_list_and_get_assigned_incidents(client, monkeypatch):
    monkeypatch.setattr(
        incident_routes,
        "get_active_profile",
        lambda _db, _email: {
            "role": "AID_PROVIDER_TEAM_MEMBER",
            "email": "member@example.com",
        },
    )
    monkeypatch.setattr(
        incident_routes,
        "get_assigned_incidents",
        lambda *_args: [incident_summary(status="ASSIGNED")],
    )
    monkeypatch.setattr(
        incident_routes,
        "get_assigned_incident",
        lambda *_args: incident_summary(status="ASSIGNED"),
    )
    client.cookies.set(
        "incident_session",
        create_session_token("member@example.com"),
    )

    list_response = client.get("/api/incidents/assigned-to-me")
    detail_response = client.get("/api/incidents/assigned-to-me/INC-00001")

    assert list_response.status_code == 200
    assert detail_response.status_code == 200
    assert detail_response.json()["incident_reference"] == "INC-00001"


def test_team_member_assigned_incident_detail_returns_not_found(client, monkeypatch):
    monkeypatch.setattr(
        incident_routes,
        "get_active_profile",
        lambda _db, _email: {
            "role": "AID_PROVIDER_TEAM_MEMBER",
            "email": "member@example.com",
        },
    )
    monkeypatch.setattr(
        incident_routes,
        "get_assigned_incident",
        lambda *_args: None,
    )
    client.cookies.set(
        "incident_session",
        create_session_token("member@example.com"),
    )

    response = client.get("/api/incidents/assigned-to-me/INC-99999")

    assert response.status_code == 404
    assert response.json()["detail"] == "Assigned incident not found"


def test_team_member_can_update_assigned_incident_status(client, monkeypatch):
    monkeypatch.setattr(
        incident_routes,
        "get_active_profile",
        lambda _db, _email: {
            "role": "AID_PROVIDER_TEAM_MEMBER",
            "email": "member@example.com",
        },
    )
    monkeypatch.setattr(
        incident_routes,
        "update_assigned_incident_status",
        lambda *_args: None,
    )
    client.cookies.set(
        "incident_session",
        create_session_token("member@example.com"),
    )

    response = client.patch(
        "/api/incidents/assigned-to-me/INC-00001/status",
        json={"status": "IN_PROGRESS"},
    )

    assert response.status_code == 200
    assert response.json() == {"success": True}


def test_team_member_status_update_rejects_unassigned_incident(client, monkeypatch):
    monkeypatch.setattr(
        incident_routes,
        "get_active_profile",
        lambda _db, _email: {
            "role": "AID_PROVIDER_TEAM_MEMBER",
            "email": "member@example.com",
        },
    )

    def reject_status(*_args):
        raise InvalidIncidentAssignment(
            "The incident is not assigned to one of your teams."
        )

    monkeypatch.setattr(
        incident_routes,
        "update_assigned_incident_status",
        reject_status,
    )
    client.cookies.set(
        "incident_session",
        create_session_token("member@example.com"),
    )

    response = client.patch(
        "/api/incidents/assigned-to-me/INC-00001/status",
        json={"status": "RESOLVED"},
    )

    assert response.status_code == 404
    assert "not assigned" in response.json()["detail"]
