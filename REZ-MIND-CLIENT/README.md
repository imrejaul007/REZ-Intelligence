# REZ Mind Client - Integration Guide

## Quick Setup

### 1. Install

```bash
npm install axios
```

### 2. Copy to your app

Copy `src/ReZMindClient.ts` to your app's services folder.

### 3. Import

```typescript
import { rezMind } from '../services/ReZMindClient';
```

---

## MERCHANT APP INTEGRATION

### Add to Order Completion

```typescript
// When order is completed
const result = await rezMind.merchant.sendOrderCompleted({
  merchant_id: 'merchant_123',
  order_id: 'order_456',
  customer_id: 'customer_789',
  items: [
    { item_id: 'biryani', quantity: 2, price: 250 },
    { item_id: 'cola', quantity: 2, price: 40 }
  ],
  total_amount: 580,
  payment_method: 'upi'
});

if (result.success) {
  console.log('Event sent to ReZ Mind:', result.correlation_id);
}
```

### Add to Inventory Check

```typescript
// When stock falls below threshold
const result = await rezMind.merchant.sendInventoryLow({
  merchant_id: 'merchant_123',
  item_id: 'biryani',
  item_name: 'Chicken Biryani',
  current_stock: 3,
  threshold: 5,
  avg_daily_sales: 12,
  recent_orders: 35
});
```

### Add to Payment Success

```typescript
// When payment is confirmed
const result = await rezMind.merchant.sendPaymentSuccess({
  merchant_id: 'merchant_123',
  transaction_id: 'txn_abc123',
  amount: 580,
  order_id: 'order_456'
});
```

---

## CONSUMER APP INTEGRATION

### Add to Order Placed

```typescript
// When user places order
const result = await rezMind.consumer.sendOrder({
  user_id: 'user_123',
  order_id: 'order_456',
  merchant_id: 'merchant_789',
  items: [
    { item_id: 'biryani', quantity: 1, price: 250 }
  ],
  total_amount: 250
});
```

### Add to Search

```typescript
// When user searches
const result = await rezMind.consumer.sendSearch({
  user_id: 'user_123',
  query: 'biryani near me',
  results_count: 15,
  clicked_item: 'biryani_large'
});
```

### Add to Item View

```typescript
// When user views item
const result = await rezMind.consumer.sendView({
  user_id: 'user_123',
  item_id: 'biryani_large',
  item_name: 'Chicken Biryani Large',
  merchant_id: 'merchant_789',
  duration_seconds: 15
});
```

### Add to Booking

```typescript
// When user books service
const result = await rezMind.consumer.sendBooking({
  user_id: 'user_123',
  booking_id: 'booking_123',
  service_type: 'salon',
  merchant_id: 'merchant_456',
  amount: 500
});
```

---

## ENVIRONMENT VARIABLES

### Development
```bash
EXPO_PUBLIC_EVENT_PLATFORM_URL=http://localhost:4008
```

### Production
```bash
EXPO_PUBLIC_EVENT_PLATFORM_URL=https://rez-event-platform.onrender.com
```

---

## ERROR HANDLING

```typescript
try {
  const result = await rezMind.merchant.sendInventoryLow(data);
  if (!result.success) {
    // Retry or queue for later
    console.log('Failed to send event');
  }
} catch (error) {
  // Non-blocking - don't break the app
  console.error('ReZ Mind error:', error);
}
```

---

## FIRE-AND-FORGET

Events are fire-and-forget. Don't await if you don't need the response:

```typescript
// Non-blocking - doesn't slow down your app
rezMind.merchant.sendOrderCompleted(data);

// Or use fire-and-forget pattern
(async () => {
  await rezMind.merchant.sendOrderCompleted(data);
})();
```

---

## WHERE TO ADD IN YOUR APP

### Merchant App
- `OrderService.ts` - When order completed
- `InventoryService.ts` - When stock low
- `PaymentService.ts` - When payment confirmed

### Consumer App
- `SearchService.ts` - When user searches
- `ProductService.ts` - When item viewed
- `OrderService.ts` - When order placed
- `BookingService.ts` - When booking made

---

Last updated: 2026-05-01
