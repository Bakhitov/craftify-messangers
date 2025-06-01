import { ClientInfo } from 'whatsapp-web.js';

// Общие типы для провайдеров мессенджеров
export type MessengerProvider = 'whatsapp' | 'telegram';

export interface BaseProviderConfig {
  provider: MessengerProvider;
  authDataPath: string;
  authStrategy: 'local' | 'none';
  dockerContainer: boolean;
  mediaStoragePath?: string;
  instanceId?: string;
}

export interface WhatsAppConfig extends BaseProviderConfig {
  provider: 'whatsapp';
}

export interface TelegramConfig extends BaseProviderConfig {
  provider: 'telegram';
  botToken: string;
  webhookUrl?: string;
  webhookSecret?: string;
}

export type ProviderConfig = WhatsAppConfig | TelegramConfig;

// Общие интерфейсы для всех провайдеров
export interface BaseStatusResponse {
  provider: MessengerProvider;
  status: string;
  state?: string;
}

export interface WhatsAppStatusResponse extends BaseStatusResponse {
  provider: 'whatsapp';
  info: ClientInfo | undefined;
  qr?: string;
  state?: 'QR_READY' | 'READY' | 'DISCONNECTED';
}

export interface TelegramStatusResponse extends BaseStatusResponse {
  provider: 'telegram';
  info?: {
    id: number;
    firstName: string;
    lastName?: string;
    username?: string;
    isBot: boolean;
  };
  state?: 'READY' | 'DISCONNECTED' | 'ERROR';
}

export type StatusResponse = WhatsAppStatusResponse | TelegramStatusResponse;

export interface ContactResponse {
  name: string;
  number: string;
  provider?: MessengerProvider;
  userId?: string; // Для Telegram
}

export interface ChatResponse {
  id: string;
  name: string;
  unreadCount: number;
  timestamp: string;
  lastMessage?: string;
  provider?: MessengerProvider;
  type?: 'private' | 'group' | 'supergroup' | 'channel'; // Для Telegram
}

export interface MessageResponse {
  id: string;
  body: string;
  fromMe: boolean;
  timestamp: string;
  contact?: string;
  type?: string;
  provider?: MessengerProvider;
  chatId?: string; // Для Telegram
  messageThreadId?: number; // Для Telegram topics
}

export interface SendMessageResponse {
  messageId: string;
  provider?: MessengerProvider;
}

export interface GroupResponse {
  id: string;
  name: string;
  description?: string;
  participants: GroupParticipant[];
  createdAt: string;
  provider?: MessengerProvider;
  type?: 'group' | 'supergroup' | 'channel'; // Для Telegram
  memberCount?: number; // Для Telegram
}

export interface GroupParticipant {
  id: string;
  number?: string; // WhatsApp
  userId?: string; // Telegram
  name?: string;
  isAdmin: boolean;
  username?: string; // Для Telegram
}

export interface CreateGroupResponse {
  groupId: string;
  inviteCode?: string;
  inviteLink?: string; // Для Telegram
  provider?: MessengerProvider;
}

export interface AddParticipantsResponse {
  success: boolean;
  added: string[];
  failed?: { number?: string; userId?: string; reason: string }[];
  provider?: MessengerProvider;
}

export interface MediaResponse {
  filePath: string;
  mimetype: string;
  filename: string;
  filesize: number;
  messageId: string;
  provider?: MessengerProvider;
}

export interface SendMediaMessageParams {
  number?: string; // WhatsApp
  chatId?: string; // Telegram
  source: string; // URI scheme format: URLs must use http:// or https:// prefixes, local files must use file:// prefix
  caption?: string;
  provider?: MessengerProvider;
}

export interface SendMediaMessageResponse extends SendMessageResponse {
  mediaInfo: {
    mimetype: string;
    filename: string;
    size?: number;
  };
}

// Telegram специфичные типы для grammY
export interface TelegramSendMessageParams {
  chatId: string | number;
  message: string;
  parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML';
  replyToMessageId?: number;
  disableWebPagePreview?: boolean;
  disableNotification?: boolean;
}

export interface TelegramChannelResponse {
  id: string;
  title: string;
  username?: string;
  description?: string;
  memberCount?: number;
  isChannel: boolean;
  isGroup: boolean;
  isSupergroup: boolean;
}

// Дополнительные типы для улучшения типизации
export interface ApiErrorResponse {
  error: string;
  details?: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ContactFilters {
  search?: string;
  isUser?: boolean;
  isGroup?: boolean;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  error?: string;
}

export interface Metrics {
  requestCount: number;
  avgResponseTime: number;
  errorRate: number;
  uptime: number;
}

// Расширенный интерфейс для WhatsApp клиента
export interface ExtendedClient {
  currentQrCode?: string;
  lastActivity?: Date;
  connectionAttempts?: number;
}

// Конфигурация приложения
export interface AppConfig {
  app: {
    port: number;
    env: string;
    logLevel: string;
  };
  database: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl?: boolean;
  };
  whatsapp: {
    authStrategy: 'local' | 'none';
    mediaPath: string;
    maxConnections: number;
  };
  telegram: {
    botToken?: string;
    enabled: boolean;
    webhookUrl?: string;
    webhookSecret?: string;
  };
  agno: {
    baseUrl: string;
    timeout: number;
    enabled: boolean;
  };
}
