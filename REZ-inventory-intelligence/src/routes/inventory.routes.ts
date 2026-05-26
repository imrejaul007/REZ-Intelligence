import { Router, Request, Response } from 'express';
import {
  asyncHandler,
  validateParams,
  validateQuery,
  NotFoundError,
  ValidationError,
} from '../middleware/error.middleware.js';
import { demandForecastingService } from '../services/demandForecasting.js';
import { reorderOptimizerService } from '../services/reorderOptimizer.js';
import { stockOptimizerService } from '../services/stockOptimizer.js';
import {
  SKUParamsSchema,
  SupplierIdParamsSchema,
  ForecastQuerySchema,
  ReorderQuerySchema,
  OptimizeQuerySchema,
  ABCAnalysisQuerySchema,
  ForecastMethod,
} from '../types/inventory.types.js';
import { DemandData, ProductMaster } from '../models/schemas.js';
import { apiLogger as logger } from './utils/logger.js';
import { startOfDay, subDays, parseISO, format } from 'date-fns';

const router = Router();

/**
 * @route GET /api/v1/health
 * @description Health check endpoint
 */
router.get(
  '/health',
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        status: 'healthy',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      },
    });
  })
);

/**
 * @route GET /api/v1/forecast/:sku
 * @description Get demand forecast for a SKU
 */
router.get(
  '/forecast/:sku',
  validateParams(SKUParamsSchema),
  validateQuery(ForecastQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { sku } = req.params;
    const query = req.query as unknown as {
      horizon: number;
      method: ForecastMethod;
      confidenceLevel: number;
    };
    const { horizon, method, confidenceLevel } = query;

    logger.info(`Forecast request for SKU: ${sku}`, { horizon, method, confidenceLevel });

    try {
      const forecast = await demandForecastingService.forecastDemand(
        sku,
        horizon,
        method
      );

      res.json({
        success: true,
        data: forecast,
      });
    } catch (error) {
      if ((error as Error).message.includes('not found') || (error as Error).message.includes('Insufficient')) {
        throw new NotFoundError('Product or demand data', sku);
      }
      throw error;
    }
  })
);

/**
 * @route GET /api/v1/forecast/:sku/compare
 * @description Compare multiple forecasting methods for a SKU
 */
router.get(
  '/forecast/:sku/compare',
  validateParams(SKUParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { sku } = req.params;
    const horizon = parseInt(req.query.horizon as string) || 30;

    logger.info(`Forecast comparison request for SKU: ${sku}`);

    const comparison = await demandForecastingService.compareMethods(sku, horizon);

    res.json({
      success: true,
      data: comparison,
    });
  })
);

/**
 * @route GET /api/v1/forecast/:sku/ensemble
 * @description Get ensemble forecast combining multiple methods
 */
router.get(
  '/forecast/:sku/ensemble',
  validateParams(SKUParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { sku } = req.params;
    const horizon = parseInt(req.query.horizon as string) || 30;

    logger.info(`Ensemble forecast request for SKU: ${sku}`);

    const forecast = await demandForecastingService.ensembleForecast(sku, horizon);

    res.json({
      success: true,
      data: forecast,
    });
  })
);

/**
 * @route GET /api/v1/reorder/:sku
 * @description Get reorder suggestions for a SKU
 */
router.get(
  '/reorder/:sku',
  validateParams(SKUParamsSchema),
  validateQuery(ReorderQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { sku } = req.params;
    const query = req.query as unknown as {
      daysUntilStockout: number;
      considerSeasonality: boolean;
      serviceLevel: number;
    };
    const { daysUntilStockout, considerSeasonality, serviceLevel } = query;

    logger.info(`Reorder suggestion request for SKU: ${sku}`);

    try {
      const suggestion = await reorderOptimizerService.getReorderSuggestion(sku, {
        daysUntilStockout,
        considerSeasonality,
        serviceLevel,
      });

      res.json({
        success: true,
        data: suggestion,
      });
    } catch (error) {
      if ((error as Error).message.includes('not found')) {
        throw new NotFoundError('Product', sku);
      }
      throw error;
    }
  })
);

