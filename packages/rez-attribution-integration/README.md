# @rez/attribution-integration

Unified client for all REZ attribution services.

## Services Consolidated

| Service | Port | Purpose |
|---------|------|---------|
| REZ-unified-attribution | 4090 | Primary attribution hub |
| REZ-ltv-attribution | 4090 | Lifetime value by channel |
| REZ-dooh-attribution | 4081 | DOOH attribution |
| rez-crosschannel-attribution | 4115 | Cross-channel tracking |

## Usage

```typescript
import { AttributionClient } from '@rez/attribution-integration';

const attribution = new AttributionClient({
  internalToken: process.env.INTERNAL_SERVICE_TOKEN,
});

// Track touchpoint
const { touchpointId } = await attribution.trackTouchpoint({
  customerId: 'cust_123',
  channel: 'dooh',
  source: 'digital_billboard',
});

// Track conversion
const { conversionId } = await attribution.trackConversion({
  customerId: 'cust_123',
  merchantId: 'merch_456',
  orderId: 'order_789',
  amount: 500,
  channel: 'dooh',
});

// Get attribution report
const report = await attribution.getAttribution({
  customerId: 'cust_123',
  startDate: new Date('2026-05-01'),
  endDate: new Date('2026-05-19'),
  model: 'DATA_DRIVEN',
});

// Get ROI by channel
const roi = await attribution.getROIByChannel({
  merchantId: 'merch_456',
  startDate: new Date('2026-05-01'),
  endDate: new Date('2026-05-19'),
});
```

## Architecture

```
┌─────────────────────────────────────────┐
│      @rez/attribution-integration         │
├─────────────────────────────────────────┤
│  Unified Client Interface                │
├─────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │  DOOH  │ │   LTV   │ │ Cross-  │  │
│  │  Attr.  │ │   Attr. │ │ Channel │  │
│  └────┬────┘ └────┬────┘ └────┬────┘  │
│       └──────────┬┴──────────┘        │
│                  ▼                      │
│         REZ-unified-attribution         │
└─────────────────────────────────────────┘
```

## License

Proprietary - RTNM Group
