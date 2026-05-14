import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Shift, Schedule, TimeOff } from '../index.js';

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    const { scheduleId, staffId, locationId, role, date, startTime, endTime, breakMinutes, notes } = req.body;
    if (!scheduleId || !staffId || !locationId || !role || !date || !startTime || !endTime) {
      return res.status(400).json({ success: false, error: 'Required fields missing' });
    }

    const shiftId = `SFT-${uuidv4().substring(0, 8).toUpperCase()}`;
    const shiftDate = new Date(date);

    const hasTimeOff = await TimeOff.findOne({
      staffId,
      startDate: { $lte: shiftDate },
      endDate: { $gte: shiftDate },
      status: 'approved'
    });

    if (hasTimeOff) {
      return res.status(400).json({ success: false, error: 'Staff has approved time off on this date' });
    }

    const startParts = startTime.split(':').map(Number);
    const endParts = endTime.split(':').map(Number);
    const startMinutes = startParts[0] * 60 + startParts[1];
    const endMinutes = endParts[0] * 60 + endParts[1];
    let totalMinutes = endMinutes - startMinutes - (breakMinutes || 0);
    if (totalMinutes < 0) totalMinutes += 24 * 60;
    const totalHours = totalMinutes / 60;

    const shift = new Shift({
      shiftId, scheduleId, staffId, locationId, role,
      date: shiftDate, startTime, endTime, breakMinutes: breakMinutes || 0,
      totalHours, notes, status: 'scheduled'
    });

    await shift.save();
    res.status(201).json({ success: true, data: shift });
  } catch (error) { next(error); }
});

router.get('/', async (req, res, next) => {
  try {
    const { locationId, staffId, scheduleId, status, startDate, endDate } = req.query;
    const query = {};
    if (locationId) query.locationId = locationId;
    if (staffId) query.staffId = staffId;
    if (scheduleId) query.scheduleId = scheduleId;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const shifts = await Shift.find(query).sort({ date: 1, startTime: 1 });
    res.json({ success: true, data: shifts });
  } catch (error) { next(error); }
});

router.get('/:shiftId', async (req, res, next) => {
  try {
    const shift = await Shift.findOne({ shiftId: req.params.shiftId });
    if (!shift) return res.status(404).json({ success: false, error: 'Shift not found' });
    res.json({ success: true, data: shift });
  } catch (error) { next(error); }
});

router.patch('/:shiftId', async (req, res, next) => {
  try {
    const updates = { ...req.body, updatedAt: new Date() };
    delete updates.shiftId;
    delete updates.createdAt;

    const shift = await Shift.findOneAndUpdate({ shiftId: req.params.shiftId }, updates, { new: true });
    if (!shift) return res.status(404).json({ success: false, error: 'Shift not found' });
    res.json({ success: true, data: shift });
  } catch (error) { next(error); }
});

router.patch('/:shiftId/status', async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    const shift = await Shift.findOneAndUpdate(
      { shiftId: req.params.shiftId },
      { status, notes, updatedAt: new Date() },
      { new: true }
    );
    if (!shift) return res.status(404).json({ success: false, error: 'Shift not found' });
    res.json({ success: true, data: shift });
  } catch (error) { next(error); }
});

router.post('/:shiftId/clock-in', async (req, res, next) => {
  try {
    const shift = await Shift.findOneAndUpdate(
      { shiftId: req.params.shiftId, status: 'scheduled' },
      {
        status: 'in_progress',
        'timesheet.clockIn': new Date(),
        updatedAt: new Date()
      },
      { new: true }
    );
    if (!shift) return res.status(404).json({ success: false, error: 'Scheduled shift not found' });
    res.json({ success: true, data: shift });
  } catch (error) { next(error); }
});

router.post('/:shiftId/clock-out', async (req, res, next) => {
  try {
    const shift = await Shift.findOne({ shiftId: req.params.shiftId, status: 'in_progress' });
    if (!shift) return res.status(404).json({ success: false, error: 'Active shift not found' });

    const clockOut = new Date();
    const clockIn = new Date(shift.timesheet.clockIn);
    const hoursWorked = (clockOut - clockIn) / (1000 * 60 * 60);
    const overtimeHours = Math.max(0, hoursWorked - shift.totalHours);

    shift.status = 'completed';
    shift.timesheet.clockOut = clockOut;
    shift.timesheet.hoursWorked = Math.round(hoursWorked * 100) / 100;
    shift.timesheet.overtimeHours = Math.round(overtimeHours * 100) / 100;
    shift.updatedAt = new Date();
    await shift.save();

    res.json({ success: true, data: shift });
  } catch (error) { next(error); }
});

router.delete('/:shiftId', async (req, res, next) => {
  try {
    const result = await Shift.deleteOne({ shiftId: req.params.shiftId, status: 'scheduled' });
    if (result.deletedCount === 0) return res.status(404).json({ success: false, error: 'Scheduled shift not found' });
    res.json({ success: true, data: { shiftId: req.params.shiftId, deleted: true } });
  } catch (error) { next(error); }
});

router.get('/reports/hours', async (req, res, next) => {
  try {
    const { startDate, endDate, locationId, staffId } = req.query;
    const match = { status: 'completed' };

    if (startDate || endDate) {
      match.date = {};
      if (startDate) match.date.$gte = new Date(startDate);
      if (endDate) match.date.$lte = new Date(endDate);
    }
    if (locationId) match.locationId = locationId;
    if (staffId) match.staffId = staffId;

    const report = await Shift.aggregate([
      { $match: match },
      {
        $group: {
          _id: { staffId: '$staffId', date: '$date' },
          hoursWorked: { $sum: '$timesheet.hoursWorked' },
          overtimeHours: { $sum: '$timesheet.overtimeHours' },
          shiftCount: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': -1 } }
    ]);

    res.json({ success: true, data: report });
  } catch (error) { next(error); }
});

export default router;
