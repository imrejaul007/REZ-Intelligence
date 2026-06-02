/**
 * Types
 */

export interface BaseEvent {
  eventId: string;
  eventType: string;
  userId: string;
  timestamp: Date;
  correlationId?: string;
  source: string;
  version: string;
  data: Record<string, any>;
}

export interface WalletEvent extends BaseEvent {
  eventType: 'wallet.credited' | 'wallet.debited';
  data: {
    userId: string;
    amount: number;
    coinType: string;
    source: string;
    balance?: number;
  };
}

export interface OrderEvent extends BaseEvent {
  eventType: 'order.completed';
  data: {
    orderId: string;
    userId: string;
    merchantId: string;
    amount: number;
    items: any[];
  };
}

export interface KarmaEvent extends BaseEvent {
  eventType: 'karma.earned';
  data: {
    userId: string;
    amount: number;
    source: string;
  };
}

export interface StreakEvent extends BaseEvent {
  eventType: 'streak.updated';
  data: {
    userId: string;
    current: number;
    longest: number;
  };
}

export interface AchievementEvent extends BaseEvent {
  eventType: 'achievement.unlocked';
  data: {
    userId: string;
    achievementId: string;
    name: string;
  };
}
