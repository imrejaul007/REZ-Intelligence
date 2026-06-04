# REZ Growth Playbook Library

Pre-built growth playbooks by industry, season, and goal.

## Features

- **50+ Pre-built Playbooks** across 15 industries
- **Industry-Specific**: Restaurant, Retail, Salon, Hotel, Gym, and more
- **Goal-Oriented**: Traffic, Revenue, Retention, Acquisition, Launch
- **Seasonal Campaigns**: Festival, Weekend, New Year, Summer
- **Campaign Templates**: Step-by-step execution guides

## Industries Covered

| Industry | Playbooks |
|----------|-----------|
| Restaurant | 5 playbooks |
| Retail | 4 playbooks |
| Salon | 2 playbooks |
| Hotel | 2 playbooks |
| Gym | 2 playbooks |
| General | 6 playbooks |

## Categories

| Category | Description |
|----------|-------------|
| traffic | Drive footfall |
| revenue | Increase sales |
| retention | Keep customers |
| acquisition | New customers |
| loyalty | Tier upgrades |
| launch | New locations/products |

## Popular Playbooks

### Restaurant

1. **Lunch Rush Boost** - Drive lunch hour traffic
2. **Weekend Revenue Surge** - Maximize weekend sales
3. **Customer Reactivation** - Win back lapsed customers
4. **New Dish Launch** - Generate buzz for new menu

### Retail

1. **New Arrival Buzz** - Product launch
2. **Loyalty Tier Upgrade** - Move members up tiers
3. **Referral Viral Loop** - Self-sustaining referrals

### General

1. **Grand Opening Blitz** - New location launch
2. **Festival Campaign** - Diwali, Holi, Eid
3. **Win-Back Competition** - Recover lost customers

## API Endpoints

### Get All Playbooks
```bash
GET /api/playbooks
```

### Filter by Industry
```bash
GET /api/playbooks/industry/restaurant
```

### Get by ID
```bash
GET /api/playbooks/lunch-rush-boost
```

### Get Recommendations
```bash
POST /api/recommend
{
  "industry": "restaurant",
  "goals": ["increase_lunch_visits", "increase_slow_hour_traffic"],
  "budget": 15000
}
```

## Response Example

```json
{
  "id": "lunch-rush-boost",
  "name": "Lunch Rush Boost",
  "description": "Drive more customers during lunch hours (11 AM - 2 PM)",
  "industry": ["restaurant", "cafe", "food-court"],
  "category": "traffic",
  "goal": "increase_lunch_visits",
  "difficulty": "beginner",
  "budget": { "min": 5000, "max": 20000 },
  "steps": [
    {
      "order": 1,
      "action": "Create",
      "channel": "whatsapp",
      "content": "Send 'Lunch Special' offer to nearby office workers",
      "timing": "10:30 AM daily"
    }
  ],
  "metrics": ["lunch_orders", "footfall", "avg_order_value"]
}
```

## Port

Port: **4291**
