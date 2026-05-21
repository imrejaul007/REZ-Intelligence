import mongoose, { Schema, Document } from 'mongoose';
import {
  TemplateCategory,
  TemplateStatus,
  TemplateComponent,
  TemplateButton,
} from '../types/whatsapp';

export interface ITemplate extends Document {
  _id: mongoose.Types.ObjectId;
  templateId: string;
  name: string;
  businessAccountId: string;
  category: TemplateCategory;
  language: string;
  components: TemplateComponent[];
  status: TemplateStatus;
  twilioTemplateSid?: string;
  merchantId?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
  validateForSending(): Promise<{ valid: boolean; errors: string[] }>;
  whatsapp: any;
}

const TemplateButtonSchema = new Schema<TemplateButton>(
  {
    type: {
      type: String,
      enum: ['url', 'phone_number', 'quick_reply', 'copy_code'],
      required: true,
    },
    text: { type: String, required: true, maxlength: 25 },
    url: { type: String },
    phone_number: { type: String },
    code: { type: String },
  },
  { _id: false }
);

const TemplateComponentSchema = new Schema<TemplateComponent>(
  {
    type: {
      type: String,
      enum: ['header', 'body', 'footer', 'button'],
      required: true,
    },
    format: {
      type: String,
      enum: ['text', 'image', 'video', 'document'],
    },
    text: { type: String },
    example: {
      header_text: { type: [String] },
      body_text: { type: [[String]] },
    },
    buttons: { type: [TemplateButtonSchema] },
  },
  { _id: false }
);

const TemplateSchema = new Schema<ITemplate>(
  {
    templateId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      maxlength: 512,
      index: true,
    },
    businessAccountId: {
      type: String,
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: Object.values(TemplateCategory),
      required: true,
    },
    language: {
      type: String,
      default: 'en',
      index: true,
    },
    components: {
      type: [TemplateComponentSchema],
      required: true,
      validate: {
        validator: function (components: TemplateComponent[]) {
          return components && components.length > 0;
        },
        message: 'Template must have at least one component',
      },
    },
    status: {
      type: String,
      enum: Object.values(TemplateStatus),
      default: TemplateStatus.PENDING,
      index: true,
    },
    twilioTemplateSid: {
      type: String,
      index: true,
    },
    merchantId: {
      type: String,
      index: true,
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

// Compound indexes
TemplateSchema.index({ merchantId: 1, status: 1 });
TemplateSchema.index({ businessAccountId: 1, status: 1 });
TemplateSchema.index({ category: 1, language: 1 });

// Pre-save validation
TemplateSchema.pre('save', function (next) {
  // Ensure body component exists for non-button-only templates
  const hasBody = this.components.some((c) => c.type === 'body');
  const hasButtons = this.components.some((c) => c.type === 'button');

  if (!hasBody && !hasButtons) {
    next(
      new Error('Template must have at least a body or button component')
    );
    return;
  }

  // Validate header format
  const header = this.components.find((c) => c.type === 'header');
  if (header?.format && ['image', 'video', 'document'].includes(header.format)) {
    if (!header.example?.header_text?.[0]) {
      next(
        new Error(
          'Media header requires example header text for approval'
        )
      );
      return;
    }
  }

  next();
});

// Instance methods
TemplateSchema.methods.validateForSending = function (): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (this.status !== TemplateStatus.APPROVED) {
    errors.push(`Template is not approved (status: ${this.status})`);
  }

  const body = this.components.find((c) => c.type === 'body');
  if (!body?.text) {
    errors.push('Template missing body text');
  }

  // Check for body variable placeholders
  const textWithVariables = body?.text?.match(/{{(\d+)}}/g) || [];
  const bodyExamples = body?.example?.body_text?.[0] || [];
  if (textWithVariables.length > 0 && bodyExamples.length < textWithVariables.length) {
    errors.push(
      `Body has ${textWithVariables.length} variables but only ${bodyExamples.length} examples provided`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

TemplateSchema.methods.getHeaderText = function (): string | undefined {
  const header = this.components.find((c) => c.type === 'header');
  return header?.text;
};

TemplateSchema.methods.getBodyText = function (): string | undefined {
  const body = this.components.find((c) => c.type === 'body');
  return body?.text;
};

TemplateSchema.methods.getFooterText = function (): string | undefined {
  const footer = this.components.find((c) => c.type === 'footer');
  return footer?.text;
};

TemplateSchema.methods.getButtons = function (): TemplateButton[] {
  const buttonComponent = this.components.find((c) => c.type === 'button');
  return buttonComponent?.buttons || [];
};

// Static methods
TemplateSchema.statics.findByMerchant = function (
  merchantId: string,
  options?: { status?: TemplateStatus; category?: TemplateCategory }
): Promise<ITemplate[]> {
  const query: Record<string, unknown> = {
    $or: [{ merchantId }, { merchantId: { $exists: false } }],
  };

  if (options?.status) {
    query.status = options.status;
  }
  if (options?.category) {
    query.category = options.category;
  }

  return this.find(query).sort({ createdAt: -1 });
};

TemplateSchema.statics.findApprovedByName = function (
  name: string,
  language?: string
): Promise<ITemplate | null> {
  const query: Record<string, unknown> = {
    name,
    status: TemplateStatus.APPROVED,
  };
  if (language) {
    query.language = language;
  }
  return this.findOne(query);
};

TemplateSchema.statics.findByTwilioSid = function (
  twilioSid: string
): Promise<ITemplate | null> {
  return this.findOne({ twilioTemplateSid: twilioSid });
};

export const Template = mongoose.model<ITemplate>('Template', TemplateSchema);
export default Template;
