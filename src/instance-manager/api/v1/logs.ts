import { Router, Request, Response } from 'express';
import { LogsService } from '../../services/logs.service';
import { lenientRateLimit } from '../../middleware/rate-limiter.middleware';
import logger from '../../../logger';

export const logsRouter = Router();

// Инициализация сервиса логов
const logsService = new LogsService();

// GET /api/v1/logs - Получить логи Instance Manager
logsRouter.get(
  '/',
  lenientRateLimit.middleware(),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const tail = parseInt(req.query.tail as string) || 100;
      const level = req.query.level as string;

      // Валидация tail
      if (tail < 1 || tail > 10000) {
        res.status(400).json({
          success: false,
          error: 'tail parameter must be between 1 and 10000',
        });
        return;
      }

      // Валидация level
      const validLevels = ['error', 'warn', 'info', 'http', 'debug'];
      if (level && !validLevels.includes(level.toLowerCase())) {
        res.status(400).json({
          success: false,
          error: `level must be one of: ${validLevels.join(', ')}`,
        });
        return;
      }

      const logsData = await logsService.getInstanceManagerLogs(tail, level);

      res.json({
        success: true,
        data: logsData,
        metadata: {
          requested_tail: tail,
          requested_level: level || 'all',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      logger.error('Failed to get instance manager logs', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

// GET /api/v1/logs/latest - Получить последние логи (для polling)
logsRouter.get(
  '/latest',
  lenientRateLimit.middleware(),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const lines = parseInt(req.query.lines as string) || 50;

      // Валидация lines
      if (lines < 1 || lines > 1000) {
        res.status(400).json({
          success: false,
          error: 'lines parameter must be between 1 and 1000',
        });
        return;
      }

      const logs = await logsService.getLatestLogs(lines);

      res.json({
        success: true,
        data: {
          logs,
          count: logs.length,
        },
        metadata: {
          requested_lines: lines,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      logger.error('Failed to get latest logs', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

// GET /api/v1/logs/stats - Получить статистику логов
logsRouter.get(
  '/stats',
  lenientRateLimit.middleware(),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const lines = parseInt(req.query.lines as string) || 1000;

      // Валидация lines
      if (lines < 100 || lines > 10000) {
        res.status(400).json({
          success: false,
          error: 'lines parameter must be between 100 and 10000',
        });
        return;
      }

      const [statistics, fileSize] = await Promise.all([
        logsService.getLogStatistics(lines),
        logsService.getLogFileSize(),
      ]);

      res.json({
        success: true,
        data: {
          level_statistics: statistics,
          file_info: {
            size_bytes: fileSize,
            size_mb: Math.round((fileSize / 1024 / 1024) * 100) / 100,
            available: logsService.isLogFileAvailable(),
          },
          analysis_scope: {
            lines_analyzed: lines,
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (error: any) {
      logger.error('Failed to get log statistics', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

// GET /api/v1/logs/health - Проверка доступности логов
logsRouter.get('/health', async (_req: Request, res: Response): Promise<void> => {
  try {
    const isAvailable = logsService.isLogFileAvailable();
    const fileSize = logsService.getLogFileSize();

    res.json({
      success: true,
      data: {
        log_file_available: isAvailable,
        file_size_bytes: fileSize,
        status: isAvailable ? 'healthy' : 'unavailable',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Failed to check logs health', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
