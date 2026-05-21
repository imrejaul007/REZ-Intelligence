# REZ-Intelligence Port Registry

## Generated: 2026-05-19
## Last Updated: May 21, 2026 - REZ Memory Layer added (4201)

This document contains all service ports and database configurations for the REZ-Intelligence platform.

---

## Port Allocation Table

### UPDATED PORTS (May 19, 2026)

| Service | New Port | Previous Port | Status |
|---------|----------|---------------|--------|
| REZ-audit-logging | **4106** | 3000 | FIXED |
| REZ-creative-engine | **4107** | 3000 | FIXED |
| REZ-experimentation-engine | **4108** | 3000 | FIXED |
| REZ-observability-system | **4109** | 3000 | FIXED |
| REZ-real-time-decision-engine | **4111** | 3000 | FIXED |
| rez-ai-voice | **4112** | 3000 | FIXED |
| rez-expert-base | **4113** | 3000 | FIXED |
| REZ-predictive-engine | **4141** | 4059 | FIXED |
| REZ-signal-aggregator | **4142** | 4059 | FIXED |
| rez-competitor-detection | **4143** | 4059 | FIXED |
| REZ-delivery-tracking-service | **4144** | 4060 | FIXED |
| REZ-knowledge-graph | **4145** | 4060 | FIXED |
| rez-social-signals | **4146** | 4060 | FIXED |
| REZ-cross-company-loyalty | **4151** | 4100 | FIXED |
| REZ-unified-chat | **4152** | 4100 | FIXED |
| REZ-validation-dashboard | **4153** | 4100 | FIXED |
| REZ-consumer-loop | **4154** | 3005 | FIXED |
| REZ-attribution-loyalty-bridge | **4155** | 4040 | FIXED |
| REZ-reorder-engine | **4156** | 4040 | FIXED |
| REZ-taste-profile | **4157** | 4041 | FIXED |
| REZ-event-connector | **4158** | 4052 | FIXED |
| REZ-email-bridge | **4160** | 4086 | FIXED |

---

## Complete Port Table

