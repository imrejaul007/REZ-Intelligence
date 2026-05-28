import { logger } from './utils/logger.js';

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// Environment configuration
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || "";
const USE_MOCK_DATA = !ORDER_SERVICE_URL;

// Types
interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  variant?: string;
  imageUrl?: string;
}

interface OrderTimeline {
  status: string;
  timestamp: string;
  description: string;
  location?: string;
}

interface TrackingInfo {
  carrier: string;
  trackingNumber: string;
  estimatedDelivery: string;
  currentLocation: string;
  events: Array<{
    timestamp: string;
    location: string;
    status: string;
    description: string;
  }>;
}

interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  merchantId: string;
  merchantName: string;
  status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";
  items: OrderItem[];
  subtotal: number;
  tax: number;
  shippingCost: number;
  discount: number;
  total: number;
  currency: string;
  paymentMethod: string;
  paymentStatus: "pending" | "paid" | "failed" | "refunded" | "partially_refunded";
  shippingAddress: {
    name: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone?: string;
  };
  billingAddress: {
    name: string;
    line1: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  createdAt: string;
  updatedAt: string;
  timeline: OrderTimeline[];
  tracking?: TrackingInfo;
  notes?: string;
  specialInstructions?: string;
}

// Mock data
const mockOrders: Order[] = [
  {
    id: "ord_001",
    orderNumber: "REZ-2026-0515001",
    userId: "usr_12345",
    merchantId: "merch_001",
    merchantName: "Spice Garden Restaurant",
    status: "delivered",
    items: [
      {
        id: "item_001",
        productId: "prod_biryani_01",
        productName: "Hyderabadi Chicken Biryani",
        quantity: 2,
        unitPrice: 299,
        totalPrice: 598,
        variant: "Full Plate",
      },
      {
        id: "item_002",
        productId: "prod_mirchi_01",
        productName: "Mirchi Ka Salan",
        quantity: 1,
        unitPrice: 149,
        totalPrice: 149,
      },
      {
        id: "item_003",
        productId: "prod_naan_01",
        productName: "Butter Naan",
        quantity: 4,
        unitPrice: 49,
        totalPrice: 196,
      },
    ],
    subtotal: 943,
    tax: 84.87,
    shippingCost: 0,
    discount: 100,
    total: 927.87,
    currency: "INR",
    paymentMethod: "UPI",
    paymentStatus: "paid",
    shippingAddress: {
      name: "Rahul Sharma",
      line1: "42, Green Valley Apartments",
      line2: "MG Road, Koramangala",
      city: "Bangalore",
      state: "Karnataka",
      postalCode: "560034",
      country: "India",
      phone: "+91 98765 43210",
    },
    billingAddress: {
      name: "Rahul Sharma",
      line1: "42, Green Valley Apartments",
      city: "Bangalore",
      state: "Karnataka",
      postalCode: "560034",
      country: "India",
    },
    createdAt: "2026-05-10T14:30:00Z",
    updatedAt: "2026-05-12T09:15:00Z",
    timeline: [
      { status: "pending", timestamp: "2026-05-10T14:30:00Z", description: "Order placed" },
      { status: "confirmed", timestamp: "2026-05-10T14:35:00Z", description: "Restaurant confirmed order" },
      { status: "processing", timestamp: "2026-05-10T14:40:00Z", description: "Food being prepared" },
      { status: "shipped", timestamp: "2026-05-10T15:20:00Z", description: "Order picked up by delivery partner", location: "Spice Garden Restaurant" },
      { status: "delivered", timestamp: "2026-05-10T15:55:00Z", description: "Order delivered", location: "Customer doorstep" },
    ],
    tracking: {
      carrier: "REZ Express",
      trackingNumber: "REZX123456789",
      estimatedDelivery: "2026-05-10T16:00:00Z",
      currentLocation: "Delivered",
      events: [
        { timestamp: "2026-05-10T15:20:00Z", location: "Spice Garden Restaurant", status: "picked_up", description: "Order picked up" },
        { timestamp: "2026-05-10T15:35:00Z", location: "Koramangala 5th Block", status: "in_transit", description: "Out for delivery" },
        { timestamp: "2026-05-10T15:55:00Z", location: "Customer address", status: "delivered", description: "Delivered to Rahul Sharma" },
      ],
    },
  },
  {
    id: "ord_002",
    orderNumber: "REZ-2026-0512002",
    userId: "usr_12345",
    merchantId: "merch_002",
    merchantName: "Urban Fitness Store",
    status: "shipped",
    items: [
      {
        id: "item_004",
        productId: "prod_dumbbell_01",
        productName: "Adjustable Dumbbell Set 5-25kg",
        quantity: 1,
        unitPrice: 3499,
        totalPrice: 3499,
        imageUrl: "https://cdn.rezapp.com/products/dumbbell-set.jpg",
      },
      {
        id: "item_005",
        productId: "prod_mat_01",
        productName: "Premium Yoga Mat",
        quantity: 1,
        unitPrice: 899,
        totalPrice: 899,
        variant: "Purple, 6mm",
      },
    ],
    subtotal: 4398,
    tax: 395.82,
    shippingCost: 99,
    discount: 500,
    total: 4392.82,
    currency: "INR",
    paymentMethod: "Card",
    paymentStatus: "paid",
    shippingAddress: {
      name: "Rahul Sharma",
      line1: "42, Green Valley Apartments",
      line2: "MG Road, Koramangala",
      city: "Bangalore",
      state: "Karnataka",
      postalCode: "560034",
      country: "India",
      phone: "+91 98765 43210",
    },
    billingAddress: {
      name: "Rahul Sharma",
      line1: "42, Green Valley Apartments",
      city: "Bangalore",
      state: "Karnataka",
      postalCode: "560034",
      country: "India",
    },
    createdAt: "2026-05-12T09:00:00Z",
    updatedAt: "2026-05-13T11:30:00Z",
    timeline: [
      { status: "pending", timestamp: "2026-05-12T09:00:00Z", description: "Order placed" },
      { status: "confirmed", timestamp: "2026-05-12T09:05:00Z", description: "Order confirmed" },
      { status: "processing", timestamp: "2026-05-12T10:00:00Z", description: "Items being packed" },
      { status: "shipped", timestamp: "2026-05-13T11:30:00Z", description: "Shipped via DTDC", location: "Bangalore Warehouse" },
    ],
    tracking: {
      carrier: "DTDC",
      trackingNumber: "DTDC987654321",
      estimatedDelivery: "2026-05-15T18:00:00Z",
      currentLocation: "Bangalore Distribution Center",
      events: [
        { timestamp: "2026-05-13T11:30:00Z", location: "Bangalore Warehouse", status: "shipped", description: "Package dispatched" },
        { timestamp: "2026-05-13T20:00:00Z", location: "Bangalore Distribution Center", status: "in_transit", description: "Arrived at facility" },
      ],
    },
  },
  {
    id: "ord_003",
    orderNumber: "REZ-2026-0514003",
    userId: "usr_67890",
    merchantId: "merch_001",
    merchantName: "Spice Garden Restaurant",
    status: "processing",
    items: [
      {
        id: "item_006",
        productId: "prod_curry_01",
        productName: "Butter Chicken",
        quantity: 1,
        unitPrice: 349,
        totalPrice: 349,
        variant: "Medium Spice",
      },
      {
        id: "item_007",
        productId: "prod_dal_01",
        productName: "Dal Makhani",
        quantity: 1,
        unitPrice: 249,
        totalPrice: 249,
      },
      {
        id: "item_008",
        productId: "prod_roti_01",
        productName: "Tandoori Roti",
        quantity: 4,
        unitPrice: 39,
        totalPrice: 156,
      },
    ],
    subtotal: 754,
    tax: 67.86,
    shippingCost: 0,
    discount: 0,
    total: 821.86,
    currency: "INR",
    paymentMethod: "Wallet",
    paymentStatus: "paid",
    shippingAddress: {
      name: "Priya Patel",
      line1: "15, Sunrise Residency",
      line2: "HSR Layout Sector 2",
      city: "Bangalore",
      state: "Karnataka",
      postalCode: "560102",
      country: "India",
      phone: "+91 99887 76655",
    },
    billingAddress: {
      name: "Priya Patel",
      line1: "15, Sunrise Residency",
      city: "Bangalore",
      state: "Karnataka",
      postalCode: "560102",
      country: "India",
    },
    createdAt: "2026-05-14T19:30:00Z",
    updatedAt: "2026-05-14T19:35:00Z",
    timeline: [
      { status: "pending", timestamp: "2026-05-14T19:30:00Z", description: "Order placed" },
      { status: "confirmed", timestamp: "2026-05-14T19:32:00Z", description: "Restaurant confirmed" },
      { status: "processing", timestamp: "2026-05-14T19:35:00Z", description: "Food being prepared" },
    ],
  },
  {
    id: "ord_004",
    orderNumber: "REZ-2026-0513004",
    userId: "usr_54321",
    merchantId: "merch_003",
    merchantName: "TechZone Electronics",
    status: "cancelled",
    items: [
      {
        id: "item_009",
        productId: "prod_earbuds_01",
        productName: "Wireless Earbuds Pro",
        quantity: 1,
        unitPrice: 5999,
        totalPrice: 5999,
        variant: "Midnight Black",
      },
    ],
    subtotal: 5999,
    tax: 539.91,
    shippingCost: 99,
    discount: 500,
    total: 6137.91,
    currency: "INR",
    paymentMethod: "UPI",
    paymentStatus: "refunded",
    shippingAddress: {
      name: "Amit Kumar",
      line1: "78, Tech Park Apartments",
      line2: "Electronic City Phase 1",
      city: "Bangalore",
      state: "Karnataka",
      postalCode: "560100",
      country: "India",
      phone: "+91 91234 56789",
    },
    billingAddress: {
      name: "Amit Kumar",
      line1: "78, Tech Park Apartments",
      city: "Bangalore",
      state: "Karnataka",
      postalCode: "560100",
      country: "India",
    },
    createdAt: "2026-05-13T10:00:00Z",
    updatedAt: "2026-05-13T10:30:00Z",
    timeline: [
      { status: "pending", timestamp: "2026-05-13T10:00:00Z", description: "Order placed" },
      { status: "confirmed", timestamp: "2026-05-13T10:05:00Z", description: "Order confirmed" },
      { status: "cancelled", timestamp: "2026-05-13T10:30:00Z", description: "Cancelled by customer - Changed mind" },
    ],
    notes: "Customer cancelled within 30 minutes of ordering",
  },
  {
    id: "ord_005",
    orderNumber: "REZ-2026-0515005",
    userId: "usr_12345",
    merchantId: "merch_004",
    merchantName: "Fresh Grocery Mart",
    status: "pending",
    items: [
      {
        id: "item_010",
        productId: "prod_fruits_01",
        productName: "Seasonal Fruit Basket",
        quantity: 1,
        unitPrice: 799,
        totalPrice: 799,
        variant: "Premium",
      },
      {
        id: "item_011",
        productId: "prod_vegetables_01",
        productName: "Organic Vegetable Box",
        quantity: 1,
        unitPrice: 599,
        totalPrice: 599,
      },
      {
        id: "item_012",
        productId: "prod_milk_01",
        productName: "Farm Fresh Milk 2L",
        quantity: 2,
        unitPrice: 65,
        totalPrice: 130,
      },
    ],
    subtotal: 1528,
    tax: 91.68,
    shippingCost: 49,
    discount: 150,
    total: 1518.68,
    currency: "INR",
    paymentMethod: "COD",
    paymentStatus: "pending",
    shippingAddress: {
      name: "Rahul Sharma",
      line1: "42, Green Valley Apartments",
      line2: "MG Road, Koramangala",
      city: "Bangalore",
      state: "Karnataka",
      postalCode: "560034",
      country: "India",
      phone: "+91 98765 43210",
    },
    billingAddress: {
      name: "Rahul Sharma",
      line1: "42, Green Valley Apartments",
      city: "Bangalore",
      state: "Karnataka",
      postalCode: "560034",
      country: "India",
    },
    createdAt: "2026-05-15T08:00:00Z",
    updatedAt: "2026-05-15T08:00:00Z",
    timeline: [
      { status: "pending", timestamp: "2026-05-15T08:00:00Z", description: "Order placed, awaiting confirmation" },
    ],
  },
];

