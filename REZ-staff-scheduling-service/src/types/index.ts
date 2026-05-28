import { Document } from 'mongoose';
import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const EmploymentType = z.enum(['full_time', 'part_time', 'contract', 'temporary']);
export type EmploymentType = z.infer<typeof EmploymentType>;

export const StaffStatus = z.enum(['active', 'inactive', 'on_leave', 'terminated']);
export type StaffStatus = z.infer<typeof StaffStatus>;

export const ScheduleStatus = z.enum(['draft', 'published', 'archived']);
export type ScheduleStatus = z.infer<typeof ScheduleStatus>;

export const ShiftStatus = z.enum(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']);
export type ShiftStatus = z.infer<typeof ShiftStatus>;

export const TimeOffType = z.enum(['vacation', 'sick', 'personal', 'other']);
export type TimeOffType = z.infer<typeof TimeOffType>;

export const TimeOffStatus = z.enum(['pending', 'approved', 'rejected', 'cancelled']);
export type TimeOffStatus = z.infer<typeof TimeOffStatus>;

// ============================================================================
// Input Schemas (Zod)
// ============================================================================

export const CreateStaffInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  role: z.string().min(1),
  department: z.string().optional(),
  locationId: z.string().optional(),
  franchiseId: z.string().optional(),
  employmentType: EmploymentType.default('full_time'),
  hourlyRate: z.number().positive().optional(),
  skills: z.array(z.string()).optional(),
  availability: z.record(z.unknown()).optional(),
});

export type CreateStaffInput = z.infer<typeof CreateStaffInputSchema>;

export const UpdateStaffInputSchema = CreateStaffInputSchema.partial();

export type UpdateStaffInput = z.infer<typeof UpdateStaffInputSchema>;

export const StaffStatusInputSchema = z.object({
  status: StaffStatus,
});

export type StaffStatusInput = z.infer<typeof StaffStatusInputSchema>;

export const StaffQuerySchema = z.object({
  locationId: z.string().optional(),
  franchiseId: z.string().optional(),
  role: z.string().optional(),
  status: StaffStatus.optional(),
});

export type StaffQuery = z.infer<typeof StaffQuerySchema>;

export const CreateTimeOffInputSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  type: TimeOffType,
  reason: z.string().optional(),
});

export type CreateTimeOffInput = z.infer<typeof CreateTimeOffInputSchema>;

export const TimeOffQuerySchema = z.object({
  status: TimeOffStatus.optional(),
});

export type TimeOffQuery = z.infer<typeof TimeOffQuerySchema>;

