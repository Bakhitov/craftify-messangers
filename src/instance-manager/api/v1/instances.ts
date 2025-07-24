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
import { batchInstanceService } from '../../services/batch-instance.service';

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
        api_key: req.body.api_key, // Для WhatsApp
        token: req.body.token, // Для Telegram
        auth_status: req.body.auth_status || 'pending',
        agno_config: req.body.agno_config, // Добавляем поддержку agno_config
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
          // Приоритет данных из памяти для auth_status и whatsapp_state
          auth_status: memoryData?.auth_status || instance.auth_status,
          whatsapp_state: memoryData ? memoryData.whatsapp_state : instance.whatsapp_state,
          account: memoryData?.whatsapp_user?.account || instance.account,
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

// GET /api/v1/instances/:id/api-key - Получить API ключ (всегда равен instanceId)
instancesRouter.get('/:id/api-key', async (req: Request, res: Response): Promise<void> => {
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

    // API ключ всегда равен instanceId
    const apiKey = id;

    res.json({
      success: true,
      data: {
        api_key: apiKey,
        generated_at: instance.api_key_generated_at || instance.created_at,
        usage_count: instanceMemoryService.getInstance(id)?.api_key_usage_count || 0,
        last_use: instanceMemoryService.getInstance(id)?.api_key_last_use,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get API key', error);
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

// GET /api/v1/instances/batch/status - Получить статус множественных экземпляров (НОВЫЙ ENDPOINT)
instancesRouter.post(
  '/batch/status',
  lenientRateLimit.middleware(),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { instance_ids, options } = req.body;

      if (!instance_ids || !Array.isArray(instance_ids)) {
        res.status(400).json({
          success: false,
          error: 'instance_ids array is required',
        });
        return;
      }

      if (instance_ids.length > 50) {
        res.status(400).json({
          success: false,
          error: 'Maximum 50 instances per batch request',
        });
        return;
      }

      const batchStatus = await batchInstanceService.getBatchInstanceStatus(instance_ids, options);

      res.json({
        success: true,
        batch_size: instance_ids.length,
        instances: batchStatus,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error('Failed to get batch instance status', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

// POST /api/v1/instances/batch/update - Batch обновление экземпляров (НОВЫЙ ENDPOINT)
instancesRouter.post(
  '/batch/update',
  strictRateLimit.middleware(),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { updates } = req.body;

      if (!updates || !Array.isArray(updates)) {
        res.status(400).json({
          success: false,
          error: 'updates array is required',
        });
        return;
      }

      if (updates.length > 20) {
        res.status(400).json({
          success: false,
          error: 'Maximum 20 instances per batch update',
        });
        return;
      }

      // Валидация каждого update
      for (const update of updates) {
        if (!update.id || !update.data) {
          res.status(400).json({
            success: false,
            error: 'Each update must have id and data fields',
          });
          return;
        }
      }

      const result = await batchInstanceService.batchUpdateInstances(updates);

      res.json({
        ...result,
        batch_size: updates.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error('Failed to batch update instances', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

// GET /api/v1/instances/stats/aggregated - Агрегированная статистика экземпляров (НОВЫЙ ENDPOINT)
instancesRouter.get(
  '/stats/aggregated',
  lenientRateLimit.middleware(),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { instance_ids } = req.query;
      
      let instanceIds: string[] | undefined;
      if (instance_ids) {
        if (typeof instance_ids === 'string') {
          instanceIds = instance_ids.split(',');
        } else if (Array.isArray(instance_ids)) {
          instanceIds = instance_ids as string[];
        }
      }

      const stats = await batchInstanceService.getAggregatedStats(instanceIds);

      res.json({
        success: true,
        stats,
        scope: instanceIds ? 'filtered' : 'all',
        filtered_count: instanceIds?.length || 0,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error('Failed to get aggregated stats', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);
