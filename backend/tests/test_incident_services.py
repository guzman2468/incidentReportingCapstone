from datetime import UTC, datetime
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

import backend.services.incidents as incidents
from backend.schemas.incidents import IncidentCreate, IncidentReporterUpdate


class FakeResult:
    def __init__(self, rows=None, scalar=None, rowcount=1):
        self.rows = rows or []
        self.scalar_value = scalar
        self.rowcount = rowcount

    def mappings(self):
        return self

    def all(self):
        return self.rows

    def one(self):
        return self.rows[0]

    def one_or_none(self):
        return self.rows[0] if self.rows else None

    def scalar_one(self):
        return self.scalar_value

    def scalar_one_or_none(self):
        return self.scalar_value


def db_with_results(*results):
    db = MagicMock()
    db.execute.side_effect = results
    return db


def incident_row(status="NEW"):
    timestamp = datetime.now(UTC)
    return {
        "id": uuid4(),
        "incident_number": 12,
        "title": "Flooding",
        "description": "Water entering the building.",
        "severity": "HIGH",
        "location": "Omaha",
        "status": status,
        "created_at": timestamp,
        "updated_at": timestamp,
        "assigned_at": None,
        "resolved_at": None,
        "closed_at": None,
        "cancelled_at": None,
        "assigned_aid_provider_id": None,
        "assigned_team_id": None,
        "assigned_provider_name": None,
        "assigned_team_name": None,
    }


def test_create_incident_requires_an_active_reporter():
    db = db_with_results(FakeResult(scalar=None))

    with pytest.raises(incidents.ReporterNotFound):
        incidents.create_incident(
            db,
            "missing@example.com",
            IncidentCreate(
                title="Flooding",
                description="Water entering the building.",
                severity="HIGH",
                location="Omaha",
            ),
        )


def test_create_incident_persists_clean_values_and_outbox_event(monkeypatch):
    incident_id = uuid4()
    db = db_with_results(
        FakeResult(scalar=uuid4()),
        FakeResult(),
        FakeResult(rows=[{"id": incident_id, "incident_number": 12}]),
    )
    add_event = MagicMock()
    monkeypatch.setattr(incidents, "add_incident_event_to_outbox", add_event)

    result = incidents.create_incident(
        db,
        "reporter@example.com",
        IncidentCreate(
            title="  Flooding ",
            description="  Water entering the building. ",
            severity="HIGH",
            location="  Omaha ",
        ),
    )

    assert result["success"] is True
    assert result["incident_reference"] == "INC-00012"
    insert_parameters = db.execute.call_args_list[1].args[1]
    assert insert_parameters["title"] == "Flooding"
    assert insert_parameters["description"] == "Water entering the building."
    assert insert_parameters["location"] == "Omaha"
    add_event.assert_called_once()
    db.commit.assert_called_once()


def test_create_incident_rolls_back_when_event_persistence_fails(monkeypatch):
    db = db_with_results(
        FakeResult(scalar=uuid4()),
        FakeResult(),
        FakeResult(rows=[{"id": uuid4(), "incident_number": 12}]),
    )
    monkeypatch.setattr(
        incidents,
        "add_incident_event_to_outbox",
        MagicMock(side_effect=RuntimeError("outbox unavailable")),
    )

    with pytest.raises(RuntimeError):
        incidents.create_incident(
            db,
            "reporter@example.com",
            IncidentCreate(
                title="Flooding",
                description="Water entering the building.",
                severity="HIGH",
                location="Omaha",
            ),
        )

    db.rollback.assert_called_once()


