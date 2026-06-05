import mongoose, { Document, Schema } from 'mongoose';
import { EventType, AttendancePrediction, PricingOptimization, VendorMatch } from '../types';

export interface IEventsMindSession extends Document {
  sessionId: string;
  eventId: string;
  organizerId?: string;
  intent: string;
  context: {
    eventType?: string;
    eventDate?: Date;
    venue?: string;
    capacity?: number;
  };
  analysis: {
    attendancePrediction?: any;
    pricingOptimization?: any;
    vendorMatches?: any[];
    marketingCampaign?: any;
    guestSatisfaction?: any;
  };
  sentiment?: number;
  createdAt: Date;
  updatedAt: Date;
}

const EventsMindSessionSchema = new Schema<IEventsMindSession>(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    eventId: { type: String, required: true, index: true },
    organizerId: { type: String, index: true },
    intent: { type: String, required: true, default: 'events_consultation' },
    context: {
      eventType: { type: String, enum: Object.values(EventType) },
      eventDate: Date,
      venue: String,
      capacity: Number,
    },
    analysis: {
      attendancePrediction: {
        predictionId: String,
        eventId: String,
        predictedAttendance: Number,
        confidence: Number,
        confidenceInterval: { lower: Number, upper: Number },
        demandLevel: String,
        factors: [String],
        predictionDate: Date,
      },
      pricingOptimization: {
        optimizationId: String,
        eventId: String,
        currentPrice: Number,
        optimizedPrice: Number,
        demandLevel: String,
        confidence: Number,
        factors: [String],
      },
      vendorMatches: [{
        matchId: String,
        vendorId: String,
        vendorName: String,
        category: String,
        matchScore: Number,
      }],
      marketingCampaign: {
        campaignId: String,
        eventId: String,
        channels: [String],
        budgetAllocation: Map,
        expectedReach: Number,
        recommendations: [String],
      },
    },
    sentiment: { type: Number, min: -1, max: 1 },
  },
  { timestamps: true }
);

EventsMindSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 });
EventsMindSessionSchema.index({ eventId: 1, createdAt: -1 });

EventsMindSessionSchema.statics.findByEvent = function (eventId: string, limit = 50) {
  return this.find({ eventId }).sort({ createdAt: -1 }).limit(limit).exec();
};

export const EventsMindSession = mongoose.model<IEventsMindSession>('EventsMindSession', EventsMindSessionSchema);
export default EventsMindSession;