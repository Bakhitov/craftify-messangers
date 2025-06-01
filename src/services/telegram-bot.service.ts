import { Bot, Context, webhookCallback } from 'grammy';
import { config } from '../config';
import logger from '../logger';
import { MessageStorageService, MessageData } from './message-storage.service';
import express from 'express';

export interface TelegramBotMessage {
  messageId: number;
  chatId: number;
  text?: string;
  from?: {
    id: number;
    firstName: string;
    lastName?: string;
    username?: string;
  };
  date: number;
  isBot: boolean;
}

export interface TelegramBotChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
}

export class TelegramBotService {
  private bot: Bot;
  private messageStorageService?: MessageStorageService;
  private isInitialized = false;
  private instanceId?: string;

  constructor(messageStorageService?: MessageStorageService, instanceId?: string) {
    if (!config.telegram.botToken) {
      throw new Error('Telegram bot token is required');
    }

    this.bot = new Bot(config.telegram.botToken);
    this.messageStorageService = messageStorageService;
    this.instanceId = instanceId;
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Обработчик всех сообщений
    this.bot.on('message', async ctx => {
      try {
        await this.handleMessage(ctx);
      } catch (error) {
        logger.error('Error handling Telegram message:', error);
      }
    });

    // Обработчик команды /start
    this.bot.command('start', async ctx => {
      await ctx.reply('Привет! Я бот для интеграции с WhatsApp Web MCP.');
    });

    // Обработчик команды /help
    this.bot.command('help', async ctx => {
      const helpText = `
Доступные команды:
/start - Начать работу с ботом
/help - Показать это сообщение
/status - Показать статус бота
/info - Информация о чате

Просто отправьте сообщение, и я его обработаю!
      `;
      await ctx.reply(helpText);
    });

    // Обработчик команды /status
    this.bot.command('status', async ctx => {
      const status = this.isInitialized ? 'Активен' : 'Не инициализирован';
      await ctx.reply(`Статус бота: ${status}`);
    });

    // Обработчик команды /info
    this.bot.command('info', async ctx => {
      const chat = ctx.chat;
      if (!chat) {
        await ctx.reply('Не удалось получить информацию о чате.');
        return;
      }

      const infoText = `
Информация о чате:
ID: ${chat.id}
Тип: ${chat.type}
${chat.title ? `Название: ${chat.title}` : ''}
${chat.username ? `Username: @${chat.username}` : ''}
${chat.first_name ? `Имя: ${chat.first_name}` : ''}
${chat.last_name ? `Фамилия: ${chat.last_name}` : ''}
      `;
      await ctx.reply(infoText);
    });

    // Обработчик ошибок
    this.bot.catch(err => {
      logger.error('Grammy bot error:', err);
    });
  }

  private async handleMessage(ctx: Context): Promise<void> {
    if (!ctx.message || !ctx.from) return;

    const message: TelegramBotMessage = {
      messageId: ctx.message.message_id,
      chatId: ctx.chat?.id || 0,
      text: ctx.message.text,
      from: {
        id: ctx.from.id,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
        username: ctx.from.username,
      },
      date: ctx.message.date,
      isBot: ctx.from.is_bot,
    };

    // Сохраняем сообщение в базу данных
    await this.storeMessage(message);

    // Логируем сообщение
    logger.info('Received Telegram message:', {
      chatId: message.chatId,
      messageId: message.messageId,
      text: message.text?.substring(0, 100),
      from: message.from?.firstName,
    });
  }

