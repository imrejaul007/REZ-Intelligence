# Merchant Growth OS

**Version:** 1.0  
**Date:** June 4, 2026  
**Company:** REZ-Intelligence  
**Repository:** [GitHub](https://github.com/imrejaul007/REZ-Intelligence)

---

## 🎯 Overview

Merchant Growth OS is a comprehensive marketing and growth platform that helps merchants acquire customers, increase revenue, and optimize campaigns using AI-powered automation.

### Key Features

- **AI Budget Optimization** - Automatically allocate marketing budget across channels
- **Growth Playbooks** - Pre-built templates for 15+ industries
- **Incrementality Testing** - Measure true campaign lift
- **Merchant Health Scoring** - Track business health
- **Offline Attribution** - Track walk-ins, calls, visits
- **Competitor Intelligence** - Real-time competitor monitoring
- **AI Review Responses** - Auto-generate review replies
- **Unified Offers** - Centralized offer management
- **Revenue Forecasting** - AI-powered predictions
- **Neighborhood Analytics** - Hyperlocal intelligence

---

## 📦 Services

### Core API Services (Ports 4290-4299)

| Port | Service | Description |
|------|---------|-------------|
| 4290 | `REZ-budget-optimizer` | AI budget allocation |
| 4291 | `REZ-growth-playbook` | 15+ industry playbooks |
| 4292 | `REZ-incrementality-testing` | Campaign lift measurement |
| 4293 | `REZ-merchant-health-score` | Health scoring |
| 4294 | `REZ-offline-attribution` | Walk-in, call tracking |
| 4295 | `REZ-competitor-alerts` | Competitor monitoring |
| 4296 | `REZ-review-response-engine` | AI review responses |
| 4297 | `REZ-unified-offer-brain` | Centralized offers |
| 4298 | `REZ-autonomous-growth-agent` | Self-managing campaigns |
| 4299 | `REZ-prompt-studio` | Prompt versioning |

### UI Services (Ports 3000, 4211-4215)

| Port | Service | Description |
|------|---------|-------------|
| 3000 | `REZ-visual-workflow-builder-ui` | Drag-drop workflow editor |
| 4211 | `REZ-approval-ui` | Human approval dashboard |
| 4215 | `REZ-growth-dashboard` | Management dashboard |

### Intelligence Services (Ports 4212-4214)

| Port | Service | Description |
|------|---------|-------------|
| 4212 | `REZ-real-pricing-tracker` | Real-time pricing |
| 4213 | `REZ-revenue-forecast` | Revenue prediction |
| 4214 | `REZ-neighborhood-analytics` | Hyperlocal intel |

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
cd REZ-Intelligence
npm install
```

### 2. Start Services

```bash
# Using Docker
docker-compose up -d

# Or individually
cd REZ-budget-optimizer && npm run dev
cd REZ-growth-playbook && npm run dev
# ... etc
```

### 3. Verify

```bash
curl http://localhost:4290/health
curl http://localhost:4291/health
```

---

## 🔗 Ecosystem Integration

### RABTUL Services (Authentication, Wallet, Payment)

```typescript
AUTH_SERVICE_URL=https://rez-auth-service.onrender.com
WALLET_SERVICE_URL=https://rez-wallet-service.onrender.com
PAYMENT_SERVICE_URL=https://rez-payment-service.onrender.com
```

### HOJAI Services (AI Brain)

```typescript
HOJAI_BRAIN_URL=http://localhost:4600
```

### Internal Services

```typescript
CAMPAIGN_SERVICE_URL=http://localhost:4301
ANALYTICS_SERVICE_URL=http://localhost:4304
LOYALTY_SERVICE_URL=http://localhost:4305
QR_SERVICE_URL=http://localhost:4306
NOTIFICATION_SERVICE_URL=http://localhost:4307
POS_SERVICE_URL=http://localhost:4308
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| `MERCHANT-GROWTH-OS-AUDIT.md` | Complete audit report |
| `MERCHANT-GROWTH-OS-API.md` | API documentation |
| `ECOSYSTEM-INTEGRATION.md` | Integration guide |
| `MERCHANT-GROWTH-OS-COMPLETE.md` | Implementation guide |

---

## 🛠️ Development

### Directory Structure

```
REZ-Intelligence/
├── REZ-budget-optimizer/           # Port 4290
├── REZ-growth-playbook/            # Port 4291
├── REZ-incrementality-testing/      # Port 4292
├── REZ-merchant-health-score/      # Port 4293
├── REZ-offline-attribution/        # Port 4294
├── REZ-competitor-alerts/          # Port 4295
├── REZ-review-response-engine/      # Port 4296
├── REZ-unified-offer-brain/       # Port 4297
├── REZ-autonomous-growth-agent/     # Port 4298
├── REZ-prompt-studio/              # Port 4299
├── REZ-approval-ui/               # Port 4211
├── REZ-real-pricing-tracker/       # Port 4212
├── REZ-revenue-forecast/           # Port 4213
├── REZ-neighborhood-analytics/     # Port 4214
├── REZ-visual-workflow-builder-ui/   # Port 3000
├── REZ-growth-dashboard/           # Port 4215
├── REZ-growth-sdk/                 # Client SDK
├── docker-compose.yml              # Container orchestration
├── kubernetes-deployment.yaml      # K8s manifests
└── deploy-all.sh                  # Deployment script
```

### Running Tests

```bash
cd REZ-budget-optimizer
npm test
```

### Using the SDK

```bash
cd REZ-growth-sdk
npm install
```

```typescript
import { MerchantGrowthSDK } from '@rez/merchant-growth-sdk';

const sdk = new MerchantGrowthSDK({
  apiKey: 'your-key',
  baseUrl: 'http://localhost:4290'
});

const budget = await sdk.budget.optimize({
  merchantId: 'm123',
  totalBudget: 100000,
  strategy: 'roas_based'
});
```

---

## 🔒 Security

- API Key authentication
- JWT validation via RABTUL Auth
- Rate limiting (100 req/min)
- Merchant data isolation
- Internal service tokens

---

## 📊 Monitoring

- Prometheus metrics at `/metrics`
- Health checks at `/health`
- Request logging
- Error tracking

---

## 🚢 Deployment

### Docker

```bash
docker-compose up -d
```

### Kubernetes

```bash
kubectl apply -f kubernetes-deployment.yaml
```

---

## 📈 Coverage

| Category | Coverage |
|----------|----------|
| Marketing & Campaigns | 100% |
| Customer Intelligence | 100% |
| Loyalty & Rewards | 100% |
| Distribution & Channels | 100% |
| Infrastructure | 100% |
| **Overall** | **100%** |

---

## 🤝 Contributing

1. Create a feature branch
2. Make changes
3. Add tests
4. Submit PR

---

## 📄 License

MIT

---

**Last Updated:** June 4, 2026
