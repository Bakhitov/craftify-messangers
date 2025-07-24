логи ватсап 
 *  Выполнение задачи: docker logs --tail 1000 -f 68f90fa59533814ae87b4f57193f6684e37687ac364b6b717b59f9617cef64ba 

2025-07-24 13:37:26:3726 info: InstanceMemoryService initialized
2025-07-24 13:37:27:3727 info: Database initialized successfully
2025-07-24 13:37:27:3727 info: Message storage service initialized
2025-07-24 13:37:27:3727 info: Starting WhatsApp Web REST API...
2025-07-24 13:37:27:3727 info: Using Instance ID: bcd1f4af-e733-4255-bf7f-acce0bacd06e (from env: true)
2025-07-24 13:37:27:3727 info: Instance bcd1f4af-e733-4255-bf7f-acce0bacd06e status changed to start {
  source: 'main.ts:startWhatsAppApiServer',
  message: 'Starting WhatsApp API server'
}
2025-07-24 13:37:27:3727 debug: Checking for WEBHOOK_CONFIG environment variable...
2025-07-24 13:37:27:3727 debug: No WEBHOOK_CONFIG found in environment variables
2025-07-24 13:37:27:3727 info: Trying to load webhook config from database for instance bcd1f4af-e733-4255-bf7f-acce0bacd06e
2025-07-24 13:37:27:3727 debug: Database config: schema=public
2025-07-24 13:37:27:3727 debug: Executing query: SELECT api_webhook_schema FROM public.message_instances WHERE id = $1 with params: [bcd1f4af-e733-4255-bf7f-acce0bacd06e]
2025-07-24 13:37:27:3727 debug: Query result rows: 1, first row: {"api_webhook_schema":{}}
2025-07-24 13:37:27:3727 debug: Full webhook config from database: {}
2025-07-24 13:37:27:3727 warn: Invalid webhook config from database: missing required 'url' field
2025-07-24 13:37:27:3727 info: No webhook config found, webhooks will not be used
2025-07-24 13:37:27:3727 debug: Checking for webhook.json in current directory: /project/webhook.json
2025-07-24 13:37:27:3727 info: Loading webhook config from: /project/webhook.json
2025-07-24 13:37:27:3727 error: Error reading webhook.json from /project/webhook.json: EISDIR: illegal operation on a directory, read
2025-07-24 13:37:28:3728 debug: Checking for webhook.json in auth data path: /wwebjs_auth/webhook.json
2025-07-24 13:37:28:3728 debug: webhook.json not found in auth data path
2025-07-24 13:37:28:3728 debug: No webhook config found
2025-07-24 13:37:28:3728 debug: WhatsApp client configuration {
  authDataPath: '/wwebjs_auth',
  mediaStoragePath: './wwebjs_media',
  authStrategy: 'local',
  dockerContainer: true,
  instanceId: 'bcd1f4af-e733-4255-bf7f-acce0bacd06e',
  hasWebhookConfig: false
}
2025-07-24 13:37:28:3728 debug: AgnoIntegrationService initialized {
  baseUrl: 'http://host.docker.internal:8000',
  timeout: 10000,
  enabled: true
}
2025-07-24 13:37:28:3728 debug: No webhook configuration provided in config, will try to load from file
2025-07-24 13:37:28:3728 debug: No webhook config found in file system either
2025-07-24 13:37:28:3728 warn: No webhook configuration found, webhook functionality will be disabled
2025-07-24 13:37:47:3747 info: QR code generated { action: 'qr_code_generated', qrLength: 239 }
2025-07-24 13:37:47:3747 info: Instance bcd1f4af-e733-4255-bf7f-acce0bacd06e status changed to qr_ready {
  source: 'whatsapp-client.ts:qr_event',
  message: 'QR code generated and ready for scanning'
}
2025-07-24 13:37:48:3748 info: QR code generated. Scan it with your phone to log in.
▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
█ ▄▄▄▄▄ █ ▄ █▄ ▄ █▀▀█ ▄▄█▄▀▄▄█▄ █ ▀▀▀▀▄▄█▄▄ █ ▀▄ ██ ▄▄▄▄▄ █
█ █   █ █ ▀▄▄ ▀█▄ █▄█▄█ ▄█▀██▀▄▀▀▄▀▀▄█▄▄▄▀█▀█▄ ▄ ██ █   █ █
█ █▄▄▄█ █▀▀▄ ▀▄ ▀██ ▀███▀   ▄▄▄ ▀█▄▀▀▀▄▄ █▄▄██▄▀▄██ █▄▄▄█ █
█▄▄▄▄▄▄▄█▄█ ▀ ▀ ▀ █ ▀ ▀▄▀▄█ █▄█ ▀▄█▄█ ▀ ▀▄█▄▀▄▀ █ █▄▄▄▄▄▄▄█
█▄ ▀▀▄▄▄██▀▀██▄▄▄▄▄▄▄▀▄▀▀▀▀▄    ▄ ▄█▀▄ ▀▄▀█▀▀ ▀▄▀ █▀▄█▄  ▄█
█▄▄ ▄▀▄▄  ▀█▀▀▄ ▄ ▄█▀▀▀█ █ █▀▀▄ ██▄▀▀█▄ ▀ ▀ ▀ ▄▀▄▀▀▄ █▄▄ ▀█
█ ▄ ▀▄▀▄▀█▄▄  ▀▀▀▄▀ █ ▄▄▄▀▀█▄▀▀█▀▄▀▄  █▀▄▀▄▀▀  █ ▀█ ▄▀▀ ▄██
█▄ ▀▄▀▄▄█▄▀▀ █ █ ▄▀ █▀█  ██▄▀  ▀▄██ ▀█ █  ▀ ▀▀▄ ▀▄ ▄█▄█▄▀▀█
█▄▀▀  ▄▄▀▀█▀█▀█▄ █▄ █▀ █▄▀▄█▄  ▀█ ██▄▄▀▀▄▀█  ▄▀█   ▀▀█▄ ▄██
█  █ █▄▄▀█▀█▀ ▀██▀█ █ ▀▄█▄█▄▀█▀▀█ ██▄ █▄▄▄█ ▄▄▄█▄▄   ▀▄▄ ▀█
█ ███ █▄▄█▀ ▄█▄ ▀▀▄▄▀  █▀▄██▄▀▄▀ ▄▄▄█▄█ ▄▀  █▄▀█▄▀   ▀▀▀▄▄█
█▀▄▀  ▄▄▀▀ █▄▄ ▄▄█▄▀▄█▄▀▄ ▀ ▀█▀▄▄█▄██▀█▄▄▄  ▄▀█▀█▀▄  ▄ █▀▀█
█ ▀ ▄▀▀▄▄ ▀█▀▀  ▀█▄▄ ▀▄█▄▀   ▀  ▀███▄ ▄▀ ██ █▄▀▄▀▀█ ▄██▀▀▀█
█ ▀▄▄ ▄▄▄  █▄██  ▀▀  ▀▄  █▀ ▄▄▄   ▀█ ▀█▀▄██▄▀█ █▄ ▄▄▄ ▄█▄▀█
█ ▄ ▄ █▄█ ▄ █ █ ▀▄▄▀▄ ▀█ ▀▄ █▄█ ▄▄▀▄▄ ▄ ▀█▀ █▄▀█▀ █▄█  ▀▀ █
█▀ ▀▀▄ ▄  ████▀▀▄▄▀▄▄▄▄▀██▀ ▄▄  ▀▄▄█▄▀█ ▄█▀█▄▀█▄  ▄▄▄ ▄█ ██
█ ▀  ▄▀▄█▀ ▀▄█▀▀▄▄▀▄▄  ▀▀ ▀█ █▀ █ ▄█▄▄▀▀█▀▀▀▀▄▄█▀ ▄ ▀███ ▀█
█  ▀██▄▄▄ ██▀▀▄██████▀▀ ▄█▄▀█ ▄█▀▀ █▄█ ▄▀ ▀ ▄▄▀▀▄▀▄▀▄ ▄█ ▀█
██ ▄▀██▄ █▄█▀█▀ ▄█ ▄▄▄▄█▄ ▀ ▄█▀ ▄▄ ▄  ▄▀ ▀ ▀▀  ▄▀▀ ▀▀█▄▄▀██
█ █▄▀█▀▄▀ ▀█  ██▀  ▄▀ ██▀█▄▀▀ ▀▀ ▄ ▀▄▀ ▄█▀ ▄█▄▀  ▀ █▀▄█▄▄▄█
█  ▀▄▀▀▄▀▀▄▄   █▀█▀▄▀▀▄▀ ▀ ▄▀▄ ▄▄ ▄█▀ ▄ ▄▀█▀█ ▀▄▀ ▀▄▀█▀  ▄█
█▄▀▀█ █▄██▀▄▀ ▀██▀▄█ █▀█▄▄▀▀ ▄█▀█▀  ▄ ▀█▀ █▄▀▄   ▀▄▀▀█▄█ ██
█ █▀ ▄▀▄  ██▄ ▀ ▀▄▀ ▀▀▄▄    ▀▄ ▄▀  ▄▀ ▄▀▄▀▄ █ █▄█▄▄▄ ▄ ▀▄▀█
█ ▀ ▀▀▄▄█▄█▀█  ▄█▄▄▀███▄▄█▄▄▀▀██ ▀▄█▀▀▄▄ ▄▀ ▄█▀▀ ▀▄██▀█▄ ██
███████▄▄ █▄█▀ ▀█▄█▄▄ ▄█▄▀█ ▄▄▄ █ ██▄ ▄▀▄█  ▀▄▀██ ▄▄▄ ▀  ██
█ ▄▄▄▄▄ █▀▀   ▀█▀█ ▄▀ ██▄▄▄ █▄█ ███▀  █▄▀▄ █▄█ ▀█ █▄█ ▀▄▀██
█ █   █ █▄▄█▀█▀█▀▀▄ ▀  █▀▄▀▄▄  ▄█  █ ▄▄  █  █ ▀▄▀▄▄ ▄ ▀▀▀▀█
█ █▄▄▄█ █▀▄ ▀ ▀▀▄█▄▀▄██▀▄ ▀▀▀▄▄ ▄██▄▄▀▄█▄███▀  ▀██▄▄█ ▀▄███
█▄▄▄▄▄▄▄█▄▄█▄▄▄▄██▄▄▄▄▄██▄█▄█▄█▄███▄▄▄█▄████▄▄█▄████▄█▄██▄█

