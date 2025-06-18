-- Migration: Split provider tables
-- Created: 2025-01-29
-- Description: Разделение таблицы message_instances на отдельные таблицы для каждого провайдера

-- Начинаем транзакцию
BEGIN;

-- 1. Переименовываем существующую таблицу message_instances в whatsappweb_instances
ALTER TABLE public.message_instances RENAME TO whatsappweb_instances;

-- 2. Переименовываем индексы для whatsappweb_instances
DROP INDEX IF EXISTS idx_message_instances_user_id;
DROP INDEX IF EXISTS idx_message_instances_provider;
DROP INDEX IF EXISTS idx_message_instances_agent_id;
DROP INDEX IF EXISTS idx_message_instances_auth_status;

CREATE INDEX idx_whatsappweb_instances_user_id ON public.whatsappweb_instances(user_id);
CREATE INDEX idx_whatsappweb_instances_agent_id ON public.whatsappweb_instances(agent_id);
CREATE INDEX idx_whatsappweb_instances_auth_status ON public.whatsappweb_instances(auth_status);

-- 3. Обновляем provider в существующих записях whatsappweb_instances
UPDATE public.whatsappweb_instances 
SET provider = 'whatsappweb' 
WHERE provider = 'whatsapp' OR provider IS NULL OR provider = '';

-- 4. Создаем таблицу для Telegram
CREATE TABLE IF NOT EXISTS public.telegram_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255),
    provider VARCHAR NOT NULL DEFAULT 'telegram',
    type_instance VARCHAR[] NOT NULL DEFAULT ARRAY['api'],
    port_api INTEGER,
    port_mcp INTEGER,
    api_key VARCHAR,
    current_api_key VARCHAR,
    api_key_generated_at TIMESTAMP,
    api_webhook_schema JSONB DEFAULT '{}',
    mcp_schema JSONB DEFAULT '{}',
    agent_id VARCHAR(255),
    agno_enable BOOLEAN DEFAULT TRUE,
    stream BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    auth_status VARCHAR(50) DEFAULT 'ready',
    account TEXT,
    bot_token TEXT NOT NULL,
    bot_username VARCHAR(255),
    webhook_url TEXT,
    webhook_secret TEXT
);

CREATE INDEX idx_telegram_instances_user_id ON public.telegram_instances(user_id);
CREATE INDEX idx_telegram_instances_agent_id ON public.telegram_instances(agent_id);
CREATE INDEX idx_telegram_instances_auth_status ON public.telegram_instances(auth_status);
CREATE INDEX idx_telegram_instances_bot_token ON public.telegram_instances(bot_token);

-- 5. Создаем таблицу для WhatsApp Official API
CREATE TABLE IF NOT EXISTS public.whatsapp_official_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255),
    provider VARCHAR NOT NULL DEFAULT 'whatsapp-official',
    type_instance VARCHAR[] NOT NULL DEFAULT ARRAY['api'],
    port_api INTEGER,
    port_mcp INTEGER,
    api_key VARCHAR,
    current_api_key VARCHAR,
    api_key_generated_at TIMESTAMP,
    api_webhook_schema JSONB DEFAULT '{}',
    mcp_schema JSONB DEFAULT '{}',
    agent_id VARCHAR(255),
    agno_enable BOOLEAN DEFAULT TRUE,
    stream BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    auth_status VARCHAR(50) DEFAULT 'ready',
    account TEXT,
    phone_number_id VARCHAR(255) NOT NULL,
    access_token TEXT NOT NULL,
    webhook_verify_token VARCHAR(255),
    business_account_id VARCHAR(255),
    api_version VARCHAR(10) DEFAULT 'v18.0'
);

CREATE INDEX idx_whatsapp_official_instances_user_id ON public.whatsapp_official_instances(user_id);
CREATE INDEX idx_whatsapp_official_instances_agent_id ON public.whatsapp_official_instances(agent_id);
CREATE INDEX idx_whatsapp_official_instances_auth_status ON public.whatsapp_official_instances(auth_status);
CREATE INDEX idx_whatsapp_official_instances_phone_number_id ON public.whatsapp_official_instances(phone_number_id);

