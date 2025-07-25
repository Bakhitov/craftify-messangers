#!/bin/bash

# Скрипт для применения миграции 011: Company ID indexes
# Дата: 2025-01-15
# Описание: Добавляет индексы для оптимизации запросов по company_id

set -e

echo "🚀 Applying Migration 011: Company ID indexes optimization"
echo "=================================================="

# Переходим в директорию с миграциями
cd "$(dirname "$0")/../db/migrations/versions"

# Проверяем существование файла миграции
MIGRATION_FILE="011_add_company_id_indexes.sql"
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Error: Migration file $MIGRATION_FILE not found!"
    exit 1
fi

echo "📁 Migration file: $MIGRATION_FILE"
echo "📅 Date: $(date)"

# Получаем настройки подключения к БД из переменных окружения или используем значения по умолчанию
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-wweb_mcp}
DB_USER=${DB_USER:-postgres}

echo "🔗 Database connection:"
echo "   Host: $DB_HOST"
echo "   Port: $DB_PORT"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"

# Проверяем подключение к базе данных
echo "🔍 Testing database connection..."
if ! PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ Error: Cannot connect to database!"
    echo "Please check your database connection settings and ensure the database is running."
    exit 1
fi

echo "✅ Database connection successful"

# Применяем миграцию
echo "🔄 Applying migration..."
echo "=================================================="

if PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$MIGRATION_FILE"; then
    echo "=================================================="
    echo "✅ Migration 011 applied successfully!"
    echo ""
    echo "📊 Created indexes:"
    echo "   - idx_message_instances_company_id"
    echo "   - idx_message_instances_provider" 
    echo "   - idx_message_instances_company_provider"
    echo "   - idx_message_instances_status"
    echo "   - idx_messages_instance_timestamp"
    echo "   - idx_messages_instance_chat_timestamp"
    echo "   - idx_messages_is_group"
    echo "   - idx_messages_instance_group_timestamp"
    echo "   - idx_messages_message_source"
    echo ""
    echo "🚀 Benefits:"
    echo "   - Faster queries by company_id"
    echo "   - Optimized message filtering"
    echo "   - Improved analytics performance"
    echo "   - Better provider-specific queries"
    echo ""
    echo "🎯 New endpoints ready to use:"
    echo "   GET /api/v1/company/{companyId}/instances"
    echo "   GET /api/v1/company/{companyId}/messages"
    echo "   GET /api/v1/company/{companyId}/messages/stats"
    echo "   GET /api/v1/company/{companyId}/messages/recent"
    
else
    echo "=================================================="
    echo "❌ Migration 011 failed!"
    echo "Please check the error messages above and fix any issues."
    exit 1
fi

echo ""
echo "🏁 Migration 011 completed at $(date)" 