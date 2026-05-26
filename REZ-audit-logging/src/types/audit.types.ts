export interface AuditEvent {
  id: string;
  tenantId?: string;
  timestamp: Date;
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
}

export interface CreateAuditEventInput {
  tenantId?: string;
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
}

export type AuditEventType =
  | 'authentication'
  | 'authorization'
  | 'data_access'
  | 'data_modification'
  | 'data_deletion'
  | 'configuration_change'
  | 'admin_action'
  | 'api_call'
  | 'system_event'
  | 'compliance_event';

export interface AuditFilter {
  startDate?: Date;
  endDate?: Date;
  eventTypes?: AuditEventType[];
  userId?: string;
  resource?: string;
  status?: 'success' | 'failure' | 'warning';
  correlationId?: string;
  limit?: number;
  offset?: number;
}

export interface AuditReport {
  id: string;
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalEvents: number;
    successCount: number;
    failureCount: number;
    warningCount: number;
    eventsByType: Record<string, number>;
  };
  events: AuditEvent[];
  complianceStatus?: ComplianceStatus;
}

export interface ComplianceStatus {
  compliant: boolean;
  lastChecked: Date;
  issues: ComplianceIssue[];
  score: number;
}

export interface ComplianceIssue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  affectedEvents: string[];
  remediation?: string;
}

export interface ComplianceFramework {
  id: string;
  name: string;
  version: string;
  requirements: ComplianceRequirement[];
}

export interface ComplianceRequirement {
  id: string;
  description: string;
  mandatory: boolean;
  checked: boolean;
  lastVerified?: Date;
}
