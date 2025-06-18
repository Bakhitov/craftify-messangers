import { EventEmitter } from 'events';
import { SlackConfig } from '../types';
import { MessageStorageService, MessageData } from '../services/message-storage.service';
import { WebhookService } from '../services/webhook.service';
import logger from '../logger';
import { WebClient } from '@slack/web-api';

export interface SlackMessage {
  channel: string;
  user: string;
  text: string;
  ts: string;
  thread_ts?: string;
  files?: Array<{
    id: string;
    name: string;
    mimetype: string;
    url_private: string;
    permalink: string;
  }>;
  subtype?: string;
}

export interface SlackUser {
  id: string;
  name: string;
  real_name?: string;
  profile?: {
    display_name?: string;
    real_name?: string;
    email?: string;
    image_72?: string;
  };
}

export interface SlackChannel {
  id: string;
  name: string;
  is_channel: boolean;
  is_group: boolean;
  is_im: boolean;
  is_mpim: boolean;
  is_private: boolean;
  is_archived: boolean;
  is_general: boolean;
  is_shared: boolean;
  is_org_shared: boolean;
  is_member: boolean;
  num_members?: number;
  topic?: {
    value: string;
    creator: string;
    last_set: number;
  };
  purpose?: {
    value: string;
    creator: string;
    last_set: number;
  };
}

export class SlackProvider extends EventEmitter {
  private config: SlackConfig;
  private messageStorageService: MessageStorageService;
  private webhookService: WebhookService;
  private client: WebClient;
  private isInitialized = false;

  constructor(config: SlackConfig, messageStorageService: MessageStorageService) {
    super();
    this.config = config;
    this.messageStorageService = messageStorageService;
    this.webhookService = new WebhookService();
    this.client = new WebClient(config.botToken);

    logger.info('Slack Provider initialized');
  }

  async initialize(): Promise<void> {
    try {
      // Проверяем соединение с Slack API
      await this.verifyConnection();

      this.isInitialized = true;
      this.emit('ready');

      logger.info('Slack Provider ready');
    } catch (error) {
      logger.error('Failed to initialize Slack Provider:', error);
      this.emit('error', error);
      throw error;
    }
  }

  private async verifyConnection(): Promise<void> {
    try {
      const authTest = await this.client.auth.test();

      if (authTest.ok) {
        logger.info('Slack API connection verified', {
          teamId: authTest.team_id,
          teamName: authTest.team,
          botId: authTest.bot_id,
          userId: authTest.user_id,
        });
      } else {
        throw new Error(`Slack auth failed: ${authTest.error}`);
      }
    } catch (error: any) {
      logger.error('Slack API connection failed:', error.message);
      throw new Error('Failed to connect to Slack API');
    }
  }

  async handleWebhook(webhookData: any): Promise<void> {
    try {
      // Обрабатываем различные типы событий Slack
      if (webhookData.type === 'url_verification') {
        // Возвращаем challenge для верификации webhook
        return webhookData.challenge;
      }

      if (webhookData.event) {
        await this.processEvent(webhookData.event);
      }
    } catch (error) {
      logger.error('Error processing Slack webhook:', error);
    }
  }

  private async processEvent(event: any): Promise<void> {
    try {
      switch (event.type) {
        case 'message':
          if (!event.subtype || event.subtype === 'file_share') {
            await this.processIncomingMessage(event);
          }
          break;
        case 'app_mention':
          await this.processAppMention(event);
          break;
        default:
          logger.debug('Unhandled Slack event type:', event.type);
      }
    } catch (error) {
      logger.error('Error processing Slack event:', error);
    }
  }

