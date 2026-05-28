/**
 * Cosmic OS - Ecosystem Services Integration
 *
 * Connects Cosmic OS to RisaCare, REZ Consumer, ReZ Ride, CorpPerks
 */

import axios from 'axios';

// ============================================
// SERVICE URLs
// ============================================

const ECOSYSTEM_SERVICES = {
  // RisaCare (Health)
  risacare: process.env.RISACARE_URL || 'http://localhost:4700',

  // REZ Consumer (Commerce)
  rezConsumer: process.env.REZ_CONSUMER_URL || 'http://localhost:3000',

  // ReZ Ride (Mobility)
  rezRide: process.env.REZ_RIDE_URL || 'http://localhost:4000',

  // CorpPerks (Career)
  corpperks: process.env.CORPPERKS_URL || 'http://localhost:4200',

  // REZ Media (Karma)
  rezMedia: process.env.REZ_MEDIA_URL || 'http://localhost:3800',
};

const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'dev-internal-token';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Internal-Token': INTERNAL_TOKEN,
});

// ============================================
// RISA CARE (Health Layer)
// ============================================

export interface RisaCareWellnessData {
  userId: string;
  wellnessScore: number;
  sleepQuality: number;
  stressLevel: number;
  fitnessLevel: number;
  recentActivities: string[];
  healthGoals: string[];
  recoveryStatus: 'recovering' | 'stable' | 'depleted';
}

export async function getRisaCareWellness(userId: string): Promise<RisaCareWellnessData | null> {
  try {
    // Get wellness data from RisaCare
    const response = await axios.get(
      `${ECOSYSTEM_SERVICES.risacare}/api/wellness/${userId}`,
      { headers: getHeaders(), timeout: 5000 }
    );

    return {
      userId,
      wellnessScore: response.data.wellnessScore || 70,
      sleepQuality: response.data.sleepQuality || 70,
      stressLevel: response.data.stressLevel || 30,
      fitnessLevel: response.data.fitnessLevel || 60,
      recentActivities: response.data.recentActivities || [],
      healthGoals: response.data.healthGoals || [],
      recoveryStatus: response.data.recoveryStatus || 'stable',
    };
  } catch {
    return null;
  }
}

export async function emitHealthSignals(userId: string): Promise<void> {
  const wellness = await getRisaCareWellness(userId);
  if (!wellness) return;

  // These would be sent to the Human Context Graph
  const signals = [
    { signal: 'wellness_score', value: wellness.wellnessScore, confidence: 0.9 },
    { signal: 'sleep_quality', value: wellness.sleepQuality, confidence: 0.85 },
    { signal: 'stress_level', value: wellness.stressLevel, confidence: 0.8 },
    { signal: 'fitness_level', value: wellness.fitnessLevel, confidence: 0.75 },
    { signal: 'recovery_status', value: wellness.recoveryStatus, confidence: 0.7 },
  ];

  return;
}

// ============================================
// REZ CONSUMER (Commerce Layer)
// ============================================

export interface REZConsumerCommerceData {
  userId: string;
  spendingLevel: number;
  categoryAffinities: Record<string, number>;
  diningPreferences: string[];
  purchaseFrequency: number;
  impulseScore: number;
  priceSensitivity: number;
}

export async function getREZConsumerCommerce(userId: string): Promise<REZConsumerCommerceData | null> {
  try {
    // Get commerce signals from REZ Consumer
    const response = await axios.get(
      `${ECOSYSTEM_SERVICES.rezConsumer}/api/signals/commerce/${userId}`,
      { headers: getHeaders(), timeout: 5000 }
    );

    return {
      userId,
      spendingLevel: response.data.spendingLevel || 50,
      categoryAffinities: response.data.categoryAffinities || {},
      diningPreferences: response.data.diningPreferences || [],
      purchaseFrequency: response.data.purchaseFrequency || 5,
      impulseScore: response.data.impulseScore || 50,
      priceSensitivity: response.data.priceSensitivity || 50,
    };
  } catch {
    // Fallback to behavioral psychology
    try {
      const response = await axios.get(
        `http://localhost:4110/api/psychology/${userId}/scores`,
        { headers: getHeaders(), timeout: 5000 }
      );
      return {
        userId,
        spendingLevel: 50,
        categoryAffinities: {},
        diningPreferences: [],
        purchaseFrequency: 5,
        impulseScore: response.data.impulseScore || 50,
        priceSensitivity: response.data.priceSensitivity || 50,
      };
    } catch {
      return null;
    }
  }
}

