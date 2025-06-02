import Dockerode from 'dockerode';
import { exec } from 'child_process';
import { promisify } from 'util';
import logger from '../../logger';
import { NamingUtils } from '../utils/naming.utils';

const execAsync = promisify(exec);

export interface DockerContainerInfo {
  id: string;
  name: string;
  state: string;
  status: string;
  labels: Record<string, string>;
}

export interface DockerComposeStatus {
  exists: boolean;
  running: boolean;
  containers: DockerContainerInfo[];
}

export class DockerService {
  private docker: Dockerode;

  constructor() {
    this.docker = new Dockerode({
      socketPath: process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock',
    });
  }

  async checkConnection(): Promise<boolean> {
    try {
      await this.docker.ping();
      // Проверяем и создаем сеть при подключении
      await this.ensureNetworkExists();
      return true;
    } catch (error) {
      logger.error('Docker connection failed', error);
      return false;
    }
  }

  async ensureNetworkExists(): Promise<void> {
    const networkName = 'wweb-network';
    
    try {
      // Проверяем существование сети
      const networks = await this.docker.listNetworks({
        filters: { name: [networkName] }
      });

      if (networks.length === 0) {
        logger.info(`Creating Docker network: ${networkName}`);
        await this.docker.createNetwork({
          Name: networkName,
          Driver: 'bridge',
          IPAM: {
            Driver: 'default',
            Config: [
              {
                Subnet: '172.20.0.0/16'
              }
            ]
          }
        });
        logger.info(`Docker network ${networkName} created successfully`);
      } else {
        logger.debug(`Docker network ${networkName} already exists`);
      }
    } catch (error) {
      logger.error(`Failed to ensure network ${networkName} exists`, error);
      // Не бросаем ошибку, так как сеть может быть создана другим способом
    }
  }

  async getContainersByInstanceId(instanceId: string): Promise<DockerContainerInfo[]> {
    try {
      const containers = await this.docker.listContainers({
        all: true,
        filters: {
          label: [`wweb.instance.id=${instanceId}`],
        },
      });

      return containers.map(container => ({
        id: container.Id,
        name: container.Names[0]?.replace(/^\//, '') || '',
        state: container.State,
        status: container.Status,
        labels: container.Labels || {},
      }));
    } catch (error) {
      logger.error('Failed to get containers by instance ID', error);
      return [];
    }
  }

  async getComposeStatus(instanceId: string): Promise<DockerComposeStatus> {
    const containers = await this.getContainersByInstanceId(instanceId);

    return {
      exists: containers.length > 0,
      running: containers.every(c => c.state === 'running'),
      containers,
    };
  }

  async startCompose(instanceId: string, composePath: string): Promise<void> {
    const projectName = NamingUtils.getComposeProjectName(instanceId);
    const command = `docker-compose -f ${composePath} -p ${projectName} up -d --build`;

    try {
      logger.info(`Starting compose for instance ${instanceId}`, { command });
      const { stdout, stderr } = await execAsync(command);

      if (stdout) logger.debug('Docker compose stdout:', stdout);
      if (stderr) logger.debug('Docker compose stderr:', stderr);

      logger.info(`Compose started successfully for instance ${instanceId}`);
    } catch (error: any) {
      logger.error(`Failed to start compose for instance ${instanceId}`, error);
      throw new Error(`Failed to start compose: ${error.message}`);
    }
  }

  async stopCompose(instanceId: string, composePath: string): Promise<void> {
    const projectName = NamingUtils.getComposeProjectName(instanceId);
    const command = `docker-compose -f ${composePath} -p ${projectName} down`;

    try {
      logger.info(`Stopping compose for instance ${instanceId}`, { command });
      const { stdout, stderr } = await execAsync(command);

      if (stdout) logger.debug('Docker compose stdout:', stdout);
      if (stderr) logger.debug('Docker compose stderr:', stderr);

      logger.info(`Compose stopped successfully for instance ${instanceId}`);
    } catch (error: any) {
      logger.error(`Failed to stop compose for instance ${instanceId}`, error);
      throw new Error(`Failed to stop compose: ${error.message}`);
    }
  }

  async restartCompose(instanceId: string, composePath: string): Promise<void> {
    const projectName = NamingUtils.getComposeProjectName(instanceId);
    const command = `docker-compose -f ${composePath} -p ${projectName} restart`;

    try {
      logger.info(`Restarting compose for instance ${instanceId}`, { command });
      const { stdout, stderr } = await execAsync(command);

      if (stdout) logger.debug('Docker compose stdout:', stdout);
      if (stderr) logger.debug('Docker compose stderr:', stderr);

      logger.info(`Compose restarted successfully for instance ${instanceId}`);
    } catch (error: any) {
      logger.error(`Failed to restart compose for instance ${instanceId}`, error);
      throw new Error(`Failed to restart compose: ${error.message}`);
    }
  }

  async getContainerStats(containerId: string): Promise<{ cpu: string; memory: string }> {
    try {
      const container = this.docker.getContainer(containerId);
      const stats = await container.stats({ stream: false });

      // Вычисляем использование CPU
      const cpuDelta =
        stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
      const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
      const cpuPercent = (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100;

      // Вычисляем использование памяти
      const memoryUsage = stats.memory_stats.usage || 0;
      const memoryLimit = stats.memory_stats.limit || 0;
      const memoryPercent = memoryLimit > 0 ? (memoryUsage / memoryLimit) * 100 : 0;

      return {
        cpu: `${cpuPercent.toFixed(1)}%`,
        memory: `${(memoryUsage / 1024 / 1024).toFixed(0)}MB`,
      };
    } catch (error) {
      logger.error('Failed to get container stats', error);
      return { cpu: '0%', memory: '0MB' };
    }
  }

  async getContainerLogs(containerId: string, tail: number = 100): Promise<string> {
    try {
      const container = this.docker.getContainer(containerId);
      const stream = await container.logs({
        stdout: true,
        stderr: true,
        tail,
        timestamps: true,
      });

      return stream.toString();
    } catch (error) {
      logger.error('Failed to get container logs', error);
      return '';
    }
  }

  async getContainerLogsByName(containerName: string, tail: number = 100): Promise<string> {
    try {
      // Находим контейнер по имени
      const containers = await this.docker.listContainers({
        all: true,
        filters: {
          name: [containerName],
        },
      });

      if (containers.length === 0) {
        logger.warn(`Container not found: ${containerName}`);
        return '';
      }

      const containerId = containers[0].Id;
      return await this.getContainerLogs(containerId, tail);
    } catch (error) {
      logger.error(`Failed to get container logs by name: ${containerName}`, error);
      return '';
    }
  }

  async getAllContainers(): Promise<Dockerode.ContainerInfo[]> {
    try {
      return await this.docker.listContainers({ all: true });
    } catch (error) {
      logger.error('Failed to list all containers', error);
      return [];
    }
  }

  async getRunningContainers(): Promise<Dockerode.ContainerInfo[]> {
    try {
      return await this.docker.listContainers({ all: false });
    } catch (error) {
      logger.error('Failed to list running containers', error);
      return [];
    }
  }

  async removeVolume(volumeName: string): Promise<void> {
    try {
      const volume = this.docker.getVolume(volumeName);
      await volume.remove();
      logger.info(`Volume ${volumeName} removed successfully`);
    } catch (error: any) {
      if (error.statusCode !== 404) {
        logger.error(`Failed to remove volume ${volumeName}`, error);
        throw error;
      }
    }
  }
}
