/**
 * Dynamic Pricing Engine - Main Express Server
 * ReZ Price Optimization Service
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

import { PricingEngine } from './services/pricingEngine.js';
import { DemandForecaster } from './services/demandForecaster.js';
import { InventoryAnalyzer } from './services/inventoryAnalyzer.js';
import { MerchantSuggestions } from './services/merchantSuggestions.js';

import {
  PriceCalculationInput,
  BulkPricingRequest,
  BulkPricingResponse,
  PriceOptimizationResult,
  HealthCheck,
  ApiError,
  BaseProduct,
  TimeContext,
  CompetitionContext,
  HistoricalPriceData,
} from './types/index.js';

// Initialize services
const pricingEngine = new PricingEngine();
const demandForecaster = new DemandForecaster();
const inventoryAnalyzer = new InventoryAnalyzer();
const merchantSuggestions = new MerchantSuggestions();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Error handling wrapper
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// Error middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(`[ERROR] ${err.message}`, err.stack);
  const error: ApiError = {
    code: 'INTERNAL_ERROR',
    message: err.message || 'An unexpected error occurred',
    timestamp: new Date(),
  };
  res.status(500).json({ success: false, error });
});

// ============================================
// HEALTH & STATUS ROUTES
// ============================================

/**
 * Health check endpoint
 */
app.get('/health', (_req: Request, res: Response) => {
  const health: HealthCheck = {
    status: 'healthy',
    services: {
      pricingEngine: true,
      demandForecaster: true,
      inventoryAnalyzer: true,
    },
    timestamp: new Date(),
    uptime: process.uptime(),
  };
  res.json({ success: true, data: health });
});

/**
 * Service info
 */
app.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'ReZ Dynamic Pricing Engine',
    version: '1.0.0',
    endpoints: [
      'POST /api/v1/calculate-price',
      'POST /api/v1/calculate-price/batch',
      'GET /api/v1/forecast-demand/:productId',
      'GET /api/v1/inventory/:productId',
      'GET /api/v1/recommendations/:productId',
      'GET /api/v1/dashboard/metrics',
      'GET /api/v1/events/upcoming',
      'POST /api/v1/demand/signal',
      'POST /api/v1/inventory/update',
    ],
  });
});

// ============================================
// PRICING CALCULATION ROUTES
// ============================================

/**
 * Calculate dynamic price for a single product
 */
app.post(
  '/api/v1/calculate-price',
  asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as PriceCalculationInput;

    // Validate required fields
    if (!input.product || !input.time || !input.inventory || !input.demand || !input.competition) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields: product, time, inventory, demand, competition',
          timestamp: new Date(),
        },
      });
      return;
    }

    const startTime = Date.now();

    // Calculate price
    const pricing = pricingEngine.calculatePrice(input);

    // Generate recommendations
    const recommendations = await merchantSuggestions.generateRecommendations(
      input.product,
      pricing,
      input.inventory,
      input.demand,
      input.competition
    );

    const result: PriceOptimizationResult = {
      productId: input.product.id,
      sku: input.product.sku,
      pricing,
      recommendations,
      metadata: {
        calculationTime: Date.now() - startTime,
        dataQuality: pricing.confidence >= 0.8 ? 'high' : pricing.confidence >= 0.5 ? 'medium' : 'low',
        factorsConsidered: pricing.factors.map(f => f.name),
      },
    };

    res.json({ success: true, data: result });
  })
);

/**
 * Calculate prices for multiple products (batch)
 */
app.post(
  '/api/v1/calculate-price/batch',
  asyncHandler(async (req: Request, res: Response) => {
    const batchRequest = req.body as BulkPricingRequest;

    if (!batchRequest.products || !Array.isArray(batchRequest.products)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request must include products array',
          timestamp: new Date(),
        },
      });
      return;
    }

    if (batchRequest.products.length > 100) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BATCH_TOO_LARGE',
          message: 'Maximum 100 products per batch',
          timestamp: new Date(),
        },
      });
      return;
    }

    const startTime = Date.now();
    const results: PriceOptimizationResult[] = [];

    for (const input of batchRequest.products) {
      try {
        const pricing = pricingEngine.calculatePrice(input);
        const recommendations = await merchantSuggestions.generateRecommendations(
          input.product,
          pricing,
          input.inventory,
          input.demand,
          input.competition
        );

        results.push({
          productId: input.product.id,
          sku: input.product.sku,
          pricing,
          recommendations,
          metadata: {
            calculationTime: 0,
            dataQuality: pricing.confidence >= 0.8 ? 'high' : pricing.confidence >= 0.5 ? 'medium' : 'low',
            factorsConsidered: pricing.factors.map(f => f.name),
          },
        });
      } catch (error) {
        console.error(`Error calculating price for product ${input.product?.id}:`, error);
        // Continue with other products
      }
    }

    const calculationTime = Date.now() - startTime;

    // Calculate summary statistics
    const adjustments = results.map(r => r.pricing.totalAdjustment);
    const summary = {
      totalProducts: results.length,
      averageAdjustment: adjustments.reduce((a, b) => a + b, 0) / (results.length || 1),
      highestIncrease: Math.max(...adjustments, 0),
      highestDecrease: Math.min(...adjustments, 0),
      calculationTimeMs: calculationTime,
    };

    const response: BulkPricingResponse = {
      batchId: batchRequest.batchId || `batch-${Date.now()}`,
      results,
      summary,
    };

    res.json({ success: true, data: response });
  })
);

