-- Rollback Migration: Split provider tables
-- Created: 2025-01-29
-- Description: Откат разделения таблиц провайдеров обратно в message_instances

-- Начинаем транзакцию
BEGIN;

-- 1. Удаляем VIEW
DROP VIEW IF EXISTS public.all_instances;

-- 2. Создаем временную таблицу message_instances с новой структурой
CREATE TABLE public.message_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255),
    provider VARCHAR NOT NULL DEFAULT 'whatsappweb',
    type_instance VARCHAR[] NOT NULL DEFAULT ARRAY['api'],
    port_api INTEGER,
    port_mcp INTEGER,
    api_key VARCHAR,
    current_api_key VARCHAR,
    api_key_generated_at TIMESTAMP,
    last_qr_generated_at TIMESTAMP,
    api_webhook_schema JSONB DEFAULT '{}',
    mcp_schema JSONB DEFAULT '{}',
    agent_id VARCHAR(255),
    agno_enable BOOLEAN DEFAULT TRUE,
    stream BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    auth_status VARCHAR(50) DEFAULT 'pending',
    account TEXT,
    whatsapp_state TEXT,
    token TEXT
);

-- 3. Копируем данные из whatsappweb_instances
INSERT INTO public.message_instances (
    id, user_id, provider, type_instance, port_api, port_mcp, 
    api_key, current_api_key, api_key_generated_at, last_qr_generated_at,
    api_webhook_schema, mcp_schema, agent_id, agno_enable, stream,
    created_at, updated_at, auth_status, account, whatsapp_state, token
)
SELECT 
    id, user_id, 'whatsapp' as provider, type_instance, port_api, port_mcp, 
    api_key, current_api_key, api_key_generated_at, last_qr_generated_at,
    api_webhook_schema, mcp_schema, agent_id, agno_enable, stream,
    created_at, updated_at, auth_status, account, whatsapp_state, token
FROM public.whatsappweb_instances;

-- 4. Копируем данные из telegram_instances
INSERT INTO public.message_instances (
    id, user_id, provider, type_instance, port_api, port_mcp, 
    api_key, current_api_key, api_key_generated_at,
    api_webhook_schema, mcp_schema, agent_id, agno_enable, stream,
    created_at, updated_at, auth_status, account, token
)
SELECT 
    id, user_id, 'telegram' as provider, type_instance, port_api, port_mcp, 
    api_key, current_api_key, api_key_generated_at,
    api_webhook_schema, mcp_schema, agent_id, agno_enable, stream,
    created_at, updated_at, auth_status, account, bot_token
FROM public.telegram_instances;

-- 5. Удаляем отдельные таблицы провайдеров
DROP TABLE IF EXISTS public.whatsappweb_instances;
DROP TABLE IF EXISTS public.telegram_instances;
DROP TABLE IF EXISTS public.whatsapp_official_instances;
DROP TABLE IF EXISTS public.facebook_messenger_instances;
DROP TABLE IF EXISTS public.instagram_instances;
DROP TABLE IF EXISTS public.slack_instances;
DROP TABLE IF EXISTS public.discord_instances;

-- 6. Создаем индексы для message_instances
CREATE INDEX idx_message_instances_user_id ON public.message_instances(user_id);
CREATE INDEX idx_message_instances_provider ON public.message_instances(provider);
CREATE INDEX idx_message_instances_agent_id ON public.message_instances(agent_id);
CREATE INDEX idx_message_instances_auth_status ON public.message_instances(auth_status);

COMMIT; 