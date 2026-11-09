@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js LTS is required: https://nodejs.org/
 pause
 exit /b 1
)
call npm install
if errorlevel 1 goto error
call npx playwright install chromium
if errorlevel 1 goto error
echo Setup completed. Open preview.cmd next.
pause
exit /b 0
:error
echo Setup failed. Please share the error message.
pause
exit /b 1
