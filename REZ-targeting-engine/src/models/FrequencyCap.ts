import mongoose, { Schema, Document } from 'mongoose';

export interface IFrequencyCap extends Document {
  user_id: string;
  campaign_id?: string;
  channel: string;
  impression_count: number;
  last_impression_at: Date;
  daily_limit: number;
  weekly_limit: number;
  lifetime_limit: number;
  daily_impressions: number;
  weekly_impressions: number;
  updated_at: Date;
}

const FrequencyCapSchema = new Schema<IFrequencyCap>({
  user_id: {
    type: String,
    required: true,
    index: true
  },
  campaign_id: {
    type: String,
    index: true
  },
  channel: {
    type: String,
    enum: ['banner', 'push', 'in_app', 'sms', 'email'],
    required: true
  },
  impression_count: {
    type: Number,
    required: true,
    default: 0
  },
  last_impression_at: {
    type: Date,
    default: Date.now
  },
  daily_limit: {
    type: Number,
    default: 5
  },
  weekly_limit: {
    type: Number,
    default: 15
  },
  lifetime_limit: {
    type: Number,
    default: 50
  },
  daily_impressions: {
    type: Number,
    default: 0
  },
  weekly_impressions: {
    type: Number,
    default: 0
  }
}, {
  timestamps: { updatedAt: 'updated_at', createdAt: false },
  collection: 'frequency_caps'
});

// Compound indexes
FrequencyCapSchema.index({ user_id: 1, channel: 1, campaign_id: 1 }, { unique: true });
FrequencyCapSchema.index({ last_impression_at: 1 });

// Static method to check if user is within frequency limits
FrequencyCapSchema.statics.canImpress = async function(
  userId: string,
  channel: string,
  campaignId?: string
): Promise<{ allowed: boolean; reason?: string; current_counts: object }> {
  const cap = await this.findOne({
    user_id: userId,
    channel,
    ...(campaignId ? { campaign_id: campaignId } : {})
  });

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  const dailyImpressions = cap?.last_impression_at && cap.last_impression_at >= today
    ? (cap.daily_impressions || 0)
    : 0;

  const weeklyImpressions = cap?.last_impression_at && cap.last_impression_at >= weekStart
    ? (cap.weekly_impressions || 0)
    : 0;

  const lifetimeImpressions = cap?.impression_count || 0;

  if (dailyImpressions >= (cap?.daily_limit || 5)) {
    return {
      allowed: false,
      reason: 'Daily frequency cap exceeded',
      current_counts: { daily: dailyImpressions, weekly: weeklyImpressions, lifetime: lifetimeImpressions }
    };
  }

  if (weeklyImpressions >= (cap?.weekly_limit || 15)) {
    return {
      allowed: false,
      reason: 'Weekly frequency cap exceeded',
      current_counts: { daily: dailyImpressions, weekly: weeklyImpressions, lifetime: lifetimeImpressions }
    };
  }

  if (lifetimeImpressions >= (cap?.lifetime_limit || 50)) {
    return {
      allowed: false,
      reason: 'Lifetime frequency cap exceeded',
      current_counts: { daily: dailyImpressions, weekly: weeklyImpressions, lifetime: lifetimeImpressions }
    };
  }

  return {
    allowed: true,
    current_counts: { daily: dailyImpressions, weekly: weeklyImpressions, lifetime: lifetimeImpressions }
  };
};

// Static method to record an impression
FrequencyCapSchema.statics.recordImpression = async function(
  userId: string,
  channel: string,
  campaignId?: string
) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  const result = await this.findOneAndUpdate(
    {
      user_id: userId,
      channel,
      ...(campaignId ? { campaign_id: campaignId } : {})
    },
    {
      $inc: {
        impression_count: 1,
        daily_impressions: 1,
        weekly_impressions: 1
      },
      $set: {
        last_impression_at: now,
        ...(campaignId ? { campaign_id: campaignId } : {})
      }
    },
    {
      upsert: true,
      new: true
    }
  );

  // Reset daily/weekly counters if needed
  if (result.last_impression_at < today || result.last_impression_at < weekStart) {
    await this.updateOne(
      { _id: result._id },
      {
        $set: {
          ...(result.last_impression_at < today ? { daily_impressions: 0 } : {}),
          ...(result.last_impression_at < weekStart ? { weekly_impressions: 0 } : {})
        }
      }
    );
  }

  return result;
};

export const FrequencyCap = mongoose.model<IFrequencyCap>('FrequencyCap', FrequencyCapSchema);
