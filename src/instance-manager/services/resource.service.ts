import * as si from 'systeminformation';
import { DockerService } from './docker.service';
import { DatabaseService } from './database.service';
import { ServerResourcesResponse, InstanceResourceInfo } from '../models/instance.model';
import logger from '../../logger';

export class ResourceService {
  constructor(
    private dockerService: DockerService,
    private databaseService: DatabaseService,
  ) {}

  async getServerResources(): Promise<ServerResourcesResponse> {
    try {
      // Получаем информацию о CPU
      const cpuLoad = await si.currentLoad();
      const cpuUsage = `${cpuLoad.currentLoad.toFixed(1)}%`;

      // Получаем информацию о памяти
      const memory = await si.mem();
      const memoryUsage = `${((memory.used / memory.total) * 100).toFixed(1)}%`;

      // Получаем информацию о диске
      const disk = await si.fsSize();
      const mainDisk = disk[0];
      const diskUsage = mainDisk ? `${mainDisk.use.toFixed(1)}%` : '0%';

      // Получаем uptime
      const time = await si.time();
      const uptime = this.formatUptime(time.uptime);

      // Получаем информацию о Docker контейнерах
      const allContainers = await this.dockerService.getAllContainers();
      const runningContainers = await this.dockerService.getRunningContainers();

      // Получаем информацию об инстансах
      const instances = await this.databaseService.getAllInstances();
      const dockerStatuses = await Promise.all(
        instances.map(inst => this.dockerService.getComposeStatus(inst.id)),
      );

      const runningInstances = dockerStatuses.filter(status => status.running).length;

      return {
        server: {
          cpu_usage: cpuUsage,
          memory_usage: memoryUsage,
          disk_usage: diskUsage,
          uptime: uptime,
        },
        docker: {
          total_containers: allContainers.length,
          running_containers: runningContainers.length,
          stopped_containers: allContainers.length - runningContainers.length,
        },
        instances: {
          total: instances.length,
          running: runningInstances,
          stopped: instances.length - runningInstances,
        },
      };
    } catch (error) {
      logger.error('Failed to get server resources', error);
      throw error;
    }
  }

  async getInstancesResources(): Promise<InstanceResourceInfo[]> {
    try {
      const instances = await this.databaseService.getAllInstances();
      const resources: InstanceResourceInfo[] = [];

      for (const instance of instances) {
        const containers = await this.dockerService.getContainersByInstanceId(instance.id);

        let totalCpu = 0;
        let totalMemory = 0;
        let status = 'stopped';

        if (containers.length > 0) {
          status = containers.every(c => c.state === 'running') ? 'running' : 'partial';

          for (const container of containers) {
            if (container.state === 'running') {
              const stats = await this.dockerService.getContainerStats(container.id);
              totalCpu += parseFloat(stats.cpu);
              totalMemory += parseFloat(stats.memory);
            }
          }
        }

        resources.push({
          instance_id: instance.id,
          display_name: `${instance.provider}_${instance.type_instance.join('_')}`,
          cpu_usage: `${totalCpu.toFixed(1)}%`,
          memory_usage: `${totalMemory}MB`,
          status: status,
        });
      }

      return resources;
    } catch (error) {
      logger.error('Failed to get instances resources', error);
      throw error;
    }
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days} days, ${hours} hours`;
    } else if (hours > 0) {
      return `${hours} hours, ${minutes} minutes`;
    } else {
      return `${minutes} minutes`;
    }
  }
}
