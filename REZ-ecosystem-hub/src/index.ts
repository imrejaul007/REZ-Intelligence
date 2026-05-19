/**
 * REZ Ecosystem Hub
 *
 * Connects REZ Intelligence, REZ Media, RABTUL, and CorpPerks
 * into a unified behavioral economy.
 *
 * Architecture:
 *
 * REZ Intelligence (Brain) ───► Unified Profile ───► Recommendations
 *        │                                           │
 *        ▼                                           ▼
 * REZ Media (Attention) ◄──────► Signals ◄──────► Loyalty
 *        │                    │
 *        ▼                    ▼
 * RABTUL (Commerce) ◄─────► Wallet
 *        │
 *        ▼
 * CorpPerks (Enterprise)
 */

import express, { Request, Response } from 'express';

const app = express();
const PORT = parseInt(process.env.PORT || '4105', 10);

app.use(express.json());

// ============================================
// SERVICE URLs
// ============================================

const SERVICES = {
  // RABTUL Services
  auth: process.env.RABTUL_AUTH_URL || 'http://localhost:4002',
  payment: process.env.RABTUL_PAYMENT_URL || 'http://localhost:4001',
  wallet: process.env.RABTUL_WALLET_URL || 'http://localhost:4004',
  loyalty: process.env.RABTUL_LOYALTY_URL || 'http://localhost:4097',

  // REZ Intelligence Services
  identity: process.env.REZ_IDENTITY_URL || 'http://localhost:4050',
  predictive: process.env.REZ_PREDICTIVE_URL || 'http://localhost:4123',
  signal: process.env.REZ_SIGNAL_URL || 'http://localhost:4121',
  orchestrator: process.env.REZ_ORCHESTRATOR_URL || 'http://localhost:4101',

  // REZ Media Services
  karma: process.env.KARMA_URL || 'http://localhost:3009',
  ads: process.env.ADS_URL || 'http://localhost:4068',

  // CorpPerks
  corpperks: process.env.CORPPERKS_URL || 'http://localhost:5000',
};

// ============================================
// TYPES
// ============================================

interface UserSignal {
  userId: string;
  source: 'REZ_APP' | 'REZ_MEDIA' | 'RABTUL' | 'CORPPERKS';
  action: string;
  data: Record<string, unknown>;
  timestamp: Date;
  location?: string;
  device?: string;
}

interface UnifiedProfile {
  userId: string;
  identities: {
    rabtul?: string;
    rezMedia?: string;
    karma?: string;
    corpperks?: string;
  };
  signals: UserSignal[];
  predictions: {
    churnRisk: number;
    ltv: number;
    engagementScore: number;
    preferredCategories: string[];
  };
  loyalty: {
    tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
    lifetimeCoins: number;
    karmaScore: number;
  };
  lastActive: Date;
}

// In-memory stores (use MongoDB in production)
const profiles = new Map<string, UnifiedProfile>();
const signals: UserSignal[] = [];

// ============================================
// SIGNAL PROCESSING
// ============================================

/**
 * Process a user signal from any source
 * Routes to appropriate services
 */
async function processSignal(signal: UserSignal): Promise<void> {
  // Store signal
  signals.push(signal);

  // Update unified profile
  const profile = await getOrCreateProfile(signal.userId);
  profile.signals.push(signal);
  profile.lastActive = new Date();

  // Route to appropriate services
  await Promise.all([
    // Send to signal aggregator
    sendToService(`${SERVICES.signal}/api/signals`, signal).catch(() => {}),

    // Handle based on source
    ...handleSignalBySource(signal)
  ]);
}

async function handleSignalBySource(signal: UserSignal): Promise<Promise<void>[]> {
  const actions: Promise<void>[] = [];

  switch (signal.source) {
    case 'REZ_MEDIA':
      // Media engagement → update karma score
      if (signal.action.includes('karma')) {
        actions.push(
          sendToService(`${SERVICES.karma}/api/karma/earn`, {
            userId: signal.userId,
            action: signal.action,
            points: calculateKarmaPoints(signal.action)
          }).catch(() => {})
        );
      }
      break;

    case 'RABTUL':
      // Commerce action → update loyalty
      if (signal.action === 'purchase') {
        const amount = signal.data.amount as number || 0;
        actions.push(
          earnLoyaltyCoins(signal.userId, amount * 0.01).catch(() => {})
        );
      }
      break;

    case 'CORPPERKS':
      // Corporate action → sync with loyalty
      actions.push(
        syncCorpPerksToLoyalty(signal.userId, signal.data).catch(() => {})
      );
      break;
  }

  return actions;
}

function calculateKarmaPoints(action: string): number {
  const pointMap: Record<string, number> = {
    'qr_scan': 20,
    'gps_checkin': 15,
    'donation': 50,
    'social_share': 25,
    'review': 30,
    'mission_complete': 40,
    'streak': 35,
    'community_post': 20,
    'friend_referral': 100
  };

  return pointMap[action] || 10;
}

// ============================================
// USER PROFILE
// ============================================

