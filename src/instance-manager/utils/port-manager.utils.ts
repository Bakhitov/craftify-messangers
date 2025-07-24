import { Pool } from 'pg';
import * as net from 'net';
import { getDatabaseConfig } from '../config/database.config';
import logger from '../../logger';

interface PortReservation {
  port: number;
  instanceId: string;
  type: 'api' | 'mcp';
  reservedAt: Date;
}

export class PortManager {
  private readonly PORT_RANGE_START = parseInt(process.env.BASE_PORT_RANGE_START || '3001');
  private readonly PORT_RANGE_END = parseInt(process.env.BASE_PORT_RANGE_END || '7999');
  private readonly RESERVATION_TIMEOUT = 30000; // 30 секунд на резервацию
  private readonly MAX_RETRIES = 5;
  private readonly RETRY_DELAY = 100; // миллисекунды
  private schema: string;

  // Кэш для оптимизации
  private portCache: Set<number> | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL = 5000; // 5 секунд

  // Локальные резервации для предотвращения race conditions
  private localReservations = new Map<number, PortReservation>();

  constructor(private pool: Pool) {
    const config = getDatabaseConfig();
    this.schema = config.schema || 'public';

    // Очистка просроченных резерваций каждые 10 секунд
    setInterval(() => this.cleanupExpiredReservations(), 10000);
  }

  async assignPorts(
    instanceId: string,
    typeInstance: string[],
  ): Promise<{ api?: number; mcp?: number }> {
    const result: { api?: number; mcp?: number } = {};

    try {
      // Атомарное назначение портов с retry логикой
      if (typeInstance.includes('api')) {
        result.api = await this.assignPortWithRetry(instanceId, 'api');
      }

      if (typeInstance.includes('mcp')) {
        result.mcp = await this.assignPortWithRetry(instanceId, 'mcp');
      }

      logger.info(`Assigned ports for instance ${instanceId}`, result);
      return result;
    } catch (error) {
      // Освобождаем уже назначенные порты в случае ошибки
      if (result.api) {
        await this.releasePortReservation(result.api);
      }
      if (result.mcp) {
        await this.releasePortReservation(result.mcp);
      }
      throw error;
    }
  }

