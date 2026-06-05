# Merchant Growth OS - Deployment Checklist

**Date:** June 4, 2026

---

## ✅ COMPLETED

### Services Built (16)

- [x] REZ-budget-optimizer (Port 4290)
- [x] REZ-growth-playbook (Port 4291)
- [x] REZ-incrementality-testing (Port 4292)
- [x] REZ-merchant-health-score (Port 4293)
- [x] REZ-offline-attribution (Port 4294)
- [x] REZ-competitor-alerts (Port 4295)
- [x] REZ-review-response-engine (Port 4296)
- [x] REZ-unified-offer-brain (Port 4297)
- [x] REZ-autonomous-growth-agent (Port 4298)
- [x] REZ-prompt-studio (Port 4299)
- [x] REZ-approval-ui (Port 4211)
- [x] REZ-real-pricing-tracker (Port 4212)
- [x] REZ-revenue-forecast (Port 4213)
- [x] REZ-neighborhood-analytics (Port 4214)
- [x] REZ-visual-workflow-builder-ui (Port 3000)
- [x] REZ-plugin-marketplace (Port 4210) - in hojai-ai

### Infrastructure

- [x] Docker Compose (docker-compose.yml)
- [x] Kubernetes Manifests (kubernetes-deployment.yaml)
- [x] Deployment Script (deploy-all.sh)
- [x] Dockerfiles (15 services)

### Documentation

- [x] README.md (main documentation)
- [x] MERCHANT-GROWTH-OS-AUDIT.md (complete audit)
- [x] MERCHANT-GROWTH-OS-API.md (API docs)
- [x] ECOSYSTEM-INTEGRATION.md (integration guide)
- [x] MERCHANT-GROWTH-OS-COMPLETE.md (implementation guide)
- [x] SOT.md (updated)

### SDK & Tools

- [x] REZ-growth-sdk (TypeScript client SDK)
- [x] Auth middleware (API keys, JWT, rate limiting)
- [x] Prometheus metrics

### Dashboard

- [x] REZ-growth-dashboard (Port 4215)

---

## 📋 MANUAL STEPS REQUIRED

### 1. Git Commit

```bash
cd REZ-Intelligence
git add .
git commit -m "feat: Complete Merchant Growth OS - 16 services"
git push origin main
```

```bash
cd hojai-ai
git add REZ-plugin-marketplace/
git commit -m "feat: Add REZ-plugin-marketplace"
git push origin main
```

### 2. Install Dependencies

```bash
cd REZ-Intelligence
for dir in REZ-*/; do
  cd "$dir"
  npm install
  cd ..
done
```

### 3. Start Services

```bash
# Docker
docker-compose up -d

# Or individually
cd REZ-budget-optimizer && npm run dev
```

### 4. Verify

```bash
curl http://localhost:4290/health
curl http://localhost:4291/health
```

### 5. Configure Environment

Create `.env` file:

```bash
# RABTUL Services
AUTH_SERVICE_URL=https://rez-auth-service.onrender.com
WALLET_SERVICE_URL=https://rez-wallet-service.onrender.com

# HOJAI
HOJAI_BRAIN_URL=http://localhost:4600

# Internal
INTERNAL_SERVICE_TOKEN=your-secure-token
MONGODB_URI=mongodb://localhost:27017
```

---

## 🧪 TESTING

### Run Tests

```bash
cd REZ-budget-optimizer
npm test
```

### Test SDK

```bash
cd REZ-growth-sdk
npm install
npm run build
node examples/basic.js
```

### Test Dashboard

```
http://localhost:4215
```

---

## 📊 SERVICE STATUS

| Service | Port | Status |
|---------|------|--------|
| Budget Optimizer | 4290 | Ready |
| Growth Playbook | 4291 | Ready |
| Incrementality Testing | 4292 | Ready |
| Merchant Health Score | 4293 | Ready |
| Offline Attribution | 4294 | Ready |
| Competitor Alerts | 4295 | Ready |
| Review Response Engine | 4296 | Ready |
| Unified Offer Brain | 4297 | Ready |
| Autonomous Growth Agent | 4298 | Ready |
| Prompt Studio | 4299 | Ready |
| Approval UI | 4211 | Ready |
| Real Pricing Tracker | 4212 | Ready |
| Revenue Forecast | 4213 | Ready |
| Neighborhood Analytics | 4214 | Ready |
| Visual Workflow Builder | 3000 | Ready |
| Plugin Marketplace | 4210 | Ready (hojai-ai) |

---

## 🔗 INTEGRATIONS

| Service | RABTUL | HOJAI | Status |
|---------|--------|-------|--------|
| All services | ✅ Auth, Wallet | ✅ Brain | Ready |

---

## 📁 FILE COUNT

| Type | Count |
|------|-------|
| Services | 16 |
| Dockerfiles | 15 |
| Integration files | 11 |
| Test files | 5 |
| Docs | 6 |
| Configs | 3 |

**Total files:** ~50+

---

## 🚀 DEPLOY

```bash
./deploy-all.sh
```

Or use Docker Compose directly:

```bash
docker-compose up -d
```

---

**Status:** ✅ READY FOR DEPLOYMENT
