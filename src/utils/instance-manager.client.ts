import axios, { AxiosInstance, AxiosResponse } from 'axios';
import logger from '../logger';

export interface CreateInstanceRequest {
  user_id: string;
  provider: 'whatsappweb' | 'telegram';
  type_instance: string[];
  config?: {
    bot_token?: string; // Для Telegram
  };
  api_webhook_schema?: {
    url: string;
    headers?: Record<string, string>;
    enabled?: boolean;
  };
}

export interface CreateInstanceResponse {
  success: boolean;
  instance_id: string;
  message: string;
  process_result: {
    success: boolean;
    details: {
      ports: Record<string, number>;
      api_key: string;
    };
  };
}

export interface InstanceInfo {
  id: string;
  user_id: string;
  provider: string;
  type_instance: string[];
  status: string;
  auth_status: string;
  ports?: Record<string, number>;
  account?: string;
  created_at: string;
  updated_at: string;
}

export interface ApiKeyResponse {
  success: boolean;
  data: {
    api_key: string;
    generated_at: string;
    last_use?: string;
    usage_count: number;
  };
}

export interface InstanceLogEntry {
  timestamp: string;
  level: string;
  message: string;
  source?: string;
}

export interface InstanceLogsResponse {
  success: boolean;
  message?: string;
  data: {
    logs: InstanceLogEntry[];
    total_lines: number;
    tail: number;
  };
}

/**
 * Клиент для работы с Instance Manager API
 *
 * @example
 * ```typescript
 * const client = new InstanceManagerClient('http://localhost:3000');
 *
 * // Создание WhatsApp инстанса
 * const whatsappInstance = await client.createWhatsAppInstance('user-001', {
 *   url: 'https://webhook.example.com/whatsapp',
 *   headers: { 'Authorization': 'Bearer token' }
 * });
 *
 * // Создание Telegram инстанса
 * const telegramInstance = await client.createTelegramInstance(
 *   'user-002',
 *   '123456789:AABBCCDDEEFFgghhiijjkkll',
 *   { url: 'https://webhook.example.com/telegram' }
 * );
 *
 * // Получение API ключа
 * const apiKey = await client.getInstanceApiKey(whatsappInstance);
 * ```
 */
