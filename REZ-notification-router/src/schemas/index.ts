import { z } from 'zod';

// Re-export all validation schemas from types
export * from '../types/index.js';

// Additional validation schemas

export const NotificationIdParamSchema = z.object({
  notificationId: z.string().min(1),
});

export const UserIdParamSchema = z.object({
  userId: z.string().min(1),
});

// Validate notification ID format
export function validateNotificationId(id: string): { valid: boolean; error?: string } {
  if (!id.startsWith('notif_')) {
    return { valid: false, error: 'Invalid notification ID format' };
  }
  return { valid: true };
}

// Validate user ID format
export function validateUserId(userId: string): { valid: boolean; error?: string } {
  if (!userId || userId.length < 1) {
    return { valid: false, error: 'User ID is required' };
  }
  if (userId.length > 100) {
    return { valid: false, error: 'User ID is too long' };
  }
  return { valid: true };
}
