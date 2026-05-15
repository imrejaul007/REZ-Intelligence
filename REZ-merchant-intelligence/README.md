# REZ Merchant Intelligence Service

Merchant-facing dashboard service providing customer insights, predictions, recommendations, and performance metrics for REZ platform merchants.

## Overview

This service powers the merchant intelligence dashboard by aggregating customer data, generating AI-powered predictions, and delivering actionable recommendations to help merchants optimize their business performance.

## Features

- **Dashboard Overview**: Comprehensive merchant metrics including total customers, revenue, and repeat rates
- **Customer Segmentation**: Detailed breakdown of customer segments (Champions, Loyalists, At-Risk, etc.)
- **ML Predictions**: Churn prediction, repeat purchase likelihood, high LTV customer identification
- **Smart Recommendations**: Prioritized, actionable recommendations with expected impact
- **Industry Benchmarking**: Compare performance against similar merchants
- **Time-Series Metrics**: Historical performance data and trends

## Quick Start

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Production build
npm run build
npm start
```

## API Endpoints

### Health Check
```
GET /health
```

### Dashboard
```
GET /merchant/:merchantId/dashboard
```
Returns complete dashboard with overview, customers, predictions, and recommendations.

### Customer List
```
GET /merchant/:merchantId/customers
```
Query parameters:
- `limit` - Number of customers (default: 50)
- `segment` - Filter by segment name
- `sortBy` - Sort field (totalSpent, totalOrders, ltv, lastOrderDate)
- `order` - Sort order (asc, desc)

### Segment Breakdown
```
GET /merchant/:merchantId/segments
```
Returns detailed segment data with trends and growth metrics.

### Predictions
```
GET /merchant/:merchantId/predictions
```
Returns ML predictions including churn risk, repeat probability, and high LTV customers.

### Recommendations
```
GET /merchant/:merchantId/recommendations
```
Query parameters:
- `type` - Filter by type (retention, upsell, winback, acquisition)
- `priority` - Filter by priority (HIGH, MEDIUM, LOW)

### Industry Comparison
```
GET /merchant/:merchantId/compare
```
Compare merchant performance against industry benchmarks.

### Metrics
```
GET /merchant/:merchantId/metrics?period=30d
```
Query parameters:
- `period` - Time period (7d, 30d, 90d)

## Response Format

All endpoints return a consistent JSON structure:

```json
{
  "success": true,
  "data": { ... }
}
```

Error responses:
```json
{
  "success": false,
  "error": "Error Type",
  "message": "Detailed error message"
}
```

## Data Types

### MerchantDashboard
```typescript
interface MerchantDashboard {
  merchantId: string;
  overview: MerchantOverview;
  customers: CustomerInsights;
  predictions: PredictionSummary;
  recommendations: Recommendation[];
  lastUpdated: Date;
}
```

### Recommendation
```typescript
interface Recommendation {
  id: string;
  type: 'retention' | 'upsell' | 'winback' | 'acquisition';
  segment: string;
  action: string;
  expectedImpact: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  estimatedRevenue: number;
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 4014 |

## Service Integration

This service is designed to work with:
- **REZ-RFM-Service** (Port 4055) - RFM segmentation data
- **REZ-Intent-Graph** - Customer intent signals
- **REZ-Lead-Intelligence** - Lead scoring data

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Merchant Intelligence                     │
├─────────────────────────────────────────────────────────────┤
│  API Layer (Express)                                        │
│  ├── Dashboard Controller                                    │
│  ├── Customer Controller                                    │
│  ├── Prediction Controller                                 │
│  └── Recommendation Controller                              │
├─────────────────────────────────────────────────────────────┤
│  Service Layer                                              │
│  ├── Data Aggregation Service                               │
│  ├── ML Prediction Service                                  │
│  └── Recommendation Engine                                  │
├─────────────────────────────────────────────────────────────┤
│  Data Sources (Mock → Real implementations)                 │
│  ├── Customer Database                                      │
│  ├── Transaction Data                                       │
│  └── External Intelligence Services                         │
└─────────────────────────────────────────────────────────────┘
```

## TODO

- [ ] Connect to real customer database
- [ ] Integrate with RFM service for segment data
- [ ] Add real ML model predictions
- [ ] Implement caching layer (Redis)
- [ ] Add authentication middleware
- [ ] Webhook support for real-time updates

## License

Proprietary - REZ Platform
