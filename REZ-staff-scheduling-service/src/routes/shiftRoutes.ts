import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Shift, TimeOff } from '../models/index.js';
import {
  CreateShiftInputSchema,
  UpdateShiftInputSchema,
  ShiftStatusInputSchema,
  ShiftQuerySchema,
  ShiftIdParamSchema,
  calculateTotalHours,
  ApiResponse,
  ShiftResponse,
  HoursReportEntry,
} from '../types/index.js';
import { asyncHandler } from '../middleware/index.js';
import { logInfo, logError } from '../services/logger.js';

const router = Router();

/**
 * POST /api/shifts
 * Create a new shift
 */
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const validationResult = CreateShiftInputSchema.safeParse(req.body);
      if (!validationResult.success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validationResult.error.issues[0]?.message || 'Invalid input',
          },
        };
        res.status(400).json(response);
        return;
      }

      const input = validationResult.data;
      const shiftDate = new Date(input.date);

      // Check for approved time off
      const hasTimeOff = await TimeOff.findOne({
        staffId: input.staffId,
        startDate: { $lte: shiftDate },
        endDate: { $gte: shiftDate },
        status: 'approved',
      });

      if (hasTimeOff) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'TIME_OFF_CONFLICT',
            message: 'Staff has approved time off on this date',
          },
        };
        res.status(400).json(response);
        return;
      }

      const shiftId = `SFT-${uuidv4().substring(0, 8).toUpperCase()}`;
      const totalHours = calculateTotalHours(input.startTime, input.endTime, input.breakMinutes);

      const shift = new Shift({
        shiftId,
        scheduleId: input.scheduleId,
        staffId: input.staffId,
        locationId: input.locationId,
        role: input.role,
        date: shiftDate,
        startTime: input.startTime,
        endTime: input.endTime,
        breakMinutes: input.breakMinutes,
        totalHours,
        notes: input.notes,
        status: 'scheduled',
      });

      await shift.save();

      logInfo('Shift created', { shiftId, staffId: input.staffId, date: input.date });

      const response: ApiResponse<ShiftResponse> = {
        success: true,
        data: formatShiftResponse(shift),
      };

      res.status(201).json(response);
    } catch (error) {
      logError('Error creating shift', { error: (error as Error).message });
      throw error;
    }
  })
);

/**
 * GET /api/shifts
 * List all shifts
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const queryValidation = ShiftQuerySchema.safeParse(req.query);
      const query = queryValidation.success ? queryValidation.data : {};

      const mongoQuery: Record<string, unknown> = {};

      if (query.locationId) mongoQuery.locationId = query.locationId;
      if (query.staffId) mongoQuery.staffId = query.staffId;
      if (query.scheduleId) mongoQuery.scheduleId = query.scheduleId;
      if (query.status) mongoQuery.status = query.status;

      if (query.startDate || query.endDate) {
        mongoQuery.date = {};
        if (query.startDate) {
          (mongoQuery.date as Record<string, unknown>).$gte = new Date(query.startDate);
        }
        if (query.endDate) {
          (mongoQuery.date as Record<string, unknown>).$lte = new Date(query.endDate);
        }
      }

      const shifts = await Shift.find(mongoQuery).sort({ date: 1, startTime: 1 });

      const response: ApiResponse<ShiftResponse[]> = {
        success: true,
        data: shifts.map(formatShiftResponse),
      };

      res.json(response);
    } catch (error) {
      logError('Error listing shifts', { error: (error as Error).message });
      throw error;
    }
  })
);

/**
 * GET /api/shifts/:shiftId
 * Get shift by ID
 */
router.get(
  '/:shiftId',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const paramValidation = ShiftIdParamSchema.safeParse(req.params);
      if (!paramValidation.success) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid shift ID' },
        };
        res.status(400).json(response);
        return;
      }

      const { shiftId } = paramValidation.data;
      const shift = await Shift.findOne({ shiftId });

      if (!shift) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Shift not found' },
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<ShiftResponse> = {
        success: true,
        data: formatShiftResponse(shift),
      };

      res.json(response);
    } catch (error) {
      logError('Error fetching shift', { error: (error as Error).message });
      throw error;
    }
  })
);

/**
 * PATCH /api/shifts/:shiftId
 * Update shift
 */
router.patch(
  '/:shiftId',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const paramValidation = ShiftIdParamSchema.safeParse(req.params);
      if (!paramValidation.success) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid shift ID' },
        };
        res.status(400).json(response);
        return;
      }

      const updates = { ...req.body, updatedAt: new Date() };
      delete updates.shiftId;
      delete updates.createdAt;

      // Recalculate total hours if times changed
      if (updates.startTime || updates.endTime || updates.breakMinutes !== undefined) {
        const currentShift = await Shift.findOne({ shiftId: paramValidation.data.shiftId });
        if (currentShift) {
          updates.totalHours = calculateTotalHours(
            updates.startTime || currentShift.startTime,
            updates.endTime || currentShift.endTime,
            updates.breakMinutes ?? currentShift.breakMinutes
          );
        }
      }

      const shift = await Shift.findOneAndUpdate(
        { shiftId: paramValidation.data.shiftId },
        updates,
        { new: true }
      );

      if (!shift) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Shift not found' },
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<ShiftResponse> = {
        success: true,
        data: formatShiftResponse(shift),
      };

      res.json(response);
    } catch (error) {
      logError('Error updating shift', { error: (error as Error).message });
      throw error;
    }
  })
);

/**
 * PATCH /api/shifts/:shiftId/status
 * Update shift status
 */
