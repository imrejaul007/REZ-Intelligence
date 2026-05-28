import { logger } from './utils/logger.js';

import 'dotenv/config';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Environment configuration
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'https://rez-payment-service.onrender.com';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';
const USE_REAL_API = process.env.USE_REAL_PAYMENT === 'true';

// Real API helper
async function fetchFromPaymentService<T>(endpoint: string, options?: RequestInit): Promise<T | null> {
  if (!USE_REAL_API) return null;

  try {
    const response = await fetch(`${PAYMENT_SERVICE_URL}${endpoint}`, {
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
    console.error(`Payment Service API error (${endpoint}):`, error);
    return null;
  }
}

// Types
interface Transaction {
  id: string;
  orderId: string;
  userId: string;
  amount: number;
  currency: string;
  status: "pending" | "completed" | "failed" | "refunded" | "partial_refund";
  paymentMethod: "card" | "upi" | "netbanking" | "wallet" | "cod";
  gateway: "razorpay" | "stripe" | "internal";
  gatewayTransactionId?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

interface Refund {
  id: string;
  transactionId: string;
  amount: number;
  status: "pending" | "processed" | "failed";
  reason?: string;
  processedAt?: string;
  createdAt: string;
}

interface WalletBalance {
  userId: string;
  balance: number;
  currency: string;
  updatedAt: string;
}

// Mock Data
const mockTransactions: Transaction[] = [
  {
    id: "txn_001",
    orderId: "ord_abc123",
    userId: "user_001",
    amount: 2999,
    currency: "INR",
    status: "completed",
    paymentMethod: "upi",
    gateway: "razorpay",
    gatewayTransactionId: "pay_razorpay_001",
    createdAt: "2026-05-14T10:30:00Z",
    updatedAt: "2026-05-14T10:30:15Z",
    metadata: { vpa: "user@upi" },
  },
  {
    id: "txn_002",
    orderId: "ord_def456",
    userId: "user_002",
    amount: 5999,
    currency: "INR",
    status: "pending",
    paymentMethod: "card",
    gateway: "razorpay",
    createdAt: "2026-05-15T08:00:00Z",
    updatedAt: "2026-05-15T08:00:00Z",
  },
  {
    id: "txn_003",
    orderId: "ord_ghi789",
    userId: "user_001",
    amount: 1299,
    currency: "INR",
    status: "failed",
    paymentMethod: "netbanking",
    gateway: "razorpay",
    gatewayTransactionId: "pay_razorpay_003",
    createdAt: "2026-05-13T15:45:00Z",
    updatedAt: "2026-05-13T15:46:30Z",
    metadata: { failureReason: "Insufficient funds" },
  },
  {
    id: "txn_004",
    orderId: "ord_jkl012",
    userId: "user_003",
    amount: 4500,
    currency: "INR",
    status: "refunded",
    paymentMethod: "wallet",
    gateway: "internal",
    gatewayTransactionId: "pay_internal_004",
    createdAt: "2026-05-10T12:00:00Z",
    updatedAt: "2026-05-12T09:00:00Z",
  },
  {
    id: "txn_005",
    orderId: "ord_mno345",
    userId: "user_002",
    amount: 8999,
    currency: "INR",
    status: "partial_refund",
    paymentMethod: "card",
    gateway: "stripe",
    gatewayTransactionId: "pay_stripe_005",
    createdAt: "2026-05-08T14:20:00Z",
    updatedAt: "2026-05-11T16:30:00Z",
  },
  {
    id: "txn_006",
    orderId: "ord_pqr678",
    userId: "user_004",
    amount: 199,
    currency: "INR",
    status: "completed",
    paymentMethod: "cod",
    gateway: "internal",
    createdAt: "2026-05-15T09:15:00Z",
    updatedAt: "2026-05-15T09:15:00Z",
  },
];

const mockRefunds: Refund[] = [
  {
    id: "ref_001",
    transactionId: "txn_004",
    amount: 4500,
    status: "processed",
    reason: "Customer requested cancellation",
    processedAt: "2026-05-12T09:00:00Z",
    createdAt: "2026-05-11T18:00:00Z",
  },
  {
    id: "ref_002",
    transactionId: "txn_005",
    amount: 2500,
    status: "processed",
    reason: "Partial item return",
    processedAt: "2026-05-11T16:30:00Z",
    createdAt: "2026-05-11T14:00:00Z",
  },
  {
    id: "ref_003",
    transactionId: "txn_005",
    amount: 2000,
    status: "pending",
    reason: "Remaining items returned",
    createdAt: "2026-05-15T10:00:00Z",
  },
];

const mockWallets: WalletBalance[] = [
  { userId: "user_001", balance: 1500.50, currency: "INR", updatedAt: "2026-05-15T10:00:00Z" },
  { userId: "user_002", balance: 0, currency: "INR", updatedAt: "2026-05-15T08:00:00Z" },
  { userId: "user_003", balance: 5000, currency: "INR", updatedAt: "2026-05-14T20:00:00Z" },
  { userId: "user_004", balance: 250.75, currency: "INR", updatedAt: "2026-05-15T09:30:00Z" },
];

// Tool Handlers
async function listTransactions(args: {
  status?: string;
  userId?: string;
  paymentMethod?: string;
  gateway?: string;
  limit?: number;
  offset?: number;
}) {
  // Try real API first if enabled
  if (USE_REAL_API) {
    const params = new URLSearchParams();
    if (args.status) params.append('status', args.status);
    if (args.userId) params.append('userId', args.userId);
    if (args.paymentMethod) params.append('paymentMethod', args.paymentMethod);
    if (args.gateway) params.append('gateway', args.gateway);
    params.append('limit', String(args.limit || 20));
    params.append('offset', String(args.offset || 0));

    const result = await fetchFromPaymentService<{ transactions: Transaction[]; total: number }>(`/api/transactions?${params}`);
    if (result) {
      return {
        transactions: result.transactions,
        total: result.total,
        source: 'remote'
      };
    }
  }

  // Fall back to local
  let filtered = [...mockTransactions];

  if (args.status) {
    filtered = filtered.filter((t) => t.status === args.status);
  }
  if (args.userId) {
    filtered = filtered.filter((t) => t.userId === args.userId);
  }
  if (args.paymentMethod) {
    filtered = filtered.filter((t) => t.paymentMethod === args.paymentMethod);
  }
  if (args.gateway) {
    filtered = filtered.filter((t) => t.gateway === args.gateway);
  }

  const offset = args.offset || 0;
  const limit = args.limit || 20;
  const paginated = filtered.slice(offset, offset + limit);

  return {
    transactions: paginated,
    total: filtered.length,
    offset,
    limit,
    source: 'local'
  };
}

async function getTransaction(args: { transactionId: string }) {
  // Try real API first if enabled
  if (USE_REAL_API) {
    const result = await fetchFromPaymentService<{ transaction: Transaction; refunds: Refund[] }>(`/api/transactions/${args.transactionId}`);
    if (result) {
      return { ...result, source: 'remote' };
    }
  }

  // Fall back to local
  const transaction = mockTransactions.find((t) => t.id === args.transactionId);

  if (!transaction) {
    return { error: "Transaction not found", transactionId: args.transactionId, source: 'local' };
  }

  const refunds = mockRefunds.filter((r) => r.transactionId === args.transactionId);

  return { transaction, refunds, source: 'local' };
}

async function getPaymentStatus(args: { transactionId: string }) {
  // Try real API first if enabled
  if (USE_REAL_API) {
    const result = await fetchFromPaymentService<Transaction>(`/api/transactions/${args.transactionId}/status`);
    if (result) {
      return {
        transactionId: result.id,
        status: result.status,
        amount: result.amount,
        currency: result.currency,
        paymentMethod: result.paymentMethod,
        gateway: result.gateway,
        isRefundable: ["completed", "partial_refund"].includes(result.status),
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        source: 'remote'
      };
    }
  }

  // Fall back to local
  const transaction = mockTransactions.find((t) => t.id === args.transactionId);

  if (!transaction) {
    return { error: "Transaction not found", transactionId: args.transactionId, source: 'local' };
  }

  return {
    transactionId: transaction.id,
    status: transaction.status,
    amount: transaction.amount,
    currency: transaction.currency,
    paymentMethod: transaction.paymentMethod,
    gateway: transaction.gateway,
    isRefundable: ["completed", "partial_refund"].includes(transaction.status),
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
    source: 'local'
  };
}

async function listRefunds(args: {
  transactionId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  // Try real API first if enabled
  if (USE_REAL_API) {
    const params = new URLSearchParams();
    if (args.transactionId) params.append('transactionId', args.transactionId);
    if (args.status) params.append('status', args.status);
    params.append('limit', String(args.limit || 20));
    params.append('offset', String(args.offset || 0));

    const result = await fetchFromPaymentService<{ refunds: Refund[]; total: number }>(`/api/refunds?${params}`);
    if (result) {
      return { ...result, source: 'remote' };
    }
  }

  // Fall back to local
  let filtered = [...mockRefunds];

  if (args.transactionId) {
    filtered = filtered.filter((r) => r.transactionId === args.transactionId);
  }
  if (args.status) {
    filtered = filtered.filter((r) => r.status === args.status);
  }

  const offset = args.offset || 0;
  const limit = args.limit || 20;
  const paginated = filtered.slice(offset, offset + limit);

  return {
    refunds: paginated,
    total: filtered.length,
    offset,
    limit,
    source: 'local'
  };
}

async function initiateRefund(args: {
  transactionId: string;
  amount?: number;
  reason: string;
}) {
  // Try real API first if enabled
  if (USE_REAL_API) {
    const result = await fetchFromPaymentService<Refund>(`/api/transactions/${args.transactionId}/refund`, {
      method: 'POST',
      body: JSON.stringify({ amount: args.amount, reason: args.reason })
    });
    if (result) {
      return { success: true, refund: result, message: `Refund of ${result.amount} INR initiated`, source: 'remote' };
    }
  }

  // Fall back to local
  const transaction = mockTransactions.find((t) => t.id === args.transactionId);

  if (!transaction) {
    return { error: "Transaction not found", transactionId: args.transactionId, source: 'local' };
  }

  if (transaction.status === "failed") {
    return { error: "Cannot refund failed transaction", source: 'local' };
  }

  const refundAmount = args.amount || transaction.amount;

  if (refundAmount > transaction.amount) {
    return { error: "Refund amount exceeds transaction amount", source: 'local' };
  }

  // Calculate already refunded amount
  const alreadyRefunded = mockRefunds
    .filter((r) => r.transactionId === args.transactionId && r.status === "processed")
    .reduce((sum, r) => sum + r.amount, 0);

  if (refundAmount + alreadyRefunded > transaction.amount) {
    return { error: "Total refund amount exceeds transaction amount", source: 'local' };
  }

  const newRefund: Refund = {
    id: `ref_${Date.now()}`,
    transactionId: args.transactionId,
    amount: refundAmount,
    status: "pending",
    reason: args.reason,
    createdAt: new Date().toISOString(),
  };

  mockRefunds.push(newRefund);

  return {
    success: true,
    refund: newRefund,
    message: `Refund of ${refundAmount} INR initiated for transaction ${args.transactionId}`,
    source: 'local'
  };
}

async function getWalletBalance(args: { userId: string }) {
  // Try real API first if enabled
  if (USE_REAL_API) {
    const result = await fetchFromPaymentService<WalletBalance>(`/api/wallets/${args.userId}/balance`);
    if (result) {
      return { ...result, source: 'remote' };
    }
  }

  // Fall back to local
  const wallet = mockWallets.find((w) => w.userId === args.userId);

  if (!wallet) {
    return {
      userId: args.userId,
      balance: 0,
      currency: "INR",
      error: "Wallet not found, initialized with 0 balance",
      updatedAt: new Date().toISOString(),
      source: 'local'
    };
  }

  return { ...wallet, source: 'local' };
}

// Create MCP Server
const server = new Server(
  {
    name: "rez-payment-debugger",
    version: "1.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_transactions",
        description: "List transactions with optional filters for status, user, payment method, and gateway",
        inputSchema: {
          type: "object",
          properties: {
            status: {
              type: "string",
              description: "Filter by status: pending, completed, failed, refunded, partial_refund",
            },
            userId: {
              type: "string",
              description: "Filter by user ID",
            },
            paymentMethod: {
              type: "string",
              description: "Filter by payment method: card, upi, netbanking, wallet, cod",
            },
            gateway: {
              type: "string",
              description: "Filter by gateway: razorpay, stripe, internal",
            },
            limit: {
              type: "number",
              description: "Maximum number of results to return (default: 20)",
            },
            offset: {
              type: "number",
              description: "Number of results to skip (for pagination)",
            },
          },
        },
      },
      {
        name: "get_transaction",
        description: "Get detailed information about a specific transaction including its refunds",
        inputSchema: {
          type: "object",
          properties: {
            transactionId: {
              type: "string",
              description: "The transaction ID to retrieve",
            },
          },
          required: ["transactionId"],
        },
      },
      {
        name: "get_payment_status",
        description: "Get the current status and details of a payment",
        inputSchema: {
          type: "object",
          properties: {
            transactionId: {
              type: "string",
              description: "The transaction ID to check",
            },
          },
          required: ["transactionId"],
        },
      },
      {
        name: "list_refunds",
        description: "List refunds with optional filters for transaction and status",
        inputSchema: {
          type: "object",
          properties: {
            transactionId: {
              type: "string",
              description: "Filter by transaction ID",
            },
            status: {
              type: "string",
              description: "Filter by status: pending, processed, failed",
            },
            limit: {
              type: "number",
              description: "Maximum number of results to return (default: 20)",
            },
            offset: {
              type: "number",
              description: "Number of results to skip (for pagination)",
            },
          },
        },
      },
      {
        name: "initiate_refund",
        description: "Initiate a refund for a transaction",
        inputSchema: {
          type: "object",
          properties: {
            transactionId: {
              type: "string",
              description: "The transaction ID to refund",
            },
            amount: {
              type: "number",
              description: "Amount to refund (defaults to full transaction amount)",
            },
            reason: {
              type: "string",
              description: "Reason for the refund",
            },
          },
          required: ["transactionId", "reason"],
        },
      },
      {
        name: "get_wallet_balance",
        description: "Get wallet balance for a user",
        inputSchema: {
          type: "object",
          properties: {
            userId: {
              type: "string",
              description: "The user ID to get balance for",
            },
          },
          required: ["userId"],
        },
      },
    ],
  };
});

// Handle Tool Calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;

    switch (name) {
      case "list_transactions":
        result = await listTransactions(args as Parameters<typeof listTransactions>[0]);
        break;
      case "get_transaction":
        result = await getTransaction(args as Parameters<typeof getTransaction>[0]);
        break;
      case "get_payment_status":
        result = await getPaymentStatus(args as Parameters<typeof getPaymentStatus>[0]);
        break;
      case "list_refunds":
        result = await listRefunds(args as Parameters<typeof listRefunds>[0]);
        break;
      case "initiate_refund":
        result = await initiateRefund(args as Parameters<typeof initiateRefund>[0]);
        break;
      case "get_wallet_balance":
        result = await getWalletBalance(args as Parameters<typeof getWalletBalance>[0]);
        break;
      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true,
    };
  }
});

// Start Server
async function main() {
  logger.error("REZ Payment MCP Server started");
  logger.error(`Payment Service URL: ${PAYMENT_SERVICE_URL}`);
  logger.error(`Real API: ${USE_REAL_API ? 'ENABLED' : 'DISABLED (set USE_REAL_PAYMENT=true to enable)'}`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
