/**
 * REZ DOOH Attribution - Entry Point
 * Track DOOH impressions to conversions
 */

import express import logger from './utils/logger';
import from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';
import {
  DOOHTouchpoint,
  ConversionEvent,
  AttributionModel,
  DOOHMetrics,
  ATTRIBUTION_WINDOWS,
} from './types';
import { attributeConversion, calculateDOOHMetrics } from './services/attributionService';

const app = express();
const PORT = parseInt(process.env.PORT || '4081', 10);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// In-memory storage (would be MongoDB in production)
const touchpoints: Map<string, DOOHTouchpoint> = new Map();
const conversions: Map<string, ConversionEvent> = new Map();

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'rez-dooh-attribution',
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// TOUCHPOINT ENDPOINTS
// ============================================================================

/**
 * POST /api/touchpoints
 * Record a DOOH touchpoint (impression, view, click)
 */
app.post('/api/touchpoints', (req, res) => {
  try {
    const touchpoint: DOOHTouchpoint = {
      ...req.body,
      touchpointId: req.body.touchpointId || uuidv4(),
      timestamp: new Date(req.body.timestamp) || new Date(),
    };

    touchpoints.set(touchpoint.touchpointId, touchpoint);

    res.status(201).json({
      success: true,
      data: { touchpointId: touchpoint.touchpointId },
    });
  } catch (error) {
    res.status(400).json({ success: false, error: 'Invalid touchpoint data' });
  }
});

/**
 * GET /api/touchpoints/:id
 * Get a specific touchpoint
 */
app.get('/api/touchpoints/:id', (req, res) => {
  const touchpoint = touchpoints.get(req.params.id);
  if (!touchpoint) {
    res.status(404).json({ success: false, error: 'Touchpoint not found' });
    return;
  }
  res.json({ success: true, data: touchpoint });
});

/**
 * GET /api/touchpoints/user/:userId
 * Get touchpoints for a user
 */
app.get('/api/touchpoints/user/:userId', (req, res) => {
  const userTouchpoints = Array.from(touchpoints.values()).filter(
    (tp) => tp.userId === req.params.userId
  );
  res.json({ success: true, data: userTouchpoints });
});

/**
 * GET /api/touchpoints/screen/:screenId
 * Get touchpoints for a screen
 */
app.get('/api/touchpoints/screen/:screenId', (req, res) => {
  const screenTouchpoints = Array.from(touchpoints.values()).filter(
    (tp) => tp.screenId === req.params.screenId
  );
  res.json({ success: true, data: screenTouchpoints });
});

// ============================================================================
// CONVERSION ENDPOINTS
// ============================================================================

/**
 * POST /api/conversions
 * Record a conversion event
 */
app.post('/api/conversions', (req, res) => {
  try {
    const conversion: ConversionEvent = {
      ...req.body,
      eventId: req.body.eventId || uuidv4(),
      timestamp: new Date(req.body.timestamp) || new Date(),
    };

    conversions.set(conversion.eventId, conversion);

    // Get user touchpoints for attribution
    const userTouchpoints = Array.from(touchpoints.values()).filter(
      (tp) =>
        tp.userId === conversion.userId || tp.deviceId === conversion.deviceId
    );

    // Run attribution
    const attribution = attributeConversion(conversion, userTouchpoints);

    res.status(201).json({
      success: true,
      data: {
        conversionId: conversion.eventId,
        attribution,
      },
    });
  } catch (error) {
    res.status(400).json({ success: false, error: 'Invalid conversion data' });
  }
});

/**
 * GET /api/conversions/:id
 * Get attribution for a conversion
 */
app.get('/api/conversions/:id', (req, res) => {
  const conversion = conversions.get(req.params.id);
  if (!conversion) {
    res.status(404).json({ success: false, error: 'Conversion not found' });
    return;
  }

  const userTouchpoints = Array.from(touchpoints.values()).filter(
    (tp) =>
      tp.userId === conversion.userId || tp.deviceId === conversion.deviceId
  );

  const attribution = attributeConversion(conversion, userTouchpoints);

  res.json({ success: true, data: attribution });
});

// ============================================================================
// ATTRIBUTION ENDPOINTS
// ============================================================================

/**
 * POST /api/attribute
 * Attribute a conversion with specific models
 */
app.post('/api/attribute', (req, res) => {
  try {
    const { conversion, touchpoints: tpList, models } = req.body;

    const conversionEvent: ConversionEvent = {
      ...conversion,
      timestamp: new Date(conversion.timestamp),
    };

    const touchpointList: DOOHTouchpoint[] = tpList.map((tp) => ({
      ...tp,
      timestamp: new Date(tp.timestamp),
    }));

    const result = attributeConversion(
      conversionEvent,
      touchpointList,
      models || ['last_touch', 'data_driven']
    );

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: 'Attribution failed' });
  }
});