router.patch(
  '/:shiftId/status',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const paramValidation = ShiftIdParamSchema.safeParse(req.params);
      if (!paramValidation.success) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid shift ID' },
        };
        res.status(400).json(response);
        return;
      }

      const statusValidation = ShiftStatusInputSchema.safeParse(req.body);
      if (!statusValidation.success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: statusValidation.error.issues[0]?.message || 'Invalid status',
          },
        };
        res.status(400).json(response);
        return;
      }

      const { shiftId } = paramValidation.data;
      const { status, notes } = statusValidation.data;

      const shift = await Shift.findOneAndUpdate(
        { shiftId },
        { status, notes, updatedAt: new Date() },
        { new: true }
      );

      if (!shift) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Shift not found' },
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<ShiftResponse> = {
        success: true,
        data: formatShiftResponse(shift),
      };

      res.json(response);
    } catch (error) {
      logError('Error updating shift status', { error: (error as Error).message });
      throw error;
    }
  })
);

/**
 * POST /api/shifts/:shiftId/clock-in
 * Clock in to shift
 */
router.post(
  '/:shiftId/clock-in',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const paramValidation = ShiftIdParamSchema.safeParse(req.params);
      if (!paramValidation.success) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid shift ID' },
        };
        res.status(400).json(response);
        return;
      }

      const { shiftId } = paramValidation.data;

      const shift = await Shift.findOneAndUpdate(
        { shiftId, status: 'scheduled' },
        {
          status: 'in_progress',
          'timesheet.clockIn': new Date(),
          updatedAt: new Date(),
        },
        { new: true }
      );

      if (!shift) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Scheduled shift not found' },
        };
        res.status(404).json(response);
        return;
      }

      logInfo('Shift clocked in', { shiftId });

      const response: ApiResponse<ShiftResponse> = {
        success: true,
        data: formatShiftResponse(shift),
      };

      res.json(response);
    } catch (error) {
      logError('Error clocking in', { error: (error as Error).message });
      throw error;
    }
  })
);

/**
 * POST /api/shifts/:shiftId/clock-out
 * Clock out from shift
 */
router.post(
  '/:shiftId/clock-out',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const paramValidation = ShiftIdParamSchema.safeParse(req.params);
      if (!paramValidation.success) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid shift ID' },
        };
        res.status(400).json(response);
        return;
      }

      const { shiftId } = paramValidation.data;

      const shift = await Shift.findOne({ shiftId, status: 'in_progress' });

      if (!shift) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Active shift not found' },
        };
        res.status(404).json(response);
        return;
      }

      const clockOut = new Date();
      const clockIn = new Date(shift.timesheet.clockIn!);
      const hoursWorked = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
      const overtimeHours = Math.max(0, hoursWorked - (shift.totalHours || 0));

      shift.status = 'completed';
      shift.timesheet.clockOut = clockOut;
      shift.timesheet.hoursWorked = Math.round(hoursWorked * 100) / 100;
      shift.timesheet.overtimeHours = Math.round(overtimeHours * 100) / 100;
      shift.updatedAt = new Date();
      await shift.save();

      logInfo('Shift clocked out', { shiftId, hoursWorked: shift.timesheet.hoursWorked });

      const response: ApiResponse<ShiftResponse> = {
        success: true,
        data: formatShiftResponse(shift),
      };

      res.json(response);
    } catch (error) {
      logError('Error clocking out', { error: (error as Error).message });
      throw error;
    }
  })
);

/**
 * DELETE /api/shifts/:shiftId
 * Delete shift
 */
router.delete(
  '/:shiftId',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const paramValidation = ShiftIdParamSchema.safeParse(req.params);
      if (!paramValidation.success) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid shift ID' },
        };
        res.status(400).json(response);
        return;
      }

      const { shiftId } = paramValidation.data;

      const result = await Shift.deleteOne({ shiftId, status: 'scheduled' });

      if (result.deletedCount === 0) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Scheduled shift not found' },
        };
        res.status(404).json(response);
        return;
      }

      logInfo('Shift deleted', { shiftId });

      const response: ApiResponse<{ shiftId: string; deleted: boolean }> = {
        success: true,
        data: { shiftId, deleted: true },
      };

      res.json(response);
    } catch (error) {
      logError('Error deleting shift', { error: (error as Error).message });
      throw error;
    }
  })
);

/**
 * GET /api/shifts/reports/hours
 * Get hours worked report
 */
router.get(
  '/reports/hours',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const match: Record<string, unknown> = { status: 'completed' };

      if (req.query.startDate || req.query.endDate) {
        match.date = {};
        if (req.query.startDate) {
          (match.date as Record<string, unknown>).$gte = new Date(req.query.startDate as string);
        }
        if (req.query.endDate) {
          (match.date as Record<string, unknown>).$lte = new Date(req.query.endDate as string);
        }
      }
      if (req.query.locationId) match.locationId = req.query.locationId;
      if (req.query.staffId) match.staffId = req.query.staffId;

      const report = await Shift.aggregate([
        { $match: match },
        {
          $group: {
            _id: { staffId: '$staffId', date: '$date' },
            hoursWorked: { $sum: '$timesheet.hoursWorked' },
            overtimeHours: { $sum: '$timesheet.overtimeHours' },
            shiftCount: { $sum: 1 },
          },
        },
        { $sort: { '_id.date': -1 } },
      ]);

      const response: ApiResponse<HoursReportEntry[]> = {
        success: true,
        data: report,
      };

      res.json(response);
    } catch (error) {
      logError('Error generating hours report', { error: (error as Error).message });
      throw error;
    }
  })
);

// Helper function
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
