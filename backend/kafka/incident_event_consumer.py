"""Kafka consumer for incident events received by the backend."""

import asyncio
import json
from collections.abc import Mapping
from typing import Any, Protocol

from kafka import KafkaConsumer
from kafka.serializer import Deserializer

from backend.kafka.config import (
    KAFKA_BOOTSTRAP_SERVERS,
    KAFKA_CONSUMER_GROUP,
    KAFKA_TOPIC,
)


class IncidentEventKeyDeserializer(Deserializer):
    """Deserialize incident IDs used as Kafka message keys."""

    def deserialize(
        self,
        topic: str,
        headers: list[tuple[str, bytes]],
        value: bytes | None,
    ) -> str | None:
        if value is None:
            return None

        return value.decode("utf-8")


class IncidentEventValueDeserializer(Deserializer):
    """Deserialize JSON Kafka values into Python dictionaries."""

    def deserialize(
        self,
        topic: str,
        headers: list[tuple[str, bytes]],
        value: bytes | None,
    ) -> dict[str, Any] | None:
        if value is None:
            return None

        return json.loads(value.decode("utf-8"))


# base interface for a router, see connection_manager.py for the real implementation.
# think of this as a interface in java terms
class IncidentEventRouter(Protocol):
    """Route a consumed incident event to authorized backend clients."""

    async def route_event(self, event: Mapping[str, Any]) -> None:
        """Route one event after it has been consumed from Kafka."""


def create_incident_event_consumer() -> KafkaConsumer:
    """Create the manually committed incident event Kafka consumer."""

    return KafkaConsumer(
        KAFKA_TOPIC,
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        group_id=KAFKA_CONSUMER_GROUP,
        auto_offset_reset="earliest",
        enable_auto_commit=False,
        key_deserializer=IncidentEventKeyDeserializer(),
        value_deserializer=IncidentEventValueDeserializer(),
    )


async def consume_incident_events(
    event_router: IncidentEventRouter,
    stop_event: asyncio.Event,
) -> None:
    """Consume events, route them, and commit offsets after successful routing."""

    consumer = create_incident_event_consumer()

    try:
        while not stop_event.is_set():
            records = await asyncio.to_thread(
                consumer.poll,
                timeout_ms=1000,
            )

            for messages in records.values():
                for message in messages:
                    if message.value is None:
                        continue

                    # if the message is not None (e.g. contains data)
                    # we have to prepare to send this message to active connections to web socket
                    await event_router.route_event(message.value)

            if records:
                await asyncio.to_thread(consumer.commit)
    finally:
        await asyncio.to_thread(consumer.close)
