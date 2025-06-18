import { EventEmitter } from 'events';
import { DiscordConfig } from '../types';
import { MessageStorageService, MessageData } from '../services/message-storage.service';
import { WebhookService } from '../services/webhook.service';
import logger from '../logger';
import {
  Client,
  GatewayIntentBits,
  Message,
  TextChannel,
  DMChannel,
  User,
  Guild,
  Channel,
} from 'discord.js';

export interface DiscordMessage {
  id: string;
  content: string;
  author: {
    id: string;
    username: string;
    discriminator: string;
    bot: boolean;
  };
  channel: {
    id: string;
    type: number;
  };
  guild?: {
    id: string;
    name: string;
  };
  timestamp: Date;
  attachments: Array<{
    id: string;
    filename: string;
    size: number;
    url: string;
    contentType?: string;
  }>;
}

export class DiscordProvider extends EventEmitter {
  private config: DiscordConfig;
  private messageStorageService: MessageStorageService;
  private webhookService: WebhookService;
  private client: Client;
  private isInitialized = false;

  constructor(config: DiscordConfig, messageStorageService: MessageStorageService) {
    super();
    this.config = config;
    this.messageStorageService = messageStorageService;
    this.webhookService = new WebhookService();

    // Настраиваем интенты для Discord бота
    const intents = config.intents || [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ];

    this.client = new Client({ intents });

    this.setupEventHandlers();

    logger.info('Discord Provider initialized');
  }

  private setupEventHandlers(): void {
    this.client.on('ready', () => {
      this.isInitialized = true;
      this.emit('ready');
      logger.info(`Discord bot logged in as ${this.client.user?.tag}`);
    });

    this.client.on('messageCreate', async (message: Message) => {
      await this.processIncomingMessage(message);
    });

    this.client.on('error', error => {
      logger.error('Discord client error:', error);
      this.emit('error', error);
    });

    this.client.on('disconnect', () => {
      this.isInitialized = false;
      logger.warn('Discord client disconnected');
    });
  }

  async initialize(): Promise<void> {
    try {
      await this.client.login(this.config.botToken);
      logger.info('Discord Provider ready');
    } catch (error) {
      logger.error('Failed to initialize Discord Provider:', error);
      this.emit('error', error);
      throw error;
    }
  }

  private async processIncomingMessage(message: Message): Promise<void> {
    try {
      // Игнорируем сообщения от ботов
      if (message.author.bot) return;

      const messageData: MessageData = {
        instance_id: this.config.instanceId || '',
        message_id: message.id,
        chat_id: message.channel.id,
        from_number: message.author.id,
        to_number: message.channel.id,
        message_body: this.extractMessageText(message),
        message_type: this.getMessageType(message),
        timestamp: message.createdTimestamp,
        is_from_me: false,
        is_group: this.isGuildChannel(message),
        contact_name: this.getUserDisplayName(message.author),
      };

      // Сохраняем сообщение в БД
      await this.messageStorageService.saveMessage(messageData);

      // Отправляем webhook
      if (this.config.instanceId) {
        const webhookData = {
          instanceId: this.config.instanceId,
          messageId: message.id,
          chatId: message.channel.id,
          from: message.author.id,
          body: messageData.message_body || '',
          timestamp: messageData.timestamp,
          provider: 'discord' as const,
          messageType: messageData.message_type || 'text',
          isGroup: messageData.is_group,
          contactName: messageData.contact_name,
        };

        await this.webhookService.sendToWebhook(webhookData);
      }

      this.emit('message', {
        messageId: message.id,
        from: message.author.id,
        body: messageData.message_body || '',
        type: messageData.message_type,
        timestamp: message.createdAt,
        channel: message.channel.id,
        isGroup: messageData.is_group,
        guild: message.guild?.name,
      });

      logger.info(
        `Processed Discord message: ${message.id} from ${message.author.username} in ${message.channel.id}`,
      );
    } catch (error) {
      logger.error('Error processing incoming Discord message:', error);
    }
  }

  private extractMessageText(message: Message): string {
    let text = message.content || '';

    if (message.attachments.size > 0) {
      const attachmentDescriptions = Array.from(message.attachments.values())
        .map(
          attachment =>
            `[${this.getAttachmentType(attachment.contentType || undefined)}: ${attachment.name}]`,
        )
        .join(' ');
      text = text ? `${text} ${attachmentDescriptions}` : attachmentDescriptions;
    }

    return text || '[MESSAGE]';
  }

  private getMessageType(message: Message): string {
    if (message.attachments.size > 0) {
      const attachment = message.attachments.first();
      return this.getAttachmentType(attachment?.contentType || undefined);
    }

    return 'text';
  }

  private getAttachmentType(contentType?: string): string {
    if (!contentType) return 'file';

    if (contentType.startsWith('image/')) return 'image';
    if (contentType.startsWith('video/')) return 'video';
    if (contentType.startsWith('audio/')) return 'audio';

    return 'file';
  }

  private getUserDisplayName(user: User): string {
    return user.displayName || user.username || user.id;
  }

  private isGuildChannel(message: Message): boolean {
    return message.guild !== null;
  }

