import mongoose, { Document, Schema } from 'mongoose';
import { RiskLevel } from '../types';

export interface IRiskFactor {
  category: 'academic' | 'engagement' | 'external';
  factor: string;
  weight: number;
  description: string;
}

export interface IDropoutRisk extends Document {
  riskId: string;
  studentId: string;
  institutionId: string;
  riskScore: number;
  riskLevel: RiskLevel;
  contributingFactors: IRiskFactor[];
  recommendations: string[];
  assessmentDate: Date;
  status: 'active' | 'monitored' | 'resolved';
  interventions?: string[];
  resolvedDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DropoutRiskSchema = new Schema<IDropoutRisk>(
  {
    riskId: {
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
    riskScore: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },
    riskLevel: {
      type: String,
      enum: Object.values(RiskLevel),
      required: true,
    },
    contributingFactors: [{
      category: {
        type: String,
        enum: ['academic', 'engagement', 'external'],
      },
      factor: String,
      weight: Number,
      description: String,
    }],
    recommendations: {
      type: [String],
      default: [],
    },
    assessmentDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'monitored', 'resolved'],
      default: 'active',
    },
    interventions: {
      type: [String],
      default: [],
    },
    resolvedDate: { type: Date },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
DropoutRiskSchema.index({ institutionId: 1, riskLevel: 1 });
DropoutRiskSchema.index({ institutionId: 1, status: 1 });
DropoutRiskSchema.index({ studentId: 1, assessmentDate: -1 });
DropoutRiskSchema.index({ institutionId: 1, riskScore: -1 });

// TTL index - resolved risks after 180 days
DropoutRiskSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 180 * 24 * 60 * 60 }
);

// Static methods
DropoutRiskSchema.statics.findByStudent = function (studentId: string) {
  return this.find({ studentId })
    .sort({ assessmentDate: -1 })
    .exec();
};

DropoutRiskSchema.statics.findActiveByInstitution = function (institutionId: string, limit = 50) {
  return this.find({ institutionId, status: { $in: ['active', 'monitored'] } })
    .sort({ riskScore: -1 })
    .limit(limit)
    .exec();
};

DropoutRiskSchema.statics.findHighRisk = function (institutionId: string, limit = 20) {
  return this.find({
    institutionId,
    riskLevel: { $in: [RiskLevel.CRITICAL, RiskLevel.HIGH] },
    status: 'active',
  })
    .sort({ riskScore: -1 })
    .limit(limit)
    .exec();
};

DropoutRiskSchema.statics.getRiskDistribution = async function (institutionId: string) {
  const results = await this.aggregate([
    { $match: { institutionId, status: 'active' } },
    {
      $group: {
        _id: '$riskLevel',
        count: { $sum: 1 },
        avgRiskScore: { $avg: '$riskScore' },
        students: { $addToSet: '$studentId' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return results.map(r => ({
    riskLevel: r._id,
    count: r.count,
    uniqueStudents: r.students.length,
    avgRiskScore: Math.round(r.avgRiskScore * 10) / 10,
  }));
};

DropoutRiskSchema.statics.updateStatus = async function (
  riskId: string,
  status: 'active' | 'monitored' | 'resolved'
) {
  const update: Record<string, unknown> = { status, updatedAt: new Date() };
  if (status === 'resolved') {
    update.resolvedDate = new Date();
  }

  return this.findOneAndUpdate({ riskId }, update, { new: true });
};

DropoutRiskSchema.statics.addIntervention = async function (riskId: string, intervention: string) {
  return this.findOneAndUpdate(
    { riskId },
    {
      $push: { interventions: intervention },
      $set: { status: 'monitored', updatedAt: new Date() },
    },
    { new: true }
  );
};

export const DropoutRisk = mongoose.model<IDropoutRisk>(
  'DropoutRisk',
  DropoutRiskSchema
);

export default DropoutRisk;