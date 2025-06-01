import logger from '../../logger';
import { EventEmitter } from 'events';
import { createPool, getDatabaseConfig } from '../../config/database.config';

export interface InstanceMemoryData {
  // Основная информация
  instance_id: string;
  user_id: string;
  provider: string;
  type_instance: string[];

  // Детальные статусы с временными метками
  status:
    | 'start'
    | 'qr_ready'
    | 'api_key_ready'
    | 'auth_success'
    | 'client_ready'
    | 'client_error'
    | 'failed';
  status_updated_at: Date;
  status_history: Array<{
    status: string;
    timestamp: Date;
    source?: string; // файл:строка где произошло изменение
    message?: string; // сообщение лога
  }>;

  // Устаревшие статусы (для совместимости)
  status_instance:
    | 'creating'
    | 'starting'
    | 'ready_for_auth'
    | 'authenticated'
    | 'client_ready'
    | 'running'
    | 'stopped'
    | 'error';
  status_service: 'active' | 'inactive' | 'partial';
  auth_status: 'pending' | 'qr_ready' | 'authenticated' | 'client_ready' | 'failed';
  whatsapp_state?: string; // READY, AUTHENTICATED, etc.

  // Информация о пользователе WhatsApp (добавляем поля для совместимости)
  phone_number?: string;
  account?: string;

  // QR код с полной историей
  current_qr?: {
    code: string;
    text?: string;
    url?: string; // URL для получения QR через API
    generated_at: Date;
    expires_at: Date;
    scan_attempts: number;
    last_scan_attempt?: Date;
  };
  qr_history: Array<{
    code: string;
    generated_at: Date;
    expires_at: Date;
    was_scanned: boolean;
    scan_attempts: number;
  }>;

  // API ключ с историей
  current_api_key?: {
    key: string;
    generated_at: Date;
    saved_to_db: boolean;
    saved_to_db_at?: Date;
    first_use?: Date;
    last_use?: Date;
    usage_count: number;
  };
  api_key_history: Array<{
    key: string;
    generated_at: Date;
    saved_to_db_at?: Date;
    replaced_at?: Date;
    reason?: string; // 'rotation', 'security', 'restart'
  }>;

  // Порты
  ports?: {
    api?: number;
    mcp?: number;
    assigned_at?: Date;
  };

  // Информация о пользователе WhatsApp
  whatsapp_user?: {
    phone_number?: string;
    account?: string;
    profile_picture_url?: string;
    authenticated_at?: Date;
    last_seen_online?: Date;
  };

  // Активность и здоровье
  last_seen?: Date;
  last_activity?: Date;
  last_message_sent?: Date;
  last_message_received?: Date;
  is_ready_for_messages: boolean;

  // Ресурсы и производительность
  resources?: {
    cpu_usage?: string;
    memory_usage?: string;
    container_status?: Record<string, string>;
    last_updated?: Date;
  };

  // Статистика сообщений
  message_stats: {
    sent_count: number;
    received_count: number;
    last_sent_at?: Date;
    last_received_at?: Date;
    daily_sent: number;
    daily_received: number;
    daily_reset_at: Date;
  };

  // Система и надежность
  system_info: {
    uptime_start?: Date;
    restart_count: number;
    last_restart_at?: Date;
    restart_reason?: string;
    health_check_count: number;
    last_health_check?: Date;
    consecutive_failures: number;
  };

  // Ошибки и проблемы
  error_info?: {
    last_error?: string;
    last_error_at?: Date;
    error_count: number;
    error_history: Array<{
      error: string;
      timestamp: Date;
      source?: string;
      stack?: string;
    }>;
  };

  // Метаданные
  created_at: Date;
  updated_at: Date;
}

export interface InstanceMemoryStats {
  total_instances: number;
  active_instances: number;
  authenticated_instances: number;
  error_instances: number;
  qr_pending_instances: number;
  memory_usage_mb: number;
  avg_uptime_hours: number;
  total_messages_today: number;
}

export class InstanceMemoryService extends EventEmitter {
  private instances: Map<string, InstanceMemoryData> = new Map();
  private cleanupInterval?: NodeJS.Timeout;
  private dailyResetInterval?: NodeJS.Timeout;
  private readonly CLEANUP_INTERVAL = 2 * 60 * 1000; // 2 минуты (было 5)
  private readonly MAX_INACTIVE_TIME = 15 * 60 * 1000; // 15 минут (было 30)
  private readonly QR_EXPIRY_TIME = 30 * 1000; // 30 секунд (было 45)
  private readonly MAX_HISTORY_ITEMS = 20; // 20 записей (было 50)