  private async storeMessage(message: TelegramBotMessage): Promise<void> {
    if (!this.messageStorageService || !this.instanceId) {
      return;
    }

    try {
      const messageData: MessageData = {
        instance_id: this.instanceId,
        message_id: message.messageId.toString(),
        chat_id: message.chatId.toString(),
        from_number: message.from?.id.toString(),
        to_number: undefined, // Для входящих сообщений
        message_body: message.text || '',
        message_type: 'text',
        is_group: message.chatId < 0, // Отрицательные ID для групп в Telegram
        group_id: message.chatId < 0 ? message.chatId.toString() : undefined,
        contact_name: message.from?.firstName,
        timestamp: message.date * 1000, // Конвертируем в миллисекунды
      };

      await this.messageStorageService.saveMessage(messageData);
    } catch (error) {
      logger.error('Failed to store Telegram bot message:', error);
    }
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Telegram bot service');

      if (config.telegram.webhookUrl) {
        // Webhook режим
        await this.bot.api.setWebhook(config.telegram.webhookUrl, {
          secret_token: config.telegram.webhookSecret,
        });
        logger.info('Telegram bot webhook set:', config.telegram.webhookUrl);
      } else {
        // Polling режим
        await this.bot.start();
        logger.info('Telegram bot started in polling mode');
      }

      this.isInitialized = true;
      logger.info('Telegram bot service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Telegram bot service:', error);
      throw error;
    }
  }

  async destroy(): Promise<void> {
    try {
      logger.info('Destroying Telegram bot service');
      await this.bot.stop();
      this.isInitialized = false;
      logger.info('Telegram bot service destroyed');
    } catch (error) {
      logger.error('Error destroying Telegram bot service:', error);
    }
  }

  async sendMessage(chatId: number, text: string): Promise<{ messageId: number }> {
    try {
      const result = await this.bot.api.sendMessage(chatId, text);

      // Сохраняем отправленное сообщение
      if (this.messageStorageService && this.instanceId) {
        const messageData: MessageData = {
          instance_id: this.instanceId,
          message_id: result.message_id.toString(),
          chat_id: chatId.toString(),
          from_number: undefined,
          to_number: chatId.toString(),
          message_body: text,
          message_type: 'text',
          is_group: chatId < 0,
          group_id: chatId < 0 ? chatId.toString() : undefined,
          contact_name: undefined,
          timestamp: Date.now(),
        };

        await this.messageStorageService.saveMessage(messageData);
      }

      return { messageId: result.message_id };
    } catch (error) {
      logger.error('Failed to send Telegram message:', error);
      throw error;
    }
  }

  async sendPhoto(chatId: number, photo: string, caption?: string): Promise<{ messageId: number }> {
    try {
      const result = await this.bot.api.sendPhoto(chatId, photo, { caption });
      return { messageId: result.message_id };
    } catch (error) {
      logger.error('Failed to send Telegram photo:', error);
      throw error;
    }
  }

  async sendDocument(
    chatId: number,
    document: string,
    caption?: string,
  ): Promise<{ messageId: number }> {
    try {
      const result = await this.bot.api.sendDocument(chatId, document, { caption });
      return { messageId: result.message_id };
    } catch (error) {
      logger.error('Failed to send Telegram document:', error);
      throw error;
    }
  }

  async getMe(): Promise<{
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
    can_join_groups?: boolean;
    can_read_all_group_messages?: boolean;
    supports_inline_queries?: boolean;
  }> {
    try {
      return await this.bot.api.getMe();
    } catch (error) {
      logger.error('Failed to get bot info:', error);
      throw error;
    }
  }

  async getChat(chatId: number): Promise<TelegramBotChat> {
    try {
      const chat = await this.bot.api.getChat(chatId);
      return {
        id: chat.id,
        type: chat.type,
        title: chat.title,
        username: chat.username,
        firstName: chat.first_name,
        lastName: chat.last_name,
      };
    } catch (error) {
      logger.error('Failed to get chat info:', error);
      throw error;
    }
  }

  getWebhookCallback(): (
    req: express.Request,
    res: express.Response,
    next?: express.NextFunction,
  ) => void {
    return webhookCallback(this.bot, 'express', {
      secretToken: config.telegram.webhookSecret,
    });
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  getBot(): Bot {
    return this.bot;
  }
}
