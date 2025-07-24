# Instance Manager API

Документация по использованию Instance Manager API для создания и управления инстансами WhatsApp и Telegram.

## Базовый URL

По умолчанию Instance Manager API работает на порту 3000:
```
http://localhost:3000
```

## Создание инстансов

### Создание WhatsApp инстанса

**Endpoint:** `POST /api/v1/instances`

**Request Body:**
```json
{
  "company_id": "user-001",
  "provider": "whatsappweb",
  "type_instance": ["api"],
  "api_webhook_schema": {
    "url": "https://webhook.example.com/whatsapp",
    "headers": {
      "Authorization": "Bearer your-token"
    },
    "enabled": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "instance_id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Instance created successfully",
  "process_result": {
    "success": true,
    "details": {
      "ports": {
        "api": 8080
      },
      "api_key": "abc123def456"
    }
  }
}
```

### Создание Telegram инстанса

**Endpoint:** `POST /api/v1/instances`

**Request Body:**
```json
{
  "company_id": "user-002",
  "provider": "telegram",
  "type_instance": ["api"],
  "config": {
    "bot_token": "123456789:AABBCCDDEEFFgghhiijjkkll"
  },
  "api_webhook_schema": {
    "url": "https://webhook.example.com/telegram",
    "headers": {
      "Authorization": "Bearer your-token"
    },
    "enabled": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "instance_id": "550e8400-e29b-41d4-a716-446655440001",
  "message": "Instance created successfully",
  "process_result": {
    "success": true,
    "details": {
      "ports": {
        "api": 8081
      },
      "api_key": "xyz789uvw012"
    }
  }
}
```

## Управление инстансами

### Получить список всех инстансов

**Endpoint:** `GET /api/v1/instances`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "company_id": "user-001",
      "provider": "whatsappweb",
      "type_instance": ["api"],
      "status": "client_ready",
      "auth_status": "authenticated",
      "ports": {
        "api": 8080
      },
      "account": "+1234567890",
      "created_at": "2024-01-01T12:00:00Z",
      "updated_at": "2024-01-01T12:05:00Z"
    }
  ]
}
```

### Получить информацию об инстансе

**Endpoint:** `GET /api/v1/instances/{instanceId}`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "company_id": "user-001",
    "provider": "whatsappweb",
    "type_instance": ["api"],
    "status": "client_ready",
    "auth_status": "authenticated",
    "ports": {
      "api": 8080
    },
    "account": "+1234567890",
    "created_at": "2024-01-01T12:00:00Z",
    "updated_at": "2024-01-01T12:05:00Z"
  }
}
```

### Получить API ключ инстанса

**Endpoint:** `GET /api/v1/instances/{instanceId}/current-api-key`

**Response:**
```json
{
  "success": true,
  "data": {
    "api_key": "abc123def456",
    "generated_at": "2024-01-01T12:00:00Z",
    "last_use": "2024-01-01T12:30:00Z",
    "usage_count": 42
  }
}
```

### Запустить инстанс

**Endpoint:** `POST /api/v1/instances/{instanceId}/start`

**Response:**
```json
{
  "success": true,
  "message": "Instance started successfully"
}
```

### Остановить инстанс

**Endpoint:** `POST /api/v1/instances/{instanceId}/stop`

**Response:**
```json
{
  "success": true,
  "message": "Instance stopped successfully"
}
```

### Перезапустить инстанс

**Endpoint:** `POST /api/v1/instances/{instanceId}/restart`

**Response:**
```json
{
  "success": true,
  "message": "Instance restarted successfully"
}
```

### Удалить инстанс

**Endpoint:** `DELETE /api/v1/instances/{instanceId}`

**Response:**
```json
{
  "success": true,
  "message": "Instance deleted successfully"
}
```

## Аутентификация WhatsApp

### Получить QR код

**Endpoint:** `GET /api/v1/instances/{instanceId}/qr`

**Response:**
```json
{
  "success": true,
  "data": {
    "qr_url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "url": "https://wa.me/qr/ABC123DEF456"
  }
}
```

### Проверить статус аутентификации

**Endpoint:** `GET /api/v1/instances/{instanceId}/auth-status`

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "authenticated",
    "authenticated": true,
    "account": "+1234567890"
  }
}
```

## Логи

### Получить логи инстанса

**Endpoint:** `GET /api/v1/instances/{instanceId}/logs?tail=100`

**Response:**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "timestamp": "2024-01-01T12:00:00Z",
        "level": "info",
        "message": "WhatsApp client initialized",
        "source": "whatsapp-provider"
      },
      {
        "timestamp": "2024-01-01T12:01:00Z",
        "level": "debug",
        "message": "QR code generated",
        "source": "auth-handler"
      }
    ],
    "total_lines": 1000,
    "tail": 100
  }
}
```

