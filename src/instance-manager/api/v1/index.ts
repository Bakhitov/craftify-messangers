import { Router } from 'express';
import { instancesRouter } from './instances';
import { resourcesRouter } from './resources';

export const v1Router = Router();

// Подключаем роутеры
v1Router.use('/instances', instancesRouter);
v1Router.use('/resources', resourcesRouter);

// Базовый эндпоинт для проверки
v1Router.get('/', (_req, res) => {
  res.json({
    version: 'v1',
    endpoints: {
      instances: '/api/v1/instances',
      resources: '/api/v1/resources',
      ports: '/api/v1/resources/ports',
      performance: '/api/v1/resources/performance',
      health: '/api/v1/resources/health',
      stressTest: '/api/v1/resources/stress-test',
    },
    description: {
      instances: 'Управление инстансами WhatsApp',
      resources: 'Мониторинг ресурсов сервера',
      ports: 'Статистика использования портов',
      performance: 'Метрики производительности системы',
      health: 'Состояние здоровья системы',
      stressTest: 'Запуск стресс-тестирования',
    },
  });
});
