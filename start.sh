#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [[ ! -d ".venv" ]]; then
    echo "ERROR: Virtual environment not found." >&2
    echo "Run the setup script first." >&2
    exit 1
fi

if [[ ! -d "frontend/pages/reporter" ]]; then
    echo "ERROR: Reporter frontend directory not found." >&2
    exit 1
fi

echo "Activating virtual environment..."
source .venv/bin/activate

echo "Starting application..."
python -m uvicorn backend.main:app --reload
