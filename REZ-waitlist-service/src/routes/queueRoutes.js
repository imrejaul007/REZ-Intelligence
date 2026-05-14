import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Queue, Entry } from '../index.js';

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    const { name, locationId, franchiseId, type, settings } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'name required' });

    const queueId = `QUE-${uuidv4().substring(0, 8).toUpperCase()}`;
    const queue = new Queue({ queueId, name, locationId, franchiseId, type, settings });
    await queue.save();

    res.status(201).json({ success: true, data: queue });
  } catch (error) { next(error); }
});

router.get('/', async (req, res, next) => {
  try {
    const { locationId, status, type } = req.query;
    const query = {};
    if (locationId) query.locationId = locationId;
    if (status) query.status = status;
    if (type) query.type = type;

    const queues = await Queue.find(query);
    res.json({ success: true, data: queues });
  } catch (error) { next(error); }
});

router.get('/:queueId', async (req, res, next) => {
  try {
    const queue = await Queue.findOne({ queueId: req.params.queueId });
    if (!queue) return res.status(404).json({ success: false, error: 'Queue not found' });

    const currentWait = await Entry.countDocuments({ queueId: req.params.queueId, status: 'waiting' });
    res.json({ success: true, data: { ...queue.toObject(), currentWait } });
  } catch (error) { next(error); }
});

router.patch('/:queueId', async (req, res, next) => {
  try {
    const queue = await Queue.findOneAndUpdate({ queueId: req.params.queueId }, req.body, { new: true });
    if (!queue) return res.status(404).json({ success: false, error: 'Queue not found' });
    res.json({ success: true, data: queue });
  } catch (error) { next(error); }
});

router.patch('/:queueId/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['active', 'paused', 'closed'];
    if (!validStatuses.includes(status)) return res.status(400).json({ success: false, error: 'Invalid status' });

    const queue = await Queue.findOneAndUpdate({ queueId: req.params.queueId }, { status }, { new: true });
    if (!queue) return res.status(404).json({ success: false, error: 'Queue not found' });
    res.json({ success: true, data: queue });
  } catch (error) { next(error); }
});

router.get('/:queueId/stats', async (req, res, next) => {
  try {
    const queue = await Queue.findOne({ queueId: req.params.queueId });
    if (!queue) return res.status(404).json({ success: false, error: 'Queue not found' });

    const currentWait = await Entry.countDocuments({ queueId: req.params.queueId, status: 'waiting' });
    const calledCount = await Entry.countDocuments({ queueId: req.params.queueId, status: 'called' });

    res.json({
      success: true,
      data: {
        queueId: req.params.queueId,
        stats: queue.stats,
        currentWait,
        currentlyCalled: calledCount
      }
    });
  } catch (error) { next(error); }
});

export default router;
