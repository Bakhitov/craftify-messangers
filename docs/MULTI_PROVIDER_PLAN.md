# Multi-Provider Architecture Implementation Plan

## Обзор

Данный план описывает реализацию архитектуры коннекторов для мессенджеров, следуя лучшим мировым практикам. Основная цель - создать эффективную систему, где API-based провайдеры работают на одном порту, а browser-based провайдеры (WhatsApp Web) остаются в отдельных инстансах.

## Архитектурные решения

### 🏗️ Общая архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer / Nginx                   │
└─────────────────────────┬───────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌─────────────┐  ┌─────────────┐    ┌─────────────┐
│ Multi-API   │  │ WhatsApp    │    │ WhatsApp    │
│ Service     │  │ Web Inst 1  │ .. │ Web Inst N  │
│ (Port 3000) │  │ (Port 3001) │    │ (Port 300N) │
│             │  │             │    │             │
│ ┌─────────┐ │  │ Puppeteer   │    │ Puppeteer   │
│ │Telegram │ │  │ + Browser   │    │ + Browser   │
│ │WhatsApp │ │  │             │    │             │
│ │Official │ │  │             │    │             │
│ │Messenger│ │  │             │    │             │
│ │Instagram│ │  │             │    │             │
│ │Slack    │ │  │             │    │             │
│ │Discord  │ │  │             │    │             │
│ └─────────┘ │  │             │    │             │
└─────────────┘  └─────────────┘    └─────────────┘
```

### 🔄 Resource Optimization

**API-based провайдеры (Один процесс)**:
- Telegram Bot API
- WhatsApp Official API  
- Facebook Messenger
- Instagram Direct
- Slack
- Discord

**Browser-based провайдеры (Отдельные процессы)**:
- WhatsApp Web (требует Puppeteer + браузер)

## Этапы реализации

### ✅ Этап 1: Database Architecture (Завершен)

- [x] Создание миграций для разделения таблиц
- [x] Переименование `message_instances` → `whatsappweb_instances`
- [x] Создание отдельных таблиц для каждого провайдера
- [x] Обновление типов TypeScript
- [x] Создание `ProviderDatabaseService`
- [x] Создание `MultiProviderService`

### 🚧 Этап 2: WhatsApp Official API Provider

#### 2.1 Установка зависимостей
```bash
npm install wh-wrapper @types/node
```

#### 2.2 Создание провайдера
- [ ] `src/providers/whatsapp-official-provider.ts`
- [ ] Реализация BaseMessengerProvider интерфейса
- [ ] Webhook обработка
- [ ] Error handling и retry logic

#### 2.3 Ключевые особенности
- REST API вместо WebSocket
- Phone Number ID для идентификации
- Webhook verification для безопасности
- Media upload через Facebook Graph API

### 🚧 Этап 3: Facebook Messenger Provider

#### 3.1 Установка зависимостей
```bash
npm install messaging-api-messenger
```

#### 3.2 Реализация
- [ ] `src/providers/facebook-messenger-provider.ts`
- [ ] Page Access Token управление
- [ ] Quick Replies и Persistent Menu
- [ ] Template messages

### 🚧 Этап 4: Instagram Direct Provider  

#### 4.1 Установка зависимостей
```bash
npm install instagram-private-api
# Или использование Facebook Graph API
```

#### 4.2 Реализация
- [ ] `src/providers/instagram-provider.ts`
- [ ] Instagram Business API интеграция
- [ ] Stories и Direct messages
- [ ] Media handling

### 🚧 Этап 5: Slack Provider

#### 5.1 Установка зависимостей
```bash
npm install @slack/bolt-js @slack/web-api
```

#### 5.2 Реализация
- [ ] `src/providers/slack-provider.ts`
- [ ] Socket Mode и HTTP Mode поддержка
- [ ] Slash Commands
- [ ] Interactive Components и Block Kit
- [ ] Thread support

### 🚧 Этап 6: Discord Provider

#### 6.1 Установка зависимостей
```bash
npm install discord.js
```

#### 6.2 Реализация
- [ ] `src/providers/discord-provider.ts`
- [ ] Gateway интents management
- [ ] Slash Commands
- [ ] Message Components (buttons, selects)
- [ ] Embeds и rich content

### 🚧 Этап 7: Integration & Testing

#### 7.1 Instance Manager Integration
- [ ] Обновление `src/instance-manager/` для поддержки новых провайдеров
- [ ] Автоматическое создание инстансов через UI
- [ ] Переключение между режимами (single/multi instance)

#### 7.2 API Endpoints
- [ ] REST API для управления провайдерами
- [ ] Единые endpoint'ы независимо от провайдера
- [ ] Swagger документация

#### 7.3 Testing
- [ ] Unit тесты для каждого провайдера
- [ ] Integration тесты
- [ ] Load testing для multi-provider service

## Лучшие библиотеки и практики

### 📚 Рекомендованные библиотеки

| Провайдер | Библиотека | Причина выбора |
|-----------|------------|----------------|
| WhatsApp Official | `wh-wrapper` | TypeScript, активная поддержка, официальный API |
| Facebook Messenger | `messaging-api-messenger` | Часть Bottender, enterprise-grade |
| Instagram | Facebook Graph API | Официальный, надежный |
| Slack | `@slack/bolt-js` | Официальная библиотека Slack |
| Discord | `discord.js` | Наиболее популярная и стабильная |
| Telegram | `grammy` (текущая) | Современная, типизированная |

### 🛡️ Security Best Practices

1. **Webhook Verification**
   - Signature verification для всех провайдеров
   - Rate limiting на webhook endpoints
   - IP whitelisting где возможно

2. **Token Security**
   - Шифрование токенов в БД
   - Rotation tokens где поддерживается
   - Environment variables для secrets

3. **Error Handling**
   - Graceful degradation
   - Circuit breaker pattern
   - Comprehensive logging

### ⚡ Performance Optimization

1. **Connection Pooling**
   - Переиспользование HTTP connections
   - Keep-alive для API вызовов
   - Connection limits per provider

2. **Caching**
   - Redis для temporary data
   - In-memory cache для frequently accessed data
   - CDN для media content

3. **Monitoring**
   - Health checks для каждого провайдера
   - Metrics collection (Prometheus)
   - Alerting для critical failures

## Конфигурация и деплой

### 🐳 Docker Configuration

#### Multi-Provider Service
```dockerfile
# Dockerfile.multi-provider
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
EXPOSE 3000
CMD ["node", "dist/multi-provider-main.js"]
```

#### WhatsApp Web Instance
```dockerfile
# Dockerfile.whatsapp-web (existing)
FROM node:18-alpine
RUN apk add --no-cache chromium
# ... existing configuration
```

### 📝 Environment Variables

```bash
# Multi-Provider Service
MULTI_PROVIDER_PORT=3000
ENABLE_TELEGRAM=true
ENABLE_WHATSAPP_OFFICIAL=true
ENABLE_MESSENGER=true
ENABLE_INSTAGRAM=true
ENABLE_SLACK=true
ENABLE_DISCORD=true

