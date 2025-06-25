# 🚀 Деплой Craftify Messengers на AWS EC2

## 📋 Пошаговая инструкция

### 1. 🔧 Создание EC2 инстанса

1. **Войдите в AWS Console** → EC2 → Launch Instance
2. **Выберите AMI**: Ubuntu Server 22.04 LTS (Free Tier)
3. **Instance Type**: t3.medium (2 vCPU, 4GB RAM) - минимум для production
4. **Key Pair**: Создайте новую или используйте существующую
5. **Security Group**: Создайте с правилами:
   ```
   SSH (22) - Ваш IP
   HTTP (80) - 0.0.0.0/0
   HTTPS (443) - 0.0.0.0/0
   Custom TCP (3000-8999) - 0.0.0.0/0  # Для API портов
   ```
6. **Storage**: 20GB gp3 (минимум)

### 2. 🔐 Подключение к серверу

```bash
# Подключение по SSH
ssh -i your-key.pem ubuntu@your-ec2-ip

# Обновление системы
sudo apt update && sudo apt upgrade -y
```

### 3. 🐳 Установка Docker

```bash
# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Добавление пользователя в группу docker
sudo usermod -aG docker ubuntu

# Установка Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Перезагрузка для применения изменений
sudo reboot
```

### 4. 📥 Клонирование проекта

```bash
# После перезагрузки подключитесь снова
ssh -i your-key.pem ubuntu@your-ec2-ip

# Клонирование репозитория
git clone https://github.com/Bakhitov/craftify-messangers.git
cd craftify-messangers

# Проверка Docker
docker --version
docker-compose --version
```

### 5. ⚙️ Настройка окружения

```bash
# Создание production конфигурации
cp .env.example .env

# Редактирование конфигурации
nano .env
```

**Пример production .env:**
```bash
# ===========================================
# PRODUCTION КОНФИГУРАЦИЯ AWS EC2
# ===========================================

NODE_ENV=production
LOG_LEVEL=info

# База данных (в Docker)
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=ai
DATABASE_USER=ai
DATABASE_PASSWORD=SUPER_SECURE_PASSWORD_CHANGE_ME_2025
DATABASE_SCHEMA=public

# Instance Manager
INSTANCE_MANAGER_PORT=3000
INSTANCE_MANAGER_BASE_URL=http://your-ec2-ip:3000

# Docker настройки для Linux
DOCKER_SOCKET_PATH=/var/run/docker.sock

# Диапазон портов
BASE_PORT_RANGE_START=3001
BASE_PORT_RANGE_END=7999
TELEGRAM_BASE_PORT_RANGE_START=4001
TELEGRAM_BASE_PORT_RANGE_END=8999

# Пути (абсолютные для production)
COMPOSE_FILES_PATH=/home/ubuntu/craftify-messangers/composes
VOLUMES_PATH=/home/ubuntu/craftify-messangers/volumes

# Security
WHATSAPP_AUTH_STRATEGY=local
WHATSAPP_MAX_CONNECTIONS=20

# Telegram (получите токен у @BotFather)
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN_HERE
TELEGRAM_ENABLED=true

# AI интеграция
AGNO_ENABLED=true
AGNO_API_BASE_URL=http://localhost:8000
AGNO_API_TIMEOUT=15000
```

### 6. 🚀 Запуск проекта

```bash
# Создание необходимых директорий
mkdir -p composes volumes logs

# Сборка и запуск
docker-compose -f docker-compose.production.yml up -d --build

# Проверка статуса
docker-compose -f docker-compose.production.yml ps
```

### 7. ✅ Проверка работоспособности

```bash
# Health check Instance Manager
curl http://localhost:3000/health

# Проверка API
curl http://localhost:3000/api/v1/instances

# Просмотр логов
docker-compose -f docker-compose.production.yml logs -f
```

### 8. 🌐 Настройка Nginx (опционально)

```bash
# Установка Nginx
sudo apt install nginx -y

# Создание конфигурации
sudo nano /etc/nginx/sites-available/craftify-messengers
```

