# Cosmic OS - Production Deployment Guide

## Overview

This guide covers deploying Cosmic OS and connecting it to the REZ ecosystem.

---

## Quick Deploy (One Command)

```bash
# From REZ-Intelligence/Cosmic-OS directory
./deploy.sh
```

---

## Manual Deployment

### Step 1: Deploy Backend Services

```bash
# REZ Emotional Intelligence (Port 4160)
cd ../REZ-emotional-intelligence
npm install && npm run build
PORT=4160 npm start &

# REZ Life Pattern Engine (Port 4161)
cd ../REZ-life-pattern-engine
npm install && npm run build
PORT=4161 npm start &

# REZ Human Context Graph (Port 4162)
cd ../REZ-human-context-graph
npm install && npm run build
PORT=4162 npm start &

# Cosmic OS (Port 4163)
cd ../Cosmic-OS
npm install && npm run build
PORT=4163 npm start &
```

### Step 2: Update Environment Variables

Create `.env` files with production URLs:

```bash
# REZ-emotional-intelligence/.env
PORT=4160
MONGODB_URI=mongodb://your-mongo-uri
LOG_LEVEL=info

# REZ-life-pattern-engine/.env
PORT=4161
MONGODB_URI=mongodb://your-mongo-uri
LOG_LEVEL=info

# REZ-human-context-graph/.env
PORT=4162
MONGODB_URI=mongodb://your-mongo-uri
EMOTIONAL_SERVICE_URL=http://emotional-intelligence:4160
LIFE_PATTERN_SERVICE_URL=http://life-pattern-engine:4161
SIGNAL_AGGREGATOR_URL=http://localhost:4142
LOG_LEVEL=info

# Cosmic-OS/.env
PORT=4163
MONGODB_URI=mongodb://your-mongo-uri
RABTUL_AUTH_URL=https://rez-auth-service.onrender.com
RABTUL_WALLET_URL=https://rez-wallet-service-36vo.onrender.com
RABTUL_NOTIFICATION_URL=https://rez-notifications-service.onrender.com
RABTUL_PROFILE_URL=https://rez-profile-service.onrender.com
EMOTIONAL_SERVICE_URL=http://emotional-intelligence:4160
LIFE_PATTERN_SERVICE_URL=http://life-pattern-engine:4161
HUMAN_CONTEXT_URL=http://human-context-graph:4162
INTERNAL_SERVICE_TOKEN=your-secure-token
LOG_LEVEL=info
```

---

## Docker Deployment

### Using Docker Compose

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Using Individual Docker Containers

```bash
# Build image
docker build -t cosmic-os .

# Run container
docker run -d \
  --name cosmic-os \
  -p 4163:4163 \
  -e MONGODB_URI=mongodb://your-uri \
  -e RABTUL_AUTH_URL=https://rez-auth-service.onrender.com \
  cosmic-os
```

---

## Render Deployment

### Prerequisites

1. Connect your GitHub repo to Render
2. Add environment variables in Render dashboard

### Services to Deploy

| Service | Name | Port | Build Command |
|---------|------|------|--------------|
| REZ-emotional-intelligence | cosmic-emotional-intelligence | 4160 | `npm ci && npm run build` |
| REZ-life-pattern-engine | cosmic-life-pattern-engine | 4161 | `npm ci && npm run build` |
| REZ-human-context-graph | cosmic-human-context-graph | 4162 | `npm ci && npm run build` |
| Cosmic-OS | cosmic-os | 4163 | `npm ci && npm run build` |

### Render Blueprint

Use the `render.yaml` file for automatic deployment:

```bash
# Install Render CLI
npm install -g @render/cloud-cli

# Login
render login

# Deploy
render deploy --config render.yaml
```

---

## Connect Ecosystem Services

### RisaCare (Health)

Add to RisaCare service environment:
```bash
COSMIC_OS_URL=https://cosmic-os.onrender.com
```

### REZ Consumer (Commerce)

Add to REZ Consumer environment:
```bash
COSMIC_OS_URL=https://cosmic-os.onrender.com
```

### ReZ Ride (Mobility)

Add to ReZ Ride environment:
```bash
COSMIC_OS_URL=https://cosmic-os.onrender.com
```

### CorpPerks (Career)

Add to CorpPerks environment:
```bash
COSMIC_OS_URL=https://cosmic-os.onrender.com
```

---

## Verify Deployment

### Health Checks

```bash
# Check each service
curl https://cosmic-emotional-intelligence.onrender.com/health
curl https://cosmic-life-pattern-engine.onrender.com/health
curl https://cosmic-human-context-graph.onrender.com/health
curl https://cosmic-os.onrender.com/health
```

### API Tests

```bash
# Test mood check-in
curl -X POST https://cosmic-os.onrender.com/api/mood/checkin \
  -H "Content-Type: application/json" \
  -d '{"userId":"test123","mood":"peaceful","energy":4}'

# Test cosmic context
curl https://cosmic-os.onrender.com/api/cosmic/test123

# Test AI Council
curl -X POST https://cosmic-os.onrender.com/api/cosmic/council \
  -H "Content-Type: application/json" \
  -d '{"userId":"test123","agents":["mystic","healer"]}'
```

---

## Mobile App Configuration

Update app.json or environment:

```bash
EXPO_PUBLIC_COSMIC_API_URL=https://cosmic-os.onrender.com
```

---

## Troubleshooting

### Service Not Starting

```bash
# Check logs
docker-compose logs [service-name]

# Restart service
docker-compose restart [service-name]
```

### Database Connection Failed

1. Verify MongoDB URI is correct
2. Check MongoDB is accessible from service
3. Verify network/firewall settings

### RABTUL Service Errors

1. Verify RABTUL service URLs are correct
2. Check INTERNAL_SERVICE_TOKEN matches
3. Verify service tokens in RABTUL dashboard

---

## Production Checklist

- [ ] All 4 backend services deployed
- [ ] MongoDB connection verified
- [ ] RABTUL service URLs configured
- [ ] INTERNAL_SERVICE_TOKEN set securely
- [ ] Health checks passing
- [ ] API endpoints responding
- [ ] Mobile app configured with production URL
- [ ] Ecosystem services connected
- [ ] Monitoring set up
- [ ] Logs aggregated

---

## Support

For issues, check:
1. Service logs
2. MongoDB connection
3. RABTUL service status
4. Network connectivity
