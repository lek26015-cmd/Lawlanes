#!/bin/bash

# Ingestion Supervisor Script
# Checks every 5 minutes if ingestion scripts are running and restarts them if not.

SCRIPTS=("scripts/ingest-ratchakitcha.py" "scripts/ingest-krisdika.py" "scripts/ingest-ratchakitcha-historical.py")
LOGS=("ratchakitcha.log" "krisdika.log" "historical.log")

cd "$(dirname "$0")"/..

echo "🚀 Starting Ingestion Supervisor Loop..."

while true; do
  for i in "${!SCRIPTS[@]}"; do
    SCRIPT="${SCRIPTS[$i]}"
    LOG="${LOGS[$i]}"
    
    # Check if process is running
    if ! ps aux | grep "$SCRIPT" | grep -v grep > /dev/null; then
      echo "⚠️  $(date): $SCRIPT is not running. Restarting..."
      nohup python3 -u "$SCRIPT" >> "$LOG" 2>&1 &
      echo "✅ Relaunched $SCRIPT (PID: $!)"
    fi
  done
  
  # Wait for 5 minutes before next check
  sleep 300
done
