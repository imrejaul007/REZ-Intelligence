# REZ Intelligence - SOT Reference

**Version:** 4.0
**Date:** June 4, 2026
**Merchant Growth OS:** 16 New Services Added
**Master SOT:** [RABTUL-Technologies/SOT.md](https://github.com/imrejaul007/RABTUL-Technologies/blob/main/SOT.md)

---

## MERCHANT GROWTH OS - NEW SERVICES (June 4, 2026)

### Complete Marketing & Growth Suite

| Service | Port | Category | Status |
|---------|------|----------|--------|
| **REZ-budget-optimizer** | 4290 | Budget Allocation | ✅ NEW |
| **REZ-growth-playbook** | 4291 | Growth Templates | ✅ NEW |
| **REZ-incrementality-testing** | 4292 | Campaign Testing | ✅ NEW |
| **REZ-merchant-health-score** | 4293 | Merchant Health | ✅ NEW |
| **REZ-offline-attribution** | 4294 | Attribution | ✅ NEW |
| **REZ-competitor-alerts** | 4295 | Competition | ✅ NEW |
| **REZ-review-response-engine** | 4296 | Reviews | ✅ NEW |
| **REZ-unified-offer-brain** | 4297 | Offers | ✅ NEW |
| **REZ-autonomous-growth-agent** | 4298 | Growth AI | ✅ NEW |
| **REZ-prompt-studio** | 4299 | Prompt Versioning | ✅ NEW |
| **REZ-approval-ui** | 4211 | Human Approval | ✅ NEW |
| **REZ-real-pricing-tracker** | 4212 | Pricing | ✅ NEW |
| **REZ-revenue-forecast** | 4213 | Forecasting | ✅ NEW |
| **REZ-neighborhood-analytics** | 4214 | Hyperlocal | ✅ NEW |
| **REZ-visual-workflow-builder-ui** | 3000 | Workflow UI | ✅ NEW |
| **REZ-plugin-marketplace** | 4210 | Plugins | ✅ NEW (hojai-ai) |

**Total:** 16 new services + ecosystem integration

---

## ECOSYSTEM INTEGRATION

Each service connects to:

| Integration | Service | Purpose |
|-------------|---------|---------|
| **RABTUL Auth** | `https://rez-auth-service.onrender.com` | Merchant verification |
| **RABTUL Wallet** | `https://rez-wallet-service.onrender.com` | Cashback, payments |
| **HOJAI Brain** | `http://localhost:4600` | AI recommendations |
| **Campaign Service** | `http://localhost:4301` | Campaign execution |

---

## Quick Links

| Document | Location |
|----------|----------|
| **Master SOT** | `RABTUL-Technologies/SOT.md` |
| **API Documentation** | `MERCHANT-GROWTH-OS-API.md` |
| **Integration Docs** | `ECOSYSTEM-INTEGRATION.md` |
| **Docker Compose** | `docker-compose.yml` |
| **K8s Manifests** | `kubernetes-deployment.yaml` |
| **Deployment** | `deploy-all.sh` |

---

## DEPLOYMENT

```bash
# Run deployment script
cd REZ-Intelligence
./deploy-all.sh

# Or manually
docker-compose up -d

# Verify
curl http://localhost:4290/health
curl http://localhost:4291/health
```

---

## PREVIOUS SERVICES (Preserved)

### AI & Agents

| Service | Port | Status |
|---------|------|--------|
| REZ-autonomous-agents | 4062 | ✅ |
| REZ-ai-orchestrator | 4101 | ✅ |
| REZ-creative-engine | 4107 | ✅ |
| REZ-support-copilot | 4033 | ✅ |

### OADA Loop

| Service | Port | Status |
|---------|------|--------|
| REZ-autonomous-loop | 4800 | ✅ |
| REZ-company-memory | 4801 | ✅ |
| REZ-live-action-feed | 4802 | ✅ |

### MCP Servers

| Service | Status |
|---------|--------|
| rez-mcp-analytics | ✅ |
| rez-mcp-identity | ✅ |
| rez-mcp-notification | ✅ |
| rez-mcp-event-bus | ✅ |
| rez-mcp-agent-invoke | ✅ |

### Targeting & Personalization

| Service | Status |
|---------|--------|
| REZ-targeting-engine | ✅ |
| REZ-personalization-engine | ✅ |
| REZ-hyperlocal-targeting | ✅ |
| REZ-recommendation-engine | ✅ |

### Merchant Intelligence

| Service | Status |
|---------|--------|
| REZ-merchant-intelligence | ✅ |
| REZ-merchant-brain | ✅ |
| REZ-merchant-360 | ✅ |
| REZ-competitor-detection | ✅ |

### Attribution

| Service | Status |
|---------|--------|
| REZ-attribution-system | ✅ |
| REZ-crosschannel-attribution | ✅ |
| REZ-dooh-attribution | ✅ |
| REZ-ltv-attribution | ✅ |

### Loyalty & Rewards

| Service | Status |
|---------|--------|
| REZ-karma-loyalty-bridge | ✅ |
| REZ-cross-company-loyalty | ✅ |
| REZ-gift-card-service | ✅ |
| REZ-feedback-collector | ✅ |

---

## PORT REGISTRY

| Port | Service | Category |
|------|---------|----------|
| 3000 | REZ-visual-workflow-builder-ui | Workflow UI |
| 3005 | rez-hospitality-expert | Expert Agent |
| 4018 | REZ-intent-predictor | Intent |
| 4050 | REZ-identity-graph | Identity |
| 4051 | REZ-memory-engine | Memory |
| 4055 | REZ-care-service | Support |
| 4062 | REZ-autonomous-agents | AI Agents |
| 4063 | REZ-supplier-marketplace | B2B |
| 4064 | REZ-inventory-alerts | Inventory |
| 4065 | REZ-bootstrap-intelligence | Cold Start |
| 4101 | REZ-ai-orchestrator | AI |
| 4107 | REZ-creative-engine | Creative |
| 4210 | REZ-plugin-marketplace | Plugins |
| 4211 | REZ-approval-ui | Approval |
| 4212 | REZ-real-pricing-tracker | Pricing |
| 4213 | REZ-revenue-forecast | Forecasting |
| 4214 | REZ-neighborhood-analytics | Hyperlocal |
| 4290 | REZ-budget-optimizer | Budget |
| 4291 | REZ-growth-playbook | Growth |
| 4292 | REZ-incrementality-testing | Testing |
| 4293 | REZ-merchant-health-score | Health |
| 4294 | REZ-offline-attribution | Attribution |
| 4295 | REZ-competitor-alerts | Competition |
| 4296 | REZ-review-response-engine | Reviews |
| 4297 | REZ-unified-offer-brain | Offers |
| 4298 | REZ-autonomous-growth-agent | Growth AI |
| 4299 | REZ-prompt-studio | Prompts |
| 4600 | HOJAI Enterprise Brain | Brain |
| 4601 | HOJAI Identity | Identity |
| 4602 | HOJAI Dashboard | Dashboard |
| 4603 | HOJAI Billing | Billing |
| 4604 | HOJAI Analytics | Analytics |
| 4605 | HOJAI API Gateway | Gateway |
| 4800 | REZ-autonomous-loop | OADA Loop |
| 4801 | REZ-company-memory | Memory |
| 4802 | REZ-live-action-feed | Actions |

---

## FILES ADDED

### Documentation
- `MERCHANT-GROWTH-OS-AUDIT.md` - Complete audit
- `MERCHANT-GROWTH-OS-API.md` - API docs
- `ECOSYSTEM-INTEGRATION.md` - Integration guide
- `MERCHANT-GROWTH-OS-COMPLETE.md` - Implementation guide

### Infrastructure
- `docker-compose.yml` - Container orchestration
- `kubernetes-deployment.yaml` - K8s manifests
- `deploy-all.sh` - Deployment script

### Integration Files
- `*/src/integrations.ts` - Ecosystem connections

### Tests
- `*/src/__tests__/api.test.ts` - Integration tests

---

**Last Updated:** June 4, 2026
**Version:** 4.0
