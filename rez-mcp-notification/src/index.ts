import { logger } from './utils/logger.js';

/**
 * REZ Notification Debugger MCP Server
 *
 * A Model Context Protocol server for debugging and managing REZ notifications.
 * Provides tools to list, view, resend notifications, and manage user preferences.
 */

import 'dotenv/config';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

// Types
interface Notification {
  id: string;
  userId: string;
  type: "order" | "payment" | "promotion" | "system" | "reminder" | "alert";
  channel: "push" | "email" | "sms" | "whatsapp" | "in_app";
  title: string;
  body: string;
  status: "pending" | "sent" | "delivered" | "read" | "failed" | "bounced";
  createdAt: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  metadata: Record<string, unknown>;
  retryCount: number;
  errorMessage?: string;
}

interface UserPreferences {
  userId: string;
  push: boolean;
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  inApp: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  blockedCategories: string[];
  marketingOptIn: boolean;
}

interface DeliveryStatus {
  notificationId: string;
  channel: string;
  status: "queued" | "sent" | "delivered" | "read" | "failed";
  providerMessageId?: string;
  providerStatus?: string;
  timestamp: string;
  attempts: number;
  lastError?: string;
}

// Mock data store
const mockNotifications: Notification[] = [
  {
    id: "notif_001",
    userId: "user_123",
    type: "order",
    channel: "push",
    title: "Order Confirmed",
    body: "Your order #ORD-2024-001 is confirmed and being prepared.",
    status: "delivered",
    createdAt: "2024-01-15T10:30:00Z",
    sentAt: "2024-01-15T10:30:05Z",
    deliveredAt: "2024-01-15T10:30:12Z",
    readAt: "2024-01-15T11:00:00Z",
    metadata: { orderId: "ORD-2024-001", amount: 459.99 },
    retryCount: 0,
  },
  {
    id: "notif_002",
    userId: "user_123",
    type: "payment",
    channel: "email",
    title: "Payment Received",
    body: "We received your payment of ₹2,500.00 for Order #ORD-2024-002.",
    status: "delivered",
    createdAt: "2024-01-15T14:20:00Z",
    sentAt: "2024-01-15T14:20:03Z",
    deliveredAt: "2024-01-15T14:21:00Z",
    metadata: { orderId: "ORD-2024-002", paymentId: "pay_abc123" },
    retryCount: 0,
  },
  {
    id: "notif_003",
    userId: "user_456",
    type: "promotion",
    channel: "whatsapp",
    title: "Flash Sale!",
    body: "50% off on all electronics. Limited time offer!",
    status: "failed",
    createdAt: "2024-01-15T16:00:00Z",
    metadata: { campaignId: "flash_sale_01", discount: "50%" },
    retryCount: 3,
    errorMessage: "Phone number not registered on WhatsApp",
  },
  {
    id: "notif_004",
    userId: "user_789",
    type: "reminder",
    channel: "sms",
    title: "Appointment Reminder",
    body: "Your appointment is scheduled for tomorrow at 2:00 PM.",
    status: "pending",
    createdAt: "2024-01-15T18:00:00Z",
    metadata: { appointmentId: "apt_001", scheduledTime: "2024-01-16T14:00:00Z" },
    retryCount: 0,
  },
  {
    id: "notif_005",
    userId: "user_123",
    type: "alert",
    channel: "push",
    title: "Price Drop Alert",
    body: "Price dropped for iPhone 15 Pro! Was ₹1,49,900, now ₹1,39,900",
    status: "sent",
    createdAt: "2024-01-15T19:00:00Z",
    sentAt: "2024-01-15T19:00:02Z",
    metadata: { productId: "iphone_15_pro", oldPrice: 149900, newPrice: 139900 },
    retryCount: 0,
  },
  {
    id: "notif_006",
    userId: "user_123",
    type: "system",
    channel: "in_app",
    title: "Account Updated",
    body: "Your profile information has been successfully updated.",
    status: "read",
    createdAt: "2024-01-14T09:00:00Z",
    sentAt: "2024-01-14T09:00:01Z",
    deliveredAt: "2024-01-14T09:00:01Z",
    readAt: "2024-01-14T09:15:00Z",
    metadata: { updatedFields: ["phone", "address"] },
    retryCount: 0,
  },
  {
    id: "notif_007",
    userId: "user_456",
    type: "order",
    channel: "email",
    title: "Order Shipped",
    body: "Your order #ORD-2024-003 has been shipped via Delhivery.",
    status: "bounced",
    createdAt: "2024-01-15T12:00:00Z",
    sentAt: "2024-01-15T12:00:05Z",
    metadata: { orderId: "ORD-2024-003", trackingNumber: "DL-123456789" },
    retryCount: 2,
    errorMessage: "Mailbox full - message rejected",
  },
  {
    id: "notif_008",
    userId: "user_789",
    type: "promotion",
    channel: "push",
    title: "Welcome Bonus",
    body: "Welcome to ReZ! Here's ₹500 off on your first order.",
    status: "delivered",
    createdAt: "2024-01-13T08:00:00Z",
    sentAt: "2024-01-13T08:00:02Z",
    deliveredAt: "2024-01-13T08:00:30Z",
    metadata: { bonusAmount: 500, promoCode: "WELCOME500" },
    retryCount: 0,
  },
];

