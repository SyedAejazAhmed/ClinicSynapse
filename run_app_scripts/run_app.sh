#!/usr/bin/env bash

set -e

# Directory containing this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Project root is the parent directory of run_app
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "=========================================="
echo "       ClinicSynapse Launcher"
echo "=========================================="
echo
echo "Project Directory:"
echo "$PROJECT_DIR"
echo

# Check if virtual environment exists
if [ ! -f "synapse/bin/python" ]; then
    echo "ERROR: Python virtual environment not found."
    echo "Expected: $PROJECT_DIR/synapse/bin/python"
    exit 1
fi

# Check if frontend dependencies exist
if [ ! -d "Frontend/node_modules" ]; then
    echo "ERROR: Frontend dependencies not found."
    echo
    echo "Please run:"
    echo "cd Frontend"
    echo "npm install"
    exit 1
fi

echo "Starting ClinicSynapse Backend..."

cd "$PROJECT_DIR/app"

"$PROJECT_DIR/synapse/bin/python" -m uvicorn main:app --reload --port 8000 &

BACKEND_PID=$!

cd "$PROJECT_DIR"

sleep 3

echo "Starting ClinicSynapse Frontend..."

cd "$PROJECT_DIR/Frontend"

npm run dev &

FRONTEND_PID=$!

echo
echo "=========================================="
echo "ClinicSynapse is starting!"
echo
echo "Backend API:       http://localhost:8000"
echo "API Documentation: http://localhost:8000/docs"
echo "Frontend:          Usually http://localhost:5173"
echo "=========================================="
echo
echo "Press Ctrl+C to stop both servers."

cleanup() {
    echo
    echo "Stopping ClinicSynapse..."

    kill "$BACKEND_PID" 2>/dev/null || true
    kill "$FRONTEND_PID" 2>/dev/null || true

    exit 0
}

trap cleanup INT TERM

wait
