#!/bin/bash
set -e

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Функция для определения внешнего IP-адреса
get_external_ip() {
    local ip=""
    
    # Пробуем несколько сервисов для получения внешнего IP
    for service in "ifconfig.me" "ipecho.net/plain" "icanhazip.com" "ident.me"; do
        ip=$(curl -s --connect-timeout 5 --max-time 10 "http://$service" 2>/dev/null | grep -E '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$')
        if [[ -n "$ip" ]]; then
            echo "$ip"
            return 0
        fi
    done
    
    # Если не удалось получить внешний IP, используем localhost
    echo "localhost"
    return 1
}

echo -e "${BLUE}🚀 Запуск DEVELOPMENT окружения с Supabase Cloud${NC}"
echo "================================================="

# Определяем внешний IP-адрес
echo -e "${YELLOW}🌐 Определение внешнего IP-адреса...${NC}"
EXTERNAL_IP=$(get_external_ip)

if [[ "$EXTERNAL_IP" == "localhost" ]]; then
    echo -e "${YELLOW}⚠️ Не удалось определить внешний IP-адрес. Используется localhost.${NC}"
    echo -e "${YELLOW}💡 Instance Manager будет доступен только локально${NC}"
else
    echo -e "${GREEN}✅ Внешний IP-адрес: $EXTERNAL_IP${NC}"
    echo -e "${GREEN}💡 Instance Manager будет доступен по адресу: http://$EXTERNAL_IP:3000${NC}"
fi

# Проверка системы
echo -e "${YELLOW}📋 Проверка системных требований...${NC}"

