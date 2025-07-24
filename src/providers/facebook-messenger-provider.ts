import { EventEmitter } from 'events';
import { FacebookMessengerConfig } from '../types';
import { MessageStorageService, MessageData } from '../services/message-storage.service';
import { WebhookService } from '../services/webhook.service';
import logger from '../logger';
import axios from 'axios';

export interface FacebookMessengerMessage {
  mid: string;
  text?: string;
  attachments?: Array<{
    type: 'image' | 'audio' | 'video' | 'file';
    payload: {
      url: string;
    };
  }>;
  quick_reply?: {
    payload: string;
  };
  sticker_id?: number;
}

export interface FacebookMessengerUser {
  id: string;
  first_name?: string;
  last_name?: string;
  profile_pic?: string;
  locale?: string;
  timezone?: number;
  gender?: string;
}

export class FacebookMessengerProvider extends EventEmitter {
  private config: FacebookMessengerConfig;
  private messageStorageService: MessageStorageService;
  private webhookService: WebhookService;
  private baseUrl: string;
  private headers: any;
  private isInitialized = false;

  constructor(config: FacebookMessengerConfig, messageStorageService: MessageStorageService) {
    super();
    this.config = config;
    this.messageStorageService = messageStorageService;
    this.webhookService = new WebhookService();

    this.baseUrl = `https://graph.facebook.com/${config.version || 'v18.0'}/me`;
    this.headers = {
      Authorization: `Bearer ${config.pageAccessToken}`,
      'Content-Type': 'application/json',
    };

    logger.info(`Facebook Messenger Provider initialized`);
  }

  async initialize(): Promise<void> {
    try {
      // Проверяем соединение с Facebook Graph API
      await this.verifyConnection();

      this.isInitialized = true;
      this.emit('ready');

      logger.info('Facebook Messenger Provider ready');
    } catch (error) {
      logger.error('Failed to initialize Facebook Messenger Provider:', error);
      this.emit('error', error);
      throw error;
    }
  }

  private async verifyConnection(): Promise<void> {
    try {
      const response = await axios.get(`${this.baseUrl}?fields=name,category`, {
        headers: this.headers,
      });

      if (response.status === 200) {
        logger.info('Facebook Messenger API connection verified', {
          pageName: response.data.name,
          category: response.data.category,
        });
      }
    } catch (error: any) {
      logger.error(
        'Facebook Messenger API connection failed:',
        error.response?.data || error.message,
      );
      throw new Error('Failed to connect to Facebook Messenger API');
    }
  }

  async handleWebhook(webhookData: any): Promise<void> {
    try {
      const entry = webhookData.entry?.[0];
      if (!entry) return;

      const messaging = entry.messaging || [];

      for (const messageEvent of messaging) {
        if (messageEvent.message) {
          await this.processIncomingMessage(messageEvent);
        } else if (messageEvent.delivery) {
          await this.processMessageDelivery(messageEvent.delivery);
        } else if (messageEvent.read) {
          await this.processMessageRead(messageEvent.read);
        }
      }
    } catch (error) {
      logger.error('Error processing Facebook Messenger webhook:', error);
    }
  }

  private async processIncomingMessage(messageEvent: any): Promise<void> {
    try {
      const message: FacebookMessengerMessage = messageEvent.message;
      const senderId = messageEvent.sender.id;
      const recipientId = messageEvent.recipient.id;
      const timestamp = messageEvent.timestamp;

      // Получаем информацию о пользователе
      const userInfo = await this.getUserInfo(senderId);

      const messageData: MessageData = {
        instance_id: this.config.instanceId || '',
        message_id: message.mid,
        chat_id: senderId,
        from_number: senderId,
        to_number: recipientId,
        message_body: this.extractMessageText(message),
        message_type: this.getMessageType(message),
        timestamp: timestamp,
        is_from_me: false,
        is_group: false,
        contact_name: this.getUserDisplayName(userInfo),
      };

      // Сохраняем сообщение в БД
      await this.messageStorageService.saveMessage(messageData);

      // Отправляем webhook
      if (this.config.instanceId) {
        const webhookData = {
          instanceId: this.config.instanceId,
          messageId: message.mid,
          chatId: senderId,
          from: senderId,
          body: messageData.message_body || '',
          timestamp: timestamp,
          provider: 'facebook-messenger' as const,
          messageType: messageData.message_type || 'text',
          isGroup: false,
          contactName: messageData.contact_name,
        };

        await this.webhookService.sendToWebhook(webhookData);
      }

      this.emit('message', {
        messageId: message.mid,
        from: senderId,
        body: messageData.message_body || '',
        type: messageData.message_type,
        timestamp: new Date(timestamp),
      });

      logger.info(`Processed Facebook Messenger message: ${message.mid} from ${senderId}`);
    } catch (error) {
      logger.error('Error processing incoming Facebook Messenger message:', error);
    }
  }

  private extractMessageText(message: FacebookMessengerMessage): string {
    if (message.text) {
      return message.text;
    }

    if (message.attachments && message.attachments.length > 0) {
      const attachment = message.attachments[0];
      return `[${attachment.type.toUpperCase()}]`;
    }

    if (message.sticker_id) {
      return '[STICKER]';
    }

    if (message.quick_reply) {
      return `[QUICK_REPLY: ${message.quick_reply.payload}]`;
    }

    return '[MESSAGE]';
  }

  private getMessageType(message: FacebookMessengerMessage): string {
    if (message.text) return 'text';
    if (message.attachments && message.attachments.length > 0) {
      return message.attachments[0].type;
    }
    if (message.sticker_id) return 'sticker';
    if (message.quick_reply) return 'quick_reply';
    return 'unknown';
  }