  // Новые параметры оптимизации памяти
  private readonly MAX_LOG_ENTRIES = 10; // Максимум логов в памяти
  private readonly MAX_QR_HISTORY = 3; // Максимум QR кодов в истории
  private readonly MEMORY_PRESSURE_THRESHOLD = 0.8; // 80% использования памяти

  constructor() {
    super();
    this.startCleanupInterval();
    this.startDailyResetInterval();
    logger.info('InstanceMemoryService initialized with enhanced tracking and memory optimization');
  }

  /**
   * Создает или обновляет данные инстанса в памяти
   */
  setInstance(instanceId: string, data: Partial<InstanceMemoryData>): InstanceMemoryData {
    const now = new Date();
    const existing = this.instances.get(instanceId);

    const instanceData: InstanceMemoryData = {
      // Значения по умолчанию
      instance_id: instanceId,
      user_id: data.user_id || existing?.user_id || '',
      provider: data.provider || existing?.provider || 'unknown',
      type_instance: data.type_instance || existing?.type_instance || ['api'],

      // Новая система статусов
      status: data.status || existing?.status || 'start',
      status_updated_at: data.status ? now : existing?.status_updated_at || now,
      status_history: existing?.status_history || [],

      // Устаревшие статусы (для совместимости)
      status_instance: data.status_instance || existing?.status_instance || 'creating',
      status_service: data.status_service || existing?.status_service || 'inactive',
      auth_status: data.auth_status || existing?.auth_status || 'pending',

      // QR код
      qr_history: existing?.qr_history || [],

      // API ключ
      api_key_history: existing?.api_key_history || [],

      // Активность
      is_ready_for_messages: data.is_ready_for_messages ?? existing?.is_ready_for_messages ?? false,

      // Статистика сообщений
      message_stats: {
        sent_count: existing?.message_stats?.sent_count || 0,
        received_count: existing?.message_stats?.received_count || 0,
        daily_sent: existing?.message_stats?.daily_sent || 0,
        daily_received: existing?.message_stats?.daily_received || 0,
        daily_reset_at: existing?.message_stats?.daily_reset_at || this.getNextDayStart(),
        ...data.message_stats,
      },

      // Система
      system_info: {
        restart_count: existing?.system_info?.restart_count || 0,
        health_check_count: existing?.system_info?.health_check_count || 0,
        consecutive_failures: existing?.system_info?.consecutive_failures || 0,
        ...existing?.system_info,
        ...data.system_info,
      },

      // Ошибки
      error_info: {
        error_count: existing?.error_info?.error_count || 0,
        error_history: existing?.error_info?.error_history || [],
        ...existing?.error_info,
        ...data.error_info,
      },

      // Метаданные
      created_at: existing?.created_at || now,
      updated_at: now,

      // Переносим существующие данные
      ...existing,

      // Применяем новые данные
      ...data,
    };

    this.instances.set(instanceId, instanceData);

    // Эмитим событие обновления
    this.emit('instance_updated', instanceId, instanceData);

    logger.debug(`Instance memory updated: ${instanceId}`, {
      status: instanceData.status,
      auth_status: instanceData.auth_status,
      is_ready: instanceData.is_ready_for_messages,
    });

    return instanceData;
  }

