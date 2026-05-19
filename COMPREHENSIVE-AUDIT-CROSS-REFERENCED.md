# REZ-Intelligence Comprehensive Audit Report
**Date:** May 19, 2026  
**Status:** COMPLETE & CROSS-REFERENCED  
**Last Git Commit:** 2eb2535 - "Security audit fixes - May 2026"

---

## Executive Summary

| Metric | Count | Status |
|--------|-------|--------|
| Total Directories | 159+ | |
| **Complete Services** (src + package.json) | 153 | 95% |
| **Incomplete Services** (src only) | 13 | 8% |
| **Empty Services** (package.json only) | 6 | 4% |
| Services with README | 112 | 70% |
| Services without README | 50 | 31% |
| Dockerfiles | 163 | |
| docker-compose files | 9 | |
| TypeScript Files | 1,289 | |
| JavaScript Files | 266 | |
| Test Files | 72 | |
| Port Conflicts | 40+ | CRITICAL |

---

## 1. Service Completeness Analysis

### Complete Services (153) ✓
These have both `src/` and `package.json`:

```
REZ-ab-testing, REZ-ab-testing-service, REZ-action-engine, REZ-ai-router,
REZ-api-keys, REZ-attribution-loyalty-bridge, REZ-attribution-system,
REZ-audit-logging, REZ-autonomous-agents, REZ-care-service, REZ-cdp-service,
REZ-commerce-agents, REZ-commerce-signal-connector, REZ-consumer-graph,
REZ-consumer-loop, REZ-creative-engine, REZ-cross-company-loyalty,
REZ-customer-intelligence-hub, REZ-data-warehouse, REZ-delivery-intelligence,
REZ-delivery-tracking-service, REZ-demand-forecast, REZ-dooh-attribution,
REZ-dooh-intelligence, REZ-ecosystem-hub, REZ-enterprise-gateway,
REZ-error-intelligence, REZ-event-bus, REZ-event-connector, REZ-event-platform,
REZ-experimentation-engine, REZ-feature-flags, REZ-feedback-collector,
REZ-flywheel-mvp, REZ-gift-card-service, REZ-health-monitor,
REZ-hyperlocal-targeting, REZ-identity-bridge, REZ-identity-graph,
REZ-insights-service, REZ-integration-sdk, REZ-inventory-alerts-service,
REZ-inventory-intelligence, REZ-inventory-sync, REZ-karma-loyalty-bridge,
REZ-knowledge-graph, REZ-ledger-service, REZ-ltv-attribution, REZ-memory-engine,
REZ-merchant-360, REZ-merchant-brain, REZ-merchant-intelligence, REZ-merchant-os,
REZ-multi-location-service, REZ-notification-router, REZ-observability,
REZ-observability-system, REZ-payments-brain, REZ-personalization-engine,
REZ-predictive-engine, REZ-price-predictor, REZ-qr-campaigns,
REZ-real-time-decision-engine, REZ-realtime-gateway, REZ-realtime-segments,
REZ-recommendation-engine, REZ-reconciliation-service, REZ-reorder-engine,
REZ-research-opportunity-agent, REZ-reservation-service, REZ-rfm-plus-service,
REZ-rfm-service, REZ-signal-aggregator, REZ-staff-scheduling-service,
REZ-supplier-marketplace, REZ-support-copilot, REZ-targeting-engine,
REZ-taste-profile, REZ-ugc-engine, REZ-unified-attribution, REZ-unified-chat,
REZ-unified-crm-hub, REZ-unified-crm-ui, REZ-unified-identity, REZ-unified-profile,
REZ-unified-recommendations, REZ-universal-user-graph, REZ-user-agents,
REZ-validation-dashboard, REZ-waitlist-service, rez-agent-registry,
rez-aggregator-hub, rez-ai-plugins, rez-ai-voice, rez-app-bridge,
rez-behavioral-psychology, rez-channel-orchestrator, rez-competitor-detection,
rez-confidence-scorer, rez-consultant-agent, rez-context-engine,
rez-conversation-intelligence, rez-core-brain, rez-crosschannel-attribution,
rez-culinary-expert, rez-customer-360, rez-education-expert, rez-email-bridge,
rez-eta-prediction, rez-expert-base, rez-fitness-expert, rez-fleet-management,
rez-fraud-agent, rez-health-expert, rez-hospitality-expert, rez-info-agent,
rez-intelligence-hub, rez-intent-graph, rez-intent-predictor, rez-lakehouse,
rez-location-intelligence, rez-mcp-agent-invoke, rez-mcp-analytics,
rez-mcp-event-bus, rez-mcp-identity, rez-mcp-inventory, rez-mcp-logs,
rez-mcp-notification, rez-mcp-order, rez-mcp-payment, rez-mcp-service-discovery,
rez-ml-feature-store, rez-ml-model-registry, rez-ml-models, rez-orchestrator-v2,
rez-priority-engine, rez-rcs-bridge, rez-retail-expert, rez-sales-agent,
rez-salon-expert, rez-service-connectors, rez-shared-types, rez-sms-bridge,
rez-social-signals, rez-support-agent, rez-travel-expert, rez-unified-agent-sdk,
rez-unified-engine, rez-web-widget, rez-whatsapp-orchestrator-bridge
```

