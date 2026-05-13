# REZ-Intelligence - Complete Structure Audit

**Date:** May 13, 2026
**Total Services:** 114

---

# REZ ECOSYSTEM STRUCTURE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ REZ ECOSYSTEM │
├─────────────────────────────────────────────────────────────────────────────┤
│ │
│ REZ AGENT OS ←───────────────────────────────────────────────┐ │
│ (Communication Layer) │ │
│ • User communication via all channels │ │
│ • Sales, Support, Consult │ │
│ • Orchestration & Routing │ │
│ • 8 Domain Experts │ │
│ • 8+ Functional Experts │ │
│ │ │
│ ├──────────────────────────────────────────────────────────┤ │
│ │ │ │
│ │ ▼ ▼ │
│ │ │
│ ┌─────────────────┐ ┌─────────────────┐ │
│ │ REZ MIND │ │ DATA PLATFORM │ │
│ │ (Intelligence) │ │ (Customer Data) │ │
│ │ • ML Models │ │ • CDP │ │
│ │ • Recommendations │ │ • Identity Graph │ │
│ │ • Predictions │ │ • Data Warehouse │ │
│ │ • Analytics │ │ • Attribution │ │
│ │ │ │ │
│ └─────────────────┘ └─────────────────┘ │
│ │ │
│ └──────────────────────────────────────────────────────────┘ │
│ │
│ INFRASTRUCTURE │
│ • Event Bus • API Gateway • Health Monitor • Observability │
│ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# 1. REZ AGENT OS (Communication Layer)

**Purpose:** Communicate with users via all channels. Handle Sales, Support, Consult, Booking, Orders.

## 1.1 Orchestration Core
| Service | Purpose | Port |
|---------|---------|------|
| `rez-orchestrator-v2` | Main orchestrator, routing | 4006 |
| `rez-core-brain` | Memory, session, personalization | 4000 |
| `rez-context-engine` | Entry point detection, routing rules | 4071 |
| `REZ-agent-orchestrator` | OLD orchestrator (deprecated) | - |

## 1.2 Orchestration Helpers
| Service | Purpose | Port |
|---------|---------|------|
| `rez-priority-engine` | Priority resolution | 4080 |
| `rez-confidence-scorer` | Agent confidence scoring | 4081 |
| `rez-permission-system` | Role-based access control | 4084 |
| `rez-agent-registry` | Agent discovery & health | 4073 |
| `rez-tool-registry` | Tool discovery | 4083 |

## 1.3 Channel Bridges
| Service | Purpose | Port |
|---------|---------|------|
| `rez-whatsapp-orchestrator-bridge` | WhatsApp → Orchestrator | 4076 |
| `rez-whatsapp-store` | WhatsApp in-chat checkout | - |
| `rez-whatsapp-commerce` | WhatsApp catalog | - |
| `rez-whatsapp-provisioning` | WhatsApp setup | - |
| `rez-instagram-bridge` | Instagram DMs & Comments | 4090 |
| `rez-instagram-sales-agent` | Instagram commerce AI | 4091 |
| `rez-ai-voice` | Voice/AI calling | 4077 |
| `REZ-unified-chat` | Unified chat interface | - |
| `REZ-notification-router` | Multi-channel notifications | 4093 |
| `REZ-realtime-gateway` | WebSocket gateway | 4094 |
| `rez-sms-bridge` | SMS → Orchestrator | 4085 |
| `rez-email-bridge` | Email → Orchestrator | 4086 |
| `rez-rcs-bridge` | RCS (Jio/Airtel) → Orchestrator | 4087 |
| `rez-web-widget` | Website chat widget → Orchestrator | 4088 |
| `rez-app-bridge` | REZ App → Orchestrator | 4089 |

## 1.4 Domain Expert Agents
| Service | Industry | Port |
|---------|----------|------|
| `rez-hospitality-expert` | Hotels, Stays | 3000 |
| `rez-culinary-expert` | Restaurants, Food | 3001 |
| `rez-travel-expert` | Tourism, Travel | 3003 |
| `rez-fitness-expert` | Gyms, Wellness | 3010 |
| `rez-health-expert` | Healthcare, Clinics | 3011 |
| `rez-retail-expert` | Shopping, E-commerce | 3004 |
| `rez-salon-expert` | Beauty, Spa | 3005 |
| `rez-education-expert` | Courses, Learning | 3006 |

## 1.5 Functional Expert Agents
| Service | Function | Port |
|---------|----------|------|
| `rez-sales-agent` | Sales, conversion | - |
| `rez-support-agent` | Support, complaints | - |
| `rez-consultant-agent` | Consulting | - |
| `rez-info-agent` | Information | - |
| `rez-fraud-agent` | Fraud detection | 3007 |

