#!/bin/bash

# Получение информации о назначенных портах через Instance Manager API
# Instance Manager работает на фиксированном порту 3000

INSTANCE_MANAGER_PORT=3000

echo "🔍 Получение информации о портах..."

# Проверка доступности Instance Manager
if ! curl -s "http://localhost:${INSTANCE_MANAGER_PORT}/health" > /dev/null; then
  echo "❌ Instance Manager недоступен на порту ${INSTANCE_MANAGER_PORT}"
  echo "   Убедитесь что сервер запущен: docker-compose -f docker-compose.instance-manager.yml up -d"
  exit 1
fi

echo "✅ Instance Manager запущен на порту ${INSTANCE_MANAGER_PORT}"

# Получение списка экземпляров
echo ""
echo "📋 Активные экземпляры:"
INSTANCES=$(curl -s "http://localhost:${INSTANCE_MANAGER_PORT}/api/v1/instances" || echo "[]")

if [ "$(echo "$INSTANCES" | jq length)" -eq 0 ]; then
  echo "   Экземпляры не найдены"
else
  echo "$INSTANCES" | jq -r '.[] | "   \(.id) | \(.company_id) | \(.status) | API: \(.api_port // "N/A") | MCP: \(.mcp_port // "N/A")"'
fi

# Получение статистики портов
echo ""
echo "📊 Статистика портов:"
PORT_STATS=$(curl -s "http://localhost:${INSTANCE_MANAGER_PORT}/api/v1/resources/ports")

if [ -n "$PORT_STATS" ]; then
  echo "   Всего портов в диапазоне: $(echo "$PORT_STATS" | jq -r '.totalPorts')"
  echo "   Используется портов: $(echo "$PORT_STATS" | jq -r '.usedPorts')"
  echo "   Свободных портов: $(echo "$PORT_STATS" | jq -r '.availablePorts')"
  echo "   Диапазон портов: $(echo "$PORT_STATS" | jq -r '.portRange.start')-$(echo "$PORT_STATS" | jq -r '.portRange.end')"
  
  # Показать занятые порты
  ALLOCATED_PORTS=$(echo "$PORT_STATS" | jq -r '.allocatedPorts[]?')
  if [ -n "$ALLOCATED_PORTS" ]; then
    echo ""
    echo "🔒 Занятые порты:"
    echo "$ALLOCATED_PORTS" | sort -n | tr '\n' ' '
    echo ""
  fi
else
  echo "   ❌ Не удалось получить статистику портов"
fi

echo ""
echo "💡 Полезные команды:"
echo "   Подробная информация об экземпляре:"
echo "   curl http://localhost:${INSTANCE_MANAGER_PORT}/api/v1/instances/INSTANCE_ID | jq '{api_port, mcp_port}'" 