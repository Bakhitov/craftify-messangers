#!/bin/bash
set -e

# Принудительно устанавливаем development окружение
export NODE_ENV=development

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Функция для определения внешнего IP-адреса
get_external_ip() {
    local ip=""
    
    # Для development окружения используем localhost по умолчанию
    # Это ускоряет запуск и избегает проблем с сетью
    if [[ "${NODE_ENV:-development}" == "development" ]]; then
        echo "localhost"
        return 0
    fi
    
    # Для production пробуем получить внешний IP
    # Пробуем быстрые IPv4 сервисы
    for service in "ipv4.icanhazip.com" "api.ipify.org" "checkip.amazonaws.com"; do
        ip=$(timeout 3 curl -s --connect-timeout 2 --max-time 3 "http://$service" 2>/dev/null | tr -d '\n\r' | grep -E '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$')
        if [[ -n "$ip" ]]; then
            echo "$ip"
            return 0
        fi
    done
    
    # Если не удалось получить внешний IP, используем localhost
    echo "localhost"
    return 1
}

echo -e "${BLUE}🚀 Запуск DEVELOPMENT окружения через Docker с Supabase Cloud${NC}"
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

# Проверка Docker Compose
if ! docker-compose --version > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker Compose не доступен${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker Compose доступен${NC}"

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
if [[ "$OSTYPE" == "darwin"* ]]; then
    USER_HOME=$(eval echo ~$USER)
    if [ -f "$USER_HOME/.colima/default/docker.sock" ]; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|DOCKER_SOCKET_PATH=.*|DOCKER_SOCKET_PATH=$USER_HOME/.colima/default/docker.sock|g" .env
        else
            sed -i "s|DOCKER_SOCKET_PATH=.*|DOCKER_SOCKET_PATH=$USER_HOME/.colima/default/docker.sock|g" .env
        fi
        echo -e "${GREEN}✅ Обновлен путь к Docker socket для Colima: $USER_HOME/.colima/default/docker.sock${NC}"
    else
        echo -e "${YELLOW}⚠️ Colima socket не найден, используется стандартный Docker socket${NC}"
    fi
fi

# Создание необходимых директорий
echo -e "${YELLOW}📁 Создание директорий...${NC}"
mkdir -p composes volumes logs
echo -e "${GREEN}✅ Директории созданы${NC}"

# Проверка конфигурации базы данных
echo -e "${YELLOW}🗄️ Проверка конфигурации Supabase...${NC}"

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
docker-compose down 2>/dev/null || true

# Создание или проверка Docker сети для инстансов
echo -e "${YELLOW}🌐 Создание Docker сети для инстансов...${NC}"
if docker network ls | grep -q "wweb-network"; then
    echo -e "${BLUE}🔧 Пересоздание сети wweb-network для обеспечения правильной конфигурации...${NC}"
    docker network rm wweb-network 2>/dev/null || true
    sleep 1
fi

echo -e "${BLUE}🔧 Создание сети wweb-network...${NC}"
if docker network create \
    --driver bridge \
    --subnet=172.21.0.0/16 \
    wweb-network 2>/dev/null; then
    echo -e "${GREEN}✅ Сеть wweb-network создана с правильной конфигурацией${NC}"
else
    # Проверяем, не была ли сеть создана параллельно
    if docker network ls | grep -q "wweb-network"; then
        echo -e "${GREEN}✅ Сеть wweb-network уже существует${NC}"
    else
        echo -e "${RED}❌ Не удалось создать сеть wweb-network${NC}"
        exit 1
    fi
fi

# Опция: запуск через Docker или локально
echo -e "${YELLOW}🚀 Выберите способ запуска Instance Manager:${NC}"
echo "1. Docker (может быть проблема с Colima socket)"
echo "2. Локально на хосте (рекомендуется для development)"
read -p "Выберите вариант (1/2) [2]: " LAUNCH_MODE
LAUNCH_MODE=${LAUNCH_MODE:-2}

if [ "$LAUNCH_MODE" = "1" ]; then
    echo -e "${YELLOW}🚀 Сборка и запуск Instance Manager через Docker Compose...${NC}"
    docker-compose -f docker-compose.instance-manager.yml up -d --build
else
    echo -e "${YELLOW}🚀 Запуск Instance Manager локально на хосте...${NC}"
    
    # Проверка Node.js и pnpm
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js не установлен${NC}"
        exit 1
    fi
    
    if ! command -v pnpm &> /dev/null; then
        echo -e "${YELLOW}📦 Установка pnpm...${NC}"
        npm install -g pnpm
    fi
    
    # Установка зависимостей и сборка
    echo -e "${YELLOW}📦 Установка зависимостей...${NC}"
    pnpm install
    
    echo -e "${YELLOW}🔨 Сборка проекта...${NC}"
    pnpm run build
    
    # Остановка контейнера если запущен
    docker-compose -f docker-compose.instance-manager.yml down 2>/dev/null || true
    
    # Запуск на хосте
    echo -e "${YELLOW}🚀 Запуск Instance Manager на хосте...${NC}"
    NODE_ENV=development node dist/main-instance-manager.js &
    INSTANCE_MANAGER_PID=$!
    echo "Instance Manager PID: $INSTANCE_MANAGER_PID"
    echo "$INSTANCE_MANAGER_PID" > .instance-manager.pid
fi

# Ожидание запуска с прогресс-индикатором
echo -e "${YELLOW}⏳ Ожидание запуска Instance Manager (это может занять до 1 минуты)...${NC}"
echo -e "${BLUE}💡 Instance Manager имеет медленный старт сервера${NC}"

# Задержка на 1 минуту как указано в правилах пользователя
sleep 60

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
    echo "Проверьте логи: docker logs wweb-mcp-instance-manager-1 -f"
    echo "Или проверьте статус контейнера: docker ps -a"
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

echo ""
echo -e "${GREEN}🎉 Development окружение запущено через Docker!${NC}"
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
echo -e "${GREEN}🔧 Docker команды для разработки:${NC}"
echo "  Логи Instance Manager:    docker logs wweb-mcp-instance-manager-1 -f"
echo "  Статус контейнеров:       docker ps -a"
echo "  Перезапуск:              docker-compose -f docker-compose.instance-manager.yml restart"
echo "  Остановка:               docker-compose -f docker-compose.instance-manager.yml down"
echo "  Пересборка:              docker-compose -f docker-compose.instance-manager.yml up -d --build"
echo "  Запуск всех сервисов:    docker-compose up -d --build"
echo ""
echo "  Создать WhatsApp инстанс:"
echo "    curl -X POST http://localhost:3000/api/v1/instances \\"
echo "      -H 'Content-Type: application/json' \\"
echo "      -d '{\"company_id\":\"test-user\",\"provider\":\"whatsappweb\",\"type_instance\":[\"api\"]}'"
echo ""
echo "  Создать Telegram инстанс:"
echo "    curl -X POST http://localhost:3000/api/v1/instances \\"
echo "      -H 'Content-Type: application/json' \\"
echo "      -d '{\"company_id\":\"test-user\",\"provider\":\"telegram\",\"type_instance\":[\"api\"]}'"
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
echo -e "${YELLOW}💡 Для остановки всех сервисов выполните:${NC}"
echo "docker-compose -f docker-compose.instance-manager.yml down && docker-compose down" 