## 1.6 Support Services
| Service | Purpose |
|---------|---------|
| `REZ-support-copilot` | Support AI |
| `rez-intelligence-hub` | Central intelligence hub |
| `REZ-action-engine` | Decision execution |
| `REZ-error-intelligence` | Error detection |

**REZ AGENT OS TOTAL: ~35 services**

---

# 2. REZ MIND (Intelligence Layer)

**Purpose:** ML, predictions, recommendations, analytics.

## 2.1 ML/AI Models
| Service | Purpose | Port |
|---------|---------|------|
| `REZ-ml-models` | ML inference | 4102 |
| `REZ-ml-production` | ML production | - |
| `REZ-ml-engine` | ML engine | - |
| `REZ-ml-feature-store` | Feature store | - |
| `REZ-ml-model-registry` | Model registry | - |

## 2.2 Recommendations & Predictions
| Service | Purpose | Port |
|---------|---------|------|
| `REZ-recommendation-engine` | Product recommendations | 4015 |
| `REZ-personalization-engine` | User personalization | 4017 |
| `REZ-unified-recommendations` | Unified recs | - |
| `REZ-demand-forecast` | Demand prediction | - |
| `REZ-price-predictor` | Price prediction | - |
| `REZ-reorder-engine` | Reorder predictions | - |
| `REZ-taste-profile` | User taste profiling | - |

## 2.3 Intent & Routing
| Service | Purpose | Port |
|---------|---------|------|
| `REZ-ai-router` | AI model routing | 4052 |
| `rez-intent-predictor` | Intent prediction | - |
| `REZ-real-time-decision-engine` | Real-time decisions | - |
| `REZ-stream-processing` | Stream processing | - |

## 2.4 Analytics & Insights
| Service | Purpose | Port |
|---------|---------|------|
| `REZ-insights-service` | Real-time insights | - |
| `REZ-analytics-orchestrator` | Analytics coordination | - |
| `REZ-attribution-system` | Conversion attribution | - |
| `REZ-feedback-collector` | Feedback collection | 4085 |

## 2.5 Testing & Experimentation
| Service | Purpose | Port |
|---------|---------|------|
| `REZ-ab-testing-service` | A/B testing | 4002 |
| `REZ-experimentation-engine` | Experiments | - |
| `REZ-creative-engine` | AI ad copy | - |

**REZ MIND TOTAL: ~20 services**

---

# 3. REZ AUTONOMOUS AGENTS

**Purpose:** AI agents that work autonomously for commerce and customers.

## 3.1 Commerce Agents
| Service | Purpose | Port |
|---------|---------|------|
| `REZ-autonomous-agents` | 30+ commerce agents | 4062 |
| `REZ-commerce-agents` | Commerce AI | - |
| `REZ-consumer-loop` | Consumer journey | - |

## 3.2 Customer & Merchant Agents
| Service | Purpose | Port |
|---------|---------|------|
| `REZ-user-agents` | User management agents | - |
| `REZ-merchant-brain` | Merchant intelligence | 4061 |
| `REZ-payments-brain` | Payment intelligence | 4070 |
| `rez-consumer-copilot` | Consumer assistance | - |

## 3.3 Knowledge & Memory
| Service | Purpose | Port |
|---------|---------|------|
| `REZ-memory-engine` | Memory storage | - |
| `REZ-knowledge-graph` | Knowledge graph | - |

**REZ AUTONOMOUS AGENTS TOTAL: ~10 services**

---

# 4. DATA PLATFORM

**Purpose:** Customer data, identity, analytics warehouse.

## 4.1 Customer Data
| Service | Purpose | Port |
|---------|---------|------|
| `REZ-cdp-service` | Customer Data Platform | - |
| `REZ-identity-graph` | Cross-app identity | 4050 |
| `REZ-consumer-graph` | Consumer behavior | - |
| `REZ-universal-user-graph` | Universal user graph | - |
| `REZ-identity-bridge` | Identity bridging | 4092 |
| `REZ-merchant-360` | Merchant 360 view | - |
| `rez-customer-360` | Customer 360 view | - |

## 4.2 Data Infrastructure
| Service | Purpose | Port |
|---------|---------|------|
| `REZ-data-platform` | Data lake/warehouse | - |
| `REZ-data-warehouse` | Analytics warehouse | - |
| `REZ-data-governance` | Data governance | - |
| `REZ-stream-processing` | Data streams | - |

