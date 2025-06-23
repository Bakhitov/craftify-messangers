import { Pool } from 'pg';
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

export interface BaseInstanceData {
  id?: string;
  user_id?: string;
  provider: MessengerProvider;
  type_instance?: string[];
  port_api?: number;
  port_mcp?: number;
  api_key?: string;
  api_key_generated_at?: Date;
  api_webhook_schema?: any;
  mcp_schema?: any;
  agent_id?: string;
  agno_enable?: boolean;
  stream?: boolean;
  created_at?: Date;
  updated_at?: Date;
  auth_status?: string;
  account?: string;
}

export interface TelegramInstanceData extends BaseInstanceData {
  provider: 'telegram';
  bot_token: string;
  bot_username?: string;
  webhook_url?: string;
  webhook_secret?: string;
}

export interface WhatsAppOfficialInstanceData extends BaseInstanceData {
  provider: 'whatsapp-official';
  phone_number_id: string;
  access_token: string;
  webhook_verify_token?: string;
  business_account_id?: string;
  api_version?: string;
}

export interface FacebookMessengerInstanceData extends BaseInstanceData {
  provider: 'facebook-messenger';
  page_access_token: string;
  page_id: string;
  app_secret: string;
  webhook_verify_token?: string;
  api_version?: string;
}

export interface InstagramInstanceData extends BaseInstanceData {
  provider: 'instagram';
  access_token: string;
  instagram_user_id: string;
  app_secret?: string;
  webhook_verify_token?: string;
}

export interface SlackInstanceData extends BaseInstanceData {
  provider: 'slack';
  bot_token: string;
  app_token?: string;
  signing_secret: string;
  team_id?: string;
  socket_mode?: boolean;
  webhook_url?: string;
}

export interface DiscordInstanceData extends BaseInstanceData {
  provider: 'discord';
  bot_token: string;
  client_id: string;
  guild_id?: string;
  application_id?: string;
  intents?: number[];
}

