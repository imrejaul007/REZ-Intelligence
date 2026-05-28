import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Staff, Shift, TimeOff } from '../models/index.js';
import {
  CreateStaffInputSchema,
  StaffStatusInputSchema,
  StaffQuerySchema,
  StaffIdParamSchema,
  ApiResponse,
  StaffResponse,
  TimeOffResponse,
} from '../types/index.js';
import { asyncHandler } from '../middleware/index.js';
import { logInfo, logError } from '../services/logger.js';

const router = Router();

/**
 * POST /api/staff
 * Create a new staff member
 */
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const validationResult = CreateStaffInputSchema.safeParse(req.body);
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
      const staffId = `STF-${uuidv4().substring(0, 8).toUpperCase()}`;

      const staff = new Staff({
        staffId,
        ...input,
      });

      await staff.save();

      logInfo('Staff created', { staffId, name: input.name });

      const response: ApiResponse<StaffResponse> = {
        success: true,
        data: formatStaffResponse(staff),
      };

      res.status(201).json(response);
    } catch (error) {
      logError('Error creating staff', { error: (error as Error).message });
      throw error;
    }
  })
);

/**
 * GET /api/staff
 * List all staff members
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const queryValidation = StaffQuerySchema.safeParse(req.query);
      const query = queryValidation.success ? queryValidation.data : {};

      const staffList = await Staff.find(query).sort({ name: 1 });

      const response: ApiResponse<StaffResponse[]> = {
        success: true,
        data: staffList.map(formatStaffResponse),
      };

      res.json(response);
    } catch (error) {
      logError('Error listing staff', { error: (error as Error).message });
      throw error;
    }
  })
);

/**
 * GET /api/staff/:staffId
 * Get staff member by ID
 */
router.get(
  '/:staffId',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const paramValidation = StaffIdParamSchema.safeParse(req.params);
      if (!paramValidation.success) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid staff ID' },
        };
        res.status(400).json(response);
        return;
      }

      const { staffId } = paramValidation.data;
      const staff = await Staff.findOne({ staffId });

      if (!staff) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Staff not found' },
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<StaffResponse> = {
        success: true,
        data: formatStaffResponse(staff),
      };

      res.json(response);
    } catch (error) {
      logError('Error fetching staff', { error: (error as Error).message });
      throw error;
    }
  })
);

/**
 * PATCH /api/staff/:staffId
 * Update staff member
 */
router.patch(
  '/:staffId',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const paramValidation = StaffIdParamSchema.safeParse(req.params);
      if (!paramValidation.success) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid staff ID' },
        };
        res.status(400).json(response);
        return;
      }

      const updates = { ...req.body, updatedAt: new Date() };
      delete updates.staffId;
      delete updates.createdAt;

      const staff = await Staff.findOneAndUpdate(
        { staffId: paramValidation.data.staffId },
        updates,
        { new: true }
      );

      if (!staff) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Staff not found' },
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<StaffResponse> = {
        success: true,
        data: formatStaffResponse(staff),
      };

      res.json(response);
    } catch (error) {
      logError('Error updating staff', { error: (error as Error).message });
      throw error;
    }
  })
);

/**
 * PATCH /api/staff/:staffId/status
 * Update staff status
 */
router.patch(
  '/:staffId/status',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const paramValidation = StaffIdParamSchema.safeParse(req.params);
      if (!paramValidation.success) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid staff ID' },
        };
        res.status(400).json(response);
        return;
      }

      const statusValidation = StaffStatusInputSchema.safeParse(req.body);
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

      const { staffId } = paramValidation.data;
      const { status } = statusValidation.data;

      const staff = await Staff.findOneAndUpdate(
        { staffId },
        { status, updatedAt: new Date() },
        { new: true }
      );

      if (!staff) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Staff not found' },
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<StaffResponse> = {
        success: true,
        data: formatStaffResponse(staff),
      };

      res.json(response);
    } catch (error) {
      logError('Error updating staff status', { error: (error as Error).message });
      throw error;
    }
  })
);

/**
 * GET /api/staff/:staffId/shifts
 * Get staff member's shifts
 */
router.get(
  '/:staffId/shifts',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const paramValidation = StaffIdParamSchema.safeParse(req.params);
      if (!paramValidation.success) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid staff ID' },
        };
        res.status(400).json(response);
        return;
      }

      const { staffId } = paramValidation.data;
      const query: Record<string, unknown> = { staffId };

      if (req.query.startDate) {
        query.date = { $gte: new Date(req.query.startDate as string) };
      }
      if (req.query.endDate) {
        if (!query.date) query.date = {};
        (query.date as Record<string, unknown>).$lte = new Date(req.query.endDate as string);
      }
      if (req.query.status) query.status = req.query.status;

      const shifts = await Shift.find(query).sort({ date: 1 });

      const response: ApiResponse<typeof shifts> = {
        success: true,
        data: shifts,
      };

      res.json(response);
    } catch (error) {
      logError('Error fetching staff shifts', { error: (error as Error).message });
      throw error;
    }
  })
);

