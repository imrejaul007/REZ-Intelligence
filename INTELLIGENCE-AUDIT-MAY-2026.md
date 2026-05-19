# REZ-Intelligence Company Audit Report
**Date:** May 19, 2026  
**Auditor:** Claude Code  
**Status:** COMPLETE

---

## Executive Summary

| Metric | Count |
|--------|-------|
| **Total Services** | 161 |
| **TypeScript Files** | 1,289 |
| **JavaScript Files** | 266 |
| **Test Files** | 72 |
| **Services with Tests** | 21 |
| **Port Conflicts** | 40+ |
| **Critical Issues** | 15 |
| **High Priority Issues** | 25 |
| **Medium Priority Issues** | 30+ |

---

## 1. Service Inventory

### By Category

| Category | Count | Services |
|-----------|-------|----------|
| **AI/ML** | 45 | Intent Graph, ML Models, Fraud Agent, Recommendation Engine, Personalization Engine, Predictive Engine, etc. |
| **Agents** | 18 | Autonomous Agents, Sales Agent, Support Agent, Fraud Agent, Consultant Agent, Info Agent, Expert Base |
| **Expert Services** | 8 | Fitness Expert, Health Expert, Travel Expert, Education Expert, Hospitality Expert, Culinary Expert, Retail Expert, Salon Expert |
| **Analytics** | 25 | Signal Aggregator, Attribution System, Analytics Orchestrator, Insights Service, etc. |
| **MCP Services** | 12 | MCP Analytics, MCP Payment, MCP Order, MCP Logs, MCP Event Bus, etc. |
| **Bridges** | 8 | Email Bridge, SMS Bridge, RCS Bridge, Karma Loyalty Bridge, CorpPerks Bridge, etc. |
| **Unified Services** | 12 | Unified CRM, Unified Identity, Unified Profile, Unified Recommendations, Unified Chat, etc. |
| **Infrastructure** | 15 | Event Bus, Event Platform, Feature Flags, Observability, Health Monitor, etc. |
| **Other** | 20 | Various utilities and connectors |

### Expert Services Status

| Service | Port | Purpose |
|---------|------|---------|
| rez-fitness-expert | 3005 | Fitness domain |
| rez-health-expert | 3005 | Health domain |
| rez-travel-expert | 3003 | Travel domain |
| rez-education-expert | 3006 | Education domain |
| rez-hospitality-expert | - | Hospitality domain |
| rez-culinary-expert | 3001 | Culinary/Food domain |
| rez-retail-expert | 3001 | Retail domain |
| rez-salon-expert | 3005 | Salon domain |
| rez-fraud-agent | 3007 | Fraud detection |
| rez-sales-agent | 3001 | Sales automation |
| rez-consultant-agent | 3003 | Consulting |
| rez-info-agent | 3004 | Information retrieval |

---

## 2. CRITICAL SECURITY ISSUES

### 2.1 Hardcoded Credentials in .env Files

| File | Issue | Severity |
|------|-------|----------|
| `REZ-signal-aggregator/.env` | `INTERNAL_SERVICE_TOKEN=dev-token-change-in-production` | CRITICAL |
| `REZ-unified-crm-hub/.env` | `INTERNAL_SERVICE_TOKEN=dev-internal-token-12345678901234567890` | CRITICAL |
| `REZ-unified-crm-hub/.env` | `MERCHANT_JWT_SECRET=dev-merchant-jwt-secret-minimum-32-characters-long` | CRITICAL |
| `REZ-predictive-engine/.env` | `INTERNAL_SERVICE_TOKEN=secure-development-token-change-in-production` | HIGH |

### 2.2 Insecure Default Secrets

| File | Line | Issue |
|------|------|-------|
| `rez-priority-engine/src/config/index.ts:12` | `JWT_SECRET: z.string().default('development-secret-change-in-production')` | CRITICAL |
| `rez-priority-engine/src/middleware/auth.ts:44` | `if (serviceId === id \|\| token === secret)` | HIGH - Timing attack possible |

### 2.3 Missing .gitignore Protection

| Status | Count |
|--------|-------|
| Services with .env in .gitignore | 48 |
| Services without .env protection | 113 |

---

## 3. PORT CONFLICTS

### Critical Conflicts (7+ services per port)

