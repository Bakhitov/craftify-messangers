import { Router, Request, Response } from 'express';
import { DatabaseService } from '../../services/database.service';
import { DockerService } from '../../services/docker.service';
import { ResourceService } from '../../services/resource.service';
import { ProcessingService } from '../../services/processing.service';
import { PortManager } from '../../utils/port-manager.utils';
import { instanceMemoryService } from '../../services/instance-memory.service';
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

// GET /api/v1/resources - Получить общую информацию о ресурсах сервера (мягкий лимит)
resourcesRouter.get(
  '/',
  lenientRateLimit.middleware(),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const resources = await resourceService.getServerResources();
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

// GET /api/v1/resources/instances - Получить информацию о ресурсах инстансов (мягкий лимит)
resourcesRouter.get(
  '/instances',
  lenientRateLimit.middleware(),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const instances = await resourceService.getInstancesResources();
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

// GET /api/v1/resources/ports - Получить статистику использования портов (мягкий лимит)
resourcesRouter.get(
  '/ports',
  lenientRateLimit.middleware(),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const portStats = await portManager.getPortStatistics();
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
      portManager.clearCache();
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

// GET /api/v1/resources/performance - Получить метрики производительности (мягкий лимит)
resourcesRouter.get(
  '/performance',
  lenientRateLimit.middleware(),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const metrics = await processingService.getPerformanceMetrics();
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

// GET /api/v1/resources/health - Получить состояние здоровья системы (мягкий лимит)
resourcesRouter.get(
  '/health',
  lenientRateLimit.middleware(),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const health = await processingService.getSystemHealth();
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

// POST /api/v1/resources/memory/cleanup - Принудительная очистка памяти (умеренный лимит)
resourcesRouter.post(
  '/memory/cleanup',
  moderateRateLimit.middleware(),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const cleanupResult = instanceMemoryService.forceMemoryCleanupPublic();

      res.json({
        success: true,
        message: 'Memory cleanup completed',
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

      const results = await processingService.runStressTest(concurrentRequests, duration);
      res.json({
        success: true,
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
