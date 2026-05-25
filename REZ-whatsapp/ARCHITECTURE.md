# REZ WhatsApp - Architecture

## Overview
Unified WhatsApp commerce platform with NLP, sessions, cart, orders, and campaigns.

## Components

```
┌────────────────────────────────────────────────────────┐
│                      API Layer (Express)                 │
├──────────────────────────────────────────────────────┤
│ POST /send          - Send message                     │
│ POST /session      - Create session                   │
│ POST /cart         - Cart operations                  │
│ POST /checkout     - Create order                     │
│ POST /templates    - Template management             │
│ POST /broadcasts   - Campaign management            │
│ POST /webhook     - Twilio webhooks               │
└──────────────────────────────────────────────────────┘
                          │
┌──────────────────────────▼────────────────────────────┐
│                    Service Layer                       │
├──────────────────────────────────────────────────┤
│ ConversationEngine  - NLP + state machine           │
│ SessionManager    - Redis + MongoDB persistence   │
│ CartService      - Cart operations                 │
│ OrderService     - Order management               │
│ BroadcastService - Campaign execution              │
└─────────────────────────────────────────────────┘
                          │
┌──────────────┐  ┌───────────┐  ┌────────────────┐
│   Twilio    │  │  MongoDB  │  │    Redis     │
│   WhatsApp  │  │  Sessions │  │    Sessions  │
└──────────────┘  └───────────┘  └────────────────┘
```

## Conversation States

```
IDLE → BROWSING → SEARCHING → VIEWING_PRODUCT
   ↓       ↓           ↓            ↓
   ↓       └──── ADD_TO_CART ←──┘
   │
   └────────── CART_REVIEW → CHECKOUT → PAYMENT_PENDING → ORDER_CONFIRMED
   │
   └──────── SUPPORT → TRACKING → COMPLETED

   ANY → EXPIRED (24h timeout)
```

## Session Flow

```
1. User sends message
2. Lookup/create session (Redis → MongoDB)
3. Detect intent (NLP/Regex)
4. Execute action
5. Save session state
6. Emit response
7. Update memory layer
```

## Intent Detection Layers

```
Layer 1: REZ Intelligence (4018) - AI intent detection
Layer 2: OpenAI GPT fallback
Layer 3: Regex patterns (ultimate fallback)
```

## Cart Schema

```typescript
interface Cart {
  userId: string;
  merchantId: string;
  items: CartItem[];
  total: number;
  createdAt: Date;
  expiresAt: Date; // 24h
}
```

## Environment Variables

```bash
PORT=4202
MONGODB_URI=mongodb://localhost:27017/rez-whatsapp
REDIS_URL=redis://localhost:6379
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
WHATSAPP_PHONE_NUMBER=+1...
OPENAI_API_KEY=sk-...
USE_AI_INTENT=true
SESSION_TTL=86400
```

## API Quick Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/whatsapp/send` | POST | Send message |
| `/api/whatsapp/session` | POST | Create session |
| `/api/whatsapp/cart` | POST | Cart operations |
| `/api/whatsapp/checkout` | POST | Create order |
| `/api/templates` | GET/POST | Template management |
| `/api/broadcasts` | GET/POST | Campaigns |
