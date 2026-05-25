/**
 * REZ Context Engine - Main Entry Point
 *
 * Unified context service combining:
 * - Weather context (outdoor/indoor multipliers)
 * - Holiday context (India-specific calendar)
 * - Traffic context (delivery/ride timing)
 * - Time slot context (breakfast/lunch/dinner)
 *
 * Port: 4141
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

import logger from './utils/logger.js';
import { weatherService } from './services/weatherService.js';
import { holidayService } from './services/holidayService.js';
import { trafficService } from './services/trafficService.js';
import { contextService } from './services/contextService.js';

const PORT = parseInt(process.env.PORT || '4141', 10);
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'dev-token';

// Create Express app
const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, _res, next) => {
  logger.debug(`${req.method} ${req.path}`, { query: req.query });
  next();
});

// Health check (no auth)
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'rez-context-engine',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Readiness check
app.get('/ready', (_req, res) => {
  res.json({ status: 'ready' });
});

// API info
app.get('/', (_req, res) => {
  res.json({
    service: 'REZ Context Engine',
    version: '1.0.0',
    port: PORT,
    description: 'Unified context for weather, holidays, traffic',
    endpoints: {
      weather: '/api/weather/:city',
      holiday: '/api/holiday',
      traffic: '/api/traffic/:city',
      context: '/api/context/:city',
      category: '/api/context/:city/:category',
      event: '/api/event/:city',
      spillover: '/api/spillover/:city',
    },
  });
});

// ============================================
// WEATHER ROUTES
// ============================================

app.get('/api/weather/:city', async (req, res) => {
  try {
    const { city } = req.params;
    const { lat, lon } = req.query;

    const coordinates = lat && lon
      ? { lat: parseFloat(lat as string), lon: parseFloat(lon as string) }
      : undefined;

    const weather = await weatherService.getWeather(city, coordinates);

    if (!weather) {
      res.status(404).json({ error: 'Weather data unavailable' });
      return;
    }

    const multiplier = weatherService.getMultipliers(weather);

    res.json({ weather, multiplier });
  } catch (error) {
    logger.error('Weather API error', { error });
    res.status(500).json({ error: 'Failed to get weather' });
  }
});

// ============================================
// HOLIDAY ROUTES
// ============================================

app.get('/api/holiday', (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date as string) : new Date();

    const context = holidayService.getContext(targetDate);

    res.json({
      date: targetDate.toISOString(),
      context
    });
  } catch (error) {
    logger.error('Holiday API error', { error });
    res.status(500).json({ error: 'Failed to get holiday context' });
  }
});

app.get('/api/holidays/upcoming', (req, res) => {
  try {
    const { days = '30' } = req.query;
    const daysNum = parseInt(days as string, 10);

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + daysNum);

    const holidays = holidayService.getUpcomingHolidays(startDate, endDate);

    res.json({ holidays, range: { start: startDate, end: endDate } });
  } catch (error) {
    logger.error('Holidays API error', { error });
    res.status(500).json({ error: 'Failed to get upcoming holidays' });
  }
});

app.get('/api/holiday/check', (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      res.status(400).json({ error: 'Date required' });
      return;
    }

    const targetDate = new Date(date as string);
    const holiday = holidayService.isHoliday(targetDate);
    const isDiwali = holidayService.isDiwaliPeriod(targetDate);
    const isSeason = holidayService.isHolidaySeason(targetDate);

    res.json({
      date: targetDate.toISOString(),
      isHoliday: !!holiday,
      holiday,
      isDiwaliPeriod: isDiwali,
      isHolidaySeason: isSeason
    });
  } catch (error) {
    logger.error('Holiday check error', { error });
    res.status(500).json({ error: 'Failed to check holiday' });
  }
});

// ============================================
// TRAFFIC ROUTES
// ============================================

app.get('/api/traffic/:city', async (req, res) => {
  try {
    const { city } = req.params;
    const { area } = req.query;

    const traffic = await trafficService.getTraffic(city, area as string | undefined);
    const multipliers = trafficService.getMultipliers(traffic);
    const timeSlot = trafficService.getTimeSlotMultiplier();

    res.json({ traffic, multipliers, timeSlot });
  } catch (error) {
    logger.error('Traffic API error', { error });
    res.status(500).json({ error: 'Failed to get traffic' });
  }
});

app.get('/api/traffic/:city/estimate', async (req, res) => {
  try {
    const { city } = req.params;
    const { baseTime = '30', area } = req.query;

    const baseMinutes = parseInt(baseTime as string, 10);
    const estimate = await trafficService.estimateDeliveryTime(
      city,
      baseMinutes,
      area as string | undefined
    );

    res.json(estimate);
  } catch (error) {
    logger.error('Traffic estimate error', { error });
    res.status(500).json({ error: 'Failed to estimate delivery time' });
  }
});

app.get('/api/timeslot', (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date as string) : undefined;

    const timeSlot = trafficService.getTimeSlotMultiplier(targetDate);

    res.json({ timeSlot, currentTime: new Date().toISOString() });
  } catch (error) {
    logger.error('Time slot error', { error });
    res.status(500).json({ error: 'Failed to get time slot' });
  }
});

// ============================================
// UNIFIED CONTEXT ROUTES
// ============================================

app.get('/api/context/:city', async (req, res) => {
  try {
    const { city } = req.params;
    const { lat, lon } = req.query;

    const coordinates = lat && lon
      ? { lat: parseFloat(lat as string), lon: parseFloat(lon as string) }
      : undefined;

    const context = await contextService.getContext(city, coordinates);

    res.json(context);
  } catch (error) {
    logger.error('Context API error', { error });
    res.status(500).json({ error: 'Failed to get context' });
  }
});

app.get('/api/context/:city/:category', async (req, res) => {
  try {
    const { city, category } = req.params;
    const { lat, lon } = req.query;

    const validCategories = ['outdoor', 'indoor', 'delivery', 'ride', 'restaurant', 'retail', 'entertainment', 'travel'];

    if (!validCategories.includes(category)) {
      res.status(400).json({
        error: 'Invalid category',
        validCategories
      });
      return;
    }

    const coordinates = lat && lon
      ? { lat: parseFloat(lat as string), lon: parseFloat(lon as string) }
      : undefined;

    const context = await contextService.getCategoryContext(
      city,
      category as keyof import('./services/contextService.js').CategoryMultipliers,
      coordinates
    );

    res.json(context);
  } catch (error) {
    logger.error('Category context error', { error });
    res.status(500).json({ error: 'Failed to get category context' });
  }
});

// ============================================
// EVENT CONTEXT ROUTES
// ============================================

app.get('/api/event/:city', async (req, res) => {
  try {
    const { city } = req.params;
    const { date, outdoor, lat, lon } = req.query;

    if (!date) {
      res.status(400).json({ error: 'Event date required' });
      return;
    }

    const eventDate = new Date(date as string);
    const isOutdoor = outdoor === 'true';
    const coordinates = lat && lon
      ? { lat: parseFloat(lat as string), lon: parseFloat(lon as string) }
      : undefined;

    const eventContext = await contextService.getEventContext(city, eventDate, isOutdoor, coordinates);

    res.json(eventContext);
  } catch (error) {
    logger.error('Event context error', { error });
    res.status(500).json({ error: 'Failed to get event context' });
  }
});

// ============================================
// SPILLOVER CONTEXT ROUTES
// ============================================

app.get('/api/spillover/:city', async (req, res) => {
  try {
    const { city } = req.params;
    const { date, category = 'restaurant' } = req.query;

    if (!date) {
      res.status(400).json({ error: 'Event date required' });
      return;
    }

    const eventDate = new Date(date as string);
    const validCategories = ['restaurant', 'retail', 'transport'];

    if (!validCategories.includes(category as string)) {
      res.status(400).json({
        error: 'Invalid category',
        validCategories
      });
      return;
    }

    const spillover = await contextService.getSpilloverContext(
      city,
      eventDate,
      category as 'restaurant' | 'retail' | 'transport'
    );

    res.json(spillover);
  } catch (error) {
    logger.error('Spillover context error', { error });
    res.status(500).json({ error: 'Failed to get spillover context' });
  }
});

// ============================================
// DEMAND MULTIPLIERS BATCH ROUTE
// ============================================

app.post('/api/batch/context', async (req, res) => {
  try {
    const { cities, categories } = req.body as {
      cities: Array<{ city: string; coordinates?: { lat: number; lon: number } }>;
      categories?: string[];
    };

    if (!cities || !Array.isArray(cities)) {
      res.status(400).json({ error: 'Cities array required' });
      return;
    }

    const results = await Promise.all(
      cities.map(async ({ city, coordinates }) => {
        if (categories && categories.length > 0) {
          const categoryResults = await Promise.all(
            categories.map(cat =>
              contextService.getCategoryContext(
                city,
                cat as keyof import('./services/contextService.js').CategoryMultipliers,
                coordinates
              )
            )
          );
          return { city, coordinates, categories: categoryResults };
        }

        const context = await contextService.getContext(city, coordinates);
        return { city, coordinates, context };
      })
    );

    res.json({ results });
  } catch (error) {
    logger.error('Batch context error', { error });
    res.status(500).json({ error: 'Failed to get batch context' });
  }
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err });
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
async function shutdown(): Promise<void> {
  logger.info('Shutting down...');

  try {
    await weatherService.disconnect();
    await trafficService.disconnect();
  } catch (error) {
    logger.error('Shutdown error', { error });
  }

  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
async function start(): Promise<void> {
  try {
    await weatherService.connect();
    await trafficService.connect();

    app.listen(PORT, () => {
      logger.info(`REZ Context Engine started on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`API base: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

start();

export { app };
