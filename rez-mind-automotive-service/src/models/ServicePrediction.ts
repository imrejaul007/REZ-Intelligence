import mongoose, { Schema, model, Document } from 'mongoose';
import { IServicePredictionRecord, IServiceHistory } from '../types';

export interface ServicePredictionDocument extends Omit<IServicePredictionRecord, '_id'>, Document {}

const serviceHistoryItemSchema = new Schema({
  serviceDate: { type: Date, required: true },
  serviceType: { type: String, enum: ['regular', 'repair', 'inspection'], required: true },
  kilometersAtService: { type: Number, required: true },
  items: [{
    name: String,
    cost: Number,
  }],
  totalCost: { type: Number, required: true },
}, { _id: false });

const predictionSchema = new Schema({
  nextServiceDue: { type: Date, required: true },
  nextServiceKm: { type: Number, required: true },
  serviceType: { type: String, enum: ['regular', 'repair', 'inspection'], required: true },
  estimatedCost: {
    min: { type: Number, required: true },
    max: { type: Number, required: true },
    avg: { type: Number, required: true },
  },
  confidence: { type: Number, required: true, min: 0, max: 1 },
  urgency: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
}, { _id: false });

const factorSchema = new Schema({
  type: { type: String, enum: ['usage_pattern', 'part_wear', 'time_based', 'km_based'], required: true },
  description: { type: String, required: true },
  impact: { type: String, enum: ['positive', 'negative'], required: true },
  weight: { type: Number, required: true },
}, { _id: false });

const recommendationSchema = new Schema({
  action: { type: String, required: true },
  priority: { type: String, enum: ['low', 'medium', 'high'], required: true },
  description: { type: String, required: true },
}, { _id: false });

const servicePredictionSchema = new Schema<ServicePredictionDocument>(
  {
    predictionId: { type: String, required: true, unique: true, index: true },
    vehicleId: { type: String, required: true, index: true },
    customerId: { type: String, index: true },
    merchantId: { type: String, required: true, index: true },
    serviceHistory: { type: [serviceHistoryItemSchema], default: [] },
    prediction: { type: predictionSchema, required: true },
    factors: { type: [factorSchema], default: [] },
    recommendations: { type: [recommendationSchema], default: [] },
    actualServiceDate: { type: Date },
    accuracy: { type: Number, min: 0, max: 1 },
  },
  { timestamps: true }
);

// Pre-save hook
servicePredictionSchema.pre('save', function (next) {
  if (!this.predictionId) {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.predictionId = `SPP-${timestamp}-${randomStr}`;
  }
  next();
});

// Static method to get predictions for vehicle
servicePredictionSchema.statics.getForVehicle = function (vehicleId: string) {
  return this.find({ vehicleId }).sort({ createdAt: -1 });
};

// Static method to get pending predictions (service due)
servicePredictionSchema.statics.getPendingService = function (merchantId: string) {
  return this.find({
    merchantId,
    actualServiceDate: { $exists: false },
    'prediction.nextServiceDue': { $lte: new Date() },
  }).sort({ 'prediction.urgency': -1, 'prediction.nextServiceDue': 1 });
};

// Static method to get predictions needing update (accuracy calculation)
servicePredictionSchema.statics.getPendingAccuracyUpdate = function (limit: number = 100) {
  return this.find({
    actualServiceDate: { $exists: true },
    accuracy: { $exists: false },
  }).limit(limit);
};

// Ensure virtuals are included
servicePredictionSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const ServicePrediction = model<ServicePredictionDocument>('ServicePrediction', servicePredictionSchema);