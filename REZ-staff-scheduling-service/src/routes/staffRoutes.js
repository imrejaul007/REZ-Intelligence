import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Staff, Shift, TimeOff } from '../index.js';

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    const { name, email, phone, role, department, locationId, franchiseId, employmentType, hourlyRate, skills, availability } = req.body;
    if (!name || !role) return res.status(400).json({ success: false, error: 'name and role required' });

    const staffId = `STF-${uuidv4().substring(0, 8).toUpperCase()}`;
    const staff = new Staff({ staffId, name, email, phone, role, department, locationId, franchiseId, employmentType, hourlyRate, skills, availability });
    await staff.save();

    res.status(201).json({ success: true, data: staff });
  } catch (error) { next(error); }
});

router.get('/', async (req, res, next) => {
  try {
    const { locationId, franchiseId, role, status } = req.query;
    const query = {};
    if (locationId) query.locationId = locationId;
    if (franchiseId) query.franchiseId = franchiseId;
    if (role) query.role = role;
    if (status) query.status = status;

    const staff = await Staff.find(query).sort({ name: 1 });
    res.json({ success: true, data: staff });
  } catch (error) { next(error); }
});

router.get('/:staffId', async (req, res, next) => {
  try {
    const staff = await Staff.findOne({ staffId: req.params.staffId });
    if (!staff) return res.status(404).json({ success: false, error: 'Staff not found' });
    res.json({ success: true, data: staff });
  } catch (error) { next(error); }
});

router.patch('/:staffId', async (req, res, next) => {
  try {
    const updates = { ...req.body, updatedAt: new Date() };
    delete updates.staffId;
    delete updates.createdAt;

    const staff = await Staff.findOneAndUpdate({ staffId: req.params.staffId }, updates, { new: true });
    if (!staff) return res.status(404).json({ success: false, error: 'Staff not found' });
    res.json({ success: true, data: staff });
  } catch (error) { next(error); }
});

router.patch('/:staffId/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const staff = await Staff.findOneAndUpdate({ staffId: req.params.staffId }, { status, updatedAt: new Date() }, { new: true });
    if (!staff) return res.status(404).json({ success: false, error: 'Staff not found' });
    res.json({ success: true, data: staff });
  } catch (error) { next(error); }
});

router.get('/:staffId/shifts', async (req, res, next) => {
  try {
    const { startDate, endDate, status } = req.query;
    const query = { staffId: req.params.staffId };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    if (status) query.status = status;

    const shifts = await Shift.find(query).sort({ date: 1 });
    res.json({ success: true, data: shifts });
  } catch (error) { next(error); }
});

router.get('/:staffId/time-off', async (req, res, next) => {
  try {
    const { status } = req.query;
    const query = { staffId: req.params.staffId };
    if (status) query.status = status;

    const timeOff = await TimeOff.find(query).sort({ startDate: -1 });
    res.json({ success: true, data: timeOff });
  } catch (error) { next(error); }
});

router.post('/:staffId/time-off', async (req, res, next) => {
  try {
    const { startDate, endDate, type, reason } = req.body;
    if (!startDate || !endDate || !type) return res.status(400).json({ success: false, error: 'Required fields missing' });

    const timeOffId = `TOT-${uuidv4().substring(0, 8).toUpperCase()}`;
    const timeOff = new TimeOff({ timeOffId, staffId: req.params.staffId, startDate: new Date(startDate), endDate: new Date(endDate), type, reason });
    await timeOff.save();

    res.status(201).json({ success: true, data: timeOff });
  } catch (error) { next(error); }
});

router.get('/:staffId/availability', async (req, res, next) => {
  try {
    const { date } = req.query;
    const staff = await Staff.findOne({ staffId: req.params.staffId });

    if (!staff) return res.status(404).json({ success: false, error: 'Staff not found' });

    const hasTimeOff = await TimeOff.findOne({
      staffId: req.params.staffId,
      startDate: { $lte: new Date(date) },
      endDate: { $gte: new Date(date) },
      status: 'approved'
    });

    res.json({
      success: true,
      data: {
        staffId: req.params.staffId,
        date,
        available: !hasTimeOff,
        timeOff: hasTimeOff || null
      }
    });
  } catch (error) { next(error); }
});

export default router;
