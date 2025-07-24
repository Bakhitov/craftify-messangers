логи инстанс менеджера 


The default interactive shell is now zsh.
To update your account to use zsh, please run `chsh -s /bin/zsh`.
For more details, please visit https://support.apple.com/kb/HT208050.
ment node dist/main-instance-manager.jsbakhitov$ source .env && NODE_ENV=develop 
2025-07-24 18:26:24:2624 info: InstanceMemoryService initialized
2025-07-24 18:26:25:2625 info: 🚀 Starting Instance Manager...
2025-07-24 18:26:26:2626 info: Database schema initialized (using public schema)
2025-07-24 18:26:26:2626 info: Database initialized successfully
2025-07-24 18:26:27:2627 info: Synced 0 instances to memory
2025-07-24 18:26:27:2627 info: ✅ Database initialized
2025-07-24 18:26:27:2627 debug: Docker network wweb-network already exists
2025-07-24 18:26:27:2627 info: ✅ Docker connection verified
2025-07-24 18:26:27:2627 info: Starting auth status update interval (15000ms)
2025-07-24 18:26:27:2627 info: ✅ Auth status update service started (interval: 15000ms)
2025-07-24 18:26:27:2627 info: 🌐 Instance Manager API running on port 3000
2025-07-24 18:26:55:2655 http: GET /health
2025-07-24 18:26:55:2655 http: GET /health 200 12ms
2025-07-24 18:27:06:276 http: POST /api/v1/instances
2025-07-24 18:27:06:276 debug: Request body: {
  user_id: 'test-fixes-telegram-v26',
  provider: 'telegram',
  type_instance: [ 'api' ],
  token: '7961413009:AAGEp-pakPC5OmvgTyXBLmNGoSlLdCAzg28',
  agno_config: {
    enabled: true,
    agent_id: 'newnew_1752823885',
    model: 'gpt-4.1',
    stream: false,
    agnoUrl: 'https://crafty-v0-0-1.onrender.com/v1/agents/newnew_1752823885/runs'
  }
}
2025-07-24 18:27:07:277 info: Processing instance 43097123-a802-40ee-8d63-cf2081ed2987 { forceRecreate: undefined }
2025-07-24 18:27:07:277 http: POST /api/v1/instances 201 575ms
2025-07-24 18:27:07:277 debug: Found instance 43097123-a802-40ee-8d63-cf2081ed2987 on attempt 1
2025-07-24 18:27:07:277 debug: Making decision {
  instanceId: '43097123-a802-40ee-8d63-cf2081ed2987',
  dockerExists: false,
  dockerRunning: true,
  forceRecreate: undefined
}
2025-07-24 18:27:07:277 info: Decision for instance 43097123-a802-40ee-8d63-cf2081ed2987: create { reason: 'Instance does not exist' }
2025-07-24 18:27:07:277 debug: Executing port update {
  instanceId: '43097123-a802-40ee-8d63-cf2081ed2987',
  port: 7531,
  type: 'api',
  query: 'UPDATE public.message_instances SET port_api = $1, updated_at = NOW() WHERE id = $2'
}
2025-07-24 18:27:07:277 debug: Successfully assigned port 7531 to instance 43097123-a802-40ee-8d63-cf2081ed2987 (api)
2025-07-24 18:27:07:277 info: Assigned ports for instance 43097123-a802-40ee-8d63-cf2081ed2987 { api: 7531 }
2025-07-24 18:27:07:277 debug: Port assignment completed for 43097123-a802-40ee-8d63-cf2081ed2987 { duration: 409 }
2025-07-24 18:27:07:277 info: Creating instance 43097123-a802-40ee-8d63-cf2081ed2987
No api_webhook_schema for instance 43097123-a802-40ee-8d63-cf2081ed2987 or it's empty
Environment variables for container 43097123-a802-40ee-8d63-cf2081ed2987: {
  DOCKER_CONTAINER: 'true',
  INSTANCE_ID: '43097123-a802-40ee-8d63-cf2081ed2987',
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
  USE_SUPABASE: 'false',
  TELEGRAM_BOT_TOKEN: '7961413009:AAGEp-pakPC5OmvgTyXBLmNGoSlLdCAzg28'
}
2025-07-24 18:27:07:277 info: Starting compose for instance 43097123-a802-40ee-8d63-cf2081ed2987 {
  command: 'docker-compose -f /Users/akhanbakhitov/Documents/15.05.25/wweb-mcp/composes/docker-compose-43097123-a802-40ee-8d63-cf2081ed2987.yml -p wweb-43097123-a802-40ee-8d63-cf2081ed2987 up -d --build'
}
2025-07-24 18:27:10:2710 debug: Docker compose stderr: time="2025-07-24T18:27:08+05:00" level=warning msg="/Users/akhanbakhitov/Documents/15.05.25/wweb-mcp/composes/docker-compose-43097123-a802-40ee-8d63-cf2081ed2987.yml: the attribute `version` is obsolete, it will be ignored, please remove it to avoid potential confusion"
 Container wweb-43097123-a802-40ee-8d63-cf2081ed2987-api  Creating
 Container wweb-43097123-a802-40ee-8d63-cf2081ed2987-api  Created
 Container wweb-43097123-a802-40ee-8d63-cf2081ed2987-api  Starting
 Container wweb-43097123-a802-40ee-8d63-cf2081ed2987-api  Started

