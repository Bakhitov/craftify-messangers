# 🤖 Интеграция с агентной системой (Agno)

## 📖 Обзор

Система wweb-mcp поддерживает автоматическую интеграцию с агентной системой для обработки входящих сообщений с помощью AI. Когда пользователь отправляет сообщение в WhatsApp или Telegram, система может автоматически переадресовать его агенту, получить ответ и отправить обратно пользователю.

## ⚙️ Конфигурация

### Переменные окружения

```bash
# Основные настройки агентной системы
AGNO_API_BASE_URL=http://localhost:8000    # URL API агентной системы
AGNO_API_TIMEOUT=10000                     # Таймаут запросов в миллисекундах
AGNO_ENABLED=true                          # Глобальное включение/отключение
```

### Настройка в Docker

В `docker-compose.yml` добавьте переменные окружения:

```yaml
environment:
  - AGNO_API_BASE_URL=http://host.docker.internal:8000
  - AGNO_API_TIMEOUT=10000
  - AGNO_ENABLED=true
```

## 🗄️ Настройка в базе данных

Для каждого инстанса мессенджера можно настроить агентную интеграцию:

```sql
-- Включение агентной интеграции для инстанса
UPDATE public.message_instances 
SET 
  agent_id = 'your-agent-id',     -- ID агента в агентной системе
  agno_enable = true              -- Включение агентной интеграции
WHERE id = 'your-instance-id';

-- Отключение агентной интеграции
UPDATE public.message_instances 
SET agno_enable = false 
WHERE id = 'your-instance-id';
```

## 🔄 Алгоритм работы

1. **Входящее сообщение** поступает в WhatsApp/Telegram
2. **Проверка условий**:
   - `AGNO_ENABLED = true` (глобально)
   - `agno_enable = true` (для инстанса)
   - `agent_id IS NOT NULL` (для инстанса)
3. **Отправка в агентную систему**: `POST /v1/agents/{agent_id}/runs`
4. **Получение ответа** от агента
5. **Отправка ответа пользователю** в исходный чат
6. **Сохранение в БД** как исходящее сообщение (`is_from_me = true`)

## 📡 API агентной системы

### Запрос к агенту

```http
POST /v1/agents/{agent_id}/runs
Content-Type: application/json

{
  "message": "Текст входящего сообщения",
  "stream": false
}
```

### Ожидаемый ответ

```json
{
  "message": "Ответ от AI агента",
  "status": "completed",
  "metadata": {
    "agent_id": "agent-123",
    "run_id": "run-456"
  }
}
```

## 🧪 Тестирование

### 1. Подготовка данных

```sql
-- Создание тестового инстанса с агентной интеграцией
UPDATE public.message_instances 
SET 
  agent_id = 'test-agent-123',
  agno_enable = true,
  user_id = 'test-user'
WHERE id = 'your-instance-id';
```

### 2. Отправка тестового сообщения

Отправьте сообщение через WhatsApp или Telegram в настроенный инстанс.

### 3. Проверка логов

```bash
# Логи агентной интеграции
docker logs your-container-name -f | grep -i agno

# Примеры успешных логов:
# "Agno config loaded from database"
# "Sending message to agno agent"
# "Received response from agno agent"
# "Agno response sent and saved"
```

### 4. Проверка сохранения в БД

```sql
-- Проверка ответов агента в базе данных
SELECT 
  message_id,
  message_body,
  is_from_me,
  created_at
FROM public.messages 
WHERE instance_id = 'your-instance-id' 
  AND is_from_me = true 
ORDER BY created_at DESC 
LIMIT 5;
```

## 🛡️ Обработка ошибок

### Принципы обработки ошибок

- **Не блокирует основную логику**: Ошибки агентной системы не влияют на webhook и сохранение сообщений
- **Graceful degradation**: При недоступности агентной системы сообщения обрабатываются обычным способом
- **Подробное логирование**: Все ошибки логируются для диагностики

### Типичные ошибки и их обработка

```typescript
// Агентная система недоступна
"Agno API request failed: timeout"

// Неправильная конфигурация
"No active agno config found for instance"

// Пустой ответ от агента
"Agno API returned empty response"

// Ошибка отправки ответа
"Failed to send agno response to user"
```

## 📊 Мониторинг

### Health Check агентной системы

```typescript
// Проверка доступности агентной системы
const service = new AgnoIntegrationService(pool);
const isHealthy = await service.checkAgnoHealth();
console.log('Agno system healthy:', isHealthy);
```

### Метрики для отслеживания

- Количество сообщений, отправленных агентам
- Время ответа агентной системы
- Процент успешных запросов к агентам
- Количество ошибок агентной интеграции

## 🔧 Отладка

### Включение debug логов

```bash
# Установить уровень логирования
LOG_LEVEL=debug

# Фильтрация логов агентной интеграции
docker logs container-name 2>&1 | grep -i agno
```

### Полезные SQL запросы

```sql
-- Статистика использования агентов
SELECT 
  agent_id,
  COUNT(*) as total_instances,
  COUNT(CASE WHEN agno_enable = true THEN 1 END) as active_instances
FROM public.message_instances 
WHERE agent_id IS NOT NULL
GROUP BY agent_id;

-- Последние сообщения агента
SELECT 
  mi.agent_id,
  m.message_body,
  m.created_at
FROM public.messages m
JOIN public.message_instances mi ON m.instance_id = mi.id
WHERE m.is_from_me = true 
  AND mi.agent_id IS NOT NULL
ORDER BY m.created_at DESC
LIMIT 10;
```

## 🚀 Production рекомендации

1. **Установите правильный timeout**: 10-30 секунд в зависимости от сложности агентов
2. **Мониторинг**: Отслеживайте доступность агентной системы
3. **Logging**: Используйте структурированные логи для анализа
4. **Rate limiting**: Ограничьте количество запросов к агентам при необходимости
5. **Fallback**: Подготовьте план действий при недоступности агентной системы

## 🔗 Связанные файлы

- `src/services/agno-integration.service.ts` - Основной сервис интеграции
- `src/whatsapp-client.ts` - Интеграция для WhatsApp
- `src/providers/telegram-provider.ts` - Интеграция для Telegram
- `db/migrations/versions/007_add_agent_user_agno_fields.sql` - Миграция БД
- `AGNO_INTEGRATION_TASK.md` - Техническое задание 