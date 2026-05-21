# REZ Observability - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Observability

---

## Overview

OpenTelemetry observability implementation for REZ Intelligence services. Provides distributed tracing, metrics collection, and context propagation across the platform.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ Observability                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Telemetry Types:                                                         │
│  ├── Traces     → Distributed request tracing                             │
│  ├── Metrics    → Application and system metrics                          │
│  └── Logs       → Structured logging with context                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  Instrumentation: HTTP, Express, MongoDB, Redis                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## OpenTelemetry Components

| Component | Package |
|-----------|---------|
| Trace SDK | @opentelemetry/sdk-trace-node |
| Metrics SDK | @opentelemetry/sdk-metrics |
| HTTP Instrumentation | @opentelemetry/instrumentation-http |
| Express Instrumentation | @opentelemetry/instrumentation-express |
| MongoDB Instrumentation | @opentelemetry/instrumentation-mongodb |
| Redis Instrumentation | @opentelemetry/instrumentation-redis |

---

## Exporters

| Exporter | Protocol | Purpose |
|----------|----------|---------|
| OTLP HTTP | HTTP | Export to collector |

---

## Dependencies

```json
{
  "@opentelemetry/api": "^1.7.0",
  "@opentelemetry/sdk-node": "^0.45.0",
  "@opentelemetry/sdk-trace-node": "^1.18.0",
  "@opentelemetry/sdk-metrics": "^1.18.0",
  "@opentelemetry/exporter-trace-otlp-http": "^0.45.0",
  "@opentelemetry/exporter-metrics-otlp-http": "^0.45.0"
}
```

---

## Status

- [x] Observability foundation
- [x] Tracing setup
- [x] Metrics setup
- [x] HTTP instrumentation
- [x] MongoDB instrumentation
- [x] Redis instrumentation
- [ ] Custom metrics
- [ ] Alerting integration
