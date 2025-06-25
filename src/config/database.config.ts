import { Pool } from 'pg';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  schema: string;
  ssl?: boolean;
  connectionString?: string;
}

export function getDatabaseConfig(): DatabaseConfig {
  // Используем переменные окружения, совместимые с instance-manager
  return {
    host: process.env.DATABASE_HOST || process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || process.env.DB_PORT || '5432'),
    database: process.env.DATABASE_NAME || process.env.DB_NAME || 'postgres',
    user: process.env.DATABASE_USER || process.env.DB_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || 'password',
    schema: process.env.DATABASE_SCHEMA || 'public',
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

  // Fallback на отдельные параметры
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

// SQL для создания таблицы messages в схеме public
export const CREATE_MESSAGES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL,
    message_id VARCHAR(255) NOT NULL,
    chat_id VARCHAR(255) NOT NULL,
    from_number VARCHAR(50),
    to_number VARCHAR(50),
    message_body TEXT,
    message_type VARCHAR(50) DEFAULT 'text',
    is_from_me BOOLEAN DEFAULT FALSE,
    is_group BOOLEAN DEFAULT FALSE,
    group_id VARCHAR(255),
    contact_name VARCHAR(255),
    agent_id TEXT,
    session_id UUID,
    message_source VARCHAR(20) DEFAULT 'user',
    timestamp BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(instance_id, message_id)
  );

  CREATE INDEX IF NOT EXISTS idx_messages_instance_id ON public.messages(instance_id);
  CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON public.messages(chat_id);
  CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON public.messages(timestamp);
  CREATE INDEX IF NOT EXISTS idx_messages_from_number ON public.messages(from_number);
  CREATE INDEX IF NOT EXISTS idx_messages_is_group ON public.messages(is_group);
  CREATE INDEX IF NOT EXISTS idx_messages_agent_id ON public.messages(agent_id);
  CREATE INDEX IF NOT EXISTS idx_messages_session_id ON public.messages(session_id);
  CREATE INDEX IF NOT EXISTS idx_messages_message_source ON public.messages(message_source);

  COMMENT ON COLUMN public.messages.message_source IS 'Источник сообщения: user (от пользователя), agno (ответ агента), api (через API), device (с устройства WhatsApp)';
`;
