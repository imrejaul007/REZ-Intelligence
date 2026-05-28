import { UnifiedProfileModel, IUnifiedProfile } from '../models/UnifiedProfile.js';
import { aggregateSignals } from './signalAggregator.js';
import { logger } from '../config/logger.js';
import type {
  EnrichmentPayload,
  ProfileMergeRequest,
  ProfileSearchQuery
} from '../types/index.js';

/**
 * Create a new unified profile
 */
export async function createProfile(userId: string): Promise<IUnifiedProfile> {
  logger.info(`Creating profile for user ${userId}`);

  // Check if profile already exists
  const existing = await UnifiedProfileModel.findOne({ userId });
  if (existing) {
    logger.warn(`Profile already exists for user ${userId}`);
    return existing as IUnifiedProfile;
  }

  // Aggregate signals from all services
  const signals = await aggregateSignals(userId);

  // Create new profile with default values
  const profile = new UnifiedProfileModel({
    userId,
    identity: {
      primaryId: userId,
      emails: [],
      phones: [],
      devices: [],
      linkedAccounts: [],
      trustScore: 50
    },
    demographics: {},
    signals,
    segments: [],
    lifetime: {
      tenureDays: 0,
      totalOrders: 0,
      totalSpend: 0,
      avgOrderValue: 0,
      predictedLTV: 0
    },
    activity: {
      last30Days: { orders: 0, spend: 0, visits: 0, sessions: 0 },
      last90Days: { orders: 0, spend: 0, visits: 0, sessions: 0 },
      engagement: { recencyScore: 50, frequencyScore: 50, monetaryScore: 50, engagementIndex: 50 }
    },
    preferences: {
      categories: [],
      brands: [],
      priceRange: { min: 0, max: 10000 },
      notifications: { email: true, sms: true, push: true },
      communicationFrequency: 'weekly'
    },
    lastUpdated: new Date()
  });

  await profile.save();
  logger.info(`Profile created for user ${userId}`);

  return profile as unknown as IUnifiedProfile;
}

/**
 * Get a unified profile by user ID
 */
export async function getProfile(userId: string): Promise<IUnifiedProfile | null> {
  logger.debug(`Fetching profile for user ${userId}`);

  const profile = await UnifiedProfileModel.findOne({ userId });

  if (!profile) {
    logger.debug(`Profile not found for user ${userId}`);
    return null;
  }

  return profile as unknown as IUnifiedProfile;
}

/**
 * Get profile by unknown identifier (userId, email, phone)
 */
export async function getProfileByIdentifier(identifier: string): Promise<IUnifiedProfile | null> {
  logger.debug(`Fetching profile by identifier ${identifier}`);

  const profile = await UnifiedProfileModel.findByIdentifier(identifier);

  if (!profile) {
    logger.debug(`Profile not found for identifier ${identifier}`);
    return null;
  }

  return profile as unknown as IUnifiedProfile;
}

/**
 * Enrich a profile with new data
 */
export async function enrichProfile(
  userId: string,
  payload: EnrichmentPayload
): Promise<IUnifiedProfile> {
  logger.info(`Enriching profile for user ${userId} from source: ${payload.source}`);

  let profile = await UnifiedProfileModel.findOne({ userId });

  if (!profile) {
    // Create new profile if it doesn't exist
    return await createProfile(userId);
  }

  const updateData: Record<string, unknown> = {
    lastUpdated: new Date()
  };

  // Process enrichment based on source
  switch (payload.source) {
    case 'identity':
      if (payload.data.emails) {
        updateData['identity.emails'] = payload.data.emails;
      }
      if (payload.data.phones) {
        updateData['identity.phones'] = payload.data.phones;
      }
      if (payload.data.devices) {
        updateData['identity.devices'] = payload.data.devices;
      }
      if (payload.data.trustScore !== undefined) {
        updateData['identity.trustScore'] = payload.data.trustScore;
      }
      if (payload.data.linkedAccounts) {
        updateData['identity.linkedAccounts'] = payload.data.linkedAccounts;
      }
      break;

    case 'cdp':
      if (payload.data.demographics) {
        const demo = payload.data.demographics as Record<string, unknown>;
        Object.assign(updateData, {
          'demographics.name': demo.name,
          'demographics.age': demo.age,
          'demographics.gender': demo.gender,
          'demographics.city': demo.city,
          'demographics.pincode': demo.pincode
        });
      }
      if (payload.data.preferences) {
        updateData.preferences = payload.data.preferences as Record<string, unknown>;
      }
      break;

    case 'orders':
      if (payload.data.lifetime) {
        updateData.lifetime = payload.data.lifetime;
      }
      if (payload.data.activity) {
        updateData.activity = payload.data.activity;
      }
      break;

    case 'signals':
      // Refresh signals from signal aggregator
      const signals = await aggregateSignals(userId);
      updateData.signals = signals;
      break;

    case 'manual':
      // Merge all data
      Object.assign(updateData, payload.data);
      break;
  }

  const updatedProfile = await UnifiedProfileModel.findOneAndUpdate(
    { userId },
    { $set: updateData },
    { new: true, runValidators: true }
  );

  if (!updatedProfile) {
    throw new Error(`Failed to update profile for user ${userId}`);
  }

  logger.info(`Profile enriched for user ${userId}`);

  return updatedProfile as unknown as IUnifiedProfile;
}

