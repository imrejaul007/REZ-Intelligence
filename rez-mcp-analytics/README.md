# REZ Analytics MCP Server

MCP server for accessing REZ platform analytics and metrics.

## Features

- **Dashboard Metrics** - Revenue, orders, and user statistics
- **Funnel Analytics** - Conversion rates through the purchase funnel
- **Revenue Breakdown** - By category and channel
- **User Metrics** - DAU, MAU, retention, and engagement
- **Merchant Performance** - GMV, fulfillment, and ratings

## Installation

```bash
cd rez-mcp-analytics
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Production

```bash
npm start
```

## Available Tools

### get_dashboard_metrics
Get key dashboard metrics including revenue, orders, and user statistics.

**Parameters:**
- `period` (optional): "today" | "week" | "month" | "quarter" | "year"

### get_funnel
Get funnel analytics showing conversion rates through the purchase funnel.

**Parameters:**
- `period` (optional): "today" | "week" | "month" | "quarter"
- `source` (optional): "all" | "organic" | "paid" | "referral" | "social"

### get_revenue_breakdown
Get revenue breakdown by category and channel.

**Parameters:**
- `breakdown` (optional): "category" | "channel" | "both"
- `period` (optional): "month" | "quarter" | "year"

### get_user_metrics
Get user metrics including DAU, MAU, retention, and engagement.

**Parameters:**
- `period` (optional): "week" | "month" | "quarter"
- `groupBy` (optional): "day" | "week" | "month"

### get_merchant_metrics
Get merchant performance metrics.

**Parameters:**
- `period` (optional): "week" | "month" | "quarter"
- `sortBy` (optional): "gmv" | "orders" | "rating" | "growth"
- `limit` (optional): 1-100 (default: 10)

## Usage Example

```bash
# Build and run
npm run build && npm start

# Or use with Claude Code MCP client
```

## Architecture

```
rez-mcp-analytics/
├── src/
│   └── index.ts          # MCP server implementation
├── dist/                 # Compiled output
├── package.json
├── tsconfig.json
└── README.md
```

## Mock Data

This server provides realistic mock data for development and testing. In production, replace mock generators with actual API calls to REZ analytics services.
