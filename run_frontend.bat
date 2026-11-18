@echo off
echo ========================================================
echo Starting FuelTaxPulse Frontend (Vite + React) on port 5173
echo ========================================================
cd /d "%~dp0frontend"
call npm.cmd run dev
pause