2025-07-24 13:37:48:3748 info: Using instance ID as static API key: bcd1f4af-e733-4255-bf7f-acce0bacd06e
2025-07-24 13:37:48:3748 info: API key saved for instance bcd1f4af-e733-4255-bf7f-acce0bacd06e {
  key_preview: 'bcd1f4af...',
  source: 'main.ts:startWhatsAppApiServer'
}
2025-07-24 13:37:48:3748 info: Updating API key in database for WhatsApp instance: bcd1f4af-e733-4255-bf7f-acce0bacd06e
2025-07-24 13:37:48:3748 info: WhatsApp API key updated in database for instance: bcd1f4af-e733-4255-bf7f-acce0bacd06e
2025-07-24 13:37:48:3748 info: API key saved for instance bcd1f4af-e733-4255-bf7f-acce0bacd06e {
  key_preview: 'bcd1f4af...',
  source: 'main.ts:startWhatsAppApiServer'
}
2025-07-24 13:37:48:3748 info: WhatsApp API key: bcd1f4af-e733-4255-bf7f-acce0bacd06e
2025-07-24 13:37:48:3748 info: Instance ID: bcd1f4af-e733-4255-bf7f-acce0bacd06e
2025-07-24 13:37:48:3748 debug: AgnoIntegrationService initialized {
  baseUrl: 'http://host.docker.internal:8000',
  timeout: 10000,
  enabled: true
}
2025-07-24 13:37:48:3748 info: Health endpoint: http://localhost:3635/api/v1/health
2025-07-24 13:37:48:3748 info: API endpoints: http://localhost:3635/api/v1/*
2025-07-24 13:37:48:3748 info: WhatsApp Web Client API started successfully on port 3635
2025-07-24 13:37:54:3754 http: GET /api/v1/health
2025-07-24 13:37:54:3754 http: GET /api/v1/health 503 17ms
2025-07-24 13:38:42:3842 http: GET /api/v1/health
2025-07-24 13:38:42:3842 http: GET /api/v1/health 503 9ms
2025-07-24 13:38:42:3842 http: GET /api/v1/status
2025-07-24 13:38:42:3842 info: getStatus method called
2025-07-24 13:38:42:3842 info: Status check { hasClientInfo: false, hasQrCode: true }
2025-07-24 13:38:42:3842 info: QR code added to response
2025-07-24 13:38:42:3842 http: GET /api/v1/status 200 7ms
2025-07-24 13:38:47:3847 info: QR code generated { action: 'qr_code_generated', qrLength: 239 }
2025-07-24 13:38:47:3847 info: Instance bcd1f4af-e733-4255-bf7f-acce0bacd06e status changed to qr_ready {
  source: 'whatsapp-client.ts:qr_event',
  message: 'QR code generated and ready for scanning'
}
2025-07-24 13:38:47:3847 info: QR code generated. Scan it with your phone to log in.
▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
█ ▄▄▄▄▄ █▄█ ▀ ▄█▀▀█▄▄▀▄▄▄▄▄███ ▄ ▀▀█ █▄█▀▄  ▀▀ ▄ ██ ▄▄▄▄▄ █
█ █   █ █   █▄ █▄▄  ▄█▄▄   █▄█▀█ █ █  █▄█▄ ██▄▀▄ ██ █   █ █
█ █▄▄▄█ █▄█▄█▀█▄▀▀▄█ ▀█▀ █▀ ▄▄▄ ▀█▄██▄█ ▄▀█▀▄▄▄▀▄██ █▄▄▄█ █
█▄▄▄▄▄▄▄█▄█ ▀ ▀▄█▄█ ▀▄█ ▀▄█ █▄█ ▀ ▀ █ ▀▄█ █▄▀ █▄█ █▄▄▄▄▄▄▄█
█▄▄▄▄▀▀▄█▄▀▄▀▀ ▀ █▄█ ▄  ▀ ▀ ▄    █ ▄▀█▄▄  █ ████▄  █▀▄▄ █ █
█▄ ▀▀ ▀▄▀█▄▄▄▄ ▀▀▀ ██ ▄▄▄█▀▄▄   ▀▄▀ ██ █▄▀▀▄█▀▀ ▄ ▄██▄ ▄▄ █
█▄▀▄ ▄█▄█   ▄▄▄  ▄█▄ ▀█▄ █▄▄▀██▀▄█▀▄▄▄  █▀▄▄▄▀▀█ █ ▀███▄▀▄█
█▀▄███▀▄▄█ ██▀▀█▀ █▄▄▀█▀█▀▄▄▀▄▀▀██▄█ ▀███ ▀  ▀█▄▄▄▀▄█ ▀▀ ▀█
██▀▄█▄█▄ ███▄▄▄ ▄ ▀█▄▄▄█ ▄█▀▄▄▀▄▄▄▄▀▀█▀█▄████ ▀▀▀█▀█▀▀███▀█
█▀▄ █▄█▄▀▀█  ▀▀▀██▄▀ ▄█▀▄ █ █ ▀▀▀▄▀ █ █ ▀▀█▀▄█▀ ██ ▄▄▄██ ██
█ ▄ ▀▀▄▄  █▀▄▄ ██ ▄███▄▄▀█▀   ▄ ▄▀ █ ▀▀██▄ ▀▀▀█▄▄ █▄▄ ▀  ▀█
█▀  █▄ ▄█  ▄█▀█ ▀▄ ▀ ▄▀   █▀▄▄█▄▀▄▀▄▀▀▀█▀▄▄ ▀   ▀▀▄█▀█▄██ █
█▄▄▀█ ▄▄▄▄▀▀▀▄▀▄ █  █ ██ ██▀▀▀▄▄▄▄▄█ ▄▀ ▀█▀▄ █ ▄▄▄▀▀█▀▀█▄ █
█▄ ▄█ ▄▄▄   ▄█▄ ▀█▄▄▀▀█▄█▀▀ ▄▄▄ ▀  ▀██▄▀█▀▄▄ ██▀  ▄▄▄ ▀▀█▀█
███▀  █▄█ ▄▄▄█▀▀▀ █▄█▄▀▀▀▄▀ █▄█ █ █ ███▄▀▀▀▄▄ ▀▀  █▄█ █▄ ▄█
█ █ █▄▄▄ ▄▀ ▄▄▀█ ▀██▄  █▄▄      ▀   ▀▄ ▄  ▀▀▄█ ██    ▄█▄ ▀█
█▀▀ ██▀▄▄█▄ ▄▄█▄██▀█ █▄▄▀ █ ██▀▀▀█ ▄▄▀▀▄▀ ▄ ██▀██  █▄███  █
█ █  ▄ ▄ █ ▄█▀ ▄▄ ▀█▄▄▄▀█▀  ▄▄ █▀ █▄ █▄█▄▀█ █ ▄  ▀  ▄▄ █▄▄█
█  █ █▀▄█▄██▀▀▄▀██▄ ▀███ ▄▄▀██ █ ▀▀▄▄ ▀ ▀█▄███▀▄███  █  ▄██
█▄▄▄ ▀▄▄  ▀▄ ▀▄  ▄█   ▄▀▄▀█▀ ▄▄█ ▄▀█▀█▀▄▄▄█ ▄█ ▄██▀█    █▄█
██▀█▄█▄▄ ███ █▀▀▀▀ ▀ █▄█▀▄▀ ▀ ▀▀█▄▄▀ ██▄▄█▄▄▄▄▀  █  ▀▀ █▀ █
██▀█▀▄▀▄█▀▄██▄█▀▀▄█▄ ▀█ ██▀█▄▀▄ ██▄▀█▀█▀██▄▀▀ ▄██▄▀██ █▄ ▀█
█▀▀██ ▀▄███▀▄▀▄▀██▀▀█▄ █ ▀█ ██ ███▄█▀▀ █  ▄▀▀█ ▄█▀▀▀██▀▀ ▄█
█ ▀ ▀▀▄▄█▀  ▀ ▄█ ██▀▀▄▀▀ █ █▄ ▀█▄  ▄▀▀▀▄███ ▄▄  ▀▄  ▀▀ █▄▄█
███████▄█▀▄▄▀██ █▄   ▀████  ▄▄▄  ▀▄██ ▄▀▀██▄▄▀▀▄▀ ▄▄▄ █▄▀▄█
█ ▄▄▄▄▄ ██ ▄█▄ ██▄█  █▄▀▄▄█ █▄█ ▄▀▄█ ▄▄▄▄ ▄ █▄▀▄▄ █▄█ ▄ █▀█
█ █   █ █▀▄▀▄▀ ▀▀███ ▄ ▀ ▀  ▄   ▄  ▀ ▀█▄ ▀▀█  ▀   ▄▄▄  ▄▀██
█ █▄▄▄█ █ █▄▄▄▀   █ ▄▀▀▄█▀▀█▀▀█▀▄▀▀▀▄▀▄▀ ▀▄▄▀█▄▄▄▄▄ ▀█ ██▀█
█▄▄▄▄▄▄▄█▄▄█▄█▄▄█▄▄█▄█▄▄█████████▄██▄████▄█▄▄████▄█▄▄▄▄▄███

