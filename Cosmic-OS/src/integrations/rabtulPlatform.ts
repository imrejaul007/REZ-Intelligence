/**
 * Cosmic OS - RABTUL Platform Integration
 *
 * Integration with RABTUL services for:
 * - Authentication (user verification)
 * - Profile (user data for context)
 * - Wallet (wellness rewards/coins)
 * - Notifications (daily readings)
 * - Gamification (wellness streaks)
 */

import axios from 'axios';

// ============================================
// RABTUL SERVICE URLS
// ============================================

const RABTUL_SERVICES = {
  auth: process.env.RABTUL_AUTH_URL || 'https://rez-auth-service.onrender.com',
  wallet: process.env.RABTUL_WALLET_URL || 'https://rez-wallet-service-36vo.onrender.com',
  notification: process.env.RABTUL_NOTIFICATION_URL || 'https://rez-notifications-service.onrender.com',
  profile: process.env.RABTUL_PROFILE_URL || 'https://rez-profile-service.onrender.com',
  gamification: process.env.RABTUL_GAMIFICATION_URL || 'http://localhost:4041',
  prive: process.env.RABTUL_PRIVE_URL || 'http://localhost:4070',
};

// Internal token for service-to-service calls
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'dev-internal-token';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Internal-Token': INTERNAL_TOKEN,
});

// ============================================
// AUTH SERVICE
// ============================================

export interface AuthUser {
  id: string;
  phoneNumber?: string;
  email?: string;
  profile?: {
    firstName?: string;
    lastName?: string;
    avatar?: string;
  };
  isVerified?: boolean;
}

export async function verifyUser(token: string): Promise<AuthUser | null> {
  try {
    const response = await axios.post(
      `${RABTUL_SERVICES.auth}/api/auth/verify`,
      { token },
      { headers: getHeaders(), timeout: 5000 }
    );
    return response.data;
  } catch {
    return null;
  }
}

export async function sendOTP(phone: string): Promise<boolean> {
  try {
    await axios.post(
      `${RABTUL_SERVICES.auth}/api/auth/send-otp`,
      { phoneNumber: phone, countryCode: '+91' },
      { headers: getHeaders(), timeout: 5000 }
    );
    return true;
  } catch {
    return false;
  }
}

export async function verifyOTP(phone: string, otp: string): Promise<{ token?: string; user?: AuthUser }> {
  try {
    const response = await axios.post(
      `${RABTUL_SERVICES.auth}/api/auth/verify-otp`,
      { phoneNumber: phone, otp },
      { headers: getHeaders(), timeout: 5000 }
    );
    return response.data;
  } catch {
    return {};
  }
}

// ============================================
// PROFILE SERVICE
// ============================================

export interface UserProfile {
  userId: string;
  name?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  dateOfBirth?: string;
  gender?: string;
  preferences?: Record<string, unknown>;
  addresses?: Array<{
    type: string;
    city?: string;
    state?: string;
  }>;
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const response = await axios.get(
      `${RABTUL_SERVICES.profile}/api/profiles/${userId}`,
      { headers: getHeaders(), timeout: 5000 }
    );
    return response.data;
  } catch {
    return null;
  }
}

export async function updateUserProfile(userId: string, data: Partial<UserProfile>): Promise<boolean> {
  try {
    await axios.patch(
      `${RABTUL_SERVICES.profile}/api/profiles/${userId}`,
      data,
      { headers: getHeaders(), timeout: 5000 }
    );
    return true;
  } catch {
    return false;
  }
}

// ============================================
// WALLET SERVICE
// ============================================

export interface WalletBalance {
  userId: string;
  coins: number;
  cashback: number;
  totalValue: number;
}

export async function getWalletBalance(userId: string): Promise<WalletBalance | null> {
  try {
    const response = await axios.get(
      `${RABTUL_SERVICES.wallet}/api/wallet/balance/${userId}`,
      { headers: getHeaders(), timeout: 5000 }
    );
    return response.data;
  } catch {
    return null;
  }
}