const mockPreferences: Record<string, UserPreferences> = {
  user_123: {
    userId: "user_123",
    push: true,
    email: true,
    sms: false,
    whatsapp: true,
    inApp: true,
    quietHoursStart: "22:00",
    quietHoursEnd: "08:00",
    blockedCategories: ["gambling", "adult"],
    marketingOptIn: true,
  },
  user_456: {
    userId: "user_456",
    push: true,
    email: false,
    sms: true,
    whatsapp: false,
    inApp: true,
    blockedCategories: [],
    marketingOptIn: false,
  },
  user_789: {
    userId: "user_789",
    push: false,
    email: true,
    sms: true,
    whatsapp: true,
    inApp: true,
    quietHoursStart: "23:00",
    quietHoursEnd: "07:00",
    blockedCategories: ["promotion"],
    marketingOptIn: true,
  },
};

const notificationTemplates: Record<string, { title: string; body: string }> = {
  order_confirmation: {
    title: "Order Confirmed - {{orderId}}",
    body: "Your order of ₹{{amount}} has been confirmed. {{deliveryEstimate}}",
  },
  payment_success: {
    title: "Payment Received",
    body: "We received ₹{{amount}} for {{orderId}}. Transaction ID: {{transactionId}}",
  },
  order_shipped: {
    title: "Your Order is On the Way!",
    body: "Order {{orderId}} shipped via {{carrier}}. Tracking: {{trackingNumber}}",
  },
  price_alert: {
    title: "Price Drop: {{productName}}",
    body: "{{productName}} dropped from ₹{{oldPrice}} to ₹{{newPrice}}! Save ₹{{savings}}",
  },
  reminder: {
    title: "Reminder: {{eventTitle}}",
    body: "{{eventDescription}} is scheduled for {{eventTime}}",
  },
  welcome: {
    title: "Welcome to ReZ! 🎉",
    body: "Thank you for joining! Use code {{promoCode}} for ₹{{bonusAmount}} off.",
  },
};

// Configuration
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL;

