# MCP Strategy for REZ Intelligence

**Analysis Date:** May 15, 2026
**Purpose:** Determine if and what MCP servers should be built

---

## Business Overview

### Current State
- **60+ microservices** in REZ-Intelligence
- **30 AI agents** (Commerce + User + Autonomous)
- **5+ apps** (Hotel OTA, Rendez, AdBazaar, Food, Merchant)
- **Event-driven architecture** with REZ-event-bus
- **Multi-channel communications** (Push, SMS, WhatsApp, Email)

### Technology Stack
| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20.x |
| Database | MongoDB |
| Cache | Redis |
| Queue | BullMQ |
| AI | Claude, GPT, Gemini |
| Search | Elasticsearch |

---

## Current MCP Usage

| MCP Server | Purpose | Status |
|------------|---------|--------|
| `code-review-graph` | Code review | ✅ Active |
| `claude-flow` | Agent orchestration | ✅ Active |
| `mcp__CodeMax__web_search` | Web searches | ✅ Active |

---

## MCP Recommendation Analysis

### Option 1: Do NOT Build Custom MCPs

**Arguments:**
1. Services are REST-ful - can be called directly
2. Claude Code already has file system access
3. Current MCPs cover basic needs
4. Building MCPs adds maintenance burden

### Option 2: Build Strategic MCPs

**Arguments:**
1. 60+ services = complex discovery
2. Agent orchestration needs tool access
3. Event debugging requires visibility
4. Analytics queries need direct DB access

---

## Recommended MCPs to Build

Based on business needs analysis:

### Tier 1: Critical (Build Now)

| MCP | Purpose | Value |
|-----|---------|-------|
| **REZ Service Discovery** | Query service health, status, ports | High |
| **REZ Event Bus** | Publish/subscribe/debug events | High |
| **REZ Agent Invoke** | Trigger AI agents via MCP | High |

### Tier 2: Important (Build Soon)

| MCP | Purpose | Value |
|-----|---------|-------|
| **REZ Analytics** | Query metrics, KPIs | Medium |
| **REZ Identity** | Resolve user identity | Medium |
| **REZ Recommendations** | Get recommendations | Medium |

### Tier 3: Nice to Have (Later)

| MCP | Purpose | Value |
|-----|---------|-------|
| **MongoDB Explorer** | Direct DB queries | Low |
| **Redis Inspector** | Cache inspection | Low |
| **REZ Notification Preview** | Preview notifications | Low |

---

## Decision Matrix

| Factor | Weight | Build MCPs? |
|--------|--------|-------------|
| Complexity (60+ services) | High | Yes |
| Maintenance burden | Medium | No |
| Developer productivity | High | Yes |
| Debugging needs | High | Yes |
| Existing tools coverage | Medium | Partial |
| Time to build | Medium | 2-3 weeks |

**Recommendation: Build Tier 1 MCPs (3 servers)**

---

## Proposed MCP Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Claude Code                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ Service     │  │ Event Bus   │  │ Agent       │    │
│  │ Discovery   │  │ MCP         │  │ Invoke      │    │
│  │ MCP        │  │             │  │ MCP         │    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │
│         │                │                │            │
└─────────┼────────────────┼────────────────┼─────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────┐
│                    REZ Services                          │
├──────────┬──────────┬──────────┬──────────┬──────────┤
│ Health   │ Event    │ Agent    │ Analytics │ Identity  │
│ Monitor │ Bus      │ Orchestr │ Service   │ Graph     │
│ (4095)  │ (4031)   │ (4062)   │ (4086)   │ (4050)    │
└──────────┴──────────┴──────────┴──────────┴──────────┘
```

---

## MCP Specifications

### MCP 1: REZ Service Discovery

**Purpose:** Query service health, status, and endpoints

**Tools:**
```typescript
// Get all services health
list_services(): Service[]

// Get specific service
get_service(name: string): Service

// Get service logs
get_service_logs(name: string, lines: number): string

// Get service config
get_service_config(name: string): Config

// Restart service
restart_service(name: string): Result
```

**Service Response:**
```typescript
interface Service {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  port: number;
  uptime: number;
  lastHealthCheck: string;
  endpoints: string[];
  dependencies: string[];
}
```

---

### MCP 2: REZ Event Bus

**Purpose:** Debug, publish, and subscribe to events

**Tools:**
```typescript
// List event types
list_event_types(): EventType[]

