import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { MonitoredProduct } from '../index.js';

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    const { productId, name, sku, locationId, franchiseId, supplierId, threshold, criticalThreshold, reorderPoint, reorderQuantity } = req.body;
    if (!productId) return res.status(400).json({ success: false, error: 'productId required' });

    const existing = await MonitoredProduct.findOne({ productId });
    if (existing) return res.status(400).json({ success: false, error: 'Product already monitored' });

    const product = new MonitoredProduct({
      productId, name, sku, locationId, franchiseId, supplierId,
      threshold: threshold || 10,
      criticalThreshold: criticalThreshold || 5,
      reorderPoint, reorderQuantity,
      status: 'ok'
    });
    await product.save();

    res.status(201).json({ success: true, data: product });
  } catch (error) { next(error); }
});

router.get('/', async (req, res, next) => {
  try {
    const { status, locationId, franchiseId, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (locationId) query.locationId = locationId;
    if (franchiseId) query.franchiseId = franchiseId;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

    const [products, total] = await Promise.all([
      MonitoredProduct.find(query).sort({ status: 1, currentStock: 1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
      MonitoredProduct.countDocuments(query)
    ]);

    res.json({ success: true, data: { products, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } } });
  } catch (error) { next(error); }
});

router.get('/:productId', async (req, res, next) => {
  try {
    const product = await MonitoredProduct.findOne({ productId: req.params.productId });
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
    res.json({ success: true, data: product });
  } catch (error) { next(error); }
});

router.patch('/:productId', async (req, res, next) => {
  try {
    const updates = { ...req.body };
    delete updates.productId;
    delete updates.createdAt;
    updates.updatedAt = new Date();

    const product = await MonitoredProduct.findOneAndUpdate({ productId: req.params.productId }, updates, { new: true });
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
    res.json({ success: true, data: product });
  } catch (error) { next(error); }
});

router.patch('/:productId/stock', async (req, res, next) => {
  try {
    const { currentStock } = req.body;
    if (currentStock === undefined) return res.status(400).json({ success: false, error: 'currentStock required' });

    const product = await MonitoredProduct.findOne({ productId: req.params.productId });
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });

    product.currentStock = currentStock;
    product.lastChecked = new Date();

    let newStatus = 'ok';
    if (currentStock === 0) newStatus = 'out_of_stock';
    else if (currentStock <= product.criticalThreshold) newStatus = 'critical';
    else if (currentStock <= product.threshold) newStatus = 'low_stock';

    product.status = newStatus;
    product.updatedAt = new Date();
    await product.save();

    res.json({ success: true, data: { productId: product.productId, currentStock, status: newStatus } });
  } catch (error) { next(error); }
});

router.patch('/:productId/pause', async (req, res, next) => {
  try {
    const product = await MonitoredProduct.findOneAndUpdate({ productId: req.params.productId }, { status: 'paused', updatedAt: new Date() }, { new: true });
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
    res.json({ success: true, data: product });
  } catch (error) { next(error); }
});

router.delete('/:productId', async (req, res, next) => {
  try {
    const result = await MonitoredProduct.deleteOne({ productId: req.params.productId });
    if (result.deletedCount === 0) return res.status(404).json({ success: false, error: 'Product not found' });
    res.json({ success: true, data: { productId: req.params.productId, deleted: true } });
  } catch (error) { next(error); }
});

export default router;
