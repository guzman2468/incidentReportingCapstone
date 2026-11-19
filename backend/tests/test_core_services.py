from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

import backend.core.security as security
from backend.schemas.aid_providers import (
    AidProviderCreate,
    AidProviderTeamCreate,
    AidProviderTeamMemberAccountCreate,
)
from backend.schemas.users import PasswordChange, UserCreate, UserLogin
from backend.services import aid_providers, users


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


def database_with_results(*results):
    db = MagicMock()
    db.execute.side_effect = results
    return db


def test_password_hash_round_trip_and_rejects_wrong_password():
    password_hash = security.hash_password("Password123!")

    assert security.verify_password("Password123!", password_hash)
    assert not security.verify_password("WrongPassword123!", password_hash)
    assert not security.verify_password("Password123!", "not-a-valid-hash")
    assert not security.verify_password("Password123!", "bcrypt$bad$hash")


def test_session_token_rejects_missing_malformed_tampered_and_expired_tokens(
    monkeypatch,
):
    token = security.create_session_token("user@example.com")
    payload, signature = token.split(".", 1)

    assert security.get_session_email(None) is None
    assert security.get_session_email("malformed") is None
    assert security.get_session_email(f"{payload}.{signature[:-1]}x") is None

    monkeypatch.setattr(security.time, "time", lambda: 9_999_999_999)
    assert security.get_session_email(token) is None


def test_create_user_normalizes_names_and_commits():
    db = MagicMock()
    user_data = UserCreate(
        first_name="  Jane ",
        last_name=" DOE ",
        email="jane@example.com",
        password="Password123!",
    )

    result = users.create_user(db, user_data)

    assert result == {"email": "jane@example.com"}
    parameters = db.execute.call_args.args[1]
    assert parameters["first_name"] == "jane"
    assert parameters["last_name"] == "doe"
    assert parameters["role"] == "REPORTER"
    assert parameters["must_change_password"] is False
    db.commit.assert_called_once()


def test_create_user_translates_duplicate_integrity_error():
    db = MagicMock()
    db.execute.side_effect = users.IntegrityError(
        "insert",
        {},
        SimpleNamespace(args=("users_email_key",)),
    )

    with pytest.raises(users.EmailAlreadyRegistered):
        users.create_user(
            db,
            UserCreate(
                first_name="Jane",
                last_name="Doe",
                email="jane@example.com",
                password="Password123!",
            ),
        )

    db.rollback.assert_called_once()


def test_authenticate_user_rejects_missing_inactive_and_wrong_password(monkeypatch):
    login = UserLogin(email="user@example.com", password="Password123!")

    for row in (None, {"is_active": False, "password_hash": "ignored"}):
        db = database_with_results(FakeResult(rows=[] if row is None else [row]))
        with pytest.raises(users.InvalidCredentials):
            users.authenticate_user(db, login)

    active_row = {
        "email": "user@example.com",
        "first_name": "User",
        "last_name": "Example",
        "role": "REPORTER",
        "is_active": True,
        "must_change_password": False,
        "password_hash": "stored",
    }
    monkeypatch.setattr(users, "verify_password", lambda *_args: False)
    with pytest.raises(users.InvalidCredentials):
        users.authenticate_user(
            database_with_results(FakeResult(rows=[active_row])),
            login,
        )


def test_authenticate_user_returns_profile_for_valid_credentials(monkeypatch):
    row = {
        "email": "user@example.com",
        "first_name": "User",
        "last_name": "Example",
        "role": "REPORTER",
        "is_active": True,
        "must_change_password": True,
        "password_hash": "stored",
    }
    monkeypatch.setattr(users, "verify_password", lambda *_args: True)

    result = users.authenticate_user(
        database_with_results(FakeResult(rows=[row])),
        UserLogin(email="user@example.com", password="Password123!"),
    )

    assert result == {
        "email": "user@example.com",
        "first_name": "User",
        "last_name": "Example",
        "role": "REPORTER",
        "must_change_password": True,
    }


def test_user_profile_and_password_change_cover_empty_and_success_paths(monkeypatch):
    profile_db = database_with_results(FakeResult(rows=[]))
    assert users.get_user_profile(profile_db, "missing@example.com") is None

    stored_hash = security.hash_password("OldPassword123!")
    password_db = database_with_results(
        FakeResult(rows=[{"password_hash": stored_hash}]),
        FakeResult(),
    )
    users.change_password(
        password_db,
        "user@example.com",
        PasswordChange(
            current_password="OldPassword123!",
            new_password="NewPassword123!",
        ),
    )
    password_db.commit.assert_called_once()

    missing_password_db = database_with_results(FakeResult(rows=[]))
    with pytest.raises(users.InvalidCredentials):
        users.change_password(
            missing_password_db,
            "missing@example.com",
            PasswordChange(
                current_password="OldPassword123!",
                new_password="NewPassword123!",
            ),
        )


def test_aid_provider_queries_return_mapping_rows():
    provider = {"id": uuid4(), "name": "Provider", "description": None}
    team = {"id": uuid4(), "name": "Team", "description": "Response"}

    assert aid_providers.get_active_aid_providers(
        database_with_results(FakeResult(rows=[provider]))
    ) == [provider]
    assert aid_providers.get_active_aid_provider_teams(
        database_with_results(FakeResult(rows=[team])),
        str(provider["id"]),
    ) == [team]


def test_create_aid_provider_normalizes_values_and_supports_empty_description():
    db = MagicMock()
    result = aid_providers.create_aid_provider(
        db,
        AidProviderCreate(name="  Red Cross ", description="  Emergency aid "),
    )

    assert result == {"success": True}
    parameters = db.execute.call_args.args[1]
    assert parameters == {"name": "red cross", "description": "Emergency aid"}
    db.commit.assert_called_once()

def test_create_aid_provider_team_rejects_inactive_provider_and_rolls_back():
    db = database_with_results(FakeResult(rowcount=0))

    with pytest.raises(aid_providers.InvalidAidProviderAssignment):
        aid_providers.create_aid_provider_team(
            db,
            AidProviderTeamCreate(
                aid_provider_id=uuid4(),
                name="Flood Team",
                description="Response team",
            ),
        )

    db.rollback.assert_called_once()


def test_create_team_member_assigns_user_and_commits():
    db = database_with_results(
        FakeResult(),
        FakeResult(scalar=uuid4()),
        FakeResult(rowcount=1),
    )
    account = AidProviderTeamMemberAccountCreate(
        first_name="  Team ",
        last_name=" Member ",
        email="member@example.com",
        password="Password123!",
        aid_provider_id=uuid4(),
        aid_provider_team_id=uuid4(),
    )

    result = aid_providers.create_aid_provider_team_member_account(db, account)

    assert result == {"email": "member@example.com"}
    first_parameters = db.execute.call_args_list[0].args[1]
    assert first_parameters["first_name"] == "team"
    assert first_parameters["last_name"] == "member"
    db.commit.assert_called_once()


def test_create_team_member_rejects_team_from_another_provider():
    db = database_with_results(
        FakeResult(),
        FakeResult(scalar=uuid4()),
        FakeResult(rowcount=0),
    )
    account = AidProviderTeamMemberAccountCreate(
        first_name="Team",
        last_name="Member",
        email="member@example.com",
        password="Password123!",
        aid_provider_id=uuid4(),
        aid_provider_team_id=uuid4(),
    )

    with pytest.raises(aid_providers.InvalidAidProviderAssignment):
        aid_providers.create_aid_provider_team_member_account(db, account)

    db.rollback.assert_called_once()
