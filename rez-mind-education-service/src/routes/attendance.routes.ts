import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { AttendanceAnomaly } from '../models';
import { validateRequest } from '../middleware/validation';
import { errorHandler } from '../middleware/errorHandler';
import { AnomalySeverity } from '../types';
import { logger } from '../utils/logger';

const router = Router();

// Zod schemas
const analyzeRequestSchema = z.object({
  studentId: z.string().optional(),
  courseId: z.string().optional(),
  startDate: z.string().datetime().or(z.date()),
  endDate: z.string().datetime().or(z.date()),
});

// GET /api/attendance/:institutionId - Get attendance anomalies
router.get(
  '/:institutionId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { institutionId } = req.params;
      const { resolved, severity, limit } = req.query;

      logger.info('Fetching attendance anomalies', { institutionId });

      let query: Record<string, unknown> = { institutionId };

      if (resolved !== undefined) {
        query.resolved = resolved === 'true';
      }

      if (severity) {
        query.severity = severity;
      }

      const anomalies = await AttendanceAnomaly.find(query)
        .sort({ severity: -1, detectedDate: -1 })
        .limit(parseInt(limit as string, 10) || 100)
        .exec();

      // Get summary by type
      const summary = await AttendanceAnomaly.getAnomalySummary(institutionId);

      logger.info('Attendance anomalies retrieved', {
        institutionId,
        total: anomalies.length,
        unresolved: anomalies.filter(a => !a.resolved).length,
      });

      res.status(200).json({
        success: true,
        data: {
          anomalies: anomalies.map(a => ({
            anomalyId: a.anomalyId,
            studentId: a.studentId,
            courseId: a.courseId,
            type: a.type,
            severity: a.severity,
            description: a.description,
            possibleCause: a.possibleCause,
            recommendedAction: a.recommendedAction,
            detectedDate: a.detectedDate,
            resolved: a.resolved,
            resolvedDate: a.resolvedDate,
          })),
          summary,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/attendance/:institutionId/student/:studentId - Get student attendance history
router.get(
  '/:institutionId/student/:studentId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { institutionId, studentId } = req.params;

      logger.info('Fetching student attendance anomalies', { institutionId, studentId });

      const anomalies = await AttendanceAnomaly.findByStudent(studentId, 20);

      if (anomalies.length === 0) {
        res.status(200).json({
          success: true,
          data: {
            studentId,
            anomalies: [],
            summary: {
              totalAnomalies: 0,
              unresolvedCount: 0,
              criticalCount: 0,
            },
          },
        });
        return;
      }

      const summary = {
        totalAnomalies: anomalies.length,
        unresolvedCount: anomalies.filter(a => !a.resolved).length,
        criticalCount: anomalies.filter(a => a.severity === AnomalySeverity.CRITICAL).length,
        byType: anomalies.reduce((acc, a) => {
          acc[a.type] = (acc[a.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      };

      res.status(200).json({
        success: true,
        data: {
          studentId,
          anomalies: anomalies.map(a => ({
            anomalyId: a.anomalyId,
            courseId: a.courseId,
            type: a.type,
            severity: a.severity,
            description: a.description,
            possibleCause: a.possibleCause,
            recommendedAction: a.recommendedAction,
            detectedDate: a.detectedDate,
            resolved: a.resolved,
          })),
          summary,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/attendance/:institutionId/analyze - Analyze attendance patterns
router.post(
  '/:institutionId/analyze',
  validateRequest(analyzeRequestSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { institutionId } = req.params;
      const { studentId, courseId, startDate, endDate } = req.body;

      logger.info('Analyzing attendance patterns', {
        institutionId,
        studentId,
        startDate,
        endDate,
      });

      // Simulate pattern analysis
      const anomalies = [];
      const types = ['sudden_drop', 'chronic_absence', 'pattern_absence', 'late_arrivals'] as const;
      const severities = [AnomalySeverity.HIGH, AnomalySeverity.MEDIUM, AnomalySeverity.LOW];

      // Generate mock anomalies based on analysis
      for (let i = 0; i < Math.floor(Math.random() * 3) + 1; i++) {
        const type = types[Math.floor(Math.random() * types.length)];
        const severity = severities[Math.floor(Math.random() * severities.length)];

        anomalies.push({
          anomalyId: uuidv4(),
          studentId: studentId || `student-${i}`,
          type,
          severity,
          description: getAnomalyDescription(type),
          possibleCause: getPossibleCause(type),
          recommendedAction: getRecommendedAction(type, severity),
          detectedDate: new Date(),
        });
      }

      // Save anomalies to database
      for (const anomaly of anomalies) {
        const attendanceAnomaly = new AttendanceAnomaly({
          anomalyId: anomaly.anomalyId,
          studentId: anomaly.studentId,
          institutionId,
          courseId,
          type: anomaly.type,
          severity: anomaly.severity,
          description: anomaly.description,
          possibleCause: anomaly.possibleCause,
          recommendedAction: anomaly.recommendedAction,
          detectedDate: anomaly.detectedDate,
        });

        await attendanceAnomaly.save();
      }

      res.status(201).json({
        success: true,
        data: {
          analyzedStudents: studentId ? 1 : 5,
          anomaliesDetected: anomalies.length,
          anomalies,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/attendance/:institutionId/anomaly/:anomalyId/resolve - Mark anomaly as resolved
router.patch(
  '/:institutionId/anomaly/:anomalyId/resolve',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { anomalyId } = req.params;

      logger.info('Resolving attendance anomaly', { anomalyId });

      const anomaly = await AttendanceAnomaly.markResolved(anomalyId);

      if (!anomaly) {
        res.status(404).json({
          success: false,
          error: {
            code: 'ANOMALY_NOT_FOUND',
            message: 'Attendance anomaly not found',
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          anomalyId: anomaly.anomalyId,
          resolved: anomaly.resolved,
          resolvedDate: anomaly.resolvedDate,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Helper functions
function getAnomalyDescription(type: string): string {
  const descriptions: Record<string, string> = {
    sudden_drop: 'Attendance rate dropped significantly (more than 20%) in the past week',
    chronic_absence: 'More than 3 consecutive absences detected without valid reasons',
    pattern_absence: 'Regular absence pattern detected (same day each week)',
    late_arrivals: 'Frequent late arrivals affecting class participation',
  };
  return descriptions[type] || 'Attendance anomaly detected';
}

function getPossibleCause(type: string): string {
  const causes: Record<string, string> = {
    sudden_drop: 'Possible illness, personal issues, or loss of interest in course',
    chronic_absence: 'May indicate family obligations, transportation issues, or disengagement',
    pattern_absence: 'Could be scheduling conflict, part-time work, or personal preference',
    late_arrivals: 'Transportation issues, oversleeping, or competing priorities',
  };
  return causes[type] || 'Under investigation';
}

function getRecommendedAction(type: string, severity: AnomalySeverity): string {
  if (severity === AnomalySeverity.CRITICAL) {
    return 'Immediate outreach to student and parents/guardians recommended';
  }
  const actions: Record<string, string> = {
    sudden_drop: 'Schedule meeting with student to discuss recent changes',
    chronic_absence: 'Create attendance improvement plan with clear expectations',
    pattern_absence: 'Discuss scheduling conflicts and potential solutions',
    late_arrivals: 'Review time management and suggest alarm/reminder tools',
  };
  return actions[type] || 'Monitor and follow up as needed';
}

// Apply error handler
router.use(errorHandler);

export default router;