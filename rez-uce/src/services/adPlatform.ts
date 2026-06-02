import Redis from 'ioredis';
import { v4 as uuid } from 'uuid';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// ============================================
// UNIFIED AD PLATFORM
// Combines: rez-ads-service + adBazaar + adsqr
// ============================================

interface Campaign {
  id: string;
  type: 'standard' | 'qr' | 'attribution';
  status: 'draft' | 'active' | 'paused' | 'completed';
  budget: number;
  spent: number;
  rewards: {
    scan?: number;
    visit?: number;
    purchase?: number;
  };
  segments: string[];
  categories: string[];
  createdAt: Date;
}

interface QRCode {
  id: string;
  campaignId: string;
  label: string;
  location?: string;
  scanCount: number;
  uniqueScans: number;
}

// ============================================
// CAMPAIGN MANAGEMENT
// ============================================

export async function createCampaign(data: Partial<Campaign>): Promise<Campaign> {
  const campaign: Campaign = {
    id: uuid(),
    type: data.type || 'standard',
    status: 'draft',
    budget: data.budget || 0,
    spent: 0,
    rewards: data.rewards || {},
    segments: data.segments || [],
    categories: data.categories || [],
    createdAt: new Date()
  };

  await redis.setex(`campaign:${campaign.id}`, 86400 * 30, JSON.stringify(campaign));
  return campaign;
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  const cached = await redis.get(`campaign:${id}`);
  if (cached) return JSON.parse(cached);

  const data = await redis.hget('campaigns', id);
  return data ? JSON.parse(data) : null;
}

export async function updateCampaign(id: string, updates: Partial<Campaign>): Promise<Campaign | null> {
  const campaign = await getCampaign(id);
  if (!campaign) return null;

  const updated = { ...campaign, ...updates };
  await redis.setex(`campaign:${id}`, 86400 * 30, JSON.stringify(updated));
  await redis.hset('campaigns', id, JSON.stringify(updated));
  return updated;
}

export async function listCampaigns(filter?: { status?: string }): Promise<Campaign[]> {
  const keys = await redis.keys('campaign:*');
  const campaigns: Campaign[] = [];

  for (const key of keys.slice(0, 100)) {
    const data = await redis.get(key);
    if (data) {
      const campaign = JSON.parse(data);
      if (!filter?.status || campaign.status === filter.status) {
        campaigns.push(campaign);
      }
    }
  }

  return campaigns;
}

// ============================================
// BUDGET TRACKING (Atomic $expr pattern)
// ============================================

export async function recordSpend(campaignId: string, amount: number): Promise<boolean> {
  // Atomic budget check using Redis
  const campaign = await getCampaign(campaignId);
  if (!campaign) return false;

  // Check budget
  if (campaign.spent + amount > campaign.budget) {
    return false;
  }

  // Atomic update
  campaign.spent += amount;
  await redis.setex(`campaign:${campaignId}`, 86400 * 30, JSON.stringify(campaign));

  return true;
}

// ============================================
// QR CODE MANAGEMENT
// ============================================

export async function generateQRCode(campaignId: string, label?: string): Promise<QRCode> {
  const qr: QRCode = {
    id: uuid(),
    campaignId,
    label: label || `QR-${Date.now()}`,
    scanCount: 0,
    uniqueScans: 0
  };

  await redis.setex(`qr:${qr.id}`, 86400 * 365, JSON.stringify(qr));
  await redis.lpush(`campaign:${campaignId}:qrs`, qr.id);

  return qr;
}

export async function recordScan(qrId: string, userId: string): Promise<void> {
  const qr: QRCode = JSON.parse(
    await redis.get(`qr:${qrId}`) || '{}'
  );

  qr.scanCount++;

  // Track unique scans
  const uniqueKey = `qr:${qrId}:scans`;
  const isUnique = await redis.sadd(uniqueKey, userId);

  if (isUnique) {
    qr.uniqueScans++;
  }

  await redis.setex(`qr:${qrId}`, 86400 * 365, JSON.stringify(qr));
}

// ============================================
// REWARD DISTRIBUTION
// ============================================

export async function distributeReward(
  campaignId: string,
  userId: string,
  event: 'scan' | 'visit' | 'purchase',
  amount: number
): Promise<{ success: boolean; coins?: number }> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) return { success: false };

  // Check budget
  const reward = campaign.rewards[event] || 0;
  if (!reward) return { success: false };

  if (campaign.spent + reward > campaign.budget) {
    return { success: false };
  }

  // Atomic update
  campaign.spent += reward;
  await redis.setex(`campaign:${campaignId}`, 86400 * 30, JSON.stringify(campaign));

  // Credit user wallet (would call wallet service)
  await redis.lpush(`user:${userId}:rewards`, JSON.stringify({
    campaignId,
    event,
    amount: reward,
    timestamp: Date.now()
  }));

  return { success: true, coins: reward };
}

// ============================================
// ATTRIBUTION FUNNEL
// ============================================

export async function trackAttribution(
  campaignId: string,
  userId: string,
  stage: 'scan' | 'visit' | 'purchase'
): Promise<void> {
  const key = `attribution:${campaignId}:${userId}`;

  const existing = await redis.hgetall(key);
  existing[stage] = new Date().toISOString();

  await redis.hset(key, existing);
  await redis.expire(key, 86400 * 7);
}

export async function getAttribution(campaignId: string, userId: string) {
  const key = `attribution:${campaignId}:${userId}`;
  return redis.hgetall(key);
}

// ============================================
// FREQUENCY CAPPING
// ============================================

export async function checkFrequencyCap(
  userId: string,
  campaignId: string
): Promise<{ allowed: boolean; remaining: number }> {
  const daily = await redis.get(`freq:${userId}:${campaignId}:daily`) || '0';
  const weekly = await redis.get(`freq:${userId}:${campaignId}:weekly`) || '0';

  const DAILY_CAP = 5;
  const WEEKLY_CAP = 15;

  if (parseInt(daily) >= DAILY_CAP) {
    return { allowed: false, remaining: 0 };
  }

  if (parseInt(weekly) >= WEEKLY_CAP) {
    return { allowed: false, remaining: 0 };
  }

  return {
    allowed: true,
    remaining: DAILY_CAP - parseInt(daily) - 1
  };
}

export async function recordFrequency(userId: string, campaignId: string): Promise<void> {
  const dayKey = `freq:${userId}:${campaignId}:daily`;
  const weekKey = `freq:${userId}:${campaignId}:weekly`;

  await redis.incr(dayKey);
  await redis.incr(weekKey);
  await redis.expire(dayKey, 86400);
  await redis.expire(weekKey, 86400 * 7);
}
