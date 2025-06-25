# Multi-Provider API Documentation

## Обзор

Мультипровайдерная система поддерживает интеграцию с различными мессенджерами через единый API. Все провайдеры работают на одном порту и управляются через единые эндпоинты.

## Поддерживаемые провайдеры

- **Telegram** - через Bot API
- **WhatsApp Official** - через Facebook Graph API
- **Facebook Messenger** - через Facebook Graph API  
- **Instagram** - через Instagram Basic Display API
- **Slack** - через Slack Web API
- **Discord** - через Discord.js

## Base URL

Все API эндпоинты доступны по адресу:
```
http://localhost:3000/api/v1/multi-provider
```

## Authentication

Все запросы требуют заголовок авторизации:
```
Authorization: Bearer YOUR_API_TOKEN
```

## Эндпоинты

### 1. Создание инстанса провайдера

**POST** `/instances`

Создает новый инстанс провайдера.

#### Request Body:

```json
{
  "provider": "telegram|whatsapp-official|facebook-messenger|instagram|slack|discord",
  "config": {
    // Конфигурация специфичная для провайдера
  }
}
```

#### Примеры конфигураций:

**Telegram:**
```json
{
  "provider": "telegram",
  "config": {
    "botToken": "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    "webhookUrl": "https://yourdomain.com/api/v1/webhook/telegram/INSTANCE_ID",
    "authStrategy": "none",
    "authDataPath": "./auth/telegram",
    "dockerContainer": false
  }
}
```

**WhatsApp Official:**
```json
{
  "provider": "whatsapp-official",
  "config": {
    "phoneNumberId": "1234567890",
    "accessToken": "EAAxxxxxxxxxxxxx",
    "webhookVerifyToken": "your_verify_token",
    "version": "v18.0",
    "authStrategy": "none",
    "authDataPath": "./auth/whatsapp-official",
    "dockerContainer": false
  }
}
```

**Facebook Messenger:**
```json
{
  "provider": "facebook-messenger",
  "config": {
    "pageAccessToken": "EAAxxxxxxxxxxxxx",
    "appSecret": "your_app_secret",
    "webhookVerifyToken": "your_verify_token",
    "version": "v18.0",
    "authStrategy": "none",
    "authDataPath": "./auth/facebook-messenger",
    "dockerContainer": false
  }
}
```

**Instagram:**
```json
{
  "provider": "instagram",
  "config": {
    "accessToken": "IGQVxxxxxxxxxxxxx",
    "instagramUserId": "1234567890",
    "appSecret": "your_app_secret",
    "webhookVerifyToken": "your_verify_token",
    "authStrategy": "none",
    "authDataPath": "./auth/instagram",
    "dockerContainer": false
  }
}
```

**Slack:**
```json
{
  "provider": "slack",
  "config": {
    "botToken": "xoxb-xxxxxxxxxxxxx",
    "appToken": "xapp-xxxxxxxxxxxxx",
    "signingSecret": "your_signing_secret",
    "socketMode": false,
    "webhookUrl": "https://yourdomain.com/api/v1/webhook/slack/INSTANCE_ID",
    "authStrategy": "none",
    "authDataPath": "./auth/slack",
    "dockerContainer": false
  }
}
```

**Discord:**
```json
{
  "provider": "discord",
  "config": {
    "botToken": "ODxxxxxxxxxxxxx.Yxxxxx.Zxxxxxxxxxxxxxxxxxxxxx",
    "clientId": "1234567890",
    "guildId": "9876543210",
    "intents": [1, 512, 32768],
    "authStrategy": "none",
    "authDataPath": "./auth/discord",
    "dockerContainer": false
  }
}
```

#### Response:
```json
{
  "instanceId": "telegram_1703123456789_abc123",
  "provider": "telegram",
  "status": "created"
}
```

### 2. Список инстансов

**GET** `/instances?provider=telegram`

Получает список всех инстансов или инстансов определенного провайдера.

#### Response:
```json
{
  "instances": [
    {
      "instance_id": "telegram_1703123456789_abc123",
      "provider_type": "telegram",
      "status": "ready",
      "created_at": "2023-12-21T10:30:00Z",
      "updated_at": "2023-12-21T10:30:00Z"
    }
  ],
  "total": 1
}
```

### 3. Статус инстанса

**GET** `/instances/{provider}/{instanceId}/status`

Получает текущий статус инстанса провайдера.

#### Response:
```json
{
  "provider": "telegram",
  "status": "ready",
  "state": "READY",
  "info": {
    "id": 123456789,
    "firstName": "Bot Name",
    "username": "your_bot",
    "isBot": true
  }
}
```

### 4. Отправка сообщения

**POST** `/instances/{provider}/{instanceId}/send-message`

Отправляет текстовое сообщение.

#### Request Body:
```json
{
  "to": "user_id_or_chat_id",
  "message": "Привет! Это сообщение от бота."
}
```

#### Response:
```json
{
  "success": true,
  "messageId": "msg_123456789",
  "to": "user_id_or_chat_id",
  "provider": "telegram"
}
```

### 5. Отправка медиа

**POST** `/instances/{provider}/{instanceId}/send-media`

Отправляет медиа файл (изображение, видео, аудио, документ).

#### Request Body:
```json
{
  "to": "user_id_or_chat_id",
  "mediaUrl": "https://example.com/image.jpg",
  "caption": "Описание изображения"
}
```

#### Response:
```json
{
  "success": true,
  "messageId": "msg_123456790",
  "to": "user_id_or_chat_id",
  "mediaUrl": "https://example.com/image.jpg",
  "caption": "Описание изображения",
  "provider": "telegram"
}
```