2025-07-24 13:39:07:397 info: QR code generated { action: 'qr_code_generated', qrLength: 239 }
2025-07-24 13:39:07:397 info: Instance bcd1f4af-e733-4255-bf7f-acce0bacd06e status changed to qr_ready {
  source: 'whatsapp-client.ts:qr_event',
  message: 'QR code generated and ready for scanning'
}
2025-07-24 13:39:07:397 info: QR code generated. Scan it with your phone to log in.
▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
█ ▄▄▄▄▄ █▄█ ▀ █▄▀▀▄█▀█▄▄  ▄███ ▄ ▀▀▀▄▀▄▀▀▄█ █  ▄ ██ ▄▄▄▄▄ █
█ █   █ █   █▄ ███  ██▄▄▀▀ █▄█▀█▀▄ █▀▀█▄█▄ █▀▄▀▄ ██ █   █ █
█ █▄▄▄█ █▄█▄▀▄█▄▀▀▄█ ▀█▀ █▀ ▄▄▄ ▀▀▄█▀ █ ▄ █▀▀ ▄▀▄██ █▄▄▄█ █
█▄▄▄▄▄▄▄█▄█▄█ ▀▄█▄█ ▀▄█ ▀▄█ █▄█ ▀ ▀ █ ▀▄█ █▄▀ █▄█ █▄▄▄▄▄▄▄█
█▄▄▄▄▀▀▄█ ▄▀ ▀ ▀ █▄█ ▄  ▀ █▄▄    █ ▄▀█▄▄  █ ████▀  █▀▄▄ █ █
█▄ ▀▀▀▀▄▄ ██▀▄ ▀▀▀ ██ ▄▄▄██▄    ▀▄▀▄██ ▀▄▀█ █▀█▄▄ ███  ▄▄ █
█▄▀█ ▄█▄▄▄▀▀▄▄▄  ▄█▄ ▀█▄ █▄▄▀▀█▀▄█ ▄▄▄█▀█▀█▄▄▀██ █ ▀██▀ ▀▄█
█ █▀▀█▀▄█▄ ██▀▀█▀ ▄█▄▀▄▀█▀▄▄ ██▀██ ▄▄██ █▄█▀ ▀▄███▀▄█ ▀▀ ▀█
█ ██▄▄█▄ ███▄▄▄ ▀ █▀█▄▀█ ▄█▀▄▄▀█▄▄▄ ▄▀ █▄▀▀▄ ▄▄ ▀█▀█▀▀██▀██
█▄ ▀▀ █▄▀▀█  ▀▀▀█▀▄▀███▀  █ █  ▀█ ▀ ▀▀▄   ▄▀ █▀ ██  ▄▄██▄██
█▀▀ ▀ █▄  █▀▀▄ ██ ▄███▄▄▀█▀   ▄ ██ █ █▀██▄ ▀▀██▄▄ ▄▄▄ ▀   █
█▀  █▀▀▄█▄▄█▀█▀ ▀▄ ▀ ▄▀   █▀▄▄█▄ ▄▀▄  ▀█ █▄ ▀▀  ▀▀▄▀▀█▄██ █
█▄▄▀█▄▄▄▀ ██   ▄ █  █ ██ ███▀▀▄▄▄▄▄█ ▄▀ ▀█▀▄ █ ▄▄▄▀ █▀▀█▄ █
█▄ ▄█ ▄▄▄ ▄ █ █ ▀█▄▄▀▀█▄█▀▄ ▄▄▄ ▀  ███▄▀█▀▄  ███  ▄▄▄ ▀▀█▀█
███▀  █▄█ ▀ ▄█▄ ▀ █▄█▄▀▀▀▄█ █▄█ █ ▀▀███▄▀▀ ▄▄ █ ▄ █▄█  ▄ ▄█
█▀▄▄█▄ ▄▄▄▀ ▄▄▀█ ▀  ▄  █▄▄▀     ▀   █▄█▄ ▄██ █▀▄█ ▄ ▄▄▀█ ▀█
█▄█  █▀▄▄▀▄ ▄▄█▄█▄▀█▀▄  ▄ █ █▄▀▀▀█ ▄ █ █▄ ▀  █▀██▀ █▄▄▄▄  █
█   ▄▄ ▄█▄ ▄█▀ ▄▄ ▀██▄▄▀▀▄  ▄  █▀▄█▄▄▄█▄ ██ ██▄  ▀  █  █▄▄█
██ █ █▀▄█▄███▀▄▀██▄ ▀███ ▄▄▀██▄▄▄▀▀▄▄▄▀ ▀█▄█ █▀▄███  █  ▄██
█▄▄▄ ▀▄▄  ▄▀█▀█  ▄█   ▄▀▄▀█▀ ▄▄▀▀▄▀█▀▄▀▄▄▄█ ▄▄ ▄██▀█    █▄█
██▀█▄▀▀▄ █▀█ ▀▀▄▀▀ ▀ █▄█▀▄▀ ▀ ▀▀█▄▄▀ ██▄▄█▄▄▄▄▀  █▀▄▀▀▄▀▀ █
██▀█▀  ▄█▀▄▀▀ █ ▀▄█▄ ▀█ ████▄▀▄ ██ ▀█▀████ █▀ ▄▀██▄██ ██ ▀█
█▀▀▀▄█▄▄▀█▀█▄▀ ███▀▀█▄ █ ▀█▄██ █████▀▀ █    ▀█ ▄▀██▄▄█▄▀ ▄█
█ ▀ ▀▀▄▄▄█  ▀ ▄█ █ ▄▀▄▀▄ █ ▀▄ ▀█▄ ▀███  ▀█▀▄▄ ▄▄ ▄ ▄▄▄ ▄▄▄█
███████▄▄▀▄▄▀██  ▄▄ ▀ ▀█▄▄  ▄▄▄  ▀▄█ ▄█▀▀█▄▄ █ ██ ▄▄▄ ███ █
█ ▄▄▄▄▄ ██ ▄█▄ █▄██ ▀█▄▀█ █ █▄█ ▄█▄█▀▄█▄▀▄▄ ▄▀ ██ █▄█ ▄ ▀▀█
█ █   █ █▀▄▀█  ▀▀███ ▄ ▀ ▀   ▄   ▄ ▀▄▀█▄▄█▀█▀ ▀ ▀ ▄▄▄▄ ▄ ▄█
█ █▄▄▄█ █ █ ▀▀ █  █ ▄▀▀▄█▀▀█▄██▀▄ ▀▀█▀▄▀▀▀▄▄▀█▄▄▄▄▄ ▀█ ██▀█
█▄▄▄▄▄▄▄█▄▄█▄▄███▄▄█▄█▄▄████▄▄███▄██▄████▄█▄▄████▄█▄▄▄▄▄███

2025-07-24 13:39:27:3927 info: QR code generated { action: 'qr_code_generated', qrLength: 239 }
2025-07-24 13:39:27:3927 info: Instance bcd1f4af-e733-4255-bf7f-acce0bacd06e status changed to qr_ready {
  source: 'whatsapp-client.ts:qr_event',
  message: 'QR code generated and ready for scanning'
}
2025-07-24 13:39:27:3927 info: QR code generated. Scan it with your phone to log in.
▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
█ ▄▄▄▄▄ █▄█ ▀ █▄▀▀█▄▄█▄█ ▄▄███ ▄ ▀ ▀  ▄█▄  ▄▄  ▄ ██ ▄▄▄▄▄ █
█ █   █ █   ▀  █▄▄  ▄▄▄▄   █▄█▀█ ▄ █  █▄██ █ █▀▄ ██ █   █ █
█ █▄▄▄█ █▄▀  ▄█▄▀▀▄█ ▀█▀ █▀ ▄▄▄  ▄▄██▄█ ▀▄█▀██▄▀▄██ █▄▄▄█ █
█▄▄▄▄▄▄▄█▄█ █ ▀▄█▄█ ▀▄█ ▀▄█ █▄█ ▀ ▀ █ ▀▄█ █▄▀ █▄█ █▄▄▄▄▄▄▄█
█▄▄▄▄██▄▀ ██▀█ ▀ █▄█ ▄  ▀ ▀▄▄    █ ▄▀█▄▄  █ ████   ██▄▄ █ █
█▄ ▀▀  ▄█▀▀▄██ ▀▀▀ ██ ▄▄▄███    ▀▄█ ██ █▄▀█▄█▀▀▄ ▀████ ▄▄ █
█▄▀▄█▄█▄██▀▀▄▄▄  ▄█▄ ▀█▄ ██▄█▀█▀▄█ ▄▄▄▀ █▀▄█▄▀▀███ ▀▄▀▀▄▀▄█
█ ██▄█▀▄██ ██▀▀█▀ ██▄▀█ █▀▄▄▀▄▀▀██ █ █▄ █▄ █ ▀▀▄▄█▀▄▄ ▄  ▀█
█ ▀▀▀▄█▄ ███▄▄▄ ▀▀▀▀██ █ ██▀▄▄▀▄▄▄█▀▄▀█▄ ▀▀█▄ ▀▀▀█▀█▀▀▄▄█▀█
█▄▀█▄ █▄▀▀█  ▀▀▀█▄▄▀█▀█▀▄██ █   ▀▄▀ ▀▄▄▀█ █▀▀█ ▀██▄▄▄▄██▀▀█
█▄▀ ▀▄▀▄  █▀██ ██ ▄███▄▄▀█▀   ▄ ▀▀ █ █▀█▄  ▀▀██▄▄ █▄▄ ▀ ▀ █
█▀  █▄█▄█▄▀▀ ▀█▀▀▄ ▀ ▄▀   █▀▄▄█▄▀▄▀▄▀▀▀█▀█▄ ▀   ▀▀ ▀██▄██ █
█▄▄▀█▄█▄ ▀▀█▄ █  █  █ ██ █▀▀▀▀▄▄▄▄▄█ ▄▀ ▀█▀▄ █ ▄█▄  ██▀█▄ █
█▄ ▄█ ▄▄▄   ▄▀ █▀█▄▄▀▀█▄█▀▀ ▄▄▄ ▀ ▄███▄▀█▀▄  █▀█▄ ▄▄▄ ▀▀█▀█
███ █ █▄█ ▀█▄███▀ █▄█▄▀▀▀▄█ █▄█ █ █▀██ █▀▀▄█▄  ▀▄ █▄█    ▄█
█▄▄▄█ ▄▄▄ ▀ ▄▄▀█ ▀▀█▄  ▀▄▄ ▄    ▀ ▀ ▀▄▄ ▄▄ ▀▄█  ▀  ▄▄  █ ▀█
█▄ ▄▄█▀▄▄▄▄ ▄▄█▄▄█▄▀▀▄▄ ▄ █ ▄█▀▀▀█ ▄ █ ▄▄▄▀ ██▄███ █▄▄█▄▄▄█
█▀▄▀▀▄ ▄   ▄█▀ ▄ ▄▀█ █▄▀▄█  █▄ ██ █▄████▀▀▄ █ ▄  ▀  ██ █▄ █
█  █ █▀▄█▄███▀▄▀██▄ ▀███ ▄▄▀███▄ █▀▄ ▄▀ █▀▄█▀█▀▄███  █  ▄▄█
█▄▄▄ ▀▄▄    █▄█  ▄█   ▄▀▄▀█▀ ▄▄▀ █▀█▀▄▀▄█▄█ ▄█ ▄██▀█    █▄█
██▀█▄▀█▄ █▄█▄██▄▀▀ ▀ █▄█▀▄▀ ▀ ▀▀█▄▄▀ ██▄▄█▄▄▄▄▀  ██ ▀▀▄▀▀ █
██▀█▀  ▄█▀▄█▄ ▀▄▀▄█▄ ▀█ ████▄▀▄ ██ ██▀▀▀██ █▀  ▀█ ▄▀█ ▄█ ▀█
█▀▀█▀ ▀▄   █▄▀▀███▀▀█▄ █ ▀▄▀██ █████▀▀▀█  ▀ ▀█▄█▀█▄ █▄▄█ ▄█
█ ▀ ▀▀▄▄██  ▀ ▄█ █▄▀▀▄▄▀ █ █▄ ▀█▄  ▄▀█▀▀▀█ █▄ ▄▀█▀ ▄ ▄█▄▄▄█
███████▄▄▀▄▄▀██  █▄▄  █▀▄▄  ▄▄▄  ▀▄█▄▄█▀ ██▄ ▀ █▀ ▄▄▄ ███ █
█ ▄▄▄▄▄ ██ ▄█▄ █ ▄█  ▀▄▀▄ █ █▄█  ▀▄█▄▀█▄███  █ ▄▀ █▄█ ▄ ▀██
█ █   █ █▀▄▀▀▀ ▀▀███ ▄ ▀ ▀         ▀█▀█▄ ▀▀█  ▀   ▄▄▄  ▄ ██
█ █▄▄▄█ █  ▀▄▄ █  █ ▄▀▀▄█▀▀██▀█▀▄▀▀▀▄▀▄▀▀ ▄▄▀▄▄▄▄▄▄ █▀ ██▀█
█▄▄▄▄▄▄▄█▄█▄█▄█▄█▄▄█▄█▄▄█████▄███▄██▄████▄█▄▄████▄█▄▄▄▄▄███