  /**
   * Обновляет статус инстанса с полным трекингом
   */
  updateStatus(
    instanceId: string,
    status: InstanceMemoryData['status'],
    options?: {
      source?: string;
      message?: string;
      whatsapp_state?: string;
    },
  ): void {
    const instance = this.getInstance(instanceId);
    const now = new Date();

    // Добавляем в историю статусов
    const statusHistory = instance?.status_history || [];
    statusHistory.push({
      status,
      timestamp: now,
      source: options?.source,
      message: options?.message,
    });

    // Ограничиваем размер истории
    if (statusHistory.length > this.MAX_HISTORY_ITEMS) {
      statusHistory.splice(0, statusHistory.length - this.MAX_HISTORY_ITEMS);
    }

    // Обновляем совместимые статусы
    let auth_status: InstanceMemoryData['auth_status'] = 'pending';
    let status_instance: InstanceMemoryData['status_instance'] = 'creating';
    let is_ready_for_messages = false;

    switch (status) {
      case 'start':
        auth_status = 'pending';
        status_instance = 'starting';
        break;
      case 'qr_ready':
        auth_status = 'qr_ready';
        status_instance = 'ready_for_auth';
        break;
      case 'api_key_ready':
        auth_status = 'pending';
        status_instance = 'running';
        break;
      case 'auth_success':
        auth_status = 'authenticated';
        status_instance = 'authenticated';
        break;
      case 'client_ready':
        auth_status = 'client_ready';
        status_instance = 'client_ready';
        is_ready_for_messages = true;
        break;
      case 'client_error':
        auth_status = 'failed';
        status_instance = 'error';
        break;
      case 'failed':
        auth_status = 'failed';
        status_instance = 'error';
        break;
    }

    this.setInstance(instanceId, {
      status,
      status_updated_at: now,
      status_history: statusHistory,
      auth_status,
      status_instance,
      is_ready_for_messages,
      whatsapp_state: options?.whatsapp_state,
      last_seen: now,
    });

    // Эмитим специфичные события
    this.emit('status_changed', instanceId, status, options);
    this.emit(`status_${status}`, instanceId, options);

    logger.info(`Instance ${instanceId} status changed to ${status}`, {
      source: options?.source,
      message: options?.message,
    });
  }

  /**
   * Сохраняет новый QR код с полной информацией
   */
  saveQRCode(
    instanceId: string,
    qrCode: string,
    options?: {
      qrText?: string;
      source?: string;
    },
  ): string {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.QR_EXPIRY_TIME);
    const qrUrl = `/api/v1/instances/${instanceId}/qr?t=${now.getTime()}`;

    const instance = this.getInstance(instanceId);

    // Сохраняем предыдущий QR в историю
    if (instance?.current_qr) {
      const qrHistory = instance.qr_history || [];
      qrHistory.push({
        code: instance.current_qr.code,
        generated_at: instance.current_qr.generated_at,
        expires_at: instance.current_qr.expires_at,
        was_scanned: false, // Если генерируется новый, значит предыдущий не был отсканирован
        scan_attempts: instance.current_qr.scan_attempts,
      });

      // Ограничиваем размер истории
      if (qrHistory.length > this.MAX_HISTORY_ITEMS) {
        qrHistory.splice(0, qrHistory.length - this.MAX_HISTORY_ITEMS);
      }
    }

    // Создаем новый QR
    const newQR = {
      code: qrCode,
      text: options?.qrText || qrCode,
      url: qrUrl,
      generated_at: now,
      expires_at: expiresAt,
      scan_attempts: 0,
    };

    this.setInstance(instanceId, {
      current_qr: newQR,
      qr_history: instance?.qr_history || [],
    });

    // Обновляем статус
    this.updateStatus(instanceId, 'qr_ready', {
      source: options?.source || 'whatsapp-client.ts:104',
      message: 'QR code generated. Scan it with your phone to log in.',
    });

    // Эмитим событие
    this.emit('qr_code_generated', instanceId, newQR);

    logger.info(`QR code saved for instance ${instanceId}`, {
      url: qrUrl,
      expires_at: expiresAt,
    });

