import { NamingUtils } from './naming.utils';

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
    if (this.isRunningInDocker()) {
      // Если Instance Manager в Docker, используем имя контейнера
      return `http://${NamingUtils.getApiContainerName(instanceId)}:${port}`;
    } else {
      // Если Instance Manager на хосте, используем localhost
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
      // Если Instance Manager в Docker, используем имя контейнера
      return `http://${NamingUtils.getMcpContainerName(instanceId)}:${port}`;
    } else {
      // Если Instance Manager на хосте, используем localhost
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
}
