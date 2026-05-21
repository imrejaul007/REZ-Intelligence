# REZ Lakehouse - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Data Infrastructure

---

## Overview

Data lakehouse combining the flexibility of data lakes with the reliability of data warehouses. Provides Delta Lake storage, ETL pipelines, and an analytics layer for unified data processing.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        REZ Lakehouse                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  Layers:                                                                  │
│  ├── Bronze (Raw)      → S3 raw data ingestion                            │
│  ├── Silver (Cleaned)  → Processed & validated data                       │
│  ├── Gold (Curated)   → Business-ready aggregates                         │
│  └── ML Features      → Feature engineering output                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  Components:                                                              │
│  ├── Delta Lake     → ACID transactions on S3                           │
│  ├── ETL Pipeline   → Data transformation jobs                           │
│  └── Analytics API  → Query interface                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Storage Layers

| Layer | Description | Retention |
|-------|-------------|-----------|
| Bronze | Raw ingested data | 90 days |
| Silver | Cleaned & validated | 1 year |
| Gold | Aggregated & curated | 2 years |
| ML Features | Feature store | 90 days |

---

## API Endpoints

### Data Ingestion
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ingest` | Ingest data to bronze |
| POST | `/api/ingest/batch` | Batch ingestion |

### ETL Jobs
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/jobs` | Create ETL job |
| GET | `/api/jobs/:id` | Get job status |
| POST | `/api/jobs/:id/run` | Trigger job run |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/query` | Execute analytics query |
| GET | `/api/catalog` | Data catalog |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "ioredis": "^5.3.0",
  "aws-sdk": "^2.1500.0",
  "winston": "^3.11.0"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ Data Platform | Read/Write | Data pipeline |
| REZ Feature Store | Write | ML features |
| REZ Analytics | Read | Query interface |
| RABTUL Services | Read | Business data |

---

## Status

- [x] Lakehouse foundation
- [ ] Delta Lake implementation
- [ ] ETL pipeline
- [ ] Analytics layer
- [ ] ML feature export
