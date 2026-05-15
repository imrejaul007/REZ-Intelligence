# REZ Log Aggregator MCP Server

MCP server for log aggregation, search, and analysis across REZ services.

## Features

- **Search Logs**: Full-text search across all services with filters
- **Service Logs**: Query logs by specific service
- **User Activity**: Trace user activity across services
- **Trace Analysis**: Get all logs for a trace ID
- **Error Analysis**: Identify error patterns and trends
- **Performance Analysis**: Find slow requests and bottlenecks
- **Export**: Export logs to JSON or CSV

## Available Tools

| Tool | Description |
|------|-------------|
| `search_logs` | Search logs with query filters (service, level, message, timeRange) |
| `get_logs_by_service` | Get recent logs for a specific service |
| `get_logs_by_user` | Get logs involving a specific user ID |
| `get_logs_by_trace` | Get all logs for a trace ID |
| `analyze_errors` | Analyze error patterns and trends |
| `get_slow_requests` | Find slow API requests |
| `export_logs` | Export logs to JSON or CSV format |
| `get_log_stats` | Get statistics about log volume |

## Installation

```bash
cd rez-mcp-logs
npm install
npm run build
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_SERVICE_URL` | URL for external log service | Uses mock data |
| `INTERNAL_SERVICE_TOKEN` | Service authentication token | Required for external service |

### External Log Service

To connect to an external log aggregation service (Elasticsearch, Loki, etc.):

```bash
export LOG_SERVICE_URL=https://log-service.example.com
export INTERNAL_SERVICE_TOKEN=your-token
```

## Usage

### Development (with mock data)

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

### Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "rez-logs": {
      "command": "node",
      "args": ["/path/to/rez-mcp-logs/dist/index.js"],
      "env": {
        "LOG_SERVICE_URL": "https://log-service.example.com",
        "INTERNAL_SERVICE_TOKEN": "your-token"
      }
    }
  }
}
```

## Tool Examples

### Search Logs

```javascript
{
  name: "search_logs",
  arguments: {
    query: "payment failed",
    service: "rez-payment-service",
    level: "ERROR",
    timeRange: "24h",
    limit: 50
  }
}
```

### Get Logs by Service

```javascript
{
  name: "get_logs_by_service",
  arguments: {
    service: "rez-auth-service",
    limit: 100,
    level: "ERROR"
  }
}
```

### Analyze Errors

```javascript
{
  name: "analyze_errors",
  arguments: {
    service: "rez-payment-service",
    timeRange: "7d",
    limit: 20
  }
}
```

### Export Logs

```javascript
{
  name: "export_logs",
  arguments: {
    format: "csv",
    filters: {
      service: "rez-dooh-service",
      level: "ERROR",
      timeRange: "30d"
    },
    limit: 5000
  }
}
```

## Supported Services

The MCP server includes mock data for these REZ services:

- `rez-auth-service` (Port 3000)
- `rez-payment-service` (Port 4001)
- `rez-order-service` (Port 4003)
- `rez-notifications-service` (Port 4004)
- `rez-search-service` (Port 4005)
- `rez-analytics-service` (Port 4006)
- `rez-dooh-service` (Port 4018)
- `rez-fraud-service` (Port 4022)
- `REZ-marketing-service` (Port 4026)
- `rez-shopify-connector` (Port 4050)
- `rez-woocommerce-connector` (Port 4051)
- `REZ-prompt-workflow-ai` (Port 4054)
- `REZ-crm-hub` (Port 4056)
- `rez-voice-cart-recovery` (Port 4053)

## Log Entry Format

```typescript
interface LogEntry {
  id: string;           // Unique log ID
  timestamp: string;    // ISO 8601 timestamp
  service: string;      // Service name
  level: "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";
  message: string;      // Log message
  userId?: string;       // User ID if applicable
  traceId?: string;     // Trace ID for request correlation
  requestId?: string;  // Request ID
  duration?: number;    // Request duration in ms
  statusCode?: number;  // HTTP status code
  method?: string;      // HTTP method
  path?: string;        // Request path
  error?: string;       // Error message
  stack?: string;       // Stack trace
  metadata?: object;    // Additional metadata
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Client (Claude)                       │
└─────────────────────────┬───────────────────────────────────┘
                          │ JSON-RPC over stdio
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              REZ Log Aggregator MCP Server                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Tool Handlers                            │   │
│  │  search_logs | get_logs_by_* | analyze_errors       │   │
│  │  get_slow_requests | export_logs | get_log_stats    │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Log Service Client                      │   │
│  │  External Service (LOG_SERVICE_URL)                 │   │
│  │           OR                                         │   │
│  │  Mock Data Store (500 generated logs)               │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Error Handling

The server returns structured error responses:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Error: Connection refused to log service"
    }
  ],
  "isError": true
}
```

## License

Proprietary - RABTUL Technologies
