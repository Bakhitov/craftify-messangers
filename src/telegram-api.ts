import express, { Request, Response, Router, RequestHandler } from 'express';
import { TelegramProvider } from './providers/telegram-provider';
import { TelegramConfig } from './types';
import { MessageStorageService } from './services/message-storage.service';
import { instanceMemoryService } from './instance-manager/services/instance-memory.service';
import logger from './logger';
import { createPool, getDatabaseConfig } from './config/database.config';

// Middleware для аутентификации API ключа с исключениями для публичных путей
function createAuthMiddleware(): express.RequestHandler {
  return (req: Request, res: Response, next: any): void => {
    // Публичные пути без авторизации - расширенный список
    const publicPaths = [
      '/status',
      '/health',
      '/api/v1/telegram/health',
      '/api/v1/telegram/status',
    ];

    if (publicPaths.some(path => req.path.includes(path))) {
      return next(); // Пропустить авторизацию для публичных путей
    }

    // Проверка авторизации для остальных endpoints
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
  };
}

// Фабрика роутера для Telegram API
export function telegramRouterFactory(
  telegramProvider: TelegramProvider,
  messageStorageService?: MessageStorageService,
  instanceId?: string,
): Router {
  const router: Router = express.Router();

  // Health check (без аутентификации)
  const getHealth: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
    res.json({
      status: 'healthy',
      provider: 'telegram',
      timestamp: new Date().toISOString(),
    });
  };

  // Получение статуса бота
  const getStatus: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
    try {
      if (!telegramProvider) {
        res.status(503).json({ error: 'Telegram provider not initialized' });
        return;
      }

      if (instanceId) {
        instanceMemoryService.markApiKeyUsage(instanceId);
      }

      const status = await telegramProvider.getStatus();
      res.json(status);
    } catch (error) {
      logger.error('Error getting Telegram status:', error);
      res.status(500).json({ error: 'Failed to get status' });
    }
  };

  // Получение информации о боте
  const getMe: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
    try {
      if (!telegramProvider) {
        res.status(503).json({ error: 'Telegram provider not initialized' });
        return;
      }

      if (instanceId) {
        instanceMemoryService.markApiKeyUsage(instanceId);
      }

      const me = await telegramProvider.getMe();
      res.json(me);
    } catch (error) {
      logger.error('Error getting bot info:', error);
      res.status(500).json({ error: 'Failed to get bot info' });
    }
  };

  // Отправка сообщения
  const sendMessage: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!telegramProvider) {
        res.status(503).json({ error: 'Telegram provider not initialized' });
        return;
      }

      const { chatId, message } = req.body;
      if (!chatId || !message) {
        res.status(400).json({ error: 'chatId and message are required' });
        return;
      }

      if (instanceId) {
        instanceMemoryService.markApiKeyUsage(instanceId);
      }

      const result = await telegramProvider.sendMessage(chatId, message);
      res.json(result);
    } catch (error) {
      logger.error('Error sending Telegram message:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  };

  // Отправка Telegram сообщения с опциями
  const sendTelegramMessage: RequestHandler = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      if (!telegramProvider) {
        res.status(503).json({ error: 'Telegram provider not initialized' });
        return;
      }

      const {
        chatId,
        message,
        parseMode,
        replyToMessageId,
        disableWebPagePreview,
        disableNotification,
      } = req.body;
      if (!chatId || !message) {
        res.status(400).json({ error: 'chatId and message are required' });
        return;
      }

      if (instanceId) {
        instanceMemoryService.markApiKeyUsage(instanceId);
      }

      const result = await telegramProvider.sendTelegramMessage({
        chatId,
        message,
        parseMode,
        replyToMessageId,
        disableWebPagePreview,
        disableNotification,
      });

      res.json(result);
    } catch (error) {
      logger.error('Error sending Telegram message with options:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  };

  // Отправка медиа
  const sendMediaMessage: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!telegramProvider) {
        res.status(503).json({ error: 'Telegram provider not initialized' });
        return;
      }

      const { chatId, source, caption } = req.body;
      if (!chatId || !source) {
        res.status(400).json({ error: 'chatId and source are required' });
        return;
      }

      if (instanceId) {
        instanceMemoryService.markApiKeyUsage(instanceId);
      }

      const result = await telegramProvider.sendMediaMessage({
        chatId,
        source,
        caption,
        provider: 'telegram',
      });

      res.json(result);
    } catch (error) {
      logger.error('Error sending Telegram media:', error);
      res.status(500).json({ error: 'Failed to send media' });
    }
  };

  // Получение контактов
  const getContacts: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!telegramProvider) {
        res.status(503).json({ error: 'Telegram provider not initialized' });
        return;
      }

      if (instanceId) {
        instanceMemoryService.markApiKeyUsage(instanceId);
      }

      const query = req.query.query as string;
      const contacts = await telegramProvider.getContacts(query);
      res.json(contacts);
    } catch (error) {
      logger.error('Error getting contacts:', error);
      res.status(500).json({ error: 'Failed to get contacts' });
    }
  };

  // Получение чатов
  const getChats: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
    try {
      if (!telegramProvider) {
        res.status(503).json({ error: 'Telegram provider not initialized' });
        return;
      }

      if (instanceId) {
        instanceMemoryService.markApiKeyUsage(instanceId);
      }

      const chats = await telegramProvider.getChats();
      res.json(chats);
    } catch (error) {
      logger.error('Error getting chats:', error);
      res.status(500).json({ error: 'Failed to get chats' });
    }
  };

  // Получение группы по ID
  const getGroupById: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!telegramProvider) {
        res.status(503).json({ error: 'Telegram provider not initialized' });
        return;
      }

      if (instanceId) {
        instanceMemoryService.markApiKeyUsage(instanceId);
      }

      const { groupId } = req.params;
      const group = await telegramProvider.getGroupById(groupId);

      if (!group) {
        res.status(404).json({ error: 'Group not found' });
        return;
      }

      res.json(group);
    } catch (error) {
      logger.error('Error getting group by ID:', error);
      res.status(500).json({ error: 'Failed to get group' });
    }
  };

  // Запуск polling для приема входящих сообщений
  const startPolling: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
    try {
      if (!telegramProvider) {
        res.status(400).json({ error: 'Telegram provider not initialized' });
        return;
      }

      await (telegramProvider as any).startPolling();
      res.json({
        success: true,
        message: 'Telegram polling started - bot will now receive incoming messages automatically',
        status: 'polling_active',
      });
    } catch (error: any) {
      logger.error('Error starting polling:', error);
      res.status(500).json({ error: error.message || 'Failed to start polling' });
    }
  };

  // Остановка polling
  const stopPolling: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
    try {
      if (!telegramProvider) {
        res.status(400).json({ error: 'Telegram provider not initialized' });
        return;
      }

      await (telegramProvider as any).stopPolling();
      res.json({
        success: true,
        message: 'Telegram polling stopped',
        status: 'polling_inactive',
      });
    } catch (error: any) {
      logger.error('Error stopping polling:', error);
      res.status(500).json({ error: error.message || 'Failed to stop polling' });
    }
  };

  // Получение статуса polling
  const getPollingStatus: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
    try {
      if (!telegramProvider) {
        res.status(400).json({ error: 'Telegram provider not initialized' });
        return;
      }

      const isPolling = (telegramProvider as any).isPollingStarted || false;
      res.json({
        polling_active: isPolling,
        status: isPolling ? 'receiving_messages' : 'polling_inactive',
        message: isPolling
          ? 'Bot is receiving incoming messages'
          : 'Bot is not receiving incoming messages',
      });
    } catch (error: any) {
      logger.error('Error getting polling status:', error);
      res.status(500).json({ error: error.message || 'Failed to get polling status' });
    }
  };

  // Получение последних полученных сообщений
  const getRecentMessages: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!messageStorageService) {
        res.status(400).json({ error: 'Message storage service not available' });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 10;
      const messages = await messageStorageService.getRecentMessages(instanceId || '', limit);

      res.json({
        success: true,
        count: messages.length,
        messages: messages.map((msg: any) => ({
          id: msg.message_id,
          chatId: msg.chat_id,
          from: msg.from_number,
          body: msg.message_body,
          type: msg.message_type,
          timestamp: new Date(msg.timestamp).toISOString(),
          isFromMe: msg.is_from_me,
          isGroup: msg.is_group,
        })),
      });
    } catch (error: any) {
      logger.error('Error getting recent messages:', error);
      res.status(500).json({ error: error.message || 'Failed to get recent messages' });
    }
  };

  // Новые эндпоинты согласно пункту 9 плана разработки

  /**
   * Получение информации об аккаунте Telegram
   */
  const getAccountInfo: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
    try {
      if (instanceId) {
        instanceMemoryService.markApiKeyUsage(instanceId);
      }

      if (!messageStorageService || !instanceId) {
        res.status(500).json({
          success: false,
          error: 'Message storage service or instance ID not available',
        });
        return;
      }

      const pool = createPool();
      const config = getDatabaseConfig();
      const result = await pool.query(
        `SELECT account, provider, created_at, updated_at 
         FROM ${config.schema}.message_instances 
         WHERE id = $1`,
        [instanceId],
      );

      if (result.rows.length > 0) {
        res.json({ success: true, data: result.rows[0] });
      } else {
        res.status(404).json({ success: false, error: 'Instance not found' });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get account info',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  };

  /**
   * Обновление конфигурации webhook
   */
  const updateWebhookConfig: RequestHandler = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      if (instanceId) {
        instanceMemoryService.markApiKeyUsage(instanceId);
      }

      const { url, headers, enabled = true } = req.body;

      if (!url) {
        res.status(400).json({
          success: false,
          error: 'Webhook URL is required',
        });
        return;
      }

      if (!messageStorageService || !instanceId) {
        res.status(500).json({
          success: false,
          error: 'Message storage service or instance ID not available',
        });
        return;
      }

      const webhookConfig = { url, headers: headers || {}, enabled };

      const pool = createPool();
      const config = getDatabaseConfig();
      await pool.query(
        `UPDATE ${config.schema}.message_instances 
         SET api_webhook_schema = $1, updated_at = NOW() 
         WHERE id = $2`,
        [JSON.stringify(webhookConfig), instanceId],
      );

      res.json({
        success: true,
        message: 'Webhook configuration updated',
        data: webhookConfig,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to update webhook config',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  };

  /**
   * Получение конфигурации webhook
   */
  const getWebhookConfig: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
    try {
      if (instanceId) {
        instanceMemoryService.markApiKeyUsage(instanceId);
      }

      if (!messageStorageService || !instanceId) {
        res.status(500).json({
          success: false,
          error: 'Message storage service or instance ID not available',
        });
        return;
      }

      const pool = createPool();
      const config = getDatabaseConfig();
      const result = await pool.query(
        `SELECT api_webhook_schema 
         FROM ${config.schema}.message_instances 
         WHERE id = $1`,
        [instanceId],
      );

      if (result.rows.length > 0) {
        res.json({
          success: true,
          data: result.rows[0].api_webhook_schema || {},
        });
      } else {
        res.status(404).json({ success: false, error: 'Instance not found' });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get webhook config',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  };

  // Регистрируем роуты
  router.get('/health', getHealth);
  router.get('/status', getStatus);
  router.get('/me', getMe);

  // Новые роуты
  router.get('/account-info', getAccountInfo);
  router.post('/webhook/config', updateWebhookConfig);
  router.get('/webhook/config', getWebhookConfig);

  router.get('/contacts', getContacts);
  router.get('/chats', getChats);
  router.post('/send', sendMessage);
  router.post('/send-telegram-message', sendTelegramMessage);
  router.post('/send-media', sendMediaMessage);
  router.get('/group/:groupId', getGroupById);

  // Роуты для управления polling
  router.post('/polling/start', startPolling);
  router.post('/polling/stop', stopPolling);
  router.get('/polling/status', getPollingStatus);

  // Роут для получения последних сообщений
  router.get('/messages/recent', getRecentMessages);

  return router;
}

// Оставляем старый API для обратной совместимости
const router: Router = express.Router();
let telegramProvider: TelegramProvider | null = null;

// Инициализация Telegram провайдера (deprecated, используйте telegramRouterFactory)
export async function initializeTelegramProvider(config: TelegramConfig): Promise<void> {
  try {
    telegramProvider = new TelegramProvider(config);
    await telegramProvider.initialize();
    logger.info('Telegram provider initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Telegram provider:', error);
    throw error;
  }
}

// Deprecated: используйте telegramRouterFactory
router.get('/status', async (_req: Request, res: Response) => {
  if (!telegramProvider) {
    res.status(503).json({ error: 'Telegram provider not initialized' });
    return;
  }
  try {
    const status = await telegramProvider.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get status' });
  }
});

export { router as telegramRouter };
export { telegramProvider };