| Port | Services | Risk |
|------|----------|------|
| **3000** | REZ-audit-logging, REZ-creative-engine, REZ-experimentation-engine, REZ-observability-system, REZ-real-time-decision-engine, rez-ai-voice, rez-expert-base | CRITICAL |
| **3005** | REZ-cdp-service, REZ-consumer-loop, rez-ml-feature-store, rez-salon-expert | HIGH |
| **4059** | REZ-hyperlocal-targeting, REZ-predictive-engine, REZ-signal-aggregator, rez-competitor-detection | CRITICAL |
| **4060** | REZ-delivery-tracking-service, REZ-knowledge-graph, REZ-unified-profile, rez-social-signals | HIGH |
| **4090** | REZ-ltv-attribution, REZ-unified-attribution, REZ-unified-recommendations | MEDIUM |

### High Priority Conflicts (3-6 services per port)

| Port | Services | Count |
|------|----------|-------|
| 3001 | rez-culinary-expert, rez-ml-model-registry, rez-sales-agent | 3 |
| 3003 | REZ-ledger-service, rez-consultant-agent, rez-travel-expert | 3 |
| 4040 | REZ-attribution-loyalty-bridge, REZ-reorder-engine, rez-location-intelligence | 3 |
| 4050 | REZ-identity-graph, REZ-payments-brain | 2 |
| 4061 | REZ-gift-card-service, REZ-merchant-brain | 2 |
| 4062 | REZ-autonomous-agents, REZ-multi-location-service | 2 |
| 4070 | REZ-payments-brain, rez-channel-orchestrator | 2 |

---

## 4. CODE QUALITY ISSUES

### 4.1 Mixed TypeScript/JavaScript

| Type | Count |
|------|-------|
| TypeScript (.ts) Files | 1,289 |
| JavaScript (.js) Files in src | 266 |
| **Ratio** | 17% JavaScript |

### 4.2 TODO/FIXME Items

| Count | Status |
|-------|--------|
| 56 | Requires attention |

**Sample TODOs:**
- `REZ-event-platform/src/events/consumer.ts` - "TODO: Implement ReZ Mind AI analysis" (3 instances)
- `REZ-personalization-engine/src/models/*.js` - "TODO: Replace with .ts implementations" (4 files)
- `REZ-recommendation-engine/src/models/*.js` - "TODO: Replace with .ts implementations" (5 files)

### 4.3 Test Coverage

| Metric | Value |
|--------|-------|
| Services with Tests | 21 (13%) |
| Total Test Files | 72 |
| Services without Tests | 140 (87%) |

---

## 5. INTEGRATION GAPS

### 5.1 RABTUL Platform Integration

| Service | Integration Status |
|---------|-------------------|
| REZ-ecosystem-hub | References RABTUL |
| REZ-enterprise-gateway | References RABTUL |
| REZ-karma-loyalty-bridge | References RABTUL |
| rez-mcp-service-discovery | References RABTUL |
| **Most services** | NOT using RABTUL services |

### 5.2 Missing Integrations

| Category | Status |
|----------|--------|
| Auth | Most services have local auth instead of using RABTUL rez-auth-service |
| Payment | Local Razorpay in rez-payments-brain instead of RABTUL |
| Wallet | Some services have local wallet routes |
| Notification | Using local implementations instead of RABTUL rez-notifications-service |

---

## 6. INFRASTRUCTURE ISSUES

### 6.1 Docker Coverage

| Item | Count |
|------|-------|
| Root Dockerfile | 1 |
| Service Dockerfiles | 11 |
| docker-compose.yml | 10 |

### 6.2 Missing Docker

| Category | Count |
|----------|-------|
| Services without Dockerfile | 150 |
| Services without docker-compose | 151 |

---

## 7. DUPLICATE SERVICES

### Potential Consolidation Candidates

| Services | Issue |
|----------|-------|
| REZ-ltv-attribution, REZ-unified-attribution | Both handle attribution |
| REZ-unified-recommendations, REZ-recommendation-engine | Both handle recommendations |
| REZ-identity-graph, REZ-consumer-graph, REZ-universal-user-graph | Multiple identity services |
| REZ-customer-360, REZ-care-service | Overlapping customer views |
| rez-behavioral-psychology, REZ-targeting-engine | Both behavioral/targeting |
| REZ-merchant-brain, REZ-merchant-intelligence, REZ-merchant-360 | Multiple merchant services |

---

## 8. EXPERT SERVICES ANALYSIS

### Port Conflicts in Expert Services

