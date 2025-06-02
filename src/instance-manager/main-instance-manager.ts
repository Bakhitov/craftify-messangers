import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import { DatabaseService } from './services/database.service';
import { DockerService } from './services/docker.service';
import logger from '../logger';
import { InstanceMonitorService } from './services/instance-monitor.service';
import { requestLogger, errorHandler } from '../middleware';
import { v1Router } from './api/v1';

const app: Application = express();

// Конфигурация
const PORT = 3000;

// Настройка CORS
const corsOptions = {
  origin: function (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ): void {
    // В development режиме разрешаем все origins
    if (process.env.NODE_ENV === 'development') {
      callback(null, true);
      return;
    }

    // Разрешаем запросы без origin (например, мобильные приложения, Postman)
    if (!origin) {
      callback(null, true);
      return;
    }

    // Базовые разрешенные origins
    const allowedOrigins = [
      'http://localhost',
      'http://127.0.0.1',
      'https://localhost',
      'https://127.0.0.1',
    ];

    // Добавляем CORS_ORIGIN из переменных окружения
    if (process.env.CORS_ORIGIN) {
      allowedOrigins.push(process.env.CORS_ORIGIN);
    }

    // Добавляем INSTANCE_MANAGER_BASE_URL из переменных окружения
    if (process.env.INSTANCE_MANAGER_BASE_URL) {
      allowedOrigins.push(process.env.INSTANCE_MANAGER_BASE_URL);
    }

    // Получаем внешний IP из переменных окружения или определяем динамически
    const externalIP =
      process.env.EXTERNAL_IP || process.env.INSTANCE_MANAGER_BASE_URL?.match(/\/\/([^:]+)/)?.[1];

    // Проверяем точное совпадение с разрешенными origins
    const isExactMatch = allowedOrigins.some(allowedOrigin => origin === allowedOrigin);
    if (isExactMatch) {
      callback(null, true);
      return;
    }

    // Проверяем паттерны для localhost и 127.0.0.1 с любыми портами
    const localhostPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
    if (localhostPattern.test(origin)) {
      callback(null, true);
      return;
    }

    // Проверяем паттерн для внешнего IP с любыми портами
    if (externalIP && externalIP !== 'localhost') {
      const externalIPPattern = new RegExp(
        `^https?://${externalIP.replace(/\./g, '\\.')}(:\\d+)?$`,
      );
      if (externalIPPattern.test(origin)) {
        callback(null, true);
        return;
      }
    }

    // Если ничего не подошло, блокируем
    logger.warn(`CORS blocked request from origin: ${origin}`);
    callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
};

// Сервисы
const databaseService = new DatabaseService();
const dockerService = new DockerService();
const instanceMonitorService = new InstanceMonitorService(dockerService, databaseService);

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(requestLogger);

// API Routes
app.use('/api/v1', v1Router);

// Routes
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: 'development',
    hotReload: 'active',
    version: '0.2.6-dev-hotreload-test',
  });
});

// Error handling
app.use(errorHandler);

// Инициализация и запуск
async function main(): Promise<void> {
  try {
    logger.info('🚀 Starting Instance Manager...');

    // Инициализация базы данных
    await databaseService.initialize();
    logger.info('✅ Database initialized');

    // Проверка Docker (опционально в режиме разработки)
    let dockerAvailable = false;
    try {
      dockerAvailable = await dockerService.checkConnection();
      if (!dockerAvailable) {
        throw new Error('Docker is not available');
      }
      logger.info('✅ Docker connection verified');
    } catch (error: unknown) {
      logger.error('Docker connection failed:', error);

      // В режиме разработки продолжаем работу без Docker
      if (process.env.NODE_ENV === 'development') {
        logger.warn(
          '⚠️  Running in development mode without Docker - some features will be disabled',
        );
        dockerAvailable = false;
      } else {
        logger.error('❌ Docker is required in production mode');
        process.exit(1);
      }
    }

    // Запуск сервиса обновления статусов аутентификации только если Docker доступен
    let statusUpdateInterval: NodeJS.Timeout | null = null;
    if (dockerAvailable) {
      const updateInterval = 60000; // 60 секунд (увеличено с 30 секунд для снижения нагрузки)
      statusUpdateInterval = await instanceMonitorService.startStatusUpdateInterval(updateInterval);
      logger.info(`✅ Auth status update service started (interval: ${updateInterval}ms)`);
    } else {
      logger.warn('⚠️  Instance monitoring disabled - Docker not available');
    }

    // Запуск сервера
    app.listen(PORT, () => {
      logger.info(`🌐 Instance Manager API running on port ${PORT}`);
      if (!dockerAvailable) {
        logger.warn('⚠️  Docker features disabled - running in limited mode');
      }
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('🛑 Shutting down Instance Manager...');
      if (statusUpdateInterval) {
        clearInterval(statusUpdateInterval);
      }
      await databaseService.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('🛑 Shutting down Instance Manager...');
      if (statusUpdateInterval) {
        clearInterval(statusUpdateInterval);
      }
      await databaseService.close();
      process.exit(0);
    });
  } catch (error: unknown) {
    logger.error('❌ Failed to start Instance Manager:', error);
    process.exit(1);
  }
}

// Запуск приложения
main();
