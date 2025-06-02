#!/bin/bash

# Скрипт для остановки экземпляра WhatsApp Web MCP
# Использование: ./stop-instance.sh <имя_экземпляра>

if [ -z "$1" ]; then
    echo "Использование: $0 <имя_экземпляра>"
    echo "Пример: $0 instance1"
    exit 1
fi

INSTANCE_NAME="wweb-mcp-$1"

echo "🛑 Остановка экземпляра: $INSTANCE_NAME"
docker compose --project-name "$INSTANCE_NAME" down

echo "✅ Экземпляр $INSTANCE_NAME остановлен!" 