async function getOrCreateProfile(userId: string): Promise<UnifiedProfile> {
  if (profiles.has(userId)) {
    return profiles.get(userId)!;
  }

  // Fetch from multiple sources in parallel
  const [loyalty, karma, prediction] = await Promise.all([
    getLoyaltyProfile(userId).catch(() => null),
    getKarmaProfile(userId).catch(() => null),
    getPrediction(userId).catch(() => null)
  ]);

  const profile: UnifiedProfile = {
    userId,
    identities: {},
    signals: [],
    predictions: prediction || {
      churnRisk: 0,
      ltv: 0,
      engagementScore: 50,
      preferredCategories: []
    },
    loyalty: {
      tier: loyalty?.tier || 'BRONZE',
      lifetimeCoins: loyalty?.lifetimeCoins || 0,
      karmaScore: karma?.score || 300
    },
    lastActive: new Date()
  };

  profiles.set(userId, profile);
  return profile;
}

async function getLoyaltyProfile(userId: string): Promise<{ tier: string; lifetimeCoins: number } | null> {
  try {
    const response = await fetch(`${SERVICES.loyalty}/api/tier/${userId}`);
    const data = await response.json();
    return { tier: data.currentTier, lifetimeCoins: data.lifetimeCoins };
  } catch {
    return null;
  }
}

async function getKarmaProfile(userId: string): Promise<{ score: number } | null> {
  try {
    const response = await fetch(`${SERVICES.karma}/api/karma/user/${userId}`);
    const data = await response.json();
    return { score: data.score };
  } catch {
    return null;
  }
}

async function getPrediction(userId: string): Promise<UnifiedProfile['predictions'] | null> {
  try {
    const response = await fetch(`${SERVICES.predictive}/api/predict/${userId}`);
    return await response.json();
  } catch {
    return null;
  }
}

// ============================================
// LOYALTY OPERATIONS
// ============================================

async function earnLoyaltyCoins(userId: string, coins: number): Promise<void> {
  await sendToService(`${SERVICES.loyalty}/api/earn`, {
    userId,
    amount: coins,
    source: 'ECOSYSTEM_HUB',
    description: 'Ecosystem engagement reward'
  });
}

async function syncCorpPerksToLoyalty(userId: string, data: Record<string, unknown>): Promise<void> {
  // Corporate achievements sync to loyalty
  if (data.achievement) {
    await earnLoyaltyCoins(userId, 50);
  }
  if (data.milestone) {
    await earnLoyaltyCoins(userId, 200);
  }
}

// ============================================
// SERVICE COMMUNICATION
// ============================================

async function sendToService(url: string, data: unknown): Promise<Response> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return response;
}

// ============================================
// API ENDPOINTS
// ============================================

// Health
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'ecosystem-hub',
    version: '1.0.0',
    connectedServices: Object.keys(SERVICES),
    timestamp: new Date().toISOString()
  });
});

// ============================================
// SIGNALS API
// ============================================

// Receive signal from any source
app.post('/api/v1/signals', async (req: Request, res: Response) => {
  const { userId, source, action, data, location, device } = req.body;

  if (!userId || !source || !action) {
    return res.status(400).json({ error: 'userId, source, and action required' });
  }

  const signal: UserSignal = {
    userId,
    source,
    action,
    data: data || {},
    timestamp: new Date(),
    location,
    device
  };

  await processSignal(signal);

  res.json({ success: true, signal });
});

// Receive batch signals
app.post('/api/v1/signals/batch', async (req: Request, res: Response) => {
  const { signals } = req.body as { signals: UserSignal[] };

  await Promise.all(signals.map(processSignal));

  res.json({ success: true, processed: signals.length });
});

// ============================================
// UNIFIED PROFILE API
// ============================================

// Get unified profile
app.get('/api/v1/profile/:userId', async (req: Request, res: Response) => {
  const profile = await getOrCreateProfile(req.params.userId);
  res.json({ profile });
});

// Update identity linking
app.post('/api/v1/profile/:userId/link', async (req: Request, res: Response) => {
  const { source, externalId } = req.body;
  const profile = await getOrCreateProfile(req.params.userId);

  if (source === 'rabtul') profile.identities.rabtul = externalId;
  if (source === 'rezMedia') profile.identities.rezMedia = externalId;
  if (source === 'karma') profile.identities.karma = externalId;
  if (source === 'corpperks') profile.identities.corpperks = externalId;

  profiles.set(req.params.userId, profile);

  res.json({ success: true, profile });
});

// ============================================
// AI RECOMMENDATIONS API
// ============================================

// Get personalized recommendations
app.get('/api/v1/recommendations/:userId', async (req: Request, res: Response) => {
  const profile = await getOrCreateProfile(req.params.userId);

  // Get AI recommendations
  const [loyaltyRecs, mediaRecs, merchantRecs] = await Promise.all([
    getLoyaltyRecommendations(profile),
    getMediaRecommendations(profile),
    getMerchantRecommendations(profile)
  ]);

  res.json({
    userId: req.params.userId,
    recommendations: {
      loyalty: loyaltyRecs,
      media: mediaRecs,
      merchants: merchantRecs
    },
    predictions: profile.predictions
  });
});

