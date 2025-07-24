import * as yaml from 'yaml';
import * as fs from 'fs/promises';
import * as path from 'path';
import { MessageInstance } from '../models/instance.model';
import { NamingUtils } from './naming.utils';

export interface ComposeConfig {
  version: string;
  services: Record<string, any>;
  volumes?: Record<string, any>;
  networks?: Record<string, any>;
}

export class DockerComposeGenerator {
  static async generateComposeFile(instance: MessageInstance): Promise<string> {
    const config: ComposeConfig = {
      version: '3.8',
      services: {},
      volumes: {},
      networks: {
        'wweb-network': {
          external: true, // Используем внешнюю сеть, которая должна быть создана заранее
        },
      },
    };

    // Добавляем volume для аутентификации
    const authVolumeName = NamingUtils.getAuthVolumeName(instance.id);
    config.volumes![authVolumeName] = {
      name: authVolumeName,
    };

    // Не создаем файл webhook.json из api_webhook_schema
    // Теперь вебхук передается напрямую через переменную окружения

    // Добавляем API сервис если нужен
    if (instance.type_instance.includes('api') && instance.port_api) {
      const apiServiceName = NamingUtils.getApiServiceName(instance.id);

      // Определяем режим и команду в зависимости от провайдера
      let mode: string;
      let command: string[];

      if (instance.provider === 'telegram') {
        mode = 'telegram-api'; // Используем правильный режим telegram-api
        command = [
          '-m',
          mode,
          '--log-level',
          'debug',
          '--api-port',
          instance.port_api.toString(),
          ...(instance.token ? ['--telegram-bot-token', instance.token] : []),
        ];
      } else {
        // Для whatsappweb и других провайдеров используем whatsapp-api
        mode = 'whatsapp-api';
        command = [
          '-m',
          mode,
          '-s',
          'local',
          '-a',
          '/wwebjs_auth',
          '--log-level',
          'debug',
          '--api-port',
          instance.port_api.toString(),
        ];
      }

      const apiService: any = {
        image: 'wweb-mcp:latest',
        container_name: NamingUtils.getApiContainerName(instance.id),
        ports: [`${instance.port_api}:${instance.port_api}`],
        volumes: instance.provider === 'telegram' ? [] : [`${authVolumeName}:/wwebjs_auth`],
        command,
        networks: ['wweb-network'], // Подключаем к общей сети
        logging: {
          driver: 'json-file',
          options: {
            'max-size': '100m',
            'max-file': '4',
          },
        },
        labels: NamingUtils.getDockerLabels(
          instance.id,
          instance.company_id || 'unknown',
          instance.provider,
          'api',
        ),
        environment: {
          DOCKER_CONTAINER: 'true',
          INSTANCE_ID: instance.id,
          // Добавляем переменные для подключения к базе данных из переменных окружения
          DB_HOST: process.env.DATABASE_HOST || process.env.DB_HOST || 'host.docker.internal',
          DB_PORT: process.env.DATABASE_PORT || process.env.DB_PORT || '5432',
          DB_NAME: process.env.DATABASE_NAME || process.env.DB_NAME || 'postgres',
          DB_USER: process.env.DATABASE_USER || process.env.DB_USER || 'postgres',
          DB_PASSWORD: process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || 'password',
          DB_SCHEMA: process.env.DATABASE_SCHEMA || process.env.DB_SCHEMA || 'public',
          // Добавляем переменные для агентной системы (Agno)
          AGNO_API_BASE_URL: process.env.AGNO_API_BASE_URL || 'http://host.docker.internal:8000',
          AGNO_API_TIMEOUT: process.env.AGNO_API_TIMEOUT || '10000',
          AGNO_ENABLED: process.env.AGNO_ENABLED || 'true',
          // Переменные для Supabase
          DATABASE_URL: process.env.DATABASE_URL,
          DATABASE_HOST: process.env.DATABASE_HOST || 'host.docker.internal',
          DATABASE_PORT: process.env.DATABASE_PORT || '5432',
          DATABASE_NAME: process.env.DATABASE_NAME || 'postgres',
          DATABASE_USER: process.env.DATABASE_USER || 'postgres',
          DATABASE_PASSWORD: process.env.DATABASE_PASSWORD || 'password',
          DATABASE_SCHEMA: process.env.DATABASE_SCHEMA || 'public',
          DATABASE_SSL: process.env.DATABASE_SSL || 'false',
          USE_SUPABASE: process.env.USE_SUPABASE || 'false',
          // For Telegram provider
          ...(instance.provider === 'telegram' &&
            instance.token && {
              TELEGRAM_BOT_TOKEN: instance.token,
            }),
          // For WhatsApp provider
          ...(instance.provider === 'whatsappweb' &&
            instance.api_key && {
              WHATSAPP_API_KEY: instance.api_key,
            }),
        },
      };

      // Для Telegram добавляем Bot Token в переменные окружения
      if (instance.provider === 'telegram') {
        // Получаем Bot Token из поля token экземпляра
        let botToken = instance.token || '';

        // Fallback на переменную окружения
        if (!botToken) {
          botToken = process.env.TELEGRAM_BOT_TOKEN || '';
        }

        if (botToken) {
          apiService.environment.TELEGRAM_BOT_TOKEN = botToken;
        } else {
          console.warn(`No Telegram Bot Token found for instance ${instance.id}`);
        }
      }

      // Если есть api_webhook_schema, добавляем его как переменную окружения
      if (instance.api_webhook_schema && Object.keys(instance.api_webhook_schema).length > 0) {
        try {
          // Проверяем, что api_webhook_schema является объектом
          if (typeof instance.api_webhook_schema === 'object') {
            const webhookConfigStr = JSON.stringify(instance.api_webhook_schema);
            console.log(`Setting WEBHOOK_CONFIG for instance ${instance.id}: ${webhookConfigStr}`);
            apiService.environment.WEBHOOK_CONFIG = webhookConfigStr;
          } else {
            console.warn(
              `api_webhook_schema для инстанса ${instance.id} не является объектом: ${typeof instance.api_webhook_schema}. Преобразуем...`,
            );
            try {
              // Если api_webhook_schema - это строка, пробуем распарсить JSON
              if (typeof instance.api_webhook_schema === 'string') {
                const parsed = JSON.parse(instance.api_webhook_schema);
                const webhookConfigStr = JSON.stringify(parsed);
                console.log(
                  `Parsed WEBHOOK_CONFIG string for instance ${instance.id}: ${webhookConfigStr}`,
                );
                apiService.environment.WEBHOOK_CONFIG = webhookConfigStr;
              } else {
                // Для других типов - преобразуем в строку и затем обратно в объект
                const webhookConfigStr = JSON.stringify(instance.api_webhook_schema);
                console.log(
                  `Converted WEBHOOK_CONFIG for instance ${instance.id}: ${webhookConfigStr}`,
                );
                apiService.environment.WEBHOOK_CONFIG = webhookConfigStr;
              }
            } catch (parseError) {
              console.error(
                `Failed to parse api_webhook_schema for instance ${instance.id}:`,
                parseError,
              );
            }
          }
        } catch (error) {
          console.error(`Failed to set WEBHOOK_CONFIG for instance ${instance.id}:`, error);
        }
      } else {
        console.log(`No api_webhook_schema for instance ${instance.id} or it's empty`);
      }

      // Для отладки: выводим переменные окружения контейнера
      console.log(`Environment variables for container ${instance.id}:`, apiService.environment);

      config.services[apiServiceName] = apiService;
    }

    // Добавляем MCP сервис если нужен
    if (instance.type_instance.includes('mcp') && instance.port_mcp) {
      const mcpServiceName = NamingUtils.getMcpServiceName(instance.id);
      const mcpService: any = {
        image: 'wweb-mcp:latest',
        container_name: NamingUtils.getMcpContainerName(instance.id),
        ports: [`${instance.port_mcp}:${instance.port_mcp}`],
        networks: ['wweb-network'], // Подключаем к общей сети
        command: [
          '-m',
          'mcp',
          '-c',
          'api',
          '-t',
          'sse',
          '-p',
          instance.port_mcp.toString(),
          '--log-level',
          'debug',
        ],
        logging: {
          driver: 'json-file',
          options: {
            'max-size': '50m',
            'max-file': '4',
          },
        },
        deploy: {
          resources: {
            limits: {
              memory: '512M',
              cpus: '0.5',
            },
            reservations: {
              memory: '128M',
              cpus: '0.1',
            },
          },
        },
        labels: NamingUtils.getDockerLabels(
          instance.id,
          instance.company_id || 'unknown',
          instance.provider,
          'mcp',
        ),
        environment: {
          DOCKER_CONTAINER: 'true',
          INSTANCE_ID: instance.id,
          // Добавляем переменные для подключения к базе данных из переменных окружения
          DB_HOST: process.env.DATABASE_HOST || process.env.DB_HOST || 'host.docker.internal',
          DB_PORT: process.env.DATABASE_PORT || process.env.DB_PORT || '5432',
          DB_NAME: process.env.DATABASE_NAME || process.env.DB_NAME || 'postgres',
          DB_USER: process.env.DATABASE_USER || process.env.DB_USER || 'postgres',
          DB_PASSWORD: process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || 'password',
          DB_SCHEMA: process.env.DATABASE_SCHEMA || process.env.DB_SCHEMA || 'public',
          // Добавляем переменные для агентной системы (Agno)
          AGNO_API_BASE_URL: process.env.AGNO_API_BASE_URL || 'http://host.docker.internal:8000',
          AGNO_API_TIMEOUT: process.env.AGNO_API_TIMEOUT || '10000',
          AGNO_ENABLED: process.env.AGNO_ENABLED || 'true',
          // Переменные для Supabase
          DATABASE_URL: process.env.DATABASE_URL,
          DATABASE_HOST: process.env.DATABASE_HOST || 'host.docker.internal',
          DATABASE_PORT: process.env.DATABASE_PORT || '5432',
          DATABASE_NAME: process.env.DATABASE_NAME || 'postgres',
          DATABASE_USER: process.env.DATABASE_USER || 'postgres',
          DATABASE_PASSWORD: process.env.DATABASE_PASSWORD || 'password',
          DATABASE_SCHEMA: process.env.DATABASE_SCHEMA || 'public',
          DATABASE_SSL: process.env.DATABASE_SSL || 'false',
          USE_SUPABASE: process.env.USE_SUPABASE || 'false',
        },
      };

      // Если есть API сервис, MCP зависит от него
      if (instance.type_instance.includes('api')) {
        mcpService.depends_on = [NamingUtils.getApiServiceName(instance.id)];
        mcpService.command.push(
          '--api-base-url',
          `http://${NamingUtils.getApiServiceName(instance.id)}:${instance.port_api}/api`,
        );

        // Используем реальный API ключ из базы данных если доступен, иначе ID инстанса как временное решение
        const apiKey = instance.api_key || instance.id;
        mcpService.command.push('--api-key', apiKey);
        // Сохраняем API ключ в переменной окружения для обратной совместимости
        mcpService.environment.WHATSAPP_API_KEY = apiKey;
      }

      config.services[mcpServiceName] = mcpService;
    }

    return yaml.stringify(config);
  }

