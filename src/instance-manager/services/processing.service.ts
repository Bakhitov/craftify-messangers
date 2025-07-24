import { MessageInstance, ProcessInstanceResponse } from '../models/instance.model';
import { DatabaseService } from './database.service';
import { DockerService } from './docker.service';
import { DecisionService } from './decision.service';
import { ComposeService } from './compose.service';
import { PortManager } from '../utils/port-manager.utils';
import { PerformanceMonitorService } from './performance-monitor.service';
import { NamingUtils } from '../utils/naming.utils';
import logger from '../../logger';
import { InstanceMonitorService } from './instance-monitor.service';
import { instanceMemoryService } from './instance-memory.service';

export class ProcessingService {
  private portManager: PortManager;
  private decisionService: DecisionService;
  private composeService: ComposeService;
  private performanceMonitor: PerformanceMonitorService;

  constructor(
    private databaseService: DatabaseService,
    private dockerService: DockerService,
  ) {
    this.portManager = new PortManager(databaseService.getPool());
    this.decisionService = new DecisionService();
    this.composeService = new ComposeService(dockerService);
    this.performanceMonitor = new PerformanceMonitorService(databaseService, this.portManager);
  }

  async processInstance(
    instanceId: string,
    forceRecreate?: boolean,
  ): Promise<ProcessInstanceResponse> {
    logger.info(`Processing instance ${instanceId}`, { forceRecreate });

    try {
      // Получаем инстанс из БД с retry логикой
      let instance: MessageInstance | null = null;
      // В production больше попыток из-за возможных сетевых задержек
      const maxRetries = process.env.NODE_ENV === 'production' ? 10 : 5;
      const retryDelay = process.env.NODE_ENV === 'production' ? 500 : 200; // миллисекунды

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        instance = await this.databaseService.getInstanceById(instanceId);

        if (instance) {
          logger.debug(`Found instance ${instanceId} on attempt ${attempt}`);
          break;
        }

        if (attempt < maxRetries) {
          logger.warn(`Instance ${instanceId} not found on attempt ${attempt}, retrying...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        }
      }

      if (!instance) {
        throw new Error(
          `Instance ${instanceId} not found in database after ${maxRetries} attempts`,
        );
      }

      // После этой проверки TypeScript знает что instance не null
      const instanceData: MessageInstance = instance;

      // Получаем текущее состояние в Docker
      const dockerState = await this.dockerService.getComposeStatus(instanceId);

      // Принимаем решение о действии
      const decision = await this.decisionService.decide(instanceData, dockerState, forceRecreate);
      logger.info(`Decision for instance ${instanceId}: ${decision.action}`, {
        reason: decision.reason,
      });

      // Начальное значение API ключа
      let apiKey = instanceData.api_key || instanceId;

      // Выполняем действие
      switch (decision.action) {
        case 'create':
          // Назначаем порты если их нет
          const needsPorts =
            (instanceData.type_instance.includes('api') && !instanceData.port_api) ||
            (instanceData.type_instance.includes('mcp') && !instanceData.port_mcp);

          if (needsPorts) {
            try {
              const ports = await this.performanceMonitor.trackPortAssignment(
                () => this.portManager.assignPorts(instanceId, instanceData.type_instance),
                instanceId,
              );
              // Порты уже сохранены в базе данных атомарно
              if (ports.api) instanceData.port_api = ports.api;
              if (ports.mcp) instanceData.port_mcp = ports.mcp;
            } catch (error) {
              logger.error(`Failed to assign ports for instance ${instanceId}`, error);
              throw new Error(`Port assignment failed: ${(error as Error).message}`);
            }
          }

          // Создаем инстанс
          await this.composeService.createInstance(instanceData);

          // Проверяем готовность API и получаем реальный API ключ
          if (instanceData.type_instance.includes('api')) {
            const extractedApiKey = await this.composeService.waitForApiReady(
              instanceData,
              3, // 9 секунд
              async (newApiKey: string) => {
                // Обновляем API ключ в базе данных только если он отличается от instanceId
                if (newApiKey !== instanceId) {
                  await this.databaseService.updateInstance(instanceId, {
                    api_key: newApiKey,
                    api_key_generated_at: new Date(),
                  });
                  instanceData.api_key = newApiKey; // Обновляем локальную копию
                } else {
                  // Если API ключ равен instanceId, просто обновляем время генерации
                  await this.databaseService.updateInstance(instanceId, {
                    api_key_generated_at: new Date(),
                  });
                }

                // Синхронизируем с memory service
                instanceMemoryService.saveApiKey(instanceId, newApiKey, {
                  source: 'ProcessingService:waitForApiReady',
                  saveToDb: true,
                });

                // Обновляем MCP конфигурацию с новым API ключом
                if (instanceData.type_instance.includes('mcp')) {
                  await this.composeService.updateApiKeyInCompose(instanceId, newApiKey);
                }
              },
            );

            if (extractedApiKey && extractedApiKey !== instanceId) {
              // Обновляем API ключ в базе данных если он еще не был обновлен
              if (extractedApiKey !== instanceData.api_key) {
                await this.databaseService.updateInstance(instanceId, { api_key: extractedApiKey });
              }
              apiKey = extractedApiKey;
              logger.info(
                `Final API key for instance ${instanceId}: ${extractedApiKey.substring(0, 16)}...`,
              );

              // Обновляем MCP конфигурацию с новым API ключом
              if (instanceData.type_instance.includes('mcp')) {
                await this.composeService.updateApiKeyInCompose(instanceId, extractedApiKey);
              }
            }
          }
          break;

        case 'update':
          await this.composeService.updateInstance(instanceData);
          break;

        case 'recreate':
          await this.composeService.recreateInstance(instanceData);

          // Проверяем готовность API и получаем реальный API ключ
          if (instanceData.type_instance.includes('api')) {
            const extractedApiKey = await this.composeService.waitForApiReady(
              instanceData,
              3, // 9 секунд
              async (newApiKey: string) => {
                // Обновляем API ключ в базе данных только если он отличается от instanceId
                if (newApiKey !== instanceId) {
                  await this.databaseService.updateInstance(instanceId, {
                    api_key: newApiKey,
                    api_key_generated_at: new Date(),
                  });
                  instanceData.api_key = newApiKey; // Обновляем локальную копию
                } else {
                  // Если API ключ равен instanceId, просто обновляем время генерации
                  await this.databaseService.updateInstance(instanceId, {
                    api_key_generated_at: new Date(),
                  });
                }

                // Синхронизируем с memory service
                instanceMemoryService.saveApiKey(instanceId, newApiKey, {
                  source: 'ProcessingService:waitForApiReady',
                  saveToDb: true,
                });

                // Обновляем MCP конфигурацию с новым API ключом
                if (instanceData.type_instance.includes('mcp')) {
                  await this.composeService.updateApiKeyInCompose(instanceId, newApiKey);
                }
              },
            );

            if (extractedApiKey && extractedApiKey !== instanceId) {
              // Обновляем API ключ в базе данных если он еще не был обновлен
              if (extractedApiKey !== instanceData.api_key) {
                await this.databaseService.updateInstance(instanceId, { api_key: extractedApiKey });
              }
              apiKey = extractedApiKey;
              logger.info(
                `Final API key for instance ${instanceId}: ${extractedApiKey.substring(0, 16)}...`,
              );

              // Обновляем MCP конфигурацию с новым API ключом
              if (instanceData.type_instance.includes('mcp')) {
                await this.composeService.updateApiKeyInCompose(instanceId, extractedApiKey);
              }
            }
          }
          break;

        case 'start':
          await this.composeService.startInstance(instanceId);

          // Проверяем готовность API и получаем реальный API ключ
          if (instanceData.type_instance.includes('api')) {
            const extractedApiKey = await this.composeService.waitForApiReady(
              instanceData,
              3, // 9 секунд
              async (newApiKey: string) => {
                // Обновляем API ключ в базе данных только если он отличается от instanceId
                if (newApiKey !== instanceId) {
                  await this.databaseService.updateInstance(instanceId, {
                    api_key: newApiKey,
                    api_key_generated_at: new Date(),
                  });
                  instanceData.api_key = newApiKey; // Обновляем локальную копию
                } else {
                  // Если API ключ равен instanceId, просто обновляем время генерации
                  await this.databaseService.updateInstance(instanceId, {
                    api_key_generated_at: new Date(),
                  });
                }

                // Синхронизируем с memory service
                instanceMemoryService.saveApiKey(instanceId, newApiKey, {
                  source: 'ProcessingService:waitForApiReady',
                  saveToDb: true,
                });

                // Обновляем MCP конфигурацию с новым API ключом
                if (instanceData.type_instance.includes('mcp')) {
                  await this.composeService.updateApiKeyInCompose(instanceId, newApiKey);
                }
              },
            );

            if (
              extractedApiKey &&
              extractedApiKey !== instanceId &&
              extractedApiKey !== instanceData.api_key
            ) {
              // Обновляем API ключ в базе данных если он еще не был обновлен
              if (extractedApiKey !== instanceData.api_key) {
                await this.databaseService.updateInstance(instanceId, { api_key: extractedApiKey });
              }
              apiKey = extractedApiKey;
              logger.info(
                `Final API key for instance ${instanceId}: ${extractedApiKey.substring(0, 16)}...`,
              );

              // Обновляем MCP конфигурацию с новым API ключом
              if (instanceData.type_instance.includes('mcp')) {
                await this.composeService.updateApiKeyInCompose(instanceId, extractedApiKey);
              }
            }
          }
          break;

        case 'no_change':
          // Ничего не делаем
          break;
      }

      // Формируем ответ
      const response: ProcessInstanceResponse = {
        success: true,
        instance_id: instanceId,
        action: decision.action,
        details: {
          display_name: NamingUtils.getDisplayName(
            instanceData.provider,
            instanceData.type_instance,
          ),
          ports: {
            api: instanceData.port_api,
            mcp: instanceData.port_mcp,
          },
          api_key: apiKey,
          auth_status: 'pending',
          status_check_url: `http://localhost:3000/api/v1/instances/${instanceId}/auth-status`,
        },
        message: this.getActionMessage(decision.action),
      };

      // ✅ ИСПРАВЛЕНИЕ №1: Немедленная проверка после запуска API
      if (
        ['create', 'recreate', 'start'].includes(decision.action) &&
        instanceData.type_instance.includes('api')
      ) {
        try {
          // ✅ УНИВЕРСАЛЬНОЕ РЕШЕНИЕ: Увеличенное время ожидания для надежности
          await new Promise(resolve => setTimeout(resolve, 5000)); // +2 секунды для WhatsApp

          // ✅ КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Загружаем СВЕЖИЕ данные из БД
          const freshInstanceData = await this.databaseService.getInstanceById(instanceId);
          if (!freshInstanceData) {
            logger.warn(`Instance ${instanceId} not found after creation`);
            return response;
          }

          logger.debug(`Fresh instance data loaded for ${instanceId}`, {
            has_api_key: !!freshInstanceData.api_key,
            api_key_preview: freshInstanceData.api_key?.substring(0, 16) + '...',
            auth_status: freshInstanceData.auth_status,
            provider: freshInstanceData.provider,
            source: 'ProcessingService:universalFix',
          });

          // Создаем экземпляр InstanceMonitorService
          const instanceMonitorService = new InstanceMonitorService(
            this.dockerService,
            this.databaseService,
          );

          // ✅ ИСПОЛЬЗУЕМ СВЕЖИЕ ДАННЫЕ вместо устаревших instanceData
          const authStatus = await instanceMonitorService.getAuthStatus(freshInstanceData);

          if (authStatus && authStatus.auth_status !== 'failed') {
            // Обновляем статус в ответе
            response.details.auth_status = authStatus.auth_status;

            // ✅ НЕМЕДЛЕННОЕ обновление БД без debounce
            await instanceMonitorService.updateAuthStatusInDatabase(freshInstanceData);

            logger.info(
              `✅ IMMEDIATE auth status update for instance ${instanceId}: ${authStatus.auth_status} (used fresh data)`,
            );
          }
        } catch (error) {
          logger.warn(`Failed to immediate update auth status for instance ${instanceId}`, error);
          // Не прерываем выполнение в случае ошибки получения статуса
        }
      }

      return response;
    } catch (error: any) {
      logger.error(`Failed to process instance ${instanceId}`, error);
      throw error;
    }
  }

  private getActionMessage(action: string): string {
    switch (action) {
      case 'create':
        return 'Instance created. Waiting for QR code generation...';
      case 'update':
        return 'Instance configuration updated successfully';
      case 'recreate':
        return 'Instance recreated. Waiting for QR code generation...';
      case 'start':
        return 'Instance started successfully';
      case 'no_change':
        return 'Instance is already up to date';
      default:
        return 'Operation completed';
    }
  }

  // Новый метод для получения метрик производительности
  async getPerformanceMetrics(): Promise<any> {
    return await this.performanceMonitor.getDetailedMetrics();
  }

  // Новый метод для получения состояния системы
  async getSystemHealth(): Promise<any> {
    return await this.performanceMonitor.getSystemHealth();
  }

  // Новый метод для запуска стресс-теста
  async runStressTest(concurrentRequests: number = 10, duration: number = 30000): Promise<any> {
    return await this.performanceMonitor.runStressTest(concurrentRequests, duration);
  }
}
