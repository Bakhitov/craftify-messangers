#!/bin/bash

# Migration 007: Add agno_url field to message_instances table
# Description: Adds agno_url column to store full Agno API endpoint URL for each instance

set -e

echo "Applying migration 007: Add agno_url field to message_instances table"

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "Error: docker-compose.yml not found. Please run this script from the project root."
    exit 1
fi

# Apply the migration
echo "Executing SQL migration..."
docker-compose exec -T postgres psql -U postgres -d wweb_mcp -f /docker-entrypoint-initdb.d/migrations/versions/007_add_agno_url_to_message_instances.sql

if [ $? -eq 0 ]; then
    echo "Migration 007 applied successfully!"
    echo "Added agno_url column to message_instances table"
    echo "Existing instances updated with default Agno URL pattern"
else
    echo "Migration 007 failed!"
    exit 1
fi 