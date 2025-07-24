import axios from 'axios';
import {
  MessageInstance,
  AuthStatusResponse,
  QRCodeResponse,
  CredentialsResponse,
} from '../models/instance.model';
import { DockerService } from './docker.service';
import { NamingUtils } from '../utils/naming.utils';
import { ConnectionUtils } from '../utils/connection.utils';
import logger from '../../logger';
import { DatabaseService } from './database.service';
import { instanceMemoryService } from './instance-memory.service';

export class InstanceMonitorService {
  private databaseService: DatabaseService | null = null;

  constructor(
    private dockerService: DockerService,
    databaseService?: DatabaseService,
  ) {
    if (databaseService) {
      this.databaseService = databaseService;
    }
  }

  async getAuthStatus(instance: MessageInstance): Promise<AuthStatusResponse> {
    // Обновляем статус в памяти - начало проверки
    instanceMemoryService.updateStatus(instance.id, 'start', {
      source: 'instance-monitor.service.ts:getAuthStatus',
      message: 'Starting auth status check',
    });

    if (!instance.port_api) {
      instanceMemoryService.updateStatus(instance.id, 'error', {
        source: 'instance-monitor.service.ts:getAuthStatus',
        message: 'No API port configured',
      });
      return {
        auth_status: 'failed',
        is_ready_for_messages: false,
      };
    }

    try {
      // Проверяем статус контейнеров
      const dockerStatus = await this.dockerService.getComposeStatus(instance.id);
      if (!dockerStatus.running) {
        instanceMemoryService.updateStatus(instance.id, 'error', {
          source: 'instance-monitor.service.ts:getAuthStatus',
          message: 'Docker containers not running',
        });
        return {
          auth_status: 'failed',
          is_ready_for_messages: false,
        };
      }

      // Если нет API ключа, возвращаем pending
      if (!instance.api_key) {
        instanceMemoryService.updateStatus(instance.id, 'start', {
          source: 'instance-monitor.service.ts:getAuthStatus',
          message: 'No API key available, waiting for generation',
        });
        return {
          auth_status: 'pending',
          is_ready_for_messages: false,
        };
      }

      // УЛУЧШЕНИЕ: Получаем предыдущий статус из памяти
      const memoryData = instanceMemoryService.getInstance(instance.id);
      const previousAuthStatus = memoryData?.auth_status || 'pending';

      // Проверяем доступность API с увеличенным таймаутом
      const apiAccessible = await ConnectionUtils.isApiAccessible(
        instance.id,
        instance.port_api,
        10000,
      ); // Увеличено до 10 секунд
      if (!apiAccessible) {
        instanceMemoryService.updateStatus(instance.id, 'start', {
          source: 'instance-monitor.service.ts:getAuthStatus',
          message: `API not accessible on port ${instance.port_api}, container may be starting`,
        });

        // УЛУЧШЕНИЕ: Сохраняем стабильный статус если он был client_ready
        if (previousAuthStatus === 'client_ready') {
          logger.warn(
            `API temporarily unavailable for instance ${instance.id}, keeping previous status: ${previousAuthStatus}`,
          );
          return {
            auth_status: previousAuthStatus,
            is_ready_for_messages: true,
            whatsapp_state: memoryData?.whatsapp_state,
            account: memoryData?.whatsapp_user?.account,
            phone_number: memoryData?.whatsapp_user?.phone_number,
            last_seen: new Date().toISOString(),
          };
        }

        return {
          auth_status: 'pending',
          is_ready_for_messages: false,
        };
      }

      // Обновляем статус - API ключ готов
      instanceMemoryService.updateStatus(instance.id, 'start', {
        source: 'instance-monitor.service.ts:getAuthStatus',
        message: `API key available, checking ${instance.provider} status`,
      });

      // Определяем endpoint в зависимости от провайдера
      let statusEndpoint: string;
      const headers: any = {};

      if (instance.provider === 'telegram') {
        statusEndpoint = `/api/v1/telegram/status`;
        // Добавляем Authorization header для Telegram тоже
        headers.Authorization = `Bearer ${instance.api_key}`;
      } else {
        // Для WhatsApp и других провайдеров
        statusEndpoint = `/api/v1/status`;
        headers.Authorization = `Bearer ${instance.api_key}`;
      }

      // Запрашиваем статус у API с увеличенным таймаутом
      const apiUrl = ConnectionUtils.getApiUrl(instance.id, instance.port_api);
      logger.debug(`Connecting to ${apiUrl}${statusEndpoint} for instance ${instance.id}`);
      const response = await axios.get(`${apiUrl}${statusEndpoint}`, {
        headers,
        timeout: 10000, // Увеличено до 10 секунд
      });

      const data = response.data;

      // Определяем статус аутентификации в зависимости от провайдера
      let authStatus: string = 'pending';
      let isReady = false;
      let memoryStatus: 'qr_ready' | 'auth_success' | 'client_ready' = 'qr_ready';
      let providerState = '';

      if (instance.provider === 'telegram') {
        // Логика для Telegram
        if (data.state === 'READY' && data.info) {
          authStatus = 'client_ready';
          memoryStatus = 'client_ready';
          isReady = true;
          providerState = data.state;

          // Сохраняем информацию о Telegram боте
          instanceMemoryService.markClientReady(instance.id);
          instanceMemoryService.markAuthenticationSuccess(instance.id, {
            phone_number: data.info?.username
              ? `@${data.info.username}`
              : data.info?.id?.toString(),
            account: data.info?.firstName || data.info?.username,
          });
        } else if (data.status === 'connected') {
          authStatus = 'client_ready';
          memoryStatus = 'client_ready';
          isReady = true;
          providerState = 'READY';
        } else {
          authStatus = 'pending';
          memoryStatus = 'qr_ready';
          providerState = data.state || 'DISCONNECTED';
        }
      } else {
        // Логика для WhatsApp
        if (data.state === 'READY' && data.info?.me) {
          authStatus = 'client_ready';
          memoryStatus = 'client_ready';
          isReady = true;
          providerState = data.state;

          // Сохраняем информацию о пользователе
          instanceMemoryService.markClientReady(instance.id);
          instanceMemoryService.markAuthenticationSuccess(instance.id, {
            phone_number: data.info?.me?.id?._serialized,
            account: data.info?.me?.pushname,
          });
        } else if (data.state === 'AUTHENTICATED') {
          authStatus = 'authenticated';
          memoryStatus = 'auth_success';
          providerState = data.state;
          instanceMemoryService.markAuthenticationSuccess(instance.id, {
            phone_number: data.info?.me?.id?._serialized,
            account: data.info?.me?.pushname,
          });
        } else if (data.qr) {
          authStatus = 'qr_ready';
          memoryStatus = 'qr_ready';
          providerState = data.state || 'QR_READY';
          // Сохраняем QR код в память
          instanceMemoryService.saveQRCode(instance.id, data.qr, {
            text: data.qrText,
            source: 'instance-monitor.service.ts:getAuthStatus',
          });
        } else {
          providerState = data.state || 'DISCONNECTED';
        }
      }

      // Обновляем статус в памяти
      instanceMemoryService.updateStatus(instance.id, memoryStatus, {
        source: 'instance-monitor.service.ts:getAuthStatus',
        message: `${instance.provider} state: ${providerState}`,
        whatsapp_state: instance.provider === 'whatsappweb' ? providerState : undefined,
      });

      // Отмечаем использование API ключа
      instanceMemoryService.markApiKeyUsage(instance.id);

      return {
        auth_status: authStatus,
        whatsapp_state: instance.provider === 'whatsappweb' ? providerState : undefined,
        phone_number:
          instance.provider === 'telegram'
            ? data.info?.username
              ? `@${data.info.username}`
              : data.info?.id?.toString()
            : data.info?.me?.id?._serialized,
        account:
          instance.provider === 'telegram'
            ? data.info?.firstName || data.info?.username
            : data.info?.me?.pushname,
        is_ready_for_messages: isReady,
        last_seen: new Date().toISOString(),
      };
    } catch (error) {
      // Более детальная обработка ошибок
      let errorMessage = 'Unknown error';
      let shouldReturnPending = false;
      let shouldPreservePreviousStatus = false;

      if (error instanceof Error) {
        if (error.message.includes('ECONNREFUSED')) {
          errorMessage = 'Connection refused - API server may be starting';
          shouldReturnPending = true;
          shouldPreservePreviousStatus = true; // УЛУЧШЕНИЕ: сохраняем предыдущий статус при временных проблемах
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Request timeout - API server may be overloaded';
          shouldReturnPending = true;
          shouldPreservePreviousStatus = true; // УЛУЧШЕНИЕ: сохраняем предыдущий статус при таймаутах  
        } else if (error.message.includes('ENOTFOUND')) {
          errorMessage = 'Host not found - networking issue';
        } else {
          errorMessage = error.message;
        }
      }

      logger.error(`Failed to get auth status for instance ${instance.id}: ${errorMessage}`, error);

      instanceMemoryService.registerError(
        instance.id,
        `Auth status check failed: ${errorMessage}`,
        {
          source: 'instance-monitor.service.ts:getAuthStatus',
          stack: error instanceof Error ? error.stack : undefined,
        },
      );

      // УЛУЧШЕНИЕ: Сохраняем стабильный статус при временных проблемах
      if (shouldPreservePreviousStatus) {
        const memoryData = instanceMemoryService.getInstance(instance.id);
        const previousAuthStatus = memoryData?.auth_status || 'pending';
        
        if (previousAuthStatus === 'client_ready') {
          logger.warn(`Temporary error for instance ${instance.id}: ${errorMessage}, keeping previous status: ${previousAuthStatus}`);
          return {
            auth_status: previousAuthStatus,
            is_ready_for_messages: true,
            whatsapp_state: memoryData?.whatsapp_state,
            account: memoryData?.whatsapp_user?.account,
            phone_number: memoryData?.whatsapp_user?.phone_number,
            last_seen: new Date().toISOString(),
          };
        }
      }

      // Если это временная проблема подключения, возвращаем pending вместо failed
      if (shouldReturnPending) {
        instanceMemoryService.updateStatus(instance.id, 'start', {
          source: 'instance-monitor.service.ts:getAuthStatus',
          message: errorMessage,
        });
        return {
          auth_status: 'pending',
          is_ready_for_messages: false,
        };
      }

      instanceMemoryService.updateStatus(instance.id, 'stopped', {
        source: 'instance-monitor.service.ts:getAuthStatus',
        message: errorMessage,
      });

      return {
        auth_status: 'failed',
        is_ready_for_messages: false,
      };
    }
  }

