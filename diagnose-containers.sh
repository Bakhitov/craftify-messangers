#!/bin/bash

echo "🔍 Диагностика Docker контейнеров WWEB-MCP"
echo "=========================================="

# Функция для цветного вывода
print_status() {
    if [ "$2" = "success" ]; then
        echo -e "\033[32m✅ $1\033[0m"
    elif [ "$2" = "warning" ]; then
        echo -e "\033[33m⚠️ $1\033[0m"
    elif [ "$2" = "error" ]; then
        echo -e "\033[31m❌ $1\033[0m"
    else
        echo -e "ℹ️ $1"
    fi
}

# Проверка Docker
echo -e "\n📦 Проверка Docker:"
if ! command -v docker &> /dev/null; then
    print_status "Docker не установлен" "error"
    exit 1
fi
print_status "Docker установлен" "success"

if ! docker info &> /dev/null; then
    print_status "Docker daemon не запущен" "error"
    exit 1
fi
print_status "Docker daemon работает" "success"

# Проверка docker-compose
if ! command -v docker-compose &> /dev/null; then
    print_status "docker-compose не установлен" "warning"
else
    print_status "docker-compose установлен" "success"
fi

# Проверка сети
echo -e "\n🌐 Проверка Docker сети:"
if docker network ls | grep -q "wweb-network"; then
    print_status "Сеть wweb-network существует" "success"
else
    print_status "Сеть wweb-network не найдена" "warning"
    echo "   Создание сети..."
    docker network create --driver bridge --subnet=172.20.0.0/16 wweb-network
    print_status "Сеть wweb-network создана" "success"
fi

# Поиск WWEB контейнеров
echo -e "\n🔍 Поиск WWEB контейнеров:"
containers=$(docker ps -a --filter "label=wweb.instance.id" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}")

if [ -z "$containers" ] || [ "$containers" = "NAMES	STATUS	PORTS" ]; then
    print_status "WWEB контейнеры не найдены" "warning"
    echo "   Попробуйте создать экземпляр через API"
else
    echo "$containers"
fi

# Детальная информация о каждом контейнере
echo -e "\n📊 Детальная информация о контейнерах:"
for container in $(docker ps -a --filter "label=wweb.instance.id" --format "{{.Names}}"); do
    echo -e "\n📋 Контейнер: $container"
    
    # Статус
    status=$(docker inspect "$container" --format "{{.State.Status}}")
    if [ "$status" = "running" ]; then
        print_status "Статус: $status" "success"
    else
        print_status "Статус: $status" "error"
    fi
    
    # Порты
    ports=$(docker inspect "$container" --format "{{range \$p, \$conf := .NetworkSettings.Ports}}{{if \$conf}}{{\$p}} -> {{(index \$conf 0).HostPort}} {{end}}{{end}}")
    if [ -n "$ports" ]; then
        echo "   Порты: $ports"
    else
        echo "   Порты: не настроены"
    fi
    
    # Проверка доступности API
    api_port=$(docker inspect "$container" --format "{{range \$p, \$conf := .NetworkSettings.Ports}}{{if \$conf}}{{(index \$conf 0).HostPort}}{{end}}{{end}}" | head -1)
    if [ -n "$api_port" ]; then
        if curl -s "http://localhost:$api_port/api/v1/health" > /dev/null 2>&1; then
            print_status "API отвечает на порту $api_port" "success"
        elif curl -s "http://localhost:$api_port/api/v1/telegram/health" > /dev/null 2>&1; then
            print_status "Telegram API отвечает на порту $api_port" "success"
        else
            print_status "API не отвечает на порту $api_port" "error"
        fi
    fi
    
    # Последние логи (если контейнер запущен)
    if [ "$status" = "running" ]; then
        echo "   📝 Последние логи (10 строк):"
        docker logs --tail 10 "$container" 2>&1 | sed 's/^/      /'
    fi
done

# Проверка файлов compose
echo -e "\n📄 Проверка Compose файлов:"
compose_files=$(find composes/ -name "docker-compose-*.yml" 2>/dev/null | wc -l)
if [ "$compose_files" -gt 0 ]; then
    print_status "Найдено $compose_files compose файлов" "success"
    ls -la composes/docker-compose-*.yml 2>/dev/null | head -5
else
    print_status "Compose файлы не найдены" "warning"
fi

# Проверка портов
echo -e "\n🚪 Проверка занятых портов:"
echo "   Порты в диапазоне 3001-3010:"
for port in {3001..3010}; do
    if ss -ln | grep -q ":$port "; then
        echo "      $port - занят"
    fi
done

echo -e "\n🎯 Проверка Instance Manager:"
if curl -s "http://localhost:3000/health" > /dev/null 2>&1; then
    print_status "Instance Manager работает на порту 3000" "success"
else
    print_status "Instance Manager не отвечает на порту 3000" "error"
fi

echo -e "\n💡 Рекомендации:"
echo "   1. Если контейнеры не запущены - проверьте логи Instance Manager"
echo "   2. Если API не отвечает - проверьте переменные окружения"
echo "   3. Если порты заняты - освободите их или измените настройки"
echo "   4. Для просмотра логов: docker logs <container_name>"
echo "   5. Для перезапуска: docker restart <container_name>"

echo -e "\n✅ Диагностика завершена" 