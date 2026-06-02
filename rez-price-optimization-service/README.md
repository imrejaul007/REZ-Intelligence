# REZ DYNAMIC PRICING ENGINE

**Version:** 2.0
**Date:** May 6, 2026
**GitHub:** [imrejaul007/rez-price-optimization-service](https://github.com/imrejaul007/rez-price-optimization-service)

---

## WHAT IT DOES

```
Dynamic pricing based on time, inventory, demand, and competition
```

### Features

| Feature | Description |
|---------|-------------|
| Time Pricing | Day of week, hour, season, events |
| Inventory Pricing | Stock level, expiry, overstock |
| Demand Pricing | Historical, real-time, predictions |
| Competition | Market positioning |

---

## PRICING RULES

### Time-Based

| Day | Demand | Discount |
|-----|--------|----------|
| Sunday | High | -5% to -10% |
| Wednesday | Low | -15% to -25% |
| Peak Hour | High | -10% |
| Off-Peak | Low | -25% |

### Inventory-Based

| Condition | Discount |
|-----------|----------|
| Near Expiry (< 3 days) | -40% to -60% |
| Near Expiry (< 7 days) | -20% to -40% |
| Overstock (> 30 days) | -15% to -30% |
| Scarcity (< 10%) | 0% or +5% |

### Demand-Based

| Demand Level | Discount |
|--------------|----------|
| Very High | 0% or +5% |
| High | -5% to -10% |
| Normal | -10% to -15% |
| Low | -15% to -25% |
| Very Low | -25% to -40% |

---

## MERCHANT AI SUGGESTIONS

```
├── "Stock running low - Reorder alert"
├── "Wednesday - Lower demand, suggest 20% off"
├── "Paneer expires in 2 days - 40% off today"
├── "Chicken trending - Premium pricing OK"
└── "Overstock Rice - Bundle offer?"
```

---

## APIS

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/price/calculate` | POST | Calculate dynamic price |
| `/api/price/recommend` | GET | Get recommendations |
| `/api/demand/forecast` | POST | Get demand forecast |
| `/api/inventory/alerts` | GET | Get stock alerts |
| `/api/offers/suggest` | GET | Get offer suggestions |
| `/api/inventory/update` | POST | Update inventory |

---

## INTEGRATIONS

| Service | Purpose |
|---------|---------|
| Merchant Service | Get merchant data |
| Catalog Service | Get product data |
| ReZ Mind | Demand predictions |
| Lead Intelligence | Personalized pricing |

---

## DEPLOYMENT

### Render

```
1. Connect GitHub repo
2. Add env vars
3. Deploy
```

### Environment Variables

```bash
PORT=4105
MONGODB_URI=mongodb://...
REDIS_URL=redis://...
REZMIND_URL=http://localhost:4010
MERCHANT_SERVICE_URL=http://localhost:3001
CATALOG_SERVICE_URL=http://localhost:3002
```

---

## STATUS

| Component | Status |
|-----------|--------|
| Pricing Engine | ✅ Built |
| Demand Forecaster | ✅ Built |
| Inventory Analyzer | ✅ Built |
| Merchant Suggestions | ✅ Built |
| Deployment Ready | ✅ Ready |

---

**Built for scale, designed for growth.**
