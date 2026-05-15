import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// Environment configuration
const EVENT_BUS_URL = process.env.EVENT_BUS_URL || 'http://localhost:4031';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';
const USE_REAL_API = process.env.USE_REAL_EVENT_BUS === 'true';

// Event Store (in-memory fallback, connected to real event bus if configured)
const eventStore: Event[] = [];

interface Event {
  id: string;
  type: string;
  channel: string;
  source: string;
  userId?: string;
  merchantId?: string;
  data: Record<string, any>;
  timestamp: string;
  status: 'published' | 'processing' | 'processed' | 'failed';
}

interface DLQEvent {
  event: Event;
  error: string;
  failedAt: string;
  retryCount: number;
}

// Sample event types
const eventTypes = [
  'user.created',
  'user.updated',
  'user.deleted',
  'order.created',
  'order.updated',
  'order.completed',
  'order.cancelled',
  'payment.initiated',
  'payment.completed',
  'payment.failed',
  'reorder.triggered',
  'reorder.nudge_sent',
  'reorder.nudge_clicked',
  'reorder.nudge_converted',
  'notification.sent',
  'notification.failed'
];

// Real API helpers
async function fetchFromEventBus<T>(endpoint: string, options?: RequestInit): Promise<T | null> {
  if (!USE_REAL_API) return null;

  try {
    const response = await fetch(`${EVENT_BUS_URL}${endpoint}`, {
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
    console.error(`Event Bus API error (${endpoint}):`, error);
    return null;
  }
}

// MCP Tools
const tools = [
  {
    name: 'list_event_types',
    description: 'List all available event types in the REZ event bus.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_events',
    description: 'Query events from the event bus with filters.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Event type (e.g., order.completed)' },
        userId: { type: 'string', description: 'Filter by user ID' },
        merchantId: { type: 'string', description: 'Filter by merchant ID' },
        channel: { type: 'string', description: 'Event channel' },
        status: { type: 'string', enum: ['published', 'processing', 'processed', 'failed'] },
        from: { type: 'string', description: 'Start date (ISO 8601)' },
        to: { type: 'string', description: 'End date (ISO 8601)' },
        limit: { type: 'number', default: 50, description: 'Max events to return' }
      }
    }
  },
  {
    name: 'publish_event',
    description: 'Publish a new event to the event bus.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Event type', required: true },
        channel: { type: 'string', description: 'Channel', default: 'events' },
        userId: { type: 'string', description: 'User ID' },
        merchantId: { type: 'string', description: 'Merchant ID' },
        data: { type: 'object', description: 'Event payload', required: true }
      },
      required: ['type', 'data']
    }
  },
  {
    name: 'get_event_flow',
    description: 'Get the complete event flow for a specific entity (user, order, etc).',
    inputSchema: {
      type: 'object',
      properties: {
        entityType: { type: 'string', enum: ['user', 'order', 'merchant', 'payment'] },
        entityId: { type: 'string', description: 'Entity ID', required: true },
        hours: { type: 'number', default: 24, description: 'Hours to look back' }
      },
      required: ['entityId']
    }
  },
  {
    name: 'get_dlq_events',
    description: 'Get events in the dead letter queue (failed events).',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', default: 50 }
      }
    }
  },
  {
    name: 'retry_dlq_event',
    description: 'Retry a failed event from the DLQ.',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: { type: 'string', required: true }
      },
      required: ['eventId']
    }
  },
  {
    name: 'get_event_stats',
    description: 'Get event processing statistics.',
    inputSchema: {
      type: 'object',
      properties: {
        hours: { type: 'number', default: 24 }
      }
    }
  }
];

// Tool handlers
async function handleListEventTypes(): Promise<string> {
  return JSON.stringify({
    count: eventTypes.length,
    types: eventTypes,
    source: USE_REAL_API ? 'remote' : 'local'
  }, null, 2);
}

