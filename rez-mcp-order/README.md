# REZ Order Management MCP Server

A Model Context Protocol (MCP) server for managing orders in the REZ platform.

## Features

- **List Orders**: Query orders with filters for status, user, merchant, and date range
- **Get Order Details**: Retrieve complete order information
- **Order Status Tracking**: View order status with full timeline
- **Delivery Tracking**: Track shipments with carrier information
- **Order Cancellation**: Cancel orders with reason tracking
- **Status Management**: Update order status with transition validation
- **Analytics**: Get comprehensive order metrics and insights

## Installation

```bash
npm install
```

## Development

```bash
# Run in development mode with hot reload
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

## Configuration

Set the `ORDER_SERVICE_URL` environment variable to connect to a real order service:

```bash
ORDER_SERVICE_URL=https://rez-order-service.onrender.com npm run dev
```

When `ORDER_SERVICE_URL` is not set, the server uses mock data for testing.

## Available Tools

### list_orders

List orders with optional filters.

```json
{
  "name": "list_orders",
  "arguments": {
    "status": "delivered",
    "userId": "usr_12345",
    "limit": 10,
    "sortBy": "createdAt",
    "sortOrder": "desc"
  }
}
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status: pending, confirmed, processing, shipped, delivered, cancelled, refunded |
| userId | string | Filter by user ID |
| merchantId | string | Filter by merchant ID |
| dateFrom | string | Filter from date (ISO 8601) |
| dateTo | string | Filter to date (ISO 8601) |
| limit | number | Results per page (1-100, default: 20) |
| offset | number | Skip count (default: 0) |
| sortBy | string | Sort field: createdAt, total, status |
| sortOrder | string | Sort direction: asc, desc |

---

### get_order

Get complete order details.

```json
{
  "name": "get_order",
  "arguments": {
    "orderId": "ord_001"
  }
}
```

Supports both order ID (`ord_001`) and order number (`REZ-2026-0515001`).

---

### get_order_status

Get order status with full timeline.

```json
{
  "name": "get_order_status",
  "arguments": {
    "orderId": "ord_001"
  }
}
```

Returns the current status, payment status, and complete timeline of all status changes.

---

### get_order_tracking

Get delivery tracking information.

```json
{
  "name": "get_order_tracking",
  "arguments": {
    "orderId": "ord_002"
  }
}
```

Returns carrier details, tracking number, estimated delivery, and all shipment events.

---

### cancel_order

Cancel an order.

```json
{
  "name": "cancel_order",
  "arguments": {
    "orderId": "ord_003",
    "reason": "Changed my mind"
  }
}
```

**Notes:**
- Cannot cancel delivered or already cancelled orders
- Refund is automatically initiated for paid orders

---

### update_order_status

Update order status with validation.

```json
{
  "name": "update_order_status",
  "arguments": {
    "orderId": "ord_003",
    "status": "confirmed",
    "note": "Order confirmed by restaurant"
  }
}
```

**Valid Status Transitions:**
| From | To |
|------|-----|
| pending | confirmed, cancelled |
| confirmed | processing, cancelled |
| processing | shipped, cancelled |
| shipped | delivered, cancelled |
| delivered | refunded |
| cancelled | (none) |

---

### get_order_analytics

Get order analytics and metrics.

```json
{
  "name": "get_order_analytics",
  "arguments": {
    "period": "month",
    "merchantId": "merch_001"
  }
}
```

**Returns:**
- Total orders, revenue, and average order value
- Breakdown by status and payment method
- Daily order trends
- Hourly order distribution
- Top products and merchants
- Customer and merchant counts

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| period | string | Time period: today, week, month, quarter, year |
| merchantId | string | Filter by merchant |
| userId | string | Filter by user |

## Response Format

All tools return responses in this format:

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
```

On error:
```json
{
  "success": false,
  "error": "Error description"
}
```

## Example Usage with MCP Client

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

const client = new Client({
  name: "order-admin",
  version: "1.0.0",
});

await client.connectTo("npx", ["-y", "rez-mcp-order"]);

// List all delivered orders
const orders = await client.callTool({
  name: "list_orders",
  arguments: { status: "delivered", limit: 10 },
});

// Get specific order
const order = await client.callTool({
  name: "get_order",
  arguments: { orderId: "ord_001" },
});

// Cancel an order
const result = await client.callTool({
  name: "cancel_order",
  arguments: { orderId: "ord_003", reason: "Customer request" },
});

// Get analytics
const analytics = await client.callTool({
  name: "get_order_analytics",
  arguments: { period: "month" },
});
```

## Mock Data

The server includes 5 sample orders for testing:

| Order ID | Order Number | Status | Merchant |
|----------|-------------|--------|----------|
| ord_001 | REZ-2026-0515001 | delivered | Spice Garden Restaurant |
| ord_002 | REZ-2026-0512002 | shipped | Urban Fitness Store |
| ord_003 | REZ-2026-0514003 | processing | Spice Garden Restaurant |
| ord_004 | REZ-2026-0513004 | cancelled | TechZone Electronics |
| ord_005 | REZ-2026-0515005 | pending | Fresh Grocery Mart |

## Architecture

```
rez-mcp-order/
├── src/
│   └── index.ts          # MCP server implementation
├── dist/                  # Compiled output
├── package.json
├── tsconfig.json
└── README.md
```

The server uses:
- **@modelcontextprotocol/sdk**: MCP protocol implementation
- **zod**: Request validation
- **TypeScript**: Type safety

## License

Internal use only - RABTUL Technologies
