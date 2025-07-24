import fs from 'fs';
import path from 'path';
import logger from '../../logger';

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  raw: string;
}

export interface LogsResponse {
  logs: LogEntry[];
  total_lines: number;
  file_size: number;
  file_path: string;
  last_modified: Date;
}

export class LogsService {
  private readonly logFilePath: string;

  constructor() {
    this.logFilePath = path.join(process.cwd(), 'logs', 'instance-manager.log');
  }

  /**
   * Получает логи Instance Manager
   * @param tail Количество последних строк (по умолчанию 100)
   * @param level Фильтр по уровню логирования (опционально)
   * @returns Логи с метаданными
   */
  async getInstanceManagerLogs(tail: number = 100, level?: string): Promise<LogsResponse> {
    try {
      // Проверяем существование файла
      if (!fs.existsSync(this.logFilePath)) {
        return {
          logs: [],
          total_lines: 0,
          file_size: 0,
          file_path: this.logFilePath,
          last_modified: new Date(),
        };
      }

      // Получаем статистику файла
      const stats = fs.statSync(this.logFilePath);

      // Читаем файл
      const content = fs.readFileSync(this.logFilePath, 'utf-8');
      const allLines = content.split('\n').filter(line => line.trim() !== '');

      // Парсим логи
      let logs = allLines.map(line => this.parseLogLine(line)).filter(Boolean) as LogEntry[];

      // Фильтруем по уровню если указан
      if (level) {
        logs = logs.filter(log => log.level.toLowerCase() === level.toLowerCase());
      }

      // Берем последние N строк
      const tailedLogs = logs.slice(-tail);

      return {
        logs: tailedLogs,
        total_lines: logs.length,
        file_size: stats.size,
        file_path: this.logFilePath,
        last_modified: stats.mtime,
      };
    } catch (error) {
      logger.error('Failed to read instance manager logs', error);
      throw new Error(
        `Failed to read logs: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Получает логи в реальном времени (для streaming)
   * @param lines Количество строк для получения
   * @returns Последние логи
   */
  async getLatestLogs(lines: number = 50): Promise<LogEntry[]> {
    try {
      if (!fs.existsSync(this.logFilePath)) {
        return [];
      }

      const content = fs.readFileSync(this.logFilePath, 'utf-8');
      const allLines = content.split('\n').filter(line => line.trim() !== '');

      const logs = allLines
        .slice(-lines)
        .map(line => this.parseLogLine(line))
        .filter(Boolean) as LogEntry[];

      return logs;
    } catch (error) {
      logger.error('Failed to get latest logs', error);
      return [];
    }
  }

  /**
   * Парсит строку лога в структурированный формат
   * @param line Строка лога
   * @returns Структурированный лог или null
   */
  private parseLogLine(line: string): LogEntry | null {
    try {
      // Формат: 2025-06-19 11:47:25:4725 info: message
      const regex = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}:\d+)\s+(\w+):\s+(.*)$/;
      const match = line.match(regex);

      if (!match) {
        // Возвращаем как есть если не удалось распарсить
        return {
          timestamp: new Date().toISOString(),
          level: 'unknown',
          message: line,
          raw: line,
        };
      }

      return {
        timestamp: match[1],
        level: match[2],
        message: match[3],
        raw: line,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Получает размер лог файла
   * @returns Размер в байтах
   */
  getLogFileSize(): number {
    try {
      if (!fs.existsSync(this.logFilePath)) {
        return 0;
      }
      return fs.statSync(this.logFilePath).size;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Проверяет доступность лог файла
   * @returns true если файл доступен для чтения
   */
  isLogFileAvailable(): boolean {
    try {
      return (
        fs.existsSync(this.logFilePath) &&
        fs.accessSync(this.logFilePath, fs.constants.R_OK) === undefined
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Получает статистику по уровням логирования
   * @param lines Количество строк для анализа (по умолчанию 1000)
   * @returns Статистика по уровням
   */
  async getLogStatistics(lines: number = 1000): Promise<Record<string, number>> {
    try {
      const logs = await this.getLatestLogs(lines);
      const stats: Record<string, number> = {};

      logs.forEach(log => {
        const level = log.level.toLowerCase();
        stats[level] = (stats[level] || 0) + 1;
      });

      return stats;
    } catch (error) {
      logger.error('Failed to get log statistics', error);
      return {};
    }
  }
}
