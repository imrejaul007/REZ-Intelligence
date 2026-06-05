import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { AlertType, AlertSeverity } from '../types';

export interface IComplianceAlert extends Document {
  _id: mongoose.Types.ObjectId;
  alertId: string;
  merchantId: string;
  prescriptionId?: string;
  patientId?: string;
  drugId?: string;
  type: AlertType;
  severity: AlertSeverity;
  description: string;
  relatedDrugName?: string;
  isResolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ComplianceAlertSchema = new Schema<IComplianceAlert>(
  {
    alertId: {
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
    prescriptionId: {
      type: String,
      index: true,
    },
    patientId: {
      type: String,
      index: true,
    },
    drugId: {
      type: String,
    },
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
    description: {
      type: String,
      required: true,
    },
    relatedDrugName: {
      type: String,
    },
    isResolved: {
      type: Boolean,
      required: true,
      default: false,
    },
    resolvedAt: {
      type: Date,
    },
    resolvedBy: {
      type: String,
    },
    resolutionNotes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
ComplianceAlertSchema.index({ merchantId: 1, isResolved: 1, severity: 1 });
ComplianceAlertSchema.index({ merchantId: 1, type: 1, isResolved: 1 });
ComplianceAlertSchema.index({ patientId: 1, isResolved: 1 });
ComplianceAlertSchema.index({ prescriptionId: 1, isResolved: 1 });

// Index for finding alerts by drug
ComplianceAlertSchema.index({ drugId: 1, isResolved: 1 });

// Text index for search
ComplianceAlertSchema.index({
  description: 'text',
  relatedDrugName: 'text',
});

export const ComplianceAlert = mongoose.model<IComplianceAlert>(
  'ComplianceAlert',
  ComplianceAlertSchema
);