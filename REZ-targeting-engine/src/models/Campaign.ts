import mongoose, { Schema, Document } from 'mongoose';

export interface ICampaign extends Document {
  campaign_id: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  rules: {
    targeting: {
      user_segments: string[];
      exclusions: string[];
      recency_days: number;
      min_orders: number;
      custom_conditions?: Record<string, unknown>;
    };
    content: {
      ad_template_id: string;
      fallback_offer: string;
      personalization_enabled?: boolean;
      dynamic_content?: boolean;
    };
    budget: {
      daily_limit: number;
      cost_per_impression: number;
      lifetime_limit?: number;
      pacing_mode?: 'even' | 'accelerated' | 'front_loaded';
    };
    scheduling: {
      send_time: string;
      timezone: string;
      specific_time?: string;
      days_of_week?: number[];
      blacklisted_dates?: string[];
    };
  };
  ab_test_config?: {
    enabled: boolean;
    variants: Array<{
      id: string;
      name: string;
      weight: number;
      ad_template_id: string;
      description?: string;
    }>;
    primary_metric: string;
    min_sample_size: number;
    test_duration_days: number;
  };
  created_at: Date;
  updated_at: Date;
  start_date?: Date;
  end_date?: Date;
  created_by: string;
  metadata?: Record<string, unknown>;
}

const TargetingSchema = new Schema({
  user_segments: { type: [String], required: true, default: [] },
  exclusions: { type: [String], required: true, default: [] },
  recency_days: { type: Number, required: true, default: 30 },
  min_orders: { type: Number, required: true, default: 1 },
  custom_conditions: { type: Schema.Types.Mixed, default: {} }
}, { _id: false });

const ContentSchema = new Schema({
  ad_template_id: { type: String, required: true },
  fallback_offer: { type: String, required: true },
  personalization_enabled: { type: Boolean, default: false },
  dynamic_content: { type: Boolean, default: false }
}, { _id: false });

const BudgetSchema = new Schema({
  daily_limit: { type: Number, required: true, default: 1000 },
  cost_per_impression: { type: Number, required: true, default: 0.05 },
  lifetime_limit: { type: Number },
  pacing_mode: { type: String, enum: ['even', 'accelerated', 'front_loaded'], default: 'even' }
}, { _id: false });

const SchedulingSchema = new Schema({
  send_time: { type: String, required: true, default: 'optimal' },
  timezone: { type: String, required: true, default: 'user_preferred' },
  specific_time: { type: String },
  days_of_week: { type: [Number], default: [0, 1, 2, 3, 4, 5, 6] },
  blacklisted_dates: { type: [String], default: [] }
}, { _id: false });

const ABVariantSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  weight: { type: Number, required: true, min: 0, max: 100 },
  ad_template_id: { type: String, required: true },
  description: { type: String }
}, { _id: false });

const CampaignSchema = new Schema<ICampaign>({
  campaign_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'paused', 'completed', 'cancelled'],
    default: 'draft',
    index: true
  },
  rules: {
    targeting: { type: TargetingSchema, required: true },
    content: { type: ContentSchema, required: true },
    budget: { type: BudgetSchema, required: true },
    scheduling: { type: SchedulingSchema, required: true }
  },
  ab_test_config: {
    enabled: { type: Boolean, default: false },
    variants: { type: [ABVariantSchema], default: [] },
    primary_metric: { type: String, enum: ['ctr', 'conversion', 'engagement', 'revenue'], default: 'ctr' },
    min_sample_size: { type: Number, default: 100 },
    test_duration_days: { type: Number, default: 7 }
  },
  start_date: { type: Date },
  end_date: { type: Date },
  created_by: {
    type: String,
    required: true,
    index: true
  },
  metadata: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'campaigns'
});

// Indexes for efficient querying
CampaignSchema.index({ 'rules.targeting.user_segments': 1 });
CampaignSchema.index({ status: 1, start_date: 1, end_date: 1 });
CampaignSchema.index({ created_at: -1 });

// Virtual for checking if campaign is currently running
CampaignSchema.virtual('isRunning').get(function() {
  const now = new Date();
  const withinDateRange = (!this.start_date || this.start_date <= now) &&
                          (!this.end_date || this.end_date >= now);
  return this.status === 'active' && withinDateRange;
});

// Method to check if status transition is valid
CampaignSchema.methods.canTransitionTo = function(newStatus: string): boolean {
  const validTransitions: Record<string, string[]> = {
    draft: ['active', 'cancelled'],
    active: ['paused', 'completed', 'cancelled'],
    paused: ['active', 'cancelled'],
    completed: [],
    cancelled: []
  };
  return validTransitions[this.status]?.includes(newStatus) ?? false;
};

export const Campaign = mongoose.model<ICampaign>('Campaign', CampaignSchema);
