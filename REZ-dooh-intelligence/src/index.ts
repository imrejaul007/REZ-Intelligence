/**
 * REZ DOOH Intelligence - Entry Point
 * Connects DOOH screens to user intelligence for targeted advertising
 */

import express, { json, urlencoded, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { logger } from './utils/logger.js';
import { createAuthMiddleware, errorHandler, notFoundHandler } from './middleware/index.js';

import {
  DOOHPricingRequest,
  DOOHScreenType,
  SCREEN_CAPTIVITY_MAP,
  BASE_CPM_BY_SCREEN,
  DOOHTargetingRequest,
} from './types';
import {
  calculateDOOHPricing,
  calculateDurationPricing,
} from './services/pricingService';
import { findTargetedUsers } from './services/targetingService';

const app = express();
const PORT = parseInt(process.env.PORT || '4080', 10);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dooh-intelligence';

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// CORS configuration
app.use(cors({
  origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,https://rez.money').split(','),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-internal-token'],
}));

// Rate limiting
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
}));

// Body parsing with size limits
app.use(json({ limit: '1mb' }));
app.use(urlencoded({ extended: true, limit: '1mb' }));

// Auth middleware
const apiKeys = (process.env.API_KEYS || '').split(',').filter(Boolean);
const internalTokens = (process.env.INTERNAL_TOKENS || '').split(',').filter(Boolean);
app.use(createAuthMiddleware({
  apiKeys,
  internalTokens,
  bypassPaths: ['/health', '/ready'],
}));

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'rez-dooh-intelligence',
    timestamp: new Date().toISOString(),
  });
});

app.get('/ready', (_req, res) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({ status: 'ready', mongodb: mongoStatus, timestamp: new Date().toISOString() });
});

// ============================================================================
// PRICING ENDPOINTS
// ============================================================================

/**
 * GET /api/screens/types
 * List all available DOOH screen types with base pricing
 */
app.get('/api/screens/types', (_req, res) => {
  const screens = Object.entries(BASE_CPM_BY_SCREEN).map(([type, pricing]) => {
    const captivity = SCREEN_CAPTIVITY_MAP[type as DOOHScreenType];
    return {
      type,
      captivityLevel: captivity,
      baseCPM: pricing.base,
      maxCPM: pricing.max,
      pricing: {
        cpm: pricing.base,
        cpc: Math.round((pricing.base / 1000) * 0.02 * 100) / 100,
        cpa: Math.round((pricing.base / 1000) * 0.01 * 100) / 100,
      },
    };
  });

  const grouped = screens.reduce((acc, screen) => {
    if (!acc[screen.captivityLevel]) {
      acc[screen.captivityLevel] = [];
    }
    acc[screen.captivityLevel].push(screen);
    return acc;
  }, {} as Record<string, typeof screens>);

  res.json({
    success: true,
    data: { screens, grouped },
  });
});

/**
 * POST /api/pricing/calculate
 * Calculate dynamic pricing for a DOOH ad
 */
app.post('/api/pricing/calculate', (req: Request, res: Response) => {
  try {
    const request: DOOHPricingRequest = req.body;

    if (!request.screenType || !request.location || !request.scheduledTime) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: screenType, location, scheduledTime',
      });
      return;
    }

    const pricing = calculateDOOHPricing(request);

    res.json({
      success: true,
      data: pricing,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({
      success: false,
      error: message,
    });
  }
});

/**
 * POST /api/pricing/duration
 * Calculate pricing for a specific duration
 */
app.post('/api/pricing/duration', (req: Request, res: Response) => {
  try {
    const { request, durationMinutes } = req.body;

    if (!request || !durationMinutes) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: request, durationMinutes',
      });
      return;
    }

    const pricing = calculateDurationPricing(request, durationMinutes);

    res.json({
      success: true,
      data: pricing,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({
      success: false,
      error: message,
    });
  }
});

/**
 * GET /api/pricing/multipliers
 * Get current multiplier values
 */
