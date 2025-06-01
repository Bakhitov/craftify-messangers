import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { DatabaseService } from '../../services/database.service';
import { DockerService } from '../../services/docker.service';
import { ProcessingService } from '../../services/processing.service';
import { ComposeService } from '../../services/compose.service';
import { InstanceMonitorService } from '../../services/instance-monitor.service';
import { instanceMemoryService } from '../../services/instance-memory.service';
import { ProcessInstanceRequest } from '../../models/instance.model';
import {
  strictRateLimit,
  moderateRateLimit,
  lenientRateLimit,
} from '../../middleware/rate-limiter.middleware';
import logger from '../../../logger';

export const instancesRouter = Router();

// Инициализация сервисов
const databaseService = new DatabaseService();
const dockerService = new DockerService();
const processingService = new ProcessingService(databaseService, dockerService);
const composeService = new ComposeService(dockerService);
const instanceMonitorService = new InstanceMonitorService(dockerService);

// POST /api/v1/instances - Создать новый экземпляр (строгий лимит)
instancesRouter.post(
  '/',
  strictRateLimit.middleware(),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { user_id, provider, type_instance, config } = req.body;

      // Валидация обязательных полей
      if (!user_id || !provider || !type_instance) {
        res.status(400).json({
          success: false,
          error: 'user_id, provider, and type_instance are required',
        });
        return;
      }

      // Валидация provider
      if (!['whatsappweb', 'telegram'].includes(provider)) {
        res.status(400).json({
          success: false,
          error: 'provider must be either "whatsappweb" or "telegram"',
        });
        return;
      }

      // Валидация type_instance
      if (!Array.isArray(type_instance) || type_instance.length === 0) {
        res.status(400).json({
          success: false,
          error: 'type_instance must be a non-empty array',
        });
        return;
      }

      const validTypes = ['api', 'mcp'];
      if (!type_instance.every(type => validTypes.includes(type))) {
        res.status(400).json({
          success: false,
          error: 'type_instance must contain only "api" and/or "mcp"',
        });
        return;
      }

      // Для Telegram проверяем наличие token в корне запроса
      if (provider === 'telegram') {
        const { token } = req.body;
        if (!token || typeof token !== 'string') {
          res.status(400).json({
            success: false,
            error: 'For telegram provider, token (bot token) is required',
          });
          return;
        }
      }

      // Генерируем ID экземпляра
      const instanceId = crypto.randomUUID();

      // Создаем экземпляр в базе данных с поддержкой всех полей
      const instanceData = {
        id: instanceId,
        user_id,
        provider,
        type_instance,
        api_webhook_schema: req.body.api_webhook_schema || {},
        mcp_schema: req.body.mcp_schema || {},
        token: provider === 'telegram' ? req.body.token : undefined, // Для Telegram сохраняем token
        agent_id: req.body.agent_id || null, // ID агента
        agno_enable: req.body.agno_enable !== undefined ? req.body.agno_enable : true, // Включение Agno
        stream: req.body.stream !== undefined ? req.body.stream : false, // Поддержка стриминга
        auth_status: req.body.auth_status || 'pending', // Статус аутентификации
      };

      await databaseService.createInstance(instanceData);

      // Сразу запускаем обработку экземпляра
      const processResult = await processingService.processInstance(instanceId);

      res.status(201).json({
        success: true,
        instance_id: instanceId,
        message: 'Instance created and processing started',
        process_result: processResult,
      });
    } catch (error: any) {
      logger.error('Failed to create instance', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

// GET /api/v1/instances/memory/stats - Получить общую статистику из памяти
instancesRouter.get(
  '/memory/stats',
  lenientRateLimit.middleware(),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const stats = instanceMemoryService.getStats();

      res.json({
        success: true,
        stats,
      });
    } catch (error: any) {
      logger.error('Failed to get memory stats', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

// GET /api/v1/instances - Получить список всех инстансов (мягкий лимит)
instancesRouter.get(
  '/',
  lenientRateLimit.middleware(),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const filters = {
        user_id: req.query.user_id as string,
        provider: req.query.provider as string,
      };

      // Получаем данные из БД
      const instances = await databaseService.getAllInstances(filters);

      // Добавляем runtime информацию из памяти и Docker
      const instancesWithStatus = await Promise.all(
        instances.map(async instance => {
          const dockerStatus = await dockerService.getComposeStatus(instance.id);
          const memoryData = instanceMemoryService.getInstance(instance.id);

          return {
            ...instance,
            status: dockerStatus.running
              ? 'running'
              : dockerStatus.exists
                ? 'stopped'
                : 'not_created',
            // Добавляем данные из памяти
            memory_status: memoryData?.status,
            auth_status: memoryData?.auth_status,
            is_ready_for_messages: memoryData?.is_ready_for_messages,
            last_activity: memoryData?.last_activity,
            whatsapp_user: memoryData?.whatsapp_user,
            message_stats: memoryData?.message_stats,
          };
        }),
      );

      res.json({
        success: true,
        instances: instancesWithStatus,
        total: instancesWithStatus.length,
      });
    } catch (error: any) {
      logger.error('Failed to get instances', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

// GET /api/v1/instances/:id - Получить информацию об инстансе (мягкий лимит)
instancesRouter.get(
  '/:id',
  lenientRateLimit.middleware(),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const instance = await databaseService.getInstanceById(id);

      if (!instance) {
        res.status(404).json({
          success: false,
          error: 'Instance not found',
        });
        return;
      }

      // Добавляем runtime информацию
      const dockerStatus = await dockerService.getComposeStatus(id);
      const health = await instanceMonitorService.checkInstanceHealth(instance);
      const memoryData = instanceMemoryService.getInstance(id);

      res.json({
        success: true,
        instance: {
          ...instance,
          status: dockerStatus.running
            ? 'running'
            : dockerStatus.exists
              ? 'stopped'
              : 'not_created',
          health: health,
          containers: dockerStatus.containers,
          // Добавляем полные данные из памяти
          memory_data: memoryData,
        },
      });
    } catch (error: any) {
      logger.error('Failed to get instance', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

// GET /api/v1/instances/:id/memory - Получить полные данные из памяти
instancesRouter.get('/:id/memory', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Проверяем существование инстанса в БД
    const instance = await databaseService.getInstanceById(id);
    if (!instance) {
      res.status(404).json({
        success: false,
        error: 'Instance not found',
      });
      return;
    }

    // Получаем данные из памяти
    const memoryData = instanceMemoryService.getInstance(id);

    if (!memoryData) {
      res.status(404).json({
        success: false,
        error: 'Instance not found in memory',
        message: 'Instance exists in database but not loaded in memory',
      });
      return;
    }

    res.json({
      success: true,
      data: memoryData,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Failed to get instance memory data', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/v1/instances/:id/status-history - Получить историю статусов
instancesRouter.get('/:id/status-history', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    // Проверяем существование инстанса в БД
    const instance = await databaseService.getInstanceById(id);
    if (!instance) {
      res.status(404).json({
        success: false,
        error: 'Instance not found',
      });
      return;
    }

    // Получаем историю статусов из памяти
    const statusHistory = instanceMemoryService.getStatusHistory(id, limit);

    res.json({
      success: true,
      data: statusHistory,
      count: statusHistory.length,
      limit,
    });
  } catch (error: any) {
    logger.error('Failed to get status history', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/v1/instances/:id/qr-history - Получить историю QR кодов
instancesRouter.get('/:id/qr-history', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    // Проверяем существование инстанса в БД
    const instance = await databaseService.getInstanceById(id);
    if (!instance) {
      res.status(404).json({
        success: false,
        error: 'Instance not found',
      });
      return;
    }

    // Получаем историю QR кодов из памяти
    const qrHistory = instanceMemoryService.getQRHistory(id, limit);

    res.json({
      success: true,
      data: qrHistory,
      count: qrHistory.length,
      limit,
    });
  } catch (error: any) {
    logger.error('Failed to get QR history', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/v1/instances/:id/api-key-history - Получить историю API ключей
instancesRouter.get('/:id/api-key-history', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    // Проверяем существование инстанса в БД
    const instance = await databaseService.getInstanceById(id);
    if (!instance) {
      res.status(404).json({
        success: false,
        error: 'Instance not found',
      });
      return;
    }

    // Получаем историю API ключей из памяти
    const apiKeyHistory = instanceMemoryService.getApiKeyHistory(id, limit);

    res.json({
      success: true,
      data: apiKeyHistory,
      count: apiKeyHistory.length,
      limit,
    });
  } catch (error: any) {
    logger.error('Failed to get API key history', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/v1/instances/:id/current-qr - Получить текущий QR код
instancesRouter.get('/:id/current-qr', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Проверяем существование инстанса в БД
    const instance = await databaseService.getInstanceById(id);
    if (!instance) {
      res.status(404).json({
        success: false,
        error: 'Instance not found',
      });
      return;
    }

    // Получаем текущий QR код из памяти
    const currentQR = instanceMemoryService.getCurrentQR(id);

    if (!currentQR) {
      res.status(404).json({
        success: false,
        error: 'QR code not available',
        message: 'No QR code generated or instance not ready',
      });
      return;
    }

    res.json({
      success: true,
      data: currentQR,
    });
  } catch (error: any) {
    logger.error('Failed to get current QR code', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/v1/instances/:id/current-api-key - Получить текущий API ключ
instancesRouter.get('/:id/current-api-key', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Проверяем существование инстанса в БД
    const instance = await databaseService.getInstanceById(id);
    if (!instance) {
      res.status(404).json({
        success: false,
        error: 'Instance not found',
      });
      return;
    }

    // 1. Сначала проверяем память
    let currentApiKey = instanceMemoryService.getCurrentApiKey(id);
    let source = 'memory';

    // 2. Если в памяти нет, проверяем DB
    if (!currentApiKey) {
      currentApiKey = instance.current_api_key || instance.api_key || null;
      source = 'database';

      // 3. Если нашли в DB, сохраняем в память для синхронизации
      if (currentApiKey) {
        instanceMemoryService.saveApiKey(id, currentApiKey, {
          source: 'API:getCurrentApiKey:sync_from_db',
          saveToDb: false, // Уже в DB
        });
        source = 'database_synced_to_memory';
      }
    }

    if (!currentApiKey) {
      res.status(404).json({
        success: false,
        error: 'API key not available',
        message: 'No API key generated for this instance',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        api_key: currentApiKey,
        generated_at: instance.api_key_generated_at,
        source: source,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get current API key', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/v1/instances/:id/activity-stats - Получить статистику активности
instancesRouter.get('/:id/activity-stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Проверяем существование инстанса в БД
    const instance = await databaseService.getInstanceById(id);
    if (!instance) {
      res.status(404).json({
        success: false,
        error: 'Instance not found',
      });
      return;
    }

    // Получаем статистику активности из памяти
    const activityStats = instanceMemoryService.getActivityStats(id);

    if (!activityStats) {
      res.status(404).json({
        success: false,
        error: 'Activity stats not available',
        message: 'Instance not found in memory',
      });
      return;
    }

    res.json({
      success: true,
      data: activityStats,
    });
  } catch (error: any) {
    logger.error('Failed to get activity stats', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/v1/instances/:id/errors - Получить список ошибок
instancesRouter.get('/:id/errors', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    // Проверяем существование инстанса в БД
    const instance = await databaseService.getInstanceById(id);
    if (!instance) {
      res.status(404).json({
        success: false,
        error: 'Instance not found',
      });
      return;
    }

    // Получаем список ошибок из памяти
    const errors = instanceMemoryService.getErrors(id, limit);

    res.json({
      success: true,
      data: errors,
      count: errors.length,
      limit,
    });
  } catch (error: any) {
    logger.error('Failed to get errors', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /api/v1/instances/:id/clear-errors - Очистить список ошибок
instancesRouter.post('/:id/clear-errors', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Проверяем существование инстанса в БД
    const instance = await databaseService.getInstanceById(id);
    if (!instance) {
      res.status(404).json({
        success: false,
        error: 'Instance not found',
      });
      return;
    }

    // Очищаем ошибки в памяти
    instanceMemoryService.clearErrors(id);

    res.json({
      success: true,
      message: 'Errors cleared successfully',
    });
  } catch (error: any) {
    logger.error('Failed to clear errors', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /api/v1/instances/:id/process - Обработать конфигурацию инстанса (строгий лимит)
instancesRouter.post(
  '/:id/process',
  strictRateLimit.middleware(),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const body = req.body as ProcessInstanceRequest;

      const result = await processingService.processInstance(id, body.force_recreate);

      res.json(result);
    } catch (error: any) {
      logger.error('Failed to process instance', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

// POST /api/v1/instances/:id/start - Запустить инстанс (умеренный лимит)
instancesRouter.post(
  '/:id/start',
  moderateRateLimit.middleware(),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const instance = await databaseService.getInstanceById(id);

      if (!instance) {
        res.status(404).json({
          success: false,
          error: 'Instance not found',
        });
        return;
      }

      await composeService.startInstance(id);

      res.json({
        success: true,
        message: 'Instance started successfully',
      });
    } catch (error: any) {
      logger.error('Failed to start instance', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

// POST /api/v1/instances/:id/stop - Остановить инстанс (умеренный лимит)
instancesRouter.post(
  '/:id/stop',
  moderateRateLimit.middleware(),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const instance = await databaseService.getInstanceById(id);

      if (!instance) {
        res.status(404).json({
          success: false,
          error: 'Instance not found',
        });
        return;
      }

      await composeService.stopInstance(id);

      res.json({
        success: true,
        message: 'Instance stopped successfully',
      });
    } catch (error: any) {
      logger.error('Failed to stop instance', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

// POST /api/v1/instances/:id/restart - Перезапустить инстанс (умеренный лимит)
instancesRouter.post(
  '/:id/restart',
  moderateRateLimit.middleware(),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const instance = await databaseService.getInstanceById(id);

      if (!instance) {
        res.status(404).json({
          success: false,
          error: 'Instance not found',
        });
        return;
      }

      await composeService.restartInstance(id);

      res.json({
        success: true,
        message: 'Instance restarted successfully',
      });
    } catch (error: any) {
      logger.error('Failed to restart instance', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

// DELETE /api/v1/instances/:id - Удалить инстанс (строгий лимит)
instancesRouter.delete(
  '/:id',
  strictRateLimit.middleware(),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const instance = await databaseService.getInstanceById(id);

      if (!instance) {
        res.status(404).json({
          success: false,
          error: 'Instance not found',
        });
        return;
      }

      // Удаляем контейнеры и файлы
      await composeService.deleteInstance(id);

      // Удаляем из БД
      await databaseService.deleteInstance(id);

      res.json({
        success: true,
        message: 'Instance deleted successfully',
      });
    } catch (error: any) {
      logger.error('Failed to delete instance', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

// GET /api/v1/instances/:id/auth-status - Получить статус аутентификации
instancesRouter.get('/:id/auth-status', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const instance = await databaseService.getInstanceById(id);

    if (!instance) {
      res.status(404).json({
        success: false,
        error: 'Instance not found',
      });
      return;
    }

    const authStatus = await instanceMonitorService.getAuthStatus(instance);

    res.json({
      success: true,
      ...authStatus,
    });
  } catch (error: any) {
    logger.error('Failed to get auth status', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/v1/instances/:id/qr - Получить QR-код
instancesRouter.get('/:id/qr', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const instance = await databaseService.getInstanceById(id);

    if (!instance) {
      res.status(404).json({
        success: false,
        error: 'Instance not found',
      });
      return;
    }

    const qrCode = await instanceMonitorService.getQRCode(instance);

    if (!qrCode) {
      res.status(404).json({
        success: false,
        error: 'QR code not available',
      });
      return;
    }

    res.json({
      success: true,
      ...qrCode,
    });
  } catch (error: any) {
    logger.error('Failed to get QR code', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/v1/instances/:id/credentials - Получить учетные данные
instancesRouter.get('/:id/credentials', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const instance = await databaseService.getInstanceById(id);

    if (!instance) {
      res.status(404).json({
        success: false,
        error: 'Instance not found',
      });
      return;
    }

    const credentials = await instanceMonitorService.getCredentials(instance);

    if (!credentials) {
      res.status(404).json({
        success: false,
        error: 'Credentials not available',
      });
      return;
    }

    res.json({
      success: true,
      ...credentials,
    });
  } catch (error: any) {
    logger.error('Failed to get credentials', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/v1/instances/:id/logs - Получить логи инстанса
instancesRouter.get('/:id/logs', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const tail = parseInt(req.query.tail as string) || 100;

    const instance = await databaseService.getInstanceById(id);

    if (!instance) {
      res.status(404).json({
        success: false,
        error: 'Instance not found',
      });
      return;
    }

    const logs = await instanceMonitorService.getInstanceLogs(id, tail);

    res.json({
      success: true,
      logs,
    });
  } catch (error: any) {
    logger.error('Failed to get logs', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
