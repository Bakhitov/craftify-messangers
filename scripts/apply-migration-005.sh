#!/bin/bash

# Скрипт для применения миграции 005 - добавление message_source в таблицу messages

set -e

echo "Applying migration 005: Add message_source to messages table..."

# Получаем переменные окружения
source .env 2>/dev/null || true

# Устанавливаем значения по умолчанию если переменные не заданы
DB_HOST=${DATABASE_HOST:-${DB_HOST:-localhost}}
DB_PORT=${DATABASE_PORT:-${DB_PORT:-5432}}
DB_NAME=${DATABASE_NAME:-${DB_NAME:-postgres}}
DB_USER=${DATABASE_USER:-${DB_USER:-postgres}}
DB_PASSWORD=${DATABASE_PASSWORD:-${DB_PASSWORD:-password}}

# Применяем миграцию
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f db/migrations/versions/005_add_message_source.sql

echo "Migration 005 applied successfully!" 