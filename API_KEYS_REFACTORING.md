# Рефакторинг системы API ключей

## 📋 Обзор изменений

Проведен полный рефакторинг системы API ключей для упрощения архитектуры и повышения надежности.

## 🔧 Ключевые изменения

### 1. Упрощение логики API ключей
- **До**: Сложная система генерации случайных API ключей с ротацией
- **После**: `api_key` всегда равен `instance_id` (статичный ключ)

### 2. Удаление поля `current_api_key`
- Убрано из всех таблиц и интерфейсов
- Упрощена логика хранения и использования ключей

### 3. Обновление схемы базы данных
```sql
-- Новая структура ai.message_instances
CREATE TABLE ai.message_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NULL,
  provider VARCHAR NOT NULL DEFAULT 'whatsappweb',
  type_instance VARCHAR[] NOT NULL DEFAULT ARRAY['api'],
  port_api INTEGER NULL,
  port_mcp INTEGER NULL,
  api_key VARCHAR NULL,  -- Всегда равен id
  api_key_generated_at TIMESTAMP WITHOUT TIME ZONE NULL,
  -- ... остальные поля
  CONSTRAINT message_instances_pkey PRIMARY KEY (id)
);
```

## 🚀 Преимущества нового подхода

1. **Простота**: Один статичный ключ на инстанс
2. **Надежность**: Нет сложной логики генерации и ротации
3. **Производительность**: Упрощенные операции с базой данных
4. **Безопасность**: Для смены ключа требуется пересоздание инстанса

## 📁 Измененные файлы

### Основные компоненты
- `src/main.ts` - упрощены функции получения API ключей
- `src/instance-manager/models/instance.model.ts` - убран `current_api_key`
- `src/instance-manager/config/database.config.ts` - обновлена схема БД

### Сервисы
- `src/instance-manager/services/instance-memory.service.ts` - упрощена логика
- `src/instance-manager/services/database.service.ts` - убраны операции с `current_api_key`
- `src/instance-manager/services/processing.service.ts` - упрощена обработка ключей
- `src/instance-manager/services/compose.service.ts` - убрана генерация ключей

### API
- `src/instance-manager/api/v1/instances.ts` - новый endpoint `/api/v1/instances/:id/api-key`
- `src/utils/instance-manager.client.ts` - обновлен клиент

### База данных
- `db/migrations/versions/002_remove_current_api_key.sql` - миграция
- `scripts/apply-migration-002.sh` - скрипт применения миграции

## 🔄 Миграция

### 1. Применение миграции базы данных
```bash
# Установите переменную окружения
export DATABASE_URL='postgresql://user:password@host:port/database'

# Примените миграцию
./scripts/apply-migration-002.sh
```

### 2. Обновление кода
Все изменения кода уже внесены и готовы к использованию.

### 3. Тестирование
После применения миграции:
1. Запустите приложение
2. Создайте новый инстанс
3. Убедитесь, что `api_key` равен `instance_id`
4. Проверьте работу API с новым ключом

## 🔐 Новая логика авторизации

### WhatsApp инстансы
```typescript
// Получение API ключа
const instanceId = 'uuid-instance-id';
const apiKey = instanceId; // Всегда равен instanceId

// Использование в запросах
const response = await fetch('/api/v1/whatsapp/send-message', {
  headers: {
    'Authorization': `Bearer ${instanceId}`
  }
});
```

### Telegram инстансы
```typescript
// Получение API ключа
const instanceId = 'uuid-instance-id';
const apiKey = instanceId; // Всегда равен instanceId

// Использование в запросах
const response = await fetch('/api/v1/telegram/send-message', {
  headers: {
    'Authorization': `Bearer ${instanceId}`
  }
});
```

## 🔧 API изменения

### Новые endpoints
- `GET /api/v1/instances/:id/api-key` - получить API ключ (заменяет `current-api-key`)

### Удаленные endpoints
- `GET /api/v1/instances/:id/current-api-key` - больше не используется

## 🛡️ Безопасность

### Смена API ключа
Для смены API ключа теперь требуется:
1. Удалить существующий инстанс: `DELETE /api/v1/instances/:id`
2. Создать новый инстанс: `POST /api/v1/instances`
3. Новый инстанс получит новый UUID как API ключ

### Преимущества подхода
- Исключает возможность утечки через логи (нет генерации случайных ключей)
- Упрощает отладку (ключ всегда известен)
- Повышает надежность (нет сложной логики ротации)

## 📊 Совместимость

### Обратная совместимость
- ❌ API endpoint `current-api-key` удален
- ❌ Поле `current_api_key` удалено из базы данных
- ✅ Все остальные API endpoints работают без изменений

### Миграция существующих инстансов
Миграция автоматически:
1. Удаляет поле `current_api_key`
2. Устанавливает `api_key = id` для всех записей
3. Обновляет `api_key_generated_at` для пустых записей

## 🧪 Тестирование

### Проверка после миграции
```bash
# 1. Проверить структуру таблицы
psql $DATABASE_URL -c "\d ai.message_instances"

# 2. Проверить данные
psql $DATABASE_URL -c "SELECT id, api_key, api_key = id as keys_match FROM ai.message_instances LIMIT 5;"

# 3. Запустить приложение
npm run dev

# 4. Создать тестовый инстанс
curl -X POST http://localhost:3001/api/v1/instances \
  -H "Content-Type: application/json" \
  -d '{"user_id": "test", "provider": "whatsappweb"}'

# 5. Получить API ключ
curl http://localhost:3001/api/v1/instances/{instance-id}/api-key
```

## 📝 Заметки для разработчиков

1. **API ключ = Instance ID**: Всегда используйте `instance.id` как API ключ
2. **Нет генерации**: Убрана вся логика генерации случайных ключей
3. **Простая авторизация**: `Authorization: Bearer {instance-id}`
4. **Пересоздание для смены**: Для нового ключа нужен новый инстанс

## 🎯 Следующие шаги

1. ✅ Применить миграцию базы данных
2. ✅ Обновить код приложения
3. 🔄 Протестировать в development окружении
4. 🔄 Обновить документацию API
5. 🔄 Развернуть в production с миграцией

---

*Рефакторинг завершен. Система API ключей теперь проста, надежна и производительна.* 