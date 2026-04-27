#!/bin/bash

# Configuration
CONTAINER_NAME="yunkhngn-mssql"
DB_NAME="blogdb"
BACKUP_DIR_HOST="./backups"
BACKUP_DIR_CONTAINER="/var/opt/mssql/backups"
RETENTION_DAYS=7
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${DB_NAME}_${TIMESTAMP}.bak"

# Ensure host backup directory exists
mkdir -p "$BACKUP_DIR_HOST"

echo "🚀 Starting automated backup for ${DB_NAME}..."

# Run SQL Backup command inside container
# We use the password from environment variable if available, otherwise fallback to default
if [ -z "$MSSQL_SA_PASSWORD" ]; then
    echo "⚠️  MSSQL_SA_PASSWORD not set in environment, using default fallback..."
    DB_PASS="Khoadeptrai1204!"
else
    DB_PASS="$MSSQL_SA_PASSWORD"
fi

docker exec $CONTAINER_NAME /opt/mssql-tools/bin/sqlcmd \
    -S localhost -U sa -P "$DB_PASS" \
    -Q "BACKUP DATABASE [${DB_NAME}] TO DISK = N'${BACKUP_DIR_CONTAINER}/${BACKUP_FILE}' WITH NOFORMAT, NOINIT, NAME = N'${DB_NAME}-Full Database Backup', SKIP, NOREWIND, NOUNLOAD, STATS = 10"

if [ $? -eq 0 ]; then
    echo "✅ Backup successful: $BACKUP_DIR_HOST/$BACKUP_FILE"
    
    # Optional: Fix ownership so host user can read/write
    docker exec -u 0 $CONTAINER_NAME chown $(id -u):$(id -g) "${BACKUP_DIR_CONTAINER}/${BACKUP_FILE}" 2>/dev/null || true
    
    # Cleanup old backups (.bak and logs)
    echo "🧹 Cleaning up backups and logs older than $RETENTION_DAYS days..."
    find "$BACKUP_DIR_HOST" -type f \( -name "*.bak" -o -name "*.log" \) -mtime +$RETENTION_DAYS -exec rm -f {} \;
    
    echo "✨ All done!"
else
    echo "❌ Backup failed!"
    exit 1
fi