def test_incident_reference_helpers_cover_invalid_and_empty_results():
    db = db_with_results(FakeResult(rows=[]))
    assert incidents.get_reporter_incident(db, "user@example.com", "bad") is None
    assert incidents.get_assigner_incident(db, "bad") is None
    assert incidents.get_assigned_incident(db, "user@example.com", "bad") is None
    assert incidents.get_incident_notes(db, "user@example.com", "bad") is None

    assert incidents.get_reporter_incidents(
        db_with_results(FakeResult(rows=[])), "user@example.com"
    ) == []
    assert incidents.get_assigner_incidents(db_with_results(FakeResult(rows=[]))) == []
    assert incidents.get_assigned_incidents(
        db_with_results(FakeResult(rows=[])), "user@example.com"
    ) == []


def test_incident_lists_and_details_add_display_reference_and_notes():
    row = incident_row()
    note = {"id": uuid4(), "note": "Initial note"}
    list_db = db_with_results(FakeResult(rows=[dict(row)]))
    listed = incidents.get_reporter_incidents(list_db, "user@example.com")
    assert listed[0]["incident_reference"] == "INC-00012"

    detail_db = db_with_results(
        FakeResult(rows=[dict(row)]),
        FakeResult(rows=[note]),
    )
    detail = incidents.get_assigner_incident(detail_db, "INC-00012")
    assert detail["notes"] == [note]

    missing_db = db_with_results(FakeResult(rows=[]))
    assert incidents.get_assigner_incident(missing_db, "INC-00012") is None


def test_nearby_incidents_calculates_bounded_coordinates():
    row = {
        "incident_number": 7,
        "title": "Storm",
        "status": "NEW",
        "location": "41.2° N, 96.0° W",
        "latitude": 41.2,
        "longitude": -96.0,
    }
    db = db_with_results(FakeResult(rows=[row]))

    result = incidents.get_nearby_incidents(db, 41.2, -96.0, 10, False)

    assert result[0]["incident_reference"] == "INC-00007"
    parameters = db.execute.call_args.args[1]
    assert parameters["assigned_work_only"] is False
    assert parameters["minimum_latitude"] < 41.2 < parameters["maximum_latitude"]


def test_assign_incident_rejects_each_invalid_state(monkeypatch):
    monkeypatch.setattr(incidents, "add_incident_event_to_outbox", MagicMock())
    base_context = {
        "id": uuid4(),
        "status": "NEW",
        "assigned_team_id": None,
        "assigned_aid_provider_id": None,
    }

    cases = [
        (FakeResult(scalar=None), None, incidents.InvalidIncidentAssignment),
        (
            FakeResult(scalar=uuid4()),
            None,
            incidents.InvalidIncidentAssignment,
        ),
    ]
    for assigner_result, incident_result, error_type in cases:
        results = [assigner_result]
        results.append(
            incident_result
            if incident_result is not None
            else FakeResult(rows=[])
        )
        db = db_with_results(*results)
        with pytest.raises(error_type):
            incidents.assign_incident(
                db,
                "assigner@example.com",
                "INC-00012",
                str(uuid4()),
                str(uuid4()),
            )
        db.rollback.assert_called_once()

    for status, error_type in [
        ("CANCELLED", incidents.InvalidIncidentAssignment),
        ("ASSIGNED", incidents.IncidentAssignmentConflict),
    ]:
        context = dict(base_context)
        context["status"] = status
        if status == "ASSIGNED":
            context["assigned_team_id"] = uuid4()
        db = db_with_results(
            FakeResult(scalar=uuid4()),
            FakeResult(rows=[context]),
        )
        with pytest.raises(error_type):
            incidents.assign_incident(
                db,
                "assigner@example.com",
                "INC-00012",
                str(uuid4()),
                str(uuid4()),
            )
        db.rollback.assert_called_once()