# Проверка Docker
if ! docker ps > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker не запущен.${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "Для macOS запустите Docker Desktop или Colima:"
        echo "  colima start"
    else
        echo "Запустите Docker:"
        echo "  sudo systemctl start docker"
    fi
    exit 1
fi
echo -e "${GREEN}✅ Docker доступен${NC}"

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js не установлен${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js $(node -v) доступен${NC}"

# Проверка pnpm
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ pnpm не установлен${NC}"
    echo "Установите pnpm: npm install -g pnpm"
    exit 1
fi
echo -e "${GREEN}✅ pnpm доступен${NC}"

# Настройка конфигурации
echo -e "${YELLOW}⚙️ Настройка development конфигурации...${NC}"

if [ ! -f "env.development" ]; then
    echo -e "${RED}❌ Файл env.development не найден${NC}"
    echo "Создайте файл env.development или запустите ./install.sh"
    exit 1
fi

# Копируем dev конфигурацию
cp env.development .env
echo -e "${GREEN}✅ Скопирована development конфигурация${NC}"

# Динамически обновляем INSTANCE_MANAGER_BASE_URL с актуальным внешним IP
if [[ "$EXTERNAL_IP" != "localhost" ]]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|INSTANCE_MANAGER_BASE_URL=.*|INSTANCE_MANAGER_BASE_URL=http://$EXTERNAL_IP:3000|g" .env
        sed -i '' "s|CORS_ORIGIN=.*|CORS_ORIGIN=http://$EXTERNAL_IP:3000|g" .env
        # Добавляем или обновляем EXTERNAL_IP
        if grep -q "EXTERNAL_IP=" .env; then
            sed -i '' "s|EXTERNAL_IP=.*|EXTERNAL_IP=$EXTERNAL_IP|g" .env
        else
            echo "EXTERNAL_IP=$EXTERNAL_IP" >> .env
        fi
    else
        sed -i "s|INSTANCE_MANAGER_BASE_URL=.*|INSTANCE_MANAGER_BASE_URL=http://$EXTERNAL_IP:3000|g" .env
        sed -i "s|CORS_ORIGIN=.*|CORS_ORIGIN=http://$EXTERNAL_IP:3000|g" .env
        # Добавляем или обновляем EXTERNAL_IP
        if grep -q "EXTERNAL_IP=" .env; then
            sed -i "s|EXTERNAL_IP=.*|EXTERNAL_IP=$EXTERNAL_IP|g" .env
        else
            echo "EXTERNAL_IP=$EXTERNAL_IP" >> .env
        fi
    fi
    echo -e "${GREEN}✅ Обновлен INSTANCE_MANAGER_BASE_URL: http://$EXTERNAL_IP:3000${NC}"
    echo -e "${GREEN}✅ Обновлен CORS_ORIGIN: http://$EXTERNAL_IP:3000${NC}"
    echo -e "${GREEN}✅ Установлен EXTERNAL_IP: $EXTERNAL_IP (для CORS с любыми портами)${NC}"
else
    echo -e "${YELLOW}💡 INSTANCE_MANAGER_BASE_URL и CORS_ORIGIN остаются localhost (внешний IP недоступен)${NC}"
fi

# Обновляем путь к Docker socket для текущего пользователя (macOS)
COLIMA_SOCKET_MISSING=false
if [[ "$OSTYPE" == "darwin"* ]]; then
    USER_HOME=$(eval echo ~$USER)
    if [ -f "$USER_HOME/.colima/default/docker.sock" ]; then
        sed -i '' "s|DOCKER_SOCKET_PATH=.*|DOCKER_SOCKET_PATH=$USER_HOME/.colima/default/docker.sock|g" .env
        echo -e "${GREEN}✅ Обновлен путь к Docker socket для Colima: $USER_HOME/.colima/default/docker.sock${NC}"
    else
        echo -e "${YELLOW}⚠️ Colima socket не найден, используется стандартный Docker socket${NC}"
        COLIMA_SOCKET_MISSING=true
    fi
fi

# Сборка проекта
echo -e "${YELLOW}🔧 Сборка проекта...${NC}"

# Устанавливаем все зависимости
echo "📦 Установка зависимостей..."
pnpm install --frozen-lockfile
echo -e "${GREEN}✅ Зависимости установлены${NC}"

# Сборка проекта
echo "🔨 Сборка TypeScript..."
pnpm run build

# Сборка Docker образов
echo -e "${YELLOW}🐳 Сборка Docker образов...${NC}"
docker build -t wweb-mcp:latest .
echo -e "${GREEN}✅ Основной Docker образ wweb-mcp:latest собран${NC}"

docker build -f Dockerfile.instance-manager -t wweb-mcp-instance-manager:latest .
echo -e "${GREEN}✅ Instance Manager Docker образ собран${NC}"

# Создание необходимых директорий
echo -e "${YELLOW}📁 Создание директорий...${NC}"
mkdir -p composes volumes logs
echo -e "${GREEN}✅ Директории созданы${NC}"

# Проверка базы данных
echo -e "${YELLOW}🗄️ Проверка подключения к Supabase...${NC}"

# Загружаем переменные из .env для проверки
source .env

# Проверяем конфигурацию Supabase
if [ "$USE_SUPABASE" = "true" ] && [ -n "$DATABASE_URL" ]; then
    echo -e "${BLUE}🌐 Используется Supabase Cloud Database${NC}"
    
    # Проверяем, что не используются placeholder значения
    if [[ "$DATABASE_URL" == *"YOUR_PASSWORD"* ]] || [[ "$DATABASE_URL" == *"YOUR_PROJECT"* ]] || [[ "$DATABASE_PASSWORD" == "YOUR_PASSWORD" ]]; then
        echo -e "${RED}❌ Обнаружены placeholder значения в конфигурации базы данных!${NC}"
        echo "Отредактируйте .env и замените:"
        echo "  - YOUR_PASSWORD на ваш пароль от Supabase"
        echo "  - YOUR_PROJECT на ID вашего проекта Supabase"
        echo "  - DATABASE_PASSWORD=YOUR_PASSWORD на реальный пароль"
        echo ""
        echo "Пример правильной строки подключения:"
        echo "DATABASE_URL=postgresql://postgres:your_real_password@db.abcdefghijklmnop.supabase.co:5432/postgres"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Конфигурация Supabase корректна${NC}"
    echo "  Host: $DATABASE_HOST"
    echo "  Database: $DATABASE_NAME"
    echo "  Schema: $DATABASE_SCHEMA"
    
else
    echo -e "${RED}❌ Конфигурация Supabase не найдена!${NC}"
    echo "Проверьте переменные DATABASE_URL и USE_SUPABASE в env.development"
    exit 1
fi

# Остановка существующих контейнеров
echo -e "${YELLOW}🛑 Остановка существующих контейнеров...${NC}"
docker-compose -f docker-compose.instance-manager.yml down 2>/dev/null || true

# Создание или проверка Docker сети для инстансов
echo -e "${YELLOW}🌐 Создание Docker сети для инстансов...${NC}"
if docker network ls | grep -q "wweb-network"; then
    echo -e "${BLUE}🔧 Пересоздание сети wweb-network для обеспечения правильной конфигурации...${NC}"
    docker network rm wweb-network 2>/dev/null || true
fi

echo -e "${BLUE}🔧 Создание сети wweb-network...${NC}"
docker network create \
    --driver bridge \
    --subnet=172.20.0.0/16 \
    wweb-network
echo -e "${GREEN}✅ Сеть wweb-network создана с правильной конфигурацией${NC}"

# Определение режима запуска Instance Manager
DOCKER_CONTEXT=$(docker context show)
USE_HOST_MODE=false

# Автоматическое определение проблем с Colima
if [[ "$OSTYPE" == "darwin"* ]] && ([[ "$DOCKER_CONTEXT" == "colima" ]] || [ "$COLIMA_SOCKET_MISSING" = true ]); then
    echo -e "${YELLOW}⚠️ Обнаружена проблема с Colima на macOS${NC}"
    if [ "$COLIMA_SOCKET_MISSING" = true ]; then
        echo -e "${YELLOW}⚠️ Colima socket недоступен${NC}"
    fi
    if [[ "$DOCKER_CONTEXT" == "colima" ]]; then
        echo -e "${YELLOW}⚠️ Colima имеет проблемы с Docker socket из контейнеров${NC}"
    fi
    echo -e "${BLUE}💡 Автоматически переключаемся на запуск Instance Manager на хосте${NC}"
    USE_HOST_MODE=true
    echo ""
fi

# Запуск Instance Manager
if [ "$USE_HOST_MODE" = true ]; then
    echo -e "${YELLOW}🚀 Запуск Instance Manager на хосте...${NC}"
    
    # Экспорт переменных окружения
    export $(grep -v '^#' .env | xargs)
    
    # Проверка что порт свободен
    if lsof -i :3000 > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️ Порт 3000 занят, останавливаем процесс...${NC}"
        pkill -f "main-instance-manager.js" || true
        sleep 2
    fi
    
    # Запуск в background
    echo -e "${BLUE}🔄 Запуск Instance Manager в background режиме...${NC}"
    nohup node dist/main-instance-manager.js > instance-manager.log 2>&1 &
    IM_PID=$!
    echo "Instance Manager запущен (PID: $IM_PID)"
    
    # Ожидание запуска
    echo -e "${YELLOW}⏳ Ожидание запуска Instance Manager...${NC}"
    sleep 5
    
else
    echo -e "${YELLOW}🚀 Запуск Instance Manager в Docker контейнере...${NC}"
    docker-compose -f docker-compose.instance-manager.yml up -d --build
    
    # Ожидание запуска
    echo -e "${YELLOW}⏳ Ожидание запуска сервисов...${NC}"
    sleep 15
fi

# Проверка статуса
echo -e "${YELLOW}🔍 Проверка статуса Instance Manager...${NC}"
RETRY_COUNT=0
MAX_RETRIES=6

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:3000/health > /dev/null; then
        echo -e "${GREEN}✅ Instance Manager запущен успешно!${NC}"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo -e "${YELLOW}⏳ Попытка $RETRY_COUNT/$MAX_RETRIES...${NC}"
        sleep 5
    fi
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${RED}❌ Instance Manager не отвечает после $MAX_RETRIES попыток${NC}"
    if [ "$USE_HOST_MODE" = true ]; then
        echo "Проверьте логи: tail -f instance-manager.log"
    else
        echo "Проверьте логи: docker logs wweb-mcp-instance-manager-1 -f"
    fi
    exit 1
fi

# Проверка подключения к базе данных
echo -e "${YELLOW}🔍 Проверка подключения к Supabase...${NC}"
HEALTH_RESPONSE=$(curl -s http://localhost:3000/health)
if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    echo -e "${GREEN}✅ Подключение к Supabase успешно!${NC}"
else
    echo -e "${YELLOW}⚠️ Возможны проблемы с подключением к базе данных${NC}"
    echo "Ответ health check: $HEALTH_RESPONSE"
fi

# Запуск TypeScript watch (опционально)
echo ""
read -p "Запустить TypeScript watch для hot reload? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}🔄 Запуск TypeScript watch...${NC}"
    pnpm run build:watch &
    TS_PID=$!
    echo "TypeScript watch запущен (PID: $TS_PID)"
    echo "Для остановки: kill $TS_PID"
fi

echo ""
echo -e "${GREEN}🎉 Development окружение запущено!${NC}"
echo "================================================="
echo -e "${BLUE}📋 Информация о сервисах:${NC}"
echo ""
echo -e "${GREEN}🌐 URLs:${NC}"
echo "  Instance Manager (локальный):  http://localhost:3000"
if [[ "$EXTERNAL_IP" != "localhost" ]]; then
    echo "  Instance Manager (внешний):    http://$EXTERNAL_IP:3000"
fi
echo "  Health Check:                  http://localhost:3000/health"
echo "  API Instances:                 http://localhost:3000/api/v1/instances"
echo "  Supabase Dashboard:            https://supabase.com/dashboard"
echo ""
if [[ "$EXTERNAL_IP" != "localhost" ]]; then
    echo -e "${GREEN}🌍 Внешний доступ:${NC}"
    echo "  Instance Manager доступен извне по адресу: http://$EXTERNAL_IP:3000"
    echo "  CORS настроен для поддержки любых портов на IP: $EXTERNAL_IP"
    echo "  Разрешенные origins: http://$EXTERNAL_IP:*, https://$EXTERNAL_IP:*"
    echo "  Убедитесь что порт 3000 открыт в файрволе"
    echo ""
fi
echo -e "${GREEN}🔧 Команды для разработки:${NC}"
if [ "$USE_HOST_MODE" = true ]; then
    echo "  Логи Instance Manager: tail -f instance-manager.log"
    echo "  Остановка Instance Manager: pkill -f main-instance-manager.js"
    echo "  Перезапуск: pkill -f main-instance-manager.js && nohup node dist/main-instance-manager.js > instance-manager.log 2>&1 &"
else
    echo "  Логи Instance Manager: docker logs wweb-mcp-instance-manager-1 -f"
    echo "  Перезапуск:            docker-compose -f docker-compose.instance-manager.yml restart"
    echo "  Остановка:             docker-compose -f docker-compose.instance-manager.yml down"
    echo "  Пересборка:            docker-compose -f docker-compose.instance-manager.yml up -d --build"
fi
echo ""
echo "  Создать WhatsApp инстанс:"
echo "    curl -X POST http://localhost:3000/api/v1/instances \\"
echo "      -H 'Content-Type: application/json' \\"
echo "      -d '{\"user_id\":\"test-user\",\"provider\":\"whatsappweb\",\"type_instance\":[\"api\"]}'"
echo ""
echo "  Создать Telegram инстанс:"
echo "    curl -X POST http://localhost:3000/api/v1/instances \\"
echo "      -H 'Content-Type: application/json' \\"
echo "      -d '{\"user_id\":\"test-user\",\"provider\":\"telegram\",\"type_instance\":[\"api\"]}'"
echo ""
echo "  Список инстансов:      curl http://localhost:3000/api/v1/instances"
echo "  Статистика портов:     curl http://localhost:3000/api/v1/resources/ports"
echo ""
echo -e "${GREEN}📝 Следующие шаги:${NC}"
echo "1. 📱 Создайте WhatsApp или Telegram инстанс через API"
echo "2. 📲 Для WhatsApp: получите QR код и отсканируйте его"
echo "3. 🤖 Для Telegram: убедитесь что TELEGRAM_BOT_TOKEN настроен"
echo "4. 💬 Используйте API для отправки сообщений"
echo ""
echo -e "${YELLOW}💡 Полезные ссылки:${NC}"
echo "  Документация API: README.md"
echo "  Тестирование: TESTING_GUIDE_NEW.md"
echo "  Supabase миграция: SUPABASE_MIGRATION_COMPLETED.md"
echo ""
if [ "$USE_HOST_MODE" = true ]; then
    echo -e "${YELLOW}💡 Для остановки Instance Manager выполните:${NC}"
    echo "pkill -f main-instance-manager.js"
else
    echo -e "${YELLOW}💡 Для остановки нажмите Ctrl+C и выполните:${NC}"
    echo "docker-compose -f docker-compose.instance-manager.yml down"
fi 