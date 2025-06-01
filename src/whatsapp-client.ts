import { Client, LocalAuth, Message, NoAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import logger from './logger';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { ExtendedClient } from './types';
import { MessageStorageService } from './services/message-storage.service';
import { instanceMemoryService } from './instance-manager/services/instance-memory.service';
import { createPool, getDatabaseConfig } from './config/database.config';
import { AgnoIntegrationService } from './services/agno-integration.service';

// Configuration interface
export interface WhatsAppConfig {
  authDataPath?: string;
  authStrategy?: 'local' | 'none';
  dockerContainer?: boolean;
  mediaStoragePath?: string;
  messageStorageService?: MessageStorageService;
  instanceId?: string;
  webhookConfig?: WebhookConfig;
}

interface WebhookConfig {
  url: string;
  authToken?: string;
  filters?: {
    allowedNumbers?: string[];
    allowPrivate?: boolean;
    allowGroups?: boolean;
  };
}

function loadWebhookConfig(dataPath: string): WebhookConfig | undefined {
  try {
    // First, try to load from current working directory (for Docker /project)
    const currentDirWebhookPath = path.join(process.cwd(), 'webhook.json');
    logger.debug(`Checking for webhook.json in current directory: ${currentDirWebhookPath}`);

    if (fs.existsSync(currentDirWebhookPath)) {
      logger.info(`Loading webhook config from: ${currentDirWebhookPath}`);
      try {
        const configContent = fs.readFileSync(currentDirWebhookPath, 'utf8');
        logger.debug(`Read webhook.json content: ${configContent}`);
        const config = JSON.parse(configContent);

        // Проверка структуры конфигурации
        if (!config.url) {
          logger.warn(
            `Invalid webhook config in ${currentDirWebhookPath}: missing required 'url' field`,
          );
          return undefined;
        }

        return config;
      } catch (err) {
        logger.error(
          `Error reading webhook.json from ${currentDirWebhookPath}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } else {
      logger.debug(`webhook.json not found in current directory`);
    }

    // Fallback to auth data path
    const webhookConfigPath = path.join(dataPath, 'webhook.json');
    logger.debug(`Checking for webhook.json in auth data path: ${webhookConfigPath}`);

    if (fs.existsSync(webhookConfigPath)) {
      logger.info(`Loading webhook config from: ${webhookConfigPath}`);
      try {
        const configContent = fs.readFileSync(webhookConfigPath, 'utf8');
        logger.debug(`Read webhook.json content: ${configContent}`);
        const config = JSON.parse(configContent);

        // Проверка структуры конфигурации
        if (!config.url) {
          logger.warn(
            `Invalid webhook config in ${webhookConfigPath}: missing required 'url' field`,
          );
          return undefined;
        }

        return config;
      } catch (err) {
        logger.error(
          `Error reading webhook.json from ${webhookConfigPath}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } else {
      logger.debug(`webhook.json not found in auth data path`);
    }

    logger.debug('No webhook config found');
    return undefined;
  } catch (error) {
    logger.error(
      `Unexpected error in loadWebhookConfig: ${error instanceof Error ? error.message : String(error)}`,
    );
    return undefined;
  }
}

export function createWhatsAppClient(config: WhatsAppConfig = {}): Client & ExtendedClient {
  const authDataPath = config.authDataPath || '.wwebjs_auth';
  const mediaStoragePath = config.mediaStoragePath || path.join(authDataPath, 'media');

  // Создаем экземпляр AgnoIntegrationService
  const pool = createPool();
  const agnoIntegrationService = new AgnoIntegrationService(pool);

  // Приоритет: 1) webhookConfig из config (из БД), 2) webhook.json из файла
  let webhookConfig = config.webhookConfig;

  // Подробное логирование о наличии webhook конфигурации
  if (webhookConfig) {
    logger.info(`Webhook configuration provided in config: ${JSON.stringify(webhookConfig)}`);
  } else {
    logger.debug('No webhook configuration provided in config, will try to load from file');
  }

  // Если webhookConfig не передан напрямую, используем файловую систему как запасной вариант
  if (!webhookConfig) {
    webhookConfig = loadWebhookConfig(authDataPath);
    if (webhookConfig) {
      logger.info(`Loaded webhook config from file: ${JSON.stringify(webhookConfig)}`);
    }
  } else {
    logger.info('Using webhook config from database api_webhook_schema');
  }

  // Итоговый статус загрузки webhook конфигурации
  if (webhookConfig) {
    logger.info(`Final webhook configuration: ${JSON.stringify(webhookConfig)}`);
  } else {
    logger.warn('No webhook configuration found, webhook functionality will be disabled');
  }

  // Create media storage directory if it doesn't exist
  if (!fs.existsSync(mediaStoragePath)) {
    try {
      fs.mkdirSync(mediaStoragePath, { recursive: true });
      logger.info(`Created media storage directory: ${mediaStoragePath}`);
    } catch (error) {
      logger.error(`Failed to create media storage directory: ${error}`);
    }
  }

  // remove Chrome lock file if it exists
  try {
    fs.rmSync(authDataPath + '/SingletonLock', { force: true });
  } catch {
    // Ignore if file doesn't exist
  }

  const npx_args = { headless: true };
  const docker_args = {
    headless: true,
    userDataDir: authDataPath,
    args: ['--no-sandbox', '--single-process', '--no-zygote'],
  };

  const authStrategy =
    config.authStrategy === 'local' && !config.dockerContainer
      ? new LocalAuth({
          dataPath: authDataPath,
        })
      : new NoAuth();

  const puppeteer = config.dockerContainer ? docker_args : npx_args;

  const client = new Client({
    puppeteer,
    authStrategy,
    restartOnAuthFail: true,
  }) as Client & ExtendedClient;

  // Generate QR code when needed
  client.on('qr', (qr: string) => {
    // Сохраняем QR код в объекте клиента
    client.currentQrCode = qr;
    logger.info('QR code generated', {
      action: 'qr_code_generated',
      qrLength: qr.length,
    });

    // Сохраняем QR код в память если есть instanceId
    if (config.instanceId) {
      instanceMemoryService.saveQRCode(config.instanceId, qr, {
        source: 'whatsapp-client.ts:qr_event',
      });
      instanceMemoryService.updateStatus(config.instanceId, 'qr_ready', {
        source: 'whatsapp-client.ts:qr_event',
        message: 'QR code generated and ready for scanning',
      });
    }

    // Display QR code in terminal
    qrcode.generate(qr, { small: true }, qrcode => {
      logger.info(`QR code generated. Scan it with your phone to log in.\n${qrcode}`);
    });
  });

  // Handle ready event
  client.on('ready', async () => {
    // Очищаем QR код при готовности клиента
    client.currentQrCode = undefined;
    client.lastActivity = new Date();
    logger.info('Client is ready!', {
      action: 'client_ready',
      clientId: client.info?.wid?.user,
    });

    // Обновляем поле account в БД с номером телефона пользователя
    if (config.instanceId && client.info?.wid?.user) {
      await updateAccountInfo(config.instanceId, client.info.wid.user);
    }

    // Обновляем статус в памяти
    if (config.instanceId) {
      instanceMemoryService.markClientReady(config.instanceId);
      instanceMemoryService.updateStatus(config.instanceId, 'client_ready', {
        source: 'whatsapp-client.ts:ready_event',
        message: 'WhatsApp client is ready for messages',
      });
    }
  });

  // Handle authenticated event
  client.on('authenticated', () => {
    // Очищаем QR код при аутентификации
    client.currentQrCode = undefined;
    logger.info('Authentication successful!', {
      action: 'authenticated',
      clientId: client.info?.wid?.user,
    });

    // Обновляем статус в памяти
    if (config.instanceId) {
      instanceMemoryService.markAuthenticationSuccess(config.instanceId, {
        phone_number: client.info?.wid?.user,
        account: client.info?.pushname,
      });
      instanceMemoryService.updateStatus(config.instanceId, 'auth_success', {
        source: 'whatsapp-client.ts:authenticated_event',
        message: 'WhatsApp authentication successful',
      });
    }
  });

  // Handle auth failure event
  client.on('auth_failure', (msg: string) => {
    // Очищаем QR код при ошибке аутентификации
    client.currentQrCode = undefined;
    logger.error('Authentication failed:', {
      action: 'auth_failure',
      message: msg,
    });

    // Регистрируем ошибку в памяти
    if (config.instanceId) {
      instanceMemoryService.registerError(config.instanceId, `Authentication failed: ${msg}`, {
        source: 'whatsapp-client.ts:auth_failure_event',
      });
      instanceMemoryService.updateStatus(config.instanceId, 'failed', {
        source: 'whatsapp-client.ts:auth_failure_event',
        message: `Authentication failed: ${msg}`,
      });
    }
  });

  // Handle disconnected event
  client.on('disconnected', (reason: string) => {
    // Очищаем QR код при отключении
    client.currentQrCode = undefined;
    logger.warn('Client was disconnected:', {
      action: 'disconnected',
      reason,
    });

    // Регистрируем отключение в памяти
    if (config.instanceId) {
      instanceMemoryService.registerError(config.instanceId, `Client disconnected: ${reason}`, {
        source: 'whatsapp-client.ts:disconnected_event',
      });
      instanceMemoryService.updateStatus(config.instanceId, 'failed', {
        source: 'whatsapp-client.ts:disconnected_event',
        message: `Client disconnected: ${reason}`,
      });
    }
  });

  // Handle incoming messages
  client.on('message', async (message: Message) => {
    const contact = await message.getContact();
    client.lastActivity = new Date();

    logger.debug('Message received', {
      from: contact.number,
      name: contact.pushname,
      messageLength: message.body.length,
    });

    // Обновляем активность в памяти
    if (config.instanceId) {
      instanceMemoryService.updateMessageStats(config.instanceId, 'received');
    }

    // Сохраняем сообщение в базу данных если настроен сервис хранения
    if (config.messageStorageService && config.instanceId) {
      const isGroup = message.from.includes('@g.us');

      try {
        await config.messageStorageService.saveMessage({
          instance_id: config.instanceId,
          message_id: message.id._serialized,
          chat_id: message.from,
          from_number: contact.number,
          to_number: client.info?.wid?.user,
          message_body: message.body,
          message_type: message.type,
          is_from_me: false, // Входящее сообщение
          is_group: isGroup,
          group_id: isGroup ? message.from : undefined,
          contact_name: contact.pushname || contact.name,
          timestamp: message.timestamp,
        });
      } catch (error) {
        logger.error('Failed to save incoming message to database', {
          error: error instanceof Error ? error.message : String(error),
          messageId: message.id._serialized,
        });
      }
    }

    // Process webhook if configured
    if (webhookConfig) {
      logger.debug(`Processing webhook for message from ${contact.number}`);

      // Check filters
      const isGroup = message.from.includes('@g.us');

      // Skip if filters don't match
      if (
        (isGroup && webhookConfig.filters?.allowGroups === false) ||
        (!isGroup && webhookConfig.filters?.allowPrivate === false) ||
        (webhookConfig.filters?.allowedNumbers?.length &&
          !webhookConfig.filters.allowedNumbers.includes(contact.number))
      ) {
        logger.debug('Message filtered out', {
          isGroup,
          allowGroups: webhookConfig.filters?.allowGroups,
          allowPrivate: webhookConfig.filters?.allowPrivate,
          allowedNumbers: webhookConfig.filters?.allowedNumbers,
          contactNumber: contact.number,
        });
        return;
      }

      logger.debug(`Sending webhook for message from ${contact.number}`);

      // Send to webhook
      try {
        const response = await axios.post(
          webhookConfig.url,
          {
            from: contact.number,
            name: contact.pushname,
            message: message.body,
            isGroup,
            timestamp: message.timestamp,
            messageId: message.id._serialized,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              ...(webhookConfig.authToken
                ? { Authorization: `Bearer ${webhookConfig.authToken}` }
                : {}),
            },
          },
        );

        if (response.status < 200 || response.status >= 300) {
          logger.warn(`Webhook request failed with status ${response.status}`);
        }
      } catch (error) {
        logger.error('Error sending webhook:', error);
      }
    }

    // Проверка agno интеграции
    if (config.instanceId) {
      try {
        const agnoConfig = await agnoIntegrationService.getAgnoConfig(config.instanceId);
        if (agnoConfig?.enabled) {
          // Отправляем сообщение агенту
          const agnoResponse = await agnoIntegrationService.sendToAgent(
            agnoConfig.agentId,
            message.body,
            agnoConfig, // Передаем полную конфигурацию
          );

          // Если получили ответ от агента
          if (agnoResponse?.message) {
            // Отправляем ответ пользователю
            const sentMessage = await client.sendMessage(message.from, agnoResponse.message);

            // Сохраняем ответ агента в БД как исходящее сообщение
            if (config.messageStorageService) {
              const isGroup = message.from.includes('@g.us');
              await config.messageStorageService.saveMessage({
                instance_id: config.instanceId,
                message_id: sentMessage.id._serialized,
                chat_id: message.from,
                from_number: client.info?.wid?.user,
                to_number: contact.number,
                message_body: agnoResponse.message,
                message_type: 'text',
                is_from_me: true, // Ответ агента = исходящее сообщение
                is_group: isGroup,
                group_id: isGroup ? message.from : undefined,
                contact_name: contact.pushname || contact.name,
                timestamp: Date.now(),
              });
            }

            logger.debug('Agno response sent and saved', {
              agentId: agnoConfig.agentId,
              responseLength: agnoResponse.message.length,
              messageId: sentMessage.id._serialized,
            });
          }
        }
      } catch (error) {
        logger.error('Agno integration failed', error);
      }
    }
  });

  // Handle outgoing messages (sent from device)
  client.on('message_create', async (message: Message) => {
    // Only process messages sent by the user (fromMe = true)
    if (!message.fromMe) {
      return;
    }

    const contact = await message.getContact();
    client.lastActivity = new Date();

    logger.debug('Outgoing message detected from device', {
      to: contact.number,
      name: contact.pushname,
      messageLength: message.body.length,
      messageId: message.id._serialized,
    });

    // Обновляем активность в памяти
    if (config.instanceId) {
      instanceMemoryService.updateMessageStats(config.instanceId, 'sent');
    }

    // Сохраняем исходящее сообщение в базу данных
    if (config.messageStorageService && config.instanceId) {
      const isGroup = message.to.includes('@g.us');

      try {
        await config.messageStorageService.saveMessage({
          instance_id: config.instanceId,
          message_id: message.id._serialized,
          chat_id: message.to,
          from_number: client.info?.wid?.user,
          to_number: contact.number,
          message_body: message.body,
          message_type: message.type,
          is_from_me: true, // Исходящее сообщение
          is_group: isGroup,
          group_id: isGroup ? message.to : undefined,
          contact_name: contact.pushname || contact.name,
          timestamp: message.timestamp,
        });

        logger.debug('Outgoing message saved to database', {
          messageId: message.id._serialized,
          instanceId: config.instanceId,
          to: contact.number,
          isGroup,
        });
      } catch (error) {
        logger.error('Failed to save outgoing message to database', {
          error: error instanceof Error ? error.message : String(error),
          messageId: message.id._serialized,
        });
      }
    }

    // Process webhook for outgoing messages if configured
    if (webhookConfig) {
      logger.debug(`Processing webhook for outgoing message to ${contact.number}`);

      const isGroup = message.to.includes('@g.us');

      // Check filters (same logic as incoming messages)
      if (
        (isGroup && webhookConfig.filters?.allowGroups === false) ||
        (!isGroup && webhookConfig.filters?.allowPrivate === false) ||
        (webhookConfig.filters?.allowedNumbers?.length &&
          !webhookConfig.filters.allowedNumbers.includes(contact.number))
      ) {
        logger.debug('Outgoing message filtered out', {
          isGroup,
          allowGroups: webhookConfig.filters?.allowGroups,
          allowPrivate: webhookConfig.filters?.allowPrivate,
          allowedNumbers: webhookConfig.filters?.allowedNumbers,
          contactNumber: contact.number,
        });
        return;
      }

      logger.debug(`Sending webhook for outgoing message to ${contact.number}`);

      // Send to webhook with fromMe flag
      try {
        const response = await axios.post(
          webhookConfig.url,
          {
            from: client.info?.wid?.user, // Отправитель - сам пользователь
            to: contact.number,
            name: contact.pushname,
            message: message.body,
            isGroup,
            fromMe: true, // Флаг исходящего сообщения
            timestamp: message.timestamp,
            messageId: message.id._serialized,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              ...(webhookConfig.authToken
                ? { Authorization: `Bearer ${webhookConfig.authToken}` }
                : {}),
            },
          },
        );

        if (response.status < 200 || response.status >= 300) {
          logger.warn(`Outgoing webhook request failed with status ${response.status}`);
        } else {
          logger.debug('Outgoing webhook sent successfully', {
            messageId: message.id._serialized,
            to: contact.number,
            status: response.status,
          });
        }
      } catch (error) {
        logger.error('Error sending outgoing webhook:', error);
      }
    }
  });

  return client;
}

/**
 * Обновляет поле account в БД с информацией о пользователе
 */
async function updateAccountInfo(instanceId: string, accountInfo: string): Promise<void> {
  try {
    const pool = createPool();
    const config = getDatabaseConfig();

    await pool.query(
      `UPDATE ${config.schema}.message_instances 
       SET account = $1, updated_at = NOW() 
       WHERE id = $2`,
      [accountInfo, instanceId],
    );

    logger.info('WhatsApp account info updated in database', {
      instanceId,
      account: accountInfo,
    });
  } catch (error) {
    logger.error('Failed to update WhatsApp account info in database:', {
      error: error instanceof Error ? error.message : String(error),
      instanceId,
      account: accountInfo,
    });
  }
}
