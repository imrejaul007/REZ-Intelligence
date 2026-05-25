# REZ Memory Layer API Reference
**Base URL:** `http://localhost:4201`
**Auth:** `X-Internal-Token` header required

---

## Quick Start

```bash
# Get user timeline
curl http://localhost:4201/api/timeline/user_123 \
  -H "X-Internal-Token: dev-token"

# Add event
curl -X POST http://localhost:4201/api/events \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: dev-token" \
  -d '{"userId": "user_123", "type": "order_placed", "category": "commerce", "source": "whatsapp", "data": {"orderId": "ord_456"}}'
```

---

## Authentication

```bash
# All requests require this header
curl -H "X-Internal-Token: your-token"

# Token in .env
INTERNAL_SERVICE_TOKEN=your-token
```

---

## Timeline

### Get User Timeline
```http
GET /api/timeline/:userId
```
**Query params:**
- `limit` - Max events (default: 100)
- `startDate` - ISO date string
- `sources` - Comma-separated list

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "eventId": "evt_xxx",
      "type": "order_placed",
      "category": "commerce",
      "source": "whatsapp",
      "timestamp": "2026-05-23T10:00:00Z",
      "data": { "orderId": "ord_456" },
      "metadata": { "sessionId": "sess_xxx" }
    }
  ]
}
```

---

### Get Timeline Summary
```http
GET /api/timeline/:userId/summary
```
**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user_123",
    "totalEvents": 1547,
    "segments": [
      { "segmentId": "active_shopper", "confidence": 0.89 }
    ],
    "preferences": {
      "categories": ["food", "travel"],
      "channels": ["whatsapp", "app"]
    },
    "lastActivity": "2026-05-23T10:00:00Z"
  }
}
```

---

## Events

### Ingest Event
```http
POST /api/events
```
**Body:**
```json
{
  "userId": "user_123",
  "type": "order_placed",
  "category": "commerce",
  "source": "whatsapp",
  "data": {
    "orderId": "ord_456",
    "total": 599
  }
}
```

### Batch Ingest
```http
POST /api/events/batch
```
**Body:**
```json
{
  "events": [
    { "userId": "user_123", "type": "event1", "category": "commerce", "source": "app" },
    { "userId": "user_123", "type": "event2", "category": "engagement", "source": "app" }
  ]
}
```

---

## Errors

| Code | Message |
|------|----------|
| `USER_NOT_FOUND` | User has no events |
| `INVALID_CATEGORY` | Unknown category |
| `INVALID_SOURCE` | Unknown source |
| `RATE_LIMITED` | Too many requests |

---

## Webhooks

### Subscribe to Updates
```http
WS /ws/timeline/:userId
```
**Events:**
- `timeline.updated`
- `segment.changed`
- `preference.detected`
