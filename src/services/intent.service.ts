/**
 * Intent Pipeline - User Intent Tracking
 * REZ-Intelligence - Behavior + Signals
 */

interface IntentSignal {
  type: 'browse' | 'search' | 'purchase' | 'abandon' | 'refund';
  userId: string;
  itemId?: string;
  query?: string;
  timestamp: Date;
  metadata?: Record<string, string>;
}

/** Process intent signal */
export async function trackIntent(signal: IntentSignal): Promise<void> {
  await redis.lpush(`signals:${signal.userId}`, JSON.stringify(signal));
  await redis.ltrim(`signals:${signal.userId}`, 0, 999);
}

/** Get intent signals for user */
export async function getIntents(userId: string, limit = 100): Promise<IntentSignal[]> {
  const signals = await redis.lrange(`signals:${userId}`, 0, limit - 1);
  return signals.map(s => JSON.parse(s));
}

/** Predict intent from signals */
export async function predictIntent(userId: string): Promise<{ intent: string; confidence: number }> {
  const signals = await getIntents(userId, 50);
  if (signals.length === 0) {
    return { intent: 'browse', confidence: 0 };
  }

  // Simple intent detection
  const browse = signals.filter(s => s.type === 'browse').length;
  const purchase = signals.filter(s => s.type === 'purchase').length;
  const abandon = signals.filter(s => s.type === 'abandon').length;

  const total = signals.length;
  const browseScore = browse / total;
  const purchaseScore = purchase / total;
  const abandonScore = abandon / total;

  if (purchaseScore > 0.5) return { intent: 'purchase', confidence: purchaseScore };
  if (abandonScore > 0.3) return { intent: 'abandon', confidence: abandonScore };
  if (browseScore > 0.7) return { intent: 'browse', confidence: browseScore };

  return { intent: 'browse', confidence: 0.5 };
}
