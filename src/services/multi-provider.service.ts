import { Express, Request, Response, RequestHandler } from 'express';
import { EventEmitter } from 'events';
import { createPool } from '../config/database.config';
import { MessageStorageService } from './message-storage.service';
import {
  ProviderConfig,
  MessengerProvider,
  TelegramConfig,
  WhatsAppOfficialConfig,
  FacebookMessengerConfig,
  InstagramConfig,
  SlackConfig,
  DiscordConfig,
} from '../types';
import { TelegramProvider } from '../providers/telegram-provider';
import { WhatsAppOfficialProvider } from '../providers/whatsapp-official-provider';
import { FacebookMessengerProvider } from '../providers/facebook-messenger-provider';
import { InstagramProvider } from '../providers/instagram-provider';
import { SlackProvider } from '../providers/slack-provider';
import { DiscordProvider } from '../providers/discord-provider';
import logger from '../logger';
import { ProviderDatabaseService } from './provider-database.service';

export interface ProviderInstance {
  id: string;
  provider: MessengerProvider;
  config: ProviderConfig;
  instance: any;
  status: 'initializing' | 'ready' | 'error' | 'stopped';
  createdAt: Date;
  lastActivity: Date;
}

export class MultiProviderService extends EventEmitter {
  private app: Express;
  private providers: Map<string, any> = new Map();
  private messageStorageService: MessageStorageService;
  private providerDatabaseService: ProviderDatabaseService;

  constructor(
    app: Express,
    messageStorageService: MessageStorageService,
    providerDatabaseService: ProviderDatabaseService,
  ) {
    super();
    this.app = app;
    this.messageStorageService = messageStorageService;
    this.providerDatabaseService = providerDatabaseService;

    this.setupWebhookRoutes();
    logger.info('MultiProviderService initialized');
  }

