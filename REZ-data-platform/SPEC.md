# REZ Data Platform - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Data Infrastructure

---

## Overview

Comprehensive data platform combining Lake, Warehouse, ETL, CDP, Governance, and Quality services. Provides end-to-end data infrastructure for the REZ ecosystem.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ Data Platform                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Components:                                                              │
│  ├── Data Lake (S3)      → Raw data storage                             │
│  ├── Data Warehouse       → Analytical queries                           │
│  ├── ETL Pipelines       → Data transformations                         │
│  ├── CDP                 → Customer data platform                        │
│  ├── Data Governance     → Catalog, lineage, policies                    │
│  └── Data Quality        → Validation, monitoring                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Lake (S3)

| Layer | Description |
|-------|-------------|
| Raw | Unprocessed source data |
| Processed | Cleaned and transformed |
| Analytics | Aggregated datasets |
| ML Features | Feature engineering output |

---

## API Endpoints

### Data
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/data/ingest` | Ingest data |
| GET | `/api/data/query` | Query warehouse |

### CDP
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cdp/profiles` | Customer profiles |
| POST | `/api/cdp/profiles/:id` | Update profile |

### Governance
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/governance/catalog` | Data catalog |
| GET | `/api/governance/lineage/:id` | Data lineage |

---

## Dependencies

```json
{
  "@aws-sdk/client-s3": "^3.540.0",
  "@aws-sdk/client-redshift-data": "^3.540.0",
  "fastify": "^4.26.2",
  "pg": "^8.11.5",
  "ioredis": "^5.3.2",
  "zod": "^3.22.4",
  "winston": "^3.12.0"
}
```

---

## Status

- [x] Service foundation
- [ ] Data lake
- [ ] Data warehouse
- [ ] ETL pipelines
- [ ] CDP features
- [ ] Data governance
- [ ] Data quality