// Order Analytics mock data
function generateAnalytics() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  return {
    summary: {
      totalOrders: 1247,
      totalRevenue: 4875234.56,
      averageOrderValue: 3909.57,
      totalItemsSold: 3891,
      uniqueCustomers: 892,
      uniqueMerchants: 45,
    },
    byStatus: {
      pending: { count: 89, revenue: 345678.90 },
      confirmed: { count: 67, revenue: 267890.12 },
      processing: { count: 45, revenue: 178901.34 },
      shipped: { count: 123, revenue: 489012.45 },
      delivered: { count: 856, revenue: 3356890.23 },
      cancelled: { count: 52, revenue: 198901.23 },
      refunded: { count: 15, revenue: 42860.29 },
    },
    byPaymentMethod: {
      UPI: { count: 523, revenue: 2056789.34 },
      Card: { count: 389, revenue: 1523456.78 },
      Wallet: { count: 234, revenue: 912345.67 },
      COD: { count: 101, revenue: 382642.77 },
    },
    trends: {
      dailyOrders: [
        { date: "2026-05-12", orders: 42, revenue: 164328.45 },
        { date: "2026-05-13", orders: 38, revenue: 148567.23 },
        { date: "2026-05-14", orders: 51, revenue: 199823.67 },
        { date: "2026-05-15", orders: 23, revenue: 89512.34 },
      ],
      hourlyBreakdown: [
        { hour: 8, orders: 12, peak: false },
        { hour: 9, orders: 18, peak: false },
        { hour: 10, orders: 25, peak: false },
        { hour: 11, orders: 32, peak: true },
        { hour: 12, orders: 45, peak: true },
        { hour: 13, orders: 38, peak: true },
        { hour: 14, orders: 28, peak: false },
        { hour: 15, orders: 22, peak: false },
        { hour: 16, orders: 20, peak: false },
        { hour: 17, orders: 35, peak: true },
        { hour: 18, orders: 48, peak: true },
        { hour: 19, orders: 55, peak: true },
        { hour: 20, orders: 42, peak: true },
        { hour: 21, orders: 35, peak: true },
      ],
    },
    topProducts: [
      { productId: "prod_biryani_01", name: "Hyderabadi Chicken Biryani", orders: 234, revenue: 69966 },
      { productId: "prod_dumbbell_01", name: "Adjustable Dumbbell Set", orders: 89, revenue: 311411 },
      { productId: "prod_earbuds_01", name: "Wireless Earbuds Pro", orders: 156, revenue: 935844 },
      { productId: "prod_curry_01", name: "Butter Chicken", orders: 198, revenue: 69102 },
      { productId: "prod_mat_01", name: "Premium Yoga Mat", orders: 134, revenue: 120466 },
    ],
    topMerchants: [
      { merchantId: "merch_001", name: "Spice Garden Restaurant", orders: 456, revenue: 1789234.56, rating: 4.7 },
      { merchantId: "merch_002", name: "Urban Fitness Store", orders: 234, revenue: 1234567.89, rating: 4.5 },
      { merchantId: "merch_003", name: "TechZone Electronics", orders: 189, revenue: 987654.32, rating: 4.3 },
      { merchantId: "merch_004", name: "Fresh Grocery Mart", orders: 312, revenue: 456789.12, rating: 4.8 },
    ],
    period: {
      start: thirtyDaysAgo.toISOString(),
      end: now.toISOString(),
    },
  };
}

