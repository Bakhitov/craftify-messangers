# Эндпоинты для получения списка инстансов и сообщений

## Обзор

Данный документ описывает все доступные эндпоинты для получения списка инстансов и сообщений, а также логику фильтрации по `company_id`.

## Базовые URL

- **Instance Manager API**: `http://localhost:3000`
- **Individual Instance API**: `http://localhost:{instance_port}` (обычно 8080+)

## 1. Эндпоинты для получения списка инстансов

### 1.1 Instance Manager API (порт 3000)

#### GET /api/v1/instances
**Описание**: Получить список всех инстансов с фильтрацией по company_id

**URL**: `http://localhost:3000/api/v1/instances`

**Параметры запроса**:
- `company_id` (string, optional) - фильтр по ID компании
- `provider` (string, optional) - фильтр по провайдеру (whatsappweb, telegram)

**Пример запроса**:
```bash
GET /api/v1/instances?company_id=user-001&provider=whatsappweb
```

**Ответ**:
```json
{
  "success": true,
  "instances": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "company_id": "user-001",
      "provider": "whatsappweb",
      "type_instance": ["api"],
      "status": "running",
      "auth_status": "authenticated",
      "ports": { "api": 8080 },
      "account": "+1234567890",
      "created_at": "2024-01-01T12:00:00Z",
      "updated_at": "2024-01-01T12:05:00Z",
      "memory_status": "active",
      "is_ready_for_messages": true,
      "last_activity": "2024-01-01T12:05:00Z",
      "whatsapp_user": { "name": "User Name", "phone": "+1234567890" },
      "message_stats": { "sent": 10, "received": 15 }
    }
  ],
  "total": 1
}
```

**Реализация**: `src/instance-manager/api/v1/instances.ts:154-207`

#### GET /api/v1/instances/:id
**Описание**: Получить информацию об одном инстансе

**URL**: `http://localhost:3000/api/v1/instances/{instanceId}`

**Ответ**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "company_id": "user-001",
    "provider": "whatsappweb",
    "status": "running",
    "auth_status": "authenticated"
  }
}
```

#### GET /api/v1/instances/batch/status
**Описание**: Получить статус множественных инстансов

**URL**: `http://localhost:3000/api/v1/instances/batch/status`

**Параметры запроса**:
- `instance_ids` (array) - массив ID инстансов
- `company_id` (string, optional) - фильтр по company_id

**Пример запроса**:
```bash
POST /api/v1/instances/batch/status
{
  "instance_ids": ["id1", "id2"],
  "company_id": "user-001"
}
```

#### GET /api/v1/resources/instances
**Описание**: Получить информацию о ресурсах инстансов (с кэшированием)

**URL**: `http://localhost:3000/api/v1/resources/instances`

### 1.2 Multi-Provider API

#### GET /api/v1/multi-provider/instances
**Описание**: Список инстансов провайдеров

**URL**: `http://localhost:3000/api/v1/multi-provider/instances`

**Параметры запроса**:
- `provider` (string, optional) - фильтр по типу провайдера

**Поддерживаемые провайдеры**:
- `telegram`
- `whatsapp-official`
- `facebook-messenger`
- `instagram`
- `slack`
- `discord`

## 2. Эндпоинты для получения списка сообщений

### 2.1 Сообщения из WhatsApp (в реальном времени)

#### GET /api/v1/messages/:number
**Описание**: Получить сообщения из конкретного чата WhatsApp

**URL**: `http://localhost:{instance_port}/api/v1/messages/{phoneNumber}`

**Параметры запроса**:
- `limit` (integer, default: 10) - количество сообщений для получения

**Пример запроса**:
```bash
GET /api/v1/messages/1234567890?limit=20
```

**Ответ**:
```json
[
  {
    "id": "msg_001",
    "from": "1234567890",
    "to": "0987654321",
    "body": "Hello World",
    "timestamp": 1640995200,
    "type": "text",
    "isGroup": false
  }
]
```

**Реализация**: `src/api.ts:221`

#### GET /api/v1/groups/:groupId/messages
**Описание**: Получить сообщения из группы WhatsApp

**URL**: `http://localhost:{instance_port}/api/v1/groups/{groupId}/messages`

**Параметры запроса**:
- `limit` (integer, default: 10) - количество сообщений

**Пример запроса**:
```bash
GET /api/v1/groups/120363043799655055@g.us/messages?limit=15
```

**Реализация**: `src/api.ts:583`

### 2.2 Сохраненные сообщения из БД

#### GET /api/v1/stored-messages
**Описание**: Получить сохраненные сообщения для инстанса из PostgreSQL

