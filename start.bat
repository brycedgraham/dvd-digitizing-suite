@echo off
rem NCIS DVD-to-Plex Studio - double-click launcher (delegates to start.ps1)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
pause
