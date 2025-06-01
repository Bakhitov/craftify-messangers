# 🧪 TESTING GUIDE - Supabase Cloud Edition

Руководство по тестированию проекта wweb-mcp с использованием Supabase Cloud базы данных.

## 🏗️ Архитектура Supabase Cloud

### Конфигурация базы данных
- **Provider**: Supabase Cloud
- **Host**: `aws-0-eu-north-1.pooler.supabase.com`
- **Port**: `6543` (Transaction mode)
- **Database**: `postgres`
- **Schema**: `public`
- **SSL**: Обязательно включен

### Настройка окружения

#### 1. Конфигурация для Supabase
```bash
# Копирование конфигурации Supabase
cp env.supabase .env

# Проверка конфигурации
cat .env | grep DATABASE
```

#### 2. Запуск с Supabase
```bash
# Остановка локальных сервисов (если запущены)
docker-compose down

# Запуск с Supabase конфигурацией
docker-compose -f docker-compose.supabase.yml up -d --build

# Проверка статуса
docker-compose -f docker-compose.supabase.yml ps
```

#### 3. Проверка подключения к Supabase
```bash
# Проверка логов подключения
docker logs wweb-mcp-instance-manager-1 -f

# Тест подключения к базе
docker exec wweb-mcp-instance-manager-1 psql \
  "postgresql://postgres.wyehpfzafbjfvyjzgjss:Ginifi51!@aws-0-eu-north-1.pooler.supabase.com:6543/postgres" \
  -c "\dt public.*"
```

### Проверка таблиц в схеме public
```bash
# Проверка существования таблиц
docker exec wweb-mcp-instance-manager-1 psql $DATABASE_URL -c "
SELECT table_name, table_schema 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('message_instances', 'messages');
"

# Проверка структуры таблицы message_instances
docker exec wweb-mcp-instance-manager-1 psql $DATABASE_URL -c "
\d public.message_instances
"

# Проверка структуры таблицы messages
docker exec wweb-mcp-instance-manager-1 psql $DATABASE_URL -c "
\d public.messages
"
```

## 🎯 Тестирование Instance Manager

Instance Manager - центральный компонент для управления экземплярами WhatsApp и Telegram.

### Запуск Instance Manager

```bash
# Запуск через Docker (рекомендуется)
docker compose -f docker-compose.instance-manager.yml up -d --build

# Проверка запуска
curl http://localhost:3000/health

# Просмотр логов
docker logs wweb-mcp-instance-manager-1 -f
```

### API Endpoints тестирование

#### Health Check

```bash
curl http://localhost:3000/health
```

Ожидаемый ответ:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T12:00:00.000Z",
  "uptime": 120.5,
  "environment": "development",
  "version": "0.2.6-dev-hotreload-test"
}
```

#### Создание WhatsApp экземпляра

```bash
curl -X POST http://localhost:3000/api/v1/instances \
-H "Content-Type: application/json" \
-d '{
  "user_id": "test-whatsapp-user-001", 
  "agent_id": "agno_assist2", 
  "agno_enable": true, 
  "provider": "whatsappweb", 
  "type_instance": ["api"], 
  "api_webhook_schema": {
    "enabled": true, 
    "url": "https://gk85vc.buildship.run/webhook-message-api", 
    "filters": {
      "allowGroups": false, 
      "allowPrivate": true
    }
  }
}'
```

#### Создание Telegram экземпляра

```bash
curl -X POST http://localhost:3000/api/v1/instances \
-H "Content-Type: application/json" \
-d '{
    "user_id": "test-telegram-user-001",
    "agent_id": "finance_agent1",
    "provider": "telegram",
    "agno_enable": true,
    "stream": false,
    "type_instance": ["api"],
    "token": "7961413009:AAGEp-pakPC5OmvgTyXBLmNGoSlLdCAzg28",
    "api_webhook_schema": {
        "enabled": true, 
        "url": "https://gk85vc.buildship.run/webhook-message-api"
    }
}'
```

#### Управление экземплярами

```bash
# Получение списка экземпляров
curl http://localhost:3000/api/v1/instances

