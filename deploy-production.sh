#!/bin/bash

# Скрипт развертывания WhatsApp Instance Manager на production сервере

echo "🚀 Развертывание WhatsApp Instance Manager на production..."

# Проверка, что скрипт запущен от root или с sudo
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Пожалуйста, запустите скрипт с sudo"
    exit 1
fi

# 1. Установка зависимостей
echo "📦 Установка системных зависимостей..."
apt-get update
apt-get install -y \
    curl \
    git \
    docker.io \
    docker-compose \
    postgresql-client \
    jq

# 2. Установка Node.js 18+
echo "📦 Установка Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# 3. Создание директорий
echo "📁 Создание директорий..."
mkdir -p /opt/wweb-mcp
mkdir -p /opt/wweb-mcp/composes
mkdir -p /opt/wweb-mcp/volumes
mkdir -p /var/log/wweb-mcp

# 4. Клонирование репозитория
echo "📥 Клонирование репозитория..."
cd /opt
git clone https://github.com/your-repo/wweb-mcp.git wweb-mcp-src
cd wweb-mcp-src

# 5. Установка зависимостей
echo "📦 Установка pnpm зависимостей..."
pnpm install

# 6. Сборка проекта
echo "🔨 Сборка проекта..."
pnpm run build

# 7. Копирование production конфигурации
echo "⚙️ Настройка конфигурации..."
cp .env.production .env

# 8. Настройка PostgreSQL
echo "🗄️ Настройка базы данных..."
sudo -u postgres psql << EOF
CREATE DATABASE ai;
CREATE USER ai WITH PASSWORD 'ai_prod_secure_password_2025';
GRANT ALL PRIVILEGES ON DATABASE ai TO ai;
\c ai
CREATE SCHEMA IF NOT EXISTS public;
GRANT ALL ON SCHEMA public TO public;
EOF

# 9. Проверка подключения к БД
echo "✅ Проверка подключения к БД..."
node test-db-connection.js

# 10. Создание systemd сервиса
echo "🔧 Создание systemd сервиса..."
cat > /etc/systemd/system/wweb-instance-manager.service << EOF
[Unit]
Description=WhatsApp Instance Manager
After=network.target postgresql.service docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/wweb-mcp-src
ExecStart=/usr/bin/node /opt/wweb-mcp-src/dist/main-instance-manager.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/wweb-mcp/instance-manager.log
StandardError=append:/var/log/wweb-mcp/instance-manager-error.log

[Install]
WantedBy=multi-user.target
EOF

# 11. Настройка логротации
echo "📝 Настройка логротации..."
cat > /etc/logrotate.d/wweb-mcp << EOF
/var/log/wweb-mcp/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 root root
}
EOF

# 12. Настройка firewall
echo "🔥 Настройка firewall..."
ufw allow 3000/tcp comment 'Instance Manager API'
ufw allow 3001:7999/tcp comment 'WhatsApp Instances'

# 13. Запуск сервиса
echo "🚀 Запуск сервиса..."
systemctl daemon-reload
systemctl enable wweb-instance-manager
systemctl start wweb-instance-manager

# 14. Проверка статуса
echo "✅ Проверка статуса..."
sleep 5
systemctl status wweb-instance-manager

# 15. Тест health endpoint
echo "🏥 Проверка health endpoint..."
curl -s http://localhost:3000/health | jq .

echo "✅ Развертывание завершено!"
echo ""
echo "📋 Информация:"
echo "   - Instance Manager API: http://$(hostname -I | awk '{print $1}'):3000"
echo "   - Логи: /var/log/wweb-mcp/"
echo "   - Конфигурация: /opt/wweb-mcp-src/.env"
echo "   - Статус сервиса: systemctl status wweb-instance-manager"
echo ""
echo "🔐 Не забудьте:"
echo "   1. Изменить пароль БД в .env"
echo "   2. Настроить SSL/TLS (nginx reverse proxy)"
echo "   3. Настроить мониторинг (Prometheus/Grafana)"
echo "   4. Настроить резервное копирование БД" 