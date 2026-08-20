@echo off
setlocal

REM Get the directory of this script
set "SCRIPT_DIR=%~dp0"

REM Project root is the parent directory of run_app
for %%I in ("%SCRIPT_DIR%..") do set "PROJECT_DIR=%%~fI"

cd /d "%PROJECT_DIR%"

echo ==========================================
echo        ClinicSynapse Launcher
echo ==========================================
echo.
echo Project Directory:
echo %PROJECT_DIR%
echo.

REM Check if virtual environment exists
if not exist ".venv\Scripts\python.exe" (
    echo ERROR: Python virtual environment not found.
    echo Expected: %PROJECT_DIR%\.venv\Scripts\python.exe
    echo.
    pause
    exit /b 1
)

REM Check if frontend dependencies exist
if not exist "Frontend\node_modules" (
    echo ERROR: Frontend dependencies not found.
    echo.
    echo Please run:
    echo cd Frontend
    echo npm install
    echo.
    pause
    exit /b 1
)

echo Starting ClinicSynapse Backend...
start "ClinicSynapse Backend" cmd /k "cd /d "%PROJECT_DIR%\app" && "%PROJECT_DIR%\.venv\Scripts\python.exe" -m uvicorn main:app --reload --port 8000"

timeout /t 3 /nobreak >nul

echo Starting ClinicSynapse Frontend...
start "ClinicSynapse Frontend" cmd /k "cd /d "%PROJECT_DIR%\Frontend" && npm run dev"

echo.
echo ==========================================
echo ClinicSynapse is starting!
echo.
echo Backend API:
echo http://localhost:8000
echo.
echo API Documentation:
echo http://localhost:8000/docs
echo.
echo Frontend:
echo Usually http://localhost:5173
echo ==========================================
echo.

pause
