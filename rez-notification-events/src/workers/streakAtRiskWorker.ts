/**
 * Streak-at-Risk Scheduler Worker
 *
 * Runs a BullMQ repeatable job every day at 7pm (local server time).
 * Queries MongoDB userstreaks for users who had a store_visit streak
 * yesterday but have NOT visited today, then enqueues a push + in_app
 * notification for each at-risk user.
 */

import { Queue, Worker, Job } from 'bullmq';
import mongoose from 'mongoose';
import { bullmqRedis } from '../config/redis';
import { createServiceLogger } from '../config/logger';

const logger = createServiceLogger('streak-at-risk-worker');

const NOTIF_QUEUE_NAME = 'notification-events';
const SCHEDULER_QUEUE  = 'streak-at-risk-scheduler';

// BAK-NOTIF-003: Latent SSRF risk guard.
// Any future channel handler that fetches from a URL must validate against this allowlist
// to prevent attackers from smuggling internal network requests (localhost, 169.254.169.254,
// private IPs, etc.) through notification event payloads.
const ALLOWED_NOTIFICATION_URL_HOSTS = (
  process.env.ALLOWED_NOTIFICATION_URL_HOSTS || 'api.rez.money,notify.rez.money'
).split(',');

/**
 * Validates that a URL resolves to an allowed host over HTTPS.
 * Call this in every channel handler before issuing a fetch() to a user-supplied URL.
 */
function isNotificationUrlAllowed(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return ALLOWED_NOTIFICATION_URL_HOSTS.includes(parsed.host);
  } catch {
    return false;
  }
}

let _schedulerQueue: Queue | null = null;
let _worker: Worker | null = null;

function getNotifQueue(): Queue {
  if (!_schedulerQueue) {
    _schedulerQueue = new Queue(NOTIF_QUEUE_NAME, { connection: bullmqRedis });
  }
  return _schedulerQueue;
}

function toDateString(d: Date): string {
  return d.toISOString().split('T')[0];
}

/**
 * Find all users who had a store_visit streak active as of yesterday
 * but have NOT visited today, meaning today's date is not their lastActivityDate.
 */
async function findStreakAtRiskUsers(): Promise<Array<{ userId: string; currentStreak: number }>> {
  const UserStreaks = mongoose.connection.collection('userstreaks');

  const today     = toDateString(new Date());
  const yesterday = toDateString(new Date(Date.now() - 86_400_000));

  // Users with store_visit streak whose lastActivityDate is exactly yesterday
  // (they visited yesterday but not yet today — streak is at risk).
  const atRiskDocs = await UserStreaks.find(
    {
      type: 'store_visit',
      currentStreak: { $gte: 1 },
      lastActivityDate: yesterday,
    },
    { projection: { userId: 1, currentStreak: 1 } },
  ).toArray();

  return atRiskDocs.map((d: any) => ({
    userId: String(d.userId),
    currentStreak: Number(d.currentStreak),
  }));
}

async function runStreakAtRiskCheck(): Promise<{ notified: number }> {
  const atRiskUsers = await findStreakAtRiskUsers();

  if (atRiskUsers.length === 0) {
    logger.info('[StreakAtRisk] No at-risk users found');
    return { notified: 0 };
  }

  logger.info(`[StreakAtRisk] Found ${atRiskUsers.length} at-risk users — enqueuing notifications`);

  const notifQueue = getNotifQueue();

  // Bulk add in batches of 100 to avoid overwhelming the queue in one shot
  const BATCH = 100;
  for (let i = 0; i < atRiskUsers.length; i += BATCH) {
    const batch = atRiskUsers.slice(i, i + BATCH);
    const jobs = batch.map(({ userId, currentStreak }) => ({
      name: 'streak_at_risk',
      data: {
        eventId: `streak-at-risk-${userId}-${new Date().toISOString().split('T')[0]}`,
        eventType: 'streak_at_risk',
        userId,
        channels: ['push', 'in_app'] as Array<'push' | 'in_app'>,
        payload: {
          title: 'Don\'t break your streak!',
          body: `Don't break your ${currentStreak}-day streak! Visit any store today.`,
          channelId: 'streaks',
          priority: 'high',
          data: { currentStreak },
        },
        category: 'behavioral',
        source: 'streak-at-risk-scheduler',
        createdAt: new Date().toISOString(),
      },
      opts: {
        jobId: `streak-at-risk:${userId}:${new Date().toISOString().split('T')[0]}`,
        attempts: 3,
        backoff: { type: 'exponential' as const, delay: 5000 },
      },
    }));
    await notifQueue.addBulk(jobs);
  }

  logger.info(`[StreakAtRisk] Enqueued ${atRiskUsers.length} notifications`);
  return { notified: atRiskUsers.length };
}

/**
 * Start the scheduler: registers a BullMQ repeatable job that fires every day
 * at 19:00 (7pm) UTC. A lightweight worker processes it immediately.
 */
export async function startStreakAtRiskScheduler(): Promise<void> {
  const schedulerQueue = new Queue(SCHEDULER_QUEUE, { connection: bullmqRedis });

  // Register the repeatable job (idempotent — same jobId won't be duplicated)
  await schedulerQueue.upsertJobScheduler(
    'streak-at-risk-daily',
    { pattern: '0 19 * * *' }, // 7pm UTC every day
    {
      name: 'streak_at_risk_check',
      data: {},
      opts: { attempts: 2, backoff: { type: 'exponential', delay: 10_000 } },
    },
  );

  logger.info('[StreakAtRisk] Repeatable job registered — cron: 0 19 * * *');

  // Worker that processes the scheduled trigger
  _worker = new Worker(
    SCHEDULER_QUEUE,
    async (_job: Job) => {
      logger.info('[StreakAtRisk] Daily check triggered');
      const result = await runStreakAtRiskCheck();
      return result;
    },
    {
      connection: bullmqRedis,
      concurrency: 1,
    },
  );

  _worker.on('completed', (job, result) => {
    logger.info('[StreakAtRisk] Daily check completed', { result });
  });

  _worker.on('failed', (job, err) => {
    logger.error('[StreakAtRisk] Daily check failed', { error: err.message });
  });

  _worker.on('error', (err) => {
    logger.error('[StreakAtRisk] Worker error', { error: err.message });
  });

  logger.info('[StreakAtRisk] Scheduler started');
}

export async function stopStreakAtRiskScheduler(): Promise<void> {
  if (_worker) {
    await _worker.close();
    _worker = null;
  }
  if (_schedulerQueue) {
    await _schedulerQueue.close();
    _schedulerQueue = null;
  }
}
