import { z } from 'zod';

// RFM Score values (1-5)
export type RFMScoreValue = 1 | 2 | 3 | 4 | 5;

// RFM Score interface
export interface IRFMScore {
  customerId: string;
  recency: RFMScoreValue;
  frequency: RFMScoreValue;
  monetary: RFMScoreValue;
  rfmCode: string; // e.g., "555", "432"
  segment: string;
  lastCalculatedAt: Date;
  metadata?: {
    daysSinceLastOrder: number;
    totalOrders: number;
    totalSpent: number;
  };
}

// Segment definitions
export interface ISegment {
  name: string;
  code: string;
  rfmCodes: string[];
  description: string;
  color: string;
}

// Customer order data (input for RFM calculation)
export interface ICustomerOrderData {
  customerId: string;
  orders: Array<{
    orderId: string;
    orderDate: Date;
    totalAmount: number;
  }>;
}

// API Request/Response types
export interface CalculateAllRequest {
  batchSize?: number;
  startDate?: Date;
  endDate?: Date;
}

export interface CalculateSingleRequest {
  customerId: string;
  orders?: Array<{
    orderId: string;
    orderDate: Date;
    totalAmount: number;
  }>;
}

export interface SegmentAnalytics {
  segment: string;
  customerCount: number;
  percentage: number;
  avgRecency: number;
  avgFrequency: number;
  avgMonetary: number;
  totalRevenue: number;
}

export interface RFMAnalyticsResponse {
  totalCustomers: number;
  segments: SegmentAnalytics[];
  distribution: Record<string, number>;
  generatedAt: Date;
}

// Zod schemas for validation
export const CalculateAllSchema = z.object({
  batchSize: z.number().int().min(1).max(1000).optional().default(100),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const CalculateSingleSchema = z.object({
  customerId: z.string().min(1),
  orders: z.array(z.object({
    orderId: z.string().min(1),
    orderDate: z.string().datetime(),
    totalAmount: z.number().min(0),
  })).optional(),
});

export const CustomerIdParamSchema = z.object({
  customerId: z.string().min(1),
});

export const SegmentParamSchema = z.object({
  segment: z.string().min(1),
});

// Segment mapping configuration
export const SEGMENTS: Record<string, ISegment> = {
  champions: {
    name: 'Champions',
    code: 'champions',
    rfmCodes: ['555', '554', '544'],
    description: 'Best customers who bought most recently, most often, and are your biggest spenders',
    color: '#22c55e',
  },
  loyal: {
    name: 'Loyal',
    code: 'loyal',
    rfmCodes: ['545', '454', '445'],
    description: 'Customers who show high engagement and consistent purchasing patterns',
    color: '#3b82f6',
  },
  potentialLoyalist: {
    name: 'Potential Loyalist',
    code: 'potentialLoyalist',
    rfmCodes: ['435', '345', '325'],
    description: 'Recent customers with decent frequency and spending potential',
    color: '#8b5cf6',
  },
  recent: {
    name: 'Recent',
    code: 'recent',
    rfmCodes: ['415', '314'],
    description: 'New customers with promising activity levels',
    color: '#06b6d4',
  },
  promising: {
    name: 'Promising',
    code: 'promising',
    rfmCodes: ['414', '212'],
    description: 'Promising customers who showed some interest but need nurturing',
    color: '#f59e0b',
  },
  needsAttention: {
    name: 'Needs Attention',
    code: 'needsAttention',
    rfmCodes: ['433', '343'],
    description: 'Average customers with declining activity who may need re-engagement',
    color: '#f97316',
  },
  atRisk: {
    name: 'At Risk',
    code: 'atRisk',
    rfmCodes: ['441', '332', '231'],
    description: 'Customers who used to purchase frequently but have become inactive',
    color: '#ef4444',
  },
  cantLoseThem: {
    name: "Can't Lose Them",
    code: 'cantLoseThem',
    rfmCodes: ['451', '352'],
    description: 'High-value customers who haven\'t purchased recently and need immediate attention',
    color: '#dc2626',
  },
  lost: {
    name: 'Lost',
    code: 'lost',
    rfmCodes: ['111', '112'],
    description: 'Customers who haven\'t purchased in a long time with low spending',
    color: '#6b7280',
  },
  lostCheap: {
    name: 'Lost Cheap',
    code: 'lostCheap',
    rfmCodes: ['121', '122'],
    description: 'Former customers with low monetary value who are unlikely to return',
    color: '#9ca3af',
  },
};

// Segment for unknown/uncategorized scores
export const UNKNOWN_SEGMENT: ISegment = {
  name: 'Uncategorized',
  code: 'uncategorized',
  rfmCodes: [],
  description: 'Customers not yet categorized',
  color: '#94a3b8',
};
