# REZ-Intelligence Port Registry

## Generated: 2026-05-16

This document contains all service ports and database configurations for the REZ-Intelligence platform.

---

## Port Allocation Table

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
| rez-ml-feature-store | - | Feature store (shared memory) | MongoDB |
| **AI Router & Expert Services** | | | |
| REZ-ai-router | 4052 | AI model routing, load balancing | MongoDB (optional) |
| rez-expert-base | 3000 | Base expert interface | None |
| rez-fitness-expert | 3010 | Fitness advice, workout plans | MongoDB |
| rez-salon-expert | 3005 | Salon service recommendations | MongoDB |
| rez-travel-expert | 3003 | Travel planning, booking | MongoDB |
| rez-education-expert | 3006 | Educational content delivery | MongoDB |
| rez-health-expert | 3011 | Health recommendations | MongoDB |
| rez-hospitality-expert | 3000 | Hospitality industry AI | MongoDB |
| rez-culinary-expert | 3001 | Recipe, culinary AI | MongoDB |
| rez-retail-expert | 3004 | Retail industry insights | MongoDB |
| **Analytics & Intelligence** | | | |
| REZ-analytics-orchestrator | - | Analytics coordination | MongoDB |
| REZ-customer-intelligence-hub | - | Customer data analysis | MongoDB |
| REZ-insights-service | 3011 | Business insights generation | MongoDB |
| REZ-conversation-intelligence | - | Chat analytics | MongoDB |
| rez-confidence-scorer | - | Confidence scoring | MongoDB/Redis |
| **Attribution & Marketing** | | | |
| REZ-ab-testing | 4110 | A/B testing experiments | MongoDB |
| REZ-ab-testing-service | 4002 | A/B test management | MongoDB |
| REZ-attribution-system | - | Conversion attribution | MongoDB |
| REZ-unified-attribution | 4090 | Multi-channel attribution | MongoDB |
| rez-crosschannel-attribution | - | Cross-channel tracking | MongoDB |
| REZ-creative-engine | 3000 | Ad creative generation | MongoDB |
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
| REZ-consumer-loop | 3005 | Consumer engagement | MongoDB |
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
| REZ-event-connector | - | Event connectivity | MongoDB |
| REZ-event-bus | - | Event messaging | None |
| REZ-stream-processing | - | Stream data processing | MongoDB |
| REZ-realtime-segments | - | Real-time segmentation | MongoDB/Redis |
| REZ-realtime-gateway | 4094 | Real-time API gateway | MongoDB |
| REZ-real-time-decision-engine | 3000 | Real-time decisions | MongoDB |
| **Personalization** | | | |
| REZ-personalization-engine | 4017 | User personalization | MongoDB |
| REZ-rfm-service | - | RFM segmentation | MongoDB |
| REZ-rfm-plus-service | 4055 | Enhanced RFM analysis | MongoDB |
| REZ-taste-profile | 4041 | User taste profiling | MongoDB |
| **Loyalty & Rewards** | | | |
| REZ-attribution-loyalty-bridge | - | Attribution-loyalty bridge | MongoDB |
| REZ-cdp-service | 3005 | Customer Data Platform | MongoDB |
| **Data Platform** | | | |
| REZ-data-platform | - | Data ingestion pipeline | MongoDB |
| REZ-data-warehouse | 4105 | Data warehousing | MongoDB |
| REZ-data-governance | - | Data quality management | MongoDB |
| REZ-lakehouse | - | Data lake architecture | MongoDB |
| **Communication Bridges** | | | |
| rez-email-bridge | 4086 | Email integration | MongoDB |
| rez-sms-bridge | - | SMS integration | MongoDB |
| rez-whatsapp-orchestrator-bridge | - | WhatsApp integration | MongoDB |
| rez-rcs-bridge | - | RCS messaging | MongoDB |
| **DOOH (Digital Out-of-Home)** | | | |
| REZ-dooh-intelligence | 4080 | DOOH analytics | MongoDB |
| REZ-dooh-attribution | 4081 | DOOH attribution | MongoDB |
| **Delivery & Logistics** | | | |
| REZ-delivery-tracking-service | 4060 | Delivery tracking | MongoDB |
| REZ-delivery-intelligence | - | Delivery optimization | MongoDB |
| rez-fleet-management | 4016 | Fleet operations | MongoDB |
| rez-eta-prediction | - | ETA calculations | MongoDB |
| **Knowledge & Memory** | | | |
| REZ-memory-engine | 4051 | Agent memory storage | MongoDB/Redis |
| REZ-knowledge-graph | 4060 | Knowledge management | MongoDB |
| **Signal Processing** | | | |
| REZ-signal-aggregator | - | Signal aggregation | MongoDB |
| rez-social-signals | 4060 | Social media signals | MongoDB |
| **QR & Campaigns** | | | |
| REZ-qr-campaigns | - | QR code campaigns | MongoDB |
| REZ-flywheel-mvp | - | Growth flywheel system | MongoDB |
| **Other Services** | | | |
| REZ-support-copilot | 4033 | AI support assistant | MongoDB |
| REZ-support-agent | 3002 | Support automation | MongoDB |
| REZ-merchant-os | 4073 | Merchant operating system | MongoDB |
| REZ-merchant-brain | 4061 | Merchant AI assistant | MongoDB |
| REZ-core-brain | 4072 | Core AI reasoning | MongoDB |
| REZ-api-keys | 4096 | API key management | MongoDB |
| REZ-audit-logging | 3000 | Audit trail | MongoDB |
| REZ-feature-flags | 4030 | Feature flags | MongoDB |
| REZ-health-monitor | - | Service health checks | None |
| REZ-observability | - | Observability stack | MongoDB |
| REZ-observability-system | 3000 | System monitoring | MongoDB |
| REZ-validation-dashboard | 4100 | Data validation UI | MongoDB |
| REZ-waitlist-service | 4066 | Waitlist management | MongoDB |
| REZ-reservation-service | 4065 | Booking management | MongoDB |
| REZ-multi-location-service | 4062 | Multi-location support | MongoDB |
| REZ-creator-network | 4072 | Creator platform | MongoDB |
| REZ-user-agents | 4030 | User agent management | MongoDB |
| REZ-error-intelligence | 4005 | Error tracking/analysis | MongoDB |
| REZ-competitor-detection | 4059 | Competitor monitoring | MongoDB |
| REZ-priority-engine | - | Priority optimization | MongoDB/Redis |
| REZ-notification-router | 4093 | Notification routing | MongoDB |
| REZ-staff-scheduling-service | 4067 | Staff scheduling | MongoDB |
| REZ-intelligence-hub | 4020 | Intelligence aggregation | MongoDB |
| REZ-unified-chat | - | Chat platform | MongoDB |
| REZ-unified-profile | 4060 | Unified user profiles | MongoDB |
| REZ-unified-recommendations | 4090 | Cross-platform recommendations | MongoDB |
| REZ-unified-inventory | - | Inventory unification | MongoDB |
| REZ-unified-event-schema | - | Event schema registry | MongoDB |
| REZ-behavioral-psychology | - | Psychology modeling | MongoDB |
| REZ-demand-forecast | 4042 | Demand prediction | MongoDB |
| REZ-price-predictor | 4043 | Price optimization | MongoDB |
| REZ-reorder-engine | 4040 | Reorder automation | MongoDB |
| REZ-action-engine | 4009 | Action execution | MongoDB |
| REZ-ai-plugins | - | Plugin system | MongoDB |
| REZ-ai-voice | - | Voice AI | MongoDB |
| REZ-ai-webhook | - | Webhook processing | MongoDB |
| REZ-context-engine | 4071 | Context management | MongoDB |
| REZ-feedback-collector | 4085 | Feedback aggregation | MongoDB |
| rez-service-connectors | - | Service connectivity | MongoDB |
| rez-web-widget | - | Web widget embedding | None |
| rez-aggregator-hub | - | Data aggregation hub | MongoDB |
| rez-intent-graph | 3007 | Intent graph storage | MongoDB |
| REZ-permission-system | - | Access control | MongoDB |
| **MCP Services** | | | |
| rez-mcp-analytics | - | Analytics MCP protocol | None |
| rez-mcp-event-bus | - | Event bus MCP protocol | None |
| rez-mcp-identity | - | Identity MCP protocol | None |
| rez-mcp-inventory | - | Inventory MCP protocol | None |
| rez-mcp-logs | - | Logging MCP protocol | None |
| rez-mcp-notification | - | Notification MCP protocol | None |
| rez-mcp-order | - | Order MCP protocol | None |
| rez-mcp-payment | - | Payment MCP protocol | None |
| rez-mcp-service-discovery | - | Service discovery | None |
| **SDKs** | | | |
| rez-unified-agent-sdk | - | Agent SDK (library) | None |
| REZ-integration-sdk | - | Integration SDK | None |
| rez-shared-types | - | Shared type definitions | None |

