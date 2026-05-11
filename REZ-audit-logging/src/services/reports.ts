import { v4 as uuidv4 } from 'uuid';
import { AuditEvent, AuditFilter, AuditReport } from '../types/audit.types';
import { auditService } from './audit.service';

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  filter: AuditFilter;
  format: 'json' | 'csv' | 'pdf';
  createdAt: Date;
}

export interface ScheduledReport {
  id: string;
  templateId: string;
  name: string;
  schedule: string;
  recipients: string[];
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

export class ReportsService {
  private templates: Map<string, ReportTemplate> = new Map();
  private scheduledReports: Map<string, ScheduledReport> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
  }

  private initializeDefaultTemplates(): void {
    const dailySummary: ReportTemplate = {
      id: 'daily-summary',
      name: 'Daily Audit Summary',
      description: 'Summary of all audit events from the last 24 hours',
      filter: {
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        limit: 1000,
      },
      format: 'json',
      createdAt: new Date(),
    };

    const securityReport: ReportTemplate = {
      id: 'security-report',
      name: 'Security Events Report',
      description: 'Failed authentication and authorization attempts',
      filter: {
        eventTypes: ['authentication', 'authorization'],
        status: 'failure',
        limit: 500,
      },
      format: 'json',
      createdAt: new Date(),
    };

    const dataAccessReport: ReportTemplate = {
      id: 'data-access-report',
      name: 'Data Access Report',
      description: 'All data access and modification events',
      filter: {
        eventTypes: ['data_access', 'data_modification', 'data_deletion'],
        limit: 1000,
      },
      format: 'json',
      createdAt: new Date(),
    };

    this.templates.set('daily-summary', dailySummary);
    this.templates.set('security-report', securityReport);
    this.templates.set('data-access-report', dataAccessReport);
  }

  async generateReport(filter: AuditFilter): Promise<AuditReport> {
    return auditService.generateReport(filter);
  }

  async generateReportFromTemplate(templateId: string): Promise<AuditReport | null> {
    const template = this.templates.get(templateId);
    if (!template) return null;

    return this.generateReport(template.filter);
  }

  getTemplates(): ReportTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplate(id: string): ReportTemplate | undefined {
    return this.templates.get(id);
  }

  createTemplate(template: Omit<ReportTemplate, 'id' | 'createdAt'>): ReportTemplate {
    const newTemplate: ReportTemplate = {
      ...template,
      id: uuidv4(),
      createdAt: new Date(),
    };
    this.templates.set(newTemplate.id, newTemplate);
    return newTemplate;
  }

  updateTemplate(id: string, updates: Partial<ReportTemplate>): ReportTemplate | null {
    const template = this.templates.get(id);
    if (!template) return null;

    const updated = { ...template, ...updates, id: template.id, createdAt: template.createdAt };
    this.templates.set(id, updated);
    return updated;
  }

  deleteTemplate(id: string): boolean {
    return this.templates.delete(id);
  }

  getScheduledReports(): ScheduledReport[] {
    return Array.from(this.scheduledReports.values());
  }

  getScheduledReport(id: string): ScheduledReport | undefined {
    return this.scheduledReports.get(id);
  }

  createScheduledReport(report: Omit<ScheduledReport, 'id'>): ScheduledReport {
    const newReport: ScheduledReport = {
      ...report,
      id: uuidv4(),
    };
    this.scheduledReports.set(newReport.id, newReport);
    return newReport;
  }

  updateScheduledReport(id: string, updates: Partial<ScheduledReport>): ScheduledReport | null {
    const report = this.scheduledReports.get(id);
    if (!report) return null;

    const updated = { ...report, ...updates, id: report.id };
    this.scheduledReports.set(id, updated);
    return updated;
  }

  deleteScheduledReport(id: string): boolean {
    return this.scheduledReports.delete(id);
  }

