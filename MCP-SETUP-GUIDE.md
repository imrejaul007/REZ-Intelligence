# MCP Setup Guide - REZ Ecosystem

**Created:** May 15, 2026
**Status:** Phase 1 & 2 Complete (6 MCPs)

---

## Overview

6 MCP servers have been built to give Claude Code superpowers over your REZ ecosystem.

---

## MCP Servers Built

### 1. Service Discovery (rez-mcp-service-discovery)

**Purpose:** Query health, status, and information about all 90+ services

**Tools:**
- `list_services` - List all services (filter by category/status)
- `get_service` - Get detailed service info
- `get_service_health` - Check service health
- `get_service_logs` - Get service logs
- `find_services` - Search services by keyword

**Services Covered:**
- RABTUL Shared (Auth, Payments, Orders, Notifications)
- REZ-Intelligence (Reorder Engine, AI Agents, Identity Graph)
- Infrastructure services

**Location:** `/Users/rejaulkarim/Documents/ReZ Full App/rez-mcp-service-discovery`

---

### 2. Event Bus (rez-mcp-event-bus)

**Purpose:** Debug events, track event flows, manage DLQ

**Tools:**
- `list_event_types` - List all event types
- `get_events` - Query events with filters
- `publish_event` - Publish new events
- `get_event_flow` - Get complete event timeline for an entity
- `get_dlq_events` - Get failed events
- `retry_dlq_event` - Retry failed events
- `get_event_stats` - Get processing statistics

**Event Types:** 16 types (user.*, order.*, payment.*, reorder.*, notification.*)

**Location:** `/Users/rejaulkarim/Documents/ReZ Full App/rez-mcp-event-bus`

---

### 3. Agent Invoke (rez-mcp-agent-invoke)

**Purpose:** Invoke and test AI agents directly

**Tools:**
- `list_agents` - List all agents (filter by category)
- `get_agent` - Get agent details
- `invoke_agent` - Invoke agent with input
- `get_agent_history` - View invocation history
- `test_agent` - Test agent with sample data
- `compare_agents` - Compare multiple agents

**Agents Available:**
| Category | Agents |
|----------|--------|
| Commerce | reorder-predictor, demand-forecast, price-optimizer |
| User | churn-risk, ltv-predictor, personalization |
| Operations | inventory-alert, fraud-detection |

**Location:** `/Users/rejaulkarim/Documents/ReZ Full App/rez-mcp-agent-invoke`

---

### 4. Analytics (rez-mcp-analytics)

**Purpose:** Query business metrics and analytics

**Tools:**
- `get_dashboard_metrics` - Revenue, orders, users, performance
- `get_funnel` - Conversion funnel analysis
- `get_revenue_breakdown` - Revenue by category/channel
- `get_user_metrics` - DAU, MAU, retention, engagement
- `get_merchant_metrics` - Merchant performance

**Location:** `/Users/rejaulkarim/Documents/ReZ Full App/rez-mcp-analytics`

---

### 5. Identity Resolution (rez-mcp-identity)

**Purpose:** Resolve user identity across apps

**Tools:**
- `resolve_identity` - Resolve by email/phone/device
- `get_unified_profile` - Get unified user profile
- `link_identities` - Link multiple identities
- `get_identity_graph` - View identity linkage graph
- `find_related_users` - Find related users

**Location:** `/Users/rejaulkarim/Documents/ReZ Full App/rez-mcp-identity`

---

### 6. Payment Debugger (rez-mcp-payment)

**Purpose:** Debug payment issues and transactions

**Tools:**
- `list_transactions` - List transactions with filters
- `get_transaction` - Get transaction details
- `get_payment_status` - Quick status check
- `list_refunds` - List refunds
- `initiate_refund` - Initiate refund
- `get_wallet_balance` - Get wallet balance

**Location:** `/Users/rejaulkarim/Documents/ReZ Full App/rez-mcp-payment`

---

## Installation

### Option 1: Individual Installation

```bash
# Service Discovery
cd "/Users/rejaulkarim/Documents/ReZ Full App/rez-mcp-service-discovery"
npm install
npm run build

# Event Bus
cd "/Users/rejaulkarim/Documents/ReZ Full App/rez-mcp-event-bus"
npm install
npm run build

# Agent Invoke
cd "/Users/rejaulkarim/Documents/ReZ Full App/rez-mcp-agent-invoke"
npm install
npm run build

# Analytics
cd "/Users/rejaulkarim/Documents/ReZ Full App/rez-mcp-analytics"
npm install
npm run build

# Identity
cd "/Users/rejaulkarim/Documents/ReZ Full App/rez-mcp-identity"
npm install
npm run build

# Payment
cd "/Users/rejaulkarim/Documents/ReZ Full App/rez-mcp-payment"
npm install
npm run build
```

### Option 2: Batch Installation

```bash
cd "/Users/rejaulkarim/Documents/ReZ Full App"

for dir in rez-mcp-*; do
  echo "Installing $dir..."
  cd "$dir"
  npm install
  npm run build
  cd ..
done
```

---

## Usage Examples

### Service Discovery

