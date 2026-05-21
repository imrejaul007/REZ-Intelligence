# REZ MCP Analytics - SPEC.md

**Version:** 1.1.0
**Type:** MCP Server
**Company:** REZ-Intelligence
**Category:** AI Tools

---

## Overview

Model Context Protocol (MCP) server providing AI agents with access to REZ analytics data. Enables natural language queries for dashboards, funnels, revenue breakdowns, and user/merchant metrics.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ MCP Analytics Server                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Protocol: MCP (Model Context Protocol)                                    │
│  Transport: Stdio (for CLI integration)                                   │
│  Data Source: REZ Analytics Service API                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## MCP Tools

### get_dashboard_metrics
Get key dashboard metrics including revenue, orders, and user statistics.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| period | string | No | `today`, `week`, `month`, `quarter`, `year` |

**Returns:** Revenue totals, order counts, user activity, conversion rates

### get_funnel
Get funnel analytics showing conversion rates through the purchase funnel.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| period | string | No | `today`, `week`, `month`, `quarter` |
| source | string | No | `all`, `organic`, `paid`, `referral`, `social` |

**Returns:** Funnel stages, drop-off rates, conversion insights

### get_revenue_breakdown
Get revenue breakdown by category and channel.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| breakdown | string | No | `category`, `channel`, `both` |
| period | string | No | `month`, `quarter`, `year` |

**Returns:** Revenue by category, channel, top performers, insights

### get_user_metrics
Get user metrics including DAU, MAU, retention, and engagement.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| period | string | No | `week`, `month`, `quarter` |
| groupBy | string | No | `day`, `week`, `month` |

**Returns:** DAU, MAU, stickiness ratio, retention rates, engagement

### get_merchant_metrics
Get merchant performance metrics including GMV, fulfillment, and ratings.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| period | string | No | `week`, `month`, `quarter` |
| sortBy | string | No | `gmv`, `orders`, `rating`, `growth` |
| limit | number | No | Number of top merchants (1-100) |

**Returns:** Top merchants, summary stats, insights

---

## Dependencies

```json
{
  "@modelcontextprotocol/sdk": "^0.5.0",
  "dotenv": "^16.6.1"
}
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ANALYTICS_SERVICE_URL` | `https://rez-analytics-service.onrender.com` | Analytics API endpoint |
| `INTERNAL_SERVICE_TOKEN` | - | Service authentication |
| `USE_REAL_ANALYTICS` | `false` | Use real API vs mock data |

---

## Usage

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

---

## Integration

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ Analytics Service | Read | Fetch analytics data |

---

## Status

- [x] MCP server foundation
- [x] Dashboard metrics tool
- [x] Funnel analytics tool
- [x] Revenue breakdown tool
- [x] User metrics tool
- [x] Merchant metrics tool
