# REZ Data Warehouse - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Data Infrastructure

---

## Overview

ETL pipelines and analytics aggregations for the REZ data warehouse. Processes data from various sources into analytics-ready datasets.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ Data Warehouse                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Pipeline Types:                                                          │
│  ├── Daily ETL    → Daily data processing                               │
│  ├── Real-time   → Streaming data processing                            │
│  └── Aggregations → Pre-computed analytics                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  Data Sources: Commerce, Analytics, Intelligence                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Pipeline Types

### Daily ETL
| Pipeline | Description |
|----------|-------------|
| User Activity | Daily user behavior aggregation |
| Revenue | Daily revenue calculations |
| Inventory | Daily stock summaries |

### Aggregations
| Aggregation | Description |
|------------|-------------|
| RFM Scores | Customer segmentation |
| Cohort Analysis | User cohort metrics |
| Funnel Analysis | Conversion funnels |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "axios": "^1.6.0",
  "winston": "^3.11.0"
}
```

---

## Status

- [x] Service foundation
- [ ] ETL pipelines
- [ ] Daily aggregations
- [ ] Real-time processing
- [ ] Analytics datasets
