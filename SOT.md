# REZ Intelligence - SOT Reference

**Master SOT:** [RABTUL-Technologies/SOT.md](https://github.com/imrejaul007/RABTUL-Technologies/blob/main/SOT.md)

---

## Quick Links

| Document | Location |
|----------|----------|
| **Master SOT** | `RABTUL-Technologies/SOT.md` |
| RAP (Services) | `RABTUL-Technologies/RAP.md` |
| Governance | `RABTUL-Technologies/SERVICE-GOVERNANCE.md` |
| Migration Guide | `RABTUL-Technologies/MIGRATION-GUIDE.md` |

---

## Service Registry

**Total Services:** 93 documented with SPEC.md

### AI & Agents

| Service | Port | Category | Status |
|---------|------|----------|--------|
| REZ-autonomous-agents | 4062 | AI Agents | ✅ |
| REZ-ai-orchestrator | 4101 | AI Agents | ✅ |
| REZ-ai-router | - | AI Agents | ✅ |
| REZ-creative-engine | 4107 | AI Agents | ✅ |
| rez-fitness-expert | 3010 | Expert Agents | ✅ |
| rez-salon-expert | 3005 | Expert Agents | ✅ |
| rez-hospitality-expert | 3000 | Expert Agents | ✅ |
| rez-education-expert | 3006 | Expert Agents | ✅ |
| rez-travel-expert | 3003 | Expert Agents | ✅ |
| rez-health-expert | 3011 | Expert Agents | ✅ |
| rez-retail-expert | 3004 | Expert Agents | ✅ |
| rez-fraud-agent | - | Security Agents | ✅ |
| rez-sales-agent | - | Sales Agents | ✅ |
| REZ-research-opportunity-agent | - | Research Agents | ✅ |
| REZ-care-service | 4055 | Support | ✅ |
| REZ-support-copilot | 4033 | Support | ✅ |
| REZ-confidence-scorer | - | AI Scoring | ✅ |
| REZ-conversation-intelligence | - | NLP | ✅ |
| REZ-bootstrap-intelligence | 4065 | Cold Start | ✅ |

### Predictions & ML

| Service | Port | Category | Status |
|---------|------|----------|--------|
| REZ-predictive-engine | 4123 | Predictions | ✅ |
| REZ-intent-predictor | 4018 | Intent | ✅ |
| REZ-reorder-engine | 4156 | Reorder | ✅ |
| REZ-price-predictor | - | Pricing | ✅ |
| REZ-demand-forecast | - | Forecasting | ✅ |
| REZ-visit-prediction | - | Predictions | ✅ |
| REZ-eta-prediction | - | ETA | ✅ |
| REZ-ml-production | - | ML Models | ✅ |
| REZ-ml-studio | - | ML Studio | ✅ |
| REZ-ml-observability | 4130 | ML Monitoring | ✅ |
| REZ-flywheel-engine | 4110 | Growth | ✅ |

### Signals & Analytics

| Service | Port | Category | Status |
|---------|------|----------|--------|
| REZ-signal-aggregator | 4121 | Signals | ✅ |
| REZ-realtime-segments | 4126 | Segmentation | ✅ |
| REZ-ab-testing | - | Experimentation | ✅ |
| REZ-ab-testing-service | - | Experimentation | ✅ |
| REZ-experimentation-engine | - | Experiments | ✅ |
| REZ-analytics-orchestrator | - | Analytics | ✅ |
| REZ-insights-service | - | Insights | ✅ |
| REZ-rfm-service | - | RFM | ✅ |
| REZ-rfm-plus-service | - | RFM+ | ✅ |
| rez-social-signals | - | Social | ✅ |

### Customer Intelligence

| Service | Port | Category | Status |
|---------|------|----------|--------|
| REZ-identity-graph | 4050 | Identity | ✅ |
| REZ-unified-identity | - | Cross-Company | ✅ |
| REZ-customer-intelligence-hub | - | Customer 360 | ✅ |
| REZ-unified-profile | 4120 | Profiles | ✅ |
| REZ-realtime-gateway | - | Real-time | ✅ |
| REZ-realtime-service | - | Real-time | ✅ |
| rez-consumer-copilot | - | Copilot | ✅ |
| rez-context-engine | - | Context | ✅ |
| REZ-taste-profile | - | Preferences | ✅ |
| REZ-behavioral-psychology | - | Psychology | ✅ |
| REZ-consumer-graph | - | Graph | ✅ |
| REZ-universal-user-graph | - | User Graph | ✅ |

### Commerce & Attribution

| Service | Port | Category | Status |
|---------|------|----------|--------|
| REZ-attribution-system | - | Attribution | ✅ |
| REZ-dooh-attribution | 4081 | DOOH | ✅ |
| REZ-attribution-loyalty-bridge | 4155 | Attribution | ✅ |
| rez-crosschannel-attribution | - | Attribution | ✅ |
| REZ-ltv-attribution | - | LTV | ✅ |
| REZ-event-bus | 4082 | Events | ✅ |
| REZ-event-platform | - | Events | ✅ |
| REZ-event-connector | 4158 | Events | ✅ |
| REZ-stream-processing | - | Streaming | ✅ |
| REZ-unified-commerce-graph | 4170 | Graph | ✅ |

### Targeting & Personalization

| Service | Port | Category | Status |
|---------|------|----------|--------|
| REZ-targeting-engine | - | Targeting | ✅ |
| REZ-personalization-engine | - | Personalization | ✅ |
| REZ-recommendation-engine | - | Recommendations | ✅ |
| REZ-unified-recommendations | - | Recommendations | ✅ |
| REZ-hyperlocal-targeting | - | Geo-targeting | ✅ |
| REZ-moment-ads | 4111 | Moment Ads | ✅ |
| REZ-dooh-intelligence | 4080 | DOOH | ✅ |

### Merchant Intelligence

| Service | Port | Category | Status |
|---------|------|----------|--------|
| REZ-merchant-intelligence | 4122 | Merchant | ✅ |
| REZ-merchant-brain | - | Merchant | ✅ |
| REZ-merchant-360 | - | Merchant | ✅ |
| REZ-competitor-detection | - | Competition | ✅ |
| REZ-supplier-marketplace | 4063 | B2B | ✅ |
| REZ-inventory-intelligence | - | Inventory | ✅ |
| REZ-inventory-alerts-service | 4064 | Alerts | ✅ |
| REZ-inventory-sync | - | Sync | ✅ |
| REZ-unified-inventory | - | Inventory | ✅ |

### Loyalty & Rewards

| Service | Port | Category | Status |
|---------|------|----------|--------|
| REZ-karma-loyalty-bridge | 4098 | Karma | ✅ |
| REZ-cross-company-loyalty | - | Loyalty | ✅ |
| REZ-gift-card-service | - | Gifts | ✅ |
| REZ-feedback-collector | - | Feedback | ✅ |

### Infrastructure

| Service | Port | Category | Status |
|---------|------|----------|--------|
| REZ-feature-flags | 4030 | Flags | ✅ |
| REZ-memory-engine | 4051 | Memory | ✅ |
| REZ-api-gateway | - | Gateway | ✅ |
| REZ-api-keys | - | API Keys | ✅ |
| REZ-event-connector | 4158 | Connector | ✅ |
| REZ-unified-event-schema | - | Schemas | ✅ |
| REZ-data-governance | - | Governance | ✅ |
| REZ-data-platform | - | Data | ✅ |
| REZ-data-warehouse | - | Warehouse | ✅ |
| REZ-feature-store | 4127 | Features | ✅ |

### Observability

| Service | Port | Category | Status |
|---------|------|----------|--------|
| REZ-health-monitor | - | Health | ✅ |
| REZ-observability | - | Observability | ✅ |
| REZ-observability-system | 4109 | Observability | ✅ |
| REZ-error-intelligence | - | Errors | ✅ |
| REZ-audit-logging | - | Audit | ✅ |
| REZ-validation-dashboard | - | Validation | ✅ |

### Communication

| Service | Port | Category | Status |
|---------|------|----------|--------|
| REZ-unified-engine | - | Communication | ✅ |
| REZ-whatsapp-orchestrator-bridge | - | WhatsApp | ✅ |
| REZ-notification-router | - | Notifications | ✅ |
| rez-email-bridge | - | Email | ✅ |
| rez-sms-bridge | - | SMS | ✅ |
| rez-rcs-bridge | - | RCS | ✅ |
| rez-ai-voice | - | Voice | ✅ |

### Integration Services

| Service | Port | Category | Status |
|---------|------|----------|--------|
| REZ-integration-sdk | - | SDK | ✅ |
| REZ-ecosystem-hub | - | Hub | ✅ |
| REZ-corpperks-bridge | - | Bridge | ✅ |
| REZ-enterprise-gateway | 4102 | Enterprise | ✅ |
| REZ-commerce-signal-connector | - | Commerce | ✅ |
| rez-service-connectors | - | Connectors | ✅ |
| rez-app-bridge | - | App Bridge | ✅ |
| REZ-commerce-agents | - | Commerce | ✅ |

### Other Services

| Service | Port | Category | Status |
|---------|------|----------|--------|
| REZ-creator-network | - | Creator | ✅ |
| REZ-consumer-loop | - | Consumer | ✅ |
| rez-fleet-management | - | Fleet | ✅ |
| REZ-merchant-os | - | Merchant OS | ✅ |
| REZ-reservation-service | - | Reservations | ✅ |
| REZ-staff-scheduling-service | - | Scheduling | ✅ |
| REZ-waitlist-service | - | Waitlist | ✅ |
| REZ-multi-location-service | - | Multi-location | ✅ |
| REZ-delivery-tracking-service | - | Delivery | ✅ |
| REZ-delivery-intelligence | - | Delivery | ✅ |
| REZ-offline-commerce-tracker | - | Offline | ✅ |
| REZ-reconciliation-service | - | Reconciliation | ✅ |
| REZ-ledger-service | - | Ledger | ✅ |
| REZ-payments-brain | - | Payments | ✅ |
| REZ-cdp-service | - | CDP | ✅ |
| REZ-cohort-service | - | Cohorts | ✅ |
| rez-priority-engine | - | Priority | ✅ |
| rez-unified-agent-sdk | - | Agent SDK | ✅ |
| rez-info-agent | - | Info Agent | ✅ |
| rez-support-agent | - | Support Agent | ✅ |
| rez-culinary-expert | - | Culinary | ✅ |
| rez-consultant-agent | - | Consultant | ✅ |
| rez-permission-system | - | Permissions | ✅ |
| REZ-user-agents | - | User Agents | ✅ |
| REZ-qr-campaigns | - | QR Campaigns | ✅ |
| REZ-knowledge-graph | - | Knowledge | ✅ |

---

## Port Registry

| Port | Service |
|------|---------|
| 3000 | rez-hospitality-expert |
| 3003 | rez-travel-expert |
| 3004 | rez-retail-expert |
| 3005 | rez-salon-expert |
| 3006 | rez-education-expert |
| 3010 | rez-fitness-expert |
| 3011 | rez-health-expert |
| 4018 | REZ-intent-predictor |
| 4050 | REZ-identity-graph |
| 4051 | REZ-memory-engine |
| 4055 | REZ-care-service |
| 4062 | REZ-autonomous-agents |
| 4063 | REZ-supplier-marketplace |
| 4064 | REZ-inventory-alerts-service |
| 4065 | REZ-bootstrap-intelligence |
| 4080 | REZ-dooh-intelligence |
| 4081 | REZ-dooh-attribution |
| 4082 | REZ-event-bus |
| 4098 | REZ-karma-loyalty-bridge |
| 4101 | REZ-ai-orchestrator |
| 4102 | REZ-enterprise-gateway |
| 4107 | REZ-creative-engine |
| 4109 | REZ-observability-system |
| 4110 | REZ-flywheel-engine |
| 4111 | REZ-moment-ads |
| 4120 | REZ-unified-profile |
| 4121 | REZ-signal-aggregator |
| 4122 | REZ-merchant-intelligence |
| 4123 | REZ-predictive-engine |
| 4126 | REZ-realtime-segments |
| 4127 | REZ-feature-store |
| 4128 | REZ-decision-engine |
| 4129 | REZ-graph-service |
| 4130 | REZ-ml-observability |
| 4131 | REZ-intelligence-hub |
| 4155 | REZ-attribution-loyalty-bridge |
| 4156 | REZ-reorder-engine |
| 4158 | REZ-event-connector |
| 4170 | REZ-unified-commerce-graph |

---

## Documentation

- **SPEC.md files:** 93 services documented
- **Categories:** 20+ service categories
- **Integration Points:** Fully documented

---

**Last Updated:** May 20, 2026
