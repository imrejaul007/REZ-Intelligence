/**
 * Marketing Routes — REZ Notification Service
 *
 * HTTP API endpoints for receiving marketing notification events
 * from the REZ Marketing Service.
 *
 * Routes:
 *   POST /api/marketing/campaign  - Trigger campaign notification
 *   POST /api/marketing/voucher     - Trigger voucher notification
 *   POST /api/marketing/broadcast   - Trigger broadcast notification
 *   POST /api/marketing/audience/sync - Sync audience notification preferences
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { Queue } from 'bullmq';
import { bullmqRedis } from '../config/redis';
import { createServiceLogger } from '../config/logger';
import mongoose from 'mongoose';

const logger = createServiceLogger('marketing-routes');
const router = Router();

// ── Queue reference ─────────────────────────────────────────────────────────────

const NOTIF_QUEUE_NAME = 'notification-events';

function getNotifQueue(): Queue {
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  if (!_notifQueue) {
    _notifQueue = new Queue(NOTIF_QUEUE_NAME, {
      connection: bullmqRedis,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
      },
    });
  }
  return _notifQueue;
}

let _notifQueue: Queue | null = null;

// Note: Authentication is handled by the middleware in index.ts before routes are mounted.
// Auth is enforced at the /api/marketing router level, not per-route.

// ── Validation helpers ─────────────────────────────────────────────────────────

function isValidObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id) && id.length === 24;
}

// ── Campaign Notification ─────────────────────────────────────────────────────

interface CampaignEvent {
  eventId: string;
  eventType: string;
  channels: string[];
  payload: {
    title: string;
    body: string;
    channelId?: string;
    priority?: string;
    data?: {
      campaignId?: string;
      merchantId?: string;
      audienceType?: string;
      audienceCount?: number;
      imageUrl?: string;
      ctaUrl?: string;
      ctaText?: string;
      targetUserIds?: string[];
    };
  };
  category?: string;
  source?: string;
  createdAt: string;
}

/**
 * POST /api/marketing/campaign
 *
 * Trigger push notification to targeted users when a campaign is created/launched.
 * Enqueues individual notification jobs for each target user.
 */
