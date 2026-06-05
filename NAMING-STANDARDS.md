# REZ-Intelligence Naming Standards

**Version:** 1.0
**Date:** June 4, 2026
**Status:** MANDATORY - All services MUST follow these standards

---

## Rule: Use `rez-` prefix for all service names

All services in REZ-Intelligence MUST use the `rez-` prefix (lowercase).

### Canonical Format
```
rez-{service-name}
```

### Examples
| Correct | Incorrect |
|---------|-----------|
| `rez-event-bus` | `REZ-event-bus` |
| `rez-workflow-builder` | `REZ-workflow-builder` |
| `rez-trust-service` | `REZ-trust-service` |

---

## Why `rez-`?

1. **Consistency with ecosystem** - RABTUL and other companies use lowercase
2. **Unix-friendly** - No uppercase in filenames or CLI arguments
3. **NPM package compatibility** - Lowercase packages are industry standard
4. **Easier grep/find** - Case-insensitive file systems can cause issues
5. **URL-safe** - Direct mapping to URLs without encoding
6. **Docker-friendly** - Container names are typically lowercase

---

## Naming Conventions

### Service Names
- Use kebab-case: `rez-{adjective}-{noun}`
- Be descriptive but concise
- Use single words after `rez-` when possible

### Good Examples
```
rez-event-bus
rez-intent-graph
rez-ml-models
rez-agent-registry
```

### Bad Examples
```
REZ-event-bus          # Uppercase prefix
rez_event_bus          # Underscore
rezEventBus            # CamelCase
rez-the-event-bus      # Articles
rez-event_bus_service  # Mixed separators
```

---

## Phase 1: Identify Duplicates

### Confirmed Duplicates (17 pairs)

