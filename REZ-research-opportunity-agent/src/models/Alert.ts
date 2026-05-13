import mongoose, { Schema, Model, Document } from 'mongoose';
import {
  AlertType,
  AlertSeverity,
} from '../types/index.js';

// Alert document interface
export interface IAlertDocument extends Document {
  _id: mongoose.Types.ObjectId;
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  data: Record<string, unknown>;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  createdAt: Date;
  expiresAt?: Date;
  acknowledge(acknowledgedBy: string): void;
}

// Static methods interface
export interface IAlertModel extends Model<IAlertDocument> {
  findActive(): mongoose.Query<IAlertDocument[], IAlertDocument>;
  findBySeverity(severity: AlertSeverity): mongoose.Query<IAlertDocument[], IAlertDocument>;
  findByType(type: AlertType): mongoose.Query<IAlertDocument[], IAlertDocument>;
  findCritical(): mongoose.Query<IAlertDocument[], IAlertDocument>;
  findRecent(limit?: number): mongoose.Query<IAlertDocument[], IAlertDocument>;
  countUnacknowledged(): mongoose.Query<number, IAlertDocument>;
  countBySeverity(): Promise<Record<AlertSeverity, number>>;
}

// Mongoose schema
const AlertSchema = new Schema<IAlertDocument>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(AlertType),
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: Object.values(AlertSeverity),
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    acknowledged: {
      type: Boolean,
      default: false,
      index: true,
    },
    acknowledgedAt: {
      type: Date,
    },
    acknowledgedBy: {
      type: String,
    },
    expiresAt: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'alerts',
  }
);

// Indexes
AlertSchema.index({ severity: 1, createdAt: -1 });
AlertSchema.index({ type: 1, severity: 1 });
AlertSchema.index({ acknowledged: 1, createdAt: -1 });
AlertSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Instance methods
AlertSchema.methods.acknowledge = function (
  this: IAlertDocument,
  acknowledgedBy: string
): void {
  this.acknowledged = true;
  this.acknowledgedAt = new Date();
  this.acknowledgedBy = acknowledgedBy;
};

// Static methods
AlertSchema.statics.findActive = function (): mongoose.Query<IAlertDocument[], IAlertDocument> {
  return this.find({ acknowledged: false }).sort({ severity: -1, createdAt: -1 });
};

AlertSchema.statics.findBySeverity = function (
  severity: AlertSeverity
): mongoose.Query<IAlertDocument[], IAlertDocument> {
  return this.find({ severity, acknowledged: false }).sort({ createdAt: -1 });
};

AlertSchema.statics.findByType = function (
  type: AlertType
): mongoose.Query<IAlertDocument[], IAlertDocument> {
  return this.find({ type, acknowledged: false }).sort({ severity: -1, createdAt: -1 });
};

AlertSchema.statics.findCritical = function (): mongoose.Query<IAlertDocument[], IAlertDocument> {
  return this.find({ severity: AlertSeverity.CRITICAL, acknowledged: false }).sort({ createdAt: -1 });
};

AlertSchema.statics.findRecent = function (limit: number = 50): mongoose.Query<IAlertDocument[], IAlertDocument> {
  return this.find().sort({ createdAt: -1 }).limit(limit);
};

AlertSchema.statics.countUnacknowledged = function (): mongoose.Query<number, IAlertDocument> {
  return this.countDocuments({ acknowledged: false });
};

AlertSchema.statics.countBySeverity = async function (): Promise<Record<AlertSeverity, number>> {
  const results = await this.aggregate([
    { $match: { acknowledged: false } },
    { $group: { _id: '$severity', count: { $sum: 1 } } },
  ]);

  const counts: Record<AlertSeverity, number> = {
    [AlertSeverity.LOW]: 0,
    [AlertSeverity.MEDIUM]: 0,
    [AlertSeverity.HIGH]: 0,
    [AlertSeverity.CRITICAL]: 0,
  };

  results.forEach((result: { _id: string; count: number }) => {
    counts[result._id as AlertSeverity] = result.count;
  });

  return counts;
};

// Transform for JSON output
AlertSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    const { _id, __v, ...rest } = ret;
    return rest;
  },
});

// Export model with extended interface
export const AlertModel = mongoose.model<IAlertDocument, IAlertModel>(
  'Alert',
  AlertSchema
);

export default AlertModel;
