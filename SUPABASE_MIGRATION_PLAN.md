# План миграции на Supabase Cloud

## 📋 Обзор

Данный документ описывает план по переходу с локальной PostgreSQL базы данных на Supabase Cloud с изменением схемы с `ai` на `public`.

## 🎯 Цель миграции

- **Текущая конфигурация**: Локальная PostgreSQL с схемой `ai`
- **Целевая конфигурация**: Supabase Cloud с схемой `public`
- **Connection String**: `postgresql://postgres.wyehpfzafbjfvyjzgjss:Ginifi51!@aws-0-eu-north-1.pooler.supabase.com:6543/postgres`

## 📊 Текущее состояние проекта

### База данных
- **Development**: Локальная база через `host.docker.internal:5432`
- **Production**: Контейнер PostgreSQL в `docker-compose.production.yml`
- **Схема**: `ai` с таблицами:
  - `ai.message_instances`
  - `ai.messages`

### Конфигурационные файлы
- `env.development` - настройки для разработки
- `env.production` - настройки для продакшена
- `docker-compose.production.yml` - включает PostgreSQL контейнер
- `src/config/database.config.ts` - основная конфигурация БД
- `src/instance-manager/config/database.config.ts` - конфигурация для instance manager

## 🚀 План реализации

### Этап 1: Создание новых конфигурационных файлов

#### 1.1 Создать `env.supabase`
```bash
# ===========================================
# SUPABASE CLOUD КОНФИГУРАЦИЯ
# ===========================================

NODE_ENV=production
LOG_LEVEL=info

# Supabase Database Configuration
DATABASE_URL=postgresql://postgres.wyehpfzafbjfvyjzgjss:Ginifi51!@aws-0-eu-north-1.pooler.supabase.com:6543/postgres
DATABASE_HOST=aws-0-eu-north-1.pooler.supabase.com
DATABASE_PORT=6543
DATABASE_NAME=postgres
DATABASE_USER=postgres.wyehpfzafbjfvyjzgjss
DATABASE_PASSWORD=Ginifi51!
DATABASE_SCHEMA=public
DATABASE_SSL=true
USE_SUPABASE=true

# Instance Manager
INSTANCE_MANAGER_PORT=3000
INSTANCE_MANAGER_BASE_URL=https://your-domain.com

# Остальные настройки...
```

#### 1.2 Создать `docker-compose.supabase.yml`
```yaml
version: '3.8'

services:
  instance-manager:
    build:
      context: .
      dockerfile: Dockerfile.instance-manager
    container_name: wweb-instance-manager-supabase
    restart: always
    environment:
      # Supabase Database Configuration
      DATABASE_URL: ${DATABASE_URL}
      DATABASE_HOST: ${DATABASE_HOST}
      DATABASE_PORT: ${DATABASE_PORT}
      DATABASE_NAME: ${DATABASE_NAME}
      DATABASE_USER: ${DATABASE_USER}
      DATABASE_PASSWORD: ${DATABASE_PASSWORD}
      DATABASE_SCHEMA: ${DATABASE_SCHEMA:-public}
      DATABASE_SSL: ${DATABASE_SSL:-true}
      USE_SUPABASE: ${USE_SUPABASE:-true}
      
      # Остальные переменные...
    ports:
      - "3000:3000"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./composes:/app/composes
      - ./volumes:/app/volumes
      - instance_logs:/app/logs
    networks:
      - wweb-network

volumes:
  instance_logs:
    driver: local

networks:
  wweb-network:
    driver: bridge
```

### Этап 2: Обновление кода подключения к БД

#### 2.1 Обновить `src/config/database.config.ts`

**Изменения:**
- Добавить поддержку `DATABASE_URL`
- Изменить схему по умолчанию с `ai` на `public`
- Настроить SSL для Supabase
- Обновить SQL запросы для схемы `public`

