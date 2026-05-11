# REZ Observability System

Comprehensive observability platform for the REZ ecosystem with logging, metrics, traces, and alerting capabilities.

## Features

### Logging (`/logs`)
- Structured logging with Winston
- Query by level, service, time range, trace ID
- Log statistics and filtering
- Log persistence with rotation

### Metrics (`/metrics`)
- Prometheus-compatible metrics
- Counters, Gauges, Histograms
- Time series data storage
- Built-in HTTP request metrics

### Traces (`/traces`)
- Distributed tracing
- Span management with events
- Trace aggregation and querying
- Service dependency tracking

### Alerts (`/alerts`)
- Configurable alert rules
- Threshold-based alerting
- Alert acknowledgment and resolution
- Cooldown management

## API Endpoints

### Health
```
GET /health
```

### Logs
```
GET  /logs           - Query logs with filters
GET  /logs/stats     - Log statistics
GET  /logs/:id       - Get log by ID
POST /logs           - Create log entry
```

### Metrics
```
GET  /metrics              - Prometheus format
GET  /metrics/time-series  - Time series data
GET  /metrics/all          - All metrics
GET  /metrics/summary      - Summary
POST /metrics/counter      - Increment counter
POST /metrics/gauge        - Set gauge
POST /metrics/histogram    - Observe histogram
```

### Traces
```
GET  /traces              - Query traces
GET  /traces/stats        - Trace statistics
GET  /traces/:traceId     - Get trace
GET  /spans/:spanId       - Get span
POST /traces/span/start   - Start span
POST /traces/span/end     - End span
POST /traces/span/event   - Add event
```

### Alerts
```
GET  /alerts              - Get alerts
GET  /alerts/stats        - Alert statistics
GET  /alerts/history      - Alert history
GET  /alerts/:id          - Get alert
POST /alerts/:id/ack      - Acknowledge
POST /alerts/:id/resolve  - Resolve
GET  /alerts/rules        - Get rules
POST /alerts/rules        - Create rule
POST /alerts/evaluate     - Evaluate rules
POST /alerts/metric       - Set metric
```

## Quick Start

```bash
# Install dependencies
npm install

# Build
npm run build

# Run
npm start
```

## Deploy to Render

### Option 1: render.yaml (Blueprint)
The `render.yaml` file configures automatic deployment. Connect your GitHub repo to Render and it will auto-deploy.

### Option 2: Manual Deploy
```bash
# Create new Web Service on Render
# Settings:
#   - Build Command: npm install && npm run build
#   - Start Command: npm start
#   - Plan: Free
#   - Port: 10000
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| NODE_ENV | development | Environment |

## Project Structure

```
REZ-observability-system/
├── src/
│   ├── index.ts       # Main entry point
│   ├── logger.ts      # Logging service
│   ├── metrics.ts     # Metrics collection
│   ├── traces.ts      # Distributed tracing
│   ├── alerts.ts      # Alert management
│   └── routes.ts      # API routes
├── package.json
├── tsconfig.json
├── render.yaml
└── README.md
```

## License

MIT
