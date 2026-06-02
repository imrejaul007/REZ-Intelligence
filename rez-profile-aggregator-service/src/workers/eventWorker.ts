/**
 * Event Worker
 *
 * Handles events from Redis pub/sub
 */

import { subscriber } from '../config/redis';
import { ProfileAggregator } from '../services/ProfileAggregator';

const aggregator = new ProfileAggregator();

const EVENTS = {
  WALLET_CREDITED: 'wallet.credited',
  WALLET_DEBITED: 'wallet.debited',
  ORDER_COMPLETED: 'order.completed',
  KARMA_EARNED: 'karma.earned',
  STREAK_UPDATED: 'streak.updated',
  ACHIEVEMENT_UNLOCKED: 'achievement.unlocked',
  BADGE_EARNED: 'badge.earned',
};

export async function startEventWorker(aggregator: ProfileAggregator): Promise<void> {
  // Subscribe to all loyalty events
  await subscriber.subscribe(
    EVENTS.WALLET_CREDITED,
    EVENTS.WALLET_DEBITED,
    EVENTS.ORDER_COMPLETED,
    EVENTS.KARMA_EARNED,
    EVENTS.STREAK_UPDATED,
    EVENTS.ACHIEVEMENT_UNLOCKED,
    EVENTS.BADGE_EARNED
  );

  subscriber.on('message', async (channel: string, message: string) => {
    try {
      const data = JSON.parse(message);
      console.log(`Received event: ${channel}`, data);

      switch (channel) {
        case EVENTS.WALLET_CREDITED:
        case EVENTS.WALLET_DEBITED:
          await aggregator.handleWalletEvent(data.userId, data);
          break;

        case EVENTS.ORDER_COMPLETED:
          await aggregator.handleOrderCompleted(data.userId, data);
          break;

        case EVENTS.KARMA_EARNED:
          await aggregator.handleKarmaEarned(data.userId, data);
          break;

        case EVENTS.STREAK_UPDATED:
          await aggregator.handleStreakUpdated(data.userId, data);
          break;

        case EVENTS.ACHIEVEMENT_UNLOCKED:
          await aggregator.handleAchievementUnlocked(data.userId, data);
          break;

        case EVENTS.BADGE_EARNED:
          await aggregator.handleBadgeEarned(data.userId, data);
          break;

        default:
          console.log(`Unknown event: ${channel}`);
      }
    } catch (error) {
      console.error(`Error handling event ${channel}:`, error);
    }
  });

  console.log('Event worker started, listening for events...');
}