def test_assign_incident_rejects_invalid_team_and_commits_success(monkeypatch):
    monkeypatch.setattr(incidents, "add_incident_event_to_outbox", MagicMock())
    context = incident_row()
    context["assigned_aid_provider_id"] = None
    context["assigned_team_id"] = None

    invalid_db = db_with_results(
        FakeResult(scalar=uuid4()),
        FakeResult(rows=[context]),
        FakeResult(rowcount=0),
    )
    with pytest.raises(incidents.InvalidIncidentAssignment):
        incidents.assign_incident(
            invalid_db,
            "assigner@example.com",
            "INC-00012",
            str(uuid4()),
            str(uuid4()),
        )
    invalid_db.rollback.assert_called_once()

    success_db = db_with_results(
        FakeResult(scalar=uuid4()),
        FakeResult(rows=[context]),
        FakeResult(rowcount=1),
    )
    incidents.assign_incident(
        success_db,
        "assigner@example.com",
        "INC-00012",
        str(uuid4()),
        str(uuid4()),
    )
    success_db.commit.assert_called_once()


def test_status_update_rejects_missing_cancelled_and_wrong_transition():
    for result, error in [
        (FakeResult(rows=[]), incidents.InvalidIncidentAssignment),
        (
            FakeResult(rows=[{"id": uuid4(), "status": "CANCELLED", "actor_id": uuid4()}]),
            incidents.InvalidIncidentAssignment,
        ),
        (
            FakeResult(rows=[{"id": uuid4(), "status": "ASSIGNED", "actor_id": uuid4()}]),
            incidents.InvalidIncidentStatusTransition,
        ),
    ]:
        db = db_with_results(result)
        with pytest.raises(error):
            incidents.update_assigned_incident_status(
                db,
                "member@example.com",
                "INC-00012",
                "RESOLVED",
            )
        db.rollback.assert_called_once()


def test_status_update_persists_transition_and_event(monkeypatch):
    monkeypatch.setattr(incidents, "add_incident_event_to_outbox", MagicMock())
    db = db_with_results(
        FakeResult(rows=[{"id": uuid4(), "status": "ASSIGNED", "actor_id": uuid4()}]),
        FakeResult(rowcount=1),
        FakeResult(),
    )

    incidents.update_assigned_incident_status(
        db,
        "member@example.com",
        "INC-00012",
        "IN_PROGRESS",
    )

    assert db.execute.call_count == 3
    db.commit.assert_called_once()


def test_reporter_update_and_cancel_cover_rejections_and_success(monkeypatch):
    reporter_update = IncidentReporterUpdate(description="  Updated ", severity="LOW")
    assert incidents.update_reporter_incident(
        MagicMock(), "user@example.com", "bad", reporter_update
    ) is False

    missing_update_db = db_with_results(FakeResult(rows=[]))
    assert incidents.update_reporter_incident(
        missing_update_db, "user@example.com", "INC-00012", reporter_update
    ) is False

    monkeypatch.setattr(incidents, "add_incident_event_to_outbox", MagicMock())
    success_update_db = db_with_results(
        FakeResult(rows=[{"id": uuid4(), "status": "NEW"}]),
        FakeResult(rowcount=1),
    )
    assert incidents.update_reporter_incident(
        success_update_db, "user@example.com", "INC-00012", reporter_update
    ) is True
    success_update_db.commit.assert_called_once()

    with pytest.raises(incidents.InvalidReporterIncidentCancellation):
        incidents.cancel_reporter_incident(MagicMock(), "user@example.com", "bad")

    not_found_db = db_with_results(FakeResult(rows=[]))
    with pytest.raises(incidents.InvalidReporterIncidentCancellation):
        incidents.cancel_reporter_incident(
            not_found_db, "user@example.com", "INC-00012"
        )

    closed_db = db_with_results(FakeResult(rows=[{"id": uuid4(), "status": "CLOSED"}]))
    with pytest.raises(incidents.InvalidReporterIncidentCancellation):
        incidents.cancel_reporter_incident(
            closed_db, "user@example.com", "INC-00012"
        )

    cancel_db = db_with_results(FakeResult(rows=[{"id": uuid4(), "status": "NEW"}]), FakeResult())
    incidents.cancel_reporter_incident(cancel_db, "user@example.com", "INC-00012")
    cancel_db.commit.assert_called_once()
