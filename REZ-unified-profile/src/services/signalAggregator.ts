import axios, { AxiosError } from 'axios';
import { logger } from '../config/logger.js';
import type {
  SignalScores,
  LocationSignals,
  BehavioralSignals,
  SocialSignals,
  CompetitorSignals,
  ServiceSignalResponse
} from '../types/index.js';

// Service URLs from environment
const LOCATION_SERVICE_URL = process.env.LOCATION_SERVICE_URL || 'http://localhost:4115';
const BEHAVIORAL_SERVICE_URL = process.env.BEHAVIORAL_SERVICE_URL || 'http://localhost:4110';
const SOCIAL_SERVICE_URL = process.env.SOCIAL_SERVICE_URL || 'http://localhost:4116';
const COMPETITOR_SERVICE_URL = process.env.COMPETITOR_SERVICE_URL || 'http://localhost:4117';

// Timeout for service calls
const SERVICE_TIMEOUT = 5000;

interface FetchResult<T> {
  success: boolean;
  data: T | null;
  error?: string;
}

async function fetchWithTimeout<T>(
  url: string,
  timeout: number = SERVICE_TIMEOUT
): Promise<FetchResult<T>> {
  try {
    const response = await axios.get<T>(url, {
      timeout,
      headers: {
        'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || '',
        'Content-Type': 'application/json'
      }
    });

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    const axiosError = error as AxiosError;
    let errorMessage = 'Unknown error';

    if (axiosError.code === 'ECONNREFUSED') {
      errorMessage = `Service unavailable: ${url}`;
    } else if (axiosError.code === 'ETIMEDOUT' || axiosError.response?.status === 408) {
      errorMessage = `Service timeout: ${url}`;
    } else if (axiosError.response) {
      errorMessage = `Service error (${axiosError.response.status}): ${url}`;
    } else {
      errorMessage = axiosError.message;
    }

    logger.warn(`Failed to fetch from ${url}`, { error: errorMessage });

    return {
      success: false,
      data: null,
      error: errorMessage
    };
  }
}

// Default signals when service is unavailable
function getDefaultLocationSignals(): LocationSignals {
  return {
    segments: [],
    patterns: [],
    favoriteZones: [],
    confidence: 0
  };
}

function getDefaultBehavioralSignals(): BehavioralSignals {
  return {
    buyerType: 'standard',
    cashbackSensitivity: 50,
    luxuryAffinity: 50,
    impulseScore: 50,
    confidence: 0
  };
}

function getDefaultSocialSignals(): SocialSignals {
  return {
    influenceTier: 'low',
    referralCount: 0,
    sharingRate: 0,
    confidence: 0
  };
}

function getDefaultCompetitorSignals(): CompetitorSignals {
  return {
    loyaltyScore: 50,
    switchRisk: 'low',
    winBackPotential: 50,
    confidence: 0
  };
}

export async function fetchLocationSignals(userId: string): Promise<LocationSignals> {
  const url = `${LOCATION_SERVICE_URL}/api/location/${userId}/patterns`;

  try {
    const result = await fetchWithTimeout<ServiceSignalResponse>(url);

    if (result.success && result.data) {
      // Handle various response formats
      const data = result.data as unknown as Record<string, unknown>;
      return {
        segments: (data.segments || (data.location as Record<string, unknown>)?.segments || []) as LocationSignals['segments'],
        patterns: (data.patterns || (data.location as Record<string, unknown>)?.patterns || []) as LocationSignals['patterns'],
        favoriteZones: (data.favoriteZones || (data.location as Record<string, unknown>)?.favoriteZones || []) as LocationSignals['favoriteZones'],
        confidence: (data.confidence || (data.location as Record<string, unknown>)?.confidence || 75) as number
      };
    }

    logger.debug(`Location signals unavailable for user ${userId}, using defaults`);
    return getDefaultLocationSignals();

  } catch (error) {
    logger.warn(`Error fetching location signals for ${userId}`, { error: error.message });
    return getDefaultLocationSignals();
  }
}

export async function fetchBehavioralSignals(userId: string): Promise<BehavioralSignals> {
  const url = `${BEHAVIORAL_SERVICE_URL}/api/psychology/${userId}/scores`;

  try {
    const result = await fetchWithTimeout<ServiceSignalResponse>(url);

    if (result.success && result.data) {
      const data = result.data as unknown as Record<string, unknown>;
      const behavioral = (data.behavioral || {}) as Record<string, unknown>;
      return {
        buyerType: (data.buyerType || behavioral.buyerType || 'standard') as BehavioralSignals['buyerType'],
        cashbackSensitivity: (data.cashbackSensitivity || behavioral.cashbackSensitivity || 50) as number,
        luxuryAffinity: (data.luxuryAffinity || behavioral.luxuryAffinity || 50) as number,
        impulseScore: (data.impulseScore || behavioral.impulseScore || 50) as number,
        confidence: (data.confidence || behavioral.confidence || 75) as number
      };
    }

    logger.debug(`Behavioral signals unavailable for user ${userId}, using defaults`);
    return getDefaultBehavioralSignals();

  } catch (error) {
    logger.warn(`Error fetching behavioral signals for ${userId}`, { error: error.message });
    return getDefaultBehavioralSignals();
  }
}

