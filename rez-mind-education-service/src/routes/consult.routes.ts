import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { EducationMindSession } from '../models';
import { StudentIntelligence } from '../services/studentIntelligence';
import { validateRequest } from '../middleware/validation';
import { errorHandler } from '../middleware/errorHandler';
import { CourseCategory } from '../types';
import { logger } from '../utils/logger';

const router = Router();
const studentIntelligence = new StudentIntelligence();

// Zod schemas for validation
const gradeSchema = z.object({
  courseId: z.string().min(1),
  courseName: z.string().min(1),
  category: z.nativeEnum(CourseCategory),
  credits: z.number().int().positive(),
  grade: z.string().optional(),
  completedDate: z.string().datetime().or(z.date()).optional(),
  status: z.enum(['completed', 'in_progress', 'failed', 'withdrawn']),
});

const consultRequestSchema = z.object({
  institutionId: z.string().min(1, 'Institution ID is required'),
  studentId: z.string().optional(),
  context: z.object({
    courseId: z.string().optional(),
    semester: z.string().optional(),
    grades: z.array(gradeSchema).optional(),
  }).optional(),
});

// POST /api/consult - AI education consultation
router.post(
  '/',
  validateRequest(consultRequestSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();
      const { institutionId, studentId, context } = req.body;

      logger.info('Processing education consultation', {
        institutionId,
        studentId,
        hasContext: !!context,
      });

      // Get course recommendations
      const recommendations = await studentIntelligence.getCourseRecommendations(
        institutionId,
        studentId
      );

      // Get risk assessments
      const riskAssessments = await studentIntelligence.assessDropoutRisk(
        institutionId,
        studentId
      );

      // Get performance predictions
      const performancePredictions = await studentIntelligence.predictPerformance(
        institutionId,
        studentId
      );

      // Calculate confidence
      const confidence = studentIntelligence.calculateConfidence({
        hasStudentId: !!studentId,
        hasGrades: !!(context?.grades?.length),
        hasContext: !!context,
      });

      // Build response
      const sessionId = uuidv4();

      // Save session to database
      try {
        const session = new EducationMindSession({
          sessionId,
          institutionId,
          studentId,
          intent: 'education_consultation',
          context: {
            courseId: context?.courseId,
            semester: context?.semester,
            grades: context?.grades,
          },
          analysis: {
            recommendations,
            riskAssessments,
            performancePredictions,
          },
          sentiment: 0.5,
        });

        await session.save();
        logger.info('Consultation session saved', { sessionId, institutionId });
      } catch (dbError) {
        logger.warn('Failed to save session, continuing with response', {
          sessionId,
          error: dbError,
        });
      }

      const duration = Date.now() - startTime;
      logger.info('Consultation completed', { sessionId, duration });

      res.status(200).json({
        success: true,
        data: {
          sessionId,
          recommendations,
          riskAssessments,
          performancePredictions,
          confidence,
        },
        meta: {
          sessionId,
          duration,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/consult/:sessionId - Retrieve session analysis
router.get(
  '/:sessionId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_SESSION_ID',
            message: 'Session ID is required',
          },
        });
        return;
      }

      const session = await EducationMindSession.findOne({ sessionId });

      if (!session) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: 'Consultation session not found',
          },
        });
        return;
      }

      logger.info('Session retrieved', { sessionId });

      res.status(200).json({
        success: true,
        data: {
          sessionId: session.sessionId,
          institutionId: session.institutionId,
          studentId: session.studentId,
          intent: session.intent,
          context: session.context,
          analysis: session.analysis,
          sentiment: session.sentiment,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
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