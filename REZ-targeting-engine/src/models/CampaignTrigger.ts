import mongoose, { Schema, Document } from 'mongoose';

export interface ICampaignTrigger extends Document {
  trigger_id: string;
  campaign_id: string;
  user_id: string;
  variant_id?: string;
  channel: 'banner' | 'push' | 'in_app' | 'sms' | 'email';
  status: 'queued' | 'sent' | 'delivered' | 'viewed' | 'clicked' | 'converted' | 'failed';
  sent_at?: Date;
  delivered_at?: Date;
  viewed_at?: Date;
  clicked_at?: Date;
  cost: number;
  revenue?: number;
  error?: string;
  metadata?: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

const CampaignTriggerSchema = new Schema<ICampaignTrigger>({
  trigger_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  campaign_id: {
    type: String,
    required: true,
    index: true
  },
  user_id: {
    type: String,
    required: true,
    index: true
  },
  variant_id: {
    type: String,
    index: true
  },
  channel: {
    type: String,
    enum: ['banner', 'push', 'in_app', 'sms', 'email'],
    required: true
  },
  status: {
    type: String,
    enum: ['queued', 'sent', 'delivered', 'viewed', 'clicked', 'converted', 'failed'],
    default: 'queued',
    index: true
  },
  sent_at: { type: Date },
  delivered_at: { type: Date },
  viewed_at: { type: Date },
  clicked_at: { type: Date },
  cost: {
    type: Number,
    required: true,
    default: 0
  },
  revenue: {
    type: Number,
    default: 0
  },
  error: { type: String },
  metadata: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'campaign_triggers'
});

// Compound indexes for efficient queries
CampaignTriggerSchema.index({ campaign_id: 1, status: 1 });
CampaignTriggerSchema.index({ campaign_id: 1, created_at: -1 });
CampaignTriggerSchema.index({ user_id: 1, created_at: -1 });
CampaignTriggerSchema.index({ variant_id: 1, status: 1 });

// TTL index to auto-delete old triggers (optional - 90 days retention)
CampaignTriggerSchema.index({ created_at: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Static method for bulk status updates
CampaignTriggerSchema.statics.bulkUpdateStatus = async function(
  triggerIds: string[],
  newStatus: string,
  additionalData?: Partial<ICampaignTrigger>
) {
  return this.updateMany(
    { trigger_id: { $in: triggerIds } },
    {
      $set: {
        status: newStatus,
        ...additionalData,
        updated_at: new Date()
      }
    }
  );
};

// Static method for getting campaign metrics
CampaignTriggerSchema.statics.getCampaignMetrics = async function(campaignId: string) {
  const pipeline = [
    { $match: { campaign_id: campaignId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        total_cost: { $sum: '$cost' },
        total_revenue: { $sum: '$revenue' }
      }
    }
  ];
  return this.aggregate(pipeline);
};

export const CampaignTrigger = mongoose.model<ICampaignTrigger>('CampaignTrigger', CampaignTriggerSchema);
