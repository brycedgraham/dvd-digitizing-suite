#!/usr/bin/env bash
set -e

echo "=========================================================="
echo "  NCIS DVD-to-Plex Automation Studio Docker Container     "
echo "=========================================================="
echo "Host Port: ${PORT}"
echo "Optical Drive Target: ${OPTICAL_DRIVE}"
echo "Scratch Directory: ${SCRATCH_DIR}"
echo "Plex Destination: ${PLEX_DIR}"
echo "=========================================================="

# Check optical drive pass-through
if [ -e "${OPTICAL_DRIVE}" ]; then
    echo "[PASS] Optical DVD drive detected at ${OPTICAL_DRIVE}"
    ls -l "${OPTICAL_DRIVE}"
else
    echo "[WARN] Optical drive ${OPTICAL_DRIVE} not found."
    echo "       Ensure you passed '--device=/dev/sr0' in your docker run or docker-compose.yml"
fi

# Ensure output directories exist
mkdir -p "${SCRATCH_DIR}" "${PLEX_DIR}"

# Start Python automation engine
echo "Starting NCIS Automation Engine on port ${PORT}..."
exec python3 /app/backend/server.py