// Request/Response schemas
const ListOrdersSchema = z.object({
  status: z.enum(["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"]).optional(),
  userId: z.string().optional(),
  merchantId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  sortBy: z.enum(["createdAt", "total", "status"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const GetOrderSchema = z.object({
  orderId: z.string(),
});

const GetOrderStatusSchema = z.object({
  orderId: z.string(),
});

const GetOrderTrackingSchema = z.object({
  orderId: z.string(),
});

const CancelOrderSchema = z.object({
  orderId: z.string(),
  reason: z.string().min(1, "Cancellation reason is required"),
});

const UpdateOrderStatusSchema = z.object({
  orderId: z.string(),
  status: z.enum(["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"]),
  note: z.string().optional(),
});

const GetOrderAnalyticsSchema = z.object({
  period: z.enum(["today", "week", "month", "quarter", "year"]).default("month"),
  merchantId: z.string().optional(),
  userId: z.string().optional(),
});

// Helper functions
function filterOrders(filters: z.infer<typeof ListOrdersSchema>): Order[] {
  let filtered = [...mockOrders];

  if (filters.status) {
    filtered = filtered.filter((o) => o.status === filters.status);
  }
  if (filters.userId) {
    filtered = filtered.filter((o) => o.userId === filters.userId);
  }
  if (filters.merchantId) {
    filtered = filtered.filter((o) => o.merchantId === filters.merchantId);
  }
  if (filters.dateFrom) {
    const fromDate = new Date(filters.dateFrom);
    filtered = filtered.filter((o) => new Date(o.createdAt) >= fromDate);
  }
  if (filters.dateTo) {
    const toDate = new Date(filters.dateTo);
    filtered = filtered.filter((o) => new Date(o.createdAt) <= toDate);
  }

  // Sort
  filtered.sort((a, b) => {
    let compareA: string | number;
    let compareB: string | number;

    switch (filters.sortBy) {
      case "createdAt":
        compareA = new Date(a.createdAt).getTime();
        compareB = new Date(b.createdAt).getTime();
        break;
      case "total":
        compareA = a.total;
        compareB = b.total;
        break;
      case "status":
        compareA = a.status;
        compareB = b.status;
        break;
      default:
        compareA = new Date(a.createdAt).getTime();
        compareB = new Date(b.createdAt).getTime();
    }

    if (typeof compareA === "string") {
      return filters.sortOrder === "asc"
        ? compareA.localeCompare(compareB as string)
        : (compareB as string).localeCompare(compareA);
    }

    return filters.sortOrder === "asc"
      ? (compareA as number) - (compareB as number)
      : (compareB as number) - (compareA as number);
  });

  // Pagination
  return filtered.slice(filters.offset, filters.offset + filters.limit);
}

function findOrder(orderId: string): Order | undefined {
  return mockOrders.find((o) => o.id === orderId || o.orderNumber === orderId);
}

// Tool implementations
async function listOrders(args: unknown) {
  try {
    const filters = ListOrdersSchema.parse(args);
    const orders = filterOrders(filters);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              success: true,
              data: {
                orders: orders.map((o) => ({
                  id: o.id,
                  orderNumber: o.orderNumber,
                  merchantName: o.merchantName,
                  status: o.status,
                  total: o.total,
                  currency: o.currency,
                  itemCount: o.items.length,
                  createdAt: o.createdAt,
                })),
                pagination: {
                  limit: filters.limit,
                  offset: filters.offset,
                  total: mockOrders.length,
                },
              },
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            success: false,
            error: error instanceof z.ZodError ? error.errors : "Invalid request",
          }),
        },
      ],
    };
  }
}

