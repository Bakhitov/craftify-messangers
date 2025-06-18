import dotenv from 'dotenv';
import { createPool, getDatabaseConfig } from '../config/database.config';
import logger from '../logger';

// Загружаем переменные окружения из .env файла
dotenv.config();

export async function testDatabaseConnection(): Promise<boolean> {
  const pool = createPool();

  try {
    logger.info('Тестирование подключения к базе данных...');

    const config = getDatabaseConfig();
    logger.info('Конфигурация БД:', {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      schema: config.schema,
      ssl: config.ssl,
      useSupabase: process.env.USE_SUPABASE === 'true',
      hasConnectionString: !!config.connectionString,
    });

    // Тест подключения
    const client = await pool.connect();

    // Проверяем версию PostgreSQL
    const versionResult = await client.query('SELECT version()');
    logger.info('Версия PostgreSQL:', versionResult.rows[0].version);

    // Проверяем текущую схему
    const schemaResult = await client.query('SELECT current_schema()');
    logger.info('Текущая схема:', schemaResult.rows[0].current_schema);

    // Проверяем доступные схемы
    const schemasResult = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
      ORDER BY schema_name
    `);
    logger.info(
      'Доступные схемы:',
      schemasResult.rows.map(row => row.schema_name),
    );

    // Проверяем существующие таблицы в ai схеме
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'ai' 
      ORDER BY table_name
    `);
    logger.info(
      'Таблицы в схеме ai:',
      tablesResult.rows.map(row => row.table_name),
    );

    // Тест простого запроса
    const testResult = await client.query('SELECT NOW() as current_time, 1 + 1 as test_calc');
    logger.info('Тестовый запрос выполнен:', {
      currentTime: testResult.rows[0].current_time,
      testCalc: testResult.rows[0].test_calc,
    });

    client.release();

    logger.info('✅ Подключение к базе данных успешно!');
    return true;
  } catch (error) {
    logger.error('❌ Ошибка подключения к базе данных:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return false;
  } finally {
    await pool.end();
  }
}

export async function createTablesIfNotExists(): Promise<boolean> {
  const pool = createPool();

  try {
    logger.info('Создание таблиц если они не существуют...');

    const client = await pool.connect();

    // Создаем таблицу messages
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai.messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        instance_id UUID NOT NULL,
        message_id VARCHAR(255) NOT NULL,
        chat_id VARCHAR(255) NOT NULL,
        from_number VARCHAR(50),
        to_number VARCHAR(50),
        message_body TEXT,
        message_type VARCHAR(50) DEFAULT 'text',
        is_from_me BOOLEAN DEFAULT FALSE,
        is_group BOOLEAN DEFAULT FALSE,
        group_id VARCHAR(255),
        contact_name VARCHAR(255),
        timestamp BIGINT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(instance_id, message_id)
      );
    `);

    // Создаем индексы
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_instance_id ON ai.messages(instance_id);
      CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON ai.messages(chat_id);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON ai.messages(timestamp);
      CREATE INDEX IF NOT EXISTS idx_messages_from_number ON ai.messages(from_number);
      CREATE INDEX IF NOT EXISTS idx_messages_is_group ON ai.messages(is_group);
    `);

    // Создаем таблицу message_instances
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai.message_instances (
        id UUID PRIMARY KEY,
        user_id VARCHAR NOT NULL,
        provider VARCHAR NOT NULL DEFAULT 'whatsappweb',
        type_instance VARCHAR[] NOT NULL DEFAULT ARRAY['api'],
        port_api INTEGER,
        port_mcp INTEGER,
        api_key VARCHAR,
        api_webhook_schema JSONB DEFAULT '{}',
        mcp_schema JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Создаем индексы для message_instances
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_message_instances_user_id ON ai.message_instances(user_id);
      CREATE INDEX IF NOT EXISTS idx_message_instances_provider ON ai.message_instances(provider);
    `);

    client.release();

    logger.info('✅ Таблицы созданы успешно!');
    return true;
  } catch (error) {
    logger.error('❌ Ошибка создания таблиц:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return false;
  } finally {
    await pool.end();
  }
}

// Функция для запуска тестов
export async function runDatabaseTests(): Promise<void> {
  logger.info('🚀 Запуск тестов базы данных...');

  const connectionTest = await testDatabaseConnection();
  if (!connectionTest) {
    logger.error('❌ Тест подключения провален. Остановка.');
    process.exit(1);
  }

  const tablesTest = await createTablesIfNotExists();
  if (!tablesTest) {
    logger.error('❌ Тест создания таблиц провален. Остановка.');
    process.exit(1);
  }

  logger.info('✅ Все тесты базы данных прошли успешно!');
}

// Если файл запущен напрямую
if (require.main === module) {
  runDatabaseTests().catch(error => {
    logger.error('❌ Критическая ошибка при тестировании БД:', error);
    process.exit(1);
  });
}
