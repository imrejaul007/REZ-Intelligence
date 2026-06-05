import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { DropoutRisk } from '../models';
import { StudentIntelligence, DropoutDetector } from '../services';
import { validateRequest } from '../middleware/validation';
import { errorHandler } from '../middleware/errorHandler';
import { CourseCategory, RiskLevel } from '../types';
import { logger } from '../utils/logger';

const router = Router();
const studentIntelligence = new StudentIntelligence();
const dropoutDetector = new DropoutDetector();

// Zod schemas
const recommendRequestSchema = z.object({
  studentId: z.string().min(1),
  careerGoals: z.array(z.string()).optional(),
  completedCourses: z.array(z.string()).optional(),
  preferredCategories: z.array(z.nativeEnum(CourseCategory)).optional(),
});

// GET /api/enrollment/:institutionId/courses - Get available courses
router.get(
  '/:institutionId/courses',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { institutionId } = req.params;
      const { category, difficulty, available } = req.query;

      logger.info('Fetching course recommendations', { institutionId });

      // Generate mock courses
      const courses = await studentIntelligence.getCourseRecommendations(institutionId, undefined);

      let filteredCourses = courses;
      if (category) {
        filteredCourses = filteredCourses.filter(c => c.category === category);
      }

      res.status(200).json({
        success: true,
        data: {
          courses: filteredCourses,
          total: filteredCourses.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/enrollment/:institutionId/recommend - Get personalized course recommendations
router.post(
  '/:institutionId/recommend',
  validateRequest(recommendRequestSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { institutionId } = req.params;
      const { studentId, careerGoals, completedCourses, preferredCategories } = req.body;

      logger.info('Generating course recommendations', { institutionId, studentId });

      const recommendations = await studentIntelligence.getCourseRecommendations(
        institutionId,
        studentId
      );

      // Filter by preferences if provided
      let filtered = recommendations;
      if (preferredCategories?.length) {
        filtered = recommendations.filter(r => preferredCategories.includes(r.category));
      }

      res.status(200).json({
        success: true,
        data: {
          studentId,
          recommendations: filtered.slice(0, 10),
          totalRecommended: filtered.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/enrollment/:institutionId/dropout-risk - Get dropout risk assessment
router.get(
  '/:institutionId/dropout-risk',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { institutionId } = req.params;
      const { riskLevel, limit } = req.query;

      logger.info('Fetching dropout risk assessment', { institutionId });

      let query: Record<string, unknown> = { institutionId, status: 'active' };
      if (riskLevel) {
        query.riskLevel = riskLevel;
      }

      const risks = await DropoutRisk.find(query)
        .sort({ riskScore: -1 })
        .limit(parseInt(limit as string, 10) || 50)
        .exec();

      // Get distribution
      const distribution = await DropoutRisk.getRiskDistribution(institutionId);

      // Group students by risk level
      const atRiskStudents = risks.map(r => ({
        studentId: r.studentId,
        riskScore: r.riskScore,
        riskLevel: r.riskLevel,
        contributingFactors: r.contributingFactors,
        recommendations: r.recommendations,
        assessmentDate: r.assessmentDate,
      }));

      res.status(200).json({
        success: true,
        data: {
          atRiskStudents,
          totalAtRisk: risks.length,
          distribution,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/enrollment/:institutionId/dropout-risk/assess - Assess dropout risk for student
router.post(
  '/:institutionId/dropout-risk/assess',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { institutionId } = req.params;
      const { studentId } = req.body;

      if (!studentId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'STUDENT_ID_REQUIRED',
            message: 'Student ID is required',
          },
        });
        return;
      }

      logger.info('Assessing dropout risk', { institutionId, studentId });

      const riskAssessment = await dropoutDetector.assessStudentRisk({
        studentId,
        institutionId,
      });

      // Save to database
      const dropoutRisk = new DropoutRisk({
        riskId: riskAssessment.riskId,
        studentId,
        institutionId,
        riskScore: riskAssessment.riskScore,
        riskLevel: riskAssessment.riskLevel,
        contributingFactors: riskAssessment.contributingFactors,
        recommendations: riskAssessment.recommendations,
        assessmentDate: riskAssessment.assessmentDate,
      });

      await dropoutRisk.save();

      res.status(201).json({
        success: true,
        data: riskAssessment,
      });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/enrollment/:institutionId/dropout-risk/:riskId/intervene - Add intervention
router.patch(
  '/:institutionId/dropout-risk/:riskId/intervene',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { riskId } = req.params;
      const { intervention } = req.body;

      if (!intervention) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INTERVENTION_REQUIRED',
            message: 'Intervention description is required',
          },
        });
        return;
      }

      logger.info('Adding dropout risk intervention', { riskId });

      const risk = await DropoutRisk.addIntervention(riskId, intervention);

      if (!risk) {
        res.status(404).json({
          success: false,
          error: {
            code: 'RISK_NOT_FOUND',
            message: 'Dropout risk assessment not found',
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          riskId: risk.riskId,
          status: risk.status,
          interventions: risk.interventions,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Apply error handler
router.use(errorHandler);

export default router;