#!/bin/bash

# Script to restore ONLY the settings table from backup
CONTAINER_NAME="yunkhngn-mssql"
SQL_FILE="/var/opt/mssql/backups/restore_settings_only.sql"

echo "🚀 Starting selective restore for 'settings' table..."

# Copy the SQL script into the container's backup mount if not already there
# Actually it's already mounted if we use yunkhngn-infra/backups
cp restore_settings_only.sql backups/

echo "Running SQL commands..."
docker exec -it $CONTAINER_NAME /opt/mssql-tools/bin/sqlcmd \
   -S localhost -U sa -P 'YourStrong@Passw0rd' \
   -i "$SQL_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Settings table restored successfully!"
else
    echo "❌ Failed to restore settings. Check if the container is running and the password is correct."
fi
