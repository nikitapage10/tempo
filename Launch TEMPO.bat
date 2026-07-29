@echo off
REM Double-click this file in File Explorer to launch a local TEMPO instance.
REM A Command Prompt window stays open while the app runs — close it (or Ctrl+C) to stop.

setlocal
cd /d "%~dp0"

echo.
echo   TEMPO — local studio
echo   ====================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo Couldn't find Node.js.
  echo Install the LTS from https://nodejs.org then try again.
  echo.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo Couldn't find npm. Reinstall Node.js from https://nodejs.org
  echo.
  pause
  exit /b 1
)

if not exist ".env.local" (
  echo Missing .env.local — run:  npm run setup
  echo Then paste your Supabase keys into .env.local
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing dependencies ^(first run only^)…
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
  echo.
)

set PORT=3000
set URL=http://localhost:%PORT%

curl -sf -o NUL --max-time 1 "%URL%" >nul 2>&1
if not errorlevel 1 (
  echo TEMPO is already running at %URL% — opening browser.
  start "" "%URL%"
  echo.
  pause
  exit /b 0
)

echo Starting TEMPO at %URL%
echo Leave this window open. Press Ctrl+C to stop.
echo.

start "" cmd /c "timeout /t 3 /nobreak >nul & start \"\" \"%URL%\""

call npm run dev -- --port %PORT%
set status=%ERRORLEVEL%
if not %status%==0 (
  echo.
  echo Dev server exited with code %status%.
  pause
)
exit /b %status%
