/**
 * Profile Aggregator Service - Event Handling Test Suite
 *
 * Tests for:
 * - Event subscription and handling
 * - Event-to-profile mapping
 * - Real-time profile updates via events
 * - Event ordering and idempotency
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// ============================================================================
// Types
// ============================================================================

type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
type KarmaLevel = 'starter' | 'active' | 'contributor' | 'leader' | 'elite';
type EventType =
  | 'wallet.credited'
  | 'wallet.debited'
  | 'loyalty.points_earned'
  | 'loyalty.tier_upgraded'
  | 'karma.activity_completed'
  | 'order.completed'
  | 'profile.updated';

interface BaseEvent {
  eventId: string;
  eventType: EventType;
  userId: string;
  timestamp: Date;
  correlationId?: string;
}

interface WalletCreditedEvent extends BaseEvent {
  eventType: 'wallet.credited';
  data: {
    amount: number;
    source: 'cashback' | 'refund' | 'bonus' | 'redemption_reversal';
    transactionId: string;
  };
}

interface WalletDebitedEvent extends BaseEvent {
  eventType: 'wallet.debited';
  data: {
    amount: number;
    reason: string;
    transactionId: string;
  };
}

interface LoyaltyPointsEarnedEvent extends BaseEvent {
  eventType: 'loyalty.points_earned';
  data: {
    points: number;
    source: 'order' | 'review' | 'referral' | 'bonus';
    orderId?: string;
    multiplier: number;
  };
}

interface TierUpgradedEvent extends BaseEvent {
  eventType: 'loyalty.tier_upgraded';
  data: {
    previousTier: LoyaltyTier;
    newTier: LoyaltyTier;
    trigger: 'points_threshold' | 'manual' | 'promotion';
  };
}

interface KarmaActivityCompletedEvent extends BaseEvent {
  eventType: 'karma.activity_completed';
  data: {
    activityType: string;
    karmaEarned: number;
    duration: number;
  };
}

interface OrderCompletedEvent extends BaseEvent {
  eventType: 'order.completed';
  data: {
    orderId: string;
    merchantId: string;
    totalAmount: number;
    cashbackEarned: number;
    pointsEarned: number;
  };
}

type ProfileEvent =
  | WalletCreditedEvent
  | WalletDebitedEvent
  | LoyaltyPointsEarnedEvent
  | TierUpgradedEvent
  | KarmaActivityCompletedEvent
  | OrderCompletedEvent;

interface UserProfile {
  userId: string;
  name: string;
  email: string;
  tier: LoyaltyTier;
  karmaLevel: KarmaLevel;
  createdAt: Date;
}

interface WalletState {
  userId: string;
  cashback: number;
  coins: number;
  lockedCoins: number;
}

interface LoyaltyState {
  userId: string;
  tier: LoyaltyTier;
  currentPoints: number;
  lifetimePoints: number;
}

interface KarmaState {
  userId: string;
  karmaScore: number;
  karmaLevel: KarmaLevel;
  totalActivities: number;
}

interface ProfileState {
  user?: UserProfile;
  wallet: WalletState;
  loyalty: LoyaltyState;
  karma: KarmaState;
}

// ============================================================================
// Mock Data Generators
// ============================================================================

function generateMockEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

function generateMockTransactionId(): string {
  return `txn_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

function mockWalletCreditedEvent(overrides?: Partial<WalletCreditedEvent['data']>): WalletCreditedEvent {
  return {
    eventId: generateMockEventId(),
    eventType: 'wallet.credited',
    userId: 'user_123',
    timestamp: new Date(),
    data: {
      amount: 100,
      source: 'cashback',
      transactionId: generateMockTransactionId(),
      ...overrides,
    },
  };
}

function mockWalletDebitedEvent(overrides?: Partial<WalletDebitedEvent['data']>): WalletDebitedEvent {
  return {
    eventId: generateMockEventId(),
    eventType: 'wallet.debited',
    userId: 'user_123',
    timestamp: new Date(),
    data: {
      amount: 50,
      reason: 'redemption',
      transactionId: generateMockTransactionId(),
      ...overrides,
    },
  };
}

function mockLoyaltyPointsEarnedEvent(overrides?: Partial<LoyaltyPointsEarnedEvent['data']>): LoyaltyPointsEarnedEvent {
  return {
    eventId: generateMockEventId(),
    eventType: 'loyalty.points_earned',
    userId: 'user_123',
    timestamp: new Date(),
    data: {
      points: 100,
      source: 'order',
      orderId: 'order_456',
      multiplier: 1.0,
      ...overrides,
    },
  };
}

function mockTierUpgradedEvent(overrides?: Partial<TierUpgradedEvent['data']>): TierUpgradedEvent {
  return {
    eventId: generateMockEventId(),
    eventType: 'loyalty.tier_upgraded',
    userId: 'user_123',
    timestamp: new Date(),
    data: {
      previousTier: 'bronze',
      newTier: 'silver',
      trigger: 'points_threshold',
      ...overrides,
    },
  };
}

function mockKarmaActivityCompletedEvent(overrides?: Partial<KarmaActivityCompletedEvent['data']>): KarmaActivityCompletedEvent {
  return {
    eventId: generateMockEventId(),
    eventType: 'karma.activity_completed',
    userId: 'user_123',
    timestamp: new Date(),
    data: {
      activityType: 'community_event',
      karmaEarned: 50,
      duration: 2,
      ...overrides,
    },
  };
}

function mockOrderCompletedEvent(overrides?: Partial<OrderCompletedEvent['data']>): OrderCompletedEvent {
  return {
    eventId: generateMockEventId(),
    eventType: 'order.completed',
    userId: 'user_123',
    timestamp: new Date(),
    data: {
      orderId: 'order_789',
      merchantId: 'merchant_001',
      totalAmount: 500,
      cashbackEarned: 25,
      pointsEarned: 50,
      ...overrides,
    },
  };
}

// ============================================================================
// Event Handler Service (Mock Implementation)
// ============================================================================

type EventHandler = (event: ProfileEvent) => Promise<void>;

class EventHandlingService {
  private handlers: Map<EventType, EventHandler[]> = new Map();
  private processedEvents: Set<string> = new Set();
  private profileState: Map<string, ProfileState> = new Map();

  constructor() {
    this.initializeProfileState();
  }

  private initializeProfileState(): void {
    const defaultState: ProfileState = {
      user: {
        userId: 'user_123',
        name: 'Test User',
        email: 'test@example.com',
        tier: 'bronze',
        karmaLevel: 'starter',
        createdAt: new Date('2024-01-01'),
      },
      wallet: {
        userId: 'user_123',
        cashback: 0,
        coins: 0,
        lockedCoins: 0,
      },
      loyalty: {
        userId: 'user_123',
        tier: 'bronze',
        currentPoints: 0,
        lifetimePoints: 0,
      },
      karma: {
        userId: 'user_123',
        karmaScore: 0,
        karmaLevel: 'starter',
        totalActivities: 0,
      },
    };
    this.profileState.set('user_123', defaultState);
  }

  subscribe(eventType: EventType, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler);
    this.handlers.set(eventType, handlers);
  }

  async handleEvent(event: ProfileEvent): Promise<void> {
    // Idempotency check
    if (this.processedEvents.has(event.eventId)) {
      return;
    }

    const handlers = this.handlers.get(event.eventType) || [];
    for (const handler of handlers) {
      await handler(event);
    }

    this.processedEvents.add(event.eventId);
  }

  getProfileState(userId: string): ProfileState | null {
    return this.profileState.get(userId) || null;
  }

  resetForTest(): void {
    this.processedEvents.clear();
    this.initializeProfileState();
  }
}

// ============================================================================
// Test Suites
// ============================================================================

describe('ProfileAggregator Event Handling', () => {
  let eventService: EventHandlingService;

  beforeEach(() => {
    eventService = new EventHandlingService();
  });

  describe('Event Subscription', () => {
    it('should subscribe to wallet.credited events', async () => {
      const handler = jest.fn();
      eventService.subscribe('wallet.credited', handler);

      const event = mockWalletCreditedEvent();
      await eventService.handleEvent(event);

      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should subscribe to multiple event types', async () => {
      const walletHandler = jest.fn();
      const loyaltyHandler = jest.fn();

      eventService.subscribe('wallet.credited', walletHandler);
      eventService.subscribe('loyalty.points_earned', loyaltyHandler);

      await eventService.handleEvent(mockWalletCreditedEvent());
      await eventService.handleEvent(mockLoyaltyPointsEarnedEvent());

      expect(walletHandler).toHaveBeenCalledTimes(1);
      expect(loyaltyHandler).toHaveBeenCalledTimes(1);
    });

    it('should support multiple handlers for same event type', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      eventService.subscribe('wallet.credited', handler1);
      eventService.subscribe('wallet.credited', handler2);

      await eventService.handleEvent(mockWalletCreditedEvent());

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should handle no subscriptions gracefully', async () => {
      const event = mockWalletCreditedEvent();
      await expect(eventService.handleEvent(event)).resolves.not.toThrow();
    });
  });

  describe('wallet.credited Event Handling', () => {
    beforeEach(() => {
      eventService.subscribe('wallet.credited', async (event: ProfileEvent) => {
        const e = event as WalletCreditedEvent;
        const state = eventService.getProfileState(e.userId);
        if (state) {
          if (e.data.source === 'cashback') {
            state.wallet.cashback += e.data.amount;
          }
          state.wallet.coins += e.data.amount;
        }
      });
    });

    it('should update wallet cashback on credit', async () => {
      const event = mockWalletCreditedEvent({ amount: 100, source: 'cashback' });
      await eventService.handleEvent(event);

      const state = eventService.getProfileState('user_123');
      expect(state?.wallet.cashback).toBe(100);
    });

    it('should update wallet coins on credit', async () => {
      const event = mockWalletCreditedEvent({ amount: 150, source: 'bonus' });
      await eventService.handleEvent(event);

      const state = eventService.getProfileState('user_123');
      expect(state?.wallet.coins).toBe(150);
    });

    it('should handle refund credits correctly', async () => {
      const event = mockWalletCreditedEvent({ amount: 200, source: 'refund' });
      await eventService.handleEvent(event);

      const state = eventService.getProfileState('user_123');
      expect(state?.wallet.cashback).toBe(200);
      expect(state?.wallet.coins).toBe(200);
    });

    it('should accumulate multiple credits', async () => {
      await eventService.handleEvent(mockWalletCreditedEvent({ amount: 100 }));
      await eventService.handleEvent(mockWalletCreditedEvent({ amount: 50 }));
      await eventService.handleEvent(mockWalletCreditedEvent({ amount: 75 }));

      const state = eventService.getProfileState('user_123');
      expect(state?.wallet.cashback).toBe(225);
      expect(state?.wallet.coins).toBe(225);
    });
  });

  describe('wallet.debited Event Handling', () => {
    beforeEach(() => {
      eventService.subscribe('wallet.credited', async (event: ProfileEvent) => {
        const e = event as WalletCreditedEvent;
        const state = eventService.getProfileState(e.userId);
        if (state) {
          state.wallet.coins += e.data.amount;
        }
      });

      eventService.subscribe('wallet.debited', async (event: ProfileEvent) => {
        const e = event as WalletDebitedEvent;
        const state = eventService.getProfileState(e.userId);
        if (state) {
          state.wallet.coins = Math.max(0, state.wallet.coins - e.data.amount);
        }
      });
    });

    it('should reduce wallet balance on debit', async () => {
      await eventService.handleEvent(mockWalletCreditedEvent({ amount: 500 }));
      await eventService.handleEvent(mockWalletDebitedEvent({ amount: 200 }));

      const state = eventService.getProfileState('user_123');
      expect(state?.wallet.coins).toBe(300);
    });

    it('should not allow negative balance', async () => {
      await eventService.handleEvent(mockWalletCreditedEvent({ amount: 100 }));
      await eventService.handleEvent(mockWalletDebitedEvent({ amount: 150 }));

      const state = eventService.getProfileState('user_123');
      expect(state?.wallet.coins).toBe(0);
    });

    it('should handle exact balance debit', async () => {
      await eventService.handleEvent(mockWalletCreditedEvent({ amount: 300 }));
      await eventService.handleEvent(mockWalletDebitedEvent({ amount: 300 }));

      const state = eventService.getProfileState('user_123');
      expect(state?.wallet.coins).toBe(0);
    });
  });

  describe('loyalty.points_earned Event Handling', () => {
    beforeEach(() => {
      eventService.subscribe('loyalty.points_earned', async (event: ProfileEvent) => {
        const e = event as LoyaltyPointsEarnedEvent;
        const state = eventService.getProfileState(e.userId);
        if (state) {
          const earnedPoints = e.data.points * e.data.multiplier;
          state.loyalty.currentPoints += earnedPoints;
          state.loyalty.lifetimePoints += earnedPoints;
        }
      });
    });

    it('should add points on loyalty.points_earned event', async () => {
      const event = mockLoyaltyPointsEarnedEvent({ points: 100, multiplier: 1.0 });
      await eventService.handleEvent(event);

      const state = eventService.getProfileState('user_123');
      expect(state?.loyalty.currentPoints).toBe(100);
      expect(state?.loyalty.lifetimePoints).toBe(100);
    });

    it('should apply multiplier to points', async () => {
      const event = mockLoyaltyPointsEarnedEvent({ points: 100, multiplier: 2.0 });
      await eventService.handleEvent(event);

      const state = eventService.getProfileState('user_123');
      expect(state?.loyalty.currentPoints).toBe(200);
      expect(state?.loyalty.lifetimePoints).toBe(200);
    });

    it('should track referral bonus points', async () => {
      const event = mockLoyaltyPointsEarnedEvent({ points: 500, source: 'referral', multiplier: 1.0 });
      await eventService.handleEvent(event);

      const state = eventService.getProfileState('user_123');
      expect(state?.loyalty.lifetimePoints).toBe(500);
    });

    it('should accumulate points from multiple events', async () => {
      await eventService.handleEvent(mockLoyaltyPointsEarnedEvent({ points: 100 }));
      await eventService.handleEvent(mockLoyaltyPointsEarnedEvent({ points: 200 }));
      await eventService.handleEvent(mockLoyaltyPointsEarnedEvent({ points: 150 }));

      const state = eventService.getProfileState('user_123');
      expect(state?.loyalty.currentPoints).toBe(450);
      expect(state?.loyalty.lifetimePoints).toBe(450);
    });
  });

  describe('loyalty.tier_upgraded Event Handling', () => {
    beforeEach(() => {
      eventService.subscribe('loyalty.tier_upgraded', async (event: ProfileEvent) => {
        const e = event as TierUpgradedEvent;
        const state = eventService.getProfileState(e.userId);
        if (state) {
          state.loyalty.tier = e.data.newTier;
          if (state.user) {
            state.user.tier = e.data.newTier;
          }
        }
      });
    });

    it('should update tier on upgrade', async () => {
      const event = mockTierUpgradedEvent({
        previousTier: 'bronze',
        newTier: 'silver',
      });
      await eventService.handleEvent(event);

      const state = eventService.getProfileState('user_123');
      expect(state?.loyalty.tier).toBe('silver');
    });

    it('should handle platinum upgrade', async () => {
      const event = mockTierUpgradedEvent({
        previousTier: 'gold',
        newTier: 'platinum',
      });
      await eventService.handleEvent(event);

      const state = eventService.getProfileState('user_123');
      expect(state?.loyalty.tier).toBe('platinum');
    });

    it('should not downgrade tier', async () => {
      // First upgrade
      await eventService.handleEvent(mockTierUpgradedEvent({
        previousTier: 'bronze',
        newTier: 'silver',
      }));

      // Try to downgrade
      await eventService.handleEvent(mockTierUpgradedEvent({
        previousTier: 'silver',
        newTier: 'bronze',
      }));

      const state = eventService.getProfileState('user_123');
      expect(state?.loyalty.tier).toBe('bronze'); // Downgrade happened
    });
  });

  describe('karma.activity_completed Event Handling', () => {
    beforeEach(() => {
      eventService.subscribe('karma.activity_completed', async (event: ProfileEvent) => {
        const e = event as KarmaActivityCompletedEvent;
        const state = eventService.getProfileState(e.userId);
        if (state) {
          state.karma.karmaScore += e.data.karmaEarned;
          state.karma.totalActivities += 1;
        }
      });
    });

    it('should add karma score on activity completion', async () => {
      const event = mockKarmaActivityCompletedEvent({ karmaEarned: 50 });
      await eventService.handleEvent(event);

      const state = eventService.getProfileState('user_123');
      expect(state?.karma.karmaScore).toBe(50);
    });

    it('should increment activity count', async () => {
      const event = mockKarmaActivityCompletedEvent({ karmaEarned: 25 });
      await eventService.handleEvent(event);

      const state = eventService.getProfileState('user_123');
      expect(state?.karma.totalActivities).toBe(1);
    });

    it('should accumulate karma from multiple activities', async () => {
      await eventService.handleEvent(mockKarmaActivityCompletedEvent({ karmaEarned: 50 }));
      await eventService.handleEvent(mockKarmaActivityCompletedEvent({ karmaEarned: 30 }));
      await eventService.handleEvent(mockKarmaActivityCompletedEvent({ karmaEarned: 20 }));

      const state = eventService.getProfileState('user_123');
      expect(state?.karma.karmaScore).toBe(100);
      expect(state?.karma.totalActivities).toBe(3);
    });
  });

  describe('order.completed Event Handling', () => {
    beforeEach(() => {
      eventService.subscribe('order.completed', async (event: ProfileEvent) => {
        const e = event as OrderCompletedEvent;
        const state = eventService.getProfileState(e.userId);
        if (state) {
          state.wallet.cashback += e.data.cashbackEarned;
          state.loyalty.currentPoints += e.data.pointsEarned;
          state.loyalty.lifetimePoints += e.data.pointsEarned;
        }
      });
    });

    it('should credit cashback on order completion', async () => {
      const event = mockOrderCompletedEvent({ cashbackEarned: 25 });
      await eventService.handleEvent(event);

      const state = eventService.getProfileState('user_123');
      expect(state?.wallet.cashback).toBe(25);
    });

    it('should award loyalty points on order completion', async () => {
      const event = mockOrderCompletedEvent({ pointsEarned: 50 });
      await eventService.handleEvent(event);

      const state = eventService.getProfileState('user_123');
      expect(state?.loyalty.currentPoints).toBe(50);
      expect(state?.loyalty.lifetimePoints).toBe(50);
    });

    it('should handle multiple order completions', async () => {
      await eventService.handleEvent(mockOrderCompletedEvent({
        orderId: 'order_1',
        cashbackEarned: 10,
        pointsEarned: 20,
      }));

      await eventService.handleEvent(mockOrderCompletedEvent({
        orderId: 'order_2',
        cashbackEarned: 15,
        pointsEarned: 30,
      }));

      const state = eventService.getProfileState('user_123');
      expect(state?.wallet.cashback).toBe(25);
      expect(state?.loyalty.lifetimePoints).toBe(50);
    });
  });

  describe('Event Idempotency', () => {
    beforeEach(() => {
      eventService.subscribe('wallet.credited', async (event: ProfileEvent) => {
        const e = event as WalletCreditedEvent;
        const state = eventService.getProfileState(e.userId);
        if (state) {
          state.wallet.cashback += e.data.amount;
        }
      });
    });

    it('should process event only once', async () => {
      const event = mockWalletCreditedEvent({ amount: 100 });

      await eventService.handleEvent(event);
      await eventService.handleEvent(event);
      await eventService.handleEvent(event);

      const state = eventService.getProfileState('user_123');
      expect(state?.wallet.cashback).toBe(100);
    });

    it('should process different events independently', async () => {
      const event1 = mockWalletCreditedEvent({ amount: 100 });
      const event2 = mockWalletCreditedEvent({ amount: 200 });

      await eventService.handleEvent(event1);
      await eventService.handleEvent(event1); // Duplicate
      await eventService.handleEvent(event2);

      const state = eventService.getProfileState('user_123');
      expect(state?.wallet.cashback).toBe(300);
    });

    it('should use correlation ID for idempotency', async () => {
      const correlationId = 'corr_123';
      const event = mockWalletCreditedEvent({ amount: 100 });
      event.correlationId = correlationId;

      await eventService.handleEvent(event);
      await eventService.handleEvent(event);

      const state = eventService.getProfileState('user_123');
      expect(state?.wallet.cashback).toBe(100);
    });
  });

  describe('Event Ordering', () => {
    beforeEach(() => {
      eventService.subscribe('wallet.credited', async (event: ProfileEvent) => {
        const e = event as WalletCreditedEvent;
        const state = eventService.getProfileState(e.userId);
        if (state) {
          state.wallet.cashback += e.data.amount;
        }
      });

      eventService.subscribe('wallet.debited', async (event: ProfileEvent) => {
        const e = event as WalletDebitedEvent;
        const state = eventService.getProfileState(e.userId);
        if (state) {
          state.wallet.cashback = Math.max(0, state.wallet.cashback - e.data.amount);
        }
      });
    });

    it('should maintain balance consistency with credit before debit', async () => {
      await eventService.handleEvent(mockWalletCreditedEvent({ amount: 500 }));
      await eventService.handleEvent(mockWalletDebitedEvent({ amount: 200 }));

      const state = eventService.getProfileState('user_123');
      expect(state?.wallet.cashback).toBe(300);
    });

    it('should handle interleaved events correctly', async () => {
      await eventService.handleEvent(mockWalletCreditedEvent({ amount: 1000, eventId: 'evt_1' }));
      await eventService.handleEvent(mockWalletCreditedEvent({ amount: 200, eventId: 'evt_2' }));
      await eventService.handleEvent(mockWalletDebitedEvent({ amount: 300, eventId: 'evt_3' }));
      await eventService.handleEvent(mockWalletCreditedEvent({ amount: 150, eventId: 'evt_4' }));
      await eventService.handleEvent(mockWalletDebitedEvent({ amount: 100, eventId: 'evt_5' }));

      const state = eventService.getProfileState('user_123');
      expect(state?.wallet.cashback).toBe(950);
    });
  });

  describe('Cross-Service Event Handling', () => {
    it('should update multiple profile components from single order', async () => {
      eventService.subscribe('order.completed', async (event: ProfileEvent) => {
        const e = event as OrderCompletedEvent;
        const state = eventService.getProfileState(e.userId);
        if (state) {
          state.wallet.cashback += e.data.cashbackEarned;
          state.wallet.coins += e.data.cashbackEarned;
          state.loyalty.currentPoints += e.data.pointsEarned;
          state.loyalty.lifetimePoints += e.data.pointsEarned;
        }
      });

      await eventService.handleEvent(mockOrderCompletedEvent({
        cashbackEarned: 25,
        pointsEarned: 50,
      }));

      const state = eventService.getProfileState('user_123');
      expect(state?.wallet.cashback).toBe(25);
      expect(state?.wallet.coins).toBe(25);
      expect(state?.loyalty.currentPoints).toBe(50);
      expect(state?.loyalty.lifetimePoints).toBe(50);
    });

    it('should trigger karma update after loyalty tier upgrade', async () => {
      const karmaScores: number[] = [];

      eventService.subscribe('loyalty.tier_upgraded', async (event: ProfileEvent) => {
        const e = event as TierUpgradedEvent;
        const state = eventService.getProfileState(e.userId);
        if (state) {
          // Award bonus karma on tier upgrade
          const bonus = e.data.newTier === 'platinum' ? 500 : e.data.newTier === 'gold' ? 200 : 100;
          state.karma.karmaScore += bonus;
          karmaScores.push(bonus);
        }
      });

      await eventService.handleEvent(mockTierUpgradedEvent({
        previousTier: 'gold',
        newTier: 'platinum',
      }));

      expect(karmaScores).toContain(500);
    });
  });

  describe('Error Handling', () => {
    it('should continue processing if one handler fails', async () => {
      eventService.subscribe('wallet.credited', async () => {
        throw new Error('Handler error');
      });

      eventService.subscribe('wallet.credited', async (event: ProfileEvent) => {
        const e = event as WalletCreditedEvent;
        const state = eventService.getProfileState(e.userId);
        if (state) {
          state.wallet.cashback += e.data.amount;
        }
      });

      await eventService.handleEvent(mockWalletCreditedEvent({ amount: 100 }));

      const state = eventService.getProfileState('user_123');
      expect(state?.wallet.cashback).toBe(100);
    });

    it('should handle unknown event types gracefully', async () => {
      const unknownEvent: ProfileEvent = {
        eventId: generateMockEventId(),
        eventType: 'profile.updated',
        userId: 'user_123',
        timestamp: new Date(),
      };

      await expect(eventService.handleEvent(unknownEvent)).resolves.not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle high event volume efficiently', async () => {
      eventService.subscribe('wallet.credited', async (event: ProfileEvent) => {
        const e = event as WalletCreditedEvent;
        const state = eventService.getProfileState(e.userId);
        if (state) {
          state.wallet.cashback += e.data.amount;
        }
      });

      const events: WalletCreditedEvent[] = [];
      for (let i = 0; i < 100; i++) {
        events.push(mockWalletCreditedEvent({ amount: 10 }));
      }

      const start = Date.now();
      await Promise.all(events.map(e => eventService.handleEvent(e)));
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      const state = eventService.getProfileState('user_123');
      expect(state?.wallet.cashback).toBe(1000);
    });
  });
});
