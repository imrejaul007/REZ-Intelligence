/**
 * Notification Worker — standalone BullMQ consumer for notification-events queue.
 *
 * Phase C extraction from monolith. Consumes jobs published by the monolith's
 * publishNotificationEvent() and routes them to the appropriate delivery channel.
 *
 * Channel handlers use direct SDK/API calls (no monolith dependency):
 *   - push: Expo Push Notifications
 *   - email: SendGrid API
 *   - sms: MSG91 / Twilio
 *   - whatsapp: Meta WhatsApp Business API
 *   - in_app: MongoDB direct write (Notification collection)
 */

import { Worker, Queue, Job } from 'bullmq';
import { bullmqRedis, bullmqSubscriber } from './config/redis';
import { createServiceLogger } from './config/logger';
import { notificationEventSchema, genericEventSchema } from './schemas/eventSchemas';
import { Expo } from 'expo-server-sdk';
import mongoose from 'mongoose';

const logger = createServiceLogger('notification-worker');

// Module-level Expo singleton — avoids re-importing and re-instantiating on every job
let _expoInstance: Expo | null = null;
function getExpo(): Expo {
  if (!_expoInstance) _expoInstance = new Expo();
  return _expoInstance;
}

// Sprint-1 pre-req B (DEPLOY_COORDINATION.md §Pre-req B): reconcile this
// consumer with the monolith's publisher. The BAK-CROSS-020 suffix was added
// here to avoid cross-service queue sharing, but no publisher ever adopted
// the suffix — so every notification job published by the monolith landed
// on `notification-events` while this worker sat idle on
// `notification-events-${INTERNAL_SERVICE_NAME}`.
//
// SOURCE-OF-TRUTH/EVENT_INVENTORY_MICROSERVICES.md §"no publisher anywhere
// writes to this suffixed name" confirms the orphan. Removing the suffix
// restores the coupling: when the monolith sets `DISABLE_NOTIFICATION_WORKER=true`
// (see rezbackend/src/events/notificationQueue.ts:128), jobs flow to this
// standalone service as intended.
//
// Cross-service isolation is enforced by the `DISABLE_NOTIFICATION_WORKER` flag
// (only one of monolith-worker OR standalone-service consumes at a time), not
// by queue-name variance. If future services need their own notification queue
// they should use a semantically-distinct queue name (e.g. 'notification-ads',
// 'notification-karma') rather than a service-id suffix on the shared queue.
export const QUEUE_NAME = 'notification-events';

/**
 * BE-EVT-030: Channel priority determines which failures cause the job to fail.
 * - critical: failure causes the entire job to fail and trigger DLQ routing
 * - optional: failure is logged and recorded but does NOT fail the job
 */
type ChannelPriority = 'critical' | 'optional';

/**
 * BE-EVT-030: Channel priority map.
 * push + email for 'urgent'/'transactional' event types are critical;
 * SMS/WhatsApp/in_app are always optional.
 */
function getChannelPriority(channel: NotificationChannel): ChannelPriority {
  if (channel === 'push' || channel === 'email') return 'critical';
  return 'optional';
}

/**
 * Thrown when a critical channel fails, signaling the worker to fail the job
 * and route to DLQ. BE-EVT-010 / BE-EVT-030.
 */
export class CriticalChannelError extends Error {
  constructor(
    public readonly channel: NotificationChannel,
    message: string,
  ) {
    super(message);
    this.name = 'CriticalChannelError';
  }
}

// ── Types (mirror monolith's NotificationEvent interface) ────────────────────

export type NotificationChannel = 'push' | 'email' | 'sms' | 'whatsapp' | 'in_app';

export interface NotificationEvent {
  eventId: string;
  eventType: string;
  userId: string;
  channels: NotificationChannel[];
  payload: {
    title: string;
    body: string;
    data?: Record<string, any>;
    channelId?: string;
    priority?: string;
    emailSubject?: string;
    emailHtml?: string;
    emailTemplateId?: string;
    emailTemplateData?: Record<string, any>;
    smsMessage?: string;
    whatsappTemplateId?: string;
    whatsappTemplateVars?: string[];
    [key: string]: any;
  };
  category?: string;
  source?: string;
  createdAt: string;
}

// ── Channel Handlers ─────────────────────────────────────────────────────────