export const CreateScheduleInputSchema = z.object({
  locationId: z.string().min(1),
  franchiseId: z.string().optional(),
  weekStart: z.string().datetime(),
  createdBy: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateScheduleInput = z.infer<typeof CreateScheduleInputSchema>;

export const ScheduleStatusInputSchema = z.object({
  status: ScheduleStatus,
});

export type ScheduleStatusInput = z.infer<typeof ScheduleStatusInputSchema>;

export const ScheduleQuerySchema = z.object({
  locationId: z.string().optional(),
  franchiseId: z.string().optional(),
  status: ScheduleStatus.optional(),
});

export type ScheduleQuery = z.infer<typeof ScheduleQuerySchema>;

export const CreateShiftInputSchema = z.object({
  scheduleId: z.string().min(1),
  staffId: z.string().min(1),
  locationId: z.string().min(1),
  role: z.string().min(1),
  date: z.string().datetime(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  breakMinutes: z.number().int().nonnegative().default(0),
  notes: z.string().optional(),
});

export type CreateShiftInput = z.infer<typeof CreateShiftInputSchema>;

export const UpdateShiftInputSchema = z.object({
  locationId: z.string().optional(),
  role: z.string().optional(),
  date: z.string().datetime().optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  breakMinutes: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
});

export type UpdateShiftInput = z.infer<typeof UpdateShiftInputSchema>;

export const ShiftStatusInputSchema = z.object({
  status: ShiftStatus,
  notes: z.string().optional(),
});

export type ShiftStatusInput = z.infer<typeof ShiftStatusInputSchema>;

export const ShiftQuerySchema = z.object({
  locationId: z.string().optional(),
  staffId: z.string().optional(),
  scheduleId: z.string().optional(),
  status: ShiftStatus.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type ShiftQuery = z.infer<typeof ShiftQuerySchema>;

export const HoursReportQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  locationId: z.string().optional(),
  staffId: z.string().optional(),
});

export type HoursReportQuery = z.infer<typeof HoursReportQuerySchema>;

// ============================================================================
// Parameter Schemas
// ============================================================================

export const StaffIdParamSchema = z.object({
  staffId: z.string().min(1),
});

export type StaffIdParam = z.infer<typeof StaffIdParamSchema>;

export const ScheduleIdParamSchema = z.object({
  scheduleId: z.string().min(1),
});

export type ScheduleIdParam = z.infer<typeof ScheduleIdParamSchema>;

export const ShiftIdParamSchema = z.object({
  shiftId: z.string().min(1),
});

export type ShiftIdParam = z.infer<typeof ShiftIdParamSchema>;

export const TimeOffIdParamSchema = z.object({
  timeOffId: z.string().min(1),
});

export type TimeOffIdParam = z.infer<typeof TimeOffIdParamSchema>;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate total hours from start time, end time, and break minutes
 */
export function calculateTotalHours(
  startTime: string,
  endTime: string,
  breakMinutes: number = 0
): number {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  let totalMinutes = endMinutes - startMinutes;
  if (totalMinutes < 0) {
    // Handle overnight shifts
    totalMinutes += 24 * 60;
  }

  return Math.max(0, (totalMinutes - breakMinutes) / 60);
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface StaffResponse {
  staffId: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  department?: string;
  locationId?: string;
  franchiseId?: string;
  employmentType: EmploymentType;
  hourlyRate?: number;
  skills?: string[];
  certifications?: string[];
  status: StaffStatus;
}

export interface TimeOffResponse {
  timeOffId: string;
  staffId: string;
  startDate: Date;
  endDate: Date;
  type: TimeOffType;
  reason?: string;
  status: TimeOffStatus;
  approvedBy?: string;
  approvedAt?: Date;
}

export interface ScheduleResponse {
  scheduleId: string;
  locationId: string;
  franchiseId?: string;
  weekStart: Date;
  weekEnd: Date;
  status: ScheduleStatus;
  publishedAt?: Date;
  createdBy?: string;
  notes?: string;
}

export interface ShiftTimesheet {
  clockIn?: Date;
  clockOut?: Date;
  hoursWorked?: number;
  overtimeHours?: number;
}

export interface ShiftResponse {
  shiftId: string;
  scheduleId: string;
  staffId: string;
  locationId: string;
  role: string;
  date: Date;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  totalHours?: number;
  status: ShiftStatus;
  notes?: string;
  timesheet?: ShiftTimesheet;
}

export interface HoursReportEntry {
  _id: {
    staffId: string;
    date: Date;
  };
  hoursWorked: number;
  overtimeHours: number;
  shiftCount: number;
}

// ============================================================================
// MongoDB Document Types
// ============================================================================

export interface IStaff extends Document {
  staffId: string;
  employeeId?: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  department?: string;
  locationId?: string;
  franchiseId?: string;
  employmentType: EmploymentType;
  hourlyRate?: number;
  status: StaffStatus;
  skills: string[];
  certifications: string[];
  availability?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISchedule extends Document {
  scheduleId: string;
  locationId: string;
  franchiseId?: string;
  weekStart: Date;
  weekEnd: Date;
  status: ScheduleStatus;
  publishedAt?: Date;
  createdBy?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IShift extends Document {
  shiftId: string;
  scheduleId: string;
  staffId: string;
  locationId: string;
  role: string;
  date: Date;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  totalHours?: number;
  status: ShiftStatus;
  notes?: string;
  timesheet: ShiftTimesheet;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITimeOff extends Document {
  timeOffId: string;
  staffId: string;
  startDate: Date;
  endDate: Date;
  type: TimeOffType;
  reason?: string;
  status: TimeOffStatus;
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
}