  async getQRCode(instance: MessageInstance): Promise<QRCodeResponse | null> {
    // Сначала пытаемся получить QR из памяти
    const memoryQR = instanceMemoryService.getCurrentQR(instance.id);
    if (memoryQR && memoryQR.expires_at > new Date()) {
      return {
        qr_code: memoryQR.qr_code,
        qr_code_text: memoryQR.qr_text,
        auth_status: 'qr_ready',
        expires_in: Math.floor((memoryQR.expires_at.getTime() - Date.now()) / 1000),
      };
    }

    if (!instance.port_api || !instance.api_key) {
      return null;
    }

    try {
      // Сначала пытаемся получить QR код через API
      const apiUrl = ConnectionUtils.getApiUrl(instance.id, instance.port_api);
      const response = await axios.get(`${apiUrl}/api/v1/status`, {
        headers: {
          Authorization: `Bearer ${instance.api_key}`,
        },
        timeout: 5000,
      });

      const data = response.data;

      if (data.qr) {
        // Сохраняем QR код в память
        instanceMemoryService.saveQRCode(instance.id, data.qr, {
          text: data.qrText,
          source: 'instance-monitor.service.ts:getQRCode',
        });

        return {
          qr_code: data.qr,
          qr_code_text: data.qrText,
          auth_status: 'qr_ready',
          expires_in: 45, // WhatsApp QR codes typically expire in 45 seconds
        };
      }

      return null;
    } catch (error) {
      logger.debug(`API not available for instance ${instance.id}, trying to extract QR from logs`);

      // Если API недоступен, пытаемся извлечь QR код из логов
      try {
        const containerName = NamingUtils.getApiContainerName(instance.id);
        const logs = await this.dockerService.getContainerLogsByName(containerName);

        // Ищем последний QR код в логах
        const qrLines = logs.split('\n').filter(line => line.includes('QR code generated'));
        if (qrLines.length === 0) {
          return null;
        }

        // Берем последнее сообщение о генерации QR кода
        const lastQrLine = qrLines[qrLines.length - 1];
        const timestamp = lastQrLine.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);

        if (timestamp) {
          // Проверяем что QR код свежий (не старше 2 минут)
          const qrTime = new Date(timestamp[1]);
          const now = new Date();
          const diffMinutes = (now.getTime() - qrTime.getTime()) / (1000 * 60);

          if (diffMinutes > 2) {
            logger.debug(`QR code too old (${diffMinutes.toFixed(1)} minutes), skipping`);
            return null;
          }
        }

        // Извлекаем QR код из логов (он идет после сообщения о генерации)
        const logLines = logs.split('\n');
        let qrStartIndex = -1;
        for (let i = logLines.length - 1; i >= 0; i--) {
          if (logLines[i].includes('QR code generated')) {
            qrStartIndex = i;
            break;
          }
        }

        if (qrStartIndex === -1) {
          return null;
        }

        // QR код начинается со строки содержащей █ символы
        const qrCodeLines = [];
        for (let i = qrStartIndex + 1; i < logLines.length; i++) {
          const line = logLines[i];
          if (line.includes('█')) {
            qrCodeLines.push(line);
          } else if (qrCodeLines.length > 0 && !line.trim()) {
            // Пустая строка после QR кода означает конец
            break;
          } else if (qrCodeLines.length > 0) {
            // Если есть текст после QR кода, значит QR код закончился
            break;
          }
        }

        if (qrCodeLines.length > 0) {
          const qrCodeText = qrCodeLines.join('\n');

          // Сохраняем QR код в память
          instanceMemoryService.saveQRCode(instance.id, qrCodeText, {
            text: qrCodeText,
            source: 'instance-monitor.service.ts:getQRCode:logs',
          });

          return {
            qr_code: qrCodeText,
            qr_code_text: qrCodeText,
            auth_status: 'qr_ready',
            expires_in: 45,
          };
        }

        return null;
      } catch (logError) {
        logger.error(`Failed to extract QR code from logs for instance ${instance.id}`, logError);
        instanceMemoryService.registerError(
          instance.id,
          `QR extraction from logs failed: ${logError}`,
          {
            source: 'instance-monitor.service.ts:getQRCode:logs',
          },
        );
        return null;
      }
    }
  }

  async getCredentials(instance: MessageInstance): Promise<CredentialsResponse | null> {
    // Сначала пытаемся получить API ключ из памяти
    const memoryApiKey = instanceMemoryService.getCurrentApiKey(instance.id);
    if (memoryApiKey && instance.port_api) {
      return {
        api_key: memoryApiKey,
        api_url: `${ConnectionUtils.getExternalUrl(instance.port_api)}/api`,
        mcp_url: instance.port_mcp ? ConnectionUtils.getExternalUrl(instance.port_mcp) : undefined,
      };
    }

    if (!instance.api_key || !instance.port_api) {
      return null;
    }

    const credentials: CredentialsResponse = {
      api_key: instance.api_key,
      api_url: `${ConnectionUtils.getExternalUrl(instance.port_api)}/api`,
    };

    if (instance.port_mcp) {
      credentials.mcp_url = ConnectionUtils.getExternalUrl(instance.port_mcp);
    }

    return credentials;
  }

  async getInstanceLogs(instanceId: string, tail: number = 100): Promise<Record<string, string>> {
    const containers = await this.dockerService.getContainersByInstanceId(instanceId);
    const logs: Record<string, string> = {};

    for (const container of containers) {
      const containerLogs = await this.dockerService.getContainerLogs(container.id, tail);
      logs[container.name] = containerLogs;
    }

    return logs;
  }

  async checkInstanceHealth(instance: MessageInstance): Promise<{
    healthy: boolean;
    services: Record<string, boolean>;
  }> {
    const services: Record<string, boolean> = {};
    let allHealthy = true;

    // Проверяем API сервис
    if (instance.type_instance.includes('api') && instance.port_api) {
      try {
        const headers: any = {};
        if (instance.api_key) {
          headers['Authorization'] = `Bearer ${instance.api_key}`;
        }

        // Определяем правильный health endpoint в зависимости от провайдера
        let healthEndpoint: string;
        if (instance.provider === 'telegram') {
          healthEndpoint = '/api/v1/telegram/health';
        } else {
          healthEndpoint = '/api/v1/health';
        }

        const apiUrl = ConnectionUtils.getApiUrl(instance.id, instance.port_api);
        const response = await axios.get(`${apiUrl}${healthEndpoint}`, {
          timeout: 5000,
        });

        // ИСПРАВЛЕНИЕ: Принимаем HTTP 200 как признак что API сервер работает
        // Даже если WhatsApp/Telegram клиент еще не готов ("unhealthy")
        // Это позволяет Instance Manager не ждать 180 секунд
        services.api =
          response.status === 200 &&
          (response.data.status === 'ok' ||
            response.data.status === 'healthy' ||
            response.data.status === 'unhealthy'); // <- ДОБАВЛЕНО

        // Дополнительная проверка: если сервер отвечает, но статус неизвестен
        if (response.status === 200 && !response.data.status) {
          services.api = true; // HTTP сервер работает
        }
      } catch (error) {
        services.api = false;
        allHealthy = false;
      }
    }

    // Проверяем MCP сервис
    if (instance.type_instance.includes('mcp') && instance.port_mcp) {
      try {
        // MCP использует SSE, поэтому просто проверяем доступность порта
        const mcpUrl = ConnectionUtils.getMcpUrl(instance.id, instance.port_mcp);
        const response = await axios.get(`${mcpUrl}/`, {
          timeout: 5000,
          validateStatus: () => true, // Принимаем любой статус
        });
        services.mcp = response.status < 500;
      } catch (error) {
        services.mcp = false;
        allHealthy = false;
      }
    }

    // Проверяем Docker контейнеры
    const dockerStatus = await this.dockerService.getComposeStatus(instance.id);
    services.docker = dockerStatus.running;

    if (!services.docker) {
      allHealthy = false;
    }

    return {
      healthy: allHealthy,
      services,
    };
  }

  /**
   * Обновляет статус аутентификации инстанса в базе данных
   */
  async updateAuthStatusInDatabase(instance: MessageInstance): Promise<boolean> {
    if (!this.databaseService) {
      logger.warn(
        'Database service not provided to InstanceMonitorService, cannot update auth status',
      );
      return false;
    }

    try {
      const authStatus = await this.getAuthStatus(instance);

      // Обновляем статус в базе данных даже если он 'failed'
      // для экземпляров с недоступными контейнерами
      if (authStatus) {
        await this.databaseService.updateInstance(instance.id, {
          updated_at: new Date(),
          auth_status: authStatus.auth_status,
          whatsapp_state: authStatus.whatsapp_state,
          account: authStatus.account,
        });

        logger.info(`Updated auth status for instance ${instance.id}: ${authStatus.auth_status}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Failed to update auth status for instance ${instance.id}`, error);
      return false;
    }
  }

  /**
   * Запускает периодическое обновление статусов всех инстансов
   */
  async startStatusUpdateInterval(intervalMs: number = 30000): Promise<NodeJS.Timeout> {
    if (!this.databaseService) {
      throw new Error(
        'Database service not provided to InstanceMonitorService, cannot start status update interval',
      );
    }

    logger.info(`Starting auth status update interval (${intervalMs}ms)`);

    const databaseService = this.databaseService; // Сохраняем ссылку для использования внутри замыкания

    return setInterval(async () => {
      try {
        // Получаем все запущенные инстансы
        const instances = await databaseService.getAllInstances();

        let updatedCount = 0;
        let skippedCount = 0;

        // Обновляем статус для каждого инстанса
        for (const instance of instances) {
          try {
            if (instance.type_instance.includes('api') && instance.port_api && instance.api_key) {
                          // Более гибкая логика пропуска экземпляров
            if (instance.auth_status === 'failed' && instance.updated_at) {
              const timeSinceUpdate = Date.now() - new Date(instance.updated_at).getTime();
              const fiveMinutesMs = 5 * 60 * 1000;

              // Пропускаем экземпляры со статусом 'failed', которые обновлялись недавно
              if (timeSinceUpdate < fiveMinutesMs) {
                skippedCount++;
                continue;
              }
            }

            // УЛУЧШЕНИЕ: Пропускаем стабильные client_ready инстансы, проверяем их реже
            if (instance.auth_status === 'client_ready' && instance.updated_at) {
              const timeSinceUpdate = Date.now() - new Date(instance.updated_at).getTime();
              const tenMinutesMs = 10 * 60 * 1000;

              // Пропускаем стабильные client_ready инстансы, если они обновлялись недавно
              if (timeSinceUpdate < tenMinutesMs) {
                logger.debug(
                  `Skipping stable client_ready instance ${instance.id} (last update ${Math.round(timeSinceUpdate / 1000)}s ago)`,
                );
                skippedCount++;
                continue;
              }
            }

            // Пропускаем экземпляры, которые были созданы менее 3 минут назад
            // чтобы дать им время на запуск
            if (instance.created_at) {
              const timeSinceCreation = Date.now() - new Date(instance.created_at).getTime();
              const threeMinutesMs = 3 * 60 * 1000;

              if (timeSinceCreation < threeMinutesMs && instance.auth_status === 'pending') {
                logger.debug(
                  `Skipping recently created instance ${instance.id} (${Math.round(timeSinceCreation / 1000)}s old)`,
                );
                skippedCount++;
                continue;
              }
            }

              const updated = await this.updateAuthStatusInDatabase(instance);
              if (updated) {
                updatedCount++;
              }
            }
          } catch (error) {
            logger.error(`Error updating auth status for instance ${instance.id}`, error);
          }
        }

        if (updatedCount > 0 || skippedCount > 0) {
          logger.info(
            `Auth status update: checked ${updatedCount} instances, skipped ${skippedCount} recently failed/created`,
          );
        }
      } catch (error) {
        logger.error('Error in auth status update interval', error);
      }
    }, intervalMs);
  }
}
