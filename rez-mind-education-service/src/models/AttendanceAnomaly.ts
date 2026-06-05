import mongoose, { Document, Schema } from 'mongoose';
import { AnomalySeverity, AttendanceStatus } from '../types';

export interface IAttendanceAnomaly extends Document {
  anomalyId: string;
  studentId: string;
  institutionId: string;
  courseId?: string;
  type: 'sudden_drop' | 'chronic_absence' | 'pattern_absence' | 'late_arrivals';
  severity: AnomalySeverity;
  description: string;
  possibleCause: string;
  recommendedAction: string;
  detectedDate: Date;
  resolved: boolean;
  resolvedDate?: Date;
  attendanceSnapshot?: {
    previousRate: number;
    currentRate: number;
    consecutiveAbsences: number;
    lateCount: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceAnomalySchema = new Schema<IAttendanceAnomaly>(
  {
    anomalyId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    studentId: {
      type: String,
      required: true,
      index: true,
    },
    institutionId: {
      type: String,
      required: true,
      index: true,
    },
    courseId: { type: String, index: true },
    type: {
      type: String,
      enum: ['sudden_drop', 'chronic_absence', 'pattern_absence', 'late_arrivals'],
      required: true,
    },
    severity: {
      type: String,
      enum: Object.values(AnomalySeverity),
      default: AnomalySeverity.MEDIUM,
    },
    description: {
      type: String,
      required: true,
    },
    possibleCause: {
      type: String,
    },
    recommendedAction: {
      type: String,
      required: true,
    },
    detectedDate: {
      type: Date,
      required: true,
    },
    resolved: {
      type: Boolean,
      default: false,
    },
    resolvedDate: { type: Date },
    attendanceSnapshot: {
      previousRate: Number,
      currentRate: Number,
      consecutiveAbsences: Number,
      lateCount: Number,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
AttendanceAnomalySchema.index({ institutionId: 1, studentId: 1 });
AttendanceAnomalySchema.index({ institutionId: 1, severity: 1 });
AttendanceAnomalySchema.index({ institutionId: 1, resolved: 1 });
AttendanceAnomalySchema.index({ studentId: 1, detectedDate: -1 });

// TTL index - resolved anomalies after 90 days
AttendanceAnomalySchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 }
);

// Static methods
AttendanceAnomalySchema.statics.findByStudent = function (studentId: string, limit = 20) {
  return this.find({ studentId })
    .sort({ detectedDate: -1 })
    .limit(limit)
    .exec();
};

AttendanceAnomalySchema.statics.findUnresolved = function (institutionId: string, limit = 50) {
  return this.find({ institutionId, resolved: false })
    .sort({ severity: -1, detectedDate: -1 })
    .limit(limit)
    .exec();
};

AttendanceAnomalySchema.statics.findBySeverity = function (institutionId: string, severity: AnomalySeverity) {
  return this.find({ institutionId, severity, resolved: false })
    .sort({ detectedDate: -1 })
    .exec();
};

AttendanceAnomalySchema.statics.markResolved = async function (anomalyId: string) {
  return this.findOneAndUpdate(
    { anomalyId },
    { resolved: true, resolvedDate: new Date(), updatedAt: new Date() },
    { new: true }
  );
};

AttendanceAnomalySchema.statics.getAnomalySummary = async function (institutionId: string) {
  const results = await this.aggregate([
    { $match: { institutionId } },
    {
      $group: {
        _id: {
          type: '$type',
          severity: '$severity',
          resolved: '$resolved',
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.severity': -1, count: -1 } },
  ]);

  return results.map(r => ({
    type: r._id.type,
    severity: r._id.severity,
    resolved: r._id.resolved,
    count: r.count,
  }));
};

export const AttendanceAnomaly = mongoose.model<IAttendanceAnomaly>(
  'AttendanceAnomaly',
  AttendanceAnomalySchema
);

export default AttendanceAnomaly;