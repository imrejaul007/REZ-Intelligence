import { z } from 'zod';

// Delay Risk
export const DelayRiskSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type DelayRisk = z.infer<typeof DelayRiskSchema>;

// Delivery Status
export const DeliveryStatusSchema = z.enum([
  'PENDING',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'FAILED',
  'RETURNED'
]);
export type DeliveryStatus = z.infer<typeof DeliveryStatusSchema>;

// Delivery Insight
export const DeliveryInsightSchema = z.object({
  orderId: z.string(),
  trackingNumber: z.string().optional(),
  status: DeliveryStatusSchema,
  eta: z.number(), // Estimated hours remaining
  etaDate: z.string().datetime(),
  actualDeliveryDate: z.string().datetime().optional(),
  deliveryScore: z.number().min(0).max(100),
  delayRisk: DelayRiskSchema,
  optimalRoute: z.array(z.string()).optional(),
  currentLocation: z.object({
    latitude: z.number(),
    longitude: z.number(),
    address: z.string().optional(),
    updatedAt: z.string().datetime(),
  }).optional(),
  delayFactors: z.array(z.object({
    factor: z.string(),
    impact: z.number(), // 0-1 impact on ETA
    description: z.string(),
  })).optional(),
  milestones: z.array(z.object({
    status: DeliveryStatusSchema,
    location: z.string().optional(),
    timestamp: z.string().datetime(),
    notes: z.string().optional(),
  })).optional(),
  recipient: z.object({
    name: z.string(),
    phone: z.string().optional(),
    address: z.string(),
  }).optional(),
  carrier: z.object({
    name: z.string(),
    trackingUrl: z.string().url().optional(),
  }).optional(),
  lastUpdated: z.string().datetime(),
});

export type DeliveryInsight = z.infer<typeof DeliveryInsightSchema>;

// Route Optimization
export const RoutePointSchema = z.object({
  orderId: z.string(),
  customerAddress: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  timeWindow: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }).optional(),
  estimatedDeliveryTime: z.string().datetime().optional(),
});

export type RoutePoint = z.infer<typeof RoutePointSchema>;

export const RouteOptimizationSchema = z.object({
  merchantId: z.string(),
  date: z.string(),
  totalOrders: z.number().int().nonnegative(),
  optimizedRoute: z.array(z.object({
    sequence: z.number().int().min(1),
    orderId: z.string(),
    customerAddress: z.string(),
    estimatedArrival: z.string().datetime(),
    estimatedDeliveryTime: z.string().datetime(),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
    status: z.enum(['PENDING', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'FAILED']),
  })),
  totalDistance: z.number(), // in km
  estimatedDuration: z.number(), // in minutes
  estimatedFuelCost: z.number().optional(),
  savings: z.object({
    distanceSaved: z.number(),
    timeSaved: z.number(),
    percentageImprovement: z.number(),
  }).optional(),
  warnings: z.array(z.object({
    orderId: z.string().optional(),
    message: z.string(),
    severity: z.enum(['INFO', 'WARNING', 'CRITICAL']),
  })).optional(),
  generatedAt: z.string().datetime(),
});

export type RouteOptimization = z.infer<typeof RouteOptimizationSchema>;

// Delivery Analytics
export const DeliveryAnalyticsSchema = z.object({
  merchantId: z.string(),
  period: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
  summary: z.object({
    totalDeliveries: z.number().int().nonnegative(),
    successfulDeliveries: z.number().int().nonnegative(),
    failedDeliveries: z.number().int().nonnegative(),
    returnRate: z.number().min(0).max(1),
    averageDeliveryTime: z.number(), // in hours
    onTimeDeliveryRate: z.number().min(0).max(1),
  }),
  trends: z.array(z.object({
    date: z.string(),
    deliveries: z.number().int(),
    onTimeRate: z.number().min(0).max(1),
    avgDeliveryTime: z.number(),
  })).optional(),
  delayAnalysis: z.object({
    totalDelays: z.number().int().nonnegative(),
    delayRate: z.number().min(0).max(1),
    averageDelayHours: z.number(),
    topDelayReasons: z.array(z.object({
      reason: z.string(),
      count: z.number().int(),
      percentage: z.number(),
    })),
  }).optional(),
  customerSatisfaction: z.object({
    averageRating: z.number().min(0).max(5),
    totalRatings: z.number().int(),
    ratingsDistribution: z.object({
      1: z.number().int(),
      2: z.number().int(),
      3: z.number().int(),
      4: z.number().int(),
      5: z.number().int(),
    }),
  }).optional(),
  generatedAt: z.string().datetime(),
});

export type DeliveryAnalytics = z.infer<typeof DeliveryAnalyticsSchema>;

// Delivery Prediction
export const DeliveryPredictionSchema = z.object({
  orderId: z.string(),
  predictedEta: z.string().datetime(),
  confidence: z.number().min(0).max(1),
  riskFactors: z.array(z.object({
    factor: z.string(),
    probability: z.number().min(0).max(1),
    impact: z.string(),
    mitigation: z.string().optional(),
  })),
  alternativeRoutes: z.array(z.object({
    route: z.array(z.string()),
    estimatedTime: z.number(),
    riskLevel: DelayRiskSchema,
  })).optional(),
  recommendedActions: z.array(z.string()).optional(),
  generatedAt: z.string().datetime(),
});

export type DeliveryPrediction = z.infer<typeof DeliveryPredictionSchema>;

// API Response Types
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

export type ApiResponse = z.infer<typeof ApiResponseSchema>;

// Pagination
export const PaginationSchema = z.object({
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
  hasMore: z.boolean(),
});

export type Pagination = z.infer<typeof PaginationSchema>;
