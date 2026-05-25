/**
 * REZ Offline Commerce Tracker
 *
 * Tracks offline commerce signals - the MOAT for REZ.
 *
 * This service tracks:
 * - Store visits (QR scans, geofence entry)
 * - Bill amounts (manual entry, POS integration)
 * - Offline purchases
 * - Redemption behavior
 * - In-store engagement
 *
 * This data is what makes REZ different from Meta/Google.
 * No other ad platform can track this deeply offline.
 */

import axios from 'axios';
import { v4 as uuid } from 'uuid';

// ============================================================================
// Configuration
// ============================================================================

const GRAPH_SERVICE_URL = process.env.GRAPH_SERVICE_URL || 'http://localhost:4129';
const EVENT_BUS_URL = process.env.EVENT_BUS_URL || 'http://localhost:4025';
const WALLET_SERVICE_URL = process.env.WALLET_SERVICE_URL || 'http://localhost:4004';

// ============================================================================
// Types
// ============================================================================

export interface StoreVisit {
  visitId: string;
  userId: string;
  merchantId: string;
  storeId: string;
  location: {
    lat: number;
    lng: number;
    address?: string;
  };
  entryTime: string;
  exitTime?: string;
  duration?: number; // minutes
  method: 'qr_scan' | 'geofence' | 'manual' | 'pos';
  metadata?: Record<string, unknown>;
}

export interface OfflinePurchase {
  purchaseId: string;
  userId: string;
  merchantId: string;
  storeId: string;
  billAmount: number;
  items?: {
    name: string;
    quantity: number;
    price: number;
    category?: string;
  }[];
  paymentMethod?: 'cash' | 'upi' | 'card' | 'wallet';
  cashbackEarned?: number;
  coinsRedeemed?: number;
  timestamp: string;
  source: 'manual' | 'pos' | 'qr';
}

export interface EngagementSignal {
  signalId: string;
  userId: string;
  merchantId: string;
  type: 'view' | 'save' | 'share' | 'review' | 'ask' | 'call' | 'directions';
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface OfflineProfile {
  userId: string;
  profile: {
    totalVisits: number;
    totalSpend: number;
    avgBillAmount: number;
    favoriteStores: { merchantId: string; visits: number; spend: number }[];
    favoriteCategories: { category: string; visits: number; spend: number }[];
    peakVisitDays: string[];
    peakVisitHours: number[];
    preferredPaymentMethods: string[];
    redemptionRate: number;
    avgDwellTime: number; // minutes
    lastVisit?: string;
  };
  segments: string[];
  predictedNextVisit?: {
    merchantId: string;
    probability: number;
    estimatedDay: string;
    estimatedTime: string;
  };
}

// ============================================================================
// Offline Commerce Tracker
// ============================================================================

class OfflineCommerceTracker {
  // Store visit tracking
  async trackStoreEntry(visit: Omit<StoreVisit, 'visitId'>): Promise<string> {
    const visitId = `visit_${uuid()}`;

    // Emit event to Event Bus
    await this.emitEvent({
      type: 'offline.store.entry',
      userId: visit.userId,
      merchantId: visit.merchantId,
      data: {
        visitId,
        storeId: visit.storeId,
        location: visit.location,
        entryTime: visit.entryTime,
        method: visit.method
      }
    });

    // Update graph with visit
    await this.updateGraph({
      type: 'visited',
      from: { type: 'user', id: visit.userId },
      to: { type: 'merchant', id: visit.merchantId },
      weight: 0.5,
      properties: {
        visitId,
        method: visit.method,
        entryTime: visit.entryTime
      }
    });

    return visitId;
  }

  async trackStoreExit(visitId: string, exitTime: string): Promise<void> {
    await this.emitEvent({
      type: 'offline.store.exit',
      data: {
        visitId,
        exitTime,
        duration: this.calculateDuration(visitId, exitTime)
      }
    });
  }

  // Offline purchase tracking
  async trackOfflinePurchase(purchase: Omit<OfflinePurchase, 'purchaseId'>): Promise<string> {
    const purchaseId = `purchase_${uuid()}`;

    // Emit event
    await this.emitEvent({
      type: 'offline.purchase.completed',
      userId: purchase.userId,
      merchantId: purchase.merchantId,
      data: {
        purchaseId,
        billAmount: purchase.billAmount,
        paymentMethod: purchase.paymentMethod,
        cashbackEarned: purchase.cashbackEarned,
        items: purchase.items
      }
    });

    // Update graph
    await this.updateGraph({
      type: 'purchased_from',
      from: { type: 'user', id: purchase.userId },
      to: { type: 'merchant', id: purchase.merchantId },
      weight: Math.min(purchase.billAmount / 100, 5), // Max weight of 5 for ₹500+
      properties: {
        purchaseId,
        billAmount: purchase.billAmount,
        timestamp: purchase.timestamp
      }
    });

    // Update merchant analytics
    await this.updateMerchantAnalytics(purchase.merchantId, purchase.billAmount);

    return purchaseId;
  }