-- 6. Создаем таблицу для Facebook Messenger
CREATE TABLE IF NOT EXISTS public.facebook_messenger_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255),
    provider VARCHAR NOT NULL DEFAULT 'facebook-messenger',
    type_instance VARCHAR[] NOT NULL DEFAULT ARRAY['api'],
    port_api INTEGER,
    port_mcp INTEGER,
    api_key VARCHAR,
    current_api_key VARCHAR,
    api_key_generated_at TIMESTAMP,
    api_webhook_schema JSONB DEFAULT '{}',
    mcp_schema JSONB DEFAULT '{}',
    agent_id VARCHAR(255),
    agno_enable BOOLEAN DEFAULT TRUE,
    stream BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    auth_status VARCHAR(50) DEFAULT 'ready',
    account TEXT,
    page_access_token TEXT NOT NULL,
    page_id VARCHAR(255) NOT NULL,
    app_secret VARCHAR(255) NOT NULL,
    webhook_verify_token VARCHAR(255),
    api_version VARCHAR(10) DEFAULT 'v18.0'
);

CREATE INDEX idx_facebook_messenger_instances_user_id ON public.facebook_messenger_instances(user_id);
CREATE INDEX idx_facebook_messenger_instances_agent_id ON public.facebook_messenger_instances(agent_id);
CREATE INDEX idx_facebook_messenger_instances_auth_status ON public.facebook_messenger_instances(auth_status);
CREATE INDEX idx_facebook_messenger_instances_page_id ON public.facebook_messenger_instances(page_id);

-- 7. Создаем таблицу для Instagram
CREATE TABLE IF NOT EXISTS public.instagram_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255),
    provider VARCHAR NOT NULL DEFAULT 'instagram',
    type_instance VARCHAR[] NOT NULL DEFAULT ARRAY['api'],
    port_api INTEGER,
    port_mcp INTEGER,
    api_key VARCHAR,
    current_api_key VARCHAR,
    api_key_generated_at TIMESTAMP,
    api_webhook_schema JSONB DEFAULT '{}',
    mcp_schema JSONB DEFAULT '{}',
    agent_id VARCHAR(255),
    agno_enable BOOLEAN DEFAULT TRUE,
    stream BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    auth_status VARCHAR(50) DEFAULT 'ready',
    account TEXT,
    access_token TEXT NOT NULL,
    instagram_user_id VARCHAR(255) NOT NULL,
    app_secret VARCHAR(255),
    webhook_verify_token VARCHAR(255)
);

CREATE INDEX idx_instagram_instances_user_id ON public.instagram_instances(user_id);
CREATE INDEX idx_instagram_instances_agent_id ON public.instagram_instances(agent_id);
CREATE INDEX idx_instagram_instances_auth_status ON public.instagram_instances(auth_status);
CREATE INDEX idx_instagram_instances_user_id_ig ON public.instagram_instances(instagram_user_id);

-- 8. Создаем таблицу для Slack
CREATE TABLE IF NOT EXISTS public.slack_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255),
    provider VARCHAR NOT NULL DEFAULT 'slack',
    type_instance VARCHAR[] NOT NULL DEFAULT ARRAY['api'],
    port_api INTEGER,
    port_mcp INTEGER,
    api_key VARCHAR,
    current_api_key VARCHAR,
    api_key_generated_at TIMESTAMP,
    api_webhook_schema JSONB DEFAULT '{}',
    mcp_schema JSONB DEFAULT '{}',
    agent_id VARCHAR(255),
    agno_enable BOOLEAN DEFAULT TRUE,
    stream BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    auth_status VARCHAR(50) DEFAULT 'ready',
    account TEXT,
    bot_token TEXT NOT NULL,
    app_token TEXT,
    signing_secret VARCHAR(255) NOT NULL,
    team_id VARCHAR(255),
    socket_mode BOOLEAN DEFAULT FALSE,
    webhook_url TEXT
);

