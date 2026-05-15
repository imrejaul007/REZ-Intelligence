import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Schedule, Shift } from '../models/index.js';
import {
  CreateScheduleInputSchema,
  ScheduleStatusInputSchema,
  ScheduleQuerySchema,
  ScheduleIdParamSchema,
  ApiResponse,
  ScheduleResponse,
  ShiftResponse,
} from '../types/index.js';
import { asyncHandler } from '../middleware/index.js';
import { logInfo, logError } from '../services/logger.js';

const router = Router();

/**
 * POST /api/schedules
 * Create a new schedule
 */
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const validationResult = CreateScheduleInputSchema.safeParse(req.body);
      if (!validationResult.success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validationResult.error.errors[0]?.message || 'Invalid input',
          },
        };
        res.status(400).json(response);
        return;
      }

      const input = validationResult.data;
      const startDate = new Date(input.weekStart);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);

      // Check for existing schedule
      const existing = await Schedule.findOne({
        locationId: input.locationId,
        weekStart: { $gte: startDate, $lt: endDate },
      });

      if (existing) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'DUPLICATE_SCHEDULE',
            message: 'Schedule already exists for this week',
          },
        };
        res.status(400).json(response);
        return;
      }

      const scheduleId = `SCH-${uuidv4().substring(0, 8).toUpperCase()}`;

      const schedule = new Schedule({
        scheduleId,
        locationId: input.locationId,
        franchiseId: input.franchiseId,
        weekStart: startDate,
        weekEnd: endDate,
        createdBy: input.createdBy,
        notes: input.notes,
      });

      await schedule.save();

      logInfo('Schedule created', { scheduleId, locationId: input.locationId });

      const response: ApiResponse<ScheduleResponse> = {
        success: true,
        data: formatScheduleResponse(schedule),
      };

      res.status(201).json(response);
    } catch (error) {
      logError('Error creating schedule', { error: (error as Error).message });
      throw error;
    }
  })
);

/**
 * GET /api/schedules
 * List all schedules
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const queryValidation = ScheduleQuerySchema.safeParse(req.query);
      const query = queryValidation.success ? queryValidation.data : {};

      const schedules = await Schedule.find(query).sort({ weekStart: -1 });

      const response: ApiResponse<ScheduleResponse[]> = {
        success: true,
        data: schedules.map(formatScheduleResponse),
      };

      res.json(response);
    } catch (error) {
      logError('Error listing schedules', { error: (error as Error).message });
      throw error;
    }
  })
);

/**
 * GET /api/schedules/:scheduleId
 * Get schedule by ID
 */
router.get(
  '/:scheduleId',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const paramValidation = ScheduleIdParamSchema.safeParse(req.params);
      if (!paramValidation.success) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid schedule ID' },
        };
        res.status(400).json(response);
        return;
      }

      const { scheduleId } = paramValidation.data;
      const schedule = await Schedule.findOne({ scheduleId });

      if (!schedule) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Schedule not found' },
        };
        res.status(404).json(response);
        return;
      }

      // Get shifts for this schedule
      const shifts = await Shift.find({ scheduleId }).sort({ date: 1, startTime: 1 });

      const response: ApiResponse<{
        schedule: ScheduleResponse;
        shifts: ShiftResponse[];
      }> = {
        success: true,
        data: {
          schedule: formatScheduleResponse(schedule),
          shifts: shifts.map(formatShiftResponse),
        },
      };

      res.json(response);
    } catch (error) {
      logError('Error fetching schedule', { error: (error as Error).message });
      throw error;
    }
  })
);

/**
 * PATCH /api/schedules/:scheduleId/status
 * Update schedule status
 */
router.patch(
  '/:scheduleId/status',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const paramValidation = ScheduleIdParamSchema.safeParse(req.params);
      if (!paramValidation.success) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid schedule ID' },
        };
        res.status(400).json(response);
        return;
      }

      const statusValidation = ScheduleStatusInputSchema.safeParse(req.body);
      if (!statusValidation.success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: statusValidation.error.errors[0]?.message || 'Invalid status',
          },
        };
        res.status(400).json(response);
        return;
      }

      const { scheduleId } = paramValidation.data;
      const { status } = statusValidation.data;

      const update: Record<string, unknown> = { status, updatedAt: new Date() };
      if (status === 'published') update.publishedAt = new Date();

      const schedule = await Schedule.findOneAndUpdate({ scheduleId }, update, { new: true });

      if (!schedule) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Schedule not found' },
        };
        res.status(404).json(response);
        return;
      }

      logInfo('Schedule status updated', { scheduleId, status });

      const response: ApiResponse<ScheduleResponse> = {
        success: true,
        data: formatScheduleResponse(schedule),
      };

      res.json(response);
    } catch (error) {
      logError('Error updating schedule status', { error: (error as Error).message });
      throw error;
    }
  })
);

/**
 * GET /api/schedules/:scheduleId/shifts
 * Get shifts for a schedule
 */
router.get(
  '/:scheduleId/shifts',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const paramValidation = ScheduleIdParamSchema.safeParse(req.params);
      if (!paramValidation.success) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid schedule ID' },
        };
        res.status(400).json(response);
        return;
      }

      const { scheduleId } = paramValidation.data;
      const shifts = await Shift.find({ scheduleId }).sort({ date: 1, startTime: 1 });

      const response: ApiResponse<ShiftResponse[]> = {
        success: true,
        data: shifts.map(formatShiftResponse),
      };

      res.json(response);
    } catch (error) {
      logError('Error fetching schedule shifts', { error: (error as Error).message });
      throw error;
    }
  })
);

// Helper functions
function formatScheduleResponse(schedule: typeof Schedule.prototype): ScheduleResponse {
  return {
    scheduleId: schedule.scheduleId,
    locationId: schedule.locationId,
    franchiseId: schedule.franchiseId,
    weekStart: schedule.weekStart,
    weekEnd: schedule.weekEnd,
    status: schedule.status,
    publishedAt: schedule.publishedAt,
    createdBy: schedule.createdBy,
    notes: schedule.notes,
  };
}

function formatShiftResponse(shift: typeof Shift.prototype): ShiftResponse {
  return {
    shiftId: shift.shiftId,
    scheduleId: shift.scheduleId,
    staffId: shift.staffId,
    locationId: shift.locationId,
    role: shift.role,
    date: shift.date,
    startTime: shift.startTime,
    endTime: shift.endTime,
    breakMinutes: shift.breakMinutes,
    totalHours: shift.totalHours,
    status: shift.status,
    notes: shift.notes,
    timesheet: shift.timesheet,
  };
}

export default router;
