import { Router, Request, Response } from 'express';
import { DatabaseService } from '../../services/database.service';
import { DockerService } from '../../services/docker.service';
import { ResourceService } from '../../services/resource.service';
import { ProcessingService } from '../../services/processing.service';
import { PortManager } from '../../utils/port-manager.utils';
import { instanceMemoryService } from '../../services/instance-memory.service';
import { resourceCacheService } from '../../services/resource-cache.service';
import {
  lenientRateLimit,
  moderateRateLimit,
  stressTestRateLimit,
} from '../../middleware/rate-limiter.middleware';
import logger from '../../../logger';

export const resourcesRouter = Router();

// Инициализация сервисов
const databaseService = new DatabaseService();
const dockerService = new DockerService();
const resourceService = new ResourceService(dockerService, databaseService);
const processingService = new ProcessingService(databaseService, dockerService);
const portManager = new PortManager(databaseService.getPool());

// GET /api/v1/resources - Получить общую информацию о ресурсах сервера (с кэшированием)
resourcesRouter.get(
  '/',
  lenientRateLimit.middleware(),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const resources = await resourceCacheService.getServerResources(() =>
        resourceService.getServerResources(),
      );

      res.json({
        success: true,
        ...resources,
      });
    } catch (error: any) {
      logger.error('Failed to get server resources', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

// GET /api/v1/resources/instances - Получить информацию о ресурсах инстансов (с кэшированием)
resourcesRouter.get(
  '/instances',
  lenientRateLimit.middleware(),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const instances = await resourceCacheService.getInstancesResources(() =>
        resourceService.getInstancesResources(),
      );

      res.json({
        success: true,
        instances,
        total: instances.length,
      });
    } catch (error: any) {
      logger.error('Failed to get instances resources', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

// GET /api/v1/resources/ports - Получить статистику использования портов (с кэшированием)
resourcesRouter.get(
  '/ports',
  lenientRateLimit.middleware(),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const portStats = await resourceCacheService.getPortStatistics(() =>
        portManager.getPortStatistics(),
      );

      res.json({
        success: true,
        ...portStats,
      });
    } catch (error: any) {
      logger.error('Failed to get port statistics', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

// POST /api/v1/resources/ports/clear-cache - Очистить кэш портов (умеренный лимит)
resourcesRouter.post(
  '/ports/clear-cache',
  moderateRateLimit.middleware(),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      // Очищаем кэш портов в PortManager
      portManager.clearCache();

      // Очищаем кэш портов в ResourceCacheService
      resourceCacheService.invalidate('port_statistics');

      res.json({
        success: true,
        message: 'Port cache cleared successfully',
      });
    } catch (error: any) {
      logger.error('Failed to clear port cache', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

// GET /api/v1/resources/performance - Получить метрики производительности (с кэшированием)
resourcesRouter.get(
  '/performance',
  lenientRateLimit.middleware(),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const metrics = await resourceCacheService.getPerformanceMetrics(() =>
        processingService.getPerformanceMetrics(),
      );

      res.json({
        success: true,
        ...metrics,
      });
    } catch (error: any) {
      logger.error('Failed to get performance metrics', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

// GET /api/v1/resources/health - Получить состояние здоровья системы (с кэшированием)
resourcesRouter.get(
  '/health',
  lenientRateLimit.middleware(),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const health = await resourceCacheService.getSystemHealth(() =>
        processingService.getSystemHealth(),
      );

      res.json({
        success: true,
        ...health,
      });
    } catch (error: any) {
      logger.error('Failed to get system health', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

// GET /api/v1/resources/cache/stats - Новый endpoint для статистики кэша
resourcesRouter.get(
  '/cache/stats',
  lenientRateLimit.middleware(),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const stats = resourceCacheService.getStats();

      res.json({
        success: true,
        cache: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error('Failed to get cache stats', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

// POST /api/v1/resources/cache/clear - Новый endpoint для очистки всего кэша
resourcesRouter.post(
  '/cache/clear',
  moderateRateLimit.middleware(),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { keys } = req.body;

      if (keys && Array.isArray(keys)) {
        // Очищаем конкретные ключи
        let clearedCount = 0;
        keys.forEach((key: string) => {
          if (resourceCacheService.invalidate(key)) {
            clearedCount++;
          }
        });

        res.json({
          success: true,
          message: `Cleared ${clearedCount} cache entries`,
          cleared_keys: keys.filter(key => resourceCacheService.invalidate(key)),
        });
      } else {
        // Очищаем весь кэш
        resourceCacheService.invalidateAll();

        res.json({
          success: true,
          message: 'All cache cleared successfully',
        });
      }
    } catch (error: any) {
      logger.error('Failed to clear cache', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

// POST /api/v1/resources/memory/cleanup - Принудительная очистка памяти (с инвалидацией кэша)
resourcesRouter.post(
  '/memory/cleanup',
  moderateRateLimit.middleware(),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const cleanupResult = instanceMemoryService.forceMemoryCleanupPublic();

      // Инвалидируем кэш связанный с экземплярами после очистки памяти
      resourceCacheService.invalidateInstanceRelated();

      res.json({
        success: true,
        message: 'Memory cleanup completed',
        cache_invalidated: true,
        ...cleanupResult,
      });
    } catch (error: any) {
      logger.error('Failed to cleanup memory', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

// POST /api/v1/resources/stress-test - Запустить стресс-тест (очень строгий лимит)
resourcesRouter.post(
  '/stress-test',
  stressTestRateLimit.middleware(),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { concurrentRequests = 10, duration = 30000 } = req.body;

      // Валидация параметров
      if (concurrentRequests < 1 || concurrentRequests > 50) {
        res.status(400).json({
          success: false,
          error: 'concurrentRequests должно быть от 1 до 50',
        });
        return;
      }

      if (duration < 5000 || duration > 300000) {
        res.status(400).json({
          success: false,
          error: 'duration должно быть от 5000 до 300000 миллисекунд',
        });
        return;
      }

      // Очищаем кэш перед стресс-тестом для получения актуальных данных
      resourceCacheService.invalidateAll();

      const results = await processingService.runStressTest(concurrentRequests, duration);

      res.json({
        success: true,
        cache_cleared_before_test: true,
        ...results,
      });
    } catch (error: any) {
      logger.error('Failed to run stress test', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);
