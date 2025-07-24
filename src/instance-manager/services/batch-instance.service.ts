import { DatabaseService } from './database.service';
import { DockerService } from './docker.service';
import { instanceMemoryService } from './instance-memory.service';
import { InstanceMonitorService } from './instance-monitor.service';
import { resourceCacheService } from './resource-cache.service';
import { MessageInstance } from '../models/instance.model';
import logger from '../../logger';

interface BatchInstanceStatus {
  id: string;
  status: 'running' | 'stopped' | 'not_created';
  health: {
    healthy: boolean;
    services: {
      api: boolean;
      docker: boolean;
    };
  };
  memoryData: any;
  authStatus: any;
}

interface BatchProcessOptions {
  includeMemory: boolean;
  includeAuth: boolean;
  includeHealth: boolean;
  includeContainers: boolean;
}

export class BatchInstanceService {
  private databaseService: DatabaseService;
  private dockerService: DockerService;
  private instanceMonitorService: InstanceMonitorService;

  constructor() {
    this.databaseService = new DatabaseService();
    this.dockerService = new DockerService();
    this.instanceMonitorService = new InstanceMonitorService(this.dockerService);
  }

  /**
   * Получить статус множественных экземпляров одним запросом
   */
  async getBatchInstanceStatus(
    instanceIds: string[],
    options: Partial<BatchProcessOptions> = {},
  ): Promise<Record<string, BatchInstanceStatus>> {
    const opts: BatchProcessOptions = {
      includeMemory: true,
      includeAuth: true,
      includeHealth: true,
      includeContainers: false,
      ...options,
    };

    logger.debug(`Getting batch status for ${instanceIds.length} instances`, {
      instanceIds,
      options: opts,
    });

    try {
      // Используем batch кэширование
      const cacheKey = `batch_instance_status_${instanceIds.sort().join('_')}`;
      const cachedResult = await resourceCacheService.getBatch(
        instanceIds.map(id => `instance_status_${id}`),
        async (missingIds: string[]) => {
          const actualIds = missingIds.map(id => id.replace('instance_status_', ''));
          return this.fetchBatchInstanceStatus(actualIds, opts);
        },
        30000, // 30 секунд TTL для instance status
      );

      return this.transformCacheResult(cachedResult);
    } catch (error) {
      logger.error('Failed to get batch instance status', { error, instanceIds });
      throw error;
    }
  }

  /**
   * Реальное получение данных для batch операции
   */
  private async fetchBatchInstanceStatus(
    instanceIds: string[],
    options: BatchProcessOptions,
  ): Promise<Record<string, BatchInstanceStatus>> {
    const result: Record<string, BatchInstanceStatus> = {};

    // Параллельное получение данных из БД
    const instancesPromise = Promise.all(
      instanceIds.map(id => this.databaseService.getInstanceById(id)),
    );

    // Параллельное получение Docker статусов
    const dockerStatusesPromise = Promise.all(
      instanceIds.map(id => this.dockerService.getComposeStatus(id)),
    );

    // Получение данных из памяти (быстро)
    const memoryData = options.includeMemory
      ? instanceIds.reduce(
          (acc, id) => {
            acc[id] = instanceMemoryService.getInstance(id);
            return acc;
          },
          {} as Record<string, any>,
        )
      : {};

    // Ждем параллельные операции
    const [instances, dockerStatuses] = await Promise.all([
      instancesPromise,
      dockerStatusesPromise,
    ]);

    // Параллельное получение auth статусов и health checks
    const authPromises: Promise<any>[] = [];
    const healthPromises: Promise<any>[] = [];

    for (let i = 0; i < instances.length; i++) {
      const instance = instances[i];
      if (!instance) continue;

      if (options.includeAuth) {
        authPromises.push(
          this.instanceMonitorService.getAuthStatus(instance).catch(error => {
            logger.warn(`Failed to get auth status for ${instance.id}`, { error });
            return { auth_status: 'unknown', error: error.message };
          }),
        );
      }

      if (options.includeHealth) {
        healthPromises.push(
          this.instanceMonitorService.checkInstanceHealth(instance).catch(error => {
            logger.warn(`Failed to get health for ${instance.id}`, { error });
            return { healthy: false, services: { api: false, docker: false }, error: error.message };
          }),
        );
      }
    }

    const [authStatuses, healthStatuses] = await Promise.all([
      options.includeAuth ? Promise.all(authPromises) : [],
      options.includeHealth ? Promise.all(healthPromises) : [],
    ]);

    // Сборка результата
    for (let i = 0; i < instances.length; i++) {
      const instance = instances[i];
      const dockerStatus = dockerStatuses[i];

      if (!instance) {
        continue;
      }

      result[`instance_status_${instance.id}`] = {
        id: instance.id,
        status: dockerStatus.running ? 'running' : dockerStatus.exists ? 'stopped' : 'not_created',
        health: options.includeHealth
          ? healthStatuses[i]
          : { healthy: false, services: { api: false, docker: false } },
        memoryData: memoryData[instance.id] || null,
        authStatus: options.includeAuth ? authStatuses[i] : null,
      };
    }

    logger.debug(`Fetched batch status for ${Object.keys(result).length} instances`);
    return result;
  }