export async function addWellnessCoins(
  userId: string,
  amount: number,
  reason: string
): Promise<boolean> {
  try {
    await axios.post(
      `${RABTUL_SERVICES.wallet}/api/wallet/add`,
      { userId, amount, reason },
      { headers: getHeaders(), timeout: 5000 }
    );
    return true;
  } catch {
    return false;
  }
}

export async function deductWellnessCoins(
  userId: string,
  amount: number,
  reason: string
): Promise<boolean> {
  try {
    await axios.post(
      `${RABTUL_SERVICES.wallet}/api/wallet/deduct`,
      { userId, amount, reason },
      { headers: getHeaders(), timeout: 5000 }
    );
    return true;
  } catch {
    return false;
  }
}

export async function getWalletTransactions(
  userId: string,
  limit = 20
): Promise<Array<{
  transactionId: string;
  type: 'credit' | 'debit';
  amount: number;
  reason: string;
  timestamp: string;
}>> {
  try {
    const response = await axios.get(
      `${RABTUL_SERVICES.wallet}/api/wallet/transactions/${userId}?limit=${limit}`,
      { headers: getHeaders(), timeout: 5000 }
    );
    return response.data.transactions || [];
  } catch {
    return [];
  }
}

// ============================================
// NOTIFICATION SERVICE
// ============================================

export interface NotificationPayload {
  userId: string;
  type: 'push' | 'sms' | 'email' | 'whatsapp';
  title?: string;
  message: string;
  data?: Record<string, unknown>;
}

export async function sendNotification(payload: NotificationPayload): Promise<boolean> {
  try {
    await axios.post(
      `${RABTUL_SERVICES.notification}/api/notifications/send`,
      payload,
      { headers: getHeaders(), timeout: 5000 }
    );
    return true;
  } catch {
    return false;
  }
}

export async function sendDailyCosmicReading(
  userId: string,
  reading: {
    theme: string;
    affirmation: string;
    cosmicState: string;
  }
): Promise<boolean> {
  return sendNotification({
    userId,
    type: 'push',
    title: 'Your Daily Cosmic Reading ✨',
    message: `${reading.theme}\n\n${reading.affirmation}\n\nEnergy: ${reading.cosmicState}`,
    data: {
      type: 'daily_cosmic_reading',
      theme: reading.theme,
    },
  });
}

export async function sendWellnessReminder(
  userId: string,
  message: string
): Promise<boolean> {
  return sendNotification({
    userId,
    type: 'push',
    title: 'Cosmic OS Wellness Check-in 🌟',
    message,
    data: { type: 'wellness_reminder' },
  });
}

// ============================================
// GAMIFICATION SERVICE
// ============================================

export interface WellnessStreak {
  userId: string;
  streakDays: number;
  longestStreak: number;
  totalCheckins: number;
  lastCheckin: string;
}

export async function recordWellnessCheckin(
  userId: string,
  mood: string
): Promise<{
  success: boolean;
  streak?: WellnessStreak;
  coinsEarned?: number;
}> {
  try {
    const response = await axios.post(
      `${RABTUL_SERVICES.gamification}/api/karma/wellness-checkin`,
      { userId, mood, source: 'cosmic_os' },
      { headers: getHeaders(), timeout: 5000 }
    );
    return response.data;
  } catch {
    // Fallback - simulate streak tracking
    return {
      success: true,
      streak: {
        userId,
        streakDays: 1,
        longestStreak: 1,
        totalCheckins: 1,
        lastCheckin: new Date().toISOString(),
      },
      coinsEarned: 5,
    };
  }
}

export async function getWellnessStreak(userId: string): Promise<WellnessStreak | null> {
  try {
    const response = await axios.get(
      `${RABTUL_SERVICES.gamification}/api/karma/streak/${userId}`,
      { headers: getHeaders(), timeout: 5000 }
    );
    return response.data;
  } catch {
    return null;
  }
}

