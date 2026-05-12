import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  retailExpert,
  RetailContext,
  Shopper,
  ProductCategory,
  SortOption,
  Product
} from '../services/retailExpert';
import { logger } from '../services/retailExpert';
import { CATEGORIES } from '../config/knowledge';

const router = Router();

const validateRequest = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message
            }))
          }
        });
      }
      next(error);
    }
  };
};

const chatSchema = z.object({
  sessionId: z.string().optional(),
  message: z.string().min(1).max(5000),
  context: z.object({
    shopperId: z.string().optional(),
    shopper: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string().email(),
      preferences: z.array(z.string()).optional(),
      sizes: z.record(z.string()).optional(),
      tier: z.enum(['basic', 'premium', 'enterprise']).optional()
    }).nullable().optional(),
    category: z.string().optional(),
    wishlist: z.array(z.object({
      productId: z.string(),
      addedAt: z.string().datetime()
    })).optional(),
    budget: z.number().optional(),
    conversationHistory: z.array(z.string()).optional()
  }).optional()
});

const searchSchema = z.object({
  query: z.string().min(1),
  category: z.string().optional(),
  priceMin: z.number().optional(),
  priceMax: z.number().optional(),
  brands: z.array(z.string()).optional(),
  colors: z.array(z.string()).optional(),
  sizes: z.array(z.string()).optional(),
  rating: z.number().optional(),
  inStock: z.boolean().optional(),
  sort: z.enum(['relevance', 'price_low_to_high', 'price_high_to_low', 'rating', 'newest', 'best_selling']).optional()
});

const sizeGuideSchema = z.object({
  category: z.enum(['womens-tops', 'mens-tops', 'womens-bottoms', 'mens-bottoms', 'shoes-womens', 'shoes-mens']),
  measurements: z.record(z.string()).optional()
});

router.post('/chat', validateRequest(chatSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId: providedSessionId, message, context } = req.body;
    const sessionId = providedSessionId || uuidv4();

    logger.info('Retail chat request received', { sessionId, messageLength: message.length });

    const wishlistItems = context?.wishlist || [];
    const wishlist = await Promise.all(wishlistItems.map(async (item: { productId: string; addedAt: string }) => {
      const product = retailExpert.getProduct(item.productId);
      if (product) {
        return {
          id: uuidv4(),
          productId: product.id,
          product,
          addedAt: new Date(item.addedAt)
        };
      }
      return null;
    }));

    const retailContext: RetailContext = {
      shopper: context?.shopper || null,
      sessionId,
      conversationHistory: context?.conversationHistory || [],
      currentCategory: context?.category || null,
      currentSearch: null,
      wishlist: wishlist.filter(Boolean),
      budget: context?.budget || null
    };

    const response = await retailExpert.processRetailQuery(retailContext, message);

    res.json({
      success: true,
      data: {
        response: response.message,
        actions: response.actions,
        data: response.data
      },
      meta: {
        sessionId,
        processingTimeMs: response.processingTime,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Retail chat endpoint error', { error });
    next(error);
  }
});

router.get('/products', async (req: Request, res: Response) => {
  const query = req.query.query as string;
  const category = req.query.category as string;
  const sort = req.query.sort as string;

  if (!query) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Query parameter is required'
      }
    });
  }

  const filters: {
    category?: string;
    priceMin?: number;
    priceMax?: number;
    sort?: SortOption;
  } = {};

  if (category) filters.category = category;
  if (sort) filters.sort = sort as SortOption;

  const products = retailExpert.searchProducts(query, filters);

  res.json({
    success: true,
    data: {
      products,
      count: products.length
    }
  });
});

router.get('/products/:productId', async (req: Request, res: Response) => {
  const { productId } = req.params;

  const product = retailExpert.getProduct(productId);

  if (!product) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Product ${productId} not found`
      }
    });
  }

  res.json({
    success: true,
    data: { product }
  });
});

router.post('/products/search', validateRequest(searchSchema), async (req: Request, res: Response) => {
  const filters = req.body;

  const products = retailExpert.searchProducts(filters.query, filters);

  res.json({
    success: true,
    data: {
      products,
      count: products.length
    }
  });
});

router.get('/categories', async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      categories: CATEGORIES
    }
  });
});

router.get('/categories/:categoryId', async (req: Request, res: Response) => {
  const { categoryId } = req.params;

  const category = CATEGORIES.find(c => c.id === categoryId);

  if (!category) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Category ${categoryId} not found`
      }
    });
  }

  const products = retailExpert.searchProducts('', { category: categoryId });

  res.json({
    success: true,
    data: {
      category,
      products,
      count: products.length
    }
  });
});

