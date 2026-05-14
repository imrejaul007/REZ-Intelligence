import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { TableModel } from '../index.js';

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    const { restaurantId, tableNumber, capacity, location } = req.body;
    if (!restaurantId || !tableNumber) return res.status(400).json({ success: false, error: 'restaurantId and tableNumber required' });

    const tableId = `TBL-${uuidv4().substring(0, 8).toUpperCase()}`;
    const table = new TableModel({ tableId, restaurantId, tableNumber, capacity, location });
    await table.save();
    res.status(201).json({ success: true, data: table });
  } catch (error) { next(error); }
});

router.get('/', async (req, res, next) => {
  try {
    const { restaurantId, status, location } = req.query;
    const query = {};
    if (restaurantId) query.restaurantId = restaurantId;
    if (status) query.status = status;
    if (location) query.location = location;

    const tables = await TableModel.find(query);
    res.json({ success: true, data: tables });
  } catch (error) { next(error); }
});

router.get('/:tableId', async (req, res, next) => {
  try {
    const table = await TableModel.findOne({ tableId: req.params.tableId });
    if (!table) return res.status(404).json({ success: false, error: 'Table not found' });
    res.json({ success: true, data: table });
  } catch (error) { next(error); }
});

router.patch('/:tableId', async (req, res, next) => {
  try {
    const table = await TableModel.findOneAndUpdate({ tableId: req.params.tableId }, req.body, { new: true });
    if (!table) return res.status(404).json({ success: false, error: 'Table not found' });
    res.json({ success: true, data: table });
  } catch (error) { next(error); }
});

router.delete('/:tableId', async (req, res, next) => {
  try {
    const result = await TableModel.deleteOne({ tableId: req.params.tableId });
    if (result.deletedCount === 0) return res.status(404).json({ success: false, error: 'Table not found' });
    res.json({ success: true, data: { tableId: req.params.tableId, deleted: true } });
  } catch (error) { next(error); }
});

export default router;