export interface WhatsAppWebInstanceData extends BaseInstanceData {
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
  async createInstance(instanceData: ProviderInstanceData): Promise<string> {
    const tableName = this.getTableName(instanceData.provider);
    const id = instanceData.id || this.generateUUID();

    try {
      // Базовые поля
      const baseFields = [
        'id',
        'user_id',
        'provider',
        'type_instance',
        'port_api',
        'port_mcp',
        'api_key',
        'api_webhook_schema',
        'mcp_schema',
        'agent_id',
        'agno_enable',
        'stream',
        'auth_status',
        'account',
      ];

      const baseValues = [
        id,
        instanceData.user_id,
        instanceData.provider,
        instanceData.type_instance || ['api'],
        instanceData.port_api,
        instanceData.port_mcp,
        instanceData.api_key,
        JSON.stringify(instanceData.api_webhook_schema || {}),
        JSON.stringify(instanceData.mcp_schema || {}),
        instanceData.agent_id,
        instanceData.agno_enable !== false,
        instanceData.stream || false,
        instanceData.auth_status || 'ready',
        instanceData.account,
      ];

      // Специфичные для провайдера поля
      let specificFields: string[] = [];
      let specificValues: any[] = [];

      switch (instanceData.provider) {
        case 'telegram':
          const telegramData = instanceData as TelegramInstanceData;
          specificFields = ['bot_token', 'bot_username', 'webhook_url', 'webhook_secret'];
          specificValues = [
            telegramData.bot_token,
            telegramData.bot_username,
            telegramData.webhook_url,
            telegramData.webhook_secret,
          ];
          break;

        case 'whatsapp-official':
          const whatsappOfficialData = instanceData as WhatsAppOfficialInstanceData;
          specificFields = [
            'phone_number_id',
            'access_token',
            'webhook_verify_token',
            'business_account_id',
            'api_version',
          ];
          specificValues = [
            whatsappOfficialData.phone_number_id,
            whatsappOfficialData.access_token,
            whatsappOfficialData.webhook_verify_token,
            whatsappOfficialData.business_account_id,
            whatsappOfficialData.api_version || 'v18.0',
          ];
          break;

        case 'facebook-messenger':
          const messengerData = instanceData as FacebookMessengerInstanceData;
          specificFields = [
            'page_access_token',
            'page_id',
            'app_secret',
            'webhook_verify_token',
            'api_version',
          ];
          specificValues = [
            messengerData.page_access_token,
            messengerData.page_id,
            messengerData.app_secret,
            messengerData.webhook_verify_token,
            messengerData.api_version || 'v18.0',
          ];
          break;

        case 'instagram':
          const instagramData = instanceData as InstagramInstanceData;
          specificFields = [
            'access_token',
            'instagram_user_id',
            'app_secret',
            'webhook_verify_token',
          ];
          specificValues = [
            instagramData.access_token,
            instagramData.instagram_user_id,
            instagramData.app_secret,
            instagramData.webhook_verify_token,
          ];
          break;

        case 'slack':
          const slackData = instanceData as SlackInstanceData;
          specificFields = [
            'bot_token',
            'app_token',
            'signing_secret',
            'team_id',
            'socket_mode',
            'webhook_url',
          ];
          specificValues = [
            slackData.bot_token,
            slackData.app_token,
            slackData.signing_secret,
            slackData.team_id,
            slackData.socket_mode || false,
            slackData.webhook_url,
          ];
          break;

        case 'discord':
          const discordData = instanceData as DiscordInstanceData;
          specificFields = ['bot_token', 'client_id', 'guild_id', 'application_id', 'intents'];
          specificValues = [
            discordData.bot_token,
            discordData.client_id,
            discordData.guild_id,
            discordData.application_id,
            JSON.stringify(discordData.intents || []),
          ];
          break;

        case 'whatsapp':
        case 'whatsappweb':
          const whatsappWebData = instanceData as WhatsAppWebInstanceData;
          specificFields = ['last_qr_generated_at', 'whatsapp_state', 'token'];
          specificValues = [
            whatsappWebData.last_qr_generated_at,
            whatsappWebData.whatsapp_state,
            whatsappWebData.token,
          ];
          break;
      }

      const allFields = [...baseFields, ...specificFields];
      const allValues = [...baseValues, ...specificValues];
      const placeholders = allFields.map((_, index) => `$${index + 1}`).join(', ');

      const query = `
        INSERT INTO ai.${tableName} (${allFields.join(', ')})
        VALUES (${placeholders})
        RETURNING id
      `;

      const result = await this.pool.query(query, allValues);
      logger.info(`Created ${instanceData.provider} instance: ${id}`);

      return result.rows[0].id;
    } catch (error) {
      logger.error(`Failed to create ${instanceData.provider} instance:`, error);
      throw error;
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
      const query = `SELECT * FROM ai.${tableName} WHERE id = $1`;
      const result = await this.pool.query(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToInstanceData(result.rows[0], provider);
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
      const query = `SELECT * FROM ai.${tableName} ORDER BY created_at DESC`;
      const result = await this.pool.query(query);

      return result.rows.map(row => this.mapRowToInstanceData(row, provider));
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
        const query = `SELECT * FROM ai.${tableName} WHERE user_id = $1 ORDER BY created_at DESC`;
        const result = await this.pool.query(query, [userId]);

        for (const row of result.rows) {
          instances.push(this.mapRowToInstanceData(row, provider));
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
  async updateInstance(id: string, updates: Partial<ProviderInstanceData>): Promise<void> {
    try {
      // Сначала определяем провайдер
      const existingInstance = await this.getInstance(id);
      if (!existingInstance) {
        throw new Error(`Instance ${id} not found`);
      }

      const tableName = this.getTableName(existingInstance.provider);
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      // Обновляем базовые поля
      const baseUpdatableFields = [
        'user_id',
        'port_api',
        'port_mcp',
        'api_webhook_schema',
        'mcp_schema',
        'agent_id',
        'agno_enable',
        'stream',
        'auth_status',
        'account',
      ];

      for (const field of baseUpdatableFields) {
        if (updates[field as keyof ProviderInstanceData] !== undefined) {
          updateFields.push(`${field} = $${paramIndex}`);
          let value = updates[field as keyof ProviderInstanceData];

          // JSON поля нужно stringify
          if (field === 'api_webhook_schema' || field === 'mcp_schema') {
            value = JSON.stringify(value);
          }

          updateValues.push(value);
          paramIndex++;
        }
      }

      // Добавляем updated_at
      updateFields.push(`updated_at = NOW()`);

      if (updateFields.length === 1) {
        // Только updated_at
        return;
      }

      // ID для WHERE условия
      updateValues.push(id);

      const query = `
        UPDATE ai.${tableName} 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
      `;

      await this.pool.query(query, updateValues);
      logger.info(`Updated ${existingInstance.provider} instance: ${id}`);
    } catch (error) {
      logger.error(`Failed to update instance ${id}:`, error);
      throw error;
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

      const tableName = this.getTableName(existingInstance.provider);
      const query = `DELETE FROM ai.${tableName} WHERE id = $1`;

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
  private mapRowToInstanceData(row: any, provider: MessengerProvider): ProviderInstanceData {
    const baseData: BaseInstanceData = {
      id: row.id,
      user_id: row.user_id,
      provider: provider as any,
      type_instance: row.type_instance,
      port_api: row.port_api,
      port_mcp: row.port_mcp,
      api_key: row.api_key,
      api_key_generated_at: row.api_key_generated_at,
      api_webhook_schema: row.api_webhook_schema,
      mcp_schema: row.mcp_schema,
      agent_id: row.agent_id,
      agno_enable: row.agno_enable,
      stream: row.stream,
      created_at: row.created_at,
      updated_at: row.updated_at,
      auth_status: row.auth_status,
      account: row.account,
    };

    switch (provider) {
      case 'telegram':
        return {
          ...baseData,
          provider: 'telegram',
          bot_token: row.bot_token,
          bot_username: row.bot_username,
          webhook_url: row.webhook_url,
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
          webhook_url: row.webhook_url,
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
          token: row.token,
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
        const query = `SELECT COUNT(*) as count FROM ai.${tableName}`;
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