2025-07-24 13:39:47:3947 info: QR code generated { action: 'qr_code_generated', qrLength: 239 }
2025-07-24 13:39:47:3947 info: Instance bcd1f4af-e733-4255-bf7f-acce0bacd06e status changed to qr_ready {
  source: 'whatsapp-client.ts:qr_event',
  message: 'QR code generated and ready for scanning'
}
2025-07-24 13:39:47:3947 info: QR code generated. Scan it with your phone to log in.
▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
█ ▄▄▄▄▄ █ ▄ █▄ █ █▀▀▀ ▄█▄ ▀▄▄█▄ █ ▄█ █▀ ██▄▄▀ ▀▄ ██ ▄▄▄▄▄ █
█ █   █ █ ▀▄ ▄▀█▄ █▄███ ▄▄▀██▀▄▀▀█▀▀▄▄▄▄▄ █▀▀▄ ▄ ██ █   █ █
█ █▄▄▄█ █▀▀▄▄▀▄ ▀██ ▀███▀   ▄▄▄ ▀ ▄▀█ ▄▄██▄▄▄▀▄▀▄██ █▄▄▄█ █
█▄▄▄▄▄▄▄█▄▀ █▄▀ ▀ █ ▀ ▀▄▀▄█ █▄█ ▀▄█▄█ ▀ ▀▄█▄▀▄▀ █ █▄▄▄▄▄▄▄█
█▄ ▀▀  ▄██▀▀█▀▄▄▄▄▄▄▄▀▄▀▀▀▀     ▄ ▄█▀▄ ▀▄▀█▀▀ ▀▄  █▀▄▀▄  ▄█
█▄▄ ▄▀█▄ █▄▄▀ ▄ ▄ ▄█▀▀▀█ █ █▀▀▄ ██ █▀█  ▀ ▀ ▀  █▀  █ █▄▄ ▀█
█ ▄ ▄▄▀▄▀▄▄▀  ▀▀▀▄▀ █ ▄▄▄▀ ▄ █▀█▀▄ █  █ ▄▀ ▀▀  ▄▀ █ ▄▀▀▄▄██
█▀ ▀█▀▄▄▄▄▀▀ █ █ ▄█▄█▀▄▀ ██▄▀  ▀▄█▄█▀▀█▀▄  ██▀▀█▀▄ ▄▄▄▄▄▀▀█
█ ▀▀▄ ▄▄▀▀█▀█▀█▄ ▄ ▄█▀█▀▀▀▄█▄  ▀█ ▄█▀▄█▀▄█ ▀▀▄ █   ▀▀█▄▀ ██
█▀▄▀▀█▄▄▀█▀█▀ ▀████  █▀▄▀▀█▄▀█ ▀▀ ███▀███▄▄  ▀██▄▄▄▄ ▀▄▄▄██
█▄ ██▀▀▄▄█▀  ▀▄ ▀▀▄▄▀  █▀▄██▄▀▄▀▄ ▄▄▄▄█ ▀▀  ▄▄▀█▄▀█▀ ▀▀▀▄▄█
█▀▄▀   ▄▀█  ▄█▀ ▄█▄▀▄█▄▀▄ ▀ ▀█▀▄▄█▄██▀█▄▄█  ▄▀█▀█▀▄█   █▀▀█
█ ▀ ▄▀ ▄█▄▀ ▀█  ▀█▄▄ ▀▄█▄▀▄▄ ▀  ▀███▄ ▄▀ ██ █▄▀▄▀ ▀▀▄▀█▀▀▀█
█ ▀▄▄ ▄▄▄ ▀▀█▄▀█ ▀▀  ▀▄  ██ ▄▄▄   █▀ ▀▀▀▄██▄▀█ █  ▄▄▄ ▄█▄▀█
█ ▄█  █▄█  ▄█ █ ▀▄▄▀▄ ▀█ ▀▄ █▄█ ▄▄▀█▄ ▄▀▀█▀ █▄▀▄█ █▄█  ▀▀ █
█▀▀▀█ ▄▄ ▄████▀▀▄▄█▀▄▄████▀▄▄▄  ▀▄█▄▄▀▄ ▄█▀▄ ▀▀ ▄ ▄ ▄ ▀▄ ██
█▄▄ █▄▀▄▀  ▀▄█▀▀▀█  █▀ ▀▄▀▀█▄▄▀ █ ▄█▄ █ ▀█ ▀▀ ▀▄▀▄▄  ▄██▄██
█▀ █▄█▄▄▄▄██▀▀▄█▄▄███▀▀ █▄▄▀▄▀▄█▀▀ █  ▀█ ▄▀▀▀▀▀ ▄▀▄▀  ▄██▀█
█▀▄▄▀██▄ █▄██▄▀ ▄█ ▄▄▄▄█▄ ▀ ▄██▄   ▄▄▄▄▀▀█ ▀▀▄ ▄▀▀ ▀▀█▄▄▀██
█ █▄▀█▀▄▀    ▄ ▀▀  ▄▀ ██▀█▄▀▀ ██▀▄ ▀█▀ ▄█  ▄█▄▀  ▀ █▀▄█▄▄▄█
█  ▀▄▄▄▄▀▀█ ██▄ ▀█▀▄▀▀▄▀ ▀ ▄▀▄ ▄▄ ▄█▀ ▄ ▄▀█▀█ ▀▄▀ ▄▀▀██▄ ▄█
█▄▀▀█▀▀▄██▄█▄▄▄▀█▀▄█ █▀█▄▄▀▀ ▄█▀█▀ ▄▄ ▀█▀ █▄▀▄▄   ▄█▀█▄▄ ██
█ █ ▀▄▀▄██▀█▄ ▀ ▀▄▀ ▀▀▄▄    ▀▄ ▄▀ ▀▄▀ ▄▀▄▀  █ ▀███▄█ █▀▄▄▀█
█ ▀ ▀▀▄▄ ▀█▀█  ▄█▄  ██  ▄██ ▀▀██ ▀███▀▀▀▄▄ █ █▀▄▄  ▀█ █▄ ██
███████▄▄ █▄█▀ ▀▀█ ▄█ ▀▀ ▀█ ▄▄▄ █ ██  █ ▀▀█ █  █▀ ▄▄▄ ▀  ▀█
█ ▄▄▄▄▄ █▀▀   ▀█ ▀ ▄ ███ █▄ █▄█ ▀▀█▀ ▄▄▄█▀ ▄█ ▀   █▄█ ▀▄▄██
█ █   █ █▄▄█▀ ▀█▀▀▄ ▀  █▀▄▀▄▄▄ ▄   █  ▄  ▀  █ ▀▄ ▄▄  ▄▀▀▀ █
█ █▄▄▄█ █▀▄▀▄▄█▄▄█▄▀▄██▀▄ ▀▀█▄▄ █▄█▄▄ ▄██▄██▀  ▀██▄▄▀ ▀▄███
█▄▄▄▄▄▄▄█▄▄▄▄▄████▄▄▄▄▄██▄█▄▄██▄███▄▄▄█▄████▄▄█▄████▄█▄██▄█

