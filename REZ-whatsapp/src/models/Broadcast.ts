import mongoose, { Schema, Document } from 'mongoose';
import {
  BroadcastStatus,
  BroadcastSegment,
  BroadcastProgress,
  WhatsAppBroadcast,
} from '../types/whatsapp';

export interface IBroadcast extends Document {
  _id: mongoose.Types.ObjectId;
  broadcastId: string;
  name: string;
  merchantId?: string;
  templateId: string;
  segment: BroadcastSegment;
  status: BroadcastStatus;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  progress: BroadcastProgress;
  results: Array<{
    userId: string;
    phone: string;
    status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
    error?: string;
    sentAt?: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
  canStart(): boolean;
  start(): Promise<void>;
  cancel(): Promise<void>;
  getProgress(): BroadcastProgress;
}

export interface IBroadcastModel extends mongoose.Model<IBroadcast> {
  getBroadcastStats(merchantId?: string): Promise<unknown>;
  findScheduled(): Promise<IBroadcast[]>;
}

const BroadcastSegmentSchema = new Schema<BroadcastSegment>(
  {
    type: {
      type: String,
      enum: ['all', 'merchant', 'tag', 'custom'],
      required: true,
    },
    merchantId: String,
    tags: [String],
    userIds: [String],
    query: { type: Map, of: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const BroadcastProgressSchema = new Schema<BroadcastProgress>(
  {
    total: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    read: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    startTime: { type: Date },
    endTime: Date,
  },
  { _id: false }
);

const BroadcastResultSchema = new Schema<IBroadcast['results'][0]>(
  {
    userId: { type: String, required: true },
    phone: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
      default: 'pending',
    },
    error: String,
    sentAt: Date,
  },
  { _id: false }
);

const BroadcastSchema = new Schema<IBroadcast>(
  {
    broadcastId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      index: true,
    },
    merchantId: {
      type: String,
      index: true,
    },
    templateId: {
      type: String,
      required: true,
      index: true,
    },
    segment: {
      type: BroadcastSegmentSchema,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(BroadcastStatus),
      default: BroadcastStatus.DRAFT,
      index: true,
    },
    scheduledAt: {
      type: Date,
      index: true,
    },
    startedAt: Date,
    completedAt: Date,
    progress: {
      type: BroadcastProgressSchema,
      default: () => ({
        total: 0,
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
        startTime: undefined,
        endTime: undefined,
      }),
    },
    results: {
      type: [BroadcastResultSchema],
      default: [],
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
  }
);

// Indexes
BroadcastSchema.index({ merchantId: 1, status: 1 });
BroadcastSchema.index({ status: 1, scheduledAt: 1 });
BroadcastSchema.index({ templateId: 1 });
BroadcastSchema.index({ createdAt: -1 });

// Pre-save validation
BroadcastSchema.pre('save', function (next) {
  // Cannot start a cancelled broadcast
  if (this.isModified('status') && this.status === BroadcastStatus.CANCELLED) {
    if (
      this.results.some((r) => r.status === 'sent' || r.status === 'delivered')
    ) {
      next(new Error('Cannot cancel broadcast with sent messages'));
      return;
    }
  }

  // Validate scheduled time
  if (this.scheduledAt && this.scheduledAt <= new Date()) {
    next(new Error('Scheduled time must be in the future'));
    return;
  }

  next();
});

// Instance methods
BroadcastSchema.methods.canStart = function (): {
  canStart: boolean;
  reason?: string;
} {
  if (this.status === BroadcastStatus.RUNNING) {
    return { canStart: false, reason: 'Broadcast is already running' };
  }
  if (this.status === BroadcastStatus.COMPLETED) {
    return { canStart: false, reason: 'Broadcast is already completed' };
  }
  if (this.status === BroadcastStatus.CANCELLED) {
    return { canStart: false, reason: 'Broadcast is cancelled' };
  }
  if (this.status === BroadcastStatus.SCHEDULED && this.scheduledAt && this.scheduledAt > new Date()) {
    return { canStart: false, reason: 'Broadcast is scheduled for later' };
  }
  return { canStart: true };
};

BroadcastSchema.methods.start = function (recipients: Array<{ userId: string; phone: string }>): void {
  this.status = BroadcastStatus.RUNNING;
  this.startedAt = new Date();
  this.progress = {
    total: recipients.length,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    startTime: new Date(),
  };
  this.results = recipients.map((r) => ({
    userId: r.userId,
    phone: r.phone,
    status: 'pending' as const,
  }));
};

BroadcastSchema.methods.updateResult = function (
  index: number,
  status: 'sent' | 'delivered' | 'read' | 'failed',
  error?: string
): void {
  if (this.results[index]) {
    this.results[index].status = status;
    if (status === 'sent' || status === 'delivered' || status === 'read') {
      this.results[index].sentAt = new Date();
    }
    if (status === 'failed' && error) {
      this.results[index].error = error;
    }

    // Update progress counters
    if (status === 'sent') this.progress.sent++;
    if (status === 'delivered') this.progress.delivered++;
    if (status === 'read') this.progress.read++;
    if (status === 'failed') this.progress.failed++;
  }
};

BroadcastSchema.methods.complete = function (): void {
  this.status = BroadcastStatus.COMPLETED;
  this.completedAt = new Date();
  this.progress.endTime = new Date();
};

BroadcastSchema.methods.cancel = function (): boolean {
  const { canStart } = this.canStart();
  if (!canStart) {
    return false;
  }
  this.status = BroadcastStatus.CANCELLED;
  return true;
};

BroadcastSchema.methods.getProgress = function (): {
  percentage: number;
  eta?: number;
  status: string;
} {
  if (this.progress.total === 0) {
    return { percentage: 0, status: this.status };
  }

  const percentage = Math.round(
    ((this.progress.sent + this.progress.failed) / this.progress.total) * 100
  );

  let eta: number | undefined;
  if (this.status === BroadcastStatus.RUNNING && this.progress.startTime) {
    const elapsed = Date.now() - this.progress.startTime.getTime();
    const sentPerMs = this.progress.sent / elapsed;
    const remaining = this.progress.total - this.progress.sent - this.progress.failed;
    if (sentPerMs > 0) {
      eta = Math.round(remaining / sentPerMs / 1000); // seconds
    }
  }

  return { percentage, eta, status: this.status };
};

// Static methods
BroadcastSchema.statics.findScheduled = function (): Promise<IBroadcast[]> {
  return this.find({
    status: BroadcastStatus.SCHEDULED,
    scheduledAt: { $lte: new Date() },
  });
};

BroadcastSchema.statics.findActive = function (
  merchantId?: string
): Promise<IBroadcast[]> {
  const query: Record<string, unknown> = {
    status: BroadcastStatus.RUNNING,
  };
  if (merchantId) {
    query.merchantId = merchantId;
  }
  return this.find(query);
};

BroadcastSchema.statics.getBroadcastStats = async function (
  merchantId?: string
): Promise<{
  total: number;
  byStatus: Record<string, number>;
  avgDeliveryRate: number;
  avgReadRate: number;
}> {
  const matchStage: Record<string, unknown> = {};
  if (merchantId) {
    matchStage.merchantId = merchantId;
  }

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  const byStatus: Record<string, number> = {};
  let total = 0;
  stats.forEach((s) => {
    byStatus[s._id] = s.count;
    total += s.count;
  });

  // Calculate delivery and read rates from completed broadcasts
  const rateStats = await this.aggregate([
    {
      $match: {
        ...matchStage,
        status: BroadcastStatus.COMPLETED,
        'progress.total': { $gt: 0 },
      },
    },
    {
      $group: {
        _id: null,
        avgDeliveryRate: {
          $avg: { $divide: ['$progress.delivered', '$progress.total'] },
        },
        avgReadRate: {
          $avg: { $divide: ['$progress.read', '$progress.total'] },
        },
      },
    },
  ]);

  return {
    total,
    byStatus,
    avgDeliveryRate: rateStats[0]?.avgDeliveryRate
      ? Math.round(rateStats[0].avgDeliveryRate * 100)
      : 0,
    avgReadRate: rateStats[0]?.avgReadRate
      ? Math.round(rateStats[0].avgReadRate * 100)
      : 0,
  };
};

export const Broadcast = mongoose.model<IBroadcast>('Broadcast', BroadcastSchema);
export default Broadcast;
