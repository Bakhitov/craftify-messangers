#!/bin/bash

# Скрипт для полной очистки всех контейнеров wweb-mcp перед применением миграции 010
# Этот скрипт удаляет все контейнеры, networks и volumes связанные с wweb-mcp

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🧹 Полная очистка wweb-mcp инфраструктуры${NC}"
echo -e "${BLUE}Этот скрипт удалит ВСЕ контейнеры, сети и volumes связанные с wweb-mcp${NC}"
echo ""

# Confirmation
read -p "Вы уверены что хотите удалить ВСЕ контейнеры wweb-mcp? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}Отменено пользователем${NC}"
    exit 0
fi

echo -e "${YELLOW}🛑 Останавливаем все контейнеры wweb-mcp...${NC}"

# Останавливаем все контейнеры с меткой wweb
WWEB_CONTAINERS=$(docker ps -q --filter "label=wweb.instance.id" 2>/dev/null || true)
if [ ! -z "$WWEB_CONTAINERS" ]; then
    echo "Останавливаем контейнеры: $WWEB_CONTAINERS"
    docker stop $WWEB_CONTAINERS
    echo -e "${GREEN}✅ Контейнеры остановлены${NC}"
else
    echo -e "${BLUE}ℹ️  Активные wweb контейнеры не найдены${NC}"
fi

echo -e "${YELLOW}🗑️  Удаляем все контейнеры wweb-mcp...${NC}"

# Удаляем все контейнеры с меткой wweb (включая остановленные)
ALL_WWEB_CONTAINERS=$(docker ps -aq --filter "label=wweb.instance.id" 2>/dev/null || true)
if [ ! -z "$ALL_WWEB_CONTAINERS" ]; then
    echo "Удаляем контейнеры: $ALL_WWEB_CONTAINERS"
    docker rm -f $ALL_WWEB_CONTAINERS
    echo -e "${GREEN}✅ Контейнеры удалены${NC}"
else
    echo -e "${BLUE}ℹ️  wweb контейнеры для удаления не найдены${NC}"
fi

echo -e "${YELLOW}🌐 Удаляем Docker сети...${NC}"

# Удаляем wweb сети
WWEB_NETWORKS=$(docker network ls --filter "name=wweb" -q 2>/dev/null || true)
if [ ! -z "$WWEB_NETWORKS" ]; then
    echo "Удаляем сети: $WWEB_NETWORKS"
    docker network rm $WWEB_NETWORKS 2>/dev/null || true
    echo -e "${GREEN}✅ Сети удалены${NC}"
else
    echo -e "${BLUE}ℹ️  wweb сети не найдены${NC}"
fi

echo -e "${YELLOW}💾 Удаляем Docker volumes...${NC}"

# Удаляем wweb volumes
WWEB_VOLUMES=$(docker volume ls --filter "name=wweb" -q 2>/dev/null || true)
if [ ! -z "$WWEB_VOLUMES" ]; then
    echo "Удаляем volumes: $WWEB_VOLUMES"
    docker volume rm $WWEB_VOLUMES 2>/dev/null || true
    echo -e "${GREEN}✅ Volumes удалены${NC}"
else
    echo -e "${BLUE}ℹ️  wweb volumes не найдены${NC}"
fi

echo -e "${YELLOW}📁 Удаляем compose файлы...${NC}"

# Удаляем все compose файлы
if [ -d "composes" ]; then
    COMPOSE_FILES=$(find composes -name "docker-compose-*.yml" 2>/dev/null || true)
    if [ ! -z "$COMPOSE_FILES" ]; then
        echo "Удаляем compose файлы: $COMPOSE_FILES"
        rm -f composes/docker-compose-*.yml
        echo -e "${GREEN}✅ Compose файлы удалены${NC}"
    else
        echo -e "${BLUE}ℹ️  Compose файлы не найдены${NC}"
    fi
else
    echo -e "${BLUE}ℹ️  Директория composes не найдена${NC}"
fi

echo -e "${YELLOW}🧽 Очистка неиспользуемых Docker ресурсов...${NC}"

# Очистка неиспользуемых ресурсов
docker system prune -f --volumes

echo -e "${GREEN}✅ Полная очистка завершена!${NC}"
echo ""
echo -e "${BLUE}📋 Следующие шаги:${NC}"
echo -e "${BLUE}1. Примените миграцию 010: ./scripts/apply-migration-010.sh${NC}"
echo -e "${BLUE}2. Перезапустите сервисы: docker-compose up -d --build${NC}"
echo -e "${BLUE}3. Пересоздайте все экземпляры через API${NC}"
echo ""
echo -e "${YELLOW}⚠️  Все данные аутентификации WhatsApp будут потеряны!${NC}"
echo -e "${YELLOW}⚠️  Потребуется повторная авторизация для всех экземпляров!${NC}" 