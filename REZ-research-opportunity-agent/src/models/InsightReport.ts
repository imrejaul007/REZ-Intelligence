import mongoose, { Schema, Model, Document } from 'mongoose';
import {
  InsightSection,
} from '../types/index.js';

// Insight section subdocument schema
const InsightSectionSchema = new Schema<InsightSection>(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    type: {
      type: String,
      enum: ['analysis', 'opportunity', 'alert', 'metric'],
      required: true,
    },
    data: {
      type: Schema.Types.Mixed,
    },
  },
  { _id: false }
);

// Insight report document interface
export interface IInsightReportDocument extends Document {
  _id: mongoose.Types.ObjectId;
  id: string;
  title: string;
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  summary: string;
  sections: InsightSection[];
  metrics: Record<string, number>;
  opportunities: string[];
  alerts: string[];
  periodStart: Date;
  periodEnd: Date;
  createdBy: string;
  createdAt: Date;
}

// Static methods interface
export interface IInsightReportModel extends Model<IInsightReportDocument> {
  findByType(type: 'daily' | 'weekly' | 'monthly' | 'custom'): mongoose.Query<IInsightReportDocument[], IInsightReportDocument>;
  findLatest(type: 'daily' | 'weekly' | 'monthly'): mongoose.Query<IInsightReportDocument | null, IInsightReportDocument>;
  findByPeriod(startDate: Date, endDate: Date): mongoose.Query<IInsightReportDocument[], IInsightReportDocument>;
  findRecent(limit?: number): mongoose.Query<IInsightReportDocument[], IInsightReportDocument>;
}

// Mongoose schema
const InsightReportSchema = new Schema<IInsightReportDocument>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'custom'],
      required: true,
      index: true,
    },
    summary: {
      type: String,
      required: true,
    },
    sections: {
      type: [InsightSectionSchema],
      default: [],
    },
    metrics: {
      type: Schema.Types.Mixed,
      default: {},
    },
    opportunities: {
      type: [String],
      default: [],
      index: true,
    },
    alerts: {
      type: [String],
      default: [],
    },
    periodStart: {
      type: Date,
      required: true,
      index: true,
    },
    periodEnd: {
      type: Date,
      required: true,
      index: true,
    },
    createdBy: {
      type: String,
      required: true,
      default: 'system',
    },
  },
  {
    timestamps: true,
    collection: 'insight_reports',
  }
);

// Indexes
InsightReportSchema.index({ type: 1, createdAt: -1 });
InsightReportSchema.index({ createdBy: 1, type: 1 });
InsightReportSchema.index({ periodStart: 1, periodEnd: 1 });

// Static methods
InsightReportSchema.statics.findByType = function (
  type: 'daily' | 'weekly' | 'monthly' | 'custom'
): mongoose.Query<IInsightReportDocument[], IInsightReportDocument> {
  return this.find({ type }).sort({ createdAt: -1 });
};

InsightReportSchema.statics.findLatest = function (
  type: 'daily' | 'weekly' | 'monthly'
): mongoose.Query<IInsightReportDocument | null, IInsightReportDocument> {
  return this.findOne({ type }).sort({ createdAt: -1 });
};

InsightReportSchema.statics.findByPeriod = function (
  startDate: Date,
  endDate: Date
): mongoose.Query<IInsightReportDocument[], IInsightReportDocument> {
  return this.find({
    periodStart: { $gte: startDate },
    periodEnd: { $lte: endDate },
  }).sort({ createdAt: -1 });
};

InsightReportSchema.statics.findRecent = function (
  limit: number = 10
): mongoose.Query<IInsightReportDocument[], IInsightReportDocument> {
  return this.find().sort({ createdAt: -1 }).limit(limit);
};

// Transform for JSON output
InsightReportSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    const { _id, __v, ...rest } = ret;
    return rest;
  },
});

// Export model with extended interface
export const InsightReportModel = mongoose.model<IInsightReportDocument, IInsightReportModel>(
  'InsightReport',
  InsightReportSchema
);

export default InsightReportModel;