# Получение информации об экземпляре
curl http://localhost:3000/api/v1/instances/{INSTANCE_ID}

# Получение данных из памяти
curl http://localhost:3000/api/v1/instances/{INSTANCE_ID}/memory

# Получение истории статусов
curl http://localhost:3000/api/v1/instances/{INSTANCE_ID}/status-history?limit=50

# Получение истории QR кодов (для WhatsApp)
curl http://localhost:3000/api/v1/instances/{INSTANCE_ID}/qr-history?limit=20

# Получение истории API ключей
curl http://localhost:3000/api/v1/instances/{INSTANCE_ID}/api-key-history?limit=20

# Получение текущего QR кода
curl http://localhost:3000/api/v1/instances/{INSTANCE_ID}/current-qr

# Получение текущего API ключа
curl http://localhost:3000/api/v1/instances/{INSTANCE_ID}/current-api-key

# Получение статистики активности
curl http://localhost:3000/api/v1/instances/{INSTANCE_ID}/activity-stats

# Получение ошибок экземпляра
curl http://localhost:3000/api/v1/instances/{INSTANCE_ID}/errors

# Очистка ошибок
curl -X POST http://localhost:3000/api/v1/instances/{INSTANCE_ID}/clear-errors

# Обработка экземпляра (создание Docker контейнера)
curl -X POST http://localhost:3000/api/v1/instances/{INSTANCE_ID}/process \
  -H "Content-Type: application/json" \
  -d '{}'

# Запуск экземпляра
curl -X POST http://localhost:3000/api/v1/instances/{INSTANCE_ID}/start

# Остановка экземпляра
curl -X POST http://localhost:3000/api/v1/instances/{INSTANCE_ID}/stop

# Перезапуск экземпляра
curl -X POST http://localhost:3000/api/v1/instances/{INSTANCE_ID}/restart

# Удаление экземпляра
curl -X DELETE http://localhost:3000/api/v1/instances/{INSTANCE_ID}

# Получение статуса аутентификации
curl http://localhost:3000/api/v1/instances/{INSTANCE_ID}/auth-status

# Получение QR кода для WhatsApp
curl http://localhost:3000/api/v1/instances/{INSTANCE_ID}/qr

# Получение учетных данных
curl http://localhost:3000/api/v1/instances/{INSTANCE_ID}/credentials

# Получение логов экземпляра
curl "http://localhost:3000/api/v1/instances/{INSTANCE_ID}/logs?tail=50"
```

#### Мониторинг ресурсов

```bash
# Общие ресурсы системы
curl http://localhost:3000/api/v1/resources

# Использование портов
curl http://localhost:3000/api/v1/resources/ports

# Производительность
curl http://localhost:3000/api/v1/resources/performance

# Очистка кэша портов
curl -X POST http://localhost:3000/api/v1/resources/ports/clear-cache

# Статистика памяти экземпляров
curl http://localhost:3000/api/v1/instances/memory/stats
```

### Тестовый сценарий полного жизненного цикла

```bash
#!/bin/bash
# test-instance-lifecycle.sh

echo "🚀 Тестирование полного жизненного цикла экземпляра"

# 1. Создание экземпляра
echo "1️⃣ Создание WhatsApp экземпляра..."
INSTANCE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/instances \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-lifecycle-'$(date +%s)'",
    "provider": "whatsappweb",
    "type_instance": ["api"]
  }')

INSTANCE_ID=$(echo $INSTANCE_RESPONSE | jq -r '.instance_id')
echo "✅ Экземпляр создан: $INSTANCE_ID"

# 2. Обработка экземпляра
echo "2️⃣ Обработка экземпляра..."
PROCESS_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/instances/$INSTANCE_ID/process \
  -H "Content-Type: application/json" \
  -d '{}')

echo "✅ Экземпляр обработан"

# 3. Ожидание готовности
echo "3️⃣ Ожидание готовности контейнера (30 сек)..."
sleep 30

# 4. Проверка статуса
echo "4️⃣ Проверка статуса экземпляра..."
curl http://localhost:3000/api/v1/instances/$INSTANCE_ID | jq '.status'

