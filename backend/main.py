import asyncio
import logging
from contextlib import asynccontextmanager
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
from .database import SessionLocal
from .kafka.incident_event_consumer import consume_incident_events
from .kafka.incident_event_outbox_publisher import (
    publish_unpublished_incident_events,
)
from .kafka.incident_event_producer import IncidentEventProducer
from .realtime.routes import connection_manager
from .realtime.routes import router as realtime_router


logger = logging.getLogger(__name__)


async def _wait_for_stop_or_timeout(
    stop_event: asyncio.Event,
    timeout_seconds: float,
) -> None:
    """Wait for shutdown or continue after the publisher interval expires."""

    try:
        await asyncio.wait_for(
            stop_event.wait(),
            timeout=timeout_seconds,
        )
    except TimeoutError:
        pass


def _publish_outbox_batch(producer: IncidentEventProducer) -> int:
    """Publish one outbox batch using a session owned by this worker thread."""

    with SessionLocal() as db:
        return publish_unpublished_incident_events(db, producer)


async def _run_outbox_publisher(
    producer: IncidentEventProducer,
    stop_event: asyncio.Event,
) -> None:
    """Continuously publish committed incident events from the outbox."""

    while not stop_event.is_set():
        try:
            await asyncio.to_thread(_publish_outbox_batch, producer)
        except Exception:
            logger.exception("The incident outbox publisher failed")

        await _wait_for_stop_or_timeout(stop_event, timeout_seconds=1)


async def _run_incident_consumer(
    event_router: object,
    stop_event: asyncio.Event,
) -> None:
    """Run the Kafka consumer and retry if Kafka temporarily is unavailable."""

    while not stop_event.is_set():
        try:
            await consume_incident_events(event_router, stop_event)
        except Exception:
            logger.exception("The incident Kafka consumer failed")
            await _wait_for_stop_or_timeout(stop_event, timeout_seconds=5)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Start and stop Kafka background resources with the FastAPI app."""

    producer = IncidentEventProducer()
    stop_event = asyncio.Event()

    # this task is in charge of pulling rows from incident_events that have not been pushied to the Kafka topic
    # it will run every second, and will take in batches of up to 100 rows 
    # that have not been published to the kafka topic
    outbox_publisher_task = asyncio.create_task(
        _run_outbox_publisher(producer, stop_event)
    )

    # this task is in charge of polling the kafka topic while the app is running.
    incident_consumer_task = asyncio.create_task(
        _run_incident_consumer(connection_manager, stop_event)
    )

    try:
        # everything before this point runs at app startup
        yield
        # everyting after this point runs at app shutdown
    finally:
        # the 2 background tasks defined earlier in this method are told to stop after this statement
        stop_event.set()

        # wait for the 2 background tasks to finish (told to stop by stop_event.set())
        await asyncio.gather(
            outbox_publisher_task,
            incident_consumer_task,
        )

        # close the producer, as background tasks have finished after the above line
        producer.close()


app = FastAPI(lifespan=lifespan)
app.include_router(users_router)
app.include_router(aid_providers_router)
app.include_router(incidents_router)
app.include_router(realtime_router)
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
