@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

where docker >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not installed or is not on PATH.
    exit /b 1
)

docker compose version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker Compose is not available.
    exit /b 1
)

if not exist .env (
    echo ERROR: .env is required in %SCRIPT_DIR%.
    exit /b 1
)

echo Starting Docker Compose...
start "Docker Compose" /b cmd /c "docker compose up --build"

echo Waiting for Kafka...
set /a ATTEMPT=0
:wait_for_kafka
docker compose exec -T kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --if-not-exists --topic incident-events --partitions 1 --replication-factor 1 >nul 2>&1
if not errorlevel 1 goto kafka_ready

set /a ATTEMPT+=1
if %ATTEMPT% GEQ 30 goto kafka_failed
timeout /t 2 /nobreak >nul
goto wait_for_kafka

:kafka_ready
echo Kafka topic incident-events is ready.
echo Application: http://localhost:8000
echo.
echo Press Ctrl+C to stop viewing logs, then run docker-stop.bat to stop the containers.
docker compose logs -f
docker compose down
exit /b 0

:kafka_failed
echo ERROR: Kafka did not become ready.
docker compose logs kafka
docker compose down
exit /b 1
