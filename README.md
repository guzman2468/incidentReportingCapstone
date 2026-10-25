# incidentReportingCapstone
Fall 2026 NGR Capstone
**FOR CAPSTONE INSTRUCTOR, SEE THE RELEASE NOTES SECTION FOR CODE MILESTONE UPDATES**

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

Update `.env` with the required database configuration and generate a strong session secret before starting the application:

```bash
openssl rand -hex 32
```

Add the generated value to `.env`:

```dotenv
DATABASE_URL=your_database_connection_string
SESSION_SECRET=your_generated_secret
```

On Windows PowerShell, if OpenSSL is unavailable, generate one with:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToHexString($bytes).ToLower()
```

Never commit `.env`; it contains database credentials and the session-signing secret.

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
main is master branch, raise PR's here intermittently. 
Create feature/ branches off of develop and raise PR's to merge feature/ branches to develop, not main.


## Release Notes (10-25-2026)
To run the app, you must follow the instructions in this README.

This application is designed to streamline disaster recovery efforts. Its main use case is for natural disaster scenarios, where multiple organizations in the relief effort are to be coordinated appropriately to tend to the needs of people (Reporters).

The features that are currently working are up to Milestone 3 as describe in the Project Plan (minimum UIs and base level functionality for each role).
Account creation by both the Admin user role and self creation for reporters is implemented. Incident related logic is not yet implemented, all data is dummy data used to see how UIs would look once real data is being used.

Please use the **main** branch to view the working version of the project up until this point.