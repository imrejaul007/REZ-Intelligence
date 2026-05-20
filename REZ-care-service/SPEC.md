# REZ Care Service - SPEC.md

**Version:** 1.0.0
**Port:** 4055
**Company:** REZ-Intelligence
**Category:** Customer Support Intelligence

---

## Overview

Unified Customer Support Intelligence Platform. Provides Customer 360 view, CSAT analytics, sentiment analysis, proactive issue detection, self-service recovery, and auto-ticket generation.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ Care Service (4055)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  Core Services:                                                             │
│  ├── Customer360Service      → Unified customer view                         │
│  ├── CSATService            → Satisfaction tracking                         │
│  ├── SentimentService       → Text sentiment analysis                       │
│  ├── ProactiveDetection     → Issue prediction                             │
│  ├── SelfServiceService     → Self-help automation                         │
│  └── AutoTicketService      → Auto ticket creation                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  Real-time: Socket.IO for live updates                                      │
│  Scheduled: Cron jobs for analysis                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Features

### Customer 360 View

Aggregates all service data into unified customer profile.

**Data Sources:**
- Order history from Order Service
- Payment history from Payment Service
- Support tickets from Care Service
- Engagement metrics from Signal Aggregator
- Social signals from Social Signals
- Predictions from Predictive Engine

### CSAT (Customer Satisfaction)

Track and analyze satisfaction scores.

**Metrics:**
- CSAT Score (0-100%)
- NPS (Net Promoter Score: -100 to 100)
- CES (Customer Effort Score: 1-7)
- Response rate

**Survey Types:**
- Post-interaction surveys
- Post-order surveys
- Periodic satisfaction polls

### Sentiment Analysis

Analyze text for customer sentiment.

**Analysis Types:**
- Ticket description sentiment
- Chat sentiment
- Review sentiment
- Feedback sentiment

**Sentiment Levels:**
- `positive` (> 0.2)
- `neutral` (-0.2 to 0.2)
- `negative` (< -0.2)

### Proactive Issue Detection

Predict and prevent issues before they escalate.

**Detectable Issues:**
- Delayed orders
- Payment failures
- Product quality issues
- Delivery problems
- Service outages

### Self-Service Recovery

Automated resolution without agent intervention.

**Self-Service Actions:**
- Order status updates
- Refund initiation
- Cancellation processing
- Replacement requests
- FAQ responses

---

## API Endpoints

### GET /api/customer/:userId/360

Get Customer 360 view.

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user_123",
    "profile": {
      "name": "John D.",
      "email": "john@example.com",
      "phone": "+91...",
      "tier": "gold",
      "lifetimeValue": 12500
    },
    "summary": {
      "totalOrders": 45,
      "totalSpent": 12500,
      "openTickets": 2,
      "csatScore": 85,
      "sentiment": "positive"
    },
    "recentOrders": [ ... ],
    "recentTickets": [ ... ],
    "sentimentHistory": [ ... ],
    "riskIndicators": ["at-risk-churn"],
    "lastUpdated": "2026-05-20T10:30:00Z"
  }
}
```

### GET /api/csat/:userId

Get CSAT metrics for user.

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user_123",
    "scores": {
      "csat": 85,
      "nps": 45,
      "ces": 1.8
    },
    "trends": {
      "csatTrend": "improving",
      "changePercent": 5.2
    },
    "surveys": {
      "total": 12,
      "completed": 10,
      "responseRate": 83
    },
    "breakdown": {
      "byCategory": { "delivery": 90, "product": 80, "support": 85 }
    }
  }
}
```

### POST /api/csat/survey

Submit CSAT survey response.

**Request:**
```json
{
  "surveyId": "survey_123",
  "userId": "user_123",
  "type": "post-interaction",
  "scores": {
    "csat": 5,
    "ces": 2
  },
  "feedback": "Great service, fast delivery!",
  "category": "delivery"
}
```

### GET /api/sentiment/:userId

