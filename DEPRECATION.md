# REZ-Intelligence Deprecation Guide

**Version:** 1.0
**Date:** June 4, 2026
**Status:** MANDATORY - All services MUST follow these deprecation procedures

---

## Overview

This document lists all deprecated service names in REZ-Intelligence and provides migration instructions. All services using the `REZ-` prefix (uppercase) are deprecated in favor of `rez-` (lowercase) naming convention.

---

## Table of Contents

1. [Why This Deprecation](#why-this-deprecation)
2. [Deprecation Timeline](#deprecation-timeline)
3. [True Duplicates (32 pairs)](#true-duplicates-32-pairs)
4. [Orphan REZ-* Services (157)](#orphan-rez--services-157)
5. [Related Services (MCP Wrappers)](#related-services-mcp-wrappers)
6. [Migration Instructions](#migration-instructions)
7. [Rollback Procedures](#rollback-procedures)
8. [Support & Contacts](#support--contacts)

---

## Why This Deprecation

| Issue | Uppercase REZ-* | Lowercase rez-* |
|-------|-----------------|-----------------|
| Unix Compatibility | Breaks scripts, causes issues | Works everywhere |
| NPM Packages | Non-standard | Industry standard |
| Docker/Container Names | Requires quoting | Works directly |
| URL Paths | Encodes to %20 | Direct mapping |
| Case-Insensitive FS | Creates confusion | Clear hierarchy |
| CLI Arguments | Needs escaping | Works as-is |

---

## Deprecation Timeline

| Phase | Dates | Action |
|-------|-------|--------|
| **Phase 1** | June 4-30, 2026 | Create alias wrappers for all duplicates |
| **Phase 2** | July 1-30, 2026 | Add deprecation warnings to REZ-* services |
| **Phase 3** | Aug 1-30, 2026 | Update all internal imports |
| **Phase 4** | Sept 1+, 2026 | Remove REZ-* services (keep aliases) |

### Key Dates

- **June 4, 2026**: Deprecation announced
- **July 4, 2026**: Phase 2 complete - all REZ-* show warnings
- **August 4, 2026**: Phase 3 complete - no internal REZ-* imports
- **September 4, 2026**: Phase 4 - REZ-* packages removed from registry
- **December 4, 2026**: Legacy support ends (external consumers)

---

## True Duplicates (32 pairs)

These services have both `REZ-*` and `rez-*` versions. The `REZ-*` versions are deprecated.

### Complete Migration Table

| Deprecated (REZ-*) | Canonical (rez-*) | Category | Priority |
|-------------------|-------------------|----------|----------|
| REZ-behavioral-psychology | rez-behavioral-psychology | AI/ML | Medium |
| REZ-competitor-detection | rez-competitor-detection | Intelligence | Medium |
| REZ-confidence-scorer | rez-confidence-scorer | ML Models | High |
| REZ-context-engine | rez-context-engine | Core AI | High |
| REZ-consumer-copilot | rez-consumer-copilot | Consumer | High |
| REZ-core-brain | rez-core-brain | Core AI | Critical |
| REZ-crosschannel-attribution | rez-crosschannel-attribution | Analytics | Medium |
| REZ-culinary-expert | rez-culinary-expert | Domain Expert | Low |
| REZ-education-expert | rez-education-expert | Domain Expert | Low |
| REZ-email-bridge | rez-email-bridge | Communication | Medium |
| REZ-fleet-management | rez-fleet-management | Fleet | Medium |
| REZ-fraud-agent | rez-fraud-agent | Security | Critical |
| REZ-identity-graph | rez-identity-graph | Core Data | Critical |
| REZ-intelligence-hub | rez-intelligence-hub | Platform | High |
| REZ-location-intelligence | rez-location-intelligence | Geo | Medium |
| REZ-migration-scripts | rez-migration-scripts | DevOps | Low |
| REZ-ml-engine | rez-ml-engine | ML Platform | High |
| REZ-ml-feature-store | rez-ml-feature-store | ML Platform | High |
| REZ-ml-model-registry | rez-ml-model-registry | ML Platform | High |
| REZ-ml-models | rez-ml-models | ML Models | High |
| REZ-price-optimization-service | rez-price-optimization-service | Commerce | Medium |
| REZ-profile-aggregator-service | rez-profile-aggregator-service | Data | Medium |
| REZ-rate-limit | rez-rate-limit | Infrastructure | High |
| REZ-rcs-bridge | rez-rcs-bridge | Communication | Medium |
| REZ-recharge-service | rez-recharge-service | Commerce | Medium |
| REZ-sales-agent | rez-sales-agent | Agent | Medium |
| REZ-salon-expert | rez-salon-expert | Domain Expert | Low |
| REZ-score-service | rez-score-service | Analytics | Medium |
| REZ-social-signals | rez-social-signals | Social | Medium |
| REZ-staff-scheduling-service | rez-staff-scheduling | Workforce | Medium |
| REZ-support-agent | rez-support-agent | Agent | Medium |
| REZ-training-data-service | rez-training-data-service | ML Platform | High |
| REZ-unified-engine | rez-unified-engine | Platform | High |
| REZ-cohort-service | rez-cohort-service | Analytics | Medium |
| REZ-customer-360 | rez-customer-360 | Data | High |
| REZ-expert-base | rez-expert-base | Platform | Medium |
| REZ-fraud-detection-service | rez-fraud-detection-service | Security | Critical |
| REZ-info-agent | rez-info-agent | Agent | Medium |
| REZ-consultant-agent | rez-consultant-agent | Agent | Medium |
| REZ-permission-system | rez-permission-system | Security | Critical |
| REZ-push-service | rez-push-service | Communication | High |
| REZ-sms-bridge | rez-sms-bridge | Communication | Medium |
| REZ-ai-plugins | rez-ai-plugins | Platform | Medium |
| REZ-ai-voice | rez-ai-voice | Platform | Medium |
| REZ-app-bridge | rez-app-bridge | Integration | Medium |
| REZ-conversation-intelligence | rez-conversation-intelligence | AI | High |
| REZ-eta-prediction | rez-eta-prediction | ML Models | High |
| REZ-e2e-tests | rez-e2e-tests | Testing | Low |
| REZ-lakehouse | rez-lakehouse | Data Platform | High |
| REZ-ai-platform | rez-ai-platform | Platform | High |
| REZ-aggregator-hub | rez-aggregator-hub | Platform | Medium |
| REZ-mcp-automl | rez-mcp-automl | MCP | Medium |
| REZ-mcp-contracts | rez-mcp-contracts | MCP | Medium |
| REZ-mcp-cosmic-twin | rez-mcp-cosmic-twin | MCP | Medium |
| REZ-mcp-invoice | rez-mcp-invoice | MCP | Medium |
| REZ-mcp-legal | rez-mcp-legal | MCP | Medium |
| REZ-mcp-ranking | rez-mcp-ranking | MCP | High |

---

## Orphan REZ-* Services (157)

These services have `REZ-*` naming but NO `rez-*` counterpart. They need review.

### Action Required: Determine fate of each service

| Status | Count | Action |
|--------|-------|--------|
| **Rename to rez-*** | ~80 | Create rez-* version, deprecate REZ-* |
| **Archive/Remove** | ~50 | No longer needed |
| **Merge with existing** | ~20 | Combine with related service |
| **Unknown** | ~7 | Needs investigation |

### Categorized Orphan List

#### Critical Infrastructure (Review First)
| Service | Recommendation |
|---------|----------------|
| REZ-memory-layer | Create rez-memory-layer |
| REZ-workflow-builder | Create rez-workflow-builder |
| REZ-unified-profile | Create rez-unified-profile |
| REZ-recommendation-engine | Create rez-recommendation-engine |
| REZ-personalization-engine | Create rez-personalization-engine |
| REZ-targeting-engine | Create rez-targeting-engine |

#### AI & ML Services
| Service | Recommendation |
|---------|----------------|
| REZ-ai-orchestrator | Create rez-ai-orchestrator |
| REZ-autonomous-agents | Create rez-autonomous-agents |
| REZ-agent-protocol | Create rez-agent-protocol |
| REZ-reasoning-engine | Create rez-reasoning-engine |
| REZ-memory-engine | Create rez-memory-engine |
| REZ-vector-intelligence | Create rez-vector-intelligence |
| REZ-federated-ml | Archive (not used) |
| REZ-synthetic-data | Archive (not used) |

#### Data & Analytics
| Service | Recommendation |
|---------|----------------|
| REZ-data-platform | Create rez-data-platform |
| REZ-data-warehouse | Create rez-data-warehouse |
| REZ-insights-service | Create rez-insights-service |
| REZ-stream-processing | Create rez-stream-processing |
| REZ-realtime-service | Merge with rez-event-bus |
| REZ-observability | Create rez-observability |

#### Domain Experts
| Service | Recommendation |
|---------|----------------|
| REZ-logistics-expert | Create rez-logistics-expert |
| REZ-finance-expert | Create rez-finance-expert |
| REZ-real-estate-expert | Archive (low usage) |
| REZ-travel-intelligence | Create rez-travel-intelligence |

#### Commerce & Marketing
| Service | Recommendation |
|---------|----------------|
| REZ-campaign-optimizer | Create rez-campaign-optimizer |
| REZ-content-moderation | Create rez-content-moderation |
| REZ-qr-campaigns | Archive (replaced by AdBazaar) |
| REZ-dooh-intelligence | Archive (replaced by AdBazaar) |

#### Platform Services
| Service | Recommendation |
|---------|----------------|
| REZ-api-gateway | Create rez-api-gateway |
| REZ-api-keys | Create rez-api-keys |
| REZ-circuit-breaker | Create rez-circuit-breaker |
| REZ-feature-flags | Create rez-feature-flags |

#### Full Orphan List (Alphabetical)
```
REZ-ab-testing
REZ-ab-testing-service
REZ-action-engine
REZ-action-orchestrator
REZ-analytics-orchestrator
REZ-attribution-loyalty-bridge
REZ-attribution-system
REZ-audit-logging
REZ-automl-pipeline
REZ-autonomous-growth-agent
REZ-autonomous-loop
REZ-bootstrap-intelligence
REZ-budget-optimizer
REZ-campaign-optimizer
REZ-care-service
REZ-cdp-service
REZ-channel-orchestrator
REZ-commerce-agents
REZ-commerce-graph
REZ-commerce-signal-connector
REZ-competitor-alerts
REZ-content-moderation
REZ-consumer-graph
REZ-consumer-loop
REZ-corpperks-bridge
REZ-creative-engine
REZ-creator-network
REZ-cosmic-twin
REZ-cross-company-loyalty
REZ-cross-sell-engine
REZ-customer-intelligence-hub
REZ-customer-platform-ui
REZ-data-governance
REZ-data-platform
REZ-data-warehouse
REZ-demand-forecast
REZ-delivery-intelligence
REZ-delivery-tracking-service
REZ-dooh-attribution
REZ-dooh-intelligence
REZ-ecompassionate-ai
REZ-ecosystem-hub
REZ-ecosystem-orchestrator
REZ-emotional-intelligence
REZ-enterprise-gateway
REZ-error-intelligence
REZ-event-connector
REZ-event-platform
REZ-experimentation-engine
REZ-explainability-engine
REZ-feature-flags
REZ-federated-ml
REZ-feedback-collector
REZ-finance-expert
REZ-flywheel-engine
REZ-flywheel-mvp
REZ-geo-intelligence
REZ-growth-playbook
REZ-health-monitor
REZ-human-context-graph
REZ-human-in-loop
REZ-hyperlocal-brain
REZ-hyperlocal-targeting
REZ-identity-bridge
REZ-incrementality-testing
REZ-insights-service
REZ-integration-sdk
REZ-intelligence-sdk
REZ-inventory-alerts-service
REZ-inventory-intelligence
REZ-inventory-sync
REZ-karma-loyalty-bridge
REZ-ledger-service
REZ-life-pattern-engine
REZ-life-story-engine
REZ-live-action-feed
REZ-loyalty-brain
REZ-logistics-expert
REZ-ltv-attribution
REZ-memory-engine
REZ-memory-layer
REZ-merchant-360
REZ-merchant-brain
REZ-merchant-graph
REZ-merchant-health-score
REZ-merchant-intelligence
REZ-merchant-os
REZ-ml-observability
REZ-ml-production
REZ-ml-studio
REZ-moment-ads
REZ-monitoring
REZ-multi-location-service
REZ-multilingual
REZ-notification-router
REZ-observability
REZ-observability-system
REZ-offline-attribution
REZ-offline-commerce-tracker
REZ-ontology-engine
REZ-payments-brain
REZ-personalization-engine
REZ-planning-agent
REZ-predictive-engine
REZ-price-predictor
REZ-product-intelligence
REZ-qr-campaigns
REZ-ranking-service
REZ-real-estate-expert
REZ-realtime-gateway
REZ-realtime-segments
REZ-realtime-service
REZ-reasoning-engine
REZ-recommendation-engine
REZ-reconciliation-service
REZ-reinforcement-optimizer
REZ-research-opportunity-agent
REZ-reservation-service
REZ-review-response-engine
REZ-reorder-engine
REZ-rfm-plus-service
REZ-rfm-service
REZ-rl-learning
REZ-saas-runtime
REZ-sentiment-analysis
REZ-signal-aggregator
REZ-slot-booking-service
REZ-society-os
REZ-stream-processing
REZ-supplier-marketplace
REZ-support-copilot
REZ-synthetic-data
REZ-targeting-engine
REZ-taste-engine
REZ-taste-profile
REZ-temporal-intelligence
REZ-tenant-adapter
REZ-trade-intelligence
REZ-trust-os
REZ-ugc-engine
REZ-unified-attribution
REZ-unified-chat
REZ-unified-commerce-graph
REZ-unified-crm-hub
REZ-unified-crm-ui
REZ-unified-event-schema
REZ-unified-graph
REZ-unified-identity
REZ-unified-inventory
REZ-unified-offer-brain
REZ-unified-profile
REZ-unified-recommendations
REZ-universal-user-graph
REZ-user-agents
REZ-validation-dashboard
REZ-vector-intelligence
REZ-visit-prediction
REZ-visual-workflow-builder-ui
REZ-waitlist-service
REZ-what-if-analytics
REZ-whatsapp
REZ-workflow-builder
REZ-company-memory
```

---

## Related Services (MCP Wrappers)

These are special cases where `REZ-*` is a wrapper around an MCP service.

| REZ-* | Canonical | Relationship |
|-------|-----------|---------------|
| REZ-event-bus | rez-mcp-event-bus | MCP wrapper for event bus |
| REZ-feature-store | rez-ml-feature-store | MCP wrapper for feature store |

### Migration for MCP Wrappers

```typescript
// Before (deprecated)
import { EventBus } from '@rez-ecosystem/REZ-event-bus';

// After (canonical)
import { EventBus } from '@rez-ecosystem/rez-mcp-event-bus';
```

---

## Migration Instructions

### Step 1: Identify Usage

Find all files importing from `REZ-*` packages:

```bash
# In your project directory
grep -r "REZ-" --include="*.ts" --include="*.js" --include="*.json" .
grep -r "REZ-" docker-compose*.yml .env* 2>/dev/null
```

### Step 2: Update Dependencies

Update `package.json`:

```json
{
  "dependencies": {
    "@rez-ecosystem/REZ-old-service": "DEPRECATED",
    "@rez-ecosystem/rez-new-service": "^1.0.0"
  }
}
```

Then run:

```bash
npm install
```

### Step 3: Update Imports

Replace all imports:

```typescript
// Before (deprecated)
import { SomeComponent } from '@rez-ecosystem/REZ-old-service';
import * as OldService from '@rez-ecosystem/REZ-old-service';

// After (canonical)
import { SomeComponent } from '@rez-ecosystem/rez-new-service';
import * as NewService from '@rez-ecosystem/rez-new-service';
```

### Step 4: Update Environment Variables

Update `.env` files and Docker configurations:

```bash
# Before
SERVICE_URL=http://REZ-old-service:4082

# After
SERVICE_URL=http://rez-new-service:4082
```

### Step 5: Update Docker Compose

```yaml
# Before
services:
  old-service:
    image: rez-ecosystem/REZ-old-service:latest

# After
services:
  new-service:
    image: rez-ecosystem/rez-new-service:latest
```

### Step 6: Verify Migration

```bash
# Check no REZ-* imports remain
grep -r "REZ-" --include="*.ts" --include="*.js" .

# Run tests
npm test

# Check build
npm run build
```

---

## Rollback Procedures

If you need to rollback after migration:

### Emergency Rollback

1. Revert to previous commit
2. Re-install old packages
3. Re-import deprecated packages

### Gradual Rollback

1. Keep both REZ-* and rez-* imports temporarily
2. Use feature flags to switch between versions
3. Monitor for issues
4. Remove REZ-* after confirmation

```typescript
import { FeatureEnabled } from '@rez-ecosystem/rez-feature-flags';

if (FeatureEnabled('use-new-service')) {
  import { Service } from '@rez-ecosystem/rez-new-service';
} else {
  import { Service } from '@rez-ecosystem/REZ-old-service';
}
```

---

## Support & Contacts

| Team | Contact | Hours |
|------|---------|-------|
| REZ-Intelligence Core | rez-intelligence@hojai.ai | 9AM-6PM IST |
| Migration Support | migration-support@hojai.ai | 24/7 |
| Emergency Escalation | oncall@hojai.ai | 24/7 |

### Slack Channels
- `#rez-intelligence-migration` - General migration discussion
- `#rez-platform-support` - Platform support
- `#migration-emergency` - Emergency issues only

### GitHub
- [REZ-Intelligence Issues](https://github.com/rez-ecosystem/REZ-Intelligence/issues)
- Tag: `migration-deprecation`

---

## Quick Reference Card

```
╔════════════════════════════════════════════════════════════════════╗
║                    REZ-* DEPRECATION QUICK REFERENCE               ║
╠════════════════════════════════════════════════════════════════════╣
║ DEPRECATED    →  CANONICAL                                          ║
║────────────────────────────────────────────────────────────────────║
║ REZ-event-bus            →  rez-mcp-event-bus  (MCP wrapper)       ║
║ REZ-identity-graph       →  rez-identity-graph                      ║
║ REZ-core-brain           →  rez-core-brain                          ║
║ REZ-fraud-agent          →  rez-fraud-agent                         ║
║ REZ-ml-engine            →  rez-ml-engine                          ║
║ REZ-rate-limit           →  rez-rate-limit                         ║
║ REZ-permission-system    →  rez-permission-system                  ║
║────────────────────────────────────────────────────────────────────║
║ KEY DATES                                                            ║
║ June 4, 2026     - Deprecation announced                            ║
║ July 4, 2026     - Phase 2: Warnings added                         ║
║ August 4, 2026   - Phase 3: Internal imports updated                 ║
║ September 4, 2026 - Phase 4: REZ-* removed from registry           ║
╚════════════════════════════════════════════════════════════════════╝
```

---

**Last Updated:** June 4, 2026
**Next Review:** Weekly until migration complete
**Document Owner:** REZ-Intelligence Team
