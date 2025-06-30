-- Migration: Add agno_config JSON field
-- Version: 008
-- Description: Adds agno_config JSONB field for flexible Agno configuration

-- Add agno_config JSON column to message_instances table
ALTER TABLE public.message_instances 
ADD COLUMN agno_config JSONB;

-- Add comment to the new column
COMMENT ON COLUMN public.message_instances.agno_config IS 'Complete Agno configuration in JSON format: {enabled, agent_id, stream, model, agnoUrl, userId}';

-- Create index for better performance when filtering by agno config
CREATE INDEX idx_message_instances_agno_config_enabled 
ON public.message_instances USING GIN ((agno_config->'enabled')); 