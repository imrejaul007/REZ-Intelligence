# REZ-INTELLIGENCE - Developer Guide

**Version:** 4.0.0
**Updated:** June 2, 2026

---

## OVERVIEW

REZ-Intelligence provides AI/ML services.

REZ-Intelligence is INDEPENDENT from RABTUL-Technologies, HOJAI-AI, AdBazaar, Axom, and all other companies.

---

## AI SERVICES

### AI Agents & Support

| Port | Service | Purpose |
|------|---------|---------|
| 4055 | REZ-care-service | Customer 360, CSAT |
| 4062 | REZ-autonomous-agents | 8 AI agents |
| 4033 | REZ-support-copilot | Support AI |

### OADA Loop — Autonomous Operations (Polsia Parity)

| Port | Service | Purpose |
|------|---------|---------|
| 4800 | REZ-autonomous-loop | Observe → Think → Decide → Act → Learn → Repeat |
| 4801 | REZ-company-memory | Business entity state, decisions, metrics |
| 4802 | REZ-live-action-feed | Real-time monitoring, audit trail |

### Intelligence & Predictions

| Port | Service | Purpose |
|------|---------|---------|
| 4018 | rez-intent-predictor | Intent prediction |
| 4123 | REZ-predictive-engine | Churn, LTV |
| 4121 | REZ-signal-aggregator | Signals |
| 4126 | REZ-realtime-segments | Real-time segments |
| 4127 | REZ-feature-store | ML features |

### Recommendations & Commerce

| Port | Service | Purpose |
|------|---------|---------|
| 4129 | REZ-graph-service | Commerce graph |
| 4128 | REZ-decision-engine | Decisions |
| 4124 | REZ-rfm-service | RFM |
| 4017 | REZ-insights-service | BI, Reports |

### Workflow & Memory

| Port | Service | Purpose |
|------|---------|---------|
| 4200 | REZ-flow-runtime | Workflow |
| 4201 | REZ-memory-layer | Customer timeline |
| 4202 | REZ-whatsapp-service | WhatsApp AI |
| 4025 | REZ-event-bus | Events |

### Expert Services (Vertical AI Agents)

| Port | Service | Purpose |
|------|---------|---------|
| 3000 | REZ-hospitality-expert | Hotel & hospitality |
| 3003 | REZ-travel-expert | Travel & tourism |
| 3004 | REZ-retail-expert | Retail & shopping |
| 3005 | REZ-salon-expert | Salon & beauty |
| 3006 | REZ-education-expert | Education & learning |
| 3007 | REZ-fitness-expert | Fitness & health |
| 3008 | REZ-health-expert | Healthcare |
| 3012 | REZ-culinary-expert | Food & restaurants |
| **3013** | **REZ-real-estate-expert** | **Real estate & property** |
| **3014** | **REZ-finance-expert** | **Finance & investments** |
| **3015** | **REZ-logistics-expert** | **Logistics & supply chain** |

---

## INTEGRATION

REZ-Intelligence can integrate with other companies' services:

### Use RABTUL Services
```typescript
AUTH_SERVICE_URL=http://localhost:4002
PAYMENT_SERVICE_URL=http://localhost:4001
WALLET_SERVICE_URL=http://localhost:4004
```

### Use HOJAI-AI Services
```typescript
HOJAI_MEMORY_URL=http://localhost:4520
HOJAI_INTELLIGENCE_URL=http://localhost:4530
```

---

## LAST UPDATED

**Date:** June 2, 2026
**Version:** 4.0.0