| Expert | Default Port | Conflict |
|--------|-------------|----------|
| rez-fitness-expert | env var | NONE |
| rez-health-expert | env var | NONE |
| rez-travel-expert | 3003 | CONFLICT (REZ-ledger-service, rez-consultant-agent) |
| rez-education-expert | 3006 | NONE |
| rez-hospitality-expert | - | NONE |
| rez-culinary-expert | 3001 | CONFLICT (rez-ml-model-registry, rez-sales-agent) |
| rez-retail-expert | env var | NONE |
| rez-salon-expert | 3005 | CONFLICT (REZ-cdp-service, REZ-consumer-loop, rez-ml-feature-store) |
| rez-fraud-agent | 3007 | NONE |
| rez-sales-agent | 3001 | CONFLICT |
| rez-consultant-agent | 3003 | CONFLICT |
| rez-info-agent | 3004 | NONE |

---

## 9. PRIORITY ACTION ITEMS

### Immediate (This Week)

| # | Action | Impact |
|---|--------|--------|
| 1 | Remove hardcoded credentials from .env files | CRITICAL |
| 2 | Add .env to .gitignore for 113 services | CRITICAL |
| 3 | Fix port conflicts for 3000, 4059 | CRITICAL |
| 4 | Update insecure JWT_SECRET defaults | HIGH |

### Short Term (This Month)

| # | Action | Impact |
|---|--------|--------|
| 5 | Migrate to TypeScript for all .js files | MEDIUM |
| 6 | Add tests to services without coverage | HIGH |
| 7 | Consolidate duplicate attribution services | MEDIUM |
| 8 | Consolidate duplicate identity services | MEDIUM |
| 9 | Add Docker to remaining services | LOW |

### Medium Term (Next Quarter)

| # | Action | Impact |
|---|--------|--------|
| 10 | Integrate all services with RABTUL platform | HIGH |
| 11 | Consolidate expert services | MEDIUM |
| 12 | Create shared integration SDK | MEDIUM |
| 13 | Standardize logging/monitoring | MEDIUM |

---

## 10. RECOMMENDATIONS

### Architecture

1. **Consolidate Expert Services** - Create a unified expert framework
2. **Single Attribution Service** - Merge LTV, unified, and loyalty attribution
3. **Unified Identity Layer** - Single source of truth for user/merchant identity
4. **Shared MCP Client** - Common MCP integration for all services

### Security

1. **Vault Integration** - Use rez-vault-client for all secrets
2. **No .env files in repo** - Use .env.example only
3. **Service mesh auth** - Centralized authentication via RABTUL
4. **Rate limiting** - Standardize across all services

### Quality

1. **100% TypeScript** - Migrate remaining .js files
2. **80% test coverage** - Add tests for all services
3. **Shared types package** - Use rez-shared-types consistently
4. **Standard linting** - Enforce ESLint/Prettier via husky

### DevOps

1. **Docker standard** - All services containerized
2. **Health checks** - Standard /health endpoint
3. **Metrics** - Prometheus-compatible metrics
4. **Tracing** - OpenTelemetry integration

---

## 11. PORT REGISTRY UPDATE

Recommended port assignments to resolve conflicts:

| Port | Service | Status |
|------|---------|--------|
| 3000 | Reserved | **DO NOT USE** |
| 3001 | rez-culinary-expert | TO ASSIGN |
| 3003 | rez-consultant-agent | TO ASSIGN |
| 3005 | rez-salon-expert | TO ASSIGN |
| 3010 | rez-fitness-expert | ASSIGNED |
| 3011 | rez-health-expert | ASSIGNED |
| 4040 | REZ-reorder-engine | TO ASSIGN |
| 4050 | REZ-identity-graph | ASSIGNED |
| 4055 | REZ-rfm-service | ASSIGNED |
| 4058 | REZ-care-service | ASSIGNED |
| 4059 | REZ-signal-aggregator | TO ASSIGN |
| 4060 | REZ-unified-profile | TO ASSIGN |
| 4061 | REZ-gift-card-service | TO ASSIGN |
| 4062 | REZ-autonomous-agents | ASSIGNED |

---

## Appendix: Service List