  /**
   * Трансформация результата кэша
   */
  private transformCacheResult(cacheResult: Record<string, any>): Record<string, BatchInstanceStatus> {
    const result: Record<string, BatchInstanceStatus> = {};

    for (const [key, value] of Object.entries(cacheResult)) {
      const instanceId = key.replace('instance_status_', '');
      result[instanceId] = value;
    }

    return result;
  }

  /**
   * Обновить множественные экземпляры в batch режиме
   */
  async batchUpdateInstances(
    updates: Array<{
      id: string;
      data: Partial<MessageInstance>;
    }>,
  ): Promise<{
    success: number;
    failed: number;
    errors: Array<{ id: string; error: string }>;
  }> {
    logger.info(`Batch updating ${updates.length} instances`);

    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ id: string; error: string }>,
    };

    // Обрабатываем в chunks по 10 для избежания перегрузки БД
    const chunkSize = 10;
    const chunks = [];

    for (let i = 0; i < updates.length; i += chunkSize) {
      chunks.push(updates.slice(i, i + chunkSize));
    }

    for (const chunk of chunks) {
      const promises = chunk.map(async update => {
        try {
          await this.databaseService.updateInstance(update.id, update.data);
          
          // Инвалидируем кэш для этого экземпляра
          resourceCacheService.invalidate(`instance_status_${update.id}`);
          
          return { success: true, id: update.id };
        } catch (error) {
          logger.error(`Failed to update instance ${update.id}`, { error });
          return {
            success: false,
            id: update.id,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      const chunkResults = await Promise.all(promises);

      chunkResults.forEach(result => {
        if (result.success) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push({ id: result.id, error: result.error || 'Unknown error' });
        }
      });
    }

    // Инвалидируем связанные кэши
    resourceCacheService.invalidateInstanceRelated();

    logger.info('Batch update completed', results);
    return results;
  }

  /**
   * Получить агрегированную статистику экземпляров
   */
  async getAggregatedStats(instanceIds?: string[]): Promise<{
    total: number;
    running: number;
    stopped: number;
    healthy: number;
    authenticated: number;
    errors: number;
    memoryUsage: number;
    avgUptime: number;
  }> {
    const cacheKey = instanceIds ? `aggr_stats_${instanceIds.sort().join('_')}` : 'aggr_stats_all';

    return resourceCacheService.getOrSet(
      cacheKey,
      async () => {
        const instances = instanceIds
          ? await Promise.all(instanceIds.map(id => this.databaseService.getInstanceById(id)))
          : await this.databaseService.getAllInstances();

        const validInstances = instances.filter(Boolean) as MessageInstance[];

        const batchStatus = await this.getBatchInstanceStatus(
          validInstances.map(i => i.id),
          {
            includeMemory: true,
            includeAuth: true,
            includeHealth: true,
            includeContainers: false,
          },
        );

        let running = 0;
        let healthy = 0;
        let authenticated = 0;
        let errorCount = 0;
        let totalMemory = 0;
        let totalUptime = 0;

        Object.values(batchStatus).forEach(status => {
          if (status.status === 'running') running++;
          if (status.health.healthy) healthy++;
          if (status.authStatus && status.authStatus.auth_status === 'client_ready') authenticated++;
          if (status.memoryData?.error_count > 0) errorCount++;
          if (status.memoryData?.memory_usage_mb) totalMemory += status.memoryData.memory_usage_mb;
          if (status.memoryData?.uptime_hours) totalUptime += status.memoryData.uptime_hours;
        });

        return {
          total: validInstances.length,
          running,
          stopped: validInstances.length - running,
          healthy,
          authenticated,
          errors: errorCount,
          memoryUsage: totalMemory,
          avgUptime: validInstances.length > 0 ? totalUptime / validInstances.length : 0,
        };
      },
      45000, // 45 секунд TTL
    );
  }
}

// Singleton экземпляр
export const batchInstanceService = new BatchInstanceService(); 