// Helper functions
async function fetchFromService<T>(endpoint: string): Promise<T | null> {
  if (!NOTIFICATION_SERVICE_URL) {
    return null;
  }

  try {
    const response = await fetch(`${NOTIFICATION_SERVICE_URL}${endpoint}`, {
      headers: {
        "X-Internal-Token": process.env.INTERNAL_SERVICE_TOKEN || "",
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json() as T;
  } catch (error) {
    console.error(`Failed to fetch from service: ${endpoint}`, error);
    return null;
  }
}

// Tool implementations
function listNotifications(args: {
  userId?: string;
  channel?: string;
  status?: string;
  type?: string;
  limit?: number;
  offset?: number;
}): Notification[] {
  let filtered = [...mockNotifications];

  if (args.userId) {
    filtered = filtered.filter((n) => n.userId === args.userId);
  }

  if (args.channel) {
    filtered = filtered.filter((n) => n.channel === args.channel);
  }

  if (args.status) {
    filtered = filtered.filter((n) => n.status === args.status);
  }

  if (args.type) {
    filtered = filtered.filter((n) => n.type === args.type);
  }

  const offset = args.offset || 0;
  const limit = args.limit || 20;

  return filtered.slice(offset, offset + limit);
}

function getNotification(args: { notificationId: string }): Notification | null {
  return mockNotifications.find((n) => n.id === args.notificationId) || null;
}

function getDeliveryStatus(args: { notificationId: string }): DeliveryStatus | null {
  const notification = mockNotifications.find((n) => n.id === args.notificationId);

  if (!notification) {
    return null;
  }

  const statusMap: Record<string, DeliveryStatus["status"]> = {
    pending: "queued",
    sent: "sent",
    delivered: "delivered",
    read: "read",
    failed: "failed",
    bounced: "failed",
  };

  return {
    notificationId: notification.id,
    channel: notification.channel,
    status: statusMap[notification.status] || "queued",
    providerMessageId: `msg_${notification.id}_${Date.now()}`,
    providerStatus: notification.status,
    timestamp: notification.sentAt || notification.createdAt,
    attempts: notification.retryCount + 1,
    lastError: notification.errorMessage,
  };
}

function resendNotification(args: { notificationId: string }): {
  success: boolean;
  newNotificationId?: string;
  message: string;
} {
  const notification = mockNotifications.find((n) => n.id === args.notificationId);

  if (!notification) {
    return {
      success: false,
      message: `Notification ${args.notificationId} not found`,
    };
  }

  if (notification.status !== "failed" && notification.status !== "bounced") {
    return {
      success: false,
      message: `Cannot resend notification with status: ${notification.status}. Only failed/bounced notifications can be resent.`,
    };
  }

  // Simulate creating a new notification
  const newNotification: Notification = {
    ...notification,
    id: `notif_${Date.now()}`,
    status: "pending",
    createdAt: new Date().toISOString(),
    retryCount: 0,
    errorMessage: undefined,
  };

  mockNotifications.push(newNotification);

  return {
    success: true,
    newNotificationId: newNotification.id,
    message: `Notification resent successfully. New ID: ${newNotification.id}`,
  };
}

function previewTemplate(args: {
  templateId: string;
  variables?: Record<string, string>;
}): {
  templateId: string;
  title: string;
  body: string;
  renderedTitle: string;
  renderedBody: string;
} | null {
  const template = notificationTemplates[args.templateId];

  if (!template) {
    return null;
  }

  const variables = args.variables || {};

  const render = (text: string) => {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || `{{${key}}}`);
  };

  return {
    templateId: args.templateId,
    title: template.title,
    body: template.body,
    renderedTitle: render(template.title),
    renderedBody: render(template.body),
  };
}

function getUserPreferences(args: { userId: string }): UserPreferences | null {
  return mockPreferences[args.userId] || null;
}

function updatePreferences(
  args: {
    userId: string;
    push?: boolean;
    email?: boolean;
    sms?: boolean;
    whatsapp?: boolean;
    inApp?: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    blockedCategories?: string[];
    marketingOptIn?: boolean;
  }
): {
  success: boolean;
  preferences?: UserPreferences;
  message: string;
} {
  const existing = mockPreferences[args.userId];

  if (!existing) {
    return {
      success: false,
      message: `User ${args.userId} not found`,
    };
  }

  const updated: UserPreferences = {
    ...existing,
    push: args.push ?? existing.push,
    email: args.email ?? existing.email,
    sms: args.sms ?? existing.sms,
    whatsapp: args.whatsapp ?? existing.whatsapp,
    inApp: args.inApp ?? existing.inApp,
    quietHoursStart: args.quietHoursStart ?? existing.quietHoursStart,
    quietHoursEnd: args.quietHoursEnd ?? existing.quietHoursEnd,
    blockedCategories: args.blockedCategories ?? existing.blockedCategories,
    marketingOptIn: args.marketingOptIn ?? existing.marketingOptIn,
  };

  mockPreferences[args.userId] = updated;

  return {
    success: true,
    preferences: updated,
    message: "Preferences updated successfully",
  };
}

// Define tools
const tools: Tool[] = [
  {
    name: "list_notifications",
    description:
      "List notifications with optional filters. Returns notifications sorted by creation date (newest first).",
    inputSchema: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description: "Filter by user ID",
        },
        channel: {
          type: "string",
          enum: ["push", "email", "sms", "whatsapp", "in_app"],
          description: "Filter by notification channel",
        },
        status: {
          type: "string",
          enum: ["pending", "sent", "delivered", "read", "failed", "bounced"],
          description: "Filter by delivery status",
        },
        type: {
          type: "string",
          enum: ["order", "payment", "promotion", "system", "reminder", "alert"],
          description: "Filter by notification type",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default: 20, max: 100)",
          minimum: 1,
          maximum: 100,
        },
        offset: {
          type: "number",
          description: "Number of results to skip (for pagination)",
          minimum: 0,
        },
      },
    },
  },
  {
    name: "get_notification",
    description: "Get detailed information about a specific notification by ID.",
    inputSchema: {
      type: "object",
      properties: {
        notificationId: {
          type: "string",
          description: "The notification ID (format: notif_xxx)",
        },
      },
      required: ["notificationId"],
    },
  },
  {
    name: "get_delivery_status",
    description: "Get delivery status information for a notification including provider details.",
    inputSchema: {
      type: "object",
      properties: {
        notificationId: {
          type: "string",
          description: "The notification ID to check",
        },
      },
      required: ["notificationId"],
    },
  },
  {
    name: "resend_notification",
    description:
      "Resend a failed or bounced notification. Creates a new notification with the same content.",
    inputSchema: {
      type: "object",
      properties: {
        notificationId: {
          type: "string",
          description: "The notification ID to resend",
        },
      },
      required: ["notificationId"],
    },
  },
  {
    name: "preview_template",
    description:
      "Preview a notification template with variable substitution. Useful for testing templates before sending.",
    inputSchema: {
      type: "object",
      properties: {
        templateId: {
          type: "string",
          description: "Template identifier (e.g., order_confirmation, payment_success, order_shipped, price_alert, reminder, welcome)",
        },
        variables: {
          type: "object",
          description: "Key-value pairs for template variable substitution",
          additionalProperties: { type: "string" },
        },
      },
      required: ["templateId"],
    },
  },
  {
    name: "get_user_preferences",
    description: "Get notification preferences for a user including channel settings and quiet hours.",
    inputSchema: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description: "The user ID to get preferences for",
        },
      },
      required: ["userId"],
    },
  },
  {
    name: "update_preferences",
    description: "Update notification preferences for a user. Only provided fields will be updated.",
    inputSchema: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description: "The user ID to update preferences for",
        },
        push: {
          type: "boolean",
          description: "Enable/disable push notifications",
        },
        email: {
          type: "boolean",
          description: "Enable/disable email notifications",
        },
        sms: {
          type: "boolean",
          description: "Enable/disable SMS notifications",
        },
        whatsapp: {
          type: "boolean",
          description: "Enable/disable WhatsApp notifications",
        },
        inApp: {
          type: "boolean",
          description: "Enable/disable in-app notifications",
        },
        quietHoursStart: {
          type: "string",
          description: "Quiet hours start time (HH:mm format, e.g., '22:00')",
        },
        quietHoursEnd: {
          type: "string",
          description: "Quiet hours end time (HH:mm format, e.g., '08:00')",
        },
        blockedCategories: {
          type: "array",
          items: { type: "string" },
          description: "List of blocked notification categories",
        },
        marketingOptIn: {
          type: "boolean",
          description: "Marketing communications opt-in status",
        },
      },
      required: ["userId"],
    },
  },
];

