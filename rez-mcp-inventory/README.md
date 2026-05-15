# REZ Inventory Checker MCP Server

A Model Context Protocol (MCP) server for REZ inventory management. Provides tools for checking stock levels, managing inventory, and monitoring stock alerts.

## Features

- Check stock levels for products by ID or SKU
- Get complete inventory lists by merchant or warehouse
- Monitor low stock items with customizable thresholds
- Update stock quantities with full audit trail
- View stock change history
- Trigger inventory sync with external systems
- Get active stock alerts (low stock, out of stock, overstock)

## Installation

```bash
cd rez-mcp-inventory
npm install
npm run build
```

## Development

```bash
# Run in development mode with hot reload
npm run dev

# Build for production
npm run build

# Run production server
npm start
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `INVENTORY_SERVICE_URL` | URL of the REZ Inventory Service | No (uses mock data if not set) |

## Available Tools

### check_stock
Check stock levels for a specific product or SKU.

```typescript
{
  product_id?: string;    // Product ID to check
  sku?: string;           // SKU code to check
  merchant_id?: string;   // Filter by merchant
}
```

### get_inventory
Get the complete inventory list for a merchant or warehouse.

```typescript
{
  merchant_id?: string;        // Merchant ID
  warehouse?: string;          // Warehouse code (e.g., WH-MUM-01)
  include_reserved?: boolean;  // Include reserved quantities
}
```

### get_low_stock_items
Get all items below their low stock threshold.

```typescript
{
  threshold?: number;          // Custom threshold override
  severity?: "all" | "warning" | "critical";  // Filter by severity
}
```

### update_stock
Update stock quantity for a product.

```typescript
{
  product_id: string;         // Product ID (required)
  quantity_change: number;    // Positive to add, negative to reduce
  reason: string;             // Reason for change (required)
}
```

### get_stock_history
Get stock change history.

```typescript
{
  product_id?: string;        // Filter by product
  limit?: number;             // Max entries (default: 50)
}
```

### sync_inventory
Trigger inventory sync with external systems.

```typescript
{
  source?: "shopify" | "woocommerce" | "all";
  full_sync?: boolean;        // Full sync vs incremental
}
```

### get_stock_alerts
Get active stock alerts.

```typescript
{
  type?: "all" | "low_stock" | "out_of_stock" | "overstock";
  severity?: "all" | "warning" | "critical" | "info";
  acknowledged?: boolean;      // Include acknowledged alerts
}
```

## Usage with Claude

Add to your MCP settings:

```json
{
  "mcpServers": {
    "rez-inventory": {
      "command": "node",
      "args": ["/path/to/rez-mcp-inventory/dist/index.js"],
      "env": {
        "INVENTORY_SERVICE_URL": "https://rez-inventory-service.onrender.com"
      }
    }
  }
}
```

## Mock Data

The server includes realistic mock data for testing:

- 8 inventory items across 3 warehouses (Mumbai, Delhi, Bangalore)
- Stock alerts for low stock and out of stock items
- Stock history with various change types

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    MCP Client (Claude)                  │
└─────────────────────────┬───────────────────────────────┘
                          │ JSON-RPC over stdio
┌─────────────────────────▼───────────────────────────────┐
│              REZ Inventory MCP Server                   │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Tool Handlers                       │    │
│  │  • check_stock     • get_inventory              │    │
│  │  • get_low_stock   • update_stock               │    │
│  │  • get_history     • sync_inventory             │    │
│  │  • get_alerts                                 │    │
│  └─────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │         Service Layer                           │    │
│  │  • Business logic & validation                  │    │
│  │  • Data transformation                          │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────┬───────────────────────────────┘
                          │
              ┌───────────▼───────────┐
              │   REZ Inventory API   │
              │   (when INVENTORY_     │
              │    SERVICE_URL set)   │
              └───────────────────────┘
```

## License

Internal use only - REZ Platform