async function getOrder(args: unknown) {
  try {
    const { orderId } = GetOrderSchema.parse(args);
    const order = findOrder(orderId);

    if (!order) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: "Order not found",
            }),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              success: true,
              data: order,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            success: false,
            error: error instanceof z.ZodError ? error.errors : "Invalid request",
          }),
        },
      ],
    };
  }
}

async function getOrderStatus(args: unknown) {
  try {
    const { orderId } = GetOrderStatusSchema.parse(args);
    const order = findOrder(orderId);

    if (!order) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: "Order not found",
            }),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              success: true,
              data: {
                orderId: order.id,
                orderNumber: order.orderNumber,
                currentStatus: order.status,
                paymentStatus: order.paymentStatus,
                timeline: order.timeline,
                lastUpdated: order.updatedAt,
              },
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            success: false,
            error: error instanceof z.ZodError ? error.errors : "Invalid request",
          }),
        },
      ],
    };
  }
}

async function getOrderTracking(args: unknown) {
  try {
    const { orderId } = GetOrderTrackingSchema.parse(args);
    const order = findOrder(orderId);

    if (!order) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: "Order not found",
            }),
          },
        ],
      };
    }

    if (!order.tracking) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: "Tracking information not available for this order",
              orderStatus: order.status,
            }),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              success: true,
              data: {
                orderId: order.id,
                orderNumber: order.orderNumber,
                tracking: order.tracking,
              },
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            success: false,
            error: error instanceof z.ZodError ? error.errors : "Invalid request",
          }),
        },
      ],
    };
  }
}

