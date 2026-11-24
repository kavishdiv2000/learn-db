@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Get the LTS version from https://nodejs.org and run this again. & pause & exit /b 1)
if not exist node_modules (
  echo Installing packages, first run only...
  call npm install
)
start "" http://localhost:5080
node server.js
pause