### Incomplete Services (13) - MISSING package.json ⚠️

| Service | Issue | Priority |
|---------|-------|----------|
| REZ-MIND-CLIENT | Has ReZMindClient.ts but no package.json | HIGH |
| REZ-analytics-orchestrator | Has src/ with dashboards, modules | HIGH |
| REZ-data-governance | Has src/ directory | MEDIUM |
| REZ-feature-store | Has src/ directory | MEDIUM |
| REZ-migration-scripts | Has src/ directory | LOW |
| REZ-ml-studio | Has src/ directory | MEDIUM |
| REZ-stream-processing | Has src/ directory | MEDIUM |
| REZ-unified-event-schema | Has src/ directory | MEDIUM |
| REZ-unified-inventory | Has src/ directory | MEDIUM |
| rez-cohort-service | Has src/ directory | MEDIUM |
| rez-fraud-detection-service | Has src/ directory | MEDIUM |
| rez-ml-engine | Has models/, scripts/ | MEDIUM |
| rez-permission-system | Has src/ directory | MEDIUM |

### Empty Services (6) - MISSING src/ ⚠️

| Service | Issue | Priority |
|---------|-------|----------|
| REZ-data-platform | Has package.json, no src/ | HIGH |
| REZ-ml-production | Has package.json, no src/ | HIGH |
| rez-ai-platform | Has Dockerfile, no src/ | HIGH |
| rez-consumer-copilot | Has package.json, no src/ | HIGH |
| rez-e2e-tests | Has package.json, no src/ (tests in separate dir) | MEDIUM |
| rez-integration-tests | Has package.json, no src/ | MEDIUM |

---

## 2. Port Registry Cross-Reference

### CRITICAL CONFLICTS (7+ services)

| Port | Services | Conflict Count |
|------|----------|----------------|
| **3000** | REZ-audit-logging, REZ-creative-engine, REZ-experimentation-engine, REZ-observability-system, REZ-real-time-decision-engine, rez-ai-voice, rez-expert-base | **7** |
| **4059** | REZ-hyperlocal-targeting, REZ-predictive-engine, REZ-signal-aggregator, rez-competitor-detection | **4** |
| **4060** | REZ-delivery-tracking-service, REZ-knowledge-graph, REZ-unified-profile, rez-social-signals | **4** |
| **4100** | REZ-cross-company-loyalty, REZ-unified-chat, REZ-unified-crm-hub, REZ-validation-dashboard | **4** |

### HIGH CONFLICTS (3-6 services)

| Port | Services | Count |
|------|----------|-------|
| 3001 | rez-culinary-expert, rez-ml-model-registry, rez-sales-agent | 3 |
| 3003 | REZ-ledger-service, REZ-load-tests, rez-consultant-agent, rez-travel-expert | 4 |
| 3005 | REZ-cdp-service, REZ-consumer-loop, rez-ml-feature-store, rez-salon-expert | 4 |
| 4010 | rez-ai-plugins, rez-whatsapp-orchestrator-bridge | 2 |
| 4030 | REZ-feature-flags, REZ-feature-store | 2 |
| 4040 | REZ-attribution-loyalty-bridge, REZ-reorder-engine, rez-location-intelligence | 3 |
| 4050 | REZ-identity-graph, REZ-memory-engine | 2 |
| 4052 | REZ-ai-router, REZ-analytics-orchestrator, REZ-api-gateway, REZ-event-connector | 4 |
| 4055 | REZ-rfm-plus-service, REZ-universal-user-graph | 2 |
| 4061 | REZ-gift-card-service, REZ-merchant-brain | 2 |
| 4062 | REZ-autonomous-agents, REZ-multi-location-service | 2 |
| 4067 | REZ-staff-scheduling-service, REZ-stream-processing | 2 |
| 4070 | REZ-payments-brain, rez-channel-orchestrator, rez-cohort-service | 3 |
| 4071 | REZ-inventory-sync, REZ-migration-scripts | 2 |
| 4073 | REZ-merchant-os, REZ-migration-scripts | 2 |
| 4090 | REZ-ltv-attribution, REZ-unified-attribution, REZ-unified-recommendations | 3 |
| 4101 | REZ-ai-orchestrator, REZ-flywheel-mvp | 2 |
| 4105 | REZ-data-warehouse, REZ-ecosystem-hub | 2 |
| 4110 | REZ-ab-testing, rez-behavioral-psychology | 2 |

### PORT-REGISTRY.md vs ACTUAL Code Comparison

