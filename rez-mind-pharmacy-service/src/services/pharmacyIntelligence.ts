import { logger } from '../utils/logger';
import { interactionChecker } from './interactionChecker';
import { complianceMonitor } from './complianceMonitor';
import {
  InteractionResult,
  ComplianceResult,
  RefillPrediction,
  InventoryRecommendation,
  DrugInteraction,
  DrugInfo,
  AlertSeverity,
  DrugCategory,
} from '../types';
import { COMMON_DRUG_INTERACTIONS } from '../config/knowledge';

export class PharmacyIntelligenceService {
  /**
   * Check drug interactions for a list of drugs
   */
  async checkInteractions(drugIds: string[]): Promise<InteractionResult> {
    logger.info('Checking drug interactions', { drugIds });

    try {
      const interactions = await interactionChecker.checkDrugInteractions(drugIds);

      // Generate recommendations based on findings
      const recommendations = this.generateInteractionRecommendations(interactions);

      // Calculate overall severity
      let overallSeverity: 'NONE' | 'MILD' | 'MODERATE' | 'SEVERE' = 'NONE';
      if (interactions.length > 0) {
        if (interactions.some(i => i.severity === 'SEVERE')) {
          overallSeverity = 'SEVERE';
        } else if (interactions.some(i => i.severity === 'MODERATE')) {
          overallSeverity = 'MODERATE';
        } else {
          overallSeverity = 'MILD';
        }
      }

      // Calculate confidence
      const confidence = this.calculateInteractionConfidence(interactions);

      return {
        interactions,
        overallSeverity,
        hasInteractions: interactions.length > 0,
        recommendations,
        confidence,
      };
    } catch (error) {
      logger.error('Error checking interactions', { error, drugIds });
      throw error;
    }
  }

  /**
   * Analyze prescription for compliance issues
   */
  async analyzePrescription(prescription: {
    prescriptionId: string;
    patientId: string;
    drugs: DrugInfo[];
    isScheduleDrug?: boolean;
    validUntil?: Date;
    refillsRemaining?: number;
  }): Promise<ComplianceResult> {
    logger.info('Analyzing prescription', {
      prescriptionId: prescription.prescriptionId,
      patientId: prescription.patientId,
      drugCount: prescription.drugs.length,
    });

    try {
      // Check schedule compliance if applicable
      const scheduleCompliance = prescription.isScheduleDrug
        ? await complianceMonitor.checkScheduleCompliance(prescription as any)
        : { isCompliant: true, issues: [], warnings: [] };

      // Check prescription validity
      const validity = complianceMonitor.checkPrescriptionValidity(prescription as any);

      // Check for drug interactions
      const drugIds = prescription.drugs.map(d => d.drugId);
      const interactions = await interactionChecker.checkDrugInteractions(drugIds);

      // Combine all results
      const allIssues = [
        ...scheduleCompliance.issues,
        ...validity.issues,
      ];

      const allWarnings = [
        ...scheduleCompliance.warnings,
        ...validity.warnings,
        ...interactions.map(i => `${i.drug1} + ${i.drug2}: ${i.description}`),
      ];

      // Generate alerts from issues
      const alerts = allIssues.map(issue => ({
        alertId: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        merchantId: 'unknown',
        prescriptionId: prescription.prescriptionId,
        patientId: prescription.patientId,
        type: issue.type,
        severity: issue.severity,
        description: issue.description,
        isResolved: false,
        createdAt: new Date(),
      }));

      return {
        isCompliant: allIssues.length === 0,
        issues: allIssues,
        warnings: allWarnings,
        alerts,
      };
    } catch (error) {
      logger.error('Error analyzing prescription', { error, prescriptionId: prescription.prescriptionId });
      throw error;
    }
  }

  /**
   * Predict refills for a customer
   */
  async predictRefills(customerId: string): Promise<RefillPrediction[]> {
    logger.info('Predicting refills', { customerId });

    try {
      // In production, this would query actual pharmacy/service data
      // Mock implementation returning expected structure
      const predictions: RefillPrediction[] = [
        {
          customerId,
          drugId: 'drug_chronic_001',
          drugName: 'Lisinopril 10mg',
          lastFillDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
          daysSupply: 30,
          predictedRefillDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          urgency: AlertSeverity.HIGH,
          confidence: 0.92,
          reasons: [
            'Chronic medication with consistent refill pattern',
            'Days supply matches predicted refill window',
          ],
          suggestedActions: [
            'Send reminder 5 days before predicted refill date',
            'Pre-authorize refill if customer has good history',
          ],
        },
        {
          customerId,
          drugId: 'drug_chronic_002',
          drugName: 'Metformin 500mg',
          lastFillDate: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
          daysSupply: 30,
          predictedRefillDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          urgency: AlertSeverity.CRITICAL,
          confidence: 0.95,
          reasons: [
            'Due for refill within days',
            'Critical chronic medication',
          ],
          suggestedActions: [
            'Send immediate reminder',
            'Offer delivery option',
          ],
        },
      ];

      return predictions;
    } catch (error) {
      logger.error('Error predicting refills', { error, customerId });
      throw error;
    }
  }

