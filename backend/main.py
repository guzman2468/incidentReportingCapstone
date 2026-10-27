from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from .core.middleware import protect_role_pages
from .database import engine
from .api.routes.users import router as users_router
from .api.routes.aid_providers import router as aid_providers_router
from .api.routes.incidents import router as incidents_router

app = FastAPI()
app.include_router(users_router)
app.include_router(aid_providers_router)
app.include_router(incidents_router)
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend" / "pages"

app.middleware("http")(protect_role_pages)


@app.get("/")
def home():
    return FileResponse(FRONTEND_DIR / "login.html")


@app.get("/db-test")
def database_test():
    with engine.connect() as connection:
        result = connection.execute(
            text("SELECT current_database()")
        )

        return {
            "status": "connected",
            "database": result.scalar()
        }


@app.get("/login")
def home():
    return FileResponse(FRONTEND_DIR / "login.html")


# Serve the page HTML, CSS, and JavaScript after the API routes are registered.
# Keeping this mount last ensures routes such as /db-test continue to reach FastAPI.
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
