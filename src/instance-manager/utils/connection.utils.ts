import { NamingUtils } from './naming.utils';
import * as net from 'net';

export class ConnectionUtils {
  /**
   * Определяет, запущен ли Instance Manager в Docker контейнере
   */
  static isRunningInDocker(): boolean {
    return process.env.DOCKER_CONTAINER === 'true';
  }

  /**
   * Получает правильный URL для подключения к API контейнеру
   * @param instanceId ID инстанса
   * @param port Порт API
   * @returns URL для подключения
   */
  static getApiUrl(instanceId: string, port: number): string {
    // Если Instance Manager работает в Docker, используем имя контейнера
    if (this.isRunningInDocker()) {
      return `http://${NamingUtils.getApiContainerName(instanceId)}:${port}`;
    } else {
      // Если Instance Manager на хосте, а контейнеры в Docker
      // Используем host.docker.internal для доступа к хосту из контейнера
      // Но для доступа с хоста к контейнеру используем localhost
      return `http://localhost:${port}`;
    }
  }

  /**
   * Получает правильный URL для подключения к MCP контейнеру
   * @param instanceId ID инстанса
   * @param port Порт MCP
   * @returns URL для подключения
   */
  static getMcpUrl(instanceId: string, port: number): string {
    if (this.isRunningInDocker()) {
      return `http://${NamingUtils.getMcpContainerName(instanceId)}:${port}`;
    } else {
      return `http://localhost:${port}`;
    }
  }

  /**
   * Получает базовый URL для внешних подключений
   * @param port Порт
   * @returns Внешний URL
   */
  static getExternalUrl(port: number): string {
    const baseUrl = process.env.INSTANCE_MANAGER_BASE_URL || 'http://localhost';
    return `${baseUrl}:${port}`;
  }

  /**
   * Проверяет доступность порта перед подключением
   * @param instanceId ID экземпляра (для определения имени контейнера)
   * @param port Порт для проверки
   * @param timeout Таймаут в миллисекундах
   * @returns Promise<boolean>
   */
  static async isPortAccessible(
    instanceId: string,
    port: number,
    timeout: number = 3000,
  ): Promise<boolean> {
    return new Promise(resolve => {
      const socket = new net.Socket();

      const timer = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, timeout);

      socket.on('connect', () => {
        clearTimeout(timer);
        socket.destroy();
        resolve(true);
      });

      socket.on('error', () => {
        clearTimeout(timer);
        resolve(false);
      });

      // Определяем хост для подключения в зависимости от режима работы
      const host = this.isRunningInDocker()
        ? NamingUtils.getApiContainerName(instanceId) // В Docker - имя контейнера
        : 'localhost'; // На хосте - localhost

      socket.connect(port, host);
    });
  }

  /**
   * Проверяет доступность API экземпляра с учетом особенностей Docker
   * @param instanceId ID экземпляра
   * @param port Порт API
   * @param timeout Таймаут в миллисекундах
   * @returns Promise<boolean>
   */
  static async isApiAccessible(
    instanceId: string,
    port: number,
    timeout: number = 3000,
  ): Promise<boolean> {
    // Сначала проверяем доступность порта
    const portAccessible = await this.isPortAccessible(instanceId, port, timeout);

    if (!portAccessible) {
      return false;
    }

    // Затем проверяем, что API действительно отвечает
    try {
      const url = this.getApiUrl(instanceId, port);
      const response = await fetch(`${url}/api/v1/telegram/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(timeout),
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }
}
