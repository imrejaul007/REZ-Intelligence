#!/usr/bin/env node

import { logger } from './utils/logger.js';

import 'dotenv/config';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Environment configuration
const INVENTORY_SERVICE_URL = process.env.INVENTORY_SERVICE_URL || 'http://localhost:4010';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';
const USE_REAL_API = process.env.USE_REAL_INVENTORY === 'true';

// Real API helper
async function fetchFromInventoryService<T>(endpoint: string, options?: RequestInit): Promise<T | null> {
  if (!USE_REAL_API) return null;

  try {
    const response = await fetch(`${INVENTORY_SERVICE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': INTERNAL_SERVICE_TOKEN,
        ...options?.headers
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json() as T;
  } catch (error) {
    console.error(`Inventory Service API error (${endpoint}):`, error);
    return null;
  }
}

// Types
interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  warehouse: string;
  lastUpdated: string;
}

interface StockAlert {
  id: string;
  productId: string;
  productName: string;
  type: "low_stock" | "out_of_stock" | "overstock";
  currentQuantity: number;
  threshold: number;
  severity: "warning" | "critical" | "info";
  createdAt: string;
  acknowledged: boolean;
}

interface StockHistoryEntry {
  id: string;
  productId: string;
  change: number;
  previousQuantity: number;
  newQuantity: number;
  reason: string;
  timestamp: string;
  userId?: string;
}

// Mock Data
const mockInventory: InventoryItem[] = [
  {
    id: "inv-001",
    productId: "prod-123",
    productName: "Organic Coffee Beans - Dark Roast",
    sku: "COF-DRK-500",
    quantity: 150,
    reserved: 25,
    available: 125,
    lowStockThreshold: 50,
    warehouse: "WH-MUM-01",
    lastUpdated: "2026-05-15T10:30:00Z",
  },
  {
    id: "inv-002",
    productId: "prod-124",
    productName: "Green Tea - Premium Matcha",
    sku: "TEA-MAT-100",
    quantity: 45,
    reserved: 10,
    available: 35,
    lowStockThreshold: 30,
    warehouse: "WH-MUM-01",
    lastUpdated: "2026-05-15T09:15:00Z",
  },
  {
    id: "inv-003",
    productId: "prod-125",
    productName: "Protein Bar - Chocolate",
    sku: "PRO-CHOC-12",
    quantity: 8,
    reserved: 3,
    available: 5,
    lowStockThreshold: 20,
    warehouse: "WH-DEL-01",
    lastUpdated: "2026-05-15T11:00:00Z",
  },
  {
    id: "inv-004",
    productId: "prod-126",
    productName: "Almond Butter - Raw",
    sku: "NUT-ALM-340",
    quantity: 200,
    reserved: 50,
    available: 150,
    lowStockThreshold: 75,
    warehouse: "WH-BAN-01",
    lastUpdated: "2026-05-15T08:45:00Z",
  },
  {
    id: "inv-005",
    productId: "prod-127",
    productName: "Coconut Water - Organic",
    sku: "DRK-COC-330",
    quantity: 0,
    reserved: 0,
    available: 0,
    lowStockThreshold: 100,
    warehouse: "WH-MUM-01",
    lastUpdated: "2026-05-14T16:20:00Z",
  },
  {
    id: "inv-006",
    productId: "prod-128",
    productName: "Quinoa - Tri-color",
    sku: "GRN-QUI-500",
    quantity: 320,
    reserved: 80,
    available: 240,
    lowStockThreshold: 100,
    warehouse: "WH-DEL-01",
    lastUpdated: "2026-05-15T07:30:00Z",
  },
  {
    id: "inv-007",
    productId: "prod-129",
    productName: "Honey - Raw Manuka",
    sku: "SWE-HON-250",
    quantity: 15,
    reserved: 5,
    available: 10,
    lowStockThreshold: 25,
    warehouse: "WH-MUM-01",
    lastUpdated: "2026-05-15T12:00:00Z",
  },
  {
    id: "inv-008",
    productId: "prod-130",
    productName: "Olive Oil - Extra Virgin",
    sku: "OIL-OLV-500",
    quantity: 85,
    reserved: 15,
    available: 70,
    lowStockThreshold: 40,
    warehouse: "WH-BAN-01",
    lastUpdated: "2026-05-15T06:15:00Z",
  },
];

const mockAlerts: StockAlert[] = [
  {
    id: "alert-001",
    productId: "prod-123",
    productName: "Organic Coffee Beans - Dark Roast",
    type: "low_stock",
    currentQuantity: 150,
    threshold: 50,
    severity: "info",
    createdAt: "2026-05-15T10:30:00Z",
    acknowledged: false,
  },
  {
    id: "alert-002",
    productId: "prod-124",
    productName: "Green Tea - Premium Matcha",
    type: "low_stock",
    currentQuantity: 45,
    threshold: 30,
    severity: "warning",
    createdAt: "2026-05-15T09:15:00Z",
    acknowledged: false,
  },
  {
    id: "alert-003",
    productId: "prod-125",
    productName: "Protein Bar - Chocolate",
    type: "low_stock",
    currentQuantity: 8,
    threshold: 20,
    severity: "critical",
    createdAt: "2026-05-15T11:00:00Z",
    acknowledged: false,
  },
  {
    id: "alert-004",
    productId: "prod-127",
    productName: "Coconut Water - Organic",
    type: "out_of_stock",
    currentQuantity: 0,
    threshold: 100,
    severity: "critical",
    createdAt: "2026-05-14T16:20:00Z",
    acknowledged: false,
  },
  {
    id: "alert-005",
    productId: "prod-129",
    productName: "Honey - Raw Manuka",
    type: "low_stock",
    currentQuantity: 15,
    threshold: 25,
    severity: "warning",
    createdAt: "2026-05-15T12:00:00Z",
    acknowledged: false,
  },
];

const mockStockHistory: StockHistoryEntry[] = [
  {
    id: "hist-001",
    productId: "prod-123",
    change: -50,
    previousQuantity: 200,
    newQuantity: 150,
    reason: "Order fulfillment - Order #ORD-7892",
    timestamp: "2026-05-15T10:30:00Z",
    userId: "system",
  },
  {
    id: "hist-002",
    productId: "prod-124",
    change: -15,
    previousQuantity: 60,
    newQuantity: 45,
    reason: "Order fulfillment - Order #ORD-7891",
    timestamp: "2026-05-15T09:15:00Z",
    userId: "system",
  },
  {
    id: "hist-003",
    productId: "prod-125",
    change: -12,
    previousQuantity: 20,
    newQuantity: 8,
    reason: "Order fulfillment - Order #ORD-7890",
    timestamp: "2026-05-15T11:00:00Z",
    userId: "system",
  },
  {
    id: "hist-004",
    productId: "prod-127",
    change: -100,
    previousQuantity: 100,
    newQuantity: 0,
    reason: "Manual adjustment - Stock count",
    timestamp: "2026-05-14T16:20:00Z",
    userId: "usr-456",
  },
  {
    id: "hist-005",
    productId: "prod-129",
    change: -10,
    previousQuantity: 25,
    newQuantity: 15,
    reason: "Order fulfillment - Order #ORD-7889",
    timestamp: "2026-05-15T12:00:00Z",
    userId: "system",
  },
  {
    id: "hist-006",
    productId: "prod-130",
    change: 50,
    previousQuantity: 35,
    newQuantity: 85,
    reason: "Restock - Purchase Order #PO-234",
    timestamp: "2026-05-15T06:15:00Z",
    userId: "usr-123",
  },
  {
    id: "hist-007",
    productId: "prod-126",
    change: -30,
    previousQuantity: 230,
    newQuantity: 200,
    reason: "Order fulfillment - Order #ORD-7888",
    timestamp: "2026-05-15T08:45:00Z",
    userId: "system",
  },
];

// Helper functions
function checkStock(items: InventoryItem[], productId?: string, sku?: string, merchantId?: string): InventoryItem[] {
  return items.filter((item) => {
    if (productId && item.productId !== productId) return false;
    if (sku && item.sku.toLowerCase() !== sku.toLowerCase()) return false;
    return true;
  });
}

function getLowStockItems(items: InventoryItem[], threshold?: number): InventoryItem[] {
  return items.filter((item) => {
    if (threshold !== undefined) {
      return item.available <= threshold;
    }
    return item.available <= item.lowStockThreshold;
  });
}

function getAvailableAlerts(alerts: StockAlert[], severity?: string): StockAlert[] {
  return alerts.filter((alert) => {
    if (!alert.acknowledged) {
      if (severity) {
        return alert.severity === severity;
      }
      return true;
    }
    return false;
  });
}

function getStockHistory(
  history: StockHistoryEntry[],
  productId?: string,
  limit: number = 50
): StockHistoryEntry[] {
  let filtered = history;
  if (productId) {
    filtered = history.filter((h) => h.productId === productId);
  }
  return filtered.slice(-limit).reverse();
}

function updateItemStock(
  items: InventoryItem[],
  productId: string,
  quantityChange: number,
  reason: string
): { success: boolean; item?: InventoryItem; history?: StockHistoryEntry } {
  const item = items.find((i) => i.productId === productId);
  if (!item) {
    return { success: false };
  }

  const newQuantity = item.quantity + quantityChange;
  if (newQuantity < 0) {
    return { success: false };
  }

  item.quantity = newQuantity;
  item.available = newQuantity - item.reserved;
  item.lastUpdated = new Date().toISOString();

  const historyEntry: StockHistoryEntry = {
    id: `hist-${Date.now()}`,
    productId,
    change: quantityChange,
    previousQuantity: newQuantity - quantityChange,
    newQuantity,
    reason,
    timestamp: item.lastUpdated,
    userId: "mcp-client",
  };

  mockStockHistory.push(historyEntry);

  return { success: true, item, history: historyEntry };
}

// Create server instance
const server = new Server(
  {
    name: "rez-inventory-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definitions
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "check_stock",
        description: "Check stock levels for a specific product or SKU. Returns current quantity, available stock, and warehouse information.",
        inputSchema: {
          type: "object",
          properties: {
            product_id: {
              type: "string",
              description: "Product ID to check stock for",
            },
            sku: {
              type: "string",
              description: "SKU code to check stock for",
            },
            merchant_id: {
              type: "string",
              description: "Merchant ID to filter by",
            },
          },
        },
      },
      {
        name: "get_inventory",
        description: "Get the complete inventory list for a merchant or warehouse. Returns all inventory items with stock levels.",
        inputSchema: {
          type: "object",
          properties: {
            merchant_id: {
              type: "string",
              description: "Merchant ID to get inventory for",
            },
            warehouse: {
              type: "string",
              description: "Warehouse code to filter by (e.g., WH-MUM-01)",
            },
            include_reserved: {
              type: "boolean",
              description: "Include reserved quantities in response",
              default: false,
            },
          },
        },
      },
      {
        name: "get_low_stock_items",
        description: "Get all items that are below their low stock threshold. Useful for identifying items that need reordering.",
        inputSchema: {
          type: "object",
          properties: {
            threshold: {
              type: "number",
              description: "Custom threshold to override product thresholds",
            },
            severity: {
              type: "string",
              enum: ["all", "warning", "critical"],
              description: "Filter by severity level",
              default: "all",
            },
          },
        },
      },
      {
        name: "update_stock",
        description: "Update the stock quantity for a product. Use positive values to add stock, negative to reduce.",
        inputSchema: {
          type: "object",
          properties: {
            product_id: {
              type: "string",
              description: "Product ID to update",
            },
            quantity_change: {
              type: "number",
              description: "Quantity to add (positive) or remove (negative)",
            },
            reason: {
              type: "string",
              description: "Reason for the stock change (e.g., 'Restock', 'Return', 'Adjustment')",
            },
          },
          required: ["product_id", "quantity_change", "reason"],
        },
      },
      {
        name: "get_stock_history",
        description: "Get the stock change history for a product or all recent changes.",
        inputSchema: {
          type: "object",
          properties: {
            product_id: {
              type: "string",
              description: "Product ID to get history for",
            },
            limit: {
              type: "number",
              description: "Maximum number of entries to return",
              default: 50,
            },
          },
        },
      },
      {
        name: "sync_inventory",
        description: "Trigger an inventory sync with external systems (Shopify, WooCommerce, etc.)",
        inputSchema: {
          type: "object",
          properties: {
            source: {
              type: "string",
              enum: ["shopify", "woocommerce", "all"],
              description: "Source to sync from",
              default: "all",
            },
            full_sync: {
              type: "boolean",
              description: "Perform a full sync instead of incremental",
              default: false,
            },
          },
        },
      },
      {
        name: "get_stock_alerts",
        description: "Get active stock alerts including low stock, out of stock, and overstock warnings.",
        inputSchema: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["all", "low_stock", "out_of_stock", "overstock"],
              description: "Filter by alert type",
              default: "all",
            },
            severity: {
              type: "string",
              enum: ["all", "warning", "critical", "info"],
              description: "Filter by severity",
              default: "all",
            },
            acknowledged: {
              type: "boolean",
              description: "Include acknowledged alerts",
              default: false,
            },
          },
        },
      },
    ],
  };
});

// Tool handlers
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "check_stock": {
        const { product_id, sku, merchant_id } = args as {
          product_id?: string;
          sku?: string;
          merchant_id?: string;
        };

        if (!product_id && !sku) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    error: "Either product_id or sku is required",
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        const results = checkStock(mockInventory, product_id, sku, merchant_id);

        if (results.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    message: "No stock found for the specified criteria",
                    product_id,
                    sku,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  count: results.length,
                  data: results,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_inventory": {
        const { merchant_id, warehouse, include_reserved } = args as {
          merchant_id?: string;
          warehouse?: string;
          include_reserved?: boolean;
        };

        let results = [...mockInventory];

        if (warehouse) {
          results = results.filter((item) => item.warehouse === warehouse);
        }

        const response = results.map((item) => {
          if (include_reserved) {
            return item;
          }
          const { reserved, ...rest } = item;
          return rest;
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  count: response.length,
                  total_items: results.reduce((sum, item) => sum + item.quantity, 0),
                  total_available: results.reduce((sum, item) => sum + item.available, 0),
                  data: response,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_low_stock_items": {
        const { threshold, severity } = args as {
          threshold?: number;
          severity?: string;
        };

        let lowStockItems = getLowStockItems(mockInventory, threshold);

        if (severity && severity !== "all") {
          const severityMap: Record<string, number> = {
            critical: 1,
            warning: 2,
            info: 3,
          };
          const targetLevel = severityMap[severity] ?? 0;

          lowStockItems = lowStockItems.filter((item) => {
            const critical = item.available <= item.lowStockThreshold * 0.25;
            const warning =
              item.available > item.lowStockThreshold * 0.25 &&
              item.available <= item.lowStockThreshold * 0.5;
            const info = item.available > item.lowStockThreshold * 0.5;

            const itemLevel = critical ? 1 : warning ? 2 : 3;
            return itemLevel <= targetLevel;
          });
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  count: lowStockItems.length,
                  critical_count: lowStockItems.filter(
                    (item) => item.available <= item.lowStockThreshold * 0.25
                  ).length,
                  warning_count: lowStockItems.filter(
                    (item) =>
                      item.available > item.lowStockThreshold * 0.25 &&
                      item.available <= item.lowStockThreshold * 0.5
                  ).length,
                  data: lowStockItems,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "update_stock": {
        const { product_id, quantity_change, reason } = args as {
          product_id: string;
          quantity_change: number;
          reason: string;
        };

        if (!product_id || quantity_change === undefined || !reason) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    error: "product_id, quantity_change, and reason are required",
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        const result = updateItemStock(mockInventory, product_id, quantity_change, reason);

        if (!result.success) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    error: "Failed to update stock. Product may not exist or quantity would go negative.",
                    product_id,
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: "Stock updated successfully",
                  item: result.item,
                  history: result.history,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_stock_history": {
        const { product_id, limit } = args as {
          product_id?: string;
          limit?: number;
        };

        const history = getStockHistory(mockStockHistory, product_id, limit ?? 50);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  count: history.length,
                  data: history,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "sync_inventory": {
        const { source, full_sync } = args as {
          source?: string;
          full_sync?: boolean;
        };

        // Simulate sync operation
        const syncResult = {
          success: true,
          message: `Inventory sync${full_sync ? " (full)" : " (incremental)"} triggered for ${source || "all sources"}`,
          sync_id: `sync-${Date.now()}`,
          started_at: new Date().toISOString(),
          estimated_duration: full_sync ? "5-10 minutes" : "30-60 seconds",
          sources: source === "all" || !source
            ? ["shopify", "woocommerce", "local"]
            : [source],
          status: "in_progress",
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(syncResult, null, 2),
            },
          ],
        };
      }

      case "get_stock_alerts": {
        const { type, severity, acknowledged } = args as {
          type?: string;
          severity?: string;
          acknowledged?: boolean;
        };

        let alerts = [...mockAlerts];

        if (!acknowledged) {
          alerts = alerts.filter((a) => !a.acknowledged);
        }

        if (type && type !== "all") {
          alerts = alerts.filter((a) => a.type === type);
        }

        if (severity && severity !== "all") {
          alerts = alerts.filter((a) => a.severity === severity);
        }

        const summary = {
          total: alerts.length,
          critical: alerts.filter((a) => a.severity === "critical").length,
          warning: alerts.filter((a) => a.severity === "warning").length,
          info: alerts.filter((a) => a.severity === "info").length,
          out_of_stock: alerts.filter((a) => a.type === "out_of_stock").length,
          low_stock: alerts.filter((a) => a.type === "low_stock").length,
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  summary,
                  data: alerts,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: `Unknown tool: ${name}` }, null, 2),
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: "Internal server error",
              message: error instanceof Error ? error.message : "Unknown error",
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  logger.error("REZ Inventory MCP Server started");
  logger.error(`Inventory Service URL: ${INVENTORY_SERVICE_URL}`);
  logger.error(`Real API: ${USE_REAL_API ? 'ENABLED' : 'DISABLED (set USE_REAL_INVENTORY=true to enable)'}`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