  private async getUserInfo(userId: string): Promise<FacebookMessengerUser | null> {
    try {
      const response = await axios.get(
        `https://graph.facebook.com/${this.config.version || 'v18.0'}/${userId}?fields=first_name,last_name,profile_pic,locale,timezone,gender`,
        { headers: this.headers },
      );

      return response.data;
    } catch (error) {
      logger.error('Error getting Facebook user info:', error);
      return null;
    }
  }

  private getUserDisplayName(userInfo: FacebookMessengerUser | null): string {
    if (!userInfo) return 'Unknown User';

    const firstName = userInfo.first_name || '';
    const lastName = userInfo.last_name || '';

    return `${firstName} ${lastName}`.trim() || userInfo.id;
  }

  private async processMessageDelivery(delivery: any): Promise<void> {
    try {
      logger.debug('Message delivery confirmation:', delivery);
    } catch (error) {
      logger.error('Error processing message delivery:', error);
    }
  }

  private async processMessageRead(read: any): Promise<void> {
    try {
      logger.debug('Message read confirmation:', read);
    } catch (error) {
      logger.error('Error processing message read:', error);
    }
  }

  async sendMessage(userId: string, message: string): Promise<{ messageId: string }> {
    try {
      if (!this.isInitialized) {
        throw new Error('Facebook Messenger Provider not initialized');
      }

      const payload = {
        recipient: { id: userId },
        message: { text: message },
      };

      const response = await axios.post(`${this.baseUrl}/messages`, payload, {
        headers: this.headers,
      });

      const messageId = response.data.message_id;

      // Получаем agent_id из конфигурации Agno для API сообщений
      let agentId: string | undefined;
      try {
        if (this.config.instanceId) {
          const agnoIntegrationService = new (
            await import('../services/agno-integration.service')
          ).AgnoIntegrationService((await import('../config/database.config')).createPool());
          const agnoConfig = await agnoIntegrationService.getAgnoConfig(this.config.instanceId);
          agentId = agnoConfig?.agent_id;
        }
      } catch (error) {
        // Игнорируем ошибки получения agent_id
      }

      // Сохраняем исходящее сообщение в БД
      const messageData: MessageData = {
        instance_id: this.config.instanceId || '',
        message_id: messageId,
        chat_id: userId,
        from_number: 'page', // Отправитель - страница
        to_number: userId,
        message_body: message,
        message_type: 'text',
        timestamp: Date.now(),
        is_from_me: true,
        is_group: false,
        contact_name: userId,
        agent_id: agentId, // ✅ Теперь передается agent_id для API сообщений
        message_source: 'api', // Указываем источник как API
      };

      await this.messageStorageService.saveMessage(messageData);

      logger.info(`Facebook Messenger message sent: ${messageId} to ${userId}`);

      return { messageId };
    } catch (error: any) {
      logger.error(
        'Error sending Facebook Messenger message:',
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  async sendImageMessage(
    userId: string,
    imageUrl: string,
    caption?: string,
  ): Promise<{ messageId: string }> {
    try {
      if (!this.isInitialized) {
        throw new Error('Facebook Messenger Provider not initialized');
      }

      const payload = {
        recipient: { id: userId },
        message: {
          attachment: {
            type: 'image',
            payload: {
              url: imageUrl,
              is_reusable: true,
            },
          },
        },
      };

      const response = await axios.post(`${this.baseUrl}/messages`, payload, {
        headers: this.headers,
      });

      const messageId = response.data.message_id;

      // Если есть подпись, отправляем отдельным сообщением
      if (caption) {
        await this.sendMessage(userId, caption);
      }

      // Сохраняем исходящее сообщение в БД
      const messageData: MessageData = {
        instance_id: this.config.instanceId || '',
        message_id: messageId,
        chat_id: userId,
        from_number: 'page',
        to_number: userId,
        message_body: caption || '[IMAGE]',
        message_type: 'image',
        timestamp: Date.now(),
        is_from_me: true,
        is_group: false,
        contact_name: userId,
      };

      await this.messageStorageService.saveMessage(messageData);

      logger.info(`Facebook Messenger image sent: ${messageId} to ${userId}`);

      return { messageId };
    } catch (error: any) {
      logger.error(
        'Error sending Facebook Messenger image:',
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  async getStatus(): Promise<any> {
    try {
      if (!this.isInitialized) {
        return {
          provider: 'facebook-messenger',
          status: 'disconnected',
          state: 'DISCONNECTED',
        };
      }

      // Проверяем статус через API
      const response = await axios.get(`${this.baseUrl}?fields=name,category`, {
        headers: this.headers,
      });

      return {
        provider: 'facebook-messenger',
        status: 'ready',
        state: 'READY',
        info: {
          pageName: response.data.name,
          category: response.data.category,
        },
      };
    } catch (error) {
      logger.error('Error getting Facebook Messenger status:', error);
      return {
        provider: 'facebook-messenger',
        status: 'error',
        state: 'ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getContacts(): Promise<any[]> {
    // Facebook Messenger API не предоставляет список контактов
    return [];
  }

  async getChats(): Promise<any[]> {
    // Facebook Messenger API не предоставляет список чатов
    return [];
  }

  async destroy(): Promise<void> {
    try {
      this.isInitialized = false;
      this.removeAllListeners();
      logger.info('Facebook Messenger Provider destroyed');
    } catch (error) {
      logger.error('Error destroying Facebook Messenger Provider:', error);
    }
  }
}
