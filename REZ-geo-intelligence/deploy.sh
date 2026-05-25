#!/bin/bash
# REZ Geo Intelligence Deployment Script

set -e

SERVICE_NAME="rez-geo-intelligence"
PORT=4140
ENV=${1:-staging}

echo "=== Deploying $SERVICE_NAME to $ENV ==="

# Build
echo "Building..."
npm run build

# Stop existing service
echo "Stopping existing service..."
pkill -f "node.*$SERVICE_NAME" 2>/dev/null || true
sleep 2

# Start service
echo "Starting service on port $PORT..."
npm run start &

# Wait for health check
sleep 5
for i in {1..10}; do
  if curl -s http://localhost:$PORT/health | grep -q "healthy"; then
    echo "Service is healthy!"
    exit 0
  fi
  sleep 2
done

echo "Health check failed!"
exit 1
