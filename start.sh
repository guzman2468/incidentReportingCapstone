#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -d ".venv" ]; then
    echo "ERROR: Virtual environment not found."
    echo "Run the setup script first."
    exit 1
fi

if [ ! -d "frontend/pages" ]; then
    echo "ERROR: Frontend pages directory not found."
    exit 1
fi

echo "Activating virtual environment..."
source .venv/bin/activate

echo "Starting application..."
python -m uvicorn backend.main:app --reload