| REZ-* (Deprecated) | rez-* (Canonical) | Status |
|-------------------|------------------|--------|
| REZ-ab-testing | - | Orphan (no rez-ab-testing) |
| REZ-ab-testing-service | - | Orphan (no rez-ab-testing-service) |
| REZ-ai-orchestrator | - | Orphan (no rez-ai-orchestrator) |
| REZ-ai-router | - | Orphan (no rez-ai-router) |
| REZ-autonomous-agents | - | Orphan (no rez-autonomous-agents) |
| REZ-autonomous-loop | - | Orphan (no rez-autonomous-loop) |
| REZ-behavioral-psychology | **rez-behavioral-psychology** | **DUPLICATE** |
| REZ-channel-orchestrator | - | Orphan (no rez-channel-orchestrator) |
| REZ-competitor-detection | **rez-competitor-detection** | **DUPLICATE** |
| REZ-competitor-alerts | - | Orphan (no rez-competitor-alerts) |
| REZ-confidence-scorer | **rez-confidence-scorer** | **DUPLICATE** |
| REZ-context-engine | **rez-context-engine** | **DUPLICATE** |
| REZ-consumer-copilot | **rez-consumer-copilot** | **DUPLICATE** |
| REZ-core-brain | **rez-core-brain** | **DUPLICATE** |
| REZ-creative-engine | - | Orphan (no rez-creative-engine) |
| REZ-crosschannel-attribution | **rez-crosschannel-attribution** | **DUPLICATE** |
| REZ-culinary-expert | **rez-culinary-expert** | **DUPLICATE** |
| REZ-customer-intelligence-hub | - | Orphan (no rez-customer-intelligence-hub) |
| REZ-customer-platform-ui | - | Orphan (no rez-customer-platform-ui) |
| REZ-data-platform | - | Orphan (no rez-data-platform) |
| REZ-data-warehouse | - | Orphan (no rez-data-warehouse) |
| REZ-delivery-intelligence | - | Orphan (no rez-delivery-intelligence) |
| REZ-delivery-tracking-service | - | Orphan (no rez-delivery-tracking-service) |
| REZ-dooh-attribution | - | Orphan (no rez-dooh-attribution) |
| REZ-dooh-intelligence | - | Orphan (no rez-dooh-intelligence) |
| REZ-education-expert | **rez-education-expert** | **DUPLICATE** |
| REZ-email-bridge | **rez-email-bridge** | **DUPLICATE** |
| REZ-ecosystem-hub | - | Orphan (no rez-ecosystem-hub) |
| REZ-emotional-intelligence | - | Orphan (no rez-emotional-intelligence) |
| REZ-enterprise-gateway | - | Orphan (no rez-enterprise-gateway) |
| REZ-error-intelligence | - | Orphan (no rez-error-intelligence) |
| REZ-event-bus | **rez-mcp-event-bus** | RELATED (MCP wrapper) |
| REZ-event-connector | - | Orphan (no rez-event-connector) |
| REZ-event-platform | - | Orphan (no rez-event-platform) |
| REZ-experimentation-engine | - | Orphan (no rez-experimentation-engine) |
| REZ-explainability-engine | - | Orphan (no rez-explainability-engine) |
| REZ-feature-flags | - | Orphan (no rez-feature-flags) |
| REZ-feature-store | **rez-ml-feature-store** | RELATED (ML wrapper) |
| REZ-federated-ml | - | Orphan (no rez-federated-ml) |
| REZ-feedback-collector | - | Orphan (no rez-feedback-collector) |
| REZ-finance-expert | - | Orphan (no rez-finance-expert) |
| REZ-fleet-management | **rez-fleet-management** | **DUPLICATE** |
| REZ-flywheel-engine | - | Orphan (no rez-flywheel-engine) |
| REZ-flywheel-mvp | - | Orphan (no rez-flywheel-mvp) |
| REZ-fraud-agent | **rez-fraud-agent** | **DUPLICATE** |
| REZ-geo-intelligence | - | Orphan (no rez-geo-intelligence) |
| REZ-growth-playbook | - | Orphan (no rez-growth-playbook) |
| REZ-health-monitor | - | Orphan (no rez-health-monitor) |
| REZ-human-in-loop | - | Orphan (no rez-human-in-loop) |
| REZ-hyperlocal-brain | - | Orphan (no rez-hyperlocal-brain) |
| REZ-hyperlocal-targeting | - | Orphan (no rez-hyperlocal-targeting) |
| REZ-identity-bridge | - | Orphan (no rez-identity-bridge) |
| REZ-identity-graph | **rez-identity-graph** | **DUPLICATE** |
| REZ-incrementality-testing | - | Orphan (no rez-incrementality-testing) |
| REZ-insights-service | - | Orphan (no rez-insights-service) |
| REZ-integration-sdk | - | Orphan (no rez-integration-sdk) |
| REZ-intelligence-hub | **rez-intelligence-hub** | **DUPLICATE** |
| REZ-intelligence-sdk | - | Orphan (no rez-intelligence-sdk) |
| REZ-inventory-alerts-service | - | Orphan (no rez-inventory-alerts-service) |
| REZ-inventory-intelligence | - | Orphan (no rez-inventory-intelligence) |
| REZ-inventory-sync | - | Orphan (no rez-inventory-sync) |
| REZ-karma-loyalty-bridge | - | Orphan (no rez-karma-loyalty-bridge) |
| REZ-life-pattern-engine | - | Orphan (no rez-life-pattern-engine) |
| REZ-life-story-engine | - | Orphan (no rez-life-story-engine) |
| REZ-live-action-feed | - | Orphan (no rez-live-action-feed) |
| REZ-location-intelligence | **rez-location-intelligence** | **DUPLICATE** |
| REZ-logistics-expert | - | Orphan (no rez-logistics-expert) |
| REZ-ltv-attribution | - | Orphan (no rez-ltv-attribution) |
| REZ-memory-engine | - | Orphan (no rez-memory-engine) |
| REZ-memory-layer | - | Orphan (no rez-memory-layer) |
| REZ-merchant-360 | - | Orphan (no rez-merchant-360) |
| REZ-merchant-brain | - | Orphan (no rez-merchant-brain) |
| REZ-merchant-graph | - | Orphan (no rez-merchant-graph) |
| REZ-merchant-health-score | - | Orphan (no rez-merchant-health-score) |
| REZ-merchant-intelligence | - | Orphan (no rez-merchant-intelligence) |
| REZ-merchant-os | - | Orphan (no rez-merchant-os) |
| REZ-migration-scripts | **rez-migration-scripts** | **DUPLICATE** |
| REZ-ml-engine | **rez-ml-engine** | **DUPLICATE** |
| REZ-ml-feature-store | **rez-ml-feature-store** | **DUPLICATE** |
| REZ-ml-model-registry | **rez-ml-model-registry** | **DUPLICATE** |
| REZ-ml-models | **rez-ml-models** | **DUPLICATE** |
| REZ-ml-observability | - | Orphan (no rez-ml-observability) |
| REZ-ml-production | - | Orphan (no rez-ml-production) |
| REZ-ml-studio | - | Orphan (no rez-ml-studio) |
| REZ-moment-ads | - | Orphan (no rez-moment-ads) |
| REZ-monitoring | - | Orphan (no rez-monitoring) |
| REZ-multi-location-service | - | Orphan (no rez-multi-location-service) |
| REZ-multilingual | - | Orphan (no rez-multilingual) |
| REZ-notification-router | - | Orphan (no rez-notification-router) |
| REZ-observability | - | Orphan (no rez-observability) |
| REZ-observability-system | - | Orphan (no rez-observability-system) |
| REZ-offline-attribution | - | Orphan (no rez-offline-attribution) |
| REZ-offline-commerce-tracker | - | Orphan (no rez-offline-commerce-tracker) |
| REZ-ontology-engine | - | Orphan (no rez-ontology-engine) |
| REZ-payments-brain | - | Orphan (no rez-payments-brain) |
| REZ-personalization-engine | - | Orphan (no rez-personalization-engine) |
| REZ-planning-agent | - | Orphan (no rez-planning-agent) |
| REZ-predictive-engine | - | Orphan (no rez-predictive-engine) |
| REZ-price-optimization-service | **rez-price-optimization-service** | **DUPLICATE** |
| REZ-price-predictor | - | Orphan (no rez-price-predictor) |
| REZ-profile-aggregator-service | **rez-profile-aggregator-service** | **DUPLICATE** |
| REZ-qr-campaigns | - | Orphan (no rez-qr-campaigns) |
| REZ-ranking-service | - | Orphan (no rez-ranking-service) |
| REZ-rate-limit | **rez-rate-limit** | **DUPLICATE** |
| REZ-rcs-bridge | **rez-rcs-bridge** | **DUPLICATE** |
| REZ-realtime-gateway | - | Orphan (no rez-realtime-gateway) |
| REZ-realtime-segments | - | Orphan (no rez-realtime-segments) |
| REZ-realtime-service | - | Orphan (no rez-realtime-service) |
| REZ-reasoning-engine | - | Orphan (no rez-reasoning-engine) |
| REZ-recharge-service | **rez-recharge-service** | **DUPLICATE** |
| REZ-recommendation-engine | - | Orphan (no rez-recommendation-engine) |
| REZ-reconciliation-service | - | Orphan (no rez-reconciliation-service) |
| REZ-reinforcement-optimizer | - | Orphan (no rez-reinforcement-optimizer) |
| REZ-research-opportunity-agent | - | Orphan (no rez-research-opportunity-agent) |
| REZ-reservation-service | - | Orphan (no rez-reservation-service) |
| REZ-review-response-engine | - | Orphan (no rez-review-response-engine) |
| REZ-rfm-plus-service | - | Orphan (no rez-rfm-plus-service) |
| REZ-rfm-service | - | Orphan (no rez-rfm-service) |
| REZ-rl-learning | - | Orphan (no rez-rl-learning) |
| REZ-saas-runtime | - | Orphan (no rez-saas-runtime) |
| REZ-sales-agent | **rez-sales-agent** | **DUPLICATE** |
| REZ-salon-expert | **rez-salon-expert** | **DUPLICATE** |
| REZ-score-service | **rez-score-service** | **DUPLICATE** |
| REZ-sentiment-analysis | - | Orphan (no rez-sentiment-analysis) |
| REZ-signal-aggregator | - | Orphan (no rez-signal-aggregator) |
| REZ-social-signals | **rez-social-signals** | **DUPLICATE** |
| REZ-society-os | - | Orphan (no rez-society-os) |
| REZ-staff-scheduling-service | **rez-staff-scheduling** | **DUPLICATE** |
| REZ-stream-processing | - | Orphan (no rez-stream-processing) |
| REZ-supplier-marketplace | - | Orphan (no rez-supplier-marketplace) |
| REZ-support-agent | **rez-support-agent** | **DUPLICATE** |
| REZ-support-copilot | - | Orphan (no rez-support-copilot) |
| REZ-synthetic-data | - | Orphan (no rez-synthetic-data) |
| REZ-targeting-engine | - | Orphan (no rez-targeting-engine) |
| REZ-taste-profile | - | Orphan (no rez-taste-profile) |
| REZ-temporal-intelligence | - | Orphan (no rez-temporal-intelligence) |
| REZ-tenant-adapter | - | Orphan (no rez-tenant-adapter) |
| REZ-training-data-service | **rez-training-data-service** | **DUPLICATE** |
| REZ-trust-os | - | Orphan (no rez-trust-os) |
| REZ-ugc-engine | - | Orphan (no rez-ugc-engine) |
| REZ-unified-attribution | - | Orphan (no rez-unified-attribution) |
| REZ-unified-chat | - | Orphan (no rez-unified-chat) |
| REZ-unified-commerce-graph | - | Orphan (no rez-unified-commerce-graph) |
| REZ-unified-crm-hub | - | Orphan (no rez-unified-crm-hub) |
| REZ-unified-crm-ui | - | Orphan (no rez-unified-crm-ui) |
| REZ-unified-engine | **rez-unified-engine** | **DUPLICATE** |
| REZ-unified-event-schema | - | Orphan (no rez-unified-event-schema) |
| REZ-unified-graph | - | Orphan (no rez-unified-graph) |
| REZ-unified-identity | - | Orphan (no rez-unified-identity) |
| REZ-unified-inventory | - | Orphan (no rez-unified-inventory) |
| REZ-unified-offer-brain | - | Orphan (no rez-unified-offer-brain) |
| REZ-unified-profile | - | Orphan (no rez-unified-profile) |
| REZ-unified-recommendations | - | Orphan (no rez-unified-recommendations) |
| REZ-universal-user-graph | - | Orphan (no rez-universal-user-graph) |
| REZ-user-agents | - | Orphan (no rez-user-agents) |
| REZ-validation-dashboard | - | Orphan (no rez-validation-dashboard) |
| REZ-vector-intelligence | - | Orphan (no rez-vector-intelligence) |
| REZ-visit-prediction | - | Orphan (no rez-visit-prediction) |
| REZ-visual-workflow-builder-ui | - | Orphan (no rez-visual-workflow-builder-ui) |
| REZ-waitlist-service | - | Orphan (no rez-waitlist-service) |
| REZ-what-if-analytics | - | Orphan (no rez-what-if-analytics) |
| REZ-whatsapp | - | Orphan (no rez-whatsapp) |
| REZ-workflow-builder | - | Orphan (no rez-workflow-builder) |
| REZ-company-memory | - | Orphan (no rez-company-memory) |
| REZ-creator-network | - | Orphan (no rez-creator-network) |
| REZ-cosmic-twin | - | Orphan (no rez-cosmic-twin) |
| REZ-ecosystem-orchestrator | - | Orphan (no rez-ecosystem-orchestrator) |
| REZ-budget-optimizer | - | Orphan (no rez-budget-optimizer) |
| REZ-autonomous-growth-agent | - | Orphan (no rez-autonomous-growth-agent) |
| REZ-care-service | - | Orphan (no rez-care-service) |
| REZ-attribution-loyalty-bridge | - | Orphan (no rez-attribution-loyalty-bridge) |
| REZ-attribution-system | - | Orphan (no rez-attribution-system) |
| REZ-audit-logging | - | Orphan (no rez-audit-logging) |
| REZ-api-gateway | - | Orphan (no rez-api-gateway) |
| REZ-api-keys | - | Orphan (no rez-api-keys) |
| REZ-cdp-service | - | Orphan (no rez-cdp-service) |
| REZ-circuit-breaker | - | Orphan (no rez-circuit-breaker) |
| REZ-cohort-service | **rez-cohort-service** | **DUPLICATE** |
| REZ-commerce-agents | - | Orphan (no rez-commerce-agents) |
| REZ-commerce-signal-connector | - | Orphan (no rez-commerce-signal-connector) |
| REZ-consumer-graph | - | Orphan (no rez-consumer-graph) |
| REZ-consumer-loop | - | Orphan (no rez-consumer-loop) |
| REZ-corpperks-bridge | - | Orphan (no rez-corpperks-bridge) |
| REZ-cross-company-loyalty | - | Orphan (no rez-cross-company-loyalty) |
| REZ-cross-sell-engine | - | Orphan (no rez-cross-sell-engine) |
| REZ-customer-360 | **rez-customer-360** | **DUPLICATE** |
| REZ-data-governance | - | Orphan (no rez-data-governance) |
| REZ-demand-forecast | - | Orphan (no rez-demand-forecast) |
| REZ-email-bridge | **rez-email-bridge** | **DUPLICATE** |
| REZ-event-bus | **rez-mcp-event-bus** | RELATED |
| REZ-expert-base | **rez-expert-base** | **DUPLICATE** |
| REZ-fraud-detection-service | **rez-fraud-detection-service** | **DUPLICATE** |
| REZ-gift-card-service | - | Orphan (no rez-gift-card-service) |
| REZ-human-context-graph | - | Orphan (no rez-human-context-graph) |
| REZ-info-agent | **rez-info-agent** | **DUPLICATE** |
| REZ-consultant-agent | **rez-consultant-agent** | **DUPLICATE** |
| REZ-permission-system | **rez-permission-system** | **DUPLICATE** |
| REZ-push-service | **rez-push-service** | **DUPLICATE** |
| REZ-reorder-engine | - | Orphan (no rez-reorder-engine) |
| REZ-sms-bridge | **rez-sms-bridge** | **DUPLICATE** |
| REZ-ai-plugins | **rez-ai-plugins** | **DUPLICATE** |
| REZ-ai-voice | **rez-ai-voice** | **DUPLICATE** |
| REZ-app-bridge | **rez-app-bridge** | **DUPLICATE** |
| REZ-conversation-intelligence | **rez-conversation-intelligence** | **DUPLICATE** |
| REZ-eta-prediction | **rez-eta-prediction** | **DUPLICATE** |
| REZ-e2e-tests | **rez-e2e-tests** | **DUPLICATE** |
| REZ-expert-rabtul.ts | - | File (not directory) |
| REZ-lakehouse | **rez-lakehouse** | **DUPLICATE** |
| REZ-action-engine | - | Orphan (no rez-action-engine) |
| REZ-action-orchestrator | - | Orphan (no rez-action-orchestrator) |
| REZ-agent-protocol | - | Orphan (no rez-agent-protocol) |
| REZ-analytics-orchestrator | - | Orphan (no rez-analytics-orchestrator) |
| REZ-ai-platform | **rez-ai-platform** | **DUPLICATE** |
| REZ-attribution-loyalty-bridge | - | Orphan (no rez-attribution-loyalty-bridge) |
| REZ-automl-pipeline | - | Orphan (no rez-automl-pipeline) |
| REZ-bootstrap-intelligence | - | Orphan (no rez-bootstrap-intelligence) |
| REZ-ledger-service | - | Orphan (no rez-ledger-service) |
| REZ-aggregator-hub | **rez-aggregator-hub** | **DUPLICATE** |
| REZ-real-estate-expert | - | Orphan (no rez-real-estate-expert) |
| REZ-ecompassionate-ai | - | Orphan (no rez-ecompassionate-ai) |
| REZ-taste-engine | - | Orphan (no rez-taste-engine) |
| REZ-slot-booking-service | - | Orphan (no rez-slot-booking-service) |
| REZ-loyalty-brain | - | Orphan (no rez-loyalty-brain) |
| REZ-commerce-graph | - | Orphan (no rez-commerce-graph) |
| REZ-product-intelligence | - | Orphan (no rez-product-intelligence) |
| REZ-real-time-decision-engine | - | Orphan (no rez-real-time-decision-engine) |
| REZ-travel-intelligence | - | Orphan (no rez-travel-intelligence) |
| REZ-content-moderation | - | Orphan (no rez-content-moderation) |
| REZ-campaign-optimizer | - | Orphan (no rez-campaign-optimizer) |
| REZ-mcp-automl | **rez-mcp-automl** | **DUPLICATE** |
| REZ-mcp-contracts | **rez-mcp-contracts** | **DUPLICATE** |
| REZ-mcp-cosmic-twin | **rez-mcp-cosmic-twin** | **DUPLICATE** |
| REZ-mcp-invoice | **rez-mcp-invoice** | **DUPLICATE** |
| REZ-mcp-legal | **rez-mcp-legal** | **DUPLICATE** |
| REZ-mcp-ranking | **rez-mcp-ranking** | **DUPLICATE** |

