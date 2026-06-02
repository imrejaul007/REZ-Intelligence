/**
 * dlqWorker.ts — Dead Letter Queue Handler
 *
 * Listens for permanently-failed jobs on the 'notification-events' worker and
 * moves them into a 'notification-dlq' queue for retention and later inspection.
 *
 * A job is considered permanently failed when attemptsMade >= the job's
 * configured attempts limit (i.e. all retries have been exhausted).
 *
 * DLQ jobs are kept indefinitely (removeOnComplete: false, removeOnFail: false)
 * so engineers can inspect or replay them.
 */

import { Queue, QueueEvents, Worker } from 'bullmq';
import mongoose from 'mongoose';
import { bullmqRedis, bullmqSubscriber } from '../config/redis';
import { createServiceLogger } from '../config/logger';

const logger = createServiceLogger('dlq-worker');

export const DLQ_QUEUE_NAME = 'notification-dlq';
const SOURCE_QUEUE_NAME   = 'notification-events';

let _dlqQueue: Queue | null        = null;
let _queueEvents: QueueEvents | null = null;

// ── Internal helpers ─────────────────────────────────────────────────────────

function getDlqQueue(): Queue {
  if (!_dlqQueue) {
    _dlqQueue = new Queue(DLQ_QUEUE_NAME, {
      connection: bullmqSubscriber,
      defaultJobOptions: {
        removeOnComplete: false,
        removeOnFail: false,
      },
    });
  }
  return _dlqQueue;
}

/**
 * Determine whether a job has exhausted all of its configured retry attempts.
 * BullMQ sets job.opts.attempts (default 1 if not specified).
 */
