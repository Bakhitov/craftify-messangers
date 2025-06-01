#!/bin/bash
# Скрипт для применения исправления поля is_from_me в таблице messages
# Использование: ./run_fix_messages.sh

echo "🔧 Применение исправления поля is_from_me в таблице ai.messages..."

# Выполнение SQL через Docker контейнер PostgreSQL
docker exec -i agent-api-pgvector-1 psql -U ai -d ai < restore_is_from_me.sql

if [ $? -eq 0 ]; then
    echo "✅ Поле is_from_me успешно добавлено в таблицу ai.messages"
    echo "📊 Проверка результата..."
    
    # Дополнительная проверка
    docker exec agent-api-pgvector-1 psql -U ai -d ai -c "
    SELECT 
        column_name, 
        data_type, 
        is_nullable, 
        column_default 
    FROM information_schema.columns 
    WHERE table_schema = 'ai' 
      AND table_name = 'messages' 
      AND column_name = 'is_from_me';
    "
else
    echo "❌ Ошибка при выполнении SQL миграции"
    exit 1
fi 