### Summary Statistics
| Category | Count |
|----------|-------|
| **REZ-* Directories** | 189 |
| **rez-* Directories** | 74 |
| **True Duplicates** | 32 pairs |
| **Orphan REZ-*** | 157 |
| **REZ-* with related rez-* (MCP wrappers)** | 2 |

---

## Phase 2: Deprecate `REZ-*` versions

### Strategy
1. **Keep REZ-* as alias wrappers** - Redirect to canonical rez-* service
2. **Add deprecation warnings** - Log warnings when REZ-* is used
3. **Document migration path** - Provide clear instructions
4. **Set deprecation timeline** - 90 days for full migration

### Deprecation Timeline
| Phase | Duration | Action |
|-------|----------|--------|
| Phase 1 | 0-30 days | Create alias wrappers for all duplicates |
| Phase 2 | 30-60 days | Add deprecation warnings to REZ-* services |
| Phase 3 | 60-90 days | Update all internal imports |
| Phase 4 | 90+ days | Remove REZ-* services (keep aliases) |

---

## Phase 3: Rename all `REZ-*` services

### Critical Dependencies to Update

#### Internal Dependencies (within REZ-Intelligence)
| Service | Imports From |
|---------|--------------|
| REZ-care-service | REZ-memory-layer, REZ-unified-profile, REZ-workflow-builder |
| REZ-support-copilot | REZ-care-service, REZ-sentiment-analysis |
| REZ-intelligence-hub | Multiple services |
| REZ-ai-orchestrator | REZ-autonomous-agents, REZ-agent-protocol |

