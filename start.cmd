@echo off
rem Double-click to run Levy. Works whatever PowerShell's script policy is.
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Get it from https://nodejs.org & pause & exit /b 1)
if not exist node_modules\pdfjs-dist call npm.cmd install --no-fund --no-audit
start "" http://localhost:5173
node server.mjs
pause
