from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from .database import engine

app = FastAPI()
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend" / "pages" / "reporter"


# TEMPORRARY HOME PAGE FOR TESTING, this will be the signup page in the future.
@app.get("/")
def home():
    return FileResponse(FRONTEND_DIR / "repDashboard.html")


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


# Serve the page HTML, CSS, and JavaScript after the API routes are registered.
# Keeping this mount last ensures routes such as /db-test continue to reach FastAPI.
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
