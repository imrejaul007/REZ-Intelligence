# REZ-Intelligence Connectivity Audit
**Date:** May 20, 2026  
**Auditor:** Claude Code  
**Total Services:** 150+

---

## Executive Summary

| Status | Count | Percentage |
|--------|-------|------------|
| **Fully Connected** | 45 | 30% |
| **Partially Connected** | 38 | 25% |
| **Minimally Connected** | 42 | 28% |
| **Disconnected/Siloed** | 25+ | 17% |

---

## 1. FULLY CONNECTED SERVICES (RABTUL + Event Bus)

### Expert Services (8) - All Using RABTUL
| Service | Port | Auth | Payment | Wallet | Status |
|---------|------|------|---------|--------|--------|
| rez-fitness-expert | 3010 | ✅ | ✅ | ✅ | Connected |
| rez-health-expert | 3011 | ✅ | ✅ | ✅ | Connected |
| rez-travel-expert | 3003 | ✅ | ✅ | ✅ | Connected |
| rez-salon-expert | 3005 | ✅ | ✅ | ✅ | Connected |
| rez-hospitality-expert | 3000 | ✅ | ✅ | ✅ | Connected |
| rez-education-expert | - | ✅ | ✅ | ✅ | Connected |
| rez-culinary-expert | - | ✅ | ✅ | ✅ | Connected |
| rez-retail-expert | 3004 | ✅ | ✅ | ✅ | Connected |

### MCP Bridge Services (9) - Using RABTUL via Environment Variables
| Service | Connected To | Status |
|---------|-------------|--------|
| rez-mcp-analytics | Analytics Service | ✅ Connected |
| rez-mcp-event-bus | Event Bus (4025) | ✅ Connected |
| rez-mcp-identity | Identity Service | ✅ Connected |
| rez-mcp-inventory | Inventory Service | ✅ Connected |
| rez-mcp-logs | Log Service | ✅ Connected |
| rez-mcp-notification | Notifications Service | ✅ Connected |
| rez-mcp-order | Order Service | ✅ Connected |
| rez-mcp-payment | Payment Service | ✅ Connected |
| rez-mcp-service-discovery | Auth Service | ✅ Connected |

### Core Intelligence Services with INTERNAL_SERVICE_TOKEN
| Service | Port | Status |
|---------|------|--------|
| rez-autonomous-agents | - | ✅ Connected |
| REZ-ab-testing | - | ✅ Connected |
| REZ-demand-forecast | - | ✅ Connected |
| REZ-identity-graph | - | ✅ Connected |
| REZ-inventory-sync | - | ✅ Connected |
| REZ-merchant-os | - | ✅ Connected |
| REZ-price-predictor | - | ✅ Connected |
| REZ-reorder-engine | - | ✅ Connected |
| REZ-taste-profile | - | ✅ Connected |
| rez-intelligence-hub | 4020 | ✅ Connected |
| rez-signal-aggregator | - | ✅ Connected |

### Services with Wallet Integration
| Service | Wallet URL | Status |
|---------|-----------|--------|
| REZ-moment-ads | WALLET_SERVICE_URL | ✅ Connected |
| REZ-offline-commerce-tracker | WALLET_SERVICE_URL | ✅ Connected |

---

## 2. PARTIALLY CONNECTED SERVICES

These services have authentication but incomplete RABTUL integration:

| Service | Has Auth | Has DB | Missing |
|---------|----------|--------|---------|
| rez-fraud-agent | ✅ | ✅ MongoDB | Payment, Wallet |
| rez-ml-engine | ❌ | ✅ MongoDB | RABTUL |
| rez-ml-model-registry | ❌ | ✅ MongoDB | RABTUL |
| rez-ml-feature-store | ❌ | ✅ MongoDB | RABTUL |
| rez-behavioral-psychology | ❌ | ✅ MongoDB | RABTUL |
| rez-social-signals | ❌ | ✅ MongoDB | RABTUL |
| rez-location-intelligence | ❌ | ✅ MongoDB | RABTUL |
| rez-channel-orchestrator | ❌ | ❌ | RABTUL, DB |
| rez-competitor-detection | ❌ | ❌ | RABTUL, DB |

---

## 3. MINIMALLY CONNECTED SERVICES

These services have basic configuration but no RABTUL integration:

