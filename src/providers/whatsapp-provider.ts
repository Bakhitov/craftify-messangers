import { Client, LocalAuth, Message, MessageMedia, GroupChat } from 'whatsapp-web.js';
import { BaseMessengerProvider } from './base-provider';
import {
  WhatsAppConfig,
  WhatsAppStatusResponse,
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
  BulkMessageRequest,
  BulkMessageResponse,
} from '../types';
import { MessageStorageService } from '../services/message-storage.service';
import { createWhatsAppClient } from '../whatsapp-client';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import logger from '../logger';
import { createPool, getDatabaseConfig } from '../config/database.config';
import { webhookService } from '../services/webhook.service';
import { AgnoIntegrationService } from '../services/agno-integration.service';

export class WhatsAppProvider extends BaseMessengerProvider {
  private client: Client;

  constructor(config: WhatsAppConfig, messageStorageService?: MessageStorageService) {
    super(config, messageStorageService);
    this.client = createWhatsAppClient(config);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('qr', (qr: string) => {
      this.logInfo('QR Code received');
      this.emitEvent('qr', { qr });
    });

    this.client.on('ready', () => {
      this.logInfo('WhatsApp client is ready');
      this.isReady = true;
      this.emitEvent('ready', {});
    });

    this.client.on('authenticated', () => {
      this.logInfo('WhatsApp client authenticated');
      this.emitEvent('authenticated', {});
    });

    this.client.on('auth_failure', (msg: string) => {
      this.logError('Authentication failed', msg);
      this.emitEvent('auth_failure', { message: msg });
    });

    this.client.on('disconnected', (reason: string) => {
      this.logInfo('WhatsApp client disconnected', { reason });
      this.isReady = false;
      this.emitEvent('disconnected', { reason });
    });

    this.client.on('message', async (message: Message) => {
      try {
        const messageResponse = await this.convertWhatsAppMessage(message);
        await this.storeMessage(messageResponse);
        this.emitEvent('message', { message: messageResponse });
      } catch (error) {
        this.logError('Error processing incoming message', error);
      }
    });

    this.client.on('message_create', async (message: Message) => {
      try {
        if (message.fromMe) {
          const messageResponse = await this.convertWhatsAppMessage(message);
          await this.storeMessage(messageResponse);
          this.emitEvent('message_create', { message: messageResponse });
        }
      } catch (error) {
        this.logError('Error processing outgoing message', error);
      }
    });
  }

  async initialize(): Promise<void> {
    try {
      this.logInfo('Initializing WhatsApp provider');
      await this.client.initialize();
      this.isInitialized = true;
      this.logInfo('WhatsApp provider initialized successfully');
    } catch (error) {
      this.handleError(error, 'initialize');
    }
  }

  async destroy(): Promise<void> {
    try {
      this.logInfo('Destroying WhatsApp provider');
      await this.client.destroy();
      this.isInitialized = false;
      this.isReady = false;
      this.logInfo('WhatsApp provider destroyed');
    } catch (error) {
      this.logError('Error destroying WhatsApp provider', error);
    }
  }

  async getStatus(): Promise<WhatsAppStatusResponse> {
    try {
      const state = await this.client.getState();
      const info = this.client.info;

      return {
        provider: 'whatsapp',
        status: this.isReady ? 'connected' : 'disconnected',
        info,
        state: state as unknown as 'QR_READY' | 'READY' | 'DISCONNECTED',
      };
    } catch (error) {
      return {
        provider: 'whatsapp',
        status: 'error',
        info: undefined,
        state: 'DISCONNECTED',
      };
    }
  }

  async sendMessage(to: string, message: string): Promise<SendMessageResponse> {
    try {
      if (!this.validateMessage(message)) {
        throw new Error('Invalid message content');
      }

      const chatId = to.includes('@c.us') ? to : `${to}@c.us`;
      const sentMessage = await this.client.sendMessage(chatId, message);

      return {
        messageId: sentMessage.id._serialized,
        provider: 'whatsapp',
      };
    } catch (error) {
      this.handleError(error, 'sendMessage');
    }
  }

  async getContacts(query?: string): Promise<ContactResponse[]> {
    try {
      const contacts = await this.client.getContacts();
      let filteredContacts = contacts.filter(contact => contact.isUser);

      if (query) {
        const searchQuery = query.toLowerCase();
        filteredContacts = filteredContacts.filter(
          contact =>
            contact.name?.toLowerCase().includes(searchQuery) ||
            contact.number.includes(searchQuery),
        );
      }

      return filteredContacts.map(contact => ({
        name: contact.name || contact.pushname || contact.number,
        number: contact.number,
        provider: 'whatsapp',
      }));
    } catch (error) {
      this.handleError(error, 'getContacts');
    }
  }

  async getChats(): Promise<ChatResponse[]> {
    try {
      const chats = await this.client.getChats();

      return chats.map(chat => ({
        id: chat.id._serialized,
        name: chat.name || 'Unknown',
        unreadCount: chat.unreadCount,
        timestamp: new Date(chat.timestamp * 1000).toISOString(),
        lastMessage: chat.lastMessage?.body,
        provider: 'whatsapp',
        type: chat.isGroup ? 'group' : 'private',
      }));
    } catch (error) {
      this.handleError(error, 'getChats');
    }
  }

