import { Pool } from 'pg';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  schema?: string;
  connectionString?: string;
  ssl?: boolean;
}

export function getDatabaseConfig(): DatabaseConfig {
  return {
    host: process.env.DATABASE_HOST || process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || process.env.DB_PORT || '5432'),
    database: process.env.DATABASE_NAME || process.env.DB_NAME || 'postgres',
    user: process.env.DATABASE_USER || process.env.DB_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || 'password',
    schema: process.env.DATABASE_SCHEMA || process.env.DB_SCHEMA || 'public',
    ssl: process.env.DATABASE_SSL === 'true' || process.env.DB_SSL === 'true',
    connectionString: process.env.DATABASE_URL,
  };
}

export function createPool(): Pool {
  const config = getDatabaseConfig();

  // Приоритет DATABASE_URL для Supabase
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    const poolConfig: any = {
      connectionString: databaseUrl,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
    };

    // Настройки пула для Supabase (убираем statement_timeout и query_timeout - они не поддерживаются)
    if (process.env.USE_SUPABASE === 'true') {
      poolConfig.max = 20; // Максимальное количество подключений
      poolConfig.idleTimeoutMillis = 30000; // 30 секунд
      poolConfig.connectionTimeoutMillis = 10000; // 10 секунд
    }

    return new Pool(poolConfig);
  }

  // Иначе используем отдельные переменные
  const poolConfig: any = {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
  };

  // Настройки пула для Supabase (убираем statement_timeout и query_timeout - они не поддерживаются)
  if (process.env.USE_SUPABASE === 'true') {
    poolConfig.max = 20;
    poolConfig.idleTimeoutMillis = 30000;
    poolConfig.connectionTimeoutMillis = 10000;
  }

  return new Pool(poolConfig);
}

// SQL для создания схемы (не нужно для public)
export const CREATE_SCHEMA_SQL = `
  -- Схема public уже существует в PostgreSQL/Supabase
  -- Ничего не нужно создавать
`;

export const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS public.message_instances (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NULL,
    provider VARCHAR NOT NULL DEFAULT 'whatsappweb',
    type_instance VARCHAR[] NOT NULL DEFAULT ARRAY['api'],
    port_api INTEGER NULL,
    port_mcp INTEGER NULL,
    api_key VARCHAR NULL,
    api_key_generated_at TIMESTAMP WITHOUT TIME ZONE NULL,
    last_qr_generated_at TIMESTAMP WITHOUT TIME ZONE NULL,
    api_webhook_schema JSONB NULL DEFAULT '{}'::jsonb,
    mcp_schema JSONB NULL DEFAULT '{}'::jsonb,
    agno_config JSONB NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT now(),
    auth_status VARCHAR(50) NULL DEFAULT 'pending',
    account TEXT NULL,
    whatsapp_state TEXT NULL,
    token TEXT NULL,
    CONSTRAINT message_instances_pkey PRIMARY KEY (id)
  ) TABLESPACE pg_default;

  CREATE INDEX IF NOT EXISTS idx_message_instances_user_id ON public.message_instances USING btree (user_id) TABLESPACE pg_default;
  CREATE INDEX IF NOT EXISTS idx_message_instances_provider ON public.message_instances USING btree (provider) TABLESPACE pg_default;
  CREATE INDEX IF NOT EXISTS idx_message_instances_auth_status ON public.message_instances USING btree (auth_status) TABLESPACE pg_default;
  CREATE INDEX IF NOT EXISTS idx_message_instances_agno_config_enabled ON public.message_instances USING GIN ((agno_config->'enabled')) TABLESPACE pg_default;
`;