/**
 * @route GET /api/v1/reorder/:sku/safety-stock
 * @description Get safety stock calculation for a SKU
 */
router.get(
  '/reorder/:sku/safety-stock',
  validateParams(SKUParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { sku } = req.params;

    logger.info(`Safety stock calculation request for SKU: ${sku}`);

    try {
      const safetyStock = await reorderOptimizerService.calculateSafetyStock(sku);

      res.json({
        success: true,
        data: safetyStock,
      });
    } catch (error) {
      if ((error as Error).message.includes('not found')) {
        throw new NotFoundError('Product', sku);
      }
      throw error;
    }
  })
);

/**
 * @route GET /api/v1/reorder/:sku/reorder-point
 * @description Get reorder point calculation for a SKU
 */
router.get(
  '/reorder/:sku/reorder-point',
  validateParams(SKUParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { sku } = req.params;

    logger.info(`Reorder point calculation request for SKU: ${sku}`);

    try {
      const reorderPoint = await reorderOptimizerService.calculateReorderPoint(sku);

      res.json({
        success: true,
        data: reorderPoint,
      });
    } catch (error) {
      if ((error as Error).message.includes('not found')) {
        throw new NotFoundError('Product', sku);
      }
      throw error;
    }
  })
);

/**
 * @route GET /api/v1/reorder/alerts
 * @description Get all reorder alerts across products
 */
router.get(
  '/reorder/alerts',
  asyncHandler(async (req: Request, res: Response) => {
    const options = {
      urgency: req.query.urgency as 'critical' | 'high' | 'medium' | 'low' | undefined,
      category: req.query.category as string | undefined,
      storeId: req.query.storeId as string | undefined,
      limit: parseInt(req.query.limit as string) || 100,
    };

    logger.info('Reorder alerts request', options);

    const alerts = await reorderOptimizerService.getReorderAlerts(options);

    res.json({
      success: true,
      data: alerts,
      count: alerts.length,
    });
  })
);

/**
 * @route GET /api/v1/optimize/:sku
 * @description Get stock optimization recommendations for a SKU
 */
router.get(
  '/optimize/:sku',
  validateParams(SKUParamsSchema),
  validateQuery(OptimizeQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { sku } = req.params;
    const query = req.query as unknown as {
      targetTurnsPerYear: number;
      holdingCostPercent: number;
    };
    const { targetTurnsPerYear, holdingCostPercent } = query;

    logger.info(`Stock optimization request for SKU: ${sku}`);

    try {
      const optimization = await stockOptimizerService.optimizeStock(sku, {
        targetTurnsPerYear,
        holdingCostPercent,
      });

      res.json({
        success: true,
        data: optimization,
      });
    } catch (error) {
      if ((error as Error).message.includes('not found')) {
        throw new NotFoundError('Product', sku);
      }
      throw error;
    }
  })
);

/**
 * @route GET /api/v1/optimize/:sku/turn
 * @description Get inventory turn analysis for a SKU
 */
router.get(
  '/optimize/:sku/turn',
  validateParams(SKUParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { sku } = req.params;

    logger.info(`Inventory turn analysis request for SKU: ${sku}`);

    try {
      const analysis = await stockOptimizerService.analyzeInventoryTurn(sku);

      res.json({
        success: true,
        data: analysis,
      });
    } catch (error) {
      if ((error as Error).message.includes('not found')) {
        throw new NotFoundError('Product', sku);
      }
      throw error;
    }
  })
);

/**
 * @route GET /api/v1/abc-analysis
 * @description Perform ABC analysis on inventory
 */
