-- Migration: Add session_id to messages table
-- Created: 2025-01-20
-- Description: Добавление поля session_id в таблицу messages для группировки сообщений по сессиям

-- Начинаем транзакцию
BEGIN;

-- Добавляем поле session_id в таблицу messages
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS session_id UUID;

-- Создаем индекс для session_id
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON public.messages(session_id);

-- Создаем функцию для генерации session_id из agent_id и chat_id
CREATE OR REPLACE FUNCTION generate_session_id(p_agent_id TEXT, p_chat_id TEXT) 
RETURNS UUID AS $$
BEGIN
    -- Если agent_id или chat_id пустые, возвращаем NULL
    IF p_agent_id IS NULL OR p_chat_id IS NULL OR p_agent_id = '' OR p_chat_id = '' THEN
        RETURN NULL;
    END IF;
    
    -- Генерируем детерминированный UUID из agent_id + chat_id
    RETURN uuid_generate_v5(
        uuid_ns_url(), 
        'session:' || p_agent_id || ':' || p_chat_id
    );
END;
$$ LANGUAGE plpgsql;

-- Обновляем существующие записи, устанавливая session_id для записей с agent_id
UPDATE public.messages 
SET session_id = generate_session_id(agent_id, chat_id)
WHERE agent_id IS NOT NULL AND agent_id != '' AND chat_id IS NOT NULL AND chat_id != '';

-- Коммитим изменения
COMMIT; 