// ============================================
// DEMAND FORECASTING ROUTES
// ============================================

/**
 * Get demand forecast for a product
 */
app.get(
  '/api/v1/forecast-demand/:productId',
  asyncHandler(async (req: Request, res: Response) => {
    const { productId } = req.params;

    // Build time context from query params or defaults
    const time: TimeContext = {
      dayOfWeek: parseInt(req.query.dayOfWeek as string) || new Date().getDay(),
      hourOfDay: parseInt(req.query.hourOfDay as string) || new Date().getHours(),
      isPeakHour: (parseInt(req.query.hourOfDay as string) || new Date().getHours()) >= 17 &&
                  (parseInt(req.query.hourOfDay as string) || new Date().getHours()) <= 20,
      season: (req.query.season as TimeContext['season']) || getCurrentSeason(),
      isHoliday: req.query.isHoliday === 'true',
      isEventDay: req.query.isEventDay === 'true',
    };

    const demand = await demandForecaster.getDemandContext(productId, time);

    res.json({ success: true, data: { productId, ...demand } });
  })
);

/**
 * Add real-time demand signal
 */
app.post(
  '/api/v1/demand/signal',
  asyncHandler(async (req: Request, res: Response) => {
    const { productId, type, count, weight } = req.body;

    if (!productId || !type) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'productId and type are required',
          timestamp: new Date(),
        },
      });
      return;
    }

    demandForecaster.addRealtimeSignal(productId, {
      type,
      count: count || 1,
      weight: weight || 1,
      timestamp: new Date(),
    });

    res.json({ success: true, message: 'Demand signal recorded' });
  })
);

/**
 * Add historical demand data
 */
app.post(
  '/api/v1/demand/history',
  asyncHandler(async (req: Request, res: Response) => {
    const data = req.body as HistoricalPriceData;

    if (!data.productId || !data.date) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'productId and date are required',
          timestamp: new Date(),
        },
      });
      return;
    }

    demandForecaster.addHistoricalData({
      ...data,
      date: new Date(data.date),
    });

    res.json({ success: true, message: 'Historical data recorded' });
  })
);

// ============================================
// INVENTORY ROUTES
// ============================================

/**
 * Get inventory analysis for a product
 */
app.get(
  '/api/v1/inventory/:productId',
  asyncHandler(async (req: Request, res: Response) => {
    const { productId } = req.params;

    // Get product info from body or query
    const product: BaseProduct = req.body.product || {
      id: productId,
      name: req.query.name as string || 'Unknown Product',
      sku: req.query.sku as string || productId,
      category: req.query.category as string || 'general',
      basePrice: parseFloat(req.query.basePrice as string) || 0,
      cost: parseFloat(req.query.cost as string) || 0,
      margin: parseFloat(req.query.margin as string) || 0,
    };

    const analysis = await inventoryAnalyzer.analyzeInventory(product);

    res.json({ success: true, data: { productId, ...analysis } });
  })
);

/**
 * Update inventory data
 */
app.post(
  '/api/v1/inventory/update',
  asyncHandler(async (req: Request, res: Response) => {
    const { productId, ...data } = req.body;

    if (!productId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'productId is required',
          timestamp: new Date(),
        },
      });
      return;
    }

    inventoryAnalyzer.updateInventory(productId, {
      ...data,
      lastRestockedDate: data.lastRestockedDate
        ? new Date(data.lastRestockedDate)
        : new Date(),
    });

    res.json({ success: true, message: 'Inventory updated' });
  })
);

/**
 * Get inventory metrics for dashboard
 */
app.get(
  '/api/v1/inventory/metrics',
  asyncHandler(async (_req: Request, res: Response) => {
    const metrics = await inventoryAnalyzer.getMetrics();
    res.json({ success: true, data: metrics });
  })
);

// ============================================
// RECOMMENDATIONS ROUTES
// ============================================

/**
 * Get recommendations for a product
 */
