import { z } from 'zod';
import { Document } from 'mongoose';

// ============================================================
// ENUMS & CONSTANTS
// ============================================================

export enum WidgetType {
  METRIC = 'metric',
  CHART = 'chart',
  TABLE = 'table',
  ALERT = 'alert',
  ACTION = 'action',
  INSIGHT = 'insight',
}

export enum BusinessType {
  RESTAURANT = 'restaurant',
  HOTEL = 'hotel',
  RETAIL = 'retail',
  SERVICES = 'services',
}

export enum SubscriptionPlan {
  FREE = 'free',
  STARTER = 'starter',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export enum AlertType {
  INVENTORY = 'inventory',
  ORDER = 'order',
  PAYMENT = 'payment',
  CUSTOMER = 'customer',
  PERFORMANCE = 'performance',
  SYSTEM = 'system',
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

export enum AlertStatus {
  NEW = 'new',
  SEEN = 'seen',
  ACTIONED = 'actioned',
  DISMISSED = 'dismissed',
}

export enum NotificationType {
  ORDER = 'order',
  PAYMENT = 'payment',
  CUSTOMER = 'customer',
  SYSTEM = 'system',
  REPORT = 'report',
}

export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
}

export enum InsightType {
  POSITIVE = 'positive',
  WARNING = 'warning',
  INFO = 'info',
}

// ============================================================
// ZOD SCHEMAS
// ============================================================

export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

export const WidgetSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(WidgetType),
  title: z.string(),
  config: z.record(z.unknown()),
  position: PositionSchema,
  size: z.enum(['small', 'medium', 'large']).default('medium'),
});

export const DashboardFiltersSchema = z.object({
  dateRange: z.enum(['today', '7d', '30d', '90d', 'custom']).default('7d'),
  comparison: z.boolean().default(false),
});

export const DashboardSchema = z.object({
  merchantId: z.string(),
  name: z.string().default('Main Dashboard'),
  widgets: z.array(WidgetSchema),
  filters: DashboardFiltersSchema,
  isDefault: z.boolean().default(false),
  updatedAt: z.date().optional(),
});

export const BusinessInfoSchema = z.object({
  type: z.nativeEnum(BusinessType).optional(),
  name: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  pincode: z.string().optional(),
});

export const SubscriptionSchema = z.object({
  plan: z.nativeEnum(SubscriptionPlan).default(SubscriptionPlan.FREE),
  expiresAt: z.date().optional(),
  features: z.array(z.string()).default([]),
});

export const ConnectionsSchema = z.object({
  pos: z.boolean().default(false),
  aggregator: z.boolean().default(false),
  payment: z.boolean().default(false),
  inventory: z.boolean().default(false),
  orders: z.boolean().default(false),
});

export const PreferencesSchema = z.object({
  dashboardLayout: z.record(z.unknown()).optional(),
  notifications: z.record(z.unknown()).optional(),
  timezone: z.string().default('Asia/Kolkata'),
});

export const MerchantSchema = z.object({
  merchantId: z.string(),
  name: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  business: BusinessInfoSchema.optional(),
  subscription: SubscriptionSchema.optional(),
  connections: ConnectionsSchema.optional(),
  preferences: PreferencesSchema.optional(),
  lastLogin: z.date().optional(),
  createdAt: z.date().optional(),
});

export const AlertActionSchema = z.object({
  type: z.enum(['none', 'view', 'link']).default('none'),
  label: z.string().optional(),
  url: z.string().optional(),
});

export const AlertSchema = z.object({
  alertId: z.string(),
  merchantId: z.string(),
  type: z.nativeEnum(AlertType),
  severity: z.nativeEnum(AlertSeverity),
  title: z.string(),
  message: z.string(),
  data: z.record(z.unknown()).optional(),
  action: AlertActionSchema.optional(),
  status: z.nativeEnum(AlertStatus).default(AlertStatus.NEW),
  createdAt: z.date().default(() => new Date()),
  expiresAt: z.date().optional(),
});

export const NotificationSchema = z.object({
  notificationId: z.string(),
  merchantId: z.string(),
  type: z.nativeEnum(NotificationType),
  title: z.string(),
  body: z.string(),
  data: z.record(z.unknown()).optional(),
  read: z.boolean().default(false),
  readAt: z.date().optional(),
  channels: z.array(z.nativeEnum(NotificationChannel)).default([NotificationChannel.IN_APP]),
  createdAt: z.date().default(() => new Date()),
});

