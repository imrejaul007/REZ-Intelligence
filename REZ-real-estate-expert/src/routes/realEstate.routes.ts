/**
 * Real Estate Expert Routes
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { realEstateExpertService } from '../services/realEstateExpert';

export const realEstateRouter = Router();

// Validation schemas
const searchSchema = z.object({
  query: z.string().optional(),
  type: z.enum(['apartment', 'house', 'villa', 'plot', 'commercial', 'industrial']).optional(),
  status: z.enum(['sale', 'rent', 'pg']).optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  city: z.string().optional(),
  locality: z.string().optional(),
  minBedrooms: z.number().optional(),
  maxBedrooms: z.number().optional(),
  minArea: z.number().optional(),
  maxArea: z.number().optional(),
  furnished: z.enum(['furnished', 'semi-furnished', 'unfurnished']).optional(),
  amenities: z.array(z.string()).optional(),
  page: z.number().optional().default(1),
  limit: z.number().optional().default(10),
});

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  sessionId: z.string().optional(),
  context: z.object({
    preferences: z.record(z.any()).optional(),
    history: z.array(z.string()).optional(),
  }).optional(),
});

const analyzeSchema = z.object({
  propertyId: z.string().min(1),
});

const marketTrendsSchema = z.object({
  city: z.string().optional(),
  locality: z.string().optional(),
});

// POST /api/v1/real-estate/search
realEstateRouter.post('/search', async (req: Request, res: Response) => {
  try {
    const params = searchSchema.parse(req.body);
    const results = await realEstateExpertService.searchProperties(params);
    res.json({ success: true, data: results });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.errors } });
    } else {
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Search failed' } });
    }
  }
});

// POST /api/v1/real-estate/chat
realEstateRouter.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, sessionId, context } = chatSchema.parse(req.body);
    const response = await realEstateExpertService.chat(message, context);
    res.json({ success: true, data: { response, sessionId } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.errors } });
    } else {
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Chat failed' } });
    }
  }
});

// POST /api/v1/real-estate/analyze
realEstateRouter.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { propertyId } = analyzeSchema.parse(req.body);
    const analysis = await realEstateExpertService.analyzeInvestment(propertyId);
    if (!analysis) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } });
    } else {
      res.json({ success: true, data: analysis });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.errors } });
    } else {
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Analysis failed' } });
    }
  }
});

// POST /api/v1/real-estate/investment
realEstateRouter.post('/investment', async (req: Request, res: Response) => {
  try {
    const { city, locality, budget, investmentGoal } = req.body;

    // Search for properties matching investment criteria
    const searchParams: any = {};
    if (city) searchParams.city = city;
    if (locality) searchParams.locality = locality;
    if (budget) {
      searchParams.maxPrice = budget * 1.2;
    }
    searchParams.status = 'sale';

    const results = await realEstateExpertService.searchProperties(searchParams);

    // Analyze top 3 properties
    const analyses = await Promise.all(
      results.properties.slice(0, 3).map(async (p) => {
        return await realEstateExpertService.analyzeInvestment(p.id);
      })
    );

    res.json({
      success: true,
      data: {
        criteria: { city, locality, budget, investmentGoal },
        recommendations: analyses.filter(Boolean)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Investment analysis failed' } });
  }
});

// GET /api/v1/real-estate/market-trends
realEstateRouter.get('/market-trends', async (req: Request, res: Response) => {
  try {
    const { city, locality } = marketTrendsSchema.parse(req.query);
    const trends = await realEstateExpertService.getMarketTrends(city, locality);
    res.json({ success: true, data: trends });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.errors } });
    } else {
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch market trends' } });
    }
  }
});

// GET /api/v1/real-estate/property/:id
realEstateRouter.get('/property/:id', async (req: Request, res: Response) => {
  try {
    const property = await realEstateExpertService.getPropertyById(req.params.id);
    if (!property) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } });
    } else {
      res.json({ success: true, data: property });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch property' } });
  }
});

// POST /api/v1/real-estate/recommendations
realEstateRouter.post('/recommendations', async (req: Request, res: Response) => {
  try {
    const preferences = searchSchema.parse(req.body);
    const recommendations = await realEstateExpertService.getRecommendations(preferences, 5);
    res.json({ success: true, data: recommendations });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.errors } });
    } else {
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to generate recommendations' } });
    }
  }
});
