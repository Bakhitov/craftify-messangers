#!/bin/bash

# Script to apply database migration for provider table separation
# Usage: ./scripts/apply-migration.sh [rollback]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DB_HOST=${DATABASE_HOST:-localhost}
DB_PORT=${DATABASE_PORT:-5432}
DB_NAME=${DATABASE_NAME:-postgres}
DB_USER=${DATABASE_USER:-postgres}
DB_PASSWORD=${DATABASE_PASSWORD}
DATABASE_URL=${DATABASE_URL}

echo -e "${YELLOW}WhatsApp Web MCP - Database Migration Script${NC}"
echo "=============================================="

# Check if we should rollback
if [ "$1" = "rollback" ]; then
    MIGRATION_FILE="db/migrations/versions/001_split_provider_tables_rollback.sql"
    ACTION="Rolling back"
    echo -e "${YELLOW}⚠️  WARNING: This will rollback the provider table separation!${NC}"
else
    MIGRATION_FILE="db/migrations/versions/001_split_provider_tables.sql"
    ACTION="Applying"
    echo -e "${GREEN}🚀 Applying provider table separation migration${NC}"
fi

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Migration file not found: $MIGRATION_FILE${NC}"
    exit 1
fi

echo -e "${YELLOW}$ACTION migration: $MIGRATION_FILE${NC}"

# Ask for confirmation
read -p "Are you sure you want to proceed? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Migration cancelled.${NC}"
    exit 0
fi

# Backup database first (if not rollback)
if [ "$1" != "rollback" ]; then
    echo -e "${YELLOW}📦 Creating database backup...${NC}"
    
    BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
    
    if [ -n "$DATABASE_URL" ]; then
        pg_dump "$DATABASE_URL" > "$BACKUP_FILE"
    else
        PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE"
    fi
    
    echo -e "${GREEN}✅ Backup created: $BACKUP_FILE${NC}"
fi

# Apply migration
echo -e "${YELLOW}📄 Executing migration...${NC}"

if [ -n "$DATABASE_URL" ]; then
    psql "$DATABASE_URL" -f "$MIGRATION_FILE"
else
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$MIGRATION_FILE"
fi

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Migration completed successfully!${NC}"
    
    if [ "$1" = "rollback" ]; then
        echo -e "${GREEN}🔄 Database structure rolled back to single message_instances table${NC}"
    else
        echo -e "${GREEN}🎉 Provider tables separated successfully!${NC}"
        echo ""
        echo -e "${YELLOW}New tables created:${NC}"
        echo "  - whatsappweb_instances (renamed from message_instances)"
        echo "  - telegram_instances"
        echo "  - whatsapp_official_instances"
        echo "  - facebook_messenger_instances"
        echo "  - instagram_instances"
        echo "  - slack_instances"
        echo "  - discord_instances"
        echo ""
        echo -e "${YELLOW}Next steps:${NC}"
        echo "1. Update your application code to use the new provider-specific tables"
        echo "2. Test the multi-provider service"
        echo "3. Deploy the updated application"
    fi
else
    echo -e "${RED}❌ Migration failed!${NC}"
    
    if [ "$1" != "rollback" ] && [ -f "$BACKUP_FILE" ]; then
        echo -e "${YELLOW}💡 You can restore from backup: $BACKUP_FILE${NC}"
        echo "   To restore: psql [connection] < $BACKUP_FILE"
    fi
    exit 1
fi

echo ""
echo -e "${GREEN}Migration script completed!${NC}" 