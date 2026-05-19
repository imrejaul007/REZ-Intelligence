# REZ-Intelligence Service Overlap Documentation

## Purpose

This document clarifies the purpose of each service to prevent duplication of effort and guide integration decisions.

---

## Attribution Services

### Services

| Service | Port | Primary Focus | Integration Points |
|---------|------|---------------|-------------------|
| **REZ-unified-attribution** | 4090 | **Primary attribution hub** - All channels, models | Bridges to DOOH, QR, LTV |
| **REZ-ltv-attribution** | 4090 | Lifetime value by channel | Uses unified-attribution |
| **REZ-dooh-attribution** | 4081 | DOOH-specific attribution | Can feed unified-attribution |
| **rez-crosschannel-attribution** | 4115 | Cross-channel tracking | Uses unified-attribution |
| **REZ-attribution-system** | - | Legacy attribution | Deprecated - use unified |

### Recommendation

- **Use REZ-unified-attribution** as the primary service
- Other attribution services should feed into or extend unified-attribution
- DOOH, LTV, crosschannel can remain specialized but should integrate

---

## Identity Services

### Services

| Service | Port | Primary Focus | Integration Points |
|---------|------|---------------|-------------------|
| **REZ-identity-graph** | 4050 | Identity resolution | All identity services |
| **REZ-universal-user-graph** | 4055 | Cross-platform user graph | Identity graph |
| **REZ-consumer-graph** | - | Consumer relationships | Identity graph |
| **REZ-unified-identity** | - | Unified identity management | Identity graph |
| **REZ-identity-bridge** | 4092 | Identity bridging | Uses identity-graph |

### Recommendation

- **Use REZ-identity-graph** as the canonical identity service
- All other identity services should use identity-graph
- Universal-user-graph provides cross-platform stitching

---

## Recommendation/Personalization Services

### Services

| Service | Port | Primary Focus | Integration Points |
|---------|------|---------------|-------------------|
| **REZ-recommendation-engine** | 4017 | Product/content recommendations | Personalization engine |
| **REZ-personalization-engine** | 4070 | User personalization | Recommendation engine |
| **REZ-unified-recommendations** | 4090 | Cross-platform recommendations | Both above |

### Recommendation

- **REZ-recommendation-engine** and **REZ-personalization-engine** are complementary
- Recommendation provides the "what to recommend" logic
- Personalization provides the "how to personalize" logic
- **REZ-unified-recommendations** aggregates across platforms

---

## Customer Services

### Services

| Service | Port | Primary Focus | Integration Points |
|---------|------|---------------|-------------------|
| **REZ-care-service** | 4058 | Customer support | CDP, Unified profile |
| **REZ-cdp-service** | 3005 | Customer Data Platform | Care, Unified profile |
| **rez-customer-360** | - | 360° customer view | Uses CDP, Care |

### Recommendation

- **REZ-care-service** is for support/customer service
- **REZ-cdp-service** is for data aggregation
- **rez-customer-360** provides the unified view
- These three should integrate but serve different purposes

---

## Merchant Intelligence

### Services

| Service | Port | Primary Focus | Integration Points |
|---------|------|---------------|-------------------|
| **REZ-merchant-intelligence** | 4014 | Merchant analytics | Merchant OS |
| **REZ-merchant-360** | - | Merchant unified view | Uses merchant-intelligence |
| **REZ-merchant-brain** | 4061 | Merchant AI assistant | Uses merchant-intelligence |
| **REZ-merchant-os** | 4073 | Merchant operating system | Aggregates all |

### Recommendation

- **REZ-merchant-os** is the primary merchant interface
- **REZ-merchant-intelligence** provides analytics
- **REZ-merchant-brain** provides AI assistance
- These should be integrated under Merchant OS

---

## Expert Services

### Services

| Expert | Domain | Port | Purpose |
|--------|--------|------|---------|
| rez-fitness-expert | Fitness | env | Fitness advice |
| rez-health-expert | Health | env | Health recommendations |
| rez-travel-expert | Travel | 3003 | Travel planning |
| rez-education-expert | Education | 3006 | Educational content |
| rez-hospitality-expert | Hospitality | - | Hospitality AI |
| rez-culinary-expert | Culinary | 3001 | Recipe/food AI |
| rez-retail-expert | Retail | env | Retail insights |
| rez-salon-expert | Salon | 3005 | Salon recommendations |
| rez-fraud-agent | Fraud | 3007 | Fraud detection |
| rez-sales-agent | Sales | 3001 | Sales automation |

### Recommendation

- Expert services are **domain-specific** - no consolidation needed
- All use the same base framework (rez-expert-base)
- Can be orchestrated by REZ-autonomous-agents

---

## MCP Services

### Services

All MCP services follow the Model Context Protocol:

| Service | Purpose |
|---------|---------|
| rez-mcp-analytics | Analytics protocol |
| rez-mcp-event-bus | Event bus protocol |
| rez-mcp-identity | Identity protocol |
| rez-mcp-inventory | Inventory protocol |
| rez-mcp-logs | Logging protocol |
| rez-mcp-notification | Notification protocol |
| rez-mcp-order | Order protocol |
| rez-mcp-payment | Payment protocol |
| rez-mcp-service-discovery | Service discovery |
| rez-mcp-agent-invoke | Agent invocation |

### Recommendation

- MCP services are **protocol-specific** - no overlap
- All implement the same MCP interface
- Used for tool/function calling from agents

---

## Integration Pattern

```
                    REZ-autonomous-agents
                              │
                              ▼
┌─────────────────────────────────────────────────────┐
│                    Domain Services                     │
├─────────────────────────────────────────────────────┤
│  Attribution ──► Identity ──► Recommendations        │
│       │              │              │                 │
│       ▼              ▼              ▼                 │
│  REZ-unified   REZ-identity   REZ-personalization  │
│  -attribution    -graph           -engine           │
└─────────────────────────────────────────────────────┘
                    │
                    ▼
              RABTUL Platform
         (Auth, Payment, Wallet, Notifications)
```

---

## How to Use This Document

1. **Before creating a new service**, check if existing services cover the use case
2. **If overlap exists**, either:
   - Extend the existing service
   - Create a specialized service that integrates with the main service
   - Mark the existing service as deprecated and migrate
3. **When integrating**, use the canonical service as the primary reference

---

## Action Items

- [ ] Add integration comments to all overlapping services
- [ ] Create integration tests between related services
- [ ] Document API contracts between services
- [ ] Create integration guide for new developers
