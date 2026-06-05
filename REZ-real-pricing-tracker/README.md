# REZ Real-Time Pricing Tracker

Track competitor prices in real-time with alerts and insights.

## Features

- **Real-time Tracking** - Monitor competitor prices across platforms
- **Price Change Alerts** - Get notified of price drops immediately
- **Multi-Source Scraping** - Zomato, Swiggy, Google, websites
- **Price Comparison** - Compare your prices vs competitors
- **Trend Analysis** - Historical price trends
- **Actionable Insights** - Recommendations based on competitor moves

## Supported Sources

- Zomato
- Swiggy
- Google Business
- Restaurant Websites
- Manual Entry

## Alert Types

- **Price Drop** - Competitor lowered price
- **Price Increase** - Competitor raised price
- **New Item** - Competitor added new item
- **Item Removed** - Competitor removed item
- **Discount** - Competitor running discount

## API Endpoints

### Track Competitor
```bash
POST /api/competitors
{
  "merchantId": "m_123",
  "name": "Competitor Restaurant",
  "sources": [
    { "type": "zomato", "url": "https://zomato.com/..." }
  ]
}
```

### Scrape Prices
```bash
POST /api/scrape/:competitorId
```

### Get Price Comparison
```bash
GET /api/prices/compare/:merchantId
```

## Port

Port: **4212**
