"""Kafka producer for persisted incident outbox events."""

import json
from collections.abc import Mapping
from typing import Any

from kafka import KafkaProducer
from kafka.serializer import Serializer

from backend.kafka.config import KAFKA_BOOTSTRAP_SERVERS, KAFKA_TOPIC


class IncidentEventKeySerializer(Serializer):
    """Serialize incident IDs used as Kafka message keys."""

    def serialize(
        self,
        topic: str,
        headers: list[tuple[str, bytes]],
        value: Any,
    ) -> bytes | None:
        if value is None:
            return None

        if isinstance(value, bytes):
            return value

        return str(value).encode("utf-8")


class IncidentEventValueSerializer(Serializer):
    """Serialize incident event dictionaries as JSON Kafka values."""

    def serialize(
        self,
        topic: str,
        headers: list[tuple[str, bytes]],
        value: Any,
    ) -> bytes | None:
        if value is None:
            return None

        if isinstance(value, bytes):
            return value

        return json.dumps(value, default=str).encode("utf-8")


class IncidentEventProducer:
    """Publish persisted incident events to the incident-events topic."""

    def __init__(self) -> None:
        self._producer = KafkaProducer(
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
            acks="all",
            retries=10,
            max_in_flight_requests_per_connection=1,
            compression_type="gzip",
            linger_ms=5,
            request_timeout_ms=10000,
            key_serializer=IncidentEventKeySerializer(),
            value_serializer=IncidentEventValueSerializer(),
        )

    def publish(self, event: Mapping[str, Any]) -> None:
        """Publish one persisted outbox event and wait for confirmation."""

        incident_id = event["incident_id"]
        self._producer.send(
            KAFKA_TOPIC,
            key=str(incident_id),
            value=dict(event),
        ).get(timeout=10)

    def close(self) -> None:
        """Flush pending messages and close the Kafka producer."""

        self._producer.flush()
        self._producer.close()
