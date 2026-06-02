import type {
  Customer,
  Segment,
  Prediction,
  Order,
  SearchFilters,
  PaginatedResponse,
  InsightData,
} from '../types';

const API_BASE = '/api/v1';

class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // Customer endpoints
  async getCustomer(id: string): Promise<Customer> {
    return this.request<Customer>(`/customers/${id}`);
  }

  async searchCustomers(
    filters: SearchFilters,
    page = 1,
    pageSize = 20
  ): Promise<PaginatedResponse<Customer>> {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
      ...(filters.query && { q: filters.query }),
      ...(filters.segment && { segment: filters.segment }),
      ...(filters.riskLevel && { riskLevel: filters.riskLevel }),
      ...(filters.tier && { tier: filters.tier }),
    });
    return this.request<PaginatedResponse<Customer>>(`/customers/search?${params}`);
  }

  async getCustomerOrders(customerId: string): Promise<Order[]> {
    return this.request<Order[]>(`/customers/${customerId}/orders`);
  }

  async getCustomerActivity(customerId: string): Promise<{ date: string; type: string; description: string }[]> {
    return this.request<{ date: string; type: string; description: string }[]>(
      `/customers/${customerId}/activity`
    );
  }

  // Segment endpoints
  async getSegments(): Promise<Segment[]> {
    return this.request<Segment[]>('/segments');
  }

  async getSegment(id: string): Promise<Segment> {
    return this.request<Segment>(`/segments/${id}`);
  }

  async getSegmentCustomers(segmentId: string): Promise<Customer[]> {
    return this.request<Customer[]>(`/segments/${segmentId}/customers`);
  }

  async createSegment(segment: Omit<Segment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Segment> {
    return this.request<Segment>('/segments', {
      method: 'POST',
      body: JSON.stringify(segment),
    });
  }

  async updateSegment(id: string, updates: Partial<Segment>): Promise<Segment> {
    return this.request<Segment>(`/segments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteSegment(id: string): Promise<void> {
    return this.request<void>(`/segments/${id}`, { method: 'DELETE' });
  }

  // Prediction endpoints
  async getPredictions(customerId: string): Promise<Prediction> {
    return this.request<Prediction>(`/customers/${customerId}/predictions`);
  }

  async getBatchPredictions(customerIds: string[]): Promise<Prediction[]> {
    return this.request<Prediction[]>('/predictions/batch', {
      method: 'POST',
      body: JSON.stringify({ customerIds }),
    });
  }

  // Insights endpoints
  async getInsights(): Promise<InsightData> {
    return this.request<InsightData>('/insights');
  }

  async getAtRiskCustomers(): Promise<Customer[]> {
    return this.request<Customer[]>('/insights/at-risk');
  }

  async getHighValueCustomers(): Promise<Customer[]> {
    return this.request<Customer[]>('/insights/high-value');
  }
}

export const api = new ApiClient();

// Mock data for development
export const mockApi = {
  getCustomer: async (id: string): Promise<Customer> => {
    await delay(300);
    return mockCustomers.find((c) => c.id === id) || mockCustomers[0];
  },

  searchCustomers: async (
    filters: SearchFilters,
    page = 1,
    pageSize = 20
  ): Promise<PaginatedResponse<Customer>> => {
    await delay(400);
    let filtered = [...mockCustomers];

    if (filters.query) {
      const q = filters.query.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.firstName.toLowerCase().includes(q) ||
          c.lastName.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.phone.includes(q)
      );
    }
    if (filters.segment) {
      filtered = filtered.filter((c) => c.segment === filters.segment);
    }
    if (filters.riskLevel) {
      filtered = filtered.filter((c) => c.riskLevel === filters.riskLevel);
    }
    if (filters.tier) {
      filtered = filtered.filter((c) => c.tier === filters.tier);
    }

    const start = (page - 1) * pageSize;
    const paged = filtered.slice(start, start + pageSize);

    return {
      data: paged,
      total: filtered.length,
      page,
      pageSize,
      totalPages: Math.ceil(filtered.length / pageSize),
    };
  },

  getCustomerOrders: async (customerId: string): Promise<Order[]> => {
    await delay(200);
    return mockOrders.filter((o) => o.customerId === customerId);
  },

  getCustomerActivity: async (customerId: string) => {
    await delay(200);
    return mockActivity[customerId] || [];
  },

  getSegments: async (): Promise<Segment[]> => {
    await delay(300);
    return mockSegments;
  },

  getSegment: async (id: string): Promise<Segment> => {
    await delay(200);
    return mockSegments.find((s) => s.id === id) || mockSegments[0];
  },

  getSegmentCustomers: async (segmentId: string): Promise<Customer[]> => {
    await delay(300);
    const segment = mockSegments.find((s) => s.id === segmentId);
    if (!segment) return [];
    return mockCustomers.filter((c) => c.segment === segment.name);
  },

  getPredictions: async (customerId: string): Promise<Prediction> => {
    await delay(350);
    const customer = mockCustomers.find((c) => c.id === customerId) || mockCustomers[0];
    return {
      customerId,
      churnScore: customer.churnProbability,
      churnRisk: customer.riskLevel,
      predictedLTV: customer.predictedLTV,
      ltvTier: customer.predictedLTV > 10000 ? 'vip' : customer.predictedLTV > 5000 ? 'premium' : 'standard',
      recommendedActions: mockRecommendations[customerId] || [],
      lastUpdated: new Date().toISOString(),
    };
  },

  getInsights: async (): Promise<InsightData> => {
    await delay(500);
    return {
      atRiskCustomers: mockCustomers.filter((c) => c.riskLevel === 'high'),
      highValueCustomers: mockCustomers.filter((c) => c.tier === 'platinum' || c.tier === 'gold'),
      recentChurners: mockCustomers.filter((c) => c.churnProbability > 70),
      engagementTrends: mockEngagementTrends,
    };
  },

  getAtRiskCustomers: async (): Promise<Customer[]> => {
    await delay(300);
    return mockCustomers.filter((c) => c.riskLevel === 'high');
  },

  getHighValueCustomers: async (): Promise<Customer[]> => {
    await delay(300);
    return mockCustomers.filter((c) => c.tier === 'platinum' || c.tier === 'gold');
  },
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Mock data
const mockCustomers: Customer[] = [
  {
    id: 'cust-001',
    firstName: 'Sarah',
    lastName: 'Mitchell',
    email: 'sarah.mitchell@email.com',
    phone: '+1-555-123-4567',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    tier: 'platinum',
    segment: 'VIP Champions',
    joinDate: '2022-03-15',
    lastVisit: '2026-05-10',
    totalOrders: 127,
    totalSpend: 15420,
    averageOrderValue: 121.4,
    engagementScore: 92,
    riskLevel: 'low',
    churnProbability: 8,
    predictedLTV: 45000,
    preferences: {
      channel: 'email',
      frequency: 'weekly',
      categories: ['Electronics', 'Fashion', 'Home'],
      communicationOptIn: true,
      marketingOptIn: true,
    },
    address: {
      street: '742 Evergreen Terrace',
      city: 'Portland',
      state: 'OR',
      zipCode: '97201',
      country: 'USA',
    },
  },
  {
    id: 'cust-002',
    firstName: 'James',
    lastName: 'Rodriguez',
    email: 'j.rodriguez@email.com',
    phone: '+1-555-234-5678',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    tier: 'gold',
    segment: 'Loyal Spenders',
    joinDate: '2023-06-20',
    lastVisit: '2026-05-08',
    totalOrders: 54,
    totalSpend: 8750,
    averageOrderValue: 162.0,
    engagementScore: 78,
    riskLevel: 'low',
    churnProbability: 15,
    predictedLTV: 22000,
    preferences: {
      channel: 'sms',
      frequency: 'monthly',
      categories: ['Sports', 'Electronics'],
      communicationOptIn: true,
      marketingOptIn: true,
    },
  },
  {
    id: 'cust-003',
    firstName: 'Emily',
    lastName: 'Chen',
    email: 'emily.chen@email.com',
    phone: '+1-555-345-6789',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
    tier: 'silver',
    segment: 'Occasional Shoppers',
    joinDate: '2024-01-10',
    lastVisit: '2026-04-15',
    totalOrders: 12,
    totalSpend: 890,
    averageOrderValue: 74.2,
    engagementScore: 45,
    riskLevel: 'medium',
    churnProbability: 42,
    predictedLTV: 3500,
    preferences: {
      channel: 'push',
      frequency: 'weekly',
      categories: ['Beauty', 'Fashion'],
      communicationOptIn: true,
      marketingOptIn: false,
    },
  },
  {
    id: 'cust-004',
    firstName: 'Michael',
    lastName: 'Thompson',
    email: 'm.thompson@email.com',
    phone: '+1-555-456-7890',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    tier: 'bronze',
    segment: 'At-Risk',
    joinDate: '2024-08-05',
    lastVisit: '2026-02-20',
    totalOrders: 3,
    totalSpend: 156,
    averageOrderValue: 52.0,
    engagementScore: 22,
    riskLevel: 'high',
    churnProbability: 78,
    predictedLTV: 800,
    preferences: {
      channel: 'email',
      frequency: 'monthly',
      categories: ['Home'],
      communicationOptIn: false,
      marketingOptIn: false,
    },
  },
  {
    id: 'cust-005',
    firstName: 'Lisa',
    lastName: 'Park',
    email: 'lisa.park@email.com',
    phone: '+1-555-567-8901',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    tier: 'gold',
    segment: 'Loyal Spenders',
    joinDate: '2023-02-28',
    lastVisit: '2026-05-09',
    totalOrders: 89,
    totalSpend: 12450,
    averageOrderValue: 139.9,
    engagementScore: 85,
    riskLevel: 'low',
    churnProbability: 12,
    predictedLTV: 28000,
    preferences: {
      channel: 'all',
      frequency: 'weekly',
      categories: ['Fashion', 'Accessories', 'Beauty'],
      communicationOptIn: true,
      marketingOptIn: true,
    },
  },
  {
    id: 'cust-006',
    firstName: 'David',
    lastName: 'Wilson',
    email: 'd.wilson@email.com',
    phone: '+1-555-678-9012',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    tier: 'silver',
    segment: 'Occasional Shoppers',
    joinDate: '2024-05-15',
    lastVisit: '2026-04-28',
    totalOrders: 8,
    totalSpend: 645,
    averageOrderValue: 80.6,
    engagementScore: 52,
    riskLevel: 'medium',
    churnProbability: 38,
    predictedLTV: 4200,
    preferences: {
      channel: 'sms',
      frequency: 'monthly',
      categories: ['Electronics', 'Gaming'],
      communicationOptIn: true,
      marketingOptIn: true,
    },
  },
  {
    id: 'cust-007',
    firstName: 'Amanda',
    lastName: 'Foster',
    email: 'a.foster@email.com',
    phone: '+1-555-789-0123',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
    tier: 'platinum',
    segment: 'VIP Champions',
    joinDate: '2021-11-20',
    lastVisit: '2026-05-10',
    totalOrders: 198,
    totalSpend: 32450,
    averageOrderValue: 163.9,
    engagementScore: 95,
    riskLevel: 'low',
    churnProbability: 5,
    predictedLTV: 78000,
    preferences: {
      channel: 'email',
      frequency: 'daily',
      categories: ['Luxury', 'Fashion', 'Travel'],
      communicationOptIn: true,
      marketingOptIn: true,
    },
  },
  {
    id: 'cust-008',
    firstName: 'Robert',
    lastName: 'Kim',
    email: 'r.kim@email.com',
    phone: '+1-555-890-1234',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150',
    tier: 'bronze',
    segment: 'New Customers',
    joinDate: '2025-12-01',
    lastVisit: '2026-01-15',
    totalOrders: 1,
    totalSpend: 89,
    averageOrderValue: 89.0,
    engagementScore: 30,
    riskLevel: 'high',
    churnProbability: 65,
    predictedLTV: 1500,
    preferences: {
      channel: 'push',
      frequency: 'weekly',
      categories: ['Sports'],
      communicationOptIn: true,
      marketingOptIn: true,
    },
  },
];

const mockOrders: Order[] = [
  {
    id: 'ord-001',
    customerId: 'cust-001',
    date: '2026-05-08',
    status: 'delivered',
    total: 245.99,
    items: [
      { productId: 'prod-123', name: 'Premium Wireless Headphones', quantity: 1, price: 199.99 },
      { productId: 'prod-456', name: 'Phone Case', quantity: 1, price: 24.99 },
      { productId: 'prod-789', name: 'Screen Protector', quantity: 2, price: 10.5 },
    ],
    shippingAddress: {
      street: '742 Evergreen Terrace',
      city: 'Portland',
      state: 'OR',
      zipCode: '97201',
      country: 'USA',
    },
  },
  {
    id: 'ord-002',
    customerId: 'cust-001',
    date: '2026-04-22',
    status: 'delivered',
    total: 89.95,
    items: [
      { productId: 'prod-234', name: 'Designer T-Shirt', quantity: 1, price: 59.95 },
      { productId: 'prod-567', name: 'Classic Jeans', quantity: 1, price: 30.0 },
    ],
    shippingAddress: {
      street: '742 Evergreen Terrace',
      city: 'Portland',
      state: 'OR',
      zipCode: '97201',
      country: 'USA',
    },
  },
  {
    id: 'ord-003',
    customerId: 'cust-001',
    date: '2026-04-05',
    status: 'delivered',
    total: 156.5,
    items: [
      { productId: 'prod-345', name: 'Smart Home Hub', quantity: 1, price: 129.99 },
      { productId: 'prod-678', name: 'LED Light Strip', quantity: 1, price: 26.51 },
    ],
    shippingAddress: {
      street: '742 Evergreen Terrace',
      city: 'Portland',
      state: 'OR',
      zipCode: '97201',
      country: 'USA',
    },
  },
  {
    id: 'ord-004',
    customerId: 'cust-002',
    date: '2026-05-01',
    status: 'shipped',
    total: 312.45,
    items: [
      { productId: 'prod-111', name: 'Running Shoes', quantity: 1, price: 159.99 },
      { productId: 'prod-222', name: 'Sports Socks (3-pack)', quantity: 2, price: 18.99 },
      { productId: 'prod-333', name: 'Fitness Tracker Band', quantity: 1, price: 95.49 },
    ],
    shippingAddress: {
      street: '123 Oak Street',
      city: 'Seattle',
      state: 'WA',
      zipCode: '98101',
      country: 'USA',
    },
  },
  {
    id: 'ord-005',
    customerId: 'cust-003',
    date: '2026-04-15',
    status: 'delivered',
    total: 78.99,
    items: [
      { productId: 'prod-444', name: 'Moisturizing Cream', quantity: 2, price: 28.99 },
      { productId: 'prod-555', name: 'Lipstick Set', quantity: 1, price: 21.01 },
    ],
    shippingAddress: {
      street: '456 Maple Ave',
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94102',
      country: 'USA',
    },
  },
];

const mockActivity: Record<string, { date: string; type: string; description: string }[]> = {
  'cust-001': [
    { date: '2026-05-10', type: 'visit', description: 'Browsed Electronics category' },
    { date: '2026-05-08', type: 'order', description: 'Placed order #ord-001 ($245.99)' },
    { date: '2026-05-05', type: 'email', description: 'Opened "Spring Sale" email' },
    { date: '2026-04-28', type: 'wishlist', description: 'Added "Wireless Earbuds" to wishlist' },
    { date: '2026-04-22', type: 'order', description: 'Placed order #ord-002 ($89.95)' },
    { date: '2026-04-15', type: 'review', description: 'Reviewed "Smart Watch Pro"' },
    { date: '2026-04-05', type: 'order', description: 'Placed order #ord-003 ($156.50)' },
    { date: '2026-03-28', type: 'visit', description: 'Browsed Home & Garden category' },
    { date: '2026-03-20', type: 'signup', description: 'Subscribed to VIP rewards program' },
  ],
  'cust-002': [
    { date: '2026-05-08', type: 'visit', description: 'Browsed Sports & Outdoors category' },
    { date: '2026-05-01', type: 'order', description: 'Placed order #ord-004 ($312.45)' },
    { date: '2026-04-25', type: 'email', description: 'Clicked "Free Shipping" promotion' },
    { date: '2026-04-10', type: 'review', description: 'Reviewed "Running Shoes Pro"' },
  ],
};

const mockSegments: Segment[] = [
  {
    id: 'seg-001',
    name: 'VIP Champions',
    description: 'Top-tier customers with highest lifetime value and engagement',
    rules: [
      { field: 'totalSpend', operator: 'greaterThan', value: 10000 },
      { field: 'tier', operator: 'equals', value: 'platinum' },
    ],
    customerCount: 245,
    avgLTV: 45600,
    avgEngagement: 91,
    createdAt: '2024-01-15',
    updatedAt: '2026-05-01',
  },
  {
    id: 'seg-002',
    name: 'Loyal Spenders',
    description: 'Consistent buyers with above-average order values',
    rules: [
      { field: 'totalOrders', operator: 'greaterThan', value: 25 },
      { field: 'averageOrderValue', operator: 'greaterThan', value: 100 },
    ],
    customerCount: 1245,
    avgLTV: 18500,
    avgEngagement: 78,
    createdAt: '2024-02-20',
    updatedAt: '2026-04-28',
  },
  {
    id: 'seg-003',
    name: 'At-Risk',
    description: 'Customers showing signs of disengagement or churn risk',
    rules: [
      { field: 'churnProbability', operator: 'greaterThan', value: 50 },
      { field: 'lastVisit', operator: 'lessThan', value: 60 },
    ],
    customerCount: 532,
    avgLTV: 2100,
    avgEngagement: 28,
    createdAt: '2024-03-10',
    updatedAt: '2026-05-05',
  },
  {
    id: 'seg-004',
    name: 'Occasional Shoppers',
    description: 'Regular but infrequent shoppers',
    rules: [
      { field: 'totalOrders', operator: 'between', value: [3, 20] },
      { field: 'engagementScore', operator: 'between', value: [30, 60] },
    ],
    customerCount: 2890,
    avgLTV: 4800,
    avgEngagement: 45,
    createdAt: '2024-04-05',
    updatedAt: '2026-04-20',
  },
  {
    id: 'seg-005',
    name: 'New Customers',
    description: 'Customers who joined within the last 6 months',
    rules: [
      { field: 'joinDate', operator: 'greaterThan', value: 180 },
    ],
    customerCount: 1567,
    avgLTV: 1200,
    avgEngagement: 35,
    createdAt: '2024-06-01',
    updatedAt: '2026-05-08',
  },
];

const mockRecommendations: Record<string, { id: string; type: 'retention' | 'upsell' | 'winback' | 'engagement'; title: string; description: string; priority: 'low' | 'medium' | 'high'; campaignId?: string }[]> = {
  'cust-001': [
    {
      id: 'rec-001',
      type: 'upsell',
      title: 'Premium Membership Upgrade',
      description: 'Eligible for exclusive platinum benefits and early access to sales',
      priority: 'high',
      campaignId: 'camp-123',
    },
    {
      id: 'rec-002',
      type: 'engagement',
      title: 'VIP Community Invitation',
      description: 'Invite to exclusive members-only events and product launches',
      priority: 'medium',
    },
  ],
  'cust-002': [
    {
      id: 'rec-003',
      type: 'upsell',
      title: 'Bundle Offer - Sports Pack',
      description: 'Save 15% when you add accessories to your recent purchase',
      priority: 'medium',
      campaignId: 'camp-124',
    },
  ],
  'cust-003': [
    {
      id: 'rec-004',
      type: 'winback',
      title: 'We Miss You Campaign',
      description: 'Special 20% discount on your favorite beauty products',
      priority: 'high',
      campaignId: 'camp-125',
    },
    {
      id: 'rec-005',
      type: 'engagement',
      title: 'Beauty Tips Newsletter',
      description: 'Weekly makeup tutorials and product recommendations',
      priority: 'low',
    },
  ],
  'cust-004': [
    {
      id: 'rec-006',
      type: 'winback',
      title: 'Reactivation Incentive',
      description: 'Free shipping on your next order + 25% discount code',
      priority: 'high',
      campaignId: 'camp-126',
    },
    {
      id: 'rec-007',
      type: 'engagement',
      title: 'Onboarding Series',
      description: 'Tips to get the most out of your membership',
      priority: 'medium',
    },
  ],
};

const mockEngagementTrends = [
  { date: '2026-01-01', score: 68 },
  { date: '2026-01-15', score: 72 },
  { date: '2026-02-01', score: 70 },
  { date: '2026-02-15', score: 75 },
  { date: '2026-03-01', score: 78 },
  { date: '2026-03-15', score: 74 },
  { date: '2026-04-01', score: 80 },
  { date: '2026-04-15', score: 82 },
  { date: '2026-05-01', score: 85 },
  { date: '2026-05-10', score: 86 },
];