```typescript
export function getDatabaseConfig(): DatabaseConfig {
  return {
    host: process.env.DATABASE_HOST || process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || process.env.DB_PORT || '5432'),
    database: process.env.DATABASE_NAME || process.env.DB_NAME || 'ai',
    user: process.env.DATABASE_USER || process.env.DB_USER || 'ai',
    password: process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || 'ai',
    schema: process.env.DATABASE_SCHEMA || 'public', // ИЗМЕНЕНО: с 'ai' на 'public'
    ssl: process.env.DATABASE_SSL === 'true' || process.env.DB_SSL === 'true',
  };
}

export function createPool(): Pool {
  const config = getDatabaseConfig();
  
  // Приоритет DATABASE_URL для Supabase
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    return new Pool({
      connectionString: databaseUrl,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
    });
  }

  return new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
  });
}

// Обновленные SQL запросы для схемы public
export const CREATE_MESSAGES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL,
    message_id VARCHAR(255) NOT NULL,
    chat_id VARCHAR(255) NOT NULL,
    from_number VARCHAR(50),
    to_number VARCHAR(50),
    message_body TEXT,
    message_type VARCHAR(50) DEFAULT 'text',
    is_from_me BOOLEAN DEFAULT FALSE,
    is_group BOOLEAN DEFAULT FALSE,
    group_id VARCHAR(255),
    contact_name VARCHAR(255),
    timestamp BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(instance_id, message_id)
  );

  CREATE INDEX IF NOT EXISTS idx_messages_instance_id ON public.messages(instance_id);
  CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON public.messages(chat_id);
  CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON public.messages(timestamp);
  CREATE INDEX IF NOT EXISTS idx_messages_from_number ON public.messages(from_number);
  CREATE INDEX IF NOT EXISTS idx_messages_is_group ON public.messages(is_group);
`;
```

#### 2.2 Обновить `src/instance-manager/config/database.config.ts`

**Аналогичные изменения:**
- Поддержка `DATABASE_URL`
- Схема `public` по умолчанию
- SSL конфигурация для Supabase

```typescript
export const CREATE_SCHEMA_SQL = `
  -- Схема public уже существует в PostgreSQL/Supabase
  -- Ничего не нужно создавать
`;