```
You: "List all intelligence services"
Claude: calls list_services({ category: 'intelligence' })
→ Returns: [rez-reorder-engine, rez-identity-graph, rez-autonomous-agents, ...]

You: "Check health of rez-flywheel-mvp"
Claude: calls get_service_health({ name: 'rez-flywheel-mvp' })
→ Returns: { status: 'healthy', uptime: 99.9%, responseTime: 45ms }
```

### Event Bus

```
You: "Show me all events for user123 in the last hour"
Claude: calls get_events({ userId: 'user123', limit: 50 })
→ Returns: Event timeline

You: "Why didn't user456 get a reorder nudge?"
Claude: calls get_event_flow({ entityType: 'user', entityId: 'user456', hours: 24 })
→ Returns: Complete event flow showing where it broke
```

### Agent Invoke

```
You: "What's user123's churn risk?"
Claude: calls invoke_agent({ agentId: 'churn-risk', userId: 'user123' })
→ Returns: { score: 0.82, riskLevel: 'high', factors: [...] }

You: "Test the reorder predictor"
Claude: calls test_agent({ agentId: 'reorder-predictor', testData: {...} })
→ Returns: { score: 85, predictedItems: [...], confidence: 0.89 }
```

### Analytics

```
You: "Show me today's key metrics"
Claude: calls get_dashboard_metrics({ dateRange: 'today' })
→ Returns: { revenue: ..., orders: ..., users: ..., conversion: ... }

You: "What's our checkout funnel conversion rate?"
Claude: calls get_funnel({ steps: ['visit', 'add_to_cart', 'checkout', 'purchase'] })
→ Returns: Funnel with drop-off analysis
```

### Identity

```
You: "Show me all identities linked to john@example.com"
Claude: calls resolve_identity({ identifier: 'john@example.com', type: 'email' })
→ Returns: { userId: 'user123', linkedIds: [...], apps: [...] }
```

### Payment

```
You: "Why did payment xyz123 fail?"
Claude: calls get_transaction({ transactionId: 'xyz123' })
→ Returns: { status: 'failed', error: 'Insufficient funds', ... }

You: "Initiate refund for order456"
Claude: calls initiate_refund({ transactionId: 'order456', amount: 299 })
→ Returns: { refundId: 'ref_xxx', status: 'initiated' }
```

---

## Configuration

### Claude Code Settings

Add to your Claude Code settings to enable MCPs:

```json
{
  "mcpServers": {
    "rez-service-discovery": {
      "command": "node",
      "args": ["/Users/rejaulkarim/Documents/ReZ Full App/rez-mcp-service-discovery/dist/index.js"]
    },
    "rez-event-bus": {
      "command": "node",
      "args": ["/Users/rejaulkarim/Documents/ReZ Full App/rez-mcp-event-bus/dist/index.js"]
    },
    "rez-agent-invoke": {
      "command": "node",
      "args": ["/Users/rejaulkarim/Documents/ReZ Full App/rez-mcp-agent-invoke/dist/index.js"]
    },
    "rez-analytics": {
      "command": "node",
      "args": ["/Users/rejaulkarim/Documents/ReZ Full App/rez-mcp-analytics/dist/index.js"]
    },
    "rez-identity": {
      "command": "node",
      "args": ["/Users/rejaulkarim/Documents/ReZ Full App/rez-mcp-identity/dist/index.js"]
    },
    "rez-payment": {
      "command": "node",
      "args": ["/Users/rejaulkarim/Documents/ReZ Full App/rez-mcp-payment/dist/index.js"]
    }
  }
}
```

### Environment Variables

Create `.env` files for each MCP with real service URLs:

```bash
# rez-mcp-service-discovery/.env
AUTH_SERVICE_URL=https://rez-auth-service.onrender.com
PAYMENT_SERVICE_URL=https://rez-payment-service.onrender.com
ORDER_SERVICE_URL=https://rez-order-service-hz18.onrender.com

# rez-mcp-agent-invoke/.env
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

---

## Development

### Running in Development Mode

```bash
cd rez-mcp-service-discovery
npm run dev  # Hot reload enabled
```

### Testing MCP Locally

```bash
# Test Service Discovery
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | npm start

# Test Event Bus
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | npm start
```

---

## Troubleshooting

### MCP Not Connecting

1. Check build: `npm run build`
2. Check dist/index.js exists
3. Check dependencies: `npm install`
4. Verify Node version: `node --version` (needs 18+)

### Tool Not Found

1. Restart Claude Code
2. Check MCP is in settings.json
3. Verify path to dist/index.js is correct

### Permission Denied

1. Check file permissions: `chmod +x dist/index.js`
2. Verify npm has write access

---

## Next Steps

### Phase 3 (Future)

Build additional MCPs:
- Order Management
- Notification Debugger
- Inventory Checker
- Log Aggregator
- Infrastructure Health

---

## Support

- MCP Source: `/Users/rejaulkarim/Documents/ReZ Full App/rez-mcp-*`
- Documentation: Each MCP has README.md
- Issues: Create GitHub issue in respective repo

---

**Happy debugging! 🚀**