| Registry Says | Code Has | Status |
|---------------|----------|--------|
| rez-fitness-expert: 3010 | PORT env var | ⚠️ Mismatch |
| rez-health-expert: 3011 | PORT env var | ⚠️ Mismatch |
| REZ-insights-service: 3011 | 3011 | ✓ Match |
| REZ-targeting-engine: 3013 | 3013 | ✓ Match |
| REZ-autonomous-agents: 4062 | 4062 | ✓ Match |
| rez-expert-base: 3000 | 3000 | ✓ Match |
| REZ-ab-testing: 4110 | 4110 | ✓ Match |
| REZ-payments-brain: 4070 | 4070 | ✓ Match |

---

## 3. Shared Packages Analysis

### Shared Packages (packages/)

| Package | Purpose | Usage |
|---------|---------|-------|
| rez-logger | Logging utility | 6 services |
| rez-security-middleware | Auth middleware | 4 services |
| rez-shared-types | Type definitions | 0 direct imports |
| rez-testing | Test utilities | 0 direct imports |
| rez-vault-client | Secret management | 0 direct imports |
| REZ-service-template | Service template | N/A |

### Shared Utilities (shared/)

| Utility | Purpose | Usage |
|---------|---------|-------|
| circuitBreaker.js | Fault tolerance | - |
| errorHandler.js | Error handling | - |
| logger.js | Logging | - |
| rateLimiter.js | Rate limiting | - |
| schemas.js | Zod schemas | - |
| securityMiddleware.js | Security | - |

### Package Usage Analysis

```typescript
// @rez/logger - 6 services using
REZ-ab-testing
REZ-gift-card-service
REZ-health-monitor
REZ-flywheel-mvp
REZ-notification-router
REZ-staff-scheduling-service

// @rez/security-middleware - 4 services using
REZ-gift-card-service
REZ-flywheel-mvp
REZ-service-template
REZ-staff-scheduling-service
REZ-notification-router

// @rez/service-connectors - 1 service (commented reference)
rez-service-connectors
```

### Missing: Local shared implementations
Several services have their own local implementations instead of using shared:
- REZ-personalization-engine/src/utils/logger.ts
- REZ-recommendation-engine/src/utils/logger.ts
- Multiple services with local auth.ts files

---

## 4. Integration Status

### RABTUL Platform Integration

| Service | Integration | Status |
|---------|-------------|--------|
| rez-unified-engine | RABTUL Auth (with local fallback) | Partial |
| REZ-enterprise-gateway | RABTUL Auth, Payment, Wallet URLs | ✅ |
| REZ-karma-loyalty-bridge | RABTUL wallet coins | ✅ |
| REZ-care-service | RABTUL Auth, Payment, Wallet | ✅ |
| rez-service-connectors | Uses RABTUL URLs | ✅ |
| **All other services** | Local implementations | ❌ |

### RABTUL Service References (89 total)
- `rez-auth-service`: 9 references
- `rez-payment-service`: 11 references  
- `rez-wallet-service`: 9 references
- `rez-notifications-service`: 9 references

### Local Auth Implementations
- `REZ-personalization-engine` - Local JWT
- `REZ-recommendation-engine` - Local JWT
- `REZ-ab-testing` - Local auth
- `REZ-targeting-engine` - Local auth
- Most services have their own auth middleware

### Payment Integration (Razorpay)
| Service | Implementation | Status |
|---------|---------------|--------|
| REZ-payments-brain | Direct Razorpay | ❌ Use RABTUL |
| rez-service-connectors | Razorpay connector | ✅ RABTUL |
| REZ-care-service | Razorpay ticket creation | ⚠️ Partial |
| REZ-event-platform | Razorpay webhook | ⚠️ Partial |

---

## 5. Duplicate/Overlapping Services

### Attribution Services (4 overlapping)

| Service | Port | Purpose |
|---------|------|---------|
| REZ-attribution-system | - | Conversion attribution |
| REZ-unified-attribution | 4090 | Multi-channel attribution |
| REZ-ltv-attribution | 4090 | LTV by channel/campaign |
| REZ-dooh-attribution | 4081 | DOOH attribution |
| rez-crosschannel-attribution | 4115 | Cross-channel tracking |

**Recommendation:** Consolidate into 1-2 services

### Identity Services (4 overlapping)

| Service | Port | Purpose |
|---------|------|---------|
| REZ-identity-graph | 4050 | Identity resolution |
| REZ-consumer-graph | - | Consumer relationship graph |
| REZ-universal-user-graph | 4055 | Cross-platform user graph |
| REZ-unified-identity | - | Unified identity management |
| REZ-identity-bridge | 4092 | Identity bridging |

**Recommendation:** Consolidate into 1-2 services

### Recommendation Services (3 overlapping)

| Service | Port | Purpose |
|---------|------|---------|
| REZ-recommendation-engine | 4017 | Product/content recommendations |
| REZ-unified-recommendations | 4090 | Cross-platform recommendations |
| REZ-personalization-engine | 4017 | User personalization |

**Recommendation:** Consolidate into 1-2 services

### Customer Services (2 overlapping)

| Service | Port | Purpose |
|---------|------|---------|
| REZ-care-service | 4058 | Customer support |
| REZ-cdp-service | 3005 | Customer Data Platform |
| rez-customer-360 | - | Customer unified view |

