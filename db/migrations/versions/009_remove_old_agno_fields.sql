-- Migration: Remove old Agno fields in favor of agno_config JSON
-- Version: 009
-- Description: Removes deprecated Agno-related fields (agent_id, agno_enable, stream, model, agno_url) as all configuration is now stored in agno_config JSONB field

-- Remove old Agno-related columns from message_instances table
ALTER TABLE public.message_instances 
DROP COLUMN IF EXISTS agent_id,
DROP COLUMN IF EXISTS agno_enable,
DROP COLUMN IF EXISTS stream,
DROP COLUMN IF EXISTS model,
DROP COLUMN IF EXISTS agno_url;

-- Drop related indexes for old fields
DROP INDEX IF EXISTS idx_message_instances_agent_id;
DROP INDEX IF EXISTS idx_message_instances_agno_enable;
DROP INDEX IF EXISTS idx_message_instances_agno_agent;
DROP INDEX IF EXISTS idx_message_instances_model;

-- Update comment on agno_config column to reflect it's now the only source of truth
COMMENT ON COLUMN public.message_instances.agno_config IS 'Complete Agno configuration in JSON format - single source of truth: {enabled, agent_id, stream, model, agnoUrl, userId}'; 