/**
 * GET /api/staff/:staffId/time-off
 * Get staff member's time off requests
 */
router.get(
  '/:staffId/time-off',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const paramValidation = StaffIdParamSchema.safeParse(req.params);
      if (!paramValidation.success) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid staff ID' },
        };
        res.status(400).json(response);
        return;
      }

      const { staffId } = paramValidation.data;
      const query: Record<string, unknown> = { staffId };

      if (req.query.status) query.status = req.query.status;

      const timeOffList = await TimeOff.find(query).sort({ startDate: -1 });

      const response: ApiResponse<TimeOffResponse[]> = {
        success: true,
        data: timeOffList.map(formatTimeOffResponse),
      };

      res.json(response);
    } catch (error) {
      logError('Error fetching staff time off', { error: (error as Error).message });
      throw error;
    }
  })
);

/**
 * POST /api/staff/:staffId/time-off
 * Create time off request
 */
router.post(
  '/:staffId/time-off',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const paramValidation = StaffIdParamSchema.safeParse(req.params);
      if (!paramValidation.success) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid staff ID' },
        };
        res.status(400).json(response);
        return;
      }

      const { startDate, endDate, type, reason } = req.body;

      if (!startDate || !endDate || !type) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Required fields missing' },
        };
        res.status(400).json(response);
        return;
      }

      const { staffId } = paramValidation.data;
      const timeOffId = `TOT-${uuidv4().substring(0, 8).toUpperCase()}`;

      const timeOff = new TimeOff({
        timeOffId,
        staffId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        type,
        reason,
      });

      await timeOff.save();

      logInfo('Time off request created', { timeOffId, staffId });

      const response: ApiResponse<TimeOffResponse> = {
        success: true,
        data: formatTimeOffResponse(timeOff),
      };

      res.status(201).json(response);
    } catch (error) {
      logError('Error creating time off request', { error: (error as Error).message });
      throw error;
    }
  })
);

/**
 * GET /api/staff/:staffId/availability
 * Check staff availability for a date
 */
router.get(
  '/:staffId/availability',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const paramValidation = StaffIdParamSchema.safeParse(req.params);
      if (!paramValidation.success) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid staff ID' },
        };
        res.status(400).json(response);
        return;
      }

      const { staffId } = paramValidation.data;
      const { date } = req.query;

      if (!date) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Date is required' },
        };
        res.status(400).json(response);
        return;
      }

      const staff = await Staff.findOne({ staffId });

      if (!staff) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Staff not found' },
        };
        res.status(404).json(response);
        return;
      }

      const hasTimeOff = await TimeOff.findOne({
        staffId,
        startDate: { $lte: new Date(date as string) },
        endDate: { $gte: new Date(date as string) },
        status: 'approved',
      });

      const response: ApiResponse<{
        staffId: string;
        date: string;
        available: boolean;
        timeOff: typeof hasTimeOff | null;
      }> = {
        success: true,
        data: {
          staffId,
          date: date as string,
          available: !hasTimeOff,
          timeOff: hasTimeOff,
        },
      };

      res.json(response);
    } catch (error) {
      logError('Error checking availability', { error: (error as Error).message });
      throw error;
    }
  })
);

// Helper functions
function formatStaffResponse(staff: typeof Staff.prototype): StaffResponse {
  return {
    staffId: staff.staffId,
    name: staff.name,
    email: staff.email,
    phone: staff.phone,
    role: staff.role,
    department: staff.department,
    locationId: staff.locationId,
    franchiseId: staff.franchiseId,
    employmentType: staff.employmentType,
    hourlyRate: staff.hourlyRate,
    skills: staff.skills,
    certifications: staff.certifications,
    status: staff.status,
  };
}

function formatTimeOffResponse(timeOff: typeof TimeOff.prototype): TimeOffResponse {
  return {
    timeOffId: timeOff.timeOffId,
    staffId: timeOff.staffId,
    startDate: timeOff.startDate,
    endDate: timeOff.endDate,
    type: timeOff.type,
    reason: timeOff.reason,
    status: timeOff.status,
    approvedBy: timeOff.approvedBy,
    approvedAt: timeOff.approvedAt,
  };
}

export default router;
