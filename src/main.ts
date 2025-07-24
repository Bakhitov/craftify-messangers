import express, { NextFunction, Request, Response } from 'express';
import { createMcpServer, McpConfig } from './mcp-server';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createWhatsAppClient, WhatsAppConfig } from './whatsapp-client';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import logger, { configureForCommandMode } from './logger';
import { requestLogger, errorHandler } from './middleware';
import { routerFactory } from './api';
import { telegramRouterFactory, initializeTelegramProvider } from './telegram-api';
import { Client } from 'whatsapp-web.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createPool, CREATE_MESSAGES_TABLE_SQL, getDatabaseConfig } from './config/database.config';
import { MessageStorageService } from './services/message-storage.service';
import { TelegramConfig } from './types';
import { instanceMemoryService } from './instance-manager/services/instance-memory.service';
import { TelegramProvider } from './providers/telegram-provider';

const isDockerContainer = process.env.DOCKER_CONTAINER === 'true';

function parseCommandLineArgs(): ReturnType<typeof yargs.parseSync> {
  return yargs(hideBin(process.argv))
    .option('mode', {
      alias: 'm',
      description: 'Run mode: mcp, whatsapp-api, or telegram-api',
      type: 'string',
      choices: ['mcp', 'whatsapp-api', 'telegram-api'],
      default: 'mcp',
    })
    .option('mcp-mode', {
      alias: 'c',
      description:
        'MCP connection mode: standalone (direct WhatsApp client) or api (connect to WhatsApp API)',
      type: 'string',
      choices: ['standalone', 'api'],
      default: 'standalone',
    })
    .option('transport', {
      alias: 't',
      description: 'MCP transport mode: sse or command',
      type: 'string',
      choices: ['sse', 'command'],
      default: 'sse',
    })
    .option('sse-port', {
      alias: 'p',
      description: 'Port for SSE server (if not specified, assigned dynamically)',
      type: 'number',
      default: 0, // 0 means dynamic port assignment
    })
    .option('api-port', {
      description: 'Port for API server (if not specified, assigned dynamically)',
      type: 'number',
      default: 0, // 0 means dynamic port assignment
    })
    .option('auth-data-path', {
      alias: 'a',
      description: 'Path to store authentication data',
      type: 'string',
      default: '.wwebjs_auth',
    })
    .option('auth-strategy', {
      alias: 's',
      description: 'Authentication strategy: local or none',
      type: 'string',
      choices: ['local', 'none'],
      default: 'local',
    })
    .option('api-base-url', {
      alias: 'b',
      description: 'Base URL for WhatsApp Web REST API when using api mode',
      type: 'string',
      default: 'http://localhost:${API_PORT}/api',
    })
    .option('api-key', {
      alias: 'k',
      description: 'API key for WhatsApp Web REST API when using api mode',
      type: 'string',
      default: '',
    })
    .option('telegram-bot-token', {
      description: 'Telegram Bot Token (required for telegram-api mode)',
      type: 'string',
      default: process.env.TELEGRAM_BOT_TOKEN || '',
    })
    .option('media-storage-path', {
      description: 'Path to store media files from messages',
      type: 'string',
    })
    .option('log-level', {
      alias: 'l',
      description: 'Log level: error, warn, info, http, debug',
      type: 'string',
      choices: ['error', 'warn', 'info', 'http', 'debug'],
      default: 'info',
    })
    .help()
    .alias('help', 'h')
    .parseSync();
}

function configureLogger(argv: ReturnType<typeof parseCommandLineArgs>): void {
  logger.level = argv['log-level'] as string;

  // Configure logger to use stderr for all levels when in MCP command mode
  if (argv.mode === 'mcp' && argv.transport === 'command') {
    configureForCommandMode();
  }
}

