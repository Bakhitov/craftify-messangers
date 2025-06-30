import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { getDatabaseConfig } from '../config/database.config';
import {
  MessengerProvider,
  ProviderConfig,
  TelegramConfig,
  WhatsAppOfficialConfig,
  FacebookMessengerConfig,
  InstagramConfig,
  SlackConfig,
  DiscordConfig,
} from '../types';
import logger from '../logger';

export interface InstanceData {
  id?: string;
  provider: string;
  account?: string;
  status?: string;
  phone?: string;
  api_key?: string;
  token?: string;
  qr_code?: string;
  webhook_url?: string;
  api_webhook_schema?: any;
  mcp_schema?: any;
  auth_status?: string;
  last_qr_update?: Date;
  created_at?: Date;
  updated_at?: Date;
}

export interface TelegramInstanceData extends InstanceData {
  provider: 'telegram';
  bot_token: string;
  bot_username?: string;
  webhook_secret?: string;
}

export interface WhatsAppOfficialInstanceData extends InstanceData {
  provider: 'whatsapp-official';
  phone_number_id: string;
  access_token: string;
  webhook_verify_token?: string;
  business_account_id?: string;
  api_version?: string;
}

export interface FacebookMessengerInstanceData extends InstanceData {
  provider: 'facebook-messenger';
  page_access_token: string;
  page_id: string;
  app_secret: string;
  webhook_verify_token?: string;
  api_version?: string;
}

export interface InstagramInstanceData extends InstanceData {
  provider: 'instagram';
  access_token: string;
  instagram_user_id: string;
  app_secret?: string;
  webhook_verify_token?: string;
}

export interface SlackInstanceData extends InstanceData {
  provider: 'slack';
  bot_token: string;
  app_token?: string;
  signing_secret: string;
  team_id?: string;
  socket_mode?: boolean;
}

export interface DiscordInstanceData extends InstanceData {
  provider: 'discord';
  bot_token: string;
  client_id: string;
  guild_id?: string;
  application_id?: string;
  intents?: number[];
}

export interface WhatsAppWebInstanceData extends InstanceData {
  provider: 'whatsapp' | 'whatsappweb';
  last_qr_generated_at?: Date;
  whatsapp_state?: string;
  token?: string;
}

export type ProviderInstanceData =
  | TelegramInstanceData
  | WhatsAppOfficialInstanceData
  | FacebookMessengerInstanceData
  | InstagramInstanceData
  | SlackInstanceData
  | DiscordInstanceData
  | WhatsAppWebInstanceData;

export class ProviderDatabaseService {
  private pool: Pool;
  private config: any;
  private schema: string = 'public';

  constructor(pool: Pool) {
    this.pool = pool;
    this.config = getDatabaseConfig();
  }

  /**
   * Получает таблицу для провайдера
   */
  private getTableName(provider: MessengerProvider): string {
    const tableMap: Record<MessengerProvider, string> = {
      telegram: 'telegram_instances',
      'whatsapp-official': 'whatsapp_official_instances',
      'facebook-messenger': 'facebook_messenger_instances',
      instagram: 'instagram_instances',
      slack: 'slack_instances',
      discord: 'discord_instances',
      whatsapp: 'whatsappweb_instances',
      whatsappweb: 'whatsappweb_instances',
    };

    return tableMap[provider] || 'whatsappweb_instances';
  }

  /**
   * Создает новый экземпляр провайдера
   */
  async createInstance(instanceData: InstanceData): Promise<InstanceData | null> {
    try {
      const instanceId = instanceData.id || randomUUID();
      const tableName = this.getTableName(instanceData.provider as MessengerProvider);

      if (!tableName) {
        throw new Error(`Unsupported provider: ${instanceData.provider}`);
      }

      const query = `
        INSERT INTO ${this.schema}.${tableName} (
          id, account, status, phone, api_key, token, 
          qr_code, webhook_url, api_webhook_schema, mcp_schema, 
          auth_status, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
        ) RETURNING *
      `;

      const values = [
        instanceId,
        instanceData.account,
        instanceData.status || 'disconnected',
        instanceData.phone,
        instanceData.api_key,
        instanceData.token,
        instanceData.qr_code,
        instanceData.webhook_url,
        instanceData.api_webhook_schema ? JSON.stringify(instanceData.api_webhook_schema) : null,
        instanceData.mcp_schema ? JSON.stringify(instanceData.mcp_schema) : null,
        instanceData.auth_status || 'pending',
      ];

      const result = await this.pool.query(query, values);
      const createdInstance = result.rows[0];

      logger.info('Instance created successfully', {
        instanceId,
        provider: instanceData.provider,
        status: createdInstance.status,
      });

      return this.mapDbRowToInstanceData(createdInstance, instanceData.provider as MessengerProvider);
    } catch (error) {
      logger.error('Failed to create instance', {
        error: error instanceof Error ? error.message : String(error),
        provider: instanceData.provider,
        instanceData,
      });
      return null;
    }
  }

