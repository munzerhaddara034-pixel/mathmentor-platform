@echo off
cd /d "%~dp0"
set PATH=%PATH%;C:\Program Files\nodejs;%LOCALAPPDATA%\Programs\nodejs
echo Starting Munzer Haddara Math Academy...
call npm install
call npm run dev
pause
