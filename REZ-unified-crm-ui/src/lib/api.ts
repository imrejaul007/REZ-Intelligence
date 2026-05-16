/**
 * REZ Unified CRM - API Client
 *
 * Connects to the Unified CRM Hub Merchant API.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_UNIFIED_CRM_URL || 'http://localhost:4101';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
}

// Token storage
let authToken: string | null = null;

export function setAuthToken(token: string) {
  authToken = token;
  if (typeof window !== 'undefined') {
    localStorage.setItem('crm_token', token);
  }
}

export function getAuthToken(): string | null {
  if (authToken) return authToken;
  if (typeof window !== 'undefined') {
    authToken = localStorage.getItem('crm_token');
  }
  return authToken;
}

export function clearAuthToken() {
  authToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('crm_token');
  }
}

export const logout = clearAuthToken;

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getAuthToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        clearAuthToken();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
      throw new Error(data.message || data.error || 'API Error');
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// Auth API
export async function login(merchantId: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ merchantId }),
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Login failed');
  }

  setAuthToken(data.data.token);
  return data.data.token;
}

export async function getCurrentMerchant() {
  return fetchApi<{
    merchantId: string;
    merchantName: string;
    permissions: string[];
  }>('/auth/me');
}

// Customers API
export interface MerchantCustomer {
  id: string;
  userId: string;
  name: string;
  phone?: string;
  segments: string[];
  totalOrders: number;
  totalSpend: number;
  averageOrderValue: number;
  lastVisit?: string;
  joinedDate: string;
}

export interface MerchantSegment {
  id: string;
  name: string;
  description?: string;
  customerCount: number;
  totalRevenue: number;
}

export interface CustomerDetail extends MerchantCustomer {
  email?: string;
  orders: {
    id: string;
    orderNumber: string;
    storeName: string;
    items: string[];
    total: number;
    status: string;
    createdAt: string;
  }[];
  reviews: {
    id: string;
    rating: number;
    comment?: string;
    storeName: string;
    createdAt: string;
  }[];
  tags: {
    name: string;
    icon?: string;
    color: string;
  }[];
}

export interface InboxMessage {
  id: string;
  channel: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  direction: 'INBOUND' | 'OUTBOUND';
  type: string;
  content: string;
  status: string;
  createdAt: string;
}

export interface InboxChannel {
  channel: string;
  name: string;
  icon: string;
  unreadCount: number;
  isConnected: boolean;
}

export interface AnalyticsOverview {
  totalCustomers: number;
  activeCustomers: number;
  newThisMonth: number;
  revenue: {
    total: number;
    averageOrderValue: number;
    totalOrders: number;
  };
  growth: {
    customerGrowth: number;
    revenueGrowth: number;
    orderGrowth: number;
  };
  retention: {
    rate: number;
    repeatCustomers: number;
  };
  topProducts: {
    name: string;
    orders: number;
    revenue: number;
  }[];
}

export async function getCustomers(options?: {
  page?: number;
  limit?: number;
  search?: string;
  segment?: string;
}): Promise<{ customers: MerchantCustomer[]; total: number }> {
  const params = new URLSearchParams();
  if (options?.page) params.append('page', String(options.page));
  if (options?.limit) params.append('limit', String(options.limit));
  if (options?.search) params.append('search', options.search);
  if (options?.segment) params.append('segment', options.segment);

  const query = params.toString();
  const response = await fetchApi<MerchantCustomer[]>(`/customers${query ? `?${query}` : ''}`);
  return {
    customers: response.data || [],
    total: response.meta?.total || 0,
  };
}

export async function getCustomerById(id: string): Promise<CustomerDetail | null> {
  const response = await fetchApi<CustomerDetail>(`/customers/${id}`);
  return response.data || null;
}

export async function getSegments(): Promise<MerchantSegment[]> {
  const response = await fetchApi<MerchantSegment[]>('/segments');
  return response.data || [];
}

export async function getInboxMessages(channel?: string): Promise<InboxMessage[]> {
  const query = channel ? `?channel=${channel}` : '';
  const response = await fetchApi<InboxMessage[]>(`/inbox/messages${query}`);
  return response.data || [];
}

export async function getInboxChannels(): Promise<InboxChannel[]> {
  const response = await fetchApi<InboxChannel[]>('/inbox/channels');
  return response.data || [];
}

export async function sendReply(messageId: string, content: string, channel?: string) {
  return fetchApi<InboxMessage>(`/inbox/messages/${messageId}/reply`, {
    method: 'POST',
    body: JSON.stringify({ content, channel }),
  });
}

export async function getAnalytics(): Promise<AnalyticsOverview> {
  const response = await fetchApi<AnalyticsOverview>('/analytics/overview');
  return response.data || {
    totalCustomers: 0,
    activeCustomers: 0,
    newThisMonth: 0,
    revenue: { total: 0, averageOrderValue: 0, totalOrders: 0 },
    growth: { customerGrowth: 0, revenueGrowth: 0, orderGrowth: 0 },
    retention: { rate: 0, repeatCustomers: 0 },
    topProducts: [],
  };
}

export default {
  login,
  logout: clearAuthToken,
  getAuthToken,
  getCurrentMerchant,
  getCustomers,
  getCustomerById,
  getSegments,
  getInboxMessages,
  getInboxChannels,
  sendReply,
  getAnalytics,
};
