import logger from './utils/logger.js';
import crypto from 'crypto';

// Crypto-based random number generator for secure randomness
function secureRandom(): number {
  return parseInt(crypto.randomBytes(4).toString('hex'), 16) / 0xFFFFFFFF;
}

/**
 * REZ Log Aggregator MCP Server
 *
 * MCP server for log aggregation, search, and analysis across REZ services.
 * Supports connecting to LOG_SERVICE_URL or using mock data for development.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// ============================================================================
// Types
// ============================================================================

interface LogEntry {
  id: string;
  timestamp: string;
  service: string;
  level: "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";
  message: string;
  userId?: string;
  traceId?: string;
  requestId?: string;
  duration?: number;
  statusCode?: number;
  method?: string;
  path?: string;
  error?: string;
  stack?: string;
  metadata?: Record<string, unknown>;
}

interface SearchLogsParams {
  query?: string;
  service?: string;
  level?: string;
  timeRange?: string;
  limit?: number;
  offset?: number;
  [key: string]: unknown;
}

interface GetLogsByServiceParams {
  service: string;
  limit?: number;
  level?: string;
  [key: string]: unknown;
}

interface GetLogsByUserParams {
  userId: string;
  limit?: number;
  [key: string]: unknown;
}

interface GetLogsByTraceParams {
  traceId: string;
  [key: string]: unknown;
}

interface AnalyzeErrorsParams {
  service?: string;
  timeRange?: string;
  limit?: number;
  [key: string]: unknown;
}

interface GetSlowRequestsParams {
  service?: string;
  thresholdMs?: number;
  limit?: number;
  [key: string]: unknown;
}

interface ExportLogsParams {
  format: "json" | "csv";
  filters?: {
    service?: string;
    level?: string;
    timeRange?: string;
    query?: string;
  };
  limit?: number;
  [key: string]: unknown;
}

// ============================================================================
// Mock Data
// ============================================================================

const SERVICES = [
  "rez-auth-service",
  "rez-payment-service",
  "rez-order-service",
  "rez-notifications-service",
  "rez-search-service",
  "rez-analytics-service",
  "rez-dooh-service",
  "rez-fraud-service",
  "REZ-marketing-service",
  "rez-shopify-connector",
  "rez-woocommerce-connector",
  "REZ-prompt-workflow-ai",
  "REZ-crm-hub",
  "rez-voice-cart-recovery",
];

const LOG_MESSAGES: Record<string, string[]> = {
  DEBUG: [
    "Cache hit for key: user_session_{id}",
    "Database query executed in {ms}ms",
    "Middleware processing request",
    "Token validation check passed",
    "GraphQL resolver executed",
  ],
  INFO: [
    "User {userId} logged in successfully",
    "Payment processed: {amount} for order {orderId}",
    "Order #{orderId} created by user {userId}",
    "Webhook received from {provider}",
    "Service health check passed",
    "Cache warmed successfully",
    "Batch job completed: {count} records processed",
    "API request processed in {ms}ms",
    "User session created: {sessionId}",
    "Notification sent to {count} recipients",
  ],
  WARN: [
    "High memory usage detected: {percent}%",
    "Slow query detected: {ms}ms",
    "Rate limit approaching for IP {ip}",
    "Retry attempt {attempt} for external API",
    "Deprecated endpoint accessed: {endpoint}",
    "Cache miss rate above threshold: {percent}%",
    "Connection pool nearing capacity: {current}/{max}",
  ],
  ERROR: [
    "Failed to process payment: insufficient funds",
    "Database connection timeout after {ms}ms",
    "External API error: {provider} returned {status}",
    "Authentication failed for user {userId}",
    "Webhook signature verification failed",
    "Order validation error: invalid items",
    "Service unavailable: {service} is down",
    "Unhandled exception in {handler}",
  ],
  FATAL: [
    "Service crashed: out of memory",
    "Critical database failure",
    "Security breach detected",
    "Complete system failure",
  ],
};

const ERROR_PATTERNS = [
  { pattern: /ECONNREFUSED/i, category: "Connection Error", count: 0 },
  { pattern: /timeout/i, category: "Timeout", count: 0 },
  { pattern: /authentication failed/i, category: "Auth Failure", count: 0 },
  { pattern: /insufficient funds/i, category: "Payment Error", count: 0 },
  { pattern: /validation error/i, category: "Validation Error", count: 0 },
  { pattern: /rate limit/i, category: "Rate Limit", count: 0 },
  { pattern: /unhandled exception/i, category: "Unhandled Exception", count: 0 },
  { pattern: /database error/i, category: "Database Error", count: 0 },
];

function generateMockLogs(count: number = 100): LogEntry[] {
  const logs: LogEntry[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const service = SERVICES[Math.floor(secureRandom() * SERVICES.length)];
    const levels: LogEntry["level"][] = ["DEBUG", "INFO", "WARN", "ERROR", "FATAL"];
    const weights = [0.1, 0.5, 0.2, 0.15, 0.05];

    let level: LogEntry["level"] = "INFO";
    const rand = secureRandom();
    let cumulative = 0;
    for (let j = 0; j < weights.length; j++) {
      cumulative += weights[j];
      if (rand < cumulative) {
        level = levels[j];
        break;
      }
    }

    const messages = LOG_MESSAGES[level];
    let message = messages[Math.floor(secureRandom() * messages.length)];

    // Replace placeholders
    message = message
      .replace("{id}", `usr_${crypto.randomUUID().replace(/-/g, '').substring(0, 9)}`)
      .replace("{userId}", `user_${Math.floor(secureRandom() * 10000)}`)
      .replace("{amount}", `₹${(secureRandom() * 10000).toFixed(2)}`)
      .replace("{orderId}", `ord_${crypto.randomUUID().replace(/-/g, '').substring(0, 9)}`)
      .replace("{provider}", ["shopify", "woocommerce", "razorpay", "twilio"][Math.floor(secureRandom() * 4)])
      .replace("{ms}", String(Math.floor(secureRandom() * 5000)))
      .replace("{sessionId}", `sess_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`)
      .replace("{count}", String(Math.floor(secureRandom() * 100)))
      .replace("{percent}", String(Math.floor(secureRandom() * 100)))
      .replace("{current}", String(Math.floor(secureRandom() * 80)))
      .replace("{max}", "100")
      .replace("{ip}", `${Math.floor(secureRandom() * 255)}.${Math.floor(secureRandom() * 255)}.${Math.floor(secureRandom() * 255)}.${Math.floor(secureRandom() * 255)}`)
      .replace("{attempt}", String(Math.floor(secureRandom() * 3) + 1))
      .replace("{endpoint}", ["/api/v1/legacy", "/api/v1/deprecated", "/api/v1/old"][Math.floor(secureRandom() * 3)])
      .replace("{service}", SERVICES[Math.floor(secureRandom() * SERVICES.length)])
      .replace("{handler}", ["paymentHandler", "authMiddleware", "webhookProcessor"][Math.floor(secureRandom() * 3)])
      .replace("{status}", ["400", "401", "403", "500", "502", "503"][Math.floor(secureRandom() * 6)]);

    const timestamp = new Date(now - Math.floor(secureRandom() * 86400000)).toISOString();
    const traceId = `trace_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;
    const requestId = `req_${crypto.randomUUID().replace(/-/g, '').substring(0, 9)}`;

    const log: LogEntry = {
      id: `log_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`,
      timestamp,
      service,
      level,
      message,
      traceId,
      requestId,
    };

    // Add optional fields based on level
    if (level === "ERROR" || level === "FATAL") {
      log.error = message;
      log.stack = `Error: ${message}\n    at ${service}.handler (${service}/src/handler.ts:42)\n    at processRequest (${service}/src/server.ts:128)`;
    }

    if (["INFO", "WARN", "ERROR"].includes(level) && secureRandom() > 0.3) {
      log.userId = `user_${Math.floor(secureRandom() * 10000)}`;
    }

    if (secureRandom() > 0.7) {
      log.duration = Math.floor(secureRandom() * 5000);
    }

    if (secureRandom() > 0.8) {
      log.statusCode = [200, 201, 400, 401, 403, 404, 500, 502, 503][Math.floor(secureRandom() * 9)];
    }

    if (["INFO", "WARN"].includes(level) && secureRandom() > 0.5) {
      log.method = ["GET", "POST", "PUT", "DELETE", "PATCH"][Math.floor(secureRandom() * 5)];
      log.path = ["/api/v1/users", "/api/v1/orders", "/api/v1/payments", "/api/v1/products", "/api/v1/auth"][Math.floor(secureRandom() * 5)];
    }

    logs.push(log);
  }

  // Sort by timestamp descending
  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// In-memory log store (simulates external service)
let logStore: LogEntry[] = generateMockLogs(500);

// ============================================================================
// Log Service Client
// ============================================================================

class LogServiceClient {
  private baseUrl: string | null;

  constructor() {
    this.baseUrl = process.env.LOG_SERVICE_URL || null;
  }

  isConnected(): boolean {
    return this.baseUrl !== null;
  }

  async search(params: SearchLogsParams): Promise<LogEntry[]> {
    if (this.isConnected()) {
      return await this.fetchFromService<LogEntry[]>("/api/logs/search", params);
    }
    return this.searchMock(params);
  }

  async getByService(params: GetLogsByServiceParams): Promise<LogEntry[]> {
    if (this.isConnected()) {
      return await this.fetchFromService<LogEntry[]>(`/api/logs/service/${params.service}`, params);
    }
    return this.getByServiceMock(params);
  }

  async getByUser(params: GetLogsByUserParams): Promise<LogEntry[]> {
    if (this.isConnected()) {
      return await this.fetchFromService<LogEntry[]>(`/api/logs/user/${params.userId}`, params);
    }
    return this.getByUserMock(params);
  }

  async getByTrace(params: GetLogsByTraceParams): Promise<LogEntry[]> {
    if (this.isConnected()) {
      return await this.fetchFromService<LogEntry[]>(`/api/logs/trace/${params.traceId}`, params);
    }
    return this.getByTraceMock(params);
  }

  async analyzeErrors(params: AnalyzeErrorsParams): Promise<Record<string, unknown>> {
    if (this.isConnected()) {
      return await this.fetchFromService<Record<string, unknown>>("/api/logs/errors/analyze", params);
    }
    return this.analyzeErrorsMock(params);
  }

  async getSlowRequests(params: GetSlowRequestsParams): Promise<LogEntry[]> {
    if (this.isConnected()) {
      return await this.fetchFromService<LogEntry[]>("/api/logs/slow", params);
    }
    return this.getSlowRequestsMock(params);
  }

  async exportLogs(params: ExportLogsParams): Promise<string> {
    const logs = await this.search({
      query: params.filters?.query,
      service: params.filters?.service,
      level: params.filters?.level,
      timeRange: params.filters?.timeRange,
      limit: params.limit || 1000,
    });

    if (params.format === "csv") {
      return this.toCSV(logs);
    }
    return JSON.stringify(logs, null, 2);
  }

  private async fetchFromService<T>(path: string, params: Record<string, unknown>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });

    const response = await fetch(url.toString(), {
      headers: {
        "X-Internal-Token": process.env.INTERNAL_SERVICE_TOKEN || "",
      },
    });

    if (!response.ok) {
      throw new Error(`Log service error: ${response.status} ${response.statusText}`);
    }

    return response.json() as T;
  }

  // ============================================================================
  // Mock implementations
  // ============================================================================

  private searchMock(params: SearchLogsParams): LogEntry[] {
    let results = [...logStore];

    if (params.query) {
      const query = params.query.toLowerCase();
      results = results.filter(
        (log) =>
          log.message.toLowerCase().includes(query) ||
          log.service.toLowerCase().includes(query) ||
          log.error?.toLowerCase().includes(query)
      );
    }

    if (params.service) {
      results = results.filter((log) => log.service === params.service);
    }

    if (params.level) {
      const level = params.level.toUpperCase();
      results = results.filter((log) => log.level === level);
    }

    if (params.timeRange) {
      const now = Date.now();
      const ranges: Record<string, number> = {
        "1h": 3600000,
        "6h": 21600000,
        "24h": 86400000,
        "7d": 604800000,
        "30d": 2592000000,
      };
      const ms = ranges[params.timeRange] || 86400000;
      const cutoff = new Date(now - ms).toISOString();
      results = results.filter((log) => log.timestamp >= cutoff);
    }

    const offset = params.offset || 0;
    const limit = params.limit || 50;
    return results.slice(offset, offset + limit);
  }

  private getByServiceMock(params: GetLogsByServiceParams): LogEntry[] {
    let results = logStore.filter((log) => log.service === params.service);

    if (params.level) {
      const level = params.level.toUpperCase();
      results = results.filter((log) => log.level === level);
    }

    return results.slice(0, params.limit || 50);
  }

  private getByUserMock(params: GetLogsByUserParams): LogEntry[] {
    return logStore
      .filter((log) => log.userId === params.userId)
      .slice(0, params.limit || 50);
  }

  private getByTraceMock(params: GetLogsByTraceParams): LogEntry[] {
    return logStore
      .filter((log) => log.traceId === params.traceId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  private analyzeErrorsMock(params: AnalyzeErrorsParams): Record<string, unknown> {
    let errors = logStore.filter(
      (log) => log.level === "ERROR" || log.level === "FATAL"
    );

    if (params.service) {
      errors = errors.filter((log) => log.service === params.service);
    }

    if (params.timeRange) {
      const now = Date.now();
      const ranges: Record<string, number> = {
        "1h": 3600000,
        "6h": 21600000,
        "24h": 86400000,
        "7d": 604800000,
        "30d": 2592000000,
      };
      const ms = ranges[params.timeRange] || 86400000;
      const cutoff = new Date(now - ms).toISOString();
      errors = errors.filter((log) => log.timestamp >= cutoff);
    }

    // Count error patterns
    const patternCounts: Record<string, number> = {};
    const serviceCounts: Record<string, number> = {};
    const errorsByService: Record<string, LogEntry[]> = {};

    errors.forEach((error) => {
      // Count by service
      serviceCounts[error.service] = (serviceCounts[error.service] || 0) + 1;
      errorsByService[error.service] = errorsByService[error.service] || [];
      errorsByService[error.service].push(error);

      // Count by pattern
      for (const { pattern, category } of ERROR_PATTERNS) {
        if (pattern.test(error.message) || (error.error && pattern.test(error.error))) {
          patternCounts[category] = (patternCounts[category] || 0) + 1;
        }
      }
    });

    // Find most common error
    const sortedPatterns = Object.entries(patternCounts).sort((a, b) => b[1] - a[1]);
    const mostCommonError = sortedPatterns[0] || ["Unknown", 0];

    // Get recent errors for context
    const recentErrors = errors.slice(0, params.limit || 10);

    return {
      totalErrors: errors.length,
      errorsByService,
      errorPatterns: patternCounts,
      mostCommonError: {
        category: mostCommonError[0],
        count: mostCommonError[1],
      },
      topServicesByErrors: Object.entries(serviceCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([service, count]) => ({ service, count })),
      recentErrors,
    };
  }

  private getSlowRequestsMock(params: GetSlowRequestsParams): LogEntry[] {
    let results = logStore.filter(
      (log) => log.duration !== undefined && log.duration > 0
    );

    if (params.service) {
      results = results.filter((log) => log.service === params.service);
    }

    const threshold = params.thresholdMs || 1000;
    results = results.filter((log) => log.duration && log.duration > threshold);

    return results
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, params.limit || 20);
  }

  private toCSV(logs: LogEntry[]): string {
    const headers = [
      "id",
      "timestamp",
      "service",
      "level",
      "message",
      "userId",
      "traceId",
      "requestId",
      "duration",
      "statusCode",
      "method",
      "path",
      "error",
    ];

    const rows = logs.map((log) =>
      headers
        .map((h) => {
          const value = log[h as keyof LogEntry];
          if (typeof value === "string" && value.includes(",")) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value ?? "";
        })
        .join(",")
    );

    return [headers.join(","), ...rows].join("\n");
  }

  // Admin methods
  addLog(log: LogEntry): void {
    logStore.unshift(log);
  }

  getStats(): Record<string, unknown> {
    const now = Date.now();
    const hourAgo = now - 3600000;

    const logsLastHour = logStore.filter(
      (log) => new Date(log.timestamp).getTime() > hourAgo
    );

    const byLevel: Record<string, number> = {};
    const byService: Record<string, number> = {};

    logsLastHour.forEach((log) => {
      byLevel[log.level] = (byLevel[log.level] || 0) + 1;
      byService[log.service] = (byService[log.service] || 0) + 1;
    });

    return {
      totalLogs: logStore.length,
      logsLastHour: logsLastHour.length,
      byLevel,
      byService,
      connected: this.isConnected(),
      serviceUrl: this.baseUrl,
    };
  }
}

const logClient = new LogServiceClient();

// ============================================================================
// MCP Server
// ============================================================================

const server = new Server(
  {
    name: "rez-log-aggregator",
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
        name: "search_logs",
        description: "Search logs with query filters. Supports filtering by service, log level, message content, and time range.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query to match against log messages",
            },
            service: {
              type: "string",
              description: "Filter by service name (e.g., 'rez-auth-service', 'rez-payment-service')",
            },
            level: {
              type: "string",
              enum: ["DEBUG", "INFO", "WARN", "ERROR", "FATAL"],
              description: "Filter by log level",
            },
            timeRange: {
              type: "string",
              enum: ["1h", "6h", "24h", "7d", "30d"],
              description: "Time range for log search",
            },
            limit: {
              type: "number",
              description: "Maximum number of logs to return (default: 50)",
              default: 50,
            },
            offset: {
              type: "number",
              description: "Offset for pagination",
              default: 0,
            },
          },
        },
      },
      {
        name: "get_logs_by_service",
        description: "Get recent logs for a specific service. Returns logs sorted by timestamp descending.",
        inputSchema: {
          type: "object",
          properties: {
            service: {
              type: "string",
              description: "Service name (e.g., 'rez-auth-service', 'rez-payment-service')",
            },
            limit: {
              type: "number",
              description: "Maximum number of logs to return (default: 50)",
              default: 50,
            },
            level: {
              type: "string",
              enum: ["DEBUG", "INFO", "WARN", "ERROR", "FATAL"],
              description: "Filter by log level",
            },
          },
          required: ["service"],
        },
      },
      {
        name: "get_logs_by_user",
        description: "Get logs involving a specific user ID. Useful for tracing user activity and debugging user-specific issues.",
        inputSchema: {
          type: "object",
          properties: {
            userId: {
              type: "string",
              description: "User ID to search for (e.g., 'user_1234')",
            },
            limit: {
              type: "number",
              description: "Maximum number of logs to return (default: 50)",
              default: 50,
            },
          },
          required: ["userId"],
        },
      },
      {
        name: "get_logs_by_trace",
        description: "Get all logs for a specific trace ID. Trace IDs correlate logs across services for a single request.",
        inputSchema: {
          type: "object",
          properties: {
            traceId: {
              type: "string",
              description: "Trace ID to search for (e.g., 'trace_abc123def456')",
            },
          },
          required: ["traceId"],
        },
      },
      {
        name: "analyze_errors",
        description: "Analyze error patterns across logs. Returns categorized error counts, most common errors, and affected services.",
        inputSchema: {
          type: "object",
          properties: {
            service: {
              type: "string",
              description: "Filter errors by service name",
            },
            timeRange: {
              type: "string",
              enum: ["1h", "6h", "24h", "7d", "30d"],
              description: "Time range for error analysis",
            },
            limit: {
              type: "number",
              description: "Number of recent errors to include (default: 10)",
              default: 10,
            },
          },
        },
      },
      {
        name: "get_slow_requests",
        description: "Find slow API requests based on duration threshold. Helps identify performance bottlenecks.",
        inputSchema: {
          type: "object",
          properties: {
            service: {
              type: "string",
              description: "Filter by service name",
            },
            thresholdMs: {
              type: "number",
              description: "Duration threshold in milliseconds (default: 1000)",
              default: 1000,
            },
            limit: {
              type: "number",
              description: "Maximum number of slow requests to return (default: 20)",
              default: 20,
            },
          },
        },
      },
      {
        name: "export_logs",
        description: "Export logs to JSON or CSV format. Useful for analysis in external tools or generating reports.",
        inputSchema: {
          type: "object",
          properties: {
            format: {
              type: "string",
              enum: ["json", "csv"],
              description: "Export format",
            },
            filters: {
              type: "object",
              description: "Optional filters for exported logs",
              properties: {
                service: {
                  type: "string",
                  description: "Filter by service name",
                },
                level: {
                  type: "string",
                  enum: ["DEBUG", "INFO", "WARN", "ERROR", "FATAL"],
                  description: "Filter by log level",
                },
                timeRange: {
                  type: "string",
                  enum: ["1h", "6h", "24h", "7d", "30d"],
                  description: "Time range for logs",
                },
                query: {
                  type: "string",
                  description: "Search query",
                },
              },
            },
            limit: {
              type: "number",
              description: "Maximum number of logs to export (default: 1000)",
              default: 1000,
            },
          },
          required: ["format"],
        },
      },
      {
        name: "get_log_stats",
        description: "Get statistics about log volume, distribution by level, and service breakdown.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "search_logs": {
        const result = await logClient.search(args as SearchLogsParams);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  count: result.length,
                  logs: result,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_logs_by_service": {
        const params = args as unknown as GetLogsByServiceParams;
        const result = await logClient.getByService(params);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  service: params.service,
                  count: result.length,
                  logs: result,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_logs_by_user": {
        const params = args as unknown as GetLogsByUserParams;
        const result = await logClient.getByUser(params);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  userId: params.userId,
                  count: result.length,
                  logs: result,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_logs_by_trace": {
        const params = args as unknown as GetLogsByTraceParams;
        const result = await logClient.getByTrace(params);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  traceId: params.traceId,
                  count: result.length,
                  logs: result,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "analyze_errors": {
        const result = await logClient.analyzeErrors(args as AnalyzeErrorsParams);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_slow_requests": {
        const result = await logClient.getSlowRequests(args as GetSlowRequestsParams);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  count: result.length,
                  slowRequests: result,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "export_logs": {
        const result = await logClient.exportLogs(args as unknown as ExportLogsParams);
        return {
          content: [
            {
              type: "text",
              text: result,
            },
          ],
        };
      }

      case "get_log_stats": {
        const stats = logClient.getStats();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(stats, null, 2),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: `Unknown tool: ${name}`,
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
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.error("REZ Log Aggregator MCP Server running on stdio");
}

main().catch(console.error);
