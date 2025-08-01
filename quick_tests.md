# 🚀 Быстрые тесты API сообщений

## 📱 WhatsApp тесты (номер: 77475318623)

### 🟢 Тест 1: Текстовое сообщение
```bash
curl -X POST "http://13.61.141.6:6609/api/v1/send" \
  -H "Authorization: Bearer 60e48460-8954-4dd2-a477-5d6e6bf142c0" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "77475318623",
    "message": "Привет! Это тестовое сообщение из API.",
    "mediaType": "text"
  }'
```

### 🖼️ Тест 2: Медиа сообщение (изображение)
```bash
curl -X POST "http://13.61.141.6:6609/api/v1/send" \
  -H "Authorization: Bearer 60e48460-8954-4dd2-a477-5d6e6bf142c0" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "77475318623",
    "source": "https://picsum.photos/800/600",
    "caption": "Красивое случайное изображение 800x600",
    "mediaType": "image"
  }'
```

---

## 🤖 Telegram тесты (Chat ID: 134527512)

### 🔵 Тест 3: Текстовое сообщение
```bash
curl -X POST "http://YOUR_TELEGRAM_SERVER/api/v1/telegram/send" \
  -H "Authorization: Bearer YOUR_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "134527512",
    "message": "Привет из Telegram API!"
  }'
```

### 🖼️ Тест 4: Медиа сообщение (изображение)
```bash
curl -X POST "http://YOUR_TELEGRAM_SERVER/api/v1/telegram/send-media" \
  -H "Authorization: Bearer YOUR_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "134527512",
    "source": "https://picsum.photos/600/400",
    "caption": "Тестовое изображение из Telegram API"
  }'
```

---

## 🔧 Запуск всех тестов одной командой

### Сделайте скрипт исполняемым:
```bash
chmod +x test_messages.sh
```

### Запустите все тесты:
```bash
./test_messages.sh
```

---

## 📋 Ожидаемые результаты

### ✅ Успешный ответ WhatsApp:
```json
{
  "messageId": "false_77475318623@c.us_ABC123",
  "messageType": "text"
}
```

### ✅ Успешный ответ Telegram:
```json
{
  "success": true,
  "messageId": "123",
  "provider": "telegram"
}
```

### ❌ Возможные ошибки:
- **400** - Неверные параметры
- **401** - Неверная авторизация
- **503** - Сервис недоступен

---

## 🛠️ Настройка для Telegram

Перед запуском Telegram тестов замените:
- `YOUR_TELEGRAM_SERVER` - на реальный адрес сервера
- `YOUR_BOT_TOKEN` - на токен вашего бота

### Пример:
```bash
# Замените эти значения в файлах:
TELEGRAM_URL="http://localhost:3002/api/v1/telegram"
TELEGRAM_TOKEN="123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ"
```

---

## 📊 Мониторинг результатов

### Проверка статуса WhatsApp:
```bash
curl -H "Authorization: Bearer 60e48460-8954-4dd2-a477-5d6e6bf142c0" \
  "http://13.61.141.6:6609/api/v1/status"
```

### Проверка статуса Telegram:
```bash
curl -H "Authorization: Bearer YOUR_BOT_TOKEN" \
  "http://YOUR_TELEGRAM_SERVER/api/v1/telegram/status"
``` 