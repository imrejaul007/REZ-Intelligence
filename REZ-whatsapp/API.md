# REZ WhatsApp API Reference
**Base URL:** `http://localhost:4202`
**Auth:** `X-Internal-Token` header required

---

## Quick Start

```bash
# Send a message
curl -X POST http://localhost:4202/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: dev-token" \
  -d '{"to": "+919876543210", "message": "Hello!"}'
```

---

## Authentication

All endpoints require `X-Internal-Token` header:
```
X-Internal-Token: your-token
```

For Twilio webhooks, include `?hub.verify_token=YOUR_TOKEN` in webhook URL.

---

## Endpoints

### Messages

#### Send Message
```http
POST /api/whatsapp/send
```
**Request:**
```json
{
  "to": "+919876543210",
  "message": "Hello!",
  "mediaUrl": "https://example.com/image.jpg"
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "messageId": "wamid.xxx",
    "status": "queued"
  }
}
```

---

#### Send Template
```http
POST /api/whatsapp/templates/:templateId/send
```
**Request:**
```json
{
  "to": "+919876543210",
  "components": {
    "header": { "type": "text", "text": "Order Update" },
    "body": { "1": "Order #12345", "2": "Out for delivery" }
  }
}
```

---

### Sessions

#### Create Session
```http
POST /api/whatsapp/session
```
**Request:**
```json
{
  "userId": "user_123",
  "merchantId": "merchant_456",
  "phone": "+919876543210"
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "sess_xxx",
    "state": "idle",
    "expiresAt": "2026-05-24T12:00:00Z"
  }
}
```

---

#### Get Session
```http
GET /api/whatsapp/session/:sessionId
```

---

### Cart

#### Add Item
```http
POST /api/whatsapp/cart
```
```json
{
  "sessionId": "sess_xxx",
  "operation": "add",
  "item": {
    "productId": "prod_123",
    "name": "Margherita Pizza",
    "price": 299,
    "quantity": 2
  }
}
```

#### Operations:
- `add` - Add item
- `update` - Update quantity
- `remove` - Remove item
- `clear` - Empty cart

---

### Orders

#### Create Order
```http
POST /api/whatsapp/checkout
```
```json
{
  "sessionId": "sess_xxx",
  "paymentMethod": "upi"
}
```

---

### Templates

#### List Templates
```http
GET /api/templates
```

#### Create Template
```http
POST /api/templates
```
```json
{
  "name": "order_confirmation",
  "language": "en",
  "category": "UTILITY",
  "components": [
    {
      "type": "header",
      "format": "text",
      "text": "{{1}}"
    },
    {
      "type": "body",
      "text": "Order #{{2}} is confirmed!"
    }
  ]
}
```

---

## Error Codes

| Code | Meaning |
|------|---------|
| `INVALID_PHONE` | Phone number format invalid |
| `SESSION_EXPIRED` | Session timeout (>24h) |
| `CART_EMPTY` | Cannot checkout empty cart |
| `TEMPLATE_NOT_FOUND` | Template ID not found |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `TWILIO_ERROR` | Twilio API failure |

---

## Webhooks

### Incoming Messages
```
POST /webhook/whatsapp
```

### Verification
```
GET /webhook/whatsapp?hub.mode=subscribe&hub.verify_token=x&hub.challenge=y
```

---

## Rate Limits

| Endpoint | Limit |
|-----------|-------|
| `/send` | 100/min |
| `/session` | 50/min |
| `/cart` | 200/min |
| `/checkout` | 20/min |
| `/templates` | 30/min |
