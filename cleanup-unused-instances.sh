#!/bin/bash

echo "🧹 Очистка неиспользуемых инстансов"
echo "=================================="

INSTANCE_MANAGER_URL="http://13.61.141.6:3000"

# Функция для получения всех инстансов
get_all_instances() {
    curl -s "$INSTANCE_MANAGER_URL/api/v1/instances" | jq -r '.instances[]'
}

# Функция для получения неактивных инстансов
get_inactive_instances() {
    curl -s "$INSTANCE_MANAGER_URL/api/v1/instances" | jq -r '.instances[] | select(.status == "failed" or .status == "error" or .status == "disconnected" or .status == "stopped") | .id'
}

# Функция для получения старых инстансов (старше 24 часов и не активных)
get_old_inactive_instances() {
    local cutoff_date=$(date -d '24 hours ago' -Iseconds)
    curl -s "$INSTANCE_MANAGER_URL/api/v1/instances" | jq -r --arg cutoff "$cutoff_date" '.instances[] | select(.created_at < $cutoff and (.status == "failed" or .status == "error" or .status == "disconnected" or .status == "stopped")) | .id'
}

# Функция для проверки активности инстанса
check_instance_activity() {
    local instance_id="$1"
    local memory_data=$(curl -s "$INSTANCE_MANAGER_URL/api/v1/instances/$instance_id/memory")
    local api_key_usage=$(echo "$memory_data" | jq -r '.data.api_key_usage_count // 0')
    
    # Если использование API ключа = 0, инстанс не используется
    if [ "$api_key_usage" -eq 0 ]; then
        echo "inactive"
    else
        echo "active"
    fi
}

# Функция для удаления инстанса
delete_instance() {
    local instance_id="$1"
    echo "🗑️  Удаляю инстанс: $instance_id"
    
    local response=$(curl -s -X DELETE "$INSTANCE_MANAGER_URL/api/v1/instances/$instance_id")
    local success=$(echo "$response" | jq -r '.success // false')
    
    if [ "$success" = "true" ]; then
        echo "✅ Инстанс $instance_id успешно удален"
        return 0
    else
        echo "❌ Ошибка удаления инстанса $instance_id: $(echo "$response" | jq -r '.error // "Unknown error"')"
        return 1
    fi
}

# Основная функция очистки
cleanup_instances() {
    local mode="$1"
    local deleted_count=0
    local failed_count=0
    
    case "$mode" in
        "failed")
            echo "🔍 Поиск инстансов со статусом failed/error/disconnected/stopped..."
            local instances=$(get_inactive_instances)
            ;;
        "old")
            echo "🔍 Поиск старых неактивных инстансов (старше 24 часов)..."
            local instances=$(get_old_inactive_instances)
            ;;
        "unused")
            echo "🔍 Поиск неиспользуемых инстансов (с нулевым использованием API)..."
            local instances=""
            local all_instances=$(curl -s "$INSTANCE_MANAGER_URL/api/v1/instances" | jq -r '.instances[].id')
            
            for instance_id in $all_instances; do
                local activity=$(check_instance_activity "$instance_id")
                if [ "$activity" = "inactive" ]; then
                    instances="$instances $instance_id"
                fi
            done
            ;;
        "interactive")
            echo "🔍 Интерактивная очистка - выберите инстансы для удаления..."
            interactive_cleanup
            return
            ;;
        *)
            echo "❌ Неизвестный режим: $mode"
            echo "Доступные режимы: failed, old, unused, interactive"
            return 1
            ;;
    esac
    
    if [ -z "$instances" ]; then
        echo "✅ Инстансы для удаления не найдены"
        return 0
    fi
    
    echo "📋 Найдены инстансы для удаления:"
    for instance_id in $instances; do
        local instance_info=$(curl -s "$INSTANCE_MANAGER_URL/api/v1/instances/$instance_id" | jq -r '.instance | "\(.provider) | \(.status) | \(.company_id) | \(.created_at)"')
        echo "  - $instance_id: $instance_info"
    done
    
    echo ""
    read -p "❓ Удалить найденные инстансы? (y/N): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        for instance_id in $instances; do
            if delete_instance "$instance_id"; then
                ((deleted_count++))
            else
                ((failed_count++))
            fi
            sleep 1  # Пауза между удалениями
        done
        
        echo ""
        echo "📊 Результаты очистки:"
        echo "✅ Успешно удалено: $deleted_count"
        echo "❌ Ошибок удаления: $failed_count"
    else
        echo "❌ Очистка отменена"
    fi
}

