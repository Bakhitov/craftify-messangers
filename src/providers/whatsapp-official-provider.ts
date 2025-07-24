import { EventEmitter } from 'events';
import { WhatsAppOfficialConfig } from '../types';
import { MessageStorageService, MessageData } from '../services/message-storage.service';
import { WebhookService } from '../services/webhook.service';
import logger from '../logger';
import axios from 'axios';

export interface WhatsAppOfficialMessage {
  id: string;
  from: string;
  to: string;
  timestamp: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'document';
  text?: {
    body: string;
  };
  image?: {
    id: string;
    mime_type: string;
    sha256: string;
  };
  audio?: {
    id: string;
    mime_type: string;
  };
  video?: {
    id: string;
    mime_type: string;
  };
  document?: {
    id: string;
    filename: string;
    mime_type: string;
  };
}

export interface WhatsAppOfficialContact {
  wa_id: string;
  profile: {
    name: string;
  };
}

export class WhatsAppOfficialProvider extends EventEmitter {
  private config: WhatsAppOfficialConfig;
  private messageStorageService: MessageStorageService;
  private webhookService: WebhookService;
  private baseUrl: string;
  private headers: any;
  private isInitialized = false;

  constructor(config: WhatsAppOfficialConfig, messageStorageService: MessageStorageService) {
    super();
    this.config = config;
    this.messageStorageService = messageStorageService;
    this.webhookService = new WebhookService();

    this.baseUrl = `https://graph.facebook.com/${config.version || 'v18.0'}/${config.phoneNumberId}`;
    this.headers = {
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
    };

    logger.info(`WhatsApp Official Provider initialized for phone: ${config.phoneNumberId}`);
  }

  async initialize(): Promise<void> {
    try {
      // Проверяем соединение с WhatsApp Business API
      await this.verifyConnection();

      this.isInitialized = true;
      this.emit('ready');

      logger.info(`WhatsApp Official Provider ready for phone: ${this.config.phoneNumberId}`);
    } catch (error) {
      logger.error('Failed to initialize WhatsApp Official Provider:', error);
      this.emit('error', error);
      throw error;
    }
  }

  private async verifyConnection(): Promise<void> {
    try {
      const response = await axios.get(`${this.baseUrl}`, {
        headers: this.headers,
      });

      if (response.status === 200) {
        logger.info('WhatsApp Official API connection verified');
      }
    } catch (error: any) {
      logger.error(
        'WhatsApp Official API connection failed:',
        error.response?.data || error.message,
      );
      throw new Error('Failed to connect to WhatsApp Official API');
    }
  }

