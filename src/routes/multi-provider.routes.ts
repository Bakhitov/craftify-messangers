import { Router, Request, Response } from 'express';
import { MultiProviderService } from '../services/multi-provider.service';
import { ProviderConfig, MessengerProvider } from '../types';
import logger from '../logger';
import { body, param, query, validationResult } from 'express-validator';

export class MultiProviderRoutes {
  private router: Router;
  private multiProviderService: MultiProviderService;

  constructor(multiProviderService: MultiProviderService) {
    this.router = Router();
    this.multiProviderService = multiProviderService;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Создание инстанса провайдера
    this.router.post(
      '/instances',
      [
        body('provider').isIn([
          'telegram',
          'whatsapp-official',
          'facebook-messenger',
          'instagram',
          'slack',
          'discord',
        ]),
        body('config').isObject(),
      ],
      this.createInstance.bind(this),
    );

    // Удаление инстанса провайдера
    this.router.delete(
      '/instances/:provider/:instanceId',
      [
        param('provider').isIn([
          'telegram',
          'whatsapp-official',
          'facebook-messenger',
          'instagram',
          'slack',
          'discord',
        ]),
        param('instanceId').isString(),
      ],
      this.deleteInstance.bind(this),
    );

    // Получение статуса инстанса
    this.router.get(
      '/instances/:provider/:instanceId/status',
      [
        param('provider').isIn([
          'telegram',
          'whatsapp-official',
          'facebook-messenger',
          'instagram',
          'slack',
          'discord',
        ]),
        param('instanceId').isString(),
      ],
      this.getInstanceStatus.bind(this),
    );

    // Список всех инстансов
    this.router.get(
      '/instances',
      [
        query('provider')
          .optional()
          .isIn([
            'telegram',
            'whatsapp-official',
            'facebook-messenger',
            'instagram',
            'slack',
            'discord',
          ]),
      ],
      this.listInstances.bind(this),
    );

    // Отправка сообщения
    this.router.post(
      '/instances/:provider/:instanceId/send-message',
      [
        param('provider').isIn([
          'telegram',
          'whatsapp-official',
          'facebook-messenger',
          'instagram',
          'slack',
          'discord',
        ]),
        param('instanceId').isString(),
        body('to').isString(),
        body('message').isString(),
      ],
      this.sendMessage.bind(this),
    );

    // Отправка медиа сообщения
    this.router.post(
      '/instances/:provider/:instanceId/send-media',
      [
        param('provider').isIn([
          'telegram',
          'whatsapp-official',
          'facebook-messenger',
          'instagram',
          'slack',
          'discord',
        ]),
        param('instanceId').isString(),
        body('to').isString(),
        body('mediaUrl').isURL(),
        body('caption').optional().isString(),
      ],
      this.sendMediaMessage.bind(this),
    );

    // Получение контактов
    this.router.get(
      '/instances/:provider/:instanceId/contacts',
      [
        param('provider').isIn([
          'telegram',
          'whatsapp-official',
          'facebook-messenger',
          'instagram',
          'slack',
          'discord',
        ]),
        param('instanceId').isString(),
      ],
      this.getContacts.bind(this),
    );

    // Получение чатов
    this.router.get(
      '/instances/:provider/:instanceId/chats',
      [
        param('provider').isIn([
          'telegram',
          'whatsapp-official',
          'facebook-messenger',
          'instagram',
          'slack',
          'discord',
        ]),
        param('instanceId').isString(),
      ],
      this.getChats.bind(this),
    );

    // Статистика провайдеров
    this.router.get('/stats', this.getStats.bind(this));

    // Список активных провайдеров
    this.router.get('/active-providers', this.getActiveProviders.bind(this));
  }

  private async createInstance(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Validation failed', details: errors.array() });
        return;
      }

      const { provider, config }: { provider: MessengerProvider; config: any } = req.body;

      // Добавляем провайдер к конфигурации
      const providerConfig: ProviderConfig = {
        ...config,
        provider,
      };

      const instanceId = await this.multiProviderService.createInstance(providerConfig);

      logger.info(`Created ${provider} instance: ${instanceId}`);