export async function emitCommerceSignals(userId: string): Promise<void> {
  const commerce = await getREZConsumerCommerce(userId);
  if (!commerce) return;

  const signals = [
    { signal: 'spending_level', value: commerce.spendingLevel, confidence: 0.8 },
    { signal: 'purchase_frequency', value: commerce.purchaseFrequency, confidence: 0.85 },
    { signal: 'impulse_score', value: commerce.impulseScore, confidence: 0.7 },
    { signal: 'price_sensitivity', value: commerce.priceSensitivity, confidence: 0.75 },
  ];

  return;
}

// ============================================
// REZ RIDE (Mobility Layer)
// ============================================

export interface ReZRideMobilityData {
  userId: string;
  travelFrequency: number;
  commutePattern: 'daily' | 'occasional' | 'remote';
  explorationLevel: number;
  mobilityStress: number;
  preferredTransport: string[];
  frequentDestinations: string[];
}

export async function getReZRideMobility(userId: string): Promise<ReZRideMobilityData | null> {
  try {
    // Get mobility data from ReZ Ride
    const response = await axios.get(
      `${ECOSYSTEM_SERVICES.rezRide}/api/signals/mobility/${userId}`,
      { headers: getHeaders(), timeout: 5000 }
    );

    return {
      userId,
      travelFrequency: response.data.travelFrequency || 5,
      commutePattern: response.data.commutePattern || 'occasional',
      explorationLevel: response.data.explorationLevel || 50,
      mobilityStress: response.data.mobilityStress || 30,
      preferredTransport: response.data.preferredTransport || ['car'],
      frequentDestinations: response.data.frequentDestinations || [],
    };
  } catch {
    return null;
  }
}

export async function emitMobilitySignals(userId: string): Promise<void> {
  const mobility = await getReZRideMobility(userId);
  if (!mobility) return;

  const signals = [
    { signal: 'travel_frequency', value: mobility.travelFrequency, confidence: 0.85 },
    { signal: 'commute_pattern', value: mobility.commutePattern, confidence: 0.9 },
    { signal: 'exploration_level', value: mobility.explorationLevel, confidence: 0.75 },
    { signal: 'mobility_stress', value: mobility.mobilityStress, confidence: 0.7 },
  ];

  return;
}

// ============================================
// CORPPERKS (Career Layer)
// ============================================

export interface CorpPerksCareerData {
  userId: string;
  burnoutRisk: number;
  ambitionLevel: number;
  productivityScore: number;
  workSatisfaction: number;
  careerStage: 'early' | 'growth' | 'mid' | 'senior' | 'executive';
  workLifeBalance: number;
}

export async function getCorpPerksCareer(userId: string): Promise<CorpPerksCareerData | null> {
  try {
    // Get career data from CorpPerks
    const response = await axios.get(
      `${ECOSYSTEM_SERVICES.corpperks}/api/signals/career/${userId}`,
      { headers: getHeaders(), timeout: 5000 }
    );

    return {
      userId,
      burnoutRisk: response.data.burnoutRisk || 30,
      ambitionLevel: response.data.ambitionLevel || 60,
      productivityScore: response.data.productivityScore || 70,
      workSatisfaction: response.data.workSatisfaction || 60,
      careerStage: response.data.careerStage || 'growth',
      workLifeBalance: response.data.workLifeBalance || 50,
    };
  } catch {
    return null;
  }
}