  static async saveComposeFile(instance: MessageInstance, content: string): Promise<string> {
    const filePath = NamingUtils.getComposeFilePath(instance.id);
    const fullPath = path.resolve(filePath);

    // Создаем директорию если не существует
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    // Сохраняем файл
    await fs.writeFile(fullPath, content, 'utf-8');

    return fullPath;
  }

  static async deleteComposeFile(instanceId: string): Promise<void> {
    const filePath = NamingUtils.getComposeFilePath(instanceId);
    const fullPath = path.resolve(filePath);

    try {
      await fs.unlink(fullPath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  static async updateComposeFileWithApiKey(instanceId: string, apiKey: string): Promise<void> {
    const filePath = NamingUtils.getComposeFilePath(instanceId);
    const fullPath = path.resolve(filePath);

    // Читаем существующий файл
    const content = await fs.readFile(fullPath, 'utf-8');
    const config = yaml.parse(content) as ComposeConfig;

    // Обновляем MCP сервис с API ключом
    const mcpServiceName = NamingUtils.getMcpServiceName(instanceId);
    if (config.services[mcpServiceName]) {
      if (!config.services[mcpServiceName].environment) {
        config.services[mcpServiceName].environment = {};
      }
      config.services[mcpServiceName].environment.WHATSAPP_API_KEY = apiKey;
    }

    // Сохраняем обновленный файл
    await fs.writeFile(fullPath, yaml.stringify(config), 'utf-8');
  }
}