      res.status(201).json({
        instanceId,
        provider,
        status: 'created',
      });
    } catch (error) {
      logger.error('Error creating instance:', error);
      res.status(500).json({
        error: 'Failed to create instance',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async deleteInstance(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Validation failed', details: errors.array() });
        return;
      }

      const { provider, instanceId } = req.params;

      await this.multiProviderService.deleteInstance(provider as MessengerProvider, instanceId);

      logger.info(`Deleted ${provider} instance: ${instanceId}`);

      res.status(200).json({
        instanceId,
        provider,
        status: 'deleted',
      });
    } catch (error) {
      logger.error('Error deleting instance:', error);
      res.status(500).json({
        error: 'Failed to delete instance',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async getInstanceStatus(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Validation failed', details: errors.array() });
        return;
      }

      const { provider, instanceId } = req.params;

      const status = await this.multiProviderService.getInstanceStatus(
        provider as MessengerProvider,
        instanceId,
      );

      res.status(200).json(status);
    } catch (error) {
      logger.error('Error getting instance status:', error);
      res.status(500).json({
        error: 'Failed to get instance status',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async listInstances(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Validation failed', details: errors.array() });
        return;
      }

      const { provider } = req.query;

      const instances = await this.multiProviderService.listInstances(
        provider as MessengerProvider,
      );

      res.status(200).json({
        instances,
        total: instances.length,
      });
    } catch (error) {
      logger.error('Error listing instances:', error);
      res.status(500).json({
        error: 'Failed to list instances',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Validation failed', details: errors.array() });
        return;
      }

      const { provider, instanceId } = req.params;
      const { to, message } = req.body;

      const result = await this.multiProviderService.sendMessage(
        provider as MessengerProvider,
        instanceId,
        to,
        message,
      );

      res.status(200).json({
        success: true,
        messageId: result.messageId,
        to,
        provider,
      });
    } catch (error) {
      logger.error('Error sending message:', error);
      res.status(500).json({
        error: 'Failed to send message',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async sendMediaMessage(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Validation failed', details: errors.array() });
        return;
      }

      const { provider, instanceId } = req.params;
      const { to, mediaUrl, caption } = req.body;

      const result = await this.multiProviderService.sendMediaMessage(
        provider as MessengerProvider,
        instanceId,
        to,
        mediaUrl,
        caption,
      );

      res.status(200).json({
        success: true,
        messageId: result.messageId,
        to,
        mediaUrl,
        caption,
        provider,
      });
    } catch (error) {
      logger.error('Error sending media message:', error);
      res.status(500).json({
        error: 'Failed to send media message',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async getContacts(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Validation failed', details: errors.array() });
        return;
      }

      const { provider, instanceId } = req.params;

      const contacts = await this.multiProviderService.getContacts(
        provider as MessengerProvider,
        instanceId,
      );

      res.status(200).json({
        contacts,
        total: contacts.length,
        provider,
      });
    } catch (error) {
      logger.error('Error getting contacts:', error);
      res.status(500).json({
        error: 'Failed to get contacts',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async getChats(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Validation failed', details: errors.array() });
        return;
      }

      const { provider, instanceId } = req.params;

      const chats = await this.multiProviderService.getChats(
        provider as MessengerProvider,
        instanceId,
      );

      res.status(200).json({
        chats,
        total: chats.length,
        provider,
      });
    } catch (error) {
      logger.error('Error getting chats:', error);
      res.status(500).json({
        error: 'Failed to get chats',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async getStats(_req: Request, res: Response): Promise<void> {
    try {
      const stats = this.multiProviderService.getProviderStats();

      res.status(200).json({
        stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error getting stats:', error);
      res.status(500).json({
        error: 'Failed to get stats',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async getActiveProviders(_req: Request, res: Response): Promise<void> {
    try {
      const activeProviders = this.multiProviderService.getActiveProviders();

      res.status(200).json({
        activeProviders,
        total: activeProviders.length,
      });
    } catch (error) {
      logger.error('Error getting active providers:', error);
      res.status(500).json({
        error: 'Failed to get active providers',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  getRouter(): Router {
    return this.router;
  }
}

export default MultiProviderRoutes;
