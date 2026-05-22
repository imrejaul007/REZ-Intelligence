# REZ Care - Priority Roadmap
# Based on Architecture Audit - May 21, 2026

## Current State Assessment

### ✅ Already Built (Don't Touch)
- [x] Expert service separation (8 verticals)
- [x] Proactive detection service
- [x] Cross-platform issue memory
- [x] Autonomous actions engine
- [x] WhatsApp integration
- [x] Mobile SDK
- [x] CSAT system
- [x] Agent management
- [x] Escalation engine
- [x] **Ecosystem integrations (DONE May 21)**

### ✅ Fully Integrated (May 21, 2026)
- [x] REZ-memory-layer (4201) - Customer Timeline
- [x] REZ-unified-profile (4060) - Unified Profile
- [x] REZ-workflow-builder (4045) - Workflow Automation
- [x] Vector Search (4127) - RAG/Knowledge

### ⚠️ Needs Work
- [ ] Human-agent copilot UI
- [ ] Revenue/monetization layer
- [ ] SaaS productization

---

## Priority 1: Consolidation (Week 1-2)

### Action: Merge to 3 Core Services

```
BEFORE (10 services):
├── rez-care-service (4058)
├── rez-support-copilot (4033)
├── rez-hospitality-expert (3005)
├── rez-salon-expert (3006)
├── rez-fitness-expert (3007)
├── rez-health-expert (3008)
├── rez-education-expert (3009)
├── rez-travel-expert (3010)
├── rez-retail-expert (3011)
└── rez-culinary-expert (3012)

AFTER (3 services):
├── rez-care-platform (4058)      ← Support OS
├── rez-care-intelligence (4033)   ← AI Brain
└── rez-care-experts (3005)       ← All 8 in 1
```

### Deliverables
- [ ] Updated render.yaml (3 services)
- [ ] Expert router to single service
- [ ] Simplified service discovery

---

## Priority 2: Customer Timeline (Week 2-4)

### Why: AI needs unified context

### Implementation
```typescript
// New: CustomerEvent schema
interface CustomerEvent {
  eventId: string;
  customerId: string;
  eventType: 'order' | 'payment' | 'support' | 'chat' | 'refund' | 'loyalty' | 'delivery';
  timestamp: Date;
  data: Record<string, any>;
  source: string; // 'rez-care', 'rez-order', 'rez-payment', etc.
  sentiment?: number;
  intent?: string;
}
```

### Integration Points
- [ ] Connect to REZ Event Bus (4025)
- [ ] Emit events from all services
- [ ] Query timeline for AI context
- [ ] Real-time updates via Socket.IO

---

## Priority 3: Workflow Engine (Week 4-8)

### Why: Current flows are hardcoded

### Options
1. **Simple**: Add workflow DSL to existing service
2. **Temporal**: Add Temporal for durable execution
3. **Camunda**: Self-hosted BPMN

### Recommendation: Option 1 (start simple)

```typescript
// Workflow DSL example
const workflow = {
  name: 'vip-refund',
  trigger: { type: 'payment_failed', customerLtv: { gt: 50000 } },
  steps: [
    { action: 'auto_refund', timeout: '5m' },
    { action: 'credit_wallet', params: { amount: 100 } },
    { action: 'send_sms', template: 'vip_retention' },
    { action: 'create_ticket', assignTo: 'vip-team' },
  ],
  escalation: { after: '30m', to: 'manager' }
};
```

### Deliverables
- [ ] Workflow schema
- [ ] Workflow executor
- [ ] Retry logic
- [ ] Timeout handling
- [ ] Saga support

---

## Priority 4: Human-Agent Copilot (Week 8-12)

### Why: Agents need AI assistance