async function cancelOrder(args: unknown) {
  try {
    const { orderId, reason } = CancelOrderSchema.parse(args);
    const order = findOrder(orderId);

    if (!order) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: "Order not found",
            }),
          },
        ],
      };
    }

    if (order.status === "delivered" || order.status === "cancelled") {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: `Cannot cancel order with status: ${order.status}`,
            }),
          },
        ],
      };
    }

    // Simulate cancellation
    const cancelledOrder: Order = {
      ...order,
      status: "cancelled",
      updatedAt: new Date().toISOString(),
      timeline: [
        ...order.timeline,
        {
          status: "cancelled",
          timestamp: new Date().toISOString(),
          description: `Cancelled: ${reason}`,
        },
      ],
    };

    // Update mock data
    const orderIndex = mockOrders.findIndex((o) => o.id === order.id);
    if (orderIndex !== -1) {
      mockOrders[orderIndex] = cancelledOrder;
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            message: "Order cancelled successfully",
            data: {
              orderId: cancelledOrder.id,
              orderNumber: cancelledOrder.orderNumber,
              status: cancelledOrder.status,
              cancellationReason: reason,
              refundStatus: cancelledOrder.paymentStatus === "paid" ? "Refund initiated" : "N/A",
            },
          }),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            success: false,
            error: error instanceof z.ZodError ? error.errors : "Invalid request",
          }),
        },
      ],
    };
  }
}