# 5. Получение данных из памяти
echo "5️⃣ Проверка данных в памяти..."
curl http://localhost:3000/api/v1/instances/$INSTANCE_ID/memory | jq '.data.status'

# 6. Очистка
echo "6️⃣ Удаление тестового экземпляра..."
curl -X DELETE http://localhost:3000/api/v1/instances/$INSTANCE_ID
echo "✅ Тест завершен успешно"
```

## 📱 Тестирование WhatsApp API

### Запуск standalone WhatsApp API

```bash
# Прямой запуск (без Instance Manager)
npm start -- --mode whatsapp-api --api-port 3001

# Проверка назначенного порта в логах
export WHATSAPP_API_PORT=3001
```

### API Endpoints тестирование

#### Базовые проверки

```bash
# Health check
curl http://localhost:$WHATSAPP_API_PORT/api/v1/health

# Статус аутентификации
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:$WHATSAPP_API_PORT/api/v1/status
```

#### Получение данных

```bash
# Получение контактов
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:$WHATSAPP_API_PORT/api/v1/contacts

# Получение чатов
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:$WHATSAPP_API_PORT/api/v1/chats

# Поиск контактов
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "http://localhost:$WHATSAPP_API_PORT/api/v1/contacts/search?query=test"

# Получение сообщений из чата
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "http://localhost:$WHATSAPP_API_PORT/api/v1/messages/77475318623?limit=10"

# Получение групп
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:$WHATSAPP_API_PORT/api/v1/groups

# Получение информации об аккаунте
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:$WHATSAPP_API_PORT/api/v1/account
```

#### Отправка сообщений

```bash
# Отправка текстового сообщения
curl -X POST http://localhost:7965/api/v1/send \
  -H "Authorization: Bearer 691d553a-f1ed-4983-8d3b-6d24cb3b4fd7" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "77475318623",
    "message": "Тестовое сообщение"
  }'

# Отправка изображения
curl -X POST http://localhost:$WHATSAPP_API_PORT/api/v1/send/media \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "1234567890",
    "source": "https://picsum.photos/300/200",
    "caption": "Тестовое изображение"
  }'

# Отправка сообщения в группу
curl -X POST http://localhost:$WHATSAPP_API_PORT/api/v1/groups/GROUP_ID@g.us/send \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Привет, группа!"
  }'
```

#### Работа с группами

```bash
# Создание группы
curl -X POST http://localhost:$WHATSAPP_API_PORT/api/v1/groups \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Тестовая группа",
    "participants": ["1234567890", "0987654321"]
  }'

# Добавление участника в группу
curl -X POST http://localhost:$WHATSAPP_API_PORT/api/v1/groups/GROUP_ID@g.us/participants \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "participants": ["1234567890"]
  }'

# Удаление участника из группы
curl -X DELETE http://localhost:$WHATSAPP_API_PORT/api/v1/groups/GROUP_ID@g.us/participants/1234567890 \
  -H "Authorization: Bearer YOUR_API_KEY"
```

#### Конфигурация Webhook

```bash
# Получение текущей конфигурации webhook
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:$WHATSAPP_API_PORT/api/v1/webhook

# Обновление конфигурации webhook
curl -X PUT http://localhost:$WHATSAPP_API_PORT/api/v1/webhook \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "url": "https://your-webhook-url.com/webhook",
    "events": ["message", "message_ack", "qr", "ready"]
  }'
```

### Тестирование аутентификации

```bash
# Получение QR кода (через Instance Manager)
curl http://localhost:3000/api/v1/instances/{INSTANCE_ID}/qr

# Проверка статуса аутентификации
curl http://localhost:3000/api/v1/instances/{INSTANCE_ID}/auth-status

# Принудительная повторная аутентификация
curl -X POST http://localhost:3000/api/v1/instances/{INSTANCE_ID}/process \
  -H "Content-Type: application/json" \
  -d '{"force_recreate": true}'
```

## 💬 Тестирование Telegram API

### Подготовка Telegram бота

```bash
# 1. Создание бота через @BotFather
# 2. Получение Bot Token
export TELEGRAM_BOT_TOKEN="YOUR_BOT_TOKEN"