**URL**: `http://localhost:{instance_port}/api/v1/stored-messages`

**Параметры запроса**:
- `chatId` (string, optional) - фильтр по ID чата
- `limit` (integer, default: 50) - количество сообщений
- `offset` (integer, default: 0) - смещение для пагинации
- `isGroup` (boolean, optional) - фильтр по групповым сообщениям

**Пример запроса**:
```bash
GET /api/v1/stored-messages?chatId=1234567890&limit=100&offset=0&isGroup=false
```

**Ответ**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "instance_id": "550e8400-e29b-41d4-a716-446655440000",
      "message_id": "msg_001",
      "chat_id": "1234567890",
      "from_me": false,
      "author": "1234567890",
      "body": "Hello World",
      "timestamp": "2024-01-01T12:00:00Z",
      "message_type": "text",
      "is_group": false,
      "group_name": null,
      "participant": null
    }
  ],
  "count": 1,
  "pagination": {
    "limit": 50,
    "offset": 0
  }
}
```

**Реализация**: `src/api.ts:1155`

#### GET /api/v1/stored-messages/stats
**Описание**: Получить статистику сообщений для инстанса

**URL**: `http://localhost:{instance_port}/api/v1/stored-messages/stats`

**Ответ**:
```json
{
  "success": true,
  "data": {
    "total_messages": 1500,
    "text_messages": 1200,
    "media_messages": 300,
    "group_messages": 800,
    "private_messages": 700,
    "today_messages": 50,
    "this_week_messages": 200,
    "this_month_messages": 500
  }
}
```

**Реализация**: `src/api.ts:1205`

### 2.3 Telegram сообщения

#### GET /api/v1/messages/recent
**Описание**: Получить последние сообщения Telegram

**URL**: `http://localhost:{instance_port}/api/v1/messages/recent`

**Параметры запроса**:
- `limit` (integer, default: 10) - количество сообщений

**Реализация**: `src/telegram-api.ts:594`

## 3. Логика фильтрации по company_id

### 3.1 Фильтрация инстансов по company_id

#### Текущая реализация

В `src/instance-manager/api/v1/instances.ts` уже реализована фильтрация:

```typescript
// GET /api/v1/instances
const filters = {
  company_id: req.query.company_id as string,
  provider: req.query.provider as string,
};

const instances = await databaseService.getAllInstances(filters);
```

#### Расширение фильтрации

Для более гибкой фильтрации можно добавить дополнительные параметры:

```typescript
const filters = {
  company_id: req.query.company_id as string,
  provider: req.query.provider as string,
  status: req.query.status as string,
  auth_status: req.query.auth_status as string,
  created_after: req.query.created_after as string,
  created_before: req.query.created_before as string,
};
```

### 3.2 Добавление company_id к инстансам

#### При создании инстанса

В `src/instance-manager/api/v1/instances.ts` при создании инстанса:

```typescript
// POST /api/v1/instances
const instanceData = {
  id: instanceId,
  company_id: req.body.company_id || 'default', // обязательное поле
  provider: req.body.provider,
  type_instance: req.body.type_instance,
  config: req.body.config,
  created_at: new Date(),
  updated_at: new Date()
};
```

#### Обновление существующих инстансов

Для добавления company_id к существующим инстансам:

```sql
-- Миграция для добавления company_id к существующим записям
UPDATE message_instances 
SET company_id = 'default' 
WHERE company_id IS NULL;
```

### 3.3 Фильтрация сообщений по company_id

#### Получение инстансов компании

Сначала получаем все инстансы компании:

```typescript
async getMessagesByCompany(companyId: string, options: {
  limit?: number;
  offset?: number;
  chatId?: string;
  isGroup?: boolean;
}): Promise<StoredMessage[]> {
  try {
    // Сначала получаем все инстансы компании
    const instances = await this.databaseService.getAllInstances({
      company_id: companyId
    });
    
    const instanceIds = instances.map(i => i.id);
    
    if (instanceIds.length === 0) {
      return [];
    }
    
    // Затем получаем сообщения для всех инстансов компании
    let query = `
      SELECT * FROM ${this.schema}.messages 
      WHERE instance_id = ANY($1)
    `;
    const params: any[] = [instanceIds];
    let paramIndex = 2;

    if (options.chatId) {
      query += ` AND chat_id = $${paramIndex}`;
      params.push(options.chatId);
      paramIndex++;
    }

    if (options.isGroup !== undefined) {
      query += ` AND is_group = $${paramIndex}`;
      params.push(options.isGroup);
      paramIndex++;
    }

    query += ' ORDER BY timestamp DESC';

    if (options.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(options.limit);
      paramIndex++;
    }

    if (options.offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(options.offset);
    }

    const result = await this.pool.query<StoredMessage>(query, params);
    return result.rows;
  } catch (error) {
    logger.error('Failed to get messages by company', {
      error: error instanceof Error ? error.message : String(error),
      companyId,
      options,
    });
    return [];
  }
}
```

