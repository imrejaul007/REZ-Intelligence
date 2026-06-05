import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { InteractionSeverity } from '../types';

export interface IDrugInteractionCheck extends Document {
  _id: mongoose.Types.ObjectId;
  checkId: string;
  merchantId: string;
  drugIds: string[];
  interactions: Array<{
    drug1: string;
    drug2: string;
    severity: InteractionSeverity;
    description: string;
    recommendation: string;
    mechanism?: string;
    clinicalEffects?: string[];
  }>;
  overallSeverity: InteractionSeverity;
  checkedAt: Date;
  checkedBy: string;
  patientId?: string;
  prescriptionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InteractionDetailSchema = new Schema({
  drug1: { type: String, required: true },
  drug2: { type: String, required: true },
  severity: {
    type: String,
    enum: Object.values(InteractionSeverity),
    required: true,
  },
  description: { type: String, required: true },
  recommendation: { type: String, required: true },
  mechanism: { type: String },
  clinicalEffects: [{ type: String }],
}, { _id: false });

const DrugInteractionCheckSchema = new Schema<IDrugInteractionCheck>(
  {
    checkId: {
      type: String,
      required: true,
      unique: true,
      default: () => uuidv4(),
      index: true,
    },
    merchantId: {
      type: String,
      required: true,
      index: true,
    },
    drugIds: [{
      type: String,
      required: true,
    }],
    interactions: [InteractionDetailSchema],
    overallSeverity: {
      type: String,
      enum: Object.values(InteractionSeverity),
      required: true,
    },
    checkedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    checkedBy: {
      type: String,
      required: true,
    },
    patientId: {
      type: String,
      index: true,
    },
    prescriptionId: {
      type: String,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
DrugInteractionCheckSchema.index({ merchantId: 1, checkedAt: -1 });
DrugInteractionCheckSchema.index({ patientId: 1, checkedAt: -1 });
DrugInteractionCheckSchema.index({ prescriptionId: 1, checkedAt: -1 });

// Index on drugIds array for finding historical interactions with specific drugs
DrugInteractionCheckSchema.index({ drugIds: 1 });
DrugInteractionCheckSchema.index({ merchantId: 1, overallSeverity: 1 });

// TTL index - interaction history expires after 1 year
DrugInteractionCheckSchema.index(
  { checkedAt: 1 },
  { expireAfterSeconds: 365 * 24 * 60 * 60 }
);

export const DrugInteractionCheck = mongoose.model<IDrugInteractionCheck>(
  'DrugInteractionCheck',
  DrugInteractionCheckSchema
);