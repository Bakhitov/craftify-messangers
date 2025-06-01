# 🚀 Craftify Messengers - WWEB-MCP Integration

[![GitHub stars](https://img.shields.io/github/stars/Bakhitov/craftify-messangers?style=social)](https://github.com/Bakhitov/craftify-messangers/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/Bakhitov/craftify-messangers?style=social)](https://github.com/Bakhitov/craftify-messangers/network/members)
[![GitHub issues](https://img.shields.io/github/issues/Bakhitov/craftify-messangers)](https://github.com/Bakhitov/craftify-messangers/issues)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> 🔥 **Мощная система для интеграции WhatsApp Web и Telegram с AI моделями через Model Context Protocol (MCP)**

Поддерживает множественные инстансы, REST API и динамическое управление Docker контейнерами для создания масштабируемых мессенджер-ботов.

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
- **PostgreSQL** >= 12 или Supabase
- **4GB RAM** минимум

### 📦 Установка

```bash
# 1. Клонирование репозитория
git clone https://github.com/Bakhitov/craftify-messangers.git
cd craftify-messangers

# 2. Установка зависимостей
npm install

# 3. Настройка окружения
cp .env.example .env
nano .env  # Отредактируйте настройки

# 4. Сборка проекта
npm run build

# 5. Запуск в development режиме
npm run dev:watch

# 6. Или запуск в production с Docker
docker-compose -f docker-compose.production.yml up -d --build
```

### ⚙️ Конфигурация

Основные переменные в `.env`:

```bash
# База данных
DATABASE_URL=your_database_url
DATABASE_HOST=localhost
DATABASE_PORT=5432

# Instance Manager
INSTANCE_MANAGER_PORT=3000
BASE_PORT_RANGE_START=3001
BASE_PORT_RANGE_END=7999

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_BASE_PORT_RANGE_START=4001
TELEGRAM_BASE_PORT_RANGE_END=8999

# AI Integration
AGNO_ENABLED=true
AGNO_API_BASE_URL=http://localhost:8000
```

## 📚 API Документация

### Instance Manager API

| Endpoint | Method | Описание |
|----------|--------|----------|
| `/api/v1/instances` | GET | Список всех инстансов |
| `/api/v1/instances` | POST | Создание нового инстанса |
| `/api/v1/instances/:id` | DELETE | Удаление инстанса |
| `/api/v1/instances/:id/start` | POST | Запуск инстанса |
| `/api/v1/instances/:id/stop` | POST | Остановка инстанса |

### WhatsApp API

```bash
# Отправка сообщения
POST /api/v1/whatsapp/send
{
  "to": "79001234567",
  "message": "Привет из WhatsApp!"
}

# Получение QR кода
GET /api/v1/whatsapp/qr

# Статус подключения
GET /api/v1/whatsapp/status
```

### Telegram API

```bash
# Отправка сообщения
POST /api/v1/telegram/send
{
  "chat_id": "123456789",
  "text": "Привет из Telegram!"
}

# Получение обновлений
GET /api/v1/telegram/updates
```

## 🐳 Docker Deployment

### Development

```bash
# Запуск Instance Manager
docker-compose -f docker-compose.instance-manager.yml up -d

# Просмотр логов
docker-compose logs -f
```

### Production

```bash
# Полный production стек
docker-compose -f docker-compose.production.yml up -d --build

# Мониторинг
docker-compose -f docker-compose.production.yml ps
docker stats
```

## 🔧 Разработка

### Структура проекта

```
craftify-messangers/
├── src/
│   ├── instance-manager/     # Instance Manager сервис
│   ├── providers/           # WhatsApp и Telegram провайдеры
│   ├── services/           # Бизнес-логика
│   ├── api.ts             # REST API endpoints
│   └── main.ts            # Главный файл приложения
├── docker-compose.yml      # Docker конфигурация
├── Dockerfile             # Docker образ
└── docs/                  # Документация
```

### Команды разработки

```bash
# Разработка с hot reload
npm run dev:watch

# Сборка проекта
npm run build

# Тестирование
npm test

# Линтинг
npm run lint

# Форматирование кода
npm run format
```

## 📊 Мониторинг и логи

### Просмотр логов

```bash
# Логи Instance Manager
docker logs wweb-mcp-instance-manager-1 -f

# Логи всех сервисов
docker-compose logs -f

# Системные ресурсы
docker stats
htop
```

### Health Checks

```bash
# Проверка Instance Manager
curl http://localhost:3000/health

# Проверка WhatsApp API
curl http://localhost:3001/api/health

# Проверка Telegram API
curl http://localhost:4001/api/health
```

## 🔒 Безопасность

- ✅ Environment variables для чувствительных данных
- ✅ Rate limiting для API endpoints
- ✅ Input validation и sanitization
- ✅ Docker security best practices
- ✅ SSL/TLS поддержка через Nginx

## 🌍 Deployment на облачных платформах

### AWS EC2

```bash
# Создание EC2 инстанса
# t3.medium (2 vCPU, 4GB RAM) - рекомендуемый минимум

# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Клонирование и запуск
git clone https://github.com/Bakhitov/craftify-messangers.git
cd craftify-messangers
docker-compose -f docker-compose.production.yml up -d
```

### DigitalOcean Droplet

```bash
# Создание Droplet (4GB RAM, 2 vCPU)
# Установка Docker и запуск аналогично AWS
```

## 🤝 Вклад в проект

1. **Fork** репозитория
2. Создайте **feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit** изменения (`git commit -m 'Add amazing feature'`)
4. **Push** в branch (`git push origin feature/amazing-feature`)
5. Создайте **Pull Request**

## 📄 Лицензия

Этот проект лицензирован под MIT License - см. файл [LICENSE](LICENSE) для деталей.

## 🆘 Поддержка

- 📧 **Email**: support@craftify-messengers.com
- 💬 **Telegram**: [@craftify_support](https://t.me/craftify_support)
- 🐛 **Issues**: [GitHub Issues](https://github.com/Bakhitov/craftify-messangers/issues)
- 📖 **Wiki**: [Документация](https://github.com/Bakhitov/craftify-messangers/wiki)

## ⭐ Поддержите проект

Если этот проект помог вам, поставьте ⭐ на GitHub!

---

<div align="center">

**Сделано с ❤️ для сообщества разработчиков**

[🌟 Star](https://github.com/Bakhitov/craftify-messangers/stargazers) • [🐛 Report Bug](https://github.com/Bakhitov/craftify-messangers/issues) • [💡 Request Feature](https://github.com/Bakhitov/craftify-messangers/issues)

</div> 