**Nginx конфигурация:**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # API endpoints для инстансов
    location ~* ^/api/instances/(\d+)/(.*) {
        set $instance_port 3001;
        if ($1 ~ "^([0-9]+)$") {
            set $instance_port $1;
        }
        proxy_pass http://localhost:$instance_port/$2$is_args$args;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Активация конфигурации
sudo ln -s /etc/nginx/sites-available/craftify-messengers /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 9. 🔒 SSL сертификат (Let's Encrypt)

```bash
# Установка Certbot
sudo apt install certbot python3-certbot-nginx -y

# Получение SSL сертификата
sudo certbot --nginx -d your-domain.com

# Автоматическое обновление
sudo crontab -e
# Добавьте строку:
# 0 12 * * * /usr/bin/certbot renew --quiet
```

### 10. 📊 Мониторинг и обслуживание

```bash
# Просмотр статуса всех контейнеров
docker ps

# Мониторинг ресурсов
docker stats

# Просмотр логов
docker-compose -f docker-compose.production.yml logs -f instance-manager

# Backup базы данных
docker exec craftify-messangers-postgres-1 pg_dump -U ai ai > backup_$(date +%Y%m%d).sql

# Очистка старых образов
docker system prune -f
```

### 11. 🔄 Обновление проекта

```bash
# Создание backup
docker exec craftify-messangers-postgres-1 pg_dump -U ai ai > backup_before_update.sql

# Остановка сервисов
docker-compose -f docker-compose.production.yml down

# Обновление кода
git pull origin main

# Пересборка и запуск
docker-compose -f docker-compose.production.yml up -d --build

# Проверка
curl http://localhost:3000/health
```

## 🛠️ Полезные команды

### Управление сервисами

```bash
# Запуск
docker-compose -f docker-compose.production.yml up -d

# Остановка
docker-compose -f docker-compose.production.yml down

# Перезапуск
docker-compose -f docker-compose.production.yml restart

# Просмотр логов
docker-compose -f docker-compose.production.yml logs -f [service_name]
```

### Создание инстансов

```bash
# WhatsApp инстанс
curl -X POST http://localhost:3000/api/v1/instances \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123",
    "provider": "whatsappweb",
    "type_instance": ["api"]
  }'

# Telegram инстанс
curl -X POST http://localhost:3000/api/v1/instances \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123",
    "provider": "telegram",
    "type_instance": ["api"],
    "api_key": "YOUR_BOT_TOKEN"
  }'
```

### Мониторинг системы

```bash
# Использование CPU и памяти
htop

# Использование диска
df -h

# Сетевые подключения
netstat -tulpn | grep :3000

# Логи системы
journalctl -u docker.service -f
```

## 🚨 Устранение неполадок

### Проблема: Контейнеры не запускаются

```bash
# Проверка логов
docker-compose -f docker-compose.production.yml logs

# Проверка образов
docker images

# Пересборка без кэша
docker-compose -f docker-compose.production.yml build --no-cache
```

### Проблема: Порты заняты

```bash
# Проверка занятых портов
sudo netstat -tulpn | grep :3000

# Освобождение порта
sudo kill -9 $(sudo lsof -t -i:3000)
```

### Проблема: Недостаточно места

```bash
# Очистка Docker
docker system prune -a --volumes -f

# Очистка логов
sudo truncate -s 0 /var/lib/docker/containers/*/*-json.log
```

## 💰 Стоимость AWS

**Примерная стоимость в месяц:**
- EC2 t3.medium: ~$30
- EBS 20GB: ~$2
- Трафик: ~$5-10
- **Итого: ~$37-42/месяц**

## 🎯 Следующие шаги

1. ✅ Настройте домен и SSL
2. ✅ Настройте мониторинг (CloudWatch)
3. ✅ Настройте автоматические backup
4. ✅ Настройте CI/CD для автоматического деплоя
5. ✅ Добавьте Load Balancer для высокой доступности

---

**🎉 Поздравляем! Ваш Craftify Messengers успешно развернут на AWS EC2!** 