  private async processIncomingMessage(message: SlackMessage): Promise<void> {
    try {
      // Игнорируем сообщения от ботов
      if (message.subtype === 'bot_message') return;

      // Получаем информацию о пользователе и канале
      const [userInfo, channelInfo] = await Promise.all([
        this.getUserInfo(message.user),
        this.getChannelInfo(message.channel),
      ]);

      const messageData: MessageData = {
        instance_id: this.config.instanceId || '',
        message_id: message.ts,
        chat_id: message.channel,
        from_number: message.user,
        to_number: message.channel,
        message_body: this.extractMessageText(message),
        message_type: this.getMessageType(message),
        timestamp: Math.floor(parseFloat(message.ts) * 1000),
        is_from_me: false,
        is_group: this.isGroupChannel(channelInfo),
        contact_name: this.getUserDisplayName(userInfo),
      };

      // Сохраняем сообщение в БД
      await this.messageStorageService.saveMessage(messageData);

      // Отправляем webhook
      if (this.config.instanceId) {
        const webhookData = {
          instanceId: this.config.instanceId,
          messageId: message.ts,
          chatId: message.channel,
          from: message.user,
          body: messageData.message_body || '',
          timestamp: messageData.timestamp,
          provider: 'slack' as const,
          messageType: messageData.message_type || 'text',
          isGroup: messageData.is_group,
          contactName: messageData.contact_name,
        };

        await this.webhookService.sendToWebhook(webhookData);
      }

      this.emit('message', {
        messageId: message.ts,
        from: message.user,
        body: messageData.message_body || '',
        type: messageData.message_type,
        timestamp: new Date(messageData.timestamp),
        channel: message.channel,
        isGroup: messageData.is_group,
      });

      logger.info(
        `Processed Slack message: ${message.ts} from ${message.user} in ${message.channel}`,
      );
    } catch (error) {
      logger.error('Error processing incoming Slack message:', error);
    }
  }

  private async processAppMention(event: any): Promise<void> {
    try {
      // Обрабатываем упоминания бота как обычные сообщения
      await this.processIncomingMessage(event);
    } catch (error) {
      logger.error('Error processing Slack app mention:', error);
    }
  }

  private extractMessageText(message: SlackMessage): string {
    let text = message.text || '';

    // Убираем упоминания бота
    text = text.replace(/<@[A-Z0-9]+>/g, '').trim();

    if (message.files && message.files.length > 0) {
      const fileDescriptions = message.files.map(file => `[FILE: ${file.name}]`).join(' ');
      text = text ? `${text} ${fileDescriptions}` : fileDescriptions;
    }

    return text || '[MESSAGE]';
  }

  private getMessageType(message: SlackMessage): string {
    if (message.files && message.files.length > 0) {
      // Определяем тип файла по MIME типу
      const file = message.files[0];
      if (file.mimetype.startsWith('image/')) return 'image';
      if (file.mimetype.startsWith('video/')) return 'video';
      if (file.mimetype.startsWith('audio/')) return 'audio';
      return 'file';
    }

    return 'text';
  }

  private async getUserInfo(userId: string): Promise<SlackUser | null> {
    try {
      const response = await this.client.users.info({ user: userId });

      if (response.ok && response.user) {
        return response.user as SlackUser;
      }

      return null;
    } catch (error) {
      logger.error('Error getting Slack user info:', error);
      return null;
    }
  }

  private async getChannelInfo(channelId: string): Promise<SlackChannel | null> {
    try {
      const response = await this.client.conversations.info({ channel: channelId });

      if (response.ok && response.channel) {
        return response.channel as SlackChannel;
      }

      return null;
    } catch (error) {
      logger.error('Error getting Slack channel info:', error);
      return null;
    }
  }

  private getUserDisplayName(userInfo: SlackUser | null): string {
    if (!userInfo) return 'Unknown User';

    return (
      userInfo.profile?.display_name ||
      userInfo.profile?.real_name ||
      userInfo.real_name ||
      userInfo.name ||
      userInfo.id
    );
  }

  private isGroupChannel(channelInfo: SlackChannel | null): boolean {
    if (!channelInfo) return false;

    return (
      channelInfo.is_channel || channelInfo.is_group || channelInfo.is_mpim || !channelInfo.is_im
    );
  }

  async sendMessage(
    channel: string,
    message: string,
    threadTs?: string,
  ): Promise<{ messageId: string }> {
    try {
      if (!this.isInitialized) {
        throw new Error('Slack Provider not initialized');
      }

      const response = await this.client.chat.postMessage({
        channel: channel,
        text: message,
        thread_ts: threadTs,
      });

      if (!response.ok) {
        throw new Error(`Slack message failed: ${response.error}`);
      }

      const messageId = response.ts!;

      // Получаем информацию о канале для определения типа
      const channelInfo = await this.getChannelInfo(channel);

      // Сохраняем исходящее сообщение в БД
      const messageData: MessageData = {
        instance_id: this.config.instanceId || '',
        message_id: String(messageId),
        chat_id: channel,
        from_number: 'bot',
        to_number: channel,
        message_body: message,
        message_type: 'text',
        timestamp: Date.now(),
        is_from_me: true,
        is_group: this.isGroupChannel(channelInfo),
        contact_name: channelInfo?.name || channel,
      };

      await this.messageStorageService.saveMessage(messageData);

      logger.info(`Slack message sent: ${messageId} to ${channel}`);

      return { messageId: String(messageId) };
    } catch (error: any) {
      logger.error('Error sending Slack message:', error.message);
      throw error;
    }
  }