async function createConfigurations(argv: ReturnType<typeof parseCommandLineArgs>): Promise<{
  whatsAppConfig: WhatsAppConfig;
  mcpConfig: McpConfig;
  telegramConfig?: TelegramConfig;
}> {
  const whatsAppConfig: WhatsAppConfig = {
    authDataPath: argv['auth-data-path'] as string,
    authStrategy: argv['auth-strategy'] as 'local' | 'none',
    dockerContainer: isDockerContainer,
    mediaStoragePath: argv['media-storage-path'] as string | undefined,
  };

  const mcpConfig: McpConfig = {
    useApiClient: argv['mcp-mode'] === 'api',
    apiBaseUrl: argv['api-base-url'] as string,
    apiKey: argv['api-key'] as string,
    whatsappConfig: whatsAppConfig,
  };

  let telegramConfig: TelegramConfig | undefined;
  if (argv.mode === 'telegram-api') {
    let botToken = argv['telegram-bot-token'] as string;

    // Если bot token не передан через аргументы или переменную окружения
    if (!botToken && process.env.INSTANCE_ID) {
      try {
        logger.info(
          `Trying to load bot token from database for instance ${process.env.INSTANCE_ID}`,
        );
        const pool = createPool();
        const config = getDatabaseConfig();

        const query = `SELECT token FROM ${config.schema}.message_instances WHERE id = $1`;
        logger.debug(`Executing query: ${query} with params: [${process.env.INSTANCE_ID}]`);

        const result = await pool.query(query, [process.env.INSTANCE_ID]);

        if (result.rows.length > 0 && result.rows[0].token) {
          botToken = result.rows[0].token;
          logger.info(
            `Successfully loaded bot token from database for instance ${process.env.INSTANCE_ID}`,
          );
        } else {
          logger.warn(`No bot token found in database for instance ${process.env.INSTANCE_ID}`);
        }
      } catch (error) {
        logger.warn(
          `Failed to load bot token from database: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (!botToken) {
      throw new Error(
        'Telegram Bot Token is required for telegram-api mode. Use --telegram-bot-token, set TELEGRAM_BOT_TOKEN environment variable, or store in database api_key field.',
      );
    }

    telegramConfig = {
      provider: 'telegram',
      botToken,
      authDataPath: argv['auth-data-path'] as string,
      authStrategy: argv['auth-strategy'] as 'local' | 'none',
      dockerContainer: isDockerContainer,
      mediaStoragePath: argv['media-storage-path'] as string | undefined,
    };
  }

  return { whatsAppConfig, mcpConfig, telegramConfig };
}

async function startMcpSseServer(
  server: ReturnType<typeof createMcpServer>,
  port: number,
  mode: string,
): Promise<void> {
  const app = express();
  app.use(requestLogger);

  let transport: SSEServerTransport;

  app.get('/sse', async (_req, res) => {
    logger.info('Received SSE connection');
    transport = new SSEServerTransport('/message', res);
    await server.connect(transport);
  });

  app.post('/message', async (req, res) => {
    await transport?.handlePostMessage(req, res);
  });

  app.use(errorHandler);

  app.listen(port, () => {
    logger.info(`MCP server is running on port ${port} in ${mode} mode`);
  });
}

async function startMcpCommandServer(
  server: ReturnType<typeof createMcpServer>,
  mode: string,
): Promise<void> {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info(`WhatsApp MCP server started successfully in ${mode} mode`);

    process.stdin.on('close', () => {
      logger.info('WhatsApp MCP Server closed');
      server.close();
    });
  } catch (error) {
    logger.error('Error connecting to MCP server', error);
  }
}

async function getWhatsAppApiKey(instanceId: string): Promise<string> {
  // API ключ всегда равен instanceId
  logger.info(`Using instance ID as static API key: ${instanceId}`);
  return instanceId;
}

async function initializeDatabase(): Promise<{
  pool: any;
  messageStorageService: MessageStorageService;
}> {
  try {
    const pool = createPool();
    const config = getDatabaseConfig();

    // Создаем схему если не существует
    await pool.query(`CREATE SCHEMA IF NOT EXISTS ${config.schema}`);

    // Создаем таблицу messages
    await pool.query(CREATE_MESSAGES_TABLE_SQL);

    logger.info('Database initialized successfully');

    const messageStorageService = new MessageStorageService(pool, config.schema);

    return { pool, messageStorageService };
  } catch (error) {
    logger.error('Failed to initialize database', error);
    throw error;
  }
}

async function startWhatsAppApiServer(
  whatsAppConfig: WhatsAppConfig,
  port: number,
  messageStorageService?: MessageStorageService,
): Promise<void> {
  logger.info('Starting WhatsApp Web REST API...');

  // Генерируем instanceId для этого API сервера
  const instanceId = process.env.INSTANCE_ID || crypto.randomUUID();
  logger.info(`Using Instance ID: ${instanceId} (from env: ${!!process.env.INSTANCE_ID})`);

  // Создаем запись в памяти для инстанса
  instanceMemoryService.setInstance(instanceId, {
    user_id: 'api-server', // Для standalone API сервера
    provider: 'whatsappweb',
    type_instance: ['api'],
    ports: {
      api: port,
      assigned_at: new Date(),
    },
  });

  // Обновляем статус - начало запуска
  instanceMemoryService.updateStatus(instanceId, 'start', {
    source: 'main.ts:startWhatsAppApiServer',
    message: 'Starting WhatsApp API server',
  });

  // Проверяем, есть ли вебхук конфигурация в переменной окружения WEBHOOK_CONFIG
  let webhookConfig: any = undefined;
  logger.debug(`Checking for WEBHOOK_CONFIG environment variable...`);

  if (process.env.WEBHOOK_CONFIG) {
    try {
      logger.info(
        `Found WEBHOOK_CONFIG in environment: ${process.env.WEBHOOK_CONFIG.substring(0, 50)}...`,
      );
      webhookConfig = JSON.parse(process.env.WEBHOOK_CONFIG);

      // Проверка структуры конфигурации
      if (!webhookConfig.url) {
        logger.warn(`Invalid webhook config from environment: missing required 'url' field`);
        logger.debug(`Full webhook config from environment: ${JSON.stringify(webhookConfig)}`);
        webhookConfig = undefined;
      } else {
        logger.info('Successfully loaded webhook config from environment variable WEBHOOK_CONFIG');
        logger.debug(`Parsed webhook config: ${JSON.stringify(webhookConfig)}`);
      }
    } catch (error) {
      logger.warn(
        `Failed to parse WEBHOOK_CONFIG from environment: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  } else {
    logger.debug('No WEBHOOK_CONFIG found in environment variables');
  }

  // Если нет в переменной окружения, пробуем получить из базы данных
  if (!webhookConfig && process.env.INSTANCE_ID) {
    try {
      logger.info(
        `Trying to load webhook config from database for instance ${process.env.INSTANCE_ID}`,
      );
      const pool = createPool();
      const config = getDatabaseConfig();
      logger.debug(`Database config: schema=${config.schema}`);

      const query = `SELECT api_webhook_schema FROM ${config.schema}.message_instances WHERE id = $1`;
      logger.debug(`Executing query: ${query} with params: [${process.env.INSTANCE_ID}]`);

      const result = await pool.query(query, [process.env.INSTANCE_ID]);

      logger.debug(
        `Query result rows: ${result.rows.length}, first row: ${JSON.stringify(result.rows[0] || {})}`,
      );

      if (result.rows.length > 0) {
        if (result.rows[0].api_webhook_schema) {
          webhookConfig = result.rows[0].api_webhook_schema;

          // Проверка структуры конфигурации
          if (!webhookConfig.url) {
            logger.warn(`Invalid webhook config from database: missing required 'url' field`);
            logger.debug(`Full webhook config from database: ${JSON.stringify(webhookConfig)}`);
            webhookConfig = undefined;
          } else {
            logger.info(
              `Loaded webhook config from database for instance ${process.env.INSTANCE_ID}: ${JSON.stringify(webhookConfig)}`,
            );
          }
        } else {
          logger.warn(
            `Instance ${process.env.INSTANCE_ID} exists in database but api_webhook_schema is empty or null`,
          );
        }
      } else {
        logger.warn(`No instance found in database with ID ${process.env.INSTANCE_ID}`);
      }
    } catch (error) {
      logger.warn(
        `Failed to load webhook config from database: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  } else if (!webhookConfig) {
    logger.debug('No INSTANCE_ID provided, skipping database lookup for webhook config');
  }

  // Добавляем messageStorageService, instanceId и webhookConfig в конфигурацию клиента
  const clientConfig = {
    ...whatsAppConfig,
    messageStorageService,
    instanceId,
    webhookConfig,
  };

  if (webhookConfig) {
    logger.info(`Using webhook config: ${JSON.stringify(webhookConfig)}`);
  } else {
    logger.info('No webhook config found, webhooks will not be used');
  }

  const client = createWhatsAppClient(clientConfig);
  await client.initialize();

  const apiKey = await getWhatsAppApiKey(instanceId);

  // Сохраняем API ключ в память
  instanceMemoryService.saveApiKey(instanceId, apiKey, {
    source: 'main.ts:startWhatsAppApiServer',
    saveToDb: false, // УБИРАЕМ - теперь сохраняем в БД при наличии INSTANCE_ID
  });

  // ДОБАВЛЯЕМ: Автоматическое обновление API ключа в БД при наличии instanceId
  if (instanceId && process.env.INSTANCE_ID) {
    try {
      logger.info(`Updating API key in database for WhatsApp instance: ${instanceId}`);
      const pool = createPool();
      const config = getDatabaseConfig();

      await pool.query(
        `UPDATE ${config.schema}.message_instances 
         SET api_key = $1, updated_at = NOW() 
         WHERE id = $2`,
        [apiKey, instanceId],
      );

      logger.info(`WhatsApp API key updated in database for instance: ${instanceId}`);

      // Также обновить в памяти с сохранением в БД
      instanceMemoryService.saveApiKey(instanceId, apiKey, {
        source: 'main.ts:startWhatsAppApiServer',
        saveToDb: true, // Теперь сохраняем в БД
      });
    } catch (error) {
      logger.error('Failed to update API key in database:', error);
    }
  } else if (!process.env.INSTANCE_ID) {
    logger.debug('No INSTANCE_ID provided, skipping database API key update');
    // Для standalone режима только в памяти
    instanceMemoryService.saveApiKey(instanceId, apiKey, {
      source: 'main.ts:startWhatsAppApiServer',
      saveToDb: false,
    });
  }

  logger.info(`WhatsApp API key: ${apiKey}`);
  logger.info(`Instance ID: ${instanceId}`);

  const app = express();
  app.use(requestLogger);
  app.use(express.json());

  // Configure authentication middleware
  const publicPaths = ['/api/v1/status', '/api/v1/health'];

  function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    // Skip authentication for public paths
    if (publicPaths.includes(req.path)) {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }

    const apiKey = authHeader.substring(7);
    if (!apiKey || apiKey.trim().length === 0) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    next();
  }

  app.use(authMiddleware);
  app.use('/api/v1', routerFactory(client, messageStorageService, instanceId));
  app.get('/api/v1/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      provider: 'whatsapp',
      timestamp: new Date().toISOString(),
    });
  });

  logger.info(`Health endpoint: http://localhost:${port}/api/v1/health`);
  logger.info(`API endpoints: http://localhost:${port}/api/v1/*`);

  app.use(errorHandler);
  app.listen(port, '0.0.0.0', () => {
    logger.info(`WhatsApp Web Client API started successfully on port ${port}`);
  });

  // Keep the process running
  process.on('SIGINT', async () => {
    logger.info('Shutting down WhatsApp Web Client API...');
    await client.destroy();
    process.exit(0);
  });
}

async function getTelegramApiKey(
  telegramConfig: TelegramConfig,
  _instanceId: string,
): Promise<string> {
  // Если INSTANCE_ID передан через переменную окружения, пытаемся получить token из БД
  if (process.env.INSTANCE_ID) {
    try {
      logger.info(`Loading bot token from database for instance ${process.env.INSTANCE_ID}`);
      const pool = createPool();
      const config = getDatabaseConfig();

      const query = `SELECT token FROM ${config.schema}.message_instances WHERE id = $1`;
      logger.debug(`Executing query: ${query} with params: [${process.env.INSTANCE_ID}]`);

      const result = await pool.query(query, [process.env.INSTANCE_ID]);

      if (result.rows.length > 0 && result.rows[0].token) {
        const botToken = result.rows[0].token;
        logger.info(
          `Successfully loaded bot token from database for instance ${process.env.INSTANCE_ID}`,
        );
        return botToken;
      } else {
        logger.warn(
          `No bot token found in database for instance ${process.env.INSTANCE_ID}, using provided token`,
        );
      }
    } catch (error) {
      logger.warn(
        `Failed to load bot token from database: ${error instanceof Error ? error.message : String(error)}, using provided token`,
      );
    }
  }

  // Используем токен из конфигурации
  if (telegramConfig.botToken) {
    return telegramConfig.botToken;
  }

  // Fallback - возвращаем ошибку, так как bot token обязателен для Telegram
  throw new Error('Bot token is required for Telegram API');
}

async function startTelegramApiServer(
  telegramConfig: TelegramConfig,
  port: number,
  messageStorageService?: MessageStorageService,
): Promise<void> {
  logger.info('Starting Telegram Bot API...');

  // Получаем instanceId и botToken
  const instanceId = process.env.INSTANCE_ID || crypto.randomUUID();
  const botToken = await getTelegramApiKey(telegramConfig, instanceId);

  // API ключ всегда равен instanceId
  const apiKey = instanceId;

  // Создаем запись в памяти для инстанса
  instanceMemoryService.setInstance(instanceId, {
    user_id: 'telegram-api-server',
    provider: 'telegram',
    type_instance: ['api'],
    status: 'start',
    auth_status: 'pending',
    ports: {
      api: port,
      assigned_at: new Date(),
    },
  });

  // Обновляем статус - начало запуска
  instanceMemoryService.updateStatus(instanceId, 'start', {
    source: 'main.ts:startTelegramApiServer',
    message: 'Starting Telegram API server',
  });

  // Инициализируем Telegram провайдер с правильным botToken
  const providerConfig = {
    ...telegramConfig,
    botToken: botToken, // Используем botToken для Telegram
    instanceId,
  };
  const telegramProvider = new TelegramProvider(providerConfig, messageStorageService);

  // Сохраняем API ключ в память (для авторизации API)
  instanceMemoryService.saveApiKey(instanceId, apiKey, {
    source: 'main.ts:startTelegramApiServer',
  });

  // Автоматическое обновление API ключа в БД при наличии instanceId
  if (instanceId && process.env.INSTANCE_ID) {
    try {
      logger.info(`Updating API key in database for Telegram instance: ${instanceId}`);
      const pool = createPool();
      const config = getDatabaseConfig();

      await pool.query(
        `UPDATE ${config.schema}.message_instances 
         SET api_key = $1, updated_at = NOW() 
         WHERE id = $2`,
        [apiKey, instanceId],
      );

      logger.info(`Telegram API key updated in database for instance: ${instanceId}`);

      // Также обновить в памяти с сохранением в БД
      instanceMemoryService.saveApiKey(instanceId, apiKey, {
        source: 'main.ts:startTelegramApiServer',
        saveToDb: true, // Теперь сохраняем в БД
      });
    } catch (error) {
      logger.error('Failed to update API key in database:', error);
    }
  } else if (!process.env.INSTANCE_ID) {
    logger.debug('No INSTANCE_ID provided, skipping database API key update');
    // Для standalone режима только в памяти
    instanceMemoryService.saveApiKey(instanceId, apiKey, {
      source: 'main.ts:startTelegramApiServer',
      saveToDb: false,
    });
  }

  logger.info('Creating Express application...');
  const app = express();
  app.use(requestLogger);
  app.use(express.json());

  // Middleware для проверки авторизации с исключениями для публичных endpoints
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Публичные пути без авторизации - расширенный список
    const publicPaths = [
      '/api/v1/telegram/status',
      '/api/v1/telegram/health',
      '/health',
      '/status',
    ];

    if (publicPaths.some(path => req.path.includes(path))) {
      return next(); // Пропустить авторизацию для публичных путей
    }

    // Проверка авторизации для остальных endpoints
    const authHeader = req.headers['authorization'];
    if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    // Отмечаем использование API ключа
    instanceMemoryService.markApiKeyUsage(instanceId);
    next();
  });

  // Добавляем роуты для Telegram API
  app.use(
    '/api/v1/telegram',
    telegramRouterFactory(telegramProvider, messageStorageService, instanceId),
  );

  // Добавляем общие роуты
  app.get('/api/v1/telegram/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      provider: 'telegram',
      timestamp: new Date().toISOString(),
    });
  });

  app.use(errorHandler);

  logger.info(`Starting Express server on port ${port}...`);

  const server = app.listen(port, '0.0.0.0', () => {
    logger.info(`Telegram API server started on port ${port}`);
    logger.info(`Health endpoint: http://localhost:${port}/api/v1/telegram/health`);
    logger.info(`API endpoints: http://localhost:${port}/api/v1/telegram/*`);
    logger.info(`Instance ID: ${instanceId}`);
    logger.info(`Bot Token: ${botToken}`);
    logger.info(`API Key: ${apiKey}`);

    instanceMemoryService.updateStatus(instanceId, 'client_ready');

    // ПОСЛЕ запуска сервера инициализируем провайдер асинхронно
    setTimeout(async () => {
      try {
        logger.info('Initializing Telegram provider...');
        await telegramProvider.initialize();

        // Автоматически запускаем polling для приема входящих сообщений
        logger.info('Starting polling for incoming messages...');
        await (telegramProvider as any).startPolling();

        instanceMemoryService.updateStatus(instanceId, 'client_ready');
        logger.info('Telegram provider initialized and polling started successfully');
      } catch (initError) {
        logger.error('Failed to initialize Telegram provider:', initError);
        instanceMemoryService.updateStatus(instanceId, 'client_error');
      }
    }, 1000); // Даем время серверу полностью запуститься
  });

  // Обработка ошибок сервера
  server.on('error', error => {
    logger.error('Express server error:', error);
    throw error;
  });

  // Keep the process running
  process.on('SIGINT', async () => {
    logger.info('Shutting down Telegram Bot API...');
    server.close();
    await telegramProvider.destroy();
  });

  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down Telegram Bot API...');
    server.close();
    await telegramProvider.destroy();
  });
}

