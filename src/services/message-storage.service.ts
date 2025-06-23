import { Pool } from 'pg';
import logger from '../logger';

export interface MessageData {
  instance_id: string;
  message_id: string;
  chat_id: string;
  from_number?: string;
  to_number?: string;
  message_body?: string;
  message_type?: string;
  is_from_me?: boolean;
  is_group: boolean;
  group_id?: string;
  contact_name?: string;
  agent_id?: string;
  session_id?: string;
  timestamp: number;
  message_source?: string;
}

export interface StoredMessage extends MessageData {
  id: string;
  created_at: Date;
  updated_at: Date;
}

export class MessageStorageService {
  private pool: Pool;
  private schema: string;

  constructor(pool: Pool, schema: string = 'ai') {
    this.pool = pool;
    this.schema = schema;
  }

  /**
   * Генерирует session_id из agent_id и chat_id, или только из chat_id если agent_id отсутствует
   */
  private generateSessionId(agentId?: string, chatId?: string): string | undefined {
    if (!chatId) {
      return undefined;
    }
    
    // Используем детерминированную генерацию UUID
    const crypto = require('crypto');
    const sessionString = agentId ? `session:${agentId}:${chatId}` : `session:${chatId}`;
    const hash = crypto.createHash('sha256').update(sessionString).digest('hex');
    
    // Форматируем как UUID v4
    const uuid = [
      hash.substr(0, 8),
      hash.substr(8, 4),
      '4' + hash.substr(13, 3), // версия 4
      ((parseInt(hash.substr(16, 1), 16) & 0x3) | 0x8).toString(16) + hash.substr(17, 3), // вариант
      hash.substr(20, 12)
    ].join('-');
    
    return uuid;
  }

  /**
   * Сохраняет сообщение в базу данных
   */
  async saveMessage(messageData: MessageData): Promise<StoredMessage | null> {
    try {
      // Автоматически генерируем session_id если не передан
      // Используем agent_id + chat_id если agent_id доступен, иначе только chat_id
      const sessionId = messageData.session_id || this.generateSessionId(messageData.agent_id, messageData.chat_id);

      const query = `
        INSERT INTO ${this.schema}.messages (
          instance_id, message_id, chat_id, from_number, to_number,
          message_body, message_type, is_from_me, is_group, group_id,
          contact_name, agent_id, session_id, message_source, timestamp, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW()
        )
        ON CONFLICT (instance_id, message_id) 
        DO UPDATE SET
          message_body = EXCLUDED.message_body,
          contact_name = EXCLUDED.contact_name,
          is_from_me = EXCLUDED.is_from_me,
          agent_id = EXCLUDED.agent_id,
          session_id = EXCLUDED.session_id,
          message_source = EXCLUDED.message_source,
          updated_at = NOW()
        RETURNING *
      `;

      const values = [
        messageData.instance_id,
        messageData.message_id,
        messageData.chat_id,
        messageData.from_number,
        messageData.to_number,
        messageData.message_body,
        messageData.message_type || 'text',
        messageData.is_from_me || false,
        messageData.is_group,
        messageData.group_id,
        messageData.contact_name,
        messageData.agent_id,
        sessionId,
        messageData.message_source || 'user',
        messageData.timestamp,
      ];

      const result = await this.pool.query<StoredMessage>(query, values);

      logger.debug('Message saved to database', {
        messageId: messageData.message_id,
        instanceId: messageData.instance_id,
        isGroup: messageData.is_group,
        isFromMe: messageData.is_from_me,
      });

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to save message to database', {
        error: error instanceof Error ? error.message : String(error),
        messageId: messageData.message_id,
        instanceId: messageData.instance_id,
      });
      return null;
    }
  }

  /**
   * Получает сообщения для определенного инстанса
   */
  async getMessages(
    instanceId: string,
    options: {
      chatId?: string;
      limit?: number;
      offset?: number;
      isGroup?: boolean;
    } = {},
  ): Promise<StoredMessage[]> {
    try {
      let query = `
        SELECT * FROM ${this.schema}.messages 
        WHERE instance_id = $1
      `;
      const params: any[] = [instanceId];
      let paramIndex = 2;

      if (options.chatId) {
        query += ` AND chat_id = $${paramIndex}`;
        params.push(options.chatId);
        paramIndex++;
      }

      if (options.isGroup !== undefined) {
        query += ` AND is_group = $${paramIndex}`;
        params.push(options.isGroup);
        paramIndex++;
      }

      query += ' ORDER BY timestamp DESC';

      if (options.limit) {
        query += ` LIMIT $${paramIndex}`;
        params.push(options.limit);
        paramIndex++;
      }

      if (options.offset) {
        query += ` OFFSET $${paramIndex}`;
        params.push(options.offset);
      }

      const result = await this.pool.query<StoredMessage>(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get messages from database', {
        error: error instanceof Error ? error.message : String(error),
        instanceId,
        options,
      });
      return [];
    }
  }

  /**
   * Получает статистику сообщений для инстанса
   */
  async getMessageStats(instanceId: string): Promise<{
    totalMessages: number;
    groupMessages: number;
    privateMessages: number;
  }> {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_messages,
          COUNT(*) FILTER (WHERE is_group = true) as group_messages,
          COUNT(*) FILTER (WHERE is_group = false) as private_messages
        FROM ${this.schema}.messages 
        WHERE instance_id = $1
      `;

      const result = await this.pool.query(query, [instanceId]);
      const row = result.rows[0];

      return {
        totalMessages: parseInt(row.total_messages) || 0,
        groupMessages: parseInt(row.group_messages) || 0,
        privateMessages: parseInt(row.private_messages) || 0,
      };
    } catch (error) {
      logger.error('Failed to get message stats from database', {
        error: error instanceof Error ? error.message : String(error),
        instanceId,
      });
      return {
        totalMessages: 0,
        groupMessages: 0,
        privateMessages: 0,
      };
    }
  }

  /**
   * Получает последние сообщения для инстанса
   */
  async getRecentMessages(instanceId: string, limit: number = 10): Promise<StoredMessage[]> {
    try {
      const query = `
        SELECT * FROM ${this.schema}.messages 
        WHERE instance_id = $1
        ORDER BY timestamp DESC
        LIMIT $2
      `;

      const result = await this.pool.query<StoredMessage>(query, [instanceId, limit]);

      logger.debug('Retrieved recent messages from database', {
        instanceId,
        count: result.rows.length,
        limit,
      });

      return result.rows;
    } catch (error) {
      logger.error('Failed to get recent messages from database', {
        error: error instanceof Error ? error.message : String(error),
        instanceId,
        limit,
      });
      return [];
    }
  }

  /**
   * Удаляет старые сообщения (старше указанного количества дней)
   */
  async cleanupOldMessages(instanceId: string, daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffTimestamp = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;

      const query = `
        DELETE FROM ${this.schema}.messages 
        WHERE instance_id = $1 AND timestamp < $2
      `;

      const result = await this.pool.query(query, [instanceId, cutoffTimestamp]);
      const deletedCount = result.rowCount || 0;

      logger.info('Cleaned up old messages', {
        instanceId,
        daysToKeep,
        deletedCount,
      });

      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup old messages', {
        error: error instanceof Error ? error.message : String(error),
        instanceId,
        daysToKeep,
      });
      return 0;
    }
  }
}