  // Engagement tracking
  async trackEngagement(signal: Omit<EngagementSignal, 'signalId'>): Promise<string> {
    const signalId = `signal_${uuid()}`;

    await this.emitEvent({
      type: `offline.engagement.${signal.type}`,
      userId: signal.userId,
      merchantId: signal.merchantId,
      data: {
        signalId,
        type: signal.type,
        metadata: signal.metadata
      }
    });

    return signalId;
  }

  // Get offline profile
  async getOfflineProfile(userId: string): Promise<OfflineProfile | null> {
    try {
      const response = await axios.get(
        `${GRAPH_SERVICE_URL}/api/profile/offline/${userId}`,
        { timeout: 5000 }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to get offline profile:', error);
      return null;
    }
  }

  // Build segments based on offline behavior
  async buildOfflineSegments(userId: string): Promise<string[]> {
    const profile = await this.getOfflineProfile(userId);
    if (!profile) return [];

    const segments: string[] = [];

    // Frequency-based segments
    if (profile.profile.totalVisits > 50) segments.push('high_frequency_visitor');
    if (profile.profile.totalVisits > 20) segments.push('regular_visitor');
    if (profile.profile.totalVisits < 5) segments.push('new_visitor');

    // Spend-based segments
    if (profile.profile.avgBillAmount > 1000) segments.push('high_spender');
    if (profile.profile.avgBillAmount > 500) segments.push('mid_spender');
    if (profile.profile.avgBillAmount < 200) segments.push('budget_shopper');

    // Category-based segments
    const topCategory = profile.profile.favoriteCategories[0];
    if (topCategory) {
      segments.push(`${topCategory.category}_lover`);
    }

    // Time-based segments
    const peakHour = profile.profile.peakVisitHours[0];
    if (peakHour >= 6 && peakHour <= 11) segments.push('morning_shopper');
    if (peakHour >= 12 && peakHour <= 17) segments.push('afternoon_shopper');
    if (peakHour >= 18 && peakHour <= 22) segments.push('evening_shopper');
    if (peakHour >= 22 || peakHour <= 4) segments.push('night_owl');

    // Payment-based segments
    if (profile.profile.preferredPaymentMethods.includes('wallet')) {
      segments.push('wallet_user');
    }
    if (profile.profile.redemptionRate > 0.7) segments.push('coin_redemption_enthusiast');

    // Dwell time segments
    if (profile.profile.avgDwellTime > 30) segments.push('long_dwell');
    if (profile.profile.avgDwellTime < 10) segments.push('quick_visitor');

    return segments;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async emitEvent(event: {
    type: string;
    userId?: string;
    merchantId?: string;
    data: Record<string, unknown>;
  }): Promise<void> {
    try {
      await axios.post(`${EVENT_BUS_URL}/api/events`, {
        ...event,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to emit event:', error);
    }
  }

  private async updateGraph(edge: {
    type: string;
    from: { type: string; id: string };
    to: { type: string; id: string };
    weight: number;
    properties: Record<string, unknown>;
  }): Promise<void> {
    try {
      await axios.post(`${GRAPH_SERVICE_URL}/api/edges`, edge);
    } catch (error) {
      console.error('Failed to update graph:', error);
    }
  }

  private async updateMerchantAnalytics(merchantId: string, billAmount: number): Promise<void> {
    try {
      await axios.post(`${GRAPH_SERVICE_URL}/api/analytics/merchant/${merchantId}`, {
        type: 'offline_purchase',
        amount: billAmount
      });
    } catch (error) {
      console.error('Failed to update merchant analytics:', error);
    }
  }

  private calculateDuration(visitId: string, exitTime: string): number {
    // In production, fetch entry time from visitId
    const entryTime = new Date();
    const exit = new Date(exitTime);
    return Math.round((exit.getTime() - entryTime.getTime()) / 60000);
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const offlineCommerceTracker = new OfflineCommerceTracker();
export default offlineCommerceTracker;
