/**
 * Logistics Expert Routes
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { logisticsExpertService } from '../services/logisticsExpert';

export const logisticsRouter = Router();

// Validation schemas
const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  context: z.object({
    fleetSize: z.number().optional(),
    industry: z.string().optional(),
  }).optional(),
});

const optimizeSchema = z.object({
  stops: z.array(z.object({
    id: z.string(),
    location: z.object({
      address: z.string(),
      city: z.string(),
      state: z.string(),
      pincode: z.string(),
      latitude: z.number(),
      longitude: z.number(),
    }),
    priority: z.number().optional(),
  })),
  vehicleId: z.string().optional(),
  startLocation: z.object({
    address: z.string(),
    city: z.string(),
    state: z.string(),
    pincode: z.string(),
    latitude: z.number(),
    longitude: z.number(),
  }).optional(),
});

const shipmentSchema = z.object({
  origin: z.object({
    address: z.string(),
    city: z.string(),
    state: z.string(),
    pincode: z.string(),
    latitude: z.number(),
    longitude: z.number(),
  }),
  destination: z.object({
    address: z.string(),
    city: z.string(),
    state: z.string(),
    pincode: z.string(),
    latitude: z.number(),
    longitude: z.number(),
  }),
  weight: z.number().positive(),
  priority: z.enum(['standard', 'express', 'overnight']),
});

// POST /api/v1/logistics/chat
logisticsRouter.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, context } = chatSchema.parse(req.body);
    const response = await logisticsExpertService.chat(message, context);
    res.json({ success: true, data: { response } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.errors } });
    } else {
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Chat failed' } });
    }
  }
});

// POST /api/v1/logistics/optimize
logisticsRouter.post('/optimize', async (req: Request, res: Response) => {
  try {
    const params = optimizeSchema.parse(req.body);
    const result = await logisticsExpertService.optimizeRoute(params);
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.errors } });
    } else {
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Optimization failed' } });
    }
  }
});

// GET /api/v1/logistics/track/:shipmentId
logisticsRouter.get('/track/:shipmentId', async (req: Request, res: Response) => {
  try {
    const shipment = await logisticsExpertService.trackShipment(req.params.shipmentId);
    if (!shipment) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Shipment not found' } });
    } else {
      res.json({ success: true, data: shipment });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Tracking failed' } });
  }
});

// GET /api/v1/logistics/fleet
logisticsRouter.get('/fleet', async (_req: Request, res: Response) => {
  try {
    const fleet = await logisticsExpertService.getFleetStatus();
    res.json({ success: true, data: fleet });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch fleet' } });
  }
});

// GET /api/v1/logistics/shipments
logisticsRouter.get('/shipments', async (_req: Request, res: Response) => {
  try {
    const shipments = await logisticsExpertService.getActiveShipments();
    res.json({ success: true, data: shipments });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch shipments' } });
  }
});

// POST /api/v1/logistics/shipments
logisticsRouter.post('/shipments', async (req: Request, res: Response) => {
  try {
    const params = shipmentSchema.parse(req.body);
    const shipment = await logisticsExpertService.createShipment(params);
    res.status(201).json({ success: true, data: shipment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.errors } });
    } else {
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create shipment' } });
    }
  }
});

// GET /api/v1/logistics/analytics
logisticsRouter.get('/analytics', async (_req: Request, res: Response) => {
  try {
    const fleet = await logisticsExpertService.getFleetStatus();
    res.json({ success: true, data: fleet.analytics });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch analytics' } });
  }
});