2025-07-24 13:40:07:407 info: QR code generated { action: 'qr_code_generated', qrLength: 239 }
2025-07-24 13:40:07:407 info: Instance bcd1f4af-e733-4255-bf7f-acce0bacd06e status changed to qr_ready {
  source: 'whatsapp-client.ts:qr_event',
  message: 'QR code generated and ready for scanning'
}
2025-07-24 13:40:07:407 info: QR code generated. Scan it with your phone to log in.
▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
█ ▄▄▄▄▄ █▀▀ █▄█ ██▀  █ █  ▄▀▀█▄  █▄▀▀ ▄▀▀█▄ █▄▄▄ ██ ▄▄▄▄▄ █
█ █   █ █▀▀▀▀▀▀█▄▄ ▀████▀▀▀██▄▀▄▀█▀▄▀▀▄▄▀▄ ▄▀▄ ▄ ██ █   █ █
█ █▄▄▄█ █▀▄ ▄▄▀█▄██ ▄  █▀ █ ▄▄▄ █ ▀▀▄▀▀▀█▄▄▄▄▄▀▀▄██ █▄▄▄█ █
█▄▄▄▄▄▄▄█▄█▄█ ▀ ▀▄▀▄▀ ▀ █ █ █▄█ ▀▄█ ▀▄▀ ▀ ▀ ▀▄▀▄▀▄█▄▄▄▄▄▄▄█
█▄▄▄▄▄█▄▄  █▀█▀▀▀▄▄▄▀▄▀▀▀▀▄ ▄   ▀█▀█▀▄█▄▀▀█▀▄█▄▄▀  █▄▀▄▀▄▀█
█▀▄ ▄█▀▄▀██▄█▀▄ ▄█▀ ▀▀▀ █ ▀▄▀ ▀███ ▄▄ ▄▄▀█▄▀▀ ▄▄██▀██▄▀▀ ▀█
█ ▀█▀▄▀▄▄██▀  ▄▄▄▄▀  █▀▄▄▀█▀▀█▀█▄▀██  ▀▄▀▀▀▀▄██▄▀  ████▄▀ █
█▄▀ ▀▄▀▄▄█▀▄█  █ ▀▄▄█▀ ▀█ █▄ █▀ ▄█ █  ▀  █▀ ▀▀▄ ▀  ▄▄ ▄▀▀▀█
█▀ ▀  ▄▄▄▄ ▀█▀ ▀▄█  ▄▄ ▀  ▀ ▀ ▄  █ █▄ █▄▀█▀  ▀██  █▄▄█▄▀█ █
██▀█▄ ▀▄▀█▀ ▄█▀█▀  █▀█▀▀▄▄█▄▀ ▄█▀ █  ▄▄▄ █▀▄▀█▄ ▀▀▄▄ ▄▀▀▀▀█
█▄▄  ██▄▀ ▄ ██▀█▄▀▄▄▄███▀▄  ▀▀▄▀ █▀▄█▄ ███  ▄▀▄█▄▀ ██▀▀▀ ▀█
█▄▄▀ ▀▄▄▀▀▀▄▄▄▀▀▄ ▀▄▄█▄▄▀█▀ ▀ ▄▀██▄  ██▄▄ ███▀█▄ ▄ ▄ ██ ▀▀█
█ ▄█▀▀▄▄ ▀██▀███▄█▄▄█▄▀█▄▀▀▀█▀  ▄  █▄ ▀▄███  ▀▄▄ ▀ ▄█▀█▀▄▄█
██▀▄▄ ▄▄▄ ▀▄▄ ▄▄ ▄▄█ ▀▄██ ▀ ▄▄▄   ▀▄█▄▀▀▄ ▄█▀█  ▄ ▄▄▄ █ ▄▀█
█ ▀█  █▄█ ▄▄█ ▄ ▄▄▄▀▀█▄█ ▀█ █▄█ ▀▀▄▄▄ ▀▄▄█ ▀ ▀█▄▄ █▄█ ▄▀▄██
██▀▀█  ▄▄▄█   ▀▀▄▀▀▄▄▄█     ▄ ▄▄▀▄▄▀█▄▄▄▄  ▄ ▀█ ▄▄▄ ▄▄   ██
█▄▀██▄▀▄▀ █▀▄█▄▄▄▄▄  ▄█▀▄▀▄ █▄▀  █▀█ ▄▀█ █ ▀█▀ ███▀██▄▄█▀ █
█  █▀ ▀▄▄██ ▄▄▄█▀▄  ▄▄▀█▄█▄▀▀▀▀ ▀█  █▀ ██ ██ █▀▄▀▄▄▀▄▄▀ █▀█
█▄▀▀▄██▄█ ▀██▄▄█▀█ ▄▀▀▀█▄ ▄█▀██  ██▄ ▄▀▄▀▀ ▀ ██▄▀▀█▄▄█▄▄█▀█
███▄▀ ▄▄▀ █ ▄ ██▀██▀▀ █ ▄ ▄▀▀█▄ ▀▄ ▄▀▄ ▄▄▄█▀█▄▀██▄ █▀▀ ▀▄▄█
█ █▄▀ ▀▄▄▄  ▀▀▄ ▄█▀▄▄▄▀▀ ▀█▀▄▄ ▄▀█▀█▀ ▀█▀▀█▀ █▄▄▀ █▀▄██ █▀█
█▀▀▀█ █▄██▀██▀▀▄█▄▀  █▀ ▀▀█▀ ▀ ▄█▀ ▀▀███▀█ ▀▀▄ ▀▀▄ ▀▀ ▄  ██
█  █▀█▄▄█▀▄▄▄ █▄▄▄▀ ▄▄▀▄  █▄▄▄ ▄▄██▄▀  ▄▀▀▀▀ █▄▄▀   ▄█▄█▀▄█
█ ▀ ▀▀▄▄  █▄ █ ▄█▀▀▀████▀ ▄▄▀▄   ▀█ ▄ ▄  ▀▀  █████▄█▄█▀  ██
███████▄█▀ ▄█▀█▄█▄▀▄▀█▀██▀  ▄▄▄  █ █▄ ▄█▀▀ ▀▄█▄▄▀ ▄▄▄  ▀▀ █
█ ▄▄▄▄▄ █▄▀███▀█▀▀█▀█ █  ▀▄ █▄█ ▀▀█▄ ▄▄▄▀ █ ▀ ▀▄▄ █▄█ ▄▀ ▀█
█ █   █ █ ▀█▄ ▄ ▄▀▄ ▄███▀▄▄ ▄  ▄ ███  ▀█▀▀  █▀▄▄▀▄ ▄ ▄▀▀▄██
█ █▄▄▄█ █ ▄████ ▄ ▀▄▄██▄▀█▀▀▄▀▀██▄█▀▀█▄██▀  ▀▀ ▄  ▄▄█▀▄▀███
█▄▄▄▄▄▄▄█▄█▄▄██▄▄█▄▄█████▄▄█▄▄█▄▄▄▄▄▄▄▄█▄█████▄▄██▄▄▄█▄█▄██

2025-07-24 13:41:18:4118 info: QR code generated { action: 'qr_code_generated', qrLength: 239 }
2025-07-24 13:41:18:4118 info: Instance bcd1f4af-e733-4255-bf7f-acce0bacd06e status changed to qr_ready {
  source: 'whatsapp-client.ts:qr_event',
  message: 'QR code generated and ready for scanning'
}
2025-07-24 13:41:18:4118 info: QR code generated. Scan it with your phone to log in.
▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
█ ▄▄▄▄▄ █ ▄ █▄▀█▀▀▀ ▀▄▄█ ▄▀▄▄█▄ █  ▀█▄█ ▄▄▄ ▀▄▀▄ ██ ▄▄▄▄▄ █
█ █   █ █ ▀▄▄▄▀██ █▄█▄█ ██▀██▀▄▀ ▄▀▀▄▄▄▄█ █▀ ▄ ▄ ██ █   █ █
█ █▄▄▄█ █▀█▄██▄ ▀██ ▀███▀   ▄▄▄ ▀▄▄▀█▀▄▄▄▀▄▄█▀▄▀▄██ █▄▄▄█ █
█▄▄▄▄▄▄▄█▄█ ▀ ▀ ▀ █ ▀ ▀▄▀▄█ █▄█ ▀▄█▄█ ▀ ▀▄█▄▀▄▀ █ █▄▄▄▄▄▄▄█
█▄ ▀▀▄ ▄██▀▀██▄▄▄▄▄▄▄▀▄▀▀▀▀▄    ▄ ▄█▀▄ ▀▄▀█▀▀ ▀▄  █▀▄▀▄  ▄█
█▄▄ ▄ █▄▄█▀   ▄ ▄ ▄█▀▀▀█ █ ▄▀▀▄ ██ ▀▀█▄▄▀ █▄▀  ▀▄▀▀█▀ ▄▄ ▀█
█ ▄▄ ▄▀▄▄▄▀▀  ▀▀▀▄▀ █ ▄▄▄▀ ▄ ▀▀█▀▄ █  █ ▄▀ ▀▀  █▀ █ ▄▀█ ▄██
█▀▀█▄▀▄▄▄█▀▀ █ █ ▄ ▀█▀ ▀ ██▄  ▄█▄██ █▀▀█  ▄ ▀▀█    ▄█▄█▄▀▀█
█▄ ▄▀ ▄▄▀▀█▀█▀█▄ ▄▄▄█  ▀▄▀▄█▄ ▀▀█ ▄▄▄ ▄ ▄█▄▀ ▄▀█   ▀▀██ ▄▀█
█  ▄██▄▄▀█▀█▀ ▀█▀▀█ ▀▄▀▄ ▀█▄▀█▀▀▀ ██ ▀██ ▄█  ▀██▄▄▄▄ ▀▄▄▄██
██▄██▄ ▄▄█▀ ▄▀▄ ▀▀▄▄▀  █▀▄██▄▀▄▀▄▄▄▄▄ █ ▄█  ▀▄▀█▄▀█▀ ▀▀▀▄▄█
█▀▄▀ ▀▀▄█▀█ ▄██▀▄█▄▀▄█▄▀▄ ▀ ▀█▀▄▄█▄█▄ █▄▄█  ▄▀█▀█▀     █▀▀█
█ ▀ ▄▄ ▄ ▄█▄▀▄▄█▀█▄▄ ▀▄█▄▀▄  ▀  ▀███▄ ▄▀ ██ █▄▀▄▀ █ ▄▀█▀▀▀█
█ ▀▄▄ ▄▄▄ ███▀▀▄ ▀▀  ▀▄  █▀ ▄▄▄   █▀ ▀▀█▄█▀▄▀█▄▀█ ▄▄▄ ▄█▄▀█
█ ▄ ▄ █▄█ ▀ █ ▄█▀▄▄▀▄ ▀█ ▀  █▄█ ▄▄ ▄▄ █▀▀█  █▄ ██ █▄█ ▄▄▀ █
██ █▀ ▄▄▄▄████▀▀▄▄█ ▄▄  ██  ▄▄  ▀▄██▄▀ █▄▀▄▄▄█▀▀▀  ▄  ▄▄ ██
██▀▀█▄▀▄ ▄ ▀▄█▀▀▄▄  █▀▀▀ ▀▀█▀█▀ █ ▄█▄▄▄  ▀▀▀▀  ██▀▄ ▀▄██▄██
█ ████▄▄████▀▀▄█▄ ██▄█▀  █▄▀▄█▄██▀ █ ▄ ▄██ ▀▀ ▀▀▄▀▄▀█▀▄█ ▀█
█▀▀▄▀██▄ █▄█▀█▀ ▄█ ▄▄▄▄█▄ ▀ ▄██▄█  ▄ ▄▄▀█▀ ▀▀  ▄▀▀ ▀▀█▄▄ ▄█
█ █▄▀█▀▄▀ ▀▄▄ ██▀  ▄▀ ██▀█▄▀▀ █▀ ▄ ▀▄▀ ▄█  ▄██▀  ▀ █▀▄█▄▄▄█
█  ▀▄ ▄▄▀▀▄▄▄▀█▀▀█▀▄▀▀▄▀ ▀ ▄▀▄ ▄▄ ▄█▀ ▄ ▄▀█▀█ ▀▄▀  ▀▀██  ▄█
█▄▀▀███▄███▀▄  ██▀▄█ █▀█▄▄▀▀ ▄█▀█▀ ▄▄ ██▀ █ ▀▄  ▄▄▄█▀██▄ ██
█ █▄▀ ▄▄▀▀▀█▄  █▀▄▀ ▀▀▄▄    ▀▄ ▄▀ ██▀ ▀ ▄▀█▀█ ▀▄▀█▀  ▄▀▀▄▀█
█ ▀ ▀▀▄▄█▀█▀█  ▄█▄████▀ ▄█▄ ▀▀██ ▀▄██▀ ▄  █▄▄█▄▀▄▄▄█▀███ ██
███████▄▄▀█▄█▀ ▀▀▄▄ ▀▀▄▀  █ ▄▄▄ █ ██ ▄█▀▄█▄ █▄▀█▀ ▄▄▄ ▀ ▄▀█
█ ▄▄▄▄▄ █▀▀   ▀█▄█ ▄▀▀██ █▄ █▄█ ███▀▄▄█▄▀ ▀▄ ▀  █ █▄█ ▀▄▄▀█
█ █   █ █▄▄█  ▀█▀▀▄ ▀  █▀▄▀▄▄  ▄█▄ █▄▄▄ ▄█  ▀▄▀▄ ▄▄   ▀▀▀ █
█ █▄▄▄█ █▀▀█ █▀▀▄█▄▀▄██▀▄ ▀▀▀ ▄ █▄█▄█▀▄█▄▄██▀▀ ▀██▄▄ ▄▀▄███
█▄▄▄▄▄▄▄█▄█▄██████▄▄▄▄▄██▄█▄▄██▄███▄▄▄█▄████▄▄█▄████▄█▄██▄█