# Интерактивная очистка
interactive_cleanup() {
    local all_instances=$(curl -s "$INSTANCE_MANAGER_URL/api/v1/instances" | jq -r '.instances[] | "\(.id)|\(.provider)|\(.status)|\(.company_id)|\(.created_at)"')
    
    echo "📋 Все инстансы:"
    echo "ID | Provider | Status | User ID | Created At"
    echo "---|----------|--------|---------|----------"
    
    local counter=1
    echo "$all_instances" | while IFS='|' read -r id provider status user_id created_at; do
        printf "%2d | %-12s | %-10s | %-15s | %s | %s\n" $counter "$id" "$provider" "$status" "$user_id" "$created_at"
        ((counter++))
    done
    
    echo ""
    read -p "📝 Введите ID инстансов для удаления (через пробел): " -r instance_ids
    
    for instance_id in $instance_ids; do
        delete_instance "$instance_id"
        sleep 1
    done
}

# Функция помощи
show_help() {
    echo "Использование: $0 [РЕЖИМ]"
    echo ""
    echo "Режимы очистки:"
    echo "  failed      - Удалить инстансы со статусом failed/error/disconnected/stopped"
    echo "  old         - Удалить старые неактивные инстансы (старше 24 часов)"
    echo "  unused      - Удалить неиспользуемые инстансы (с нулевым использованием API)"
    echo "  interactive - Интерактивный выбор инстансов для удаления"
    echo ""
    echo "Примеры:"
    echo "  $0 failed"
    echo "  $0 old"
    echo "  $0 unused"
    echo "  $0 interactive"
}

# Функция сухого запуска (показать что будет удалено без удаления)
dry_run() {
    local mode="$1"
    echo "🔍 Сухой запуск - показываю что будет удалено (режим: $mode)"
    
    case "$mode" in
        "failed")
            local instances=$(get_inactive_instances)
            ;;
        "old")
            local instances=$(get_old_inactive_instances)
            ;;
        "unused")
            local instances=""
            local all_instances=$(curl -s "$INSTANCE_MANAGER_URL/api/v1/instances" | jq -r '.instances[].id')
            
            for instance_id in $all_instances; do
                local activity=$(check_instance_activity "$instance_id")
                if [ "$activity" = "inactive" ]; then
                    instances="$instances $instance_id"
                fi
            done
            ;;
    esac
    
    if [ -z "$instances" ]; then
        echo "✅ Инстансы для удаления не найдены"
        return 0
    fi
    
    echo "📋 Будут удалены следующие инстансы:"
    for instance_id in $instances; do
        local instance_info=$(curl -s "$INSTANCE_MANAGER_URL/api/v1/instances/$instance_id" | jq -r '.instance | "\(.provider) | \(.status) | \(.company_id) | \(.created_at)"')
        echo "  - $instance_id: $instance_info"
    done
}

# Основная логика
case "$1" in
    "help"|"-h"|"--help")
        show_help
        ;;
    "dry-run")
        if [ -z "$2" ]; then
            echo "❌ Укажите режим для сухого запуска"
            show_help
            exit 1
        fi
        dry_run "$2"
        ;;
    "failed"|"old"|"unused"|"interactive")
        cleanup_instances "$1"
        ;;
    "")
        echo "❌ Режим не указан"
        show_help
        exit 1
        ;;
    *)
        echo "❌ Неизвестный режим: $1"
        show_help
        exit 1
        ;;
esac 