2025-07-24 18:27:10:2710 info: Compose started successfully for instance 43097123-a802-40ee-8d63-cf2081ed2987
2025-07-24 18:27:10:2710 info: Instance 43097123-a802-40ee-8d63-cf2081ed2987 created successfully
2025-07-24 18:27:10:2710 info: Waiting for API to be ready for instance 43097123-a802-40ee-8d63-cf2081ed2987 (timeout: 9 seconds)
2025-07-24 18:27:10:2710 info: Saving API key to database for instance 43097123-a802-40ee-8d63-cf2081ed2987
2025-07-24 18:27:10:2710 info: Saving API key to database for instance 43097123-a802-40ee-8d63-cf2081ed2987
2025-07-24 18:27:10:2710 info: Saving API key to database for instance 43097123-a802-40ee-8d63-cf2081ed2987
2025-07-24 18:27:10:2710 info: Saving API key to database for instance 43097123-a802-40ee-8d63-cf2081ed2987
2025-07-24 18:27:10:2710 info: API key saved for instance 43097123-a802-40ee-8d63-cf2081ed2987 {
  key_preview: '43097123...',
  source: 'ProcessingService:waitForApiReady'
}
2025-07-24 18:27:10:2710 info: API key updated in database for instance 43097123-a802-40ee-8d63-cf2081ed2987
2025-07-24 18:27:11:2711 info: API key saved to database for instance 43097123-a802-40ee-8d63-cf2081ed2987
2025-07-24 18:27:11:2711 debug: API not responding yet, attempt 1/3: read ECONNRESET
2025-07-24 18:27:11:2711 info: API key saved to database for instance 43097123-a802-40ee-8d63-cf2081ed2987
2025-07-24 18:27:11:2711 info: API key saved to database for instance 43097123-a802-40ee-8d63-cf2081ed2987
2025-07-24 18:27:11:2711 info: API key saved to database for instance 43097123-a802-40ee-8d63-cf2081ed2987
2025-07-24 18:27:14:2714 debug: API not responding yet, attempt 2/3: read ECONNRESET
2025-07-24 18:27:17:2717 info: API health check passed after 3 attempts
2025-07-24 18:27:17:2717 info: API is fully ready and authenticated after 3 attempts
2025-07-24 18:27:20:2720 info: Instance 43097123-a802-40ee-8d63-cf2081ed2987 status changed to start {
  source: 'instance-monitor.service.ts:getAuthStatus',
  message: 'Starting auth status check'
}
2025-07-24 18:27:20:2720 info: Instance 43097123-a802-40ee-8d63-cf2081ed2987 status changed to start {
  source: 'instance-monitor.service.ts:getAuthStatus',
  message: 'No API key available, waiting for generation'
}
2025-07-24 18:27:20:2720 debug: Updating auth_status in database for instance 43097123-a802-40ee-8d63-cf2081ed2987 {
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
    '$1: Thu Jul 24 2025 18:27:20 GMT+0500 (Казахстан)',
    '$2: pending',
    '$3: 43097123-a802-40ee-8d63-cf2081ed2987'
  ]
}
2025-07-24 18:27:20:2720 debug: Database update result for instance 43097123-a802-40ee-8d63-cf2081ed2987 {
  updated_auth_status: 'pending',
  expected_auth_status: 'pending',
  matches: true
}
2025-07-24 18:27:20:2720 info: ✅ IMMEDIATE auth status update for instance 43097123-a802-40ee-8d63-cf2081ed2987: pending
2025-07-24 18:27:20:2720 info: ✅ IMMEDIATE auth status update for instance 43097123-a802-40ee-8d63-cf2081ed2987: pending
2025-07-24 18:27:20:2720 info: Instance 43097123-a802-40ee-8d63-cf2081ed2987 processing completed: {
  success: true,
  instance_id: '43097123-a802-40ee-8d63-cf2081ed2987',
  action: 'create',
  details: {
    display_name: 'telegram_api',
    ports: { api: 7531, mcp: null },
    api_key: '43097123-a802-40ee-8d63-cf2081ed2987',
    auth_status: 'pending',
    status_check_url: 'http://localhost:3000/api/v1/instances/43097123-a802-40ee-8d63-cf2081ed2987/auth-status'
  },
  message: 'Instance created. Waiting for QR code generation...'
}
2025-07-24 18:27:34:2734 http: GET /api/v1/instances/43097123-a802-40ee-8d63-cf2081ed2987
2025-07-24 18:27:35:2735 http: GET /api/v1/instances/43097123-a802-40ee-8d63-cf2081ed2987 200 467ms
2025-07-24 18:27:45:2745 debug: Cleaned up expired port reservation: 7531
2025-07-24 18:27:47:2747 http: GET /api/v1/instances/43097123-a802-40ee-8d63-cf2081ed2987/auth-status
2025-07-24 18:27:48:2748 info: Instance 43097123-a802-40ee-8d63-cf2081ed2987 status changed to start {
  source: 'instance-monitor.service.ts:getAuthStatus',
  message: 'Starting auth status check'
}
2025-07-24 18:27:48:2748 info: Instance 43097123-a802-40ee-8d63-cf2081ed2987 status changed to start {
  source: 'instance-monitor.service.ts:getAuthStatus',
  message: 'API key available, checking telegram status'
}
2025-07-24 18:27:48:2748 debug: Connecting to http://localhost:7531/api/v1/telegram/status for instance 43097123-a802-40ee-8d63-cf2081ed2987
2025-07-24 18:27:48:2748 info: Instance 43097123-a802-40ee-8d63-cf2081ed2987 status changed to client_ready { source: 'client', message: 'Client is ready for messages' }
2025-07-24 18:27:48:2748 info: Instance 43097123-a802-40ee-8d63-cf2081ed2987 status changed to client_ready {
  source: 'instance-monitor.service.ts:getAuthStatus',
  message: 'telegram state: READY'
}
2025-07-24 18:27:48:2748 http: GET /api/v1/instances/43097123-a802-40ee-8d63-cf2081ed2987/auth-status 200 804ms
2025-07-24 18:27:56:2756 http: GET /api/v1/instances/43097123-a802-40ee-8d63-cf2081ed2987
2025-07-24 18:27:56:2756 http: GET /api/v1/instances/43097123-a802-40ee-8d63-cf2081ed2987 200 117ms
2025-07-24 18:27:57:2757 debug: Updating auth_status in database for instance 43097123-a802-40ee-8d63-cf2081ed2987 {
  auth_status: 'client_ready',
  whatsapp_state: undefined,
  account: 'salesBotsales',
  query: '\n' +
    '      UPDATE public.message_instances \n' +
    '      SET updated_at = $1, auth_status = $2, account = $3\n' +
    '      WHERE id = $4\n' +
    '      RETURNING *\n' +
    '    ',
  values: [
    '$1: Thu Jul 24 2025 18:27:57 GMT+0500 (Казахстан)',
    '$2: client_ready',
    '$3: salesBotsales',
    '$4: 43097123-a802-40ee-8d63-cf2081ed2987'
  ]
}
2025-07-24 18:27:57:2757 debug: Database update result for instance 43097123-a802-40ee-8d63-cf2081ed2987 {
  updated_auth_status: 'client_ready',
  expected_auth_status: 'client_ready',
  matches: true
}
2025-07-24 18:27:57:2757 info: ✅ DEBOUNCED auth status update for instance 43097123-a802-40ee-8d63-cf2081ed2987: client_ready
2025-07-24 18:27:57:2757 info: Auth status update: checked 1 instances, skipped 0 recently failed/created
2025-07-24 18:28:12:2812 debug: Allowing client_ready instance 43097123-a802-40ee-8d63-cf2081ed2987 to update in DB (15s ago)
2025-07-24 18:28:27:2827 debug: Allowing client_ready instance 43097123-a802-40ee-8d63-cf2081ed2987 to update in DB (30s ago)
2025-07-24 18:28:42:2842 debug: Allowing client_ready instance 43097123-a802-40ee-8d63-cf2081ed2987 to update in DB (45s ago)


