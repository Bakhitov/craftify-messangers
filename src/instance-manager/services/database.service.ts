import { Pool } from 'pg';
import { MessageInstance } from '../models/instance.model';
import { createPool, CREATE_TABLE_SQL, CREATE_SCHEMA_SQL } from '../config/database.config';
import logger from '../../logger';
import { instanceMemoryService } from './instance-memory.service';

export class DatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = createPool();
    this.setupMemoryServiceIntegration();
  }

  private setupMemoryServiceIntegration(): void {
    // Подписываемся на события сохранения API ключей
    instanceMemoryService.on('save_api_key_to_db', async (instanceId: string, apiKey: string) => {
      try {
        logger.info(`Saving API key to database for instance ${instanceId}`);
        await this.updateInstance(instanceId, {
          api_key: apiKey,
          current_api_key: apiKey,
          api_key_generated_at: new Date(),
          updated_at: new Date(),
        });
        instanceMemoryService.markApiKeySavedToDb(instanceId);
        logger.info(`API key saved to database for instance ${instanceId}`);
      } catch (error) {
        logger.error(`Failed to save API key to database for instance ${instanceId}`, error);
        instanceMemoryService.registerError(instanceId, `Failed to save API key to DB: ${error}`, {
          source: 'database.service.ts:setupMemoryServiceIntegration',
        });
      }
    });

    // Подписываемся на события обновления статуса аутентификации
    instanceMemoryService.on('auth_status_changed', async (instanceId: string, authData: any) => {
      try {
        logger.debug(`Updating auth status in database for instance ${instanceId}`);
        await this.updateInstance(instanceId, {
          api_webhook_schema: {
            auth_status: authData.auth_status,
            account: authData.account,
            whatsapp_state: authData.whatsapp_state,
            last_seen: new Date().toISOString(),
          },
          updated_at: new Date(),
        });
        logger.debug(`Auth status updated in database for instance ${instanceId}`);
      } catch (error) {
        logger.error(`Failed to update auth status in database for instance ${instanceId}`, error);
      }
    });

    // Подписываемся на события сохранения QR кодов
    instanceMemoryService.on('qr_code_generated', async (instanceId: string, _qrData: any) => {
      try {
        logger.debug(`Updating QR generation time in database for instance ${instanceId}`);
        await this.updateInstance(instanceId, {
          last_qr_generated_at: new Date(),
          updated_at: new Date(),
        });
      } catch (error) {
        logger.error(`Failed to update QR generation time for instance ${instanceId}`, error);
      }
    });
  }

  async initialize(): Promise<void> {
    try {
      // Создаем схему
      await this.pool.query(CREATE_SCHEMA_SQL);
      logger.info('Database schema initialized (using ai schema)');

      // Создаем таблицу
      await this.pool.query(CREATE_TABLE_SQL);
      logger.info('Database initialized successfully');

      // Синхронизируем существующие данные с памятью
      await this.syncExistingDataToMemory();
    } catch (error) {
      logger.error('Failed to initialize database', error);
      throw error;
    }
  }

  /**
   * Синхронизация существующих данных из БД в память при запуске
   */
  private async syncExistingDataToMemory(): Promise<void> {
    try {
      const instances = await this.getAllInstances();

      for (const instance of instances) {
        // Добавляем экземпляр в память
        instanceMemoryService.setInstance(instance.id, {
          user_id: instance.user_id,
          provider: instance.provider,
          type_instance: instance.type_instance,
          ports: {
            api: instance.port_api,
            mcp: instance.port_mcp,
            assigned_at: instance.created_at,
          },
          created_at: instance.created_at,
          updated_at: instance.updated_at,
        });

        // Если есть API ключ (для WhatsApp), сохраняем его в память
        if (instance.api_key) {
          instanceMemoryService.saveApiKey(instance.id, instance.api_key, {
            source: 'database.service.ts:syncExistingDataToMemory',
            saveToDb: false, // Уже в БД
          });
          instanceMemoryService.markApiKeySavedToDb(instance.id);
        }

        // Если есть token (для Telegram), сохраняем его в память как API ключ
        if (instance.token && instance.provider === 'telegram') {
          instanceMemoryService.saveApiKey(instance.id, instance.token, {
            source: 'database.service.ts:syncExistingDataToMemory',
            saveToDb: false, // Уже в БД
          });
          instanceMemoryService.markApiKeySavedToDb(instance.id);
        }
      }

      logger.info(`Synced ${instances.length} instances to memory`);
    } catch (error) {
      logger.error('Failed to sync existing data to memory', error);
    }
  }

  async getInstanceById(id: string): Promise<MessageInstance | null> {
    const result = await this.pool.query<MessageInstance>(
      'SELECT * FROM ai.message_instances WHERE id = $1',
      [id],
    );

    return result.rows[0] || null;
  }

  async getAllInstances(filters?: {
    user_id?: string;
    provider?: string;
  }): Promise<MessageInstance[]> {
    let query = 'SELECT * FROM ai.message_instances WHERE 1=1';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters?.user_id) {
      query += ` AND user_id = $${paramIndex}`;
      params.push(filters.user_id);
      paramIndex++;
    }

    if (filters?.provider) {
      query += ` AND provider = $${paramIndex}`;
      params.push(filters.provider);
      paramIndex++;
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.pool.query<MessageInstance>(query, params);
    return result.rows;
  }

  async updateInstance(
    id: string,
    updates: Partial<Omit<MessageInstance, 'id' | 'created_at'>>,
  ): Promise<MessageInstance | null> {
    const updateFields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    // Добавляем updated_at автоматически
    updates.updated_at = new Date();

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      return await this.getInstanceById(id);
    }

    values.push(id);
    const query = `
      UPDATE ai.message_instances 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.pool.query<MessageInstance>(query, values);
    return result.rows[0] || null;
  }

  async deleteInstance(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM ai.message_instances WHERE id = $1', [
      id,
    ]);

    return (result.rowCount ?? 0) > 0;
  }

  async getInstancesByPorts(ports: number[]): Promise<MessageInstance[]> {
    if (ports.length === 0) return [];

    const result = await this.pool.query<MessageInstance>(
      'SELECT * FROM ai.message_instances WHERE port_api = ANY($1) OR port_mcp = ANY($1)',
      [ports],
    );

    return result.rows;
  }

  async countInstances(filters?: { user_id?: string; provider?: string }): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM ai.message_instances WHERE 1=1';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters?.user_id) {
      query += ` AND user_id = $${paramIndex}`;
      params.push(filters.user_id);
      paramIndex++;
    }

    if (filters?.provider) {
      query += ` AND provider = $${paramIndex}`;
      params.push(filters.provider);
      paramIndex++;
    }

    const result = await this.pool.query<{ count: string }>(query, params);
    return parseInt(result.rows[0].count);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  getPool(): Pool {
    return this.pool;
  }

  async createInstance(instanceData: {
    id: string;
    user_id: string;
    provider: string;
    type_instance: string[];
    api_webhook_schema?: object;
    mcp_schema?: object;
    api_key?: string; // Поддержка api_key для WhatsApp
    token?: string; // Поддержка token для Telegram
    agent_id?: string; // ID агента
    agno_enable?: boolean; // Включение Agno
    stream?: boolean; // Поддержка стриминга
    auth_status?: string; // Статус аутентификации
  }): Promise<MessageInstance> {
    const query = `
      INSERT INTO ai.message_instances (
        id, user_id, provider, type_instance, api_webhook_schema, mcp_schema, 
        api_key, token, agent_id, agno_enable, stream, auth_status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      instanceData.id,
      instanceData.user_id,
      instanceData.provider,
      instanceData.type_instance,
      JSON.stringify(instanceData.api_webhook_schema || {}),
      JSON.stringify(instanceData.mcp_schema || {}),
      instanceData.api_key || null, // Для WhatsApp
      instanceData.token || null, // Для Telegram
      instanceData.agent_id || null, // ID агента
      instanceData.agno_enable !== undefined ? instanceData.agno_enable : true, // Включение Agno
      instanceData.stream !== undefined ? instanceData.stream : false, // Поддержка стриминга
      instanceData.auth_status || 'pending', // Статус аутентификации
    ];

    const result = await this.pool.query<MessageInstance>(query, values);
    return result.rows[0];
  }
}
