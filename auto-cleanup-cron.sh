#!/bin/bash

# Автоматическая очистка неиспользуемых инстансов
# Запускается по cron расписанию

LOGFILE="/tmp/instance-cleanup.log"
INSTANCE_MANAGER_URL="http://13.61.141.6:3000"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOGFILE"
}

log "🚀 Запуск автоматической очистки инстансов"

# 1. Очистка failed инстансов
failed_instances=$(curl -s "$INSTANCE_MANAGER_URL/api/v1/instances" | jq -r '.instances[] | select(.status == "failed" or .status == "error") | .id')

if [ -n "$failed_instances" ]; then
    log "🗑️ Найдены failed инстансы для удаления: $(echo $failed_instances | tr '\n' ' ')"
    
    for instance_id in $failed_instances; do
        response=$(curl -s -X DELETE "$INSTANCE_MANAGER_URL/api/v1/instances/$instance_id")
        success=$(echo "$response" | jq -r '.success // false')
        
        if [ "$success" = "true" ]; then
            log "✅ Удален failed инстанс: $instance_id"
        else
            log "❌ Ошибка удаления failed инстанса $instance_id: $(echo "$response" | jq -r '.error // "Unknown error"')"
        fi
        
        sleep 2
    done
else
    log "✅ Failed инстансы для удаления не найдены"
fi

# 2. Очистка старых disconnected инстансов (старше 2 часов)
cutoff_date=$(date -d '2 hours ago' -Iseconds)
old_disconnected=$(curl -s "$INSTANCE_MANAGER_URL/api/v1/instances" | jq -r --arg cutoff "$cutoff_date" '.instances[] | select(.status == "disconnected" and .created_at < $cutoff) | .id')

if [ -n "$old_disconnected" ]; then
    log "🗑️ Найдены старые disconnected инстансы для удаления: $(echo $old_disconnected | tr '\n' ' ')"
    
    for instance_id in $old_disconnected; do
        response=$(curl -s -X DELETE "$INSTANCE_MANAGER_URL/api/v1/instances/$instance_id")
        success=$(echo "$response" | jq -r '.success // false')
        
        if [ "$success" = "true" ]; then
            log "✅ Удален старый disconnected инстанс: $instance_id"
        else
            log "❌ Ошибка удаления disconnected инстанса $instance_id"
        fi
        
        sleep 2
    done
else
    log "✅ Старые disconnected инстансы для удаления не найдены"
fi

# 3. Статистика после очистки
total_instances=$(curl -s "$INSTANCE_MANAGER_URL/api/v1/instances" | jq '.instances | length')
active_instances=$(curl -s "$INSTANCE_MANAGER_URL/api/v1/instances" | jq '.instances[] | select(.status == "client_ready" or .status == "connected") | length')

log "📊 Статистика после очистки: всего инстансов $total_instances, активных $active_instances"
log "✅ Автоматическая очистка завершена"

# Очистка старых логов (оставляем последние 1000 строк)
tail -n 1000 "$LOGFILE" > "${LOGFILE}.tmp" && mv "${LOGFILE}.tmp" "$LOGFILE" 