  private async assignPortWithRetry(instanceId: string, type: 'api' | 'mcp'): Promise<number> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await this.assignSinglePort(instanceId, type);
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Port assignment attempt ${attempt} failed for ${instanceId}:${type}`, {
          error: (error as Error).message,
        });

        if (attempt < this.MAX_RETRIES) {
          // Экспоненциальная задержка с jitter
          const delay = this.RETRY_DELAY * Math.pow(2, attempt - 1) + Math.random() * 100;
          await this.sleep(delay);

          // Сбрасываем кэш для получения актуальной информации
          this.invalidateCache();
        }
      }
    }

    throw new Error(
      `Failed to assign port after ${this.MAX_RETRIES} attempts: ${lastError?.message}`,
    );
  }

  private async assignSinglePort(instanceId: string, type: 'api' | 'mcp'): Promise<number> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Сначала проверяем, существует ли инстанс
      const checkQuery = `SELECT id FROM ${this.schema}.message_instances WHERE id = $1`;
      const checkResult = await client.query(checkQuery, [instanceId]);
      
      if (checkResult.rowCount === 0) {
        // Добавляем более подробное логирование
        logger.error(`Instance ${instanceId} not found in database during port assignment`, {
          schema: this.schema,
          type: type,
          query: checkQuery
        });
        
        // Попробуем найти инстанс без схемы для диагностики
        const debugQuery = `SELECT id, created_at FROM message_instances WHERE id = $1`;
        const debugResult = await client.query(debugQuery, [instanceId]).catch(err => {
          logger.error('Debug query failed:', err);
          return { rows: [] };
        });
        
        if (debugResult.rows.length > 0) {
          logger.error(`Instance found in different schema!`, {
            instance: debugResult.rows[0],
            expectedSchema: this.schema
          });
        }
        
        throw new Error(`Instance ${instanceId} not found in database for port assignment`);
      }

      // Получаем список занятых портов с блокировкой
      const usedPorts = await this.getUsedPortsWithLock(client);

      // Добавляем локально зарезервированные порты
      for (const [port, reservation] of this.localReservations) {
        if (reservation.instanceId !== instanceId) {
          usedPorts.add(port);
        }
      }

      // Находим свободный порт
      const port = await this.findNextAvailablePortOptimized(usedPorts);

      // Создаем локальную резервацию
      this.localReservations.set(port, {
        port,
        instanceId,
        type,
        reservedAt: new Date(),
      });

      // Атомарно обновляем порт в базе данных
      const updateQuery =
        type === 'api'
          ? `UPDATE ${this.schema}.message_instances SET port_api = $1, updated_at = NOW() WHERE id = $2`
          : `UPDATE ${this.schema}.message_instances SET port_mcp = $1, updated_at = NOW() WHERE id = $2`;

      logger.debug(`Executing port update`, {
        instanceId,
        port,
        type,
        query: updateQuery
      });

      const updateResult = await client.query(updateQuery, [port, instanceId]);

      if (updateResult.rowCount === 0) {
        throw new Error(`Instance ${instanceId} not found for port assignment`);
      }

      await client.query('COMMIT');

      // Инвалидируем кэш
      this.invalidateCache();

      logger.debug(`Successfully assigned port ${port} to instance ${instanceId} (${type})`);
      return port;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async getUsedPortsWithLock(client: any): Promise<Set<number>> {
    // Используем кэш если он актуален
    if (this.portCache && Date.now() < this.cacheExpiry) {
      return new Set(this.portCache);
    }

    const result = await client.query(
      `SELECT port_api, port_mcp FROM ${this.schema}.message_instances 
       WHERE port_api IS NOT NULL OR port_mcp IS NOT NULL 
       FOR UPDATE SKIP LOCKED`,
    );

    const usedPorts = new Set<number>();

    for (const row of result.rows) {
      if (row.port_api) usedPorts.add(row.port_api);
      if (row.port_mcp) usedPorts.add(row.port_mcp);
    }

    // Обновляем кэш
    this.portCache = usedPorts;
    this.cacheExpiry = Date.now() + this.CACHE_TTL;

    return usedPorts;
  }

  private async getUsedPorts(): Promise<Set<number>> {
    // Используем кэш если он актуален
    if (this.portCache && Date.now() < this.cacheExpiry) {
      return new Set(this.portCache);
    }

    const result = await this.pool.query<{ port_api: number | null; port_mcp: number | null }>(
      `SELECT port_api, port_mcp FROM ${this.schema}.message_instances WHERE port_api IS NOT NULL OR port_mcp IS NOT NULL`,
    );

    const usedPorts = new Set<number>();

    for (const row of result.rows) {
      if (row.port_api) usedPorts.add(row.port_api);
      if (row.port_mcp) usedPorts.add(row.port_mcp);
    }

    // Обновляем кэш
    this.portCache = usedPorts;
    this.cacheExpiry = Date.now() + this.CACHE_TTL;

    return usedPorts;
  }

  private async findNextAvailablePortOptimized(usedPorts: Set<number>): Promise<number> {
    // Оптимизированный поиск: начинаем с случайного порта для лучшего распределения
    const totalPorts = this.PORT_RANGE_END - this.PORT_RANGE_START + 1;
    const startOffset = Math.floor(Math.random() * totalPorts);

    // Проверяем порты начиная со случайного смещения
    for (let i = 0; i < totalPorts; i++) {
      const port = this.PORT_RANGE_START + ((startOffset + i) % totalPorts);

      if (!usedPorts.has(port) && !this.localReservations.has(port)) {
        // Быстрая проверка доступности порта
        if (await this.isPortAvailableFast(port)) {
          return port;
        }
      }
    }

    throw new Error(`No available ports in range ${this.PORT_RANGE_START}-${this.PORT_RANGE_END}`);
  }

  private async findNextAvailablePort(usedPorts: Set<number>): Promise<number> {
    for (let port = this.PORT_RANGE_START; port <= this.PORT_RANGE_END; port++) {
      if (!usedPorts.has(port) && (await this.isPortAvailable(port))) {
        return port;
      }
    }

    throw new Error(`No available ports in range ${this.PORT_RANGE_START}-${this.PORT_RANGE_END}`);
  }

  private isPortAvailableFast(port: number): Promise<boolean> {
    return new Promise(resolve => {
      const server = net.createServer();
      const timeout = setTimeout(() => {
        server.close();
        resolve(false);
      }, 100); // Быстрый timeout

      server.once('error', () => {
        clearTimeout(timeout);
        resolve(false);
      });

      server.once('listening', () => {
        clearTimeout(timeout);
        server.close();
        resolve(true);
      });

      server.listen(port);
    });
  }

  private isPortAvailable(port: number): Promise<boolean> {
    return new Promise(resolve => {
      const server = net.createServer();

      server.once('error', () => {
        resolve(false);
      });

      server.once('listening', () => {
        server.close();
        resolve(true);
      });

      server.listen(port);
    });
  }

  async releasePort(port: number): Promise<void> {
    // Удаляем локальную резервацию
    this.localReservations.delete(port);

    // Инвалидируем кэш
    this.invalidateCache();

    logger.debug(`Released port ${port}`);
  }

  private async releasePortReservation(port: number): Promise<void> {
    this.localReservations.delete(port);
  }

  private cleanupExpiredReservations(): void {
    const now = new Date();
    const expired: number[] = [];

    for (const [port, reservation] of this.localReservations) {
      if (now.getTime() - reservation.reservedAt.getTime() > this.RESERVATION_TIMEOUT) {
        expired.push(port);
      }
    }

    for (const port of expired) {
      this.localReservations.delete(port);
      logger.debug(`Cleaned up expired port reservation: ${port}`);
    }
  }

  private invalidateCache(): void {
    this.portCache = null;
    this.cacheExpiry = 0;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Метод для получения статистики
  async getPortStatistics(): Promise<{
    totalPorts: number;
    usedPorts: number;
    availablePorts: number;
    reservedPorts: number;
    portRange: { start: number; end: number };
  }> {
    const usedPorts = await this.getUsedPorts();
    const totalPorts = this.PORT_RANGE_END - this.PORT_RANGE_START + 1;

    return {
      totalPorts,
      usedPorts: usedPorts.size,
      availablePorts: totalPorts - usedPorts.size,
      reservedPorts: this.localReservations.size,
      portRange: {
        start: this.PORT_RANGE_START,
        end: this.PORT_RANGE_END,
      },
    };
  }

  // Метод для принудительной очистки кэша
  clearCache(): void {
    this.invalidateCache();
    logger.debug('Port cache cleared manually');
  }
}