## 4.3 Attribution & Tracking
| Service | Purpose | Port |
|---------|---------|------|
| `REZ-attribution-system` | Attribution tracking | - |
| `REZ-creator-network` | Creator attribution | - |

**DATA PLATFORM TOTAL: ~12 services**

---

# 5. INFRASTRUCTURE

**Purpose:** Technical infrastructure for all services.

## 5.1 Event & Messaging
| Service | Purpose | Port |
|---------|---------|------|
| `REZ-event-bus` | Event publishing (Redis+Kafka) | 4031 |
| `REZ-event-platform` | Event platform | 4008 |
| `REZ-unified-event-schema` | Event schema | - |
| `REZ-event-connector` | Event connectors | - |

## 5.2 API & Gateway
| Service | Purpose | Port |
|---------|---------|------|
| `REZ-api-gateway` | API gateway | - |
| `REZ-api-keys` | API key management | - |
| `REZ-integration-sdk` | SDK for integrations | 4091 |

## 5.3 Observability
| Service | Purpose | Port |
|---------|---------|------|
| `REZ-health-monitor` | Health monitoring | - |
| `REZ-observability` | Observability platform | - |
| `REZ-observability-system` | System observability | - |
| `REZ-audit-logging` | Audit logs | - |
| `REZ-validation-dashboard` | KPI dashboard | 4100 |

## 5.4 Feature Flags & Config
| Service | Purpose | Port |
|---------|---------|------|
| `REZ-feature-flags` | Feature flags | - |

## 5.5 Other Infrastructure
| Service | Purpose |
|---------|---------|
| `REZ-flywheel-mvp` | Data flywheel |
| `REZ-load-tests` | Load testing |
| `REZ-migration-scripts` | DB migrations |
| `REZ-ledger-service` | Double-entry bookkeeping |

**INFRASTRUCTURE TOTAL: ~15 services**

---

# 6. DUPLICATES / OLD / TO CLEANUP

| Service | Status | Notes |
|---------|--------|-------|
| `REZ-agent-orchestrator` | DEPRECATED | Use `rez-orchestrator-v2` |
| `REZ-merchant-os` | DUPLICATE? | Check if same as merchant-360 |
| `REZ-validation-dashboard` | CHECK | May be duplicate |

---

# SUMMARY TABLE

| Category | Services | Description |
|----------|----------|-------------|
| **REZ AGENT OS** | ~40 | Communication, orchestration, agents, channels |
| **REZ MIND** | ~20 | ML, recommendations, predictions, analytics |
| **REZ AUTONOMOUS AGENTS** | ~10 | AI agents for commerce |
| **DATA PLATFORM** | ~12 | Customer data, identity, warehouse |
| **INFRASTRUCTURE** | ~15 | Event bus, API gateway, observability |
| **UNDETERMINED** | ~17 | Need review |
| **TOTAL** | **114** | |

---

# CHANNEL BRIDGES - ALL COMPLETE

| Channel | Bridge Service | Port | Status |
|---------|--------------|------|--------|
| **WhatsApp** | `rez-whatsapp-orchestrator-bridge` | 4076 | ✅ Done |
| **Instagram** | `rez-instagram-bridge` | 4090 | ✅ Done |
| **Voice** | `rez-ai-voice` | 4077 | ✅ Done |
| **SMS** | `rez-sms-bridge` | 4085 | ✅ Done |
| **Email** | `rez-email-bridge` | 4086 | ✅ Done |
| **RCS** | `rez-rcs-bridge` | 4087 | ✅ Done |
| **Web Widget** | `rez-web-widget` | 4088 | ✅ Done |
| **App** | `rez-app-bridge` | 4089 | ✅ Done |

**ALL 8 CHANNELS COMPLETE!** ✅

---

# PROPOSED CLEANUP

## Merge Duplicates
- `REZ-merchant-os` + `REZ-merchant-360` → Keep one
- `REZ-cdp-service` + `REZ-data-platform` → Check overlap

## Move to Appropriate Repos
- `REZ-ledger-service` → RABTUL-Technologies (Finance)
- `REZ-reconciliation-service` → RABTUL-Technologies (Finance)

## Delete Deprecated
- `REZ-agent-orchestrator` → DELETE

---

# RECOMMENDED ACTIONS

1. **Confirm REZ AGENT OS scope** - Does it include channel bridges?
2. **Move finance services** to RABTUL-Technologies
3. **Delete deprecated services**
4. **Merge duplicate services**
5. **Document each service's purpose**

---

**Document Version:** 1.0
**Last Updated:** May 13, 2026
