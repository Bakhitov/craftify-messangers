import { Router, Request, Response } from 'express';
import { param, query, validationResult } from 'express-validator';
import { MessageStorageService } from '../../../services/message-storage.service';
import { DatabaseService } from '../../services/database.service';
import logger from '../../../logger';
import { RateLimiter, rateLimitConfigs } from '../../middleware/rate-limiter.middleware';
import { Pool } from 'pg';

const companyMessagesRouter = Router();
const databaseService = new DatabaseService();

// Создаем rate limiter для эндпоинтов сообщений
const messagesRateLimit = new RateLimiter({
  windowMs: 60 * 1000, // 1 минута
  maxRequests: 100, // 100 запросов в минуту
});

// Создаем экземпляр MessageStorageService
let messageStorageService: MessageStorageService | null = null;

async function getMessageStorageService(): Promise<MessageStorageService> {
  if (!messageStorageService) {
    // Получаем pool из database service
    const pool = (databaseService as any).pool as Pool;
    messageStorageService = new MessageStorageService(pool);
  }
  return messageStorageService;
}

/**
 * GET /api/v1/company/:companyId/messages
 * Получить все сообщения для всех инстансов компании
 */
companyMessagesRouter.get(
  '/:companyId/messages',
  [
    param('companyId').isString().notEmpty().withMessage('Company ID is required'),
    query('chatId').optional().isString(),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Limit must be between 1 and 1000'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be >= 0'),
    query('isGroup').optional().isBoolean().withMessage('isGroup must be boolean'),
    query('provider')
      .optional()
      .isIn([
        'whatsappweb',
        'telegram',
        'whatsapp-official',
        'facebook-messenger',
        'instagram',
        'slack',
        'discord',
      ])
      .withMessage('Invalid provider'),
  ],
  messagesRateLimit.middleware(),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
        return;
      }

      const companyId = req.params.companyId;
      const chatId = req.query.chatId as string;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const provider = req.query.provider as string;
      const isGroup =
        req.query.isGroup === 'true' ? true : req.query.isGroup === 'false' ? false : undefined;
      const messageStorage = await getMessageStorageService();
      const messages = await messageStorage.getMessagesByCompany(companyId, {
        chatId,
        limit,
        offset,
        isGroup,
        provider,
      });

      res.json({
        success: true,
        data: messages,
        count: messages.length,
        pagination: {
          limit,
          offset,
        },
        filters: {
          company_id: companyId,
          chat_id: chatId,
          is_group: isGroup,
          provider,
        },
      });
    } catch (error: any) {
      logger.error('Failed to get company messages', {
        error: error.message,
        companyId: req.params.companyId,
        query: req.query,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to get company messages',
        details: error.message,
      });
    }
  },
);

/**
 * GET /api/v1/company/:companyId/messages/stats
 * Получить статистику сообщений для компании
 */
companyMessagesRouter.get(
  '/:companyId/messages/stats',
  [param('companyId').isString().notEmpty().withMessage('Company ID is required')],
  messagesRateLimit.middleware(),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
        return;
      }

      const companyId = req.params.companyId;

      const messageStorage = await getMessageStorageService();
      const stats = await messageStorage.getCompanyMessageStats(companyId);

      res.json({
        success: true,
        data: stats,
        company_id: companyId,
      });
    } catch (error: any) {
      logger.error('Failed to get company message stats', {
        error: error.message,
        companyId: req.params.companyId,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to get company message stats',
        details: error.message,
      });
    }
  },
);

/**
 * GET /api/v1/company/:companyId/instances
 * Получить все инстансы компании (дублирует функциональность из instances.ts с фильтром)
 */
companyMessagesRouter.get(
  '/:companyId/instances',
  [
    param('companyId').isString().notEmpty().withMessage('Company ID is required'),
    query('provider')
      .optional()
      .isIn([
        'whatsappweb',
        'telegram',
        'whatsapp-official',
        'facebook-messenger',
        'instagram',
        'slack',
        'discord',
      ]),
    query('status').optional().isString(),
  ],
  messagesRateLimit.middleware(),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
        return;
      }

      const companyId = req.params.companyId;
      const provider = req.query.provider as string;
      const status = req.query.status as string;

      const filters = {
        company_id: companyId,
        provider,
        status,
      };

      // Удаляем undefined значения
      Object.keys(filters).forEach(key => {
        if (filters[key as keyof typeof filters] === undefined) {
          delete filters[key as keyof typeof filters];
        }
      });

      const instances = await databaseService.getAllInstances(filters);

      res.json({
        success: true,
        instances,
        total: instances.length,
        company_id: companyId,
        filters,
      });
    } catch (error: any) {
      logger.error('Failed to get company instances', {
        error: error.message,
        companyId: req.params.companyId,
        query: req.query,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to get company instances',
        details: error.message,
      });
    }
  },
);

/**
 * GET /api/v1/company/:companyId/messages/recent
 * Получить последние сообщения для всех инстансов компании
 */
companyMessagesRouter.get(
  '/:companyId/messages/recent',
  [
    param('companyId').isString().notEmpty().withMessage('Company ID is required'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('provider')
      .optional()
      .isIn([
        'whatsappweb',
        'telegram',
        'whatsapp-official',
        'facebook-messenger',
        'instagram',
        'slack',
        'discord',
      ]),
  ],
  messagesRateLimit.middleware(),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
        return;
      }

      const companyId = req.params.companyId;
      const limit = parseInt(req.query.limit as string) || 20;
      const provider = req.query.provider as string;

      const messageStorage = await getMessageStorageService();
      const messages = await messageStorage.getMessagesByCompany(companyId, {
        limit,
        provider,
      });

      res.json({
        success: true,
        data: messages,
        count: messages.length,
        company_id: companyId,
        limit,
        provider,
      });
    } catch (error: any) {
      logger.error('Failed to get recent company messages', {
        error: error.message,
        companyId: req.params.companyId,
        query: req.query,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to get recent company messages',
        details: error.message,
      });
    }
  },
);

export { companyMessagesRouter };
