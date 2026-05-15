import { z } from 'zod';

// Re-export all validation schemas from types
export * from '../types/index.js';

// Additional validation schemas

export const StaffIdParamSchema = z.object({
  staffId: z.string().min(1),
});

export const ScheduleIdParamSchema = z.object({
  scheduleId: z.string().min(1),
});

export const ShiftIdParamSchema = z.object({
  shiftId: z.string().min(1),
});

export const TimeOffIdParamSchema = z.object({
  timeOffId: z.string().min(1),
});

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

// Calculate total hours from start and end time
export function calculateTotalHours(startTime: string, endTime: string, breakMinutes = 0): number {
  const startParts = startTime.split(':').map(Number);
  const endParts = endTime.split(':').map(Number);

  const startMinutes = startParts[0] * 60 + startParts[1];
  const endMinutes = endParts[0] * 60 + endParts[1];

  let totalMinutes = endMinutes - startMinutes - breakMinutes;

  // Handle overnight shifts
  if (totalMinutes < 0) {
    totalMinutes += 24 * 60;
  }

  return totalMinutes / 60;
}

// Validate date range
export function validateDateRange(startDate: string, endDate: string): { valid: boolean; error?: string } {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime())) {
    return { valid: false, error: 'Invalid start date' };
  }

  if (isNaN(end.getTime())) {
    return { valid: false, error: 'Invalid end date' };
  }

  if (start > end) {
    return { valid: false, error: 'Start date must be before end date' };
  }

  return { valid: true };
}