**Recommendation:** Consolidate or clarify scope

### Merchant Intelligence (4 overlapping)

| Service | Port | Purpose |
|---------|------|---------|
| REZ-merchant-brain | 4061 | Merchant AI assistant |
| REZ-merchant-intelligence | 4014 | Merchant analytics |
| REZ-merchant-360 | - | Merchant unified view |
| REZ-merchant-os | 4073 | Merchant operating system |

**Recommendation:** Consolidate or clarify scope

### Expert Services (9 domains)

| Expert | Port | Domain |
|--------|------|--------|
| rez-fitness-expert | env | Fitness |
| rez-health-expert | env | Health |
| rez-travel-expert | 3003 | Travel |
| rez-education-expert | 3006 | Education |
| rez-hospitality-expert | - | Hospitality |
| rez-culinary-expert | 3001 | Culinary |
| rez-retail-expert | env | Retail |
| rez-salon-expert | 3005 | Salon |
| rez-expert-base | 3000 | Base framework |

**Status:** Framework exists, domains need review

### Agent Services (10+ agents)

| Agent | Port | Purpose |
|-------|------|---------|
| REZ-autonomous-agents | 4062 | Task orchestration |
| rez-sales-agent | 3001 | Sales automation |
| rez-support-agent | 3002 | Support automation |
| rez-fraud-agent | 3007 | Fraud detection |
| rez-consultant-agent | 3003 | Consulting |
| rez-info-agent | 3004 | Information retrieval |
| rez-research-opportunity-agent | - | Opportunity identification |
| rez-unified-agent-sdk | - | SDK |
| REZ-commerce-agents | 4063 | E-commerce automation |
| REZ-research-opportunity-agent | - | Research |

**Status:** Well organized, some duplication

---

## 6. MCP Services (10 services)

| Service | Purpose | Status |
|---------|---------|--------|
| rez-mcp-analytics | Analytics protocol | ✅ |
| rez-mcp-event-bus | Event bus protocol | ✅ |
| rez-mcp-identity | Identity protocol | ✅ |
| rez-mcp-inventory | Inventory protocol | ✅ |
| rez-mcp-logs | Logging protocol | ✅ |
| rez-mcp-notification | Notification protocol | ✅ |
| rez-mcp-order | Order protocol | ✅ |
| rez-mcp-payment | Payment protocol | ✅ |
| rez-mcp-service-discovery | Service discovery | ✅ |
| rez-mcp-agent-invoke | Agent invocation | ✅ |

**Status:** Complete MCP protocol suite

---

## 7. README Coverage

| Status | Count | Percentage |
|--------|-------|------------|
| Services WITH README | 112 | 70% |
| Services WITHOUT README | 50 | 31% |

### Services Missing README
```
REZ-ab-testing, REZ-ai-orchestrator, REZ-ai-router, REZ-autonomous-agents,
REZ-commerce-agents, REZ-consumer-loop, REZ-corpperks-bridge, REZ-creator-network,
REZ-cross-company-loyalty, REZ-data-platform, REZ-data-warehouse, REZ-demand-forecast,
REZ-dooh-attribution, REZ-dooh-intelligence, REZ-ecosystem-hub, REZ-enterprise-gateway,
REZ-event-connector, REZ-feedback-collector, REZ-flywheel-mvp, REZ-identity-bridge,
REZ-identity-graph, REZ-inventory-sync, REZ-karma-loyalty-bridge, REZ-knowledge-graph,
REZ-ltv-attribution, REZ-memory-engine, REZ-merchant-brain, REZ-merchant-os,
REZ-notification-router, REZ-observability, REZ-payments-brain, REZ-price-predictor,
REZ-realtime-gateway, REZ-reorder-engine, REZ-rfm-plus-service, REZ-taste-profile,
REZ-ugc-engine, REZ-unified-crm-ui, REZ-unified-identity, REZ-unified-recommendations,
REZ-user-agents, REZ-validation-dashboard, rez-context-engine, rez-crosschannel-attribution,
rez-eta-prediction, rez-fitness-expert, rez-fleet-management, rez-health-expert,
rez-lakehouse, rez-shared-types
```

---

## 8. Docker Coverage

| Item | Count | Percentage |
|------|-------|------------|
| Dockerfiles | 163 | 100% |
| docker-compose files | 9 | 6% |

### Services WITHOUT docker-compose
All services except the 9 listed in the repo root.

---

## 9. Security Issues

### Hardcoded Credentials ⚠️

| File | Issue |
|------|-------|
| REZ-signal-aggregator/.env | `INTERNAL_SERVICE_TOKEN=dev-token-change-in-production` |
| REZ-unified-crm-hub/.env | `INTERNAL_SERVICE_TOKEN=dev-internal-token-12345678901234567890` |
| REZ-unified-crm-hub/.env | `MERCHANT_JWT_SECRET=dev-merchant-jwt-secret-...` |
| REZ-predictive-engine/.env | `INTERNAL_SERVICE_TOKEN=secure-development-token-...` |
| rez-priority-engine/src/config | `JWT_SECRET: default('development-secret-change-in-production')` |

