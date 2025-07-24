import { MessageInstance, Decision } from '../models/instance.model';
import { DockerComposeStatus } from './docker.service';
import logger from '../../logger';

export class DecisionService {
  async decide(
    dbInstance: MessageInstance,
    dockerState: DockerComposeStatus,
    forceRecreate?: boolean,
  ): Promise<Decision> {
    logger.debug('Making decision', {
      instanceId: dbInstance.id,
      dockerExists: dockerState.exists,
      dockerRunning: dockerState.running,
      forceRecreate,
    });

    // Принудительное пересоздание
    if (forceRecreate) {
      return { action: 'recreate', reason: 'Force recreate requested' };
    }

    // Инстанс не существует в Docker
    if (!dockerState.exists) {
      return { action: 'create', reason: 'Instance does not exist' };
    }

    // Проверяем изменения конфигурации
    if (this.hasConfigurationChanged(dbInstance, dockerState)) {
      return { action: 'update', reason: 'Configuration changed' };
    }

    // Контейнеры остановлены
    if (!dockerState.running) {
      return { action: 'start', reason: 'Containers are stopped' };
    }

    // Все в порядке
    return { action: 'no_change', reason: 'Instance is up to date' };
  }

  private hasConfigurationChanged(
    dbInstance: MessageInstance,
    dockerState: DockerComposeStatus,
  ): boolean {
    // Проверяем количество контейнеров
    const expectedContainers = dbInstance.type_instance.length;
    if (dockerState.containers.length !== expectedContainers) {
      logger.debug('Container count mismatch', {
        expected: expectedContainers,
        actual: dockerState.containers.length,
      });
      return true;
    }

    // Проверяем типы контейнеров
    const containerTypes = dockerState.containers.map(c => c.labels['wweb.instance.type']);
    const hasAllTypes = dbInstance.type_instance.every(type => containerTypes.includes(type));

    if (!hasAllTypes) {
      logger.debug('Container types mismatch', {
        expected: dbInstance.type_instance,
        actual: containerTypes,
      });
      return true;
    }

    // Проверяем метки
    for (const container of dockerState.containers) {
      if (
        container.labels['wweb.instance.user_id'] !== dbInstance.company_id ||
        container.labels['wweb.instance.provider'] !== dbInstance.provider
      ) {
        logger.debug('Container labels mismatch', {
          container: container.name,
          labels: container.labels,
        });
        return true;
      }
    }

    return false;
  }
}
