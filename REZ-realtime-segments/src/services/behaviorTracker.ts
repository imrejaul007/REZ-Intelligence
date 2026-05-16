import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import type { UserData } from '../types/index.js';

// Redis client for behavior tracking
let redisClient: Redis | null = null;

export interface BehavioralEvent {
  eventId: string;
  userId: string;
  eventType: string;
  eventName: string;
  properties: Record<string, unknown>;
  timestamp: string;
  sessionId?: string;
  source: string;
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export interface RFMScore {
  recency: number;
  frequency: number;
  monetary: number;
  totalScore: number;
  tier: 'platinum' | 'gold' | 'silver' | 'bronze' | 'standard';
}

export interface UserBehaviorProfile {
  userId: string;
  sessionCount: number;
  totalEvents: number;
  lastActivityAt: string;
  firstActivityAt: string;
  avgSessionDuration: number;
  eventsByType: Record<string, number>;
  rfmScore: RFMScore;
  behavioralTraits: BehavioralTraits;
  crossSessionData: CrossSessionData;
  calculatedAt: string;
}

export interface BehavioralTraits {
  purchaseVelocity: 'high' | 'medium' | 'low';
  engagementLevel: 'high' | 'medium' | 'low';
  brandLoyalty: 'high' | 'medium' | 'low';
  priceSensitivity: 'high' | 'medium' | 'low';
  omnichannelPreference: 'online' | 'offline' | 'both';
}

export interface CrossSessionData {
  avgTimeBetweenSessions: number;
  sessionVariance: number;
  preferredChannels: string[];
  preferredTimes: number[];
  returnProbability: number;
  abandonmentRate: number;
  recoveryRate: number;
}

export interface EventAggregation {
  userId: string;
  period: 'daily' | 'weekly' | 'monthly';
  startDate: string;
  endDate: string;
  eventCounts: Record<string, number>;
  uniqueSessions: number;
  totalDuration: number;
}

// Initialize Redis connection for behavior tracking
export function initializeBehaviorTracker(redis: Redis): void {
  redisClient = redis;
}

// Default TTL for various data types (in seconds)
const TTL = {
  EVENT: 60 * 60 * 24 * 30, // 30 days for raw events
  SESSION: 60 * 60 * 24, // 24 hours for sessions
  PROFILE: 60 * 60 * 6, // 6 hours for behavior profiles
  AGGREGATION: 60 * 60, // 1 hour for aggregations
  SESSION_DATA: 60 * 60 * 24 * 7, // 7 days for cross-session data
};

// Key generators
const keys = {
  userEvents: (userId: string) => `behavior:events:${userId}`,
  userSessions: (userId: string) => `behavior:sessions:${userId}`,
  eventStream: (userId: string) => `behavior:stream:${userId}`,
  sessionData: (sessionId: string) => `behavior:session:${sessionId}`,
  userProfile: (userId: string) => `behavior:profile:${userId}`,
  rfmScores: (userId: string) => `behavior:rfm:${userId}`,
  eventAggregations: (userId: string, period: string) => `behavior:agg:${userId}:${period}`,
  userActivityHash: (userId: string) => `behavior:hash:${userId}`,
};

// Track a behavioral event
export async function trackEvent(event: Omit<BehavioralEvent, 'eventId' | 'timestamp'>): Promise<BehavioralEvent> {
  if (!redisClient) {
    throw new Error('Behavior tracker not initialized');
  }

  const fullEvent: BehavioralEvent = {
    ...event,
    eventId: uuidv4(),
    timestamp: new Date().toISOString(),
  };

  const pipeline = redisClient.pipeline();

  // Store event in user's event list (sorted by timestamp)
  pipeline.zadd(
    keys.userEvents(event.userId),
    new Date(fullEvent.timestamp).getTime(),
    JSON.stringify(fullEvent)
  );

  // Trim to keep only last 1000 events per user
  pipeline.zremrangebyrank(keys.userEvents(event.userId), 0, -1001);

  // Add to event stream for real-time processing
  pipeline.lpush(keys.eventStream(event.userId), JSON.stringify(fullEvent));
  pipeline.ltrim(keys.eventStream(event.userId), 0, 999);

  // Increment event type counter
  pipeline.hincrby(`behavior:eventTypes:${event.userId}`, event.eventType, 1);

  // Set TTL on the keys
  pipeline.expire(keys.userEvents(event.userId), TTL.EVENT);
  pipeline.expire(keys.eventStream(event.userId), TTL.EVENT);
  pipeline.expire(`behavior:eventTypes:${event.userId}`, TTL.EVENT);

  await pipeline.exec();

  // Update activity timestamp
  await redisClient.set(`behavior:lastActivity:${event.userId}`, fullEvent.timestamp, 'EX', TTL.EVENT);

  return fullEvent;
}

// Start a new session for a user
export async function startSession(
  userId: string,
  metadata: Record<string, unknown> = {}
): Promise<{ sessionId: string; startedAt: string }> {
  if (!redisClient) {
    throw new Error('Behavior tracker not initialized');
  }

  const sessionId = uuidv4();
  const startedAt = new Date().toISOString();

  const sessionData = {
    sessionId,
    userId,
    startedAt,
    metadata,
    eventCount: 0,
  };

  await redisClient.hset(keys.sessionData(sessionId), {
    data: JSON.stringify(sessionData),
    userId,
    startedAt,
  });
  await redisClient.expire(keys.sessionData(sessionId), TTL.SESSION);

  // Add session to user's session list
  await redisClient.zadd(
    keys.userSessions(userId),
    new Date(startedAt).getTime(),
    sessionId
  );

  return { sessionId, startedAt };
}

// End a session
export async function endSession(
  sessionId: string,
  metadata: Record<string, unknown> = {}
): Promise<{ duration: number; eventCount: number } | null> {
  if (!redisClient) {
    throw new Error('Behavior tracker not initialized');
  }

  const sessionDataRaw = await redisClient.hget(keys.sessionData(sessionId), 'data');
  if (!sessionDataRaw) {
    return null;
  }

  const sessionData = JSON.parse(sessionDataRaw);
  const endedAt = new Date();
  const startedAt = new Date(sessionData.startedAt);
  const duration = endedAt.getTime() - startedAt.getTime();

  // Update session with end info
  await redisClient.hset(keys.sessionData(sessionId), {
    endedAt: endedAt.toISOString(),
    duration: String(duration),
    eventCount: String(sessionData.eventCount),
    metadata: JSON.stringify(metadata),
  });

  // Calculate average session duration for user
  await updateAverageSessionDuration(sessionData.userId, duration);

  return { duration, eventCount: sessionData.eventCount };
}

// Increment event count for a session
export async function incrementSessionEventCount(sessionId: string): Promise<void> {
  if (!redisClient) {
    throw new Error('Behavior tracker not initialized');
  }

  await redisClient.hincrby(keys.sessionData(sessionId), 'eventCount', 1);
}

// Update user's average session duration
async function updateAverageSessionDuration(userId: string, newDuration: number): Promise<void> {
  if (!redisClient) return;

  const avgKey = `behavior:avgSession:${userId}`;
  const countKey = `behavior:sessionCount:${userId}`;

  const currentAvg = parseFloat((await redisClient.get(avgKey)) || '0');
  const count = parseInt((await redisClient.get(countKey)) || '0', 10);

  const newCount = count + 1;
  const newAvg = currentAvg + (newDuration - currentAvg) / newCount;

  await redisClient.setex(avgKey, TTL.PROFILE, String(newAvg));
  await redisClient.setex(countKey, TTL.PROFILE, String(newCount));
}

// Get user's recent events
export async function getUserEvents(
  userId: string,
  limit = 100,
  since?: string
): Promise<BehavioralEvent[]> {
  if (!redisClient) {
    throw new Error('Behavior tracker not initialized');
  }

  let maxScore = '+inf';
  if (since) {
    maxScore = String(new Date(since).getTime());
  }

  const events = await redisClient.zrevrangebyscore(
    keys.userEvents(userId),
    maxScore,
    '-inf',
    'LIMIT',
    0,
    limit
  );

  return events.map((e) => JSON.parse(e) as BehavioralEvent);
}

// Get user's session history
export async function getUserSessions(
  userId: string,
  limit = 50
): Promise<Array<{ sessionId: string; startedAt: string; endedAt?: string; duration?: number }>> {
  if (!redisClient) {
    throw new Error('Behavior tracker not initialized');
  }

  const sessionIds = await redisClient.zrevrange(keys.userSessions(userId), 0, limit - 1);

  const sessions = await Promise.all(
    sessionIds.map(async (sessionId) => {
      const data = await redisClient!.hgetall(keys.sessionData(sessionId));
      if (!data.data) return null;

      const sessionData = JSON.parse(data.data);
      return {
        sessionId,
        startedAt: sessionData.startedAt,
        endedAt: data.endedAt,
        duration: data.duration ? parseInt(data.duration, 10) : undefined,
      };
    })
  );

  return sessions.filter((s): s is NonNullable<typeof s> => s !== null);
}

// Calculate RFM score for a user
export async function calculateRFMScore(
  userId: string,
  referenceDate = new Date()
): Promise<RFMScore> {
  if (!redisClient) {
    throw new Error('Behavior tracker not initialized');
  }

  // Get user's last activity
  const lastActivity = await redisClient.get(`behavior:lastActivity:${userId}`);
  const lastActivityDate = lastActivity ? new Date(lastActivity) : new Date(0);

  // Get event counts and monetary data
  const eventTypes = await redisClient.hgetall(`behavior:eventTypes:${userId}`);

  // Calculate RFM components
  const recencyDays = Math.floor(
    (referenceDate.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Recency: 1-100 score (higher is better - more recent)
  const recency = Math.max(0, Math.min(100, 100 - recencyDays));

  // Frequency: based on total events and session count
  const totalEvents = Object.values(eventTypes).reduce((sum, count) => sum + parseInt(count, 10), 0);
  const sessionCount = await redisClient.zcard(keys.userSessions(userId));
  const frequency = Math.min(100, (totalEvents * 2 + sessionCount * 5));

  // Monetary: estimated from order events (in production, would fetch actual order values)
  const orderEvents = parseInt(eventTypes['order_completed'] || '0', 10) +
    parseInt(eventTypes['purchase'] || '0', 10) +
    parseInt(eventTypes['checkout'] || '0', 10);
  const monetary = Math.min(100, orderEvents * 10);

  // Total score
  const totalScore = Math.round((recency * 0.4 + frequency * 0.3 + monetary * 0.3) * 100) / 100;

  // Determine tier
  let tier: RFMScore['tier'];
  if (totalScore >= 80) tier = 'platinum';
  else if (totalScore >= 60) tier = 'gold';
  else if (totalScore >= 40) tier = 'silver';
  else if (totalScore >= 20) tier = 'bronze';
  else tier = 'standard';

  const rfmScore: RFMScore = { recency, frequency, monetary, totalScore, tier };

  // Cache the RFM score
  await redisClient.setex(keys.rfmScores(userId), TTL.PROFILE, JSON.stringify(rfmScore));

  return rfmScore;
}

// Get cached RFM score
export async function getCachedRFMScore(userId: string): Promise<RFMScore | null> {
  if (!redisClient) {
    throw new Error('Behavior tracker not initialized');
  }

  const cached = await redisClient.get(keys.rfmScores(userId));
  if (cached) {
    return JSON.parse(cached) as RFMScore;
  }
  return null;
}

// Calculate behavioral traits for a user
export async function calculateBehavioralTraits(
  userId: string,
  eventHistory: BehavioralEvent[]
): Promise<BehavioralTraits> {
  // Purchase velocity: based on time between purchase events
  const purchaseEvents = eventHistory.filter((e) =>
    ['order_completed', 'purchase', 'checkout'].includes(e.eventType)
  );
  let purchaseVelocity: BehavioralTraits['purchaseVelocity'] = 'low';

  if (purchaseEvents.length >= 10) {
    const avgTimeBetween = calculateAverageTimeBetweenEvents(purchaseEvents);
    if (avgTimeBetween < 7 * 24 * 60 * 60 * 1000) purchaseVelocity = 'high';
    else if (avgTimeBetween < 30 * 24 * 60 * 60 * 1000) purchaseVelocity = 'medium';
  } else if (purchaseEvents.length >= 3) {
    purchaseVelocity = 'medium';
  }

  // Engagement level: based on event frequency
  const eventCount = eventHistory.length;
  const daysActive = getDaysActive(eventHistory);
  const eventsPerDay = daysActive > 0 ? eventCount / daysActive : 0;

  let engagementLevel: BehavioralTraits['engagementLevel'] = 'low';
  if (eventsPerDay > 5) engagementLevel = 'high';
  else if (eventsPerDay > 1) engagementLevel = 'medium';

  // Brand loyalty: based on return rate and session count
  const sessions = await getUserSessions(userId, 100);
  const returnRate = sessions.length > 1 ? 1 - 1 / sessions.length : 0;

  let brandLoyalty: BehavioralTraits['brandLoyalty'] = 'low';
  if (returnRate > 0.8 && sessions.length >= 5) brandLoyalty = 'high';
  else if (returnRate > 0.5) brandLoyalty = 'medium';

  // Price sensitivity: based on discount/promo event ratio
  const discountEvents = eventHistory.filter((e) =>
    ['promo_used', 'discount_applied', 'coupon_used'].includes(e.eventType)
  ).length;
  const priceSensitivity = eventCount > 0 ? discountEvents / eventCount : 0;

  let priceSensitivityLevel: BehavioralTraits['priceSensitivity'] = 'low';
  if (priceSensitivity > 0.3) priceSensitivityLevel = 'high';
  else if (priceSensitivity > 0.1) priceSensitivityLevel = 'medium';

  // Omnichannel preference: based on source/device diversity
  const sources = new Set(eventHistory.map((e) => e.source));
  const omnichannelPreference: BehavioralTraits['omnichannelPreference'] =
    sources.size >= 3 ? 'both' : sources.has('online') ? 'online' : 'offline';

  return {
    purchaseVelocity,
    engagementLevel,
    brandLoyalty,
    priceSensitivity: priceSensitivityLevel,
    omnichannelPreference,
  };
}

// Calculate cross-session data
export async function calculateCrossSessionData(
  userId: string,
  sessions: Array<{ sessionId: string; startedAt: string; endedAt?: string; duration?: number }>
): Promise<CrossSessionData> {
  if (sessions.length < 2) {
    return {
      avgTimeBetweenSessions: 0,
      sessionVariance: 0,
      preferredChannels: [],
      preferredTimes: [],
      returnProbability: 0,
      abandonmentRate: 0,
      recoveryRate: 0,
    };
  }

  // Calculate average time between sessions
  const sessionTimestamps = sessions
    .map((s) => new Date(s.startedAt).getTime())
    .sort((a, b) => a - b);

  let totalGap = 0;
  for (let i = 1; i < sessionTimestamps.length; i++) {
    totalGap += sessionTimestamps[i] - sessionTimestamps[i - 1];
  }
  const avgTimeBetweenSessions = totalGap / (sessionTimestamps.length - 1);

  // Calculate variance
  const mean = avgTimeBetweenSessions;
  const variance =
    sessions.reduce((sum, s) => {
      const gap = s.duration ? s.duration : 0;
      return sum + Math.pow(gap - mean, 2);
    }, 0) / sessions.length;

  // Calculate return probability (sessions where user came back)
  const returnProbability = sessions.length > 1 ? 1 - 1 / sessions.length : 0;

  // Get events to analyze channels and times
  const events = await getUserEvents(userId, 500);
  const channels = [...new Set(events.map((e) => e.source))];
  const times = events.map((e) => new Date(e.timestamp).getHours());

  // Count abandonment (sessions without purchase)
  const eventsBySession = events.reduce(
    (acc, e) => {
      const sessionId = e.sessionId;
      if (!acc[sessionId]) acc[sessionId] = { total: 0, hasPurchase: false };
      acc[sessionId].total++;
      if (['order_completed', 'purchase'].includes(e.eventType)) {
        acc[sessionId].hasPurchase = true;
      }
      return acc;
    },
    {} as Record<string, { total: number; hasPurchase: boolean }>
  );

  const sessionsWithEvents = Object.keys(eventsBySession).length;
  const abandonedSessions = sessionsWithEvents > 0
    ? Object.values(eventsBySession).filter((s) => !s.hasPurchase).length / sessionsWithEvents
    : 0;

  // Recovery rate (abandoned sessions that returned)
  const recoveryRate = abandonedSessions > 0 ? Math.min(1, 1 - abandonedSessions + 0.3) : 0.5;

  return {
    avgTimeBetweenSessions: Math.round(avgTimeBetweenSessions / (1000 * 60)), // in minutes
    sessionVariance: Math.round(Math.sqrt(variance) / (1000 * 60)), // in minutes
    preferredChannels: channels,
    preferredTimes: [...new Set(times)],
    returnProbability: Math.round(returnProbability * 100) / 100,
    abandonmentRate: Math.round(abandonedSessions * 100) / 100,
    recoveryRate: Math.round(recoveryRate * 100) / 100,
  };
}

// Get complete user behavior profile
export async function getUserBehaviorProfile(userId: string): Promise<UserBehaviorProfile | null> {
  if (!redisClient) {
    throw new Error('Behavior tracker not initialized');
  }

  // Check cache first
  const cached = await redisClient.get(keys.userProfile(userId));
  if (cached) {
    return JSON.parse(cached) as UserBehaviorProfile;
  }

  // Gather all data
  const [events, sessions, rfmScore] = await Promise.all([
    getUserEvents(userId, 1000),
    getUserSessions(userId, 100),
    getCachedRFMScore(userId),
  ]);

  if (events.length === 0) {
    return null;
  }

  // Calculate derived metrics
  const eventCounts = events.reduce(
    (acc, e) => {
      acc[e.eventType] = (acc[e.eventType] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const totalDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  const avgSessionDuration = sessions.length > 0 ? totalDuration / sessions.length : 0;

  // Calculate behavioral traits
  const behavioralTraits = await calculateBehavioralTraits(userId, events);

  // Calculate cross-session data
  const crossSessionData = await calculateCrossSessionData(userId, sessions);

  // Get or calculate RFM score
  const rfm = rfmScore || (await calculateRFMScore(userId));

  const profile: UserBehaviorProfile = {
    userId,
    sessionCount: sessions.length,
    totalEvents: events.length,
    lastActivityAt: events[0]?.timestamp || new Date(0).toISOString(),
    firstActivityAt: events[events.length - 1]?.timestamp || new Date(0).toISOString(),
    avgSessionDuration: Math.round(avgSessionDuration / 1000), // in seconds
    eventsByType: eventCounts,
    rfmScore: rfm,
    behavioralTraits,
    crossSessionData,
    calculatedAt: new Date().toISOString(),
  };

  // Cache the profile
  await redisClient.setex(keys.userProfile(userId), TTL.PROFILE, JSON.stringify(profile));

  return profile;
}

// Convert behavior profile to UserData format for segment evaluation
export function profileToUserData(profile: UserBehaviorProfile): Partial<UserData> {
  return {
    userId: profile.userId,
    lifetime: {
      totalSpend: profile.rfmScore.monetary * 100, // Convert to estimated spend
      totalOrders: profile.eventsByType['order_completed'] || 0,
      avgOrderValue: profile.rfmScore.monetary * 10,
      tenureDays: getDaysActiveFromTimestamps(profile.firstActivityAt, profile.lastActivityAt),
    },
    activity: {
      last30Days: {
        orders: Math.round(profile.totalEvents * 0.1),
        visits: profile.sessionCount,
      },
      engagement: {
        engagementIndex: profile.rfmScore.totalScore,
      },
    },
    signals: {
      competitor: {
        switchRisk: profile.behavioralTraits.brandLoyalty === 'high' ? 'LOW' : 'MEDIUM',
        loyaltyScore: profile.rfmScore.totalScore,
      },
      behavioral: {
        cashbackSensitivity: profile.behavioralTraits.priceSensitivity === 'high' ? 80 : 40,
        dealSeeking: profile.behavioralTraits.purchaseVelocity === 'high' ? 70 : 40,
        luxuryAffinity: profile.rfmScore.tier === 'platinum' || profile.rfmScore.tier === 'gold' ? 70 : 30,
      },
      social: {
        influenceTier: 'standard',
      },
      location: {
        segments: profile.crossSessionData.preferredChannels,
      },
    },
  };
}

// Aggregate events for a user over a period
export async function getEventAggregation(
  userId: string,
  period: 'daily' | 'weekly' | 'monthly'
): Promise<EventAggregation> {
  if (!redisClient) {
    throw new Error('Behavior tracker not initialized');
  }

  const now = new Date();
  let startDate: Date;
  let endDate = now;

  switch (period) {
    case 'daily':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'weekly':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'monthly':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
  }

  const events = await getUserEvents(userId, 10000, startDate.toISOString());

  const eventCounts = events.reduce(
    (acc, e) => {
      acc[e.eventType] = (acc[e.eventType] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const uniqueSessions = new Set(events.map((e) => e.sessionId)).size;
  const sessionIds = [...new Set(events.map((e) => e.sessionId))];
  const sessionsData = await Promise.all(
    sessionIds.map((id) => redisClient!.hgetall(keys.sessionData(id)))
  );
  const totalDuration = sessionsData.reduce((sum, s) => sum + (parseInt(s.duration || '0', 10)), 0);

  return {
    userId,
    period,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    eventCounts,
    uniqueSessions,
    totalDuration,
  };
}

// Helper: Calculate average time between events
function calculateAverageTimeBetweenEvents(events: BehavioralEvent[]): number {
  if (events.length < 2) return 0;

  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  let totalGap = 0;
  for (let i = 1; i < sorted.length; i++) {
    totalGap += new Date(sorted[i].timestamp).getTime() - new Date(sorted[i - 1].timestamp).getTime();
  }

  return totalGap / (sorted.length - 1);
}

// Helper: Get days active from events
function getDaysActive(events: BehavioralEvent[]): number {
  if (events.length === 0) return 0;

  const dates = new Set(events.map((e) => new Date(e.timestamp).toISOString().split('T')[0]));
  return dates.size;
}

// Helper: Get days active from timestamps
function getDaysActiveFromTimestamps(firstActivity: string, lastActivity: string): number {
  const first = new Date(firstActivity);
  const last = new Date(lastActivity);
  return Math.max(1, Math.floor((last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24)));
}

// Disconnect behavior tracker
export async function disconnectBehaviorTracker(): Promise<void> {
  if (redisClient) {
    redisClient.disconnect();
    redisClient = null;
  }
}

export default {
  initializeBehaviorTracker,
  trackEvent,
  startSession,
  endSession,
  incrementSessionEventCount,
  getUserEvents,
  getUserSessions,
  calculateRFMScore,
  getCachedRFMScore,
  calculateBehavioralTraits,
  calculateCrossSessionData,
  getUserBehaviorProfile,
  profileToUserData,
  getEventAggregation,
  disconnectBehaviorTracker,
};