#### External Dependencies
| Service | Used By |
|---------|---------|
| REZ-event-bus | REZ-memory-layer, REZ-insights-service, REZ-care-service |
| REZ-identity-graph | REZ-unified-profile, REZ-customer-intelligence-hub |
| REZ-recommendation-engine | REZ-personalization-engine, REZ-unified-recommendations |

### Migration Steps

1. **Update package.json dependencies**
```json
{
  "dependencies": {
    "rez-event-bus": "^1.0.0"
  }
}
```

2. **Update import statements**
```typescript
// Before
import { EventBus } from '@rez-ecosystem/event-bus';

// After
import { EventBus } from '@rez-ecosystem/rez-event-bus';
```

3. **Update Docker/environment variables**
```bash
# Before
EVENT_BUS_URL=http://REZ-event-bus:4082

# After
EVENT_BUS_URL=http://rez-event-bus:4082
```

4. **Update documentation references**

---

## Services to Rename (Priority Order)

### Priority 1 - High Traffic Services
| Current Name | Target Name | Impact |
|--------------|-------------|--------|
| REZ-event-bus | rez-event-bus | High |
| REZ-identity-graph | rez-identity-graph | High |
| REZ-memory-layer | rez-memory-layer | High |
| REZ-workflow-builder | rez-workflow-builder | High |
| REZ-recommendation-engine | rez-recommendation-engine | High |