  async getMessages(chatId: string, limit = 10): Promise<MessageResponse[]> {
    try {
      if (!this.validateChatId(chatId)) {
        throw new Error('Invalid chat ID');
      }

      const chat = await this.client.getChatById(chatId);
      const messages = await chat.fetchMessages({ limit });

      const messageResponses = await Promise.all(
        messages.map(message => this.convertWhatsAppMessage(message)),
      );

      return messageResponses;
    } catch (error) {
      this.handleError(error, 'getMessages');
    }
  }

  async createGroup(name: string, participants: string[]): Promise<CreateGroupResponse> {
    try {
      if (!this.validateParticipants(participants)) {
        throw new Error('Invalid participants list');
      }

      const participantIds = participants.map(p => (p.includes('@c.us') ? p : `${p}@c.us`));
      const group = await this.client.createGroup(name, participantIds);

      const groupId = typeof group === 'string' ? group : group.gid._serialized;

      return {
        groupId,
        provider: 'whatsapp',
      };
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

      const chat = (await this.client.getChatById(groupId)) as GroupChat;
      const participantIds = participants.map((p: string) =>
        p.includes('@c.us') ? p : `${p}@c.us`,
      );

      await chat.addParticipants(participantIds);

      return {
        success: true,
        added: participants,
        provider: 'whatsapp',
      };
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

  async searchGroups(query: string): Promise<GroupResponse[]> {
    try {
      const chats = await this.client.getChats();
      const groups = chats.filter(chat => chat.isGroup) as GroupChat[];

      const searchQuery = query.toLowerCase();
      const filteredGroups = groups.filter(group => group.name.toLowerCase().includes(searchQuery));

      return filteredGroups.map(group => ({
        id: group.id._serialized,
        name: group.name,
        description: group.description,
        participants: group.participants.map((p: any) => ({
          id: p.id._serialized,
          number: p.id.user,
          name: p.id.user,
          isAdmin: p.isAdmin,
        })),
        createdAt: new Date((Number(group.createdAt) || 0) * 1000).toISOString(),
        provider: 'whatsapp',
        type: 'group',
        memberCount: group.participants.length,
      }));
    } catch (error) {
      this.handleError(error, 'searchGroups');
    }
  }

  async getGroupById(groupId: string): Promise<GroupResponse | null> {
    try {
      if (!this.validateChatId(groupId)) {
        return null;
      }

      const chat = await this.client.getChatById(groupId);
      if (!chat.isGroup) {
        return null;
      }

      const group = chat as GroupChat;

      return {
        id: group.id._serialized,
        name: group.name,
        description: group.description,
        participants: group.participants.map((p: any) => ({
          id: p.id._serialized,
          number: p.id.user,
          name: p.id.user,
          isAdmin: p.isAdmin,
        })),
        createdAt: new Date((Number(group.createdAt) || 0) * 1000).toISOString(),
        provider: 'whatsapp',
        type: 'group',
        memberCount: group.participants.length,
      };
    } catch (error) {
      this.logError('Error getting group by ID', error);
      return null;
    }
  }

  async downloadMediaFromMessage(messageId: string): Promise<MediaResponse> {
    try {
      const message = await this.client.getMessageById(messageId);
      if (!message.hasMedia) {
        throw new Error('Message does not contain media');
      }

      const media = await message.downloadMedia();
      const filename = `${messageId}_${Date.now()}.${mime.extension(media.mimetype) || 'bin'}`;
      const filePath = this.getMediaPath(filename);

      // Создаем директорию если не существует
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Сохраняем файл
      fs.writeFileSync(filePath, media.data, 'base64');

      return {
        filePath,
        mimetype: media.mimetype,
        filename,
        filesize: Buffer.from(media.data, 'base64').length,
        messageId,
        provider: 'whatsapp',
      };
    } catch (error) {
      this.handleError(error, 'downloadMediaFromMessage');
    }
  }

  async sendMediaMessage(params: SendMediaMessageParams): Promise<SendMediaMessageResponse> {
    try {
      if (!params.number || !params.source) {
        throw new Error('Number and source are required');
      }

      const chatId = params.number.includes('@c.us') ? params.number : `${params.number}@c.us`;
      let media: MessageMedia;

      if (params.source.startsWith('http://') || params.source.startsWith('https://')) {
        media = await MessageMedia.fromUrl(params.source, { unsafeMime: true });
      } else if (params.source.startsWith('file://')) {
        const filePath = params.source.replace('file://', '');
        media = MessageMedia.fromFilePath(filePath);
      } else {
        throw new Error('Invalid source format. Use http://, https://, or file:// prefix');
      }

      const sentMessage = await this.client.sendMessage(chatId, media, { caption: params.caption });

      return {
        messageId: sentMessage.id._serialized,
        provider: 'whatsapp',
        mediaInfo: {
          mimetype: media.mimetype,
          filename: media.filename || 'unknown',
          size: media.data ? Buffer.from(media.data, 'base64').length : undefined,
        },
      };
    } catch (error) {
      this.handleError(error, 'sendMediaMessage');
    }
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

  private async convertWhatsAppMessage(message: Message): Promise<MessageResponse> {
    const contact = await message.getContact();

    return {
      id: message.id._serialized,
      body: message.body,
      fromMe: message.fromMe,
      timestamp: new Date(message.timestamp * 1000).toISOString(),
      contact: contact.number,
      type: message.type,
      provider: 'whatsapp',
      chatId: message.from,
    };
  }

  // Дополнительные методы специфичные для WhatsApp
  getWhatsAppClient(): Client {
    return this.client;
  }

  async getQRCode(): Promise<string | null> {
    try {
      // QR код будет получен через событие 'qr'
      return null;
    } catch (error) {
      this.logError('Error getting QR code', error);
      return null;
    }
  }
}