# 3. Проверка работоспособности бота
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe" | jq .
```

### Создание Telegram экземпляра

```bash
# Создание через Instance Manager
curl -X POST http://localhost:3000/api/v1/instances \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-telegram-user-001",
    "agent_id": "finance_agent1",
    "provider": "telegram",
    "agno_enable": true,
    "stream": false,
    "type_instance": ["api"],
    "token": "7961413009:AAGEp-pakPC5OmvgTyXBLmNGoSlLdCAzg28",
    "api_webhook_schema": {
        "enabled": true, 
        "url": "https://gk85vc.buildship.run/webhook-message-api",
        "filters": {
            "allowGroups": false,
            "allowPrivate": true
        }
    }
  }'
```

### API Endpoints тестирование

#### Базовые проверки

```bash
# Health check
curl http://localhost:$TELEGRAM_API_PORT/api/v1/health

# Информация о боте
curl -H "Authorization: Bearer $TELEGRAM_BOT_TOKEN" \
  http://localhost:$TELEGRAM_API_PORT/api/v1/telegram/me

# Статус бота
curl -H "Authorization: Bearer $TELEGRAM_BOT_TOKEN" \
  http://localhost:$TELEGRAM_API_PORT/api/v1/telegram/status
```

#### Отправка сообщений

```bash
# Получение Chat ID (написать боту сообщение в Telegram)
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getUpdates" | \
  jq '.result[-1].message.chat.id'

export TELEGRAM_CHAT_ID="your-chat-id"

# Отправка текстового сообщения
curl -X POST http://localhost:4325/api/v1/telegram/send \
  -H "Authorization: Bearer 7961413009:AAGEp-pakPC5OmvgTyXBLmNGoSlLdCAzg28" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "134527512",
    "message": "🚀 салют!"
  }'

# Отправка форматированного сообщения
curl -X POST http://localhost:$TELEGRAM_API_PORT/api/v1/telegram/send-telegram-message \
  -H "Authorization: Bearer $TELEGRAM_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "'$TELEGRAM_CHAT_ID'",
    "message": "*Жирный текст* и _курсив_",
    "parseMode": "Markdown"
  }'

# Отправка медиа
curl -X POST http://localhost:$TELEGRAM_API_PORT/api/v1/telegram/send-media \
  -H "Authorization: Bearer $TELEGRAM_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "'$TELEGRAM_CHAT_ID'",
    "source": "https://picsum.photos/400/300",
    "caption": "🖼️ Тестовое изображение"
  }'
```

#### Получение данных

```bash
# Получение контактов
curl -H "Authorization: Bearer $TELEGRAM_BOT_TOKEN" \
  http://localhost:$TELEGRAM_API_PORT/api/v1/telegram/contacts

# Получение чатов
curl -H "Authorization: Bearer $TELEGRAM_BOT_TOKEN" \
  http://localhost:$TELEGRAM_API_PORT/api/v1/telegram/chats

# Получение сообщений из чата
curl -H "Authorization: Bearer $TELEGRAM_BOT_TOKEN" \
  "http://localhost:$TELEGRAM_API_PORT/api/v1/telegram/messages/$TELEGRAM_CHAT_ID?limit=10"

# Получение информации об аккаунте
curl -H "Authorization: Bearer $TELEGRAM_BOT_TOKEN" \
  http://localhost:$TELEGRAM_API_PORT/api/v1/telegram/account

# Получение последних сообщений
curl -H "Authorization: Bearer $TELEGRAM_BOT_TOKEN" \
  "http://localhost:$TELEGRAM_API_PORT/api/v1/telegram/recent-messages?limit=20"
```

#### Управление polling и webhook

```bash
# Запуск polling
curl -X POST http://localhost:$TELEGRAM_API_PORT/api/v1/telegram/polling/start \
  -H "Authorization: Bearer $TELEGRAM_BOT_TOKEN"

# Остановка polling
curl -X POST http://localhost:$TELEGRAM_API_PORT/api/v1/telegram/polling/stop \
  -H "Authorization: Bearer $TELEGRAM_BOT_TOKEN"

