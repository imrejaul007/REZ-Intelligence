# REZ QR Campaigns Service

**Port:** 4130

QR-triggered campaign management and attribution.

## Features

- Campaign creation with offers
- QR code generation
- Scan tracking
- Redemption tracking
- Attribution reporting

## Campaign Types

- `discount` - Discount offers
- `loyalty` - Loyalty rewards
- `discovery` - New product discovery
- `feedback` - Customer feedback

## API

```bash
# Create campaign
POST /campaigns

# Activate campaign
POST /campaigns/:id/activate

# Track scan
POST /scan

# Track redemption
POST /redeem

# Get stats
GET /campaigns/:id/stats

# Attribution report
GET /campaigns/:id/attribution
```

## Environment

```bash
PORT=4130
MONGODB_URI=mongodb://localhost:27017/rez_qr_campaigns
BASE_URL=https://rezapp.com
```
