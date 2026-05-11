import mongoose, { Schema, Document } from 'mongoose';

export interface IBudgetPacing extends Document {
  campaign_id: string;
  daily_spent: number;
  daily_limit: number;
  lifetime_spent: number;
  lifetime_limit?: number;
  pacing_percentage: number;
  last_updated: Date;
  daily_reset_at: Date;
}

const BudgetPacingSchema = new Schema<IBudgetPacing>({
  campaign_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  daily_spent: {
    type: Number,
    required: true,
    default: 0
  },
  daily_limit: {
    type: Number,
    required: true,
    default: 1000
  },
  lifetime_spent: {
    type: Number,
    required: true,
    default: 0
  },
  lifetime_limit: {
    type: Number
  },
  pacing_percentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  last_updated: {
    type: Date,
    default: Date.now
  },
  daily_reset_at: {
    type: Date,
    default: () => {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      now.setDate(now.getDate() + 1);
      return now;
    }
  }
}, {
  timestamps: false,
  collection: 'budget_pacing'
});

// Static method to check if budget allows for more impressions
BudgetPacingSchema.statics.canSpend = async function(
  campaignId: string,
  costPerImpression: number,
  dailyLimit: number,
  lifetimeLimit?: number
): Promise<{ allowed: boolean; reason?: string; remaining_budget: object }> {
  const pacing = await this.findOne({ campaign_id: campaignId });
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  today.setHours(23, 59, 59, 999);

  // Check if daily reset is needed
  if (pacing?.daily_reset_at && now > pacing.daily_reset_at) {
    await this.updateOne(
      { campaign_id: campaignId },
      {
        $set: { daily_spent: 0, daily_reset_at: today }
      }
    );
  }

  const currentPacing = await this.findOne({ campaign_id: campaignId });
  const dailySpent = currentPacing?.daily_spent || 0;
  const lifetimeSpent = currentPacing?.lifetime_spent || 0;

  const dailyRemaining = dailyLimit - dailySpent;
  const lifetimeRemaining = lifetimeLimit ? lifetimeLimit - lifetimeSpent : Infinity;

  const impressionsPossible = Math.min(
    Math.floor(dailyRemaining / costPerImpression),
    Math.floor(lifetimeRemaining / costPerImpression)
  );

  if (impressionsPossible <= 0) {
    return {
      allowed: false,
      reason: dailyRemaining <= 0 ? 'Daily budget exhausted' : 'Lifetime budget exhausted',
      remaining_budget: { daily: dailyRemaining, lifetime: lifetimeRemaining }
    };
  }

  return {
    allowed: true,
    remaining_budget: { daily: dailyRemaining, lifetime: lifetimeRemaining }
  };
};

// Static method to record spend
BudgetPacingSchema.statics.recordSpend = async function(
  campaignId: string,
  amount: number,
  dailyLimit: number,
  lifetimeLimit?: number
) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  today.setHours(23, 59, 59, 999);

  return this.findOneAndUpdate(
    { campaign_id: campaignId },
    {
      $inc: {
        daily_spent: amount,
        lifetime_spent: amount
      },
      $set: {
        daily_limit: dailyLimit,
        lifetime_limit: lifetimeLimit,
        last_updated: now,
        pacing_percentage: Math.min(100, ((amount) / dailyLimit) * 100)
      },
      $setOnInsert: {
        daily_reset_at: today
      }
    },
    {
      upsert: true,
      new: true
    }
  );
};

// Calculate pacing based on mode
BudgetPacingSchema.statics.calculatePacingAmount = function(
  pacingMode: 'even' | 'accelerated' | 'front_loaded',
  dailyLimit: number,
  currentHour: number = new Date().getHours()
): number {
  const totalHours = 24;
  const remainingHours = totalHours - currentHour;

  switch (pacingMode) {
    case 'even':
      return dailyLimit / totalHours;
    case 'accelerated':
      return (dailyLimit * 1.5) / Math.max(remainingHours, 1);
    case 'front_loaded':
      if (currentHour < 12) {
        return dailyLimit / 12;
      }
      return (dailyLimit * 0.3) / remainingHours;
    default:
      return dailyLimit / totalHours;
  }
};

export const BudgetPacing = mongoose.model<IBudgetPacing>('BudgetPacing', BudgetPacingSchema);
