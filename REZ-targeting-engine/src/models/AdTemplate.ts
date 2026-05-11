import mongoose, { Schema, Document } from 'mongoose';

export interface IAdTemplate extends Document {
  template_id: string;
  name: string;
  channel: 'banner' | 'push' | 'in_app' | 'sms' | 'email';
  content: {
    headline?: string;
    body: string;
    cta_text?: string;
    cta_url?: string;
    image_url?: string;
    deep_link?: string;
    metadata?: Record<string, any>;
  };
  design: {
    layout: string;
    colors?: {
      primary?: string;
      secondary?: string;
      background?: string;
      text?: string;
    };
    font_size?: string;
    spacing?: string;
  };
  targeting?: {
    min_age?: number;
    max_age?: number;
    preferred_segments?: string[];
  };
  created_at: Date;
  updated_at: Date;
  is_active: boolean;
}

const TemplateContentSchema = new Schema({
  headline: { type: String, maxlength: 100 },
  body: { type: String, required: true, maxlength: 500 },
  cta_text: { type: String, maxlength: 30 },
  cta_url: { type: String },
  image_url: { type: String },
  deep_link: { type: String },
  metadata: { type: Schema.Types.Mixed, default: {} }
}, { _id: false });

const TemplateDesignSchema = new Schema({
  layout: { type: String, required: true, default: 'standard' },
  colors: {
    primary: { type: String },
    secondary: { type: String },
    background: { type: String },
    text: { type: String }
  },
  font_size: { type: String },
  spacing: { type: String }
}, { _id: false });

const AdTemplateSchema = new Schema<IAdTemplate>({
  template_id: {
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
  channel: {
    type: String,
    enum: ['banner', 'push', 'in_app', 'sms', 'email'],
    required: true,
    index: true
  },
  content: {
    type: TemplateContentSchema,
    required: true
  },
  design: {
    type: TemplateDesignSchema,
    required: true,
    default: () => ({ layout: 'standard' })
  },
  targeting: {
    min_age: { type: Number, min: 0, max: 120 },
    max_age: { type: Number, min: 0, max: 120 },
    preferred_segments: { type: [String], default: [] }
  },
  is_active: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'ad_templates'
});

// Compound indexes
AdTemplateSchema.index({ channel: 1, is_active: 1 });

export const AdTemplate = mongoose.model<IAdTemplate>('AdTemplate', AdTemplateSchema);