### Git Status (Unstaged Changes)

**Staged:**
- .gitmodules
- REZ-attribution-loyalty-bridge/src/services/walletIntegrator.ts

**Modified:**
- PORT-REGISTRY.md
- Multiple .env.example files
- REZ-unified-attribution/src/services/attribution.ts
- package-lock.json

**Untracked:**
- DOCKER-AUDIT.md
- INTELLIGENCE-AUDIT-MAY-2026.md
- 25+ new Dockerfiles
- 5 new service directories

---

## 10. Code Quality Metrics

### TypeScript vs JavaScript

| Type | Files | Percentage |
|------|-------|------------|
| TypeScript (.ts) | 1,289 | 83% |
| JavaScript (.js) | 266 | 17% |

### Test Coverage

| Metric | Value |
|--------|-------|
| Services with Tests | 21 (13%) |
| Services without Tests | 140 (87%) |
| Test Files | 72 |

### TODO/FIXME Items

| Count | Sample Locations |
|-------|----------------|
| 56 | REZ-event-platform, REZ-personalization-engine, REZ-recommendation-engine |

---

## 11. Critical Action Items

### IMMEDIATE (This Week)

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 1 | Fix port 3000 conflict (7 services) | CRITICAL | HIGH |
| 2 | Fix port 4059 conflict (4 services) | CRITICAL | MEDIUM |
| 3 | Remove credentials from .env files | CRITICAL | LOW |
| 4 | Add .env to .gitignore for 113 services | CRITICAL | LOW |
| 5 | Create package.json for 13 incomplete services | HIGH | MEDIUM |
| 6 | Add README to 50 services | MEDIUM | LOW |

### SHORT TERM (This Month)

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 7 | Consolidate attribution services (5→2) | HIGH | HIGH |
| 8 | Consolidate identity services (5→2) | HIGH | HIGH |
| 9 | Consolidate recommendation services (3→1) | MEDIUM | MEDIUM |
| 10 | Add tests to 100+ services | MEDIUM | HIGH |
| 11 | Migrate .js to .ts (266 files) | MEDIUM | HIGH |
| 12 | Integrate local auth with RABTUL | HIGH | HIGH |

### MEDIUM TERM (Next Quarter)

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 13 | Consolidate customer services | MEDIUM | HIGH |
| 14 | Consolidate merchant services | MEDIUM | HIGH |
| 15 | Add docker-compose to all services | LOW | MEDIUM |
| 16 | Create unified shared package | MEDIUM | MEDIUM |

---

## 12. Recommended Port Assignments

To resolve conflicts, reassign:

| Port | Current | Should Be |
|------|---------|-----------|
| 3000 | 7 services | RESERVE - NO SERVICES |
| 3001 | 3 services | rez-culinary-expert |
| 3002 | (empty) | rez-sales-agent |
| 3003 | 4 services | rez-consultant-agent |
| 3004 | (empty) | rez-travel-expert |
| 3005 | 4 services | rez-salon-expert |
| 4059 | 4 services | REZ-signal-aggregator |
| 4060 | 4 services | REZ-unified-profile |
| 4090 | 3 services | REZ-unified-attribution |
| 4100 | 4 services | REZ-unified-crm-hub |

---

## 13. Service Classification by Priority

### Tier 1 - Production Critical (25 services)

```
REZ-autonomous-agents, REZ-care-service, REZ-payments-brain,
REZ-identity-graph, REZ-signal-aggregator, REZ-recommendation-engine,
REZ-personalization-engine, REZ-support-copilot, REZ-predictive-engine,
REZ-targeting-engine, REZ-event-platform, rez-intent-predictor,
REZ-merchant-os, REZ-unified-crm-hub, REZ-action-engine,
REZ-realtime-segments, REZ-feature-flags, REZ-notification-router,
REZ-data-warehouse, REZ-dooh-intelligence, REZ-inventory-sync,
REZ-merchant-intelligence, REZ-supplier-marketplace, REZ-gift-card-service,
REZ-reservation-service
```

### Tier 2 - Important (50 services)

All other services with complete implementations.

### Tier 3 - Development/Experimental (13 incomplete + 6 empty)

Need completion before production deployment.

---

## Appendix A: Complete Service Inventory

### REZ-* Prefix Services (95)