// Get event history
get_events(filters: EventFilters): Event[]

// Publish event
publish_event(event: Event): EventResult

// Subscribe to events
subscribe(channel: string): void

// Get event stats
get_event_stats(): EventStats
```

**Usage Example:**
```typescript
// Debug why a user didn't get a recommendation
> get_events({ type: 'order.completed', userId: 'user123', limit: 10 })

// Publish test event
> publish_event({ type: 'test.user.action', data: { test: true } })
```

---

### MCP 3: REZ Agent Invoke

**Purpose:** Trigger AI agents directly

**Tools:**
```typescript
// List available agents
list_agents(): Agent[]

// Invoke specific agent
invoke_agent(agentId: string, input: AgentInput): AgentResult

// Get agent history
get_agent_history(agentId: string, limit: number): Conversation[]

// Get agent capabilities
get_agent_capabilities(agentId: string): Capability[]
```

**Usage Example:**
```typescript
// Ask the reorder predictor about a user
> invoke_agent({ agentId: 'reorder-predictor', userId: 'user123' })

// Get churn risk score
> invoke_agent({ agentId: 'churn-risk', userId: 'user123' })
```

---

### MCP 4: REZ Analytics (Tier 2)

**Purpose:** Query business metrics

**Tools:**
```typescript
// Get dashboard metrics
get_dashboard_metrics(dateRange: DateRange): DashboardMetrics

// Get funnel analysis
get_funnel(steps: string[], dateRange: DateRange): FunnelResult

// Get revenue metrics
get_revenue_metrics(breakdown: string): RevenueMetrics

// Get user segments
get_user_segments(): Segment[]
```

---

### MCP 5: REZ Identity (Tier 2)

**Purpose:** Resolve user identity across apps

**Tools:**
```typescript
// Resolve identity
resolve_identity(identifier: string): IdentityProfile

// Link identities
link_identities(source: string, target: string): LinkResult

// Get unified profile
get_unified_profile(userId: string): UnifiedProfile
```

---

## Implementation Plan

### Phase 1: Build Core MCPs (Week 1)

| Task | Duration | Owner |
|------|---------|-------|
| MCP Server scaffolding | 2 days | Agent |
| Service Discovery MCP | 3 days | Agent |
| Event Bus MCP | 3 days | Agent |

### Phase 2: Build Agent MCP (Week 2)

| Task | Duration | Owner |
|------|---------|-------|
| Agent Invoke MCP | 5 days | Agent |

### Phase 3: Build Analytics MCP (Week 3)

| Task | Duration | Owner |
|------|---------|-------|
| Analytics MCP | 5 days | Agent |

---

## Build vs Buy Analysis

| MCP | Build Cost | Buy Option | Recommendation |
|-----|-----------|-----------|----------------|
| Service Discovery | 5 days | N/A | Build |
| Event Bus | 5 days | N/A | Build |
| Agent Invoke | 5 days | N/A | Build |
| Analytics | 5 days | Metabase, Grafana | Build |
| MongoDB Explorer | 3 days | MongoDB Compass | Skip |
| Redis Inspector | 2 days | Redis Insight | Skip |

---

## Final Recommendation

### Build These MCPs:

1. ✅ **REZ Service Discovery MCP**
   - Query service health
   - View service logs
   - Check service status

2. ✅ **REZ Event Bus MCP**
   - Debug event flow
   - Publish test events
   - Monitor event processing

3. ✅ **REZ Agent Invoke MCP**
   - Trigger agents
   - Get agent responses
   - Analyze agent decisions

### Skip These:

- MongoDB Explorer (use Compass)
- Redis Inspector (use Redis Insight)
- Direct DB queries (security risk)

### Timeline: 2-3 weeks

---

## Questions for You

1. **Priority:** Which MCP is most valuable to you?
   - Service debugging?
   - Event debugging?
   - Agent testing?

2. **Access Level:** Should MCPs have:
   - Read-only access?
   - Full admin access?

3. **Security:** Who should access MCPs?
   - Developers only?
   - All Claude Code users?

---

## Next Steps

1. **Approve MCP list** → I'll build them
2. **Decide access level** → Configure permissions
3. **Set up MCP server** → Deploy infrastructure

What would you like to do?
