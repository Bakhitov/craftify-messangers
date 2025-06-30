#!/bin/bash

# Migration 008: Add agno_config JSON field
# Description: Adds agno_config JSONB field for flexible Agno configuration

set -e

echo "Applying migration 008: Add agno_config JSON field"

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "Error: docker-compose.yml not found. Please run this script from the project root."
    exit 1
fi

# Apply the migration
echo "Executing SQL migration..."
docker-compose exec -T postgres psql -U postgres -d wweb_mcp -f /docker-entrypoint-initdb.d/migrations/versions/008_add_agno_config_json_field.sql

if [ $? -eq 0 ]; then
    echo "Migration 008 applied successfully!"
    echo "✅ Added agno_config JSONB column"
    echo "✅ Created performance index on agno_config->enabled"
    echo ""
    echo "🔧 Manual data migration required:"
    echo "   Update existing instances with JSON config manually"
    echo "   Example format: {\"enabled\": true, \"agentId\": \"agno_assist\", \"stream\": false, \"model\": \"gpt-4.1\"}"
else
    echo "Migration 008 failed!"
    exit 1
fi 