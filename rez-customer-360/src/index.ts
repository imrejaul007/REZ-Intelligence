/**
 * Customer 360 View Module
 * Unified customer profile with interaction history, lifetime value, and preferences
 */

import { EventEmitter } from 'events';
import { randomBytes } from 'crypto';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface ContactInfo {
  email: string;
  phone?: string;
  address?: Address;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface UnifiedProfile {
  id: string;
  firstName: string;
  lastName: string;
  contact: ContactInfo;
  demographics: Demographics;
  accountStatus: 'active' | 'inactive' | 'churned' | 'prospect';
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface Demographics {
  age?: number;
  gender?: string;
  occupation?: string;
  income?: string;
  education?: string;
  maritalStatus?: string;
  children?: number;
}

export interface Interaction {
  id: string;
  type: InteractionType;
  channel: Channel;
  timestamp: Date;
  duration?: number; // in seconds
  outcome?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  agent?: string;
  notes?: string;
  metadata: Record<string, unknown>;
}

export type InteractionType =
  | 'purchase'
  | 'support_ticket'
  | 'call'
  | 'email'
  | 'chat'
  | 'meeting'
  | 'survey'
  | 'refund'
  | 'upgrade'
  | 'downgrade'
  | 'feedback';

export type Channel = 'web' | 'mobile' | 'phone' | 'email' | 'chat' | 'in_store' | 'api';

export interface Transaction {
  id: string;
  timestamp: Date;
  amount: number;
  currency: string;
  items: TransactionItem[];
  paymentMethod: string;
  status: 'completed' | 'pending' | 'refunded' | 'failed';
}

export interface TransactionItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface LifetimeValue {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  firstPurchaseDate: Date | null;
  lastPurchaseDate: Date | null;
  predictedLTV: number;
  ltvScore: 'low' | 'medium' | 'high' | 'vip';
  churnRisk: 'low' | 'medium' | 'high' | 'critical';
  lastCalculated: Date;
}

export interface Preference {
  id: string;
  category: string;
  key: string;
  value: unknown;
  updatedAt: Date;
}

export interface CustomerPreferences {
  communication: {
    emailMarketing: boolean;
    smsMarketing: boolean;
    pushNotifications: boolean;
    preferredContactChannel: Channel;
  };
  privacy: {
    dataSharingConsent: boolean;
    analyticsConsent: boolean;
    gdprConsent: boolean;
    marketingConsent: boolean;
  };
  personalization: {
    language: string;
    timezone: string;
    currency: string;
    theme?: 'light' | 'dark' | 'system';
  };
  customPreferences: Preference[];
}

export interface Customer360Config {
  enableRealTimeUpdates: boolean;
  ltvPredictionModel?: 'simple' | 'advanced';
  churnRiskThreshold: number;
  maxInteractionsPerPage: number;
}

// ============================================================================
// Customer 360 Class
// ============================================================================

export class Customer360 extends EventEmitter {
  private profile: UnifiedProfile | null = null;
  private interactions: Interaction[] = [];
  private transactions: Transaction[] = [];
  private lifetimeValue: LifetimeValue | null = null;
  private preferences: CustomerPreferences | null = null;
  private config: Customer360Config;

  constructor(config: Partial<Customer360Config> = {}) {
    super();
    this.config = {
      enableRealTimeUpdates: true,
      ltvPredictionModel: 'simple',
      churnRiskThreshold: 0.5,
      maxInteractionsPerPage: 50,
      ...config,
    };
  }

  // ==========================================================================
  // Unified Profile Methods
  // ==========================================================================

  /**
   * Load or create a unified customer profile
   */
  async loadProfile(profile: UnifiedProfile): Promise<UnifiedProfile> {
    this.profile = {
      ...profile,
      createdAt: new Date(profile.createdAt),
      updatedAt: new Date(profile.updatedAt),
    };
    this.emit('profile:loaded', this.profile);
    return this.profile;
  }

  /**
   * Get the unified customer profile
   */
  getProfile(): UnifiedProfile | null {
    return this.profile;
  }

  /**
   * Update customer profile fields
   */
  async updateProfile(updates: Partial<UnifiedProfile>): Promise<UnifiedProfile> {
    if (!this.profile) {
      throw new Error('No profile loaded. Call loadProfile first.');
    }

    this.profile = {
      ...this.profile,
      ...updates,
      updatedAt: new Date(),
    };
    this.emit('profile:updated', this.profile);
    return this.profile;
  }

  /**
   * Add tags to the customer profile
   */
  async addTags(tags: string[]): Promise<string[]> {
    if (!this.profile) {
      throw new Error('No profile loaded.');
    }
    this.profile.tags = [...new Set([...this.profile.tags, ...tags])];
    this.profile.updatedAt = new Date();
    this.emit('profile:tagsUpdated', this.profile.tags);
    return this.profile.tags;
  }

  /**
   * Remove tags from the customer profile
   */
  async removeTags(tags: string[]): Promise<string[]> {
    if (!this.profile) {
      throw new Error('No profile loaded.');
    }
    this.profile.tags = this.profile.tags.filter((t) => !tags.includes(t));
    this.profile.updatedAt = new Date();
    this.emit('profile:tagsUpdated', this.profile.tags);
    return this.profile.tags;
  }

  // ==========================================================================
  // Interaction History Methods
  // ==========================================================================

  /**
   * Add a new interaction to the history
   */
  async addInteraction(interaction: Omit<Interaction, 'id'>): Promise<Interaction> {
    const newInteraction: Interaction = {
      ...interaction,
      id: this.generateId(),
      timestamp: new Date(interaction.timestamp),
    };
    this.interactions.unshift(newInteraction); // Most recent first

    if (this.config.enableRealTimeUpdates) {
      this.recalculateLTV();
    }

    this.emit('interaction:added', newInteraction);
    return newInteraction;
  }

  /**
   * Get interaction history with filtering and pagination
   */
  getInteractionHistory(options?: {
    type?: InteractionType;
    channel?: Channel;
    startDate?: Date;
    endDate?: Date;
    sentiment?: 'positive' | 'neutral' | 'negative';
    limit?: number;
    offset?: number;
  }): { interactions: Interaction[]; total: number } {
    let filtered = [...this.interactions];

    if (options?.type) {
      filtered = filtered.filter((i) => i.type === options.type);
    }
    if (options?.channel) {
      filtered = filtered.filter((i) => i.channel === options.channel);
    }
    if (options?.startDate) {
      filtered = filtered.filter((i) => i.timestamp >= options.startDate!);
    }
    if (options?.endDate) {
      filtered = filtered.filter((i) => i.timestamp <= options.endDate!);
    }
    if (options?.sentiment) {
      filtered = filtered.filter((i) => i.sentiment === options.sentiment);
    }

    const total = filtered.length;
    const limit = options?.limit ?? this.config.maxInteractionsPerPage;
    const offset = options?.offset ?? 0;

    return {
      interactions: filtered.slice(offset, offset + limit),
      total,
    };
  }

  /**
   * Get interactions within a date range
   */
  getInteractionsByDateRange(startDate: Date, endDate: Date): Interaction[] {
    return this.interactions.filter(
      (i) => i.timestamp >= startDate && i.timestamp <= endDate
    );
  }

  /**
   * Get interaction statistics
   */
  getInteractionStats(): {
    totalInteractions: number;
    byType: Record<InteractionType, number>;
    byChannel: Record<Channel, number>;
    averageSentiment: number;
    mostActiveDay: string;
  } {
    const byType: Partial<Record<InteractionType, number>> = {};
    const byChannel: Partial<Record<Channel, number>> = {};
    let sentimentSum = 0;
    let sentimentCount = 0;
    const dayCounts: Record<string, number> = {};

    for (const interaction of this.interactions) {
      byType[interaction.type] = (byType[interaction.type] || 0) + 1;
      byChannel[interaction.channel] = (byChannel[interaction.channel] || 0) + 1;

      if (interaction.sentiment) {
        sentimentSum += interaction.sentiment === 'positive' ? 1 : interaction.sentiment === 'negative' ? -1 : 0;
        sentimentCount++;
      }

      const day = interaction.timestamp.toLocaleDateString();
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    }

    const mostActiveDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

    return {
      totalInteractions: this.interactions.length,
      byType: byType as Record<InteractionType, number>,
      byChannel: byChannel as Record<Channel, number>,
      averageSentiment: sentimentCount > 0 ? sentimentSum / sentimentCount : 0,
      mostActiveDay,
    };
  }

  // ==========================================================================
  // Lifetime Value Methods
  // ==========================================================================

  /**
   * Recalculate the lifetime value metrics
   */
  recalculateLTV(): LifetimeValue {
    const completedTransactions = this.transactions.filter((t) => t.status === 'completed');

    const totalRevenue = completedTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalOrders = completedTransactions.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const sortedTransactions = [...completedTransactions].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
    const firstPurchaseDate = sortedTransactions[0]?.timestamp || null;
    const lastPurchaseDate = sortedTransactions[sortedTransactions.length - 1]?.timestamp || null;

    // Predict LTV based on average order value and engagement
    const predictedLTV = this.calculatePredictedLTV(totalRevenue, averageOrderValue, totalOrders);
    const ltvScore = this.calculateLTVScore(totalRevenue);
    const churnRisk = this.calculateChurnRisk();

    this.lifetimeValue = {
      totalRevenue,
      totalOrders,
      averageOrderValue,
      firstPurchaseDate,
      lastPurchaseDate,
      predictedLTV,
      ltvScore,
      churnRisk,
      lastCalculated: new Date(),
    };

    this.emit('ltv:recalculated', this.lifetimeValue);
    return this.lifetimeValue;
  }

  /**
   * Calculate predicted lifetime value
   */
  private calculatePredictedLTV(
    currentRevenue: number,
    avgOrderValue: number,
    orderCount: number
  ): number {
    if (this.config.ltvPredictionModel === 'simple') {
      // Simple model: extrapolate based on current average
      const expectedPurchasesPerYear = orderCount > 0 ? orderCount : 1;
      const expectedYearsAsCustomer = 3; // Assumed average customer lifespan
      return currentRevenue + avgOrderValue * expectedPurchasesPerYear * expectedYearsAsCustomer;
    }

    // Advanced model would use ML predictions
    // For now, use the same logic with adjustments
    const engagementScore = Math.min(orderCount / 10, 1); // Normalize to max 10 orders
    const multiplier = 1 + engagementScore * 2; // 1x to 3x multiplier
    return currentRevenue * multiplier * 3;
  }

  /**
   * Calculate LTV score category
   */
  private calculateLTVScore(totalRevenue: number): 'low' | 'medium' | 'high' | 'vip' {
    if (totalRevenue >= 10000) return 'vip';
    if (totalRevenue >= 5000) return 'high';
    if (totalRevenue >= 1000) return 'medium';
    return 'low';
  }

  /**
   * Calculate churn risk based on recency of interactions
   */
  private calculateChurnRisk(): 'low' | 'medium' | 'high' | 'critical' {
    if (!this.lastPurchaseDate) {
      return 'critical';
    }

    const daysSinceLastPurchase = Math.floor(
      (Date.now() - this.lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceLastPurchase > 90) return 'critical';
    if (daysSinceLastPurchase > 60) return 'high';
    if (daysSinceLastPurchase > 30) return 'medium';
    return 'low';
  }

  /**
   * Get the current lifetime value data
   */
  getLifetimeValue(): LifetimeValue | null {
    return this.lifetimeValue;
  }

  /**
   * Add transactions and update LTV
   */
  async addTransaction(transaction: Omit<Transaction, 'id'>): Promise<Transaction> {
    const newTransaction: Transaction = {
      ...transaction,
      id: this.generateId(),
      timestamp: new Date(transaction.timestamp),
    };
    this.transactions.push(newTransaction);
    this.recalculateLTV();
    this.emit('transaction:added', newTransaction);
    return newTransaction;
  }

  /**
   * Get transaction history
   */
  getTransactions(options?: {
    status?: Transaction['status'];
    startDate?: Date;
    endDate?: Date;
    minAmount?: number;
    maxAmount?: number;
  }): { transactions: Transaction[]; total: number } {
    let filtered = [...this.transactions];

    if (options?.status) {
      filtered = filtered.filter((t) => t.status === options.status);
    }
    if (options?.startDate) {
      filtered = filtered.filter((t) => t.timestamp >= options.startDate!);
    }
    if (options?.endDate) {
      filtered = filtered.filter((t) => t.timestamp <= options.endDate!);
    }
    if (options?.minAmount !== undefined) {
      filtered = filtered.filter((t) => t.amount >= options.minAmount!);
    }
    if (options?.maxAmount !== undefined) {
      filtered = filtered.filter((t) => t.amount <= options.maxAmount!);
    }

    return {
      transactions: filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
      total: filtered.length,
    };
  }

  // ==========================================================================
  // Preferences Methods
  // ==========================================================================

  /**
   * Load customer preferences
   */
  async loadPreferences(preferences: CustomerPreferences): Promise<CustomerPreferences> {
    this.preferences = preferences;
    this.emit('preferences:loaded', this.preferences);
    return this.preferences;
  }

  /**
   * Get customer preferences
   */
  getPreferences(): CustomerPreferences | null {
    return this.preferences;
  }

  /**
   * Update communication preferences
   */
  async updateCommunicationPreferences(
    updates: Partial<CustomerPreferences['communication']>
  ): Promise<CustomerPreferences['communication']> {
    if (!this.preferences) {
      throw new Error('No preferences loaded. Call loadPreferences first.');
    }
    this.preferences.communication = {
      ...this.preferences.communication,
      ...updates,
    };
    this.emit('preferences:updated', this.preferences);
    return this.preferences.communication;
  }

  /**
   * Update privacy consent settings
   */
  async updatePrivacyConsent(
    updates: Partial<CustomerPreferences['privacy']>
  ): Promise<CustomerPreferences['privacy']> {
    if (!this.preferences) {
      throw new Error('No preferences loaded. Call loadPreferences first.');
    }
    this.preferences.privacy = {
      ...this.preferences.privacy,
      ...updates,
    };
    this.emit('preferences:updated', this.preferences);
    return this.preferences.privacy;
  }

  /**
   * Update personalization settings
   */
  async updatePersonalization(
    updates: Partial<CustomerPreferences['personalization']>
  ): Promise<CustomerPreferences['personalization']> {
    if (!this.preferences) {
      throw new Error('No preferences loaded. Call loadPreferences first.');
    }
    this.preferences.personalization = {
      ...this.preferences.personalization,
      ...updates,
    };
    this.emit('preferences:updated', this.preferences);
    return this.preferences.personalization;
  }

  /**
   * Add or update a custom preference
   */
  async setCustomPreference(category: string, key: string, value: unknown): Promise<Preference> {
    if (!this.preferences) {
      throw new Error('No preferences loaded. Call loadPreferences first.');
    }

    const existingIndex = this.preferences.customPreferences.findIndex(
      (p) => p.category === category && p.key === key
    );

    const preference: Preference = {
      id: existingIndex >= 0 ? this.preferences.customPreferences[existingIndex].id : this.generateId(),
      category,
      key,
      value,
      updatedAt: new Date(),
    };

    if (existingIndex >= 0) {
      this.preferences.customPreferences[existingIndex] = preference;
    } else {
      this.preferences.customPreferences.push(preference);
    }

    this.emit('preferences:customUpdated', preference);
    return preference;
  }

  /**
   * Get a specific custom preference
   */
  getCustomPreference(category: string, key: string): Preference | undefined {
    return this.preferences?.customPreferences.find(
      (p) => p.category === category && p.key === key
    );
  }

  /**
   * Remove a custom preference
   */
  async removeCustomPreference(category: string, key: string): Promise<boolean> {
    if (!this.preferences) {
      throw new Error('No preferences loaded. Call loadPreferences first.');
    }
    const index = this.preferences.customPreferences.findIndex(
      (p) => p.category === category && p.key === key
    );
    if (index >= 0) {
      this.preferences.customPreferences.splice(index, 1);
      this.emit('preferences:customRemoved', { category, key });
      return true;
    }
    return false;
  }

  // ==========================================================================
  // Complete Customer 360 View
  // ==========================================================================

  /**
   * Get the complete Customer 360 view
   */
  getComplete360View(): {
    profile: UnifiedProfile | null;
    interactions: Interaction[];
    transactions: Transaction[];
    lifetimeValue: LifetimeValue | null;
    preferences: CustomerPreferences | null;
    summary: {
      customerName: string;
      accountAge: number; // in days
      daysSinceLastActivity: number | null;
      overallHealth: 'healthy' | 'at_risk' | 'churned';
    };
  } {
    const lastInteraction = this.interactions[0];
    const daysSinceLastActivity = lastInteraction
      ? Math.floor((Date.now() - lastInteraction.timestamp.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    let overallHealth: 'healthy' | 'at_risk' | 'churned' = 'healthy';
    if (this.lifetimeValue?.churnRisk === 'critical' || this.lifetimeValue?.churnRisk === 'high') {
      overallHealth = 'at_risk';
    }
    if (this.profile?.accountStatus === 'churned') {
      overallHealth = 'churned';
    }

    return {
      profile: this.profile,
      interactions: this.interactions,
      transactions: this.transactions,
      lifetimeValue: this.lifetimeValue,
      preferences: this.preferences,
      summary: {
        customerName: this.profile
          ? `${this.profile.firstName} ${this.profile.lastName}`
          : 'Unknown',
        accountAge: this.profile
          ? Math.floor((Date.now() - this.profile.createdAt.getTime()) / (1000 * 60 * 60 * 24))
          : 0,
        daysSinceLastActivity,
        overallHealth,
      },
    };
  }

  /**
   * Export customer data for compliance (GDPR, CCPA)
   */
  exportCustomerData(): Record<string, unknown> {
    const view = this.getComplete360View();
    return {
      exportedAt: new Date().toISOString(),
      profile: view.profile,
      interactions: view.interactions.map((i) => ({
        ...i,
        timestamp: i.timestamp.toISOString(),
      })),
      transactions: view.transactions.map((t) => ({
        ...t,
        timestamp: t.timestamp.toISOString(),
      })),
      preferences: view.preferences,
      ltv: view.lifetimeValue,
    };
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  private generateId(): string {
    return `${Date.now()}-${randomBytes(4).toString('hex')}`;
  }

  /**
   * Reset all customer data
   */
  reset(): void {
    this.profile = null;
    this.interactions = [];
    this.transactions = [];
    this.lifetimeValue = null;
    this.preferences = null;
    this.emit('reset');
  }

  /**
   * Get current configuration
   */
  getConfig(): Customer360Config {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  setConfig(updates: Partial<Customer360Config>): void {
    this.config = { ...this.config, ...updates };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createCustomer360(config?: Partial<Customer360Config>): Customer360 {
  return new Customer360(config);
}

// ============================================================================
// Default Export
// ============================================================================

export default Customer360;