export async function fetchSocialSignals(userId: string): Promise<SocialSignals> {
  const url = `${SOCIAL_SERVICE_URL}/api/social/${userId}`;

  try {
    const result = await fetchWithTimeout<ServiceSignalResponse>(url);

    if (result.success && result.data) {
      const data = result.data as unknown as Record<string, unknown>;
      const social = (data.social || {}) as Record<string, unknown>;
      return {
        influenceTier: (data.influenceTier || social.influenceTier || 'low') as SocialSignals['influenceTier'],
        referralCount: (data.referralCount || social.referralCount || 0) as number,
        sharingRate: (data.sharingRate || social.sharingRate || 0) as number,
        confidence: (data.confidence || social.confidence || 75) as number
      };
    }

    logger.debug(`Social signals unavailable for user ${userId}, using defaults`);
    return getDefaultSocialSignals();

  } catch (error) {
    logger.warn(`Error fetching social signals for ${userId}`, { error: error.message });
    return getDefaultSocialSignals();
  }
}

export async function fetchCompetitorSignals(userId: string): Promise<CompetitorSignals> {
  const url = `${COMPETITOR_SERVICE_URL}/api/competitor/${userId}`;

  try {
    const result = await fetchWithTimeout<ServiceSignalResponse>(url);

    if (result.success && result.data) {
      const data = result.data as unknown as Record<string, unknown>;
      const competitor = (data.competitor || {}) as Record<string, unknown>;
      return {
        loyaltyScore: (data.loyaltyScore || competitor.loyaltyScore || 50) as number,
        switchRisk: (data.switchRisk || competitor.switchRisk || 'low') as CompetitorSignals['switchRisk'],
        winBackPotential: (data.winBackPotential || competitor.winBackPotential || 50) as number,
        confidence: (data.confidence || competitor.confidence || 75) as number
      };
    }

    logger.debug(`Competitor signals unavailable for user ${userId}, using defaults`);
    return getDefaultCompetitorSignals();

  } catch (error) {
    logger.warn(`Error fetching competitor signals for ${userId}`, { error: error.message });
    return getDefaultCompetitorSignals();
  }
}

/**
 * Calculate overall signal score from individual signals
 * Weighted average based on confidence levels
 */
function calculateOverallScore(
  location: LocationSignals,
  behavioral: BehavioralSignals,
  social: SocialSignals,
  competitor: CompetitorSignals
): number {
  const signals = [
    { score: 50, confidence: location.confidence }, // Use median as base score
    { score: behavioral.cashbackSensitivity, confidence: behavioral.confidence },
    { score: behavioral.luxuryAffinity, confidence: behavioral.confidence },
    { score: behavioral.impulseScore, confidence: behavioral.confidence },
    { score: social.referralCount * 10, confidence: social.confidence }, // Scale referral count
    { score: social.sharingRate, confidence: social.confidence },
    { score: competitor.loyaltyScore, confidence: competitor.confidence },
    { score: competitor.winBackPotential, confidence: competitor.confidence }
  ].filter(s => s.confidence > 0);

  if (signals.length === 0) {
    return 50; // Default neutral score
  }

  // Weighted average by confidence
  const totalConfidence = signals.reduce((sum, s) => sum + s.confidence, 0);
  const weightedSum = signals.reduce((sum, s) => sum + (s.score * s.confidence), 0);

  return Math.round(weightedSum / totalConfidence);
}

/**
 * Aggregate all signals for a user
 * Fetches from all signal services in parallel
 */
export async function aggregateSignals(userId: string): Promise<SignalScores> {
  logger.debug(`Aggregating signals for user ${userId}`);

  const startTime = Date.now();

  // Fetch all signals in parallel
  const [location, behavioral, social, competitor] = await Promise.all([
    fetchLocationSignals(userId),
    fetchBehavioralSignals(userId),
    fetchSocialSignals(userId),
    fetchCompetitorSignals(userId)
  ]);

  const overall = calculateOverallScore(location, behavioral, social, competitor);

  const duration = Date.now() - startTime;
  logger.debug(`Signal aggregation completed for user ${userId} in ${duration}ms`, {
    overall,
    locationConfidence: location.confidence,
    behavioralConfidence: behavioral.confidence,
    socialConfidence: social.confidence,
    competitorConfidence: competitor.confidence
  });

  return {
    location,
    behavioral,
    social,
    competitor,
    overall
  };
}

/**
 * Update signals for a specific category only
 */
export async function updateCategorySignals(
  userId: string,
  category: 'location' | 'behavioral' | 'social' | 'competitor'
): Promise<Partial<SignalScores>> {
  logger.debug(`Updating ${category} signals for user ${userId}`);

  switch (category) {
    case 'location':
      return { location: await fetchLocationSignals(userId) };
    case 'behavioral':
      return { behavioral: await fetchBehavioralSignals(userId) };
    case 'social':
      return { social: await fetchSocialSignals(userId) };
    case 'competitor':
      return { competitor: await fetchCompetitorSignals(userId) };
  }
}

/**
 * Check health of all signal services
 */
export async function checkSignalServicesHealth(): Promise<Record<string, boolean>> {
  const services = [
    { name: 'location', url: `${LOCATION_SERVICE_URL}/health` },
    { name: 'behavioral', url: `${BEHAVIORAL_SERVICE_URL}/health` },
    { name: 'social', url: `${SOCIAL_SERVICE_URL}/health` },
    { name: 'competitor', url: `${COMPETITOR_SERVICE_URL}/health` }
  ];

  const results: Record<string, boolean> = {};

  await Promise.all(
    services.map(async (service) => {
      try {
        const result = await fetchWithTimeout(service.url, 2000);
        results[service.name] = result.success;
      } catch {
        results[service.name] = false;
      }
    })
  );

  return results;
}

export default {
  aggregateSignals,
  updateCategorySignals,
  fetchLocationSignals,
  fetchBehavioralSignals,
  fetchSocialSignals,
  fetchCompetitorSignals,
  checkSignalServicesHealth
};