async function handleGetEvents(args: any): Promise<string> {
  // Try real API first if enabled
  if (USE_REAL_API) {
    const params = new URLSearchParams();
    if (args.type) params.append('type', args.type);
    if (args.userId) params.append('userId', args.userId);
    if (args.merchantId) params.append('merchantId', args.merchantId);
    if (args.channel) params.append('channel', args.channel);
    if (args.status) params.append('status', args.status);
    if (args.from) params.append('from', args.from);
    if (args.to) params.append('to', args.to);
    params.append('limit', String(args.limit || 50));

    const result = await fetchFromEventBus<{ events: Event[]; total: number }>(`/api/events?${params}`);
    if (result) {
      return JSON.stringify({
        count: result.events.length,
        total: result.total,
        source: 'remote',
        events: result.events
      }, null, 2);
    }
  }

  // Fall back to local event store
  let events = [...eventStore];

  if (args.type) {
    events = events.filter(e => e.type.includes(args.type));
  }
  if (args.userId) {
    events = events.filter(e => e.userId === args.userId);
  }
  if (args.merchantId) {
    events = events.filter(e => e.merchantId === args.merchantId);
  }
  if (args.channel) {
    events = events.filter(e => e.channel === args.channel);
  }
  if (args.status) {
    events = events.filter(e => e.status === args.status);
  }
  if (args.from) {
    events = events.filter(e => e.timestamp >= args.from);
  }
  if (args.to) {
    events = events.filter(e => e.timestamp <= args.to);
  }

  events = events.slice(0, args.limit || 50);

  return JSON.stringify({
    count: events.length,
    source: 'local',
    events
  }, null, 2);
}

async function handlePublishEvent(args: any): Promise<string> {
  const event: Event = {
    id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: args.type,
    channel: args.channel || 'events',
    source: 'mcp-client',
    userId: args.userId,
    merchantId: args.merchantId,
    data: args.data,
    timestamp: new Date().toISOString(),
    status: 'published'
  };

  // Try real API first if enabled
  if (USE_REAL_API) {
    const result = await fetchFromEventBus<Event>('/api/events', {
      method: 'POST',
      body: JSON.stringify(event)
    });

    if (result) {
      return JSON.stringify({
        success: true,
        source: 'remote',
        event: result
      }, null, 2);
    }
  }

  // Fall back to local store
  eventStore.unshift(event);

  return JSON.stringify({
    success: true,
    source: 'local',
    event
  }, null, 2);
}

