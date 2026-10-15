@echo off

cd /d "%~dp0"

if not exist .venv (
    echo ERROR: Virtual environment not found.
    echo Run the setup script first.
    pause
    exit /b 1
)

if not exist frontend\pages\reporter (
    echo ERROR: Reporter frontend directory not found.
    pause
    exit /b 1
)

echo Activating virtual environment...
call .venv\Scripts\activate.bat

echo Starting application...
python -m uvicorn backend.main:app --reload