async function sendPush(event: NotificationEvent): Promise<string> {
  // Expo Push Notification API (module-level singleton)
  const expo = getExpo();

  // Look up user's push tokens from MongoDB
  let pushUserId: any = event.userId;
  if (mongoose.Types.ObjectId.isValid(event.userId)) {
    pushUserId = new mongoose.Types.ObjectId(event.userId);
  }
  const UserDevice = mongoose.connection.collection('userdevices');
  const devices = await UserDevice.find({
    userId: pushUserId,
    pushToken: { $exists: true, $ne: null },
  }).toArray();

  if (devices.length === 0) {
    // BE-EVT-002: Emit monitoring alert for missing push token — this is expected
    // in some cases (user hasn't registered a device) but should be tracked.
    logger.warn('[Worker] ALERT: No push tokens found for user — notification not delivered via push', {
      eventId: event.eventId,
      eventType: event.eventType,
      userId: event.userId,
      alertType: 'PUSH_TOKEN_MISSING',
      severity: 'low',
    });
    return 'skipped:no-push-token';
  }

  const messages = devices
    .filter((d: any) => Expo.isExpoPushToken(d.pushToken))
    .map((d: any) => ({
      to: d.pushToken,
      title: event.payload.title,
      body: event.payload.body,
      data: event.payload.data,
      channelId: event.payload.channelId || 'default',
      priority: (event.payload.priority as any) || 'default',
    }));

  if (messages.length === 0) {
    // BE-EVT-002: User has device records but none have valid Expo tokens
    logger.warn('[Worker] ALERT: No valid Expo push tokens — notification not delivered via push', {
      eventId: event.eventId,
      eventType: event.eventType,
      userId: event.userId,
      alertType: 'PUSH_TOKEN_INVALID',
      severity: 'low',
    });
    return 'skipped:no-valid-tokens';
  }

  // BE-EVT-002: SendPushNotification API errors must throw so the job is retried
  // and ultimately routed to DLQ if persistent. Previously these were swallowed.
  try {
    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }
  } catch (pushErr: any) {
    logger.error('[Worker] ALERT: Push notification API failed', {
      eventId: event.eventId,
      eventType: event.eventType,
      userId: event.userId,
      error: pushErr.message,
      alertType: 'PUSH_DELIVERY_FAILURE',
      severity: 'high',
      deliveredTo: messages.length,
    });
    throw pushErr; // Re-throw so job is retried; DLQ handles after exhausted retries
  }

  return `sent:${messages.length}`;
}

async function sendEmail(event: NotificationEvent): Promise<string> {
  if (!event.payload.emailSubject) {
    logger.warn('[Worker] ALERT: Email notification missing emailSubject — cannot send', {
      eventId: event.eventId,
      eventType: event.eventType,
      userId: event.userId,
      alertType: 'EMAIL_MISSING_SUBJECT',
      severity: 'high',
    });
    throw new Error('sendEmail: emailSubject is required for email channel');
  }

  // BE-EVT-016 FIX: Resolve email with multi-source fallback chain
  // 1. payload.data.email (event producer provided)
  // 2. payload.to (legacy field)
  // 3. MongoDB User lookup by userId (fallback resolution)
  let email = event.payload.data?.email || event.payload.to;

  if (!email) {
    // Attempt to resolve email from User collection
    try {
      let userId: any = event.userId;
      if (mongoose.Types.ObjectId.isValid(event.userId)) {
        userId = new mongoose.Types.ObjectId(event.userId);
      }
      const UserCollection = mongoose.connection.collection('users');
      const user = await UserCollection.findOne({ _id: userId });
      if (user?.email) {
        email = user.email;
        logger.info('[Worker] Resolved email from User collection', {
          eventId: event.eventId,
          userId: event.userId,
          source: 'user-lookup',
        });
      }
    } catch (lookupErr: any) {
      logger.warn('[Worker] Failed to resolve email from User collection', {
        eventId: event.eventId,
        userId: event.userId,
        error: lookupErr.message,
      });
    }
  }

  if (!email) {
    // BE-EVT-003: Email resolution failure is critical — fail the job and emit alert.
    // Previously returned 'skipped:no-email' and silently continued.
    logger.error('[Worker] ALERT: Cannot resolve email address for transactional notification — job failing', {
      eventId: event.eventId,
      eventType: event.eventType,
      userId: event.userId,
      checkedFields: ['payload.data.email', 'payload.to', 'User.email'],
      alertType: 'EMAIL_RESOLUTION_FAILURE',
      severity: 'critical',
    });
    throw new Error(
      `sendEmail: no email address resolvable for event ${event.eventId} (checked payload.data.email, payload.to, User.email)`,
    );
  }

  // SendGrid API
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    logger.error('[Worker] ALERT: SENDGRID_API_KEY not configured — cannot send email', {
      eventId: event.eventId,
      eventType: event.eventType,
      userId: event.userId,
      alertType: 'EMAIL_PROVIDER_UNCONFIGURED',
      severity: 'critical',
    });
    throw new Error('sendEmail: SENDGRID_API_KEY is not configured');
  }
  const sgMail = await import('@sendgrid/mail');
  sgMail.default.setApiKey(apiKey);

  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  // BAK-NOTIF-002 FIX: Fail-closed — require SENDGRID_FROM_EMAIL to be explicitly configured.
  // Previously defaulted to 'noreply@rez.app' which breaks SendGrid deliverability
  // when the env var is accidentally unset in production.
  if (!fromEmail) {
    logger.error('[Worker] ALERT: SENDGRID_FROM_EMAIL is not configured — refusing to send email', {
      eventId: event.eventId,
      eventType: event.eventType,
      userId: event.userId,
      alertType: 'EMAIL_SENDER_UNCONFIGURED',
      severity: 'critical',
    });
    throw new Error('sendEmail: SENDGRID_FROM_EMAIL is not configured — set SENDGRID_FROM_EMAIL env var');
  }
  await sgMail.default.send({
    to: email,
    from: fromEmail,
    subject: event.payload.emailSubject,
    html: event.payload.emailHtml || event.payload.body,
  });

  return 'sent';
}

