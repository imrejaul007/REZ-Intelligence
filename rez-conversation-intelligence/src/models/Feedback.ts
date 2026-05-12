import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IFeedbackCorrection {
  messageId?: string;
  originalIntent: string;
  correctedIntent: string;
  explanation?: string;
}

export interface IFeedback extends Document {
  feedbackId: string;
  conversationId: string;
  type: 'rating' | 'correction' | 'suggestion' | 'escalation';
  rating?: number;
  corrections: IFeedbackCorrection[];
  suggestions: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';
  feedback?: string;
  metadata: Record<string, unknown>;
  status: 'pending' | 'processed' | 'reviewed' | 'applied';
  processedAt?: Date;
  reviewedAt?: Date;
  reviewerId?: string;
  reviewNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FeedbackCorrectionSchema = new Schema<IFeedbackCorrection>({
  messageId: { type: String },
  originalIntent: { type: String, required: true },
  correctedIntent: { type: String, required: true },
  explanation: String
}, { _id: false });

const FeedbackSchema = new Schema<IFeedback>({
  feedbackId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  conversationId: {
    type: String,
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['rating', 'correction', 'suggestion', 'escalation'],
    required: true,
    index: true
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  corrections: [FeedbackCorrectionSchema],
  suggestions: [String],
  sentiment: {
    type: String,
    enum: ['positive', 'neutral', 'negative']
  },
  feedback: {
    type: String,
    maxlength: 5000
  },
  metadata: { type: Schema.Types.Mixed, default: {} },
  status: {
    type: String,
    enum: ['pending', 'processed', 'reviewed', 'applied'],
    default: 'pending',
    index: true
  },
  processedAt: Date,
  reviewedAt: Date,
  reviewerId: String,
  reviewNotes: String
}, {
  timestamps: true
});

// Indexes for efficient querying
FeedbackSchema.index({ conversationId: 1, type: 1 });
FeedbackSchema.index({ status: 1, type: 1 });
FeedbackSchema.index({ createdAt: 1, status: 1 });

// Compound index for analytics
FeedbackSchema.index({ type: 1, rating: 1, createdAt: 1 });

export interface FeedbackModel extends Model<IFeedback> {
  findByConversation(conversationId: string): Promise<IFeedback[]>;
  findPendingCorrections(): Promise<IFeedback[]>;
  findPendingReviews(): Promise<IFeedback[]>;
  getRatingDistribution(startDate?: Date, endDate?: Date): Promise<Array<{ rating: number; count: number }>>;
  getFeedbackTrend(interval: string, startDate?: Date, endDate?: Date): Promise<Array<{ date: Date; avgRating: number; count: number }>>;
}

FeedbackSchema.statics.findByConversation = function(conversationId: string) {
  return this.find({ conversationId }).sort({ createdAt: -1 });
};

FeedbackSchema.statics.findPendingCorrections = function() {
  return this.find({
    type: 'correction',
    status: 'pending'
  }).sort({ createdAt: 1 });
};

FeedbackSchema.statics.findPendingReviews = function() {
  return this.find({
    status: 'processed'
  }).sort({ processedAt: 1 });
};

FeedbackSchema.statics.getRatingDistribution = async function(
  startDate?: Date,
  endDate?: Date
) {
  const matchStage: Record<string, unknown> = {
    type: 'rating',
    rating: { $exists: true, $ne: null }
  };
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = startDate;
    if (endDate) matchStage.createdAt.$lte = endDate;
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

FeedbackSchema.statics.getFeedbackTrend = async function(
  interval: string,
  startDate?: Date,
  endDate?: Date
) {
  const matchStage: Record<string, unknown> = {
    type: 'rating',
    rating: { $exists: true, $ne: null }
  };
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = startDate;
    if (endDate) matchStage.createdAt.$lte = endDate;
  }

  let dateFormat: string;
  switch (interval) {
    case 'hour':
      dateFormat = '%Y-%m-%d %H:00';
      break;
    case 'week':
      dateFormat = '%Y-W%V';
      break;
    case 'month':
      dateFormat = '%Y-%m';
      break;
    default:
      dateFormat = '%Y-%m-%d';
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
        avgRating: { $avg: '$rating' },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

export const Feedback = mongoose.model<IFeedback, FeedbackModel>(
  'Feedback',
  FeedbackSchema
);

export default Feedback;