router.get('/size-guides', async (req: Request, res: Response) => {
  const { SIZE_GUIDES } = await import('../config/knowledge');

  res.json({
    success: true,
    data: {
      sizeGuides: SIZE_GUIDES
    }
  });
});

router.post('/size-guides/recommend', validateRequest(sizeGuideSchema), async (req: Request, res: Response) => {
  const { category, measurements } = req.body;
  const { SIZE_GUIDES } = await import('../config/knowledge');

  const sizeGuide = SIZE_GUIDES.find(sg => sg.category === category);

  if (!sizeGuide) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Size guide for ${category} not found`
      }
    });
  }

  let recommendedSize: string | null = null;
  let confidence: number = 0;

  if (measurements) {
    for (const [size, sizeMeasurements] of Object.entries(sizeGuide.sizes)) {
      let matchScore = 0;
      let totalFields = 0;

      for (const [measurement, value] of Object.entries(measurements)) {
        if (measurement in sizeMeasurements) {
          totalFields++;
          const sizeValue = sizeMeasurements[measurement as keyof typeof sizeMeasurements];
          const userValue = value as string;
          const sizeNum = parseFloat(sizeValue.replace(/"/g, ''));
          const userNum = parseFloat(userValue.replace(/"/g, ''));

          if (Math.abs(sizeNum - userNum) <= 1) {
            matchScore++;
          }
        }
      }

      if (totalFields > 0 && matchScore / totalFields > confidence) {
        confidence = matchScore / totalFields;
        recommendedSize = size;
      }
    }
  }

  res.json({
    success: true,
    data: {
      sizeGuide,
      recommendedSize,
      confidence: confidence > 0 ? Math.round(confidence * 100) : null,
      measurements
    }
  });
});

router.post('/compare', async (req: Request, res: Response) => {
  const { productIds } = req.body;

  if (!productIds || !Array.isArray(productIds) || productIds.length < 2) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'At least 2 product IDs are required for comparison'
      }
    });
  }

  const products: Product[] = [];
  for (const id of productIds) {
    const product = retailExpert.getProduct(id);
    if (product) {
      products.push(product);
    }
  }

  if (products.length < 2) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Not enough valid products found for comparison'
      }
    });
  }

  const comparison = {
    products,
    criteria: {
      price: products.map(p => p.price),
      rating: products.map(p => p.rating),
      inStock: products.map(p => p.inStock),
      colors: products.map(p => p.colors?.length || 0),
      features: products.map(p => p.features?.length || 0)
    }
  };

  res.json({
    success: true,
    data: comparison
  });
});

router.get('/recommendations', async (req: Request, res: Response) => {
  const category = req.query.category as string;
  const limit = parseInt(req.query.limit as string) || 4;

  let products = retailExpert.searchProducts('', { category });

  products = products
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit);

  res.json({
    success: true,
    data: {
      products,
      count: products.length
    }
  });
});

router.get('/deals', async (req: Request, res: Response) => {
  const allProducts = retailExpert.searchProducts('');

  const deals = allProducts
    .filter(p => p.originalPrice && p.originalPrice > p.price)
    .map(p => ({
      ...p,
      discount: Math.round(((p.originalPrice! - p.price) / p.originalPrice!) * 100)
    }))
    .sort((a, b) => b.discount - a.discount);

  res.json({
    success: true,
    data: {
      products: deals,
      count: deals.length
    }
  });
});

router.get('/new-arrivals', async (req: Request, res: Response) => {
  const allProducts = retailExpert.searchProducts('');

  const newArrivals = allProducts
    .sort((a, b) => b.id.localeCompare(a.id))
    .slice(0, 10);

  res.json({
    success: true,
    data: {
      products: newArrivals,
      count: newArrivals.length
    }
  });
});

export { router as retailRouter };
