#!/bin/bash

# Скрипт для применения миграции 004 - добавление session_id в таблицу messages

set -e

echo "Applying migration 004: Add session_id to messages table..."

# Получаем переменные окружения
source .env 2>/dev/null || true

# Устанавливаем значения по умолчанию если переменные не заданы
DB_HOST=${DATABASE_HOST:-${DB_HOST:-localhost}}
DB_PORT=${DATABASE_PORT:-${DB_PORT:-5432}}
DB_NAME=${DATABASE_NAME:-${DB_NAME:-postgres}}
DB_USER=${DATABASE_USER:-${DB_USER:-postgres}}
DB_PASSWORD=${DATABASE_PASSWORD:-${DB_PASSWORD:-password}}

# Применяем миграцию
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f db/migrations/versions/004_add_session_id_to_messages.sql

echo "Migration 004 applied successfully!" 