---

## Shared Infrastructure

| Service | Port | Used By |
|---------|------|---------|
| MongoDB | 27017 | All MongoDB services |
| Redis | 6379 | Caching, sessions, real-time |
| AgentDB | 8080 | Vector storage, memory |

---

## Phase-Based Port Allocation

Based on `.env.example`:

| Phase | Port Range | Services |
|-------|-----------|----------|
| Phase 1 | 4040-4043 | Reorder, Taste, Demand, Price |
| Phase 2 | 4050-4052 | Identity, Memory, AI Router |
| Phase 3 | 4060-4062 | Knowledge, Merchant Brain, Agents |
| Phase 4 | 4070-4073 | Payments, Inventory Sync, Creator, Merchant OS |

---

## Service Dependencies

### MongoDB Clusters
- **rez_intelligence** - Main cluster for general services
- **rez-intent-graph** - Intent prediction cluster
- **rez-feature-flags** - Feature flag cluster
- **Per-service databases** - Individual MongoDB databases

### Redis Usage
- **6379** - Default Redis port
- Used for: Sessions, caching, real-time features, agent memory

### PostgreSQL
- **Reconciliation Service** - Port 10000

---

## Environment Variables

Key environment variables for port configuration:

```bash
PORT=<service-port>              # Main service port
MONGODB_URI=<connection-string>  # MongoDB connection
REDIS_URL=redis://localhost:6379 # Redis connection
REDIS_PORT=6379                  # Redis port
```

---

## Notes

1. Services marked with `-` in the Port column either:
   - Do not expose HTTP servers
   - Are libraries/SDKs
   - Use environment variable for port configuration

2. Services marked with "None" in Database do not use persistent storage.

3. Port conflicts should be resolved by using environment variables in production.

4. All services support `PORT` environment variable override.
