# REZ Reconciliation Service

Financial reconciliation service for daily balance checks, transaction verification, discrepancy detection, dispute handling, and audit reports.

## Overview

The REZ Reconciliation Service provides comprehensive financial reconciliation capabilities:
- Daily balance verification
- Transaction matching and verification
- Discrepancy detection and alerting
- Dispute management
- Audit report generation

## Features

- **Balance Reconciliation**: Verify end-of-day balances across systems
- **Transaction Matching**: Match transactions between source and target systems
- **Discrepancy Detection**: Identify and flag mismatches automatically
- **Dispute Handling**: Manage and track disputes
- **Audit Reports**: Generate compliance-ready audit reports
- **Scheduled Jobs**: Automated daily reconciliation runs

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Source System  │───▶│  Reconciliation │───▶│  Target System  │
│  (Payment, etc) │    │    Service      │    │  (Ledger, etc) │
└─────────────────┘    └────────┬────────┘    └─────────────────┘
                                │
                                ▼
                         ┌─────────────┐
                         │  PostgreSQL │
                         │  (Reports)  │
                         └─────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+

### Installation

```bash
npm install
npm run build
```

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

## API Endpoints

### Reconciliation

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reconciliation` | Get reconciliation status |
| POST | `/api/reconciliation/run` | Trigger reconciliation run |
| GET | `/api/reconciliation/discrepancies` | List discrepancies |

### Transactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transactions` | Query transactions |
| GET | `/api/transactions/:id` | Get transaction details |
| POST | `/api/transactions/match` | Match transactions |

### Disputes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/disputes` | List disputes |
| POST | `/api/disputes` | Create dispute |
| GET | `/api/disputes/:id` | Get dispute details |
| PATCH | `/api/disputes/:id` | Update dispute |

### Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/daily` | Daily reconciliation report |
| GET | `/api/reports/audit` | Audit report |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |

## Usage Examples

### Trigger Reconciliation

```bash
curl -X POST http://localhost:10000/api/reconciliation/run \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2026-05-01",
    "sourceSystem": "payment-gateway"
  }'
```

### Create Dispute

```bash
curl -X POST http://localhost:10000/api/disputes \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "TXN-123",
    "reason": "Amount mismatch",
    "claimedAmount": 100.00,
    "expectedAmount": 90.00
  }'
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 10000 | Service port |
| NODE_ENV | development | Environment |
| DATABASE_URL | - | PostgreSQL connection string |
| JWT_SECRET | - | JWT secret for authentication |
| RECONCILIATION_CRON_SCHEDULE | 0 2 * * * | Cron schedule for daily reconciliation |
| LOG_LEVEL | info | Logging level |

## Deploy to Render

The service is configured for Render deployment via `render.yaml`.

## License

MIT