    return qrUrl;
  }

  /**
   * Сохраняет API ключ в память и планирует сохранение в БД
   */
  saveApiKey(
    instanceId: string,
    apiKey: string,
    options?: {
      source?: string;
      saveToDb?: boolean;
    },
  ): void {
    const now = new Date();
    const instance = this.getInstance(instanceId);

    // Сохраняем предыдущий ключ в историю
    if (instance?.current_api_key) {
      const keyHistory = instance.api_key_history || [];
      keyHistory.push({
        key: instance.current_api_key.key,
        generated_at: instance.current_api_key.generated_at,
        saved_to_db_at: instance.current_api_key.saved_to_db_at,
        replaced_at: now,
        reason: 'new_key_generated',
      });

      // Ограничиваем размер истории
      if (keyHistory.length > this.MAX_HISTORY_ITEMS) {
        keyHistory.splice(0, keyHistory.length - this.MAX_HISTORY_ITEMS);
      }
    }

    // Создаем новый API ключ
    const newApiKey = {
      key: apiKey,
      generated_at: now,
      saved_to_db: options?.saveToDb || false,
      saved_to_db_at: options?.saveToDb ? now : undefined,
      usage_count: 0,
    };

    this.setInstance(instanceId, {
      current_api_key: newApiKey,
      api_key_history: instance?.api_key_history || [],
    });

    // Обновляем статус
    this.updateStatus(instanceId, 'api_key_ready', {
      source: options?.source || 'InstanceMemoryService:saveApiKey',
      message: `API key generated: ${apiKey.substring(0, 8)}...`,
    });

    // Планируем сохранение в БД если не было сохранено напрямую
    if (options?.saveToDb !== true && options?.saveToDb !== false) {
      this.scheduleApiKeySaveToDb(instanceId, apiKey);
    }

    // Эмитим событие
    this.emit('api_key_generated', instanceId, apiKey);

    logger.info(`API key saved for instance ${instanceId}`, {
      key_preview: `${apiKey.substring(0, 8)}...`,
      saved_to_db: options?.saveToDb || false,
      source: options?.source,
    });
  }

  /**
   * Отмечает успешную аутентификацию
   */
  markAuthenticationSuccess(
    instanceId: string,
    userInfo?: {
      phone_number?: string;
      account?: string;
      profile_picture_url?: string;
    },
  ): void {
    const now = new Date();

    this.setInstance(instanceId, {
      whatsapp_user: {
        ...userInfo,
        authenticated_at: now,
        last_seen_online: now,
      },
    });

    this.updateStatus(instanceId, 'auth_success', {
      source: 'whatsapp-client.ts:123',
      message: 'Authentication successful!',
    });

    // Отмечаем что текущий QR был успешно отсканирован
    const instance = this.getInstance(instanceId);
    if (instance?.current_qr) {
      this.setInstance(instanceId, {
        current_qr: {
          ...instance.current_qr,
          scan_attempts: instance.current_qr.scan_attempts + 1,
        },
      });
    }

    this.emit('authentication_success', instanceId, userInfo);
  }

  /**
   * Отмечает что клиент готов к работе
   */
  markClientReady(instanceId: string): void {
    this.updateStatus(instanceId, 'client_ready', {
      source: 'whatsapp-client.ts:113',
      message: 'Client is ready!',
    });

    const instance = this.getInstance(instanceId);
    this.setInstance(instanceId, {
      system_info: {
        ...instance?.system_info,
        uptime_start: new Date(),
        consecutive_failures: 0,
        restart_count: instance?.system_info?.restart_count || 0,
        health_check_count: instance?.system_info?.health_check_count || 0,
      },
    });

    this.emit('client_ready', instanceId);
  }

  /**
   * Регистрирует ошибку
   */
  registerError(
    instanceId: string,
    error: string,
    options?: {
      source?: string;
      stack?: string;
    },
  ): void {
    const now = new Date();
    const instance = this.getInstance(instanceId);

    const errorHistory = instance?.error_info?.error_history || [];
    errorHistory.push({
      error,
      timestamp: now,
      source: options?.source,
      stack: options?.stack,
    });

    // Ограничиваем размер истории ошибок
    if (errorHistory.length > this.MAX_HISTORY_ITEMS) {
      errorHistory.splice(0, errorHistory.length - this.MAX_HISTORY_ITEMS);
    }

    this.setInstance(instanceId, {
      error_info: {
        last_error: error,
        last_error_at: now,
        error_count: (instance?.error_info?.error_count || 0) + 1,
        error_history: errorHistory,
      },
      system_info: {
        ...instance?.system_info,
        consecutive_failures: (instance?.system_info?.consecutive_failures || 0) + 1,
        restart_count: instance?.system_info?.restart_count || 0,
        health_check_count: instance?.system_info?.health_check_count || 0,
      },
    });

    this.updateStatus(instanceId, 'failed', {
      source: options?.source,
      message: error,
    });

    this.emit('instance_error', instanceId, error, options);
  }

  /**
   * Получает текущий QR код
   */
  getCurrentQR(instanceId: string): InstanceMemoryData['current_qr'] | null {
    const instance = this.getInstance(instanceId);
    if (!instance?.current_qr) return null;

    // Проверяем не истек ли QR код
    if (new Date() > instance.current_qr.expires_at) {
      return null;
    }

    return instance.current_qr;
  }

  /**
   * Получает текущий API ключ
   */
  getCurrentApiKey(instanceId: string): string | null {
    const instance = this.getInstance(instanceId);
    return instance?.current_api_key?.key || null;
  }

  /**
   * Отмечает использование API ключа
   */
  markApiKeyUsage(instanceId: string): void {
    const instance = this.getInstance(instanceId);
    if (!instance?.current_api_key) return;

    const now = new Date();
    this.setInstance(instanceId, {
      current_api_key: {
        ...instance.current_api_key,
        last_use: now,
        first_use: instance.current_api_key.first_use || now,
        usage_count: instance.current_api_key.usage_count + 1,
      },
    });
  }

  /**
   * Планирует сохранение API ключа в БД
   */
  private scheduleApiKeySaveToDb(instanceId: string, apiKey: string): void {
    // Эмитим событие для DatabaseService
    this.emit('save_api_key_to_db', instanceId, apiKey);

    // Через 5 секунд проверяем что ключ сохранен
    setTimeout(() => {
      const instance = this.getInstance(instanceId);
      if (instance?.current_api_key && !instance.current_api_key.saved_to_db) {
        logger.warn(`API key for instance ${instanceId} was not saved to DB`);
      }
    }, 5000);
  }

  /**
   * Отмечает что API ключ сохранен в БД
   */
  markApiKeySavedToDb(instanceId: string): void {
    const instance = this.instances.get(instanceId);
    if (!instance?.current_api_key) {
      return;
    }

    instance.current_api_key.saved_to_db = true;
    instance.current_api_key.saved_to_db_at = new Date();
    instance.updated_at = new Date();

    logger.info(`API key marked as saved to DB for instance ${instanceId}`);
  }

  /**
   * Обновляет статистику сообщений
   */
  updateMessageStats(instanceId: string, type: 'sent' | 'received'): void {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return;
    }

    const now = new Date();

    if (type === 'sent') {
      instance.message_stats.sent_count++;
      instance.message_stats.daily_sent++;
      instance.message_stats.last_sent_at = now;
      instance.last_message_sent = now;
    } else {
      instance.message_stats.received_count++;
      instance.message_stats.daily_received++;
      instance.message_stats.last_received_at = now;
      instance.last_message_received = now;
    }

    instance.last_activity = now;
    instance.updated_at = now;

    logger.debug(`Message stats updated for instance ${instanceId}: ${type}`);
  }

  /**
   * Сброс дневной статистики
   */
  private startDailyResetInterval(): void {
    const now = new Date();
    const tomorrow = this.getNextDayStart();
    const msUntilTomorrow = tomorrow.getTime() - now.getTime();

    // Первый сброс в полночь
    setTimeout(() => {
      this.resetDailyStats();

      // Затем каждые 24 часа
      this.dailyResetInterval = setInterval(
        () => {
          this.resetDailyStats();
        },
        24 * 60 * 60 * 1000,
      );
    }, msUntilTomorrow);
  }

  private resetDailyStats(): void {
    const nextReset = this.getNextDayStart();

    for (const [instanceId, instance] of this.instances) {
      this.setInstance(instanceId, {
        message_stats: {
          ...instance.message_stats,
          daily_sent: 0,
          daily_received: 0,
          daily_reset_at: nextReset,
        },
      });
    }

    logger.info('Daily message statistics reset for all instances');
  }

  private getNextDayStart(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }

  /**
   * Получает данные инстанса из памяти
   */
  getInstance(instanceId: string): InstanceMemoryData | null {
    return this.instances.get(instanceId) || null;
  }

  /**
   * Получает все инстансы
   */
  getAllInstances(): InstanceMemoryData[] {
    return Array.from(this.instances.values());
  }

  /**
   * Получает инстансы по фильтрам
   */
  getInstancesByFilter(filter: {
    user_id?: string;
    provider?: string;
    status?: string;
    auth_status?: string;
    is_ready_for_messages?: boolean;
  }): InstanceMemoryData[] {
    return this.getAllInstances().filter(instance => {
      if (filter.user_id && instance.user_id !== filter.user_id) return false;
      if (filter.provider && instance.provider !== filter.provider) return false;
      if (filter.status && instance.status !== filter.status) return false;
      if (filter.auth_status && instance.auth_status !== filter.auth_status) return false;
      if (
        filter.is_ready_for_messages !== undefined &&
        instance.is_ready_for_messages !== filter.is_ready_for_messages
      )
        return false;
      return true;
    });
  }

  /**
   * Получает статистику по всем инстансам
   */
  getStats(): InstanceMemoryStats {
    const instances = this.getAllInstances();
    const now = new Date();

    let totalUptimeMs = 0;
    let uptimeCount = 0;
    let totalMessagesToday = 0;

    for (const instance of instances) {
      if (instance.system_info.uptime_start) {
        totalUptimeMs += now.getTime() - instance.system_info.uptime_start.getTime();
        uptimeCount++;
      }
      totalMessagesToday +=
        instance.message_stats.daily_sent + instance.message_stats.daily_received;
    }

    return {
      total_instances: instances.length,
      active_instances: instances.filter(i => i.status_service === 'active').length,
      authenticated_instances: instances.filter(i => i.status === 'client_ready').length,
      error_instances: instances.filter(i => i.status === 'failed').length,
      qr_pending_instances: instances.filter(i => i.status === 'qr_ready').length,
      memory_usage_mb: this.getMemoryUsageMB(),
      avg_uptime_hours: uptimeCount > 0 ? totalUptimeMs / uptimeCount / (1000 * 60 * 60) : 0,
      total_messages_today: totalMessagesToday,
    };
  }

  /**
   * Получает использование памяти сервисом
   */
  private getMemoryUsageMB(): number {
    const used = process.memoryUsage();
    return Math.round((used.heapUsed / 1024 / 1024) * 100) / 100;
  }

  /**
   * Удаляет инстанс из памяти
   */
  removeInstance(instanceId: string): boolean {
    const existed = this.instances.has(instanceId);
    this.instances.delete(instanceId);

    if (existed) {
      this.emit('instance_removed', instanceId);
      logger.debug(`Instance removed from memory: ${instanceId}`);
    }

    return existed;
  }

  /**
   * Очищает все данные
   */
  clear(): void {
    const count = this.instances.size;
    this.instances.clear();
    logger.info(`Cleared ${count} instances from memory`);
    this.emit('memory_cleared');
  }

  /**
   * Запускает периодическую очистку неактивных инстансов
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveInstances();
      this.forceMemoryCleanup();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Очищает неактивные инстансы
   */
  private cleanupInactiveInstances(): void {
    const now = new Date();
    const toRemove: string[] = [];

    for (const [instanceId, instance] of this.instances) {
      const lastActivity = instance.last_activity || instance.created_at;
      const inactiveTime = now.getTime() - lastActivity.getTime();

      if (inactiveTime > this.MAX_INACTIVE_TIME && instance.status_instance === 'stopped') {
        toRemove.push(instanceId);
      }
    }

    if (toRemove.length > 0) {
      logger.info(`Cleaning up ${toRemove.length} inactive instances from memory`);
      toRemove.forEach(id => this.removeInstance(id));
    }
  }

  /**
   * Принудительная очистка памяти при высоком давлении
   */
  private forceMemoryCleanup(): void {
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memoryUsage.heapTotal / 1024 / 1024;
    const memoryPressure = heapUsedMB / heapTotalMB;

    if (memoryPressure > this.MEMORY_PRESSURE_THRESHOLD) {
      logger.warn(`High memory pressure detected: ${(memoryPressure * 100).toFixed(1)}%`);

      // 1. Очищаем старые QR коды
      this.cleanupOldQrCodes();

      // 2. Очищаем старые истории статусов
      this.cleanupOldStatusHistory();

      // 3. Принудительно удаляем неактивные экземпляры
      this.forceCleanupInactiveInstances();

      // 4. Запускаем garbage collection если доступен
      if (global.gc) {
        global.gc();
        logger.info('Forced garbage collection completed');
      }

      // Логируем результат
      const newMemoryUsage = process.memoryUsage();
      const newHeapUsedMB = newMemoryUsage.heapUsed / 1024 / 1024;
      const freedMB = heapUsedMB - newHeapUsedMB;
      logger.info(`Memory cleanup freed ${freedMB.toFixed(1)}MB`);
    }
  }

  /**
   * Очистка старых QR кодов из истории
   */
  private cleanupOldQrCodes(): void {
    let cleanedCount = 0;

    for (const [instanceId, instance] of this.instances) {
      if (instance.qr_history && instance.qr_history.length > this.MAX_QR_HISTORY) {
        const oldLength = instance.qr_history.length;
        instance.qr_history = instance.qr_history
          .sort((a, b) => b.generated_at.getTime() - a.generated_at.getTime())
          .slice(0, this.MAX_QR_HISTORY);
        cleanedCount += oldLength - instance.qr_history.length;
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} old QR codes from memory`);
    }
  }

  /**
   * Очистка старых записей истории статусов
   */
  private cleanupOldStatusHistory(): void {
    let cleanedCount = 0;

    for (const [instanceId, instance] of this.instances) {
      if (instance.status_history && instance.status_history.length > this.MAX_HISTORY_ITEMS) {
        const oldLength = instance.status_history.length;
        instance.status_history = instance.status_history
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, this.MAX_HISTORY_ITEMS);
        cleanedCount += oldLength - instance.status_history.length;
      }

      // Также очищаем историю ошибок
      if (
        instance.error_info?.error_history &&
        instance.error_info.error_history.length > this.MAX_HISTORY_ITEMS
      ) {
        const oldLength = instance.error_info.error_history.length;
        instance.error_info.error_history = instance.error_info.error_history
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, this.MAX_HISTORY_ITEMS);
        cleanedCount += oldLength - instance.error_info.error_history.length;
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} old status/error history entries from memory`);
    }
  }

  /**
   * Более агрессивная очистка неактивных экземпляров
   */
  private forceCleanupInactiveInstances(): void {
    const now = new Date();
    const toRemove: string[] = [];

    for (const [instanceId, instance] of this.instances) {
      const lastActivity = instance.last_activity || instance.created_at;
      const inactiveTime = now.getTime() - lastActivity.getTime();

      // Более агрессивные условия очистки при высоком давлении памяти
      const shouldRemove =
        (inactiveTime > this.MAX_INACTIVE_TIME && instance.status_instance === 'stopped') ||
        (inactiveTime > 60 * 60 * 1000 && instance.status === 'failed') || // 1 час для failed
        (inactiveTime > 2 * 60 * 60 * 1000 && !instance.is_ready_for_messages) || // 2 часа для неготовых
        inactiveTime > 4 * 60 * 60 * 1000; // 4 часа для любых неактивных

      if (shouldRemove) {
        toRemove.push(instanceId);
      }
    }

    if (toRemove.length > 0) {
      logger.info(
        `Force cleaning up ${toRemove.length} inactive instances from memory due to memory pressure`,
      );
      toRemove.forEach(id => this.removeInstance(id));
    }
  }

  /**
   * Публичный метод для принудительной очистки памяти (для API)
   */
  public forceMemoryCleanupPublic(): {
    before: { instances: number; memory_mb: number; heap_used_mb: number };
    after: { instances: number; memory_mb: number; heap_used_mb: number };
    freed_instances: number;
    freed_memory_mb: number;
  } {
    const beforeStats = this.getStats();
    const beforeMemory = process.memoryUsage();

    // Принудительная очистка
    this.forceMemoryCleanup();

    const afterStats = this.getStats();
    const afterMemory = process.memoryUsage();

    return {
      before: {
        instances: beforeStats.total_instances,
        memory_mb: beforeStats.memory_usage_mb,
        heap_used_mb: Math.round(beforeMemory.heapUsed / 1024 / 1024),
      },
      after: {
        instances: afterStats.total_instances,
        memory_mb: afterStats.memory_usage_mb,
        heap_used_mb: Math.round(afterMemory.heapUsed / 1024 / 1024),
      },
      freed_instances: beforeStats.total_instances - afterStats.total_instances,
      freed_memory_mb: Math.round((beforeMemory.heapUsed - afterMemory.heapUsed) / 1024 / 1024),
    };
  }

  /**
   * Уничтожает сервис и очищает все интервалы
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.dailyResetInterval) {
      clearInterval(this.dailyResetInterval);
    }
    this.clear();
    this.removeAllListeners();
  }

  /**
   * Получает историю статусов инстанса
   */
  getStatusHistory(
    instanceId: string,
    limit: number = 50,
  ): Array<{
    status: string;
    timestamp: Date;
    source?: string;
    message?: string;
  }> {
    const instance = this.getInstance(instanceId);
    if (!instance?.status_history) return [];

    // Возвращаем последние записи (сортируем по времени в убывающем порядке)
    return instance.status_history
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Получает историю QR кодов инстанса
   */
  getQRHistory(
    instanceId: string,
    limit: number = 20,
  ): Array<{
    code: string;
    generated_at: Date;
    expires_at: Date;
    was_scanned: boolean;
    scan_attempts: number;
  }> {
    const instance = this.getInstance(instanceId);
    if (!instance?.qr_history) return [];

    // Возвращаем последние записи (сортируем по времени в убывающем порядке)
    return instance.qr_history
      .sort((a, b) => b.generated_at.getTime() - a.generated_at.getTime())
      .slice(0, limit);
  }

  /**
   * Получает историю API ключей инстанса (без самих ключей для безопасности)
   */
  getApiKeyHistory(
    instanceId: string,
    limit: number = 20,
  ): Array<{
    key_preview: string;
    generated_at: Date;
    saved_to_db_at?: Date;
    replaced_at?: Date;
    reason?: string;
  }> {
    const instance = this.getInstance(instanceId);
    if (!instance?.api_key_history) return [];

    // Возвращаем последние записи с замаскированными ключами
    return instance.api_key_history
      .sort((a, b) => b.generated_at.getTime() - a.generated_at.getTime())
      .slice(0, limit)
      .map(entry => ({
        key_preview: entry.key.substring(0, 8) + '...',
        generated_at: entry.generated_at,
        saved_to_db_at: entry.saved_to_db_at,
        replaced_at: entry.replaced_at,
        reason: entry.reason,
      }));
  }

  /**
   * Получает статистику активности инстанса
   */
  getActivityStats(instanceId: string): {
    message_stats: InstanceMemoryData['message_stats'];
    last_activity?: Date;
    last_seen?: Date;
    uptime_hours?: number;
    health_status: 'healthy' | 'warning' | 'error';
    consecutive_failures: number;
  } | null {
    const instance = this.getInstance(instanceId);
    if (!instance) return null;

    const now = new Date();
    const uptimeHours = instance.system_info?.uptime_start
      ? (now.getTime() - instance.system_info.uptime_start.getTime()) / (1000 * 60 * 60)
      : 0;

    // Определяем статус здоровья
    let healthStatus: 'healthy' | 'warning' | 'error' = 'healthy';
    const consecutiveFailures = instance.system_info?.consecutive_failures || 0;

    if (consecutiveFailures > 5) {
      healthStatus = 'error';
    } else if (consecutiveFailures > 2) {
      healthStatus = 'warning';
    }

    return {
      message_stats: instance.message_stats,
      last_activity: instance.last_activity,
      last_seen: instance.last_seen,
      uptime_hours: uptimeHours,
      health_status: healthStatus,
      consecutive_failures: consecutiveFailures,
    };
  }

  /**
   * Получает список ошибок инстанса
   */
  getErrors(
    instanceId: string,
    limit: number = 50,
  ): Array<{
    error: string;
    timestamp: Date;
    source?: string;
    stack?: string;
  }> {
    const instance = this.getInstance(instanceId);
    if (!instance?.error_info?.error_history) return [];

    // Возвращаем последние ошибки (сортируем по времени в убывающем порядке)
    return instance.error_info.error_history
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Очищает список ошибок инстанса
   */
  clearErrors(instanceId: string): void {
    const instance = this.getInstance(instanceId);
    if (!instance) return;

    this.setInstance(instanceId, {
      error_info: {
        ...instance.error_info,
        error_history: [],
        error_count: 0,
        last_error: undefined,
        last_error_at: undefined,
      },
      system_info: {
        ...instance.system_info,
        consecutive_failures: 0,
      },
    });

    logger.info(`Cleared errors for instance ${instanceId}`);
  }

  private async updateApiKeyInDatabase(
    instanceId: string,
    apiKey: string,
    source?: string,
  ): Promise<void> {
    try {
      const pool = createPool();
      const config = getDatabaseConfig();

      await pool.query(
        `UPDATE ${config.schema}.message_instances 
         SET api_key = $1, updated_at = NOW() 
         WHERE id = $2`,
        [apiKey, instanceId],
      );

      logger.info(`API key updated in database for instance ${instanceId}`, {
        source: source || 'InstanceMemoryService:updateApiKeyInDatabase',
      });

      // Отмечаем что ключ сохранен в БД
      this.markApiKeySavedToDb(instanceId);
    } catch (error) {
      logger.error(`Failed to update API key in database for instance ${instanceId}:`, error);
    }
  }
}

// Singleton instance
export const instanceMemoryService = new InstanceMemoryService();