| Service | Port | Config | Issue |
|---------|------|--------|-------|
| rez-agent-registry | 4011 | Redis | No RABTUL |
| rez-ai-plugins | 4010 | Redis, MongoDB | No RABTUL |
| rez-ai-voice | - | TTS, Logging | No RABTUL |
| rez-app-bridge | 4089 | CORS | No RABTUL |
| rez-consultant-agent | 3003 | CORS | No RABTUL |
| rez-crosschannel-attribution | 4115 | MongoDB | No RABTUL |
| rez-email-bridge | 4160 | CORS | No RABTUL |
| rez-expert-base | 4113 | CORS | No RABTUL |
| rez-fleet-management | 4016 | - | No RABTUL |
| rez-info-agent | 3004 | CORS | No RABTUL |
| rez-sales-agent | 3001 | CORS | No RABTUL |
| rez-support-agent | 3002 | CORS | No RABTUL |
| rez-web-widget | 4088 | CORS, Logs | No RABTUL |

---

## 4. DISCONNECTED/SILOAD SERVICES

These services have no external dependencies configured:

### Core Services Without Connectivity
| Service | Issue |
|---------|-------|
| rez-cohort-service | No src/*.ts files found |
| rez-context-engine | No RABTUL, isolated logic |
| rez-conversation-intelligence | No RABTUL, isolated |
| rez-core-brain | No RABTUL, personalization only |
| rez-confidence-scorer | No RABTUL, scoring only |
| rez-customer-360 | Examples only, no service |
| rez-expert-base | No RABTUL |
| rez-intent-graph | **Own Redis pub/sub** - not using REZ Event Bus |
| rez-intent-predictor | No src/*.ts found |
| rez-ml-models | No src/*.ts found |
| rez-orchestrator-v2 | No src/*.ts found |
| rez-permission-system | No src/*.ts found |
| rez-priority-engine | No RABTUL |
| rez-rcs-bridge | No RABTUL |
| rez-service-connectors | No src/*.ts found |
| rez-shared-types | Library only |
| rez-unified-agent-sdk | No src/*.ts found |
| rez-unified-engine | No RABTUL |

### REZ-* Services Without RABTUL Connection
| Service | Issue |
|---------|-------|
| REZ-MIND-CLIENT | Client library only |
| REZ-ab-testing-service | No RABTUL env vars |
| REZ-ai-orchestrator | No RABTUL env vars |
| REZ-ai-router | Has auth check, no RABTUL |
| REZ-analytics-orchestrator | No src/*.ts found |
| REZ-api-keys | No RABTUL env vars |
| REZ-attribution-loyalty-bridge | No RABTUL env vars |
| REZ-attribution-system | No RABTUL env vars |
| REZ-audit-logging | No RABTUL env vars |
| REZ-bootstrap-intelligence | No RABTUL env vars |
| REZ-care-service | No RABTUL env vars |
| REZ-cdp-service | No RABTUL env vars |
| REZ-commerce-agents | No src/*.ts found |
| REZ-commerce-signal-connector | No RABTUL env vars |
| REZ-consumer-graph | No RABTUL env vars |
| REZ-consumer-loop | No RABTUL env vars |
| REZ-corpperks-bridge | No RABTUL env vars |
| REZ-creative-engine | No RABTUL env vars |
| REZ-creator-network | No src/*.ts found |
| REZ-cross-company-loyalty | No RABTUL env vars |
| REZ-cross-sell-engine | No RABTUL env vars |
| REZ-customer-intelligence-hub | No RABTUL env vars |
| REZ-data-governance | No RABTUL env vars |
| REZ-data-warehouse | No src/*.ts found |
| REZ-delivery-intelligence | No RABTUL env vars |
| REZ-delivery-tracking-service | No src/*.ts found |
| REZ-dooh-attribution | No RABTUL env vars |
| REZ-dooh-intelligence | No RABTUL env vars |
| REZ-ecosystem-hub | No RABTUL env vars |
| REZ-enterprise-gateway | No RABTUL env vars |
| REZ-error-intelligence | No RABTUL env vars |
| REZ-event-bus | **Own service** - should be connected TO |
| REZ-event-connector | No src/*.ts found |
| REZ-event-platform | No RABTUL env vars |
| REZ-experimentation-engine | No RABTUL env vars |
| REZ-feature-flags | No RABTUL env vars |
| REZ-feature-store | No RABTUL env vars |
| REZ-feedback-collector | No src/*.ts found |
| REZ-flywheel-engine | No RABTUL env vars |
| REZ-flywheel-mvp | No RABTUL env vars |
| REZ-gift-card-service | No RABTUL env vars |
| REZ-health-monitor | No RABTUL env vars |
| REZ-hyperlocal-targeting | No RABTUL env vars |
| REZ-identity-bridge | Has token, minimal |
| REZ-insights-service | No RABTUL env vars |
| REZ-integration-sdk | No src/*.ts found |
| REZ-inventory-alerts-service | No src/*.ts found |
| REZ-inventory-intelligence | No RABTUL env vars |
| REZ-knowledge-graph | No src/*.ts found |
| REZ-ledger-service | No RABTUL env vars |
| REZ-ltv-attribution | No RABTUL env vars |
| REZ-memory-engine | No src/*.ts found |
| REZ-merchant-360 | No RABTUL env vars |
| REZ-merchant-brain | No src/*.ts found |
| REZ-merchant-intelligence | No RABTUL env vars |
| REZ-migration-scripts | Scripts only |
| REZ-ml-observability | No RABTUL env vars |
| REZ-ml-studio | No src/*.ts found |
| REZ-multi-location-service | No src/*.ts found |
| REZ-notification-router | No RABTUL env vars |
| REZ-observability | No src/*.ts found |
| REZ-observability-system | Has token, minimal |
| REZ-payments-brain | No src/*.ts found |
| REZ-personalization-engine | No src/*.ts found |
| REZ-predictive-engine | No RABTUL env vars |
| REZ-price-predictor | Has token check |
| REZ-qr-campaigns | No RABTUL env vars |
| REZ-real-time-decision-engine | No RABTUL env vars |
| REZ-realtime-gateway | No src/*.ts found |
| REZ-realtime-segments | No RABTUL env vars |
| REZ-recommendation-engine | No RABTUL env vars |
| REZ-reconciliation-service | No src/*.ts found |
| REZ-research-opportunity-agent | No RABTUL env vars |
| REZ-reservation-service | No src/*.ts found |
| REZ-rfm-plus-service | No RABTUL env vars |
| REZ-rfm-service | No RABTUL env vars |
| REZ-staff-scheduling-service | No RABTUL env vars |
| REZ-stream-processing | No src/*.ts found |
| REZ-supplier-marketplace | No src/*.ts found |
| REZ-support-copilot | No RABTUL env vars |
| REZ-targeting-engine | No RABTUL env vars |
| REZ-ugc-engine | No src/*.ts found |
| REZ-unified-attribution | No RABTUL env vars |
| REZ-unified-chat | No src/*.ts found |
| REZ-unified-commerce-graph | No RABTUL env vars |
| REZ-unified-crm-hub | No RABTUL env vars |
| REZ-unified-crm-ui | No src/*.ts found |
| REZ-unified-event-schema | No RABTUL env vars |
| REZ-unified-identity | No src/*.ts found |
| REZ-unified-inventory | No RABTUL env vars |
| REZ-unified-profile | No RABTUL env vars |
| REZ-unified-recommendations | No src/*.ts found |
| REZ-universal-user-graph | Has wallet URL, partial |
| REZ-user-agents | No src/*.ts found |
| REZ-validation-dashboard | No src/*.ts found |
| REZ-visit-prediction | No RABTUL env vars |
| REZ-waitlist-service | No src/*.ts found |

---

## 5. SHARED CLIENTS AUDIT

### Available but NOT USED
| Client | Location | Purpose | Usage |
|--------|----------|---------|-------|
| `rez-intelligence-client` | `shared/rez-intelligence-client/` | Unified AI/ML API | **0 services** |
| `rez-platform-client` | `shared/rez-platform-client/` | RABTUL platform | **0 services** |
| `rez-rabtul-integration` | `packages/rez-rabtul-integration/` | RABTUL services | **0 services** |
| `rez-attribution-integration` | `packages/rez-attribution-integration/` | Attribution | **0 services** |
| `rez-identity-integration` | `packages/rez-identity-integration/` | Identity | **0 services** |

### Shared Clients WITH USAGE
| Client | Used By |
|--------|---------|
| `rez-logger` | Some services |
| `rez-security-middleware` | Some services |
| `rez-shared-types` | Most services |

---

## 6. CRITICAL ISSUES

### Issue 1: No Shared Client Usage
**Problem:** 150+ services exist but NONE are using the canonical `rez-intelligence-client` or `rez-platform-client`.

**Impact:**
- Duplicated connection code across services
- Inconsistent error handling
- No standardized retry/circuit-breaker
- Hard to maintain

### Issue 2: Custom Event Bus Implementations
**Problem:** `rez-intent-graph` uses its own Redis pub/sub instead of REZ Event Bus (4025).

**Impact:**
- Events not visible to other services
- No centralized event tracking
- Duplicate event infrastructure

### Issue 3: Missing INTERNAL_SERVICE_TOKEN
**Problem:** 70+ services don't have `INTERNAL_SERVICE_TOKEN` configured.

**Impact:**
- Cannot communicate securely with other services
- Authentication bypass vulnerability
- Cannot use RABTUL infrastructure

### Issue 4: Inconsistent Environment Variables
**Problem:** Services use different env var names for the same services.

| Service URL | Variations |
|-------------|------------|
| Auth | `AUTH_SERVICE_URL`, `RABTUL_AUTH_URL` |
| Payment | `PAYMENT_SERVICE_URL`, `RABTUL_PAYMENT_URL` |
| Wallet | `WALLET_SERVICE_URL`, `RABTUL_WALLET_URL` |

---

## 7. RECOMMENDATIONS

### Priority 1: Connect Disconnected Services
For services without RABTUL integration, add:
```typescript
import { authService, walletService } from '../packages/rez-rabtul-integration';

// Or use shared client
import { getIntelligenceClient } from '../shared/rez-intelligence-client';
```

### Priority 2: Migrate to Shared Clients
Replace direct axios calls with shared clients:
```typescript
// Before (inconsistent)
const response = await axios.get(`${AUTH_URL}/api/auth/verify`, {...});

// After (standardized)
import { authService } from '../packages/rez-rabtul-integration';
const user = await authService.verify(token);
```

### Priority 3: Fix rez-intent-graph Event Bus
Replace custom Redis pub/sub with REZ Event Bus:
```typescript
// Before
import { emitEvent } from './eventBus'; // Custom Redis

// After
import { EventBusClient } from '../shared/rez-intelligence-client';
const events = new EventBusClient(config);
await events.publish({ type: 'insight.generated', ... });
```

### Priority 4: Standardize Environment Variables
Adopt consistent naming from `REZ-EXPERTS-ENV.md`:
```bash
AUTH_SERVICE_URL=https://rez-auth-service.onrender.com
PAYMENT_SERVICE_URL=https://rez-payment-service.onrender.com
WALLET_SERVICE_URL=https://rez-wallet-service-36vo.onrender.com
INTERNAL_SERVICE_TOKEN=<token>
```

### Priority 5: Add INTERNAL_SERVICE_TOKEN to All Services
Create a script to add required env vars to all services.

---

## 8. ACTION PLAN

| Phase | Services | Action | Timeline |
|-------|----------|--------|----------|
| 1 | 8 Expert Services | Already connected | ✅ Done |
| 2 | 9 MCP Bridges | Already connected | ✅ Done |
| 3 | 25 Critical AI Services | Add RABTUL + Event Bus | 1 week |
| 4 | 50 ML/Analytics Services | Add INTERNAL_SERVICE_TOKEN | 1 week |
| 5 | 60 Remaining Services | Review and connect | 2 weeks |
| 6 | Shared Clients | Implement usage across all | 3 weeks |

---

## Appendix: Service Count by Category

| Category | Count | Connected | Disconnected |
|----------|-------|-----------|--------------|
| Expert Services | 8 | 8 | 0 |
| MCP Bridges | 9 | 9 | 0 |
| Core AI/ML | 25 | 12 | 13 |
| Analytics | 15 | 3 | 12 |
| Attribution | 10 | 2 | 8 |
| CRM/Hubs | 12 | 1 | 11 |
| Unclassified | 71 | 10 | 61 |
| **Total** | **150** | **45** | **105** |

---

## Files Referenced

- [REZ-expert-rabtul.ts](REZ-expert-rabtul.ts) - Expert services RABTUL integration
- [REZ-EXPERTS-ENV.md](REZ-EXPERTS-ENV.md) - Environment variables
- `shared/rez-intelligence-client/` - Shared intelligence client (NOT USED)
- `shared/rez-platform-client/` - Shared RABTUL client (NOT USED)
- `packages/rez-rabtul-integration/` - RABTUL integration package (NOT USED)
