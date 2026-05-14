import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Restaurant } from '../index.js';

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    const { name, franchiseId, locationId, address, contact, settings, operatingHours } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'name required' });

    const restaurantId = `RST-${uuidv4().substring(0, 8).toUpperCase()}`;
    const restaurant = new Restaurant({ restaurantId, name, franchiseId, locationId, address, contact, settings, operatingHours });
    await restaurant.save();
    res.status(201).json({ success: true, data: restaurant });
  } catch (error) { next(error); }
});

router.get('/', async (req, res, next) => {
  try {
    const { franchiseId, status } = req.query;
    const query = {};
    if (franchiseId) query.franchiseId = franchiseId;
    if (status) query.status = status;

    const restaurants = await Restaurant.find(query);
    res.json({ success: true, data: restaurants });
  } catch (error) { next(error); }
});

router.get('/:restaurantId', async (req, res, next) => {
  try {
    const restaurant = await Restaurant.findOne({ restaurantId: req.params.restaurantId });
    if (!restaurant) return res.status(404).json({ success: false, error: 'Restaurant not found' });
    res.json({ success: true, data: restaurant });
  } catch (error) { next(error); }
});

router.patch('/:restaurantId', async (req, res, next) => {
  try {
    const restaurant = await Restaurant.findOneAndUpdate({ restaurantId: req.params.restaurantId }, req.body, { new: true });
    if (!restaurant) return res.status(404).json({ success: false, error: 'Restaurant not found' });
    res.json({ success: true, data: restaurant });
  } catch (error) { next(error); }
});

export default router;