2025-07-24 13:41:34:4134 info: QR code generated { action: 'qr_code_generated', qrLength: 146 }
2025-07-24 13:41:34:4134 info: Instance bcd1f4af-e733-4255-bf7f-acce0bacd06e status changed to qr_ready {
  source: 'whatsapp-client.ts:qr_event',
  message: 'QR code generated and ready for scanning'
}
2025-07-24 13:41:34:4134 info: QR code generated. Scan it with your phone to log in.
▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
█ ▄▄▄▄▄ █▄█▄ ██▀ █▄█ ▀ ▄▄█▄▀▄▀▄▄ ▄▀█▀▄█ ▄▄▄▄▄ █
█ █   █ █  █ ▀▀██  ▀▄  ▄ ▀█▀ █▄▀ ███ ▀█ █   █ █
█ █▄▄▄█ █▄▄ █▀█▀█▀▀█  ▄▄▄ █ ▄█ ▀▀█▄▄▄▄█ █▄▄▄█ █
█▄▄▄▄▄▄▄█▄▀▄█▄█▄▀ ▀ █ █▄█ █▄█ ▀▄█ ▀ █ █▄▄▄▄▄▄▄█
█    █▀▄▀▄███ █▄ █▄██▄ ▄ ▄▀█ ▄█▀██▄█▀  ██▄  █ █
█ ▀▄█ █▄█▀  █   ▀█▀▀▄▄ ▀▄▀  █ ▀▄ ▄ ▄▀  █▀█ ▄ ▄█
█▀ ▄ ▄█▄ ▀ █▀▀ █ █▄▄▀ ▄▄▀▄▀▀▀█ █ █▀██▄█ ▄▀█▄ ██
██▀▀▀██▄▀▀█▀▄▄ █▀█▄▄▀█▄█ ██▀▀▀▄ ▀█▀ ▄██▄▄▀ ▀ ▀█
█ ▄█▄ ▄▄█▀▀▀▀▄█▄█  ▀ █▀ ▄█▄▄▄▀▀▄  █  ▄▄▄█▀▄▄▀▀█
█▀██▄▄ ▄█▄█ █▄█▀▀▀▀▄▄ █▄  ██▀ █▄▄▀ ▄ █▄▀█ ▄█▄██
██▄▄█ ▄▄▄ ██▄▄▀█ █ █  ▄▄▄ ▀██  ▀▀▀ ▄▀ ▄▄▄ ▀ █ █
█▄█▄▄ █▄█ ▀▀ █ ▀▄█▄▀  █▄█  ▀▄██ ▀▄ ▄█ █▄█  ▄ ▄█
███ ▀ ▄▄▄ ▄█ ▄▄ █▄ ▄ ▄   ▄▄ ▀██▄ ▀█▄█▄ ▄ ▄▀█▄██
█  ▀▄ ▀▄  ██▄▀▀█▄█ █▄▀▀█▀▀█▄ █▄█ ▀▄▀▀▄██ ▄ ▀▀██
█▀ █▄ █▄▀ ▄▀▄▄█ ▀▀█▀▄█ ▀█ ▄█ █▀█▀▄▄▀  ███ ▄ ▄▄█
█▀█ ▀█ ▄▄▄▄ ▄▀▀▀▄▄ ▄▀▀▄▀███ ▄▄██▀▄ ▄█ ▄▀ █▄▄ ▀█
█▄▀▄█ ▀▄█ ▄▀▀█ █▄█▄▀ █ ▄▀  ▄ ▄  ▄█▄██▀█▀██▀ ▀▀█
██▀▀▀ █▄      ▀▄█▀▀▄▀▀▄█▄▄███▄ █▀ ▀▄ ▄▄ ▀▄▀▄  █
█▄██▄▄█▄▄  ▀██▄█▀█    ▄▄▄ ▀ ▄███ █ ██ ▄▄▄ ▄ ███
█ ▄▄▄▄▄ ██ ▀▀██  ▄▀▀█ █▄█ █▀▄ ▀█ ▀██▄ █▄█ ▀ ▀▀█
█ █   █ █▀█ ██ █▄ ▀▀▀▄▄   █▄ ▀▀▄▄▄▀▀▀ ▄▄▄▄▄ ███
█ █▄▄▄█ █ ▄█ ▄ ▀█▀█▀▀▄▀   ▄▀█▀▀▀▄███▀▄ ▀▀██▄█ █
█▄▄▄▄▄▄▄█▄▄▄██████▄█▄█▄▄▄█▄▄▄▄▄▄██▄███▄█▄▄█▄███

2025-07-24 13:41:40:4140 info: QR code generated { action: 'qr_code_generated', qrLength: 239 }
2025-07-24 13:41:40:4140 info: Instance bcd1f4af-e733-4255-bf7f-acce0bacd06e status changed to qr_ready {
  source: 'whatsapp-client.ts:qr_event',
  message: 'QR code generated and ready for scanning'
}
2025-07-24 13:41:40:4140 info: QR code generated. Scan it with your phone to log in.
▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
█ ▄▄▄▄▄ █ ▄▀█▄▄█▄▀█ ▀ ▀▄▀ █▄█▀▄ ▀ ▄█▀ ▄▄█▄   █▀▄ ██ ▄▄▄▄▄ █
█ █   █ █ ▀█▄▄ ██  ▄█▄▄▀▄█▀█▄▀██▀█▀▄█▄▀ █ ▀▀ ▄ ▄ ██ █   █ █
█ █▄▄▄█ █▀█  ██▀▀█ ▀▀███▀   ▄▄▄ ▀▄▀▀▄  ▄▀▄█▄ ▀▄▀▄██ █▄▄▄█ █
█▄▄▄▄▄▄▄█▄▀▄▀ ▀▄▀ ▀ ▀ █ ▀▄█ █▄█ ▀▄█▄█ █ ▀ █▄▀ ▀▄█ █▄▄▄▄▄▄▄█
█▄▄▀█  ▄██ ▀██▀  █ ▄▀▀ ▀ ▀▀▄ ▄  ▄ ▄█▀▄█▀▄▀▀▀▀▄▀▄  ▀▀▄▀▄  ▄█
█▄ ▀ ▄▄▄█   █▀▄  ▄▄█▀▀▀█  █▄█ ▄ █▀ █▄ ▄▀ ▀█▄ ▀▀█ ▄▄▄  ▄▄ ██
█ █▀▄▀▀▄▀▄▄▄▄█▀▀▀█▀ ▄▀▄▄▀▀██▄▀▀██▄▀██▄▄▀ ▀ ▀▀▄ █   ▀ ██▄ ▀█
██▀▄██▀▄ ▀█▄▀█  ▄ █▀████▄█ ▄  ▄█ ▄ ▄ ▄█▀█   ▄█▀▀▀█▄▄▄▄▀█▄██
█ ▀▄▄▄ ▄█▄▄██▄▀▄ ▄▄ █ ▄▀▀▀ █▄ █ █▄▄█    ▄█  ▀  ▄  ▀▀▀█ █▀▀█
█▄ ▄▄█▄▄ ▀█ █▀▀█▀▀█▀▄██▄ █▀███▀▄█▀█▀▀█▄ ██▀▀▄▀████▄  ▄▀▄ ██
█▄▀▀ ▄█▄▀ ██  ▄ ▀▀▄ ▀  ▀▀▄▄▄▀█ ▀▀▄█▄▄▄█▀█▀ ▀█ ▀█▄▀█▀▄█ ████
█▄  █  ▄▄▀▀█▄▄▀█▄██▀▄█ █▄ ▀  ▀▀▀▄███▀▀▀██▀ █▄▀  ▀ ██▄ ██▀▀█
█▀ █▄  ▄█▄█▀ ▄▀ ▄▄ ▄ ▀ █   ▄▄█▄▀▀███  █▀▄█▀ █ ▀█ ▀▄▀ ▀▄ ███
█▀ ▄▀ ▄▄▄ █ ▄█▄ ▀▀▀  ▀▄  ▀█ ▄▄▄ ▄▄████▄▄ ▀▄ ▄▄█   ▄▄▄ ▄██▀█
█▀  █ █▄█ █▀█▀▄▀ ▄▄▀▀▀▀█ ▀▄ █▄█ █  █ ▄█▀ █▀▀▀▄▀▄█ █▄█ ▀▀ ▀█
██▀▀▄▄▄▄▄▄▀▄▄█ ▀▀ █▄█▀▄▀▄▄█▄▄▄▄  █▄▄█ █▄▀ █▄▀ ▀   ▄ ▄ ▄█ ██
█ ▀ █▄▀▄▄▄▀█  ▄█ █▄▄█ ▄█▄▀ ▀ █▀ █▄▄█▄ ▄▀▄█▀▀▀▄▀▄▀ ▄▄▀██▀▀▀█
█ ▄███▀▄  ▀█ ▄▀▄ ▄▀█   ▀ ▄▄ █▀▄██▀▄▀  ▀█ ██ █▀    ▀▀  ██ ██
█▄██▄▀▀▄▀▄█▄██ █▄██▄▄▄█▀▄ ▀▀▄█▄▄█▄ █▄ ▀ ▄█▀▀█  ██  ▀ ▄▀▀ ██
█▀▀▀▄ ▀▄▄ ▄█▄ █▄▀ ▄▀▀ ▀▄▀█▄▀▀ ▀▀▀█  █▀ ▄▀ ▄█▄▀█▀█▀▄▀▀▀▄█▄▄█
█▄ █▄▄▀▄ ████ ▀▀▄▄ ▄▀▀▀▀▀  ▄▀▄█▄▄ ▄█▄▄▄▀▄▀▄ ▀▄▄▄▀▄▀  ▄ █ ▄█
█▀▄ ▀▀▀▄▄▄▄██ █ █ ▄█ █▀█▀ █▀▄▀▀▀█▀▄▄▀▀ ▄▄▄█▄▀▄▀█▄  █▄▀██ ██
██▀ █▀ ▄▄▄▄██▀ ▄▀█▀ █▀▄▄ ▀ ▀▀▄█▄▀▄ ▄▄▄▄  ▀▀ ▀▄▀█▀█ █ █ ▀ ▀█
█ ▀ ▀▀▄▄▀▄ ▀▄ █▀▀▀█▀▀▄▀  ▄█ █▄█▀█ ▄█▄█▀██▄▀▄█▄█▀█ █▀▀▀ ▄▄▀█
███████▄█ ▄▀  ▀█▀▄▄▄ ▀▄█▀ █ ▄▄▄ █▄██▄▄▄▀▀█ ▀█  ██ ▄▄▄ ▄▀█▄█
█ ▄▄▄▄▄ █▀▄▄▀█▀█▀█▄  ▄▄█▀▀▄ █▄█ █ ▄█▄ ▀█▄▀█▄▀▄  ▄ █▄█ ▀█▄██
█ █   █ █▄█▀██  ▀▀  ▀ ▀▀▀▄▄▄ ▄ ▄█▄ ▄█▄▀▀ ██ █▄▀██▄ ▄ ▄▄█ ▀█
█ █▄▄▄█ █▀▄▀▄██▀▄█ █▄█▄▄▄ ▀▄█ ▄ █▄▄▄▄  ▄▀▄▀ █▀ ▀▀█▀█▀▄▄▄███
█▄▄▄▄▄▄▄█▄█████▄▄▄█▄▄▄▄██▄█▄▄▄█▄███▄▄▄██▄██▄█▄████▄▄██▄██▄█

