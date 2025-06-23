-- Миграция для удаления current_api_key из базы данных
-- Файл: 002_remove_current_api_key.sql

-- 1. Удаляем current_api_key из ai.message_instances
ALTER TABLE ai.message_instances DROP COLUMN IF EXISTS current_api_key;

-- 2. Обновляем api_key равным id для всех записей где api_key пустой или null
UPDATE ai.message_instances 
SET api_key = id 
WHERE api_key IS NULL OR api_key = '';

-- 3. Обновляем api_key_generated_at для записей где он пустой
UPDATE ai.message_instances 
SET api_key_generated_at = COALESCE(created_at, NOW()) 
WHERE api_key_generated_at IS NULL;

-- Удаляем current_api_key из таблиц провайдеров (если существуют)
ALTER TABLE IF EXISTS public.whatsappweb_instances DROP COLUMN IF EXISTS current_api_key;
ALTER TABLE IF EXISTS public.telegram_instances DROP COLUMN IF EXISTS current_api_key;
ALTER TABLE IF EXISTS public.whatsapp_official_instances DROP COLUMN IF EXISTS current_api_key;
ALTER TABLE IF EXISTS public.facebook_messenger_instances DROP COLUMN IF EXISTS current_api_key;
ALTER TABLE IF EXISTS public.instagram_instances DROP COLUMN IF EXISTS current_api_key;
ALTER TABLE IF EXISTS public.slack_instances DROP COLUMN IF EXISTS current_api_key;
ALTER TABLE IF EXISTS public.discord_instances DROP COLUMN IF EXISTS current_api_key; 