app.get('/api/pricing/multipliers', (_req, res) => {
  res.json({
    success: true,
    data: {
      time: {
        peak_morning: '2.0x (7-9am)',
        peak_evening: '2.0x (6-9pm)',
        business_hours: '1.5x (9am-6pm)',
        weekend: '1.3x',
        off_peak: '0.5x',
        late_night: '0.4x',
      },
      city: {
        metro: '2.5x',
        tier1: '2.0x',
        tier2: '1.3x',
        tier3: '1.0x',
      },
      seasonal: {
        festival: '2.5x (Diwali, Christmas)',
        holiday: '1.8x',
        normal: '1.0x',
        january: '0.8x',
      },
      captivity: {
        personal: '2.0x',
        captive_private: '1.5x',
        semi_captive: '1.2x',
        public: '1.0x',
      },
    },
  });
});

// ============================================================================
// TARGETING ENDPOINTS
// ============================================================================

/**
 * POST /api/targeting/users
 * Find targeted users for a DOOH screen
 */
app.post('/api/targeting/users', async (req: Request, res: Response) => {
  try {
    const request: DOOHTargetingRequest = req.body;

    if (!request.screenType || !request.location) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: screenType, location',
      });
      return;
    }

    const users = await findTargetedUsers(request);

    res.json({
      success: true,
      data: { count: users.length, users },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({
      success: false,
      error: message,
    });
  }
});

/**
 * GET /api/targeting/screen-profile/:screenType
 * Get typical audience profile for a screen type
 */
app.get('/api/targeting/screen-profile/:screenType', (req: Request, res: Response) => {
  const { screenType } = req.params;

  const profile = {
    screenType,
    captivityLevel: SCREEN_CAPTIVITY_MAP[screenType as DOOHScreenType],
    basePricing: BASE_CPM_BY_SCREEN[screenType as DOOHScreenType],
    audience: {
      demographics: getAudienceDemographics(screenType as DOOHScreenType),
      interests: getAudienceInterests(screenType as DOOHScreenType),
      purchaseIntent: getPurchaseIntent(screenType as DOOHScreenType),
    },
    recommendations: {
      bestFor: getBestUseCases(screenType as DOOHScreenType),
      avoidFor: getAvoidUseCases(screenType as DOOHScreenType),
    },
  };

  res.json({ success: true, data: profile });
});

// ============================================================================
// AUDIENCE PROFILE HELPERS
// ============================================================================

function getAudienceDemographics(screenType: DOOHScreenType) {
  const profiles: Record<string, { age: string[]; income: string[] }> = {
    hotel_tv: { age: ['28-50'], income: ['medium', 'high'] },
    cab_screen: { age: ['22-45'], income: ['medium', 'high'] },
    flight_seat: { age: ['28-55'], income: ['medium', 'high'] },
    bus_seat: { age: ['18-50'], income: ['low', 'medium'] },
    mall_kiosk: { age: ['22-45'], income: ['medium', 'high'] },
    office_lobby: { age: ['25-45'], income: ['medium', 'high'] },
    university_display: { age: ['18-25'], income: ['low', 'medium'] },
    gym_screen: { age: ['22-45'], income: ['medium', 'high'] },
    billboard_led: { age: ['18-65'], income: ['low', 'medium', 'high'] },
    bus_shelter: { age: ['18-55'], income: ['low', 'medium'] },
  };
  return profiles[screenType] || { age: ['25-45'], income: ['medium'] };
}

function getAudienceInterests(screenType: DOOHScreenType) {
  const interests: Record<string, string[]> = {
    hotel_tv: ['travel', 'dining', 'entertainment', 'luxury'],
    cab_screen: ['food', 'entertainment', 'local services'],
    flight_seat: ['travel', 'business', 'duty free'],
    bus_seat: ['daily needs', 'budget shopping'],
    mall_kiosk: ['shopping', 'fashion', 'food'],
    office_lobby: ['food delivery', 'wellness', 'productivity'],
    university_display: ['food', 'tech', 'education', 'social'],
    gym_screen: ['fitness', 'nutrition', 'wellness'],
    billboard_led: ['brands', 'awareness'],
    bus_shelter: ['daily services', 'local'],
  };
  return interests[screenType] || ['general'];
}

