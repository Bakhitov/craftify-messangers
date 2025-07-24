# 🧪 РУКОВОДСТВО ПО ТЕСТИРОВАНИЮ ЭНДПОИНТОВ

Краткое руководство по тестированию всех актуальных API эндпоинтов проекта wweb-mcp.

## 🏗️ Запуск системы

### Запуск Instance Manager
```bash
# Development режим (рекомендуется для тестирования)
npm run dev

# Production режим через Docker
docker-compose -f docker-compose.instance-manager.yml up -d --build

# Проверка запуска
curl http://localhost:3000/health
```

## 📱 Instance Manager API (Порт 3000)

### Health Check
```bash
curl http://localhost:3000/health
```
**Ожидаемый ответ:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T12:00:00.000Z",
  "uptime": 120.5,
  "environment": "development",
  "version": "0.2.6-dev-hotreload-test"
}
```

### Получение списка доступных эндпоинтов
```bash
curl http://localhost:3000/api/v1/
```
**Ожидаемый ответ:**
```json
{
  "version": "v1",
  "endpoints": {
    "instances": "/api/v1/instances",
    "resources": "/api/v1/resources",
    "logs": "/api/v1/logs",
    "ports": "/api/v1/resources/ports",
    "performance": "/api/v1/resources/performance",
    "health": "/api/v1/resources/health",
    "stressTest": "/api/v1/resources/stress-test"
  }
}
```

### Создание WhatsApp экземпляра
```bash
curl -X POST http://localhost:3000/api/v1/instances \
-H "Content-Type: application/json" \
-d '{
  "user_id": "test-user-001", 
  "provider": "whatsappweb", 
  "type_instance": ["api"],
  "agno_config": {
    "enabled": true,
    "agent_id": "newnew_1752823885",
    "model": "gpt-4.1",
    "stream": false,
    "agnoUrl": "https://crafty-v0-0-1.onrender.com/v1/agents/newnew_1752823885/runs"
  }
}'
```
**Ожидаемый ответ:**
```json
{
  "success": true,
  "instance_id": "abc-123-def-456",
  "message": "Instance created and processing started",
  "process_result": {
    "action": "create",
    "details": {
      "provider": "whatsappweb",
      "port_api": 3567,
      "auth_status": "pending"
    }
  }
}
```

### Создание Telegram экземпляра
```bash
curl -X POST http://localhost:3000/api/v1/instances \
-H "Content-Type: application/json" \
-d '{
  "user_id": "test-telegram-001",
  "provider": "telegram",
  "type_instance": ["api"],
  "token": "7961413009:AAGEp-pakPC5OmvgTyXBLmNGoSlLdCAzg28",
  "agno_config": {
    "enabled": true,
    "agent_id": "newnew_1752823885",
    "model": "gpt-4.1",
    "stream": false,
    "agnoUrl": "https://crafty-v0-0-1.onrender.com/v1/agents/newnew_1752823885/runs"
  }
}'
```

### Получение информации об экземпляре
```bash
curl http://localhost:3000/api/v1/instances/INSTANCE_ID
```
**Ожидаемый ответ:**
```json
{
  "success": true,
  "instance": {
    "id": "abc-123-def-456",
    "user_id": "test-user-001",
    "provider": "whatsappweb",
    "status": "running",
    "auth_status": "qr_ready",
    "created_at": "2025-01-15T10:00:00.000Z",
    "port_api": 3567,
    "agno_config": {
      "enabled": true,
      "agent_id": "newnew_1752823885"
    }
  }
}
```

### Получение списка экземпляров
```bash
curl http://localhost:3000/api/v1/instances
```
**Ожидаемый ответ:**
```json
{
  "success": true,
  "instances": [
    {
      "id": "abc-123-def-456",
      "provider": "whatsappweb",
      "status": "running",
      "created_at": "2025-01-15T10:00:00.000Z"
    }
  ],
  "count": 1
}
```

### Получение QR кода (WhatsApp)
```bash
curl http://localhost:3000/api/v1/instances/INSTANCE_ID/qr
```
**Ожидаемый ответ:**
```json
{
  "success": true,
  "qr_code": "2@ABC123DEF456...",
  "qr_code_text": "██████████████\n███  ███  ███\n...",
  "auth_status": "qr_ready",
  "expires_in": 42
}
```

### Получение статуса аутентификации
```bash
curl http://localhost:3000/api/v1/instances/INSTANCE_ID/auth-status
```
**Ожидаемый ответ:**
```json
{
  "success": true,
  "auth_status": "qr_ready",
  "is_ready_for_messages": false,
  "last_qr_generated": "2025-01-15T10:15:30.123Z",
  "whatsapp_state": "QR_READY"
}
```

### Получение данных из памяти
```bash
curl http://localhost:3000/api/v1/instances/INSTANCE_ID/memory
```
**Ожидаемый ответ:**
```json
{
  "success": true,
  "data": {
    "status": "client_ready",
    "auth_status": "authenticated", 
    "api_key": "abc-123-def-456",
    "ports": {
      "api": 3567
    },
    "is_ready_for_messages": true,
    "message_stats": {
      "sent_count": 15,
      "received_count": 23
    }
  }
}
```

### Удаление экземпляра
```bash
curl -X DELETE http://localhost:3000/api/v1/instances/INSTANCE_ID
```
**Ожидаемый ответ:**
```json
{
  "success": true,
  "message": "Instance deleted successfully"
}
```

### Получение логов экземпляра
```bash
curl "http://localhost:3000/api/v1/instances/INSTANCE_ID/logs?tail=100"
```
**Ожидаемый ответ:**
```json
{
  "success": true,
  "logs": [
    "2025-01-15T10:15:30.123Z [INFO] WhatsApp client initialized",
    "2025-01-15T10:15:35.456Z [INFO] QR code generated"
  ],
  "container_status": "running"
}
```

### Получение логов Instance Manager
```bash
curl "http://localhost:3000/api/v1/logs?tail=100"
```
**Ожидаемый ответ:**
```json
{
  "success": true,
  "logs": [
    "2025-01-15T10:15:30.123Z [INFO] Instance Manager started on port 3000",
    "2025-01-15T10:15:35.456Z [INFO] Database connection established",
    "2025-01-15T10:16:00.789Z [INFO] Docker service initialized",
    "2025-01-15T10:16:30.123Z [INFO] Instance abc-123-def-456 created successfully"
  ],
  "file": "instance-manager.log",
  "total_lines": 1523
}
```

## 📊 Мониторинг ресурсов

### Общие ресурсы системы
```bash
curl http://localhost:3000/api/v1/resources
```
**Ожидаемый ответ:**
```json
{
  "success": true,
  "system": {
    "cpu_usage": "25.3%",
    "memory_usage": "2.1GB",
    "disk_usage": "45%"
  },
  "docker": {
    "running_containers": 3,
    "total_containers": 5
  }
}
```

### Использование портов
```bash
curl http://localhost:3000/api/v1/resources/ports
```
**Ожидаемый ответ:**
```json
{
  "success": true,
  "used_ports": [3000, 3567, 4521],
  "available_ports": [3568, 3569, 4522],
  "port_range": "3001-7999"
}
```

### Проверка здоровья системы
```bash
curl http://localhost:3000/api/v1/resources/health
```
**Ожидаемый ответ:**
```json
{
  "success": true,
  "status": "healthy",
  "services": {
    "database": true,
    "docker": true,
    "memory_service": true
  },
  "timestamp": "2025-01-15T12:00:00.000Z"
}
```

## 📱 WhatsApp API (Динамический порт)

### Health Check
```bash
curl -H "Authorization: Bearer INSTANCE_ID" \
  http://localhost:PORT/api/v1/health