| Service | Port | Complete | README | Docker | Priority |
|---------|------|----------|--------|--------|----------|
| REZ-ab-testing | 4110 | ✅ | ❌ | ✅ | 2 |
| REZ-ab-testing-service | 4002 | ✅ | ✅ | ❌ | 2 |
| REZ-action-engine | - | ✅ | ✅ | ❌ | 1 |
| REZ-ai-orchestrator | 4101 | ✅ | ❌ | ✅ | 2 |
| REZ-ai-router | 4052 | ✅ | ❌ | ❌ | 1 |
| REZ-analytics-orchestrator | 4052 | ❌ | ? | ❌ | 3 |
| REZ-api-gateway | 4052 | ✅ | ? | ❌ | 3 |
| REZ-api-keys | 4096 | ✅ | ? | ❌ | 2 |
| REZ-attribution-loyalty-bridge | 4040 | ✅ | ✅ | ✅ | 2 |
| REZ-attribution-system | - | ✅ | ✅ | ❌ | 2 |
| REZ-audit-logging | 3000 | ✅ | ✅ | ✅ | 1 |
| REZ-autonomous-agents | 4062 | ✅ | ✅ | ✅ | 1 |
| REZ-care-service | 4058 | ✅ | ✅ | ✅ | 1 |
| REZ-cdp-service | 3005 | ✅ | ✅ | ✅ | 1 |
| REZ-commerce-agents | 4063 | ✅ | ❌ | ✅ | 1 |
| REZ-commerce-signal-connector | 4150 | ✅ | ✅ | ✅ | 2 |
| REZ-consumer-graph | - | ✅ | ✅ | ✅ | 2 |
| REZ-consumer-loop | 3005 | ✅ | ❌ | ✅ | 2 |
| REZ-corperks-bridge | 4099 | ✅ | ? | ❌ | 2 |
| REZ-creative-engine | 3000 | ✅ | ✅ | ❌ | 2 |
| REZ-creator-network | 4072 | ✅ | ❌ | ✅ | 2 |
| REZ-cross-company-loyalty | 4100 | ✅ | ❌ | ❌ | 2 |
| REZ-customer-intelligence-hub | - | ✅ | ✅ | ✅ | 2 |
| REZ-data-governance | - | ❌ | ? | ❌ | 3 |
| REZ-data-platform | - | ❌ | ✅ | ✅ | 3 |
| REZ-data-warehouse | 4105 | ✅ | ❌ | ✅ | 1 |
| REZ-delivery-intelligence | - | ✅ | ✅ | ❌ | 2 |
| REZ-delivery-tracking-service | 4060 | ✅ | ✅ | ❌ | 1 |
| REZ-demand-forecast | 4042 | ✅ | ✅ | ❌ | 2 |
| REZ-dooh-attribution | 4081 | ✅ | ❌ | ✅ | 2 |
| REZ-dooh-intelligence | 4080 | ✅ | ❌ | ✅ | 2 |
| REZ-ecosystem-hub | 4105 | ✅ | ❌ | ✅ | 2 |
| REZ-enterprise-gateway | 4102 | ✅ | ❌ | ✅ | 1 |
| REZ-error-intelligence | 4005 | ✅ | ✅ | ❌ | 1 |
| REZ-event-bus | - | ✅ | ✅ | ✅ | 1 |
| REZ-event-connector | 4052 | ✅ | ❌ | ❌ | 2 |
| REZ-event-platform | 4008 | ✅ | ✅ | ❌ | 1 |
| REZ-experimentation-engine | 3000 | ✅ | ✅ | ✅ | 2 |
| REZ-feature-flags | 4030 | ✅ | ✅ | ❌ | 1 |
| REZ-feature-store | 4030 | ❌ | ? | ❌ | 3 |
| REZ-feedback-collector | 4085 | ✅ | ✅ | ❌ | 2 |
| REZ-flywheel-mvp | 4101 | ✅ | ✅ | ❌ | 2 |
| REZ-gift-card-service | 4061 | ✅ | ✅ | ❌ | 1 |
| REZ-health-monitor | - | ✅ | ✅ | ❌ | 1 |
| REZ-hyperlocal-targeting | 4059 | ✅ | ✅ | ✅ | 2 |
| REZ-identity-bridge | 4092 | ✅ | ❌ | ❌ | 2 |
| REZ-identity-graph | 4050 | ✅ | ❌ | ✅ | 1 |
| REZ-insights-service | 3011 | ✅ | ✅ | ❌ | 1 |
| REZ-integration-sdk | - | ✅ | ✅ | ❌ | 2 |
| REZ-inventory-alerts-service | 4064 | ✅ | ✅ | ❌ | 2 |
| REZ-inventory-intelligence | - | ✅ | ✅ | ✅ | 2 |
| REZ-inventory-sync | 4071 | ✅ | ❌ | ❌ | 1 |
| REZ-karma-loyalty-bridge | 4098 | ✅ | ❌ | ❌ | 2 |
| REZ-knowledge-graph | 4060 | ✅ | ❌ | ❌ | 2 |
| REZ-ledger-service | 3003 | ✅ | ✅ | ❌ | 1 |
| REZ-load-tests | 3003 | ✅ | ✅ | ❌ | 3 |
| REZ-ltv-attribution | 4090 | ✅ | ✅ | ❌ | 2 |
| REZ-memory-engine | 4051 | ✅ | ❌ | ❌ | 2 |
| REZ-merchant-360 | - | ✅ | ✅ | ❌ | 2 |
| REZ-merchant-brain | 4061 | ✅ | ❌ | ❌ | 2 |
| REZ-merchant-intelligence | 4014 | ✅ | ✅ | ❌ | 1 |
| REZ-merchant-os | 4073 | ✅ | ❌ | ❌ | 1 |
| REZ-migration-scripts | 4073 | ❌ | ? | ❌ | 3 |
| REZ-ml-production | - | ❌ | ? | ❌ | 3 |
| REZ-ml-studio | - | ❌ | ? | ❌ | 3 |
| REZ-multi-location-service | 4062 | ✅ | ✅ | ❌ | 2 |
| REZ-notification-router | 4093 | ✅ | ❌ | ✅ | 1 |
| REZ-observability | - | ✅ | ✅ | ✅ | 2 |
| REZ-observability-system | 3000 | ✅ | ✅ | ❌ | 2 |
| REZ-payments-brain | 4070 | ✅ | ❌ | ❌ | 1 |
| REZ-personalization-engine | 4017 | ✅ | ✅ | ❌ | 1 |
| REZ-predictive-engine | 4059 | ✅ | ✅ | ❌ | 1 |
| REZ-price-predictor | 4043 | ✅ | ✅ | ❌ | 2 |
| REZ-qr-campaigns | 4130 | ✅ | ✅ | ✅ | 2 |
| REZ-real-time-decision-engine | 3000 | ✅ | ✅ | ❌ | 2 |
| REZ-realtime-gateway | 4094 | ✅ | ❌ | ❌ | 2 |
| REZ-realtime-segments | - | ✅ | ✅ | ✅ | 1 |
| REZ-recommendation-engine | 4017 | ✅ | ✅ | ❌ | 1 |
| REZ-reconciliation-service | 10000 | ✅ | ✅ | ✅ | 1 |
| REZ-reorder-engine | 4040 | ✅ | ❌ | ✅ | 2 |
| REZ-research-opportunity-agent | - | ✅ | ✅ | ❌ | 2 |
| REZ-reservation-service | 4065 | ✅ | ✅ | ❌ | 1 |
| REZ-rfm-plus-service | 4055 | ✅ | ❌ | ❌ | 2 |
| REZ-rfm-service | - | ✅ | ✅ | ✅ | 2 |
| REZ-signal-aggregator | 4059 | ✅ | ✅ | ✅ | 1 |
| REZ-staff-scheduling-service | 4067 | ✅ | ✅ | ✅ | 2 |
| REZ-stream-processing | 4067 | ❌ | ? | ❌ | 3 |
| REZ-supplier-marketplace | 4063 | ✅ | ✅ | ❌ | 1 |
| REZ-support-copilot | 4033 | ✅ | ✅ | ❌ | 1 |
| REZ-targeting-engine | 3013 | ✅ | ✅ | ❌ | 1 |
| REZ-taste-profile | 4041 | ✅ | ❌ | ❌ | 2 |
| REZ-ugc-engine | - | ✅ | ✅ | ❌ | 2 |
| REZ-unified-attribution | 4090 | ✅ | ✅ | ✅ | 2 |
| REZ-unified-chat | 4100 | ✅ | ✅ | ❌ | 2 |
| REZ-unified-crm-hub | 4100 | ✅ | ✅ | ✅ | 1 |
| REZ-unified-crm-ui | - | ✅ | ❌ | ✅ | 2 |
| REZ-unified-event-schema | - | ❌ | ? | ❌ | 3 |
| REZ-unified-identity | - | ✅ | ❌ | ❌ | 2 |
| REZ-unified-inventory | - | ❌ | ? | ❌ | 3 |
| REZ-unified-profile | 4060 | ✅ | ✅ | ❌ | 1 |
| REZ-unified-recommendations | 4090 | ✅ | ❌ | ❌ | 2 |
| REZ-universal-user-graph | 4055 | ✅ | ✅ | ❌ | 1 |
| REZ-user-agents | 4030 | ✅ | ❌ | ❌ | 2 |
| REZ-validation-dashboard | 4100 | ✅ | ✅ | ❌ | 2 |
| REZ-waitlist-service | 4066 | ✅ | ✅ | ❌ | 2 |

