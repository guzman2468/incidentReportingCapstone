import asyncio
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import backend.kafka.config as kafka_config
import backend.kafka.incident_event_consumer as event_consumer
import backend.kafka.incident_event_outbox_publisher as outbox_publisher
import backend.kafka.incident_event_producer as event_producer
import backend.realtime.connection_manager as realtime_manager
from backend.realtime.connection_manager import ConnectedUser, ConnectionManager


class FakeResult:
    def __init__(self, rows=None):
        self.rows = rows or []

    def mappings(self):
        return self

    def all(self):
        return self.rows


def test_kafka_config_parses_multiple_bootstrap_servers(monkeypatch):
    monkeypatch.setenv("KAFKA_BOOTSTRAP_SERVERS", " kafka-one:9092, kafka-two:9092, ")

    assert kafka_config._get_bootstrap_servers() == [
        "kafka-one:9092",
        "kafka-two:9092",
    ]


def test_kafka_serializers_and_deserializers_handle_none_bytes_and_values():
    key_serializer = event_producer.IncidentEventKeySerializer()
    value_serializer = event_producer.IncidentEventValueSerializer()
    key_deserializer = event_consumer.IncidentEventKeyDeserializer()
    value_deserializer = event_consumer.IncidentEventValueDeserializer()

    assert key_serializer.serialize("topic", [], None) is None
    assert key_serializer.serialize("topic", [], b"key") == b"key"
    assert key_serializer.serialize("topic", [], 123) == b"123"
    assert value_serializer.serialize("topic", [], None) is None
    assert value_serializer.serialize("topic", [], b"value") == b"value"
    assert value_serializer.serialize("topic", [], {"id": 1}) == b'{"id": 1}'
    assert key_deserializer.deserialize("topic", [], None) is None
    assert key_deserializer.deserialize("topic", [], b"key") == "key"
    assert value_deserializer.deserialize("topic", [], None) is None
    assert value_deserializer.deserialize("topic", [], b'{"id": 1}') == {"id": 1}


def test_incident_event_producer_publishes_and_closes(monkeypatch):
    producer_client = MagicMock()
    send_result = MagicMock()
    producer_client.send.return_value = send_result
    monkeypatch.setattr(event_producer, "KafkaProducer", lambda **_kwargs: producer_client)

    producer = event_producer.IncidentEventProducer()
    event = {"incident_id": uuid4(), "event_type": "IncidentSubmitted"}
    producer.publish(event)
    producer.close()

    producer_client.send.assert_called_once()
    send_result.get.assert_called_once_with(timeout=10)
    producer_client.flush.assert_called_once()
    producer_client.close.assert_called_once()


def test_outbox_publisher_marks_success_and_records_failure(monkeypatch):
    event = {"event_id": uuid4(), "incident_id": uuid4()}
    failed_event = {"event_id": uuid4(), "incident_id": uuid4()}
    db = MagicMock()
    db.execute.side_effect = [
        FakeResult(rows=[event, failed_event]),
        FakeResult(),
        FakeResult(),
        FakeResult(),
        FakeResult(),
        FakeResult(),
        FakeResult(),
    ]
    producer = MagicMock()
    producer.publish.side_effect = [None, RuntimeError("Kafka unavailable")]

    assert outbox_publisher.publish_unpublished_incident_events(
        db,
        producer,
    ) == 1
    assert db.rollback.call_count == 1
    assert db.commit.call_count == 4


def test_consumer_deserializes_events_routes_values_and_closes(monkeypatch):
    message = MagicMock(value={"event_type": "IncidentSubmitted"})
    consumer = MagicMock()
    consumer.poll.side_effect = [{"partition": [message]}, {}]
    monkeypatch.setattr(event_consumer, "create_incident_event_consumer", lambda: consumer)
    router = MagicMock()
    router.route_event = AsyncMock()
    stop_event = asyncio.Event()

    async def stop_after_first_route(event):
        stop_event.set()

    router.route_event.side_effect = stop_after_first_route
    asyncio.run(event_consumer.consume_incident_events(router, stop_event))

    router.route_event.assert_awaited_once_with(message.value)
    consumer.commit.assert_called_once()
    consumer.close.assert_called_once()


def test_connection_manager_tracks_connections_and_routes_authorized_events():
    manager = ConnectionManager()
    websocket = MagicMock()
    websocket.accept = AsyncMock()
    websocket.send_json = AsyncMock()
    user = ConnectedUser(uuid4(), "user@example.com", "REPORTER")

    asyncio.run(manager.connect(websocket, user))
    assert manager.get_user(websocket) == user
    assert manager.get_connections() == ((websocket, user),)

    manager._get_authorized_user_ids = MagicMock(return_value={user.user_id})
    asyncio.run(
        manager.route_event(
            {
                "event_id": uuid4(),
                "event_type": "IncidentUpdated",
                "event_data": {
                    "incident_reference": "INC-00001",
                    "old_status": "ASSIGNED",
                    "new_status": "IN_PROGRESS",
                },
            }
        )
    )
    websocket.send_json.assert_awaited_once()

    manager.disconnect(websocket)
    assert manager.get_user(websocket) is None


def test_connection_manager_builds_event_messages_and_handles_empty_authorization(
    monkeypatch,
):
    manager = ConnectionManager()
    user_id = uuid4()
    event = {
        "event_id": uuid4(),
        "event_type": "IncidentNoteAdded",
        "actor_id": user_id,
        "event_data": {
            "incident_reference": "INC-00001",
            "actor_name": "User Example",
            "actor_role": "REPORTER",
            "message": "Updated details",
            "created_at": "now",
        },
    }
    message = manager._build_websocket_message(event)

    assert message["event_type"] == "IncidentNoteAdded"
    assert message["event_data"]["message"] == "Updated details"
    assert manager._get_authorized_user_ids({"event_data": {}}) == set()

    db = MagicMock()
    stakeholder_result = MagicMock()
    stakeholder_result.scalars.return_value.all.return_value = [user_id]
    db.execute.return_value = stakeholder_result
    session = MagicMock()
    session.__enter__.return_value = db
    monkeypatch.setattr(realtime_manager, "SessionLocal", lambda: session)

    assert manager._get_authorized_user_ids(
        {"event_data": {}, "incident_id": uuid4()}
    ) == {user_id}


def test_connection_manager_removes_websocket_when_send_fails():
    manager = ConnectionManager()
    websocket = MagicMock()
    websocket.send_json = AsyncMock(side_effect=RuntimeError("disconnected"))
    user = ConnectedUser(uuid4(), "user@example.com", "REPORTER")
    manager._connections[websocket] = user
    manager._get_authorized_user_ids = MagicMock(return_value={user.user_id})

    asyncio.run(
        manager.route_event(
            {
                "event_type": "IncidentSubmitted",
                "event_data": {"status": "NEW"},
            }
        )
    )

    assert manager.get_user(websocket) is None