export class InstanceManagerClient {
  private axios: AxiosInstance;
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.axios = axios.create({
      baseURL: baseUrl,
      timeout: 30000, // 30 секунд таймаут
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WhatsApp-Web-MCP-Client/1.0',
      },
    });

    // Логирование запросов
    this.axios.interceptors.request.use(
      config => {
        logger.debug('Instance Manager API request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          data: config.data,
        });
        return config;
      },
      error => {
        logger.error('Instance Manager API request error', error);
        return Promise.reject(error);
      },
    );

    // Логирование ответов
    this.axios.interceptors.response.use(
      response => {
        logger.debug('Instance Manager API response', {
          status: response.status,
          url: response.config.url,
          data: response.data,
        });
        return response;
      },
      error => {
        logger.error('Instance Manager API response error', {
          status: error.response?.status,
          url: error.config?.url,
          error: error.response?.data || error.message,
        });
        return Promise.reject(error);
      },
    );
  }

  /**
   * Создает новый WhatsApp инстанс
   *
   * @param userId - Идентификатор пользователя
   * @param webhookConfig - Конфигурация webhook (опционально)
   * @returns ID созданного инстанса
   */
  async createWhatsAppInstance(
    userId: string,
    webhookConfig?: {
      url: string;
      headers?: Record<string, string>;
      enabled?: boolean;
    },
  ): Promise<string> {
    try {
      const requestData: CreateInstanceRequest = {
        user_id: userId,
        provider: 'whatsappweb',
        type_instance: ['api'],
        api_webhook_schema: webhookConfig
          ? {
              url: webhookConfig.url,
              headers: webhookConfig.headers || {},
              enabled: webhookConfig.enabled !== false,
            }
          : undefined,
      };

      const response: AxiosResponse<CreateInstanceResponse> = await this.axios.post(
        '/api/v1/instances',
        requestData,
      );

      if (!response.data.success) {
        throw new Error(`Failed to create WhatsApp instance: ${response.data.message}`);
      }

      logger.info('WhatsApp instance created successfully', {
        instanceId: response.data.instance_id,
        userId,
        ports: response.data.process_result.details.ports,
      });

      return response.data.instance_id;
    } catch (error) {
      logger.error('Failed to create WhatsApp instance', {
        userId,
        webhookConfig,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Создает новый Telegram инстанс
   *
   * @param userId - Идентификатор пользователя
   * @param botToken - Токен Telegram бота
   * @param webhookConfig - Конфигурация webhook (опционально)
   * @returns ID созданного инстанса
   */
  async createTelegramInstance(
    userId: string,
    botToken: string,
    webhookConfig?: {
      url: string;
      headers?: Record<string, string>;
      enabled?: boolean;
    },
  ): Promise<string> {
    try {
      const requestData: CreateInstanceRequest = {
        user_id: userId,
        provider: 'telegram',
        type_instance: ['api'],
        config: {
          bot_token: botToken,
        },
        api_webhook_schema: webhookConfig
          ? {
              url: webhookConfig.url,
              headers: webhookConfig.headers || {},
              enabled: webhookConfig.enabled !== false,
            }
          : undefined,
      };

      const response: AxiosResponse<CreateInstanceResponse> = await this.axios.post(
        '/api/v1/instances',
        requestData,
      );

      if (!response.data.success) {
        throw new Error(`Failed to create Telegram instance: ${response.data.message}`);
      }

      logger.info('Telegram instance created successfully', {
        instanceId: response.data.instance_id,
        userId,
        ports: response.data.process_result.details.ports,
      });

      return response.data.instance_id;
    } catch (error) {
      logger.error('Failed to create Telegram instance', {
        userId,
        botToken: botToken.substring(0, 8) + '...',
        webhookConfig,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Получает список всех инстансов
   *
   * @returns Массив инстансов
   */
  async getAllInstances(): Promise<InstanceInfo[]> {
    try {
      const response = await this.axios.get('/api/v1/instances');
      return response.data.data || [];
    } catch (error) {
      logger.error('Failed to get instances list', error);
      throw error;
    }
  }

  /**
   * Получает информацию об инстансе
   *
   * @param instanceId - ID инстанса
   * @returns Информация об инстансе
   */
  async getInstance(instanceId: string): Promise<InstanceInfo | null> {
    try {
      const response = await this.axios.get(`/api/v1/instances/${instanceId}`);
      return response.data.data || null;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      logger.error('Failed to get instance info', { instanceId, error });
      throw error;
    }
  }

  /**
   * Получает API ключ инстанса (всегда равен instanceId)
   *
   * @param instanceId - ID инстанса
   * @returns API ключ
   */
  async getInstanceApiKey(instanceId: string): Promise<string> {
    try {
      const response: AxiosResponse<ApiKeyResponse> = await this.axios.get(
        `/api/v1/instances/${instanceId}/api-key`,
      );

      if (!response.data.success) {
        throw new Error('Failed to get API key from response');
      }

      return response.data.data.api_key;
    } catch (error) {
      logger.error('Failed to get instance API key', { instanceId, error });
      throw error;
    }
  }

  /**
   * Запускает инстанс
   *
   * @param instanceId - ID инстанса
   */
  async startInstance(instanceId: string): Promise<void> {
    try {
      const response = await this.axios.post(`/api/v1/instances/${instanceId}/start`);

      if (!response.data.success) {
        throw new Error(`Failed to start instance: ${response.data.message}`);
      }

      logger.info('Instance started successfully', { instanceId });
    } catch (error) {
      logger.error('Failed to start instance', { instanceId, error });
      throw error;
    }
  }

  /**
   * Останавливает инстанс
   *
   * @param instanceId - ID инстанса
   */
  async stopInstance(instanceId: string): Promise<void> {
    try {
      const response = await this.axios.post(`/api/v1/instances/${instanceId}/stop`);

      if (!response.data.success) {
        throw new Error(`Failed to stop instance: ${response.data.message}`);
      }

      logger.info('Instance stopped successfully', { instanceId });
    } catch (error) {
      logger.error('Failed to stop instance', { instanceId, error });
      throw error;
    }
  }

  /**
   * Перезапускает инстанс
   *
   * @param instanceId - ID инстанса
   */
  async restartInstance(instanceId: string): Promise<void> {
    try {
      const response = await this.axios.post(`/api/v1/instances/${instanceId}/restart`);

      if (!response.data.success) {
        throw new Error(`Failed to restart instance: ${response.data.message}`);
      }

      logger.info('Instance restarted successfully', { instanceId });
    } catch (error) {
      logger.error('Failed to restart instance', { instanceId, error });
      throw error;
    }
  }

  /**
   * Удаляет инстанс
   *
   * @param instanceId - ID инстанса
   */
  async deleteInstance(instanceId: string): Promise<void> {
    try {
      const response = await this.axios.delete(`/api/v1/instances/${instanceId}`);

      if (!response.data.success) {
        throw new Error(`Failed to delete instance: ${response.data.message}`);
      }

      logger.info('Instance deleted successfully', { instanceId });
    } catch (error) {
      logger.error('Failed to delete instance', { instanceId, error });
      throw error;
    }
  }

  /**
   * Получает QR код для WhatsApp инстанса
   *
   * @param instanceId - ID инстанса
   * @returns URL для получения QR кода
   */
  async getQRCode(instanceId: string): Promise<string> {
    try {
      const response = await this.axios.get(`/api/v1/instances/${instanceId}/qr`);

      if (!response.data.success) {
        throw new Error(`Failed to get QR code: ${response.data.message}`);
      }

      return response.data.data.qr_url || response.data.data.url;
    } catch (error) {
      logger.error('Failed to get QR code', { instanceId, error });
      throw error;
    }
  }

  /**
   * Проверяет статус аутентификации
   *
   * @param instanceId - ID инстанса
   * @returns Статус аутентификации
   */
  async getAuthStatus(instanceId: string): Promise<{
    status: string;
    authenticated: boolean;
    account?: string;
  }> {
    try {
      const response = await this.axios.get(`/api/v1/instances/${instanceId}/auth-status`);

      if (!response.data.success) {
        throw new Error(`Failed to get auth status: ${response.data.message}`);
      }

      return response.data.data;
    } catch (error) {
      logger.error('Failed to get auth status', { instanceId, error });
      throw error;
    }
  }

  /**
   * Получает логи инстанса
   *
   * @param instanceId - ID инстанса
   * @param tail - Количество последних строк (по умолчанию 100)
   * @returns Логи инстанса
   */
  async getInstanceLogs(instanceId: string, tail: number = 100): Promise<InstanceLogEntry[]> {
    try {
      const response: AxiosResponse<InstanceLogsResponse> = await this.axios.get(
        `/api/v1/instances/${instanceId}/logs`,
        { params: { tail } },
      );

      if (!response.data.success) {
        throw new Error(`Failed to get logs: ${response.data.message}`);
      }

      return response.data.data.logs;
    } catch (error) {
      logger.error('Failed to get instance logs', { instanceId, tail, error });
      throw error;
    }
  }

  /**
   * Проверяет доступность Instance Manager API
   *
   * @returns true если API доступен
   */
  async ping(): Promise<boolean> {
    try {
      const response = await this.axios.get('/api/health');
      return response.status === 200;
    } catch (error) {
      logger.warn('Instance Manager API ping failed', error);
      return false;
    }
  }

  /**
   * Устанавливает базовый URL для API
   *
   * @param baseUrl - Новый базовый URL
   */
  setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl;
    this.axios.defaults.baseURL = baseUrl;
    logger.info('Instance Manager client base URL updated', { baseUrl });
  }

  /**
   * Получает текущий базовый URL
   *
   * @returns Текущий базовый URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }
}

/**
 * Глобальный экземпляр клиента Instance Manager
 * Можно использовать из любого места в приложении
 */
export const instanceManagerClient = new InstanceManagerClient();

/**
 * Фабричная функция для создания клиента с кастомным URL
 *
 * @param baseUrl - Базовый URL Instance Manager API
 * @returns Новый экземпляр клиента
 */
export function createInstanceManagerClient(baseUrl: string): InstanceManagerClient {
  return new InstanceManagerClient(baseUrl);
}