#### Новый эндпоинт для сообщений компании

```typescript
// GET /api/v1/company/:companyId/messages
router.get('/company/:companyId/messages', async (req: Request, res: Response) => {
  try {
    const companyId = req.params.companyId;
    const chatId = req.query.chatId as string;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const isGroup = req.query.isGroup === 'true' ? true : 
                   req.query.isGroup === 'false' ? false : undefined;

    const messages = await messageStorageService.getMessagesByCompany(companyId, {
      chatId,
      limit,
      offset,
      isGroup,
    });

    res.json({
      success: true,
      data: messages,
      count: messages.length,
      pagination: {
        limit,
        offset,
      },
      company_id: companyId
    });
  } catch (error) {
    logger.error('Failed to get company messages', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get company messages',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});
```

## 4. Примеры использования

### 4.1 Получить все инстансы компании

```bash
curl -X GET "http://localhost:3000/api/v1/instances?company_id=user-001"
```

### 4.2 Получить сообщения конкретного инстанса

```bash
curl -X GET "http://localhost:8080/api/v1/stored-messages?limit=100&offset=0"
```

### 4.3 Получить все сообщения компании (предлагаемый эндпоинт)

```bash
curl -X GET "http://localhost:3000/api/v1/company/user-001/messages?limit=100"
```

### 4.4 Фильтрация по нескольким параметрам

```bash
curl -X GET "http://localhost:3000/api/v1/instances?company_id=user-001&provider=whatsappweb&status=running"
```

## 5. Схема базы данных

### 5.1 Таблица message_instances

```sql
CREATE TABLE message_instances (
    id UUID PRIMARY KEY,
    company_id VARCHAR(255) NOT NULL,  -- ID компании
    provider VARCHAR(50) NOT NULL,     -- whatsappweb, telegram, etc.
    type_instance TEXT[],              -- ['api', 'webhook']
    port_api INTEGER,                  -- порт для API
    port_mcp INTEGER,                  -- порт для MCP
    api_key VARCHAR,                   -- API ключ
    api_key_generated_at TIMESTAMP,    -- время генерации API ключа
    last_qr_generated_at TIMESTAMP,    -- время последней генерации QR кода
    api_webhook_schema JSONB,          -- схема webhook для API
    mcp_schema JSONB,                  -- схема MCP
    agno_config JSONB,                 -- конфигурация Agno
    auth_status VARCHAR(50),           -- authenticated, pending, failed, qr_ready, client_ready
    account TEXT,                      -- номер телефона или username
    whatsapp_state TEXT,               -- состояние WhatsApp
    token TEXT,                        -- токен
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Индексы для быстрой фильтрации
CREATE INDEX idx_message_instances_company_id ON message_instances(company_id);
CREATE INDEX idx_message_instances_provider ON message_instances(provider);
CREATE INDEX idx_message_instances_auth_status ON message_instances(auth_status);
```

### 5.2 Таблица messages

```sql
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    instance_id UUID NOT NULL REFERENCES message_instances(id),
    message_id VARCHAR(255) NOT NULL,
    chat_id VARCHAR(255) NOT NULL,
    from_me BOOLEAN NOT NULL,
    author VARCHAR(255),
    body TEXT,
    timestamp TIMESTAMP NOT NULL,
    message_type VARCHAR(50),
    is_group BOOLEAN DEFAULT FALSE,
    group_name VARCHAR(255),
    participant VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX idx_messages_instance_id ON messages(instance_id);
CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX idx_messages_is_group ON messages(is_group);

-- Композитный индекс для фильтрации по company_id через instance_id
CREATE INDEX idx_messages_instance_chat ON messages(instance_id, chat_id);
```

## 6. Заключение

Данная документация описывает все доступные эндпоинты для работы с инстансами и сообщениями. Фильтрация по `company_id` уже реализована для инстансов и может быть легко расширена для сообщений через связь с таблицей инстансов.

Для полной реализации фильтрации сообщений по `company_id` рекомендуется:

1. Добавить новый эндпоинт `/api/v1/company/:companyId/messages`
2. Расширить существующие методы в `MessageStorageService`
3. Создать соответствующие индексы в базе данных
4. Добавить валидацию и авторизацию по `company_id` 