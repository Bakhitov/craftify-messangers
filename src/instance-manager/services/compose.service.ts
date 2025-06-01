import { MessageInstance } from '../models/instance.model';
import { DockerService } from './docker.service';
import { DockerComposeGenerator } from '../utils/docker-compose.utils';
import { NamingUtils } from '../utils/naming.utils';
import logger from '../../logger';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';

export class ComposeService {
  constructor(private dockerService: DockerService) {}

  async createInstance(instance: MessageInstance): Promise<void> {
    logger.info(`Creating instance ${instance.id}`);

    try {
      // Генерируем Docker Compose файл
      const composeContent = await DockerComposeGenerator.generateComposeFile(instance);
      const composePath = await DockerComposeGenerator.saveComposeFile(instance, composeContent);

      // Запускаем контейнеры
      await this.dockerService.startCompose(instance.id, composePath);

      logger.info(`Instance ${instance.id} created successfully`);
    } catch (error) {
      logger.error(`Failed to create instance ${instance.id}`, error);
      throw error;
    }
  }

  async updateInstance(instance: MessageInstance): Promise<void> {
    logger.info(`Updating instance ${instance.id}`);

    try {
      // Останавливаем существующие контейнеры
      const composePath = NamingUtils.getComposeFilePath(instance.id);
      await this.dockerService.stopCompose(instance.id, composePath);

      // Генерируем новый Docker Compose файл
      const composeContent = await DockerComposeGenerator.generateComposeFile(instance);
      await DockerComposeGenerator.saveComposeFile(instance, composeContent);

      // Запускаем контейнеры с новой конфигурацией
      await this.dockerService.startCompose(instance.id, composePath);

      logger.info(`Instance ${instance.id} updated successfully`);
    } catch (error) {
      logger.error(`Failed to update instance ${instance.id}`, error);
      throw error;
    }
  }

  async recreateInstance(instance: MessageInstance): Promise<void> {
    logger.info(`Recreating instance ${instance.id}`);

    try {
      // Удаляем существующие контейнеры и volumes
      await this.deleteInstance(instance.id);

      // Создаем заново
      await this.createInstance(instance);

      logger.info(`Instance ${instance.id} recreated successfully`);
    } catch (error) {
      logger.error(`Failed to recreate instance ${instance.id}`, error);
      throw error;
    }
  }

  async startInstance(instanceId: string): Promise<void> {
    logger.info(`Starting instance ${instanceId}`);

    try {
      const composePath = NamingUtils.getComposeFilePath(instanceId);
      await this.dockerService.startCompose(instanceId, composePath);

      logger.info(`Instance ${instanceId} started successfully`);
    } catch (error) {
      logger.error(`Failed to start instance ${instanceId}`, error);
      throw error;
    }
  }

  async stopInstance(instanceId: string): Promise<void> {
    logger.info(`Stopping instance ${instanceId}`);

    try {
      const composePath = NamingUtils.getComposeFilePath(instanceId);
      await this.dockerService.stopCompose(instanceId, composePath);

      logger.info(`Instance ${instanceId} stopped successfully`);
    } catch (error) {
      logger.error(`Failed to stop instance ${instanceId}`, error);
      throw error;
    }
  }

  async restartInstance(instanceId: string): Promise<void> {
    logger.info(`Restarting instance ${instanceId}`);

    try {
      const composePath = NamingUtils.getComposeFilePath(instanceId);
      await this.dockerService.restartCompose(instanceId, composePath);

      logger.info(`Instance ${instanceId} restarted successfully`);
    } catch (error) {
      logger.error(`Failed to restart instance ${instanceId}`, error);
      throw error;
    }
  }

  async deleteInstance(instanceId: string): Promise<void> {
    logger.info(`Deleting instance ${instanceId}`);

    try {
      const composePath = NamingUtils.getComposeFilePath(instanceId);

      // Останавливаем контейнеры
      await this.dockerService.stopCompose(instanceId, composePath);

      // Удаляем volume
      const volumeName = NamingUtils.getAuthVolumeName(instanceId);
      await this.dockerService.removeVolume(volumeName);

      // Удаляем compose файл
      await DockerComposeGenerator.deleteComposeFile(instanceId);

      logger.info(`Instance ${instanceId} deleted successfully`);
    } catch (error) {
      logger.error(`Failed to delete instance ${instanceId}`, error);
      // Не выбрасываем ошибку, так как инстанс может быть частично удален
    }
  }