  async generateExecutiveSummary(filter: AuditFilter = {}): Promise<{
    period: { start: Date; end: Date };
    generatedAt: Date;
    overview: {
      totalEvents: number;
      uniqueUsers: number;
      uniqueResources: number;
    };
    riskAssessment: {
      highRiskEvents: number;
      mediumRiskEvents: number;
      lowRiskEvents: number;
    };
    topEventTypes: { type: string; count: number }[];
    failedEventsByUser: { userId: string; count: number }[];
    recommendations: string[];
  }> {
    const events = await auditService.getEvents({ ...filter, limit: undefined, offset: undefined });

    const uniqueUsers = new Set(events.map(e => e.userId).filter(Boolean)).size;
    const uniqueResources = new Set(events.map(e => e.resource)).size;

    let highRisk = 0, mediumRisk = 0, lowRisk = 0;

    for (const event of events) {
      if (event.status === 'failure') {
        if (event.eventType === 'authorization' || event.eventType === 'data_deletion') {
          highRisk++;
        } else if (event.eventType === 'data_modification' || event.eventType === 'admin_action') {
          mediumRisk++;
        } else {
          lowRisk++;
        }
      }
    }

    const eventTypeCounts: Record<string, number> = {};
    for (const event of events) {
      eventTypeCounts[event.eventType] = (eventTypeCounts[event.eventType] || 0) + 1;
    }

    const topEventTypes = Object.entries(eventTypeCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const failedByUser: Record<string, number> = {};
    for (const event of events.filter(e => e.status === 'failure' && e.userId)) {
      failedByUser[event.userId!] = (failedByUser[event.userId!] || 0) + 1;
    }

    const failedEventsByUser = Object.entries(failedByUser)
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const recommendations: string[] = [];

    if (highRisk > 5) {
      recommendations.push('High number of critical failures detected - immediate investigation required');
    }
    if (failedEventsByUser.length > 0 && failedEventsByUser[0].count > 10) {
      recommendations.push(`User ${failedEventsByUser[0].userId} has excessive failed attempts - consider account review`);
    }
    if (uniqueResources > 100) {
      recommendations.push('Wide range of resources accessed - ensure access controls are appropriate');
    }

    return {
      period: {
        start: filter.startDate || new Date(0),
        end: filter.endDate || new Date(),
      },
      generatedAt: new Date(),
      overview: {
        totalEvents: events.length,
        uniqueUsers,
        uniqueResources,
      },
      riskAssessment: {
        highRiskEvents: highRisk,
        mediumRiskEvents: mediumRisk,
        lowRiskEvents: lowRisk,
      },
      topEventTypes,
      failedEventsByUser,
      recommendations,
    };
  }

  async generateSecurityReport(filter: AuditFilter = {}): Promise<{
    summary: {
      totalAuthAttempts: number;
      failedAuth: number;
      failedAuthRate: number;
      totalAuthzAttempts: number;
      failedAuthz: number;
      failedAuthzRate: number;
    };
    suspiciousActivity: {
      multipleFailedAttempts: { userId: string; attempts: number }[];
      unusualAccessPatterns: AuditEvent[];
    };
    recommendations: string[];
  }> {
    const events = await auditService.getEvents({
      ...filter,
      eventTypes: ['authentication', 'authorization'],
      limit: undefined,
    });

    const authEvents = events.filter(e => e.eventType === 'authentication');
    const authzEvents = events.filter(e => e.eventType === 'authorization');

    const failedAuth = authEvents.filter(e => e.status === 'failure');
    const failedAuthz = authzEvents.filter(e => e.status === 'failure');

    const failedByUser: Record<string, number> = {};
    for (const event of failedAuth) {
      if (event.userId) {
        failedByUser[event.userId] = (failedByUser[event.userId] || 0) + 1;
      }
    }

    const multipleFailedAttempts = Object.entries(failedByUser)
      .filter(([, count]) => count >= 3)
      .map(([userId, attempts]) => ({ userId, attempts }))
      .sort((a, b) => b.attempts - a.attempts);

    const recommendations: string[] = [];

    if (multipleFailedAttempts.length > 0) {
      recommendations.push(`${multipleFailedAttempts.length} users with multiple failed attempts detected`);
    }

    if (failedAuth.length > 0 && authEvents.length > 0) {
      const authRate = (failedAuth.length / authEvents.length) * 100;
      if (authRate > 10) {
        recommendations.push(`High authentication failure rate (${authRate.toFixed(1)}%) - review authentication mechanisms`);
      }
    }

    return {
      summary: {
        totalAuthAttempts: authEvents.length,
        failedAuth: failedAuth.length,
        failedAuthRate: authEvents.length > 0 ? (failedAuth.length / authEvents.length) * 100 : 0,
        totalAuthzAttempts: authzEvents.length,
        failedAuthz: failedAuthz.length,
        failedAuthzRate: authzEvents.length > 0 ? (failedAuthz.length / authzEvents.length) * 100 : 0,
      },
      suspiciousActivity: {
        multipleFailedAttempts,
        unusualAccessPatterns: events.filter(e =>
          e.status === 'failure' &&
          (e.eventType === 'data_deletion' || e.eventType === 'admin_action')
        ),
      },
      recommendations,
    };
  }
}

export const reportsService = new ReportsService();
