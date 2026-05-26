/**
 * REZ Karma-Loyalty Bridge Service
 * Connects Karma (social impact) with RABTUL Unified Loyalty (universal coins)
 *
 * This is the CRITICAL integration point that makes REZ loyalty truly unified.
 *
 * Flow:
 * Karma Action → Karma Score → REZ Coins → Tier Progress → More Benefits
 */

import crypto from 'crypto';
import express, { Request, Response } from 'express';
import { logger } from './utils/logger.js';

const app = express();
const PORT = parseInt(process.env.PORT || '4098', 10);

app.use(express.json());

// ============================================
// CONFIGURATION
// ============================================

// RABTUL services
const RABTUL_URL = process.env.RABTUL_URL || 'http://localhost:4004';

// Karma service
const KARMA_URL = process.env.KARMA_URL || 'http://localhost:3009';

// ============================================
// TYPES
// ============================================

interface KarmaAction {
  type: 'checkin' | 'donation' | 'share' | 'review' | 'mission' | 'streak';
  karmaPoints: number;
  rezCoins: number; // Converted amount
  description: string;
}

interface ConversionRecord {
  id: string;
  userId: string;
  karmaUserId: string;
  action: string;
  karmaPoints: number;
  rezCoins: number;
  timestamp: Date;
  status: 'pending' | 'completed' | 'failed';
}

interface BridgeConfig {
  // Conversion rates: karma points → REZ coins
  conversionRates: Record<string, number>; // e.g., { checkin: 0.1 } = 10 karma = 1 REZ coin
  // Bonus multipliers by tier
  tierMultipliers: Record<string, number>; // e.g., { GOLD: 1.5 }
  // Karma score thresholds for bonus
  scoreThresholds: Record<string, number>; // e.g., { GOLD: 600 }
}

// Default configuration
const DEFAULT_CONFIG: BridgeConfig = {
  // 10 karma points = 1 REZ coin (base rate)
  conversionRates: {
    checkin: 0.1,     // QR/GPS check-in: 10 karma = 1 coin
    donation: 0.15,    // Donation: 10 karma = 1.5 coins
    share: 0.05,     // Social share: 20 karma = 1 coin
    review: 0.1,      // Review posted: 10 karma = 1 coin
    mission: 0.2,      // Mission completed: 10 karma = 2 coins
    streak: 0.25,     // Streak bonus: 10 karma = 2.5 coins
  },
  // Tier multipliers
  tierMultipliers: {
    BRONZE: 1.0,
    SILVER: 1.25,
    GOLD: 1.5,
    PLATINUM: 2.0,
  },
  // Karma score thresholds
  scoreThresholds: {
    SILVER: 450,
    GOLD: 600,
    PLATINUM: 750,
  },
};

// In-memory stores (use MongoDB in production)
const conversions: ConversionRecord[] = [];
const config = { ...DEFAULT_CONFIG };

// ============================================
// CONVERSION LOGIC
// ============================================

/**
 * Convert karma points to REZ coins
 * Applies:
 * 1. Base conversion rate by action type
 * 2. Tier multiplier
 * 3. Karma score bonus
 */
function convertKarmaToRezCoins(
  karmaPoints: number,
  actionType: keyof typeof config.conversionRates,
  tier: keyof typeof config.tierMultipliers,
  karmaScore: number
): number {
  // Get base rate
  const baseRate = config.conversionRates[actionType] || 0.1;

  // Calculate base coins
  let coins = karmaPoints * baseRate;

  // Apply tier multiplier
  const tierMultiplier = config.tierMultipliers[tier] || 1.0;
  coins *= tierMultiplier;

  // Apply karma score bonus (every 100 points above 450 = +5% bonus)
  if (karmaScore >= 450) {
    const scoreBonus = Math.floor((karmaScore - 450) / 100) * 0.05;
    coins *= (1 + Math.min(scoreBonus, 0.5)); // Cap at 50% bonus
  }

  // Round to 2 decimal places
  return Math.round(coins * 100) / 100;
}

/**
 * Get tier from karma score
 */
function getTierFromKarmaScore(score: number): keyof typeof config.tierMultipliers {
  if (score >= 750) return 'PLATINUM';
  if (score >= 600) return 'GOLD';
  if (score >= 450) return 'SILVER';
  return 'BRONZE';
}

// ============================================
// API ENDPOINTS
// ============================================

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'karma-loyalty-bridge',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Get conversion preview (before committing)
app.post('/api/v1/convert/preview', (req: Request, res: Response) => {
  const { karmaPoints, actionType, karmaScore } = req.body;

  if (!karmaPoints || !actionType) {
    return res.status(400).json({ error: 'karmaPoints and actionType required' });
  }

  const tier = getTierFromKarmaScore(karmaScore || 300);
  const coins = convertKarmaToRezCoins(karmaPoints, actionType, tier, karmaScore || 300);

  res.json({
    karmaPoints,
    actionType,
    karmaScore: karmaScore || 300,
    tier,
    baseRate: config.conversionRates[actionType] || 0.1,
    tierMultiplier: config.tierMultipliers[tier] || 1.0,
    scoreBonus: karmaScore >= 450 ? Math.min(Math.floor((karmaScore - 450) / 100) * 5, 50) : 0,
    rezCoins: coins,
    breakdown: {
      baseCoins: karmaPoints * (config.conversionRates[actionType] || 0.1),
      afterTier: karmaPoints * (config.conversionRates[actionType] || 0.1) * (config.tierMultipliers[tier] || 1.0),
      afterScore: coins,
    },
  });
});

