import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Reservation, TableModel } from '../index.js';

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    const { restaurantId, customerName, customerPhone, customerEmail, partySize, dateTime, duration, specialRequests, occasion } = req.body;
    if (!restaurantId || !customerName || !customerPhone || !partySize || !dateTime) {
      return res.status(400).json({ success: false, error: 'Required fields missing' });
    }

    const reservationId = `RES-${uuidv4().substring(0, 8).toUpperCase()}`;
    const reservation = new Reservation({
      reservationId, restaurantId, customerName, customerPhone, customerEmail,
      partySize, dateTime: new Date(dateTime), duration: duration || 90,
      specialRequests, occasion, status: 'confirmed',
      timeline: [{ status: 'confirmed', notes: 'Reservation created' }]
    });

    await reservation.save();
    res.status(201).json({ success: true, data: reservation });
  } catch (error) { next(error); }
});

router.get('/', async (req, res, next) => {
  try {
    const { restaurantId, customerId, status, date, page = 1, limit = 20 } = req.query;
    const query = {};
    if (restaurantId) query.restaurantId = restaurantId;
    if (customerId) query.customerId = customerId;
    if (status) query.status = status;
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      query.dateTime = { $gte: startDate, $lt: endDate };
    }

    const [reservations, total] = await Promise.all([
      Reservation.find(query).sort({ dateTime: 1 }).skip((parseInt(page) - 1) * parseInt(limit)).limit(parseInt(limit)),
      Reservation.countDocuments(query)
    ]);

    res.json({ success: true, data: { reservations, total } });
  } catch (error) { next(error); }
});

router.get('/:reservationId', async (req, res, next) => {
  try {
    const reservation = await Reservation.findOne({ reservationId: req.params.reservationId });
    if (!reservation) return res.status(404).json({ success: false, error: 'Reservation not found' });
    res.json({ success: true, data: reservation });
  } catch (error) { next(error); }
});

router.patch('/:reservationId/status', async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    const validStatuses = ['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show'];
    if (!validStatuses.includes(status)) return res.status(400).json({ success: false, error: 'Invalid status' });

    const reservation = await Reservation.findOneAndUpdate(
      { reservationId: req.params.reservationId },
      { status, $push: { timeline: { status, notes } }, updatedAt: new Date() },
      { new: true }
    );

    if (!reservation) return res.status(404).json({ success: false, error: 'Reservation not found' });
    res.json({ success: true, data: reservation });
  } catch (error) { next(error); }
});

router.get('/availability/:restaurantId', async (req, res, next) => {
  try {
    const { date, partySize } = req.query;
    if (!date) return res.status(400).json({ success: false, error: 'date required' });

    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);

    const existingReservations = await Reservation.find({
      restaurantId: req.params.restaurantId,
      dateTime: { $gte: startDate, $lt: endDate },
      status: { $in: ['confirmed', 'seated'] }
    });

    const tables = await TableModel.find({ restaurantId: req.params.restaurantId, status: 'available' });
    const availableSlots = [];

    for (let hour = 11; hour <= 21; hour++) {
      for (let min = 0; min < 60; min += 30) {
        const slotTime = new Date(startDate);
        slotTime.setHours(hour, min, 0, 0);
        const slotEnd = new Date(slotTime.getTime() + 90 * 60000);

        const hasConflict = existingReservations.some(r => {
          const resStart = new Date(r.dateTime);
          const resEnd = new Date(resStart.getTime() + (r.duration || 90) * 60000);
          return (slotTime >= resStart && slotTime < resEnd) || (slotEnd > resStart && slotEnd <= resEnd);
        });

        if (!hasConflict) {
          availableSlots.push({ time: slotTime.toISOString(), partySize: parseInt(partySize) || 2 });
        }
      }
    }

    res.json({ success: true, data: { date, availableSlots, totalSlots: availableSlots.length } });
  } catch (error) { next(error); }
});

router.delete('/:reservationId', async (req, res, next) => {
  try {
    const reservation = await Reservation.findOneAndUpdate(
      { reservationId: req.params.reservationId },
      { status: 'cancelled', $push: { timeline: { status: 'cancelled', notes: 'Cancelled by user' } }, updatedAt: new Date() },
      { new: true }
    );
    if (!reservation) return res.status(404).json({ success: false, error: 'Reservation not found' });
    res.json({ success: true, data: { reservationId: reservation.reservationId, status: 'cancelled' } });
  } catch (error) { next(error); }
});

export default router;