async function startMcpServer(
  mcpConfig: McpConfig,
  transport: string,
  port: number,
  mode: string,
  messageStorageService?: MessageStorageService,
): Promise<void> {
  let client: Client | null = null;
  let instanceId: string | undefined;

  if (mode === 'standalone') {
    logger.info('Starting WhatsApp Web Client...');

    // Генерируем instanceId для MCP сервера
    instanceId = process.env.INSTANCE_ID || crypto.randomUUID();

    // Создаем запись в памяти для инстанса
    instanceMemoryService.setInstance(instanceId, {
      user_id: 'mcp-server', // Для standalone MCP сервера
      provider: 'whatsappweb',
      type_instance: ['mcp'],
      ports: {
        mcp: port,
        assigned_at: new Date(),
      },
    });

    // Обновляем статус - начало запуска
    instanceMemoryService.updateStatus(instanceId, 'start', {
      source: 'main.ts:startMcpServer',
      message: 'Starting MCP server with WhatsApp client',
    });

    // Проверяем, есть ли вебхук конфигурация в переменной окружения WEBHOOK_CONFIG
    let webhookConfig: any = undefined;
    if (process.env.WEBHOOK_CONFIG) {
      try {
        webhookConfig = JSON.parse(process.env.WEBHOOK_CONFIG);
        logger.info('Loaded webhook config from environment variable WEBHOOK_CONFIG');
      } catch (error) {
        logger.warn('Failed to parse WEBHOOK_CONFIG from environment', error);
      }
    }
    // Если нет в переменной окружения, пробуем получить из базы данных
    else if (process.env.INSTANCE_ID) {
      try {
        const pool = createPool();
        const config = getDatabaseConfig();
        const result = await pool.query(
          `SELECT api_webhook_schema FROM ${config.schema}.message_instances WHERE id = $1`,
          [process.env.INSTANCE_ID],
        );

        if (result.rows.length > 0 && result.rows[0].api_webhook_schema) {
          webhookConfig = result.rows[0].api_webhook_schema;
          logger.info(
            `Loaded webhook config from database for instance ${process.env.INSTANCE_ID}`,
          );
        }
      } catch (error) {
        logger.warn('Failed to load webhook config from database', error);
      }
    }

    // Добавляем messageStorageService, instanceId и webhookConfig в конфигурацию клиента
    const clientConfig = {
      ...mcpConfig.whatsappConfig,
      messageStorageService,
      instanceId,
      webhookConfig,
    };

    client = createWhatsAppClient(clientConfig);
    await client.initialize();

    if (messageStorageService) {
      logger.info(`MCP Instance ID: ${instanceId}`);
    }
  }

  logger.info(`Starting MCP server in ${mode} mode...`);
  logger.debug('MCP Configuration:', mcpConfig);

  const server = createMcpServer(mcpConfig, client);

  if (transport === 'sse') {
    await startMcpSseServer(server, port, mode);
  } else if (transport === 'command') {
    await startMcpCommandServer(server, mode);
  }
}

