# Миграция 010: Переименование user_id в company_id

## 📋 Описание изменений

Во всем проекте поле `user_id` переименовано в `company_id` для лучшего соответствия семантике.

## ⚠️ КРИТИЧЕСКИ ВАЖНО: ПОЛНАЯ ОЧИСТКА

**Существующие Docker контейнеры НЕСОВМЕСТИМЫ с новым кодом!**  
Старые контейнеры имеют метки с `user_id`, а новый код ищет `company_id`.

### 🚨 Обязательные действия:

1. **СНЕСТИ ВСЕ** существующие контейнеры
2. Применить миграцию БД 
3. Пересоздать все экземпляры

## 🗄️ Изменения в базе данных

### Новые файлы:
- `db/migrations/versions/010_rename_user_id_to_company_id.sql` - SQL миграция
- `scripts/apply-migration-010.sh` - Скрипт для применения миграции
- `scripts/cleanup-all-instances.sh` - Полная очистка контейнеров ⚡ **НОВЫЙ**
- `scripts/full-migration-010.sh` - Комплексная миграция ⚡ **НОВЫЙ**

### Что изменяется в БД:
- Поле `user_id` → `company_id` в таблице `public.message_instances`
- Индекс `idx_message_instances_user_id` → `idx_message_instances_company_id`
- Все провайдерские таблицы обновлены (если существуют)

## 💻 Изменения в коде

### Основные файлы:
- `src/instance-manager/models/instance.model.ts` - интерфейс MessageInstance ✅
- `src/instance-manager/api/v1/instances.ts` - API endpoints ✅
- `src/instance-manager/services/database.service.ts` - методы работы с БД ✅
- `src/instance-manager/config/database.config.ts` - схема таблицы ✅
- `src/utils/instance-manager.client.ts` - клиентские интерфейсы ✅
- `src/utils/test-db-connection.ts` - тестовые таблицы ✅
- `src/services/agno-integration.service.ts` - Agno интеграция ✅

### Дополнительные исправления:
- `src/instance-manager/services/decision.service.ts` - сравнение меток Docker ✅
- `src/instance-manager/services/instance-memory.service.ts` - память экземпляров ✅
- `src/instance-manager/utils/docker-compose.utils.ts` - генерация Docker Compose ✅
- `src/instance-manager/utils/naming.utils.ts` - Docker метки ✅
- `src/services/provider-database.service.ts` - провайдерская база данных ✅

### Логика Agno интеграции:
- **В системе**: Используется `company_id`
- **В Agno API**: Отправляется как `user_id` (для совместимости)
- **В памяти**: Остается `user_id` (для внутренней совместимости)
- **В Docker метках**: Значение `company_id` записывается в метку `wweb.instance.user_id`

## 📖 Обновленная документация

- `docs/INSTANCE_MANAGER_API.md` - примеры API ✅
- `FINAL_README.md` - примеры создания экземпляров ✅
- `start-dev.sh` - команды для разработки ✅
- `get-ports.sh` - скрипт вывода портов ✅
- `cleanup-unused-instances.sh` - скрипт очистки ✅

## 🚀 ПРОСТОЙ СПОСОБ: Автоматическая миграция

**Рекомендуемый способ для продакшена:**

```bash
# Полная миграция одной командой (с подтверждением)
./scripts/full-migration-010.sh
```

Этот скрипт выполнит:
1. ✅ Полную очистку всех контейнеров  
2. ✅ Применение миграции БД
3. ✅ Перезапуск сервисов
4. ✅ Проверку работоспособности

## 🔧 РУЧНОЙ СПОСОБ: Пошаговая миграция

### Этап 1: Полная очистка
```bash
# Удаляет ВСЕ контейнеры, сети и volumes wweb-mcp
./scripts/cleanup-all-instances.sh
```

### Этап 2: Миграция БД
```bash
# Применяет изменения схемы базы данных
./scripts/apply-migration-010.sh  
```

### Этап 3: Перезапуск
```bash
# Перезапуск основных сервисов
docker-compose down
docker-compose up -d --build
```

## 🧪 Тестирование

После миграции проверить:

### 1. API работает:
```bash
curl http://localhost:3000/api/v1/instances
```

### 2. Создание экземпляра:
```bash
curl -X POST http://localhost:3000/api/v1/instances \
  -H "Content-Type: application/json" \
  -d '{"company_id": "test-company", "provider": "whatsappweb", "type_instance": ["api"]}'
```

### 3. Фильтрация по company_id:
```bash
curl http://localhost:3000/api/v1/instances?company_id=test-company
```

## ⚠️ Что сломается

### ❌ Сломается:
- **Все существующие контейнеры** - будут удалены
- **Данные аутентификации WhatsApp** - потребуется пере-QR
- **Внешние API вызовы** - нужно заменить `user_id` на `company_id`

### ✅ Не сломается:
- **Библиотеки WhatsApp/Telegram** - код не изменился
- **Основная функциональность** - только поля переименованы
- **База данных** - данные сохранятся, изменится только схема

## ✅ Статус

**ГОТОВО К ПРИМЕНЕНИЮ** - Все файлы обновлены, миграция создана

### 🔧 Всего файлов: 19

**Основные компоненты:** 7 файлов
**Дополнительные исправления:** 5 файлов  
**Документация и скрипты:** 5 файлов
**Новые файлы:** 4 файла ⚡ **+2 новых скрипта**

**Проверка TypeScript:** ✅ Без ошибок

## 🎯 Итог

**Да, нужно снести все контейнеры!** Но это безопасно:
- ✅ Нативные библиотеки не пострадают  
- ✅ Основной код работает без изменений
- ✅ Просто пересоздадутся контейнеры с правильными метками
- ⚠️ Потребуется повторная авторизация WhatsApp

**Автоматический скрипт все сделает безопасно!** 🚀 