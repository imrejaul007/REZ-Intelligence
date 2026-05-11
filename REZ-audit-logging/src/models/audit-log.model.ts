import mongoose, { Schema, Document } from 'mongoose';
import { AuditEventType } from '../types/audit.types';

// TTL: 365 days in seconds (31,536,000 seconds)
const TTL_SECONDS = 365 * 24 * 60 * 60;

export interface IAuditLogDocument extends Document {
  id: string;
  tenantId: string;
  eventType: AuditEventType;
  action: string;
  resource: string;
  resourceId?: string;
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  status: 'success' | 'failure' | 'warning';
  details?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  correlationId?: string;
  timestamp: Date;
  expiresAt?: Date; // TTL index field
}

const AuditLogSchema = new Schema<IAuditLogDocument>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      enum: [
        'authentication',
        'authorization',
        'data_access',
        'data_modification',
        'data_deletion',
        'configuration_change',
        'admin_action',
        'api_call',
        'system_event',
        'compliance_event',
      ],
    },
    action: {
      type: String,
      required: true,
    },
    resource: {
      type: String,
      required: true,
    },
    resourceId: {
      type: String,
    },
    userId: {
      type: String,
      index: true,
    },
    userEmail: {
      type: String,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    status: {
      type: String,
      required: true,
      enum: ['success', 'failure', 'warning'],
    },
    details: {
      type: Schema.Types.Mixed,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    correlationId: {
      type: String,
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
      expires: TTL_SECONDS,
    },
  },
  {
    timestamps: true,
    collection: 'audit_logs',
  }
);

// Compound indexes for efficient querying
AuditLogSchema.index({ tenantId: 1, timestamp: -1 });
AuditLogSchema.index({ tenantId: 1, userId: 1, timestamp: -1 });
AuditLogSchema.index({ tenantId: 1, eventType: 1, timestamp: -1 });
AuditLogSchema.index({ tenantId: 1, resource: 1, timestamp: -1 });
AuditLogSchema.index({ tenantId: 1, status: 1, timestamp: -1 });
AuditLogSchema.index({ correlationId: 1, timestamp: -1 });

export const AuditLogModel = mongoose.model<IAuditLogDocument>('AuditLog', AuditLogSchema);