async function handleGetEventFlow(args: any): Promise<string> {
  // Try real API first if enabled
  if (USE_REAL_API) {
    const result = await fetchFromEventBus<{ events: Event[] }>(
      `/api/events/flow/${args.entityType}/${args.entityId}?hours=${args.hours || 24}`
    );

    if (result) {
      return JSON.stringify({
        entityType: args.entityType,
        entityId: args.entityId,
        hoursLookback: args.hours,
        count: result.events.length,
        source: 'remote',
        timeline: result.events.map(e => ({
          timestamp: e.timestamp,
          type: e.type,
          status: e.status,
          summary: summarizeEvent(e)
        }))
      }, null, 2);
    }
  }

  // Fall back to local event store
  const entityField = args.entityType + 'Id';
  const events = eventStore
    .filter(e => (e as any)[entityField] === args.entityId)
    .filter(e => {
      const eventTime = new Date(e.timestamp).getTime();
      const hoursAgo = Date.now() - (args.hours * 60 * 60 * 1000);
      return eventTime >= hoursAgo;
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return JSON.stringify({
    entityType: args.entityType,
    entityId: args.entityId,
    hoursLookback: args.hours,
    count: events.length,
    source: 'local',
    timeline: events.map(e => ({
      timestamp: e.timestamp,
      type: e.type,
      status: e.status,
      summary: summarizeEvent(e)
    }))
  }, null, 2);
}

function summarizeEvent(event: Event): string {
  switch (event.type) {
    case 'order.completed': return `Order completed: Rs.${event.data?.total || 0}`;
    case 'reorder.triggered': return `Reorder nudge triggered for ${event.merchantId}`;
    case 'payment.failed': return `Payment failed: ${event.data?.reason || 'Unknown'}`;
    default: return `${event.type} event`;
  }
}

async function handleGetDLQEvents(args: any): Promise<string> {
  // Try real API first if enabled
  if (USE_REAL_API) {
    const result = await fetchFromEventBus<{ events: DLQEvent[] }>(`/api/events/dlq?limit=${args.limit || 50}`);
    if (result) {
      return JSON.stringify({
        count: result.events.length,
        source: 'remote',
        events: result.events
      }, null, 2);
    }
  }

  // Fall back to local event store
  const failedEvents = eventStore
    .filter(e => e.status === 'failed')
    .slice(0, args.limit || 50)
    .map(e => ({
      event: e,
      error: 'Processing failed',
      failedAt: e.timestamp,
      retryCount: 0
    }));

  return JSON.stringify({
    count: failedEvents.length,
    source: 'local',
    events: failedEvents
  }, null, 2);
}

async function handleRetryDLQEvent(args: any): Promise<string> {
  // Try real API first if enabled
  if (USE_REAL_API) {
    const result = await fetchFromEventBus<Event>(`/api/events/dlq/${args.eventId}/retry`, {
      method: 'POST'
    });

    if (result) {
      return JSON.stringify({
        success: true,
        source: 'remote',
        event: result
      }, null, 2);
    }
  }

  // Fall back to local event store
  const event = eventStore.find(e => e.id === args.eventId);

  if (!event) {
    return JSON.stringify({ error: 'Event not found' });
  }

  event.status = 'published';
  event.timestamp = new Date().toISOString();

  return JSON.stringify({
    success: true,
    source: 'local',
    event
  }, null, 2);
}

async function handleGetEventStats(args: any): Promise<string> {
  // Try real API first if enabled
  if (USE_REAL_API) {
    const result = await fetchFromEventBus<{ totalEvents: number; byType: Record<string, number>; byStatus: Record<string, number> }>(
      `/api/events/stats?hours=${args.hours || 24}`
    );

    if (result) {
      return JSON.stringify({
        period: `Last ${args.hours} hours`,
        totalEvents: result.totalEvents,
        eventsPerHour: (result.totalEvents / (args.hours || 24)).toFixed(2),
        byType: result.byType,
        byStatus: result.byStatus,
        topTypes: Object.entries(result.byType)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([type, count]) => ({ type, count })),
        source: 'remote'
      }, null, 2);
    }
  }

  // Fall back to local event store
  const hoursAgo = Date.now() - (args.hours * 60 * 60 * 1000);
  const recentEvents = eventStore.filter(e => new Date(e.timestamp).getTime() >= hoursAgo);

  const typeCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};

  recentEvents.forEach(e => {
    typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
    statusCounts[e.status] = (statusCounts[e.status] || 0) + 1;
  });

  return JSON.stringify({
    period: `Last ${args.hours} hours`,
    totalEvents: recentEvents.length,
    eventsPerHour: (recentEvents.length / args.hours).toFixed(2),
    byType: typeCounts,
    byStatus: statusCounts,
    topTypes: Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type, count })),
    source: 'local'
  }, null, 2);
}

// Create MCP Server
const server = new Server(
  {
    name: 'rez-event-bus',
    version: '1.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: string;

    switch (name) {
      case 'list_event_types':
        result = await handleListEventTypes();
        break;
      case 'get_events':
        result = await handleGetEvents(args || {});
        break;
      case 'publish_event':
        result = await handlePublishEvent(args);
        break;
      case 'get_event_flow':
        result = await handleGetEventFlow(args);
        break;
      case 'get_dlq_events':
        result = await handleGetDLQEvents(args || {});
        break;
      case 'retry_dlq_event':
        result = await handleRetryDLQEvent(args);
        break;
      case 'get_event_stats':
        result = await handleGetEventStats(args || {});
        break;
      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }

    return { content: [{ type: 'text', text: result }] };
  } catch (error) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: String(error) }) }], isError: true };
  }
});

async function main() {
  console.error('REZ Event Bus MCP running on stdio');
  console.error(`Event Bus URL: ${EVENT_BUS_URL}`);
  console.error(`Real API: ${USE_REAL_API ? 'ENABLED' : 'DISABLED (set USE_REAL_EVENT_BUS=true to enable)'}`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
