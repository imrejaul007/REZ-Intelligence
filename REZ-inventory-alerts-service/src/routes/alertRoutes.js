import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Alert, AlertRule, MonitoredProduct } from '../index.js';

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    const { productId, locationId, franchiseId, type, severity, currentStock, threshold, message, channels } = req.body;
    if (!productId || !type) return res.status(400).json({ success: false, error: 'productId and type required' });

    const alertId = `ALT-${uuidv4().substring(0, 8).toUpperCase()}`;
    const alert = new Alert({ alertId, productId, locationId, franchiseId, type, severity, currentStock, threshold, message, channels, status: 'active' });
    await alert.save();

    res.status(201).json({ success: true, data: alert });
  } catch (error) { next(error); }
});

router.get('/', async (req, res, next) => {
  try {
    const { status, type, severity, locationId, franchiseId, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (type) query.type = type;
    if (severity) query.severity = severity;
    if (locationId) query.locationId = locationId;
    if (franchiseId) query.franchiseId = franchiseId;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

    const [alerts, total] = await Promise.all([
      Alert.find(query).sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
      Alert.countDocuments(query)
    ]);

    res.json({ success: true, data: { alerts, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } } });
  } catch (error) { next(error); }
});

router.get('/:alertId', async (req, res, next) => {
  try {
    const alert = await Alert.findOne({ alertId: req.params.alertId });
    if (!alert) return res.status(404).json({ success: false, error: 'Alert not found' });
    res.json({ success: true, data: alert });
  } catch (error) { next(error); }
});

router.patch('/:alertId/acknowledge', async (req, res, next) => {
  try {
    const { acknowledgedBy } = req.body;
    const alert = await Alert.findOneAndUpdate({ alertId: req.params.alertId, status: 'active' }, { status: 'acknowledged', acknowledgedBy, acknowledgedAt: new Date() }, { new: true });
    if (!alert) return res.status(404).json({ success: false, error: 'Active alert not found' });
    res.json({ success: true, data: alert });
  } catch (error) { next(error); }
});

router.patch('/:alertId/resolve', async (req, res, next) => {
  try {
    const { resolvedBy } = req.body;
    const alert = await Alert.findOneAndUpdate({ alertId: req.params.alertId, status: { $in: ['active', 'acknowledged'] } }, { status: 'resolved', resolvedBy, resolvedAt: new Date() }, { new: true });
    if (!alert) return res.status(404).json({ success: false, error: 'Active alert not found' });
    res.json({ success: true, data: alert });
  } catch (error) { next(error); }
});

router.patch('/:alertId/snooze', async (req, res, next) => {
  try {
    const { hours = 24 } = req.body;
    const snoozedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
    const alert = await Alert.findOneAndUpdate({ alertId: req.params.alertId, status: { $in: ['active', 'acknowledged'] } }, { status: 'snoozed', snoozedUntil }, { new: true });
    if (!alert) return res.status(404).json({ success: false, error: 'Active alert not found' });
    res.json({ success: true, data: alert });
  } catch (error) { next(error); }
});

router.get('/stats/summary', async (req, res, next) => {
  try {
    const { franchiseId, locationId } = req.query;
    const query = { franchiseId, locationId };

    const summary = await Alert.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    const severityCounts = await Alert.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$severity', count: { $sum: 1 } } }
    ]);

    res.json({ success: true, data: { byType: summary, bySeverity: severityCounts } });
  } catch (error) { next(error); }
});

router.get('/rules', async (req, res, next) => {
  try {
    const { franchiseId, enabled } = req.query;
    const query = {};
    if (franchiseId) query.franchiseId = franchiseId;
    if (enabled !== undefined) query.enabled = enabled === 'true';

    const rules = await AlertRule.find(query);
    res.json({ success: true, data: rules });
  } catch (error) { next(error); }
});

router.post('/rules', async (req, res, next) => {
  try {
    const { name, description, franchiseId, locationId, conditions, actions, severity } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'name required' });

    const ruleId = `RUL-${uuidv4().substring(0, 8).toUpperCase()}`;
    const rule = new AlertRule({ ruleId, name, description, franchiseId, locationId, conditions, actions, severity });
    await rule.save();

    res.status(201).json({ success: true, data: rule });
  } catch (error) { next(error); }
});

export default router;