CREATE INDEX idx_slack_instances_user_id ON public.slack_instances(user_id);
CREATE INDEX idx_slack_instances_agent_id ON public.slack_instances(agent_id);
CREATE INDEX idx_slack_instances_auth_status ON public.slack_instances(auth_status);
CREATE INDEX idx_slack_instances_team_id ON public.slack_instances(team_id);

-- 9. Создаем таблицу для Discord
CREATE TABLE IF NOT EXISTS public.discord_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255),
    provider VARCHAR NOT NULL DEFAULT 'discord',
    type_instance VARCHAR[] NOT NULL DEFAULT ARRAY['api'],
    port_api INTEGER,
    port_mcp INTEGER,
    api_key VARCHAR,
    current_api_key VARCHAR,
    api_key_generated_at TIMESTAMP,
    api_webhook_schema JSONB DEFAULT '{}',
    mcp_schema JSONB DEFAULT '{}',
    agent_id VARCHAR(255),
    agno_enable BOOLEAN DEFAULT TRUE,
    stream BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    auth_status VARCHAR(50) DEFAULT 'ready',
    account TEXT,
    bot_token TEXT NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    guild_id VARCHAR(255),
    application_id VARCHAR(255),
    intents JSONB DEFAULT '[]'
);

CREATE INDEX idx_discord_instances_user_id ON public.discord_instances(user_id);
CREATE INDEX idx_discord_instances_agent_id ON public.discord_instances(agent_id);
CREATE INDEX idx_discord_instances_auth_status ON public.discord_instances(auth_status);
CREATE INDEX idx_discord_instances_guild_id ON public.discord_instances(guild_id);

-- 10. Создаем VIEW для совместимости (опционально)
CREATE VIEW public.all_instances AS
SELECT 
    id, user_id, provider, type_instance, port_api, port_mcp, 
    api_key, current_api_key, api_key_generated_at, 
    api_webhook_schema, mcp_schema, agent_id, agno_enable, stream,
    created_at, updated_at, auth_status, account,
    'whatsappweb' as table_source
FROM public.whatsappweb_instances
UNION ALL
SELECT 
    id, user_id, provider, type_instance, port_api, port_mcp, 
    api_key, current_api_key, api_key_generated_at, 
    api_webhook_schema, mcp_schema, agent_id, agno_enable, stream,
    created_at, updated_at, auth_status, account,
    'telegram' as table_source
FROM public.telegram_instances
UNION ALL
SELECT 
    id, user_id, provider, type_instance, port_api, port_mcp, 
    api_key, current_api_key, api_key_generated_at, 
    api_webhook_schema, mcp_schema, agent_id, agno_enable, stream,
    created_at, updated_at, auth_status, account,
    'whatsapp-official' as table_source
FROM public.whatsapp_official_instances
UNION ALL
SELECT 
    id, user_id, provider, type_instance, port_api, port_mcp, 
    api_key, current_api_key, api_key_generated_at, 
    api_webhook_schema, mcp_schema, agent_id, agno_enable, stream,
    created_at, updated_at, auth_status, account,
    'facebook-messenger' as table_source
FROM public.facebook_messenger_instances
UNION ALL
SELECT 
    id, user_id, provider, type_instance, port_api, port_mcp, 
    api_key, current_api_key, api_key_generated_at, 
    api_webhook_schema, mcp_schema, agent_id, agno_enable, stream,
    created_at, updated_at, auth_status, account,
    'instagram' as table_source
FROM public.instagram_instances
UNION ALL
SELECT 
    id, user_id, provider, type_instance, port_api, port_mcp, 
    api_key, current_api_key, api_key_generated_at, 
    api_webhook_schema, mcp_schema, agent_id, agno_enable, stream,
    created_at, updated_at, auth_status, account,
    'slack' as table_source
FROM public.slack_instances
UNION ALL
SELECT 
    id, user_id, provider, type_instance, port_api, port_mcp, 
    api_key, current_api_key, api_key_generated_at, 
    api_webhook_schema, mcp_schema, agent_id, agno_enable, stream,
    created_at, updated_at, auth_status, account,
    'discord' as table_source
FROM public.discord_instances;

COMMIT; 