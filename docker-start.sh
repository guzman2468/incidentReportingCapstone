#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v docker >/dev/null 2>&1; then
    echo "ERROR: Docker is not installed or is not on PATH." >&2
    exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
    echo "ERROR: Docker Compose is not available." >&2
    exit 1
fi

if [ ! -f .env ]; then
    echo "ERROR: .env is required in $SCRIPT_DIR." >&2
    exit 1
fi

compose_pid=""

stop_containers() {
    exit_status="$1"
    trap - INT TERM EXIT
    if [ -n "$compose_pid" ] && kill -0 "$compose_pid" 2>/dev/null; then
        kill -INT "$compose_pid" 2>/dev/null || true
        wait "$compose_pid" 2>/dev/null || true
    fi
    docker compose down
    exit "$exit_status"
}

trap 'stop_containers 130' INT
trap 'stop_containers 143' TERM
trap 'status=$?; stop_containers "$status"' EXIT

docker compose up --build &
compose_pid=$!

echo "Waiting for Kafka..."
for attempt in $(seq 1 30); do
    if ! kill -0 "$compose_pid" 2>/dev/null; then
        wait "$compose_pid" || true
        echo "ERROR: Docker Compose stopped before Kafka became ready." >&2
        exit 1
    fi
    if docker compose exec -T kafka /opt/kafka/bin/kafka-topics.sh \
        --bootstrap-server localhost:9092 \
        --create \
        --if-not-exists \
        --topic incident-events \
        --partitions 1 \
        --replication-factor 1 >/dev/null 2>&1; then
        echo "Kafka topic incident-events is ready."
        echo "Application: http://localhost:8000"
        compose_status=0
        wait "$compose_pid" || compose_status=$?
        trap - EXIT
        docker compose down
        exit "$compose_status"
    fi
    sleep 2
done

echo "ERROR: Kafka did not become ready." >&2
docker compose logs kafka >&2
exit 1
