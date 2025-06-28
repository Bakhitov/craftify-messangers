-- Migration: Add model field to message_instances table
-- Version: 006
-- Description: Adds model column to support different AI models in Agno integration

-- Add model column to message_instances table
ALTER TABLE public.message_instances 
ADD COLUMN model VARCHAR(100) DEFAULT 'gpt-4.1';

-- Add comment to the new column
COMMENT ON COLUMN public.message_instances.model IS 'AI model to use for Agno agent processing';

-- Update existing records to have default model
UPDATE public.message_instances 
SET model = 'gpt-4.1' 
WHERE model IS NULL;

-- Create index for better performance when filtering by model
CREATE INDEX idx_message_instances_model ON public.message_instances(model); 