-- Migration 011: Add indexes for company_id optimization
-- Date: 2025-01-15
-- Description: Добавляет индексы для оптимизации запросов по company_id

-- Проверяем существование индексов перед созданием
DO $$
BEGIN
    -- Композитный индекс для фильтрации по company_id + provider (если не существует)
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'message_instances' 
        AND indexname = 'idx_message_instances_company_provider'
    ) THEN
        CREATE INDEX idx_message_instances_company_provider 
        ON message_instances(company_id, provider);
        
        RAISE NOTICE 'Created index: idx_message_instances_company_provider';
    ELSE
        RAISE NOTICE 'Index already exists: idx_message_instances_company_provider';
    END IF;

    -- Композитный индекс для company_id + auth_status
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'message_instances' 
        AND indexname = 'idx_message_instances_company_auth_status'
    ) THEN
        CREATE INDEX idx_message_instances_company_auth_status 
        ON message_instances(company_id, auth_status);
        
        RAISE NOTICE 'Created index: idx_message_instances_company_auth_status';
    ELSE
        RAISE NOTICE 'Index already exists: idx_message_instances_company_auth_status';
    END IF;

    -- Композитный индекс для сообщений: instance_id + timestamp (для быстрой сортировки)
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'messages' 
        AND indexname = 'idx_messages_instance_timestamp'
    ) THEN
        CREATE INDEX idx_messages_instance_timestamp 
        ON messages(instance_id, timestamp DESC);
        
        RAISE NOTICE 'Created index: idx_messages_instance_timestamp';
    ELSE
        RAISE NOTICE 'Index already exists: idx_messages_instance_timestamp';
    END IF;

    -- Композитный индекс для сообщений: instance_id + chat_id + timestamp
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'messages' 
        AND indexname = 'idx_messages_instance_chat_timestamp'
    ) THEN
        CREATE INDEX idx_messages_instance_chat_timestamp 
        ON messages(instance_id, chat_id, timestamp DESC);
        
        RAISE NOTICE 'Created index: idx_messages_instance_chat_timestamp';
    ELSE
        RAISE NOTICE 'Index already exists: idx_messages_instance_chat_timestamp';
    END IF;

    -- Композитный индекс для сообщений: instance_id + is_group + timestamp
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'messages' 
        AND indexname = 'idx_messages_instance_group_timestamp'
    ) THEN
        CREATE INDEX idx_messages_instance_group_timestamp 
        ON messages(instance_id, is_group, timestamp DESC);
        
        RAISE NOTICE 'Created index: idx_messages_instance_group_timestamp';
    ELSE
        RAISE NOTICE 'Index already exists: idx_messages_instance_group_timestamp';
    END IF;

    -- Композитный индекс для сообщений: instance_id + message_source + timestamp
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'messages' 
        AND indexname = 'idx_messages_instance_source_timestamp'
    ) THEN
        CREATE INDEX idx_messages_instance_source_timestamp 
        ON messages(instance_id, message_source, timestamp DESC);
        
        RAISE NOTICE 'Created index: idx_messages_instance_source_timestamp';
    ELSE
        RAISE NOTICE 'Index already exists: idx_messages_instance_source_timestamp';
    END IF;

    -- Обновляем статистику таблиц для оптимизатора
    ANALYZE message_instances;
    ANALYZE messages;
    
    RAISE NOTICE 'Migration 011 completed successfully - Company ID indexes added';

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Migration 011 failed: %', SQLERRM;
END $$; 