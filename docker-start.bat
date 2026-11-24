@echo off
title SQL Lab (Docker)
cd /d "%~dp0"
where docker >nul 2>nul || (echo Docker is not installed. Install Docker Desktop from https://www.docker.com/products/docker-desktop/ & pause & exit /b 1)
docker info >nul 2>nul || (echo Docker Desktop is not running. Start it, wait for "Engine running", then run this again. & pause & exit /b 1)

echo Starting SQL Server 2025 and SQL Lab in Docker...
echo (The first run downloads about 1.5 GB, so it can take several minutes.)
docker compose up -d --build || (echo. & echo docker compose failed - see the messages above. & pause & exit /b 1)

echo Waiting for SQL Lab to answer on http://localhost:5080 ...
set /a tries=0
:wait
curl -s -o nul http://localhost:5080/api/status && goto ready
set /a tries+=1
if %tries% GEQ 60 (echo SQL Lab did not start. Check: docker compose logs & pause & exit /b 1)
timeout /t 3 /nobreak >nul
goto wait

:ready
start "" http://localhost:5080
echo.
echo SQL Lab is running at http://localhost:5080
echo SQL Server is on localhost,1433  (login: sa, password from .env or Str0ng!Passw0rd)
echo In the app, click "Set up practice database" the first time.
echo.
echo Stop everything later with docker-stop.bat (your data is kept).
pause
