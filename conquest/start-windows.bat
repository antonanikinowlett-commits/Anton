@echo off
rem Starts a local server and opens the game at http://localhost:8000
cd /d "%~dp0"
start "" http://localhost:8000/
python -m http.server 8000 || py -m http.server 8000
