import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { PerformancePrediction } from '../models';
import { PerformancePredictor } from '../services/performancePredictor';
import { validateRequest } from '../middleware/validation';
import { errorHandler } from '../middleware/errorHandler';
import { CourseCategory } from '../types';
import { logger } from '../utils/logger';

const router = Router();
const performancePredictor = new PerformancePredictor();

// Zod schemas
const predictRequestSchema = z.object({
  studentId: z.string().min(1),
  courseId: z.string().optional(),
  courseName: z.string().optional(),
  category: z.nativeEnum(CourseCategory).optional(),
  metrics: z.object({
    attendanceRate: z.number().min(0).max(100),
    assignmentCompletion: z.number().min(0).max(100),
    quizAverage: z.number().min(0).max(100),
    examAverage: z.number().min(0).max(100),
    participationScore: z.number().min(0).max(100),
    overallGpa: z.number().min(0).max(4),
  }),
});

// GET /api/performance/:institutionId - Get performance predictions
router.get(
  '/:institutionId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { institutionId } = req.params;
      const { studentId, courseId, limit } = req.query;

      logger.info('Fetching performance predictions', { institutionId, studentId });

      let query: Record<string, unknown> = { institutionId };
      if (studentId) query.studentId = studentId;
      if (courseId) query.courseId = courseId;

      const predictions = await PerformancePrediction.find(query)
        .sort({ predictionDate: -1 })
        .limit(parseInt(limit as string, 10) || 100)
        .exec();

      // Group by risk level
      const distribution = await PerformancePrediction.getPerformanceDistribution(institutionId);

      logger.info('Performance predictions retrieved', {
        institutionId,
        total: predictions.length,
      });

      res.status(200).json({
        success: true,
        data: {
          predictions: predictions.map(p => ({
            predictionId: p.predictionId,
            studentId: p.studentId,
            courseId: p.courseId,
            courseName: p.courseName,
            predictedGrade: p.predictedGrade,
            confidence: p.confidence,
            riskFactors: p.riskFactors,
            recommendations: p.recommendations,
            predictionDate: p.predictionDate,
            actualGrade: p.actualGrade,
            accuracy: p.accuracy,
          })),
          distribution,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/performance/:institutionId/student/:studentId - Get specific student predictions
router.get(
  '/:institutionId/student/:studentId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { institutionId, studentId } = req.params;

      logger.info('Fetching student performance predictions', { institutionId, studentId });

      const predictions = await PerformancePrediction.findByStudent(studentId, 20);

      if (predictions.length === 0) {
        res.status(404).json({
          success: false,
          error: {
            code: 'PREDICTIONS_NOT_FOUND',
            message: 'No performance predictions found for this student',
          },
        });
        return;
      }

      // Calculate performance trends
      const latest = predictions[0];
      const earlier = predictions[Math.min(5, predictions.length - 1)];
      const performanceTrend = earlier && earlier.predictedGrade > latest.predictedGrade
        ? 'declining'
        : earlier && earlier.predictedGrade < latest.predictedGrade
        ? 'improving'
        : 'stable';

      res.status(200).json({
        success: true,
        data: {
          studentId,
          summary: {
            totalPredictions: predictions.length,
            avgConfidence: predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length,
            performanceTrend,
          },
          predictions: predictions.map(p => ({
            predictionId: p.predictionId,
            courseId: p.courseId,
            courseName: p.courseName,
            predictedGrade: p.predictedGrade,
            confidence: p.confidence,
            riskFactors: p.riskFactors,
            predictionDate: p.predictionDate,
            actualGrade: p.actualGrade,
            accuracy: p.accuracy,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/performance/:institutionId/predict - Create new performance prediction
router.post(
  '/:institutionId/predict',
  validateRequest(predictRequestSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { institutionId } = req.params;
      const { studentId, courseId, courseName, category, metrics } = req.body;

      logger.info('Creating performance prediction', { institutionId, studentId, courseId });

      const prediction = await performancePredictor.predictStudentPerformance({
        studentId,
        institutionId,
        courseId,
        courseName,
        category,
        metrics,
      });

      // Save to database
      const performancePrediction = new PerformancePrediction({
        predictionId: prediction.predictionId,
        studentId,
        institutionId,
        courseId,
        courseName,
        category,
        predictedGrade: prediction.predictedGrade,
        confidence: prediction.confidence,
        riskFactors: prediction.riskFactors,
        recommendations: prediction.recommendations,
        predictionDate: prediction.predictionDate,
        metricsSnapshot: metrics,
      });

      await performancePrediction.save();

      res.status(201).json({
        success: true,
        data: prediction,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Apply error handler
router.use(errorHandler);

export default router;