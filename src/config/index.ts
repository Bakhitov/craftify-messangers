import { AppConfig } from '../types';

export const config: AppConfig = {
  app: {
    port: parseInt(process.env.PORT || process.env.BASE_PORT_RANGE_START || '0'),
    env: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'wweb_instances',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true',
  },
  whatsapp: {
    authStrategy: (process.env.WHATSAPP_AUTH_STRATEGY as 'local' | 'none') || 'local',
    mediaPath: process.env.MEDIA_PATH || '.wwebjs_auth/media',
    maxConnections: parseInt(process.env.WHATSAPP_MAX_CONNECTIONS || '10'),
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    enabled: process.env.TELEGRAM_ENABLED === 'true',
    webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
  },
  agno: {
    baseUrl: process.env.AGNO_API_BASE_URL || 'http://localhost:8000',
    timeout: parseInt(process.env.AGNO_API_TIMEOUT || '10000'),
    enabled: process.env.AGNO_ENABLED === 'true',
  },
};

// Валидация конфигурации
export function validateConfig(): void {
  const errors: string[] = [];

  // Проверка порта (разрешаем 0 для динамического назначения)
  if (isNaN(config.app.port) || config.app.port < 0 || config.app.port > 65535) {
    errors.push('Invalid app port');
  }

  // Проверка окружения
  if (!['development', 'production', 'test'].includes(config.app.env)) {
    errors.push('Invalid environment');
  }

  // Проверка порта БД
  if (isNaN(config.database.port) || config.database.port < 1 || config.database.port > 65535) {
    errors.push('Invalid database port');
  }

  // Проверка стратегии аутентификации
  if (!['local', 'none'].includes(config.whatsapp.authStrategy)) {
    errors.push('Invalid WhatsApp auth strategy');
  }

  // Проверка конфигурации Telegram
  if (config.telegram.enabled && !config.telegram.botToken) {
    errors.push('Telegram bot token is required when Telegram is enabled');
  }

  // Проверка конфигурации Agno
  if (config.agno.enabled) {
    if (!config.agno.baseUrl) {
      errors.push('Agno base URL is required when Agno is enabled');
    }

    if (isNaN(config.agno.timeout) || config.agno.timeout < 1000 || config.agno.timeout > 60000) {
      errors.push('Agno timeout must be between 1000 and 60000 ms');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Config validation failed: ${errors.join(', ')}`);
  }
}

// Инициализация конфигурации
validateConfig();
