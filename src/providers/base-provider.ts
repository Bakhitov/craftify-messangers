import { EventEmitter } from 'events';
import {
  ProviderConfig,
  StatusResponse,
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
  MessengerProvider,
  BulkMessageRequest,
  BulkMessageResponse,
} from '../types';
import { MessageStorageService, MessageData } from '../services/message-storage.service';
import logger from '../logger';

export abstract class BaseMessengerProvider extends EventEmitter {
  protected config: ProviderConfig;
  protected messageStorageService?: MessageStorageService;
  protected instanceId?: string;
  protected isInitialized = false;
  protected isReady = false;

  constructor(config: ProviderConfig, messageStorageService?: MessageStorageService) {
    super();
    this.config = config;
    this.messageStorageService = messageStorageService;
    this.instanceId = config.instanceId;
  }

  // Абстрактные методы, которые должны быть реализованы в каждом провайдере
  abstract initialize(): Promise<void>;
  abstract destroy(): Promise<void>;
  abstract getStatus(): Promise<StatusResponse>;
  abstract sendMessage(to: string, message: string): Promise<SendMessageResponse>;
  abstract getContacts(query?: string): Promise<ContactResponse[]>;
  abstract getChats(): Promise<ChatResponse[]>;
  abstract getMessages(chatId: string, limit?: number): Promise<MessageResponse[]>;
  abstract createGroup(name: string, participants: string[]): Promise<CreateGroupResponse>;
  abstract addParticipantsToGroup(
    groupId: string,
    participants: string[],
  ): Promise<AddParticipantsResponse>;
  abstract getGroupMessages(groupId: string, limit?: number): Promise<MessageResponse[]>;
  abstract sendGroupMessage(groupId: string, message: string): Promise<SendMessageResponse>;
  abstract searchGroups(query: string): Promise<GroupResponse[]>;
  abstract getGroupById(groupId: string): Promise<GroupResponse | null>;
  abstract downloadMediaFromMessage(messageId: string): Promise<MediaResponse>;
  abstract sendMediaMessage(params: SendMediaMessageParams): Promise<SendMediaMessageResponse>;
  abstract sendBulkMessages(request: BulkMessageRequest): Promise<BulkMessageResponse>;

  // Общие методы для всех провайдеров
  getProvider(): MessengerProvider {
    return this.config.provider;
  }

  getInstanceId(): string | undefined {
    return this.instanceId;
  }

  isProviderReady(): boolean {
    return this.isReady;
  }

  isProviderInitialized(): boolean {
    return this.isInitialized;
  }

  protected async storeMessage(message: MessageResponse): Promise<void> {
    if (!this.messageStorageService || !this.instanceId) {
      return;
    }

    try {
      // Пытаемся получить agent_id (может быть переопределено в дочерних классах)
      let agentId: string | undefined;
      try {
        agentId = await this.getAgentId();
      } catch (error) {
        // Игнорируем ошибки получения agent_id для обратной совместимости
      }

      const messageData: MessageData = {
        instance_id: this.instanceId,
        message_id: message.id,
        chat_id: message.chatId || message.contact || '',
        from_number: message.fromMe ? undefined : message.contact || '',
        to_number: message.fromMe ? message.contact || '' : undefined,
        message_body: message.body,
        message_type: message.type || 'text',
        is_group: message.chatId?.includes('@g.us') || false,
        group_id: message.chatId?.includes('@g.us') ? message.chatId : undefined,
        contact_name: message.contact,
        agent_id: agentId,
        timestamp: new Date(message.timestamp).getTime(),
      };

      await this.messageStorageService.saveMessage(messageData);
    } catch (error) {
      logger.error(`Failed to store message for provider ${this.config.provider}:`, error);
    }
  }

  /**
   * Получает agent_id для текущего инстанса
   * Может быть переопределено в дочерних классах
   */
  protected async getAgentId(): Promise<string | undefined> {
    return undefined;
  }

  protected emitEvent(event: string, data: Record<string, unknown>): void {
    this.emit(event, {
      provider: this.config.provider,
      instanceId: this.instanceId,
      ...data,
    });
  }

  // Хелперы для валидации
  protected validateChatId(chatId: string): boolean {
    return Boolean(chatId && chatId.trim().length > 0);
  }

  protected validateMessage(message: string): boolean {
    return Boolean(message && message.trim().length > 0);
  }

  protected validateParticipants(participants: string[]): boolean {
    return participants && participants.length > 0 && participants.every(p => p.trim().length > 0);
  }

  // Методы для работы с медиа
  protected getMediaPath(filename: string): string {
    const mediaPath = this.config.mediaStoragePath || '.media';
    return `${mediaPath}/${this.config.provider}/${this.instanceId}/${filename}`;
  }

  protected generateMessageId(): string {
    return `${this.config.provider}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Методы для обработки ошибок
  protected handleError(error: Error | unknown, context: string): never {
    const errorMessage = `${this.config.provider} provider error in ${context}: ${error instanceof Error ? error.message : String(error)}`;
    logger.error(errorMessage, error);
    this.emitEvent('error', { error: errorMessage, context });
    throw new Error(errorMessage);
  }

  protected logInfo(message: string, data?: Record<string, unknown>): void {
    logger.info(`[${this.config.provider.toUpperCase()}] ${message}`, data);
  }

  protected logError(message: string, error?: Error | unknown): void {
    logger.error(`[${this.config.provider.toUpperCase()}] ${message}`, error);
  }

  protected logDebug(message: string, data?: Record<string, unknown>): void {
    logger.debug(`[${this.config.provider.toUpperCase()}] ${message}`, data);
  }
}