2025-07-24 13:42:52:4252 info: Authentication successful! { action: 'authenticated', clientId: undefined }
2025-07-24 13:42:52:4252 info: Instance bcd1f4af-e733-4255-bf7f-acce0bacd06e status changed to auth_success {
  source: 'whatsapp-client.ts:authenticated_event',
  message: 'WhatsApp authentication successful'
}
2025-07-24 13:42:55:4255 info: Client is ready! { action: 'client_ready', clientId: '77066318623' }
2025-07-24 13:42:56:4256 info: WhatsApp account info updated in database {
  instanceId: 'bcd1f4af-e733-4255-bf7f-acce0bacd06e',
  account: '77066318623'
}
2025-07-24 13:42:56:4256 info: Instance bcd1f4af-e733-4255-bf7f-acce0bacd06e status changed to client_ready { source: 'client', message: 'Client is ready for messages' }
2025-07-24 13:42:56:4256 info: Instance bcd1f4af-e733-4255-bf7f-acce0bacd06e status changed to client_ready {
  source: 'whatsapp-client.ts:ready_event',
  message: 'WhatsApp client is ready for messages'
}


логи инстанса 

The default interactive shell is now zsh.
To update your account to use zsh, please run `chsh -s /bin/zsh`.
For more details, please visit https://support.apple.com/kb/HT208050.
nce-manager.js &ir-Akhan:wweb-mcp akhanbakhitov$ source .env && NODE_ENV=development node dist/main-insta 
[1] 16361
(base) MacBook-Air-Akhan:wweb-mcp akhanbakhitov$ 2025-07-24 18:37:07:377 info: InstanceMemoryService initialized
2025-07-24 18:37:07:377 info: 🚀 Starting Instance Manager...
2025-07-24 18:37:09:379 info: Database schema initialized (using public schema)
2025-07-24 18:37:10:3710 info: Database initialized successfully
2025-07-24 18:37:10:3710 info: Synced 0 instances to memory
2025-07-24 18:37:10:3710 info: ✅ Database initialized
2025-07-24 18:37:10:3710 debug: Docker network wweb-network already exists
2025-07-24 18:37:10:3710 info: ✅ Docker connection verified
2025-07-24 18:37:10:3710 info: Starting auth status update interval (15000ms)
2025-07-24 18:37:10:3710 info: ✅ Auth status update service started (interval: 15000ms)
2025-07-24 18:37:10:3710 info: 🌐 Instance Manager API running on port 3000
2025-07-24 18:37:14:3714 http: GET /health
2025-07-24 18:37:14:3714 http: GET /health 200 4ms
2025-07-24 18:37:22:3722 http: POST /api/v1/instances
2025-07-24 18:37:22:3722 debug: Request body: {
  user_id: 'test-final-whatsapp',
  provider: 'whatsappweb',
  type_instance: [ 'api' ],
  agno_config: {
    enabled: true,
    agent_id: 'newnew_1752823885',
    model: 'gpt-4.1',
    stream: false,
    agnoUrl: 'https://crafty-v0-0-1.onrender.com/v1/agents/newnew_1752823885/runs'
  }
}
2025-07-24 18:37:22:3722 info: Processing instance bcd1f4af-e733-4255-bf7f-acce0bacd06e { forceRecreate: undefined }
2025-07-24 18:37:22:3722 http: POST /api/v1/instances 201 530ms
2025-07-24 18:37:22:3722 debug: Found instance bcd1f4af-e733-4255-bf7f-acce0bacd06e on attempt 1
2025-07-24 18:37:22:3722 debug: Making decision {
  instanceId: 'bcd1f4af-e733-4255-bf7f-acce0bacd06e',
  dockerExists: false,
  dockerRunning: true,
  forceRecreate: undefined
}
2025-07-24 18:37:22:3722 info: Decision for instance bcd1f4af-e733-4255-bf7f-acce0bacd06e: create { reason: 'Instance does not exist' }
2025-07-24 18:37:23:3723 debug: Executing port update {
  instanceId: 'bcd1f4af-e733-4255-bf7f-acce0bacd06e',
  port: 3635,
  type: 'api',
  query: 'UPDATE public.message_instances SET port_api = $1, updated_at = NOW() WHERE id = $2'
}
2025-07-24 18:37:23:3723 debug: Successfully assigned port 3635 to instance bcd1f4af-e733-4255-bf7f-acce0bacd06e (api)
2025-07-24 18:37:23:3723 info: Assigned ports for instance bcd1f4af-e733-4255-bf7f-acce0bacd06e { api: 3635 }
2025-07-24 18:37:23:3723 debug: Port assignment completed for bcd1f4af-e733-4255-bf7f-acce0bacd06e { duration: 400 }
2025-07-24 18:37:23:3723 info: Creating instance bcd1f4af-e733-4255-bf7f-acce0bacd06e
No api_webhook_schema for instance bcd1f4af-e733-4255-bf7f-acce0bacd06e or it's empty
Environment variables for container bcd1f4af-e733-4255-bf7f-acce0bacd06e: {
  DOCKER_CONTAINER: 'true',
  INSTANCE_ID: 'bcd1f4af-e733-4255-bf7f-acce0bacd06e',
  DB_HOST: 'db.wyehpfzafbjfvyjzgjss.supabase.co',
  DB_PORT: '5432',
  DB_NAME: 'postgres',
  DB_USER: 'postgres',
  DB_PASSWORD: 'Ginifi51!',
  DB_SCHEMA: 'public',
  AGNO_API_BASE_URL: 'http://host.docker.internal:8000',
  AGNO_API_TIMEOUT: '10000',
  AGNO_ENABLED: 'true',
  DATABASE_URL: undefined,
  DATABASE_HOST: 'db.wyehpfzafbjfvyjzgjss.supabase.co',
  DATABASE_PORT: '5432',
  DATABASE_NAME: 'postgres',
  DATABASE_USER: 'postgres',
  DATABASE_PASSWORD: 'Ginifi51!',
  DATABASE_SCHEMA: 'public',
  DATABASE_SSL: 'false',
  USE_SUPABASE: 'false'
}
2025-07-24 18:37:23:3723 info: Starting compose for instance bcd1f4af-e733-4255-bf7f-acce0bacd06e {
  command: 'docker-compose -f /Users/akhanbakhitov/Documents/15.05.25/wweb-mcp/composes/docker-compose-bcd1f4af-e733-4255-bf7f-acce0bacd06e.yml -p wweb-bcd1f4af-e733-4255-bf7f-acce0bacd06e up -d --build'
}
2025-07-24 18:37:24:3724 debug: Docker compose stderr: time="2025-07-24T18:37:23+05:00" level=warning msg="/Users/akhanbakhitov/Documents/15.05.25/wweb-mcp/composes/docker-compose-bcd1f4af-e733-4255-bf7f-acce0bacd06e.yml: the attribute `version` is obsolete, it will be ignored, please remove it to avoid potential confusion"
 Volume "wweb-auth-bcd1f4af-e733-4255-bf7f-acce0bacd06e"  Creating
 Volume "wweb-auth-bcd1f4af-e733-4255-bf7f-acce0bacd06e"  Created
 Container wweb-bcd1f4af-e733-4255-bf7f-acce0bacd06e-api  Creating
 Container wweb-bcd1f4af-e733-4255-bf7f-acce0bacd06e-api  Created
 Container wweb-bcd1f4af-e733-4255-bf7f-acce0bacd06e-api  Starting
 Container wweb-bcd1f4af-e733-4255-bf7f-acce0bacd06e-api  Started