  /**
   * Получает экземпляр провайдера по ID
   */
  async getInstance(
    id: string,
    provider?: MessengerProvider,
  ): Promise<ProviderInstanceData | null> {
    try {
      // Если провайдер не указан, ищем во всех таблицах
      if (!provider) {
        const providers: MessengerProvider[] = [
          'telegram',
          'whatsapp-official',
          'facebook-messenger',
          'instagram',
          'slack',
          'discord',
          'whatsappweb',
        ];

        for (const providerType of providers) {
          const instance = await this.getInstance(id, providerType);
          if (instance) {
            return instance;
          }
        }
        return null;
      }

      const tableName = this.getTableName(provider);
      const query = `SELECT * FROM public.${tableName} WHERE id = $1`;
      const result = await this.pool.query(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapDbRowToInstanceData(result.rows[0], provider);
    } catch (error) {
      logger.error(`Failed to get instance ${id}:`, error);
      throw error;
    }
  }

  /**
   * Получает все экземпляры провайдера
   */
  async getInstancesByProvider(provider: MessengerProvider): Promise<ProviderInstanceData[]> {
    try {
      const tableName = this.getTableName(provider);
      const query = `SELECT * FROM public.${tableName} ORDER BY created_at DESC`;
      const result = await this.pool.query(query);

      return result.rows.map(row => this.mapDbRowToInstanceData(row, provider));
    } catch (error) {
      logger.error(`Failed to get ${provider} instances:`, error);
      throw error;
    }
  }

  /**
   * Получает все экземпляры для пользователя
   */
  async getInstancesByUser(userId: string): Promise<ProviderInstanceData[]> {
    try {
      const instances: ProviderInstanceData[] = [];
      const providers: MessengerProvider[] = [
        'telegram',
        'whatsapp-official',
        'facebook-messenger',
        'instagram',
        'slack',
        'discord',
        'whatsappweb',
      ];

      for (const provider of providers) {
        const tableName = this.getTableName(provider);
        const query = `SELECT * FROM public.${tableName} WHERE user_id = $1 ORDER BY created_at DESC`;
        const result = await this.pool.query(query, [userId]);

        for (const row of result.rows) {
          instances.push(this.mapDbRowToInstanceData(row, provider));
        }
      }

      return instances;
    } catch (error) {
      logger.error(`Failed to get instances for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Обновляет экземпляр провайдера
   */
  async updateInstance(
    instanceId: string,
    provider: string,
    updateData: Partial<InstanceData>,
  ): Promise<InstanceData | null> {
    try {
      const tableName = this.getTableName(provider as MessengerProvider);

      if (!tableName) {
        throw new Error(`Unsupported provider: ${provider}`);
      }

      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      // Обновляемые поля (убрал agent_id, agno_enable)
      const fields = [
        'account',
        'status', 
        'phone',
        'api_key',
        'token',
        'qr_code',
        'webhook_url',
        'api_webhook_schema',
        'mcp_schema',
        'auth_status',
      ];

      for (const field of fields) {
        if (updateData[field as keyof InstanceData] !== undefined) {
          updateFields.push(`${field} = $${paramIndex}`);
          let value = updateData[field as keyof InstanceData];
          
          // Сериализуем JSON поля
          if ((field === 'api_webhook_schema' || field === 'mcp_schema') && value) {
            value = JSON.stringify(value);
          }
          
          values.push(value);
          paramIndex++;
        }
      }

      if (updateFields.length === 0) {
        logger.warn('No fields to update', { instanceId, provider });
        return await this.getInstance(instanceId, provider as MessengerProvider);
      }

      updateFields.push(`updated_at = NOW()`);
      values.push(instanceId);

      const query = `
        UPDATE ${this.schema}.${tableName} 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await this.pool.query(query, values);

      if (result.rows.length === 0) {
        logger.warn('Instance not found for update', { instanceId, provider });
        return null;
      }

      const updatedInstance = result.rows[0];

      logger.info('Instance updated successfully', {
        instanceId,
        provider,
        status: updatedInstance.status,
        updatedFields: updateFields.slice(0, -1), // Exclude updated_at
      });

      return this.mapDbRowToInstanceData(updatedInstance, provider as MessengerProvider);
    } catch (error) {
      logger.error('Failed to update instance', {
        error: error instanceof Error ? error.message : String(error),
        instanceId,
        provider,
        updateData,
      });
      return null;
    }
  }

  /**
   * Удаляет экземпляр провайдера
   */
  async deleteInstance(id: string): Promise<void> {
    try {
      // Сначала определяем провайдер
      const existingInstance = await this.getInstance(id);
      if (!existingInstance) {
        logger.warn(`Instance ${id} not found for deletion`);
        return;
      }

      const tableName = this.getTableName(existingInstance.provider as MessengerProvider);
      const query = `DELETE FROM public.${tableName} WHERE id = $1`;

      await this.pool.query(query, [id]);
      logger.info(`Deleted ${existingInstance.provider} instance: ${id}`);
    } catch (error) {
      logger.error(`Failed to delete instance ${id}:`, error);
      throw error;
    }
  }

  /**
   * Конвертирует строку из БД в InstanceData
   */
  private mapDbRowToInstanceData(row: any, provider: MessengerProvider): ProviderInstanceData {
    const baseData: InstanceData = {
      id: row.id,
      provider: provider as any,
      account: row.account,
      status: row.status,
      phone: row.phone,
      api_key: row.api_key,
      token: row.token,
      qr_code: row.qr_code,
      webhook_url: row.webhook_url,
      api_webhook_schema: row.api_webhook_schema ? JSON.parse(row.api_webhook_schema) : null,
      mcp_schema: row.mcp_schema ? JSON.parse(row.mcp_schema) : null,
      auth_status: row.auth_status,
      last_qr_update: row.last_qr_update,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    switch (provider) {
      case 'telegram':
        return {
          ...baseData,
          provider: 'telegram',
          bot_token: row.bot_token,
          bot_username: row.bot_username,
          webhook_secret: row.webhook_secret,
        } as TelegramInstanceData;

      case 'whatsapp-official':
        return {
          ...baseData,
          provider: 'whatsapp-official',
          phone_number_id: row.phone_number_id,
          access_token: row.access_token,
          webhook_verify_token: row.webhook_verify_token,
          business_account_id: row.business_account_id,
          api_version: row.api_version,
        } as WhatsAppOfficialInstanceData;

      case 'facebook-messenger':
        return {
          ...baseData,
          provider: 'facebook-messenger',
          page_access_token: row.page_access_token,
          page_id: row.page_id,
          app_secret: row.app_secret,
          webhook_verify_token: row.webhook_verify_token,
          api_version: row.api_version,
        } as FacebookMessengerInstanceData;

      case 'instagram':
        return {
          ...baseData,
          provider: 'instagram',
          access_token: row.access_token,
          instagram_user_id: row.instagram_user_id,
          app_secret: row.app_secret,
          webhook_verify_token: row.webhook_verify_token,
        } as InstagramInstanceData;

      case 'slack':
        return {
          ...baseData,
          provider: 'slack',
          bot_token: row.bot_token,
          app_token: row.app_token,
          signing_secret: row.signing_secret,
          team_id: row.team_id,
          socket_mode: row.socket_mode,
        } as SlackInstanceData;

      case 'discord':
        return {
          ...baseData,
          provider: 'discord',
          bot_token: row.bot_token,
          client_id: row.client_id,
          guild_id: row.guild_id,
          application_id: row.application_id,
          intents: row.intents,
        } as DiscordInstanceData;

      case 'whatsapp':
      case 'whatsappweb':
      default:
        return {
          ...baseData,
          provider: 'whatsappweb',
          last_qr_generated_at: row.last_qr_generated_at,
          whatsapp_state: row.whatsapp_state,
        } as WhatsAppWebInstanceData;
    }
  }

  /**
   * Генерирует UUID (простая реализация)
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Получает статистику по всем провайдерам
   */
  async getStatistics(): Promise<Record<MessengerProvider, number>> {
    const stats: Record<MessengerProvider, number> = {} as any;
    const providers: MessengerProvider[] = [
      'telegram',
      'whatsapp-official',
      'facebook-messenger',
      'instagram',
      'slack',
      'discord',
      'whatsappweb',
    ];

    for (const provider of providers) {
      try {
        const tableName = this.getTableName(provider);
        const query = `SELECT COUNT(*) as count FROM public.${tableName}`;
        const result = await this.pool.query(query);
        stats[provider] = parseInt(result.rows[0].count);
      } catch (error) {
        logger.error(`Failed to get stats for ${provider}:`, error);
        stats[provider] = 0;
      }
    }

    return stats;
  }
}
