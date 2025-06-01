import axios from 'axios';
import { createPool, getDatabaseConfig } from '../config/database.config';
import logger from '../logger';

export interface WebhookMessageData {
  instanceId: string;
  messageId: string;
  chatId: string;
  from?: string;
  body: string;
  timestamp: number;
  provider: 'whatsapp' | 'telegram';
  messageType: string;
  isGroup: boolean;
  contactName?: string;
}

export class WebhookService {
  async sendToWebhook(messageData: WebhookMessageData): Promise<void> {
    try {
      const webhookConfig = await this.getWebhookConfig(messageData.instanceId);

      if (!webhookConfig || !webhookConfig.url || !webhookConfig.enabled) {
        logger.debug('Webhook not configured or disabled', {
          instanceId: messageData.instanceId,
        });
        return;
      }

      const payload = {
        instance_id: messageData.instanceId,
        message_id: messageData.messageId,
        chat_id: messageData.chatId,
        from: messageData.from,
        body: messageData.body,
        timestamp: messageData.timestamp,
        provider: messageData.provider,
        message_type: messageData.messageType,
        is_group: messageData.isGroup,
        contact_name: messageData.contactName,
        received_at: new Date().toISOString(),
      };

      const response = await axios.post(webhookConfig.url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'WhatsApp-Web-MCP/1.0',
          ...(webhookConfig.headers || {}),
        },
        timeout: 15000,
      });

      logger.debug('Webhook delivered successfully', {
        instanceId: messageData.instanceId,
        messageId: messageData.messageId,
        status: response.status,
        url: webhookConfig.url,
      });
    } catch (error) {
      logger.error('Webhook delivery failed', {
        instanceId: messageData.instanceId,
        messageId: messageData.messageId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async getWebhookConfig(instanceId: string): Promise<any> {
    try {
      const pool = createPool();
      const config = getDatabaseConfig();

      const result = await pool.query(
        `SELECT api_webhook_schema FROM ${config.schema}.message_instances WHERE id = $1`,
        [instanceId],
      );

      return result.rows[0]?.api_webhook_schema;
    } catch (error) {
      logger.error('Failed to get webhook config:', error);
      return null;
    }
  }
}

export const webhookService = new WebhookService();
