#!/bin/bash
# Migration 009: Remove old Agno fields in favor of agno_config JSON
# Description: Removes deprecated Agno-related fields as all configuration is now stored in agno_config JSONB field

set -e

echo "Applying migration 009: Remove old Agno fields"
echo "⚠️  WARNING: This will remove old Agno configuration fields (agent_id, agno_enable, stream, model, agno_url)"
echo "Make sure all instances are configured with agno_config JSON field before proceeding!"
echo ""

# Пауза для подтверждения
read -p "Continue? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Migration cancelled"
    exit 1
fi

# Применяем миграцию через Docker
docker-compose exec -T postgres psql -U postgres -d wweb_mcp -f /docker-entrypoint-initdb.d/migrations/versions/009_remove_old_agno_fields.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration 009 applied successfully"
    echo "✅ Removed old Agno fields: agent_id, agno_enable, stream, model, agno_url"
    echo "✅ Updated agno_config column comment"
    echo ""
    echo "Next steps:"
    echo "1. Restart all instances to apply changes"
    echo "2. Verify all Agno configurations work with agno_config field"
    echo "3. Update any external tools that used old fields"
else
    echo "❌ Migration 009 failed"
    exit 1
fi 