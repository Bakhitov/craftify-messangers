import { Request, Response, NextFunction } from 'express';
import logger from '../../logger';

interface RateLimitConfig {
  windowMs: number; // Окно времени в миллисекундах
  maxRequests: number; // Максимальное количество запросов в окне
  skipSuccessfulRequests?: boolean; // Пропускать успешные запросы
  skipFailedRequests?: boolean; // Пропускать неудачные запросы
}

interface ClientInfo {
  requests: number[];
  blocked: boolean;
  blockedUntil?: number;
}

export class RateLimiter {
  private clients = new Map<string, ClientInfo>();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(private config: RateLimitConfig) {
    // Очистка старых записей каждые 5 минут
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const clientId = this.getClientId(req);
      const now = Date.now();

      // Получаем или создаем информацию о клиенте
      let clientInfo = this.clients.get(clientId);
      if (!clientInfo) {
        clientInfo = { requests: [], blocked: false };
        this.clients.set(clientId, clientInfo);
      }

      // Проверяем, заблокирован ли клиент
      if (clientInfo.blocked && clientInfo.blockedUntil && now < clientInfo.blockedUntil) {
        const remainingTime = Math.ceil((clientInfo.blockedUntil - now) / 1000);
        logger.warn(`Rate limit exceeded for client ${clientId}, blocked for ${remainingTime}s`);

        res.status(429).json({
          success: false,
          error: 'Too many requests',
          retryAfter: remainingTime,
          message: `Превышен лимит запросов. Повторите попытку через ${remainingTime} секунд.`,
        });
        return;
      }

      // Убираем старые запросы из окна
      const windowStart = now - this.config.windowMs;
      clientInfo.requests = clientInfo.requests.filter(time => time > windowStart);

      // Проверяем лимит
      if (clientInfo.requests.length >= this.config.maxRequests) {
        // Блокируем клиента на время окна
        clientInfo.blocked = true;
        clientInfo.blockedUntil = now + this.config.windowMs;

        logger.warn(
          `Rate limit exceeded for client ${clientId}, blocking for ${this.config.windowMs}ms`,
        );

        res.status(429).json({
          success: false,
          error: 'Too many requests',
          retryAfter: Math.ceil(this.config.windowMs / 1000),
          message: `Превышен лимит запросов (${this.config.maxRequests} за ${this.config.windowMs / 1000}с). Повторите попытку позже.`,
        });
        return;
      }

      // Добавляем текущий запрос
      clientInfo.requests.push(now);
      clientInfo.blocked = false;
      clientInfo.blockedUntil = undefined;

      // Добавляем заголовки с информацией о лимитах
      res.setHeader('X-RateLimit-Limit', this.config.maxRequests);
      res.setHeader('X-RateLimit-Remaining', this.config.maxRequests - clientInfo.requests.length);
      res.setHeader('X-RateLimit-Reset', new Date(now + this.config.windowMs).toISOString());

      next();
    };
  }

  private getClientId(req: Request): string {
    // Используем IP адрес как идентификатор клиента
    // В продакшене можно использовать более сложную логику (API ключи, пользователи и т.д.)
    return req.ip || req.connection.remoteAddress || 'unknown';
  }

  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    for (const [clientId, clientInfo] of this.clients.entries()) {
      // Удаляем старые запросы
      clientInfo.requests = clientInfo.requests.filter(time => time > windowStart);

      // Убираем блокировку если время истекло
      if (clientInfo.blocked && clientInfo.blockedUntil && now >= clientInfo.blockedUntil) {
        clientInfo.blocked = false;
        clientInfo.blockedUntil = undefined;
      }

      // Удаляем клиентов без активности
      if (clientInfo.requests.length === 0 && !clientInfo.blocked) {
        this.clients.delete(clientId);
      }
    }

    logger.debug(`Rate limiter cleanup completed, active clients: ${this.clients.size}`);
  }

  // Метод для получения статистики
  getStats(): {
    activeClients: number;
    blockedClients: number;
    totalRequests: number;
  } {
    let blockedClients = 0;
    let totalRequests = 0;

    for (const clientInfo of this.clients.values()) {
      if (clientInfo.blocked) {
        blockedClients++;
      }
      totalRequests += clientInfo.requests.length;
    }

    return {
      activeClients: this.clients.size,
      blockedClients,
      totalRequests,
    };
  }

  // Метод для сброса лимитов (для тестирования)
  reset(): void {
    this.clients.clear();
    logger.info('Rate limiter reset');
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.clients.clear();
  }
}

// Предустановленные конфигурации
export const rateLimitConfigs = {
  // Строгий лимит для создания инстансов
  strict: {
    windowMs: 60 * 1000, // 1 минута
    maxRequests: 5, // 5 запросов в минуту
  },

  // Умеренный лимит для обычных операций
  moderate: {
    windowMs: 60 * 1000, // 1 минута
    maxRequests: 30, // 30 запросов в минуту
  },

  // Мягкий лимит для чтения данных
  lenient: {
    windowMs: 60 * 1000, // 1 минута
    maxRequests: 100, // 100 запросов в минуту
  },

  // Очень строгий лимит для стресс-тестов
  stressTest: {
    windowMs: 5 * 60 * 1000, // 5 минут
    maxRequests: 1, // 1 запрос в 5 минут
  },
};

// Экспортируем готовые middleware
export const strictRateLimit = new RateLimiter(rateLimitConfigs.strict);
export const moderateRateLimit = new RateLimiter(rateLimitConfigs.moderate);
export const lenientRateLimit = new RateLimiter(rateLimitConfigs.lenient);
export const stressTestRateLimit = new RateLimiter(rateLimitConfigs.stressTest);
