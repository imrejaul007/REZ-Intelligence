import { z } from 'zod';

// ============================================================
// ENUMS & CONSTANTS
// ============================================================

export enum FlywheelStage {
  DISCOVERY = 'discovery',
  CONSIDERATION = 'consideration',
  CONVERSION = 'conversion',
  LOYALTY = 'loyalty',
  IDLE = 'idle',
}

export enum EventType {
  QR_SCAN = 'qr_scan',
  BROWSE = 'browse',
  ORDER = 'order',
  REORDER = 'reorder',
}

// ============================================================
// ZOD SCHEMAS
// ============================================================

export const MerchantVisitSchema = z.object({
  visits: z.number().min(0).default(0),
  lastVisit: z.string().datetime().nullable().default(null),
});

export const TasteProfileSchema = z.object({
  userId: z.string(),
  merchants: z.record(z.string(), MerchantVisitSchema).default({}),
  categories: z.record(z.string(), z.number()).default({}),
  updatedAt: z.string().datetime(),
});

export const SearchRecordSchema = z.object({
  id: z.string(),
  query: z.string(),
  context: z.record(z.unknown()),
  timestamp: z.string().datetime(),
});

export const OrderItemSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  price: z.number(),
  quantity: z.number().min(1).default(1),
});

export const OrderSchema = z.object({
  orderId: z.string(),
  userId: z.string(),
  merchantId: z.string(),
  merchantName: z.string().optional(),
  items: z.array(OrderItemSchema),
  totalAmount: z.number(),
  status: z.enum(['pending', 'completed', 'cancelled', 'refunded']).default('completed'),
  createdAt: z.string().datetime(),
});

export const NudgeSchema = z.object({
  id: z.string(),
  userId: z.string(),
  orderId: z.string(),
  message: z.string(),
  score: z.number(),
  sentAt: z.string().datetime(),
  status: z.enum(['pending', 'sent', 'delivered', 'converted']).default('sent'),
});

export const ReorderScoreSchema = z.object({
  score: z.number().min(0).max(100),
  factors: z.object({
    daysSinceOrder: z.number(),
    recencyBoost: z.number(),
    frequencyBoost: z.number(),
    itemCount: z.number(),
  }),
  threshold: z.number().default(60),
  shouldNudge: z.boolean(),
});

export const EventSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(EventType),
  userId: z.string(),
  merchantId: z.string().optional(),
  merchantName: z.string().optional(),
  location: z.string().optional(),
  query: z.string().optional(),
  items: z.array(OrderItemSchema).optional(),
  totalAmount: z.number().optional(),
  stage: z.nativeEnum(FlywheelStage),
  timestamp: z.string().datetime(),
});

export const RecommendationSchema = z.object({
  merchantId: z.string(),
  visits: z.number(),
  affinity: z.number().min(0).max(100),
});

export const ConversionTrackingSchema = z.object({
  evaluated: z.number(),
  candidates: z.number(),
  nudgesSent: z.number(),
  conversionRate: z.string(),
});

export const UserProfileSchema = z.object({
  userId: z.string(),
  tasteProfile: TasteProfileSchema.optional(),
  identity: z.record(z.unknown()).optional(),
  events: z.array(EventSchema).optional(),
  searchContext: z.record(z.unknown()).optional(),
  totalOrders: z.number(),
  flywheelStage: z.nativeEnum(FlywheelStage),
});

export const FlywheelStatusSchema = z.object({
  totalEvents: z.number(),
  totalOrders: z.number(),
  totalNudges: z.number(),
  usersWithProfiles: z.number(),
  recentActivity: z.object({
    events: z.array(z.object({
      type: z.string(),
      userId: z.string(),
      timestamp: z.string(),
    })),
    orders: z.array(z.object({
      orderId: z.string(),
      userId: z.string(),
      merchantName: z.string().optional(),
    })),
  }),
});

// ============================================================
// TYPE DEFINITIONS
// ============================================================

export type MerchantVisit = z.infer<typeof MerchantVisitSchema>;
export type TasteProfile = z.infer<typeof TasteProfileSchema>;
export type SearchRecord = z.infer<typeof SearchRecordSchema>;
export type OrderItem = z.infer<typeof OrderItemSchema>;
export type Order = z.infer<typeof OrderSchema>;
export type Nudge = z.infer<typeof NudgeSchema>;
export type ReorderScore = z.infer<typeof ReorderScoreSchema>;
export type Event = z.infer<typeof EventSchema>;
export type Recommendation = z.infer<typeof RecommendationSchema>;
export type ConversionTracking = z.infer<typeof ConversionTrackingSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type FlywheelStatus = z.infer<typeof FlywheelStatusSchema>;

// API Request Types
export interface QRScanRequest {
  userId: string;
  merchantId: string;
  merchantName?: string;
  location?: string;
}

export interface BrowseRequest {
  userId: string;
  query?: string;
  merchantId?: string;
  items?: OrderItem[];
}

export interface OrderRequest {
  userId: string;
  merchantId: string;
  merchantName?: string;
  items: OrderItem[];
  totalAmount?: number;
}

export interface ReorderCandidate {
  orderId: string;
  userId: string;
  merchantId: string;
  scoreData: ReorderScore;
  action: 'nudge' | 'skip';
}

// API Response Types
export interface QRScanResponse {
  eventId: string;
  userId: string;
  merchantId: string;
  merchantName?: string;
  stage: FlywheelStage;
  nextAction: string;
  message: string;
}

export interface BrowseResponse {
  eventId: string;
  userId: string;
  context: { recentSearches: SearchRecord[]; totalSearches: number };
  tasteProfile?: TasteProfile;
  stage: FlywheelStage;
  recommendations: Recommendation[];
}

export interface OrderResponse extends Order {
  stage: FlywheelStage;
  reorderScheduled: boolean;
  estimatedReorderWindow: string;
  message: string;
}

export interface ReorderTriggerResponse {
  evaluated: number;
  candidates: ReorderCandidate[];
  nudges: Array<{
    orderId: string;
    nudgeId: string;
    score: number;
    userId: string;
  }>;
  tracking: ConversionTracking;
}

export interface ReorderScoreResponse {
  orderId: string;
  merchantId: string;
  merchantName?: string;
  lastOrderDate: string;
  score: ReorderScore;
  daysSinceOrder: number;
}
