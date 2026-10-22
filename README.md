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
main is master branch, raise PR's here intermittently. Create feature/ branches off of develop and raise PR's to merge feature/ branches to develop, not main.



Test your UIs with the LiveServer extension in VScode, the below text if for once backend logic is being developed and then you have to use the start scripts to be able to access logic and frontend files like the real app would.


The reporter frontend files in `frontend/pages/reporter` are served statically by FastAPI when the application starts. Open http://localhost:8000/ to view the temporary home page (reporter dashboard). This will be
the sign up page in the future but you can add /yourPageNameHere to the end of the localhost
URL to view your page.
