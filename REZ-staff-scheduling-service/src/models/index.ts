import mongoose, { Schema, Model } from 'mongoose';
import {
  IStaff,
  ISchedule,
  IShift,
  ITimeOff,
  EmploymentType,
  StaffStatus,
  ScheduleStatus,
  ShiftStatus,
  TimeOffType,
  TimeOffStatus,
} from '../types/index.js';

// ============================================================================
// Staff Schema
// ============================================================================

const staffSchema = new Schema<IStaff>(
  {
    staffId: { type: String, required: true, unique: true },
    employeeId: { type: String },
    name: { type: String, required: true },
    email: { type: String },
    phone: { type: String },
    role: { type: String, required: true },
    department: { type: String },
    locationId: { type: String, index: true },
    franchiseId: { type: String },
    employmentType: {
      type: String,
      enum: ['full_time', 'part_time', 'contract', 'temporary'],
      default: 'full_time',
    },
    hourlyRate: { type: Number },
    status: {
      type: String,
      enum: ['active', 'inactive', 'on_leave', 'terminated'],
      default: 'active',
    },
    skills: [{ type: String }],
    certifications: [{ type: String }],
    availability: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

staffSchema.index({ locationId: 1, status: 1 });

export const Staff: Model<IStaff> = mongoose.model<IStaff>('Staff', staffSchema);

// ============================================================================
// Schedule Schema
// ============================================================================

const scheduleSchema = new Schema<ISchedule>(
  {
    scheduleId: { type: String, required: true, unique: true },
    locationId: { type: String, required: true, index: true },
    franchiseId: { type: String },
    weekStart: { type: Date, required: true },
    weekEnd: { type: Date, required: true },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
    },
    publishedAt: { type: Date },
    createdBy: { type: String },
    notes: { type: String },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

scheduleSchema.index({ locationId: 1, weekStart: 1 });

export const Schedule: Model<ISchedule> = mongoose.model<ISchedule>('Schedule', scheduleSchema);

// ============================================================================
// Shift Schema
// ============================================================================

const shiftTimesheetSchema = new Schema(
  {
    clockIn: { type: Date },
    clockOut: { type: Date },
    hoursWorked: { type: Number },
    overtimeHours: { type: Number },
  },
  { _id: false }
);

const shiftSchema = new Schema<IShift>(
  {
    shiftId: { type: String, required: true, unique: true },
    scheduleId: { type: String, required: true, index: true },
    staffId: { type: String, required: true, index: true },
    locationId: { type: String, required: true },
    role: { type: String, required: true },
    date: { type: Date, required: true, index: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    breakMinutes: { type: Number, default: 0 },
    totalHours: { type: Number },
    status: {
      type: String,
      enum: ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'],
      default: 'scheduled',
    },
    notes: { type: String },
    timesheet: {
      type: shiftTimesheetSchema,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

shiftSchema.index({ staffId: 1, date: 1 });
shiftSchema.index({ locationId: 1, date: 1 });
shiftSchema.index({ status: 1 });

export const Shift: Model<IShift> = mongoose.model<IShift>('Shift', shiftSchema);

// ============================================================================
// TimeOff Schema
// ============================================================================

const timeOffSchema = new Schema<ITimeOff>(
  {
    timeOffId: { type: String, required: true, unique: true },
    staffId: { type: String, required: true, index: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    type: {
      type: String,
      enum: ['vacation', 'sick', 'personal', 'other'],
      required: true,
    },
    reason: { type: String },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
    },
    approvedBy: { type: String },
    approvedAt: { type: Date },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

timeOffSchema.index({ staffId: 1, startDate: 1, endDate: 1 });

export const TimeOff: Model<ITimeOff> = mongoose.model<ITimeOff>('TimeOff', timeOffSchema);

// ============================================================================
// Export all models
// ============================================================================

export const models = {
  Staff,
  Schedule,
  Shift,
  TimeOff,
};

export default models;
