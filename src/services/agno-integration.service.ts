import axios, { AxiosResponse } from 'axios';
import { Pool } from 'pg';
import logger from '../logger';

export interface AgnoConfig {
  agentId: string;
  enabled: boolean;
  stream: boolean;
  userId?: string;
}

export interface AgnoResponse {
  message?: string;
  response?: string;
  status?: string;
  metadata?: {
    agent_id?: string;
    run_id?: string;
  };
}

export interface AgnoApiRequest {
  message: string;
  stream: boolean;
  user_id?: string;
  session_id?: string;
}

export interface AgnoEnvironmentConfig {
  baseUrl: string;
  timeout: number;
  enabled: boolean;
}

export class AgnoIntegrationService {
  private readonly config: AgnoEnvironmentConfig;
  private readonly dbPool: Pool;

  constructor(dbPool: Pool) {
    this.dbPool = dbPool;
    this.config = {
      baseUrl: process.env.AGNO_API_BASE_URL || 'http://localhost:8000',
      timeout: parseInt(process.env.AGNO_API_TIMEOUT || '10000'),
      enabled: process.env.AGNO_ENABLED === 'true',
    };

    logger.debug('AgnoIntegrationService initialized', {
      baseUrl: this.config.baseUrl,
      timeout: this.config.timeout,
      enabled: this.config.enabled,
    });
  }

  /**
   * Получает конфигурацию агента для указанного инстанса из БД
   */
  async getAgnoConfig(instanceId: string): Promise<AgnoConfig | null> {
    try {
      // Проверяем глобальное включение агентной системы
      if (!this.config.enabled) {
        logger.debug('Agno integration globally disabled');
        return null;
      }

      const query = `
        SELECT agent_id, agno_enable, stream, user_id 
        FROM public.message_instances 
        WHERE id = $1 
          AND agno_enable = TRUE 
          AND agent_id IS NOT NULL
      `;

      const result = await this.dbPool.query(query, [instanceId]);

      if (result.rows.length === 0) {
        logger.debug('No active agno config found for instance', { instanceId });
        return null;
      }

      const row = result.rows[0];
      const config: AgnoConfig = {
        agentId: row.agent_id,
        enabled: row.agno_enable,
        stream: row.stream,
        userId: row.user_id,
      };

      logger.debug('Agno config loaded from database', {
        instanceId,
        agentId: config.agentId,
        enabled: config.enabled,
        stream: config.stream,
        userId: config.userId,
      });

      return config;
    } catch (error) {
      logger.error('Failed to load agno config from database', {
        instanceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Отправляет сообщение в агентную систему и возвращает ответ
   */
  async sendToAgent(
    agentId: string,
    message: string,
    config: AgnoConfig,
  ): Promise<AgnoResponse | null> {
    try {
      if (!this.config.enabled) {
        logger.debug('Agno integration globally disabled, skipping agent request');
        return null;
      }

      if (!message || message.trim().length === 0) {
        logger.warn('Empty message provided to agno agent', { agentId });
        return null;
      }

      const url = `${this.config.baseUrl}/v1/agents/${agentId}/runs`;
      const payload: AgnoApiRequest = {
        message: message.trim(),
        stream: config.stream,
        user_id: config.userId,
        session_id: config.userId, // Используем user_id как session_id
      };

      logger.debug('Sending message to agno agent', {
        agentId,
        url,
        messageLength: message.length,
        stream: config.stream,
        userId: config.userId,
      });

      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: this.config.timeout,
        responseType: 'text', // Получаем ответ как текст для обработки всех форматов
      });

      if (response.status < 200 || response.status >= 300) {
        logger.warn('Agno API returned non-success status', {
          agentId,
          status: response.status,
          statusText: response.statusText,
        });
        return null;
      }

      logger.debug('Raw Agno API response', {
        agentId,
        status: response.status,
        contentType: response.headers['content-type'],
        dataLength: response.data?.length || 0,
        stream: config.stream,
      });

      // Парсим ответ в зависимости от режима stream и Content-Type
      let agnoResponse: any = null;
      const contentType = response.headers['content-type'] || '';

      if (config.stream && contentType.includes('text/event-stream')) {
        // Обрабатываем SSE формат для stream=true
        const responseText = response.data as string;
        logger.debug('Processing SSE response (stream=true)', { responseText });

        agnoResponse = {
          message: responseText.trim(),
          status: 'completed',
        };
      } else if (!config.stream && contentType.includes('application/json')) {
        // Обрабатываем JSON ответ для stream=false
        logger.debug('Processing JSON response (stream=false)');
        try {
          // Ответ уже в виде строки JSON, парсим его
          const jsonData = JSON.parse(response.data);
          agnoResponse = {
            message: jsonData, // Сам JSON уже содержит строку ответа
            status: 'completed',
          };
        } catch (parseError) {
          // Если не удалось распарсить как JSON, используем как обычный текст
          agnoResponse = {
            message: response.data.toString().trim(),
            status: 'completed',
          };
        }
      } else {
        // Обрабатываем как обычный текст (fallback)
        agnoResponse = {
          message: response.data.toString().trim(),
          status: 'completed',
        };
      }

      // Поддерживаем оба формата: message и response
      const responseMessage = agnoResponse?.message || agnoResponse?.response;

      if (!agnoResponse || !responseMessage || responseMessage.trim().length === 0) {
        logger.warn('Agno API returned empty response', {
          agentId,
          response: agnoResponse,
          contentType,
          stream: config.stream,
        });
        return null;
      }

      logger.debug('Received response from agno agent', {
        agentId,
        responseLength: responseMessage.length,
        status: agnoResponse.status,
        runId: agnoResponse.metadata?.run_id,
        stream: config.stream,
      });

      // Возвращаем стандартизированный ответ с полем message
      return {
        ...agnoResponse,
        message: responseMessage,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('Agno API request failed', {
          agentId,
          url: `${this.config.baseUrl}/v1/agents/${agentId}/runs`,
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: error.message,
          timeout: error.code === 'ECONNABORTED',
          responseData: error.response?.data,
          stream: config.stream,
        });
      } else {
        logger.error('Unexpected error in agno integration', {
          agentId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return null;
    }
  }

  /**
   * Проверяет доступность агентной системы
   */
  async checkAgnoHealth(): Promise<boolean> {
    try {
      if (!this.config.enabled) {
        return false;
      }

      const response = await axios.get(`${this.config.baseUrl}/health`, {
        timeout: 5000,
      });

      return response.status >= 200 && response.status < 300;
    } catch (error) {
      logger.debug('Agno health check failed', {
        baseUrl: this.config.baseUrl,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Возвращает текущую конфигурацию агентной системы
   */
  getConfig(): AgnoEnvironmentConfig {
    return { ...this.config };
  }
}
