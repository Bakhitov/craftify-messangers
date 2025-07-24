import { BaseMessengerProvider } from './base-provider';
import { MessageStorageService } from '../services/message-storage.service';
import {
  InstagramConfig,
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
  BulkMessageRequest,
  BulkMessageResponse,
} from '../types';

export class InstagramProvider extends BaseMessengerProvider {
  constructor(config: InstagramConfig, messageStorageService?: MessageStorageService) {
    super(config, messageStorageService);
  }

  async initialize(): Promise<void> {
    this.logInfo('Instagram provider initialized (placeholder)');
    this.isInitialized = true;
  }

  async destroy(): Promise<void> {
    this.logInfo('Instagram provider destroyed');
    this.isInitialized = false;
    this.isReady = false;
  }

  async getStatus(): Promise<StatusResponse> {
    return {
      provider: 'instagram',
      status: 'ready',
      state: 'READY',
      info: {
        userId: 'placeholder',
        username: 'placeholder',
        accountType: 'business',
      },
    };
  }

  async sendMessage(_to: string, _message: string): Promise<SendMessageResponse> {
    this.logError('Instagram sendMessage not implemented');
    throw new Error('Instagram provider not implemented');
  }

  async getContacts(_query?: string): Promise<ContactResponse[]> {
    return [];
  }

  async getChats(): Promise<ChatResponse[]> {
    return [];
  }

  async getMessages(_chatId: string, _limit?: number): Promise<MessageResponse[]> {
    return [];
  }

  async createGroup(_name: string, _participants: string[]): Promise<CreateGroupResponse> {
    throw new Error('Instagram provider not implemented');
  }

  async addParticipantsToGroup(
    _groupId: string,
    _participants: string[],
  ): Promise<AddParticipantsResponse> {
    throw new Error('Instagram provider not implemented');
  }

  async getGroupMessages(_groupId: string, _limit?: number): Promise<MessageResponse[]> {
    return [];
  }

  async sendGroupMessage(_groupId: string, _message: string): Promise<SendMessageResponse> {
    throw new Error('Instagram provider not implemented');
  }

  async searchGroups(_query: string): Promise<GroupResponse[]> {
    return [];
  }

  async getGroupById(_groupId: string): Promise<GroupResponse | null> {
    return null;
  }

  async downloadMediaFromMessage(_messageId: string): Promise<MediaResponse> {
    throw new Error('Instagram provider not implemented');
  }

  async sendMediaMessage(_params: SendMediaMessageParams): Promise<SendMediaMessageResponse> {
    throw new Error('Instagram provider not implemented');
  }

  async sendBulkMessages(_request: BulkMessageRequest): Promise<BulkMessageResponse> {
    throw new Error('Instagram provider not implemented');
  }
}
