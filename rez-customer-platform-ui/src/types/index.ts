export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatar?: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  segment: string;
  joinDate: string;
  lastVisit: string;
  totalOrders: number;
  totalSpend: number;
  averageOrderValue: number;
  engagementScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  churnProbability: number;
  predictedLTV: number;
  preferences: CustomerPreferences;
  address?: Address;
}

export interface CustomerPreferences {
  channel: 'email' | 'sms' | 'push' | 'all';
  frequency: 'daily' | 'weekly' | 'monthly';
  categories: string[];
  communicationOptIn: boolean;
  marketingOptIn: boolean;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface Order {
  id: string;
  customerId: string;
  date: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  total: number;
  items: OrderItem[];
  shippingAddress: Address;
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Segment {
  id: string;
  name: string;
  description: string;
  rules: SegmentRule[];
  customerCount: number;
  avgLTV: number;
  avgEngagement: number;
  createdAt: string;
  updatedAt: string;
}

export interface SegmentRule {
  field: string;
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'between';
  value: string | number | [number, number];
}

export interface Prediction {
  customerId: string;
  churnScore: number;
  churnRisk: 'low' | 'medium' | 'high';
  predictedLTV: number;
  ltvTier: 'standard' | 'premium' | 'vip';
  recommendedActions: RecommendedAction[];
  lastUpdated: string;
}

export interface RecommendedAction {
  id: string;
  type: 'retention' | 'upsell' | 'winback' | 'engagement';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  campaignId?: string;
}

export interface SearchFilters {
  query?: string;
  segment?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  ltvRange?: [number, number];
  tier?: 'bronze' | 'silver' | 'gold' | 'platinum';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface InsightData {
  atRiskCustomers: Customer[];
  highValueCustomers: Customer[];
  recentChurners: Customer[];
  engagementTrends: { date: string; score: number }[];
}
