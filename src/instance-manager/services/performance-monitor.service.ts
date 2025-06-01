import { DatabaseService } from './database.service';
import { PortManager } from '../utils/port-manager.utils';
import logger from '../../logger';

interface PerformanceMetrics {
  portAssignmentTime: number[];
  concurrentRequests: number;
  failureRate: number;
  averageResponseTime: number;
  peakConcurrency: number;
  lastResetTime: Date;
}

interface PortAssignmentMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  concurrentPeak: number;
  currentConcurrent: number;
}

export class PerformanceMonitorService {
  private metrics: PerformanceMetrics = {
    portAssignmentTime: [],
    concurrentRequests: 0,
    failureRate: 0,
    averageResponseTime: 0,
    peakConcurrency: 0,
    lastResetTime: new Date(),
  };

  private readonly MAX_METRICS_HISTORY = 1000;
  private readonly METRICS_RESET_INTERVAL = 3600000; // 1 час

  constructor(
    private databaseService: DatabaseService,
    private portManager: PortManager,
  ) {
    // Автоматический сброс метрик каждый час
    setInterval(() => this.resetMetrics(), this.METRICS_RESET_INTERVAL);
  }

  async trackPortAssignment<T>(operation: () => Promise<T>, instanceId: string): Promise<T> {
    const startTime = Date.now();
    this.metrics.concurrentRequests++;

    if (this.metrics.concurrentRequests > this.metrics.peakConcurrency) {
      this.metrics.peakConcurrency = this.metrics.concurrentRequests;
    }

    try {
      const result = await operation();
      const duration = Date.now() - startTime;

      this.recordSuccess(duration);
      logger.debug(`Port assignment completed for ${instanceId}`, { duration });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordFailure(duration);
      logger.error(`Port assignment failed for ${instanceId}`, {
        duration,
        error: (error as Error).message,
      });
      throw error;
    } finally {
      this.metrics.concurrentRequests--;
    }
  }

  private recordSuccess(duration: number): void {
    this.addMetric(duration);
    this.updateAverages();
  }

  private recordFailure(duration: number): void {
    this.addMetric(duration);
    this.updateAverages();
    this.updateFailureRate();
  }

  private addMetric(duration: number): void {
    this.metrics.portAssignmentTime.push(duration);

    // Ограничиваем размер истории
    if (this.metrics.portAssignmentTime.length > this.MAX_METRICS_HISTORY) {
      this.metrics.portAssignmentTime.shift();
    }
  }

  private updateAverages(): void {
    if (this.metrics.portAssignmentTime.length > 0) {
      const sum = this.metrics.portAssignmentTime.reduce((a, b) => a + b, 0);
      this.metrics.averageResponseTime = sum / this.metrics.portAssignmentTime.length;
    }
  }

  private updateFailureRate(): void {
    // Простая реализация - можно улучшить для более точного подсчета
    const recentMetrics = this.metrics.portAssignmentTime.slice(-100);
    if (recentMetrics.length > 0) {
      // Предполагаем, что время > 5000ms указывает на проблемы
      const slowRequests = recentMetrics.filter(time => time > 5000).length;
      this.metrics.failureRate = slowRequests / recentMetrics.length;
    }
  }