// ============================================
// PRIVE SERVICE (Premium Loyalty)
// ============================================

export interface PriveEligibility {
  eligible: boolean;
  tier?: 'entry' | 'signature' | 'elite';
  score?: number;
  pillars?: {
    engagement: number;
    trust: number;
    influence: number;
    economic: number;
    brandAffinity: number;
    network: number;
  };
}

export async function checkPriveEligibility(userId: string): Promise<PriveEligibility> {
  try {
    const response = await axios.get(
      `${RABTUL_SERVICES.prive}/api/eligibility`,
      { headers: getHeaders(), timeout: 5000 }
    );
    return response.data;
  } catch {
    return { eligible: false };
  }
}

export async function recordEngagementSignal(
  userId: string,
  signal: {
    type: string;
    value: number;
    source: string;
  }
): Promise<boolean> {
  try {
    await axios.post(
      `${RABTUL_SERVICES.prive}/api/engagement/signal`,
      { userId, ...signal },
      { headers: getHeaders(), timeout: 5000 }
    );
    return true;
  } catch {
    return false;
  }
}

// ============================================
// WELLNESS REWARDS CONFIG
// ============================================

export const WELLNESS_REWARDS = {
  moodCheckin: 5, // coins per mood check-in
  streakBonus: 10, // extra coins for streaks
  weeklyGoal: 50, // coins for weekly wellness goal
  monthlyGoal: 200, // coins for monthly wellness goal
  mindfulnessSession: 15, // coins per mindfulness session
  journalEntry: 5, // coins per journal entry
  weeklyStreakMilestones: {
    7: 50, // 1 week streak
    14: 100, // 2 week streak
    30: 300, // 1 month streak
    60: 750, // 2 month streak
    90: 1500, // 3 month streak
  },
};

export async function awardWellnessReward(
  userId: string,
  rewardType: 'moodCheckin' | 'streakBonus' | 'weeklyGoal' | 'monthlyGoal' | 'mindfulnessSession' | 'journalEntry',
  streakDays = 0
): Promise<{ awarded: boolean; coins: number }> {
  // Base rewards by type
  const baseRewards: Record<string, number> = {
    moodCheckin: 5,
    streakBonus: 10,
    weeklyGoal: 50,
    monthlyGoal: 200,
    mindfulnessSession: 15,
    journalEntry: 5,
  };

  let coins = baseRewards[rewardType] || 5;

  // Check for streak milestone bonus
  if (rewardType === 'streakBonus') {
    const streakMilestone = WELLNESS_REWARDS.weeklyStreakMilestones[streakDays as keyof typeof WELLNESS_REWARDS.weeklyStreakMilestones];
    if (streakMilestone) {
      coins += streakMilestone;
    }
  }

  const success = await addWellnessCoins(userId, coins, `Cosmic OS Wellness: ${rewardType}`);

  return { awarded: success, coins };
}

// ============================================
// UNIFIED USER CONTEXT
// ============================================

export interface CosmicUserContext {
  user: AuthUser;
  profile: UserProfile | null;
  wallet: WalletBalance | null;
  prive: PriveEligibility | null;
  streak: WellnessStreak | null;
}

export async function getCosmicUserContext(userId: string, token?: string): Promise<CosmicUserContext | null> {
  // Verify token if provided
  if (token) {
    const user = await verifyUser(token);
    if (!user || user.id !== userId) return null;
  }

  // Fetch all data in parallel
  const [profile, wallet, prive, streak] = await Promise.all([
    getUserProfile(userId),
    getWalletBalance(userId),
    checkPriveEligibility(userId),
    getWellnessStreak(userId),
  ]);

  return {
    user: { id: userId },
    profile,
    wallet,
    prive,
    streak,
  };
}
