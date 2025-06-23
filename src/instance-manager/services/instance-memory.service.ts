import logger from '../../logger';
import { EventEmitter } from 'events';
import { createPool, getDatabaseConfig } from '../../config/database.config';

export interface InstanceMemoryData {
  // Основная информация
  instance_id: string;
  user_id: string;
  provider: string;
  type_instance: string[];

  // Статус
  status:
    | 'initializing'
    | 'start'
    | 'qr_ready'
    | 'auth_success'
    | 'client_ready'
    | 'client_error'
    | 'stopped'
    | 'error';
  auth_status: 'pending' | 'qr_ready' | 'authenticated' | 'client_ready' | 'failed';
  whatsapp_state?: string;

  // QR код
  qr_code?: {
    code: string;
    text?: string;
    generated_at: Date;
    expires_at: Date;
    source?: string;
  };

  // API ключ (всегда равен instance_id)
  api_key: string;
  api_key_usage_count: number;
  api_key_last_use?: Date;
  api_key_first_use?: Date;

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
  private readonly CLEANUP_INTERVAL = 2 * 60 * 1000; // 2 минуты
  private readonly MAX_INACTIVE_TIME = 15 * 60 * 1000; // 15 минут
  private readonly QR_EXPIRY_TIME = 30 * 1000; // 30 секунд
  private readonly MAX_HISTORY_ITEMS = 20; // 20 записей

  constructor() {
    super();
    this.startCleanupInterval();
    this.startDailyResetInterval();
    logger.info('InstanceMemoryService initialized');
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

      // Статус
      status: data.status || existing?.status || 'initializing',
      auth_status: data.auth_status || existing?.auth_status || 'pending',
      whatsapp_state: data.whatsapp_state || existing?.whatsapp_state,

      // QR код
      qr_code: data.qr_code || existing?.qr_code,

      // API ключ
      api_key: data.api_key || existing?.api_key || instanceId,
      api_key_usage_count: data.api_key_usage_count || existing?.api_key_usage_count || 0,
      api_key_last_use: data.api_key_last_use || existing?.api_key_last_use,
      api_key_first_use: data.api_key_first_use || existing?.api_key_first_use,

      // Активность
      is_ready_for_messages: data.is_ready_for_messages ?? existing?.is_ready_for_messages ?? false,
      last_seen: data.last_seen || existing?.last_seen,
      last_activity: data.last_activity || existing?.last_activity,
      last_message_sent: data.last_message_sent || existing?.last_message_sent,
      last_message_received: data.last_message_received || existing?.last_message_received,

      // Порты
      ports: data.ports || existing?.ports,

      // WhatsApp пользователь
      whatsapp_user: data.whatsapp_user || existing?.whatsapp_user,

      // Ресурсы
      resources: data.resources || existing?.resources,

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
    };

    this.instances.set(instanceId, instanceData);

    // Эмитим событие обновления
    this.emit('instance_updated', instanceId, instanceData);