// Create MCP Server
const server = new Server(
  {
    name: "rez-notification-debugger",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;

    switch (name) {
      case "list_notifications": {
        const notifications = listNotifications(args as Parameters<typeof listNotifications>[0]);
        result = {
          count: notifications.length,
          notifications,
        };
        break;
      }

      case "get_notification": {
        const notification = getNotification(args as { notificationId: string });
        if (!notification) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Notification not found: ${(args as { notificationId: string }).notificationId}`,
              },
            ],
            isError: true,
          };
        }
        result = notification;
        break;
      }

      case "get_delivery_status": {
        const status = getDeliveryStatus(args as { notificationId: string });
        if (!status) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Notification not found: ${(args as { notificationId: string }).notificationId}`,
              },
            ],
            isError: true,
          };
        }
        result = status;
        break;
      }

      case "resend_notification": {
        const res = resendNotification(args as { notificationId: string });
        result = res;
        break;
      }

      case "preview_template": {
        const preview = previewTemplate(args as Parameters<typeof previewTemplate>[0]);
        if (!preview) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Template not found: ${(args as { templateId: string }).templateId}`,
              },
            ],
            isError: true,
          };
        }
        result = preview;
        break;
      }

      case "get_user_preferences": {
        const prefs = getUserPreferences(args as { userId: string });
        if (!prefs) {
          return {
            content: [
              {
                type: "text" as const,
                text: `User preferences not found: ${(args as { userId: string }).userId}`,
              },
            ],
            isError: true,
          };
        }
        result = prefs;
        break;
      }

      case "update_preferences": {
        const res = updatePreferences(args as Parameters<typeof updatePreferences>[0]);
        result = res;
        break;
      }

      default:
        return {
          content: [
            {
              type: "text" as const,
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const USE_REAL_API = process.env.USE_REAL_NOTIFICATION === 'true';
  logger.error("REZ Notification Debugger MCP Server started");
  logger.error(`Notification Service URL: ${NOTIFICATION_SERVICE_URL || 'http://localhost:4011'}`);
  logger.error(`Real API: ${USE_REAL_API ? 'ENABLED' : 'DISABLED (set USE_REAL_NOTIFICATION=true to enable)'}`);

  const transport = new (await import("@modelcontextprotocol/sdk/server/stdio.js")).StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
