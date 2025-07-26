@echo off
title ClipForgeXL Development Server
cd /d "c:\Users\ASUS ROG STRIX\ClipForgeXL\ClipForgeXL"
echo Starting ClipForgeXL on port 9002...
echo.
node_modules\.bin\next dev -p 9002
pause
