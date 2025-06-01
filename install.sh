#!/bin/bash
set -e

echo "🚀 Начинаю установку wweb-mcp..."

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для логирования
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Проверка системных требований
log "Проверка системных требований..."

# Проверка Node.js
if ! command -v node &> /dev/null; then
    error "Node.js не установлен. Установите Node.js версии 18 или выше."
fi

NODE_VERSION=$(node -v | sed 's/v//')
REQUIRED_VERSION="18.0.0"
if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    error "Требуется Node.js версии $REQUIRED_VERSION или выше. Текущая версия: $NODE_VERSION"
fi

log "✅ Node.js версии $NODE_VERSION установлен"

# Проверка pnpm
if ! command -v pnpm &> /dev/null; then
    error "pnpm не установлен"
fi

log "✅ pnpm доступен"

# Проверка Docker
if ! command -v docker &> /dev/null; then
    warn "Docker не установлен. Некоторые функции будут недоступны."
else
    log "✅ Docker доступен"
fi

# Установка зависимостей
log "Установка зависимостей Node.js..."
if [ -f "pnpm-lock.yaml" ]; then
    pnpm install --frozen-lockfile
else
    pnpm install
fi

log "✅ Зависимости установлены"

# Сборка проекта
log "Сборка проекта..."
pnpm run build

log "✅ Проект собран"

# Создание необходимых директорий
log "Создание необходимых директорий..."
mkdir -p .wwebjs_auth
mkdir -p logs
mkdir -p volumes
mkdir -p composes

log "✅ Директории созданы"

# Создание .env файла из примера
if [ ! -f ".env" ]; then
    log "Создание базового .env файла..."
    cat > .env << EOF
# ===========================================
# DEVELOPMENT КОНФИГУРАЦИЯ
# ===========================================

# Режим разработки
NODE_ENV=development
LOG_LEVEL=debug

# База данных (Supabase Cloud)
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres
DATABASE_HOST=db.YOUR_PROJECT.supabase.co
DATABASE_PORT=5432
DATABASE_NAME=postgres
DATABASE_USER=postgres
DATABASE_PASSWORD=YOUR_PASSWORD
DATABASE_SCHEMA=public
DATABASE_SSL=true
USE_SUPABASE=true

# Instance Manager
INSTANCE_MANAGER_PORT=3000
INSTANCE_MANAGER_BASE_URL=http://localhost:3000

# Docker настройки
DOCKER_SOCKET_PATH=/var/run/docker.sock

# Диапазон портов для инстансов
BASE_PORT_RANGE_START=3001
BASE_PORT_RANGE_END=7999
TELEGRAM_BASE_PORT_RANGE_START=4001
TELEGRAM_BASE_PORT_RANGE_END=8999

# Пути
COMPOSE_FILES_PATH=./composes
VOLUMES_PATH=./volumes

# WhatsApp настройки
WHATSAPP_AUTH_STRATEGY=local
WHATSAPP_MAX_CONNECTIONS=5

# Telegram настройки
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN_HERE
TELEGRAM_ENABLED=false

# AI интеграция (Agno Agent System)
AGNO_API_BASE_URL=http://host.docker.internal:8000
AGNO_API_TIMEOUT=10000
AGNO_ENABLED=false

# Development специфичные настройки
DOCKER_CONTAINER=true
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
EOF
    warn "Создан базовый .env файл. ОБЯЗАТЕЛЬНО отредактируйте его:"
    echo "  1. Замените YOUR_PASSWORD на ваш пароль от Supabase"
    echo "  2. Замените YOUR_PROJECT на ID вашего проекта Supabase"
    echo "  3. Добавьте TELEGRAM_BOT_TOKEN если планируете использовать Telegram"
fi

# Проверка линтера
log "Проверка кода линтером..."
if pnpm run lint; then
    log "✅ Код прошел проверку линтера"
else
    warn "Код не прошел проверку линтера. Запустите 'pnpm run lint:fix' для исправления."
fi

# Проверка Docker образов
if command -v docker &> /dev/null; then
    log "Сборка Docker образов..."
    
    # Сборка основного образа для инстансов
    docker build -t wweb-mcp:latest .
    log "✅ Основной Docker образ wweb-mcp:latest собран"
    
    # Сборка Instance Manager образа
    docker build -f Dockerfile.instance-manager -t wweb-mcp-instance-manager:latest .
    log "✅ Instance Manager Docker образ собран"
