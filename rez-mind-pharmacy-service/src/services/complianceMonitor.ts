import { logger } from '../utils/logger';
import { ComplianceAlert, IComplianceAlert } from '../models';
import {
  ComplianceIssue,
  AlertType,
  AlertSeverity,
  DrugSchedule,
  SCHEDULE_RESTRICTIONS,
} from '../types';

interface ScheduleComplianceResult {
  isCompliant: boolean;
  issues: ComplianceIssue[];
  warnings: string[];
}

interface ValidityResult {
  isValid: boolean;
  issues: ComplianceIssue[];
  warnings: string[];
}

interface PrescriptionData {
  prescriptionId: string;
  patientId?: string;
  prescriberId?: string;
  isScheduleDrug?: boolean;
  schedule?: DrugSchedule;
  validUntil?: Date;
  issuedDate?: Date;
  refillsRemaining?: number;
  drugs?: Array<{ name: string; category: string }>;
}

export class ComplianceMonitorService {
  /**
   * Check schedule drug compliance
   */
  async checkScheduleCompliance(prescription: PrescriptionData): Promise<ScheduleComplianceResult> {
    logger.info('Checking schedule compliance', { prescriptionId: prescription.prescriptionId });

    const issues: ComplianceIssue[] = [];
    const warnings: string[] = [];

    if (!prescription.isScheduleDrug) {
      return { isCompliant: true, issues, warnings };
    }

    const schedule = prescription.schedule || DrugSchedule.NON_CONTROLLED;
    const restrictions = SCHEDULE_RESTRICTIONS[schedule];

    // Check ID requirement
    if (restrictions.idRequired) {
      warnings.push('Schedule drug - valid ID required for dispensing');
    }

    // Check refill limits
    if (prescription.refillsRemaining !== undefined) {
      const maxRefills = restrictions.refills;
      if (typeof maxRefills === 'number' && prescription.refillsRemaining > maxRefills) {
        issues.push({
          type: AlertType.SCHEDULE_DRUG,
          severity: AlertSeverity.CRITICAL,
          description: `Refills exceed schedule ${schedule} limit of ${maxRefills}`,
          relatedPrescriptionId: prescription.prescriptionId,
          recommendation: 'Limit refills to allowed maximum',
        });
      }
    }

    // Check validity period for schedule drugs
    if (prescription.validUntil) {
      const validUntil = new Date(prescription.validUntil);
      const now = new Date();

      if (validUntil < now) {
        issues.push({
          type: AlertType.INVALID_PRESCRIPTION,
          severity: AlertSeverity.CRITICAL,
          description: `Schedule ${schedule} prescription has expired`,
          relatedPrescriptionId: prescription.prescriptionId,
          recommendation: 'Do not dispense. Request new prescription.',
        });
      } else if (schedule === DrugSchedule.SCHEDULE_II) {
        // Schedule II prescriptions typically have shorter validity
        const daysUntilExpiry = Math.ceil(
          (validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysUntilExpiry <= 7) {
          warnings.push(`Schedule II prescription expires in ${daysUntilExpiry} days`);
        }
      }
    }

    // Schedule-specific warnings
    switch (schedule) {
      case DrugSchedule.SCHEDULE_I:
        issues.push({
          type: AlertType.SCHEDULE_DRUG,
          severity: AlertSeverity.CRITICAL,
          description: 'Schedule I drugs have no accepted medical use - verify prescription authenticity',
          relatedPrescriptionId: prescription.prescriptionId,
          recommendation: 'Contact prescriber for verification. Most Schedule I prescriptions are fraudulent.',
        });
        break;

      case DrugSchedule.SCHEDULE_II:
        if (prescription.refillsRemaining !== undefined && prescription.refillsRemaining > 0) {
          issues.push({
            type: AlertType.SCHEDULE_DRUG,
            severity: AlertSeverity.CRITICAL,
            description: 'Schedule II prescriptions do not allow refills',
            relatedPrescriptionId: prescription.prescriptionId,
            recommendation: 'Require new prescription for each dispensing',
          });
        }
        break;

      case DrugSchedule.SCHEDULE_III:
      case DrugSchedule.SCHEDULE_IV:
      case DrugSchedule.SCHEDULE_V:
        warnings.push(`Schedule ${schedule.replace('SCHEDULE_', '')} drug - follow standard dispensing protocols`);
        break;
    }

    logger.info('Schedule compliance check completed', {
      prescriptionId: prescription.prescriptionId,
      schedule,
      isCompliant: issues.length === 0,
      issueCount: issues.length,
    });

    return {
      isCompliant: issues.length === 0,
      issues,
      warnings,
    };
  }

  /**
   * Check prescription validity
   */
  checkPrescriptionValidity(prescription: PrescriptionData): ValidityResult {
    logger.info('Checking prescription validity', { prescriptionId: prescription.prescriptionId });

    const issues: ComplianceIssue[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!prescription.prescriptionId) {
      issues.push({
        type: AlertType.INVALID_PRESCRIPTION,
        severity: AlertSeverity.CRITICAL,
        description: 'Prescription ID is required',
        recommendation: 'Request valid prescription',
      });
    }

    if (!prescription.prescriberId) {
      issues.push({
        type: AlertType.INVALID_PRESCRIPTION,
        severity: AlertSeverity.HIGH,
        description: 'Prescriber information is missing',
        recommendation: 'Request complete prescription with prescriber details',
      });
    }

    // Check dates
    const now = new Date();

    if (prescription.issuedDate) {
      const issuedDate = new Date(prescription.issuedDate);
      if (issuedDate > now) {
        issues.push({
          type: AlertType.INVALID_PRESCRIPTION,
          severity: AlertSeverity.CRITICAL,
          description: 'Prescription issued date is in the future',
          relatedPrescriptionId: prescription.prescriptionId,
          recommendation: 'Verify prescription date. May be fraudulent.',
        });
      }

      // Typical prescription validity periods
      const daysSinceIssued = Math.ceil(
        (now.getTime() - issuedDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceIssued > 365) {
        warnings.push('Prescription is over 1 year old - may require renewal');
      }
    }

    if (prescription.validUntil) {
      const validUntil = new Date(prescription.validUntil);
      if (validUntil < now) {
        issues.push({
          type: AlertType.INVALID_PRESCRIPTION,
          severity: AlertSeverity.CRITICAL,
          description: 'Prescription has expired',
          relatedPrescriptionId: prescription.prescriptionId,
          recommendation: 'Request renewal from prescriber',
        });
      }
    } else {
      // Default validity check
      if (prescription.issuedDate) {
        const issuedDate = new Date(prescription.issuedDate);
        const daysSinceIssued = Math.ceil(
          (now.getTime() - issuedDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceIssued > 6) {
          warnings.push('Prescription validity should be confirmed with prescriber');
        }
      }
    }

    // Check for drug count
    if (prescription.drugs && prescription.drugs.length === 0) {
      issues.push({
        type: AlertType.INVALID_PRESCRIPTION,
        severity: AlertSeverity.CRITICAL,
        description: 'Prescription contains no medications',
        relatedPrescriptionId: prescription.prescriptionId,
        recommendation: 'Request corrected prescription',
      });
    }

    logger.info('Prescription validity check completed', {
      prescriptionId: prescription.prescriptionId,
      isValid: issues.length === 0,
      issueCount: issues.length,
    });

    return {
      isValid: issues.length === 0,
      issues,
      warnings,
    };
  }

  /**
   * Create compliance alert for issues found
   */
  async createAlert(
    merchantId: string,
    type: AlertType,
    severity: AlertSeverity,
    description: string,
    additionalData?: {
      prescriptionId?: string;
      patientId?: string;
      drugId?: string;
      relatedDrugName?: string;
    }
  ): Promise<IComplianceAlert> {
    const alert = new ComplianceAlert({
      alertId: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      merchantId,
      type,
      severity,
      description,
      isResolved: false,
      ...additionalData,
    });

    await alert.save();

    logger.info('Compliance alert created', {
      alertId: alert.alertId,
      merchantId,
      type,
      severity,
    });

    return alert;
  }

  /**
   * Get unresolved alerts for a merchant
   */
  async getUnresolvedAlerts(
    merchantId: string,
    options?: {
      severity?: AlertSeverity;
      type?: AlertType;
      limit?: number;
    }
  ): Promise<IComplianceAlert[]> {
    const query: any = { merchantId, isResolved: false };

    if (options?.severity) {
      query.severity = options.severity;
    }
    if (options?.type) {
      query.type = options.type;
    }

    return ComplianceAlert.find(query)
      .sort({ severity: -1, createdAt: -1 })
      .limit(options?.limit || 100)
      .lean();
  }

  /**
   * Resolve alerts
   */
  async resolveAlerts(
    alertIds: string[],
    resolvedBy: string,
    resolutionNotes?: string
  ): Promise<number> {
    const result = await ComplianceAlert.updateMany(
      { alertId: { $in: alertIds } },
      {
        $set: {
          isResolved: true,
          resolvedAt: new Date(),
          resolvedBy,
          resolutionNotes,
        },
      }
    );

    logger.info('Alerts resolved', {
      alertIds,
      resolvedBy,
      count: result.modifiedCount,
    });

    return result.modifiedCount;
  }
}

export const complianceMonitor = new ComplianceMonitorService();