app.get(
  '/api/v1/recommendations/:productId',
  asyncHandler(async (req: Request, res: Response) => {
    const { productId } = req.params;

    // Reconstruct contexts from query params or use defaults
    const product: BaseProduct = {
      id: productId,
      name: req.query.name as string || 'Unknown Product',
      sku: req.query.sku as string || productId,
      category: req.query.category as string || 'general',
      basePrice: parseFloat(req.query.basePrice as string) || 10,
      cost: parseFloat(req.query.cost as string) || 5,
      margin: parseFloat(req.query.margin as string) || 50,
    };

    const inventory = await inventoryAnalyzer.getInventoryContext(product);

    const time: TimeContext = {
      dayOfWeek: new Date().getDay(),
      hourOfDay: new Date().getHours(),
      isPeakHour: new Date().getHours() >= 17 && new Date().getHours() <= 20,
      season: getCurrentSeason(),
      isHoliday: false,
      isEventDay: false,
    };

    const demand = await demandForecaster.getDemandContext(productId, time);

    const competition: CompetitionContext = {
      competitorPrices: [],
      marketPosition: 'mid-market',
      averageCompetitorPrice: product.basePrice,
      priceDifference: 0,
    };

    const pricing = pricingEngine.calculatePrice({
      product,
      time,
      inventory,
      demand,
      competition,
    });

    const recommendations = await merchantSuggestions.generateRecommendations(
      product,
      pricing,
      inventory,
      demand,
      competition
    );

    res.json({
      success: true,
      data: {
        productId,
        product,
        pricing,
        recommendations,
        generatedAt: new Date(),
      },
    });
  })
);

/**
 * Get recommendation history
 */
app.get(
  '/api/v1/recommendations/:productId/history',
  asyncHandler(async (req: Request, res: Response) => {
    const { productId } = req.params;
    const history = merchantSuggestions.getRecommendationHistory(productId);

    res.json({
      success: true,
      data: {
        productId,
        history: history.get(productId) || [],
      },
    });
  })
);

// ============================================
// DASHBOARD & EVENTS ROUTES
// ============================================

/**
 * Get dashboard metrics
 */
app.get(
  '/api/v1/dashboard/metrics',
  asyncHandler(async (_req: Request, res: Response) => {
    const inventoryMetrics = await inventoryAnalyzer.getMetrics();

    res.json({
      success: true,
      data: {
        totalProducts: inventoryMetrics.totalProducts,
        activeOptimizations: Math.floor(inventoryMetrics.totalProducts * 0.8),
        averagePriceAdjustment: 0.05,
        revenueImpact: inventoryMetrics.totalStockValue * 0.08,
        marginImpact: 0.02,
        inventoryMetrics,
        systemHealth: {
          status: 'healthy',
          uptime: process.uptime(),
          lastCalculation: new Date(),
        },
      },
    });
  })
);

/**
 * Get upcoming promotional events
 */
app.get(
  '/api/v1/events/upcoming',
  asyncHandler(async (req: Request, res: Response) => {
    const days = parseInt(req.query.days as string) || 30;
    const events = merchantSuggestions.getUpcomingEvents(days);

    res.json({
      success: true,
      data: {
        events,
        count: events.length,
      },
    });
  })
);

// ============================================
// CONFIGURATION ROUTES
// ============================================

/**
 * Get pricing engine configuration
 */
app.get(
  '/api/v1/config/pricing',
  asyncHandler(async (_req: Request, res: Response) => {
    const config = pricingEngine.getConfig();
    res.json({ success: true, data: config });
  })
);

/**
 * Update pricing engine configuration
 */
app.post(
  '/api/v1/config/pricing',
  asyncHandler(async (req: Request, res: Response) => {
    const newConfig = req.body;

    pricingEngine.updateConfig(newConfig);

    res.json({
      success: true,
      message: 'Configuration updated',
      data: pricingEngine.getConfig(),
    });
  })
);

// ============================================
// HELPER METHODS
// ============================================

function getCurrentSeason(): 'spring' | 'summer' | 'autumn' | 'winter' {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

// ============================================
// SERVER STARTUP
// ============================================

const server = app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     ReZ Dynamic Pricing Engine - Started Successfully          ║
║                                                               ║
║     Service: Price Optimization Service                        ║
║     Version: 1.0.0                                             ║
║     Port: ${PORT}                                                ║
║                                                               ║
║     Endpoints:                                                 ║
║     - POST /api/v1/calculate-price      Calculate price       ║
║     - POST /api/v1/calculate-price/batch Batch calculate        ║
║     - GET  /api/v1/forecast-demand/:id   Demand forecast       ║
║     - GET  /api/v1/inventory/:id          Inventory analysis    ║
║     - GET  /api/v1/recommendations/:id   AI recommendations    ║
║     - GET  /api/v1/dashboard/metrics     Dashboard metrics      ║
║     - GET  /health                        Health check          ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

export default app;