## Использование с JavaScript/TypeScript

### Установка зависимости

```bash
npm install axios
```

### Пример использования

```typescript
import { InstanceManagerClient } from './utils/instance-manager.client';

// Создание клиента
const client = new InstanceManagerClient('http://localhost:3000');

// Создание WhatsApp инстанса
const whatsappInstanceId = await client.createWhatsAppInstance('user-001', {
  url: 'https://webhook.example.com/whatsapp',
  headers: { 'Authorization': 'Bearer token' }
});

// Создание Telegram инстанса
const telegramInstanceId = await client.createTelegramInstance(
  'user-002', 
  '123456789:AABBCCDDEEFFgghhiijjkkll',
  { url: 'https://webhook.example.com/telegram' }
);

// Получение API ключа
const apiKey = await client.getInstanceApiKey(whatsappInstanceId);

// Получение QR кода для WhatsApp
const qrCode = await client.getQRCode(whatsappInstanceId);

// Проверка статуса
const authStatus = await client.getAuthStatus(whatsappInstanceId);

// Управление инстансами
await client.startInstance(whatsappInstanceId);
await client.stopInstance(whatsappInstanceId);
await client.restartInstance(whatsappInstanceId);

// Получение логов
const logs = await client.getInstanceLogs(whatsappInstanceId, 50);

// Удаление инстанса
await client.deleteInstance(whatsappInstanceId);
```

### Глобальный клиент

Можно использовать предконфигурированный глобальный экземпляр:

```typescript
import { instanceManagerClient } from './utils/instance-manager.client';

// Установка базового URL
instanceManagerClient.setBaseUrl('http://your-server:3000');

// Использование
const instances = await instanceManagerClient.getAllInstances();
```

## Webhook интеграция

При создании инстанса можно указать webhook URL для получения входящих сообщений:

```json
{
  "api_webhook_schema": {
    "url": "https://your-server.com/webhook/messages",
    "headers": {
      "Authorization": "Bearer your-secret-token",
      "Content-Type": "application/json"
    },
    "enabled": true
  }
}
```

### Структура webhook сообщения

```json
{
  "instance_id": "550e8400-e29b-41d4-a716-446655440000",
  "provider": "whatsappweb",
  "message": {
    "id": "message-123",
    "body": "Hello, World!",
    "fromMe": false,
    "timestamp": "2024-01-01T12:00:00Z",
    "contact": "John Doe (+1234567890)",
    "type": "text",
    "chatId": "1234567890@c.us"
  }
}
```

## Коды статусов инстансов

| Статус | Описание |
|--------|----------|
| `start` | Инстанс запускается |
| `qr_ready` | QR код готов для сканирования (только WhatsApp) |
| `client_ready` | Клиент готов к работе |
| `authenticated` | Аутентификация пройдена |
| `stopped` | Инстанс остановлен |
| `error` | Ошибка в работе инстанса |

## Коды статусов аутентификации

| Статус | Описание |
|--------|----------|
| `pending` | Ожидание аутентификации |
| `qr_ready` | QR код готов (только WhatsApp) |
| `authenticated` | Аутентификация пройдена |
| `failed` | Ошибка аутентификации |
| `disconnected` | Соединение потеряно |

## Обработка ошибок

API возвращает стандартные HTTP коды статусов:

- `200` - Успешная операция
- `400` - Неверный запрос
- `401` - Неавторизованный доступ  
- `404` - Ресурс не найден
- `500` - Внутренняя ошибка сервера

Пример ответа с ошибкой:

```json
{
  "success": false,
  "error": "Instance not found",
  "code": "INSTANCE_NOT_FOUND"
}
```

## Лимиты и ограничения

- Максимальное количество инстансов на пользователя: 10
- Таймаут для операций создания/удаления: 30 секунд
- Максимальный размер webhook payload: 1MB
- Частота webhook запросов: до 100 сообщений в секунду

## Мониторинг

### Health check

**Endpoint:** `GET /api/health`

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### Проверка доступности

```typescript
const isAvailable = await client.ping();
console.log('API доступен:', isAvailable);
``` 