/**
 * Merge multiple profiles into one
 */
export async function mergeProfiles(request: ProfileMergeRequest): Promise<IUnifiedProfile> {
  const { primaryUserId, secondaryUserIds, strategy = 'latest-wins' } = request;

  logger.info(`Merging profiles: ${secondaryUserIds.join(', ')} into ${primaryUserId}`);

  // Get all profiles
  const profiles = await UnifiedProfileModel.find({
    userId: { $in: [primaryUserId, ...secondaryUserIds] }
  });

  if (profiles.length === 0) {
    throw new Error('No profiles found for merge');
  }

  const primaryProfile = profiles.find(p => p.userId === primaryUserId);
  const secondaryProfiles = profiles.filter(p => p.userId !== primaryUserId);

  if (!primaryProfile) {
    throw new Error(`Primary profile ${primaryUserId} not found`);
  }

  // Merge data based on strategy
  const mergedData: Record<string, unknown> = {
    userId: primaryUserId,
    lastUpdated: new Date()
  };

  // Merge identity
  const allEmails = new Set<string>();
  const allPhones = new Set<string>();
  const allDevices = new Set<string>();

  profiles.forEach((p) => {
    p.identity?.emails?.forEach((e: string) => allEmails.add(e));
    p.identity?.phones?.forEach((ph: string) => allPhones.add(ph));
    p.identity?.devices?.forEach((d: string) => allDevices.add(d));
  });

  mergedData.identity = {
    primaryId: primaryUserId,
    emails: Array.from(allEmails),
    phones: Array.from(allPhones),
    devices: Array.from(allDevices),
    linkedAccounts: profiles.flatMap((p) => p.identity?.linkedAccounts || []),
    trustScore: Math.max(...profiles.map((p) => p.identity?.trustScore || 0))
  };

  // Merge demographics (latest wins)
  if (strategy === 'latest-wins') {
    const sorted = profiles.sort((a, b) =>
      (b.lastUpdated?.getTime() || 0) - (a.lastUpdated?.getTime() || 0)
    );
    mergedData.demographics = sorted[0]?.demographics || {};
  } else {
    mergedData.demographics = (primaryProfile as unknown as IUnifiedProfile).demographics || {};
  }

  // Merge signals (max values)
  const pProfile = primaryProfile as unknown as IUnifiedProfile;
  mergedData.signals = {
    location: {
      segments: [...new Set(profiles.flatMap((p) => p.signals?.location?.segments || []))],
      patterns: [...new Set(profiles.flatMap((p) => p.signals?.location?.patterns || []))],
      favoriteZones: [...new Set(profiles.flatMap((p) => p.signals?.location?.favoriteZones || []))],
      confidence: Math.max(...profiles.map((p) => p.signals?.location?.confidence || 0))
    },
    behavioral: {
      buyerType: pProfile.signals?.behavioral?.buyerType || 'standard',
      cashbackSensitivity: Math.max(...profiles.map((p) => p.signals?.behavioral?.cashbackSensitivity || 0)),
      luxuryAffinity: Math.max(...profiles.map((p) => p.signals?.behavioral?.luxuryAffinity || 0)),
      impulseScore: Math.max(...profiles.map((p) => p.signals?.behavioral?.impulseScore || 0)),
      confidence: Math.max(...profiles.map((p) => p.signals?.behavioral?.confidence || 0))
    },
    social: {
      influenceTier: pProfile.signals?.social?.influenceTier || 'low',
      referralCount: Math.max(...profiles.map((p) => p.signals?.social?.referralCount || 0)),
      sharingRate: Math.max(...profiles.map((p) => p.signals?.social?.sharingRate || 0)),
      confidence: Math.max(...profiles.map((p) => p.signals?.social?.confidence || 0))
    },
    competitor: {
      loyaltyScore: Math.max(...profiles.map((p) => p.signals?.competitor?.loyaltyScore || 0)),
      switchRisk: pProfile.signals?.competitor?.switchRisk || 'low',
      winBackPotential: Math.max(...profiles.map((p) => p.signals?.competitor?.winBackPotential || 0)),
      confidence: Math.max(...profiles.map((p) => p.signals?.competitor?.confidence || 0))
    },
    overall: Math.max(...profiles.map((p) => p.signals?.overall || 0))
  };

  // Merge segments
  mergedData.segments = [...new Set(profiles.flatMap((p) => p.segments || []))];

  // Merge lifetime (sum for orders/spend, max for dates)
  mergedData.lifetime = {
    tenureDays: Math.max(...profiles.map((p) => p.lifetime?.tenureDays || 0)),
    totalOrders: profiles.reduce((sum, p) => sum + (p.lifetime?.totalOrders || 0), 0),
    totalSpend: profiles.reduce((sum, p) => sum + (p.lifetime?.totalSpend || 0), 0),
    avgOrderValue: 0, // Will be recalculated
    lastOrderDate: new Date(Math.max(
      ...profiles.map((p) => p.lifetime?.lastOrderDate?.getTime() || 0)
    )) || undefined,
    firstOrderDate: new Date(Math.min(
      ...profiles.filter((p) => p.lifetime?.firstOrderDate).map((p) => p.lifetime!.firstOrderDate!.getTime())
    )) || undefined,
    predictedLTV: Math.max(...profiles.map((p) => p.lifetime?.predictedLTV || 0))
  };

  // Recalculate avg order value
  const lifetimeData = mergedData.lifetime as { totalOrders: number; totalSpend: number; avgOrderValue: number };
  if (lifetimeData.totalOrders > 0) {
    lifetimeData.avgOrderValue = lifetimeData.totalSpend / lifetimeData.totalOrders;
  }

  // Merge activity (sum)
  mergedData.activity = {
    last30Days: {
      orders: profiles.reduce((sum, p) => sum + (p.activity?.last30Days?.orders || 0), 0),
      spend: profiles.reduce((sum, p) => sum + (p.activity?.last30Days?.spend || 0), 0),
      visits: profiles.reduce((sum, p) => sum + (p.activity?.last30Days?.visits || 0), 0),
      sessions: profiles.reduce((sum, p) => sum + (p.activity?.last30Days?.sessions || 0), 0)
    },
    last90Days: {
      orders: profiles.reduce((sum, p) => sum + (p.activity?.last90Days?.orders || 0), 0),
      spend: profiles.reduce((sum, p) => sum + (p.activity?.last90Days?.spend || 0), 0),
      visits: profiles.reduce((sum, p) => sum + (p.activity?.last90Days?.visits || 0), 0),
      sessions: profiles.reduce((sum, p) => sum + (p.activity?.last90Days?.sessions || 0), 0)
    },
    engagement: {
      recencyScore: Math.max(...profiles.map((p) => p.activity?.engagement?.recencyScore || 0)),
      frequencyScore: Math.max(...profiles.map((p) => p.activity?.engagement?.frequencyScore || 0)),
      monetaryScore: Math.max(...profiles.map((p) => p.activity?.engagement?.monetaryScore || 0)),
      engagementIndex: Math.max(...profiles.map((p) => p.activity?.engagement?.engagementIndex || 0))
    }
  };

  // Merge preferences (union)
  mergedData.preferences = {
    categories: [...new Set(profiles.flatMap((p) => p.preferences?.categories || []))],
    brands: [...new Set(profiles.flatMap((p) => p.preferences?.brands || []))],
    priceRange: pProfile.preferences?.priceRange || { min: 0, max: 10000 },
    notifications: pProfile.preferences?.notifications || { email: true, sms: true, push: true },
    communicationFrequency: pProfile.preferences?.communicationFrequency || 'weekly'
  };

  // Update primary profile with merged data
  const updated = await UnifiedProfileModel.findOneAndUpdate(
    { userId: primaryUserId },
    { $set: mergedData },
    { new: true, runValidators: true }
  );

  // Delete secondary profiles
  if (secondaryUserIds.length > 0) {
    await UnifiedProfileModel.deleteMany({ userId: { $in: secondaryUserIds } });
    logger.info(`Deleted ${secondaryUserIds.length} merged profiles`);
  }

  logger.info(`Merge complete: ${primaryUserId} now contains data from ${secondaryUserIds.length} profiles`);

  return updated as unknown as IUnifiedProfile;
}

