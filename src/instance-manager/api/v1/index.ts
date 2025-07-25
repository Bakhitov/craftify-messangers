import { Router } from 'express';
import { instancesRouter } from './instances';
import { resourcesRouter } from './resources';
import { logsRouter } from './logs';
import { companyMessagesRouter } from './company-messages';

export const v1Router = Router();

// Подключаем роутеры
v1Router.use('/instances', instancesRouter);
v1Router.use('/resources', resourcesRouter);
v1Router.use('/logs', logsRouter);
v1Router.use('/company', companyMessagesRouter);

// Базовый эндпоинт для проверки
v1Router.get('/', (_req, res) => {
  res.json({
    version: 'v1',
    endpoints: {
      instances: '/api/v1/instances',
      resources: '/api/v1/resources',
      logs: '/api/v1/logs',
      company: '/api/v1/company',
      ports: '/api/v1/resources/ports',
      performance: '/api/v1/resources/performance',
      health: '/api/v1/resources/health',
      stressTest: '/api/v1/resources/stress-test',
    },
    description: {
      instances: 'Управление инстансами WhatsApp',
      resources: 'Мониторинг ресурсов сервера',
      logs: 'Логи Instance Manager приложения',
      company: 'Работа с данными компании (инстансы и сообщения)',
      ports: 'Статистика использования портов',
      performance: 'Метрики производительности системы',
      health: 'Состояние здоровья системы',
      stressTest: 'Запуск стресс-тестирования',
    },
    company_endpoints: {
      instances: '/api/v1/company/{companyId}/instances',
      messages: '/api/v1/company/{companyId}/messages',
      messageStats: '/api/v1/company/{companyId}/messages/stats',
      recentMessages: '/api/v1/company/{companyId}/messages/recent',
    },
  });
});
