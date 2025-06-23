export interface MessageInstance {
  id: string; // UUID
  user_id: string; // ID пользователя
  provider: string; // whatsappweb, telegram
  type_instance: string[]; // ['api'] или ['mcp'] или ['api', 'mcp']
  port_api?: number; // Назначается при создании
  port_mcp?: number; // Назначается при создании
  api_key?: string; // Всегда равен instance.id
  token?: string; // Bot token для Telegram
  api_key_generated_at?: Date; // Время генерации API ключа
  last_qr_generated_at?: Date; // Время последнего QR кода
  api_webhook_schema: object; // По умолчанию {}
  mcp_schema: object; // По умолчанию {}
  agent_id?: string; // ID агента
  agno_enable?: boolean; // Включение Agno (по умолчанию true)
  stream?: boolean; // Поддержка стриминга (по умолчанию false)
  created_at?: Date;
  updated_at?: Date;
  auth_status?: string; // Статус аутентификации (по умолчанию 'pending')
  account?: string; // Информация об аккаунте (номер телефона для WhatsApp, имя бота для Telegram)
  whatsapp_state?: string; // Состояние WhatsApp

  // Дополнительные поля для интеграции с оперативной памятью
  last_activity_at?: Date; // Время последней активности
  message_stats?: object; // Статистика сообщений в формате JSONB
}

export interface InstanceRuntimeInfo {
  // Docker статусы
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

  // WhatsApp статусы
  auth_status: 'pending' | 'qr_ready' | 'authenticated' | 'client_ready' | 'failed';
  qr_code?: string; // base64 QR-код
  qr_code_url?: string; // URL для получения QR-кода

  // Ресурсы (из Docker stats)
  use_memory: string; // "256MB"
  use_cpu: string; // "15%"

  // Автогенерируемые имена
  display_name: string; // whatsappweb_api
  api_webhook_name: string; // webhook-{instance_id}
  mcp_name: string; // mcp-{instance_id}

  // Docker информация
  docker_services: string[]; // ['wweb-{id}-api', 'wweb-{id}-mcp']
  compose_path: string; // composes/docker-compose-{id}.yml
}

export interface Decision {
  action: 'create' | 'update' | 'recreate' | 'start' | 'stop' | 'no_change';
  reason: string;
}

export interface ProcessInstanceRequest {
  force_recreate?: boolean;
}

export interface ProcessInstanceResponse {
  success: boolean;
  instance_id: string;
  action: string;
  details: {
    display_name: string;
    ports: {
      api?: number;
      mcp?: number;
    };
    api_key?: string;
    auth_status: string;
    status_check_url: string;
  };
  message: string;
}

export interface AuthStatusResponse {
  auth_status: string;
  whatsapp_state?: string;
  phone_number?: string;
  account?: string;
  is_ready_for_messages?: boolean;
  last_seen?: string;
}

export interface QRCodeResponse {
  qr_code: string;
  qr_code_text?: string;
  auth_status: string;
  expires_in?: number;
}

export interface CredentialsResponse {
  api_key: string;
  api_url: string;
  mcp_url?: string;
}

export interface ServerResourcesResponse {
  server: {
    cpu_usage: string;
    memory_usage: string;
    disk_usage: string;
    uptime: string;
  };
  docker: {
    total_containers: number;
    running_containers: number;
    stopped_containers: number;
  };
  instances: {
    total: number;
    running: number;
    stopped: number;
  };
}

export interface InstanceResourceInfo {
  instance_id: string;
  display_name: string;
  cpu_usage: string;
  memory_usage: string;
  status: string;
}