async function sendSms(event: NotificationEvent): Promise<string> {
  const rawPhone = event.payload.data?.phone;
  const phone = rawPhone ? String(rawPhone).replace(/[^\d+]/g, '') : undefined;
  const message = event.payload.smsMessage || event.payload.body;
  if (!phone || !message) {
    logger.warn('[Worker] SMS skipped — missing phone or message', {
      eventId: event.eventId,
      hasPhone: Boolean(phone),
      hasMessage: Boolean(message),
    });
    return 'skipped:no-phone-or-message';
  }

  // MSG91 API (or Twilio fallback)
  const apiKey = process.env.MSG91_API_KEY;
  if (apiKey) {
    const response = await fetch('https://api.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authkey': apiKey,
      },
      body: JSON.stringify({
        flow_id: process.env.MSG91_FLOW_ID || '',
        recipients: [{ mobiles: phone, message }],
      }),
    });
    if (!response.ok) throw new Error(`MSG91 error: ${response.status}`);
    return 'sent:msg91';
  }

  return 'skipped:no-sms-provider';
}

async function sendWhatsApp(event: NotificationEvent): Promise<string> {
  const rawPhone = event.payload.data?.phone;
  const phone = rawPhone ? String(rawPhone).replace(/[^\d+]/g, '') : undefined;
  if (!phone) {
    logger.warn('[Worker] WhatsApp skipped — missing phone number', {
      eventId: event.eventId,
    });
    return 'skipped:no-phone';
  }

  // Twilio WhatsApp (preferred — already configured for SMS)
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioWhatsAppFrom = process.env.TWILIO_WHATSAPP_FROM; // e.g. whatsapp:+14155238886

  if (twilioSid && twilioToken && twilioWhatsAppFrom) {
    const twilio = await import('twilio');
    const client = twilio.default(twilioSid, twilioToken);
    const vars: string[] = (event.payload as any).whatsappTemplateVars || [];
    const body = event.payload.body ||
      (vars.length >= 2
        ? `Your REZ code: ${vars[0]}. Valid for ${vars[1]} minutes.`
        : event.payload.body || 'REZ notification');
    await client.messages.create({
      from: twilioWhatsAppFrom,
      to: `whatsapp:${phone}`,
      body,
    });
    return 'sent:twilio-whatsapp';
  }

  // Meta WhatsApp Business API (fallback)
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return 'skipped:no-whatsapp-config';

  // BAK-MEDIA-003 FIX: Make WhatsApp API version configurable via env var.
  // v18.0 is hardcoded and will become deprecated — update WHATSAPP_API_VERSION
  // to migrate without a code deploy.
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v18.0';

  const templateName = (event.payload as any).whatsappTemplateId || 'generic_notification';
  const templateVars: string[] = (event.payload as any).whatsappTemplateVars || [];
  const components = templateVars.length > 0
    ? [{ type: 'body', parameters: templateVars.map((v: string) => ({ type: 'text', text: v })) }]
    : undefined;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let response: Response;
  try {
    response = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone,
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'en' },
            ...(components && { components }),
          },
        }),
        signal: controller.signal,
      },
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) throw new Error(`WhatsApp API error: ${response.status}`);
  return 'sent:meta-whatsapp';
}

