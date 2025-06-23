-- Migration: Add message_source to messages table
-- Created: 2025-01-29
-- Description: Добавление поля message_source для различения источника сообщений

-- Начинаем транзакцию
BEGIN;

-- Добавляем поле message_source в таблицу messages
ALTER TABLE ai.messages 
ADD COLUMN IF NOT EXISTS message_source VARCHAR(20) DEFAULT 'user';

-- Создаем индекс для message_source
CREATE INDEX IF NOT EXISTS idx_messages_message_source ON ai.messages(message_source);

-- Обновляем существующие записи:
-- Входящие сообщения (is_from_me = false) = 'user'
UPDATE ai.messages 
SET message_source = 'user'
WHERE is_from_me = false AND message_source IS NULL;

-- Исходящие сообщения с agent_id = 'agno' (ответы агента)
UPDATE ai.messages 
SET message_source = 'agno'
WHERE is_from_me = true AND agent_id IS NOT NULL AND agent_id != '' AND message_source IS NULL;

-- Остальные исходящие сообщения = 'api' (отправленные через API или с устройства)
-- Примечание: различить API и device для существующих записей невозможно, поэтому ставим 'api'
UPDATE ai.messages 
SET message_source = 'api'
WHERE is_from_me = true AND (agent_id IS NULL OR agent_id = '') AND message_source IS NULL;

-- Добавляем комментарий к колонке
COMMENT ON COLUMN ai.messages.message_source IS 'Источник сообщения: user (от пользователя), agno (ответ агента), api (через API), device (с устройства WhatsApp)';

-- Коммитим изменения
COMMIT; 