/**
 * Search profiles with filters
 */
export async function searchProfiles(query: ProfileSearchQuery): Promise<IUnifiedProfile[]> {
  logger.debug('Searching profiles', query);

  const filter: Record<string, unknown> = {};

  if (query.email) {
    filter['identity.emails'] = query.email;
  }

  if (query.phone) {
    filter['identity.phones'] = query.phone;
  }

  if (query.segment) {
    filter.segments = query.segment;
  }

  if (query.city) {
    filter['demographics.city'] = query.city;
  }

  if (query.minLifetimeValue !== undefined) {
    (filter['lifetime.totalSpend'] as Record<string, number>) = { $gte: query.minLifetimeValue };
  }

  if (query.maxLifetimeValue !== undefined) {
    const existing = (filter['lifetime.totalSpend'] as Record<string, number>) || {};
    filter['lifetime.totalSpend'] = {
      ...existing,
      $lte: query.maxLifetimeValue
    };
  }

  const limit = query.limit || 50;
  const offset = query.offset || 0;

  const profiles = await UnifiedProfileModel.find(filter)
    .sort({ 'lifetime.totalSpend': -1 })
    .skip(offset)
    .limit(limit);

  return profiles as unknown as IUnifiedProfile[];
}

/**
 * Get profiles by segment
 */
