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
      // Получаем инстанс из БД
      const instance = await this.databaseService.getInstanceById(instanceId);
      if (!instance) {
        throw new Error(`Instance ${instanceId} not found in database`);
      }

      // Получаем текущее состояние в Docker
      const dockerState = await this.dockerService.getComposeStatus(instanceId);

      // Принимаем решение о действии
      const decision = await this.decisionService.decide(instance, dockerState, forceRecreate);
      logger.info(`Decision for instance ${instanceId}: ${decision.action}`, {
        reason: decision.reason,
      });

      // Начальное значение API ключа
      let apiKey = instance.api_key || instanceId;

      // Выполняем действие
      switch (decision.action) {
        case 'create':
          // Назначаем порты если их нет
          const needsPorts =
            (instance.type_instance.includes('api') && !instance.port_api) ||
            (instance.type_instance.includes('mcp') && !instance.port_mcp);

          if (needsPorts) {
            try {
              const ports = await this.performanceMonitor.trackPortAssignment(
                () => this.portManager.assignPorts(instanceId, instance.type_instance),
                instanceId,
              );
              // Порты уже сохранены в базе данных атомарно
              if (ports.api) instance.port_api = ports.api;
              if (ports.mcp) instance.port_mcp = ports.mcp;
            } catch (error) {
              logger.error(`Failed to assign ports for instance ${instanceId}`, error);
              throw new Error(`Port assignment failed: ${(error as Error).message}`);
            }
          }

          // Создаем инстанс
          await this.composeService.createInstance(instance);

          // Проверяем готовность API и получаем реальный API ключ
          if (instance.type_instance.includes('api')) {
            const extractedApiKey = await this.composeService.waitForApiReady(
              instance,
              60, // 2 минуты
              async (newApiKey: string) => {
                // Обновляем API ключ в базе данных только если он отличается от instanceId
                if (newApiKey !== instanceId) {
                  await this.databaseService.updateInstance(instanceId, {
                    api_key: newApiKey,
                    api_key_generated_at: new Date(),
                  });
                  instance.api_key = newApiKey; // Обновляем локальную копию
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
                if (instance.type_instance.includes('mcp')) {
                  await this.composeService.updateApiKeyInCompose(instanceId, newApiKey);
                }
              },
            );

            if (extractedApiKey && extractedApiKey !== instanceId) {
              // Обновляем API ключ в базе данных если он еще не был обновлен
              if (extractedApiKey !== instance.api_key) {
                await this.databaseService.updateInstance(instanceId, { api_key: extractedApiKey });
              }
              apiKey = extractedApiKey;
              logger.info(
                `Final API key for instance ${instanceId}: ${extractedApiKey.substring(0, 16)}...`,
              );

              // Обновляем MCP конфигурацию с новым API ключом
              if (instance.type_instance.includes('mcp')) {
                await this.composeService.updateApiKeyInCompose(instanceId, extractedApiKey);
              }
            }
          }
          break;

        case 'update':
          await this.composeService.updateInstance(instance);
          break;

        case 'recreate':
          await this.composeService.recreateInstance(instance);

          // Проверяем готовность API и получаем реальный API ключ
          if (instance.type_instance.includes('api')) {
            const extractedApiKey = await this.composeService.waitForApiReady(
              instance,
              60, // 2 минуты
              async (newApiKey: string) => {
                // Обновляем API ключ в базе данных только если он отличается от instanceId
                if (newApiKey !== instanceId) {
                  await this.databaseService.updateInstance(instanceId, {
                    api_key: newApiKey,
                    api_key_generated_at: new Date(),
                  });
                  instance.api_key = newApiKey; // Обновляем локальную копию
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
                if (instance.type_instance.includes('mcp')) {
                  await this.composeService.updateApiKeyInCompose(instanceId, newApiKey);
                }
              },
            );

            if (extractedApiKey && extractedApiKey !== instanceId) {
              // Обновляем API ключ в базе данных если он еще не был обновлен
              if (extractedApiKey !== instance.api_key) {
                await this.databaseService.updateInstance(instanceId, { api_key: extractedApiKey });
              }
              apiKey = extractedApiKey;
              logger.info(
                `Final API key for instance ${instanceId}: ${extractedApiKey.substring(0, 16)}...`,
              );

              // Обновляем MCP конфигурацию с новым API ключом
              if (instance.type_instance.includes('mcp')) {
                await this.composeService.updateApiKeyInCompose(instanceId, extractedApiKey);
              }
            }
          }
          break;

        case 'start':
          await this.composeService.startInstance(instanceId);

          // Проверяем готовность API и получаем реальный API ключ
          if (instance.type_instance.includes('api')) {
            const extractedApiKey = await this.composeService.waitForApiReady(
              instance,
              60, // 2 минуты
              async (newApiKey: string) => {
                // Обновляем API ключ в базе данных только если он отличается от instanceId
                if (newApiKey !== instanceId) {
                  await this.databaseService.updateInstance(instanceId, {
                    api_key: newApiKey,
                    api_key_generated_at: new Date(),
                  });
                  instance.api_key = newApiKey; // Обновляем локальную копию
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
                if (instance.type_instance.includes('mcp')) {
                  await this.composeService.updateApiKeyInCompose(instanceId, newApiKey);
                }
              },
            );

            if (
              extractedApiKey &&
              extractedApiKey !== instanceId &&
              extractedApiKey !== instance.api_key
            ) {
              // Обновляем API ключ в базе данных если он еще не был обновлен
              if (extractedApiKey !== instance.api_key) {
                await this.databaseService.updateInstance(instanceId, { api_key: extractedApiKey });
              }
              apiKey = extractedApiKey;
              logger.info(
                `Final API key for instance ${instanceId}: ${extractedApiKey.substring(0, 16)}...`,
              );

              // Обновляем MCP конфигурацию с новым API ключом
              if (instance.type_instance.includes('mcp')) {
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
          display_name: NamingUtils.getDisplayName(instance.provider, instance.type_instance),
          ports: {
            api: instance.port_api,
            mcp: instance.port_mcp,
          },
          api_key: apiKey,
          auth_status: 'pending',
          status_check_url: `http://localhost:3000/api/v1/instances/${instanceId}/auth-status`,
        },
        message: this.getActionMessage(decision.action),
      };

      // Получаем актуальный статус аутентификации после создания/обновления инстанса
      if (
        ['create', 'recreate', 'start'].includes(decision.action) &&
        instance.type_instance.includes('api')
      ) {
        try {
          // Ждем немного, чтобы API успел запуститься полностью
          await new Promise(resolve => setTimeout(resolve, 3000));

          // Создаем экземпляр InstanceMonitorService
          const instanceMonitorService = new InstanceMonitorService(
            this.dockerService,
            this.databaseService,
          );

          // Получаем актуальный статус аутентификации
          const authStatus = await instanceMonitorService.getAuthStatus(instance);

          if (authStatus && authStatus.auth_status !== 'failed') {
            // Обновляем статус в ответе
            response.details.auth_status = authStatus.auth_status;

            // Обновляем статус в базе данных через updateAuthStatusInDatabase
            await instanceMonitorService.updateAuthStatusInDatabase(instance);

            logger.info(
              `Updated auth status for instance ${instanceId}: ${authStatus.auth_status}`,
            );
          }
        } catch (error) {
          logger.warn(`Failed to update auth status for instance ${instanceId}`, error);
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
