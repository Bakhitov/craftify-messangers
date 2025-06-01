#!/bin/bash

echo "🚀 Starting development environment with hot reload..."
echo "📁 Code changes will be automatically compiled and reflected in Docker containers"
echo ""

# Проверяем, что Docker Compose запущен
echo "📊 Checking Instance Manager status..."
if ! docker ps | grep -q "wweb-mcp-instance-manager"; then
    echo "🔧 Starting Instance Manager..."
    docker-compose -f docker-compose.instance-manager.yml up -d
    sleep 5
else
    echo "✅ Instance Manager already running"
fi

echo ""
echo "🔄 Starting TypeScript watch mode..."
echo "💡 Press Ctrl+C to stop watching"
echo "📝 Make changes to TypeScript files - they will be compiled automatically!"
echo ""

# Запускаем TypeScript в watch режиме
pnpm run build -- --watch &
TS_PID=$!

# Функция для остановки всех процессов
cleanup() {
    echo ""
    echo "🛑 Stopping development environment..."
    kill $TS_PID 2>/dev/null
    echo "✅ Development environment stopped"
    exit 0
}

# Обработка Ctrl+C
trap cleanup SIGINT SIGTERM

# Показываем полезную информацию
echo "📋 Development Environment Info:"
echo "🌐 Instance Manager: http://localhost:3000"
echo "📚 API Documentation: http://localhost:3000/api/v1/instances"
echo ""
echo "🔧 Quick commands:"
echo "  • Test Telegram: node telegram-fixed-test.js"
echo "  • Instance Manager API: curl http://localhost:3000/health"
echo "  • View logs: docker logs wweb-mcp-instance-manager-1 -f"
echo ""

# Ждем изменений
wait $TS_PID 