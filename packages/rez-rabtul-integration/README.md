# @rez/rabtul-integration

Shared integration module for connecting REZ-Intelligence services to the RABTUL platform.

## Installation

```bash
npm install @rez/rabtul-integration
```

## Environment Variables

```bash
# RABTUL Service URLs
RABTUL_AUTH_URL=http://localhost:4002
RABTUL_PAYMENT_URL=http://localhost:4001
RABTUL_WALLET_URL=http://localhost:4004
RABTUL_NOTIFICATIONS_URL=http://localhost:4011
RABTUL_ORDER_URL=http://localhost:4006
RABTUL_CATALOG_URL=http://localhost:4007
RABTUL_PROFILE_URL=http://localhost:4013

# Service-to-Service Token
INTERNAL_SERVICE_TOKEN=your-secure-token
```

## Usage

```typescript
import {
  authService,
  paymentService,
  walletService,
  notificationService,
  orderService,
  catalogService,
  profileService,
} from '@rez/rabtul-integration';

// Verify user authentication
const auth = await authService.verify(token);
if (auth.valid) {
  console.log('User:', auth.userId);
}

// Initiate payment
const payment = await paymentService.initiate({
  orderId: 'order_123',
  amount: 500,
  paymentMethod: 'upi',
});

// Add coins to wallet
await walletService.addCoins({
  userId: 'user_123',
  amount: 100,
  reason: 'Referral bonus',
});

// Send notification
await notificationService.send({
  userId: 'user_123',
  channel: 'push',
  type: 'order_update',
  title: 'Order Delivered!',
  message: 'Your order has been delivered.',
});
```

## Services Integrated

| Service | Purpose |
|---------|---------|
| Auth | Token verification, OTP, service tokens |
| Payment | Initiate, capture, refund, webhook verification |
| Wallet | Add/deduct coins, balance, transactions |
| Notification | Push, SMS, Email, WhatsApp |
| Order | Create, status, updates |
| Catalog | Products, search, merchant products |
| Profile | User and merchant profiles |

## Architecture

```
┌─────────────────────────────────────────────┐
│        REZ-Intelligence Services             │
├─────────────────────────────────────────────┤
│                                             │
│    @rez/rabtul-integration (this package)  │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│         RABTUL Platform Services             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │  Auth    │ │ Payment  │ │  Wallet  │   │
│  │  4002    │ │  4001    │ │  4004    │   │
│  └──────────┘ └──────────┘ └──────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │   Notif  │ │  Order   │ │ Catalog  │   │
│  │  4011    │ │  4006    │ │  4007    │   │
│  └──────────┘ └──────────┘ └──────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

## Migration Guide

### Before (Local Auth)
```typescript
import jwt from 'jsonwebtoken';

const verifyToken = (token: string) => {
  return jwt.verify(token, process.env.JWT_SECRET!);
};
```

### After (RABTUL Auth)
```typescript
import { authService } from '@rez/rabtul-integration';

const verifyToken = async (token: string) => {
  const result = await authService.verify(token);
  if (!result.valid) throw new Error('Invalid token');
  return result;
};
```

## License

Proprietary - RTNM Group