router.get(
  '/abc-analysis',
  validateQuery(ABCAnalysisQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { category, storeId, limit } = req.query as {
      category?: string;
      storeId?: string;
      limit?: number;
    };

    logger.info('ABC analysis request', { category, storeId, limit });

    const analysis = await stockOptimizerService.performABCAnalysis({
      category,
      storeId,
      limit,
    });

    res.json({
      success: true,
      data: analysis,
    });
  })
);

/**
 * @route GET /api/v1/optimize/underperforming
 * @description Get underperforming SKUs
 */
router.get(
  '/optimize/underperforming',
  asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 50;

    logger.info('Underperforming SKUs request', { limit });

    const skus = await stockOptimizerService.getUnderperformingSKUs(limit);

    res.json({
      success: true,
      data: skus,
      count: skus.length,
    });
  })
);

/**
 * @route POST /api/v1/sync/orders
 * @description Sync order data for demand analysis
 */
router.post(
  '/sync/orders',
  asyncHandler(async (req: Request, res: Response) => {
    const { orders, syncType } = req.body as {
      orders: Array<{
        orderId: string;
        sku: string;
        quantity: number;
        orderDate: string;
        customerId?: string;
        storeId?: string;
        channel?: 'online' | 'offline' | 'wholesale';
      }>;
      syncType: 'incremental' | 'full';
    };

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      throw new ValidationError('Orders array is required and must not be empty');
    }

    logger.info(`Order sync request: ${orders.length} orders, type: ${syncType}`);

    const result = await syncOrderData(orders, syncType);

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * @route GET /api/v1/supplier/:supplierId/lead-times
 * @description Get lead time data for a supplier
 */
router.get(
  '/supplier/:supplierId/lead-times',
  validateParams(SupplierIdParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { supplierId } = req.params;

    logger.info(`Lead times request for supplier: ${supplierId}`);

    const leadTimes = await reorderOptimizerService.getSupplierLeadTimes(supplierId);

    if (leadTimes.length === 0) {
      throw new NotFoundError('Supplier lead time data', supplierId);
    }

    res.json({
      success: true,
      data: leadTimes,
      count: leadTimes.length,
    });
  })
);

/**
 * @route GET /api/v1/supplier/:supplierId/analysis
 * @description Get lead time analysis for a supplier
 */
router.get(
  '/supplier/:supplierId/analysis',
  validateParams(SupplierIdParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { supplierId } = req.params;

    logger.info(`Supplier analysis request for: ${supplierId}`);

    try {
      const analysis = await reorderOptimizerService.analyzeSupplierLeadTimes(supplierId);

      res.json({
        success: true,
        data: analysis,
      });
    } catch (error) {
      if ((error as Error).message.includes('No lead time data')) {
        throw new NotFoundError('Supplier lead time data', supplierId);
      }
      throw error;
    }
  })
);

/**
 * @route GET /api/v1/products
 * @description List products with optional filtering
 */
router.get(
  '/products',
  asyncHandler(async (req: Request, res: Response) => {
    const options = {
      category: req.query.category as string | undefined,
      storeId: req.query.storeId as string | undefined,
      status: req.query.status as string | undefined,
      limit: Math.min(parseInt(req.query.limit as string) || 100, 1000),
      skip: parseInt(req.query.skip as string) || 0,
    };

    logger.info('Products list request', options);

    const query: Record<string, unknown> = { isActive: true };
    if (options.category) query.category = options.category;
    if (options.storeId) query.storeId = options.storeId;
    if (options.status) query.status = options.status;

    const [products, total] = await Promise.all([
      ProductMaster.find(query)
        .sort({ sku: 1 })
        .skip(options.skip)
        .limit(options.limit)
        .lean(),
      ProductMaster.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: products,
      pagination: {
        total,
        limit: options.limit,
        skip: options.skip,
        hasMore: options.skip + products.length < total,
      },
    });
  })
);

/**
 * @route POST /api/v1/products
 * @description Create a new product
 */
