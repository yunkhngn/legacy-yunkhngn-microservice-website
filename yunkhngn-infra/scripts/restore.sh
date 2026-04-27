#!/bin/bash

# Configuration
CONTAINER_NAME="yunkhngn-mssql"
DB_NAME="blogdb"
BACKUP_DIR_CONTAINER="/var/opt/mssql/backups"

if [ -z "$1" ]; then
    echo "Usage: ./scripts/restore.sh <BACKUP_FILENAME>"
    echo "Example: ./scripts/restore.sh blogdb_20260428_051000.bak"
    echo ""
    echo "Available backups in ./backups/:"
    ls -1 ./backups/*.bak 2>/dev/null | xargs -n 1 basename
    exit 1
fi

BACKUP_FILE=$1

echo "⚠️  WARNING: This will restore the database '${DB_NAME}' from '${BACKUP_FILE}'."
echo "Any data not in the backup will be lost."
read -p "Are you sure you want to proceed? (y/N) " confirm

if [[ $confirm != [yY] ]]; then
    echo "Operation cancelled."
    exit 0
fi

if [ -z "$MSSQL_SA_PASSWORD" ]; then
    DB_PASS="YourStrongPassword"
else
    DB_PASS="$MSSQL_SA_PASSWORD"
fi

echo "🚀 Starting restore..."

docker exec $CONTAINER_NAME /opt/mssql-tools/bin/sqlcmd \
    -S localhost -U sa -P "$DB_PASS" \
    -Q "USE [master]; 
        ALTER DATABASE [${DB_NAME}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
        RESTORE DATABASE [${DB_NAME}] FROM DISK = N'${BACKUP_DIR_CONTAINER}/${BACKUP_FILE}' WITH REPLACE;
        ALTER DATABASE [${DB_NAME}] SET MULTI_USER;"

if [ $? -eq 0 ]; then
    echo "✅ Restore successful!"
else
    echo "❌ Restore failed!"
    exit 1
fi
