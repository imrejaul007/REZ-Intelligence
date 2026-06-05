import { Router, Request, Response, NextFunction } from 'express';
import { GroceryIntelligence } from '../services/groceryIntelligence';
import { errorHandler } from '../middleware/errorHandler';
import { GroceryCategory } from '../types';
import { logger } from '../utils/logger';

const router = Router();
const groceryIntelligence = new GroceryIntelligence();

// GET /api/supplier/optimize/:merchantId - Supplier optimization recommendations
router.get(
  '/optimize/:merchantId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { merchantId } = req.params;
      const { category, prioritizeCriteria } = req.query;

      logger.info('Fetching supplier optimization', { merchantId, category });

      const scores = await groceryIntelligence.scoreSuppliers(merchantId);

      // Filter by category if specified
      let filteredScores = scores;
      if (category) {
        filteredScores = scores.filter(
          s => s.supplierName.toLowerCase().includes((category as string).toLowerCase())
        );
      }

      // Sort by criteria if specified
      if (prioritizeCriteria) {
        const criteria = prioritizeCriteria as string;
        filteredScores.sort((a, b) => {
          switch (criteria) {
            case 'reliability':
              return b.reliabilityScore - a.reliabilityScore;
            case 'quality':
              return b.qualityScore - a.qualityScore;
            case 'price':
              return b.priceScore - a.priceScore;
            case 'sustainability':
              return b.sustainabilityScore - a.sustainabilityScore;
            default:
              return b.overallScore - a.overallScore;
          }
        });
      }

      // Group by risk level
      const riskGroups = {
        low: filteredScores.filter(s => s.riskLevel === 'low'),
        medium: filteredScores.filter(s => s.riskLevel === 'medium'),
        high: filteredScores.filter(s => s.riskLevel === 'high'),
      };

      // Generate recommendations
      const recommendations = filteredScores.slice(0, 5).map((supplier, index) => ({
        supplierId: supplier.supplierId,
        supplierName: supplier.supplierName,
        overallScore: supplier.overallScore,
        riskLevel: supplier.riskLevel,
        recommendation:
          index === 0
            ? 'Primary recommendation - highest overall score'
            : index < 3
            ? `Alternative #${index} - good ${supplier.riskLevel === 'low' ? 'reliability' : 'value'}`
            : 'Consider for specific categories or backup',
        strengths: getStrengths(supplier),
        considerations: getConsiderations(supplier),
      }));

      logger.info('Supplier optimization retrieved', {
        merchantId,
        total: filteredScores.length,
        lowRisk: riskGroups.low.length,
      });

      res.status(200).json({
        success: true,
        data: {
          suppliers: filteredScores,
          summary: {
            total: filteredScores.length,
            lowRisk: riskGroups.low.length,
            mediumRisk: riskGroups.medium.length,
            highRisk: riskGroups.high.length,
            avgScore:
              filteredScores.reduce((sum, s) => sum + s.overallScore, 0) /
              Math.max(1, filteredScores.length),
          },
          recommendations,
          riskDistribution: {
            low: riskGroups.low.length,
            medium: riskGroups.medium.length,
            high: riskGroups.high.length,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/supplier/performance/:merchantId - Performance scores
router.get(
  '/performance/:merchantId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { merchantId } = req.params;
      const { supplierId, timePeriod } = req.query;

      logger.info('Fetching supplier performance', { merchantId, supplierId });

      const scores = await groceryIntelligence.scoreSuppliers(merchantId);

      // Filter by supplier if specified
      let filteredScores = scores;
      if (supplierId) {
        filteredScores = scores.filter(s => s.supplierId === supplierId);
      }

      // Calculate performance metrics
      const avgReliability = filteredScores.reduce((sum, s) => sum + s.reliabilityScore, 0) /
        Math.max(1, filteredScores.length);
      const avgQuality = filteredScores.reduce((sum, s) => sum + s.qualityScore, 0) /
        Math.max(1, filteredScores.length);
      const avgPrice = filteredScores.reduce((sum, s) => sum + s.priceScore, 0) /
        Math.max(1, filteredScores.length);
      const avgOnTimeDelivery = filteredScores.reduce((sum, s) => sum + s.onTimeDeliveryRate, 0) /
        Math.max(1, filteredScores.length);
      const avgOrderAccuracy = filteredScores.reduce((sum, s) => sum + s.orderAccuracy, 0) /
        Math.max(1, filteredScores.length);

      // Generate performance summary
      const summary = {
        overallPerformance:
          (avgReliability * 0.3 + avgQuality * 0.25 + avgPrice * 0.2 + avgOnTimeDelivery * 0.15 + avgOrderAccuracy * 0.1),
        reliability: Math.round(avgReliability * 10) / 10,
        quality: Math.round(avgQuality * 10) / 10,
        pricing: Math.round(avgPrice * 10) / 10,
        onTimeDelivery: Math.round(avgOnTimeDelivery * 10) / 10,
        orderAccuracy: Math.round(avgOrderAccuracy * 10) / 10,
      };

      // Identify top and bottom performers
      const sorted = [...filteredScores].sort((a, b) => b.overallScore - a.overallScore);
      const topPerformers = sorted.slice(0, 3);
      const underperformers = sorted.slice(-3).reverse();

      // Generate improvement suggestions
      const improvements = [];
      if (avgReliability < 80) {
        improvements.push('Focus on improving delivery reliability across suppliers');
      }
      if (avgQuality < 75) {
        improvements.push('Review quality control processes with underperforming suppliers');
      }
      if (avgPrice < 70) {
        improvements.push('Explore new supplier relationships for better pricing');
      }
      if (avgOrderAccuracy < 90) {
        improvements.push('Implement order verification processes to improve accuracy');
      }

      res.status(200).json({
        success: true,
        data: {
          suppliers: filteredScores.map(s => ({
            supplierId: s.supplierId,
            supplierName: s.supplierName,
            overallScore: s.overallScore,
            reliabilityScore: s.reliabilityScore,
            qualityScore: s.qualityScore,
            priceScore: s.priceScore,
            sustainabilityScore: s.sustainabilityScore,
            onTimeDeliveryRate: s.onTimeDeliveryRate,
            orderAccuracy: s.orderAccuracy,
            riskLevel: s.riskLevel,
            lastEvaluated: s.lastEvaluated,
          })),
          summary,
          topPerformers: topPerformers.map(s => ({
            supplierId: s.supplierId,
            supplierName: s.supplierName,
            overallScore: s.overallScore,
          })),
          underperformers: underperformers.map(s => ({
            supplierId: s.supplierId,
            supplierName: s.supplierName,
            overallScore: s.overallScore,
            issues: identifyIssues(s),
          })),
          improvements,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Helper functions
function getStrengths(supplier: { reliabilityScore: number; qualityScore: number; priceScore: number; sustainabilityScore: number }): string[] {
  const strengths: string[] = [];
  if (supplier.reliabilityScore >= 85) strengths.push('Excellent delivery reliability');
  if (supplier.qualityScore >= 85) strengths.push('High product quality');
  if (supplier.priceScore >= 85) strengths.push('Competitive pricing');
  if (supplier.sustainabilityScore >= 80) strengths.push('Strong sustainability practices');
  if (supplier.reliabilityScore >= 95) strengths.push('Exceptional on-time delivery');
  return strengths.length > 0 ? strengths : ['Consistent performance'];
}

function getConsiderations(supplier: { reliabilityScore: number; qualityScore: number; priceScore: number; riskLevel: string }): string[] {
  const considerations: string[] = [];
  if (supplier.reliabilityScore < 80) considerations.push('Monitor delivery consistency');
  if (supplier.qualityScore < 75) considerations.push('Review quality assurance');
  if (supplier.priceScore < 70) considerations.push('Price negotiation may be needed');
  if (supplier.riskLevel === 'high') considerations.push('Consider backup suppliers');
  return considerations.length > 0 ? considerations : ['No major concerns'];
}

function identifyIssues(supplier: { reliabilityScore: number; qualityScore: number; priceScore: number; onTimeDeliveryRate: number; orderAccuracy: number }): string[] {
  const issues: string[] = [];
  if (supplier.reliabilityScore < 70) issues.push('Low reliability score');
  if (supplier.qualityScore < 70) issues.push('Quality concerns');
  if (supplier.priceScore < 65) issues.push('Uncompetitive pricing');
  if (supplier.onTimeDeliveryRate < 85) issues.push('Delivery delays');
  if (supplier.orderAccuracy < 90) issues.push('Order accuracy issues');
  return issues;
}

// Apply error handler
router.use(errorHandler);

export default router;