  async sendFileMessage(
    channel: string,
    fileUrl: string,
    filename?: string,
    title?: string,
    comment?: string,
  ): Promise<{ messageId: string }> {
    try {
      if (!this.isInitialized) {
        throw new Error('Slack Provider not initialized');
      }

      const response = await this.client.files.upload({
        channels: channel,
        file: fileUrl, // Может быть URL или Buffer
        filename: filename,
        title: title,
        initial_comment: comment,
      });

      if (!response.ok) {
        throw new Error(`Slack file upload failed: ${response.error}`);
      }

      const messageId = response.file?.timestamp || Date.now().toString();

      // Получаем информацию о канале
      const channelInfo = await this.getChannelInfo(channel);

      // Сохраняем исходящее сообщение в БД
      const messageData: MessageData = {
        instance_id: this.config.instanceId || '',
        message_id: String(messageId),
        chat_id: channel,
        from_number: 'bot',
        to_number: channel,
        message_body: comment || `[FILE: ${filename || 'file'}]`,
        message_type: 'file',
        timestamp: Date.now(),
        is_from_me: true,
        is_group: this.isGroupChannel(channelInfo),
        contact_name: channelInfo?.name || channel,
      };

      await this.messageStorageService.saveMessage(messageData);

      logger.info(`Slack file sent: ${messageId} to ${channel}`);

      return { messageId: String(messageId) };
    } catch (error: any) {
      logger.error('Error sending Slack file:', error.message);
      throw error;
    }
  }

  async getStatus(): Promise<any> {
    try {
      if (!this.isInitialized) {
        return {
          provider: 'slack',
          status: 'disconnected',
          state: 'DISCONNECTED',
        };
      }

      const authTest = await this.client.auth.test();

      if (authTest.ok) {
        return {
          provider: 'slack',
          status: 'ready',
          state: 'READY',
          info: {
            teamId: authTest.team_id,
            teamName: authTest.team,
            botId: authTest.bot_id,
            appId: authTest.app_id,
          },
        };
      } else {
        throw new Error(authTest.error || 'Unknown error');
      }
    } catch (error) {
      logger.error('Error getting Slack status:', error);
      return {
        provider: 'slack',
        status: 'error',
        state: 'ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getContacts(): Promise<any[]> {
    try {
      if (!this.isInitialized) return [];

      const response = await this.client.users.list();

      if (response.ok && response.members) {
        return response.members
          .filter((member: any) => !member.deleted && !member.is_bot)
          .map((member: any) => ({
            id: member.id,
            name: member.name,
            realName: member.real_name,
            displayName: member.profile?.display_name,
            email: member.profile?.email,
            provider: 'slack',
          }));
      }

      return [];
    } catch (error) {
      logger.error('Error getting Slack contacts:', error);
      return [];
    }
  }

  async getChats(): Promise<any[]> {
    try {
      if (!this.isInitialized) return [];

      const response = await this.client.conversations.list({
        types: 'public_channel,private_channel,mpim,im',
      });

      if (response.ok && response.channels) {
        return response.channels.map((channel: any) => ({
          id: channel.id,
          name: channel.name || 'Direct Message',
          type: this.getChannelType(channel),
          memberCount: channel.num_members,
          isPrivate: channel.is_private,
          isArchived: channel.is_archived,
          provider: 'slack',
        }));
      }

      return [];
    } catch (error) {
      logger.error('Error getting Slack chats:', error);
      return [];
    }
  }

  private getChannelType(channel: any): string {
    if (channel.is_im) return 'direct';
    if (channel.is_mpim) return 'group_direct';
    if (channel.is_channel) return channel.is_private ? 'private_channel' : 'public_channel';
    if (channel.is_group) return 'private_group';
    return 'unknown';
  }

  async destroy(): Promise<void> {
    try {
      this.isInitialized = false;
      this.removeAllListeners();
      logger.info('Slack Provider destroyed');
    } catch (error) {
      logger.error('Error destroying Slack Provider:', error);
    }
  }
}