// Convert karma points to REZ coins
app.post('/api/v1/convert', async (req: Request, res: Response) => {
  const { userId, karmaUserId, karmaPoints, actionType, karmaScore, description } = req.body;

  if (!userId || !karmaUserId || !karmaPoints || !actionType) {
    return res.status(400).json({
      error: 'userId, karmaUserId, karmaPoints, and actionType required'
    });
  }

  // Determine tier from karma score
  const tier = getTierFromKarmaScore(karmaScore || 300);

  // Calculate REZ coins
  const rezCoins = convertKarmaToRezCoins(karmaPoints, actionType, tier, karmaScore || 300);

  // Create conversion record
  const record: ConversionRecord = {
    id: `conv_${crypto.randomUUID()}`,
    userId,
    karmaUserId,
    action: actionType,
    karmaPoints,
    rezCoins,
    timestamp: new Date(),
    status: 'completed',
  };

  conversions.push(record);

  // In production, this would:
  // 1. Call RABTUL to add coins to user wallet
  // 2. Call Karma to mark points as converted
  // 3. Emit event for analytics

  res.status(201).json({
    success: true,
    conversion: record,
    message: `${karmaPoints} Karma points → ${rezCoins} REZ Coins`,
    nextTier: getNextTierInfo(tier, karmaPoints),
  });
});

// Get conversion history
app.get('/api/v1/conversions/:userId', (req: Request, res: Response) => {
  const userConversions = conversions.filter(c => c.userId === req.params.userId);

  const totalKarma = userConversions.reduce((sum, c) => sum + c.karmaPoints, 0);
  const totalRezCoins = userConversions.reduce((sum, c) => sum + c.rezCoins, 0);

  res.json({
    userId: req.params.userId,
    conversions: userConversions.reverse(),
    summary: {
      totalConversions: userConversions.length,
      totalKarmaPoints: totalKarma,
      totalRezCoins: totalRezCoins,
      avgConversionRate: totalKarma > 0 ? (totalRezCoins / totalKarma * 100).toFixed(2) + '%' : '0%',
    },
  });
});

// Get conversion rates
app.get('/api/v1/config/rates', (_req: Request, res: Response) => {
  res.json({
    conversionRates: config.conversionRates,
    tierMultipliers: config.tierMultipliers,
    scoreThresholds: config.scoreThresholds,
  });
});

// Update conversion rates (admin)
app.put('/api/v1/config/rates', (req: Request, res: Response) => {
  const { actionType, rate } = req.body;

  if (actionType && rate !== undefined) {
    config.conversionRates[actionType] = rate;
  }

  res.json({
    success: true,
    updatedRates: config.conversionRates,
  });
});

// Bulk convert (for batch processing)
app.post('/api/v1/convert/batch', async (req: Request, res: Response) => {
  const { conversions } = req.body as {
    conversions: Array<{
      userId: string;
      karmaUserId: string;
      karmaPoints: number;
      actionType: string;
      karmaScore: number;
    }>;
  };

  if (!conversions || !Array.isArray(conversions)) {
    return res.status(400).json({ error: 'conversions array required' });
  }

  const results = conversions.map(c => {
    const tier = getTierFromKarmaScore(c.karmaScore || 300);
    const rezCoins = convertKarmaToRezCoins(c.karmaPoints, c.actionType as keyof typeof config.conversionRates, tier, c.karmaScore || 300);

    const record: ConversionRecord = {
      id: `conv_${crypto.randomUUID()}`,
      userId: c.userId,
      karmaUserId: c.karmaUserId,
      action: c.actionType,
      karmaPoints: c.karmaPoints,
      rezCoins,
      timestamp: new Date(),
      status: 'completed',
    };

    conversions.push(record);
    return record;
  });

  const totalKarma = results.reduce((sum, r) => sum + r.karmaPoints, 0);
  const totalRezCoins = results.reduce((sum, r) => sum + r.rezCoins, 0);

  res.status(201).json({
    success: true,
    processed: results.length,
    totalKarmaPoints: totalKarma,
    totalRezCoins: totalRezCoins,
    results,
  });
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function getNextTierInfo(
  currentTier: keyof typeof config.tierMultipliers,
  karmaPoints: number
): { nextTier: string; coinsNeeded: number } | null {
  const tierOrder: (keyof typeof config.tierMultipliers)[] = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
  const currentIndex = tierOrder.indexOf(currentTier);

  if (currentIndex >= tierOrder.length - 1) {
    return null; // Already at highest tier
  }

  const nextTier = tierOrder[currentIndex + 1];
  const nextThreshold = config.scoreThresholds[nextTier] || 0;
  const coinsNeeded = Math.max(0, nextThreshold - karmaPoints);

  return { nextTier, coinsNeeded };
}

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  logger.info(`REZ Karma-Loyalty Bridge running on port ${PORT}`);
  logger.info('');
  logger.info('Features:');
  logger.info('  • Karma points → REZ Coins conversion');
  logger.info('  • Tier-based multipliers');
  logger.info('  • Karma score bonuses');
  logger.info('  • Batch processing');
  logger.info('');
  logger.info('Conversion Rates:');
  Object.entries(config.conversionRates).forEach(([action, rate]) => {
    logger.info(`  ${action}: ${(rate * 100).toFixed(1)}% (10 karma = ${rate * 100} coins)`);
  });
  logger.info('');
  logger.info('Tier Multipliers:');
  Object.entries(config.tierMultipliers).forEach(([tier, mult]) => {
    logger.info(`  ${tier}: ${mult}x`);
  });
});

export { app };