function isExhausted(attemptsMade: number, configuredAttempts: number | undefined): boolean {
  const maxAttempts = configuredAttempts ?? 1;
  return attemptsMade >= maxAttempts;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Attach DLQ handling to the already-running notification-events Worker instance.
 *
 * The caller passes the Worker reference so we can attach the 'failed' event
 * listener without creating a second consumer for the same queue.
 *
 * Also creates a QueueEvents listener for monitoring purposes.
 */
export function startDlqHandler(notificationWorker: Worker): void {
  const dlqQueue = getDlqQueue();

  // ── Worker 'failed' event ──────────────────────────────────────────────────
  // Fired every time a job fails (including intermediate retries).
  // We only forward to the DLQ once all retries are exhausted.
  notificationWorker.on('failed', async (job, err) => {
    if (!job) return;

    const configuredAttempts: number | undefined =
      (job.opts as any)?.attempts ?? undefined;

    if (!isExhausted(job.attemptsMade, configuredAttempts)) {
      // Still has retries remaining — skip DLQ
      return;
    }

    logger.error('[DLQ] Job exhausted all retries — forwarding to DLQ', {
      jobId: job.id,
      eventId: (job.data as any)?.eventId,
      userId: (job.data as any)?.userId,
      eventType: (job.data as any)?.eventType,
      attempts: job.attemptsMade,
      error: err.message,
    });

    try {
      // BAK-MED-002 FIX: Mark the original job as permanently failed with moveToFailed.
      // This updates the job's state in BullMQ from 'failed' (retryable) to a final
      // failed state with a structured error reason, preventing it from being retried again
      // if BullMQ's internal retry logic is triggered by a separate event.
      // The reason object preserves the full failure context for later inspection.
      const error = Object.assign(new Error(err.message), {
        stack: err.stack,
        failedAt: new Date().toISOString(),
        eventId: (job.data as any)?.eventId,
        eventType: (job.data as any)?.eventType,
        userId: (job.data as any)?.userId,
        sourceQueue: SOURCE_QUEUE_NAME,
      });
      await job.moveToFailed(error, job.id ?? '', true);
    } catch (moveErr: any) {
      // moveToFailed can fail if the job was already cleaned up.
      // Log and continue — the DLQ entry below is the primary record.
      logger.warn('[DLQ] moveToFailed failed — DLQ entry still recorded', {
        originalJobId: job.id,
        error: moveErr.message,
      });
    }

    try {
      const failedAt = new Date().toISOString();

      await dlqQueue.add(
        'dlq-entry',
        {
          originalJob: job.data,
          failedAt,
          error: err.message,
          attempts: job.attemptsMade,
          sourceQueue: SOURCE_QUEUE_NAME,
          originalJobId: job.id,
        },
        {
          removeOnComplete: false,
          removeOnFail: false,
        },
      );

      logger.error('[DLQ] Entry stored successfully', {
        originalJobId: job.id,
        eventId: (job.data as any)?.eventId,
      });

      // Persist dead-letter record to MongoDB dlq_log for admin review
      try {
        const DlqLog = mongoose.connection.collection('dlq_log');
        await DlqLog.insertOne({
          jobName: job.name,
          data: job.data,
          error: err.message,
          failedAt,
          attempts: job.attemptsMade,
          processedAt: new Date().toISOString(),
        });
        logger.error('[DLQ] ALERT: Dead-letter job persisted to dlq_log', {
          jobId: job.id,
          jobName: job.name,
          eventType: (job.data as any)?.eventType,
          userId: (job.data as any)?.userId,
          attempts: job.attemptsMade,
          error: err.message,
        });
      } catch (mongoErr: any) {
        // Non-fatal — DLQ queue entry was already saved; log and continue
        logger.error('[DLQ] Failed to write dlq_log record to MongoDB', {
          jobId: job.id,
          mongoError: mongoErr.message,
        });
      }
    } catch (dlqErr: any) {
      logger.error('[DLQ] Failed to store DLQ entry', {
        originalJobId: job.id,
        error: dlqErr.message,
      });
    }
  });

  // ── QueueEvents monitor ────────────────────────────────────────────────────
  // Provides an independent monitoring stream for the source queue without
  // competing as a worker.
  _queueEvents = new QueueEvents(SOURCE_QUEUE_NAME, {
    connection: bullmqSubscriber,
  });

  _queueEvents.on('failed', ({ jobId, failedReason }) => {
    logger.error('[DLQ] QueueEvents: job failed', { jobId, failedReason });
  });

  _queueEvents.on('error', (err) => {
    logger.error('[DLQ] QueueEvents error', { error: err.message });
  });

  logger.info('[DLQ] Handler started — monitoring queue: ' + SOURCE_QUEUE_NAME);
  logger.info('[DLQ] Dead letters routed to queue: ' + DLQ_QUEUE_NAME);
}

/**
 * Gracefully close the DLQ queue and QueueEvents listener.
 */
export async function stopDlqHandler(): Promise<void> {
  if (_queueEvents) {
    await _queueEvents.close();
    _queueEvents = null;
  }
  if (_dlqQueue) {
    await _dlqQueue.close();
    _dlqQueue = null;
  }
  logger.info('[DLQ] Handler stopped');
}

// Aliases used by src/index.ts (sprint spec naming)
export const startDlqWorker = startDlqHandler;
export const stopDlqWorker = stopDlqHandler;

// ── DLQ Cleanup Job (BE-EVT-014) ─────────────────────────────────────────────

/**
 * DLQ entries accumulate indefinitely, causing:
 * - Database bloat (large dlq_log collection)
 * - Slow DLQ admin queries
 * - Increased MongoDB storage costs
 *
 * Cleanup policy:
 * - ARCHIVE_THRESHOLD (7 days): entries are moved to a cold-storage collection
 *   (dlq_archive) before deletion, preserving the audit trail.
 * - DELETE_THRESHOLD (90 days): archived entries are permanently deleted.
 *
 * The cleanup runs on a configurable interval (default: every 24 hours).
 * It uses bulk operations for efficiency and logs all actions.
 */

const ARCHIVE_THRESHOLD_DAYS = 7;
const DELETE_THRESHOLD_DAYS = 90;

let _cleanupInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Moves DLQ log entries older than ARCHIVE_THRESHOLD_DAYS to dlq_archive
 * and deletes entries older than DELETE_THRESHOLD_DAYS.
 */
async function runDlqCleanup(): Promise<void> {
  logger.info('[DLQ-Cleanup] Starting DLQ cleanup run');

  const mongoose = await import('mongoose');
  const DlqLog = mongoose.connection.collection('dlq_log');
  const DlqArchive = mongoose.connection.collection('dlq_archive');

  const now = new Date();
  const archiveCutoff = new Date(now.getTime() - ARCHIVE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
  const deleteCutoff = new Date(now.getTime() - DELETE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

  try {
    // Step 1: Archive entries older than ARCHIVE_THRESHOLD_DAYS
    const toArchive = await DlqLog.find({
      processedAt: { $lt: archiveCutoff.toISOString() },
    }).toArray();

    if (toArchive.length > 0) {
      // BULL-007 FIX: Use upsert instead of insertMany to prevent duplicate archives
      // on re-runs within the same archiveCutoff window.
      const upsertResults = await Promise.all(
        toArchive.map((doc: any) =>
          DlqArchive.updateOne(
            { _id: doc._id }, // dedup key: preserve original _id
            {
              $set: {
                ...doc,
                archivedAt: now.toISOString(),
                originalCollection: 'dlq_log',
              },
            },
            { upsert: true },
          ),
        ),
      );
      const upserted = upsertResults.filter((r) => r.upsertedCount > 0).length;
      logger.info('[DLQ-Cleanup] Archived entries to dlq_archive', {
        total: toArchive.length,
        upserted,
        updated: toArchive.length - upserted,
      });
    }

    // Step 2: Delete entries older than ARCHIVE_THRESHOLD_DAYS from dlq_log
    const dlqDeleteResult = await DlqLog.deleteMany({
      processedAt: { $lt: archiveCutoff.toISOString() },
    });

    if (dlqDeleteResult.deletedCount > 0) {
      logger.info('[DLQ-Cleanup] Deleted old entries from dlq_log', {
        deletedCount: dlqDeleteResult.deletedCount,
        archiveThreshold: ARCHIVE_THRESHOLD_DAYS,
      });
    }

    // Step 3: Delete archived entries older than DELETE_THRESHOLD_DAYS
    const archiveDeleteResult = await DlqArchive.deleteMany({
      archivedAt: { $lt: deleteCutoff.toISOString() },
    });

    if (archiveDeleteResult.deletedCount > 0) {
      logger.info('[DLQ-Cleanup] Deleted old entries from dlq_archive', {
        deletedCount: archiveDeleteResult.deletedCount,
        deleteThreshold: DELETE_THRESHOLD_DAYS,
      });
    }

    logger.info('[DLQ-Cleanup] Cleanup run completed', {
      archived: toArchive.length,
      dlqDeleted: dlqDeleteResult.deletedCount,
      archiveDeleted: archiveDeleteResult.deletedCount,
    });
  } catch (cleanupErr: any) {
    logger.error('[DLQ-Cleanup] Cleanup run failed', { error: cleanupErr.message });
  }
}

/**
 * Start the periodic DLQ cleanup job.
 * @param intervalMs - How often to run cleanup (default: every 24 hours)
 */
export function startDlqCleanup(intervalMs: number = 24 * 60 * 60 * 1000): void {
  if (_cleanupInterval !== null) {
    logger.warn('[DLQ-Cleanup] Cleanup already running — skipping start');
    return;
  }

  // Run immediately on start, then on the interval
  runDlqCleanup().catch((err) => {
    logger.error('[DLQ-Cleanup] Initial cleanup run failed', { error: err.message });
  });

  _cleanupInterval = setInterval(() => {
    runDlqCleanup().catch((err) => {
      logger.error('[DLQ-Cleanup] Scheduled cleanup run failed', { error: err.message });
    });
  }, intervalMs);

  logger.info('[DLQ-Cleanup] Started — archiving after 7 days, deleting after 90 days', {
    intervalMs,
    archiveThresholdDays: ARCHIVE_THRESHOLD_DAYS,
    deleteThresholdDays: DELETE_THRESHOLD_DAYS,
  });
}

/**
 * Stop the periodic DLQ cleanup job.
 */
export function stopDlqCleanup(): void {
  if (_cleanupInterval !== null) {
    clearInterval(_cleanupInterval);
    _cleanupInterval = null;
    logger.info('[DLQ-Cleanup] Stopped');
  }
}
