-- Migration: Rename user_id to company_id
-- Version: 010
-- Description: Renames user_id field to company_id in all tables for better semantic meaning

BEGIN;

-- Rename user_id to company_id in main message_instances table
ALTER TABLE public.message_instances 
RENAME COLUMN user_id TO company_id;

-- Update index name for consistency
DROP INDEX IF EXISTS idx_message_instances_user_id;
CREATE INDEX IF NOT EXISTS idx_message_instances_company_id 
ON public.message_instances(company_id);

-- Update comment to reflect the new field name
COMMENT ON COLUMN public.message_instances.company_id IS 'Company identifier - nullable text field for grouping instances by company';

-- If there are any provider-specific tables from old migrations, rename columns there too
-- (These might not exist in current schema but ensuring compatibility)
DO $$
BEGIN
    -- Check and rename in whatsappweb_instances if exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'whatsappweb_instances' 
               AND column_name = 'user_id') THEN
        ALTER TABLE public.whatsappweb_instances RENAME COLUMN user_id TO company_id;
        DROP INDEX IF EXISTS idx_whatsappweb_instances_user_id;
        CREATE INDEX IF NOT EXISTS idx_whatsappweb_instances_company_id 
        ON public.whatsappweb_instances(company_id);
    END IF;

    -- Check and rename in telegram_instances if exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'telegram_instances' 
               AND column_name = 'user_id') THEN
        ALTER TABLE public.telegram_instances RENAME COLUMN user_id TO company_id;
        DROP INDEX IF EXISTS idx_telegram_instances_user_id;
        CREATE INDEX IF NOT EXISTS idx_telegram_instances_company_id 
        ON public.telegram_instances(company_id);
    END IF;

    -- Check and rename in whatsapp_official_instances if exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'whatsapp_official_instances' 
               AND column_name = 'user_id') THEN
        ALTER TABLE public.whatsapp_official_instances RENAME COLUMN user_id TO company_id;
        DROP INDEX IF EXISTS idx_whatsapp_official_instances_user_id;
        CREATE INDEX IF NOT EXISTS idx_whatsapp_official_instances_company_id 
        ON public.whatsapp_official_instances(company_id);
    END IF;

    -- Check and rename in facebook_messenger_instances if exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'facebook_messenger_instances' 
               AND column_name = 'user_id') THEN
        ALTER TABLE public.facebook_messenger_instances RENAME COLUMN user_id TO company_id;
        DROP INDEX IF EXISTS idx_facebook_messenger_instances_user_id;
        CREATE INDEX IF NOT EXISTS idx_facebook_messenger_instances_company_id 
        ON public.facebook_messenger_instances(company_id);
    END IF;

    -- Check and rename in instagram_instances if exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'instagram_instances' 
               AND column_name = 'user_id') THEN
        ALTER TABLE public.instagram_instances RENAME COLUMN user_id TO company_id;
        DROP INDEX IF EXISTS idx_instagram_instances_user_id;
        CREATE INDEX IF NOT EXISTS idx_instagram_instances_company_id 
        ON public.instagram_instances(company_id);
    END IF;

    -- Check and rename in slack_instances if exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'slack_instances' 
               AND column_name = 'user_id') THEN
        ALTER TABLE public.slack_instances RENAME COLUMN user_id TO company_id;
        DROP INDEX IF EXISTS idx_slack_instances_user_id;
        CREATE INDEX IF NOT EXISTS idx_slack_instances_company_id 
        ON public.slack_instances(company_id);
    END IF;

    -- Check and rename in discord_instances if exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'discord_instances' 
               AND column_name = 'user_id') THEN
        ALTER TABLE public.discord_instances RENAME COLUMN user_id TO company_id;
        DROP INDEX IF EXISTS idx_discord_instances_user_id;
        CREATE INDEX IF NOT EXISTS idx_discord_instances_company_id 
        ON public.discord_instances(company_id);
    END IF;
END$$;

COMMIT; 