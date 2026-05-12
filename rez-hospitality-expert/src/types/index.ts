/**
 * Hospitality Expert Agent - Type Definitions
 */

import { z } from 'zod';

// ============================================
// ENUMS
// ============================================

export enum HospitalityIntent {
  CHECK_IN = 'CHECK_IN',
  CHECK_OUT = 'CHECK_OUT',
  ROOM_SERVICE = 'ROOM_SERVICE',
  HOUSEKEEPING = 'HOUSEKEEPING',
  CONCIERGE = 'CONCIERGE',
  AMENITIES = 'AMENITIES',
  DINING = 'DINING',
  SPA_WELLNESS = 'SPA_WELLNESS',
  TRANSPORTATION = 'TRANSPORTATION',
  LOCAL_RECOMMENDATIONS = 'LOCAL_RECOMMENDATIONS',
  ROOM_UPGRADE = 'ROOM_UPGRADE',
  COMPLAINT = 'COMPLAINT',
  GENERAL_INQUIRY = 'GENERAL_INQUIRY',
  EMERGENCY = 'EMERGENCY',
  BILLING = 'BILLING',
  WiFi_TECHNICAL = 'WIFI_TECHNICAL',
}

export enum RoomType {
  STANDARD = 'STANDARD',
  DELUXE = 'DELUXE',
  SUITE = 'SUITE',
  JUNIOR_SUITE = 'JUNIOR_SUITE',
  PRESIDENTIAL_SUITE = 'PRESIDENTIAL_SUITE',
  EXECUTIVE = 'EXECUTIVE',
  ACCESSIBLE = 'ACCESSIBLE',
  FAMILY = 'FAMILY',
  OCEAN_VIEW = 'OCEAN_VIEW',
  POOL_VIEW = 'POOL_VIEW',
}

export enum AmenityCategory {
  ROOM = 'ROOM',
  PROPERTY = 'PROPERTY',
  DINING = 'DINING',
  RECREATION = 'RECREATION',
  BUSINESS = 'BUSINESS',
  ACCESSIBILITY = 'ACCESSIBILITY',
}

export enum ServiceStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  DELAYED = 'DELAYED',
}

export enum Priority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum GuestTier {
  STANDARD = 'STANDARD',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
  DIAMOND = 'DIAMOND',
}

// ============================================
// ZOD SCHEMAS
// ============================================

export const GuestSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  tier: z.nativeEnum(GuestTier).default(GuestTier.STANDARD),
  preferences: z.record(z.any()).optional(),
  notes: z.string().optional(),
});

export const ReservationSchema = z.object({
  id: z.string(),
  guestId: z.string(),
  roomNumber: z.string().optional(),
  roomType: z.nativeEnum(RoomType),
  checkInDate: z.string().datetime(),
  checkOutDate: z.string().datetime(),
  adults: z.number().int().positive().default(1),
  children: z.number().int().nonnegative().default(0),
  specialRequests: z.string().optional(),
  status: z.enum(['confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show']),
});

export const ServiceRequestSchema = z.object({
  id: z.string(),
  guestId: z.string(),
  reservationId: z.string().optional(),
  intent: z.nativeEnum(HospitalityIntent),
  request: z.string(),
  priority: z.nativeEnum(Priority).default(Priority.NORMAL),
  status: z.nativeEnum(ServiceStatus).default(ServiceStatus.PENDING),
  roomNumber: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  assignedTo: z.string().optional(),
});

export const ChatMessageSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  role: z.enum(['guest', 'agent', 'system']),
  content: z.string(),
  intent: z.nativeEnum(HospitalityIntent).optional(),
  metadata: z.record(z.any()).optional(),
  timestamp: z.string().datetime(),
});

export const ConversationContextSchema = z.object({
  sessionId: z.string(),
  guest: GuestSchema.optional(),
  reservation: ReservationSchema.optional(),
  currentIntent: z.nativeEnum(HospitalityIntent).optional(),
  conversationHistory: z.array(ChatMessageSchema),
  recentRequests: z.array(ServiceRequestSchema),
  preferences: z.record(z.any()).optional(),
  language: z.string().default('en'),
  createdAt: z.string().datetime(),
  lastActivity: z.string().datetime(),
});

// ============================================
// REQUEST/RESPONSE TYPES
// ============================================

export interface ChatRequest {
  sessionId: string;
  message: string;
  guestId?: string;
  reservationId?: string;
  metadata?: Record<string, unknown>;
}

export interface ChatResponse {
  sessionId: string;
  message: string;
  intent?: HospitalityIntent;
  confidence: number;
  suggestedActions?: SuggestedAction[];
  quickReplies?: string[];
  metadata?: Record<string, unknown>;
}

export interface SuggestedAction {
  label: string;
  action: string;
  payload?: Record<string, unknown>;
}

export interface RoomRecommendation {
  roomType: RoomType;
  description: string;
  priceDifference: number;
  benefits: string[];
  images?: string[];
}

export interface AmenityInfo {
  name: string;
  description: string;
  category: AmenityCategory;
  hours?: string;
  location?: string;
  contact?: string;
  price?: number;
  isAvailable: boolean;
}

export interface LocalRecommendation {
  name: string;
  type: 'restaurant' | 'attraction' | 'shopping' | 'transport' | 'entertainment';
  distance: string;
  description: string;
  rating?: number;
  priceRange?: string;
  hours?: string;
  contact?: string;
  imageUrl?: string;
}

// ============================================
// WORKFLOW TYPES
// ============================================

export interface WorkflowStep {
  order: number;
  action: string;
  prompt: string;
  requiredFields: string[];
  optionalFields: string[];
  validationRules?: Record<string, z.ZodSchema>;
  onComplete?: string;
}

export interface CheckInWorkflow {
  steps: WorkflowStep[];
  estimatedTime: string;
  requiredDocuments: string[];
  specialRequests: string[];
}

export interface CheckOutWorkflow {
  steps: WorkflowStep[];
  estimatedTime: string;
  billingItems: string[];
  feedback: string[];
}

// ============================================
// CONFIGURATION TYPES
// ============================================

export interface HospitalityExpertConfig {
  serviceName: string;
  port: number;
  mongodbUri: string;
  mongodbDb: string;
  redisUrl: string;
  anthropicApiKey: string;
  anthropicModel: string;
  maxTokens: number;
  sessionTimeout: number;
  maxConversationHistory: number;
  rateLimitWindow: number;
  rateLimitMax: number;
}

// ============================================
// LIFECYCLE TYPES
// ============================================

export interface AgentLifecycleEvent {
  event: 'start' | 'end' | 'error';
  sessionId: string;
  guestId?: string;
  intent?: HospitalityIntent;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// ============================================
// ANALYTICS TYPES
// ============================================

export interface IntentMetrics {
  intent: HospitalityIntent;
  count: number;
  avgResponseTime: number;
  satisfactionScore?: number;
  escalationCount: number;
}

export interface SessionMetrics {
  sessionId: string;
  duration: number;
  messageCount: number;
  intentsDetected: HospitalityIntent[];
  satisfactionScore?: number;
  createdAt: string;
  endedAt?: string;
}

// Type exports
export type Guest = z.infer<typeof GuestSchema>;
export type Reservation = z.infer<typeof ReservationSchema>;
export type ServiceRequest = z.infer<typeof ServiceRequestSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ConversationContext = z.infer<typeof ConversationContextSchema>;
