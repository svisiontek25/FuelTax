@echo off
echo ========================================================
echo Starting FuelTaxPulse Backend API (FastAPI) on port 8000
echo ========================================================
cd /d "%~dp0backend"
python main.py
pause
