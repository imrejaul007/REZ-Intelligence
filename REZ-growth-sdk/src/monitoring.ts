/**
 * REZ Merchant Growth SDK - Usage Examples
 */

import { MerchantGrowthSDK } from './index';

// ============== INITIALIZATION ==============

const sdk = new MerchantGrowthSDK({
  apiKey: process.env.REZ_API_KEY || 'your-api-key',
  baseUrl: process.env.REZ_API_URL || 'http://localhost:4290',
  timeout: 30000
});

// ============== BUDGET OPTIMIZATION ==============

async function budgetExample() {
  // Optimize campaign budget
  const budget = await sdk.budget.optimize({
    merchantId: 'merchant_123',
    totalBudget: 100000,
    strategy: 'roas_based',
    minChannelBudget: 5000
  });

  console.log('Budget allocations:', budget.allocations);
  console.log('Expected ROAS:', budget.expectedTotalRoas);

  // Create campaign
  const campaign = await sdk.budget.createCampaign({
    merchantId: 'merchant_123',
    name: 'Summer Sale',
    channel: 'instagram',
    currentBudget: 25000
  });

  console.log('Campaign created:', campaign.id);
}

// ============== HEALTH SCORE ==============

async function healthExample() {
  const score = await sdk.health.calculateScore({
    merchantId: 'merchant_123',
    industry: 'restaurant',
    revenue: {
      current: 500000,
      previous: 450000,
      target: 600000
    },
    customers: {
      total: 1000,
      new: 100,
      active: 700,
      churned: 50,
      returning: 600
    },
    engagement: {
      loyaltyMembers: 300,
      referrals: 50,
      reviews: 200,
      avgRating: 4.5
    },
    operational: {
      avgOrderValue: 500,
      ordersPerDay: 100,
      fulfillmentRate: 95
    }
  });

  console.log('Health Score:', score.score);
  console.log('Tier:', score.tier);
  console.log('Risks:', score.risks);
}

// ============== OFFERS ==============

async function offersExample() {
  // Create offer
  const offer = await sdk.offers.create({
    merchantId: 'merchant_123',
    name: 'Weekend Cashback',
    type: 'cashback',
    value: 20,
    minOrderValue: 500,
    channels: ['whatsapp', 'sms'],
    startDate: '2024-01-01',
    endDate: '2024-01-31'
  });

  console.log('Offer created:', offer.id);

  // Get recommendation for customer
  const recommended = await sdk.offers.recommend('customer_456', {
    timeOfDay: 'lunch',
    dayOfWeek: 'friday'
  });

  console.log('Recommended offer:', recommended);
}

// ============== REVIEWS ==============

async function reviewsExample() {
  // Ingest review
  const review = await sdk.reviews.ingest({
    merchantId: 'merchant_123',
    platform: 'google',
    rating: 4,
    text: 'Great food and service!',
    customerName: 'John D.'
  });

  console.log('Review ingested:', review.id);

  // Generate AI response
  const response = await sdk.reviews.generateResponse(review.id);
  console.log('AI Response:', response.response);

  // Approve and post
  await sdk.reviews.approve(review.id, response.response, 'manager_123');

  // Get sentiment stats
  const stats = await sdk.reviews.getSentimentStats('merchant_123');
  console.log('Sentiment Stats:', stats);
}

// ============== FORECAST ==============

async function forecastExample() {
  // Get today's prediction
  const today = await sdk.forecast.getTodayPrediction('merchant_123');
  console.log('Today\'s predicted revenue:', today.predicted);
  console.log('Confidence:', today.confidence);

  // Get weekly forecast
  const weekly = await sdk.forecast.getWeeklyForecast('merchant_123');
  console.log('Weekly prediction:', weekly.totalPredicted);

  // Predict campaign impact
  const impact = await sdk.forecast.predictCampaignImpact({
    merchantId: 'merchant_123',
    campaignType: 'cashback',
    budget: 10000,
    duration: 7
  });

  console.log('Expected lift:', impact.expectedLift + '%');
}

// ============== PLAYBOOKS ==============

async function playbookExample() {
  // Get recommendations
  const recommended = await sdk.playbooks.recommend({
    industry: 'restaurant',
    goals: ['increase_lunch_visits', 'increase_slow_hour_traffic'],
    budget: 15000
  });

  console.log('Recommended playbooks:', recommended);

  // Get playbook details
  const playbook = await sdk.playbooks.getById('lunch-rush-boost');
  console.log('Steps:', playbook.steps.length);
}

// ============== COMPETITOR ==============

async function competitorExample() {
  // Add competitor
  const competitor = await sdk.competitors.add({
    merchantId: 'merchant_123',
    name: 'Competitor Restaurant',
    sources: [{ type: 'google', url: 'https://maps.google.com/...' }]
  });

  // Record prices
  await sdk.competitors.recordPrices({
    competitorId: competitor.id,
    merchantId: 'merchant_123',
    items: [{ name: 'Burger', price: 199 }]
  });

  // Get price comparison
  const comparison = await sdk.competitors.getPriceComparison('merchant_123');
  console.log('Price comparison:', comparison);

  // Get alerts
  const alerts = await sdk.competitors.getAlerts('merchant_123', 'new');
  console.log('Competitor alerts:', alerts.length);
}

// ============== GROWTH AGENT ==============

async function growthAgentExample() {
  // Create experiment
  const experiment = await sdk.growthAgent.createExperiment({
    merchantId: 'merchant_123',
    name: 'Lunch Traffic Boost',
    goal: 'increase_lunch_visits',
    targetMetric: 'lunch_orders',
    targetValue: 100,
    duration: 14,
    budget: 20000
  });

  console.log('Experiment created:', experiment.id);

  // Start experiment
  await sdk.growthAgent.start(experiment.id);

  // Get results
  const results = await sdk.growthAgent.getResults(experiment.id);
  console.log('Results:', results);
}

// ============== HEALTH CHECK ==============

async function healthCheckExample() {
  const status = await sdk.healthCheck();

  console.log('Service Status:');
  for (const [service, isHealthy] of Object.entries(status)) {
    console.log(`  ${service}: ${isHealthy ? '✅' : '❌'}`);
  }
}

// ============== RUN ALL ==============

async function main() {
  console.log('=== Merchant Growth SDK Examples ===\n');

  try {
    await healthCheckExample();
    console.log('\n---\n');

    // Uncomment to run specific examples:
    // await budgetExample();
    // await healthExample();
    // await offersExample();
    // await reviewsExample();
    // await forecastExample();
    // await playbookExample();
    // await competitorExample();
    // await growthAgentExample();

  } catch (error) {
    console.error('Error:', error);
  }
}

main();
