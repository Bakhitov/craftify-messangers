# 🛠️ Исправление проблем с Docker контейнерами

## Проблема
В результате тестирования endpoints была обнаружена критическая проблема: **API серверы внутри Docker контейнеров не запускались**, хотя контейнеры создавались успешно.

### Симптомы:
- ✅ Docker контейнеры создаются и запускаются
- ❌ API серверы не отвечают на портах (7334, 7501, etc.)
- ❌ Логи показывают "API not responding yet, attempt X/60"
- ❌ Timeout при создании экземпляров через POST /api/v1/instances

## Исправленные проблемы

### 1. 🏥 Неправильные Health Endpoints
**Проблема**: Для всех провайдеров использовался одинаковый endpoint `/api/health`

**Исправление**: В `src/instance-manager/services/compose.service.ts`
```typescript
// ДО: Один endpoint для всех
const healthResponse = await axios.get(`http://localhost:${port}/api/health`);

// ПОСЛЕ: Правильные endpoints для каждого провайдера
let healthEndpoint: string;
if (instance.provider === 'telegram') {
  healthEndpoint = '/api/v1/telegram/health';
} else {
  healthEndpoint = '/api/v1/health'; // WhatsApp и другие
}
```

### 2. 🌐 Проблемы с Networking
**Проблема**: Использовался `host.docker.internal` для проверки API с хоста

**Исправление**: В `src/instance-manager/services/compose.service.ts`
```typescript
// ДО: 
const healthResponse = await axios.get(`http://host.docker.internal:${port}/api/health`);

// ПОСЛЕ:
const healthResponse = await axios.get(`http://localhost:${port}${healthEndpoint}`);
```

### 3. 🔧 Улучшенные команды запуска Docker
**Проблема**: Telegram контейнеры не получали bot token через параметры командной строки

**Исправление**: В `src/instance-manager/utils/docker-compose.utils.ts`
```typescript
if (instance.provider === 'telegram') {
  command = [
    '-m', mode,
    '--log-level', 'debug',
    '--api-port', instance.port_api.toString(),
    ...(instance.token ? ['--telegram-bot-token', instance.token] : []),
  ];
}
```

### 4. 🏗️ Улучшенная обработка health checks
**Проблема**: Health check падал если не удавалось подключиться к основному endpoint

**Исправление**: В `src/instance-manager/utils/connection.utils.ts`
```typescript
// Проверяем /api/v1/health, если не получается - пробуем Telegram endpoint
try {
  const response = await fetch(`${url}/api/v1/health`);
  return response.ok;
} catch (error) {
  // Fallback для Telegram
  const response = await fetch(`${url}/api/v1/telegram/health`);
  return response.ok;
}
```

### 5. 🔄 Исправлены переменные окружения
**Проблема**: Некорректные значения по умолчанию для базы данных

**Исправление**: В `src/instance-manager/utils/docker-compose.utils.ts`
```typescript
// Более безопасные значения по умолчанию
DATABASE_SSL: process.env.DATABASE_SSL || 'false',  // было 'true'
USE_SUPABASE: process.env.USE_SUPABASE || 'false',  // было 'true'
```

## 🔧 Диагностика проблем

### Скрипт диагностики
Создан новый скрипт `diagnose-containers.sh` для быстрой диагностики:

```bash
./diagnose-containers.sh
```

Скрипт проверяет:
- ✅ Статус Docker и docker-compose
- ✅ Существование сети wweb-network
- ✅ Статус всех WWEB контейнеров
- ✅ Доступность API endpoints
- ✅ Логи контейнеров
- ✅ Файлы compose
- ✅ Занятые порты

### Ручная диагностика

1. **Проверка контейнеров**:
```bash
docker ps -a --filter "label=wweb.instance.id"
```

2. **Проверка логов**:
```bash
docker logs <container_name>
```

3. **Проверка API**:
```bash
# WhatsApp
curl http://localhost:<port>/api/v1/health

# Telegram  
curl http://localhost:<port>/api/v1/telegram/health
```

4. **Проверка сети**:
```bash
docker network ls | grep wweb-network
```

## 🚀 Тестирование исправлений

После внесения изменений:

1. **Перезапустите Instance Manager**:
```bash
npm run dev
```

2. **Создайте новый экземпляр**:
```bash
curl -X POST http://localhost:3000/api/v1/instances \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test_user",
    "provider": "whatsappweb",
    "type_instance": ["api"]
  }'
```

3. **Проверьте статус**:
```bash
# Дождитесь создания и запуска контейнера
sleep 30

# Проверьте доступность API
curl http://localhost:<assigned_port>/api/v1/health
```

## 🎯 Ожидаемые результаты

После исправлений:
- ✅ Docker контейнеры создаются И запускаются
- ✅ API серверы отвечают на правильных endpoints
- ✅ Health checks проходят успешно
- ✅ Экземпляры переходят в статус "ready"
- ✅ Timeout при создании экземпляров исключен

## 🆘 Решение проблем

### Если API все еще не отвечает:
1. Запустите `./diagnose-containers.sh`
2. Проверьте логи контейнера
3. Убедитесь что порт не занят другим процессом
4. Проверьте переменные окружения в `.env`

### Если контейнер не запускается:
1. Проверьте Docker image: `docker images | grep wweb-mcp`
2. Пересоберите image: `docker build -t wweb-mcp:latest .`
3. Проверьте сеть: `docker network ls | grep wweb-network`

### Если ошибки базы данных:
1. Проверьте подключение к БД
2. Убедитесь что переменные `DATABASE_*` правильно настроены
3. Для локальной разработки используйте `host.docker.internal`

---

## 📋 Чеклист после исправлений

- [ ] Instance Manager запускается без ошибок
- [ ] Docker контейнеры создаются
- [ ] API серверы отвечают на health endpoints
- [ ] Создание экземпляров работает без timeout
- [ ] Диагностический скрипт показывает все ✅
- [ ] Логи контейнеров не содержат критических ошибок

---

**Статус**: ✅ Исправлено  
**Дата**: 23 июля 2025  
**Версия**: wweb-mcp v2.1+ 