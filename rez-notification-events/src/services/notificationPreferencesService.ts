/**
 * notificationPreferencesService.ts — User notification preference management
 *
 * NTF-010 FIX: All MongoDB operations are now properly awaited. Previously,
 * countDocuments() was called without await, causing the Promise to be truthy
 * (not null) and the preferences check to always short-circuit, effectively
 * bypassing the opt-out check entirely.
 *
 * This service queries the usernotificationsettings MongoDB collection to
 * determine whether a user has opted out of a given notification type or channel.
 */

import mongoose from 'mongoose';
import { createServiceLogger } from '../config/logger';

const logger = createServiceLogger('notification-preferences');

// Collection name — mirrors monolith's UserNotificationSettings model
const COLLECTION = 'usernotificationsettings';

export interface NotificationPreference {
  userId: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  inAppEnabled: boolean;
  emailDigestEnabled: boolean;
  mutedChannels: string[];
  mutedEventTypes: string[];
}

/**
 * Check whether a user has opted out of a specific notification channel.
 * Returns true if the user HAS preferences on record (opt-out takes effect).
 *
 * @param userId - The user's ID
 * @param channel - The delivery channel to check (push, email, sms, whatsapp, in_app)
 * @returns true if preferences exist (opt-out may apply), false if no record
 */
export async function hasNotificationPreferences(userId: string): Promise<boolean> {
  let objectId: mongoose.Types.ObjectId;
  if (mongoose.Types.ObjectId.isValid(userId)) {
    objectId = new mongoose.Types.ObjectId(userId);
  } else {
    logger.warn('[Preferences] Invalid userId format', { userId });
    return false;
  }

  // NTF-010 FIX: countDocuments() returns a Promise<number>, not a number.
  // Without `await`, the if-condition evaluated the Promise object itself
  // (which is truthy), always entering the if-block and treating every user
  // as if they had preferences on record — effectively disabling the opt-out
  // bypass and sending notifications even when users had opted out.
  const count = await mongoose.connection.collection(COLLECTION).countDocuments({
    _id: objectId,
  });

  if (count > 0) {
    logger.debug('[Preferences] User has preference record', { userId, count });
    return true;
  }
  return false;
}

/**
 * Check whether a user has explicitly opted out of a specific channel.
 *
 * @param userId - The user's ID
 * @param channel - The delivery channel to check
 * @returns true if user has opted out of this channel, false otherwise
 */
export async function isChannelOptedOut(userId: string, channel: string): Promise<boolean> {
  let objectId: mongoose.Types.ObjectId;
  if (mongoose.Types.ObjectId.isValid(userId)) {
    objectId = new mongoose.Types.ObjectId(userId);
  } else {
    return false;
  }

  const doc = await mongoose.connection.collection(COLLECTION).findOne(
    { _id: objectId },
    { projection: { [channelEnabledField(channel)]: 1 } },
  );

  if (!doc) return false;

  // Channel enabled fields follow the pattern: pushEnabled, emailEnabled, etc.
  const field = channelEnabledField(channel);
  return doc[field] === false;
}

/**
 * Check whether a user has muted a specific event type.
 *
 * @param userId - The user's ID
 * @param eventType - The event type to check (e.g. 'coin_earned', 'streak_at_risk')
 * @returns true if user has muted this event type, false otherwise
 */
export async function isEventTypeMuted(userId: string, eventType: string): Promise<boolean> {
  let objectId: mongoose.Types.ObjectId;
  if (mongoose.Types.ObjectId.isValid(userId)) {
    objectId = new mongoose.Types.ObjectId(userId);
  } else {
    return false;
  }

  const doc = await mongoose.connection.collection(COLLECTION).findOne(
    { _id: objectId, mutedEventTypes: eventType },
    { projection: { _id: 1 } },
  );

  return doc !== null;
}

/**
 * Get full notification preferences for a user.
 *
 * @param userId - The user's ID
 * @returns Preference object or null if no record exists
 */
export async function getPreferences(userId: string): Promise<NotificationPreference | null> {
  let objectId: mongoose.Types.ObjectId;
  if (mongoose.Types.ObjectId.isValid(userId)) {
    objectId = new mongoose.Types.ObjectId(userId);
  } else {
    return null;
  }

  const doc = await mongoose.connection.collection(COLLECTION).findOne({ _id: objectId });
  if (!doc) return null;

  return {
    userId: String(doc._id),
    emailEnabled: doc.emailEnabled ?? true,
    pushEnabled: doc.pushEnabled ?? true,
    smsEnabled: doc.smsEnabled ?? true,
    whatsappEnabled: doc.whatsappEnabled ?? true,
    inAppEnabled: doc.inAppEnabled ?? true,
    emailDigestEnabled: doc.emailDigestEnabled ?? false,
    mutedChannels: doc.mutedChannels ?? [],
    mutedEventTypes: doc.mutedEventTypes ?? [],
  };
}

/**
 * Check if a notification should be suppressed for a user based on preferences.
 *
 * @param userId - The user's ID
 * @param channel - The delivery channel
 * @param eventType - The event type
 * @returns true if the notification should be suppressed (user opted out)
 */
export async function shouldSuppressNotification(
  userId: string,
  channel: string,
  eventType: string,
): Promise<boolean> {
  // If no preferences record exists, use platform defaults (send the notification)
  const hasPrefs = await hasNotificationPreferences(userId);
  if (!hasPrefs) return false;

  // Check channel-level opt-out
  const optedOut = await isChannelOptedOut(userId, channel);
  if (optedOut) return true;

  // Check event-type-level mute
  const muted = await isEventTypeMuted(userId, eventType);
  return muted;
}

function channelEnabledField(channel: string): string {
  switch (channel) {
    case 'push': return 'pushEnabled';
    case 'email': return 'emailEnabled';
    case 'sms': return 'smsEnabled';
    case 'whatsapp': return 'whatsappEnabled';
    case 'in_app': return 'inAppEnabled';
    default: return `${channel}Enabled`;
  }
}