fi

# Финальная проверка
log "Финальная проверка установки..."

# Проверка существования основных файлов
REQUIRED_FILES=(
    "dist/main.js"
    "dist/main-instance-manager.js"
    "package.json"
    ".env"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        error "Отсутствует необходимый файл: $file"
    fi
done

log "✅ Все необходимые файлы присутствуют"

# Проверка Docker context для macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    DOCKER_CONTEXT=$(docker context show 2>/dev/null || echo "unknown")
    if [[ "$DOCKER_CONTEXT" == "colima" ]]; then
        warn "Обнаружен macOS + Colima"
        warn "Colima имеет проблемы с Docker socket из контейнеров"
        warn "Рекомендуется запуск Instance Manager на хосте для полной функциональности"
        echo ""
        echo -e "${YELLOW}💡 При запуске ./start-dev.sh выберите 'y' для запуска на хосте${NC}"
    fi
fi

# Вывод информации о запуске
echo ""
echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}🎉 Установка завершена успешно!${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""
echo -e "${GREEN}Доступные команды:${NC}"
echo ""
echo -e "${YELLOW}Development окружение:${NC}"
echo "  ./start-dev.sh                           # Запуск development окружения"
if [[ "$OSTYPE" == "darwin"* ]] && [[ "$(docker context show 2>/dev/null)" == "colima" ]]; then
    echo "  ⚠️  На macOS + Colima рекомендуется запуск Instance Manager на хосте"
    echo "  💡 При запуске выберите 'y' для оптимальной работы"
else
    echo "  docker-compose -f docker-compose.instance-manager.yml up -d"
fi
echo ""
echo -e "${YELLOW}Production окружение:${NC}"
echo "  ./start-prod.sh                          # Запуск production окружения"
echo ""
echo -e "${YELLOW}Разработка:${NC}"
echo "  pnpm run dev                              # Режим разработки"
echo "  pnpm run dev:instance-manager             # Instance Manager в режиме разработки"
echo "  pnpm test                                 # Запуск тестов"
echo "  pnpm run lint                             # Проверка кода"
echo ""
echo -e "${YELLOW}Ручной запуск Instance Manager (альтернатива):${NC}"
echo "  node dist/main-instance-manager.js       # Запуск на хосте (рекомендуется для macOS + Colima)"
echo "  nohup node dist/main-instance-manager.js > instance-manager.log 2>&1 &  # Background режим"
echo ""
echo -e "${GREEN}Следующие шаги:${NC}"
echo "1. 🔧 Отредактируйте .env файл с настройками Supabase:"
echo "   - DATABASE_URL: строка подключения к Supabase"
echo "   - DATABASE_PASSWORD: пароль от Supabase"
echo "   - Замените YOUR_PROJECT на ID вашего проекта"
echo ""
echo "2. 🚀 Запустите development окружение:"
echo "   ./start-dev.sh"
if [[ "$OSTYPE" == "darwin"* ]] && [[ "$(docker context show 2>/dev/null)" == "colima" ]]; then
    echo "   💡 Выберите 'y' для запуска Instance Manager на хосте"
fi
echo ""
echo "3. 📱 Для Telegram API добавьте TELEGRAM_BOT_TOKEN в .env"
echo ""
echo -e "${BLUE}📚 Документация:${NC}"
echo "  README.md                - Основная документация"
echo "  TESTING_GUIDE_NEW.md     - Руководство по тестированию"
echo "  SUPABASE_MIGRATION_COMPLETED.md - Информация о миграции на Supabase"
echo ""
echo -e "${YELLOW}💡 Полезные ссылки:${NC}"
echo "  Supabase Dashboard: https://supabase.com/dashboard"
echo "  Instance Manager API: http://localhost:3000 (после запуска)"
echo ""
if [[ "$OSTYPE" == "darwin"* ]] && [[ "$(docker context show 2>/dev/null)" == "colima" ]]; then
    echo -e "${YELLOW}🍎 Специально для macOS + Colima:${NC}"
    echo "  • Instance Manager лучше работает на хосте (не в контейнере)"
    echo "  • Это решает проблемы с Docker socket подключением"
    echo "  • Альтернатива: переключиться на Docker Desktop"
    echo "    docker context use desktop-linux"
    echo ""
fi 