  /**
   * Optimize inventory for a merchant
   */
  async optimizeInventory(merchantId: string): Promise<InventoryRecommendation[]> {
    logger.info('Optimizing inventory', { merchantId });

    try {
      // In production, this would analyze actual inventory data
      const recommendations: InventoryRecommendation[] = [
        {
          drugId: 'drug_stock_001',
          drugName: 'Amoxicillin 500mg',
          action: 'reorder',
          quantity: 200,
          urgency: AlertSeverity.HIGH,
          reason: 'Below reorder point. Current stock: 30, reorder point: 100.',
          estimatedCost: 450.00,
          supplierRecommendation: 'Primary supplier can deliver within 48 hours.',
        },
        {
          drugId: 'drug_stock_002',
          drugName: 'Ibuprofen 400mg',
          action: 'mark_down',
          quantity: 50,
          urgency: AlertSeverity.MEDIUM,
          reason: 'Expiring in 30 days. Consider mark-down to reduce waste.',
          estimatedCost: 0,
        },
        {
          drugId: 'drug_stock_003',
          drugName: 'Lisinopril 10mg',
          action: 'reorder',
          quantity: 300,
          urgency: AlertSeverity.HIGH,
          reason: 'High-velocity item. Maintain optimal stock levels.',
          estimatedCost: 750.00,
          supplierRecommendation: 'Bulk order from primary supplier for better pricing.',
        },
      ];

      return recommendations;
    } catch (error) {
      logger.error('Error optimizing inventory', { error, merchantId });
      throw error;
    }
  }

  /**
   * Build customer health profile from various data sources
   */
  async buildCustomerProfile(customerId: string): Promise<{
    conditions: string[];
    allergies: string[];
    medications: DrugInfo[];
    riskFactors: string[];
  }> {
    logger.info('Building customer profile', { customerId });

    try {
      // In production, this would aggregate data from multiple sources
      return {
        conditions: ['hypertension', 'type_2_diabetes'],
        allergies: ['penicillin', 'sulfa'],
        medications: [
          {
            drugId: 'drug_001',
            name: 'Lisinopril 10mg',
            category: DrugCategory.ANTIHYPERTENSIVE,
            dosage: '10mg daily',
          },
          {
            drugId: 'drug_002',
            name: 'Metformin 500mg',
            category: DrugCategory.DIABETIC,
            dosage: '500mg twice daily',
          },
        ],
        riskFactors: [
          'Taking multiple cardiovascular medications',
          'Age > 65 - consider renal function',
        ],
      };
    } catch (error) {
      logger.error('Error building customer profile', { error, customerId });
      throw error;
    }
  }

  /**
   * Generate recommendations based on found interactions
   */
  private generateInteractionRecommendations(interactions: DrugInteraction[]): string[] {
    const recommendations: string[] = [];

    for (const interaction of interactions) {
      if (interaction.severity === 'SEVERE') {
        recommendations.push(
          `URGENT: Review ${interaction.drug1} + ${interaction.drug2} - ${interaction.description}`
        );
        recommendations.push(`Recommendation: ${interaction.recommendation}`);
      } else if (interaction.severity === 'MODERATE') {
        recommendations.push(
          `Monitor: ${interaction.drug1} + ${interaction.drug2} - ${interaction.description}`
        );
      } else {
        recommendations.push(
          `Note: ${interaction.drug1} + ${interaction.drug2} - minor interaction (${interaction.description})`
        );
      }
    }

    return recommendations;
  }

  /**
   * Calculate confidence score for interaction analysis
   */
  private calculateInteractionConfidence(interactions: DrugInteraction[]): number {
    // Base confidence increases with known interactions in database
    let confidence = 0.5;

    if (interactions.length > 0) {
      // Higher confidence when we find specific interactions
      const knownInteractions = interactions.filter(i =>
        COMMON_DRUG_INTERACTIONS.some(
          known =>
            (known.drug1 === i.drug1 && known.drug2 === i.drug2) ||
            (known.drug1 === i.drug2 && known.drug2 === i.drug1)
        )
      );

      confidence += knownInteractions.length * 0.1;
    }

    return Math.min(confidence, 0.95);
  }
}

export const pharmacyIntelligence = new PharmacyIntelligenceService();