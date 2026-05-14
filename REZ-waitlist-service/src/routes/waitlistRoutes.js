import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Entry, Queue } from '../index.js';

const router = Router();

router.post('/join', async (req, res, next) => {
  try {
    const { queueId, customerName, customerPhone, customerId, partySize, notes } = req.body;
    if (!queueId || !customerName || !customerPhone) {
      return res.status(400).json({ success: false, error: 'Required fields missing' });
    }

    const queue = await Queue.findOne({ queueId, status: 'active' });
    if (!queue) return res.status(404).json({ success: false, error: 'Queue not found or inactive' });

    const lastEntry = await Entry.findOne({ queueId, status: 'waiting' }).sort({ position: -1 });
    const position = lastEntry ? lastEntry.position + 1 : 1;

    const estimatedWait = position * (queue.settings.estimatedWaitPerCustomer || 15);

    const entryId = `ENT-${uuidv4().substring(0, 8).toUpperCase()}`;
    const entry = new Entry({
      entryId, queueId, customerId, customerName, customerPhone,
      partySize: partySize || 1, position, status: 'waiting',
      estimatedWait, notes
    });

    await entry.save();

    res.status(201).json({
      success: true,
      data: {
        entryId,
        queueId,
        position,
        estimatedWait,
        message: `You are #${position} in the queue. Estimated wait: ${estimatedWait} minutes.`
      }
    });
  } catch (error) { next(error); }
});

router.get('/', async (req, res, next) => {
  try {
    const { queueId, status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (queueId) query.queueId = queueId;
    if (status) query.status = status;

    const [entries, total] = await Promise.all([
      Entry.find(query).sort({ position: 1 }).skip((parseInt(page) - 1) * parseInt(limit)).limit(parseInt(limit)),
      Entry.countDocuments(query)
    ]);

    res.json({ success: true, data: { entries, total } });
  } catch (error) { next(error); }
});

router.get('/:entryId', async (req, res, next) => {
  try {
    const entry = await Entry.findOne({ entryId: req.params.entryId });
    if (!entry) return res.status(404).json({ success: false, error: 'Entry not found' });
    res.json({ success: true, data: entry });
  } catch (error) { next(error); }
});

router.get('/customer/:customerId', async (req, res, next) => {
  try {
    const entries = await Entry.find({ customerId: req.params.customerId, status: 'waiting' })
      .sort({ createdAt: -1 })
      .limit(5);
    res.json({ success: true, data: entries });
  } catch (error) { next(error); }
});

router.patch('/:entryId/call', async (req, res, next) => {
  try {
    const entry = await Entry.findOneAndUpdate(
      { entryId: req.params.entryId, status: 'waiting' },
      { status: 'called', calledAt: new Date(), updatedAt: new Date() },
      { new: true }
    );
    if (!entry) return res.status(404).json({ success: false, error: 'Waiting entry not found' });
    res.json({ success: true, data: entry });
  } catch (error) { next(error); }
});

router.patch('/:entryId/seat', async (req, res, next) => {
  try {
    const entry = await Entry.findOne({ entryId: req.params.entryId });
    if (!entry) return res.status(404).json({ success: false, error: 'Entry not found' });

    const actualWait = Math.round((Date.now() - new Date(entry.createdAt).getTime()) / 60000);

    entry.status = 'seated';
    entry.seatedAt = new Date();
    entry.actualWait = actualWait;
    entry.updatedAt = new Date();
    await entry.save();

    await Entry.updateMany(
      { queueId: entry.queueId, position: { $gt: entry.position }, status: 'waiting' },
      { $inc: { position: -1 } }
    );

    const queue = await Queue.findOneAndUpdate(
      { queueId: entry.queueId },
      {
        $inc: { 'stats.totalServed': 1 },
        $set: { 'stats.averageWaitTime': actualWait }
      },
      { new: true }
    );

    res.json({ success: true, data: { entry, actualWait } });
  } catch (error) { next(error); }
});

router.patch('/:entryId/cancel', async (req, res, next) => {
  try {
    const entry = await Entry.findOneAndUpdate(
      { entryId: req.params.entryId, status: { $in: ['waiting', 'called'] } },
      { status: 'cancelled', updatedAt: new Date() },
      { new: true }
    );
    if (!entry) return res.status(404).json({ success: false, error: 'Active entry not found' });

    await Entry.updateMany(
      { queueId: entry.queueId, position: { $gt: entry.position }, status: 'waiting' },
      { $inc: { position: -1 } }
    );

    res.json({ success: true, data: { entryId: entry.entryId, status: 'cancelled' } });
  } catch (error) { next(error); }
});

router.patch('/:entryId/no-show', async (req, res, next) => {
  try {
    const entry = await Entry.findOneAndUpdate(
      { entryId: req.params.entryId, status: 'called' },
      { status: 'no_show', updatedAt: new Date() },
      { new: true }
    );
    if (!entry) return res.status(404).json({ success: false, error: 'Called entry not found' });

    await Entry.updateMany(
      { queueId: entry.queueId, position: { $gt: entry.position }, status: 'waiting' },
      { $inc: { position: -1 } }
    );

    res.json({ success: true, data: { entryId: entry.entryId, status: 'no_show' } });
  } catch (error) { next(error); }
});

router.get('/:queueId/position/:entryId', async (req, res, next) => {
  try {
    const entry = await Entry.findOne({ entryId: req.params.entryId, queueId: req.params.queueId });
    if (!entry) return res.status(404).json({ success: false, error: 'Entry not found' });

    const queue = await Queue.findOne({ queueId: req.params.queueId });
    const aheadCount = await Entry.countDocuments({
      queueId: req.params.queueId,
      position: { $lt: entry.position },
      status: 'waiting'
    });

    const estimatedWait = aheadCount * (queue?.settings.estimatedWaitPerCustomer || 15);

    res.json({
      success: true,
      data: {
        entryId: entry.entryId,
        position: entry.position,
        status: entry.status,
        aheadInQueue: aheadCount,
        estimatedWait,
        partySize: entry.partySize
      }
    });
  } catch (error) { next(error); }
});

export default router;