    return instanceData;
  }

  /**
   * Сохраняет API ключ в память
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
    
    this.setInstance(instanceId, {
      api_key: apiKey,
      api_key_first_use: now,
    });

    // Планируем сохранение в БД если требуется
    if (options?.saveToDb !== false) {
      this.emit('save_api_key_to_db', instanceId, apiKey);
    }

    logger.info(`API key saved for instance ${instanceId}`, {
      key_preview: `${apiKey.substring(0, 8)}...`,
      source: options?.source,
    });
  }

  /**
   * Отмечает что API ключ сохранен в БД (для совместимости)
   */
  markApiKeySavedToDb(instanceId: string): void {
    logger.debug(`API key marked as saved to DB for instance ${instanceId}`);
  }

  /**
   * Обновляет статус инстанса
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
    const now = new Date();

    // Обновляем совместимые статусы
    let auth_status: InstanceMemoryData['auth_status'] = 'pending';
    let is_ready_for_messages = false;

    switch (status) {
      case 'start':
        auth_status = 'pending';
        break;
      case 'qr_ready':
        auth_status = 'qr_ready';
        break;
      case 'auth_success':
        auth_status = 'authenticated';
        break;
      case 'client_ready':
        auth_status = 'client_ready';
        is_ready_for_messages = true;
        break;
      case 'client_error':
        auth_status = 'failed';
        break;
      case 'stopped':
        auth_status = 'failed';
        break;
      case 'error':
        auth_status = 'failed';
        break;
    }

    this.setInstance(instanceId, {
      status,
      auth_status,
      whatsapp_state: options?.whatsapp_state,
      last_seen: now,
      is_ready_for_messages,
    });

    // Эмитим специфичные события
    this.emit('status_changed', instanceId, status, options);

    logger.info(`Instance ${instanceId} status changed to ${status}`, {
      source: options?.source,
      message: options?.message,
    });
  }

  /**
   * Получает данные инстанса из памяти
   */
  getInstance(instanceId: string): InstanceMemoryData | null {
    return this.instances.get(instanceId) || null;
  }

  /**
   * Получает текущий API ключ
   */
  getCurrentApiKey(instanceId: string): string | null {
    const instance = this.getInstance(instanceId);
    return instance?.api_key || null;
  }

  /**
   * Отмечает использование API ключа
   */
  markApiKeyUsage(instanceId: string): void {
    const instance = this.getInstance(instanceId);
    if (!instance?.api_key) return;

    const now = new Date();
    this.setInstance(instanceId, {
      api_key_usage_count: instance.api_key_usage_count + 1,
      api_key_last_use: now,
      api_key_first_use: instance.api_key_first_use || now,
    });
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

    this.updateStatus(instanceId, 'stopped', {
      source: options?.source,
      message: error,
    });

    this.emit('instance_error', instanceId, error, options);
  }

  private getNextDayStart(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }

  private startCleanupInterval(): void {
    // Stub implementation
  }

  private startDailyResetInterval(): void {
    // Stub implementation
  }

  /**
   * Обновляет статистику сообщений
   */
  updateMessageStats(instanceId: string, type: 'sent' | 'received'): void {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      logger.warn(`Instance ${instanceId} not found for message stats update`);
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

    this.instances.set(instanceId, instance);
    this.emit('messageStatsUpdated', { instanceId, type, stats: instance.message_stats });
  }

  /**
   * Получает общую статистику всех инстансов
   */
  getStats(): InstanceMemoryStats {
    const instances = Array.from(this.instances.values());
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return {
      total_instances: instances.length,
      active_instances: instances.filter(i => i.status === 'client_ready' || i.status === 'auth_success').length,
      authenticated_instances: instances.filter(i => i.auth_status === 'authenticated' || i.auth_status === 'client_ready').length,
      error_instances: instances.filter(i => i.status === 'error' || i.status === 'client_error').length,
      qr_pending_instances: instances.filter(i => i.status === 'qr_ready').length,
      memory_usage_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      avg_uptime_hours: instances.reduce((sum, i) => {
        const uptime = i.system_info.uptime_start ? 
          (now.getTime() - i.system_info.uptime_start.getTime()) / (1000 * 60 * 60) : 0;
        return sum + uptime;
      }, 0) / Math.max(instances.length, 1),
      total_messages_today: instances.reduce((sum, i) => sum + i.message_stats.daily_sent + i.message_stats.daily_received, 0)
    };
  }

  /**
   * Получает историю статусов инстанса
   */
  getStatusHistory(instanceId: string, _limit: number = 10): Array<{
    status: string;
    timestamp: Date;
    source?: string;
    message?: string;
  }> {
    // Поскольку мы не храним историю статусов в памяти, возвращаем текущий статус
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return [];
    }

    return [{
      status: instance.status,
      timestamp: instance.updated_at,
      source: 'memory',
      message: `Current status: ${instance.status}`
    }];
  }

  /**
   * Получает историю QR кодов
   */
  getQRHistory(instanceId: string, _limit: number = 10): Array<{
    qr_code: string;
    qr_text?: string;
    generated_at: Date;
    expires_at: Date;
    source?: string;
  }> {
    const instance = this.instances.get(instanceId);
    if (!instance || !instance.qr_code) {
      return [];
    }

    return [{
      qr_code: instance.qr_code.code,
      qr_text: instance.qr_code.text,
      generated_at: instance.qr_code.generated_at,
      expires_at: instance.qr_code.expires_at,
      source: instance.qr_code.source
    }];
  }

  /**
   * Получает историю API ключей (теперь всегда возвращает instance_id)
   */
  getApiKeyHistory(instanceId: string, _limit: number = 10): Array<{
    api_key: string;
    created_at: Date;
    usage_count: number;
    last_used_at?: Date;
  }> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return [];
    }

    return [{
      api_key: instance.api_key,
      created_at: instance.created_at,
      usage_count: instance.api_key_usage_count,
      last_used_at: instance.api_key_last_use
    }];
  }

  /**
   * Получает текущий QR код
   */
  getCurrentQR(instanceId: string): {
    qr_code: string;
    qr_text?: string;
    generated_at: Date;
    expires_at: Date;
    source?: string;
  } | null {
    const instance = this.instances.get(instanceId);
    if (!instance || !instance.qr_code) {
      return null;
    }

    // Проверяем, не истек ли QR код
    if (instance.qr_code.expires_at < new Date()) {
      return null;
    }

    return {
      qr_code: instance.qr_code.code,
      qr_text: instance.qr_code.text,
      generated_at: instance.qr_code.generated_at,
      expires_at: instance.qr_code.expires_at,
      source: instance.qr_code.source
    };
  }

  /**
   * Получает статистику активности инстанса
   */
  getActivityStats(instanceId: string): {
    uptime_hours: number;
    messages_sent_today: number;
    messages_received_today: number;
    last_activity?: Date;
    health_score: number;
  } | null {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return null;
    }

    const now = new Date();
    const uptimeHours = instance.system_info.uptime_start ? 
      (now.getTime() - instance.system_info.uptime_start.getTime()) / (1000 * 60 * 60) : 0;

    // Простой алгоритм расчета здоровья (0-100)
    let healthScore = 100;
    if (instance.status === 'error' || instance.status === 'client_error') healthScore -= 50;
    if (instance.system_info.consecutive_failures > 0) healthScore -= instance.system_info.consecutive_failures * 10;
    if (instance.error_info && instance.error_info.error_count > 0) healthScore -= Math.min(instance.error_info.error_count * 5, 30);
    healthScore = Math.max(0, healthScore);

    return {
      uptime_hours: uptimeHours,
      messages_sent_today: instance.message_stats.daily_sent,
      messages_received_today: instance.message_stats.daily_received,
      last_activity: instance.last_activity,
      health_score: healthScore
    };
  }

  /**
   * Получает ошибки инстанса
   */
  getErrors(instanceId: string, limit: number = 10): Array<{
    error: string;
    timestamp: Date;
    source?: string;
    stack?: string;
  }> {
    const instance = this.instances.get(instanceId);
    if (!instance || !instance.error_info) {
      return [];
    }

    return instance.error_info.error_history
      .slice(-limit)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Очищает ошибки инстанса
   */
  clearErrors(instanceId: string): void {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return;
    }

    if (instance.error_info) {
      instance.error_info.error_count = 0;
      instance.error_info.error_history = [];
      instance.error_info.last_error = undefined;
      instance.error_info.last_error_at = undefined;
    }

    instance.system_info.consecutive_failures = 0;
    instance.updated_at = new Date();

    this.instances.set(instanceId, instance);
    this.emit('errorsCleared', { instanceId });
  }

  /**
   * Принудительная очистка памяти (публичный метод)
   */
  forceMemoryCleanupPublic(): {
    cleaned_instances: number;
    total_instances: number;
    memory_before_mb: number;
    memory_after_mb: number;
  } {
    const memoryBefore = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    const totalBefore = this.instances.size;

    this.forceMemoryCleanup();

    const memoryAfter = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    const totalAfter = this.instances.size;

    return {
      cleaned_instances: totalBefore - totalAfter,
      total_instances: totalAfter,
      memory_before_mb: memoryBefore,
      memory_after_mb: memoryAfter
    };
  }

  /**
   * Сохраняет QR код
   */
  saveQRCode(instanceId: string, qrCode: string, options?: {
    text?: string;
    source?: string;
    expirySeconds?: number;
  }): void {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      logger.warn(`Instance ${instanceId} not found for QR code save`);
      return;
    }

    const now = new Date();
    const expiryTime = new Date(now.getTime() + (options?.expirySeconds || 30) * 1000);

    instance.qr_code = {
      code: qrCode,
      text: options?.text,
      generated_at: now,
      expires_at: expiryTime,
      source: options?.source
    };

    instance.updated_at = now;
    this.instances.set(instanceId, instance);

    this.emit('qrCodeSaved', { instanceId, qrCode, expiresAt: expiryTime });
  }

  /**
   * Отмечает клиент как готовый
   */
  markClientReady(instanceId: string): void {
    this.updateStatus(instanceId, 'client_ready', {
      source: 'client',
      message: 'Client is ready for messages'
    });

    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.is_ready_for_messages = true;
      instance.auth_status = 'client_ready';
      instance.system_info.uptime_start = instance.system_info.uptime_start || new Date();
      this.instances.set(instanceId, instance);
    }
  }

  /**
   * Отмечает успешную аутентификацию
   */
  markAuthenticationSuccess(instanceId: string, options?: {
    phone_number?: string;
    account?: string;
    profile_picture_url?: string;
  }): void {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      logger.warn(`Instance ${instanceId} not found for auth success`);
      return;
    }

    const now = new Date();
    
    instance.auth_status = 'authenticated';
    instance.whatsapp_user = {
      ...instance.whatsapp_user,
      ...options,
      authenticated_at: now,
      last_seen_online: now
    };

    instance.updated_at = now;
    this.instances.set(instanceId, instance);

    this.emit('authenticationSuccess', { instanceId, user: instance.whatsapp_user });
  }

  /**
   * Принудительная очистка памяти (приватный метод)
   */
  private forceMemoryCleanup(): void {
    const now = new Date();
    const instancesToRemove: string[] = [];

    for (const [instanceId, instance] of this.instances.entries()) {
      // Удаляем неактивные инстансы
      const lastActivity = instance.last_activity || instance.updated_at;
      const inactiveTime = now.getTime() - lastActivity.getTime();
      
      if (inactiveTime > this.MAX_INACTIVE_TIME && 
          (instance.status === 'stopped' || instance.status === 'error')) {
        instancesToRemove.push(instanceId);
      }
    }

    // Удаляем найденные инстансы
    instancesToRemove.forEach(instanceId => {
      this.instances.delete(instanceId);
      logger.info(`Cleaned up inactive instance: ${instanceId}`);
    });

    // Принудительная сборка мусора
    if (global.gc) {
      global.gc();
    }
  }
}

// Экспортируем singleton
export const instanceMemoryService = new InstanceMemoryService(); 