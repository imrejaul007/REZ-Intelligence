/**
 * ConsumerProfile - Canonical Consumer Model
 * Manages the unified view of a consumer across all platforms
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Consumer360,
  LinkedDevice,
  LinkedApp,
  LinkedWallet,
  TransactionSummary,
  BrowsingSummary,
  DOOHSummary,
  IntentProfile,
  LoyaltyProfile,
  AIMemoryProfile,
  ConsumerMetadata,
  TasteProfile,
  AppType,
  WalletType,
  LoyaltyTier,
  ConsentStatus,
} from './types';

export class ConsumerProfile {
  private profile: Consumer360;

  constructor(data?: Partial<Consumer360>) {
    this.profile = this.createDefaultProfile();
    if (data) {
      this.merge(data);
    }
  }

  private createDefaultProfile(): Consumer360 {
    const now = new Date().toISOString();
    return {
      user_id: uuidv4(),
      primary_email: '',
      primary_phone: '',
      created_at: now,
      updated_at: now,
      devices: [],
      apps: [],
      wallets: [],
      transactions: {
        total_orders: 0,
        total_spent: 0,
        avg_order_value: 0,
        last_order: '',
        first_order: '',
        order_frequency: 'occasional',
      },
      browsing: {
        sessions: 0,
        search_queries: 0,
        products_viewed: 0,
        wishlists: 0,
        cart_abandons: 0,
        avg_session_duration: 0,
        last_session: '',
      },
      dooh: {
        scanned_codes: 0,
        redemptions: 0,
        campaigns_viewed: 0,
        engagement_score: 0,
        favorite_locations: [],
        last_scan: '',
      },
      intent: {
        affinities: [],
        categories: [],
        price_range: {
          min: 0,
          max: 1000,
          currency: 'USD',
          preferred: 50,
        },
        preferred_brands: [],
        seasonal_patterns: [],
        predicted_interests: [],
        confidence_scores: {},
      },
      loyalty: {
        points_balance: 0,
        lifetime_points: 0,
        tier: 'bronze',
        tier_progress: 0,
        referral_count: 0,
        member_since: now,
        benefits: [],
      },
      ai_memory: {
        preferences: {},
        conversation_history: [],
        taste_profile: this.createDefaultTasteProfile(),
        interaction_patterns: [],
        feedback_history: [],
      },
      metadata: {
        data_sources: [],
        last_aggregated: now,
        verification_status: 'unverified',
        consent_status: {
          marketing: false,
          analytics: false,
          personalization: false,
          third_party_sharing: false,
        },
        gdpr_compliant: false,
        risk_score: 0,
        segment_tags: [],
      },
    };
  }

  private createDefaultTasteProfile(): TasteProfile {
    return {
      flavors: {},
      style_preferences: [],
      dietary_restrictions: [],
      preferred_cuisines: [],
      price_sensitivity: 'medium',
      sustainability_focus: 0.5,
    };
  }

  // ============================================
  // IDENTITY MANAGEMENT
  // ============================================

  get userId(): string {
    return this.profile.user_id;
  }

  get email(): string {
    return this.profile.primary_email;
  }

  get phone(): string {
    return this.profile.primary_phone;
  }

  setIdentity(email?: string, phone?: string): void {
    if (email) {
      this.profile.primary_email = email.toLowerCase().trim();
    }
    if (phone) {
      this.profile.primary_phone = this.normalizePhone(phone);
    }
    this.touch();
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/[^\d+]/g, '');
  }

  // ============================================
  // DEVICE MANAGEMENT
  // ============================================

  addDevice(device: Omit<LinkedDevice, 'device_id' | 'linked_at'>): void {
    const existing = this.profile.devices.find(
      (d) => d.device_id === device.device_id
    );

    if (existing) {
      existing.last_active = new Date().toISOString();
      Object.assign(existing, device);
    } else {
      this.profile.devices.push({
        device_id: device.device_id,
        type: device.type,
        platform: device.platform,
        app_version: device.app_version,
        linked_at: new Date().toISOString(),
        last_active: new Date().toISOString(),
        primary: device.primary ?? this.profile.devices.length === 0,
        trust_score: device.trust_score ?? 0.5,
      });
    }
    this.touch();
  }

  removeDevice(deviceId: string): void {
    this.profile.devices = this.profile.devices.filter(
      (d) => d.device_id !== deviceId
    );
    // If removed device was primary, set another as primary
    if (this.profile.devices.length > 0 && !this.profile.devices.some(d => d.primary)) {
      this.profile.devices[0].primary = true;
    }
    this.touch();
  }

  getPrimaryDevice(): LinkedDevice | undefined {
    return this.profile.devices.find((d) => d.primary);
  }

  // ============================================
  // APP LINKING
  // ============================================

  linkApp(app: AppType, userIdInApp: string): void {
    const existing = this.profile.apps.find((a) => a.app === app);

    if (existing) {
      existing.user_id_in_app = userIdInApp;
      existing.last_sync = new Date().toISOString();
      existing.connected = true;
    } else {
      this.profile.apps.push({
        app,
        user_id_in_app: userIdInApp,
        linked_at: new Date().toISOString(),
        last_sync: new Date().toISOString(),
        connected: true,
      });
    }
    this.touch();
  }

  unlinkApp(app: AppType): void {
    const appLink = this.profile.apps.find((a) => a.app === app);
    if (appLink) {
      appLink.connected = false;
    }
    this.touch();
  }

  isAppLinked(app: AppType): boolean {
    const appLink = this.profile.apps.find((a) => a.app === app);
    return appLink?.connected ?? false;
  }

  // ============================================
  // WALLET MANAGEMENT
  // ============================================

  addWallet(type: WalletType, balance: number, address?: string): void {
    const existing = this.profile.wallets.find((w) => w.type === type);

    if (existing) {
      existing.balance = balance;
      existing.linked = true;
      if (address) existing.address = address;
    } else {
      this.profile.wallets.push({
        type,
        balance,
        linked: true,
        linked_at: new Date().toISOString(),
        currency: type === 'crypto' ? 'CRYPTO' : 'USD',
        address,
      });
    }
    this.touch();
  }

  updateWalletBalance(type: WalletType, balance: number): void {
    const wallet = this.profile.wallets.find((w) => w.type === type);
    if (wallet) {
      wallet.balance = balance;
      this.touch();
    }
  }

  getWallet(type: WalletType): LinkedWallet | undefined {
    return this.profile.wallets.find((w) => w.type === type);
  }

  // ============================================
  // TRANSACTION MANAGEMENT
  // ============================================

  addTransaction(amount: number, paymentMethod?: string): void {
    const now = new Date().toISOString();
    const summary = this.profile.transactions;

    summary.total_orders += 1;
    summary.total_spent += amount;
    summary.avg_order_value = summary.total_spent / summary.total_orders;
    summary.last_order = now;

    if (!summary.first_order) {
      summary.first_order = now;
    }

    if (paymentMethod) {
      summary.favorite_payment_method = paymentMethod;
    }

    this.updateOrderFrequency();
    this.touch();
  }

  private updateOrderFrequency(): void {
    const summary = this.profile.transactions;
    if (!summary.first_order || !summary.last_order) return;

    const first = new Date(summary.first_order);
    const last = new Date(summary.last_order);
    const daysDiff = Math.max(1, (last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24));
    const ordersPerDay = summary.total_orders / daysDiff;

    if (ordersPerDay >= 1) {
      summary.order_frequency = 'daily';
    } else if (ordersPerDay >= 1 / 7) {
      summary.order_frequency = 'weekly';
    } else if (ordersPerDay >= 1 / 30) {
      summary.order_frequency = 'monthly';
    } else {
      summary.order_frequency = 'occasional';
    }
  }

  // ============================================
  // BROWSING MANAGEMENT
  // ============================================

  recordBrowsingEvent(
    type: 'session' | 'search' | 'product_view' | 'wishlist' | 'cart_abandon',
    sessionId?: string
  ): void {
    const summary = this.profile.browsing;
    const now = new Date().toISOString();

    switch (type) {
      case 'session':
        summary.sessions += 1;
        summary.last_session = now;
        break;
      case 'search':
        summary.search_queries += 1;
        break;
      case 'product_view':
        summary.products_viewed += 1;
        break;
      case 'wishlist':
        summary.wishlists += 1;
        break;
      case 'cart_abandon':
        summary.cart_abandons += 1;
        break;
    }

    this.touch();
  }

  // ============================================
  // DOOH MANAGEMENT
  // ============================================

  recordDOOHEngagement(type: 'scan' | 'redeem', location?: string): void {
    const summary = this.profile.dooh;
    const now = new Date().toISOString();

    if (type === 'scan') {
      summary.scanned_codes += 1;
      summary.last_scan = now;
      if (location && !summary.favorite_locations.includes(location)) {
        summary.favorite_locations.push(location);
      }
    } else if (type === 'redeem') {
      summary.redemptions += 1;
    }

    this.updateDOOHEngagementScore();
    this.touch();
  }

  private updateDOOHEngagementScore(): void {
    const summary = this.profile.dooh;
    const totalEngagements = summary.scanned_codes + summary.redemptions;
    if (totalEngagements === 0) {
      summary.engagement_score = 0;
      return;
    }
    // Score based on redemption rate (higher redemption = higher engagement)
    summary.engagement_score = Math.min(1, summary.redemptions / Math.max(1, summary.scanned_codes));
  }

  // ============================================
  // LOYALTY MANAGEMENT
  // ============================================

  updateLoyaltyTier(tier: LoyaltyTier): void {
    const loyalty = this.profile.loyalty;
    const previousTier = loyalty.tier;
    loyalty.tier = tier;

    if (this.isHigherTier(tier, previousTier)) {
      loyalty.benefits = this.getTierBenefits(tier);
      loyalty.tier_progress = 0;
    }

    this.touch();
  }

  private isHigherTier(newTier: LoyaltyTier, oldTier: LoyaltyTier): boolean {
    const tierOrder: LoyaltyTier[] = ['bronze', 'silver', 'gold', 'platinum', 'vip'];
    return tierOrder.indexOf(newTier) > tierOrder.indexOf(oldTier);
  }

  private getTierBenefits(tier: LoyaltyTier): string[] {
    const benefits: Record<LoyaltyTier, string[]> = {
      bronze: ['Basic rewards'],
      silver: ['Basic rewards', 'Birthday bonus', 'Free shipping'],
      gold: ['Silver benefits', 'Priority support', 'Early access'],
      platinum: ['Gold benefits', 'Exclusive events', 'Personal concierge'],
      vip: ['Platinum benefits', 'VIP-only products', 'Custom experiences'],
    };
    return benefits[tier];
  }

  addPoints(points: number, expiryDate?: string): void {
    const loyalty = this.profile.loyalty;
    loyalty.points_balance += points;
    loyalty.lifetime_points += points;

    if (expiryDate) {
      loyalty.points_expiry_date = expiryDate;
    }

    this.updateTierProgress();
    this.touch();
  }

  redeemPoints(points: number): boolean {
    const loyalty = this.profile.loyalty;
    if (loyalty.points_balance >= points) {
      loyalty.points_balance -= points;
      this.touch();
      return true;
    }
    return false;
  }

  private updateTierProgress(): void {
    const loyalty = this.profile.loyalty;
    // Define thresholds for each tier
    const thresholds = {
      bronze: { min: 0, max: 1000 },
      silver: { min: 1000, max: 5000 },
      gold: { min: 5000, max: 15000 },
      platinum: { min: 15000, max: 50000 },
      vip: { min: 50000, max: Infinity },
    };

    const tierThresholds = thresholds[loyalty.tier];
    if (loyalty.lifetime_points >= tierThresholds.min) {
      if (loyalty.lifetime_points >= thresholds.platinum.min && loyalty.tier === 'gold') {
        this.updateLoyaltyTier('platinum');
      } else if (loyalty.lifetime_points >= thresholds.gold.min && loyalty.tier === 'silver') {
        this.updateLoyaltyTier('gold');
      } else if (loyalty.lifetime_points >= thresholds.silver.min && loyalty.tier === 'bronze') {
        this.updateLoyaltyTier('silver');
      }
    }

    // Calculate progress within current tier
    const range = tierThresholds.max - tierThresholds.min;
    const progress = loyalty.lifetime_points - tierThresholds.min;
    loyalty.tier_progress = Math.min(100, (progress / range) * 100);
  }

  // ============================================
  // AI MEMORY MANAGEMENT
  // ============================================

  setPreference(key: string, value): void {
    this.profile.ai_memory.preferences[key] = value;
    this.touch();
  }

  getPreference(key: string): unknown {
    return this.profile.ai_memory.preferences[key];
  }

  updateTasteProfile(updates: Partial<TasteProfile>): void {
    this.profile.ai_memory.taste_profile = {
      ...this.profile.ai_memory.taste_profile,
      ...updates,
    };
    this.touch();
  }

  addFlavorPreference(flavor: string, score: number): void {
    this.profile.ai_memory.taste_profile.flavors[flavor] = score;
    this.touch();
  }

  // ============================================
  // INTENT PROFILE MANAGEMENT
  // ============================================

  updateIntentProfile(updates: Partial<IntentProfile>): void {
    this.profile.intent = {
      ...this.profile.intent,
      ...updates,
    };
    this.touch();
  }

  setPriceRange(min: number, max: number, currency: string = 'USD'): void {
    this.profile.intent.price_range = {
      min,
      max,
      currency,
      preferred: (min + max) / 2,
    };
    this.touch();
  }

  // ============================================
  // METADATA MANAGEMENT
  // ============================================

  addDataSource(source: string): void {
    if (!this.profile.metadata.data_sources.includes(source)) {
      this.profile.metadata.data_sources.push(source);
      this.touch();
    }
  }

  setConsentStatus(consent: Partial<ConsentStatus>): void {
    this.profile.metadata.consent_status = {
      ...this.profile.metadata.consent_status,
      ...consent,
    };
    this.updateGDPRCompliance();
    this.touch();
  }

  private updateGDPRCompliance(): void {
    const consent = this.profile.metadata.consent_status;
    this.profile.metadata.gdpr_compliant =
      consent.marketing !== undefined &&
      consent.analytics !== undefined &&
      consent.personalization !== undefined;
  }

  addSegmentTag(tag: string): void {
    if (!this.profile.metadata.segment_tags.includes(tag)) {
      this.profile.metadata.segment_tags.push(tag);
      this.touch();
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  private touch(): void {
    this.profile.updated_at = new Date().toISOString();
  }

  merge(data: Partial<Consumer360>): void {
    // Deep merge non-array properties
    Object.keys(data).forEach((key) => {
      const value = data[key as keyof Consumer360];
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          // For arrays, we could merge or replace depending on strategy
          (this.profile as unknown)[key] = value;
        } else if (typeof value === 'object') {
          (this.profile as unknown)[key] = {
            ...(this.profile as unknown)[key],
            ...value,
          };
        } else {
          (this.profile as unknown)[key] = value;
        }
      }
    });
    this.touch();
  }

  toJSON(): Consumer360 {
    return { ...this.profile };
  }

  static fromJSON(data: Consumer360): ConsumerProfile {
    const profile = new ConsumerProfile();
    profile.profile = { ...data };
    return profile;
  }

  // ============================================
  // SERIALIZATION
  // ============================================

  toBuffer(): Buffer {
    return Buffer.from(JSON.stringify(this.profile));
  }

  static fromBuffer(buffer: Buffer): ConsumerProfile {
    const data = JSON.parse(buffer.toString()) as Consumer360;
    return ConsumerProfile.fromJSON(data);
  }
}
