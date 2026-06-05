import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import {
  DrugCategory,
  SessionType,
  InteractionSeverity,
  AlertSeverity,
  AlertType,
} from '../types';

export interface IPharmacyMindSession extends Document {
  _id: mongoose.Types.ObjectId;
  sessionId: string;
  merchantId: string;
  pharmacistId?: string;
  patientId?: string;
  sessionType: SessionType;
  context: {
    drugs?: Array<{
      drugId: string;
      name: string;
      category: DrugCategory;
      dosage: string;
    }>;
    prescriptionId?: string;
    customerProfile?: {
      customerId: string;
      conditions: string[];
      allergies: string[];
    };
  };
  analysis: {
    interactions?: Array<{
      drug1: string;
      drug2: string;
      severity: InteractionSeverity;
      description: string;
      recommendation: string;
    }>;
    complianceIssues?: Array<{
      type: AlertType;
      severity: AlertSeverity;
      description: string;
    }>;
    inventoryAlerts?: Array<{
      drugId: string;
      drugName: string;
      alertType: string;
      message: string;
    }>;
    recommendations?: string[];
  };
  recommendations: string[];
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
}

const DrugSchema = new Schema({
  drugId: { type: String, required: true },
  name: { type: String, required: true },
  category: {
    type: String,
    enum: Object.values(DrugCategory),
    required: true,
  },
  dosage: { type: String, required: true },
}, { _id: false });

const CustomerProfileSchema = new Schema({
  customerId: { type: String, required: true },
  conditions: [{ type: String }],
  allergies: [{ type: String }],
}, { _id: false });

const ContextSchema = new Schema({
  drugs: [DrugSchema],
  prescriptionId: { type: String },
  customerProfile: CustomerProfileSchema,
}, { _id: false });

const InteractionSchema = new Schema({
  drug1: { type: String, required: true },
  drug2: { type: String, required: true },
  severity: {
    type: String,
    enum: Object.values(InteractionSeverity),
    required: true,
  },
  description: { type: String, required: true },
  recommendation: { type: String, required: true },
}, { _id: false });

const ComplianceIssueSchema = new Schema({
  type: {
    type: String,
    enum: Object.values(AlertType),
    required: true,
  },
  severity: {
    type: String,
    enum: Object.values(AlertSeverity),
    required: true,
  },
  description: { type: String, required: true },
}, { _id: false });

const InventoryAlertSchema = new Schema({
  drugId: { type: String, required: true },
  drugName: { type: String, required: true },
  alertType: { type: String, required: true },
  message: { type: String, required: true },
}, { _id: false });

const AnalysisSchema = new Schema({
  interactions: [InteractionSchema],
  complianceIssues: [ComplianceIssueSchema],
  inventoryAlerts: [InventoryAlertSchema],
  recommendations: [{ type: String }],
}, { _id: false });

const PharmacyMindSessionSchema = new Schema<IPharmacyMindSession>(
  {
    sessionId: {
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
    pharmacistId: {
      type: String,
      index: true,
    },
    patientId: {
      type: String,
      index: true,
    },
    sessionType: {
      type: String,
      enum: Object.values(SessionType),
      required: true,
    },
    context: {
      type: ContextSchema,
      required: true,
    },
    analysis: {
      type: AnalysisSchema,
      required: true,
    },
    recommendations: [{
      type: String,
    }],
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
      default: 0.5,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
PharmacyMindSessionSchema.index({ merchantId: 1, createdAt: 1 });
PharmacyMindSessionSchema.index({ patientId: 1, createdAt: 1 });
PharmacyMindSessionSchema.index({ pharmacistId: 1, createdAt: 1 });

// Text index for search capabilities
PharmacyMindSessionSchema.index({
  'context.drugs.name': 'text',
  'recommendations': 'text',
});

// TTL index - sessions expire after 60 days
PharmacyMindSessionSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 24 * 60 * 60 }
);

export const PharmacyMindSession = mongoose.model<IPharmacyMindSession>(
  'PharmacyMindSession',
  PharmacyMindSessionSchema
);