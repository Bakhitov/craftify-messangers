-- Migration: Add agno_url field to message_instances table
-- Version: 007
-- Description: Adds agno_url column to store full Agno API endpoint URL for each instance

-- Add agno_url column to message_instances table
ALTER TABLE public.message_instances 
ADD COLUMN agno_url TEXT;

-- Add comment to the new column
COMMENT ON COLUMN public.message_instances.agno_url IS 'Full Agno API endpoint URL for this instance (e.g., https://crafty-v0-0-1.onrender.com/v1/agents/agno_assist/runs)';

-- Update existing records with default Agno URL pattern
-- This will need to be updated manually for each instance with their specific agent_id
UPDATE public.message_instances 
SET agno_url = CONCAT('https://crafty-v0-0-1.onrender.com/v1/agents/', COALESCE(agent_id, 'agno_assist'), '/runs')
WHERE agno_enable = TRUE AND agent_id IS NOT NULL; 