### UI Features
```
┌─────────────────────────────────────────────────────────────┐
│  TICKET #1234 - Payment Issue                            │
├─────────────────────────────────────────────────────────────┤
│  Customer: Rahul S. (VIP - LTV: ₹1.2L)                  │
│  Churn Risk: HIGH (0.82) │ Sentiment: Negative           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🤖 AI SUGGESTIONS:                                        │
│  ├─ Suggested Response: "I see your payment failed..."    │
│  ├─ Recommended Action: Auto-refund + 200 coins           │
│  ├─ VIP Retention: Apply coupon CODE-VIP-500              │
│  └─ Similar Ticket: #1189 (resolved successfully)         │
│                                                             │
│  [ Apply Suggestion ] [ Override & Send ] [ Escalate ]    │
└─────────────────────────────────────────────────────────────┘
```

### Deliverables
- [ ] Agent dashboard UI
- [ ] Real-time suggestions
- [ ] One-click actions
- [ ] Customer context panel
- [ ] Response composer with AI

---

## Priority 5: Revenue Layer (Month 4-6)

### Why: Turn cost center into profit center

### Products to Launch

| Product | Target | Price |
|---------|--------|-------|
| REZ Care Lite | SMBs | ₹999/mo |
| REZ Care Pro | Mid-market | ₹4,999/mo |
| REZ Care Enterprise | Enterprise | Custom |

### Features by Tier

| Feature | Lite | Pro | Enterprise |
|---------|------|-----|-----------|
| Tickets | 100/mo | Unlimited | Unlimited |
| WhatsApp | ✅ | ✅ | ✅ |
| AI Suggestions | Basic | Advanced | Custom |
| Analytics | Basic | Advanced | Custom |
| Multi-brand | ❌ | 3 brands | Unlimited |
| API Access | ❌ | ✅ | ✅ |
| SLA | Email | Priority | Dedicated |

---

## Long-Term Vision (6-18 months)

### Phase 1: SaaS Launch
- [ ] Multi-tenant architecture
- [ ] Self-service onboarding
- [ ] Payment integration
- [ ] White-label options

### Phase 2: AI Marketplace
- [ ] Plugin architecture
- [ ] Custom AI agents
- [ ] Industry-specific models
- [ ] Fine-tuning on customer data

### Phase 3: Platform
- [ ] Partner ecosystem
- [ ] Integration marketplace
- [ ] Referral program
- [ ] Enterprise features

---

## Key Metrics to Track

### Product Metrics
- Tickets resolved per hour
- First response time
- Resolution rate
- CSAT score
- Auto-resolution rate

### Business Metrics
- Revenue per merchant
- Churn rate
- NPS score
- Support cost per order
- Recovery rate (refunds/retention)

---

## Dependencies

### Before Priority 2 (Customer Timeline)
- [ ] REZ Event Bus (4025) deployed
- [ ] Schema registry defined

### Before Priority 4 (Agent Copilot)
- [ ] Agent dashboard deployed
- [ ] Socket.IO integration

### Before Priority 5 (Revenue)
- [ ] Multi-tenant service ready
- [ ] Billing system integrated
- [ ] Legal docs prepared

---

## Quick Wins (Completed May 21, 2026)

1. ✅ Consolidate render.yaml to 3 services
2. ✅ Add expertServices.ts (consolidated)
3. ✅ Connect REZ-memory-layer (timeline)
4. ✅ Connect REZ-unified-profile (profile)
5. ✅ Connect REZ-workflow-builder (automation)
6. ✅ Connect Vector Search (RAG/Knowledge)
7. ✅ Add ecosystemRoutes.ts with 15+ endpoints
8. ✅ Update SOT with complete integration status

---

## Status: Complete ✅

All ecosystem integrations are now connected:
- ✅ Memory Layer (Customer Timeline)
- ✅ Unified Profile (Customer 360)
- ✅ Workflow Builder (Automation)
- ✅ Vector Search (RAG/Knowledge)

The foundation is solid. The audit correctly identified:
- ✅ Architecture is future-proof
- ✅ Operational simplification done (3 domains)
- ✅ All missing services integrated
- ⚠️ Human-Agent Copilot UI (next phase)
- ❌ Revenue layer (future phase)

**Next action**: Deploy consolidated 3-service architecture
