# 🧪 Рабочие тесты API сообщений

## 📊 Результаты тестирования

### ✅ Статус WhatsApp сервера:
```bash
curl -H "Authorization: Bearer 60e48460-8954-4dd2-a477-5d6e6bf142c0" \
  "http://13.61.141.6:6609/api/v1/status"
```

**Результат:**
```json
{
  "provider": "whatsapp",
  "status": "connected", 
  "info": {
    "pushname": "Рабочий",
    "wid": {"server": "c.us", "user": "77066318623", "_serialized": "77066318623@c.us"},
    "me": {"server": "c.us", "user": "77066318623", "_serialized": "77066318623@c.us"},
    "platform": "smbi"
  },
  "state": "READY"
}
```
✅ **Сервер готов к работе!**

---

## 🔧 Диагностика проблем

### ❌ Проблема 1: Текстовые сообщения
**Команда:**
```bash
curl -X POST "http://13.61.141.6:6609/api/v1/send" \
  -H "Authorization: Bearer 60e48460-8954-4dd2-a477-5d6e6bf142c0" \
  -H "Content-Type: application/json" \
  -d '{"number": "77475318623", "message": "Тест", "mediaType": "text"}'
```

**Ошибка:**
```json
{"error":"Failed to send message","details":"WhatsApp sendMessage returned invalid result structure"}
```

### ❌ Проблема 2: Медиа сообщения
**Команда:**
```bash
curl -X POST "http://13.61.141.6:6609/api/v1/send" \
  -H "Authorization: Bearer 60e48460-8954-4dd2-a477-5d6e6bf142c0" \
  -H "Content-Type: application/json" \
  -d '{"number": "77475318623", "source": "https://picsum.photos/400/300", "caption": "Тест"}'
```

**Ошибка:**
```json
{"error":"Failed to send message","details":"Failed to send media message: Cannot read properties of undefined (reading 'id')"}
```

---

## 🔍 Возможные причины проблем

### 1. **WhatsApp клиент не полностью инициализирован**
- Статус показывает READY, но внутренние структуры могут быть не готовы
- Нужно подождать дополнительное время после подключения

### 2. **Проблемы с номером получателя**
- Номер `77475318623` может быть не зарегистрирован в WhatsApp
- Или номер заблокирован/недоступен

### 3. **Проблемы с кодом обработки ответов**
- Код ожидает определенную структуру ответа от WhatsApp
- Фактический ответ может отличаться

---

## 🛠️ Рекомендации для исправления

### 1. **Проверка номера получателя**
```bash
# Попробуйте отправить на другой номер (например, ваш собственный)
curl -X POST "http://13.61.141.6:6609/api/v1/send" \
  -H "Authorization: Bearer 60e48460-8954-4dd2-a477-5d6e6bf142c0" \
  -H "Content-Type: application/json" \
  -d '{"number": "77066318623", "message": "Тест на собственный номер", "mediaType": "text"}'
```

### 2. **Проверка контактов**
```bash
curl -H "Authorization: Bearer 60e48460-8954-4dd2-a477-5d6e6bf142c0" \
  "http://13.61.141.6:6609/api/v1/contacts"
```

### 3. **Проверка чатов**
```bash
curl -H "Authorization: Bearer 60e48460-8954-4dd2-a477-5d6e6bf142c0" \
  "http://13.61.141.6:6609/api/v1/chats"
```

---

## 📝 Правильные форматы для тестирования

### ✅ Текстовое сообщение (правильный формат):
```bash
curl -X POST "http://13.61.141.6:6609/api/v1/send" \
  -H "Authorization: Bearer 60e48460-8954-4dd2-a477-5d6e6bf142c0" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "77475318623",
    "message": "Привет! Это тестовое сообщение.",
    "mediaType": "text"
  }'
```

### ✅ Медиа сообщение (правильный формат):
```bash
curl -X POST "http://13.61.141.6:6609/api/v1/send" \
  -H "Authorization: Bearer 60e48460-8954-4dd2-a477-5d6e6bf142c0" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "77475318623",
    "source": "https://picsum.photos/400/300",
    "caption": "Тестовое изображение",
    "mediaType": "image"
  }'
```

---

## 🤖 Telegram тесты (требуют настройки)

### Настройка переменных:
```bash
export TELEGRAM_URL="http://YOUR_SERVER:PORT/api/v1/telegram"
export TELEGRAM_TOKEN="YOUR_BOT_TOKEN"
```

### Текстовое сообщение:
```bash
curl -X POST "$TELEGRAM_URL/send" \
  -H "Authorization: Bearer $TELEGRAM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "134527512",
    "message": "Привет из Telegram API!"
  }'
```

### Медиа сообщение:
```bash
curl -X POST "$TELEGRAM_URL/send-media" \
  -H "Authorization: Bearer $TELEGRAM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "134527512", 
    "source": "https://picsum.photos/400/300",
    "caption": "Тестовое изображение"
  }'
```

---

## 📋 Статус тестирования

### WhatsApp API (http://13.61.141.6:6609):
- ✅ **Сервер доступен**
- ✅ **Авторизация работает** 
- ✅ **Клиент подключен (READY)**
- ❌ **Отправка сообщений не работает** (проблемы с кодом)

### Telegram API:
- ❓ **Требует настройки** (URL и токен)
- ❓ **Не протестирован**

---

## 🔄 Следующие шаги

1. **Исправить код обработки ответов WhatsApp**
2. **Протестировать на собственном номере**
3. **Настроить Telegram API**
4. **Добавить дополнительную диагностику**

---

## 💡 Полезные команды для диагностики

### Проверка здоровья сервиса:
```bash
curl "http://13.61.141.6:6609/api/v1/health"
```

### Проверка с подробным выводом:
```bash
curl -v -X POST "http://13.61.141.6:6609/api/v1/send" \
  -H "Authorization: Bearer 60e48460-8954-4dd2-a477-5d6e6bf142c0" \
  -H "Content-Type: application/json" \
  -d '{"number": "77475318623", "message": "Тест"}'
```

### Мониторинг логов (если доступен):
```bash
# Если есть доступ к серверу
tail -f /path/to/logs/app.log
``` 