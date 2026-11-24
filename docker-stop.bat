@echo off
cd /d "%~dp0"
echo Stopping SQL Lab and SQL Server (databases are kept in the "sqldata" volume)...
docker compose down
echo.
echo To delete the databases as well, run:  docker compose down -v
pause
