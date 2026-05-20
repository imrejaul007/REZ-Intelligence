# REZ Observability System - SPEC.md

**Version:** 1.0.0
**Port:** 4109
**Company:** REZ-Intelligence
**Category:** Infrastructure

---

## Overview

Platform-grade observability system providing centralized logging, metrics collection, distributed tracing, and alerting for the entire REZ ecosystem.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ Observability System                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  Components:                                                                │
│  ├── Logging      → Structured logs with Winston                          │
│  ├── Metrics      → Prometheus-format metrics with prom-client           │
│  ├── Traces       → Distributed request tracing                         │
│  └── Alerts       → Rule-based alerting system                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Logs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/logs` | Query logs |
| GET | `/logs/stats` | Log statistics |
| GET | `/logs/:id` | Get log by ID |
| POST | `/logs` | Create log entry |

### Metrics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/metrics` | Prometheus format |
| GET | `/metrics/time-series` | Time series data |
| GET | `/metrics/all` | All time series metrics |
| GET | `/metrics/summary` | Metrics summary |
| POST | `/metrics/counter` | Increment counter |
| POST | `/metrics/gauge` | Set gauge value |
| POST | `/metrics/histogram` | Observe histogram |

### Traces
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/traces` | Query traces |
| GET | `/traces/stats` | Trace statistics |
| GET | `/traces/:traceId` | Get trace by ID |
| GET | `/spans/:spanId` | Get span by ID |
| POST | `/traces/span/start` | Start new span |
| POST | `/traces/span/end` | End span |
| POST | `/traces/span/event` | Add span event |

### Alerts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/alerts` | Get all alerts |
| GET | `/alerts/stats` | Alert statistics |
| GET | `/alerts/history` | Alert history |
| GET | `/alerts/:alertId` | Get alert by ID |
| POST | `/alerts/:id/ack` | Acknowledge alert |
| POST | `/alerts/:id/resolve` | Resolve alert |
| GET | `/alerts/rules` | Get all alert rules |
| POST | `/alerts/rules` | Create alert rule |
| POST | `/alerts/evaluate` | Evaluate all rules |
| POST | `/alerts/metric` | Set metric value |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "winston": "^3.11.0",
  "prom-client": "^15.1.0",
  "uuid": "^9.0.1"
}
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| PORT | No | 4109 | Service port |
| NODE_ENV | No | development | Environment |

---

## Status

- [x] Service foundation
- [ ] Logging system
- [ ] Metrics collection
- [ ] Distributed tracing
- [ ] Alert rules engine
- [ ] Alert evaluation