```
**Ожидаемый ответ:**
```json
{
  "status": "healthy",
  "provider": "whatsapp",
  "timestamp": "2025-01-15T12:00:00.000Z"
}
```

### Получение статуса
```bash
curl -H "Authorization: Bearer INSTANCE_ID" \
  http://localhost:PORT/api/v1/status
```
**Ожидаемый ответ:**
```json
{
  "provider": "whatsapp",
  "status": "connected",
  "state": "READY",
  "info": {
    "me": {
      "id": {"_serialized": "79001234567@c.us"},
      "pushname": "John Doe"
    }
  }
}
```

### Отправка текстового сообщения
```bash
curl -X POST http://localhost:PORT/api/v1/send \
  -H "Authorization: Bearer INSTANCE_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "79001234567",
    "message": "Тестовое сообщение"
  }'
```
**Ожидаемый ответ:**
```json
{
  "success": true,
  "messageId": "false_79001234567@c.us_ABC123",
  "messageType": "text",
  "timestamp": "2025-01-15T12:00:00.000Z"
}
```

### Отправка медиа сообщения
```bash
curl -X POST http://localhost:PORT/api/v1/send \
  -H "Authorization: Bearer INSTANCE_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "79001234567",
    "source": "https://picsum.photos/400/300",
    "caption": "Тестовое изображение",
    "mediaType": "image"
  }'
```
**Ожидаемый ответ:**
```json
{
  "success": true,
  "messageId": "false_79001234567@c.us_DEF456",
  "messageType": "media",
  "mediaType": "image"
}
```

### Получение контактов
```bash
curl -H "Authorization: Bearer INSTANCE_ID" \
  http://localhost:PORT/api/v1/contacts
```
**Ожидаемый ответ:**
```json
{
  "success": true,
  "contacts": [
    {
      "id": {"_serialized": "79001234567@c.us"},
      "name": "John Doe",
      "pushname": "John",
      "isGroup": false
    }
  ]
}
```

### Получение чатов
```bash
curl -H "Authorization: Bearer INSTANCE_ID" \
  http://localhost:PORT/api/v1/chats
```
**Ожидаемый ответ:**
```json
{
  "success": true,
  "chats": [
    {
      "id": {"_serialized": "79001234567@c.us"},
      "name": "John Doe",
      "isGroup": false,
      "unreadCount": 0,
      "lastMessage": {
        "body": "Последнее сообщение",
        "timestamp": 1705312800
      }
    }
  ]
}
```

### Массовая рассылка
```bash
curl -X POST http://localhost:PORT/api/v1/send-bulk \
  -H "Authorization: Bearer INSTANCE_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "recipients": [
      {"to": "79001234567", "name": "Иван"},
      {"to": "79007654321", "name": "Мария"}
    ],
    "message": "Привет, {name}! Это массовое сообщение.",
    "delayBetweenMessages": 2000
  }'