export async function emitCareerSignals(userId: string): Promise<void> {
  const career = await getCorpPerksCareer(userId);
  if (!career) return;

  const signals = [
    { signal: 'burnout_risk', value: career.burnoutRisk, confidence: 0.8 },
    { signal: 'ambition_level', value: career.ambitionLevel, confidence: 0.75 },
    { signal: 'productivity_score', value: career.productivityScore, confidence: 0.85 },
    { signal: 'work_satisfaction', value: career.workSatisfaction, confidence: 0.7 },
    { signal: 'career_stage', value: career.careerStage, confidence: 0.9 },
    { signal: 'work_life_balance', value: career.workLifeBalance, confidence: 0.8 },
  ];

  return;
}

// ============================================
// REZ MEDIA (Karma Layer)
// ============================================

export interface REZMediaKarmaData {
  userId: string;
  karmaScore: number;
  generosityLevel: number;
  communityEngagement: number;
  socialContribution: number;
  recentImpactActions: string[];
}

export async function getREZMediaKarma(userId: string): Promise<REZMediaKarmaData | null> {
  try {
    // Get karma data from REZ Media
    const response = await axios.get(
      `${ECOSYSTEM_SERVICES.rezMedia}/api/karma/signals/${userId}`,
      { headers: getHeaders(), timeout: 5000 }
    );

    return {
      userId,
      karmaScore: response.data.karmaScore || 50,
      generosityLevel: response.data.generosityLevel || 50,
      communityEngagement: response.data.communityEngagement || 50,
      socialContribution: response.data.socialContribution || 50,
      recentImpactActions: response.data.recentImpactActions || [],
    };
  } catch {
    return null;
  }
}

export async function emitKarmaSignals(userId: string): Promise<void> {
  const karma = await getREZMediaKarma(userId);
  if (!karma) return;

  const signals = [
    { signal: 'karma_score', value: karma.karmaScore, confidence: 0.9 },
    { signal: 'generosity_level', value: karma.generosityLevel, confidence: 0.85 },
    { signal: 'community_engagement', value: karma.communityEngagement, confidence: 0.8 },
    { signal: 'social_contribution', value: karma.socialContribution, confidence: 0.75 },
  ];

  return;
}

// ============================================
// UNIFIED ECOSYSTEM CONTEXT
// ============================================

export interface EcosystemContext {
  userId: string;
  health?: RisaCareWellnessData | null;
  commerce?: REZConsumerCommerceData | null;
  mobility?: ReZRideMobilityData | null;
  career?: CorpPerksCareerData | null;
  karma?: REZMediaKarmaData | null;
  fetchedAt: Date;
}

export async function getFullEcosystemContext(userId: string): Promise<EcosystemContext> {
  // Fetch all data in parallel
  const [health, commerce, mobility, career, karma] = await Promise.all([
    getRisaCareWellness(userId),
    getREZConsumerCommerce(userId),
    getReZRideMobility(userId),
    getCorpPerksCareer(userId),
    getREZMediaKarma(userId),
  ]);

  return {
    userId,
    health,
    commerce,
    mobility,
    career,
    karma,
    fetchedAt: new Date(),
  };
}

// ============================================
// SIGNAL EMISSION
// ============================================

export async function emitAllSignals(userId: string): Promise<{
  emitted: number;
  failed: number;
}> {
  let emitted = 0;
  let failed = 0;

  const emitFunctions = [
    () => emitHealthSignals(userId),
    () => emitCommerceSignals(userId),
    () => emitMobilitySignals(userId),
    () => emitCareerSignals(userId),
    () => emitKarmaSignals(userId),
  ];

  for (const fn of emitFunctions) {
    try {
      await fn();
      emitted++;
    } catch {
      failed++;
    }
  }

  return { emitted, failed };
}