  /**
   * Извлекает реальный API ключ из логов контейнера WhatsApp
   */
  async extractApiKeyFromLogs(instanceId: string): Promise<string | null> {
    try {
      const containerName = NamingUtils.getApiContainerName(instanceId);
      logger.info(`Extracting API key from container logs: ${containerName}`);

      // Получаем логи контейнера
      const logs = await this.dockerService.getContainerLogsByName(containerName);

      // Ищем строку с API ключом в формате "WhatsApp API key: <ключ>"
      const apiKeyRegex = /WhatsApp API key:\s*([a-f0-9]{64})/i;
      const lines = logs.split('\n');

      for (const line of lines) {
        const match = line.match(apiKeyRegex);
        if (match && match[1]) {
          const apiKey = match[1].trim();
          logger.info(`API key extracted from logs: ${apiKey.substring(0, 16)}...`);
          return apiKey;
        }
      }

      logger.warn(`API key not found in logs for instance ${instanceId}`);
      return null;
    } catch (error) {
      logger.error(`Failed to extract API key from logs for instance ${instanceId}`, error);
      return null;
    }
  }

  async waitForApiReady(
    instance: MessageInstance,
    maxAttempts: number = 30,
    onApiKeyExtracted?: (apiKey: string) => Promise<void>,
  ): Promise<string | null> {
    if (!instance.port_api) {
      return null;
    }

    logger.info(
      `Waiting for API to be ready for instance ${instance.id} (timeout: ${maxAttempts * 3} seconds)`,
    );

    let apiKey: string | null = null;
    let apiKeyUpdated = false;

    // Проверяем, что API сервер запущен и доступен
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Сначала пытаемся извлечь API ключ из логов (только каждые 5 попыток для снижения нагрузки)
        if (!apiKey && attempt % 5 === 1) {
          const extractedKey = await this.extractApiKeyFromLogs(instance.id);

          if (extractedKey && extractedKey !== instance.id) {
            logger.info(`API key found in logs: ${extractedKey.substring(0, 16)}...`);
            apiKey = extractedKey;

            // Немедленно обновляем API ключ в базе данных
            if (onApiKeyExtracted && !apiKeyUpdated) {
              try {
                await onApiKeyExtracted(apiKey);
                apiKeyUpdated = true;
                logger.info(`API key immediately updated in database for instance ${instance.id}`);
              } catch (error) {
                logger.error(
                  `Failed to update API key in database for instance ${instance.id}`,
                  error,
                );
              }
            }
          }
        }

        // Проверяем health endpoint без авторизации
        const healthResponse = await axios.get(
          `http://host.docker.internal:${instance.port_api}/api/health`,
          {
            timeout: 5000,
          },
        );

        if (healthResponse.status === 200) {
          logger.info(`API health check passed after ${attempt} attempts`);

          // Если у нас нет API ключа из логов, используем ID как fallback
          if (!apiKey) {
            logger.warn(`Using instance ID as fallback API key for ${instance.id}`);
            apiKey = instance.id;
          }

          // Проверяем API с полученным ключом
          try {
            const statusResponse = await axios.get(
              `http://host.docker.internal:${instance.port_api}/api/status`,
              {
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                },
                timeout: 5000,
              },
            );

            if (statusResponse.status === 200) {
              logger.info(`API is fully ready and authenticated after ${attempt} attempts`);
              return apiKey;
            }
          } catch {
            logger.debug(
              `API authentication failed with extracted key, attempt ${attempt}/${maxAttempts}`,
            );
          }
        }
      } catch {
        logger.debug(`API not responding yet, attempt ${attempt}/${maxAttempts}`);
      }

      // Ждем 3 секунды перед следующей попыткой (увеличено с 2 секунд)
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Если API не ответил после всех попыток, возвращаем найденный ключ или ID
    if (apiKey && apiKey !== instance.id) {
      logger.warn(
        `API did not respond after ${maxAttempts} attempts, but API key was extracted from logs: ${apiKey.substring(0, 16)}...`,
      );
      return apiKey;
    } else {
      logger.warn(
        `API did not respond after ${maxAttempts} attempts, returning instance ID as fallback`,
      );
      return instance.id;
    }
  }

  async updateApiKeyInCompose(instanceId: string, apiKey: string): Promise<void> {
    try {
      await DockerComposeGenerator.updateComposeFileWithApiKey(instanceId, apiKey);

      // Перезапускаем MCP контейнер для применения нового ключа
      const composePath = NamingUtils.getComposeFilePath(instanceId);
      const projectName = NamingUtils.getComposeProjectName(instanceId);
      const mcpServiceName = NamingUtils.getMcpServiceName(instanceId);

      const command = `docker-compose -f ${composePath} -p ${projectName} restart ${mcpServiceName}`;
      const execAsync = promisify(exec);

      await execAsync(command);
      logger.info(`Updated API key for instance ${instanceId}`);
    } catch (error) {
      logger.error(`Failed to update API key for instance ${instanceId}`, error);
      throw error;
    }
  }
}
