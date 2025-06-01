#!/bin/bash

# Скрипт для создания и запуска экземпляра через Instance Manager API
# Использование: ./start-instance.sh <user_id> [provider] [type]

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

if [ -z "$1" ]; then
    echo -e "${RED}❌ Использование: $0 <user_id> [provider] [type]${NC}"
    echo ""
    echo -e "${YELLOW}Параметры:${NC}"
    echo "  user_id   - Уникальный ID пользователя (обязательно)"
    echo "  provider  - whatsappweb или telegram (по умолчанию: whatsappweb)"
    echo "  type      - api или mcp (по умолчанию: api)"
    echo ""
    echo -e "${BLUE}Примеры:${NC}"
    echo "  $0 user123                    # WhatsApp API инстанс"
    echo "  $0 user123 whatsappweb api    # WhatsApp API инстанс"
    echo "  $0 user123 telegram api       # Telegram API инстанс"
    echo "  $0 user123 whatsappweb mcp    # WhatsApp MCP инстанс"
    exit 1
fi

USER_ID="$1"
PROVIDER="${2:-whatsappweb}"
TYPE="${3:-api}"
INSTANCE_MANAGER_URL="http://localhost:3000"

echo -e "${BLUE}🚀 Создание инстанса через Instance Manager API${NC}"
echo "================================================="
echo -e "${YELLOW}Параметры:${NC}"
echo "  User ID:  $USER_ID"
echo "  Provider: $PROVIDER"
echo "  Type:     $TYPE"
echo ""

# Проверка доступности Instance Manager
echo -e "${YELLOW}🔍 Проверка доступности Instance Manager...${NC}"
if ! curl -s "$INSTANCE_MANAGER_URL/health" > /dev/null; then
    echo -e "${RED}❌ Instance Manager недоступен на $INSTANCE_MANAGER_URL${NC}"
    echo ""
    echo -e "${YELLOW}Запустите Instance Manager:${NC}"
    echo "  ./start-dev.sh                                    # Development"
    echo "  ./start-prod.sh                                   # Production"
    echo "  docker-compose -f docker-compose.instance-manager.yml up -d"
    exit 1
fi

echo -e "${GREEN}✅ Instance Manager доступен${NC}"

# Формирование JSON payload
JSON_PAYLOAD=$(cat <<EOF
{
  "user_id": "$USER_ID",
  "provider": "$PROVIDER",
  "type_instance": ["$TYPE"]
}
EOF
)

# Добавление webhook для WhatsApp (опционально)
if [ "$PROVIDER" = "whatsappweb" ]; then
    read -p "Добавить webhook URL? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Введите webhook URL: " WEBHOOK_URL
        if [ -n "$WEBHOOK_URL" ]; then
            JSON_PAYLOAD=$(cat <<EOF
{
  "user_id": "$USER_ID",
  "provider": "$PROVIDER",
  "type_instance": ["$TYPE"],
  "api_webhook_schema": {
    "enabled": true,
    "url": "$WEBHOOK_URL",
    "filters": {
      "allowGroups": false,
      "allowPrivate": true
    }
  }
}
EOF
            )
            echo -e "${GREEN}✅ Webhook добавлен: $WEBHOOK_URL${NC}"
        fi
    fi
fi

# Создание инстанса
echo -e "${YELLOW}🔧 Создание инстанса...${NC}"
echo "Отправка запроса к API..."

RESPONSE=$(curl -s -X POST "$INSTANCE_MANAGER_URL/api/v1/instances" \
  -H "Content-Type: application/json" \
  -d "$JSON_PAYLOAD")

# Проверка ответа
if echo "$RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Инстанс создан успешно!${NC}"
    
    # Извлечение информации об инстансе
    INSTANCE_ID=$(echo "$RESPONSE" | grep -o '"instance_id":"[^"]*"' | cut -d'"' -f4)
    API_PORT=$(echo "$RESPONSE" | grep -o '"api":[0-9]*' | cut -d':' -f2)
    API_KEY=$(echo "$RESPONSE" | grep -o '"api_key":"[^"]*"' | cut -d'"' -f4)
    
    echo ""
    echo -e "${BLUE}📋 Информация об инстансе:${NC}"
    echo "  Instance ID: $INSTANCE_ID"
    echo "  API Port:    $API_PORT"
    echo "  API Key:     $API_KEY"
    echo ""
    
    if [ "$PROVIDER" = "whatsappweb" ]; then
        echo -e "${GREEN}📱 WhatsApp инстанс:${NC}"
        echo "  QR Code:     http://localhost:$API_PORT/api/v1/qr"
        echo "  Status:      http://localhost:$API_PORT/api/v1/status"
        echo "  Send Message: http://localhost:$API_PORT/api/v1/send"
        echo ""
        echo -e "${YELLOW}💡 Следующие шаги:${NC}"
        echo "1. Получите QR код: curl http://localhost:$API_PORT/api/v1/qr"
        echo "2. Отсканируйте QR код в WhatsApp"
        echo "3. Проверьте статус: curl http://localhost:$API_PORT/api/v1/status"
        echo "4. Отправьте сообщение:"
        echo "   curl -X POST http://localhost:$API_PORT/api/v1/send \\"
        echo "     -H 'Authorization: Bearer $API_KEY' \\"
        echo "     -H 'Content-Type: application/json' \\"
        echo "     -d '{\"to\":\"79001234567\",\"message\":\"Hello!\"}'"
    elif [ "$PROVIDER" = "telegram" ]; then
        echo -e "${GREEN}🤖 Telegram инстанс:${NC}"
        echo "  Bot Info:    http://localhost:$API_PORT/api/v1/bot/info"
        echo "  Send Message: http://localhost:$API_PORT/api/v1/send"
        echo ""
        echo -e "${YELLOW}💡 Следующие шаги:${NC}"
        echo "1. Проверьте бота: curl http://localhost:$API_PORT/api/v1/bot/info"
        echo "2. Отправьте сообщение:"
        echo "   curl -X POST http://localhost:$API_PORT/api/v1/send \\"
        echo "     -H 'Authorization: Bearer $API_KEY' \\"
        echo "     -H 'Content-Type: application/json' \\"
        echo "     -d '{\"chat_id\":\"@username\",\"text\":\"Hello!\"}'"
    fi
    
    echo ""
    echo -e "${GREEN}🔧 Управление инстансом:${NC}"
    echo "  Статус:      curl $INSTANCE_MANAGER_URL/api/v1/instances/$INSTANCE_ID"
    echo "  Удаление:    curl -X DELETE $INSTANCE_MANAGER_URL/api/v1/instances/$INSTANCE_ID"
    echo "  Все инстансы: curl $INSTANCE_MANAGER_URL/api/v1/instances"
    
else
    echo -e "${RED}❌ Ошибка создания инстанса!${NC}"
    echo ""
    echo -e "${YELLOW}Ответ сервера:${NC}"
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
    echo ""
    
    # Проверка логов
    echo -e "${YELLOW}💡 Проверьте логи Instance Manager:${NC}"
    echo "docker logs wweb-mcp-instance-manager-1 -f"
    exit 1
fi 