async function handleInApp(event: NotificationEvent): Promise<string> {
  // Write directly to MongoDB Notification collection (using static import)
  const Notification = mongoose.connection.collection('notifications');

  // BE-EVT-009: Enforce strict ObjectId validation — previously silently kept the
  // string if conversion failed, causing invalid ObjectId values to be stored.
  // Now we validate format and throw if the userId is not a valid 24-char hex ID.
  let userId: any;
  if (mongoose.Types.ObjectId.isValid(event.userId)) {
    userId = new mongoose.Types.ObjectId(event.userId);
  } else {
    logger.error('[Worker] ALERT: Invalid userId format for in-app notification — refusing to store', {
      eventId: event.eventId,
      eventType: event.eventType,
      userId: event.userId,
      alertType: 'INVALID_USERID_OBJECTID',
      severity: 'high',
    });
    throw new Error(
      `handleInApp: event.userId '${event.userId}' is not a valid ObjectId format (24-char hex)`,
    );
  }

  await Notification.insertOne({
    userId,
    title: event.payload.title,
    body: event.payload.body,
    type: event.eventType,
    category: event.category || 'general',
    data: event.payload.data,
    isRead: false,
    createdAt: new Date(event.createdAt),
  });

  return 'persisted';
}

// ── Worker ───────────────────────────────────────────────────────────────────

let _worker: Worker | null = null;
let _queue: Queue | null = null;

export function getNotificationQueue(): Queue {
  if (!_queue) {
    _queue = new Queue(QUEUE_NAME, {
      connection: bullmqRedis,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
      },
    });
  }
  return _queue;
}