### rez-* Prefix Services (52)

| Service | Port | Complete | README | Docker | Priority |
|---------|------|----------|--------|--------|----------|
| rez-agent-registry | 4011 | ✅ | ✅ | ❌ | 2 |
| rez-aggregator-hub | - | ✅ | ✅ | ❌ | 2 |
| rez-ai-platform | - | ❌ | ✅ | ✅ | 3 |
| rez-ai-plugins | 4010 | ✅ | ✅ | ❌ | 2 |
| rez-ai-voice | 3000 | ✅ | ✅ | ❌ | 2 |
| rez-app-bridge | 4089 | ✅ | ✅ | ❌ | 2 |
| rez-behavioral-psychology | 4110 | ✅ | ✅ | ❌ | 2 |
| rez-channel-orchestrator | 4070 | ✅ | ✅ | ❌ | 2 |
| rez-cohort-service | 4070 | ❌ | ? | ❌ | 3 |
| rez-competitor-detection | 4059 | ✅ | ✅ | ❌ | 2 |
| rez-confidence-scorer | - | ✅ | ✅ | ❌ | 2 |
| rez-consultant-agent | 3003 | ✅ | ✅ | ❌ | 2 |
| rez-consumer-copilot | - | ❌ | ? | ❌ | 3 |
| rez-context-engine | 4071 | ✅ | ❌ | ❌ | 2 |
| rez-conversation-intelligence | - | ✅ | ✅ | ❌ | 2 |
| rez-core-brain | - | ✅ | ✅ | ❌ | 2 |
| rez-crosschannel-attribution | 4115 | ✅ | ❌ | ❌ | 2 |
| rez-culinary-expert | 3001 | ✅ | ✅ | ❌ | 2 |
| rez-customer-360 | - | ✅ | ✅ | ❌ | 2 |
| rez-e2e-tests | - | ❌ | ? | ✅ | 3 |
| rez-education-expert | 3006 | ✅ | ✅ | ❌ | 2 |
| rez-email-bridge | 4086 | ✅ | ✅ | ❌ | 2 |
| rez-eta-prediction | - | ✅ | ❌ | ✅ | 2 |
| rez-expert-base | 3000 | ✅ | ✅ | ❌ | 2 |
| rez-fitness-expert | env | ✅ | ❌ | ❌ | 2 |
| rez-fleet-management | 4016 | ✅ | ✅ | ❌ | 2 |
| rez-fraud-agent | 3007 | ✅ | ✅ | ❌ | 2 |
| rez-fraud-detection-service | 3007 | ❌ | ? | ❌ | 3 |
| rez-health-expert | env | ✅ | ❌ | ❌ | 2 |
| rez-hospitality-expert | - | ✅ | ✅ | ❌ | 2 |
| rez-info-agent | 3004 | ✅ | ✅ | ❌ | 2 |
| rez-integration-tests | - | ❌ | ? | ❌ | 3 |
| rez-intelligence-hub | 4020 | ✅ | ✅ | ❌ | 2 |
| rez-intent-graph | - | ✅ | ✅ | ❌ | 1 |
| rez-intent-predictor | 4018 | ✅ | ✅ | ✅ | 1 |
| rez-lakehouse | - | ✅ | ✅ | ❌ | 2 |
| rez-location-intelligence | 4040 | ✅ | ✅ | ❌ | 2 |
| rez-mcp-agent-invoke | - | ✅ | ✅ | ❌ | 1 |
| rez-mcp-analytics | - | ✅ | ✅ | ✅ | 1 |
| rez-mcp-event-bus | - | ✅ | ✅ | ✅ | 1 |
| rez-mcp-identity | - | ✅ | ✅ | ✅ | 1 |
| rez-mcp-inventory | - | ✅ | ✅ | ✅ | 1 |
| rez-mcp-logs | - | ✅ | ✅ | ✅ | 1 |
| rez-mcp-notification | - | ✅ | ✅ | ✅ | 1 |
| rez-mcp-order | - | ✅ | ✅ | ✅ | 1 |
| rez-mcp-payment | - | ✅ | ✅ | ✅ | 1 |
| rez-mcp-service-discovery | - | ✅ | ✅ | ✅ | 1 |
| rez-ml-engine | - | ❌ | ? | ❌ | 3 |
| rez-ml-feature-store | 3005 | ✅ | ✅ | ❌ | 2 |
| rez-ml-model-registry | 3001 | ✅ | ✅ | ❌ | 2 |
| rez-ml-models | - | ✅ | ✅ | ❌ | 2 |
| rez-orchestrator-v2 | - | ✅ | ✅ | ✅ | 2 |
| rez-permission-system | - | ❌ | ? | ❌ | 3 |
| rez-priority-engine | - | ✅ | ✅ | ✅ | 2 |
| rez-rcs-bridge | - | ✅ | ✅ | ❌ | 2 |
| rez-retail-expert | env | ✅ | ✅ | ✅ | 2 |
| rez-sales-agent | 3001 | ✅ | ✅ | ❌ | 2 |
| rez-salon-expert | 3005 | ✅ | ❌ | ❌ | 2 |
| rez-service-connectors | - | ✅ | ✅ | ❌ | 1 |
| rez-shared-types | - | ✅ | ❌ | ❌ | 2 |
| rez-sms-bridge | - | ✅ | ✅ | ❌ | 2 |
| rez-social-signals | 4060 | ✅ | ✅ | ❌ | 2 |
| rez-support-agent | 3002 | ✅ | ✅ | ❌ | 2 |
| rez-travel-expert | 3003 | ✅ | ✅ | ❌ | 2 |
| rez-unified-agent-sdk | - | ✅ | ✅ | ✅ | 2 |
| rez-unified-engine | - | ✅ | ✅ | ✅ | 1 |
| rez-web-widget | 4088 | ✅ | ✅ | ❌ | 2 |
| rez-whatsapp-orchestrator-bridge | 4010 | ✅ | ✅ | ❌ | 2 |

---

**End of Comprehensive Audit Report**
