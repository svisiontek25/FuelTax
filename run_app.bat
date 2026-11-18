@echo off
echo ========================================================
echo Launching FuelTaxPulse Full Stack (Backend + Frontend)
echo ========================================================
start "FuelTaxPulse Backend" cmd /c "%~dp0run_backend.bat"
start "FuelTaxPulse Frontend" cmd /c "%~dp0run_frontend.bat"
echo Services starting...
echo Backend: http://localhost:8000/docs
echo Frontend: http://localhost:5173
pause