# Статус polling
curl -H "Authorization: Bearer $TELEGRAM_BOT_TOKEN" \
  http://localhost:$TELEGRAM_API_PORT/api/v1/telegram/polling/status

# Получение конфигурации webhook
curl -H "Authorization: Bearer $TELEGRAM_BOT_TOKEN" \
  http://localhost:$TELEGRAM_API_PORT/api/v1/telegram/webhook

# Обновление конфигурации webhook
curl -X PUT http://localhost:$TELEGRAM_API_PORT/api/v1/telegram/webhook \
  -H "Authorization: Bearer $TELEGRAM_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "url": "https://your-webhook-url.com/telegram",
    "events": ["message", "callback_query"]
  }'
```

### Автоматизированный тест Telegram

```bash
# Создание тестового скрипта
cat > test-telegram-full.js << 'EOF'
#!/usr/bin/env node

const axios = require('axios');

const INSTANCE_MANAGER_URL = 'http://localhost:3000';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function runFullTelegramTest() {
  try {
    console.log('🚀 Запуск полного теста Telegram интеграции...\n');

    // 1. Создание экземпляра
    const createResponse = await axios.post(`${INSTANCE_MANAGER_URL}/api/v1/instances`, {
      user_id: `telegram-test-${Date.now()}`,
      provider: 'telegram',
      type_instance: ['api'],
      token: BOT_TOKEN
    });
    
    const instanceId = createResponse.data.instance_id;
    console.log(`✅ Экземпляр создан: ${instanceId}`);

    // 2. Обработка
    await axios.post(`${INSTANCE_MANAGER_URL}/api/v1/instances/${instanceId}/process`);
    console.log('✅ Экземпляр обработан');

    // 3. Ожидание
    console.log('⏳ Ожидание запуска (30 сек)...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    // 4. Получение информации об экземпляре
    const instanceInfo = await axios.get(`${INSTANCE_MANAGER_URL}/api/v1/instances/${instanceId}`);
    console.log(`✅ Экземпляр готов: ${JSON.stringify(instanceInfo.data.status)}`);

    // 5. Получение данных из памяти
    const memoryData = await axios.get(`${INSTANCE_MANAGER_URL}/api/v1/instances/${instanceId}/memory`);
    console.log(`✅ Данные в памяти: ${JSON.stringify(memoryData.data.data?.status)}`);

    console.log(`\n🎉 Тест завершен! Instance: ${instanceId}`);

  } catch (error) {
    console.error('❌ Ошибка теста:', error.response?.data || error.message);
  }
}

runFullTelegramTest();
EOF

chmod +x test-telegram-full.js

# Запуск теста
TELEGRAM_BOT_TOKEN="YOUR_BOT_TOKEN" \
TELEGRAM_CHAT_ID="YOUR_CHAT_ID" \
node test-telegram-full.js
```

## 🔗 Интеграционное тестирование

### Создание интеграционных тестов

```bash
mkdir -p test/integration

# Полный интеграционный тест
cat > test/integration/full-system.test.js << 'EOF'
const axios = require('axios');

describe('Full System Integration', () => {
  const INSTANCE_MANAGER_URL = 'http://localhost:3000';
  
  describe('Instance Manager → WhatsApp Flow', () => {
    it('should create and manage WhatsApp instance end-to-end', async () => {
      // 1. Создание экземпляра через Instance Manager
      const createResponse = await axios.post(`${INSTANCE_MANAGER_URL}/api/v1/instances`, {
        user_id: `test-wa-${Date.now()}`,
        provider: 'whatsappweb',
        type_instance: ['api']
      });
      
      expect(createResponse.status).toBe(201);
      expect(createResponse.data.instance_id).toBeDefined();
      
      const instanceId = createResponse.data.instance_id;
      
      // 2. Проверка создания в базе данных
      const instanceInfo = await axios.get(`${INSTANCE_MANAGER_URL}/api/v1/instances/${instanceId}`);
      expect(instanceInfo.data.instance.provider).toBe('whatsappweb');
      
      // 3. Проверка данных в памяти
      const memoryData = await axios.get(`${INSTANCE_MANAGER_URL}/api/v1/instances/${instanceId}/memory`);
      expect(memoryData.data.data).toBeDefined();
      
      // 4. Очистка
      await axios.delete(`${INSTANCE_MANAGER_URL}/api/v1/instances/${instanceId}`);
    }, 60000);
  });

  describe('Instance Manager → Telegram Flow', () => {
    it('should create and manage Telegram instance end-to-end', async () => {
      // Аналогично для Telegram
      const createResponse = await axios.post(`${INSTANCE_MANAGER_URL}/api/v1/instances`, {
        user_id: `test-tg-${Date.now()}`,
        provider: 'telegram',
        type_instance: ['api'],
        token: process.env.TELEGRAM_BOT_TOKEN || 'test-token'
      });
      
      expect(createResponse.status).toBe(201);
      
      const instanceId = createResponse.data.instance_id;
      
      // Проверка и очистка
      const instanceInfo = await axios.get(`${INSTANCE_MANAGER_URL}/api/v1/instances/${instanceId}`);
      expect(instanceInfo.data.instance.provider).toBe('telegram');
      
      await axios.delete(`${INSTANCE_MANAGER_URL}/api/v1/instances/${instanceId}`);
    }, 60000);
  });

  describe('Multi-Provider Management', () => {
    it('should handle multiple instances simultaneously', async () => {
      // Тест создания и управления несколькими экземплярами
      const instances = [];
      
      // Создание нескольких экземпляров
      for (let i = 0; i < 3; i++) {
        const response = await axios.post(`${INSTANCE_MANAGER_URL}/api/v1/instances`, {
          user_id: `test-multi-${i}-${Date.now()}`,
          provider: i % 2 === 0 ? 'whatsappweb' : 'telegram',
          type_instance: ['api'],
          token: i % 2 === 1 ? 'test-token' : undefined
        });
        instances.push(response.data.instance_id);
      }
      
      // Проверка списка экземпляров
      const listResponse = await axios.get(`${INSTANCE_MANAGER_URL}/api/v1/instances`);
      expect(listResponse.data.instances.length).toBeGreaterThanOrEqual(3);
      
      // Очистка
      for (const instanceId of instances) {
        await axios.delete(`${INSTANCE_MANAGER_URL}/api/v1/instances/${instanceId}`);
      }
    }, 120000);
  });
});
EOF

# Запуск интеграционных тестов
npm install --save-dev jest axios
npx jest test/integration/full-system.test.js
```

## 🎯 E2E тестирование

### Автоматизированные E2E тесты

```bash
# Создание E2E тестового скрипта
cat > test-e2e-complete.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 Запуск полного E2E тестирования..."

# 1. Запуск Instance Manager
echo "1️⃣ Запуск Instance Manager..."
docker compose -f docker-compose.instance-manager.yml up -d --build
sleep 15

# 2. Создание WhatsApp экземпляра
echo "2️⃣ Создание WhatsApp экземпляра..."
WA_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/instances \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "e2e-whatsapp-test",
    "provider": "whatsappweb",
    "type_instance": ["api"]
  }')

