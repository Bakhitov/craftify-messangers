# 🚀 WWEB-MCP: WhatsApp & Telegram MCP Server

[![PR Checks](https://github.com/pnizer/wweb-mcp/actions/workflows/pr-checks.yml/badge.svg)](https://github.com/pnizer/wweb-mcp/actions/workflows/pr-checks.yml)

Мощная система для интеграции WhatsApp Web и Telegram с AI моделями через Model Context Protocol (MCP). Поддерживает множественные инстансы, REST API и динамическое управление контейнерами.

## 📋 Содержание

- [🔍 Обзор](#-обзор)
- [🏗️ Архитектура](#️-архитектура)
- [⚡ Быстрый старт](#-быстрый-старт)
- [🛠️ Разработка](#️-разработка)
- [🚀 Production](#-production)
- [📚 API Документация](#-api-документация)
- [🧪 Тестирование](#-тестирование)
- [🔧 Устранение неполадок](#-устранение-неполадок)

## 🔍 Обзор

### Что это?

WWEB-MCP - это комплексная система, которая предоставляет:

- **WhatsApp Web API** - программный доступ к WhatsApp через whatsapp-web.js
- **Telegram Bot API** - интеграция с Telegram через grammY библиотеку
- **Instance Manager** - управление множественными инстансами в Docker контейнерах
- **MCP Server** - интеграция с AI моделями (Claude) через Model Context Protocol
- **REST API** - полноценный API для автоматизации сообщений

### Основные возможности

✅ **Множественные инстансы** - создание и управление несколькими WhatsApp/Telegram инстансами  
✅ **Docker интеграция** - автоматическое создание и управление контейнерами  
✅ **Hot reload** - быстрая разработка с автоматической пересборкой  
✅ **REST API** - полный набор endpoints для интеграции  
✅ **Webhook поддержка** - получение событий в реальном времени  
✅ **Database integration** - PostgreSQL для хранения метаданных  
✅ **Production ready** - готовая конфигурация с Nginx и SSL  

### ⚠️ Важно

> **Этот проект предназначен только для тестирования и не должен использоваться в продакшн среде с реальными пользователями WhatsApp.** WhatsApp не разрешает ботов или неофициальных клиентов на своей платформе.

## 🏗️ Архитектура

### Компоненты системы

```
┌─────────────────────────────────────────────────────────────┐
│                    WWEB-MCP СИСТЕМА                         │
├─────────────────────────────────────────────────────────────┤
│  🎯 Instance Manager (Порт 3000)                           │
│  ├── REST API для управления инстансами                     │
│  ├── Docker Service (создание контейнеров)                  │
│  ├── Database Service (PostgreSQL)                          │
│  └── Health Monitoring                                      │
├─────────────────────────────────────────────────────────────┤
│  📱 WhatsApp Instances (Динамические порты 3001-7999)      │
│  ├── WhatsApp Web Client (puppeteer + whatsapp-web.js)     │
│  ├── REST API (/api/v1/whatsapp)                           │
│  ├── MCP Server интеграция                                 │
│  └── Webhook поддержка                                      │
├─────────────────────────────────────────────────────────────┤
│  💬 Telegram Instances (Динамические порты 4001-8999)      │
│  ├── Telegram Bot (grammY)                                 │
│  ├── REST API (/api/v1/telegram)                           │
│  ├── Bot Token аутентификация                               │
│  └── Webhook поддержка                                      │
├─────────────────────────────────────────────────────────────┤
│  🧠 MCP Server (Динамические порты)                        │
│  ├── Model Context Protocol интеграция                      │
│  ├── AI Tools для WhatsApp и Telegram                      │
│  └── SSE/Command транспорт                                  │
└─────────────────────────────────────────────────────────────┘
```

### Режимы работы

| Режим | Описание | Энтрипоинт | Порт |
|-------|----------|------------|------|
| **Instance Manager** | Управление инстансами | `main-instance-manager.js` | 3000 (фиксированный) |
| **WhatsApp API** | Standalone WhatsApp API | `main.js -m whatsapp-api` | Динамический |
| **Telegram API** | Standalone Telegram API | `main.js -m telegram-api` | Динамический |
| **MCP Server** | AI интеграция | `main.js -m mcp` | Динамический |

## ⚡ Быстрый старт

### Системные требования

- **Node.js** >= 18.0.0
- **Docker** + Docker Compose
- **PostgreSQL** >= 12 (для Instance Manager)
- **4GB RAM** минимум для запуска нескольких инстансов

### macOS (разработка)
```bash
# Установка Colima (альтернатива Docker Desktop)
brew install colima docker docker-compose
colima start

# Клонирование проекта
git clone https://github.com/pnizer/wweb-mcp.git
cd wweb-mcp

# Автоматическая установка
chmod +x install.sh
./install.sh
```

### Linux (production)
```bash
# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Клонирование и установка
git clone https://github.com/pnizer/wweb-mcp.git
cd wweb-mcp
chmod +x install.sh
./install.sh
```

### Быстрая проверка установки

```bash
# Проверка сборки
npm run build

# Health check
npm start -- --mode whatsapp-api &
sleep 5
curl http://localhost:$(docker logs wweb-mcp-whatsapp-api-1 2>&1 | grep "listening on port" | tail -1 | grep -o '[0-9]*')/api/health
```

## 🛠️ Разработка

### Конфигурация для разработки

Создайте `.env.development`:

```bash
# ===========================================
# DEVELOPMENT КОНФИГУРАЦИЯ (macOS/Colima)
# ===========================================

# Режим разработки
NODE_ENV=development
LOG_LEVEL=debug

# База данных (локальная или в контейнере)
DATABASE_HOST=host.docker.internal
DATABASE_PORT=5432
DATABASE_NAME=ai
DATABASE_USER=ai
DATABASE_PASSWORD=ai
DATABASE_SCHEMA=ai

# Instance Manager
INSTANCE_MANAGER_PORT=3000
INSTANCE_MANAGER_BASE_URL=http://localhost:3000

# Docker настройки для macOS Colima
DOCKER_SOCKET_PATH=/Users/$(whoami)/.colima/default/docker.sock

# Диапазон портов
BASE_PORT_RANGE_START=3001
BASE_PORT_RANGE_END=7999
TELEGRAM_BASE_PORT_RANGE_START=4001
TELEGRAM_BASE_PORT_RANGE_END=8999

# Пути (относительные для dev)
COMPOSE_FILES_PATH=./composes
VOLUMES_PATH=./volumes

# WhatsApp настройки
WHATSAPP_AUTH_STRATEGY=local
WHATSAPP_MAX_CONNECTIONS=5

# Telegram настройки (получите токен у @BotFather)
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN_HERE
TELEGRAM_ENABLED=true

# AI интеграция (для тестирования)
AGNO_API_BASE_URL=http://host.docker.internal:8000
AGNO_API_TIMEOUT=10000
AGNO_ENABLED=false
```

### Запуск в режиме разработки

```bash
# 1. Копируем dev конфигурацию
cp .env.development .env

# 2. Запуск с hot reload (рекомендуется)
chmod +x dev-watch.sh
./dev-watch.sh

# Или ручной запуск Instance Manager
docker-compose -f docker-compose.instance-manager.yml up -d --build

# 3. Проверка статуса
curl http://localhost:3000/health
```

### Структура development окружения

```bash
wweb-mcp/
├── .env                     # Активная конфигурация  
├── .env.development         # Dev шаблон
├── composes/               # Генерируемые compose файлы
│   └── instance-*.yml
├── volumes/                # Данные инстансов
│   ├── instance-{id}/
│   │   ├── whatsapp_auth/
│   │   └── telegram_auth/
├── logs/                   # Логи всех контейнеров
└── dist/                   # Собранный код (auto-rebuild)
```

### Hot Reload разработка

Hot reload настроен для быстрой разработки:

1. **TypeScript Watch** - автоматическая пересборка при изменении `.ts` файлов
2. **Volume Mapping** - изменения попадают в контейнер без пересборки
3. **Nodemon** - автоматический перезапуск сервисов

```bash
# Запуск hot reload
./dev-watch.sh

# В другом терминале - изменяйте код
# Изменения в src/ автоматически компилируются в dist/
# Instance Manager автоматически перезапускается
```

### Полезные команды для разработки

```bash
# Логи Instance Manager
docker logs wweb-mcp-instance-manager-1 -f

# Создание тестового WhatsApp инстанса
curl -X POST http://localhost:3000/api/v1/instances \
  -H "Content-Type: application/json" \
  -d '{"user_id": "dev-test", "provider": "whatsappweb", "type_instance": ["api"]}'

# Создание тестового Telegram инстанса
curl -X POST http://localhost:3000/api/v1/instances \
  -H "Content-Type: application/json" \
  -d '{"user_id": "dev-test", "provider": "telegram", "type_instance": ["api"], "api_key": "YOUR_BOT_TOKEN"}'

# Список всех инстансов
curl http://localhost:3000/api/v1/instances

# Список Docker контейнеров
docker ps --filter "name=wweb-mcp"

# Очистка всех контейнеров
docker-compose -f docker-compose.instance-manager.yml down
docker system prune -f
```

## 🚀 Production

### Конфигурация для production

Создайте `.env.production`:

```bash
# ===========================================
# PRODUCTION КОНФИГУРАЦИЯ (Linux Server)
# ===========================================

# Режим production
NODE_ENV=production
LOG_LEVEL=info

# База данных (в Docker)
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=ai
DATABASE_USER=ai
DATABASE_PASSWORD=SUPER_SECURE_PASSWORD_CHANGE_ME_2025
DATABASE_SCHEMA=ai

# Instance Manager
INSTANCE_MANAGER_PORT=3000
INSTANCE_MANAGER_BASE_URL=https://your-domain.com

# Docker настройки для Linux
DOCKER_SOCKET_PATH=/var/run/docker.sock

# Диапазон портов
BASE_PORT_RANGE_START=3001
BASE_PORT_RANGE_END=7999
TELEGRAM_BASE_PORT_RANGE_START=4001
TELEGRAM_BASE_PORT_RANGE_END=8999

# Пути (абсолютные для production)
COMPOSE_FILES_PATH=/app/composes
VOLUMES_PATH=/app/volumes

# Security
WHATSAPP_AUTH_STRATEGY=local
WHATSAPP_MAX_CONNECTIONS=20

# AI интеграция (production API)
AGNO_API_BASE_URL=https://agno-api.your-domain.com
AGNO_API_TIMEOUT=15000
AGNO_ENABLED=true

# SSL (для Nginx)
SSL_CERT_PATH=/etc/ssl/certs/your-domain.crt
SSL_KEY_PATH=/etc/ssl/private/your-domain.key
```

### Развертывание production

```bash
# 1. Подготовка сервера
sudo apt update && sudo apt upgrade -y
sudo apt install docker.io docker-compose postgresql-client nginx certbot

# 2. Клонирование и настройка
git clone https://github.com/pnizer/wweb-mcp.git
cd wweb-mcp

# 3. Настройка production конфигурации
cp .env.production .env
nano .env  # Отредактируйте пароли и домены

# 4. Создание SSL сертификатов
sudo certbot certonly --nginx -d your-domain.com
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ./ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ./ssl/

# 5. Запуск production стека
docker-compose -f docker-compose.production.yml up -d --build

# 6. Проверка
curl https://your-domain.com/health
```

### Production архитектура

```yaml
# docker-compose.production.yml
services:
  postgres:          # PostgreSQL база данных
    image: postgres:16-alpine
    volumes: [postgres_data:/var/lib/postgresql/data]
    healthcheck: [pg_isready]
    
  instance-manager:  # Основной сервис управления
    build: {dockerfile: Dockerfile.instance-manager}
    depends_on: [postgres]
    volumes: [/var/run/docker.sock, ./composes, ./volumes]
    
  nginx:             # Reverse proxy + SSL
    image: nginx:alpine
    volumes: [./nginx.conf, ./ssl]
    ports: ["80:80", "443:443"]
```

### Мониторинг production

```bash
# Проверка статуса всех сервисов
docker-compose -f docker-compose.production.yml ps

# Логи
docker-compose -f docker-compose.production.yml logs -f

# Health checks
curl https://your-domain.com/health
curl https://your-domain.com/api/v1/instances

# Мониторинг ресурсов
docker stats

# Backup базы данных
docker exec postgres_container pg_dump -U ai ai > backup_$(date +%Y%m%d).sql
```

### Обновление production

```bash
# 1. Создание backup
docker exec wweb-postgres pg_dump -U ai ai > backup_before_update.sql

# 2. Остановка сервисов
docker-compose -f docker-compose.production.yml down

# 3. Обновление кода
git pull origin main
npm ci --omit=dev
npm run build

# 4. Пересборка образов
docker-compose -f docker-compose.production.yml build --no-cache

# 5. Запуск обновленных сервисов
docker-compose -f docker-compose.production.yml up -d

# 6. Проверка
curl https://your-domain.com/health
```

## 📚 API Документация

### Instance Manager API

**Base URL:** `http://localhost:3000/api/v1`

#### Управление инстансами

```bash
# Получить все инстансы
GET /instances

# Создать новый инстанс
POST /instances
{
  "user_id": "user123",
  "provider": "whatsappweb|telegram", 
  "type_instance": ["api"],
  "api_key": "telegram_bot_token",  // только для Telegram
  "api_webhook_schema": {
    "enabled": true,
    "url": "https://your-webhook.com/webhook"
  }
}

# Получить инстанс
GET /instances/{id}

# Запустить инстанс (создать Docker контейнер)
POST /instances/{id}/process

# Запустить контейнер
POST /instances/{id}/start

# Остановить контейнер  
POST /instances/{id}/stop

# Перезапустить контейнер
POST /instances/{id}/restart

# Удалить инстанс
DELETE /instances/{id}

# Получить логи инстанса
GET /instances/{id}/logs

# Получить статус QR кода (WhatsApp)
GET /instances/{id}/qr-status

# Получить QR код (WhatsApp)
GET /instances/{id}/qr
```

#### System API

```bash
# Health check
GET /health

# Статистика системы
GET /api/v1/system/stats

# Список Docker контейнеров
GET /api/v1/system/containers

# Информация о портах
GET /api/v1/system/ports
```

### WhatsApp Instance API

**Base URL:** `http://localhost:{динамический_порт}/api/v1/whatsapp`

```bash
# Статус клиента
GET /status

# Отправить сообщение
POST /send-message
{
  "to": "79161234567@c.us",
  "message": "Привет из WhatsApp!"
}

# Отправить медиа
POST /send-media
{
  "to": "79161234567@c.us", 
  "media": "base64_or_url",
  "caption": "Описание медиа"
}

# Получить чаты
GET /chats

# Получить контакты
GET /contacts

# Получить сообщения чата
GET /chats/{chatId}/messages

# Создать группу
POST /groups
{
  "name": "Моя группа",
  "participants": ["79161234567@c.us"]
}
```

### Telegram Instance API

**Base URL:** `http://localhost:{динамический_порт}/api/v1/telegram`

```bash
# Информация о боте
GET /me

# Отправить сообщение
POST /send-message
{
  "chatId": "123456789",
  "message": "Привет из Telegram!"
}

# Отправить медиа
POST /send-media
{
  "chatId": "123456789",
  "source": "https://example.com/image.jpg",
  "caption": "Описание"
}

# Статус бота
GET /status

# Получить обновления
GET /updates

# Установить webhook
POST /webhook
{
  "url": "https://your-domain.com/webhook"
}
```

## 🧪 Тестирование

### Unit тесты

```bash
# Запуск всех тестов
npm test

# Watch режим
npm run test:watch

# Покрытие кода
npm run test:coverage

# Только unit тесты
npm run test -- --testPathPattern=unit
```

### Интеграционные тесты

```bash
# Подготовка тестовой базы
createdb wweb_test
PGPASSWORD=ai psql -h localhost -p 5432 -U ai -d wweb_test -f db/migrations/init.sql

# Запуск интеграционных тестов
TEST_MODE=integration npm test

# Тестирование WhatsApp API
node telegram-integration-test.js

# Тестирование Telegram API  
node telegram-fixed-test.js

# E2E тесты
npm run test:e2e
```

### Нагрузочное тестирование

```bash
# Установка K6
brew install k6  # macOS
sudo apt install k6  # Linux

# Тест создания инстансов
k6 run test/load/instances.js

# Тест API endpoints
k6 run test/load/api.js
```

### Проверка в реальном времени

```bash
# 1. Запуск Instance Manager
docker-compose -f docker-compose.instance-manager.yml up -d

# 2. Создание WhatsApp инстанса
INSTANCE_ID=$(curl -s -X POST http://localhost:3000/api/v1/instances \
  -H "Content-Type: application/json" \
  -d '{"user_id": "test", "provider": "whatsappweb", "type_instance": ["api"]}' \
  | jq -r '.instance.id')

# 3. Запуск инстанса
curl -X POST http://localhost:3000/api/v1/instances/$INSTANCE_ID/process
curl -X POST http://localhost:3000/api/v1/instances/$INSTANCE_ID/start

# 4. Получение QR кода
curl http://localhost:3000/api/v1/instances/$INSTANCE_ID/qr

# 5. Отправка тестового сообщения (после сканирования QR)
API_PORT=$(docker port wweb-mcp-${INSTANCE_ID} | cut -d: -f2)
curl -X POST http://localhost:$API_PORT/api/v1/whatsapp/send-message \
  -H "Content-Type: application/json" \
  -d '{"to": "79161234567@c.us", "message": "Тест из API!"}'
```

## 🔧 Устранение неполадок

### Типичные проблемы

#### 1. Docker Socket недоступен (macOS)

```bash
# Проблема: Cannot connect to Docker daemon
# Решение: Проверьте путь к Colima socket
ls -la ~/.colima/default/docker.sock

# Обновите .env
DOCKER_SOCKET_PATH=/Users/$(whoami)/.colima/default/docker.sock
```

#### 2. Порты заняты

```bash
# Найти процесс на порту
lsof -i :3000

# Убить процесс
kill -9 $(lsof -t -i:3000)

# Освободить диапазон портов
./get-ports.sh
```

#### 3. WhatsApp не подключается

```bash
# Проверка логов
docker logs wweb-mcp-{instance_id} -f

# Очистка данных аутентификации
rm -rf volumes/instance-{id}/whatsapp_auth

# Перезапуск инстанса
curl -X POST http://localhost:3000/api/v1/instances/{id}/restart
```

#### 4. База данных недоступна

```bash
# Проверка подключения
PGPASSWORD=ai psql -h localhost -p 5432 -U ai -d ai -c "SELECT 1;"

# Инициализация схемы
PGPASSWORD=ai psql -h localhost -p 5432 -U ai -d ai -f db/migrations/versions/init.sql

# Проверка таблиц
PGPASSWORD=ai psql -h localhost -p 5432 -U ai -d ai -c "\dt ai.*"
```

#### 5. Instance Manager не запускается

```bash
# Проверка образа
docker images | grep wweb-mcp

# Пересборка
docker-compose -f docker-compose.instance-manager.yml build --no-cache

# Проверка volume mapping
docker-compose -f docker-compose.instance-manager.yml config
```

### Логи и отладка

```bash
# Основные логи
docker logs wweb-mcp-instance-manager-1 -f

# Логи конкретного инстанса
docker logs wweb-mcp-{instance_id} -f

# Системные логи
journalctl -u docker.service -f

# Логи с фильтрацией
docker logs wweb-mcp-instance-manager-1 2>&1 | grep ERROR

# Экспорт логов
docker logs wweb-mcp-instance-manager-1 > debug.log 2>&1
```

### Очистка и сброс

```bash
# Полная очистка
docker-compose -f docker-compose.instance-manager.yml down
docker system prune -a --volumes -f
rm -rf volumes/ composes/ logs/

# Сброс базы данных
PGPASSWORD=ai psql -h localhost -p 5432 -U ai -d ai -c "DROP SCHEMA ai CASCADE; CREATE SCHEMA ai;"

# Переустановка
./install.sh
```

### Производительность

```bash
# Мониторинг ресурсов
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"

# Анализ использования места
docker system df
du -sh volumes/
du -sh logs/

# Очистка старых данных
find logs/ -name "*.log" -mtime +7 -delete
find volumes/ -name "*.log" -mtime +30 -delete
```

---

## 📄 Лицензия

MIT License. См. [LICENSE](LICENSE) для подробностей.

## 🤝 Поддержка

- 📖 [Документация](FINAL_README.md)
- 🧪 [Гид по тестированию](TESTING_GUIDE_NEW.md)
- 📝 [История изменений](CHANGELOG.md)
- 🐛 [Issues](https://github.com/pnizer/wweb-mcp/issues)

---

**Сделано с ❤️ для сообщества разработчиков** 