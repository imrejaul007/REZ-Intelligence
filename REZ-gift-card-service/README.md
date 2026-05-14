# Gift Card Service

**Port:** 4061
**Purpose:** Digital gift cards, balances, and redemption

---

## Overview

The Gift Card Service manages digital gift cards, balances, and redemptions across the REZ platform. It provides:

- Gift card creation and purchase
- Balance management
- PIN-secured redemption
- Customer wallet aggregation
- Transaction history and reporting
- Multiple gift card types (physical/digital)

## Features

### Gift Card Management
- Create digital and physical gift cards
- Load additional balance
- PIN-secured transactions
- Expiry management
- Freeze and cancel capabilities

### Redemption
- Secure PIN verification
- Partial redemption support
- Store-specific redemption tracking
- Balance validation

### Customer Wallet
- Aggregate view of all gift cards
- Total balance calculation
- Individual card management

### Transaction Tracking
- Complete transaction history
- Multiple transaction types (purchase, redeem, load, refund)
- Date range filtering and reporting

## API Endpoints

### Gift Card Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/gift-cards` | Create/purchase gift card |
| GET | `/api/gift-cards/:cardId` | Get gift card details |
| POST | `/api/gift-cards/balance` | Check balance (with PIN) |
| POST | `/api/gift-cards/:cardId/redeem` | Redeem balance |
| POST | `/api/gift-cards/:cardId/load` | Load additional balance |
| GET | `/api/gift-cards/customer/:customerId` | Get customer's cards |
| PATCH | `/api/gift-cards/:cardId/cancel` | Cancel gift card |
| PATCH | `/api/gift-cards/:cardId/freeze` | Freeze gift card |
| GET | `/api/gift-cards/:cardId/history` | Transaction history |

### Transaction Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transactions` | List all transactions |
| GET | `/api/transactions/:transactionId` | Get transaction details |
| GET | `/api/transactions/gift-card/:cardId` | Card transactions |
| GET | `/api/transactions/reports/summary` | Transaction summary |

### Wallet Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/wallets` | Create customer wallet |
| GET | `/api/wallets/:customerId` | Get wallet details |
| GET | `/api/wallets/:customerId/balance` | Get balance summary |
| PATCH | `/api/wallets/:customerId/status` | Update wallet status |
| DELETE | `/api/wallets/:customerId` | Close wallet |

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/gift-cards/health` | Service health status |

## Data Models

### GiftCard

```javascript
{
  cardId: "GC-12345678",
  cardNumber: "GCNABCD12345678",
  pin: "4829",
  balance: 2500,
  originalValue: 5000,
  currency: "INR",
  status: "active",
  type: "digital",
  issuedTo: {
    customerId: "cust_123",
    email: "recipient@example.com",
    name: "John Doe"
  },
  purchasedBy: {
    customerId: "cust_456",
    email: "buyer@example.com",
    name: "Jane Smith"
  },
  validFrom: "2026-05-14T00:00:00Z",
  validUntil: "2027-05-14T00:00:00Z",
  transactionHistory: [...]
}
```

### Transaction

```javascript
{
  transactionId: "TX-ABCDEF12",
  type: "redeem",
  giftCardId: "GC-12345678",
  amount: 500,
  balanceBefore: 2500,
  balanceAfter: 2000,
  currency: "INR",
  status: "completed",
  metadata: {
    orderId: "order_789",
    storeId: "store_001",
    storeName: "Main Street Branch",
    customerId: "cust_123"
  },
  createdAt: "2026-05-14T10:30:00Z"
}
```

### Wallet

```javascript
{
  walletId: "WAL-12345678",
  customerId: "cust_123",
  balance: 0,
  currency: "INR",
  totalGiftCards: 3,
  status: "active"
}
```

## Usage Examples

### Create a Gift Card

```bash
curl -X POST http://localhost:4061/api/gift-cards \
  -H "X-Internal-Token: your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "value": 5000,
    "type": "digital",
    "issuedTo": {
      "customerId": "cust_123",
      "email": "recipient@example.com",
      "name": "John Doe"
    },
    "purchasedBy": {
      "customerId": "cust_456",
      "email": "buyer@example.com",
      "name": "Jane Smith"
    },
    "validDays": 365,
    "metadata": {
      "occasion": "Birthday",
      "message": "Happy Birthday!"
    }
  }'
```

### Check Balance

```bash
curl -X POST http://localhost:4061/api/gift-cards/balance \
  -H "X-Internal-Token: your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "cardNumber": "GCNABCD12345678",
    "pin": "4829"
  }'
```

### Redeem Gift Card

```bash
curl -X POST http://localhost:4061/api/gift-cards/GC-12345678/redeem \
  -H "X-Internal-Token: your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 500,
    "pin": "4829",
    "storeId": "store_001",
    "storeName": "Main Street Branch",
    "orderId": "order_789",
    "customerId": "cust_123"
  }'
```

### Load Additional Balance

```bash
curl -X POST http://localhost:4061/api/gift-cards/GC-12345678/load \
  -H "X-Internal-Token: your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "pin": "4829"
  }'
```

### Get Customer Wallet Balance

```bash
curl http://localhost:4061/api/wallets/cust_123/balance \
  -H "X-Internal-Token: your-token"
```

## Environment Variables

```bash
# Service
PORT=4061
MONGODB_URI=mongodb://localhost:27017/rez-gift-card-service
REDIS_URL=redis://localhost:6379
NODE_ENV=development
INTERNAL_SERVICE_TOKEN=your-internal-token

# Gift Card Settings
MIN_GIFT_CARD_VALUE=100
MAX_GIFT_CARD_VALUE=50000
DEFAULT_CURRENCY=INR
GIFT_CARD_PREFIX=GC
```

## Quick Start

```bash
cd REZ-Intelligence/REZ-gift-card-service
npm install
cp .env.example .env
npm run dev
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│  Order Service  │────▶│   Gift Card     │
└─────────────────┘     │    Service      │
                        └────────┬────────┘
                                 │
┌─────────────────┐     ┌────────▼────────┐
│  Payment Service │────▶│  Transaction DB │
└─────────────────┘     └─────────────────┘
```

## Gift Card Status Flow

```
active ──────┬──────> frozen
             │
             ├──────> cancelled
             │
             └──────> redeemed (when balance = 0)
                              │
                              └──────> expired (after validUntil)
```

## Integration Points

| Service | Integration |
|---------|-------------|
| `rez-payment-service` | Payment processing |
| `rez-order-service` | Order redemption |
| `REZ-notifications-service` | Gift card notifications |
| `REZ-engagement-platform` | Loyalty programs |

## Related Services

- [Delivery Tracking Service](./REZ-delivery-tracking-service/) - Delivery management
- [Multi-location Service](./REZ-multi-location-service/) - Multi-store management
- [Reservation Service](./REZ-reservation-service/) - Restaurant reservations