async function getLoyaltyRecommendations(profile: UnifiedProfile): Promise<string[]> {
  const tier = profile.loyalty.tier;
  const coins = profile.loyalty.lifetimeCoins;

  const recs: string[] = [];

  // Tier upgrade suggestion
  if (coins >= 4500 && coins < 5000) {
    recs.push('Only 500 more coins to SILVER tier!');
  }
  if (coins >= 19500 && coins < 20000) {
    recs.push('Only 500 more coins to GOLD tier!');
  }

  // Redemption suggestions
  if (profile.loyalty.lifetimeCoins > 1000) {
    recs.push('You have enough coins for a discount!');
  }

  return recs;
}

async function getMediaRecommendations(profile: UnifiedProfile): Promise<string[]> {
  const recs: string[] = [];

  // Karma suggestions based on score
  if (profile.loyalty.karmaScore < 450) {
    recs.push('Scan a QR code to boost your Karma score!');
  }

  // Engagement suggestions
  if (profile.signals.length < 5) {
    recs.push('Check in at partner locations to earn REZ coins!');
  }

  return recs;
}

async function getMerchantRecommendations(profile: UnifiedProfile): Promise<string[]> {
  const categories = profile.predictions.preferredCategories || [];

  // Recommend based on preferences
  if (categories.includes('food')) {
    return ['Restaurant partners near you', 'New cafe opened!', 'Food delivery deals'];
  }

  return ['Popular nearby', 'Trending this week', 'New partners'];
}

// ============================================
// CROSS-BRAND CAMPAIGNS API
// ============================================

interface Campaign {
  id: string;
  name: string;
  trigger: {
    action: string;
    source: string;
  };
  reward: {
    coins: number;
    source: 'loyalty' | 'karma';
  };
  target: string[];
}

const campaigns: Campaign[] = [
  {
    id: 'c1',
    name: 'Restaurant Week',
    trigger: { action: 'visit', source: 'REZ_MEDIA' },
    reward: { coins: 50, source: 'loyalty' },
    target: ['restaurant', 'food']
  },
  {
    id: 'c2',
    name: 'Karma Streak',
    trigger: { action: 'checkin', source: 'REZ_MEDIA' },
    reward: { coins: 25, source: 'karma' },
    target: ['community']
  },
  {
    id: 'c3',
    name: 'Corporate Bonus',
    trigger: { action: 'milestone', source: 'CORPPERKS' },
    reward: { coins: 100, source: 'loyalty' },
    target: ['enterprise']
  }
];

// Check campaign eligibility
app.post('/api/v1/campaigns/check', async (req: Request, res: Response) => {
  const { userId, action, source } = req.body;

  const eligible = campaigns.filter(c =>
    c.trigger.action === action && c.trigger.source === source
  );

  res.json({ eligible });
});

// Trigger campaign reward
app.post('/api/v1/campaigns/:campaignId/trigger', async (req: Request, res: Response) => {
  const { userId } = req.body;
  const campaign = campaigns.find(c => c.id === req.params.campaignId);

  if (!campaign) {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  // Award reward
  if (campaign.reward.source === 'loyalty') {
    await earnLoyaltyCoins(userId, campaign.reward.coins);
  }

  res.json({
    success: true,
    campaign: campaign.name,
    reward: campaign.reward.coins,
    message: `You earned ${campaign.reward.coins} REZ Coins!`
  });
});

// ============================================
// ANALYTICS API
// ============================================

// Get user engagement score
app.get('/api/v1/analytics/engagement/:userId', async (req: Request, res: Response) => {
  const profile = await getOrCreateProfile(req.params.userId);

  const signalCount = profile.signals.length;
  const lastActive = profile.lastActive;
  const karmaScore = profile.loyalty.karmaScore;
  const coins = profile.loyalty.lifetimeCoins;

  // Calculate engagement score (0-100)
  const engagementScore = Math.min(100,
    (signalCount * 5) +
    (karmaScore / 10) +
    (coins / 1000)
  );

  res.json({
    userId: req.params.userId,
    engagementScore: Math.round(engagementScore),
    signalCount,
    lastActive,
    karmaScore,
    lifetimeCoins: coins,
    tier: profile.loyalty.tier
  });
});

// ============================================
// SERVICE STATUS
// ============================================

app.get('/api/v1/services/status', (_req: Request, res: Response) => {
  const status = Object.entries(SERVICES).map(([name, url]) => ({
    name,
    url,
    status: 'connected' // Would ping in production
  }));

  res.json({ services: status });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`REZ Ecosystem Hub running on port ${PORT}`);
  console.log('');
  console.log('Connected Services:');
  Object.entries(SERVICES).forEach(([name, url]) => {
    console.log(`  ${name}: ${url}`);
  });
  console.log('');
  console.log('Features:');
  console.log('  • Unified user profiles');
  console.log('  • Signal processing');
  console.log('  • Cross-brand campaigns');
  console.log('  • AI recommendations');
  console.log('  • Engagement analytics');
});

export { app };