Логи телеграм *  Выполнение задачи: docker logs --tail 1000 -f 4d08064b9efbfef163b67b90687525ae63a471695c11aa6f06bdd1876142a788 

2025-07-24 13:27:14:2714 info: InstanceMemoryService initialized
2025-07-24 13:27:15:2715 info: Database initialized successfully
2025-07-24 13:27:15:2715 info: Message storage service initialized
2025-07-24 13:27:15:2715 info: Starting Telegram Bot API...
2025-07-24 13:27:15:2715 info: Loading bot token from database for instance 43097123-a802-40ee-8d63-cf2081ed2987
2025-07-24 13:27:15:2715 debug: Executing query: SELECT token FROM public.message_instances WHERE id = $1 with params: [43097123-a802-40ee-8d63-cf2081ed2987]
2025-07-24 13:27:15:2715 info: Successfully loaded bot token from database for instance 43097123-a802-40ee-8d63-cf2081ed2987
2025-07-24 13:27:15:2715 info: Instance 43097123-a802-40ee-8d63-cf2081ed2987 status changed to start {
  source: 'main.ts:startTelegramApiServer',
  message: 'Starting Telegram API server'
}
2025-07-24 13:27:15:2715 debug: AgnoIntegrationService initialized {
  baseUrl: 'http://host.docker.internal:8000',
  timeout: 10000,
  enabled: true
}
2025-07-24 13:27:15:2715 info: API key saved for instance 43097123-a802-40ee-8d63-cf2081ed2987 {
  key_preview: '43097123...',
  source: 'main.ts:startTelegramApiServer'
}
2025-07-24 13:27:15:2715 info: Updating API key in database for Telegram instance: 43097123-a802-40ee-8d63-cf2081ed2987
2025-07-24 13:27:16:2716 info: Telegram API key updated in database for instance: 43097123-a802-40ee-8d63-cf2081ed2987
2025-07-24 13:27:16:2716 info: API key saved for instance 43097123-a802-40ee-8d63-cf2081ed2987 {
  key_preview: '43097123...',
  source: 'main.ts:startTelegramApiServer'
}
2025-07-24 13:27:16:2716 info: Creating Express application...
2025-07-24 13:27:16:2716 info: Starting Express server on port 7531...
2025-07-24 13:27:16:2716 info: Telegram API server started on port 7531
2025-07-24 13:27:16:2716 info: Health endpoint: http://localhost:7531/api/v1/telegram/health
2025-07-24 13:27:16:2716 info: API endpoints: http://localhost:7531/api/v1/telegram/*
2025-07-24 13:27:16:2716 info: Instance ID: 43097123-a802-40ee-8d63-cf2081ed2987
2025-07-24 13:27:16:2716 info: Bot Token: 7961413009:AAGEp-pakPC5OmvgTyXBLmNGoSlLdCAzg28
2025-07-24 13:27:16:2716 info: API Key: 43097123-a802-40ee-8d63-cf2081ed2987
2025-07-24 13:27:16:2716 info: Instance 43097123-a802-40ee-8d63-cf2081ed2987 status changed to client_ready { source: undefined, message: undefined }
2025-07-24 13:27:17:2717 http: GET /api/v1/telegram/health
2025-07-24 13:27:17:2717 http: GET /api/v1/telegram/health 200 7ms
2025-07-24 13:27:17:2717 http: GET /api/v1/telegram/status
2025-07-24 13:27:17:2717 http: GET /api/v1/telegram/status 200 3ms
2025-07-24 13:27:17:2717 info: Initializing Telegram provider...
2025-07-24 13:27:17:2717 info: [TELEGRAM] Initializing Telegram provider 
2025-07-24 13:27:17:2717 info: [TELEGRAM] Bot initialized: @salesBotsalesBot (salesBotsales) 
2025-07-24 13:27:18:2718 info: [TELEGRAM] Telegram account info updated in database {
  instanceId: '43097123-a802-40ee-8d63-cf2081ed2987',
  account: 'salesBotsales (@salesBotsalesBot)'
}
2025-07-24 13:27:18:2718 info: [TELEGRAM] Telegram provider initialized successfully 
2025-07-24 13:27:18:2718 info: Starting polling for incoming messages...
2025-07-24 13:27:18:2718 info: [TELEGRAM] Starting Telegram polling for incoming messages... 
2025-07-24 13:27:18:2718 info: Instance 43097123-a802-40ee-8d63-cf2081ed2987 status changed to client_ready { source: undefined, message: undefined }
2025-07-24 13:27:18:2718 info: Telegram provider initialized and polling started successfully
2025-07-24 13:27:18:2718 info: [TELEGRAM] Telegram polling started for bot @salesBotsalesBot 
2025-07-24 13:27:35:2735 http: GET /api/v1/telegram/health
2025-07-24 13:27:35:2735 http: GET /api/v1/telegram/health 200 3ms
2025-07-24 13:27:48:2748 http: GET /api/v1/health
2025-07-24 13:27:48:2748 http: GET /api/v1/health 404 10ms
2025-07-24 13:27:48:2748 http: GET /api/v1/telegram/status
2025-07-24 13:27:48:2748 http: GET /api/v1/telegram/status 200 98ms
2025-07-24 13:27:56:2756 http: GET /api/v1/telegram/health
2025-07-24 13:27:56:2756 http: GET /api/v1/telegram/health 200 1ms
2025-07-24 13:28:06:286 http: POST /api/v1/telegram/send
2025-07-24 13:28:07:287 debug: Agno config loaded from database JSON {
  instanceId: '43097123-a802-40ee-8d63-cf2081ed2987',
  agent_id: 'newnew_1752823885',
  enabled: true,
  stream: false,
  model: 'gpt-4.1',
  agnoUrl: 'https://crafty-v0-0-1.onrender.com/v1/agents/newnew_1752823885/runs',
  userId: 'test-fixes-telegram-v26',
  rawJson: {
    model: 'gpt-4.1',
    stream: false,
    agnoUrl: 'https://crafty-v0-0-1.onrender.com/v1/agents/newnew_1752823885/runs',
    enabled: true,
    agent_id: 'newnew_1752823885'
  },
  sessionId: 'will be set by provider'
}
2025-07-24 13:28:07:287 debug: Message saved to database {
  messageId: '274',
  instanceId: '43097123-a802-40ee-8d63-cf2081ed2987',
  isGroup: false,
  isFromMe: true
}
2025-07-24 13:28:07:287 debug: [TELEGRAM] Outgoing Telegram message saved {
  messageId: 274,
  chatId: '134527512',
  instanceId: '43097123-a802-40ee-8d63-cf2081ed2987',
  agentId: 'newnew_1752823885'
}
2025-07-24 13:28:07:287 http: POST /api/v1/telegram/send 200 1193ms
