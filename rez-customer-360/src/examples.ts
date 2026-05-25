import logger from './utils/logger';

/**
 * Customer 360 Usage Examples
 * Demonstrates all major features of the Customer 360 module
 */

import {
  Customer360,
  createCustomer360,
  UnifiedProfile,
  Interaction,
  Transaction,
  CustomerPreferences,
} from './index';

// ============================================================================
// Example: Basic Usage
// ============================================================================

async function basicUsageExample() {
  // Create a new Customer 360 instance
  const customer360 = createCustomer360({
    enableRealTimeUpdates: true,
    ltvPredictionModel: 'advanced',
    churnRiskThreshold: 0.5,
  });

  // Set up event listeners
  customer360.on('profile:updated', (profile) => {
    console.log('Profile updated:', profile.firstName, profile.lastName);
  });

  customer360.on('ltv:recalculated', (ltv) => {
    logger.info(`LTV recalculated: $${ltv.totalRevenue.toFixed(2)}`);
  });

  // Create a unified profile
  const profile: UnifiedProfile = {
    id: 'cust_12345',
    firstName: 'John',
    lastName: 'Doe',
    contact: {
      email: 'john.doe@example.com',
      phone: '+1-555-123-4567',
      address: {
        street: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        zipCode: '94102',
        country: 'USA',
      },
    },
    demographics: {
      age: 35,
      gender: 'male',
      occupation: 'Software Engineer',
      income: '100000-150000',
      maritalStatus: 'married',
      children: 2,
    },
    accountStatus: 'active',
    createdAt: new Date('2023-01-15'),
    updatedAt: new Date(),
    tags: ['vip', 'tech-savvy', 'early-adopter'],
    metadata: {
      referralSource: 'google',
      accountTier: 'premium',
    },
  };

  await customer360.loadProfile(profile);
  console.log('Profile loaded:', profile.id);

  // Add tags
  await customer360.addTags(['newsletter-subscriber']);
  console.log('Tags after adding:', customer360.getProfile()?.tags);

  // Load preferences
  const preferences: CustomerPreferences = {
    communication: {
      emailMarketing: true,
      smsMarketing: false,
      pushNotifications: true,
      preferredContactChannel: 'email',
    },
    privacy: {
      dataSharingConsent: false,
      analyticsConsent: true,
      gdprConsent: true,
      marketingConsent: true,
    },
    personalization: {
      language: 'en-US',
      timezone: 'America/Los_Angeles',
      currency: 'USD',
      theme: 'dark',
    },
    customPreferences: [],
  };

  await customer360.loadPreferences(preferences);

  // Update communication preferences
  await customer360.updateCommunicationPreferences({
    smsMarketing: true,
  });

  // Add custom preference
  await customer360.setCustomPreference('notifications', 'dailyDigest', true);
  await customer360.setCustomPreference('notifications', 'weeklyReport', false);

  // Add interactions
  const interactions: Omit<Interaction, 'id'>[] = [
    {
      type: 'purchase',
      channel: 'web',
      timestamp: new Date('2024-01-20'),
      outcome: 'completed',
      sentiment: 'positive',
      metadata: { orderId: 'ORD-001' },
    },
    {
      type: 'support_ticket',
      channel: 'chat',
      timestamp: new Date('2024-02-15'),
      duration: 900,
      outcome: 'resolved',
      sentiment: 'neutral',
      agent: 'agent_42',
      notes: 'Help with account settings',
      metadata: { ticketId: 'TKT-123' },
    },
    {
      type: 'call',
      channel: 'phone',
      timestamp: new Date('2024-03-10'),
      duration: 300,
      outcome: 'upgraded_plan',
      sentiment: 'positive',
      agent: 'agent_15',
      notes: 'Customer inquired about enterprise plan',
      metadata: { callId: 'CALL-456' },
    },
    {
      type: 'email',
      channel: 'email',
      timestamp: new Date('2024-04-05'),
      sentiment: 'neutral',
      metadata: { campaignId: 'SPRING-2024' },
    },
  ];

  for (const interaction of interactions) {
    await customer360.addInteraction(interaction);
  }

  // Add transactions
  const transactions: Omit<Transaction, 'id'>[] = [
    {
      timestamp: new Date('2024-01-20'),
      amount: 299.99,
      currency: 'USD',
      items: [
        { productId: 'PROD-001', name: 'Premium Plan Annual', quantity: 1, unitPrice: 299.99, total: 299.99 },
      ],
      paymentMethod: 'credit_card',
      status: 'completed',
    },
    {
      timestamp: new Date('2024-03-10'),
      amount: 150.00,
      currency: 'USD',
      items: [
        { productId: 'PROD-002', name: 'Add-on: Extra Users', quantity: 5, unitPrice: 30.00, total: 150.00 },
      ],
      paymentMethod: 'credit_card',
      status: 'completed',
    },
  ];

  for (const transaction of transactions) {
    await customer360.addTransaction(transaction);
  }

  // Get interaction history with filters
  const supportInteractions = customer360.getInteractionHistory({
    type: 'support_ticket',
  });
  logger.info(`Support tickets: ${supportInteractions.total}`);

  // Get interaction stats
  const stats = customer360.getInteractionStats();
  console.log('Interaction stats:', {
    total: stats.totalInteractions,
    mostActiveDay: stats.mostActiveDay,
    sentiment: stats.averageSentiment > 0 ? 'positive' : stats.averageSentiment < 0 ? 'negative' : 'neutral',
  });

  // Get lifetime value
  const ltv = customer360.getLifetimeValue();
  console.log('Lifetime Value:', {
    totalRevenue: `$${ltv?.totalRevenue.toFixed(2)}`,
    predictedLTV: `$${ltv?.predictedLTV.toFixed(2)}`,
    score: ltv?.ltvScore,
    churnRisk: ltv?.churnRisk,
    avgOrderValue: `$${ltv?.averageOrderValue.toFixed(2)}`,
  });

  // Get complete 360 view
  const completeView = customer360.getComplete360View();
  console.log('Customer Health:', completeView.summary.overallHealth);
  console.log('Days since last activity:', completeView.summary.daysSinceLastActivity);

  // Export customer data (for GDPR/CCPA compliance)
  const exportedData = customer360.exportCustomerData();
  console.log('Exported data includes:', Object.keys(exportedData));

  return customer360;
}

