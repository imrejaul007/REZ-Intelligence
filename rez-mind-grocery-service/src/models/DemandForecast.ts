import mongoose, { Document, Schema } from 'mongoose';
import { GroceryCategory, TrendDirection } from '../types';

export interface IDemandForecast extends Document {
  forecastId: string;
  merchantId: string;
  productId: string;
  productName: string;
  category: GroceryCategory;
  predictedQuantity: number;
  confidence: number;
  dateRange: {
    from: Date;
    to: Date;
  };
  actualQuantity?: number;
  accuracy?: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  trend: TrendDirection;
  seasonality?: {
    factor: number;
    peakMonths: string[];
  };
  influencingFactors: string[];
  createdAt: Date;
  updatedAt: Date;
}

const DemandForecastSchema = new Schema<IDemandForecast>(
  {
    forecastId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    merchantId: {
      type: String,
      required: true,
      index: true,
    },
    productId: {
      type: String,
      required: true,
    },
    productName: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: Object.values(GroceryCategory),
      required: true,
    },
    predictedQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.75,
    },
    dateRange: {
      from: {
        type: Date,
        required: true,
      },
      to: {
        type: Date,
        required: true,
      },
    },
    actualQuantity: {
      type: Number,
    },
    accuracy: {
      type: Number,
      min: 0,
      max: 100,
    },
    confidenceInterval: {
      lower: {
        type: Number,
        required: true,
      },
      upper: {
        type: Number,
        required: true,
      },
    },
    trend: {
      type: String,
      enum: Object.values(TrendDirection),
      default: TrendDirection.STABLE,
    },
    seasonality: {
      factor: { type: Number },
      peakMonths: { type: [String] },
    },
    influencingFactors: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
DemandForecastSchema.index({ merchantId: 1, productId: 1 });
DemandForecastSchema.index({ merchantId: 1, category: 1 });
DemandForecastSchema.index({ merchantId: 1, dateRange: 1 });
DemandForecastSchema.index({ merchantId: 1, trend: 1 });
DemandForecastSchema.index({ dateRange: 1, merchantId: 1 });

// TTL index - forecasts older than 180 days are archived
DemandForecastSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 180 * 24 * 60 * 60 }
);

// Static methods
DemandForecastSchema.statics.findByMerchant = function (merchantId: string) {
  return this.find({ merchantId })
    .sort({ dateRange: -1 })
    .exec();
};

DemandForecastSchema.statics.findByProduct = function (merchantId: string, productId: string) {
  return this.find({ merchantId, productId })
    .sort({ dateRange: -1 })
    .exec();
};

DemandForecastSchema.statics.findCurrentForecasts = function (merchantId: string) {
  const now = new Date();
  return this.find({
    merchantId,
    dateRange: { $gte: now },
  })
    .sort({ dateRange: 1 })
    .exec();
};

DemandForecastSchema.statics.findTrendUp = function (merchantId: string, limit = 20) {
  return this.find({
    merchantId,
    trend: TrendDirection.TRENDING_UP,
  })
    .sort({ predictedQuantity: -1 })
    .limit(limit)
    .exec();
};

DemandForecastSchema.statics.findTrendDown = function (merchantId: string, limit = 20) {
  return this.find({
    merchantId,
    trend: TrendDirection.TRENDING_DOWN,
  })
    .sort({ predictedQuantity: 1 })
    .limit(limit)
    .exec();
};

DemandForecastSchema.statics.updateActualQuantity = async function (
  forecastId: string,
  actualQuantity: number
) {
  const forecast = await this.findOne({ forecastId });
  if (!forecast) return null;

  const accuracy = Math.max(
    0,
    100 - Math.abs(actualQuantity - forecast.predictedQuantity) / forecast.predictedQuantity * 100
  );

  return this.findOneAndUpdate(
    { forecastId },
    { actualQuantity, accuracy, updatedAt: new Date() },
    { new: true }
  );
};

DemandForecastSchema.statics.getCategoryForecasts = function (merchantId: string, category: GroceryCategory) {
  return this.find({ merchantId, category })
    .sort({ dateRange: 1 })
    .exec();
};

DemandForecastSchema.statics.getMerchantTrendSummary = async function (merchantId: string) {
  const summary = await this.aggregate([
    { $match: { merchantId } },
    {
      $group: {
        _id: '$trend',
        count: { $sum: 1 },
        avgPredictedQuantity: { $avg: '$predictedQuantity' },
        avgConfidence: { $avg: '$confidence' },
      },
    },
  ]);

  return summary.map(s => ({
    trend: s._id,
    count: s.count,
    avgPredictedQuantity: Math.round(s.avgPredictedQuantity * 10) / 10,
    avgConfidence: Math.round(s.avgConfidence * 100) / 100,
  }));
};

// Instance method to check if forecast is within confidence interval
DemandForecastSchema.methods.isWithinConfidence = function (actualValue: number): boolean {
  return actualValue >= this.confidenceInterval.lower && actualValue <= this.confidenceInterval.upper;
};

// Instance method to calculate forecast error percentage
DemandForecastSchema.methods.calculateErrorPercentage = function (actualValue: number): number {
  if (this.predictedQuantity === 0) return 0;
  return Math.abs((actualValue - this.predictedQuantity) / this.predictedQuantity) * 100;
};

export const DemandForecast = mongoose.model<IDemandForecast>(
  'DemandForecast',
  DemandForecastSchema
);

export default DemandForecast;