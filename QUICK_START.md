# ⚡ Быстрый старт WWEB-MCP

Минимальная инструкция для запуска системы с нуля.

## 🔥 Самый быстрый старт

### 1. Клонирование и установка
```bash
git clone https://github.com/pnizer/wweb-mcp.git
cd wweb-mcp
chmod +x *.sh
./install.sh
```

### 2. Запуск (выберите свою платформу)

#### macOS (с Colima)
```bash
./start-dev.sh
```

#### Linux
```bash
./start-prod.sh
```

### 3. Проверка
```bash
curl http://localhost:3000/health
```

## 🎯 Что дальше?

После успешного запуска вы получите:

- **Instance Manager**: http://localhost:3000
- **API Документация**: http://localhost:3000/api/v1/instances

### Создание первого WhatsApp инстанса
```bash
curl -X POST http://localhost:3000/api/v1/instances \
  -H "Content-Type: application/json" \
  -d '{"user_id": "test", "provider": "whatsappweb", "type_instance": ["api"]}'
```

### Создание первого Telegram инстанса
```bash
# Сначала получите токен у @BotFather в Telegram
curl -X POST http://localhost:3000/api/v1/instances \
  -H "Content-Type: application/json" \
  -d '{"user_id": "test", "provider": "telegram", "type_instance": ["api"], "api_key": "YOUR_BOT_TOKEN"}'
```

## 📚 Подробная документация

- [Полная документация](README.md)
- [Руководство по тестированию](TESTING_GUIDE_NEW.md)
- [История изменений](CHANGELOG.md) 