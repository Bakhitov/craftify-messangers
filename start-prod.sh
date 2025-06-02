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

echo -e "${BLUE}🚀 Запуск PRODUCTION окружения с Supabase Cloud${NC}"
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
    echo -e "${RED}❌ Docker не запущен. Установите и запустите Docker:${NC}"
    echo "sudo systemctl start docker"
    echo "sudo systemctl enable docker"
    exit 1
fi
echo -e "${GREEN}✅ Docker доступен${NC}"

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js не установлен${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js $(node -v) доступен${NC}"

# Проверка root прав для production
if [ "$EUID" -eq 0 ]; then
    echo -e "${YELLOW}⚠️ Запуск от имени root. В production рекомендуется создать отдельного пользователя.${NC}"
fi

# Настройка конфигурации
echo -e "${YELLOW}⚙️ Настройка production конфигурации...${NC}"

if [ ! -f "env.production" ]; then
    echo -e "${RED}❌ Файл env.production не найден${NC}"
    echo "Создайте файл env.production или запустите ./install.sh"
    exit 1
fi

# Копируем prod конфигурацию
cp env.production .env
echo -e "${GREEN}✅ Скопирована production конфигурация${NC}"

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

# Валидация критических настроек
echo -e "${YELLOW}🔒 Проверка security настроек...${NC}"

# Загружаем переменные из .env для проверки
source .env

# Проверка Supabase конфигурации
if [ "$USE_SUPABASE" = "true" ] && [ -n "$DATABASE_URL" ]; then
    echo -e "${BLUE}🌐 Используется Supabase Cloud Database${NC}"
    
    # Проверяем, что не используются placeholder значения
    if [[ "$DATABASE_URL" == *"YOUR_PASSWORD"* ]] || [[ "$DATABASE_URL" == *"YOUR_PROJECT"* ]] || [[ "$DATABASE_PASSWORD" == "YOUR_PASSWORD" ]]; then
        echo -e "${RED}❌ Обнаружены placeholder значения в конфигурации базы данных!${NC}"
        echo "Отредактируйте env.production и замените:"
        echo "  - YOUR_PASSWORD на ваш пароль от Supabase"
        echo "  - YOUR_PROJECT на ID вашего проекта Supabase"
        echo "  - DATABASE_PASSWORD=YOUR_PASSWORD на реальный пароль"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Конфигурация Supabase корректна${NC}"
    echo "  Host: $DATABASE_HOST"
    echo "  Database: $DATABASE_NAME"
    echo "  Schema: $DATABASE_SCHEMA"
    
else
    echo -e "${RED}❌ Конфигурация Supabase не найдена!${NC}"
    echo "Проверьте переменные DATABASE_URL и USE_SUPABASE в env.production"
    exit 1
fi

# Проверка доменов
if [[ "$INSTANCE_MANAGER_BASE_URL" == *"your-domain.com"* ]] || [[ "$INSTANCE_MANAGER_BASE_URL" == *"localhost"* ]]; then
    echo -e "${YELLOW}⚠️ Обнаружены placeholder или localhost домены. Убедитесь, что обновили:${NC}"
    echo "- INSTANCE_MANAGER_BASE_URL"
    echo "- AGNO_API_BASE_URL"
fi

echo -e "${GREEN}✅ Security настройки проверены${NC}"

# Сборка проекта
echo -e "${YELLOW}🔧 Сборка production проекта...${NC}"

# Устанавливаем все зависимости (включая dev для сборки и возможности пересборки)
echo "📦 Установка всех зависимостей для сборки..."
pnpm install --frozen-lockfile

# Сборка проекта
echo "🔨 Сборка TypeScript проекта..."
pnpm run build

# Проверяем результаты сборки
if [[ ! -f "dist/main.js" ]]; then
    echo -e "${RED}❌ Основной файл dist/main.js не найден${NC}"
    exit 1
fi

if [[ ! -f "dist/main-instance-manager.js" ]]; then
    echo -e "${RED}❌ Instance Manager файл dist/main-instance-manager.js не найден${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Проект собран успешно${NC}"

# Сборка Docker образов ПЕРЕД удалением dev-зависимостей
echo -e "${YELLOW}🐳 Сборка Docker образов...${NC}"
docker build -t wweb-mcp:latest .
echo -e "${GREEN}✅ Основной Docker образ wweb-mcp:latest собран${NC}"

docker build -f Dockerfile.instance-manager -t wweb-mcp-instance-manager:latest .
echo -e "${GREEN}✅ Instance Manager Docker образ собран${NC}"

# В production мы НЕ удаляем dev-зависимости с хоста для возможности пересборки
# Dev-зависимости удаляются только внутри Docker образов для оптимизации размера
echo -e "${GREEN}✅ Docker образы оптимизированы (dev-зависимости удалены внутри контейнеров)${NC}"

# Создание необходимых директорий
echo -e "${YELLOW}📁 Создание production директорий...${NC}"
mkdir -p composes volumes logs ssl
echo -e "${GREEN}✅ Директории созданы${NC}"

# Проверка SSL сертификатов (если используется HTTPS)
if [ "$NODE_ENV" = "production" ] && [ "$ENABLE_HTTPS" = "true" ]; then
    echo -e "${YELLOW}🔐 Проверка SSL сертификатов...${NC}"
    if [ ! -f "ssl/fullchain.pem" ] || [ ! -f "ssl/privkey.pem" ]; then
        echo -e "${YELLOW}⚠️ SSL сертификаты не найдены. Создание self-signed сертификатов...${NC}"
        
        # Создание самоподписанного сертификата для тестирования
        openssl req -x509 -newkey rsa:4096 -keyout ssl/privkey.pem -out ssl/fullchain.pem -days 365 -nodes \
            -subj "/C=RU/ST=Moscow/L=Moscow/O=WWEB-MCP/OU=IT/CN=localhost"
        
        echo -e "${YELLOW}⚠️ Создан self-signed сертификат. Для production используйте Let's Encrypt:${NC}"
        echo "sudo certbot certonly --nginx -d your-domain.com"
    else
        echo -e "${GREEN}✅ SSL сертификаты найдены${NC}"
    fi
fi

# Остановка существующих сервисов
echo -e "${YELLOW}🛑 Остановка существующих сервисов...${NC}"
docker-compose -f docker-compose.instance-manager.yml down 2>/dev/null || true
docker-compose -f docker-compose.instance-manager.production.yml down 2>/dev/null || true

# Очистка старых образов
echo -e "${YELLOW}🧹 Очистка старых Docker образов...${NC}"
docker system prune -f

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

# Определение режима запуска Instance Manager для production
DOCKER_CONTEXT=$(docker context show)
USE_HOST_MODE=false

if [[ "$OSTYPE" == "darwin"* ]] && [[ "$DOCKER_CONTEXT" == "colima" ]]; then
    echo -e "${YELLOW}⚠️ Обнаружен macOS + Colima в production окружении${NC}"
    echo -e "${YELLOW}⚠️ Для production рекомендуется Docker Desktop или Linux сервер${NC}"
    echo -e "${BLUE}💡 Альтернатива: запуск Instance Manager на хосте${NC}"
    echo ""
    read -p "Запустить Instance Manager на хосте? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        USE_HOST_MODE=true
    fi
fi

# Запуск production Instance Manager
if [ "$USE_HOST_MODE" = true ]; then
    echo -e "${YELLOW}🚀 Запуск production Instance Manager на хосте...${NC}"
    
    # Экспорт переменных окружения
    export $(grep -v '^#' .env | xargs)
    
    # Проверка что порт свободен
    if lsof -i :3000 > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️ Порт 3000 занят, останавливаем процесс...${NC}"
        pkill -f "main-instance-manager.js" || true
        sleep 2
    fi
    
    # Запуск в background с логированием
    echo -e "${BLUE}🔄 Запуск Instance Manager в production режиме...${NC}"
    nohup node dist/main-instance-manager.js > instance-manager-prod.log 2>&1 &
    IM_PID=$!
    echo "Instance Manager запущен (PID: $IM_PID)"
    
    # Ожидание запуска
    echo -e "${YELLOW}⏳ Ожидание запуска Instance Manager...${NC}"
    sleep 10
    
else
    echo -e "${YELLOW}🚀 Запуск production Instance Manager в Docker...${NC}"
    echo -e "${BLUE}💡 Используется production docker-compose конфигурация с bridge network${NC}"
    docker-compose -f docker-compose.instance-manager.production.yml up -d --build
    
    # Ожидание запуска всех сервисов
    echo -e "${YELLOW}⏳ Ожидание запуска сервисов...${NC}"
    sleep 20
fi

# Проверка статуса сервисов
echo -e "${YELLOW}🔍 Проверка статуса сервисов...${NC}"

# Проверка Instance Manager
echo -n "Instance Manager: "
RETRY_COUNT=0
MAX_RETRIES=6

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:3000/health > /dev/null; then
        echo -e "${GREEN}✅ Запущен${NC}"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
            echo -e "${RED}❌ Недоступен${NC}"
            if [ "$USE_HOST_MODE" = true ]; then
                echo "Проверьте логи: tail -f instance-manager-prod.log"
            else
                echo "Проверьте логи: docker logs wweb-mcp-instance-manager-prod -f"
            fi
        else
            echo -n "."
            sleep 3
        fi
    fi
done

# Проверка подключения к Supabase
echo -e "${YELLOW}🔍 Проверка подключения к Supabase...${NC}"
HEALTH_RESPONSE=$(curl -s http://localhost:3000/health 2>/dev/null || echo "error")
if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    echo -e "${GREEN}✅ Подключение к Supabase успешно!${NC}"
else
    echo -e "${YELLOW}⚠️ Возможны проблемы с подключением к базе данных${NC}"
    echo "Ответ health check: $HEALTH_RESPONSE"
fi

# Финальная проверка доступности
echo -e "${YELLOW}🌐 Проверка веб-доступности...${NC}"
if curl -s http://localhost:3000/health > /dev/null; then
    echo -e "${GREEN}✅ HTTP API доступен${NC}"
else
    echo -e "${RED}❌ API недоступен${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Production окружение запущено!${NC}"
echo "================================================="
echo -e "${BLUE}📋 Production информация:${NC}"
echo ""
echo -e "${GREEN}🌐 URLs:${NC}"
echo "  Instance Manager API (локальный):  http://localhost:3000"
if [[ "$EXTERNAL_IP" != "localhost" ]]; then
    echo "  Instance Manager API (внешний):    http://$EXTERNAL_IP:3000"
fi
echo "  Health Check:                      http://localhost:3000/health"
echo "  API Instances:                     http://localhost:3000/api/v1/instances"
echo "  Supabase Dashboard:                https://supabase.com/dashboard"
echo ""
if [[ "$EXTERNAL_IP" != "localhost" ]]; then
    echo -e "${GREEN}🌍 Внешний доступ:${NC}"
    echo "  Instance Manager доступен извне по адресу: http://$EXTERNAL_IP:3000"
    echo "  CORS настроен для поддержки любых портов на IP: $EXTERNAL_IP"
    echo "  Разрешенные origins: http://$EXTERNAL_IP:*, https://$EXTERNAL_IP:*"
    if [ "$USE_HOST_MODE" = true ]; then
        echo "  Режим сети: Host network (прямой доступ к портам хоста)"
    else
        echo "  Режим сети: Bridge network (порт 3000 проброшен на 0.0.0.0:3000)"
    fi
    echo "  Убедитесь что порт 3000 открыт в файрволе"
    echo "  Рекомендуется настроить SSL и reverse proxy для production"
    echo ""
fi
echo -e "${GREEN}🔧 Команды мониторинга:${NC}"
if [ "$USE_HOST_MODE" = true ]; then
    echo "  Статус процесса:       ps aux | grep main-instance-manager.js"
    echo "  Логи Instance Manager: tail -f instance-manager-prod.log"
    echo "  Процесс Instance Manager: ps aux | grep main-instance-manager.js"
else
    echo "  Статус контейнера:     docker ps | grep wweb-mcp-instance-manager-prod"
    echo "  Логи Instance Manager: docker logs wweb-mcp-instance-manager-prod -f"
    echo "  Статистика ресурсов:   docker stats wweb-mcp-instance-manager-prod"
fi
echo "  Проверка здоровья:     curl http://localhost:3000/health"
echo ""
echo -e "${GREEN}🛑 Команды управления:${NC}"
if [ "$USE_HOST_MODE" = true ]; then
    echo "  Остановка:             pkill -f main-instance-manager.js"
    echo "  Перезапуск:            pkill -f main-instance-manager.js && nohup node dist/main-instance-manager.js > instance-manager-prod.log 2>&1 &"
    echo "  Просмотр логов:        tail -f instance-manager-prod.log"
    echo "  Статус процесса:       ps aux | grep main-instance-manager.js"
else
    echo "  Перезапуск:            docker-compose -f docker-compose.instance-manager.production.yml restart"
    echo "  Остановка:             docker-compose -f docker-compose.instance-manager.production.yml down"
    echo "  Обновление:            git pull && docker-compose -f docker-compose.instance-manager.production.yml up -d --build"
    echo "  Просмотр логов:        docker-compose -f docker-compose.instance-manager.production.yml logs -f"
fi
echo ""
echo -e "${GREEN}📊 API команды:${NC}"
echo "  Создать WhatsApp инстанс:"
echo "    curl -X POST http://localhost:3000/api/v1/instances \\"
echo "      -H 'Content-Type: application/json' \\"
echo "      -d '{\"user_id\":\"prod-user\",\"provider\":\"whatsappweb\",\"type_instance\":[\"api\"]}'"
echo ""
echo "  Список инстансов:      curl http://localhost:3000/api/v1/instances"
echo "  Статистика портов:     curl http://localhost:3000/api/v1/resources/ports"
echo ""
echo -e "${YELLOW}💡 Важные замечания для production:${NC}"
echo "• ✅ Используется Supabase Cloud Database (управляемая БД)"
echo "• 🔄 Настройте регулярные backup через Supabase Dashboard"
echo "• 🔒 Настройте SSL сертификаты для HTTPS"
echo "• 📊 Настройте мониторинг и алерты"
echo "• 🔄 Регулярно обновляйте зависимости и образы"
echo "• 🌐 Используйте внешний reverse proxy (CloudFlare, Nginx)"
echo "• 🔐 Настройте firewall и ограничьте доступ к портам"
echo "• 🛠️ Dev-зависимости остаются на хосте для возможности пересборки"
echo "• 🐳 Docker образы оптимизированы (dev-зависимости удалены внутри контейнеров)"
echo ""
echo -e "${BLUE}📚 Документация:${NC}"
echo "  README.md                        - Основная документация"
echo "  TESTING_GUIDE_NEW.md             - Руководство по тестированию"
echo "  SUPABASE_MIGRATION_COMPLETED.md  - Информация о Supabase" 