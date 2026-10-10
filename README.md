# incidentReportingCapstone
Fall 2026 NGR Capstone


## Prerequisites

Before running the application, create the local environment file and install the dependencies.

Mac/Linux:

```bash
cp .env.example .env
./setup.sh
```

Windows:

```bat
copy .env.example .env
setup.bat
```

Update `.env` with the required database configuration before starting the application.

## FastAPI-only testing

Use the regular `start` script when testing the FastAPI application without Kafka messaging.

Mac/Linux:

```bash
./start.sh
```

Windows:

```bat
start.bat
```

## Kafka messaging testing

Use the Docker startup script when Kafka messaging is required. Make sure Docker is running and the root `.env` file has been configured.

Mac/Linux:

```bash
./docker-start.sh
```

Windows:

```bat
docker-start.bat
```

The Docker startup script runs FastAPI and Kafka together, creates the `incident-events` topic if needed, and displays container logs.

To stop the Docker containers:

Mac/Linux:

```bash
./docker-stop.sh
```

Windows:

```bat
docker-stop.bat
```

The stop scripts remove the containers without deleting the persistent Kafka volume.
main is master branch, raise PR's here intermittently. Create feature/ branches off of develop and raise PR's to merge feature/ branches to develop, not main.
