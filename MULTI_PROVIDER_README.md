# 🚀 Multi-Provider Messenger System v2.0

## 📋 Обзор

Это комплексная система для работы с множественными мессенджерами через единый API. Поддерживает 6 различных платформ мессенджеров с унифицированным интерфейсом управления.

## 🎯 Поддерживаемые провайдеры

| Провайдер | Статус | Возможности | API Type |
|-----------|--------|-------------|----------|
| **Telegram** | ✅ Готов | Полная поддержка | Bot API |
| **WhatsApp Official** | ✅ Готов | Сообщения, медиа | Graph API |
| **Facebook Messenger** | ✅ Готов | Сообщения, изображения | Graph API |
| **Instagram** | ✅ Готов | Сообщения, изображения | Basic Display API |
| **Slack** | ✅ Готов | Полная поддержка | Web API |
| **Discord** | ✅ Готов | Полная поддержка | Discord.js |

## 🏗️ Архитектура

### Структура системы

```
┌─────────────────────────┐
│    MultiProvider API    │  ← Единый API endpoint
├─────────────────────────┤
│   MultiProviderService  │  ← Центральный сервис
├─────────────────────────┤
│  Provider Database      │  ← Разделенные таблицы
├─────────────────────────┤
│   Individual Providers  │  ← Специфичные провайдеры
└─────────────────────────┘
```

### База данных

Система использует разделенные таблицы для каждого провайдера:

- `telegram_instances`
- `whatsapp_official_instances`
- `facebook_messenger_instances`
- `instagram_instances`
- `slack_instances`
- `discord_instances`

## 🚀 Быстрый старт

### 1. Установка зависимостей

```bash
npm install
```

### 2. Настройка базы данных

```bash
# Применить миграции
cd db/migrations
# Используйте свой инструмент миграций или выполните SQL напрямую
psql -d your_database -f versions/001_split_provider_tables.sql
```

### 3. Настройка переменных окружения

Создайте `.env` файл:

```env
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=whatsapp_mcp
DATABASE_USER=postgres
DATABASE_PASSWORD=password

# API
PORT=3000
LOG_LEVEL=info

# Provider tokens (настройте по необходимости)
TELEGRAM_BOT_TOKEN=your_telegram_token
WHATSAPP_ACCESS_TOKEN=your_whatsapp_token
SLACK_BOT_TOKEN=your_slack_token
DISCORD_BOT_TOKEN=your_discord_token
```

### 4. Запуск

```bash
npm run dev
```

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api/v1/multi-provider
```

### Основные endpoints

#### Создание инстанса
```bash
POST /instances
{
  "provider": "telegram",
  "config": {
    "botToken": "123456789:ABC...",
    "authStrategy": "none"
  }
}
```

#### Отправка сообщения
```bash
POST /instances/{provider}/{instanceId}/send-message
{
  "to": "user_id",
  "message": "Hello World!"
}
```

#### Статистика
```bash
GET /stats
```

Полная документация API: [docs/MULTI_PROVIDER_API.md](docs/MULTI_PROVIDER_API.md)

## 🔧 Конфигурация провайдеров

### Telegram
```json
{
  "provider": "telegram",
  "config": {
    "botToken": "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    "authStrategy": "none",
    "authDataPath": "./auth/telegram",
    "dockerContainer": false
  }
}
```

### WhatsApp Official
```json
{
  "provider": "whatsapp-official",
  "config": {
    "phoneNumberId": "1234567890",
    "accessToken": "EAAxxxxxxxxxxxxx",
    "webhookVerifyToken": "your_verify_token",
    "version": "v18.0"
  }
}
```

### Slack
```json
{
  "provider": "slack",
  "config": {
    "botToken": "xoxb-xxxxxxxxxxxxx",
    "signingSecret": "your_signing_secret",
    "socketMode": false
  }
}
```

### Discord
```json
{
  "provider": "discord",
  "config": {
    "botToken": "ODxxxxxxxxxxxxx.Yxxxxx.Zxxxxxxxxxxxxxxxxxxxxx",
    "clientId": "1234567890",
    "intents": [1, 512, 32768]
  }
}
```

## 🌐 Примеры использования

### 1. Создание Telegram бота

```bash
curl -X POST http://localhost:3000/api/v1/multi-provider/instances \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "telegram",
    "config": {
      "botToken": "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    }
  }'
```

Ответ:
```json
{
  "instanceId": "telegram_1703123456789_abc123",
  "provider": "telegram",
  "status": "created"
}
```

### 2. Отправка сообщения

```bash
curl -X POST http://localhost:3000/api/v1/multi-provider/instances/telegram/telegram_1703123456789_abc123/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "to": "123456789",
    "message": "Привет из мультипровайдерной системы!"
  }'