  async sendMessage(channelId: string, message: string): Promise<{ messageId: string }> {
    try {
      if (!this.isInitialized) {
        throw new Error('Discord Provider not initialized');
      }

      const channel = await this.client.channels.fetch(channelId);

      if (!channel || !channel.isTextBased()) {
        throw new Error('Invalid channel or channel is not text-based');
      }

      const sentMessage = await (channel as TextChannel | DMChannel).send(message);

      // Сохраняем исходящее сообщение в БД
      const messageData: MessageData = {
        instance_id: this.config.instanceId || '',
        message_id: sentMessage.id,
        chat_id: channelId,
        from_number: this.client.user?.id || 'bot',
        to_number: channelId,
        message_body: message,
        message_type: 'text',
        timestamp: Date.now(),
        is_from_me: true,
        is_group: sentMessage.guild !== null,
        contact_name: this.getChannelName(channel),
      };

      await this.messageStorageService.saveMessage(messageData);

      logger.info(`Discord message sent: ${sentMessage.id} to ${channelId}`);

      return { messageId: sentMessage.id };
    } catch (error: any) {
      logger.error('Error sending Discord message:', error.message);
      throw error;
    }
  }

  async sendFileMessage(
    channelId: string,
    fileUrl: string,
    message?: string,
  ): Promise<{ messageId: string }> {
    try {
      if (!this.isInitialized) {
        throw new Error('Discord Provider not initialized');
      }

      const channel = await this.client.channels.fetch(channelId);

      if (!channel || !channel.isTextBased()) {
        throw new Error('Invalid channel or channel is not text-based');
      }

      const sentMessage = await (channel as TextChannel | DMChannel).send({
        content: message,
        files: [fileUrl],
      });

      // Сохраняем исходящее сообщение в БД
      const messageData: MessageData = {
        instance_id: this.config.instanceId || '',
        message_id: sentMessage.id,
        chat_id: channelId,
        from_number: this.client.user?.id || 'bot',
        to_number: channelId,
        message_body: message || '[FILE]',
        message_type: 'file',
        timestamp: Date.now(),
        is_from_me: true,
        is_group: sentMessage.guild !== null,
        contact_name: this.getChannelName(channel),
      };

      await this.messageStorageService.saveMessage(messageData);

      logger.info(`Discord file sent: ${sentMessage.id} to ${channelId}`);

      return { messageId: sentMessage.id };
    } catch (error: any) {
      logger.error('Error sending Discord file:', error.message);
      throw error;
    }
  }

  private getChannelName(channel: Channel): string {
    if ('name' in channel && channel.name) {
      return channel.name;
    }
    if ('recipient' in channel && channel.recipient) {
      return channel.recipient.username;
    }
    return channel.id;
  }

  async getStatus(): Promise<any> {
    try {
      if (!this.isInitialized || !this.client.user) {
        return {
          provider: 'discord',
          status: 'disconnected',
          state: 'DISCONNECTED',
        };
      }

      const guilds = this.client.guilds.cache;

      return {
        provider: 'discord',
        status: 'ready',
        state: 'READY',
        info: {
          botId: this.client.user.id,
          username: this.client.user.username,
          discriminator: this.client.user.discriminator,
          guildCount: guilds.size,
        },
      };
    } catch (error) {
      logger.error('Error getting Discord status:', error);
      return {
        provider: 'discord',
        status: 'error',
        state: 'ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getContacts(): Promise<any[]> {
    try {
      if (!this.isInitialized) return [];

      const contacts: any[] = [];

      // Получаем пользователей из всех гильдий
      for (const guild of this.client.guilds.cache.values()) {
        try {
          const members = await guild.members.fetch();

          for (const member of members.values()) {
            if (!member.user.bot && !contacts.find(c => c.id === member.user.id)) {
              contacts.push({
                id: member.user.id,
                username: member.user.username,
                discriminator: member.user.discriminator,
                displayName: member.displayName,
                guildName: guild.name,
                provider: 'discord',
              });
            }
          }
        } catch (error) {
          logger.error(`Error fetching members for guild ${guild.name}:`, error);
        }
      }

      return contacts;
    } catch (error) {
      logger.error('Error getting Discord contacts:', error);
      return [];
    }
  }

  async getChats(): Promise<any[]> {
    try {
      if (!this.isInitialized) return [];

      const chats: any[] = [];

      // Получаем каналы из всех гильдий
      for (const guild of this.client.guilds.cache.values()) {
        const channels = guild.channels.cache.filter(
          channel =>
            channel.isTextBased() && channel.permissionsFor(this.client.user!)?.has('ViewChannel'),
        );

        for (const channel of channels.values()) {
          chats.push({
            id: channel.id,
            name: 'name' in channel ? channel.name : 'Unnamed Channel',
            type: 'guild_channel',
            guildId: guild.id,
            guildName: guild.name,
            isPrivate: false,
            provider: 'discord',
          });
        }
      }

      // Получаем приватные сообщения
      for (const channel of this.client.channels.cache.values()) {
        if (channel.type === 1) {
          // DM Channel
          const dmChannel = channel as DMChannel;
          chats.push({
            id: channel.id,
            name: dmChannel.recipient?.username || 'Unknown User',
            type: 'direct_message',
            isPrivate: true,
            provider: 'discord',
          });
        }
      }

      return chats;
    } catch (error) {
      logger.error('Error getting Discord chats:', error);
      return [];
    }
  }

  async destroy(): Promise<void> {
    try {
      this.isInitialized = false;
      await this.client.destroy();
      this.removeAllListeners();
      logger.info('Discord Provider destroyed');
    } catch (error) {
      logger.error('Error destroying Discord Provider:', error);
    }
  }
}
