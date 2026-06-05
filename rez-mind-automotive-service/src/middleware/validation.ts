import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export const validate = (schema: z.ZodSchema, source: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const data = source === 'body' ? req.body : source === 'query' ? req.query : req.params;
      const parsed = schema.parse(data);
      if (source === 'body') req.body = parsed;
      else if (source === 'query') req.query = parsed as any;
      else req.params = parsed as any;
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Consultation schemas
export const consultRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  context: z.object({
    customerId: z.string().optional(),
    vehicleId: z.string().optional(),
    merchantId: z.string().optional(),
    sessionId: z.string().optional(),
  }).optional(),
});

// Pricing schemas
export const pricingRequestSchema = z.object({
  vehicleData: z.object({
    make: z.string().min(1),
    model: z.string().min(1),
    variant: z.string().min(1),
    year: z.number().int().min(1990).max(new Date().getFullYear() + 1),
    kilometerReading: z.number().int().min(0),
    fuelType: z.enum(['petrol', 'diesel', 'electric', 'hybrid']),
    transmission: z.enum(['manual', 'auto']),
    ownership: z.enum(['1st', '2nd', '3rd']),
    condition: z.enum(['excellent', 'good', 'fair', 'poor']).optional(),
    location: z.string().optional(),
    marketData: z.object({
      similarListings: z.number().optional(),
      avgPrice: z.number().optional(),
      minPrice: z.number().optional(),
      maxPrice: z.number().optional(),
    }).optional(),
  }),
  strategy: z.enum(['quick_sale', 'max_value', 'balanced']).optional(),
});

// Service prediction schemas
export const servicePredictionRequestSchema = z.object({
  vehicleId: z.string().min(1),
  currentKilometerReading: z.number().int().min(0).optional(),
  serviceHistory: z.array(z.object({
    serviceDate: z.string().datetime(),
    serviceType: z.enum(['regular', 'repair', 'inspection']),
    kilometersAtService: z.number().int().min(0),
    items: z.array(z.object({ name: z.string(), cost: z.number() })),
    totalCost: z.number().min(0),
  })).optional(),
});

// Lead scoring schemas
export const leadScoreRequestSchema = z.object({
  leadData: z.object({
    customerId: z.string().min(1),
    customerName: z.string().optional(),
    customerPhone: z.string().optional(),
    customerEmail: z.string().email().optional(),
    source: z.enum(['web', 'mobile', 'phone', 'walk-in', 'referral', 'other']),
    interest: z.object({
      vehicleId: z.string().optional(),
      vehicleInterest: z.string().optional(),
      serviceInterest: z.string().optional(),
      budget: z.object({ min: z.number(), max: z.number() }).optional(),
      timeline: z.enum(['immediate', '1_month', '3_months', '6_months', 'exploring']).optional(),
    }),
    engagement: z.object({
      pagesViewed: z.number().optional(),
      inquiriesMade: z.number().optional(),
      appointmentsBooked: z.number().optional(),
      testDrivesTaken: z.number().optional(),
      lastActivity: z.string().datetime().optional(),
    }).optional(),
    demographic: z.object({
      age: z.number().optional(),
      occupation: z.string().optional(),
      location: z.string().optional(),
    }).optional(),
  }),
  merchantId: z.string().min(1),
});