### 6. Получение контактов

**GET** `/instances/{provider}/{instanceId}/contacts`

Получает список контактов (если поддерживается провайдером).

#### Response:
```json
{
  "contacts": [
    {
      "id": "123456789",
      "name": "John Doe",
      "username": "john_doe",
      "provider": "telegram"
    }
  ],
  "total": 1,
  "provider": "telegram"
}
```

### 7. Получение чатов

**GET** `/instances/{provider}/{instanceId}/chats`

Получает список чатов (если поддерживается провайдером).

#### Response:
```json
{
  "chats": [
    {
      "id": "chat123456789",
      "name": "Группа разработчиков",
      "type": "group",
      "memberCount": 15,
      "provider": "telegram"
    }
  ],
  "total": 1,
  "provider": "telegram"
}
```

### 8. Удаление инстанса

**DELETE** `/instances/{provider}/{instanceId}`

Удаляет инстанс провайдера.

#### Response:
```json
{
  "instanceId": "telegram_1703123456789_abc123",
  "provider": "telegram",
  "status": "deleted"
}
```

### 9. Статистика

**GET** `/stats`

Получает статистику по всем провайдерам.

#### Response:
```json
{
  "stats": {
    "Telegram": {
      "count": 2,
      "instances": ["telegram_1703123456789_abc123", "telegram_1703123456790_def456"]
    },
    "WhatsAppOfficial": {
      "count": 1,
      "instances": ["whatsapp-official_1703123456791_ghi789"]
    }
  },
  "timestamp": "2023-12-21T10:30:00Z"
}
```

### 10. Активные провайдеры

**GET** `/active-providers`

Получает список всех активных инстансов провайдеров.

#### Response:
```json
{
  "activeProviders": [
    "telegram_1703123456789_abc123",
    "whatsapp-official_1703123456791_ghi789"
  ],
  "total": 2
}
```

## Webhooks

Каждый провайдер имеет свой webhook endpoint:

### Telegram
```
POST /api/v1/webhook/telegram/{instanceId}
```

### WhatsApp Official
```
POST /api/v1/webhook/whatsapp-official/{instanceId}
GET /api/v1/webhook/whatsapp-official/{instanceId} (verification)
```

### Facebook Messenger
```
POST /api/v1/webhook/facebook-messenger/{instanceId}
```

### Instagram
```
POST /api/v1/webhook/instagram/{instanceId}
```

### Slack
```
POST /api/v1/webhook/slack/{instanceId}
```

### Discord
Discord использует WebSocket соединение, webhooks не требуются.

## Примеры использования

### Создание Telegram бота

```bash
curl -X POST http://localhost:3000/api/v1/multi-provider/instances \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "provider": "telegram",
    "config": {
      "botToken": "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      "authStrategy": "none",
      "authDataPath": "./auth/telegram",
      "dockerContainer": false
    }
  }'
```

### Отправка сообщения

```bash
curl -X POST http://localhost:3000/api/v1/multi-provider/instances/telegram/telegram_1703123456789_abc123/send-message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "to": "123456789",
    "message": "Привет из Telegram бота!"
  }'
```

### Отправка изображения

```bash
curl -X POST http://localhost:3000/api/v1/multi-provider/instances/telegram/telegram_1703123456789_abc123/send-media \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "to": "123456789",
    "mediaUrl": "https://example.com/image.jpg",
    "caption": "Красивое изображение"
  }'
```

## Коды ошибок

| Код | Описание |
|-----|----------|
| 400 | Неверные параметры запроса |
| 401 | Неавторизованный доступ |
| 404 | Провайдер или инстанс не найден |
| 500 | Внутренняя ошибка сервера |

## События и webhook'и

Все провайдеры отправляют унифицированные события:

```json
{
  "instanceId": "telegram_1703123456789_abc123",
  "messageId": "msg_123456789",
  "from": "123456789",
  "to": "987654321",
  "body": "Текст сообщения",
  "type": "text",
  "timestamp": "2023-12-21T10:30:00Z",
  "fromMe": false,
  "contact": "John Doe",
  "provider": "telegram"
}
```

## Ограничения провайдеров

### Telegram
- ✅ Отправка/получение сообщений
- ✅ Медиа файлы
- ✅ Группы и каналы  
- ✅ Webhooks

### WhatsApp Official  
- ✅ Отправка/получение сообщений
- ✅ Медиа файлы
- ❌ Список контактов
- ❌ Список чатов
- ✅ Webhooks

### Facebook Messenger
- ✅ Отправка/получение сообщений
- ✅ Изображения
- ❌ Список контактов
- ❌ Список чатов  
- ✅ Webhooks

### Instagram
- ✅ Отправка/получение сообщений
- ✅ Изображения
- ❌ Список контактов
- ❌ Список чатов
- ✅ Webhooks

### Slack
- ✅ Отправка/получение сообщений
- ✅ Файлы
- ✅ Список пользователей
- ✅ Список каналов
- ✅ Webhooks

### Discord
- ✅ Отправка/получение сообщений  
- ✅ Файлы
- ✅ Список пользователей
- ✅ Список каналов
- ❌ Webhooks (использует WebSocket)

## Дополнительные настройки

### Настройка database

Для корректной работы необходимо настроить переменные окружения:

```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=whatsapp_mcp
DATABASE_USER=postgres
DATABASE_PASSWORD=password
DATABASE_SCHEMA=public
```

### Docker

Сервис можно запустить в Docker:

```bash
docker-compose up -d --build
```

### Логирование

Уровень логирования настраивается через:

```env
LOG_LEVEL=info
```

Доступные уровни: `error`, `warn`, `info`, `debug` 