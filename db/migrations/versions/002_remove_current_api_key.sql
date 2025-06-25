-- Migration: Remove current_api_key field from all tables
-- Created: 2025-01-20

-- 1. Удаляем current_api_key из public.message_instances
ALTER TABLE public.message_instances DROP COLUMN IF EXISTS current_api_key;

-- 2. Устанавливаем api_key = id для всех записей где api_key IS NULL
UPDATE public.message_instances
SET api_key = id::text 
WHERE api_key IS NULL OR api_key = '';

-- 3. Устанавливаем api_key = id для всех записей где api_key не равен id
UPDATE public.message_instances
SET api_key = id::text 
WHERE api_key != id::text;

-- 4. Удаляем current_api_key из всех таблиц провайдеров (если они существуют)
ALTER TABLE IF EXISTS public.whatsappweb_instances DROP COLUMN IF EXISTS current_api_key;
ALTER TABLE IF EXISTS public.telegram_instances DROP COLUMN IF EXISTS current_api_key;
ALTER TABLE IF EXISTS public.whatsapp_official_instances DROP COLUMN IF EXISTS current_api_key;
ALTER TABLE IF EXISTS public.facebook_messenger_instances DROP COLUMN IF EXISTS current_api_key;
ALTER TABLE IF EXISTS public.instagram_instances DROP COLUMN IF EXISTS current_api_key;
ALTER TABLE IF EXISTS public.slack_instances DROP COLUMN IF EXISTS current_api_key;
ALTER TABLE IF EXISTS public.discord_instances DROP COLUMN IF EXISTS current_api_key; 