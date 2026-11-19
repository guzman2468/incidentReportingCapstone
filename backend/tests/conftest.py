import os

os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")
os.environ.setdefault("SESSION_SECRET", "test-session-secret")

from fastapi import FastAPI
import pytest
from fastapi.testclient import TestClient

from backend.api.routes.aid_providers import router as aid_providers_router
from backend.api.routes.incidents import router as incidents_router
from backend.api.routes.users import router as users_router
from backend.database import get_db


class FakeDB:
    """Dependency placeholder for route-level tests."""


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(users_router)
    app.include_router(aid_providers_router)
    app.include_router(incidents_router)

    def override_get_db():
        yield FakeDB()

    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)