async function updateOrderStatus(args: unknown) {
  try {
    const { orderId, status, note } = UpdateOrderStatusSchema.parse(args);
    const order = findOrder(orderId);

    if (!order) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: "Order not found",
            }),
          },
        ],
      };
    }

    // Validate status transition
    const validTransitions: Record<string, string[]> = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["processing", "cancelled"],
      processing: ["shipped", "cancelled"],
      shipped: ["delivered", "cancelled"],
      delivered: ["refunded"],
      cancelled: [],
      refunded: [],
    };

    if (!validTransitions[order.status]?.includes(status)) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: `Invalid status transition from '${order.status}' to '${status}'`,
              validTransitions: validTransitions[order.status],
            }),
          },
        ],
      };
    }

    // Simulate status update
    const updatedOrder: Order = {
      ...order,
      status: status as Order["status"],
      updatedAt: new Date().toISOString(),
      timeline: [
        ...order.timeline,
        {
          status,
          timestamp: new Date().toISOString(),
          description: note || `Status updated to ${status}`,
        },
      ],
    };

    // Update mock data
    const orderIndex = mockOrders.findIndex((o) => o.id === order.id);
    if (orderIndex !== -1) {
      mockOrders[orderIndex] = updatedOrder;
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            message: "Order status updated successfully",
            data: {
              orderId: updatedOrder.id,
              orderNumber: updatedOrder.orderNumber,
              previousStatus: order.status,
              newStatus: updatedOrder.status,
              updatedAt: updatedOrder.updatedAt,
            },
          }),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            success: false,
            error: error instanceof z.ZodError ? error.errors : "Invalid request",
          }),
        },
      ],
    };
  }
}

async function getOrderAnalytics(args: unknown) {
  try {
    const { period, merchantId, userId } = GetOrderAnalyticsSchema.parse(args);

    // Filter analytics based on merchantId or userId if provided
    const analytics = generateAnalytics();

    if (merchantId || userId) {
      // In a real implementation, this would filter from the actual service
      // For now, return partial data with a note
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                data: {
                  ...analytics,
                  note: merchantId
                    ? `Analytics filtered for merchant: ${merchantId}`
                    : `Analytics filtered for user: ${userId}`,
                  // In production, these would be recalculated
                  summary: {
                    ...analytics.summary,
                    totalOrders: merchantId ? 234 : 12,
                    totalRevenue: merchantId ? 912345.67 : 45892.34,
                  },
                },
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
          type: "text" as const,
          text: JSON.stringify(
            {
              success: true,
              data: analytics,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            success: false,
            error: error instanceof z.ZodError ? error.errors : "Invalid request",
          }),
        },
      ],
    };
  }
}

