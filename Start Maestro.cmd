@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. This PC was tested with Node.js 24.16.0.
  pause
  exit /b 1
)
call node scripts\serve.mjs --open
if errorlevel 1 pause


