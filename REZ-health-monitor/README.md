# REZ Health Monitor Service

Production-ready health monitoring service for the REZ Intelligence platform with circuit breaker support.

## Features

- **Service Health Monitoring**: Ping all configured services every 30 seconds
- **Circuit Breaker Pattern**: Prevents cascading failures with configurable thresholds
  - Opens after 3 consecutive failures
  - Auto-recovers after 30 seconds (half-open state)
  - Allows 1 test request in half-open state
- **Alerting**: Webhook notifications for service failures
- **Real-time Dashboard**: Web UI showing service health and circuit breaker states
- **REST API**: Full programmatic access to health data and circuit breaker management

## Quick Start

```bash
cd REZ-health-monitor
npm install
npm run build
npm start
```

The service will start on port 4095 (configurable via `PORT` environment variable).

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 4095 | Service port |
| `NODE_ENV` | development | Environment mode |
| `REDIS_URL` | redis://localhost:6379 | Redis connection URL |
| `HEALTH_CHECK_INTERVAL_MS` | 30000 | Health check interval (30s) |
| `HEALTH_CHECK_TIMEOUT_MS` | 5000 | Health check request timeout (5s) |
| `CIRCUIT_BREAKER_FAILURE_THRESHOLD` | 3 | Failures before circuit opens |
| `CIRCUIT_BREAKER_RESET_TIMEOUT_MS` | 30000 | Time before retry (30s) |
| `CIRCUIT_BREAKER_HALF_OPEN_MAX_CALLS` | 1 | Test requests in half-open state |
| `ALERT_WEBHOOK_URL` | - | Webhook URL for alerts |
| `LOG_LEVEL` | info | Logging level |

### Custom Services Configuration

To monitor custom services, set the `SERVICES_CONFIG` environment variable:

```bash
SERVICES_CONFIG='[{"name":"my-service","url":"http://localhost:3000/health","category":"custom"}]'
```

## API Endpoints

### Health Check Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Basic health check |
| GET | `/health/all` | All services health status |
| GET | `/health/:serviceName` | Specific service health |
| GET | `/health/:serviceName/detailed` | Detailed health with circuit info |

### Circuit Breaker Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/circuits` | All circuit breaker states |
| GET | `/circuits/:serviceName` | Specific circuit state |
| POST | `/circuits/:serviceName/reset` | Reset circuit breaker |
| POST | `/circuits/:serviceName/state` | Force circuit state |

### Alert Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/alerts` | Recent alerts (limit param supported) |
| GET | `/alerts/:serviceName` | Alerts for specific service |

### Service Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/services` | List monitored services |
| POST | `/services` | Add service to monitor |
| DELETE | `/services/:serviceName` | Remove service from monitoring |

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard` | Web UI dashboard |

## Response Examples

### Health All Response

```json
{
  "success": true,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "summary": {
    "total": 28,
    "healthy": 25,
    "degraded": 2,
    "down": 1,
    "overallStatus": "degraded",
    "unavailableServices": ["rez-service-x"]
  },
  "services": [
    {
      "name": "rez-hospitality-expert",
      "status": "healthy",
      "latency": 45,
      "uptime": 99.9,
      "error": null,
      "timestamp": "2024-01-15T10:30:00.000Z",
      "circuitState": "closed"
    }
  ]
}
```

### Circuit Breaker Response

```json
{
  "success": true,
  "circuits": [
    {
      "name": "my-service",
      "state": "closed",
      "failures": 5,
      "successes": 120,
      "lastFailure": null,
      "lastSuccess": "2024-01-15T10:30:00.000Z",
      "lastStateChange": "2024-01-15T09:00:00.000Z",
      "consecutiveFailures": 0
    }
  ],
  "summary": {
    "total": 28,
    "closed": 27,
    "open": 1,
    "halfOpen": 0,
    "totalCircuitsOpened": 3,
    "totalRecoveries": 2,
    "lastReset": "2024-01-15T08:00:00.000Z"
  }
}
```

## Circuit Breaker States

```
CLOSED ──(failures >= threshold)──> OPEN
   ^                                 │
   │                                 │
   │ (success in half-open)         │ (timeout elapsed)
   │                                 v
   │                              HALF_OPEN
   │                                 │
   │                                 │ (failure in half-open)
   │ <────────────────────────────────┘
   │ (success continues)
   │
   (failures reset on success)
```

## Integration with Expert Services

Each expert service should implement the following health endpoints:

### GET /health
Basic liveness probe (Kubernetes liveness)

```json
{
  "status": "healthy",
  "service": "rez-hospitality-expert",
  "version": "1.0.0",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600.5
}
```

### GET /health/detailed
Readiness probe with dependency checks (Kubernetes readiness)

```json
{
  "status": "healthy",
  "service": "rez-hospitality-expert",
  "version": "1.0.0",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600.5,
  "dependencies": {
    "mongodb": "connected",
    "redis": "connected",
    "coreBrain": "connected"
  }
}
```

### GET /health/ready
Kubernetes readiness probe

```json
{
  "ready": true,
  "checks": {
    "database": true,
    "cache": true,
    "dependencies": true
  }
}
```

## Alerting

Configure a webhook URL to receive alerts:

```bash
ALERT_WEBHOOK_URL=https://your-webhook-endpoint.com/alerts
```

Alerts are sent when:
- Circuit breaker opens (service repeatedly failing)
- Circuit breaker transitions to half-open (recovery attempt)

### Slack Integration

The webhook payload is formatted for Slack:

```json
{
  "text": ":red_circle: *CIRCUIT_OPENED*\n*Service:* my-service\n*Message:* my-service is down: Connection refused",
  "blocks": [...]
}
```

## License

MIT