async function main(): Promise<void> {
  try {
    const argv = parseCommandLineArgs();
    configureLogger(argv);

    const { whatsAppConfig, mcpConfig, telegramConfig } = await createConfigurations(argv);

    // Инициализируем базу данных для всех режимов
    let messageStorageService: MessageStorageService | undefined;
    try {
      const { messageStorageService: service } = await initializeDatabase();
      messageStorageService = service;
      logger.info('Message storage service initialized');
    } catch (error) {
      logger.warn('Failed to initialize message storage service, continuing without it', error);
    }

    if (argv.mode === 'mcp') {
      await startMcpServer(
        mcpConfig,
        argv['transport'] as string,
        argv['sse-port'] as number,
        argv['mcp-mode'] as string,
        messageStorageService,
      );
    } else if (argv.mode === 'whatsapp-api') {
      // Для whatsapp-api режима используем -p флаг (sse-port) если api-port не указан
      const port = (argv['api-port'] as number) || (argv['sse-port'] as number);
      await startWhatsAppApiServer(whatsAppConfig, port, messageStorageService);
    } else if (argv.mode === 'telegram-api') {
      if (!telegramConfig) {
        throw new Error('Telegram configuration is required for telegram-api mode');
      }
      // Для telegram-api режима также используем -p флаг если api-port не указан
      const port = (argv['api-port'] as number) || (argv['sse-port'] as number);
      await startTelegramApiServer(telegramConfig, port, messageStorageService);
    }
  } catch (error) {
    logger.error('Error starting application:', error);
    process.exit(1);
  }
}

main();