# Provider-specific
TELEGRAM_WEBHOOK_PATH=/webhook/telegram
WHATSAPP_OFFICIAL_WEBHOOK_PATH=/webhook/whatsapp-official
# ... и т.д.
```

### 🚀 Kubernetes Deployment

```yaml
# k8s/multi-provider-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: multi-provider-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: multi-provider
  template:
    metadata:
      labels:
        app: multi-provider
    spec:
      containers:
      - name: multi-provider
        image: wweb-mcp:multi-provider
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

## Мониторинг и метрики

### 📊 Ключевые метрики

1. **Provider Health**
   - Connection status
   - Response times
   - Error rates
   - Message throughput

2. **Resource Usage**
   - Memory usage per provider
   - CPU usage
   - Database connections
   - Network I/O

3. **Business Metrics**
   - Messages sent/received per provider
   - Active instances
   - User engagement

### 🔍 Logging Strategy

```typescript
// Structured logging
logger.info('Message sent', {
  provider: 'telegram',
  instanceId: 'user-123',
  messageId: 'msg-456',
  recipientId: 'chat-789',
  timestamp: Date.now(),
  size: messageSize
});
```

## Roadmap

### Phase 1 (2-3 недели)
- ✅ Database migration
- 🚧 WhatsApp Official API
- 🚧 Multi-Provider Service основа

### Phase 2 (2-3 недели)  
- 🔄 Facebook Messenger
- 🔄 Instagram Direct
- 🔄 Integration testing

### Phase 3 (2-3 недели)
- 🔄 Slack integration
- 🔄 Discord integration
- 🔄 Advanced features

### Phase 4 (1-2 недели)
- 🔄 UI updates
- 🔄 Documentation
- 🔄 Production deployment

## Выводы

Эта архитектура обеспечивает:

- **Масштабируемость**: Тысячи API-based клиентов на одном сервере
- **Эффективность**: Минимальное потребление ресурсов
- **Надежность**: Isolation failures между провайдерами
- **Maintainability**: Четкое разделение ответственности
- **Flexibility**: Легкое добавление новых провайдеров

Следуя этому плану, мы создадим production-ready систему, способную конкурировать с лучшими решениями на рынке. 