  private setupWebhookRoutes(): void {
    // Telegram webhook
    this.app.post('/api/v1/webhook/telegram/:instanceId', async (req: Request, res: Response) => {
      try {
        const instanceId = req.params.instanceId;
        const provider = this.providers.get(instanceId);

        if (!provider || provider.constructor.name !== 'TelegramProvider') {
          return res.status(404).json({ error: 'Telegram provider not found' });
        }

        await provider.handleWebhook(req.body);
        return res.status(200).json({ success: true });
      } catch (error) {
        logger.error('Telegram webhook error:', error);
        return res.status(500).json({ error: 'Internal server error' });
      }
    });

    // WhatsApp Official webhook
    this.app.post(
      '/api/v1/webhook/whatsapp-official/:instanceId',
      async (req: Request, res: Response) => {
        try {
          const instanceId = req.params.instanceId;
          const provider = this.providers.get(instanceId);

          if (!provider || provider.constructor.name !== 'WhatsAppOfficialProvider') {
            return res.status(404).json({ error: 'WhatsApp Official provider not found' });
          }

          await provider.handleWebhook(req.body);
          return res.status(200).json({ success: true });
        } catch (error) {
          logger.error('WhatsApp Official webhook error:', error);
          return res.status(500).json({ error: 'Internal server error' });
        }
      },
    );

    // WhatsApp Official webhook verification
    this.app.get('/api/v1/webhook/whatsapp-official/:instanceId', (req: Request, res: Response) => {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      // Здесь нужно проверить токен из конфигурации провайдера
      if (mode === 'subscribe' && token) {
        logger.info('WhatsApp Official webhook verified');
        res.status(200).send(challenge);
      } else {
        res.status(403).json({ error: 'Forbidden' });
      }
    });

    // Facebook Messenger webhook
    this.app.post(
      '/api/v1/webhook/facebook-messenger/:instanceId',
      async (req: Request, res: Response) => {
        try {
          const instanceId = req.params.instanceId;
          const provider = this.providers.get(instanceId);

          if (!provider || provider.constructor.name !== 'FacebookMessengerProvider') {
            return res.status(404).json({ error: 'Facebook Messenger provider not found' });
          }

          await provider.handleWebhook(req.body);
          return res.status(200).json({ success: true });
        } catch (error) {
          logger.error('Facebook Messenger webhook error:', error);
          return res.status(500).json({ error: 'Internal server error' });
        }
      },
    );

    // Instagram webhook
    this.app.post('/api/v1/webhook/instagram/:instanceId', async (req: Request, res: Response) => {
      try {
        const instanceId = req.params.instanceId;
        const provider = this.providers.get(instanceId);

        if (!provider || provider.constructor.name !== 'InstagramProvider') {
          return res.status(404).json({ error: 'Instagram provider not found' });
        }

        await provider.handleWebhook(req.body);
        return res.status(200).json({ success: true });
      } catch (error) {
        logger.error('Instagram webhook error:', error);
        return res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Slack webhook
    this.app.post('/api/v1/webhook/slack/:instanceId', async (req: Request, res: Response) => {
      try {
        const instanceId = req.params.instanceId;
        const provider = this.providers.get(instanceId);

        if (!provider || provider.constructor.name !== 'SlackProvider') {
          return res.status(404).json({ error: 'Slack provider not found' });
        }

        const result = await provider.handleWebhook(req.body);

        // Slack может требовать возврат challenge для верификации
        if (result) {
          return res.status(200).send(result);
        } else {
          return res.status(200).json({ success: true });
        }
      } catch (error) {
        logger.error('Slack webhook error:', error);
        return res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Discord webhook (не используется, Discord использует WebSocket)
    this.app.post('/api/v1/webhook/discord/:instanceId', async (_req: Request, res: Response) => {
      res.status(404).json({ error: 'Discord uses WebSocket connection, not webhooks' });
    });
  }

  async createInstance(config: ProviderConfig): Promise<string> {
    try {
      const instanceId = this.generateInstanceId(config.provider);

      // Сохраняем конфигурацию в БД
      await this.providerDatabaseService.createInstance({
        id: instanceId,
        provider: config.provider,
        auth_status: 'creating',
        created_at: new Date(),
        updated_at: new Date(),
        ...this.mapConfigToInstanceData(config),
      });

      // Создаем провайдер
      const provider = await this.createProvider(config, instanceId);

      if (provider) {
        this.providers.set(instanceId, provider);

        // Инициализируем провайдер
        await provider.initialize();

        // Обновляем статус в БД
        await this.providerDatabaseService.updateInstance(instanceId, config.provider, {
          auth_status: 'ready',
        });

        logger.info(`Created ${config.provider} instance: ${instanceId}`);

        this.emit('instanceCreated', {
          instanceId,
          provider: config.provider,
          status: 'ready',
        });

        return instanceId;
      } else {
        throw new Error(`Failed to create provider for ${config.provider}`);
      }
    } catch (error) {
      logger.error('Error creating instance:', error);
      throw error;
    }
  }

  private mapConfigToInstanceData(_config: ProviderConfig): any {
    // Базовые поля, общие для всех провайдеров
    const baseData = {
      // Удаляю старые поля Agno - теперь всё в agno_config
      // agno_enable: true,
      stream: false,
    };

    // Возвращаем базовые данные, специфичные поля будут добавлены в провайдере
    return baseData;
  }

  private async createProvider(config: ProviderConfig, instanceId: string): Promise<any> {
    const configWithInstanceId = { ...config, instanceId };

    switch (config.provider) {
      case 'telegram':
        return new TelegramProvider(configWithInstanceId as any, this.messageStorageService);

      case 'whatsapp-official':
        return new WhatsAppOfficialProvider(configWithInstanceId as any, this.messageStorageService);

      case 'facebook-messenger':
        return new FacebookMessengerProvider(configWithInstanceId as any, this.messageStorageService);

      case 'instagram':
        return new InstagramProvider(configWithInstanceId as any, this.messageStorageService);

      case 'slack':
        return new SlackProvider(configWithInstanceId as any, this.messageStorageService);

      case 'discord':
        return new DiscordProvider(configWithInstanceId as any, this.messageStorageService);

      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }

  async deleteInstance(provider: MessengerProvider, instanceId: string): Promise<void> {
    try {
      const providerInstance = this.providers.get(instanceId);

      if (providerInstance) {
        await providerInstance.destroy();
        this.providers.delete(instanceId);
      }

      // Удаляем из БД
      await this.providerDatabaseService.deleteInstance(instanceId);

      logger.info(`Deleted ${provider} instance: ${instanceId}`);

      this.emit('instanceDeleted', {
        instanceId,
        provider,
      });
    } catch (error) {
      logger.error('Error deleting instance:', error);
      throw error;
    }
  }

  async getInstanceStatus(provider: MessengerProvider, instanceId: string): Promise<any> {
    try {
      const providerInstance = this.providers.get(instanceId);

      if (!providerInstance) {
        return {
          provider,
          status: 'not_found',
          state: 'NOT_FOUND',
        };
      }

      return await providerInstance.getStatus();
    } catch (error) {
      logger.error('Error getting instance status:', error);
      return {
        provider,
        status: 'error',
        state: 'ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async sendMessage(
    _provider: MessengerProvider,
    instanceId: string,
    to: string,
    message: string,
  ): Promise<{ messageId: string }> {
    try {
      const providerInstance = this.providers.get(instanceId);

      if (!providerInstance) {
        throw new Error('Provider instance not found');
      }

      return await providerInstance.sendMessage(to, message);
    } catch (error) {
      logger.error('Error sending message:', error);
      throw error;
    }
  }

  async sendMediaMessage(
    _provider: MessengerProvider,
    instanceId: string,
    to: string,
    mediaUrl: string,
    caption?: string,
  ): Promise<{ messageId: string }> {
    try {
      const providerInstance = this.providers.get(instanceId);

      if (!providerInstance) {
        throw new Error('Provider instance not found');
      }

      // Вызываем соответствующий метод в зависимости от провайдера
      if (providerInstance.sendMediaMessage) {
        return await providerInstance.sendMediaMessage(to, mediaUrl, caption);
      } else if (providerInstance.sendImageMessage) {
        return await providerInstance.sendImageMessage(to, mediaUrl, caption);
      } else if (providerInstance.sendFileMessage) {
        return await providerInstance.sendFileMessage(to, mediaUrl, undefined, undefined, caption);
      } else {
        throw new Error('Media message not supported by this provider');
      }
    } catch (error) {
      logger.error('Error sending media message:', error);
      throw error;
    }
  }

  async getContacts(_provider: MessengerProvider, instanceId: string): Promise<any[]> {
    try {
      const providerInstance = this.providers.get(instanceId);

      if (!providerInstance) {
        return [];
      }

      return await providerInstance.getContacts();
    } catch (error) {
      logger.error('Error getting contacts:', error);
      return [];
    }
  }

  async getChats(_provider: MessengerProvider, instanceId: string): Promise<any[]> {
    try {
      const providerInstance = this.providers.get(instanceId);

      if (!providerInstance) {
        return [];
      }

      return await providerInstance.getChats();
    } catch (error) {
      logger.error('Error getting chats:', error);
      return [];
    }
  }

  async listInstances(provider?: MessengerProvider): Promise<any[]> {
    try {
      if (provider) {
        return await this.providerDatabaseService.getInstancesByProvider(provider);
      } else {
        // Возвращаем все экземпляры из памяти
        const instances = [];
        for (const [instanceId, providerInstance] of this.providers.entries()) {
          instances.push({
            instance_id: instanceId,
            provider_type: providerInstance.constructor.name.replace('Provider', '').toLowerCase(),
            status: 'ready'
          });
        }
        return instances;
      }
    } catch (error) {
      logger.error('Error listing instances:', error);
      return [];
    }
  }

  private generateInstanceId(provider: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `${provider}_${timestamp}_${random}`;
  }

  async loadExistingInstances(): Promise<void> {
    try {
      const instances = await this.listInstances();

      for (const instance of instances) {
        try {
          const config = instance.config_data;
          const provider = await this.createProvider(config, instance.instance_id);

          if (provider) {
            this.providers.set(instance.instance_id, provider);
            await provider.initialize();

            await this.providerDatabaseService.updateInstance(instance.instance_id, instance.provider_type, {
              auth_status: 'ready',
            });

            logger.info(
              `Loaded existing ${instance.provider_type} instance: ${instance.instance_id}`,
            );
          }
        } catch (error) {
          logger.error(`Failed to load instance ${instance.instance_id}:`, error);

          await this.providerDatabaseService.updateInstance(instance.instance_id, instance.provider_type, {
            auth_status: 'error',
          });
        }
      }

      logger.info(`Loaded ${this.providers.size} provider instances`);
    } catch (error) {
      logger.error('Error loading existing instances:', error);
    }
  }

  getActiveProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  getProviderStats(): any {
    const stats: any = {};

    for (const [instanceId, provider] of this.providers.entries()) {
      const providerType = provider.constructor.name.replace('Provider', '');

      if (!stats[providerType]) {
        stats[providerType] = {
          count: 0,
          instances: [],
        };
      }

      stats[providerType].count++;
      stats[providerType].instances.push(instanceId);
    }

    return stats;
  }

  async destroy(): Promise<void> {
    try {
      for (const [instanceId, provider] of this.providers.entries()) {
        try {
          await provider.destroy();
        } catch (error) {
          logger.error(`Error destroying provider ${instanceId}:`, error);
        }
      }

      this.providers.clear();
      this.removeAllListeners();

      logger.info('MultiProviderService destroyed');
    } catch (error) {
      logger.error('Error destroying MultiProviderService:', error);
    }
  }
}

// Не экспортируем singleton, так как требуются параметры конструктора
// export const multiProviderService = new MultiProviderService();
