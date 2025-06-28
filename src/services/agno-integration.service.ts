import axios, { AxiosResponse } from 'axios';
import { Pool } from 'pg';
import logger from '../logger';
const FormData = require('form-data');

export interface AgnoConfig {
  agentId: string;
  enabled: boolean;
  stream: boolean;
  model?: string;
  userId?: string;
  sessionId?: string;
}

export interface AgnoResponse {
  content?: string;
  message?: string;
  response?: string;
  status?: string;
  run_id?: string;
  agent_id?: string;
  session_id?: string;
  metrics?: {
    input_tokens?: number[];
    output_tokens?: number[];
    total_tokens?: number[];
    time?: number[];
  };
}

export interface AgnoApiRequest {
  message: string;
  stream: boolean;
  monitor: boolean;
  model?: string;
  user_id?: string;
  session_id?: string;
  files?: Buffer[];
}

export interface AgnoMediaFile {
  buffer: Buffer;
  filename: string;
  mimetype: string;
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
        SELECT agent_id, agno_enable, stream, model, user_id 
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
        model: row.model || 'gpt-4.1', // Значение по умолчанию
        userId: row.user_id,
        sessionId: undefined, // session_id будет устанавливаться в провайдерах
      };

      logger.debug('Agno config loaded from database', {
        instanceId,
        agentId: config.agentId,
        enabled: config.enabled,
        stream: config.stream,
        model: config.model,
        userId: config.userId,
        sessionId: 'will be set by provider', // Указываем что будет установлен провайдером
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
    return this.sendToAgentWithFiles(agentId, message, config, []);
  }

  /**
   * Отправляет сообщение с файлами в агентную систему и возвращает ответ
   */
  async sendToAgentWithFiles(
    agentId: string,
    message: string,
    config: AgnoConfig,
    files: AgnoMediaFile[] = [],
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

      // Новый URL для multipart API
      const url = `${this.config.baseUrl}/v1/agents/${agentId}/runs/multipart`;

      // Создаем FormData для multipart/form-data запроса
      const formData = new FormData();
      formData.append('message', message.trim());
      formData.append('stream', config.stream.toString());
      
      if (config.model) {
        formData.append('model', config.model);
      }
      
      if (config.userId) {
        formData.append('user_id', config.userId);
      }
      
      if (config.sessionId) {
        formData.append('session_id', config.sessionId);
      }

      // Добавляем файлы если они есть
      if (files && files.length > 0) {
        for (const file of files) {
          formData.append('files', file.buffer, {
            filename: file.filename,
            contentType: file.mimetype,
          });
        }
      }

      logger.debug('Sending message to agno agent', {
        agentId,
        url,
        messageLength: message.length,
        filesCount: files.length,
        stream: config.stream,
        model: config.model,
        userId: config.userId,
        sessionId: config.sessionId,
      });

      const response = await axios.post(url, formData, {
        headers: {
          'Accept': 'application/json',
          ...formData.getHeaders(),
        },
        timeout: this.config.timeout,
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
        dataLength: JSON.stringify(response.data)?.length || 0,
        filesCount: files.length,
        stream: config.stream,
        model: config.model,
      });

      // Обрабатываем новый формат ответа
      const responseData = response.data;
      
      if (!responseData || typeof responseData !== 'object') {
        logger.warn('Agno API returned invalid response format', {
          agentId,
          response: responseData,
        });
        return null;
      }

      // Извлекаем сообщение из нового формата
      const responseMessage = responseData.content || responseData.message || responseData.response;

      if (!responseMessage || responseMessage.trim().length === 0) {
        logger.warn('Agno API returned empty response content', {
          agentId,
          response: responseData,
        });
        return null;
      }

      logger.debug('Received response from agno agent', {
        agentId,
        responseLength: responseMessage.length,
        runId: responseData.run_id,
        sessionId: responseData.session_id,
        metrics: responseData.metrics,
        filesCount: files.length,
        stream: config.stream,
        model: config.model,
      });

      // Возвращаем стандартизированный ответ
      return {
        content: responseMessage,
        message: responseMessage, // Для обратной совместимости
        status: responseData.status || 'completed',
        run_id: responseData.run_id,
        agent_id: responseData.agent_id,
        session_id: responseData.session_id,
        metrics: responseData.metrics,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('Agno API request failed', {
          agentId,
          url: `${this.config.baseUrl}/v1/agents/${agentId}/runs/multipart`,
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: error.message,
          timeout: error.code === 'ECONNABORTED',
          responseData: error.response?.data,
          filesCount: files.length,
          stream: config.stream,
          model: config.model,
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