export const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS public.message_instances (
    id UUID PRIMARY KEY,
    user_id VARCHAR NOT NULL,
    provider VARCHAR NOT NULL DEFAULT 'whatsappweb',
    type_instance VARCHAR[] NOT NULL DEFAULT ARRAY['api'],
    port_api INTEGER,
    port_mcp INTEGER,
    api_key VARCHAR,
    api_webhook_schema JSONB DEFAULT '{}',
    mcp_schema JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_message_instances_user_id ON public.message_instances(user_id);
  CREATE INDEX IF NOT EXISTS idx_message_instances_provider ON public.message_instances(provider);
`;
```

### Этап 3: Обновление сервисов и SQL запросов

#### 3.1 Файлы требующие обновления схемы

Необходимо найти и обновить все места где используется схема `ai`:

```bash
# Поиск файлов содержащих схему ai
grep -r "ai\." src/
grep -r "ai\." *.ts
grep -r "DATABASE_SCHEMA.*ai" .
```

**Файлы для обновления:**
- `src/services/message-storage.service.ts`
- `src/instance-manager/services/database.service.ts`
- `src/main.ts` (места использования схемы в SQL запросах)

#### 3.2 Обновление SQL запросов

**БЫЛО:**
```sql
SELECT * FROM ai.message_instances WHERE id = $1
INSERT INTO ai.messages (...)
CREATE SCHEMA IF NOT EXISTS ai;
```

**СТАЛО:**
```sql
SELECT * FROM public.message_instances WHERE id = $1
INSERT INTO public.messages (...)
-- CREATE SCHEMA не нужен для public
```

### Этап 4: Создание скриптов автоматизации

#### 4.1 Создать `scripts/switch-to-supabase.sh`
```bash
#!/bin/bash

echo "🚀 Переключение на Supabase Cloud..."

# Остановка текущих контейнеров
echo "Остановка текущих сервисов..."
docker-compose -f docker-compose.production.yml down

# Копирование конфигурации Supabase
echo "Применение конфигурации Supabase..."
cp env.supabase .env

# Запуск с Supabase конфигурацией
echo "Запуск сервисов с Supabase..."
docker-compose -f docker-compose.supabase.yml up -d --build

echo "✅ Переключение на Supabase завершено!"
echo "🔗 Connection: aws-0-eu-north-1.pooler.supabase.com:6543"
echo "📊 Schema: public"
```

#### 4.2 Создать `scripts/switch-to-local.sh`
```bash
#!/bin/bash

echo "🔄 Возврат к локальной PostgreSQL..."

# Остановка Supabase конфигурации
echo "Остановка Supabase сервисов..."
docker-compose -f docker-compose.supabase.yml down

# Возврат к production конфигурации
echo "Применение локальной конфигурации..."
cp env.production .env

# Запуск локальных сервисов
echo "Запуск локальных сервисов..."
docker-compose -f docker-compose.production.yml up -d --build

echo "✅ Возврат к локальной БД завершен!"
```

#### 4.3 Создать `scripts/migrate-schema.sql` (если нужен перенос данных)
```sql
-- Скрипт для переноса данных из схемы ai в public
-- Используется только если есть существующие данные в схеме ai

BEGIN;

-- Перенос message_instances
INSERT INTO public.message_instances 
SELECT * FROM ai.message_instances
ON CONFLICT (id) DO NOTHING;

-- Перенос messages  
INSERT INTO public.messages 
SELECT * FROM ai.messages
ON CONFLICT (instance_id, message_id) DO NOTHING;

-- Проверка результатов
SELECT 'message_instances' as table_name, count(*) as count FROM public.message_instances
UNION ALL
SELECT 'messages' as table_name, count(*) as count FROM public.messages;

COMMIT;
```

### Этап 5: Тестирование

#### 5.1 Чек-лист проверки
- [ ] Подключение к Supabase устанавливается успешно
- [ ] Таблицы создаются в схеме `public`
- [ ] Instance Manager работает корректно
- [ ] API эндпоинты функционируют
- [ ] WhatsApp и Telegram API работают
- [ ] Сообщения сохраняются в БД
- [ ] SSL соединение работает стабильно

#### 5.2 Команды для тестирования
```bash
# Проверка подключения к Supabase
docker exec -it wweb-instance-manager-supabase psql $DATABASE_URL -c "\dt public.*"

# Проверка Instance Manager
curl http://localhost:3000/health

# Проверка логов
docker logs wweb-instance-manager-supabase
```

## 🔧 Технические детали

### Параметры подключения Supabase

| Параметр | Значение |
|----------|----------|
| **Host** | `aws-0-eu-north-1.pooler.supabase.com` |
| **Port** | `6543` (Transaction mode) / `5432` (Session mode) |
| **Database** | `postgres` |
| **User** | `postgres.wyehpfzafbjfvyjzgjss` |
| **Password** | `Ginifi51!` |
| **Schema** | `public` |
| **SSL** | `required` |

### Рекомендации по портам

- **Port 6543**: Transaction mode - рекомендуется для API и коротких запросов
- **Port 5432**: Session mode - для длительных соединений и транзакций

### SSL конфигурация
```typescript
ssl: {
  rejectUnauthorized: false
}
```

## ⚠️ Важные моменты

### Безопасность
- Пароль содержит специальный символ `!` - требует правильного экранирования в некоторых контекстах
- Использовать переменные окружения для чувствительных данных
- SSL обязателен для Supabase Cloud

### Производительность
- Connection pooling через порт 6543
- Оптимизация запросов для облачной БД
- Мониторинг использования ресурсов Supabase

### Резервное копирование
- Создать backup существующих данных перед миграцией
- Проверить совместимость схемы данных
- Тестирование на dev окружении перед prod

## 📁 Измененные файлы

### Новые файлы
- `env.supabase`
- `docker-compose.supabase.yml`
- `scripts/switch-to-supabase.sh`
- `scripts/switch-to-local.sh`
- `scripts/migrate-schema.sql`
- `SUPABASE_MIGRATION_PLAN.md` (этот документ)

### Обновляемые файлы
- `src/config/database.config.ts`
- `src/instance-manager/config/database.config.ts`
- `src/services/message-storage.service.ts`
- `src/instance-manager/services/database.service.ts`
- `src/main.ts`
- `env.production` (добавить опции Supabase)
- `CHANGELOG.md`
- `README.md`

## 🎯 Преимущества миграции

### Использование схемы `public`
1. **Стандартность**: Схема `public` является стандартной в PostgreSQL
2. **Упрощение**: Не требует создания дополнительных схем
3. **Совместимость**: Лучшая совместимость с инструментами Supabase
4. **Доступ**: Все пользователи имеют доступ к схеме `public` по умолчанию

### Supabase Cloud
1. **Масштабируемость**: Автоматическое масштабирование ресурсов
2. **Надежность**: Высокая доступность и резервное копирование
3. **Мониторинг**: Встроенные инструменты мониторинга
4. **Обслуживание**: Автоматические обновления и патчи безопасности

## 📝 Следующие шаги

1. **Подготовка**: Создание backup существующих данных
2. **Разработка**: Реализация изменений в коде
3. **Тестирование**: Проверка на dev окружении
4. **Деплой**: Поэтапный переход в production
5. **Мониторинг**: Контроль работы после миграции

---

**Дата создания**: 2025
**Версия**: 1.0
**Статус**: В разработке 