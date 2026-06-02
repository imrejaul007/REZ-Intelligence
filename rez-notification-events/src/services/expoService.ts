/**
 * expoService.ts — Expo Push Notification delivery service
 *
 * NTF-008 FIX: Validate tokens before sending to filter known-invalid tokens upfront.
 * Previously, all tokens were sent directly to Expo's API without pre-validation,
 * generating unnecessary errors and consuming send quota on known-bad recipients.
 *
 * Validation strategy for expo-server-sdk v3.7.0:
 *   1. Pre-send: filter tokens using Expo.isExpoPushToken() to remove format-invalid tokens
 *   2. Post-send: inspect push notification receipts to identify delivery failures
 *
 * Architecture: This service is imported by worker.ts and replaces the inline
 * sendPush() expo handling, centralizing all Expo SDK interactions.
 */

import { Expo } from 'expo-server-sdk';
import { createServiceLogger } from '../config/logger';

const logger = createServiceLogger('expo-service');

// Module-level singleton — one Expo client per process
let _expo: Expo | null = null;

function getExpo(): Expo {
  if (!_expo) _expo = new Expo();
  return _expo;
}

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: string;
  priority?: 'default' | 'high' | 'normal';
}

export interface ExpoSendResult {
  sent: string[];
  invalid: string[];
  errors: Record<string, string>;
}

/**
 * Validate a batch of push tokens before attempting delivery.
 * Filters out tokens that are not valid Expo push tokens by format.
 *
 * Note: expo-server-sdk v3.7.0 does not have a batch validatePushNotifications API.
 * The Expo backend validation (token deregistration, etc.) is handled post-send
 * via push notification receipt inspection.
 *
 * @param tokens - Raw push token strings
 * @returns Array of tokens that passed format validation
 */
export async function validateTokens(tokens: string[]): Promise<string[]> {
  if (tokens.length === 0) return [];

  const expo = getExpo();
  const validTokens: string[] = [];
  const invalidTokens: string[] = [];

  for (const rawToken of tokens) {
    if (Expo.isExpoPushToken(rawToken)) {
      validTokens.push(rawToken);
    } else {
      invalidTokens.push(rawToken);
      logger.warn('[Expo] Token failed format validation', {
        tokenPrefix: String(rawToken).substring(0, 8),
        eventId: 'unknown',
      });
    }
  }

  const invalidCount = invalidTokens.length;
  if (invalidCount > 0) {
    logger.info('[Expo] Token format validation complete', {
      total: tokens.length,
      valid: validTokens.length,
      invalid: invalidCount,
    });
  }

  return validTokens;
}

/**
 * Send push notifications via Expo Push API.
 * Validates all tokens upfront before chunking and sending.
 *
 * @param messages - Array of Expo push message objects
 * @returns Object with sent, invalid, and error details
 */
export async function sendPushNotifications(messages: ExpoMessage[]): Promise<ExpoSendResult> {
  if (messages.length === 0) {
    return { sent: [], invalid: [], errors: {} };
  }

  const tokens = messages.map((m) => m.to);
  const validMessages: ExpoMessage[] = [];
  const invalidTokens: string[] = [];

  // NTF-008 FIX: Filter tokens before sending
  const validTokens = await validateTokens(tokens);
  const validTokenSet = new Set(validTokens);

  for (const msg of messages) {
    if (validTokenSet.has(msg.to)) {
      validMessages.push(msg);
    } else {
      invalidTokens.push(msg.to);
    }
  }

  const result: ExpoSendResult = {
    sent: [],
    invalid: invalidTokens,
    errors: {},
  };

  if (validMessages.length === 0) {
    logger.warn('[Expo] No valid tokens after validation — skipping send');
    return result;
  }

  const expo = getExpo();
  try {
    const chunks = expo.chunkPushNotifications(validMessages as any);

    for (const chunk of chunks) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);

      // Collect receipt IDs from tickets that were accepted
      const receiptIds: string[] = [];
      for (const ticket of ticketChunk) {
        // ticket is ExpoPushTicket = ExpoPushSuccessTicket | ExpoPushErrorReceipt
        // TypeScript can't narrow union members inside a loop iteration
        const t = ticket as { id?: string; status?: string; details?: Record<string, unknown>; message?: string };
        if (t.id && t.status !== 'error') {
          receiptIds.push(t.id);
        } else if (t.status === 'error') {
          // Ticket was rejected immediately — record the error
          const detail = t.details?.error;
          const errMsg = detail
            ? `${detail}: ${t.message || ''}`
            : (t.message || 'unknown immediate rejection');
          const receiptKey = t.id || `immediate-${receiptIds.length}`;
          result.errors[receiptKey] = errMsg;
        }
      }

      // Fetch delivery receipts for accepted tickets
      if (receiptIds.length > 0) {
        // Give Expo a moment to process receipts
        await new Promise((resolve) => setTimeout(resolve, 1000));
        try {
          const receipts = await expo.getPushNotificationReceiptsAsync(receiptIds);

          for (const receiptId of receiptIds) {
            const receipt = receipts[receiptId];
            if (!receipt) {
              // No receipt yet — Expo may still be processing
              result.sent.push(receiptId);
              continue;
            }

            if (receipt.status === 'error') {
              const detail = receipt.details?.error;
              const errMsg = detail
                ? `${detail}: ${receipt.message || ''}`
                : (receipt.message || 'unknown error');
              result.errors[receiptId] = errMsg;
              logger.error('[Expo] Push delivery receipt error', {
                receiptId,
                error: errMsg,
              });
            } else {
              result.sent.push(receiptId);
            }
          }
        } catch (receiptErr: unknown) {
          // Receipt fetch failed — Expo may be temporarily unavailable.
          // Mark all as pending rather than failing the whole batch.
          logger.warn('[Expo] Failed to fetch delivery receipts — marking as pending', {
            error: receiptErr instanceof Error ? receiptErr.message : String(receiptErr),
            receiptCount: receiptIds.length,
          });
          result.sent.push(...receiptIds);
        }
      }
    }

    return result;
  } catch (sendErr: unknown) {
    logger.error('[Expo] Send push notifications failed', {
      error: sendErr instanceof Error ? sendErr.message : String(sendErr),
      validMessages: validMessages.length,
    });
    throw sendErr;
  }
}
