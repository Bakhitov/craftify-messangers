#!/bin/bash

# Скрипт для применения миграции 002_remove_current_api_key.sql
# Удаляет поле current_api_key и обновляет api_key равным instance_id

set -e

echo "🔄 Применение миграции 002: Удаление current_api_key"

# Проверяем наличие переменных окружения
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Переменная DATABASE_URL не установлена"
    echo "💡 Установите переменную: export DATABASE_URL='postgresql://user:password@host:port/database'"
    exit 1
fi

echo "📊 Подключение к базе данных: $DATABASE_URL"

# Применяем миграцию
echo "🔧 Применение миграции..."
psql "$DATABASE_URL" -f "$(dirname "$0")/../db/migrations/versions/002_remove_current_api_key.sql"

if [ $? -eq 0 ]; then
    echo "✅ Миграция 002 успешно применена!"
    echo ""
    echo "📋 Выполненные изменения:"
    echo "  - Удалено поле current_api_key из всех таблиц"
    echo "  - Обновлены api_key равными instance_id для всех записей"
    echo "  - Обновлены api_key_generated_at для пустых записей"
    echo ""
    echo "🚀 Теперь API ключи всегда равны instance_id"
else
    echo "❌ Ошибка при применении миграции"
    exit 1
fi 