  async getPortAssignmentMetrics(): Promise<PortAssignmentMetrics> {
    const times = this.metrics.portAssignmentTime;
    const totalRequests = times.length;
    const successfulRequests = times.filter(time => time < 5000).length;
    const failedRequests = totalRequests - successfulRequests;

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageTime: this.metrics.averageResponseTime,
      minTime: times.length > 0 ? Math.min(...times) : 0,
      maxTime: times.length > 0 ? Math.max(...times) : 0,
      concurrentPeak: this.metrics.peakConcurrency,
      currentConcurrent: this.metrics.concurrentRequests,
    };
  }

  async getSystemHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    recommendations: string[];
    portStatistics: any;
  }> {
    const portStats = await this.portManager.getPortStatistics();
    const assignmentMetrics = await this.getPortAssignmentMetrics();

    const issues: string[] = [];
    const recommendations: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Проверка доступности портов
    const portUtilization = (portStats.usedPorts / portStats.totalPorts) * 100;
    if (portUtilization > 90) {
      status = 'critical';
      issues.push(`Критически высокое использование портов: ${portUtilization.toFixed(1)}%`);
      recommendations.push('Увеличьте диапазон портов или очистите неиспользуемые инстансы');
    } else if (portUtilization > 75) {
      status = 'warning';
      issues.push(`Высокое использование портов: ${portUtilization.toFixed(1)}%`);
      recommendations.push('Рассмотрите возможность расширения диапазона портов');
    }

    // Проверка производительности назначения портов
    if (assignmentMetrics.averageTime > 2000) {
      status = status === 'critical' ? 'critical' : 'warning';
      issues.push(`Медленное назначение портов: ${assignmentMetrics.averageTime.toFixed(0)}ms`);
      recommendations.push('Проверьте нагрузку на базу данных и очистите кэш портов');
    }

    // Проверка частоты ошибок
    const errorRate =
      assignmentMetrics.totalRequests > 0
        ? (assignmentMetrics.failedRequests / assignmentMetrics.totalRequests) * 100
        : 0;

    if (errorRate > 10) {
      status = 'critical';
      issues.push(`Высокая частота ошибок: ${errorRate.toFixed(1)}%`);
      recommendations.push('Проверьте логи и состояние системы');
    } else if (errorRate > 5) {
      status = status === 'critical' ? 'critical' : 'warning';
      issues.push(`Повышенная частота ошибок: ${errorRate.toFixed(1)}%`);
      recommendations.push('Мониторьте систему на предмет проблем');
    }

    // Проверка параллельных запросов
    if (assignmentMetrics.concurrentPeak > 20) {
      status = status === 'critical' ? 'critical' : 'warning';
      issues.push(
        `Высокая пиковая нагрузка: ${assignmentMetrics.concurrentPeak} параллельных запросов`,
      );
      recommendations.push('Рассмотрите возможность ограничения скорости запросов');
    }

    return {
      status,
      issues,
      recommendations,
      portStatistics: {
        ...portStats,
        utilizationPercent: portUtilization,
        assignmentMetrics,
      },
    };
  }

  async getDetailedMetrics(): Promise<{
    performance: PerformanceMetrics;
    portAssignment: PortAssignmentMetrics;
    systemHealth: any;
  }> {
    const [portAssignment, systemHealth] = await Promise.all([
      this.getPortAssignmentMetrics(),
      this.getSystemHealth(),
    ]);

    return {
      performance: { ...this.metrics },
      portAssignment,
      systemHealth,
    };
  }

  resetMetrics(): void {
    this.metrics = {
      portAssignmentTime: [],
      concurrentRequests: 0,
      failureRate: 0,
      averageResponseTime: 0,
      peakConcurrency: 0,
      lastResetTime: new Date(),
    };
    logger.info('Performance metrics reset');
  }

  // Метод для стресс-тестирования
  async runStressTest(
    concurrentRequests: number = 10,
    duration: number = 30000,
  ): Promise<{
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageTime: number;
    maxConcurrency: number;
  }> {
    logger.info(
      `Starting stress test: ${concurrentRequests} concurrent requests for ${duration}ms`,
    );

    const startTime = Date.now();
    const results: { success: boolean; time: number }[] = [];
    let activeRequests = 0;
    let maxConcurrency = 0;

    const makeRequest = async (): Promise<void> => {
      activeRequests++;
      maxConcurrency = Math.max(maxConcurrency, activeRequests);

      const requestStart = Date.now();
      try {
        // Симулируем назначение порта
        await this.portManager.getPortStatistics();
        results.push({ success: true, time: Date.now() - requestStart });
      } catch (error) {
        results.push({ success: false, time: Date.now() - requestStart });
      } finally {
        activeRequests--;
      }
    };

    // Запускаем параллельные запросы
    const promises: Promise<void>[] = [];
    const interval = setInterval(() => {
      if (Date.now() - startTime < duration) {
        for (let i = 0; i < concurrentRequests; i++) {
          promises.push(makeRequest());
        }
      }
    }, 1000);

    // Ждем завершения теста
    await new Promise(resolve => setTimeout(resolve, duration));
    clearInterval(interval);

    // Ждем завершения всех запросов
    await Promise.all(promises);

    const successfulRequests = results.filter(r => r.success).length;
    const failedRequests = results.length - successfulRequests;
    const averageTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;

    logger.info('Stress test completed', {
      totalRequests: results.length,
      successfulRequests,
      failedRequests,
      averageTime,
      maxConcurrency,
    });

    return {
      totalRequests: results.length,
      successfulRequests,
      failedRequests,
      averageTime,
      maxConcurrency,
    };
  }
}
