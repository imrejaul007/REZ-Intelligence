# REZ Event Platform - API Endpoints Documentation

## Overview

The REZ Event Platform is a central event bus service that receives webhook events from various REZ ecosystem services and forwards them to the Action Engine for processing. This documentation covers all available API endpoints.

**Base URL:**
- Production: `https://rez-event-platform.onrender.com`
- Local: `http://localhost:4008`

---

## Table of Contents

1. [Health & Status Endpoints](#health--status-endpoints)
2. [Event Publishing](#event-publishing)
3. [Merchant App Webhooks](#merchant-app-webhooks)
4. [Consumer App Webhooks](#consumer-app-webhooks)
5. [Auth Webhooks](#auth-webhooks)
6. [Wallet Webhooks](#wallet-webhooks)
7. [Catalog Webhooks](#catalog-webhooks)
8. [Gamification Webhooks](#gamification-webhooks)
9. [Support Webhooks](#support-webhooks)
10. [Chat Webhooks](#chat-webhooks)
11. [Response Schemas](#response-schemas)

---

## Health & Status Endpoints

### GET /health

Health check endpoint that returns service status including MongoDB connection state.

**Response:**
```json
{
  "status": "healthy",
  "service": "rez-event-platform",
  "mongodb": "connected",
  "actionEngine": "http://localhost:4009",
  "timestamp": "2026-05-01T12:00:00.000Z"
}
```

---

### GET /ready

Readiness probe for container orchestration.

**Response:**
```json
{ "ready": true }
```

| Ready State | HTTP Status | MongoDB State |
|-------------|-------------|---------------|
| `true` | 200 | Connected |
| `false` | 503 | Disconnected |

---

### GET /live

Liveness probe for container orchestration.

**Response:**
```json
{ "alive": true }
```

---

### GET /stats

Returns event statistics including total count and breakdown by event type.

**Response:**
```json
{
  "total": 1234,
  "byType": [
    { "_id": "inventory.low", "count": 150 },
    { "_id": "order.completed", "count": 500 }
  ]
}
```

---

### GET /webhook/status

Returns status and documentation of all available webhooks.

**Response:**
```json
{
  "service": "rez-event-platform",
  "version": "2.0.0",
  "webhooks": {
    "merchant": { ... },
    "consumer": { ... },
    "auth": { ... },
    "wallet": { ... },
    "catalog": { ... },
    "gamification": { ... },
    "support": { ... },
    "chat": { ... }
  },
  "action_engine_url": "http://localhost:4009"
}
```

---

## Event Publishing

### POST /events/{type}

Publish a generic event to the event bus.

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | Event type identifier |

**Request Body:**
```json
{
  "correlation_id": "unique-id-123",
  "source": "my-service",
  "data": {
    "custom": "payload"
  }
}
```

**Response:**
```json
{
  "success": true,
  "eventId": "65f1234567890abcdef12345",
  "correlationId": "unique-id-123"
}
```

---

## Merchant App Webhooks

### POST /webhook/merchant/inventory

Triggered when merchant inventory falls below threshold.

**Use Case:** Stock monitoring, automatic reordering, low-stock alerts

**Request Body:**
```json
{
  "merchant_id": "merchant_123",
  "item_id": "item_456",
  "item_name": "Premium Burger",
  "current_stock": 5,
  "threshold": 10,
  "avg_daily_sales": 20,
  "recent_orders": 45,
  "source": "merchant_app"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `merchant_id` | string | Yes | Merchant unique identifier |
| `item_id` | string | Yes | Item unique identifier |
| `item_name` | string | No | Name of the item |
| `current_stock` | integer | No | Current stock quantity |
| `threshold` | integer | No | Low stock threshold |
| `avg_daily_sales` | number | No | Average daily sales |
| `recent_orders` | integer | No | Orders in last 3 days |
| `source` | string | No | Source service identifier |

**Response:**
```json
{
  "success": true,
  "correlation_id": "merchant_merchant_123_1714567890123",
  "event_id": "65f1234567890abcdef12345"
}
```

---

### POST /webhook/merchant/order

Triggered when a merchant completes an order.

**Use Case:** Order analytics, merchant dashboard updates, commission tracking

**Request Body:**
```json
{
  "merchant_id": "merchant_123",
  "order_id": "order_789",
  "items": [
    {
      "item_id": "item_1",
      "name": "Burger",
      "quantity": 2,
      "price": 10.99
    }
  ],
  "total_amount": 21.98,
  "customer_id": "customer_456",
  "payment_method": "wallet",
  "source": "merchant_app"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `merchant_id` | string | Yes | Merchant unique identifier |
| `order_id` | string | Yes | Order unique identifier |
| `items` | array | No | List of order items |
| `total_amount` | number | No | Total order amount |
| `customer_id` | string | No | Customer identifier |
| `payment_method` | string | No | wallet, card, cash, bank_transfer |
| `source` | string | No | Source service identifier |

**Response:**
```json
{
  "success": true,
  "correlation_id": "merchant_order_merchant_123_1714567890123",
  "event_id": "65f1234567890abcdef12345"
}
```

---

### POST /webhook/merchant/payment

Triggered when a merchant receives payment.

**Use Case:** Payment reconciliation, merchant earnings, financial reporting

**Request Body:**
```json
{
  "merchant_id": "merchant_123",
  "transaction_id": "txn_abc123",
  "amount": 150.00,
  "status": "success",
  "source": "merchant_app"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `merchant_id` | string | Yes | Merchant unique identifier |
| `transaction_id` | string | Yes | Transaction identifier |
| `amount` | number | Yes | Transaction amount |
| `status` | string | No | success, pending, failed |
| `source` | string | No | Source service identifier |

**Response:**
```json
{
  "success": true,
  "correlation_id": "merchant_payment_merchant_123_1714567890123",
  "event_id": "65f1234567890abcdef12345"
}
```

---

## Consumer App Webhooks

### POST /webhook/consumer/order

Triggered when a consumer places an order.

**Use Case:** Order tracking, consumer history, recommendations

**Request Body:**
```json
{
  "user_id": "user_123",
  "order_id": "order_789",
  "items": [
    {
      "item_id": "item_1",
      "name": "Pizza",
      "quantity": 1,
      "price": 15.99
    }
  ],
  "total_amount": 15.99,
  "merchant_id": "merchant_456",
  "source": "consumer_app"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | string | Yes | User unique identifier |
| `order_id` | string | Yes | Order unique identifier |
| `items` | array | No | List of order items |
| `total_amount` | number | No | Total order amount |
| `merchant_id` | string | No | Merchant identifier |
| `source` | string | No | Source service identifier |

**Response:**
```json
{
  "success": true,
  "correlation_id": "consumer_order_user_123_1714567890123",
  "event_id": "65f1234567890abcdef12345"
}
```

---

### POST /webhook/consumer/search

Triggered when a consumer performs a search.

**Use Case:** Intent tracking, search analytics, trending queries

**Request Body:**
```json
{
  "user_id": "user_123",
  "query": "best pizza near me",
  "results_count": 25,
  "clicked_item": "item_456",
  "source": "consumer_app"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | string | Yes | User unique identifier |
| `query` | string | Yes | Search query string |
| `results_count` | integer | No | Number of results returned |
| `clicked_item` | string | No | Item clicked from results |
| `source` | string | No | Source service identifier |

**Response:**
```json
{
  "success": true,
  "correlation_id": "consumer_search_user_123_1714567890123",
  "event_id": "65f1234567890abcdef12345"
}
```

---

### POST /webhook/consumer/view

Triggered when a consumer views an item.

**Use Case:** Engagement tracking, recommendations, item analytics

**Request Body:**
```json
{
  "user_id": "user_123",
  "item_id": "item_456",
  "item_name": "Margherita Pizza",
  "merchant_id": "merchant_789",
  "duration_seconds": 30,
  "source": "consumer_app"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | string | Yes | User unique identifier |
| `item_id` | string | Yes | Item unique identifier |
| `item_name` | string | No | Name of the item |
| `merchant_id` | string | No | Merchant identifier |
| `duration_seconds` | integer | No | Time spent viewing |
| `source` | string | No | Source service identifier |

**Response:**
```json
{
  "success": true,
  "correlation_id": "consumer_view_user_123_1714567890123",
  "event_id": "65f1234567890abcdef12345"
}
```

---

## Auth Webhooks

### POST /webhook/auth/signup

Triggered when a new user registers.

**Use Case:** Onboarding workflows, welcome campaigns, user analytics

**Request Body:**
```json
{
  "user_id": "user_123",
  "method": "email",
  "source": "auth_service"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | string | Yes | User unique identifier |
| `method` | string | No | email, phone, google, apple, facebook |
| `source` | string | No | Source service identifier |

**Response:**
```json
{
  "success": true,
  "correlation_id": "auth_signup_user_123_1714567890123",
  "event_id": "65f1234567890abcdef12345"
}
```

---

### POST /webhook/auth/login

Triggered when a user attempts to log in.

**Use Case:** Security monitoring, session management, login analytics

**Request Body:**
```json
{
  "user_id": "user_123",
  "method": "password",
  "success": true,
  "source": "auth_service"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | string | Yes | User unique identifier |
| `method` | string | No | email, phone, google, apple, facebook, password |
| `success` | boolean | No | Login success status (default: true) |
| `source` | string | No | Source service identifier |

**Response:**
```json
{
  "success": true,
  "correlation_id": "auth_login_user_123_1714567890123",
  "event_id": "65f1234567890abcdef12345"
}
```

---

### POST /webhook/auth/logout

Triggered when a user logs out.

**Use Case:** Session cleanup, logout analytics, device management

**Request Body:**
```json
{
  "user_id": "user_123",
  "source": "auth_service"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | string | Yes | User unique identifier |
| `source` | string | No | Source service identifier |

**Response:**
```json
{
  "success": true,
  "correlation_id": "auth_logout_user_123_1714567890123",
  "event_id": "65f1234567890abcdef12345"
}
```

---

## Wallet Webhooks

### POST /webhook/wallet/topup

Triggered when a user adds funds to their wallet.

**Use Case:** Balance tracking, payment processing, bonus campaigns

**Request Body:**
```json
{
  "user_id": "user_123",
  "amount": 100.00,
  "payment_method": "credit_card",
  "balance_after": 250.00,
  "transaction_id": "txn_abc123",
  "source": "wallet_service"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | string | Yes | User unique identifier |
| `amount` | number | Yes | Top-up amount |
| `payment_method` | string | No | credit_card, debit_card, bank_transfer, promo_code |
| `balance_after` | number | No | Wallet balance after top-up |
| `transaction_id` | string | No | Transaction identifier |
| `source` | string | No | Source service identifier |

**Response:**
```json
{
  "success": true,
  "correlation_id": "wallet_topup_txn_abc123_1714567890123",
  "event_id": "65f1234567890abcdef12345"
}
```

---

### POST /webhook/wallet/withdraw

Triggered when a user withdraws funds from their wallet.

**Use Case:** Withdrawal processing, compliance, fraud detection

**Request Body:**
```json
{
  "user_id": "user_123",
  "amount": 50.00,
  "status": "pending",
  "transaction_id": "txn_def456",
  "source": "wallet_service"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | string | Yes | User unique identifier |
| `amount` | number | Yes | Withdrawal amount |
| `status` | string | No | pending, processing, completed, failed |
| `transaction_id` | string | No | Transaction identifier |
| `source` | string | No | Source service identifier |

**Response:**
```json
{
  "success": true,
  "correlation_id": "wallet_withdraw_txn_def456_1714567890123",
  "event_id": "65f1234567890abcdef12345"
}
```

---

## Catalog Webhooks

### POST /webhook/catalog/view

Triggered when a user views a catalog/menu item.

**Use Case:** Menu analytics, popularity tracking, recommendations

**Request Body:**
```json
{
  "user_id": "user_123",
  "merchant_id": "merchant_456",
  "item_id": "item_789",
  "item_name": "Chicken Wings",
  "category": "Appetizers",
  "source": "catalog_service"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | string | No | User identifier |
| `merchant_id` | string | No | Merchant identifier |
| `item_id` | string | No | Item identifier |
| `item_name` | string | No | Name of the item |
| `category` | string | No | Item category |
| `source` | string | No | Source service identifier |

**Response:**
```json
{
  "success": true,
  "correlation_id": "catalog_view_item_789_1714567890123",
  "event_id": "65f1234567890abcdef12345"
}
```

---

## Gamification Webhooks

### POST /webhook/gamification/earn

Triggered when a user earns loyalty points.

**Use Case:** Points tracking, rewards eligibility, engagement campaigns

**Request Body:**
```json
{
  "user_id": "user_123",
  "points": 100,
  "reason": "order_completed",
  "source": "gamification_service"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | string | Yes | User unique identifier |
| `points` | integer | Yes | Points earned |
| `reason` | string | No | Reason for earning points |
| `source` | string | No | Source service identifier |

**Response:**
```json
{
  "success": true,
  "correlation_id": "gamification_earn_user_123_1714567890123",
  "event_id": "65f1234567890abcdef12345"
}
```

---

### POST /webhook/gamification/redeem

Triggered when a user redeems loyalty points for rewards.

**Use Case:** Reward fulfillment, redemption analytics, inventory management

**Request Body:**
```json
{
  "user_id": "user_123",
  "points": 500,
  "reward_id": "reward_456",
  "source": "gamification_service"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | string | Yes | User unique identifier |
| `points` | integer | Yes | Points redeemed |
| `reward_id` | string | No | Reward being redeemed |
| `source` | string | No | Source service identifier |

**Response:**
```json
{
  "success": true,
  "correlation_id": "gamification_redeem_user_123_1714567890123",
  "event_id": "65f1234567890abcdef12345"
}
```

---

## Support Webhooks

### POST /webhook/support/ticket

Triggered when a user creates a support ticket.

**Use Case:** Ticket routing, priority handling, customer service analytics

**Request Body:**
```json
{
  "ticket_id": "ticket_123",
  "user_id": "user_456",
  "category": "order_issue",
  "priority": "high",
  "source": "support_service"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ticket_id` | string | Yes | Ticket unique identifier |
| `user_id` | string | Yes | User unique identifier |
| `category` | string | No | general, order_issue, payment_issue, refund, complaint, feedback, other |
| `priority` | string | No | low, medium, high, urgent |
| `source` | string | No | Source service identifier |

**Response:**
```json
{
  "success": true,
  "correlation_id": "support_ticket_ticket_123_1714567890123",
  "event_id": "65f1234567890abcdef12345"
}
```

---

## Chat Webhooks

### POST /webhook/chat/message

Triggered when a chat message is sent.

**Use Case:** Conversation tracking, support automation, message analytics

**Request Body:**
```json
{
  "message_id": "msg_123",
  "conversation_id": "conv_456",
  "sender_id": "user_789",
  "sender_type": "user",
  "content": "Hello, I need help with my order",
  "context": "order_inquiry",
  "source": "chat_service"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message_id` | string | Yes | Message unique identifier |
| `conversation_id` | string | Yes | Conversation identifier |
| `sender_id` | string | Yes | Sender identifier |
| `sender_type` | string | No | user, agent, bot |
| `content` | string | No | Message content (truncated to 100 chars) |
| `context` | string | No | Conversation context |
| `source` | string | No | Source service identifier |

**Response:**
```json
{
  "success": true,
  "correlation_id": "chat_message_msg_123_1714567890123",
  "event_id": "65f1234567890abcdef12345"
}
```

---

## Response Schemas

### Webhook Accepted Response

All webhook endpoints return this response format on success:

```json
{
  "success": true,
  "correlation_id": "unique-correlation-id",
  "event_id": "mongodb-document-id"
}
```

### Error Response

All webhook endpoints return this response format on error:

```json
{
  "success": false,
  "error": "Error message description"
}
```

**HTTP Status Codes:**
| Code | Description |
|------|-------------|
| 200 | Event accepted successfully |
| 400 | Bad request - invalid payload |
| 500 | Internal server error |

---

## Webhook Summary

| Category | Endpoint | Event Type |
|----------|----------|------------|
| **Merchant** | `/webhook/merchant/inventory` | inventory.low |
| | `/webhook/merchant/order` | order.completed |
| | `/webhook/merchant/payment` | payment.success |
| **Consumer** | `/webhook/consumer/order` | consumer.order |
| | `/webhook/consumer/search` | consumer.search |
| | `/webhook/consumer/view` | consumer.view |
| **Auth** | `/webhook/auth/signup` | auth.signup |
| | `/webhook/auth/login` | auth.login |
| | `/webhook/auth/logout` | auth.logout |
| **Wallet** | `/webhook/wallet/topup` | wallet.topup |
| | `/webhook/wallet/withdraw` | wallet.withdraw |
| **Catalog** | `/webhook/catalog/view` | catalog.view |
| **Gamification** | `/webhook/gamification/earn` | gamification.earn |
| | `/webhook/gamification/redeem` | gamification.redeem |
| **Support** | `/webhook/support/ticket` | support.ticket |
| **Chat** | `/webhook/chat/message` | chat.message |

**Total: 16 Webhooks**

---

## Swagger/OpenAPI

Full API specification is available in YAML format:
- **File:** `src/docs/openapi.yaml`
- **UI:** `/api-docs` (when swagger-ui is enabled)

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 4008 | Service port |
| `MONGODB_URI` | mongodb://localhost:27017/rez-app | MongoDB connection string |
| `ACTION_ENGINE_URL` | http://localhost:4009 | Action Engine webhook URL |
