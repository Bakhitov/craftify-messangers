#!/bin/bash
set -e

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Запуск PRODUCTION окружения с Supabase Cloud${NC}"
echo "================================================="

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

# Валидация критических настроек
echo -e "${YELLOW}🔒 Проверка security настроек...${NC}"

# Загружаем переменные из .env для проверки
source .env

# Проверка Supabase конфигурации
if [ "$USE_SUPABASE" = "true" ] && [ -n "$DATABASE_URL" ]; then
    echo -e "${BLUE}🌐 Используется Supabase Cloud Database${NC}"
    
    # Проверяем, что не используются placeholder значения
    if [[ "$DATABASE_URL" == *"YOUR_PASSWORD"* ]] || [[ "$DATABASE_URL" == *"YOUR_PROJECT"* ]]; then
        echo -e "${RED}❌ Обнаружены placeholder значения в DATABASE_URL!${NC}"
        echo "Отредактируйте env.production и замените:"
        echo "  - YOUR_PASSWORD на ваш пароль от Supabase"
        echo "  - YOUR_PROJECT на ID вашего проекта Supabase"
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
pnpm install --prod
pnpm run build

# Сборка Docker образов
echo -e "${YELLOW}🐳 Сборка Docker образов...${NC}"
docker build -t wweb-mcp:latest .
echo -e "${GREEN}✅ Основной Docker образ wweb-mcp:latest собран${NC}"

docker build -f Dockerfile.instance-manager -t wweb-mcp-instance-manager:latest .
echo -e "${GREEN}✅ Instance Manager Docker образ собран${NC}"

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

# Очистка старых образов
echo -e "${YELLOW}🧹 Очистка старых Docker образов...${NC}"
docker system prune -f

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
    docker-compose -f docker-compose.instance-manager.yml up -d --build
    
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
            echo "Проверьте логи: docker logs wweb-mcp-instance-manager-1 -f"
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
echo "  Instance Manager API:  http://localhost:3000"
echo "  Health Check:          http://localhost:3000/health"
echo "  API Instances:         http://localhost:3000/api/v1/instances"
echo "  Supabase Dashboard:    https://supabase.com/dashboard"
echo ""
echo -e "${GREEN}🔧 Команды мониторинга:${NC}"
echo "  Статус контейнера:     docker ps | grep wweb-mcp-instance-manager"
if [ "$USE_HOST_MODE" = true ]; then
    echo "  Логи Instance Manager: tail -f instance-manager-prod.log"
    echo "  Процесс Instance Manager: ps aux | grep main-instance-manager.js"
else
    echo "  Логи Instance Manager: docker logs wweb-mcp-instance-manager-1 -f"
fi
echo "  Статистика ресурсов:   docker stats wweb-mcp-instance-manager-1"
echo "  Проверка здоровья:     curl http://localhost:3000/health"
echo ""
echo -e "${GREEN}🛑 Команды управления:${NC}"
if [ "$USE_HOST_MODE" = true ]; then
    echo "  Остановка:             pkill -f main-instance-manager.js"
    echo "  Перезапуск:            pkill -f main-instance-manager.js && nohup node dist/main-instance-manager.js > instance-manager-prod.log 2>&1 &"
    echo "  Просмотр логов:        tail -f instance-manager-prod.log"
    echo "  Статус процесса:       ps aux | grep main-instance-manager.js"
else
    echo "  Перезапуск:            docker-compose -f docker-compose.instance-manager.yml restart"
    echo "  Остановка:             docker-compose -f docker-compose.instance-manager.yml down"
    echo "  Обновление:            git pull && docker-compose -f docker-compose.instance-manager.yml up -d --build"
    echo "  Просмотр логов:        docker-compose -f docker-compose.instance-manager.yml logs -f"
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
echo ""
echo -e "${BLUE}📚 Документация:${NC}"
echo "  README.md                        - Основная документация"
echo "  TESTING_GUIDE_NEW.md             - Руководство по тестированию"
echo "  SUPABASE_MIGRATION_COMPLETED.md  - Информация о Supabase" 