export async function getProfilesBySegment(
  segment: string,
  options: { limit?: number; skip?: number } = {}
): Promise<IUnifiedProfile[]> {
  const { limit = 100, skip = 0 } = options;

  logger.debug(`Fetching profiles for segment: ${segment}`);

  const profiles = await UnifiedProfileModel.findBySegment(segment, { limit, skip });

  return profiles as unknown as IUnifiedProfile[];
}

/**
 * Get segment membership stats
 */
export async function getSegmentStats(): Promise<Record<string, number>> {
  const result = await UnifiedProfileModel.aggregate([
    { $unwind: '$segments' },
    { $group: { _id: '$segments', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  const stats: Record<string, number> = {};
  result.forEach((item) => {
    stats[item._id] = item.count;
  });

  return stats;
}

/**
 * Update profile segments
 */
export async function updateProfileSegments(
  userId: string,
  segments: string[]
): Promise<IUnifiedProfile | null> {
  const profile = await UnifiedProfileModel.findOneAndUpdate(
    { userId },
    {
      $set: {
        segments,
        lastUpdated: new Date()
      }
    },
    { new: true }
  );

  return profile as unknown as IUnifiedProfile || null;
}

/**
 * Delete a profile
 */
export async function deleteProfile(userId: string): Promise<boolean> {
  const result = await UnifiedProfileModel.deleteOne({ userId });

  logger.info(`Deleted profile for user ${userId}: ${result.deletedCount > 0}`);

  return result.deletedCount > 0;
}

export default {
  createProfile,
  getProfile,
  getProfileByIdentifier,
  enrichProfile,
  mergeProfiles,
  searchProfiles,
  getProfilesBySegment,
  getSegmentStats,
  updateProfileSegments,
  deleteProfile
};