### REZ-* Services (95)
```
REZ-ab-testing, REZ-ab-testing-service, REZ-action-engine, REZ-ai-orchestrator,
REZ-ai-router, REZ-api-keys, REZ-attribution-loyalty-bridge, REZ-attribution-system,
REZ-audit-logging, REZ-autonomous-agents, REZ-care-service, REZ-cdp-service,
REZ-commerce-agents, REZ-commerce-signal-connector, REZ-consumer-graph,
REZ-consumer-loop, REZ-corpperks-bridge, REZ-creative-engine, REZ-creator-network,
REZ-cross-company-loyalty, REZ-customer-intelligence-hub, REZ-data-platform,
REZ-data-warehouse, REZ-delivery-intelligence, REZ-delivery-tracking-service,
REZ-demand-forecast, REZ-dooh-attribution, REZ-dooh-intelligence, REZ-ecosystem-hub,
REZ-enterprise-gateway, REZ-error-intelligence, REZ-event-bus, REZ-event-connector,
REZ-event-platform, REZ-experimentation-engine, REZ-feature-flags, REZ-feedback-collector,
REZ-flywheel-mvp, REZ-gift-card-service, REZ-health-monitor, REZ-hyperlocal-targeting,
REZ-identity-bridge, REZ-identity-graph, REZ-insights-service, REZ-integration-sdk,
REZ-inventory-alerts-service, REZ-inventory-intelligence, REZ-inventory-sync,
REZ-karma-loyalty-bridge, REZ-knowledge-graph, REZ-ledger-service, REZ-ltv-attribution,
REZ-memory-engine, REZ-merchant-360, REZ-merchant-brain, REZ-merchant-intelligence,
REZ-merchant-os, REZ-ml-production, REZ-multi-location-service, REZ-notification-router,
REZ-observability, REZ-observability-system, REZ-payments-brain, REZ-personalization-engine,
REZ-predictive-engine, REZ-price-predictor, REZ-qr-campaigns, REZ-real-time-decision-engine,
REZ-realtime-gateway, REZ-realtime-segments, REZ-recommendation-engine,
REZ-reconciliation-service, REZ-reorder-engine, REZ-research-opportunity-agent,
REZ-reservation-service, REZ-rfm-plus-service, REZ-rfm-service, REZ-signal-aggregator,
REZ-staff-scheduling-service, REZ-supplier-marketplace, REZ-support-copilot,
REZ-targeting-engine, REZ-taste-profile, REZ-ugc-engine, REZ-unified-attribution,
REZ-unified-chat, REZ-unified-crm-hub, REZ-unified-crm-ui, REZ-unified-identity,
REZ-unified-profile, REZ-unified-recommendations, REZ-universal-user-graph,
REZ-user-agents, REZ-validation-dashboard, REZ-waitlist-service
```

### rez-* Services (52)
```
rez-agent-registry, rez-aggregator-hub, rez-ai-platform, rez-ai-plugins, rez-ai-voice,
rez-app-bridge, rez-behavioral-psychology, rez-channel-orchestrator,
rez-competitor-detection, rez-confidence-scorer, rez-consultant-agent,
rez-consumer-copilot, rez-context-engine, rez-conversation-intelligence, rez-core-brain,
rez-crosschannel-attribution, rez-culinary-expert, rez-customer-360, rez-e2e-tests,
rez-education-expert, rez-email-bridge, rez-eta-prediction, rez-expert-base,
rez-fitness-expert, rez-fleet-management, rez-fraud-agent, rez-fraud-detection-service,
rez-health-expert, rez-hospitality-expert, rez-info-agent, rez-integration-tests,
rez-intelligence-hub, rez-intent-graph, rez-intent-predictor, rez-lakehouse,
rez-location-intelligence, rez-mcp-agent-invoke, rez-mcp-analytics, rez-mcp-event-bus,
rez-mcp-identity, rez-mcp-inventory, rez-mcp-logs, rez-mcp-notification, rez-mcp-order,
rez-mcp-payment, rez-mcp-service-discovery, rez-ml-feature-store, rez-ml-model-registry,
rez-ml-models, rez-orchestrator-v2, rez-priority-engine, rez-rcs-bridge,
rez-retail-expert, rez-sales-agent, rez-salon-expert, rez-service-connectors,
rez-shared-types, rez-sms-bridge, rez-social-signals, rez-support-agent,
rez-travel-expert, rez-unified-agent-sdk, rez-unified-engine, rez-web-widget,
rez-whatsapp-orchestrator-bridge
```

### Shared Packages (5)
```
REZ-service-template, rez-logger, rez-security-middleware, rez-shared-types,
rez-testing, rez-vault-client
```

---

**End of Audit Report**