export const MetricSchema = z.object({
  orders: z.number(),
  revenue: z.number(),
  customers: z.number(),
  avgOrderValue: z.number(),
  newCustomers: z.number(),
  returningCustomers: z.number(),
  completionRate: z.number(),
  avgDeliveryTime: z.number(),
});

export const MetricsGrowthSchema = z.object({
  orders: z.string(),
  revenue: z.string(),
});

export const MetricsComparisonSchema = z.object({
  orders: z.number(),
  revenue: z.number(),
});

export const MetricsResponseSchema = z.object({
  current: MetricSchema,
  previous: MetricsComparisonSchema,
  growth: MetricsGrowthSchema,
  period: z.string(),
});

export const ChartDataPointSchema = z.object({
  date: z.string(),
  value: z.number(),
});

export const ChartDataResponseSchema = z.object({
  metric: z.string(),
  groupBy: z.string(),
  data: z.array(ChartDataPointSchema),
});

export const InsightSchema = z.object({
  type: z.nativeEnum(InsightType),
  title: z.string(),
  description: z.string(),
  action: z.object({
    type: z.enum(['view', 'link']),
    label: z.string(),
    url: z.string().optional(),
  }).optional(),
});

// ============================================================
// TYPE DEFINITIONS
// ============================================================

export type Position = z.infer<typeof PositionSchema>;
export type Widget = z.infer<typeof WidgetSchema>;
export type DashboardFilters = z.infer<typeof DashboardFiltersSchema>;
export type Dashboard = z.infer<typeof DashboardSchema>;
export type BusinessInfo = z.infer<typeof BusinessInfoSchema>;
export type Subscription = z.infer<typeof SubscriptionSchema>;
export type Connections = z.infer<typeof ConnectionsSchema>;
export type Preferences = z.infer<typeof PreferencesSchema>;
export type Merchant = z.infer<typeof MerchantSchema>;
export type AlertAction = z.infer<typeof AlertActionSchema>;
export type Alert = z.infer<typeof AlertSchema>;
export type Notification = z.infer<typeof NotificationSchema>;
export type Metric = z.infer<typeof MetricSchema>;
export type MetricsGrowth = z.infer<typeof MetricsGrowthSchema>;
export type MetricsComparison = z.infer<typeof MetricsComparisonSchema>;
export type MetricsResponse = z.infer<typeof MetricsResponseSchema>;
export type ChartDataPoint = z.infer<typeof ChartDataPointSchema>;
export type ChartDataResponse = z.infer<typeof ChartDataResponseSchema>;
export type Insight = z.infer<typeof InsightSchema>;

// Mongoose Document types
export interface IMerchant extends Document {
  merchantId: string;
  name: string;
  email?: string;
  phone?: string;
  business?: {
    type?: BusinessType;
    name?: string;
    address?: string;
    city?: string;
    pincode?: string;
  };
  subscription?: {
    plan: SubscriptionPlan;
    expiresAt?: Date;
    features: string[];
  };
  connections?: Connections;
  preferences?: Preferences;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDashboard extends Document {
  merchantId: string;
  name: string;
  widgets: Widget[];
  filters: DashboardFilters;
  isDefault: boolean;
  updatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAlert extends Document {
  alertId: string;
  merchantId: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  action?: AlertAction;
  status: AlertStatus;
  createdAt: Date;
  expiresAt?: Date;
  updatedAt: Date;
}

export interface INotification extends Document {
  notificationId: string;
  merchantId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  read: boolean;
  readAt?: Date;
  channels: NotificationChannel[];
  createdAt: Date;
  updatedAt: Date;
}

// API Request/Response Types
export interface CreateMerchantRequest {
  name: string;
  email?: string;
  phone?: string;
  business?: BusinessInfo;
}

export interface UpdateDashboardRequest {
  widgets?: Widget[];
  filters?: DashboardFilters;
}

export interface UpdateAlertRequest {
  status: AlertStatus;
}

export interface MerchantMetricsResponse {
  metrics: MetricsResponse;
}

export interface MerchantInsightsResponse {
  insights: Insight[];
}
