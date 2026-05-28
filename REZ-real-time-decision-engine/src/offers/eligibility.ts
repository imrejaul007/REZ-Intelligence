import { Logger } from 'pino';
import { RealTimeFraudBlocker } from '../fraud/real-time-block';

export interface EligibilityContext {
  userId: string;
  offerId: string;
  offerType: 'discount' | 'cashback' | 'points' | 'upgrade' | 'trial';
  userProfile: UserProfile;
  transactionContext?: TransactionContext;
  fraudBlocker: RealTimeFraudBlocker;
}

export interface UserProfile {
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  accountAge: number; // days
  totalSpent: number;
  lastPurchaseDate?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  kycStatus: 'none' | 'basic' | 'full';
  exclusionFlags: string[];
}

export interface TransactionContext {
  amount: number;
  category: string;
  merchantId: string;
  paymentMethod: string;
}

export interface EligibilityResult {
  eligible: boolean;
  offerId: string;
  score: number;
  reasons: string[];
  modifiers: OfferModifier[];
  nextBestOffer?: AlternativeOffer;
  expiresAt: string;
}

export interface OfferModifier {
  type: 'discount_adjustment' | 'cap_change' | 'duration_extension';
  value: number;
  reason: string;
}

export interface AlternativeOffer {
  offerId: string;
  type: string;
  estimatedValue: number;
  matchScore: number;
}

export interface EligibilityCheckRequest {
  userId: string;
  offerId: string;
  context?: Partial<TransactionContext>;
}

export interface FraudCheckResult {
  blocked: boolean;
  reason?: string;
  riskScore: number;
}

// Offer eligibility rules engine
const ELIGIBILITY_RULES = {
  discount: {
    minTier: 'bronze',
    minAccountAge: 1,
    kycRequired: 'none',
  },
  cashback: {
    minTier: 'silver',
    minAccountAge: 30,
    kycRequired: 'basic',
  },
  points: {
    minTier: 'bronze',
    minAccountAge: 1,
    kycRequired: 'none',
  },
  upgrade: {
    minTier: 'gold',
    minAccountAge: 90,
    kycRequired: 'full',
  },
  trial: {
    minTier: 'bronze',
    minAccountAge: 1,
    kycRequired: 'none',
  },
};

const TIER_RANKING: Record<string, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
};