2025-07-24 18:37:24:3724 info: Compose started successfully for instance bcd1f4af-e733-4255-bf7f-acce0bacd06e
2025-07-24 18:37:24:3724 info: Instance bcd1f4af-e733-4255-bf7f-acce0bacd06e created successfully
2025-07-24 18:37:24:3724 info: Waiting for API to be ready for instance bcd1f4af-e733-4255-bf7f-acce0bacd06e (timeout: 9 seconds)
2025-07-24 18:37:24:3724 info: Saving API key to database for instance bcd1f4af-e733-4255-bf7f-acce0bacd06e
2025-07-24 18:37:24:3724 info: Saving API key to database for instance bcd1f4af-e733-4255-bf7f-acce0bacd06e
2025-07-24 18:37:24:3724 info: Saving API key to database for instance bcd1f4af-e733-4255-bf7f-acce0bacd06e
2025-07-24 18:37:24:3724 info: Saving API key to database for instance bcd1f4af-e733-4255-bf7f-acce0bacd06e
2025-07-24 18:37:24:3724 info: API key saved for instance bcd1f4af-e733-4255-bf7f-acce0bacd06e {
  key_preview: 'bcd1f4af...',
  source: 'ProcessingService:waitForApiReady'
}
2025-07-24 18:37:24:3724 info: API key updated in database for instance bcd1f4af-e733-4255-bf7f-acce0bacd06e
2025-07-24 18:37:24:3724 debug: API not responding yet, attempt 1/3: read ECONNRESET
2025-07-24 18:37:24:3724 info: API key saved to database for instance bcd1f4af-e733-4255-bf7f-acce0bacd06e
2025-07-24 18:37:25:3725 info: API key saved to database for instance bcd1f4af-e733-4255-bf7f-acce0bacd06e
2025-07-24 18:37:25:3725 info: API key saved to database for instance bcd1f4af-e733-4255-bf7f-acce0bacd06e
2025-07-24 18:37:25:3725 info: API key saved to database for instance bcd1f4af-e733-4255-bf7f-acce0bacd06e
2025-07-24 18:37:27:3727 debug: API not responding yet, attempt 2/3: read ECONNRESET
2025-07-24 18:37:30:3730 debug: API not responding yet, attempt 3/3: read ECONNRESET
2025-07-24 18:37:34:3734 warn: API did not respond after 3 attempts, returning instance ID as API key
2025-07-24 18:37:37:3737 info: Instance bcd1f4af-e733-4255-bf7f-acce0bacd06e status changed to start {
  source: 'instance-monitor.service.ts:getAuthStatus',
  message: 'Starting auth status check'
}
2025-07-24 18:37:37:3737 info: Instance bcd1f4af-e733-4255-bf7f-acce0bacd06e status changed to start {
  source: 'instance-monitor.service.ts:getAuthStatus',
  message: 'No API key available, waiting for generation'
}
2025-07-24 18:37:37:3737 debug: Updating auth_status in database for instance bcd1f4af-e733-4255-bf7f-acce0bacd06e {
  auth_status: 'pending',
  whatsapp_state: undefined,
  account: undefined,
  query: '\n' +
    '      UPDATE public.message_instances \n' +
    '      SET updated_at = $1, auth_status = $2\n' +
    '      WHERE id = $3\n' +
    '      RETURNING *\n' +
    '    ',
  values: [
    '$1: Thu Jul 24 2025 18:37:37 GMT+0500 (Казахстан)',
    '$2: pending',
    '$3: bcd1f4af-e733-4255-bf7f-acce0bacd06e'
  ]
}
2025-07-24 18:37:38:3738 debug: Database update result for instance bcd1f4af-e733-4255-bf7f-acce0bacd06e {
  updated_auth_status: 'pending',
  expected_auth_status: 'pending',
  matches: true
}
2025-07-24 18:37:38:3738 info: ✅ IMMEDIATE auth status update for instance bcd1f4af-e733-4255-bf7f-acce0bacd06e: pending
2025-07-24 18:37:38:3738 info: ✅ IMMEDIATE auth status update for instance bcd1f4af-e733-4255-bf7f-acce0bacd06e: pending
2025-07-24 18:37:38:3738 info: Instance bcd1f4af-e733-4255-bf7f-acce0bacd06e processing completed: {
  success: true,
  instance_id: 'bcd1f4af-e733-4255-bf7f-acce0bacd06e',
  action: 'create',
  details: {
    display_name: 'whatsappweb_api',
    ports: { api: 3635, mcp: null },
    api_key: 'bcd1f4af-e733-4255-bf7f-acce0bacd06e',
    auth_status: 'pending',
    status_check_url: 'http://localhost:3000/api/v1/instances/bcd1f4af-e733-4255-bf7f-acce0bacd06e/auth-status'
  },
  message: 'Instance created. Waiting for QR code generation...'
}
2025-07-24 18:37:54:3754 http: GET /api/v1/instances/bcd1f4af-e733-4255-bf7f-acce0bacd06e
2025-07-24 18:37:54:3754 http: GET /api/v1/instances/bcd1f4af-e733-4255-bf7f-acce0bacd06e 200 776ms
2025-07-24 18:37:57:3757 debug: Cleaned up expired port reservation: 3635
2025-07-24 18:38:42:3842 http: GET /api/v1/instances/bcd1f4af-e733-4255-bf7f-acce0bacd06e/auth-status
2025-07-24 18:38:42:3842 info: Instance bcd1f4af-e733-4255-bf7f-acce0bacd06e status changed to start {
  source: 'instance-monitor.service.ts:getAuthStatus',
  message: 'Starting auth status check'
}
2025-07-24 18:38:42:3842 info: Instance bcd1f4af-e733-4255-bf7f-acce0bacd06e status changed to start {
  source: 'instance-monitor.service.ts:getAuthStatus',
  message: 'API key available, checking whatsappweb status'
}
2025-07-24 18:38:42:3842 debug: Connecting to http://localhost:3635/api/v1/status for instance bcd1f4af-e733-4255-bf7f-acce0bacd06e
2025-07-24 18:38:42:3842 info: Instance bcd1f4af-e733-4255-bf7f-acce0bacd06e status changed to qr_ready {
  source: 'instance-monitor.service.ts:getAuthStatus',
  message: 'whatsappweb state: QR_READY'
}
2025-07-24 18:38:42:3842 http: GET /api/v1/instances/bcd1f4af-e733-4255-bf7f-acce0bacd06e/auth-status 200 496ms
2025-07-24 18:38:47:3847 http: GET /api/v1/instances/bcd1f4af-e733-4255-bf7f-acce0bacd06e/qr
2025-07-24 18:38:47:3847 http: GET /api/v1/instances/bcd1f4af-e733-4255-bf7f-acce0bacd06e/qr 200 178ms
2025-07-24 18:38:55:3855 debug: Updating auth_status in database for instance bcd1f4af-e733-4255-bf7f-acce0bacd06e {
  auth_status: 'qr_ready',
  whatsapp_state: 'QR_READY',
  account: undefined,
  query: '\n' +
    '      UPDATE public.message_instances \n' +
    '      SET updated_at = $1, auth_status = $2, whatsapp_state = $3\n' +
    '      WHERE id = $4\n' +
    '      RETURNING *\n' +
    '    ',
  values: [
    '$1: Thu Jul 24 2025 18:38:55 GMT+0500 (Казахстан)',
    '$2: qr_ready',
    '$3: QR_READY',
    '$4: bcd1f4af-e733-4255-bf7f-acce0bacd06e'
  ]
}
2025-07-24 18:38:55:3855 debug: Database update result for instance bcd1f4af-e733-4255-bf7f-acce0bacd06e {
  updated_auth_status: 'qr_ready',
  expected_auth_status: 'qr_ready',
  matches: true
}
2025-07-24 18:38:55:3855 info: ✅ DEBOUNCED auth status update for instance bcd1f4af-e733-4255-bf7f-acce0bacd06e: qr_ready
2025-07-24 18:38:55:3855 info: Auth status update: checked 1 instances, skipped 0 recently failed/created
2025-07-24 18:39:55:3955 debug: Updating auth_status in database for instance bcd1f4af-e733-4255-bf7f-acce0bacd06e {
  auth_status: 'qr_ready',
  whatsapp_state: 'QR_READY',
  account: undefined,
  query: '\n' +
    '      UPDATE public.message_instances \n' +
    '      SET updated_at = $1, auth_status = $2, whatsapp_state = $3\n' +
    '      WHERE id = $4\n' +
    '      RETURNING *\n' +
    '    ',
  values: [
    '$1: Thu Jul 24 2025 18:39:55 GMT+0500 (Казахстан)',
    '$2: qr_ready',
    '$3: QR_READY',
    '$4: bcd1f4af-e733-4255-bf7f-acce0bacd06e'
  ]
}
2025-07-24 18:39:55:3955 debug: Database update result for instance bcd1f4af-e733-4255-bf7f-acce0bacd06e {
  updated_auth_status: 'qr_ready',
  expected_auth_status: 'qr_ready',
  matches: true
}
2025-07-24 18:39:55:3955 info: ✅ DEBOUNCED auth status update for instance bcd1f4af-e733-4255-bf7f-acce0bacd06e: qr_ready
2025-07-24 18:39:55:3955 info: Auth status update: checked 1 instances, skipped 0 recently failed/created
2025-07-24 18:41:55:4155 debug: Updating auth_status in database for instance bcd1f4af-e733-4255-bf7f-acce0bacd06e {
  auth_status: 'qr_ready',
  whatsapp_state: 'QR_READY',
  account: undefined,
  query: '\n' +
    '      UPDATE public.message_instances \n' +
    '      SET updated_at = $1, auth_status = $2, whatsapp_state = $3\n' +
    '      WHERE id = $4\n' +
    '      RETURNING *\n' +
    '    ',
  values: [
    '$1: Thu Jul 24 2025 18:41:55 GMT+0500 (Казахстан)',
    '$2: qr_ready',
    '$3: QR_READY',
    '$4: bcd1f4af-e733-4255-bf7f-acce0bacd06e'
  ]
}
2025-07-24 18:41:55:4155 debug: Database update result for instance bcd1f4af-e733-4255-bf7f-acce0bacd06e {
  updated_auth_status: 'qr_ready',
  expected_auth_status: 'qr_ready',
  matches: true
}
2025-07-24 18:41:55:4155 info: ✅ DEBOUNCED auth status update for instance bcd1f4af-e733-4255-bf7f-acce0bacd06e: qr_ready
2025-07-24 18:41:55:4155 info: Auth status update: checked 1 instances, skipped 0 recently failed/created
2025-07-24 18:42:07:427 debug: Rate limiter cleanup completed, active clients: 0
2025-07-24 18:42:07:427 debug: Rate limiter cleanup completed, active clients: 0
2025-07-24 18:42:07:427 debug: Rate limiter cleanup completed, active clients: 0
2025-07-24 18:42:07:427 debug: Rate limiter cleanup completed, active clients: 0
(base) MacBook-Air-Akhan:wweb-mcp akhanbakhitov$ 
(base) MacBook-Air-Akhan:wweb-mcp akhanbakhitov$ 2025-07-24 18:43:55:4355 debug: Updating auth_status in database for instance bcd1f4af-e733-4255-bf7f-acce0bacd06e {
  auth_status: 'qr_ready',
  whatsapp_state: 'QR_READY',
  account: undefined,
  query: '\n' +
    '      UPDATE public.message_instances \n' +
    '      SET updated_at = $1, auth_status = $2, whatsapp_state = $3\n' +
    '      WHERE id = $4\n' +
    '      RETURNING *\n' +
    '    ',
  values: [
    '$1: Thu Jul 24 2025 18:43:55 GMT+0500 (Казахстан)',
    '$2: qr_ready',
    '$3: QR_READY',
    '$4: bcd1f4af-e733-4255-bf7f-acce0bacd06e'
  ]
}
2025-07-24 18:43:55:4355 debug: Database update result for instance bcd1f4af-e733-4255-bf7f-acce0bacd06e {
  updated_auth_status: 'qr_ready',
  expected_auth_status: 'qr_ready',
  matches: true
}
2025-07-24 18:43:55:4355 info: ✅ DEBOUNCED auth status update for instance bcd1f4af-e733-4255-bf7f-acce0bacd06e: qr_ready
2025-07-24 18:43:55:4355 info: Auth status update: checked 1 instances, skipped 0 recently failed/created
