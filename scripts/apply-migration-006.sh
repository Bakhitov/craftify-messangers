#!/bin/bash

# Migration 006: Add model field to message_instances table
# Description: Adds model column to support different AI models in Agno integration

set -e

echo "Applying migration 006: Add model field to message_instances table"

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "Error: docker-compose.yml not found. Please run this script from the project root."
    exit 1
fi

# Apply the migration
echo "Executing SQL migration..."
docker-compose exec -T postgres psql -U postgres -d wweb_mcp -f /docker-entrypoint-initdb.d/migrations/versions/006_add_model_to_message_instances.sql

if [ $? -eq 0 ]; then
    echo "Migration 006 applied successfully!"
    echo "Added model column to message_instances table with default value 'gpt-4.1'"
else
    echo "Migration 006 failed!"
    exit 1
fi 