#!/bin/bash

# REZ Unified CRM Hub - Deployment Script

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}REZ Unified CRM Hub Deployment${NC}"
echo -e "${GREEN}========================================${NC}"

# Check environment
if [ ! -f .env ]; then
    echo -e "${YELLOW}Warning: .env file not found. Copy from .env.example${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${YELLOW}Created .env from .env.example. Please update with actual values.${NC}"
    fi
fi

# Build
echo -e "\n${GREEN}[1/3] Building application...${NC}"
npm run build

# Docker build
echo -e "\n${GREEN}[2/3] Building Docker image...${NC}"
docker build -t rez-unified-crm-hub:latest .

# Deploy
echo -e "\n${GREEN}[3/3] Deploying...${NC}"

# Check if docker network exists
if ! docker network inspect rez-network >/dev/null 2>&1; then
    echo -e "${YELLOW}Creating rez-network...${NC}"
    docker network create rez-network
fi

# Run container
docker stop rez-unified-crm-hub 2>/dev/null || true
docker rm rez-unified-crm-hub 2>/dev/null || true

docker run -d \
    --name rez-unified-crm-hub \
    --restart unless-stopped \
    -p 4100:4100 \
    -p 4101:4101 \
    --network rez-network \
    -e NODE_ENV=production \
    rez-unified-crm-hub:latest

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "\nEndpoints:"
echo -e "  Internal API:  http://localhost:4100"
echo -e "  Merchant API: http://localhost:4101"
echo -e "  Health:       http://localhost:4100/api/v1/health"
echo -e "\n${YELLOW}IMPORTANT: Internal API should NOT be exposed to merchants${NC}"