export const checkOfferEligibility = async (
  body: EligibilityCheckRequest,
  fraudBlocker: RealTimeFraudBlocker
): Promise<EligibilityResult> => {
  const startTime = Date.now();

  try {
    // Validate input
    if (!body.userId || !body.offerId) {
      throw new Error('Missing required fields: userId, offerId');
    }

    // Fetch user profile (would be from User Service in production)
    const userProfile = await fetchUserProfile(body.userId);

    // Fraud check first
    const fraudResult = await fraudBlocker.checkTransaction({
      userId: body.userId,
      transactionId: body.offerId,
      context: 'offer_redemption',
    });

    if (fraudResult.blocked) {
      return {
        eligible: false,
        offerId: body.offerId,
        score: 0,
        reasons: [`Blocked by fraud system: ${fraudResult.reasons.join(', ')}`],
        modifiers: [],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
    }

    // Check offer-specific rules
    const offerConfig = await fetchOfferConfig(body.offerId);
    const rules = ELIGIBILITY_RULES[offerConfig.type as keyof typeof ELIGIBILITY_RULES] || ELIGIBILITY_RULES.discount;

    const reasons: string[] = [];
    const modifiers: OfferModifier[] = [];
    let score = 100;

    // Tier check
    const userTierRank = TIER_RANKING[userProfile.tier];
    const requiredTierRank = TIER_RANKING[rules.minTier];
    if (userTierRank < requiredTierRank) {
      return {
        eligible: false,
        offerId: body.offerId,
        score: 0,
        reasons: [`Requires ${rules.minTier} tier or higher. Current: ${userProfile.tier}`],
        modifiers: [],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
    }

    // Account age check
    if (userProfile.accountAge < rules.minAccountAge) {
      return {
        eligible: false,
        offerId: body.offerId,
        score: 0,
        reasons: [`Account must be at least ${rules.minAccountAge} days old`],
        modifiers: [],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
    }

    // KYC check
    const kycRank: Record<string, number> = { none: 0, basic: 1, full: 2 };
    if (kycRank[userProfile.kycStatus] < kycRank[rules.kycRequired]) {
      score -= 30;
      reasons.push('KYC verification recommended for better offers');
    }

    // Exclusion check
    if (userProfile.exclusionFlags.includes(offerConfig.category)) {
      return {
        eligible: false,
        offerId: body.offerId,
        score: 0,
        reasons: ['User excluded from this offer category'],
        modifiers: [],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
    }

    // Tier-based modifiers
    if (userProfile.tier === 'gold' || userProfile.tier === 'platinum') {
      modifiers.push({
        type: 'discount_adjustment',
        value: 5, // 5% extra discount
        reason: `${userProfile.tier} tier bonus`,
      });
      score += 10;
    }

    // Engagement modifiers
    if (!userProfile.emailVerified) {
      score -= 10;
      modifiers.push({
        type: 'duration_extension',
        value: 0,
        reason: 'Verify email to unlock full offer value',
      });
    }

    if (!userProfile.phoneVerified) {
      score -= 10;
    }

    // Recency modifiers
    if (userProfile.lastPurchaseDate) {
      const daysSincePurchase = (Date.now() - new Date(userProfile.lastPurchaseDate).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSincePurchase > 90) {
        modifiers.push({
          type: 'cap_change',
          value: 1.5, // 50% higher cap
          reason: 'Welcome back bonus - increased offer cap',
        });
        score += 15;
        reasons.push('Welcome back offer activated');
      }
    }

    // Payment method bonus
    if (body.context?.paymentMethod === 'premium_card') {
      modifiers.push({
        type: 'discount_adjustment',
        value: 2,
        reason: 'Premium payment method bonus',
      });
      score += 5;
    }

    const eligible = score >= 60;
    const normalizedScore = Math.min(100, Math.max(0, score)) / 100;

    return {
      eligible,
      offerId: body.offerId,
      score: normalizedScore,
      reasons: eligible ? (reasons.length ? reasons : ['All eligibility criteria met']) : ['Score below minimum threshold'],
      modifiers,
      nextBestOffer: eligible ? await findAlternativeOffer(body, offerConfig) : undefined,
      expiresAt: new Date(Date.now() + offerConfig.validityDays * 24 * 60 * 60 * 1000).toISOString(),
    };

  } catch (error) {
    const err = error as Error;
    throw new Error(`Eligibility check failed: ${err.message}`);
  }
};

// Helper functions
async function fetchUserProfile(userId: string): Promise<UserProfile> {
  // In production, this would call User Service
  return {
    tier: 'silver',
    accountAge: 45,
    totalSpent: 2500,
    lastPurchaseDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    emailVerified: true,
    phoneVerified: true,
    kycStatus: 'basic',
    exclusionFlags: [],
  };
}

async function fetchOfferConfig(offerId: string): Promise<{ type: string; category: string; validityDays: number; baseValue: number; offerId: string }> {
  // In production, this would call Offer Service
  return {
    offerId,
    type: 'cashback',
    category: 'retail',
    validityDays: 30,
    baseValue: 10,
  };
}

async function findAlternativeOffer(
  request: EligibilityCheckRequest,
  _originalOffer: { type: string; category: string; validityDays: number; baseValue: number; offerId: string }
): Promise<AlternativeOffer | undefined> {
  // Find a suitable alternative offer
  // In production, this would query the Offer Service
  return {
    offerId: `ALT-${request.offerId}`,
    type: 'points',
    estimatedValue: 500,
    matchScore: 0.75,
  };
}
