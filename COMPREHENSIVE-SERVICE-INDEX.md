# REZ-Intelligence Comprehensive Service Index

**Version:** 1.0
**Date:** June 4, 2026
**Total Services:** 263 services

This document is the single source of truth for all services in REZ-Intelligence. All services use the `rez-` prefix (lowercase).

---

## Table of Contents

1. [AI Agents & Autonomy](#ai-agents--autonomy)
2. [Prediction & ML](#prediction--ml)
3. [Customer Intelligence](#customer-intelligence)
4. [Commerce & Attribution](#commerce--attribution)
5. [Personalization & Recommendations](#personalization--recommendations)
6. [Identity & Security](#identity--security)
7. [Knowledge & Data](#knowledge--data)
8. [Communication & Messaging](#communication--messaging)
9. [Location & Geo](#location--geo)
10. [Loyalty & Rewards](#loyalty--rewards)
11. [Expert Domain Agents](#expert-domain-agents)
12. [MCP Servers](#mcp-servers)
13. [Infrastructure & Platform](#infrastructure--platform)
14. [Analytics & Insights](#analytics--insights)
15. [Operations & Support](#operations--support)
16. [Integrations & Bridges](#integrations--bridges)
17. [SDKs & Client Libraries](#sdks--client-libraries)

---

## AI Agents & Autonomy

### Core AI Orchestration

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-ai-orchestrator | 4101 | Multi-agent coordination | ✅ Complete | rez-autonomous-agents |
| rez-ai-router | 4052 | Intent classification & routing | ✅ Complete | rez-intent-predictor |
| rez-agent-registry | 4101 | Agent discovery & capabilities | ✅ Complete | - |
| rez-agent-protocol | - | Standardized agent communication | ✅ Complete | - |
| rez-orchestrator-v2 | 4170 | Enhanced orchestration | ✅ Complete | rez-intent-predictor, rez-expert-base |

### Autonomous Agents (8 agents)

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-autonomous-agents | 4062 | Self-learning agents | ✅ Complete | rez-event-bus, rez-memory-layer |
| rez-autonomous-loop | 4800 | OADA loop (Observe-Act-Decide-Learn) | ✅ Complete | rez-company-memory, rez-live-action-feed |
| rez-autonomous-growth-agent | - | Growth automation | ✅ Complete | rez-signal-aggregator |

### Domain-Specific Agents

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-fraud-agent | - | Fraud detection | ✅ Complete | rez-ml-models |
| rez-sales-agent | - | Sales automation | ✅ Complete | rez-customer-360 |
| rez-support-agent | - | Support automation | ✅ Complete | rez-knowledge-base-service |
| rez-info-agent | - | Information retrieval | ✅ Complete | rez-knowledge-graph |
| rez-consultant-agent | - | Business consulting | ✅ Complete | rez-analytics |
| rez-research-opportunity-agent | - | Market research | ✅ Complete | rez-competitor-detection |

### Reasoning & Planning

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-reasoning-engine | - | Chain-of-thought reasoning | ✅ Complete | - |
| rez-planning-agent | 4170 | Multi-step planning | ✅ Complete | rez-reasoning-engine |
| rez-vector-intelligence | - | Vector embeddings | ✅ Complete | - |
| rez-ontology-engine | - | Knowledge ontology | ✅ Complete | - |
| rez-causal-ai | - | Causal inference | ✅ Complete | - |

---

## Prediction & ML

### Core ML Infrastructure

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-ml-engine | - | ML training & inference | ✅ Complete | - |
| rez-ml-models | - | Production ML models | ✅ Complete | rez-ml-model-registry |
| rez-ml-feature-store | 3005 | Feature serving | ✅ Complete | - |
| rez-ml-model-registry | - | Model versioning | ✅ Complete | - |
| rez-ml-production | - | MLOps platform | ✅ Complete | rez-ml-observability |
| rez-ml-observability | 4130 | Model monitoring | ✅ Complete | - |

### Prediction Services

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-predictive-engine | 4123 | Churn, LTV prediction | ✅ Complete | rez-ml-models |
| rez-intent-predictor | 4018 | User intent prediction | ✅ Complete | rez-intent-graph |
| rez-demand-forecast | - | Demand forecasting | ✅ Complete | rez-ml-models |
| rez-price-predictor | - | Dynamic pricing | ✅ Complete | rez-ml-models |
| rez-visit-prediction | - | Return prediction | ✅ Complete | rez-ml-models |
| rez-eta-prediction | - | ETA estimation | ✅ Complete | rez-location-intelligence |
| rez-reorder-engine | 4156 | Subscription optimization | ✅ Complete | rez-ml-models |
| rez-eta-prediction | - | Delivery ETA | ✅ Complete | rez-fleet-management |

### Advanced ML Services

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-federated-ml | 4165 | Privacy-preserving ML | ✅ Complete | - |
| rez-reinforcement-optimizer | 4147 | Multi-armed bandits | ✅ Complete | - |
| rez-synthetic-data | 4145 | Test data generation | ✅ Complete | - |
| rez-automl-pipeline | - | AutoML pipeline | ✅ Complete | rez-ml-engine |
| rez-bootstrap-intelligence | 4065 | Cold start solutions | ✅ Complete | - |

---

## Customer Intelligence

### Profile & Identity

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-identity-graph | 4050 | Cross-platform identity | ✅ Complete | - |
| rez-unified-identity | 4060 | Single identity management | ✅ Complete | rez-identity-graph |
| rez-unified-profile | 4120 | Unified customer profile | ✅ Complete | rez-identity-graph |
| rez-consumer-graph | - | Consumer relationships | ✅ Complete | rez-identity-graph |
| rez-universal-user-graph | - | User graph | ✅ Complete | rez-identity-graph |
| rez-user-agents | - | Device fingerprinting | ✅ Complete | - |

### Customer Intelligence

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-customer-360 | - | 360-degree view | ✅ Complete | rez-unified-profile |
| rez-customer-intelligence-hub | - | CDP capabilities | ✅ Complete | rez-identity-graph |
| rez-context-engine | - | Session context | ✅ Complete | rez-memory-layer |
| rez-behavioral-psychology | - | Psychology models | ✅ Complete | - |
| rez-taste-profile | - | Preference learning | ✅ Complete | rez-ml-models |
| rez-cohort-service | - | Cohort analysis | ✅ Complete | rez-unified-profile |

### Customer Engagement

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-consumer-copilot | - | Shopping assistant | ✅ Complete | rez-context-engine |
| rez-consumer-loop | - | Engagement loop | ✅ Complete | rez-signal-aggregator |
| rez-realtime-segments | 4126 | Dynamic segments | ✅ Complete | rez-identity-graph |
| rez-profile-aggregator-service | - | Profile aggregation | ✅ Complete | rez-unified-profile |

---

## Commerce & Attribution

### Attribution

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-attribution-system | - | Multi-touch attribution | ✅ Complete | rez-event-bus |
| rez-attribution-loyalty-bridge | 4155 | Attribution-loyalty bridge | ✅ Complete | rez-karma-loyalty-bridge |
| rez-crosschannel-attribution | - | Cross-channel attribution | ✅ Complete | rez-attribution-system |
| rez-ltv-attribution | - | LTV-based attribution | ✅ Complete | rez-predictive-engine |
| rez-incrementality-testing | - | Incrementality tests | ✅ Complete | rez-ab-testing |
| rez-offline-attribution | - | Offline attribution | ✅ Complete | rez-event-bus |

### Commerce Intelligence

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-commerce-signal-connector | 4150 | Commerce events | ✅ Complete | rez-event-bus |
| rez-commerce-agents | - | Commerce optimization | ✅ Complete | rez-attribution-system |
| rez-unified-commerce-graph | 4170 | Commerce knowledge graph | ✅ Complete | rez-knowledge-graph |
| rez-commerce-graph | - | Product relationships | ✅ Complete | - |
| rez-product-intelligence | - | Product analytics | ✅ Complete | - |

### Transactions

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-payments-brain | - | Payment intelligence | ✅ Complete | - |
| rez-ledger-service | - | Financial ledger | ✅ Complete | - |
| rez-reconciliation-service | - | Payment reconciliation | ✅ Complete | rez-ledger-service |
| rez-gift-card-service | - | Gift cards | ✅ Complete | rez-wallet-service |
| rez-recharge-service | - | Recharge services | ✅ Complete | - |

---

## Personalization & Recommendations

### Recommendation Engine

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-recommendation-engine | 4017 | Personalized recommendations | ✅ Complete | rez-intent-predictor |
| rez-personalization-engine | - | Real-time personalization | ✅ Complete | rez-recommendation-engine |
| rez-unified-recommendations | - | Cross-channel recommendations | ✅ Complete | rez-recommendation-engine |
| rez-cross-sell-engine | - | Cross-sell optimization | ✅ Complete | rez-recommendation-engine |
| rez-next-best-action | - | Next best action | ✅ Complete | rez-ml-models |

### Targeting

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-targeting-engine | - | Ad targeting | ✅ Complete | rez-realtime-segments |
| rez-hyperlocal-targeting | - | Geo targeting | ✅ Complete | rez-geo-intelligence |
| rez-moment-ads | 4111 | Contextual ads | ✅ Complete | rez-signal-aggregator |

---

## Identity & Security

### Trust & Security

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-trust-os | - | Trust scoring | ✅ Complete | rez-identity-graph |
| rez-fraud-detection-service | - | Pattern fraud | ✅ Complete | rez-ml-models |
| rez-confidence-scorer | - | Confidence scoring | ✅ Complete | rez-ml-models |
| reaz-threat-graph | 4715 | Threat intelligence | ✅ Complete | rez-identity-graph |

---

## Knowledge & Data

### Knowledge Management

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-knowledge-graph | - | Knowledge graph | ✅ Complete | - |
| rez-knowledge-base-service | 4005 | Knowledge articles | ✅ Complete | rez-knowledge-graph |
| rez-knowledge-service | - | Knowledge API | ✅ Complete | rez-knowledge-base-service |
| rez-vector-intelligence | - | Semantic search | ✅ Complete | - |

### Data Platform

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-data-platform | - | ETL pipelines | ✅ Complete | - |
| rez-data-warehouse | - | OLAP queries | ✅ Complete | - |
| rez-lakehouse | - | Lakehouse architecture | ✅ Complete | - |
| rez-data-governance | - | Data compliance | ✅ Complete | - |
| rez-stream-processing | 4132 | Stream processing | ✅ Complete | - |

---

## Communication & Messaging

### Messaging Channels

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-whatsapp | 4202 | WhatsApp commerce | ✅ Complete | rez-event-bus |
| rez-whatsapp-orchestrator-bridge | - | WhatsApp orchestration | ✅ Complete | rez-whatsapp |
| rez-sms-bridge | - | SMS integration | ✅ Complete | - |
| rez-email-bridge | - | Email integration | ✅ Complete | - |
| rez-rcs-bridge | 4140 | RCS messaging | ✅ Complete | - |
| rez-ai-voice | - | Voice AI | ✅ Complete | - |

### Notification Management

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-notification-router | - | Multi-channel routing | ✅ Complete | rez-sms-bridge, rez-email-bridge |
| rez-notification-events | - | Event-based notifications | ✅ Complete | rez-event-bus |
| rez-push-service | 8081 | FCM push | ✅ Complete | - |

### Unified Communication

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-unified-messaging | 8083 | Unified messaging | ✅ Complete | rez-sms-bridge, rez-email-bridge |
| rez-unified-engine | - | Cross-domain processing | ✅ Complete | - |
| rez-unified-chat | - | Chat platform | ✅ Complete | rez-context-engine |

---

## Location & Geo

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-geo-intelligence | 4140 | Geo analytics | ✅ Complete | - |
| rez-location-intelligence | - | Hot zone detection | ✅ Complete | - |
| rez-hyperlocal-brain | 4148 | Unified location intelligence | ✅ Complete | rez-geo-intelligence |

---

## Loyalty & Rewards

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-karma-loyalty-bridge | 4098 | Karma points | ✅ Complete | - |
| rez-cross-company-loyalty | - | Coalition loyalty | ✅ Complete | rez-karma-loyalty-bridge |
| rez-rfm-service | - | RFM analysis | ✅ Complete | - |
| rez-rfm-plus-service | - | Enhanced RFM | ✅ Complete | rez-rfm-service |
| rez-feedback-collector | - | Survey collection | ✅ Complete | - |
| rez-loyalty-brain | - | Loyalty intelligence | ✅ Complete | rez-karma-loyalty-bridge |

---

## Expert Domain Agents

### Industry Experts (Vertical AI)

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-hospitality-expert | 3000 | Hotels & hospitality | ✅ Complete | rez-knowledge-graph |
| rez-salon-expert | 3005 | Beauty & wellness | ✅ Complete | rez-knowledge-graph |
| rez-fitness-expert | 3010 | Fitness & health | ✅ Complete | rez-knowledge-graph |
| rez-health-expert | 3011 | Healthcare | ✅ Complete | rez-knowledge-graph |
| rez-travel-expert | 3003 | Travel & tourism | ✅ Complete | rez-knowledge-graph |
| rez-retail-expert | 3004 | Retail & shopping | ✅ Complete | rez-knowledge-graph |
| rez-education-expert | 3006 | Education | ✅ Complete | rez-knowledge-graph |
| rez-culinary-expert | - | Food & restaurants | ✅ Complete | rez-knowledge-graph |
| rez-real-estate-expert | 3013 | Real estate | ✅ Complete | rez-knowledge-graph |
| rez-finance-expert | 3014 | Finance | ✅ Complete | rez-knowledge-graph |
| rez-logistics-expert | 3015 | Logistics | ✅ Complete | rez-knowledge-graph |

---

## MCP Servers

### Model Context Protocol Servers

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-mcp-service-discovery | - | Service discovery | ✅ Complete | - |
| rez-mcp-event-bus | - | Event bus MCP | ✅ Complete | rez-event-bus |
| rez-mcp-analytics | - | Analytics MCP | ✅ Complete | rez-signal-aggregator |
| rez-mcp-identity | - | Identity MCP | ✅ Complete | rez-identity-graph |
| rez-mcp-payment | - | Payment MCP | ✅ Complete | rez-payments-brain |
| rez-mcp-order | - | Order MCP | ✅ Complete | rez-commerce-signal-connector |
| rez-mcp-notification | - | Notification MCP | ✅ Complete | rez-notification-router |
| rez-mcp-inventory | - | Inventory MCP | ✅ Complete | - |
| rez-mcp-logs | - | Logging MCP | ✅ Complete | - |
| rez-mcp-agent-invoke | - | Agent invocation | ✅ Complete | rez-agent-registry |
| rez-mcp-automl | - | AutoML MCP | ✅ Complete | rez-automl-pipeline |
| rez-mcp-contracts | - | Contracts MCP | ✅ Complete | - |
| rez-mcp-cosmic-twin | - | Cosmic twin MCP | ✅ Complete | - |
| rez-mcp-invoice | - | Invoice MCP | ✅ Complete | - |
| rez-mcp-legal | - | Legal MCP | ✅ Complete | - |
| rez-mcp-ranking | - | Ranking MCP | ✅ Complete | - |

---

## Infrastructure & Platform

### Event & Message Bus

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-event-bus | 4082 | Redis + Kafka events | ✅ Complete | - |
| rez-event-platform | - | Event processing | ✅ Complete | rez-event-bus |
| rez-event-connector | 4158 | Event connectors | ✅ Complete | rez-event-bus |
| rez-unified-event-schema | - | Standard schemas | ✅ Complete | - |

### Workflow & Automation

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-flow-runtime | 4200 | Workflow execution | ✅ Complete | rez-event-bus |
| rez-workflow-builder | 4199 | Visual workflow builder | ✅ Complete | rez-flow-runtime |
| rez-visual-workflow-builder-ui | - | Workflow UI | ✅ Complete | rez-workflow-builder |
| rez-action-engine | 4009 | Decision execution | ✅ Complete | rez-event-bus |
| rez-action-orchestrator | 4146 | Autonomous actions | ✅ Complete | rez-action-engine |

### Memory & State

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-memory-layer | 4201 | Customer timeline | ✅ Complete | rez-event-bus |
| rez-memory-engine | 4051 | Memory storage | ✅ Complete | - |
| rez-company-memory | 4801 | Business memory | ✅ Complete | - |
| rez-live-action-feed | 4802 | Audit trail | ✅ Complete | - |

### API & Gateway

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-api-gateway | 4000 | Central routing | ✅ Complete | - |
| rez-api-keys | - | API key management | ✅ Complete | - |
| rez-enterprise-gateway | 4102 | Enterprise SSO | ✅ Complete | - |

### Feature Flags & Config

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-feature-flags | 4030 | Feature toggles | ✅ Complete | - |
| rez-feature-store | 4127 | ML features | ✅ Complete | - |

---

## Analytics & Insights

### Signal & Analytics

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-signal-aggregator | 4121 | Signal collection | ✅ Complete | rez-event-bus |
| rez-insights-service | 4017 | Business insights | ✅ Complete | - |
| rez-ab-testing | 4132 | A/B testing | ✅ Complete | - |
| rez-ab-testing-service | - | Feature flags | ✅ Complete | rez-ab-testing |
| rez-experimentation-engine | - | Experiment platform | ✅ Complete | rez-ab-testing |
| rez-analytics-orchestrator | - | Analytics coordination | ✅ Complete | - |

### Business Intelligence

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-merchant-intelligence | 4122 | Merchant analytics | ✅ Complete | - |
| rez-merchant-360 | - | Merchant view | ✅ Complete | rez-merchant-intelligence |
| rez-merchant-brain | - | Merchant AI | ✅ Complete | rez-merchant-intelligence |
| rez-merchant-os | - | Merchant dashboard | ✅ Complete | - |
| rez-what-if-analytics | - | Scenario modeling | ✅ Complete | - |
| rez-realtime-service | - | Real-time updates | ✅ Complete | - |
| rez-realtime-gateway | - | WebSocket gateway | ✅ Complete | - |

---

## Operations & Support

### Customer Support

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-care-service | 4055 | Support OS | ✅ Complete | rez-knowledge-base-service |
| rez-support-copilot | 4033 | AI support | ✅ Complete | rez-care-service |
| rez-error-intelligence | - | Error tracking | ✅ Complete | - |
| rez-incident-response | - | Incident management | ✅ Complete | - |

### Observability

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-observability | - | Metrics & logs | ✅ Complete | - |
| rez-observability-system | 4109 | APM platform | ✅ Complete | - |
| rez-health-monitor | - | Health checks | ✅ Complete | - |
| rez-monitoring | - | Monitoring dashboard | ✅ Complete | - |
| rez-audit-logging | 4133 | Audit trail | ✅ Complete | - |
| rez-validation-dashboard | - | Data validation | ✅ Complete | - |

### Inventory & Operations

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-inventory-intelligence | 4081 | Inventory optimization | ✅ Complete | - |
| rez-inventory-alerts-service | 4064 | Stock alerts | ✅ Complete | - |
| rez-inventory-sync | - | Multi-channel sync | ✅ Complete | - |
| rez-unified-inventory | - | Universal inventory | ✅ Complete | - |
| rez-delivery-intelligence | - | Delivery optimization | ✅ Complete | - |
| rez-delivery-tracking-service | - | Live tracking | ✅ Complete | - |
| rez-offline-commerce-tracker | - | Offline sync | ✅ Complete | - |
| rez-multi-location-service | - | Multi-location support | ✅ Complete | - |

### Scheduling & Workforce

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-staff-scheduling-service | - | Staff scheduling | ✅ Complete | - |
| rez-staff-scheduling | - | Scheduling engine | ✅ Complete | - |
| rez-fleet-management | - | Fleet operations | ✅ Complete | - |

---

## Integrations & Bridges

### External Integrations

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-app-bridge | - | App integration | ✅ Complete | - |
| rez-service-connectors | - | Service connectors | ✅ Complete | - |
| rez-integration-sdk | - | Integration SDK | ✅ Complete | - |
| rez-ecosystem-hub | - | Cross-company hub | ✅ Complete | - |
| rez-corpperks-bridge | - | CorpPerks integration | ✅ Complete | - |
| rez-identity-bridge | - | Identity bridge | ✅ Complete | rez-identity-graph |

### DOOH & Advertising

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-dooh-intelligence | 4080 | DOOH targeting | ✅ Complete | - |
| rez-dooh-attribution | 4081 | DOOH attribution | ✅ Complete | - |
| rez-qr-campaigns | - | QR campaigns | ✅ Complete | - |
| rez-campaign-optimizer | - | Campaign optimization | ✅ Complete | - |

### Social & Content

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-social-signals | - | Social engagement | ✅ Complete | - |
| rez-ugc-engine | - | User-generated content | ✅ Complete | - |
| rez-creator-network | - | Creator management | ✅ Complete | - |
| rez-content-moderation | - | Content moderation | ✅ Complete | - |
| rez-sentiment-analysis | - | Sentiment analysis | ✅ Complete | - |

### Travel & Reservations

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-travel-intelligence | - | Travel insights | ✅ Complete | - |
| rez-reservation-service | - | Booking system | ✅ Complete | - |
| rez-waitlist-service | - | Waitlist management | ✅ Complete | - |

---

## SDKs & Client Libraries

| Service | Port | Purpose | Status | Dependencies |
|---------|------|---------|--------|--------------|
| rez-unified-agent-sdk | - | Agent SDK | ✅ Complete | - |
| rez-intelligence-sdk | 4151 | TypeScript SDK | ✅ Complete | - |
| rez-expert-base | - | Expert framework | ✅ Complete | - |
| rez-ai-platform | - | AI platform | ✅ Complete | - |
| rez-ai-plugins | - | Plugin system | ✅ Complete | - |
| rez-web-widget | - | Embeddable widget | ✅ Complete | - |
| rez-python-sdk | - | Python SDK | ✅ Complete | - |
| rez-java-sdk | - | Java SDK | ✅ Complete | - |
| rez-go-sdk | - | Go SDK | ✅ Complete | - |
| rez-ruby-sdk | - | Ruby SDK | ✅ Complete | - |

---

## Shared Packages

| Service | Purpose | Status |
|---------|---------|--------|
| rez-shared | Common utilities | ✅ Complete |
| rez-shared-config | Configuration | ✅ Complete |
| rez-shared-types | Type definitions | ✅ Complete |

---

## Legacy/Alias Services (Deprecating)

These services use the old `REZ-` prefix and will be removed. Use the `rez-` equivalent instead.

| Deprecated | Use Instead | Status |
|------------|-------------|--------|
| REZ-event-bus | rez-event-bus | Migrate |
| REZ-identity-graph | rez-identity-graph | Migrate |
| REZ-memory-layer | rez-memory-layer | Migrate |
| REZ-workflow-builder | rez-workflow-builder | Migrate |

---

## Port Registry

| Port | Service |
|------|---------|
| 3000 | rez-hospitality-expert |
| 3003 | rez-travel-expert |
| 3004 | rez-retail-expert |
| 3005 | rez-salon-expert, rez-ml-feature-store |
| 3006 | rez-education-expert |
| 3010 | rez-fitness-expert |
| 3011 | rez-health-expert |
| 3013 | rez-real-estate-expert |
| 3014 | rez-finance-expert |
| 3015 | rez-logistics-expert |
| 4000 | rez-api-gateway |
| 4005 | rez-knowledge-base-service |
| 4017 | rez-recommendation-engine, rez-insights-service |
| 4018 | rez-intent-predictor |
| 4026 | rez-ai-router |
| 4030 | rez-feature-flags |
| 4033 | rez-support-copilot |
| 4050 | rez-identity-graph |
| 4051 | rez-memory-engine |
| 4052 | rez-ai-router |
| 4055 | rez-care-service |
| 4062 | rez-autonomous-agents |
| 4063 | REZ-supplier-marketplace |
| 4064 | rez-inventory-alerts-service |
| 4065 | rez-bootstrap-intelligence |
| 4080 | rez-dooh-intelligence |
| 4081 | rez-inventory-intelligence |
| 4082 | rez-event-bus |
| 4098 | rez-karma-loyalty-bridge |
| 4101 | rez-ai-orchestrator |
| 4102 | rez-enterprise-gateway |
| 4107 | REZ-creative-engine |
| 4109 | rez-observability-system, rez-action-engine |
| 4110 | REZ-flywheel-engine |
| 4111 | rez-moment-ads |
| 4120 | rez-unified-profile |
| 4121 | rez-signal-aggregator |
| 4122 | rez-merchant-intelligence |
| 4123 | rez-predictive-engine |
| 4126 | rez-realtime-segments |
| 4127 | rez-feature-store |
| 4130 | rez-ml-observability |
| 4132 | rez-stream-processing, rez-ab-testing |
| 4133 | rez-audit-logging |
| 4140 | rez-geo-intelligence, rez-rcs-bridge |
| 4144 | REZ-temporal-intelligence |
| 4145 | REZ-explainability-engine, rez-synthetic-data |
| 4146 | REZ-action-orchestrator |
| 4147 | REZ-reinforcement-optimizer |
| 4148 | REZ-hyperlocal-brain |
| 4149 | REZ-business-orchestrator |
| 4150 | rez-commerce-signal-connector |
| 4151 | REZ-intelligence-sdk |
| 4155 | rez-attribution-loyalty-bridge |
| 4156 | rez-reorder-engine |
| 4158 | rez-event-connector |
| 4165 | rez-federated-ml |
| 4170 | rez-orchestrator-v2, rez-unified-commerce-graph |
| 4175 | RezOps-AI |
| 4200 | rez-flow-runtime |
| 4201 | rez-memory-layer |
| 4202 | rez-whatsapp |
| 4715 | reaz-threat-graph |
| 4800 | rez-autonomous-loop |
| 4801 | rez-company-memory |
| 4802 | rez-live-action-feed |
| 8081 | rez-push-service |
| 8083 | rez-unified-messaging |

---

**Last Updated:** June 4, 2026
**Version:** 1.0
