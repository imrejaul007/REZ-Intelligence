# REZ Behavioral Psychology Service

**Port:** 4110

Behavioral psychology scoring for user personas.

## Signals Collected

- **Cashback Sensitivity** - Responsiveness to cashback/redemption
- **Convenience Preference** - Values convenience over price
- **Luxury Affinity** - Preference for premium products
- **Impulse Score** - Impulse buyer tendency
- **Price Sensitivity** - Price-conscious behavior
- **Deal Seeking** - Actively seeks discounts

## Buyer Types

- `SAVER` - Deal seekers, price sensitive
- `CONVENIENCE` - Values time and ease
- `LUXURY` - Premium buyers
- `BALANCED` - Mix of all

## API

```bash
# Get user psychology
GET /api/psychology/:userId

# Get scores
GET /api/psychology/:userId/scores

# Get buying style
GET /api/psychology/:userId/style

# Record event
POST /api/psychology/event
```

## Environment

```bash
PORT=4110
MONGODB_URI=mongodb://localhost:27017/rez_behavioral
```