  async handleWebhook(webhookData: any): Promise<void> {
    try {
      const entry = webhookData.entry?.[0];
      if (!entry) return;

      const changes = entry.changes || [];

      for (const change of changes) {
        if (change.field === 'messages') {
          const value = change.value;

          // Обрабатываем входящие сообщения
          if (value.messages) {
            for (const message of value.messages) {
              await this.processIncomingMessage(message, value.contacts?.[0]);
            }
          }

          // Обрабатываем статусы сообщений
          if (value.statuses) {
            for (const status of value.statuses) {
              await this.processMessageStatus(status);
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error processing WhatsApp Official webhook:', error);
    }
  }

  private async processIncomingMessage(
    message: WhatsAppOfficialMessage,
    contact?: WhatsAppOfficialContact,
  ): Promise<void> {
    try {
      const messageData: MessageData = {
        instance_id: this.config.instanceId || '',
        message_id: message.id,
        chat_id: message.from,
        from_number: message.from,
        to_number: message.to,
        message_body: this.extractMessageText(message),
        message_type: message.type,
        timestamp: parseInt(message.timestamp) * 1000,
        is_from_me: false,
        is_group: false,
        contact_name: contact?.profile?.name || message.from,
      };

      // Сохраняем сообщение в БД
      await this.messageStorageService.saveMessage(messageData);

      // Отправляем webhook
      if (this.config.instanceId) {
        const webhookData = {
          instanceId: this.config.instanceId,
          messageId: message.id,
          chatId: message.from,
          from: message.from,
          body: messageData.message_body || '',
          timestamp: messageData.timestamp,
          provider: 'whatsapp-official' as const,
          messageType: message.type,
          isGroup: false,
          contact: contact?.profile?.name || message.from,
        };

        await this.webhookService.sendToWebhook(webhookData);
      }

      this.emit('message', {
        messageId: message.id,
        from: message.from,
        body: messageData.message_body || '',
        type: message.type,
        timestamp: new Date(messageData.timestamp),
      });

      logger.info(`Processed WhatsApp Official message: ${message.id} from ${message.from}`);
    } catch (error) {
      logger.error('Error processing incoming WhatsApp Official message:', error);
    }
  }

  private extractMessageText(message: WhatsAppOfficialMessage): string {
    switch (message.type) {
      case 'text':
        return message.text?.body || '';
      case 'image':
        return '[Image]';
      case 'audio':
        return '[Audio]';
      case 'video':
        return '[Video]';
      case 'document':
        return `[Document: ${message.document?.filename || 'file'}]`;
      default:
        return `[${message.type}]`;
    }
  }

  private async processMessageStatus(status: any): Promise<void> {
    try {
      logger.info(`Message status update: ${status.id} -> ${status.status}`);

      // Можно обновить статус сообщения в БД
      if (status.status === 'delivered' || status.status === 'read') {
        // Обновляем статус в message_storage если нужно
      }
    } catch (error) {
      logger.error('Error processing message status:', error);
    }
  }

  async sendMessage(to: string, message: string): Promise<{ messageId: string }> {
    try {
      if (!this.isInitialized) {
        throw new Error('WhatsApp Official Provider not initialized');
      }

      const payload = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: {
          body: message,
        },
      };

      const response = await axios.post(`${this.baseUrl}/messages`, payload, {
        headers: this.headers,
      });

      const messageId = response.data.messages[0].id;

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
        chat_id: to,
        from_number: this.config.phoneNumberId,
        to_number: to,
        message_body: message,
        message_type: 'text',
        timestamp: Date.now(),
        is_from_me: true,
        is_group: false,
        contact_name: to,
        agent_id: agentId, // ✅ Теперь передается agent_id для API сообщений
        message_source: 'api', // Указываем источник как API
      };

      await this.messageStorageService.saveMessage(messageData);

      logger.info(`WhatsApp Official message sent: ${messageId} to ${to}`);

      return { messageId };
    } catch (error: any) {
      logger.error(
        'Error sending WhatsApp Official message:',
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  async sendMediaMessage(
    to: string,
    mediaUrl: string,
    caption?: string,
    mediaType: 'image' | 'audio' | 'video' | 'document' = 'image',
  ): Promise<{ messageId: string }> {
    try {
      if (!this.isInitialized) {
        throw new Error('WhatsApp Official Provider not initialized');
      }

      // Сначала загружаем медиа
      const mediaId = await this.uploadMedia(mediaUrl, mediaType);

      const payload: any = {
        messaging_product: 'whatsapp',
        to: to,
        type: mediaType,
      };

      payload[mediaType] = {
        id: mediaId,
      };

      if (caption && (mediaType === 'image' || mediaType === 'video' || mediaType === 'document')) {
        payload[mediaType].caption = caption;
      }

      const response = await axios.post(`${this.baseUrl}/messages`, payload, {
        headers: this.headers,
      });

      const messageId = response.data.messages[0].id;

      // Сохраняем исходящее сообщение в БД
      const messageData: MessageData = {
        instance_id: this.config.instanceId || '',
        message_id: messageId,
        chat_id: to,
        from_number: this.config.phoneNumberId,
        to_number: to,
        message_body: caption || `[${mediaType.toUpperCase()}]`,
        message_type: mediaType,
        timestamp: Date.now(),
        is_from_me: true,
        is_group: false,
        contact_name: to,
      };

      await this.messageStorageService.saveMessage(messageData);

      logger.info(`WhatsApp Official media message sent: ${messageId} to ${to}`);

      return { messageId };
    } catch (error: any) {
      logger.error(
        'Error sending WhatsApp Official media message:',
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  private async uploadMedia(mediaUrl: string, mediaType: string): Promise<string> {
    try {
      // Скачиваем медиа файл
      const mediaResponse = await axios.get(mediaUrl, { responseType: 'stream' });

      // Создаем FormData для загрузки
      const FormData = require('form-data');
      const formData = new FormData();
      formData.append('file', mediaResponse.data);
      formData.append('messaging_product', 'whatsapp');
      formData.append('type', mediaType);

      const uploadUrl = `https://graph.facebook.com/${this.config.version || 'v18.0'}/${this.config.phoneNumberId}/media`;

      const response = await axios.post(uploadUrl, formData, {
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          ...formData.getHeaders(),
        },
      });

      return response.data.id;
    } catch (error: any) {
      logger.error(
        'Error uploading media to WhatsApp Official:',
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  async getStatus(): Promise<any> {
    try {
      if (!this.isInitialized) {
        return {
          provider: 'whatsapp-official',
          status: 'disconnected',
          state: 'DISCONNECTED',
        };
      }

      // Проверяем статус через API
      const response = await axios.get(`${this.baseUrl}`, {
        headers: this.headers,
      });

      return {
        provider: 'whatsapp-official',
        status: 'ready',
        state: 'READY',
        info: {
          phoneNumberId: this.config.phoneNumberId,
          displayName: response.data.display_phone_number || this.config.phoneNumberId,
        },
      };
    } catch (error) {
      logger.error('Error getting WhatsApp Official status:', error);
      return {
        provider: 'whatsapp-official',
        status: 'error',
        state: 'ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getContacts(): Promise<any[]> {
    // WhatsApp Official API не предоставляет список контактов
    // Возвращаем пустой массив или контакты из БД
    return [];
  }

  async getChats(): Promise<any[]> {
    // WhatsApp Official API не предоставляет список чатов
    // Можно вернуть чаты из БД
    try {
      if (!this.config.instanceId) return [];

      // Получаем уникальные чаты из сообщений
      // Это упрощенная реализация, можно улучшить
      return [];
    } catch (error) {
      logger.error('Error getting WhatsApp Official chats:', error);
      return [];
    }
  }

  async destroy(): Promise<void> {
    try {
      this.isInitialized = false;
      this.removeAllListeners();
      logger.info('WhatsApp Official Provider destroyed');
    } catch (error) {
      logger.error('Error destroying WhatsApp Official Provider:', error);
    }
  }
}
