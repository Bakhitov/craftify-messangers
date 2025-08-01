#!/bin/bash

# 🧪 Тесты отправки сообщений через WhatsApp и Telegram API
# Дата: $(date)

echo "🚀 Запуск тестов отправки сообщений..."
echo "==========================================="

# Настройки
WHATSAPP_URL="http://13.61.141.6:6609/api/v1"
WHATSAPP_TOKEN="60e48460-8954-4dd2-a477-5d6e6bf142c0"
WHATSAPP_NUMBER="77475318623"

TELEGRAM_URL="http://localhost:3002/api/v1/telegram"  # Замените на реальный URL
TELEGRAM_TOKEN="YOUR_BOT_TOKEN"  # Замените на реальный токен
TELEGRAM_CHAT_ID="134527512"

echo ""
echo "📱 ТЕСТЫ WHATSAPP"
echo "=================="

# 🟢 Тест 1: WhatsApp - Текстовое сообщение
echo ""
echo "🟢 Тест 1: WhatsApp - Текстовое сообщение"
echo "Номер: $WHATSAPP_NUMBER"
echo "Сообщение: 'Привет! Это тестовое сообщение из API.'"
echo ""

curl -X POST "$WHATSAPP_URL/send" \
  -H "Authorization: Bearer $WHATSAPP_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"number\": \"$WHATSAPP_NUMBER\",
    \"message\": \"Привет! Это тестовое сообщение из API. Время: $(date '+%H:%M:%S')\",
    \"mediaType\": \"text\"
  }" \
  -w "\n\nСтатус: %{http_code}\nВремя ответа: %{time_total}s\n" \
  -s

echo ""
echo "----------------------------------------"

# 🖼️ Тест 2: WhatsApp - Медиа сообщение (изображение)
echo ""
echo "🖼️ Тест 2: WhatsApp - Медиа сообщение (изображение)"
echo "Номер: $WHATSAPP_NUMBER"
echo "Файл: https://picsum.photos/800/600"
echo "Описание: 'Красивое случайное изображение 800x600'"
echo ""

curl -X POST "$WHATSAPP_URL/send" \
  -H "Authorization: Bearer $WHATSAPP_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"number\": \"$WHATSAPP_NUMBER\",
    \"source\": \"https://picsum.photos/800/600\",
    \"caption\": \"Красивое случайное изображение 800x600. Отправлено: $(date '+%H:%M:%S')\",
    \"mediaType\": \"image\"
  }" \
  -w "\n\nСтатус: %{http_code}\nВремя ответа: %{time_total}s\n" \
  -s

echo ""
echo "=========================================="

echo ""
echo "🤖 ТЕСТЫ TELEGRAM"
echo "=================="

# 🔵 Тест 3: Telegram - Текстовое сообщение
echo ""
echo "🔵 Тест 3: Telegram - Текстовое сообщение"
echo "Chat ID: $TELEGRAM_CHAT_ID"
echo "Сообщение: 'Привет из Telegram API!'"
echo ""

curl -X POST "$TELEGRAM_URL/send" \
  -H "Authorization: Bearer $TELEGRAM_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"chatId\": \"$TELEGRAM_CHAT_ID\",
    \"message\": \"Привет из Telegram API! Время: $(date '+%H:%M:%S')\"
  }" \
  -w "\n\nСтатус: %{http_code}\nВремя ответа: %{time_total}s\n" \
  -s

echo ""
echo "----------------------------------------"

# 🖼️ Тест 4: Telegram - Медиа сообщение (изображение)
echo ""
echo "🖼️ Тест 4: Telegram - Медиа сообщение (изображение)"
echo "Chat ID: $TELEGRAM_CHAT_ID"
echo "Файл: https://picsum.photos/600/400"
echo "Описание: 'Тестовое изображение из Telegram API'"
echo ""

curl -X POST "$TELEGRAM_URL/send-media" \
  -H "Authorization: Bearer $TELEGRAM_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"chatId\": \"$TELEGRAM_CHAT_ID\",
    \"source\": \"https://picsum.photos/600/400\",
    \"caption\": \"Тестовое изображение из Telegram API. Отправлено: $(date '+%H:%M:%S')\"
  }" \
  -w "\n\nСтатус: %{http_code}\nВремя ответа: %{time_total}s\n" \
  -s

echo ""
echo "=========================================="
echo ""
echo "✅ Все тесты завершены!"
echo ""
echo "📋 Сводка тестов:"
echo "1. ✅ WhatsApp текст → $WHATSAPP_NUMBER"
echo "2. ✅ WhatsApp медиа → $WHATSAPP_NUMBER"
echo "3. ✅ Telegram текст → $TELEGRAM_CHAT_ID"
echo "4. ✅ Telegram медиа → $TELEGRAM_CHAT_ID"
echo ""
echo "🔧 Для запуска:"
echo "chmod +x test_messages.sh"
echo "./test_messages.sh"
echo ""
echo "📝 Примечания:"
echo "- Замените TELEGRAM_URL на реальный адрес вашего Telegram API"
echo "- Замените TELEGRAM_TOKEN на реальный токен бота"
echo "- Проверьте доступность URL для медиа файлов" 