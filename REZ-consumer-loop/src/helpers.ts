import { TasteProfile, Recommendation, FlywheelStage, Event, Order } from './types.js';

export function generateMockRecommendations(
  tasteProfile: TasteProfile | undefined,
  currentMerchantId: string | undefined
): Recommendation[] {
  if (!tasteProfile) return [];

  const merchants = Object.entries(tasteProfile.merchants || {})
    .filter(([id]) => id !== currentMerchantId)
    .sort((a, b) => b[1].visits - a[1].visits)
    .slice(0, 3)
    .map(([id, data]) => ({
      merchantId: id,
      visits: data.visits,
      affinity: Math.min(100, data.visits * 20),
    }));

  return merchants;
}

export function determineFlywheelStage(events: Event[], orders: Order[]): FlywheelStage {
  const recentEvents = events.slice(-10);
  const hasRecentOrder = orders.length > 0;

  if (!hasRecentOrder && recentEvents.some((e) => e.type === 'qr_scan')) {
    return FlywheelStage.DISCOVERY;
  }
  if (recentEvents.some((e) => e.type === 'browse')) {
    return FlywheelStage.CONSIDERATION;
  }
  if (hasRecentOrder) {
    return FlywheelStage.CONVERSION;
  }
  return FlywheelStage.IDLE;
}

export function calculateReorderWindow(daysSinceOrder: number): string {
  if (daysSinceOrder <= 3) return '1-3 days';
  if (daysSinceOrder <= 7) return '3-7 days';
  if (daysSinceOrder <= 14) return '7-14 days';
  if (daysSinceOrder <= 30) return '14-30 days';
  return '30+ days';
}
