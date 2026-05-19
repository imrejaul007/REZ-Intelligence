# RABTUL Integration Guide

## Overview

All REZ-Intelligence services should integrate with RABTUL platform services for core functionality instead of implementing these features locally.

## When to Use RABTUL

| Feature | RABTUL Service | Port | Use Instead Of |
|---------|---------------|------|---------------|
| Authentication | rez-auth-service | 4002 | Local JWT, bcrypt |
| Payment Processing | rez-payment-service | 4001 | Direct Razorpay/Stripe |
| Wallet/Coins | rez-wallet-service | 4004 | Local wallet tables |
| Notifications | rez-notifications-service | 4011 | Local SMS/Email |
| User Profiles | rez-profile-service | 4013 | Local profile tables |
| Orders | rez-order-service | 4006 | Local order tables |
| Product Catalog | rez-catalog-service | 4007 | Local product tables |
| Search | rez-search-service | 4008 | Custom search |

## Quick Integration

### Option 1: Use Shared Package (Recommended)

```typescript
// Install @rez/rabtul-integration package
import { authService, paymentService, walletService } from '@rez/rabtul-integration';

// Verify user token
const auth = await authService.verify(token);
if (auth.valid) {
  console.log('User:', auth.userId);
}

// Process payment
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
```

### Option 2: Direct HTTP Calls

```typescript
const RABTUL_AUTH_URL = process.env.RABTUL_AUTH_URL || 'http://localhost:4002';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN;

async function verifyToken(token: string) {
  const response = await fetch(`${RABTUL_AUTH_URL}/api/auth/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': INTERNAL_TOKEN,
    },
    body: JSON.stringify({ token }),
  });
  return response.json();
}
```

## Environment Variables

```bash
# RABTUL Service URLs
RABTUL_AUTH_URL=http://localhost:4002
RABTUL_PAYMENT_URL=http://localhost:4001
RABTUL_WALLET_URL=http://localhost:4004
RABTUL_NOTIFICATIONS_URL=http://localhost:4011
RABTUL_PROFILE_URL=http://localhost:4013
RABTUL_ORDER_URL=http://localhost:4006
RABTUL_CATALOG_URL=http://localhost:4007
RABTUL_SEARCH_URL=http://localhost:4008

# Service-to-Service Authentication
INTERNAL_SERVICE_TOKEN=your-secure-token
```

## Service Integration Status

### Already Using RABTUL ✓

| Service | Integration | Status |
|---------|-------------|--------|
| REZ-care-service | Auth, Payment, Wallet, Notifications | ✅ Complete |
| REZ-enterprise-gateway | Auth, Payment, Wallet URLs | ✅ Complete |
| REZ-karma-loyalty-bridge | RABTUL wallet coins | ✅ Complete |
| REZ-attribution-loyalty-bridge | RABTUL payment | ✅ Complete |
| REZ-unified-engine | RABTUL auth (with local fallback) | ✅ Complete |
| rez-service-connectors | RABTUL URLs | ✅ Complete |

### Need Migration (Local Auth)

| Service | Current Pattern | Action |
|---------|---------------|--------|
| rez-priority-engine | Local JWT_SECRET | Migrate to RABTUL |
| REZ-ab-testing | Local auth | Migrate to RABTUL |
| REZ-realtime-segments | Local auth | Migrate to RABTUL |
| rez-confidence-scorer | Local auth | Migrate to RABTUL |
| REZ-unified-identity | Local auth | Migrate to RABTUL |

## Migration Examples

### Before (Local Auth)

```typescript
// ❌ DON'T do this
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret';

async function login(phone: string, password: string) {
  const user = await User.findOne({ phone });
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error('Invalid credentials');

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
  return { token };
}
```

### After (RABTUL Auth)

```typescript
// ✅ DO this
import { authService } from '@rez/rabtul-integration';

async function login(phone: string, otp: string) {
  const result = await authService.verifyOTP(phone, otp);
  if (!result.success) throw new Error('Invalid OTP');

  return { token: result.token };
}

async function verifyRequest(token: string) {
  const auth = await authService.verify(token);
  if (!auth.valid) throw new Error('Unauthorized');
  return auth.userId;
}
```

### Before (Local Payment)

```typescript
// ❌ DON'T do this
import Razorpay from 'razorpay';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

async function createPayment(orderId: string, amount: number) {
  const payment = await razorpay.orders.create({
    amount: amount * 100, // Razorpay uses paise
    currency: 'INR',
  });
  return payment;
}
```

### After (RABTUL Payment)

```typescript
// ✅ DO this
import { paymentService } from '@rez/rabtul-integration';

async function createPayment(orderId: string, amount: number) {
  const payment = await paymentService.initiate({
    orderId,
    amount,
    paymentMethod: 'upi',
    purpose: 'order_payment',
  });
  return payment;
}
```

### Before (Local Wallet)

```typescript
// ❌ DON'T do this
async function addCoins(userId: string, amount: number) {
  const user = await User.findById(userId);
  user.walletBalance += amount;
  user.lifetimeEarnings += amount;
  await user.save();

  await WalletTransaction.create({
    userId,
    amount,
    type: 'credit',
    reason: 'bonus',
  });
}
```

### After (RABTUL Wallet)

```typescript
// ✅ DO this
import { walletService } from '@rez/rabtul-integration';

async function addCoins(userId: string, amount: number, reason: string) {
  const result = await walletService.addCoins({
    userId,
    amount,
    reason,
    source: 'rez-intelligence',
  });
  return result;
}
```

## Error Handling

```typescript
import { paymentService } from '@rez/rabtul-integration';

async function safePayment(paymentId: string) {
  try {
    return await paymentService.getStatus(paymentId);
  } catch (error) {
    if (error.message.includes('404')) {
      return { status: 'not_found' };
    }
    if (error.message.includes('401')) {
      throw new Error('RABTUL authentication failed - check INTERNAL_SERVICE_TOKEN');
    }
    throw error;
  }
}
```

## Circuit Breaker Pattern

For resilience, wrap RABTUL calls with circuit breaker:

```typescript
import { CircuitBreaker } from '@rez/shared';

const authBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
});

async function verifyWithFallback(token: string) {
  try {
    return await authBreaker.execute(() => authService.verify(token));
  } catch (error) {
    // Circuit open - use fallback
    console.warn('RABTUL auth unavailable, using fallback');
    return { valid: false, fallback: true };
  }
}
```

## Testing

Mock RABTUL services in tests:

```typescript
// test/setup.ts
jest.mock('@rez/rabtul-integration', () => ({
  authService: {
    verify: jest.fn().mockResolvedValue({ valid: true, userId: 'test_user' }),
  },
  paymentService: {
    initiate: jest.fn().mockResolvedValue({ paymentId: 'pay_test_123' }),
  },
}));
```

## Checklist

- [ ] Identify local auth/payment/wallet implementations
- [ ] Add `@rez/rabtul-integration` dependency
- [ ] Replace local implementations with RABTUL calls
- [ ] Add environment variables for RABTUL URLs
- [ ] Handle RABTUL service unavailability (fallback or error)
- [ ] Update tests to mock RABTUL responses
- [ ] Remove local credential tables/code
- [ ] Document integration in service README

## Resources

- [RABTUL RAP.md](RABTUL-Technologies/RAP.md)
- [@rez/rabtul-integration package](packages/rez-rabtul-integration)
- [RABTUL Service Ports](../docs/PORTS.md)
