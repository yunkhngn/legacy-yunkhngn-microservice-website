#!/bin/bash

# Script to restore ONLY the settings table from backup
CONTAINER_NAME="yunkhngn-mssql"
SQL_FILE="/var/opt/mssql/backups/restore_settings_only.sql"

echo "🚀 Starting selective restore for 'settings' table..."

# Copy the SQL script into the container's backup mount if not already there
# Actually it's already mounted if we use yunkhngn-infra/backups
cp restore_settings_only.sql backups/

echo "Fixing permissions for backup files..."
docker exec -u 0 $CONTAINER_NAME chown mssql:root /var/opt/mssql/backups/blogdb_20260325_020001.mdf /var/opt/mssql/backups/blogdb_20260325_020001.ldf /var/opt/mssql/backups/restore_settings_only.sql
docker exec -u 0 $CONTAINER_NAME chmod 660 /var/opt/mssql/backups/blogdb_20260325_020001.mdf /var/opt/mssql/backups/blogdb_20260325_020001.ldf
docker exec -u 0 $CONTAINER_NAME chmod 664 /var/opt/mssql/backups/restore_settings_only.sql

echo "Running SQL commands..."
docker exec -it $CONTAINER_NAME /opt/mssql-tools/bin/sqlcmd \
   -S localhost -U sa -P 'YourStrongPassword' \
   -i "$SQL_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Settings table restored successfully!"
else
    echo "❌ Failed to restore settings. Check if the container is running and the password is correct."
fi
