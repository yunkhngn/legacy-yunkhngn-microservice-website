#!/bin/bash

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
INFRA_DIR="$( dirname "$SCRIPT_DIR" )"
CONTAINER_NAME="yunkhngn-mssql"
DB_NAME="blogdb"
BACKUP_DIR_HOST="${INFRA_DIR}/backups"
LOG_FILE="${INFRA_DIR}/backups/backup_log.txt"
BACKUP_DIR_CONTAINER="/var/opt/mssql/backups"
RETENTION_DAYS=7
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${DB_NAME}_${TIMESTAMP}.bak"

# Ensure host backup directory exists and has correct permissions
mkdir -p "$BACKUP_DIR_HOST"
# Give mssql user inside container permission to write to the backup folder
docker exec -u 0 $CONTAINER_NAME chown mssql:0 "$BACKUP_DIR_CONTAINER" 2>/dev/null || true
docker exec -u 0 $CONTAINER_NAME chmod 770 "$BACKUP_DIR_CONTAINER" 2>/dev/null || true

echo "[$(date)] 🚀 Starting automated backup for ${DB_NAME}..." >> "$LOG_FILE"

# Run SQL Backup command inside container
if [ -z "$MSSQL_SA_PASSWORD" ]; then
    DB_PASS="Khoadeptrai1204!"
else
    DB_PASS="$MSSQL_SA_PASSWORD"
fi

# Execute backup and capture both stdout and stderr
BACKUP_OUTPUT=$(docker exec $CONTAINER_NAME /opt/mssql-tools/bin/sqlcmd \
    -S localhost -U sa -P "$DB_PASS" \
    -Q "BACKUP DATABASE [${DB_NAME}] TO DISK = N'${BACKUP_DIR_CONTAINER}/${BACKUP_FILE}' WITH NOFORMAT, NOINIT, NAME = N'${DB_NAME}-Full Database Backup', SKIP, NOREWIND, NOUNLOAD, STATS = 10" 2>&1)

# Check if the output contains "Error" or "denied" or "failed"
if echo "$BACKUP_OUTPUT" | grep -Ei "Error|denied|failed|abnormally" > /dev/null; then
    echo "[$(date)] ❌ Backup failed!" >> "$LOG_FILE"
    echo "$BACKUP_OUTPUT" >> "$LOG_FILE"
    exit 1
else
    echo "$BACKUP_OUTPUT" >> "$LOG_FILE"
    echo "[$(date)] ✅ Backup successful: $BACKUP_FILE" >> "$LOG_FILE"
    
    # Optional: Fix ownership
    docker exec -u 0 $CONTAINER_NAME chown $(id -u):$(id -g) "${BACKUP_DIR_CONTAINER}/${BACKUP_FILE}" 2>/dev/null || true
    
    # Cleanup old backups
    echo "[$(date)] 🧹 Cleaning up older than $RETENTION_DAYS days..." >> "$LOG_FILE"
    find "$BACKUP_DIR_HOST" -type f \( -name "*.bak" -o -name "backup_log.txt" \) -mtime +$RETENTION_DAYS -exec rm -f {} \;
fi
