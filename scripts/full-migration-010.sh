#!/bin/bash

# Комплексный скрипт для миграции 010: Переход с user_id на company_id
# Включает полную очистку контейнеров и применение миграции БД

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${PURPLE}🚀 МИГРАЦИЯ 010: user_id → company_id${NC}"
echo -e "${BLUE}Этот скрипт выполнит:${NC}"
echo -e "${BLUE}1. Полную очистку Docker контейнеров${NC}"
echo -e "${BLUE}2. Применение миграции базы данных${NC}"
echo -e "${BLUE}3. Перезапуск основных сервисов${NC}"
echo ""

# Final confirmation
echo -e "${YELLOW}⚠️  ВНИМАНИЕ: Все данные аутентификации будут потеряны!${NC}"
echo -e "${YELLOW}⚠️  Все экземпляры потребуют повторной настройки!${NC}"
echo ""
read -p "Продолжить миграцию? (yes/no): " final_confirm
if [ "$final_confirm" != "yes" ]; then
    echo -e "${YELLOW}Миграция отменена${NC}"
    exit 0
fi

echo ""
echo -e "${PURPLE}=== ЭТАП 1: ОЧИСТКА КОНТЕЙНЕРОВ ===${NC}"

# Запускаем скрипт очистки автоматически
if [ -f "scripts/cleanup-all-instances.sh" ]; then
    echo "yes" | ./scripts/cleanup-all-instances.sh
else
    echo -e "${RED}❌ Скрипт очистки не найден: scripts/cleanup-all-instances.sh${NC}"
    exit 1
fi

echo ""
echo -e "${PURPLE}=== ЭТАП 2: МИГРАЦИЯ БАЗЫ ДАННЫХ ===${NC}"

# Применяем миграцию БД
if [ -f "scripts/apply-migration-010.sh" ]; then
    ./scripts/apply-migration-010.sh
else
    echo -e "${RED}❌ Скрипт миграции не найден: scripts/apply-migration-010.sh${NC}"
    exit 1
fi

echo ""
echo -e "${PURPLE}=== ЭТАП 3: ПЕРЕЗАПУСК СЕРВИСОВ ===${NC}"

echo -e "${YELLOW}🔄 Останавливаем основные сервисы...${NC}"
docker-compose down || true

echo -e "${YELLOW}🏗️  Пересобираем и запускаем сервисы...${NC}"
docker-compose up -d --build

echo -e "${YELLOW}⏱️  Ждем запуска сервисов (30 сек)...${NC}"
sleep 30

echo ""
echo -e "${PURPLE}=== ЭТАП 4: ПРОВЕРКА ===${NC}"

# Проверяем что сервисы запущены
echo -e "${YELLOW}🔍 Проверяем статус сервисов...${NC}"
docker-compose ps

echo ""
echo -e "${YELLOW}🔍 Проверяем API Instance Manager...${NC}"
API_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v1/instances || echo "failed")
if [ "$API_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✅ Instance Manager API доступен${NC}"
else
    echo -e "${YELLOW}⚠️  Instance Manager API недоступен (код: $API_RESPONSE)${NC}"
fi

echo ""
echo -e "${GREEN}🎉 МИГРАЦИЯ 010 ЗАВЕРШЕНА!${NC}"
echo ""
echo -e "${BLUE}📋 Что изменилось:${NC}"
echo -e "${BLUE}- Все API endpoints теперь используют 'company_id' вместо 'user_id'${NC}"
echo -e "${BLUE}- Все Docker контейнеры пересозданы с новыми метками${NC}"
echo -e "${BLUE}- База данных обновлена с новой схемой${NC}"
echo ""
echo -e "${BLUE}📋 Что нужно сделать:${NC}"
echo -e "${BLUE}1. Пересоздать все экземпляры через API с новым полем 'company_id'${NC}"
echo -e "${BLUE}2. Обновить внешние интеграции для использования 'company_id'${NC}"
echo -e "${BLUE}3. Повторно авторизовать все WhatsApp экземпляры${NC}"
echo ""
echo -e "${BLUE}🧪 Пример создания нового экземпляра:${NC}"
echo -e "${BLUE}curl -X POST http://localhost:3000/api/v1/instances \\${NC}"
echo -e "${BLUE}  -H 'Content-Type: application/json' \\${NC}"
echo -e "${BLUE}  -d '{\"company_id\":\"test-company\",\"provider\":\"whatsappweb\",\"type_instance\":[\"api\"]}'${NC}"
echo ""
echo -e "${GREEN}✅ Миграция успешно завершена!${NC}" 