import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Schedule, Shift } from '../index.js';

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    const { locationId, franchiseId, weekStart, createdBy, notes } = req.body;
    if (!locationId || !weekStart) return res.status(400).json({ success: false, error: 'locationId and weekStart required' });

    const startDate = new Date(weekStart);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);

    const existing = await Schedule.findOne({ locationId, weekStart: { $gte: startDate, $lt: endDate } });
    if (existing) return res.status(400).json({ success: false, error: 'Schedule already exists for this week' });

    const scheduleId = `SCH-${uuidv4().substring(0, 8).toUpperCase()}`;
    const schedule = new Schedule({ scheduleId, locationId, franchiseId, weekStart: startDate, weekEnd: endDate, createdBy, notes });
    await schedule.save();

    res.status(201).json({ success: true, data: schedule });
  } catch (error) { next(error); }
});

router.get('/', async (req, res, next) => {
  try {
    const { locationId, franchiseId, status } = req.query;
    const query = {};
    if (locationId) query.locationId = locationId;
    if (franchiseId) query.franchiseId = franchiseId;
    if (status) query.status = status;

    const schedules = await Schedule.find(query).sort({ weekStart: -1 });
    res.json({ success: true, data: schedules });
  } catch (error) { next(error); }
});

router.get('/:scheduleId', async (req, res, next) => {
  try {
    const schedule = await Schedule.findOne({ scheduleId: req.params.scheduleId });
    if (!schedule) return res.status(404).json({ success: false, error: 'Schedule not found' });

    const shifts = await Shift.find({ scheduleId: req.params.scheduleId }).sort({ date: 1, startTime: 1 });
    res.json({ success: true, data: { ...schedule.toObject(), shifts } });
  } catch (error) { next(error); }
});

router.patch('/:scheduleId/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const update = { status, updatedAt: new Date() };
    if (status === 'published') update.publishedAt = new Date();

    const schedule = await Schedule.findOneAndUpdate({ scheduleId: req.params.scheduleId }, update, { new: true });
    if (!schedule) return res.status(404).json({ success: false, error: 'Schedule not found' });

    res.json({ success: true, data: schedule });
  } catch (error) { next(error); }
});

router.get('/:scheduleId/shifts', async (req, res, next) => {
  try {
    const shifts = await Shift.find({ scheduleId: req.params.scheduleId }).sort({ date: 1, startTime: 1 });
    res.json({ success: true, data: shifts });
  } catch (error) { next(error); }
});

export default router;
