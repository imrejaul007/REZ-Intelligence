# REZ Merchant Growth SDK

Client SDK for Merchant Growth OS services.

## Installation

```bash
npm install @rez/merchant-growth-sdk
```

## Usage

```typescript
import { MerchantGrowthSDK } from '@rez/merchant-growth-sdk';

const sdk = new MerchantGrowthSDK({
  apiKey: 'your-api-key',
  baseUrl: 'http://localhost:4290'
});

// Optimize budget
const budget = await sdk.budget.optimize({
  merchantId: 'm123',
  totalBudget: 100000,
  strategy: 'roas_based'
});

// Get health score
const score = await sdk.health.calculateScore({
  merchantId: 'm123',
  industry: 'restaurant',
  revenue: { current: 500000, previous: 450000, target: 600000 },
  customers: { total: 1000, new: 100, active: 700, churned: 50, returning: 600 },
  engagement: { loyaltyMembers: 300, referrals: 50, reviews: 200, avgRating: 4.5 }
});

// Get revenue forecast
const forecast = await sdk.forecast.getTodayPrediction('m123');

// Check all services
const health = await sdk.healthCheck();
```

## Available Clients

| Client | Methods |
|--------|---------|
| `sdk.budget` | optimize, getCampaigns, createCampaign, getChannelPerformance |
| `sdk.health` | calculateScore, getScore, getAlerts, getBenchmarks |
| `sdk.offers` | create, getAll, recommend, optimize, getPerformance |
| `sdk.reviews` | ingest, getAll, generateResponse, approve, getSentimentStats |
| `sdk.forecast` | getTodayPrediction, getWeeklyForecast, getMonthlyForecast, predictCampaignImpact |
| `sdk.playbooks` | getAll, getById, getByIndustry, recommend, getCategories |
| `sdk.competitors` | add, getAll, recordPrices, getPriceComparison, getAlerts |
| `sdk.growthAgent` | createExperiment, getExperiments, start, getResults, scale |

## Port

**SDK connects to:** http://localhost:4290
