#!/bin/bash

# Скрипт автоматического обновления Craftify Messengers на production

set -e  # Остановка при ошибке

echo "🔄 Начинаю обновление Craftify Messengers..."

# Проверка, что мы в правильной директории
if [ ! -f "package.json" ]; then
    echo "❌ Ошибка: package.json не найден. Убедитесь, что вы в корневой директории проекта."
    exit 1
fi

# Создание резервных копий
echo "💾 Создание резервных копий..."
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
if [ -d "volumes" ]; then
    cp -r volumes volumes.backup.$(date +%Y%m%d_%H%M%S)
fi

# Остановка сервисов
echo "🛑 Остановка текущих сервисов..."
if [ -f "docker-compose.production.yml" ]; then
    docker-compose -f docker-compose.production.yml down
else
    docker-compose down
fi

# Получение обновлений
echo "📥 Получение обновлений из GitHub..."
git fetch origin
CURRENT_COMMIT=$(git rev-parse HEAD)
echo "Текущий коммит: $CURRENT_COMMIT"

git pull origin main
NEW_COMMIT=$(git rev-parse HEAD)
echo "Новый коммит: $NEW_COMMIT"

if [ "$CURRENT_COMMIT" = "$NEW_COMMIT" ]; then
    echo "ℹ️ Обновлений нет, но перезапускаю сервисы..."
else
    echo "✅ Получены новые изменения"
fi

# Обновление зависимостей
echo "📦 Обновление зависимостей..."
if command -v pnpm &> /dev/null; then
    pnpm install
elif command -v npm &> /dev/null; then
    npm install
else
    echo "❌ npm или pnpm не найдены"
    exit 1
fi

# Сборка проекта (если есть build скрипт)
echo "🔨 Сборка проекта..."
echo "Building project..."
pnpm run build

# Запуск обновленных сервисов
echo "🚀 Запуск обновленных сервисов..."
if [ -f "docker-compose.production.yml" ]; then
    docker-compose -f docker-compose.production.yml up -d --build
else
    docker-compose up -d --build
fi

# Ожидание запуска
echo "⏳ Ожидание запуска сервисов..."
sleep 10

# Проверка работоспособности
echo "✅ Проверка работоспособности..."
if [ -f "docker-compose.production.yml" ]; then
    docker-compose -f docker-compose.production.yml ps
else
    docker-compose ps
fi

# Health check
echo "🏥 Проверка health endpoint..."
if curl -f -s http://localhost:3000/health > /dev/null; then
    echo "✅ Сервис работает корректно!"
else
    echo "⚠️ Health check не прошел, проверьте логи"
    if [ -f "docker-compose.production.yml" ]; then
        docker-compose -f docker-compose.production.yml logs --tail=20
    else
        docker-compose logs --tail=20
    fi
fi

echo ""
echo "🎉 Обновление завершено!"
echo "📋 Полезные команды:"
echo "   Логи: docker-compose logs -f"
echo "   Статус: docker-compose ps"
echo "   Health: curl http://localhost:3000/health"
echo ""
echo "💡 В случае проблем можно откатиться:"
echo "   git checkout $CURRENT_COMMIT"
echo "   docker-compose up -d --build"

echo "✅ Production update completed successfully!" 