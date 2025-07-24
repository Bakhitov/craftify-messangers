import { Bot, Context, InputFile } from 'grammy';
import { BaseMessengerProvider } from './base-provider';
import { createPool, getDatabaseConfig } from '../config/database.config';
import {
  TelegramConfig,
  TelegramStatusResponse,
  ContactResponse,
  ChatResponse,
  MessageResponse,
  SendMessageResponse,
  GroupResponse,
  CreateGroupResponse,
  AddParticipantsResponse,
  MediaResponse,
  SendMediaMessageParams,
  SendMediaMessageResponse,
  TelegramSendMessageParams,
  TelegramChannelResponse,
  BulkMessageRequest,
  BulkMessageResponse,
} from '../types';
import { MessageStorageService, MessageData } from '../services/message-storage.service';
import { webhookService } from '../services/webhook.service';
import { AgnoIntegrationService, AgnoMediaFile } from '../services/agno-integration.service';
import * as mime from 'mime-types';
import axios from 'axios';
import logger from '../logger';
import { config } from '../config';

export class TelegramProvider extends BaseMessengerProvider {
  private bot: Bot;
  private isStarted = false;
  private isPollingStarted = false;
  private agnoIntegrationService: AgnoIntegrationService;
  private botInfo: any = null;

  constructor(config: TelegramConfig, messageStorageService?: MessageStorageService) {
    super(config, messageStorageService);

    if (!config.botToken) {
      throw new Error('Telegram Bot Token is required');
    }

    this.bot = new Bot(config.botToken);

    // Создаем экземпляр AgnoIntegrationService
    const pool = createPool();
    this.agnoIntegrationService = new AgnoIntegrationService(pool);

    // Настраиваем event handlers сразу в конструкторе
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Обработка всех сообщений
    this.bot.on('message', async (ctx: Context) => {
      try {
        const messageResponse = await this.convertGrammyMessage(ctx);
        await this.storeMessage(messageResponse);

        // Отправляем в webhook
        if (this.instanceId) {
          try {
            await webhookService.sendToWebhook({
              instanceId: this.instanceId,
              messageId: messageResponse.id,
              chatId: messageResponse.chatId || ctx.chat?.id.toString() || '',
              from: ctx.from?.id.toString(),
              body: messageResponse.body,
              timestamp: Date.now(),
              provider: 'telegram',
              messageType: messageResponse.type || 'text',
              isGroup: ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup',
              contactName: messageResponse.contact || this.getFullContactName(ctx.from),
            });
          } catch (webhookError) {
            this.logError('Failed to send webhook for Telegram message:', webhookError);
          }
        }

        // Проверка agno интеграции
        if (this.instanceId) {
          try {
            const agnoConfig = await this.agnoIntegrationService.getAgnoConfig(this.instanceId);
            if (agnoConfig?.enabled) {
              // Генерируем session_id детерминированно из agent_id + chat_id
              const chatId = ctx.chat?.id.toString() || '';
              const sessionId = this.generateSessionId(agnoConfig.agent_id, chatId);

              // Обновляем конфигурацию с сгенерированным session_id
              const configWithSession = {
                ...agnoConfig,
                sessionId: sessionId,
              };

              // Получаем текст сообщения (включая описания медиа)
              const messageText = messageResponse.body;

              // Подготавливаем файлы для отправки в Agno если есть медиа
              const agnoFiles: AgnoMediaFile[] = [];
              let finalMessageText = messageText;

              // Обрабатываем медиа файлы
              if (ctx.message && 'photo' in ctx.message && ctx.message.photo) {
                // Фотография
                const photos = ctx.message.photo;
                const photo = photos[photos.length - 1]; // Берем самое большое разрешение
                try {
                  const file = await ctx.api.getFile(photo.file_id);
                  const fileUrl = `https://api.telegram.org/file/bot${this.bot.token}/${file.file_path}`;
                  const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });

                  const filename = `photo_${ctx.message.message_id}.jpg`;
                  agnoFiles.push({
                    buffer: Buffer.from(response.data),
                    filename,
                    mimetype: 'image/jpeg',
                  });

                  finalMessageText = ctx.message.caption
                    ? `${ctx.message.caption}\n\n[PHOTO: ${filename}]`
                    : `[PHOTO: ${filename}]`;
                } catch (error) {
                  this.logError('Failed to download Telegram photo for Agno', error);
                }
              } else if (ctx.message && 'document' in ctx.message && ctx.message.document) {
                // Документ
                const document = ctx.message.document;
                try {
                  const file = await ctx.api.getFile(document.file_id);
                  const fileUrl = `https://api.telegram.org/file/bot${this.bot.token}/${file.file_path}`;
                  const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });

                  const filename = document.file_name || `document_${ctx.message.message_id}`;
                  agnoFiles.push({
                    buffer: Buffer.from(response.data),
                    filename,
                    mimetype: document.mime_type || 'application/octet-stream',
                  });

                  finalMessageText = ctx.message.caption
                    ? `${ctx.message.caption}\n\n[DOCUMENT: ${filename}]`
                    : `[DOCUMENT: ${filename}]`;
                } catch (error) {
                  this.logError('Failed to download Telegram document for Agno', error);
                }
              } else if (ctx.message && 'video' in ctx.message && ctx.message.video) {
                // Видео
                const video = ctx.message.video;
                try {
                  const file = await ctx.api.getFile(video.file_id);
                  const fileUrl = `https://api.telegram.org/file/bot${this.bot.token}/${file.file_path}`;
                  const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });

                  const filename = `video_${ctx.message.message_id}.mp4`;
                  agnoFiles.push({
                    buffer: Buffer.from(response.data),
                    filename,
                    mimetype: video.mime_type || 'video/mp4',
                  });

                  finalMessageText = ctx.message.caption
                    ? `${ctx.message.caption}\n\n[VIDEO: ${filename}]`
                    : `[VIDEO: ${filename}]`;
                } catch (error) {
                  this.logError('Failed to download Telegram video for Agno', error);
                }
              }

              // Отправляем сообщение агенту (с файлами если есть)
              const agnoResponse = await this.agnoIntegrationService.sendToAgentWithFiles(
                finalMessageText,
                configWithSession,
                agnoFiles,
              );

              // Если получили ответ от агента
              const responseMessage = agnoResponse?.content || agnoResponse?.message;
              if (responseMessage) {
                // Отправляем ответ пользователю
                const sentMessage = await ctx.reply(responseMessage);

                // Сохраняем ответ агента в БД как исходящее сообщение
                if (this.messageStorageService) {
                  const botName = this.getBotName();
                  await this.messageStorageService.saveMessage({
                    instance_id: this.instanceId,
                    message_id: sentMessage.message_id.toString(),
                    chat_id: ctx.chat?.id.toString() || '',
                    from_number: botName, // От бота
                    to_number: ctx.chat?.id.toString() || '',
                    message_body: responseMessage,
                    message_type: 'text',
                    is_from_me: true, // Ответ агента = исходящее сообщение
                    is_group: ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup',
                    group_id:
                      ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup'
                        ? ctx.chat.id.toString()
                        : undefined,
                    contact_name: this.getFullContactName(ctx.from),
                    agent_id: agnoConfig.agent_id, // Добавляем agent_id
                    message_source: 'agno', // Ответ от AI агента
                    timestamp: Date.now(),
                  });
                }

                this.logDebug('Agno response sent and saved', {
                  agentId: agnoConfig.agent_id,
                  responseLength: responseMessage.length,
                  messageId: sentMessage.message_id,
                  runId: agnoResponse.run_id,
                });
              }
            }
          } catch (error) {
            this.logError('Agno integration failed', error);
          }
        }

        // Получаем agent_id из конфигурации Agno
        let agentId: string | undefined;
        try {
          if (this.instanceId) {
            const agnoConfig = await this.agnoIntegrationService.getAgnoConfig(this.instanceId);
            agentId = agnoConfig?.agent_id;
          }
        } catch (error) {
          // Игнорируем ошибки получения agent_id
        }

        // Сохранить входящее сообщение в БД
        if (this.messageStorageService && this.instanceId && ctx.message) {
          await this.messageStorageService.saveMessage({
            instance_id: this.instanceId,
            message_id: ctx.message.message_id.toString(),
            chat_id: ctx.chat?.id.toString() || '',
            from_number: ctx.from?.id.toString(),
            to_number: this.getBotName(), // К боту
            message_body: messageResponse.body, // Используем обработанный текст включая медиа
            message_type: messageResponse.type || 'text', // Правильный тип сообщения
            is_from_me: false, // Входящее сообщение
            is_group: ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup',
            group_id:
              ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup'
                ? ctx.chat.id.toString()
                : undefined,
            contact_name: this.getFullContactName(ctx.from),
            agent_id: agentId, // Добавляем agent_id если есть
            message_source: 'user', // Входящее сообщение всегда от пользователя
            timestamp: Date.now(),
          });

          this.logDebug('Incoming Telegram message saved', {
            messageId: ctx.message.message_id,
            chatId: ctx.chat?.id,
            instanceId: this.instanceId,
            messageType: messageResponse.type,
          });
        }

        this.emitEvent('message', { message: messageResponse });

        this.logInfo(
          `Received message from ${messageResponse.contact}: ${messageResponse.body.substring(0, 50)}...`,
        );
      } catch (error) {
        this.logError('Error processing new message', error);
      }
    });

    // Обработка ошибок
    this.bot.catch((err: any) => {
      this.logError('Bot error', err);
      this.emitEvent('error', { error: err.message });
    });
  }

  async initialize(): Promise<void> {
    try {
      this.logInfo('Initializing Telegram provider');

      // Устанавливаем таймаут для инициализации (5 секунд)
      const initPromise = this.bot.api.getMe();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Telegram initialization timeout')), 5000);
      });

      // Ждем либо успешную инициализацию, либо таймаут
      const me = (await Promise.race([initPromise, timeoutPromise])) as any;
      this.botInfo = me; // Сохраняем информацию о боте
      this.logInfo(`Bot initialized: @${me.username} (${me.first_name})`);

      // Обновляем поле account в БД с информацией о боте
      if (this.instanceId) {
        const botInfo = `${me.first_name}${me.username ? ` (@${me.username})` : ''}`;
        await this.updateAccountInfo(botInfo);
      }

      this.isStarted = true;
      this.isInitialized = true;
      this.isReady = true;

      this.logInfo('Telegram provider initialized successfully');
      this.emitEvent('ready', {});
    } catch (error) {
      this.logError('Failed to initialize Telegram provider', error);
      this.isInitialized = false;
      this.isReady = false;
      // Не делаем throw для предотвращения падения всего процесса
      this.emitEvent('error', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async startPolling(): Promise<void> {
    try {
      if (this.isPollingStarted) {
        this.logInfo('Polling already started');
        return;
      }

      this.logInfo('Starting Telegram polling for incoming messages...');

      // Запускаем polling в неблокирующем режиме
      this.bot.start({
        onStart: botInfo => {
          this.logInfo(`Telegram polling started for bot @${botInfo.username}`);
          this.isPollingStarted = true;
          this.emitEvent('polling_started', { botInfo });
        },
      });
    } catch (error) {
      this.logError('Failed to start polling', error);
      this.emitEvent('error', {
        error: error instanceof Error ? error.message : 'Polling start failed',
      });
    }
  }

  async stopPolling(): Promise<void> {
    try {
      if (!this.isPollingStarted) {
        this.logInfo('Polling not started');
        return;
      }

      this.logInfo('Stopping Telegram polling...');
      await this.bot.stop();
      this.isPollingStarted = false;
      this.logInfo('Telegram polling stopped');
      this.emitEvent('polling_stopped', {});
    } catch (error) {
      this.logError('Error stopping polling', error);
    }
  }

  async destroy(): Promise<void> {
    try {
      this.logInfo('Destroying Telegram provider');

      if (this.isPollingStarted) {
        await this.stopPolling();
      }

      this.isStarted = false;
      this.isInitialized = false;
      this.isReady = false;
      this.logInfo('Telegram provider destroyed');
    } catch (error) {
      this.logError('Error destroying Telegram provider', error);
    }
  }

  async getStatus(): Promise<TelegramStatusResponse> {
    try {
      if (!this.isReady) {
        return {
          provider: 'telegram',
          status: 'disconnected',
          state: 'DISCONNECTED',
        };
      }

      const me = await this.bot.api.getMe();

      return {
        provider: 'telegram',
        status: 'connected',
        info: {
          id: me.id,
          firstName: me.first_name,
          lastName: me.last_name,
          username: me.username,
          isBot: me.is_bot,
        },
        state: 'READY',
      };
    } catch (error) {
      return {
        provider: 'telegram',
        status: 'error',
        state: 'ERROR',
      };
    }
  }

  async sendMessage(to: string, message: string): Promise<SendMessageResponse> {
    try {
      if (!this.validateMessage(message)) {
        throw new Error('Invalid message content');
      }

      const chatId = this.parseChatId(to);
      const result = await this.bot.api.sendMessage(chatId, message);

      // Сохранить исходящее сообщение в БД
      if (this.messageStorageService && this.instanceId) {
        const botName = this.getBotName();
        await this.messageStorageService.saveMessage({
          instance_id: this.instanceId,
          message_id: result.message_id.toString(),
          chat_id: to,
          from_number: botName, // От бота
          to_number: to,
          message_body: message,
          message_type: 'text',
          is_from_me: true,
          is_group: to.startsWith('-'),
          group_id: to.startsWith('-') ? to : undefined,
          contact_name: await this.getContactName(to),
          message_source: 'api', // Сообщение отправлено через API
          timestamp: Date.now(),
        });

        this.logDebug('Outgoing Telegram message saved', {
          messageId: result.message_id,
          chatId: to,
          instanceId: this.instanceId,
        });
      }

      return {
        messageId: result.message_id.toString(),
        provider: 'telegram',
      };
    } catch (error) {
      this.handleError(error, 'sendMessage');
    }
  }

  async sendTelegramMessage(params: TelegramSendMessageParams): Promise<SendMessageResponse> {
    try {
      if (!this.validateMessage(params.message)) {
        throw new Error('Invalid message content');
      }

      const chatId = this.parseChatId(params.chatId.toString());
      const options: any = {
        parse_mode: params.parseMode,
        reply_to_message_id: params.replyToMessageId,
        disable_web_page_preview: params.disableWebPagePreview,
        disable_notification: params.disableNotification,
      };

      const result = await this.bot.api.sendMessage(chatId, params.message, options);

      // Сохранить исходящее сообщение в БД
      if (this.messageStorageService && this.instanceId) {
        await this.messageStorageService.saveMessage({
          instance_id: this.instanceId,
          message_id: result.message_id.toString(),
          chat_id: params.chatId.toString(),
          from_number: this.getBotName(), // От бота
          to_number: params.chatId.toString(),
          message_body: params.message,
          message_type: 'text',
          is_group: params.chatId.toString().startsWith('-'),
          group_id: params.chatId.toString().startsWith('-') ? params.chatId.toString() : undefined,
          contact_name: await this.getContactName(params.chatId.toString()),
          message_source: 'api', // Сообщение отправлено через API
          timestamp: Date.now(),
        });

        this.logDebug('Outgoing Telegram message saved', {
          messageId: result.message_id,
          chatId: params.chatId,
          instanceId: this.instanceId,
        });
      }

      return {
        messageId: result.message_id.toString(),
        provider: 'telegram',
      };
    } catch (error) {
      this.handleError(error, 'sendTelegramMessage');
    }
  }

  async getContacts(_query?: string): Promise<ContactResponse[]> {
    try {
      // В Telegram Bot API нет прямого доступа к контактам
      // Возвращаем пустой массив или можно реализовать кэширование пользователей
      this.logInfo('Telegram bots cannot access user contacts directly');
      return [];
    } catch (error) {
      this.handleError(error, 'getContacts');
    }
  }

  async getChats(): Promise<ChatResponse[]> {
    try {
      // В Telegram Bot API нет метода для получения всех чатов
      // Можно реализовать кэширование чатов из полученных сообщений
      this.logInfo('Telegram bots cannot list all chats directly');
      return [];
    } catch (error) {
      this.handleError(error, 'getChats');
    }
  }

  async getMessages(chatId: string, _limit = 10): Promise<MessageResponse[]> {
    try {
      if (!this.validateChatId(chatId)) {
        throw new Error('Invalid chat ID');
      }

      // В Telegram Bot API нет метода для получения истории сообщений
      // Можно реализовать через хранение сообщений в базе данных
      this.logInfo('Telegram bots cannot retrieve message history directly');
      return [];
    } catch (error) {
      this.handleError(error, 'getMessages');
    }
  }

  async createGroup(_name: string, participants: string[]): Promise<CreateGroupResponse> {
    try {
      if (!this.validateParticipants(participants)) {
        throw new Error('Invalid participants list');
      }

      // В Telegram Bot API нет прямого метода создания групп
      // Группы создаются пользователями, а бот добавляется в них
      throw new Error(
        'Telegram bots cannot create groups directly. Groups must be created by users.',
      );
    } catch (error) {
      this.handleError(error, 'createGroup');
    }
  }

  async addParticipantsToGroup(
    groupId: string,
    participants: string[],
  ): Promise<AddParticipantsResponse> {
    try {
      if (!this.validateChatId(groupId) || !this.validateParticipants(participants)) {
        throw new Error('Invalid group ID or participants');
      }

      // В Telegram Bot API нет прямого метода добавления участников
      // Можно использовать invite links или пользователи должны добавлять сами
      throw new Error('Telegram bots cannot add participants directly. Use invite links instead.');
    } catch (error) {
      this.handleError(error, 'addParticipantsToGroup');
    }
  }

  async getGroupMessages(groupId: string, limit = 10): Promise<MessageResponse[]> {
    return this.getMessages(groupId, limit);
  }

  async sendGroupMessage(groupId: string, message: string): Promise<SendMessageResponse> {
    return this.sendMessage(groupId, message);
  }

  async searchGroups(_query: string): Promise<GroupResponse[]> {
    try {
      // В Telegram Bot API нет поиска групп
      this.logInfo('Telegram bots cannot search groups directly');
      return [];
    } catch (error) {
      this.handleError(error, 'searchGroups');
    }
  }

  async getGroupById(groupId: string): Promise<GroupResponse | null> {
    try {
      if (!this.validateChatId(groupId)) {
        return null;
      }

      const chatId = this.parseChatId(groupId);
      const chat = await this.bot.api.getChat(chatId);

      if (chat.type === 'private') {
        return null;
      }

      let type: 'group' | 'supergroup' | 'channel' = 'group';
      if (chat.type === 'supergroup') type = 'supergroup';
      if (chat.type === 'channel') type = 'channel';

      return {
        id: chat.id.toString(),
        name: 'title' in chat ? chat.title : 'Unknown',
        description: 'description' in chat ? chat.description : undefined,
        participants: [], // Требует отдельного запроса
        createdAt: new Date().toISOString(),
        provider: 'telegram',
        type,
        memberCount: 'member_count' in chat ? (chat.member_count as number) : undefined,
      };
    } catch (error) {
      this.logError('Error getting group by ID', error);
      return null;
    }
  }

  async downloadMediaFromMessage(_messageId: string): Promise<MediaResponse> {
    try {
      throw new Error(
        'downloadMediaFromMessage requires chat ID for Telegram. Use downloadMediaFromChat instead.',
      );
    } catch (error) {
      this.handleError(error, 'downloadMediaFromMessage');
    }
  }

  async downloadMediaFromChat(_chatId: string, _messageId: string): Promise<MediaResponse> {
    try {
      // В Telegram Bot API нет прямого метода для скачивания медиа по ID сообщения
      // Медиа скачивается через file_id из объекта сообщения
      throw new Error('Media download requires file_id from message object');
    } catch (error) {
      this.handleError(error, 'downloadMediaFromChat');
    }
  }

  async sendMediaMessage(params: SendMediaMessageParams): Promise<SendMediaMessageResponse> {
    try {
      if (!params.chatId || !params.source) {
        throw new Error('Chat ID and source are required');
      }

      const chatId = this.parseChatId(params.chatId);
      let inputFile: InputFile;

      if (params.source.startsWith('http://') || params.source.startsWith('https://')) {
        // Скачиваем файл из URL
        const response = await axios.get(params.source, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);
        inputFile = new InputFile(buffer, 'media');
      } else if (params.source.startsWith('file://')) {
        // Читаем локальный файл
        const filePath = params.source.replace('file://', '');
        inputFile = new InputFile(filePath);
      } else {
        throw new Error('Invalid source format. Use http://, https://, or file:// prefix');
      }

      // Определяем тип медиа по MIME типу
      const mimeType = mime.lookup(params.source) || 'application/octet-stream';
      let result;

      if (mimeType.startsWith('image/')) {
        result = await this.bot.api.sendPhoto(chatId, inputFile, { caption: params.caption });
      } else if (mimeType.startsWith('video/')) {
        result = await this.bot.api.sendVideo(chatId, inputFile, { caption: params.caption });
      } else if (mimeType.startsWith('audio/')) {
        result = await this.bot.api.sendAudio(chatId, inputFile, { caption: params.caption });
      } else {
        result = await this.bot.api.sendDocument(chatId, inputFile, { caption: params.caption });
      }

      return {
        messageId: result.message_id.toString(),
        provider: 'telegram',
        mediaInfo: {
          mimetype: mimeType,
          filename: 'media',
          size: 0, // grammY не предоставляет размер файла
        },
      };
    } catch (error) {
      this.handleError(error, 'sendMediaMessage');
    }
  }

  // Telegram специфичные методы
  async getChannels(): Promise<TelegramChannelResponse[]> {
    try {
      // В Telegram Bot API нет метода для получения списка каналов
      this.logInfo('Telegram bots cannot list channels directly');
      return [];
    } catch (error) {
      this.handleError(error, 'getChannels');
    }
  }

  async getMe(): Promise<any> {
    try {
      return await this.bot.api.getMe();
    } catch (error) {
      this.logError('Error getting me', error);
      return null;
    }
  }

  // Вспомогательные методы
  private parseChatId(chatId: string | number): number {
    if (typeof chatId === 'number') {
      return chatId;
    }

    const parsed = parseInt(chatId, 10);
    if (isNaN(parsed)) {
      throw new Error(`Invalid chat ID: ${chatId}`);
    }

    return parsed;
  }

  private async convertGrammyMessage(ctx: Context): Promise<MessageResponse> {
    const message = ctx.message;
    if (!message) {
      throw new Error('No message in context');
    }

    const fromMe = message.from?.is_bot === true;

    // Получаем полное имя пользователя
    const contactName = this.getFullContactName(message.from);

    let body = '';
    let type = 'text';

    if ('text' in message && message.text) {
      body = message.text;
      type = 'text';
    } else if ('photo' in message) {
      body = message.caption || '[Photo]';
      type = 'photo';
    } else if ('video' in message) {
      body = message.caption || '[Video]';
      type = 'video';
    } else if ('audio' in message) {
      body = message.caption || '[Audio]';
      type = 'audio';
    } else if ('voice' in message) {
      body = '[Voice message]';
      type = 'voice';
    } else if ('document' in message) {
      body = message.caption || '[Document]';
      type = 'document';
    } else if ('sticker' in message) {
      body = '[Sticker]';
      type = 'sticker';
    }

    return {
      id: message.message_id.toString(),
      body,
      fromMe,
      timestamp: new Date(message.date * 1000).toISOString(),
      contact: contactName, // Полное имя пользователя вместо только ID
      type,
      provider: 'telegram',
      chatId: message.chat.id.toString(),
      messageThreadId: 'message_thread_id' in message ? message.message_thread_id : undefined,
    };
  }

  // Получение экземпляра бота для расширенного использования
  getBot(): Bot {
    return this.bot;
  }

  private async getContactName(chatId: string): Promise<string> {
    try {
      const id = this.parseChatId(chatId);
      const chat = await this.bot.api.getChat(id);

      if (chat.type === 'private') {
        return this.getFullContactName(chat);
      } else if ('title' in chat) {
        return chat.title;
      }

      return `Chat${chatId}`;
    } catch (error) {
      this.logError('Error getting contact name', error);
      return `Unknown${chatId}`;
    }
  }

  private getFullContactName(
    from:
      | {
          id?: number;
          first_name?: string;
          last_name?: string;
          username?: string;
        }
      | undefined,
  ): string {
    if (!from) return 'Unknown';

    let name = '';

    // Добавляем имя
    if (from.first_name) {
      name += from.first_name;
    }

    // Добавляем фамилию
    if (from.last_name) {
      name += ` ${from.last_name}`;
    }

    // Добавляем username
    if (from.username) {
      name += ` (@${from.username})`;
    }

    // Если ничего нет, используем ID
    return name.trim() || `User${from.id}`;
  }

  /**
   * Переопределенный метод для сохранения телеграм сообщений с правильными полями
   */
  protected async storeMessage(message: MessageResponse): Promise<void> {
    if (!this.messageStorageService || !this.instanceId) {
      return;
    }

    try {
      const botName = this.getBotName();

      // Получаем agent_id из конфигурации Agno
      let agentId: string | undefined;
      try {
        const agnoConfig = await this.agnoIntegrationService.getAgnoConfig(this.instanceId);
        agentId = agnoConfig?.agent_id;
      } catch (error) {
        this.logDebug('Could not get Agno config for storing message', { error });
      }

      const messageData: MessageData = {
        instance_id: this.instanceId,
        message_id: message.id,
        chat_id: message.chatId || '',
        // Для телеграм: записываем chat_id пользователя в from_number, имя бота в to_number
        from_number: message.fromMe ? botName : message.chatId || '',
        to_number: message.fromMe ? message.chatId || '' : botName,
        message_body: message.body,
        message_type: message.type || 'text',
        is_from_me: message.fromMe,
        is_group: message.chatId?.startsWith('-') || false,
        group_id: message.chatId?.startsWith('-') ? message.chatId : undefined,
        contact_name: message.contact,
        agent_id: agentId, // Добавляем agent_id
        // Правильная логика для message_source:
        // - Входящие (fromMe: false) = всегда 'user'
        // - Исходящие (fromMe: true) = если есть agent_id то 'agno', иначе 'api'
        message_source: message.fromMe ? (agentId ? 'agno' : 'api') : 'user',
        timestamp: new Date(message.timestamp).getTime(),
      };

      await this.messageStorageService.saveMessage(messageData);
    } catch (error) {
      this.logError(`Failed to store message for Telegram provider:`, error);
    }
  }

  /**
   * Получает имя бота для записи в поля from_number/to_number
   */
  private getBotName(): string {
    if (!this.botInfo) return 'TelegramBot';

    let name = '';
    if (this.botInfo.first_name) {
      name += this.botInfo.first_name;
    }
    if (this.botInfo.username) {
      name += ` (@${this.botInfo.username})`;
    }

    return name.trim() || 'TelegramBot';
  }

  /**
   * Обновляет поле account в БД с информацией о боте
   */
  private async updateAccountInfo(accountInfo: string): Promise<void> {
    if (!this.instanceId) return;

    try {
      const pool = createPool();
      const config = getDatabaseConfig();

      await pool.query(
        `UPDATE ${config.schema}.message_instances 
         SET account = $1, updated_at = NOW() 
         WHERE id = $2`,
        [accountInfo, this.instanceId],
      );

      this.logInfo('Telegram account info updated in database', {
        instanceId: this.instanceId,
        account: accountInfo,
      });
    } catch (error) {
      this.logError('Failed to update Telegram account info in database:', {
        error: error instanceof Error ? error.message : String(error),
        instanceId: this.instanceId,
        account: accountInfo,
      });
    }
  }

  /**
   * Переопределяем метод getAgentId для получения agent_id из Agno конфигурации
   */
  protected async getAgentId(): Promise<string | undefined> {
    try {
      if (!this.instanceId) {
        return undefined;
      }
      const agnoConfig = await this.agnoIntegrationService.getAgnoConfig(this.instanceId);
      logger.debug('Agno config for agent_id', { instanceId: this.instanceId, agnoConfig });
      return agnoConfig?.agent_id;
    } catch (error) {
      logger.error('Failed to get agent_id from Agno config', { error });
      return undefined;
    }
  }

  private generateSessionId(agentId?: string, chatId?: string): string | undefined {
    if (!chatId) {
      return undefined;
    }

    // Используем детерминированную генерацию UUID (такую же как в MessageStorageService)
    const crypto = require('crypto');
    const sessionString = agentId ? `session:${agentId}:${chatId}` : `session:${chatId}`;
    const hash = crypto.createHash('sha256').update(sessionString).digest('hex');

    // Форматируем как UUID v4
    const uuid = [
      hash.substr(0, 8),
      hash.substr(8, 4),
      '4' + hash.substr(13, 3), // версия 4
      ((parseInt(hash.substr(16, 1), 16) & 0x3) | 0x8).toString(16) + hash.substr(17, 3), // вариант
      hash.substr(20, 12),
    ].join('-');

    return uuid;
  }

  async sendBulkMessages(request: BulkMessageRequest): Promise<BulkMessageResponse> {
    const { bulkMessageService } = await import('../services/bulk-message.service');

    // Функция отправки для конкретного провайдера
    const sendMessageFn = async (
      to: string,
      message: string,
    ): Promise<{ messageId?: string; error?: string }> => {
      try {
        const result = await this.sendMessage(to, message);
        return { messageId: result.messageId };
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
      }
    };

    return await bulkMessageService.executeBulkMessage(request, sendMessageFn);
  }
}
