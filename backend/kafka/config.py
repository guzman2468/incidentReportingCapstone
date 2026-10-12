import os

from dotenv import load_dotenv

load_dotenv()


def _get_bootstrap_servers() -> list[str]:
    raw_servers = os.getenv(
        "KAFKA_BOOTSTRAP_SERVERS",
        "localhost:9092",
    )

    return [
        server.strip()
        for server in raw_servers.split(",")
        if server.strip()
    ]


KAFKA_BOOTSTRAP_SERVERS = _get_bootstrap_servers()

KAFKA_TOPIC = os.getenv(
    "KAFKA_TOPIC",
    "incident-events",
)

KAFKA_CONSUMER_GROUP = os.getenv(
    "KAFKA_CONSUMER_GROUP",
    "incident-reporting-consumers",
)