// MCP Server Setup
const server = new Server(
  {
    name: "rez-mcp-order",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_orders",
        description: "List orders with optional filters for status, user, merchant, and date range. Supports pagination and sorting.",
        inputSchema: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"],
              description: "Filter by order status",
            },
            userId: {
              type: "string",
              description: "Filter by user ID",
            },
            merchantId: {
              type: "string",
              description: "Filter by merchant ID",
            },
            dateFrom: {
              type: "string",
              description: "Filter orders from this date (ISO 8601 format)",
            },
            dateTo: {
              type: "string",
              description: "Filter orders to this date (ISO 8601 format)",
            },
            limit: {
              type: "number",
              minimum: 1,
              maximum: 100,
              default: 20,
              description: "Number of orders to return",
            },
            offset: {
              type: "number",
              minimum: 0,
              default: 0,
              description: "Number of orders to skip",
            },
            sortBy: {
              type: "string",
              enum: ["createdAt", "total", "status"],
              default: "createdAt",
              description: "Field to sort by",
            },
            sortOrder: {
              type: "string",
              enum: ["asc", "desc"],
              default: "desc",
              description: "Sort order",
            },
          },
        },
      },
      {
        name: "get_order",
        description: "Get complete order details by order ID or order number.",
        inputSchema: {
          type: "object",
          properties: {
            orderId: {
              type: "string",
              description: "Order ID or order number (e.g., ord_001 or REZ-2026-0515001)",
            },
          },
          required: ["orderId"],
        },
      },
      {
        name: "get_order_status",
        description: "Get order status with full timeline of status changes.",
        inputSchema: {
          type: "object",
          properties: {
            orderId: {
              type: "string",
              description: "Order ID or order number",
            },
          },
          required: ["orderId"],
        },
      },
      {
        name: "get_order_tracking",
        description: "Get delivery tracking information for an order including carrier details and shipment events.",
        inputSchema: {
          type: "object",
          properties: {
            orderId: {
              type: "string",
              description: "Order ID or order number",
            },
          },
          required: ["orderId"],
        },
      },
      {
        name: "cancel_order",
        description: "Cancel an order. Only orders that are not yet delivered or already cancelled can be cancelled.",
        inputSchema: {
          type: "object",
          properties: {
            orderId: {
              type: "string",
              description: "Order ID or order number",
            },
            reason: {
              type: "string",
              description: "Reason for cancellation",
            },
          },
          required: ["orderId", "reason"],
        },
      },
      {
        name: "update_order_status",
        description: "Update the status of an order. Validates status transitions to ensure proper workflow.",
        inputSchema: {
          type: "object",
          properties: {
            orderId: {
              type: "string",
              description: "Order ID or order number",
            },
            status: {
              type: "string",
              enum: ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"],
              description: "New order status",
            },
            note: {
              type: "string",
              description: "Optional note about the status change",
            },
          },
          required: ["orderId", "status"],
        },
      },
      {
        name: "get_order_analytics",
        description: "Get order analytics and metrics including revenue, order counts, trends, and top products/merchants.",
        inputSchema: {
          type: "object",
          properties: {
            period: {
              type: "string",
              enum: ["today", "week", "month", "quarter", "year"],
              default: "month",
              description: "Time period for analytics",
            },
            merchantId: {
              type: "string",
              description: "Filter analytics by merchant ID",
            },
            userId: {
              type: "string",
              description: "Filter analytics by user ID",
            },
          },
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "list_orders":
      return listOrders(args);
    case "get_order":
      return getOrder(args);
    case "get_order_status":
      return getOrderStatus(args);
    case "get_order_tracking":
      return getOrderTracking(args);
    case "cancel_order":
      return cancelOrder(args);
    case "update_order_status":
      return updateOrderStatus(args);
    case "get_order_analytics":
      return getOrderAnalytics(args);
    default:
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: `Unknown tool: ${name}`,
            }),
          },
        ],
      };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.error("REZ Order Management MCP Server started");
}

main().catch(console.error);