Get sentiment analysis for user.

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user_123",
    "overallSentiment": "positive",
    "sentimentScore": 0.65,
    "trend": "stable",
    "breakdown": {
      "tickets": { "score": 0.5, "count": 5 },
      "chats": { "score": 0.8, "count": 12 },
      "reviews": { "score": 0.7, "count": 3 }
    },
    "recentMentions": [
      { "source": "ticket", "text": "...", "sentiment": 0.6, "date": "2026-05-18" }
    ]
  }
}
```

### POST /api/sentiment/analyze

Analyze text sentiment.

**Request:**
```json
{
  "text": "I'm really happy with the product quality and fast delivery!",
  "language": "en"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "text": "I'm really happy with the product quality and fast delivery!",
    "sentiment": "positive",
    "score": 0.85,
    "emotions": {
      "joy": 0.8,
      "satisfaction": 0.7
    },
    "keywords": ["happy", "quality", "fast", "delivery"]
  }
}
```

### GET /api/proactive/:userId

Get proactive detection results.

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user_123",
    "riskScore": 35,
    "riskLevel": "low",
    "detectedIssues": [
      {
        "type": "delivery-delay",
        "probability": 0.65,
        "orderId": "order_456",
        "recommendedAction": "proactive_communication",
        "message": "Your order may be delayed. Here's a ₹50 coupon."
      }
    ],
    "lastChecked": "2026-05-20T10:30:00Z"
  }
}
```

### POST /api/self-service/:userId/resolve

Attempt self-service resolution.

**Request:**
```json
{
  "intent": "refund_request",
  "context": {
    "orderId": "order_456",
    "reason": "product_not_as_described"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "resolved": true,
    "action": "refund_initiated",
    "refundAmount": 499,
    "estimatedProcessingTime": "3-5 business days",
    "ticketId": null
  }
}
```

### GET /api/tickets

List support tickets.

**Query:** `?status=open&priority=high&limit=20`

**Response:**
```json
{
  "success": true,
  "data": {
    "tickets": [
      {
        "ticketId": "ticket_123",
        "userId": "user_123",
        "subject": "Order not delivered",
        "status": "open",
        "priority": "high",
        "category": "delivery",
        "sentiment": "negative",
        "assignedTo": "agent_456",
        "createdAt": "2026-05-19T14:30:00Z"
      }
    ],
    "pagination": { "total": 45, "page": 1, "limit": 20 }
  }
}
```

### POST /api/tickets

Create new ticket (auto or manual).

**Request:**
```json
{
  "userId": "user_123",
  "subject": "Order not delivered",
  "description": "My order #12345 was supposed to arrive yesterday...",
  "category": "delivery",
  "priority": "high",
  "source": "chat",
  "metadata": { "orderId": "order_12345" }
}
```

---

## Data Models

### Ticket

```typescript
interface Ticket {
  ticketId: string;
  userId: string;
  subject: string;
  description: string;
  status: 'open' | 'pending' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  sentiment?: number;
  assignedTo?: string;
  tags: string[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}
```

### CSATSurvey

```typescript
interface CSATSurvey {
  surveyId: string;
  userId: string;
  type: 'post-interaction' | 'post-order' | 'periodic';
  interactionId?: string;
  scores: {
    csat?: number;     // 1-5
    nps?: number;      // 0-10
    ces?: number;      // 1-7
  };
  feedback?: string;
  category?: string;
  status: 'pending' | 'completed' | 'expired';
  createdAt: Date;
  completedAt?: Date;
}
```

### ProactiveAlert

```typescript
interface ProactiveAlert {
  alertId: string;
  userId: string;
  issueType: string;
  probability: number;
  context: Record<string, any>;
  recommendedAction: string;
  actionTaken: boolean;
  createdAt: Date;
}
```

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "socket.io": "^4.8.3",
  "node-cron": "^3.0.3",
  "axios": "^1.6.0",
  "uuid": "^9.0.0"
}
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 4055 | Service port |
| `MONGODB_URI` | mongodb://localhost:27017/rez-care | MongoDB |
| `NODE_ENV` | development | Environment |

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| Order Service | Read | Order history, status |
| Payment Service | Read | Payment history |
| Auth Service | Read | User authentication |
| Signal Aggregator | Read | Engagement data |
| Notification Service | Trigger | Proactive alerts |
| Commerce Graph | Write | Customer insights |

---

## Real-time Features

Socket.IO events for live updates:

- `ticket:created` - New ticket
- `ticket:updated` - Ticket status change
- `csat:submitted` - New survey response
- `alert:triggered` - Proactive issue detected
- `customer:360:updated` - Profile updated

---

## Status

- [x] Customer 360 view
- [x] CSAT tracking
- [x] Sentiment analysis
- [x] Proactive detection
- [x] Self-service recovery
- [x] Auto-ticket generation
- [x] Real-time updates (Socket.IO)
- [x] Scheduled analysis
- [ ] AI-powered response suggestions
- [ ] Commerce graph sync
