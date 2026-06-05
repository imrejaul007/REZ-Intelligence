import mongoose, { Document, Schema } from 'mongoose';
import { DemandLevel, EventType } from '../types';

export interface IAttendancePrediction extends Document {
  predictionId: string;
  eventId: string;
  eventName?: string;
  eventType: EventType;
  predictedAttendance: number;
  confidence: number;
  confidenceInterval: { lower: number; upper: number };
  demandLevel: DemandLevel;
  factors: string[];
  predictionDate: Date;
  actualAttendance?: number;
  accuracy?: number;
  createdAt: Date;
  updatedAt: Date;
}

const AttendancePredictionSchema = new Schema<IAttendancePrediction>(
  {
    predictionId: { type: String, required: true, unique: true, index: true },
    eventId: { type: String, required: true, index: true },
    eventName: { type: String },
    eventType: { type: String, enum: Object.values(EventType), required: true },
    predictedAttendance: { type: Number, required: true, min: 0 },
    confidence: { type: Number, min: 0, max: 1, default: 0.75 },
    confidenceInterval: {
      lower: { type: Number, required: true },
      upper: { type: Number, required: true },
    },
    demandLevel: { type: String, enum: Object.values(DemandLevel), default: DemandLevel.MEDIUM },
    factors: { type: [String], default: [] },
    predictionDate: { type: Date, required: true },
    actualAttendance: { type: Number },
    accuracy: { type: Number, min: 0, max: 100 },
  },
  { timestamps: true }
);

AttendancePredictionSchema.index({ eventId: 1, predictionDate: -1 });
AttendancePredictionSchema.index({ eventId: 1, demandLevel: 1 });

AttendancePredictionSchema.statics.findByEvent = function (eventId: string) {
  return this.find({ eventId }).sort({ predictionDate: -1 }).exec();
};

AttendancePredictionSchema.statics.updateActualAttendance = async function (predictionId: string, actualAttendance: number) {
  const prediction = await this.findOne({ predictionId });
  if (!prediction) return null;
  const accuracy = Math.max(0, 100 - Math.abs(actualAttendance - prediction.predictedAttendance) / prediction.predictedAttendance * 100);
  return this.findOneAndUpdate({ predictionId }, { actualAttendance, accuracy, updatedAt: new Date() }, { new: true });
};

export const AttendancePrediction = mongoose.model<IAttendancePrediction>('AttendancePrediction', AttendancePredictionSchema);
export default AttendancePrediction;