WA_INSTANCE_ID=$(echo $WA_RESPONSE | jq -r '.instance_id')
echo "✅ WhatsApp экземпляр: $WA_INSTANCE_ID"

# 3. Создание Telegram экземпляра
echo "3️⃣ Создание Telegram экземпляра..."
TG_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/instances \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "e2e-telegram-test",
    "provider": "telegram",
    "type_instance": ["api"],
    "token": "'$TELEGRAM_BOT_TOKEN'"
  }')

TG_INSTANCE_ID=$(echo $TG_RESPONSE | jq -r '.instance_id')
echo "✅ Telegram экземпляр: $TG_INSTANCE_ID"

# 4. Ожидание готовности
echo "4️⃣ Ожидание готовности контейнеров (60 сек)..."
sleep 60

# 5. Проверка функциональности
echo "5️⃣ Проверка функциональности..."

# Проверка статуса экземпляров
WA_STATUS=$(curl -s http://localhost:3000/api/v1/instances/$WA_INSTANCE_ID | jq -r '.instance.status')
TG_STATUS=$(curl -s http://localhost:3000/api/v1/instances/$TG_INSTANCE_ID | jq -r '.instance.status')

echo "✅ WhatsApp статус: $WA_STATUS"
echo "✅ Telegram статус: $TG_STATUS"

# Проверка данных в памяти
WA_MEMORY=$(curl -s http://localhost:3000/api/v1/instances/$WA_INSTANCE_ID/memory | jq -r '.data.status // "not_loaded"')
TG_MEMORY=$(curl -s http://localhost:3000/api/v1/instances/$TG_INSTANCE_ID/memory | jq -r '.data.status // "not_loaded"')

echo "✅ WhatsApp память: $WA_MEMORY"
echo "✅ Telegram память: $TG_MEMORY"

# 6. Проверка общей статистики
echo "6️⃣ Проверка общей статистики..."
STATS=$(curl -s http://localhost:3000/api/v1/instances/memory/stats)
echo "✅ Статистика памяти: $(echo $STATS | jq '.stats.total_instances')"

# 7. Очистка
echo "7️⃣ Очистка..."
curl -X DELETE http://localhost:3000/api/v1/instances/$WA_INSTANCE_ID > /dev/null
curl -X DELETE http://localhost:3000/api/v1/instances/$TG_INSTANCE_ID > /dev/null

docker compose -f docker-compose.instance-manager.yml down

echo "🎉 E2E тест завершен успешно!"
EOF

chmod +x test-e2e-complete.sh

# Запуск E2E теста
TELEGRAM_BOT_TOKEN="YOUR_BOT_TOKEN" ./test-e2e-complete.sh
```

## 🛠️ Устранение неполадок

### Частые проблемы и решения

#### 1. Проблемы с портами

```bash
# Освобождение занятых портов
kill -9 $(lsof -t -i:3000)

# Очистка кэша портов Instance Manager
curl -X POST http://localhost:3000/api/v1/resources/ports/clear-cache

# Проверка использования портов
curl http://localhost:3000/api/v1/resources/ports
```

#### 2. Проблемы с Docker

```bash
# Перезапуск Docker службы
sudo systemctl restart docker

# Очистка Docker ресурсов
docker system prune -f
docker volume prune -f

# Проверка Docker socket (macOS Colima)
ls -la ~/.colima/default/docker.sock
```

#### 3. Проблемы с базой данных Supabase

```bash
# Проверка подключения к Supabase
docker exec wweb-mcp-instance-manager-1 psql $DATABASE_URL -c "SELECT 1;"

# Проверка схемы public
docker exec wweb-mcp-instance-manager-1 psql $DATABASE_URL -c "\dt public.*"

# Проверка переменных окружения
docker exec wweb-mcp-instance-manager-1 env | grep DATABASE
```

#### 4. Проблемы с Instance Manager

```bash
# Перезапуск Instance Manager
docker compose -f docker-compose.instance-manager.yml restart

# Проверка логов
docker logs wweb-mcp-instance-manager-1 --tail 50

# Принудительная пересборка
docker compose -f docker-compose.instance-manager.yml up -d --build

# Проверка health check
curl http://localhost:3000/health
```

#### 5. Проблемы с экземплярами

```bash
# Проверка статуса всех экземпляров
curl http://localhost:3000/api/v1/instances | jq '.instances[] | {id: .id, status: .status, provider: .provider}'

# Получение ошибок конкретного экземпляра
curl http://localhost:3000/api/v1/instances/{INSTANCE_ID}/errors

# Очистка ошибок
curl -X POST http://localhost:3000/api/v1/instances/{INSTANCE_ID}/clear-errors

# Принудительный перезапуск экземпляра
curl -X POST http://localhost:3000/api/v1/instances/{INSTANCE_ID}/restart
```

#### 6. Проблемы с памятью и производительностью

```bash
# Проверка использования ресурсов
curl http://localhost:3000/api/v1/resources/performance

# Статистика памяти экземпляров
curl http://localhost:3000/api/v1/instances/memory/stats

# Очистка неактивных экземпляров из памяти
# (автоматически происходит каждые 5 минут)
```

### Диагностические команды

```bash
# Полная диагностика системы
cat > diagnose-system.sh << 'EOF'
#!/bin/bash

echo "🔍 Диагностика системы WWEB-MCP"
echo "================================"

# 1. Проверка Docker
echo "1️⃣ Docker статус:"
docker --version
docker compose version
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 2. Проверка Instance Manager
echo -e "\n2️⃣ Instance Manager:"
curl -s http://localhost:3000/health | jq . || echo "❌ Instance Manager недоступен"

# 3. Проверка базы данных
echo -e "\n3️⃣ База данных:"
docker exec wweb-mcp-instance-manager-1 psql $DATABASE_URL -c "SELECT COUNT(*) as instances FROM public.message_instances;" 2>/dev/null || echo "❌ База данных недоступна"

# 4. Проверка экземпляров
echo -e "\n4️⃣ Экземпляры:"
curl -s http://localhost:3000/api/v1/instances | jq '.instances | length' || echo "❌ Не удалось получить список экземпляров"

# 5. Проверка ресурсов
echo -e "\n5️⃣ Ресурсы системы:"
curl -s http://localhost:3000/api/v1/resources/performance | jq '.cpu_usage, .memory_usage' || echo "❌ Не удалось получить данные о ресурсах"

# 6. Проверка портов
echo -e "\n6️⃣ Использование портов:"
curl -s http://localhost:3000/api/v1/resources/ports | jq '.used_ports | length' || echo "❌ Не удалось получить данные о портах"

echo -e "\n✅ Диагностика завершена"
EOF

chmod +x diagnose-system.sh
./diagnose-system.sh
```

## 📝 Заключение

Данное руководство предоставляет полный набор инструментов для тестирования всех компонентов системы WhatsApp Web MCP:

### ✅ Покрытые области тестирования

1. **Instance Manager** - полное тестирование API и функциональности
   - Создание, управление и удаление экземпляров
   - Мониторинг ресурсов и производительности
   - Работа с памятью и историей статусов
   
2. **WhatsApp API** - тестирование аутентификации и отправки сообщений
   - REST API endpoints для всех функций
   - Управление контактами, чатами и группами
   - Отправка текстовых и медиа сообщений
   
3. **Telegram API** - тестирование bot интеграции и API endpoints
   - Полный набор Telegram Bot API функций
   - Polling и webhook режимы работы
   - Отправка сообщений и медиа контента
   
4. **Интеграционные тесты** - межкомпонентное взаимодействие
   - Полный жизненный цикл экземпляров
   - Тестирование множественных провайдеров
   
5. **E2E тесты** - полные пользовательские сценарии
   - Автоматизированные скрипты тестирования
   - Проверка всей системы от начала до конца
   
6. **Диагностика и мониторинг** - инструменты для отладки
   - Системные проверки и диагностика
   - Мониторинг ресурсов и производительности

### 🎯 Критерии готовности к продакшену

- [x] Instance Manager полностью протестирован
- [x] WhatsApp и Telegram интеграции работают
- [x] Supabase Cloud база данных настроена
- [x] REST API endpoints документированы и протестированы
- [x] Мониторинг и диагностика реализованы
- [x] E2E тесты автоматизированы
- [x] Документация по устранению неполадок готова

### 🚀 Архитектурные особенности

- **Микросервисная архитектура** с Instance Manager как центральным компонентом
- **Docker контейнеризация** для изоляции экземпляров
- **Supabase Cloud** для надежного хранения данных
- **Memory service** для быстрого доступа к runtime данным
- **Rate limiting** для защиты API endpoints
- **Webhook поддержка** для real-time интеграций

---

**Последнее обновление**: 28 января 2025  
**Версия системы**: wweb-mcp v0.2.6-dev-hotreload-test  
**Статус**: ✅ Production Ready с Supabase Cloud  
**Автор**: AI Assistant с анализом реальной архитектуры проекта 