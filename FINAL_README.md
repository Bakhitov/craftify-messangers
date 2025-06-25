# WhatsApp Web MCP

[![PR Checks](https://github.com/pnizer/wweb-mcp/actions/workflows/pr-checks.yml/badge.svg)](https://github.com/pnizer/wweb-mcp/actions/workflows/pr-checks.yml)

A Node.js application that connects WhatsApp Web with AI models through the Model Context Protocol (MCP). This project provides a standardized interface for programmatic interaction with WhatsApp, enabling automated messaging, contact management, and group chat functionality through AI-driven workflows.

## 📋 Содержание

- [Обзор](#обзор)
- [Установка](#установка)
- [Конфигурация](#конфигурация)
- [Использование](#использование)
- [Telegram Integration](#telegram-integration)
- [Instance Manager](#instance-manager)
- [API Документация](#api-документация)
- [Развертывание](#развертывание)
- [Оптимизация кода](#оптимизация-кода)
- [Тестирование](#тестирование)
- [Устранение неполадок](#устранение-неполадок)
- [Лицензия](#лицензия)

## 🔍 Обзор

WhatsApp Web MCP предоставляет бесшовную интеграцию между WhatsApp Web и AI моделями через:

- Создание стандартизированного интерфейса через Model Context Protocol (MCP)
- Предоставление MCP серверу доступа к функциональности WhatsApp
- **НОВОЕ**: Поддержка Telegram ботов через grammY
- Гибкие варианты развертывания через SSE или Command режимы
- Поддержка как прямой интеграции с WhatsApp клиентом, так и API-подключения

### ⚠️ Дисклеймер

**ВАЖНО**: Этот инструмент предназначен только для тестирования и не должен использоваться в продакшн среде.

> Этот проект не связан, не ассоциирован, не авторизован, не одобрен WhatsApp или любыми его дочерними компаниями. Официальный сайт WhatsApp можно найти на whatsapp.com. WhatsApp не разрешает ботов или неофициальных клиентов на своей платформе, поэтому это не следует считать полностью безопасным.

## 🚀 Установка

### Быстрый старт

```bash
# Клонирование репозитория
git clone https://github.com/pnizer/wweb-mcp.git
cd wweb-mcp

# Установка зависимостей
npm install

# Сборка проекта
npm run build

# Глобальная установка
npm install -g .

# Или использование с npx
npx .
```

### Docker установка

```bash
# Сборка образа
docker build . -t wweb-mcp:latest

# Запуск с Docker Compose
docker-compose up -d
```

## ⚙️ Конфигурация

### Параметры командной строки

| Опция | Алиас | Описание | Варианты | По умолчанию |
|-------|-------|----------|----------|--------------|
| `--mode` | `-m` | Режим работы | `mcp`, `whatsapp-api`, `telegram-api` | `mcp` |
| `--mcp-mode` | `-c` | Режим MCP подключения | `standalone`, `api` | `standalone` |
| `--transport` | `-t` | Режим MCP транспорта | `sse`, `command` | `sse` |
| `--sse-port` | `-p` | Порт для SSE сервера (если не указан - назначается динамически) | - | `динамический` |
| `--api-port` | - | Порт для API сервера (если не указан - назначается динамически) | - | `динамический` |
| `--auth-data-path` | `-a` | Путь для хранения данных аутентификации | - | `.wwebjs_auth` |
| `--auth-strategy` | `-s` | Стратегия аутентификации | `local`, `none` | `local` |
| `--api-base-url` | `-b` | Базовый URL API для MCP в режиме api | - | `http://localhost:${API_PORT}/api` |
| `--api-key` | `-k` | API ключ для WhatsApp Web REST API | - | `''` |
| `--telegram-bot-token` | - | Токен для Telegram бота | - | - |
| `--log-level` | `-l` | Уровень логирования | `error`, `warn`, `info`, `http`, `debug` | `info` |

### Переменные окружения

```bash
# Основные настройки (порты назначаются динамически)
PORT=${API_PORT}  # Назначается автоматически
NODE_ENV=development
LOG_LEVEL=info

# Управление портами
BASE_PORT_RANGE_START=3001  # Начало диапазона портов
BASE_PORT_RANGE_END=7999    # Конец диапазона портов

# База данных (для Instance Manager)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=wweb_instances
DB_USER=postgres
DB_PASSWORD=password
DB_SSL=false
DATABASE_SCHEMA=public

# WhatsApp настройки
WHATSAPP_AUTH_STRATEGY=local
MEDIA_PATH=.wwebjs_auth/media
WHATSAPP_MAX_CONNECTIONS=10

# Telegram настройки
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_ENABLED=true
TELEGRAM_WEBHOOK_URL=https://your-domain.com/api/telegram/webhook
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret

# Instance Manager (фиксированный порт для управления)
INSTANCE_MANAGER_PORT=3000
INSTANCE_MANAGER_BASE_URL=http://localhost:3000
DOCKER_SOCKET_PATH=/var/run/docker.sock
```

## 📱 Telegram Integration

### Миграция на grammY

**ВАЖНО**: В версии 0.2.5 мы заменили библиотеку `telegram` (GramJS) на `grammY` для лучшей поддержки ботов.

#### Преимущества grammY:
- ✅ Специально разработан для Telegram ботов
- ✅ Простая аутентификация через Bot Token
- ✅ Отличная TypeScript поддержка
- ✅ Активное развитие и поддержка
- ✅ Богатая экосистема плагинов

#### Миграция с telegram на grammY:

1. **Получите Bot Token**:
   - Найдите @BotFather в Telegram
   - Создайте нового бота: `/newbot`
   - Скопируйте полученный токен

2. **Обновите конфигурацию**:
   ```bash
   # Старая конфигурация (больше не используется)
   TELEGRAM_API_ID=your_api_id
   TELEGRAM_API_HASH=your_api_hash
   TELEGRAM_PHONE_NUMBER=+1234567890
   
   # Новая конфигурация
   TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
   TELEGRAM_ENABLED=true
   ```

3. **Перезапустите приложение**:
   ```bash
   npm run build
   npm start
   ```

### Использование Telegram API

```bash
# Запуск Telegram API сервера (порт назначается динамически)
npx wweb-mcp --mode telegram-api

# Проверьте логи для получения назначенного порта, затем:
# Проверка статуса бота
curl http://localhost:${API_PORT}/api/telegram/status

# Отправка сообщения
curl -X POST http://localhost:${API_PORT}/api/telegram/send \
  -H "Content-Type: application/json" \
  -d '{"chatId": "123456789", "message": "Hello from grammY!"}'

# Отправка медиа
curl -X POST http://localhost:${API_PORT}/api/telegram/send-media \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "123456789",
    "source": "https://example.com/image.jpg",
    "caption": "Check out this image!"
  }'
```

### Доступные Telegram инструменты

| Инструмент | Описание | Параметры |
|------------|----------|-----------|
| `get_telegram_status` | Проверка статуса Telegram бота | Нет |
| `send_telegram_message` | Отправка сообщений в Telegram | `chatId`, `message` |
| `send_telegram_media` | Отправка медиа в Telegram | `chatId`, `source`, `caption` |
| `get_telegram_group` | Получение информации о группе | `groupId` |
| `get_telegram_me` | Получение информации о боте | Нет |

## 🎯 Использование

### Режимы работы

#### 1. WhatsApp API Сервер

```bash
# Запуск standalone API сервера (порт назначается динамически)
npx wweb-mcp --mode whatsapp-api

# Проверьте логи для получения назначенного порта
# С Docker (портирование настроено автоматически)
docker run -p ${BASE_PORT_RANGE_START:-3001}-${BASE_PORT_RANGE_END:-7999}:${BASE_PORT_RANGE_START:-3001} wweb-mcp:latest --mode whatsapp-api
```

#### 2. Telegram API Сервер

```bash
# Запуск Telegram API сервера (порт назначается динамически)
npx wweb-mcp --mode telegram-api

# С переменными окружения
TELEGRAM_BOT_TOKEN=your_token npx wweb-mcp --mode telegram-api
```

#### 3. MCP Сервер (Standalone)

```bash
# Прямое подключение к WhatsApp Web (порт назначается динамически)
npx wweb-mcp --mode mcp --mcp-mode standalone --transport sse
```

#### 4. MCP Сервер (API Client)

```bash
# Сначала запустите API сервер и получите API ключ из логов
npx wweb-mcp --mode whatsapp-api

# Получите назначенный порт из логов, затем запустите MCP сервер с API ключом
npx wweb-mcp --mode mcp --mcp-mode api --api-base-url http://localhost:${API_PORT}/api --api-key YOUR_API_KEY --transport sse
```

### Доступные инструменты

| Инструмент | Описание | Параметры |
|------------|----------|-----------|
| `get_status` | Проверка статуса подключения WhatsApp | Нет |
| `send_message` | Отправка сообщений контактам | `number`, `message` |
| `search_contacts` | Поиск контактов по имени или номеру | `query` |
| `get_messages` | Получение сообщений из чата | `number`, `limit` |
| `get_chats` | Получение списка всех чатов | Нет |
| `create_group` | Создание новой группы | `name`, `participants` |
| `add_participants_to_group` | Добавление участников в группу | `groupId`, `participants` |
| `get_group_messages` | Получение сообщений из группы | `groupId`, `limit` |
| `send_group_message` | Отправка сообщения в группу | `groupId`, `message` |
| `search_groups` | Поиск групп | `query` |
| `get_group_by_id` | Получение информации о группе | `groupId` |
| `download_media_from_message` | Скачивание медиа из сообщения | `messageId` |
| `send_media_message` | Отправка медиа сообщения | `number`, `source`, `caption` |

## 🏗️ Instance Manager

Instance Manager позволяет управлять множественными экземплярами WhatsApp через единый API.

### Основные возможности

- **Управление экземплярами**: Создание, запуск, остановка, удаление
- **Мониторинг**: Отслеживание состояния, логов, ресурсов
- **Автоматизация**: Автоматический перезапуск, health checks
- **Масштабирование**: Поддержка множественных экземпляров
- **API интеграция**: RESTful API для всех операций

### Запуск Instance Manager

```bash
# Запуск с Docker Compose
docker-compose -f docker-compose.instance-manager.yml up -d

# Или локально
npm run start:instance-manager
```

### API Endpoints

#### Управление экземплярами

```bash
# Создание экземпляра
POST /api/v1/instances
{
  "user_id": "user123",
  "type_instance": ["api", "mcp"]
}

# Получение списка экземпляров
GET /api/v1/instances

# Получение экземпляра по ID
GET /api/v1/instances/{id}

# Запуск экземпляра
POST /api/v1/instances/{id}/start

# Остановка экземпляра
POST /api/v1/instances/{id}/stop

# Удаление экземпляра
DELETE /api/v1/instances/{id}
```

#### Мониторинг

```bash
# Статус аутентификации
GET /api/v1/instances/{id}/auth-status

# QR код для аутентификации
GET /api/v1/instances/{id}/qr

# Учетные данные
GET /api/v1/instances/{id}/credentials

# Логи экземпляра
GET /api/v1/instances/{id}/logs?tail=100

# Проверка здоровья
GET /api/v1/instances/{id}/health
```

#### Ресурсы и производительность

```bash
# Статистика портов
GET /api/v1/resources/ports

# Метрики производительности
GET /api/v1/resources/performance

# Состояние системы
GET /api/v1/resources/health

# Очистка кэша портов
POST /api/v1/resources/ports/clear-cache

# Стресс-тестирование
POST /api/v1/resources/stress-test
```

## 📚 API Документация

### WhatsApp API Endpoints

#### Статус и аутентификация

```bash
# Получение статуса клиента
GET /api/status
# Ответ: { "status": "connected", "info": {...}, "qr": "...", "state": "READY" }

# Health check
GET /api/health
# Ответ: { "status": "ok", "timestamp": "..." }
```

#### Сообщения

```bash
# Отправка сообщения
POST /api/send
{
  "number": "+1234567890",
  "message": "Hello, World!"
}

# Получение сообщений
GET /api/messages/{number}?limit=10

# Отправка медиа
POST /api/send-media
{
  "number": "+1234567890",
  "source": "https://example.com/image.jpg",
  "caption": "Optional caption"
}
```

#### Контакты и чаты

```bash
# Поиск контактов
GET /api/contacts/search?query=John

# Получение чатов
GET /api/chats

# Скачивание медиа
GET /api/download-media/{messageId}
```

#### Группы

```bash
# Создание группы
POST /api/create-group
{
  "name": "My Group",
  "participants": ["+1234567890", "+0987654321"]
}

# Добавление участников
POST /api/add-participants
{
  "groupId": "group_id@g.us",
  "participants": ["+1111111111"]
}

# Сообщения группы
GET /api/group-messages/{groupId}?limit=10

# Отправка в группу
POST /api/send-group
{
  "groupId": "group_id@g.us",
  "message": "Hello, Group!"
}

# Поиск групп
GET /api/groups/search?query=work

# Информация о группе
GET /api/groups/{groupId}
```

## 🧪 Тестирование

Для ручного тестирования WhatsApp и Telegram интеграций воспользуйтесь отдельным руководством: [TESTING_GUIDE.md](./TESTING_GUIDE.md).

### Быстрое тестирование (5 минут)

```bash
# 1. Проверка health check
curl http://localhost:3003/health

# 2. Создание тестового экземпляра
curl -X POST http://localhost:3003/api/v1/instances \
  -H "Content-Type: application/json" \
  -d '{"user_id": "test_user", "type_instance": ["api"]}'

# 3. Получение списка экземпляров
curl http://localhost:3003/api/v1/instances

# 4. Проверка статистики портов
curl http://localhost:3003/api/v1/resources/ports

# 5. Очистка тестовых данных
./cleanup-test-instances.sh
```

### Автоматическое тестирование

```bash
# Запуск всех тестов
npm test

# Линтинг
npm run lint

# Проверка типов
npm run type-check

# Стресс-тестирование Instance Manager
curl -X POST http://localhost:3003/api/v1/resources/stress-test \
  -H "Content-Type: application/json" \
  -d '{"concurrent": 5, "iterations": 10}'
```

## 🔍 Устранение неполадок

### Частые проблемы

#### 1. QR код не отображается

```bash
# Проверка статуса
curl http://localhost:3001/api/status

# Проверка логов
docker logs whatsapp-api

# Очистка данных аутентификации
rm -rf .wwebjs_auth
```

#### 2. Проблемы с портами

```bash
# Проверка занятых портов
netstat -tulpn | grep :3001

# Очистка кэша портов
curl -X POST http://localhost:3003/api/v1/resources/ports/clear-cache

# Проверка статистики портов
curl http://localhost:3003/api/v1/resources/ports
```

#### 3. Проблемы с Docker

```bash
# Проверка Docker
docker ps
docker logs instance-manager

# Проверка подключения к Docker
curl http://localhost:3003/api/v1/resources/health

# Перезапуск сервисов
docker-compose restart
```

### Отладка

```bash
# Включение debug логов
export LOG_LEVEL=debug
export DEBUG=*

# Проверка переменных окружения
env | grep -E "(DB_|INSTANCE_|WHATSAPP_)"

# Мониторинг ресурсов
curl http://localhost:3003/api/v1/resources/performance
```

### Логи

```bash
# Логи WhatsApp API
docker logs whatsapp-api -f

# Логи Instance Manager
docker logs instance-manager -f

# Логи PostgreSQL
docker logs postgres -f

# Системные логи
journalctl -u wweb-mcp -f
```

## 📊 Мониторинг и метрики

### Доступные метрики

- **Производительность**: Время ответа, пропускная способность
- **Ресурсы**: Использование CPU, памяти, портов
- **Ошибки**: Частота ошибок, типы ошибок
- **Состояние**: Health checks, статус сервисов

### Endpoints мониторинга

```bash
# Общее состояние системы
GET /api/v1/resources/health

# Метрики производительности
GET /api/v1/resources/performance

# Статистика использования портов
GET /api/v1/resources/ports

# Health check Instance Manager
GET /health

# Health check WhatsApp API
GET /api/health
```

## 📄 Лицензия

Этот проект лицензирован под MIT License - см. файл [LICENSE](LICENSE) для деталей.

## 🔗 Полезные ссылки

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [WhatsApp Web.js](https://wwebjs.dev/)
- [Docker Documentation](https://docs.docker.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [grammY Documentation](https://grammy.dev/)

## 📞 Поддержка

Если у вас есть вопросы или проблемы:

1. Проверьте [Issues](https://github.com/pnizer/wweb-mcp/issues)
2. Создайте новый Issue с подробным описанием
3. Используйте шаблоны для bug reports и feature requests

---

**Версия**: 0.2.5  
**Последнее обновление**: 25.05.2025 