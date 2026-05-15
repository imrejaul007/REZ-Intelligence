import { z } from 'zod';

// Re-export all validation schemas from types
export * from '../types/index.js';

// Additional validation schemas for edge cases

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const DateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const TransactionIdParamSchema = z.object({
  transactionId: z.string().min(1),
});

export const CardIdParamSchema = z.object({
  cardId: z.string().min(1),
});

export const CustomerIdParamSchema = z.object({
  customerId: z.string().min(1),
});

export const CustomerIdQuerySchema = z.object({
  status: z.enum(['active', 'redeemed', 'expired', 'cancelled', 'frozen']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// Validate card value range
export function validateGiftCardValue(value: number): { valid: boolean; error?: string } {
  const minValue = parseInt(process.env.MIN_GIFT_CARD_VALUE || '100');
  const maxValue = parseInt(process.env.MAX_GIFT_CARD_VALUE || '50000');

  if (value < minValue) {
    return { valid: false, error: `Value must be at least ${minValue}` };
  }

  if (value > maxValue) {
    return { valid: false, error: `Value must not exceed ${maxValue}` };
  }

  return { valid: true };
}

// Validate PIN format
export function validatePIN(pin: string): { valid: boolean; error?: string } {
  if (!/^\d{4}$/.test(pin)) {
    return { valid: false, error: 'PIN must be exactly 4 digits' };
  }
  return { valid: true };
}

// Validate time format (HH:MM)
export function validateTimeFormat(time: string): { valid: boolean; error?: string } {
  if (!/^\d{2}:\d{2}$/.test(time)) {
    return { valid: false, error: 'Time must be in HH:MM format' };
  }

  const [hours, minutes] = time.split(':').map(Number);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return { valid: false, error: 'Invalid time values' };
  }

  return { valid: true };
}