router.post('/campaign', async (req: Request, res: Response) => {
  const event = req.body as CampaignEvent;

  if (!event.eventId || !event.eventType || !event.channels || !event.payload) {
    res.status(400).json({ error: 'Missing required fields: eventId, eventType, channels, payload' });
    return;
  }

  if (!event.payload.title || !event.payload.body) {
    res.status(400).json({ error: 'Missing required payload fields: title, body' });
    return;
  }

  const payloadData = event.payload.data || {};
  const targetUserIds = payloadData.targetUserIds || [];
  const campaignId = payloadData.campaignId || event.eventId;

  logger.info('[Marketing] Processing campaign notification', {
    eventId: event.eventId,
    campaignId,
    channelCount: event.channels.length,
    targetUserCount: targetUserIds.length,
  });

  const notifQueue = getNotifQueue();
  const channels = event.channels as Array<'push' | 'email' | 'sms' | 'whatsapp' | 'in_app'>;

  try {
    // Enqueue campaign notification jobs for each target user
    if (targetUserIds.length > 0) {
      const jobs = targetUserIds.map((userId) => ({
        name: 'marketing_campaign',
        data: {
          eventId: `${event.eventId}-${userId}`,
          eventType: event.eventType,
          userId,
          channels,
          payload: {
            title: event.payload.title,
            body: event.payload.body,
            channelId: event.payload.channelId || 'marketing',
            priority: event.payload.priority || 'default',
            data: {
              ...payloadData,
              campaignId,
            },
          },
          category: event.category || 'marketing',
          source: event.source || 'rez-marketing-service',
          createdAt: event.createdAt || new Date().toISOString(),
        },
        opts: {
          jobId: `campaign:${campaignId}:${userId}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
      }));

      await notifQueue.addBulk(jobs);
    } else {
      // No target users specified — enqueue a single job with no user (for segment-based lookup)
      await notifQueue.add('marketing_campaign', {
        eventId: event.eventId,
        eventType: event.eventType,
        channels,
        payload: {
          title: event.payload.title,
          body: event.payload.body,
          channelId: event.payload.channelId || 'marketing',
          priority: event.payload.priority || 'default',
          data: payloadData,
        },
        category: event.category || 'marketing',
        source: event.source || 'rez-marketing-service',
        createdAt: event.createdAt || new Date().toISOString(),
      }, {
        jobId: `campaign:${campaignId}:single`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      });
    }

    logger.info('[Marketing] Campaign notification enqueued', {
      eventId: event.eventId,
      campaignId,
      targetUserCount: targetUserIds.length,
    });

    res.json({
      success: true,
      eventId: event.eventId,
      campaignId,
      enqueued: targetUserIds.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[Marketing] Failed to enqueue campaign notification', {
      eventId: event.eventId,
      error: message,
    });
    res.status(500).json({ error: 'Failed to enqueue notification', details: message });
  }
});

// ── Voucher Notification ────────────────────────────────────────────────────────

interface VoucherEvent {
  eventId: string;
  eventType: string;
  userId?: string;
  channels: string[];
  payload: {
    title: string;
    body: string;
    channelId?: string;
    priority?: string;
    smsMessage?: string;
    emailSubject?: string;
    emailHtml?: string;
    data?: {
      voucherId?: string;
      voucherCode?: string;
      voucherType?: string;
      voucherValue?: number;
      merchantId?: string;
      validUntil?: string;
      email?: string;
      phone?: string;
    };
  };
  category?: string;
  source?: string;
  createdAt: string;
}

/**
 * POST /api/marketing/voucher
 *
 * Trigger SMS/Email notification with voucher code.
 * Used when a voucher is generated and needs to be delivered to a user.
 */
router.post('/voucher', async (req: Request, res: Response) => {
  const event = req.body as VoucherEvent;

  if (!event.eventId || !event.eventType || !event.channels) {
    res.status(400).json({ error: 'Missing required fields: eventId, eventType, channels' });
    return;
  }

  if (!event.userId && !event.payload.data?.email && !event.payload.data?.phone) {
    res.status(400).json({ error: 'Must provide userId or email/phone in payload.data' });
    return;
  }

  const payloadData = event.payload.data || {};
  const voucherId = payloadData.voucherId || event.eventId;
  const voucherCode = payloadData.voucherCode || 'N/A';

  logger.info('[Marketing] Processing voucher notification', {
    eventId: event.eventId,
    voucherId,
    voucherCode,
    channels: event.channels,
  });

  const notifQueue = getNotifQueue();
  const channels = event.channels as Array<'push' | 'email' | 'sms' | 'whatsapp' | 'in_app'>;

  // Ensure we have a userId for the job
  const userId = event.userId || payloadData.email || payloadData.phone || 'unknown';

  try {
    await notifQueue.add('marketing_voucher', {
      eventId: event.eventId,
      eventType: event.eventType,
      userId,
      channels,
      payload: {
        title: event.payload.title,
        body: event.payload.body,
        channelId: event.payload.channelId || 'vouchers',
        priority: event.payload.priority || 'default',
        smsMessage: event.payload.smsMessage,
        emailSubject: event.payload.emailSubject,
        emailHtml: event.payload.emailHtml,
        data: {
          ...payloadData,
          voucherId,
          voucherCode,
        },
      },
      category: event.category || 'marketing',
      source: event.source || 'rez-marketing-service',
      createdAt: event.createdAt || new Date().toISOString(),
    }, {
      jobId: `voucher:${voucherId}:${userId}`,
      attempts: 5,
      backoff: { type: 'exponential', delay: 3000 },
    });

    logger.info('[Marketing] Voucher notification enqueued', {
      eventId: event.eventId,
      voucherId,
      voucherCode,
      userId,
    });

    res.json({
      success: true,
      eventId: event.eventId,
      voucherId,
      voucherCode,
      userId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[Marketing] Failed to enqueue voucher notification', {
      eventId: event.eventId,
      voucherId,
      error: message,
    });
    res.status(500).json({ error: 'Failed to enqueue notification', details: message });
  }
});

// ── Broadcast Notification ─────────────────────────────────────────────────────

interface BroadcastEvent {
  eventId: string;
  eventType: string;
  userIds?: string[];
  channels: string[];
  payload: {
    title: string;
    body: string;
    channelId?: string;
    priority?: string;
    data?: {
      broadcastId?: string;
      merchantId?: string;
      audienceSegment?: string;
      targetUserCount?: number;
      scheduledAt?: string;
    };
  };
  category?: string;
  source?: string;
  createdAt: string;
}

/**
 * POST /api/marketing/broadcast
 *
 * Trigger broadcast notification to audience segments.
 * Enqueues individual notification jobs for each target user.
 */
router.post('/broadcast', async (req: Request, res: Response) => {
  const event = req.body as BroadcastEvent;

  if (!event.eventId || !event.eventType || !event.channels) {
    res.status(400).json({ error: 'Missing required fields: eventId, eventType, channels' });
    return;
  }

  if (!event.payload?.title || !event.payload?.body) {
    res.status(400).json({ error: 'Missing required payload fields: title, body' });
    return;
  }

  if (!event.userIds || event.userIds.length === 0) {
    res.status(400).json({ error: 'userIds array is required and must not be empty' });
    return;
  }

  const payloadData = event.payload.data || {};
  const broadcastId = payloadData.broadcastId || event.eventId;

  logger.info('[Marketing] Processing broadcast notification', {
    eventId: event.eventId,
    broadcastId,
    targetUserCount: event.userIds.length,
    channelCount: event.channels.length,
  });

  const notifQueue = getNotifQueue();
  const channels = event.channels as Array<'push' | 'email' | 'sms' | 'whatsapp' | 'in_app'>;

  // Enqueue in batches to avoid overwhelming the queue
  const BATCH_SIZE = 100;
  let enqueuedCount = 0;
  const errors: string[] = [];

  try {
    for (let i = 0; i < event.userIds.length; i += BATCH_SIZE) {
      const batch = event.userIds.slice(i, i + BATCH_SIZE);
      const jobs = batch.map((userId) => ({
        name: 'marketing_broadcast',
        data: {
          eventId: `${event.eventId}-${userId}`,
          eventType: event.eventType,
          userId,
          channels,
          payload: {
            title: event.payload.title,
            body: event.payload.body,
            channelId: event.payload.channelId || 'broadcast',
            priority: event.payload.priority || 'default',
            data: {
              ...payloadData,
              broadcastId,
            },
          },
          category: event.category || 'marketing',
          source: event.source || 'rez-marketing-service',
          createdAt: event.createdAt || new Date().toISOString(),
        },
        opts: {
          jobId: `broadcast:${broadcastId}:${userId}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
      }));

      await notifQueue.addBulk(jobs);
      enqueuedCount += batch.length;
    }

    logger.info('[Marketing] Broadcast notification enqueued', {
      eventId: event.eventId,
      broadcastId,
      enqueuedCount,
    });

    res.json({
      success: true,
      eventId: event.eventId,
      broadcastId,
      enqueued: enqueuedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[Marketing] Failed to enqueue broadcast notification', {
      eventId: event.eventId,
      broadcastId,
      error: message,
    });
    res.status(500).json({ error: 'Failed to enqueue notification', details: message });
  }
});

// ── Audience Sync ──────────────────────────────────────────────────────────────

interface AudienceSyncEvent {
  merchantId: string;
  segmentId: string;
  userIds: string[];
  syncedAt: string;
}

/**
 * POST /api/marketing/audience/sync
 *
 * Sync notification preferences when audience segment is updated.
 * Updates user notification preference records in MongoDB.
 */
router.post('/audience/sync', async (req: Request, res: Response) => {
  const event = req.body as AudienceSyncEvent;

  if (!event.merchantId || !event.segmentId || !Array.isArray(event.userIds)) {
    res.status(400).json({ error: 'Missing required fields: merchantId, segmentId, userIds' });
    return;
  }

  logger.info('[Marketing] Processing audience sync', {
    merchantId: event.merchantId,
    segmentId: event.segmentId,
    userCount: event.userIds.length,
  });

  try {
    const NotificationPreferences = mongoose.connection.collection('notification_preferences');

    const syncedAt = new Date(event.syncedAt || Date.now());
    const bulkOps = event.userIds.map((userId) => ({
      updateOne: {
        filter: { userId, merchantId: event.merchantId },
        update: {
          $set: {
            segmentIds: [event.segmentId],
            lastSyncedAt: syncedAt,
            marketingEnabled: true,
          },
          $setOnInsert: {
            userId,
            merchantId: event.merchantId,
            createdAt: syncedAt,
          },
        },
        upsert: true,
      },
    }));

    const result = await NotificationPreferences.bulkWrite(bulkOps);

    logger.info('[Marketing] Audience sync completed', {
      merchantId: event.merchantId,
      segmentId: event.segmentId,
      synced: event.userIds.length,
      modified: result.modifiedCount,
      upserted: result.upsertedCount,
    });

    res.json({
      success: true,
      merchantId: event.merchantId,
      segmentId: event.segmentId,
      synced: event.userIds.length,
      modified: result.modifiedCount,
      upserted: result.upsertedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[Marketing] Audience sync failed', {
      merchantId: event.merchantId,
      segmentId: event.segmentId,
      error: message,
    });
    res.status(500).json({ error: 'Failed to sync audience preferences', details: message });
  }
});

export default router;