router.post(
  '/products',
  asyncHandler(async (req: Request, res: Response) => {
    const productData = req.body;

    logger.info('Create product request', { sku: productData.sku });

    // Check if product already exists
    const existing = await ProductMaster.findOne({ sku: productData.sku });
    if (existing) {
      throw new ValidationError(`Product with SKU '${productData.sku}' already exists`);
    }

    const product = new ProductMaster(productData);
    await product.save();

    res.status(201).json({
      success: true,
      data: product,
    });
  })
);

/**
 * @route GET /api/v1/demand/:sku
 * @description Get demand data for a SKU
 */
router.get(
  '/demand/:sku',
  validateParams(SKUParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { sku } = req.params;
    const days = Math.min(parseInt(req.query.days as string) || 90, 365);

    logger.info(`Demand data request for SKU: ${sku}`, { days });

    const startDate = subDays(new Date(), days);

    const demandData = await DemandData.find({
      sku,
      date: { $gte: startDate },
    })
      .sort({ date: 1 })
      .lean();

    res.json({
      success: true,
      data: demandData,
      count: demandData.length,
    });
  })
);

/**
 * Helper function to sync order data
 */
async function syncOrderData(
  orders: Array<{
    orderId: string;
    sku: string;
    quantity: number;
    orderDate: string;
    customerId?: string;
    storeId?: string;
    channel?: 'online' | 'offline' | 'wholesale';
  }>,
  syncType: 'incremental' | 'full'
): Promise<{
  syncedOrders: number;
  skippedOrders: number;
  errors: Array<{ orderId: string; error: string }>;
  lastSyncDate: Date;
}> {
  let syncedOrders = 0;
  let skippedOrders = 0;
  const errors: Array<{ orderId: string; error: string }> = [];

  // If full sync, clear existing data for these SKUs
  if (syncType === 'full') {
    const skus = [...new Set(orders.map((o) => o.sku))];
    await DemandData.deleteMany({ sku: { $in: skus } });
  }

  // Group orders by SKU and date
  const groupedOrders = new Map<string, Map<string, typeof orders>>();

  for (const order of orders) {
    const dateKey = format(parseISO(order.orderDate), 'yyyy-MM-dd');

    if (!groupedOrders.has(order.sku)) {
      groupedOrders.set(order.sku, new Map());
    }

    const skuGroup = groupedOrders.get(order.sku)!;
    if (!skuGroup.has(dateKey)) {
      skuGroup.set(dateKey, []);
    }
    skuGroup.get(dateKey)!.push(order);
  }

  // Process each SKU's aggregated demand
  for (const [sku, dateGroups] of groupedOrders) {
    for (const [dateStr, dayOrders] of dateGroups) {
      try {
        const orderDate = parseISO(dateStr);
        const totalQuantity = dayOrders.reduce((acc, o) => acc + o.quantity, 0);
        const uniqueCustomers = new Set(dayOrders.map((o) => o.customerId).filter(Boolean)).size;

        const channels = {
          online: dayOrders.filter((o) => o.channel === 'online').length,
          offline: dayOrders.filter((o) => o.channel === 'offline').length,
          wholesale: dayOrders.filter((o) => o.channel === 'wholesale').length,
        };

        // Upsert demand data
        await DemandData.findOneAndUpdate(
          { sku, date: startOfDay(orderDate) },
          {
            $set: {
              totalQuantity,
              uniqueCustomers,
              channels,
              orderCount: dayOrders.length,
            },
            $setOnInsert: {
              sku,
              date: startOfDay(orderDate),
              totalRevenue: 0,
            },
          },
          { upsert: true, new: true }
        );

        syncedOrders++;
      } catch (error) {
        errors.push({
          orderId: dayOrders[0].orderId,
          error: (error as Error).message,
        });
        skippedOrders++;
      }
    }
  }

  logger.info('Order sync completed', { syncedOrders, skippedOrders, errors: errors.length });

  return {
    syncedOrders,
    skippedOrders,
    errors,
    lastSyncDate: new Date(),
  };
}

export default router;