| Service | Port | Used By | Database |
|---------|------|---------|----------|
| **Agent Orchestrator** | | | |
| REZ-autonomous-agents | 4062 | Agent system, Task orchestration | MongoDB |
| rez-agent-registry | - | Agent registration (no HTTP server) | None |
| rez-mcp-agent-invoke | - | MCP tool invocation | None |
| **AI & ML Services** | | | |
| rez-intent-predictor | 4018 | Intent prediction, ML inference | MongoDB |
| rez-ml-model-registry | 3001 | ML model versioning, deployment | MongoDB |
| rez-ml-engine | - | ML model serving (in-process) | MongoDB |
| rez-ml-feature-store | 3005 | Feature store (shared memory) | MongoDB |
| **AI Router & Expert Services** | | | |
| REZ-ai-router | 4052 | AI model routing, load balancing | MongoDB (optional) |
| rez-expert-base | **4113** | Base expert interface | None |
| rez-fitness-expert | env | Fitness advice, workout plans | MongoDB |
| rez-salon-expert | 3005 | Salon service recommendations | MongoDB |
| rez-travel-expert | 3003 | Travel planning, booking | MongoDB |
| rez-education-expert | 3006 | Educational content delivery | MongoDB |
| rez-health-expert | env | Health recommendations | MongoDB |
| rez-hospitality-expert | - | Hospitality industry AI | MongoDB |
| rez-culinary-expert | 3001 | Recipe, culinary AI | MongoDB |
| rez-retail-expert | env | Retail industry insights | MongoDB |
| **Analytics & Intelligence** | | | |
| REZ-analytics-orchestrator | 4052 | Analytics coordination | MongoDB |
| REZ-customer-intelligence-hub | - | Customer data analysis | MongoDB |
| REZ-insights-service | 3011 | Business insights generation | MongoDB |
| REZ-conversation-intelligence | - | Chat analytics | MongoDB |
| rez-confidence-scorer | - | Confidence scoring | MongoDB/Redis |
| **Attribution & Marketing** | | | |
| REZ-ab-testing | 4110 | A/B testing experiments | MongoDB |
| REZ-ab-testing-service | 4002 | A/B test management | MongoDB |
| REZ-attribution-system | - | Conversion attribution | MongoDB |
| REZ-unified-attribution | 4090 | Multi-channel attribution | MongoDB |
| rez-crosschannel-attribution | 4115 | Cross-channel tracking | MongoDB |
| REZ-creative-engine | **4107** | Ad creative generation | MongoDB |
| REZ-recommendation-engine | 4017 | Product/content recommendations | MongoDB |
| **Commerce & Sales** | | | |
| REZ-commerce-agents | 4063 | E-commerce automation | MongoDB |
| REZ-commerce-signal-connector | 4150 | Commerce event signals | MongoDB |
| rez-sales-agent | 3001 | Sales automation | MongoDB |
| rez-fraud-agent | 3007 | Fraud detection | MongoDB |
| REZ-merchant-360 | - | Merchant unified view | MongoDB |
| REZ-merchant-intelligence | 4014 | Merchant analytics | MongoDB |
| REZ-research-opportunity-agent | - | Opportunity identification | MongoDB |
| **Consumer Services** | | | |
| REZ-consumer-loop | **4154** | Consumer engagement | MongoDB |
| REZ-consumer-graph | - | Consumer relationship graph | MongoDB |
| **Identity & Data** | | | |
| REZ-identity-graph | 4050 | Identity resolution | MongoDB |
| REZ-identity-bridge | 4092 | Identity bridging | MongoDB |
| REZ-unified-identity | - | Unified identity management | MongoDB |
| REZ-universal-user-graph | 4055 | Cross-platform user graph | MongoDB |
| rez-mcp-identity | - | MCP identity protocol | None |
| **Inventory & Supply Chain** | | | |
| REZ-inventory-sync | 4071 | Real-time inventory sync | MongoDB |
| REZ-inventory-intelligence | - | Inventory forecasting | MongoDB |
| REZ-inventory-alerts-service | 4064 | Inventory notifications | MongoDB |
| REZ-supplier-marketplace | 4063 | Supplier management | MongoDB |
| **Payment & Finance** | | | |
| REZ-payments-brain | 4070 | Payment processing | MongoDB |
| REZ-gift-card-service | 4061 | Gift card management | MongoDB |
| REZ-ledger-service | 3003 | Financial ledger | MongoDB |
| REZ-reconciliation-service | 10000 | Transaction reconciliation | PostgreSQL |
| **Location & Targeting** | | | |
| REZ-targeting-engine | 3013 | Ad targeting | MongoDB |
| rez-location-intelligence | 4040 | Location-based analytics | MongoDB |
| REZ-hyperlocal-targeting | 4059 | Hyperlocal ad targeting | MongoDB |
| **Real-time & Streaming** | | | |
| REZ-event-platform | 4008 | Event ingestion/processing | MongoDB |
| REZ-event-connector | **4158** | Event connectivity | MongoDB |
| REZ-event-bus | - | Event messaging | None |
| REZ-stream-processing | 4067 | Stream data processing | MongoDB |
| REZ-realtime-segments | - | Real-time segmentation | MongoDB/Redis |
| REZ-realtime-gateway | 4094 | Real-time API gateway | MongoDB |
| REZ-real-time-decision-engine | **4111** | Real-time decisions | MongoDB |
| **Personalization** | | | |
| REZ-personalization-engine | 4070 | User personalization | MongoDB |
| REZ-rfm-service | - | RFM segmentation | MongoDB |
| REZ-rfm-plus-service | 4055 | Enhanced RFM analysis | MongoDB |
| REZ-taste-profile | **4157** | User taste profiling | MongoDB |
| **Loyalty & Rewards** | | | |
| REZ-attribution-loyalty-bridge | **4155** | Attribution-loyalty bridge | MongoDB |
| REZ-cdp-service | 3005 | Customer Data Platform | MongoDB |
| **Data Platform** | | | |
| REZ-data-platform | - | Data ingestion pipeline | MongoDB |
| REZ-data-warehouse | 4105 | Data warehousing | MongoDB |
| REZ-data-governance | - | Data quality management | MongoDB |
| REZ-lakehouse | - | Data lake architecture | MongoDB |
| **Communication Bridges** | | | |
| rez-email-bridge | **4160** | Email integration | MongoDB |
| rez-sms-bridge | - | SMS integration | MongoDB |
| rez-whatsapp-orchestrator-bridge | 4010 | WhatsApp integration | MongoDB |
| rez-rcs-bridge | - | RCS messaging | MongoDB |
| **DOOH (Digital Out-of-Home)** | | | |
| REZ-dooh-intelligence | 4080 | DOOH analytics | MongoDB |
| REZ-dooh-attribution | 4081 | DOOH attribution | MongoDB |
| **Support & Operations** | | | |
| REZ-support-copilot | 4033 | AI support assistant | MongoDB |
| rez-support-agent | 3002 | Support automation | MongoDB |
| REZ-care-service | 4058 | Customer support | MongoDB |
| **Monitoring & Observability** | | | |
| REZ-audit-logging | **4106** | Audit trail | MongoDB |
| REZ-observability-system | **4109** | System monitoring | MongoDB |
| REZ-health-monitor | - | Service health checks | None |
| REZ-observability | - | Observability stack | MongoDB |
| **Error Intelligence** | | | |
| REZ-error-intelligence | 4005 | Error tracking/analysis | MongoDB |
| **Feature Management** | | | |
| REZ-feature-flags | 4030 | Feature flags | MongoDB |
| **CRM & Customer** | | | |
| REZ-unified-crm-hub | 4100 | Unified CRM hub | MongoDB |
| REZ-unified-chat | **4152** | Chat platform | MongoDB |
| REZ-validation-dashboard | **4153** | Data validation UI | MongoDB |
| **Merchant Services** | | | |
| REZ-merchant-os | 4073 | Merchant operating system | MongoDB |
| REZ-merchant-brain | 4061 | Merchant AI assistant | MongoDB |
| REZ-core-brain | - | Core AI reasoning | MongoDB |
| **API Management** | | | |
| REZ-api-keys | 4096 | API key management | MongoDB |
| REZ-enterprise-gateway | 4102 | Enterprise gateway | MongoDB |
| **Flywheel & Growth** | | | |
| REZ-flywheel-mvp | 4101 | Growth flywheel system | MongoDB |
| REZ-ai-orchestrator | 4101 | AI orchestration | MongoDB |
| **Loyalty Across Companies** | | | |
| REZ-cross-company-loyalty | **4151** | Cross-company loyalty | MongoDB |
| REZ-karma-loyalty-bridge | 4098 | Karma loyalty bridge | MongoDB |
| **QR & Campaigns** | | | |
| REZ-qr-campaigns | 4130 | QR code campaigns | MongoDB |
| **Creator Economy** | | | |
| REZ-creator-network | 4072 | Creator platform | MongoDB |
| **UGC Engine** | | | |
| REZ-ugc-engine | - | User-generated content | MongoDB |
| **Notifications** | | | |
| REZ-notification-router | 4093 | Notification routing | MongoDB |
| **Staff Management** | | | |
| REZ-staff-scheduling-service | 4067 | Staff scheduling | MongoDB |
| **Reservations** | | | |
| REZ-reservation-service | 4065 | Booking management | MongoDB |
| **Multi-location** | | | |
| REZ-multi-location-service | 4062 | Multi-location support | MongoDB |
| **Knowledge Graph** | | | |
| REZ-knowledge-graph | **4145** | Knowledge management | MongoDB |
| **Social Signals** | | | |
| rez-social-signals | **4146** | Social media signals | MongoDB |
| **Delivery** | | | |
| REZ-delivery-tracking-service | **4144** | Delivery tracking | MongoDB |
| REZ-delivery-intelligence | - | Delivery optimization | MongoDB |
| rez-fleet-management | 4016 | Fleet operations | MongoDB |
| rez-eta-prediction | 4086 | ETA calculations | MongoDB |
| **Demand & Pricing** | | | |
| REZ-demand-forecast | 4042 | Demand prediction | MongoDB |
| REZ-price-predictor | 4043 | Price optimization | MongoDB |
| **Inventory** | | | |
| REZ-reorder-engine | **4156** | Reorder automation | MongoDB |
| **Loyalty** | | | |
| REZ-ltv-attribution | 4090 | LTV by channel/campaign | In-memory |
| **Feedback** | | | |
| REZ-feedback-collector | 4085 | Feedback aggregation | MongoDB |
| **Signal Aggregator** | | | |
| REZ-signal-aggregator | **4142** | Signal aggregation | MongoDB |
| **Predictive Engine** | | | |
| REZ-predictive-engine | **4141** | Predictive analytics | MongoDB |
| **Spend Predictor** | | | |
| REZ-spend-predictor | **4147** | Predicts likely bill amount | MongoDB |
| **Unified Services** | | | |
| REZ-unified-profile | 4060 | Unified user profiles | MongoDB |
| REZ-unified-recommendations | 4090 | Cross-platform recommendations | MongoDB |
| **Context Engine** | | | |
| REZ-context-engine | 4071 | Context management | MongoDB |
| **Voice AI** | | | |
| rez-ai-voice | **4112** | Voice AI | MongoDB |
| **Web Widget** | | | |
| rez-web-widget | 4088 | Web widget embedding | None |
| **App Bridge** | | | |
| rez-app-bridge | 4089 | App bridging | MongoDB |
| **Competitor Detection** | | | |
| rez-competitor-detection | **4143** | Competitor monitoring | MongoDB |
| **Behavioral Psychology** | | | |
| rez-behavioral-psychology | 4110 | Psychology modeling | MongoDB |
| **Unified Engine** | | | |
| rez-unified-engine | - | Unified engine | MongoDB |
| **Channel Orchestrator** | | | |
| rez-channel-orchestrator | 4070 | Channel orchestration | MongoDB |
| **Ecosystem Hub** | | | |
| REZ-ecosystem-hub | 4105 | Ecosystem hub | MongoDB |
| **Commerce Intelligence Network** | | | |
| REZ-unified-commerce-graph | **4170** | Single graph: Customer+Merchant+Location+Transaction | MongoDB |
| REZ-unified-ad-decision | **4180** | Central ad decision brain | MongoDB |
| **Cohort Service** | | | |
| rez-cohort-service | 4070 | Cohort analysis | MongoDB |
| **User Agents** | | | |
| REZ-user-agents | 4055 | User agent management | MongoDB |
| **Intelligence Hub** | | | |
| rez-intelligence-hub | 4020 | Intelligence aggregation | MongoDB |
| **ML Services** | | | |
| rez-ml-models | - | ML models library | MongoDB |
| **Orchestrator V2** | | | |
| rez-orchestrator-v2 | - | Orchestrator v2 | MongoDB |
| **Consultant Agent** | | | |
| rez-consultant-agent | 3003 | Consulting | MongoDB |
| **Info Agent** | | | |
| rez-info-agent | 3004 | Information retrieval | MongoDB |
| **Fraud Agent** | | | |
| rez-fraud-agent | 3007 | Fraud detection | MongoDB |
| **Fraud Detection Service** | | | |
| rez-fraud-detection-service | 3007 | Fraud detection service | MongoDB |
| **Experimentation Engine** | | | |
| REZ-experimentation-engine | **4108** | Experimentation engine | MongoDB |
| **Memory Engine** | | | |
| REZ-memory-engine | 4051 | Agent memory storage | MongoDB/Redis |
| **Intelligence** | | | |
| REZ-intelligence-hub | 4020 | Intelligence hub | MongoDB |
| **ML Feature Store** | | | |
| rez-ml-feature-store | 3005 | ML feature store | MongoDB |
| **Customer Intelligence** | | | |
| rez-memory-layer | 4201 | Customer timeline service | MongoDB |

---

## Shared Infrastructure

| Service | Port | Used By |
|---------|------|---------|
| MongoDB | 27017 | All MongoDB services |
| Redis | 6379 | Caching, sessions, real-time |
| AgentDB | 8080 | Vector storage, memory |

---

## Port Ranges

| Range | Purpose |
|-------|---------|
| 3000-3013 | Expert services, domain-specific |
| 4000-4100 | Core platform services |
| 4100-4200 | Intelligence services |
| 10000+ | Special services (PostgreSQL) |

---

## Notes

1. Services marked with `-` in the Port column either:
   - Do not expose HTTP servers
   - Are libraries/SDKs
   - Use environment variable for port configuration

2. Services marked with "env" use PORT from environment variable.

3. Port conflicts have been resolved as of May 19, 2026.

4. All services support `PORT` environment variable override.

---

## Security Reminders

- NEVER commit .env files with credentials
- Use `.env.example` as template only
- All services should have `.gitignore` with `.env`
- Use RABTUL services for auth, payments, wallet when available
