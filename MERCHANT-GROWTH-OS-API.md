# MERCHANT GROWTH OS - COMPLETE API DOCUMENTATION

**Version:** 1.0  
**Date:** June 4, 2026  
**Base URL:** `http://localhost:{port}`

---

## TABLE OF CONTENTS

1. [Budget Optimizer (4290)](#1-rez-budget-optimizer---port-4290)
2. [Growth Playbook (4291)](#2-rez-growth-playbook---port-4291)
3. [Incrementality Testing (4292)](#3-rez-incrementality-testing---port-4292)
4. [Merchant Health Score (4293)](#4-rez-merchant-health-score---port-4293)
5. [Offline Attribution (4294)](#5-rez-offline-attribution---port-4294)
6. [Competitor Alerts (4295)](#6-rez-competitor-alerts---port-4295)
7. [Review Response Engine (4296)](#7-rez-review-response-engine---port-4296)
8. [Unified Offer Brain (4297)](#8-rez-unified-offer-brain---port-4297)
9. [Autonomous Growth Agent (4298)](#9-rez-autonomous-growth-agent---port-4298)
10. [Prompt Studio (4299)](#10-rez-prompt-studio---port-4299)
11. [Approval UI (4211)](#11-rez-approval-ui---port-4211)
12. [Real Pricing Tracker (4212)](#12-rez-real-pricing-tracker---port-4212)
13. [Revenue Forecast (4213)](#13-rez-revenue-forecast---port-4213)
14. [Neighborhood Analytics (4214)](#14-rez-neighborhood-analytics---port-4214)
15. [Visual Workflow Builder (3000)](#15-rez-visual-workflow-builder---port-3000)

---

## 1. REZ Budget Optimizer - Port 4290

AI-powered campaign budget allocation and optimization.

### Endpoints

#### `GET /health`
Health check.

#### `POST /api/optimize`
Optimize budget allocation across channels.

```json
Request:
{
  "merchantId": "merchant_123",
  "totalBudget": 100000,
  "strategy": "roas_based",
  "minChannelBudget": 5000,
  "excludeChannels": ["dooh"]
}

Response:
{
  "allocations": [
    {
      "channel": "instagram",
      "amount": 35000,
      "percentage": 35,
      "expectedRoas": 3.5,
      "reason": "High allocation due to strong ROAS performance"
    }
  ],
  "totalBudget": 100000,
  "expectedTotalRoas": 3.2,
  "confidence": 0.85
}
```

#### `POST /api/campaigns`
Create campaign.

```json
Request:
{
  "merchantId": "merchant_123",
  "name": "Summer Sale",
  "channel": "instagram",
  "currentBudget": 25000
}
```

#### `PATCH /api/campaigns/:id/spend`
Update campaign spend.

```json
Request:
{
  "spent": 5000,
  "revenue": 15000,
  "conversions": 50
}
```

#### `GET /api/channels/performance`
Get channel performance metrics.

#### `GET /api/campaigns/:merchantId`
Get all campaigns for merchant.

#### `POST /api/experiments`
Create A/B experiment.

```json
Request:
{
  "merchantId": "merchant_123",
  "name": "Budget Allocation Test",
  "strategy": "roas_based",
  "totalBudget": 50000,
  "controlGroupPercentage": 10
}
```

---

## 2. REZ Growth Playbook - Port 4291

Pre-built growth playbooks library.

### Endpoints

#### `GET /health`
Health check.

#### `GET /api/playbooks`
Get all playbooks (with optional filters).

Query params: `?industry=restaurant&category=traffic&goal=increase_visits`

#### `GET /api/playbooks/:id`
Get specific playbook.

#### `GET /api/playbooks/industry/:industry`
Get playbooks by industry.

#### `GET /api/categories`
Get all categories.

#### `GET /api/industries`
Get all industries.

#### `POST /api/recommend`
Get playbook recommendations.

```json
Request:
{
  "industry": "restaurant",
  "goals": ["increase_lunch_visits"],
  "budget": 15000
}

Response:
[
  {
    "id": "lunch-rush-boost",
    "name": "Lunch Rush Boost",
    "difficulty": "beginner",
    "budget": { "min": 5000, "max": 20000 }
  }
]
```

#### `POST /api/usage`
Save playbook for merchant.

#### `GET /api/usage/:merchantId`
Get merchant's saved playbooks.

---

## 3. REZ Incrementality Testing - Port 4292

Measure true campaign lift with control experiments.

### Endpoints

#### `GET /health`
Health check.

#### `POST /api/experiments`
Create incrementality experiment.

```json
Request:
{
  "merchantId": "merchant_123",
  "name": "WhatsApp vs SMS Test",
  "type": "channel",
  "hypothesis": "WhatsApp outperforms SMS by 20%",
  "testGroupPercentage": 50,
  "investment": 10000,
  "startDate": "2024-01-01",
  "endDate": "2024-01-14"
}
```

#### `GET /api/experiments/:merchantId`
Get all experiments.

#### `PATCH /api/experiments/:id/status`
Update experiment status.

```json
Request: { "status": "running" }
```

#### `POST /api/experiments/:id/results`
Record experiment results.

```json
Request:
{
  "testGroup": {
    "size": 5000,
    "converted": 250,
    "revenue": 125000,
    "conversionRate": 5.0
  },
  "controlGroup": {
    "size": 5000,
    "converted": 180,
    "revenue": 90000,
    "conversionRate": 3.6
  }
}

Response:
{
  "results": {
    "lift": { "revenue": 38.9, "conversionRate": 38.9 },
    "statistical": { "confidence": 99.2, "pValue": 0.008, "isSignificant": true },
    "roi": 250,
    "incrementalRevenue": 35000
  }
}
```

#### `GET /api/reports/:merchantId`
Get incrementality report.

---

## 4. REZ Merchant Health Score - Port 4293

Composite merchant health scoring.

### Endpoints

#### `GET /health`
Health check.

#### `POST /api/score`
Calculate health score.

```json
Request:
{
  "merchantId": "merchant_123",
  "industry": "restaurant",
  "revenue": { "current": 500000, "previous": 450000, "target": 600000 },
  "customers": { "total": 1000, "new": 100, "active": 700, "churned": 50, "returning": 600 },
  "engagement": { "loyaltyMembers": 300, "referrals": 50, "reviews": 200, "avgRating": 4.5 },
  "operational": { "avgOrderValue": 500, "ordersPerDay": 100, "fulfillmentRate": 95 }
}

Response:
{
  "merchantId": "merchant_123",
  "score": 78,
  "tier": "gold",
  "components": {
    "revenue": { "score": 82, "trend": 11.1 },
    "customer": { "score": 75 },
    "engagement": { "score": 80 }
  },
  "risks": []
}
```

#### `GET /api/score/:merchantId`
Get existing score.

#### `GET /api/scores`
Get all scores with filters.

Query params: `?tier=gold&industry=restaurant&minScore=70`

#### `GET /api/alerts/:merchantId`
Get risk alerts.

#### `GET /api/benchmarks/:industry`
Get industry benchmarks.

---

## 5. REZ Offline Attribution - Port 4294

Track offline conversions.

### Endpoints

#### `GET /health`
Health check.

#### `POST /api/touchpoints/qr`
Record QR scan touchpoint.

```json
Request:
{
  "merchantId": "merchant_123",
  "customerId": "cust_456",
  "qrCodeId": "qr_table_5"
}
```

#### `POST /api/touchpoints/call`
Record phone call touchpoint.

```json
Request:
{
  "merchantId": "merchant_123",
  "customerId": "cust_456",
  "phoneNumber": "+919876543210",
  "callDuration": 180
}
```

#### `POST /api/conversions`
Record offline conversion.

```json
Request:
{
  "merchantId": "merchant_123",
  "customerId": "cust_456",
  "type": "purchase",
  "revenue": 2500,
  "attributionData": { "model": "position_based" }
}
```

#### `GET /api/touchpoints/:merchantId`
Get touchpoints with filters.

Query params: `?channel=qr_scan&startDate=2024-01-01`

#### `GET /api/reports/:merchantId/channel`
Get channel attribution report.

#### `GET /api/journey/:merchantId/:customerId`
Get customer journey.

---

## 6. REZ Competitor Alerts - Port 4295

Real-time competitor monitoring.

### Endpoints

#### `GET /health`
Health check.

#### `POST /api/competitors`
Add competitor.

```json
Request:
{
  "merchantId": "merchant_123",
  "name": "Competitor Restaurant",
  "sources": [{ "type": "google", "url": "https://maps.google.com/..." }]
}
```

#### `GET /api/competitors/:merchantId`
Get competitors.

#### `POST /api/prices`
Record price snapshot.

```json
Request:
{
  "competitorId": "comp_123",
  "merchantId": "merchant_123",
  "items": [{ "name": "Burger", "price": 199, "originalPrice": 249 }]
}
```

#### `POST /api/campaigns`
Track competitor campaign.

```json
Request:
{
  "competitorId": "comp_123",
  "merchantId": "merchant_123",
  "platform": "instagram",
  "type": "discount",
  "discount": 25
}
```

#### `GET /api/alerts/:merchantId`
Get alerts.

Query params: `?status=new&severity=high`

#### `GET /api/alerts/:merchantId/count`
Get unread alert count.

#### `POST /api/alerts/:id/dismiss`
Dismiss alert.

#### `GET /api/insights/:merchantId`
Get competitive insights.

---

## 7. REZ Review Response Engine - Port 4296

AI-powered review responses.

### Endpoints

#### `GET /health`
Health check.

#### `POST /api/reviews/ingest`
Ingest review.

```json
Request:
{
  "merchantId": "merchant_123",
  "platform": "google",
  "rating": 4,
  "text": "Great food and service!",
  "customerName": "John D."
}
```

#### `GET /api/reviews/:merchantId`
Get reviews.

Query params: `?sentiment=negative&status=pending`

#### `POST /api/reviews/:id/respond`
Generate AI response.

```json
Response:
{
  "response": {
    "text": "Thank you for your kind words!",
    "confidence": 0.95,
    "alternatives": []
  }
}
```

#### `POST /api/reviews/:id/approve`
Approve and post response.

```json
Request:
{
  "responseText": "Thank you!",
  "approvedBy": "manager_123"
}
```

#### `GET /api/reviews/:merchantId/sentiment-stats`
Get sentiment statistics.

#### `GET /api/reviews/:merchantId/escalations`
Get escalated reviews.

---

## 8. REZ Unified Offer Brain - Port 4297

Centralized offer intelligence.

### Endpoints

#### `GET /health`
Health check.

#### `POST /api/offers`
Create offer.

```json
Request:
{
  "merchantId": "merchant_123",
  "name": "Weekend Cashback",
  "type": "cashback",
  "value": 20,
  "minOrderValue": 500,
  "channels": ["whatsapp", "sms"],
  "startDate": "2024-01-01",
  "endDate": "2024-01-31"
}
```

#### `GET /api/offers/:merchantId`
Get all offers.

#### `POST /api/offers/:id/recommend`
Get personalized offer recommendation.

```json
Request:
{
  "customerId": "cust_456",
  "context": { "timeOfDay": "lunch", "dayOfWeek": "friday" }
}

Response:
{
  "recommendedOffer": { "id": "offer_123", "name": "Weekend Cashback" },
  "confidence": 0.85
}
```

#### `POST /api/offers/:id/optimize`
Optimize offer parameters.

#### `GET /api/offers/:merchantId/performance`
Get offer performance metrics.

---

## 9. REZ Autonomous Growth Agent - Port 4298

Self-managing growth experiments.

### Endpoints

#### `GET /health`
Health check.

#### `POST /api/experiments`
Create growth experiment.

```json
Request:
{
  "merchantId": "merchant_123",
  "name": "Lunch Traffic Boost",
  "goal": "increase_lunch_visits",
  "targetMetric": "lunch_orders",
  "targetValue": 100,
  "duration": 14,
  "budget": 20000
}
```

#### `GET /api/experiments/:merchantId`
Get experiments.

#### `POST /api/experiments/:id/start`
Start experiment.

#### `GET /api/experiments/:id/results`
Get experiment results.

#### `POST /api/experiments/:id/scale`
Scale winning experiment.

---

## 10. REZ Prompt Studio - Port 4299

Prompt versioning and A/B testing.

### Endpoints

#### `GET /health`
Health check.

#### `POST /api/prompts`
Create prompt.

```json
Request:
{
  "name": "Welcome Message",
  "description": "AI message for new customers",
  "merchantId": "m_123",
  "content": "Welcome {{customerName}}!",
  "variables": [{ "name": "customerName", "type": "string" }]
}
```

#### `GET /api/prompts/:merchantId`
Get prompts.

#### `PUT /api/prompts/:promptId/versions`
Update prompt (creates new version).

```json
Request:
{
  "content": "New improved content...",
  "changeDescription": "Updated tone"
}
```

#### `POST /api/prompts/:promptId/rollback`
Rollback to previous version.

```json
Request:
{
  "targetVersion": 3,
  "reason": "New version causing issues"
}
```

#### `POST /api/tests`
Create A/B test.

```json
Request:
{
  "promptId": "p_123",
  "name": "Test A vs B",
  "variants": [
    { "versionId": "v1", "percentage": 50 },
    { "versionId": "v2", "percentage": 50 }
  ]
}
```

---

## 11. REZ Approval UI - Port 4211

Human-in-the-loop approval dashboard.

### Frontend Routes

- `GET /` - Approval dashboard (Next.js app)

### Features (Frontend UI)

- Pending approvals queue
- Quick approve/reject/escalate
- Content preview
- Priority levels (urgent, high, medium, low)
- Status tracking

---

## 12. REZ Real Pricing Tracker - Port 4212

Real-time competitor pricing.

### Endpoints

#### `GET /health`
Health check.

#### `POST /api/competitors`
Add competitor.

#### `GET /api/competitors/:merchantId`
Get competitors.

#### `POST /api/scrape/:competitorId`
Trigger price scrape.

#### `POST /api/scrape/batch/:merchantId`
Batch scrape all competitors.

#### `GET /api/prices/:competitorId/history`
Get price history.

Query params: `?days=30`

#### `GET /api/prices/compare/:merchantId`
Get price comparison.

#### `GET /api/alerts/:merchantId`
Get price alerts.

#### `GET /api/alerts/:merchantId/counts`
Get alert counts by type.

---

## 13. REZ Revenue Forecast - Port 4213

AI-powered revenue prediction.

### Endpoints

#### `GET /health`
Health check.

#### `POST /api/revenue`
Record revenue data.

```json
Request:
{
  "merchantId": "merchant_123",
  "date": "2024-01-15",
  "revenue": 45000,
  "orders": 120,
  "customers": 100,
  "newCustomers": 20
}
```

#### `GET /api/forecast/:merchantId/today`
Get today's prediction.

```json
Response:
{
  "merchantId": "merchant_123",
  "date": "2024-01-15",
  "predicted": 48000,
  "confidence": 85,
  "lower": 40800,
  "upper": 55200
}
```

#### `GET /api/forecast/:merchantId/week`
Get weekly forecast.

#### `GET /api/forecast/:merchantId/month`
Get monthly forecast.

#### `POST /api/forecast/campaign-impact`
Predict campaign impact.

```json
Request:
{
  "merchantId": "merchant_123",
  "campaignType": "cashback",
  "budget": 10000,
  "duration": 7
}

Response:
{
  "expectedConversions": 150,
  "expectedRevenue": 75000,
  "expectedLift": 15,
  "confidence": 75
}
```

#### `GET /api/revenue/:merchantId`
Get revenue history.

#### `GET /api/revenue/:merchantId/stats`
Get revenue statistics.

---

## 14. REZ Neighborhood Analytics - Port 4214

Hyperlocal intelligence.

### Endpoints

#### `GET /health`
Health check.

#### `POST /api/neighborhoods`
Register neighborhood.

```json
Request:
{
  "name": "Koramangala",
  "city": "Bangalore",
  "coordinates": { "type": "Point", "coordinates": [77.61, 12.93] }
}
```

#### `GET /api/neighborhoods/nearby`
Find nearby neighborhoods.

Query params: `?lat=12.97&lng=77.59&radius=5000`

#### `POST /api/snapshots`
Record location snapshot.

#### `POST /api/signals`
Create demand signal.

```json
Request:
{
  "neighborhoodId": "n_123",
  "type": "event",
  "name": "Concert nearby",
  "impact": {
    "direction": "positive",
    "magnitude": "high",
    "expectedChange": 40
  },
  "timing": { "start": "2024-01-20", "end": "2024-01-20" }
}
```

#### `GET /api/signals/:neighborhoodId/active`
Get active signals.

#### `POST /api/forecast/footfall`
Generate footfall forecast.

```json
Request:
{
  "neighborhoodId": "n_123",
  "merchantId": "m_123",
  "date": "2024-01-20"
}

Response:
{
  "predicted": { "footfall": 500, "confidence": 80 },
  "factors": [
    { "type": "event", "contribution": 25 }
  ]
}
```

#### `GET /api/insights/:neighborhoodId`
Get neighborhood insights.

---

## 15. REZ Visual Workflow Builder - Port 3000

Drag-and-drop workflow builder.

### Frontend Routes

- `GET /` - Workflow list view
- Workflow editor with drag-drop canvas

### Features

- Node palette (triggers, actions, logic, flow)
- Drag-and-drop canvas
- Node configuration panel
- Workflow execution dashboard

---

## ERROR CODES

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid input |
| 404 | Not Found |
| 500 | Internal Server Error |

## COMMON HEADERS

```
Content-Type: application/json
X-Merchant-Id: merchant_123
X-Internal-Token: your-internal-token
```

---

**Document Version:** 1.0  
**Last Updated:** June 4, 2026
