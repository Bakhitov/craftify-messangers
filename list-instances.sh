#!/bin/bash

# Скрипт для просмотра всех запущенных экземпляров WhatsApp Web MCP

echo "📋 Запущенные экземпляры WhatsApp Web MCP:"
echo ""
docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}" | head -1
docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}" | grep wweb-mcp

echo ""
echo "🔧 Управление экземплярами:"
echo "  Запустить: ./start-instance.sh <имя>"
echo "  Остановить: ./stop-instance.sh <имя>"
echo "  Логи: docker compose --project-name wweb-mcp-<имя> logs -f" 