```

### 3. Получение статистики

```bash
curl http://localhost:3000/api/v1/multi-provider/stats
```

Ответ:
```json
{
  "stats": {
    "Telegram": {
      "count": 2,
      "instances": ["telegram_1703123456789_abc123", "telegram_1703123456790_def456"]
    },
    "Slack": {
      "count": 1,
      "instances": ["slack_1703123456791_ghi789"]
    }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## 🔄 Миграция с версии 1.x

Система полностью обратно совместима. Существующие WhatsApp Web инстансы продолжают работать.

### Пошаговая миграция:

1. **Создайте резервную копию БД:**
   ```bash
   pg_dump whatsapp_mcp > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Обновите зависимости:**
   ```bash
   npm install
   ```

3. **Примените миграции:**
   ```bash
   cd db/migrations
   psql -d whatsapp_mcp -f versions/001_split_provider_tables.sql
   ```

4. **Протестируйте:**
   - Убедитесь, что существующие инстансы работают
   - Создайте тестовый инстанс нового провайдера

### Откат при необходимости:

```bash
cd db/migrations
psql -d whatsapp_mcp -f versions/001_split_provider_tables_rollback.sql
```

## 📊 Мониторинг и логирование

### Логи
Система ведет детальные логи для каждого провайдера:

```bash
# Просмотр логов
tail -f logs/multi-provider.log
```

### Статус проверки

```bash
# Статус всех провайдеров
curl http://localhost:3000/api/v1/multi-provider/active-providers

# Статус конкретного инстанса
curl http://localhost:3000/api/v1/multi-provider/instances/telegram/instance_id/status
```

## 🔒 Безопасность

### Токены и ключи
- Все токены хранятся в переменных окружения
- Используйте `.env` файлы для разных окружений
- Никогда не коммитьте токены в git

### Webhook безопасность
- Проверка подписей для всех webhook'ов
- Валидация входящих данных
- Rate limiting для API endpoints

## 🐳 Docker

### Development
```bash
docker-compose up -d
```

### Production
```bash
docker-compose -f docker-compose.production.yml up -d
```

## 🧪 Тестирование

### Запуск тестов

```bash
# Все тесты
npm test

# Тесты конкретного провайдера
npm test -- --grep "Telegram"
```

### Ручное тестирование

1. Создайте инстанс через API
2. Отправьте тестовое сообщение
3. Проверьте webhook обработку
4. Удалите инстанс

## 🔧 Разработка

### Добавление нового провайдера

1. Создайте провайдер в `src/providers/your-provider.ts`
2. Добавьте тип в `src/types.ts`
3. Обновите `MultiProviderService`
4. Добавьте миграцию для таблицы
5. Добавьте тесты

### Структура проекта

```
src/
├── providers/           # Провайдеры мессенджеров
├── services/           # Бизнес логика
├── routes/             # API роуты
├── types.ts            # TypeScript типы
└── ...

docs/
├── MULTI_PROVIDER_API.md    # API документация
└── MULTI_PROVIDER_PLAN.md   # Архитектурный план

db/
└── migrations/
    └── versions/       # SQL миграции
```

## 📈 Производительность

### Оптимизации
- Все API провайдеры работают на одном порту
- Connection pooling для БД
- Efficient memory usage
- Graceful shutdown

### Масштабирование
- Поддержка тысяч инстансов на одном сервере
- Горизонтальное масштабирование через load balancer
- Database partitioning по провайдерам

## 🆘 Устранение неполадок

### Частые проблемы

**Ошибка создания инстанса:**
```bash
# Проверьте логи
tail -f logs/multi-provider.log

# Проверьте статус БД
curl http://localhost:3000/health
```

**Webhook не работает:**
```bash
# Проверьте настройки провайдера
curl http://localhost:3000/api/v1/multi-provider/instances/telegram/instance_id/status
```

**Ошибки БД:**
```bash
# Проверьте миграции
psql -d whatsapp_mcp -c "\dt"
```

## 📄 Лицензия

MIT License - see LICENSE file

## 🤝 Поддержка

- 📧 Email: support@example.com
- 📱 Telegram: @support_bot
- 🐛 Issues: GitHub Issues
- 📖 Docs: [docs/](docs/)

## 🗺️ Roadmap

### v2.1 (Q2 2024)
- [ ] WhatsApp Business API
- [ ] Twitter DM support
- [ ] Webhook queuing system

### v2.2 (Q3 2024)
- [ ] Advanced analytics
- [ ] Multi-tenant support
- [ ] GraphQL API

### v3.0 (Q4 2024)
- [ ] Real-time dashboard
- [ ] AI message processing
- [ ] Enterprise features

---

**🎉 Готово к работе!** Система поддерживает 6 мессенджеров через единый API с полной обратной совместимостью. 