function getPurchaseIntent(screenType: DOOHScreenType) {
  const intent: Record<string, 'high' | 'medium' | 'low'> = {
    hotel_tv: 'high',
    cab_screen: 'medium',
    flight_seat: 'medium',
    bus_seat: 'low',
    mall_kiosk: 'high',
    office_lobby: 'medium',
    university_display: 'low',
    gym_screen: 'medium',
    billboard_led: 'low',
    bus_shelter: 'low',
  };
  return intent[screenType] || 'medium';
}

function getBestUseCases(screenType: DOOHScreenType) {
  const cases: Record<string, string[]> = {
    hotel_tv: ['Restaurant promotions', 'Local attractions', 'Travel services'],
    cab_screen: ['Food delivery', 'Entertainment', 'Ride-sharing upgrades'],
    flight_seat: ['Duty-free shopping', 'Travel insurance', 'Hotel bookings'],
    bus_seat: ['Budget apps', 'Daily deals', 'Local services'],
    mall_kiosk: ['Fashion brands', 'Restaurant deals', 'Entertainment'],
    office_lobby: ['Productivity tools', 'Food delivery', 'Wellness'],
    university_display: ['Student discounts', 'Tech gadgets', 'Food deals'],
    gym_screen: ['Supplements', 'Fitness apps', 'Wellness'],
    billboard_led: ['Brand awareness', 'Major launches'],
    bus_shelter: ['Local businesses', 'Public transport'],
  };
  return cases[screenType] || ['General promotions'];
}

function getAvoidUseCases(screenType: DOOHScreenType) {
  const cases: Record<string, string[]> = {
    hotel_tv: ['Budget services', 'Complicated forms'],
    cab_screen: ['Long reading', 'Complex content'],
    flight_seat: ['Budget brands', 'Extended videos'],
    bus_seat: ['Premium services', 'Complex offers'],
    mall_kiosk: ['Local-only services', 'Complex UX'],
    office_lobby: ['Inappropriate content', 'Long videos'],
    university_display: ['Premium brands', 'Financial products'],
    gym_screen: ['Gyms competitors', 'Unhealthy food'],
    billboard_led: ['Detailed information', 'Small text'],
    bus_shelter: ['Premium products', 'Complex offers'],
  };
  return cases[screenType] || [];
}

// ============================================================================
// DEMO ENDPOINTS
// ============================================================================

/**
 * GET /api/demo/pricing
 * Get sample pricing for all screen types
 */
app.get('/api/demo/pricing', (_req, res) => {
  const demos = Object.entries(BASE_CPM_BY_SCREEN).map(([type, pricing]) => {
    const demoRequest: DOOHPricingRequest = {
      screenType: type as DOOHScreenType,
      location: { city: 'Mumbai', tier: 'metro' },
      scheduledTime: { start: new Date(), end: new Date() },
      campaignObjective: 'awareness',
    };

    const pricingResult = calculateDOOHPricing(demoRequest);

    return {
      screenType: type,
      base: pricing.base,
      metroPeak: pricingResult.finalCPM,
      metroNormal: calculateDOOHPricing({
        ...demoRequest,
        scheduledTime: { start: new Date('2026-05-15T14:00:00'), end: new Date() },
      }).finalCPM,
      tier2Peak: calculateDOOHPricing({
        ...demoRequest,
        location: { city: 'Pune', tier: 'tier1' },
      }).finalCPM,
    };
  });

  res.json({ success: true, data: demos });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
async function start(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    logger.info(`[${new Date().toISOString()}] Connected to MongoDB`);

    app.listen(PORT, () => {
      logger.info(`[${new Date().toISOString()}] DOOH Intelligence running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error instanceof Error ? error.message : 'Unknown' });
    process.exit(1);
  }
}

start();

export default app;