// ============================================================================
// Example: Filtering and Analytics
// ============================================================================

async function analyticsExample() {
  const customer360 = createCustomer360();

  // Set up profile
  await customer360.loadProfile({
    id: 'cust_analytics_demo',
    firstName: 'Jane',
    lastName: 'Smith',
    contact: { email: 'jane.smith@example.com' },
    demographics: { age: 42 },
    accountStatus: 'active',
    createdAt: new Date('2022-06-01'),
    updatedAt: new Date(),
    tags: [],
    metadata: {},
  });

  // Add multiple interactions over time
  const recentDate = new Date();
  for (let i = 0; i < 20; i++) {
    const date = new Date(recentDate);
    date.setDate(date.getDate() - i * 7);

    await customer360.addInteraction({
      type: i % 4 === 0 ? 'purchase' : i % 3 === 0 ? 'email' : 'chat',
      channel: i % 2 === 0 ? 'web' : 'mobile',
      timestamp: date,
      sentiment: i % 5 === 0 ? 'negative' : 'positive',
      metadata: { day: i },
    });
  }

  // Get interactions from last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentInteractions = customer360.getInteractionsByDateRange(thirtyDaysAgo, new Date());
  logger.info(`Interactions in last 30 days: ${recentInteractions.length}`);

  // Get channel breakdown
  const allStats = customer360.getInteractionStats();
  console.log('Interactions by channel:', allStats.byChannel);

  // Get transactions with amount filters
  for (let i = 1; i <= 5; i++) {
    await customer360.addTransaction({
      timestamp: new Date(),
      amount: i * 50,
      currency: 'USD',
      items: [{ productId: `P-${i}`, name: `Product ${i}`, quantity: 1, unitPrice: i * 50, total: i * 50 }],
      paymentMethod: 'card',
      status: 'completed',
    });
  }

  const expensiveOrders = customer360.getTransactions({ minAmount: 150 });
  logger.info(`Orders over $150: ${expensiveOrders.total}`);

  return customer360;
}

// ============================================================================
// Example: Event-Driven Architecture
// ============================================================================

async function eventsExample() {
  const customer360 = createCustomer360({ enableRealTimeUpdates: true });

  // Subscribe to all events
  const eventLog: Array<{ event: string; data: unknown; timestamp: Date }> = [];

  customer360.on('profile:loaded', (data) => eventLog.push({ event: 'profile:loaded', data, timestamp: new Date() }));
  customer360.on('profile:updated', (data) => eventLog.push({ event: 'profile:updated', data, timestamp: new Date() }));
  customer360.on('profile:tagsUpdated', (data) => eventLog.push({ event: 'profile:tagsUpdated', data, timestamp: new Date() }));
  customer360.on('interaction:added', (data) => eventLog.push({ event: 'interaction:added', data, timestamp: new Date() }));
  customer360.on('transaction:added', (data) => eventLog.push({ event: 'transaction:added', data, timestamp: new Date() }));
  customer360.on('ltv:recalculated', (data) => eventLog.push({ event: 'ltv:recalculated', data, timestamp: new Date() }));
  customer360.on('preferences:loaded', (data) => eventLog.push({ event: 'preferences:loaded', data, timestamp: new Date() }));
  customer360.on('preferences:updated', (data) => eventLog.push({ event: 'preferences:updated', data, timestamp: new Date() }));
  customer360.on('preferences:customUpdated', (data) => eventLog.push({ event: 'preferences:customUpdated', data, timestamp: new Date() }));
  customer360.on('reset', () => eventLog.push({ event: 'reset', data: null, timestamp: new Date() }));

  // Trigger events
  await customer360.loadProfile({
    id: 'cust_events',
    firstName: 'Event',
    lastName: 'Test',
    contact: { email: 'event@test.com' },
    demographics: {},
    accountStatus: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    tags: [],
    metadata: {},
  });

  await customer360.addTags(['test-tag']);
  await customer360.addInteraction({ type: 'chat', channel: 'web', timestamp: new Date(), metadata: {} });
  await customer360.addTransaction({
    timestamp: new Date(),
    amount: 100,
    currency: 'USD',
    items: [],
    paymentMethod: 'card',
    status: 'completed',
  });

  logger.info(`Total events triggered: ${eventLog.length}`);
  console.log('Event types:', eventLog.map((e) => e.event).join(', '));

  return customer360;
}

// ============================================================================
// Run Examples
// ============================================================================

async function main() {
  logger.info('=== Customer 360 Basic Usage ===');
  await basicUsageExample();

  logger.info('\n=== Analytics Example ===');
  await analyticsExample();

  logger.info('\n=== Events Example ===');
  await eventsExample();

  logger.info('\n=== All examples completed successfully ===');
}

main().catch(console.error);
