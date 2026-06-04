# REZ Offline Attribution Service

Track offline conversions - walk-ins, phone calls, in-store visits.

## Features

- **Touchpoint Tracking** - QR scans, flyer scans, phone calls, in-store visits
- **Multi-touch Attribution** - First touch, last touch, linear, time decay, position based
- **Customer Journey** - Complete view of online and offline interactions
- **Channel Attribution** - Understand which channels drive offline conversions

## Touchpoint Types

| Type | Description |
|------|-------------|
| walk_in | Customer visited location |
| phone_call | Inbound/outbound call |
| inquiry | Product/service inquiry |
| dine_in | Dined at restaurant |
| browse | In-store browsing |

## Channel Types

| Channel | Description |
|---------|-------------|
| qr_scan | Scanned QR code |
| flyer | Saw physical flyer |
| poster | Saw poster/banner |
| signage | Saw store signage |
| referral | Referred by someone |
| organic | Direct walk-in |
| direct | Direct contact |

## API Endpoints

### Record QR Scan
```bash
POST /api/touchpoints/qr
{
  "merchantId": "merchant_123",
  "customerId": "cust_456",
  "qrCodeId": "qr_table_5",
  "location": { "type": "Point", "coordinates": [77.59, 12.97] }
}
```

### Record Phone Call
```bash
POST /api/touchpoints/call
{
  "merchantId": "merchant_123",
  "customerId": "cust_456",
  "phoneNumber": "+919876543210",
  "callDuration": 180
}
```

### Record Conversion
```bash
POST /api/conversions
{
  "merchantId": "merchant_123",
  "customerId": "cust_456",
  "type": "purchase",
  "revenue": 2500,
  "attributionData": {
    "model": "position_based"
  }
}
```

### Get Channel Attribution Report
```bash
GET /api/reports/:merchantId/channel?startDate=2024-01-01&endDate=2024-01-31
```

## Attribution Models

1. **First Touch** - 100% credit to first touchpoint
2. **Last Touch** - 100% credit to last touchpoint
3. **Linear** - Equal credit to all touchpoints
4. **Time Decay** - More recent touchpoints get more credit
5. **Position Based** - First & last get 40% each, middle gets 20%

## Port

Port: **4294**