```
**Ожидаемый ответ:**
```json
{
  "success": true,
  "bulk_id": "bulk_abc123",
  "total_recipients": 2,
  "status": "processing",
  "results": []
}
```

## 🤖 Telegram API (Динамический порт)

### Health Check
```bash
curl http://localhost:PORT/api/v1/telegram/health
```
**Ожидаемый ответ:**
```json
{
  "status": "healthy",
  "provider": "telegram",
  "timestamp": "2025-01-15T12:00:00.000Z"
}
```

### Информация о боте
```bash
curl -H "Authorization: Bearer BOT_TOKEN" \
  http://localhost:PORT/api/v1/telegram/me
```
**Ожидаемый ответ:**
```json
{
  "success": true,
  "bot": {
    "id": 7961413009,
    "is_bot": true,
    "first_name": "YourBotName",
    "username": "your_bot_username"
  }
}
```

### Отправка сообщения
```bash
curl -X POST http://localhost:PORT/api/v1/telegram/send \
  -H "Authorization: Bearer BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "134527512",
    "message": "Привет из Telegram API!"
  }'
```
**Ожидаемый ответ:**
```json
{
  "success": true,
  "message_id": 123,
  "chat_id": 134527512,
  "date": 1705312800
}
```

### Отправка медиа
```bash
curl -X POST http://localhost:PORT/api/v1/telegram/send-media \
  -H "Authorization: Bearer BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "134527512",
    "source": "https://picsum.photos/400/300",
    "caption": "🖼️ Тестовое изображение"
  }'
```
**Ожидаемый ответ:**
```json
{
  "success": true,
  "message_id": 124,
  "photo": [
    {
      "file_id": "AgACAgIAAxkBAAIBY2R...",
      "width": 400,
      "height": 300
    }
  ]
}
```

### Получение чатов
```bash
curl -H "Authorization: Bearer BOT_TOKEN" \
  http://localhost:PORT/api/v1/telegram/chats
```
**Ожидаемый ответ:**
```json
{
  "success": true,
  "chats": [
    {
      "id": 134527512,
      "type": "private",
      "first_name": "John",
      "username": "john_doe"
    }
  ]
}
```

### Массовая рассылка Telegram
```bash
curl -X POST http://localhost:PORT/api/v1/telegram/send-bulk \
  -H "Authorization: Bearer BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipients": [
      {"to": "134527512", "name": "Пользователь1"},
      {"to": "987654321", "name": "Пользователь2"}
    ],
    "message": "🚀 Привет, {name}! Массовое уведомление от бота.",
    "delayBetweenMessages": 1000
  }'
```
**Ожидаемый ответ:**
```json
{
  "success": true,
  "bulk_id": "tg_bulk_xyz789",
  "total_recipients": 2,
  "status": "processing"
}
```

## 🌐 Multi-Provider Webhooks

### WhatsApp Webhook
```bash
curl -X POST http://localhost:3000/api/v1/webhook/whatsappweb/INSTANCE_ID \
  -H "Content-Type: application/json" \
  -d '{
    "event": "message",
    "data": {
      "from": "79001234567@c.us",
      "body": "Входящее сообщение"
    }
  }'
```

### Telegram Webhook
```bash
curl -X POST http://localhost:3000/api/v1/webhook/telegram/INSTANCE_ID \
  -H "Content-Type: application/json" \
  -d '{
    "update_id": 123,
    "message": {
      "message_id": 456,
      "from": {"id": 134527512},
      "text": "Входящее сообщение"
    }
  }'
```

## 🔧 Управление экземплярами

### Запуск экземпляра
```bash
curl -X POST http://localhost:3000/api/v1/instances/INSTANCE_ID/start
```

### Остановка экземпляра
```bash
curl -X POST http://localhost:3000/api/v1/instances/INSTANCE_ID/stop
```

### Перезапуск экземпляра
```bash
curl -X POST http://localhost:3000/api/v1/instances/INSTANCE_ID/restart
```

## 🚨 Типичные ошибки

### Ошибка 401 - Unauthorized
```json
{
  "error": "Missing or invalid Authorization header"
}
```
**Решение**: Добавить заголовок `Authorization: Bearer API_KEY`

### Ошибка 503 - Service Unavailable
```json
{
  "error": "WhatsApp client not ready"
}
```
**Решение**: Дождаться готовности клиента или проверить аутентификацию

### Ошибка 404 - Not Found
```json
{
  "success": false,
  "error": "Instance not found"
}
```
**Решение**: Проверить правильность INSTANCE_ID

### Ошибка 429 - Rate Limit
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 60
}
```
**Решение**: Подождать указанное время перед повторным запросом

---

**Примечание**: Замените `INSTANCE_ID`, `PORT`, `BOT_TOKEN` на актуальные значения из ваших экземпляров. 