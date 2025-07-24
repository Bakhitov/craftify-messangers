#!/bin/bash

# Script to apply migration 010: Rename user_id to company_id
# This script renames user_id field to company_id in all database tables

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Applying Migration 010: Rename user_id to company_id${NC}"

# Load database configuration
if [ -f "env.production" ]; then
    source env.production
    echo -e "${GREEN}✅ Loaded production environment${NC}"
elif [ -f "env.development" ]; then
    source env.development
    echo -e "${GREEN}✅ Loaded development environment${NC}"
else
    echo -e "${RED}❌ No environment file found${NC}"
    exit 1
fi

# Check if migration file exists
MIGRATION_FILE="db/migrations/versions/010_rename_user_id_to_company_id.sql"
if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Migration file not found: $MIGRATION_FILE${NC}"
    exit 1
fi

# Apply migration
echo -e "${YELLOW}📊 Applying migration 010...${NC}"

# Execute migration
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$MIGRATION_FILE"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Migration 010 applied successfully!${NC}"
    echo -e "${GREEN}   - Renamed user_id to company_id in all tables${NC}"
    echo -e "${GREEN}   - Updated all related indexes${NC}"
    echo -e "${GREEN}   - Added proper comments${NC}"
else
    echo -e "${RED}❌ Migration 010 failed!${NC}"
    exit 1
fi

echo -e "${YELLOW}🎯 Migration 010 completed!${NC}" 