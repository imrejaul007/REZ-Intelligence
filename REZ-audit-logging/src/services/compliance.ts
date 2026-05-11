import { v4 as uuidv4 } from 'uuid';
import {
  ComplianceFramework,
  ComplianceRequirement,
  ComplianceStatus,
  ComplianceIssue,
  AuditEvent,
  AuditFilter,
} from '../types/audit.types';
import { auditService } from './audit.service';

export class ComplianceService {
  private frameworks: Map<string, ComplianceFramework> = new Map();

  constructor() {
    this.initializeDefaultFrameworks();
  }

  private initializeDefaultFrameworks(): void {
    const gdpr: ComplianceFramework = {
      id: 'gdpr',
      name: 'General Data Protection Regulation',
      version: '2016/679',
      requirements: [
        { id: 'gdpr-1', description: 'Data processing records maintained', mandatory: true, checked: false },
        { id: 'gdpr-2', description: 'Consent mechanisms documented', mandatory: true, checked: false },
        { id: 'gdpr-3', description: 'Data subject rights implemented', mandatory: true, checked: false },
        { id: 'gdpr-4', description: 'Data breach notification procedures', mandatory: true, checked: false },
        { id: 'gdpr-5', description: 'Privacy by design principles', mandatory: true, checked: false },
      ],
    };

    const hipaa: ComplianceFramework = {
      id: 'hipaa',
      name: 'Health Insurance Portability and Accountability Act',
      version: '1996',
      requirements: [
        { id: 'hipaa-1', description: 'PHI access controls implemented', mandatory: true, checked: false },
        { id: 'hipaa-2', description: 'Audit trails for PHI access', mandatory: true, checked: false },
        { id: 'hipaa-3', description: 'Encryption of PHI at rest and in transit', mandatory: true, checked: false },
        { id: 'hipaa-4', description: 'Business associate agreements', mandatory: true, checked: false },
      ],
    };

    const soc2: ComplianceFramework = {
      id: 'soc2',
      name: 'SOC 2 Trust Service Criteria',
      version: '2017',
      requirements: [
        { id: 'soc2-1', description: 'Security controls documented', mandatory: true, checked: false },
        { id: 'soc2-2', description: 'Availability monitoring', mandatory: true, checked: false },
        { id: 'soc2-3', description: 'Confidentiality controls', mandatory: true, checked: false },
        { id: 'soc2-4', description: 'Privacy controls', mandatory: true, checked: false },
        { id: 'soc2-5', description: 'Processing integrity', mandatory: true, checked: false },
      ],
    };

    this.frameworks.set('gdpr', gdpr);
    this.frameworks.set('hipaa', hipaa);
    this.frameworks.set('soc2', soc2);
  }

  async checkCompliance(filter: AuditFilter = {}): Promise<ComplianceStatus> {
    const events = await auditService.getEvents({ ...filter, limit: undefined, offset: undefined });
    const issues: ComplianceIssue[] = [];
    let score = 100;

    const criticalEvents = events.filter(e =>
      e.status === 'failure' &&
      (e.eventType === 'authorization' || e.eventType === 'data_access')
    );

    if (criticalEvents.length > 0) {
      score -= Math.min(criticalEvents.length * 5, 30);
      issues.push({
        id: uuidv4(),
        severity: 'critical',
        description: `${criticalEvents.length} failed access control events detected`,
        affectedEvents: criticalEvents.map(e => e.id),
        remediation: 'Review and strengthen access control policies',
      });
    }

    const dataModificationEvents = events.filter(e => e.eventType === 'data_modification');
    const unauthorizedModifications = dataModificationEvents.filter(e => e.status === 'failure');

    if (unauthorizedModifications.length > 0) {
      score -= Math.min(unauthorizedModifications.length * 3, 15);
      issues.push({
        id: uuidv4(),
        severity: 'high',
        description: `${unauthorizedModifications.length} unauthorized data modifications blocked`,
        affectedEvents: unauthorizedModifications.map(e => e.id),
        remediation: 'Review data modification authorization policies',
      });
    }

    const adminActions = events.filter(e => e.eventType === 'admin_action');
    const failedAdminActions = adminActions.filter(e => e.status === 'failure');

    if (failedAdminActions.length > 0) {
      score -= Math.min(failedAdminActions.length * 2, 10);
      issues.push({
        id: uuidv4(),
        severity: 'medium',
        description: `${failedAdminActions.length} failed administrative actions`,
        affectedEvents: failedAdminActions.map(e => e.id),
      });
    }

    const authenticationEvents = events.filter(e => e.eventType === 'authentication');
    const failedAuth = authenticationEvents.filter(e => e.status === 'failure');

    if (failedAuth.length > 10) {
      score -= 5;
      issues.push({
        id: uuidv4(),
        severity: 'medium',
        description: `${failedAuth.length} failed authentication attempts detected`,
        affectedEvents: failedAuth.slice(0, 10).map(e => e.id),
        remediation: 'Consider implementing account lockout policies',
      });
    }

    for (const [id, framework] of this.frameworks) {
      const uncheckedRequirements = framework.requirements.filter(r => !r.checked && r.mandatory);
      if (uncheckedRequirements.length > 0) {
        score -= uncheckedRequirements.length * 2;
        issues.push({
          id: uuidv4(),
          severity: 'high',
          description: `${framework.name} has ${uncheckedRequirements.length} unchecked mandatory requirements`,
          affectedEvents: [],
          remediation: `Complete ${framework.name} compliance checklist`,
        });
      }
    }

    return {
      compliant: score >= 70,
      lastChecked: new Date(),
      issues,
      score: Math.max(0, score),
    };
  }

  getFrameworks(): ComplianceFramework[] {
    return Array.from(this.frameworks.values());
  }

  getFramework(id: string): ComplianceFramework | undefined {
    return this.frameworks.get(id);
  }

  updateRequirement(frameworkId: string, requirementId: string, checked: boolean): boolean {
    const framework = this.frameworks.get(frameworkId);
    if (!framework) return false;

    const requirement = framework.requirements.find(r => r.id === requirementId);
    if (!requirement) return false;

    requirement.checked = checked;
    requirement.lastVerified = new Date();
    return true;
  }

  addFramework(framework: ComplianceFramework): void {
    this.frameworks.set(framework.id, framework);
  }

  removeFramework(id: string): boolean {
    return this.frameworks.delete(id);
  }

  async getComplianceReport(filter: AuditFilter = {}): Promise<{
    status: ComplianceStatus;
    frameworks: ComplianceFramework[];
    recommendations: string[];
  }> {
    const status = await this.checkCompliance(filter);
    const recommendations: string[] = [];

    if (status.score < 70) {
      recommendations.push('Critical: Immediate action required to improve compliance score');
    }
    if (status.score < 85) {
      recommendations.push('Warning: Review and address compliance issues');
    }

    const criticalIssues = status.issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push('Critical security events detected - review access controls');
    }

    return {
      status,
      frameworks: this.getFrameworks(),
      recommendations,
    };
  }
}

export const complianceService = new ComplianceService();
