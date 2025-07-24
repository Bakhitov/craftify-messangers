import logger from '../../logger';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface CacheConfig {
  serverResourcesTTL: number;
  instanceResourcesTTL: number;
  performanceMetricsTTL: number;
  systemHealthTTL: number;
  portStatisticsTTL: number;
}

export class ResourceCacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private config: CacheConfig;

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      serverResourcesTTL: 30000, // 30 секунд для системных ресурсов
      instanceResourcesTTL: 60000, // 60 секунд для ресурсов экземпляров
      performanceMetricsTTL: 45000, // 45 секунд для метрик производительности
      systemHealthTTL: 30000, // 30 секунд для health checks
      portStatisticsTTL: 120000, // 2 минуты для статистики портов
      ...config,
    };

    // Запуск периодической очистки кэша каждые 5 минут
    setInterval(() => this.cleanupExpiredEntries(), 300000);
  }

  async getOrSet<T>(key: string, fetchFunction: () => Promise<T>, ttl: number): Promise<T> {
    const entry = this.cache.get(key);
    const now = Date.now();

    // Проверяем актуальность кэша
    if (entry && now - entry.timestamp < entry.ttl) {
      logger.debug(`Cache HIT for key: ${key}`, {
        age: now - entry.timestamp,
        ttl: entry.ttl,
      });
      return entry.data;
    }

    // Кэш устарел или отсутствует - получаем свежие данные
    logger.debug(`Cache MISS for key: ${key}`, {
      reason: entry ? 'expired' : 'not_found',
    });

    try {
      const data = await fetchFunction();

      // Сохраняем в кэш
      this.cache.set(key, {
        data,
        timestamp: now,
        ttl,
      });

      logger.debug(`Cache SET for key: ${key}`, { size: this.cache.size });
      return data;
    } catch (error) {
      // В случае ошибки, если есть устаревший кэш - используем его
      if (entry) {
        logger.warn(`Using stale cache for key: ${key} due to error`, { error });
        return entry.data;
      }
      throw error;
    }
  }

  async getServerResources<T>(fetchFunction: () => Promise<T>): Promise<T> {
    return this.getOrSet('server_resources', fetchFunction, this.config.serverResourcesTTL);
  }

  async getInstancesResources<T>(fetchFunction: () => Promise<T>): Promise<T> {
    return this.getOrSet('instances_resources', fetchFunction, this.config.instanceResourcesTTL);
  }

  async getPerformanceMetrics<T>(fetchFunction: () => Promise<T>): Promise<T> {
    return this.getOrSet('performance_metrics', fetchFunction, this.config.performanceMetricsTTL);
  }

  async getSystemHealth<T>(fetchFunction: () => Promise<T>): Promise<T> {
    return this.getOrSet('system_health', fetchFunction, this.config.systemHealthTTL);
  }

  async getPortStatistics<T>(fetchFunction: () => Promise<T>): Promise<T> {
    return this.getOrSet('port_statistics', fetchFunction, this.config.portStatisticsTTL);
  }

  invalidate(key: string): boolean {
    const result = this.cache.delete(key);
    if (result) {
      logger.debug(`Cache INVALIDATED for key: ${key}`);
    }
    return result;
  }

  invalidateAll(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.debug(`Cache CLEARED - removed ${size} entries`);
  }

  invalidateInstanceRelated(): void {
    const keysToInvalidate = ['instances_resources', 'system_health', 'performance_metrics'];
    let invalidatedCount = 0;

    keysToInvalidate.forEach(key => {
      if (this.invalidate(key)) {
        invalidatedCount++;
      }
    });

    logger.debug(`Invalidated ${invalidatedCount} instance-related cache entries`);
  }

  getStats(): {
    totalEntries: number;
    hitRate: number;
    entries: Array<{
      key: string;
      age: number;
      ttl: number;
      expired: boolean;
    }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age: now - entry.timestamp,
      ttl: entry.ttl,
      expired: now - entry.timestamp >= entry.ttl,
    }));

    return {
      totalEntries: this.cache.size,
      hitRate: 0, // TODO: Добавить трекинг hit rate
      entries,
    };
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= entry.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`Cache cleanup: removed ${cleanedCount} expired entries`);
    }
  }

  async getBatch<T>(
    keys: string[],
    fetchFunction: (keys: string[]) => Promise<Record<string, T>>,
    ttl: number,
  ): Promise<Record<string, T>> {
    const now = Date.now();
    const result: Record<string, T> = {};
    const missingKeys: string[] = [];

    // Проверяем какие ключи есть в кэше
    for (const key of keys) {
      const entry = this.cache.get(key);
      if (entry && now - entry.timestamp < entry.ttl) {
        result[key] = entry.data;
      } else {
        missingKeys.push(key);
      }
    }

    // Если есть недостающие ключи - получаем их batch запросом
    if (missingKeys.length > 0) {
      logger.debug(`Cache batch MISS for keys: ${missingKeys.join(', ')}`);

      const fetchedData = await fetchFunction(missingKeys);

      // Кэшируем полученные данные
      for (const [key, data] of Object.entries(fetchedData)) {
        this.cache.set(key, {
          data,
          timestamp: now,
          ttl,
        });
        result[key] = data;
      }
    }

    return result;
  }
}

// Singleton экземпляр для использования в приложении
export const resourceCacheService = new ResourceCacheService();