### Priority 2 - Medium Traffic Services
| Current Name | Target Name | Impact |
|--------------|-------------|--------|
| REZ-personalization-engine | rez-personalization-engine | Medium |
| REZ-targeting-engine | rez-targeting-engine | Medium |
| REZ-predictive-engine | rez-personalization-engine | Medium |
| REZ-signal-aggregator | rez-signal-aggregator | Medium |
| REZ-intent-predictor | rez-intent-predictor | Medium |

### Priority 3 - Low Traffic Services
All remaining REZ-* services to rez-* equivalents.

---

## Dependencies to Update

### External Services Importing from REZ-Intelligence
| External Service | Imports From REZ-Intelligence |
|------------------|-------------------------------|
| REZ-Consumer | REZ-event-bus, REZ-identity-graph, REZ-memory-layer |
| RABTUL-Technologies | REZ-api-gateway, REZ-auth-service (different) |
| AdBazaar | REZ-dooh-intelligence, REZ-targeting-engine |
| KHAIRMOVE | REZ-event-bus, REZ-intent-predictor |
| HOJAI-AI | REZ-event-bus (for cross-service intelligence) |

---

## Verification Checklist

- [ ] All service names use `rez-` prefix
- [ ] All imports updated to `rez-*` format
- [ ] All Docker images use `rez-*` naming
- [ ] All environment variables use `rez-*` format
- [ ] All documentation updated
- [ ] All CI/CD pipelines updated
- [ ] All monitoring/alerting updated
- [ ] All external references updated

---

## Enforcement

This naming standard is **mandatory**. All new services MUST use `rez-` prefix.

**Violations:**
- PRs with REZ-* naming will be rejected
- CI/CD will fail on REZ-* naming
- New services using REZ-* will be sent back for correction

---

**Last Updated:** June 4, 2026
**Next Review:** Weekly until migration complete