/**
 * GET /api/attribution/models
 * List available attribution models
 */
app.get('/api/attribution/models', (_req, res) => {
  res.json({
    success: true,
    data: {
      models: [
        {
          id: 'first_touch',
          name: 'First Touch',
          description: 'All credit to first touchpoint',
        },
        {
          id: 'last_touch',
          name: 'Last Touch',
          description: 'All credit to last touchpoint',
        },
        {
          id: 'linear',
          name: 'Linear',
          description: 'Equal credit to all touchpoints',
        },
        {
          id: 'time_decay',
          name: 'Time Decay',
          description: 'More credit to recent touchpoints',
        },
        {
          id: 'position_based',
          name: 'Position Based',
          description: '40% first, 40% last, 20% middle',
        },
        {
          id: 'data_driven',
          name: 'Data Driven',
          description: 'ML-based attribution using engagement signals',
        },
      ],
      defaultModel: 'last_touch',
    },
  });
});

/**
 * GET /api/attribution/windows
 * Get attribution window settings
 */
app.get('/api/attribution/windows', (_req, res) => {
  res.json({
    success: true,
    data: ATTRIBUTION_WINDOWS,
  });
});

// ============================================================================
// METRICS ENDPOINTS
// ============================================================================

/**
 * GET /api/metrics/screen/:screenId
 * Get DOOH metrics for a screen
 */
app.get('/api/metrics/screen/:screenId', (req, res) => {
  const screenTouchpoints = Array.from(touchpoints.values()).filter(
    (tp) => tp.screenId === req.params.screenId
  );

  const screenType = screenTouchpoints[0]?.screenType || 'unknown';

  // Calculate metrics
  const metrics = calculateDOOHMetrics(
    req.params.screenId,
    screenType,
    { start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), end: new Date() },
    screenTouchpoints.length, // impressions
    screenTouchpoints.filter((t) => t.event === 'view_through').length, // engagements
    Math.floor(screenTouchpoints.length * 0.1), // app visits (mock)
    Math.floor(screenTouchpoints.length * 0.05), // searches (mock)
    Math.floor(screenTouchpoints.length * 0.02), // add to cart (mock)
    Math.floor(screenTouchpoints.length * 0.01), // conversions (mock)
    screenTouchpoints.length * 0.5, // revenue (mock)
    screenTouchpoints.length * 0.02 // spend (mock)
  );

  res.json({ success: true, data: metrics });
});

/**
 * POST /api/metrics/aggregate
 * Get aggregated metrics
 */
app.post('/api/metrics/aggregate', (req, res) => {
  const { screenIds, period, groupBy } = req.body;

  // Mock aggregated metrics
  const metrics = {
    totalImpressions: 1000000,
    totalEngagements: 150000,
    totalConversions: 5000,
    totalRevenue: 250000,
    averageViewability: 0.68,
    averageROAS: 2.5,
    byScreenType: [
      { screenType: 'hotel_tv', impressions: 300000, roas: 3.2 },
      { screenType: 'cab_screen', impressions: 250000, roas: 2.8 },
      { screenType: 'mall_kiosk', impressions: 200000, roas: 2.5 },
      { screenType: 'billboard_led', impressions: 250000, roas: 1.8 },
    ],
  };

  res.json({ success: true, data: metrics });
});

// ============================================================================
// FOOTFALL ENDPOINTS
// ============================================================================

/**
 * POST /api/footfall/attribute
 * Attribute footfall to DOOH
 */
app.post('/api/footfall/attribute', (req, res) => {
  const { screenId, campaignId, date, totalFootfall, byDistance, byTimeWindow } = req.body;

  // Mock attribution
  const attribution = {
    screenId,
    campaignId,
    date: new Date(date),
    totalFootfall,
    attributedFootfall: Math.floor(totalFootfall * 0.15), // 15% attribution
    attributionRate: 0.15,
    byDistance: byDistance || [
      { distanceMeters: 100, footfall: 500, attributionRate: 0.25 },
      { distanceMeters: 250, footfall: 800, attributionRate: 0.18 },
      { distanceMeters: 500, footfall: 1200, attributionRate: 0.10 },
    ],
    byTimeWindow: byTimeWindow || [
      { windowMinutes: 30, footfall: 400, attributionRate: 0.22 },
      { windowMinutes: 60, footfall: 800, attributionRate: 0.15 },
      { windowMinutes: 120, footfall: 1500, attributionRate: 0.08 },
    ],
  };

  res.json({ success: true, data: attribution });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, () => {
  logger.info(`[${new Date().toISOString()}] DOOH Attribution running on port ${PORT}`);
});

export default app;