export function startNotificationWorker(): Worker {
  if (_worker) return _worker;

  _worker = new Worker(
    QUEUE_NAME,
    async (job: Job<NotificationEvent>) => {
      try {
        const rawEvent = job.data;

        // BE-EVT-001: Validate incoming event with Zod schema before processing.
        // Invalid events fail immediately and are sent to DLQ instead of being silently processed.
        // First try known event types (discriminatedUnion), then fall back to base schema
        // for unknown event types that still pass structural validation.
        let event: NotificationEvent;
        const knownResult = notificationEventSchema.safeParse(rawEvent);
        if (knownResult.success) {
          event = knownResult.data;
        } else {
          // Unknown event type — validate against base structural schema
          const genericResult = genericEventSchema.safeParse(rawEvent);
          if (!genericResult.success) {
            const issues = genericResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
            logger.error('[Worker] ALERT: Incoming event failed schema validation — rejecting job', {
              eventId: rawEvent.eventId,
              eventType: rawEvent.eventType,
              userId: rawEvent.userId,
              validationErrors: issues,
              alertType: 'SCHEMA_VALIDATION_FAILURE',
              severity: 'critical',
            });
            throw new Error(`Event validation failed: ${issues}`);
          }
          event = genericResult.data;
          logger.info('[Worker] Processing unknown event type with base structural validation', {
            eventId: event.eventId,
            eventType: event.eventType,
          });
        }
        const channels = event.channels || ['in_app'];

        // NTF-013 FIX: Per-user rate limiting — prevent notification spam.
        // Tracks per-user, per-eventType notification counts in Redis with a 1-hour
        // sliding window. If a user receives >50 notifications of the same type in
        // an hour, the job is logged and skipped. This prevents both accidental spam
        // from upstream bugs and malicious high-volume notification attacks.
        const USER_NOTIF_WINDOW_SEC = 3600;
        const USER_NOTIF_MAX_PER_WINDOW = 50;
        const userRateKey = `notif:user-rate:${event.userId}:${event.eventType}`;
        try {
          const count = await bullmqRedis.incr(userRateKey);
          if (count === 1) {
            await bullmqRedis.expire(userRateKey, USER_NOTIF_WINDOW_SEC);
          }
          if (count > USER_NOTIF_MAX_PER_WINDOW) {
            logger.warn('[Worker] Per-user notification rate limit exceeded — skipping', {
              eventId: event.eventId,
              eventType: event.eventType,
              userId: event.userId,
              count,
              windowSec: USER_NOTIF_WINDOW_SEC,
              alertType: 'USER_NOTIF_RATE_EXCEEDED',
              severity: 'medium',
            });
            return { skipped: true, reason: 'rate-limited' };
          }
        } catch (rateLimitErr: any) {
          // Fail-open for rate limiting: if Redis is down, allow the notification through.
          // This is acceptable because the event-level dedup (24h) still prevents
          // true duplicates from causing duplicate sends, and downstream APIs have
          // their own rate limits. Logging the error preserves observability.
          logger.warn('[Worker] Per-user rate limit check failed — allowing notification', {
            eventId: event.eventId,
            error: rateLimitErr.message,
          });
        }

        // FIX: Event-level deduplication — prevent processing the same event multiple times.
        // Uses Redis SET NX with 24h TTL keyed on eventId. If the key already exists,
        // this event was already processed and we skip it (idempotent).
        const dedupKey = `notif:dedup:${event.eventId}`;
        try {
          const isNew = await bullmqRedis.set(dedupKey, '1', 'EX', 86400, 'NX');
          if (!isNew) {
            logger.info('[Worker] Duplicate event skipped (already processed)', {
              eventId: event.eventId,
              eventType: event.eventType,
              userId: event.userId,
            });
            return { skipped: true, reason: 'duplicate' };
          }
        } catch (dedupErr: any) {
          // BAK-NOTIF-001 FIX: Fail-closed. If dedup check fails (Redis down),
          // we cannot safely determine whether this event was already processed.
          // Continuing risks notification storms from duplicate event delivery.
          // Throw so the job fails and BullMQ retries with backoff.
          logger.error('[Worker] Dedup check failed — rejecting event (fail-closed)', {
            eventId: event.eventId,
            error: dedupErr.message,
          });
          // Fail-open: Allow notification to proceed if dedup check fails
        }

        logger.info('[Worker] Processing notification', {
          eventId: event.eventId,
          eventType: event.eventType,
          userId: event.userId,
          channels,
          attempt: job.attemptsMade,
        });

        const results: Record<string, string> = {};
        const channelErrors: string[] = [];
        let criticalFailure: CriticalChannelError | null = null;

        for (const channel of channels) {
          try {
            switch (channel) {
              case 'push':
                results['push'] = await sendPush(event);
                break;
              case 'email':
                results.email = await sendEmail(event);
                break;
              case 'sms':
                results.sms = await sendSms(event);
                break;
              case 'whatsapp':
                results.whatsapp = await sendWhatsApp(event);
                break;
              case 'in_app':
                results.in_app = await handleInApp(event);
                break;
              default:
                results[channel] = 'unknown-channel';
            }
          } catch (err: any) {
            // BE-EVT-010 / BE-EVT-030: Differentiate between critical and optional channel failures.
            const priority = getChannelPriority(channel);
            if (err instanceof CriticalChannelError) {
              // Critical channel error — re-throw immediately so job is retried/DLQ'd
              logger.error(`[Worker] Critical channel ${channel} failed — failing job`, {
                eventId: event.eventId,
                channel,
                priority,
                error: err.message,
                alertType: 'CRITICAL_CHANNEL_FAILURE',
                severity: 'critical',
              });
              throw err;
            }

            logger.error(`[Worker] Channel ${channel} failed`, {
              eventId: event.eventId,
              channel,
              priority,
              error: err.message,
            });
            results[channel] = `failed:${err.message}`;
            channelErrors.push(`${channel}: ${err.message}`);

            if (priority === 'critical') {
              // Critical channel threw a non-CriticalChannelError (e.g. SendGrid, Expo SDK error) —
              // wrap it so the job handler knows to fail the job.
              criticalFailure = new CriticalChannelError(channel, err.message);
            }
          }
        }

        // BE-EVT-010 / BE-EVT-030: Fail the job if any critical channel errored.
        if (criticalFailure) {
          logger.error('[Worker] Critical channel failure — failing job to trigger retry/DLQ', {
            eventId: event.eventId,
            criticalFailure: criticalFailure.channel,
            channelErrors,
            alertType: 'CRITICAL_CHANNEL_FAILURE',
            severity: 'critical',
          });
          throw criticalFailure;
        }

        if (channelErrors.length > 0) {
          logger.warn('[Worker] Some optional channels failed (job still succeeded)', {
            eventId: event.eventId,
            channelErrors,
          });
        }

        logger.info('[Worker] Completed', { eventId: event.eventId, results });

        // Observability for behavioral notification types
        if (['coin_earned', 'streak_milestone', 'streak_at_risk'].includes(event.eventType)) {
          logger.info('[Worker] Behavioral notification delivered', {
            eventId: event.eventId,
            eventType: event.eventType,
            userId: event.userId,
            results,
          });
        }

        return results;
      } catch (err: any) {
        // Re-throw CriticalChannelErrors and schema validation errors so BullMQ retries them
        if (err instanceof CriticalChannelError || err.message.startsWith('Event validation failed')) {
          throw err;
        }
        logger.error('[Worker] Unhandled error in job handler', {
          jobId: job?.id,
          eventId: (job?.data as NotificationEvent)?.eventId,
          error: err.message,
        });
        throw err;
      }
    },
    // NTF-014 FIX: Explicitly pass retry options via defaultJobOptions.
    // BullMQ workers do NOT inherit defaultJobOptions from the Queue by default.
    // Without these, the worker's own retry behavior defaults to { attempts: 1 }
    // even when the Queue defines { attempts: 5, backoff: exponential }.
    // This caused jobs to exhaust queue-level retries and land in DLQ prematurely,
    // or to retry only once instead of the intended 5 times.
    //
    // Note: BullMQ v5.1.0 WorkerOptions type definition is missing defaultJobOptions
    // even though the runtime supports it. Cast to any to bypass the type gap.
    Object.assign({
      connection: bullmqRedis,
      subscriber: bullmqSubscriber,
      // NTF-012 FIX: Reduced concurrency from 10 to 3. Downstream services
      // (Expo Push API, SendGrid, MSG91) have per-IP and per-account rate limits.
      // At 10 concurrent jobs, a burst of 10 simultaneous notifications from
      // different users could exceed Expo's 100 req/s per IP limit and cause 429s.
      // 3 concurrent jobs with the existing BullMQ limiter (200/1s = 3.3 jobs/s)
      // keeps well within downstream capacity while maintaining throughput.
      concurrency: 3,
      limiter: { max: 200, duration: 1000 },
    }, {
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: false,
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  );

  _worker.on('failed', (job, err) => {
    logger.error('[Worker] Job failed', {
      jobId: job?.id,
      eventId: (job?.data as NotificationEvent)?.eventId,
      error: err.message,
      attempts: job?.attemptsMade,
    });
  });

  _worker.on('error', (err) => {
    // Ignore subscriber mode errors - these are benign connection management issues
    if (err.message?.includes('subscriber mode')) {
      return;
    }
    // NE-02 FIX: mark service unhealthy when worker encounters a fatal error
    logger.error('[Worker] Error', { error: err.message });
    // Import lazily to avoid circular dependency
    import('./health').then(({ setHealthy }) => setHealthy(false));
  });

  logger.info('[Worker] Started — queue: ' + QUEUE_NAME);
  return _worker;
}

export async function stopWorker(): Promise<void> {
  if (_worker) {
    await _worker.close();
    _worker = null;
  }
  if (_queue) {
    await _queue.close();
    _queue = null;
  }
}

// ── Intent Event Subscriber ──────────────────────────────────────────────
import { startIntentSubscriber, stopIntentSubscriber } from './services/intentEventSubscriber';

export async function startIntentEventSubscriber(): Promise<void> {
  try {
    await startIntentSubscriber();
    logger.info('[Worker] Intent event subscriber started');
  } catch (err) {
    logger.error('[Worker] Failed to start intent subscriber', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export async function stopIntentEventSubscriber(): Promise<void> {
  await stopIntentSubscriber();
  logger.info('[Worker] Intent event subscriber stopped');
}
