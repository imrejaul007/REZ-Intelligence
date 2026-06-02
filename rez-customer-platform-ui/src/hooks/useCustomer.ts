import { useState, useEffect, useCallback } from 'react';
import type { Customer, Segment, Prediction, Order, SearchFilters, PaginatedResponse, InsightData } from '../types';
import { mockApi } from '../services/api';

interface UseCustomerResult {
  customer: Customer | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useCustomer(id: string | null): UseCustomerResult {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCustomer = useCallback(async () => {
    if (!id) {
      setCustomer(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await mockApi.getCustomer(id);
      setCustomer(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch customer'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCustomer();
  }, [fetchCustomer]);

  return { customer, loading, error, refetch: fetchCustomer };
}

interface UseSegmentsResult {
  segments: Segment[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useSegments(): UseSegmentsResult {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSegments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await mockApi.getSegments();
      setSegments(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch segments'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSegments();
  }, [fetchSegments]);

  return { segments, loading, error, refetch: fetchSegments };
}

interface UseSegmentResult {
  segment: Segment | null;
  customers: Customer[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useSegment(id: string | null): UseSegmentResult {
  const [segment, setSegment] = useState<Segment | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSegment = useCallback(async () => {
    if (!id) {
      setSegment(null);
      setCustomers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [segmentData, customersData] = await Promise.all([
        mockApi.getSegment(id),
        mockApi.getSegmentCustomers(id),
      ]);
      setSegment(segmentData);
      setCustomers(customersData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch segment'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSegment();
  }, [fetchSegment]);

  return { segment, customers, loading, error, refetch: fetchSegment };
}

interface UsePredictionsResult {
  predictions: Prediction | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function usePredictions(customerId: string | null): UsePredictionsResult {
  const [predictions, setPredictions] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPredictions = useCallback(async () => {
    if (!customerId) {
      setPredictions(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await mockApi.getPredictions(customerId);
      setPredictions(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch predictions'));
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchPredictions();
  }, [fetchPredictions]);

  return { predictions, loading, error, refetch: fetchPredictions };
}

interface UseSearchResult {
  customers: Customer[];
  total: number;
  page: number;
  totalPages: number;
  loading: boolean;
  error: Error | null;
  search: (filters: SearchFilters, page?: number) => void;
  setPage: (page: number) => void;
  currentFilters: SearchFilters;
}

export function useSearch(): UseSearchResult {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPageState] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [currentFilters, setCurrentFilters] = useState<SearchFilters>({});

  const search = useCallback(async (filters: SearchFilters, searchPage = 1) => {
    setLoading(true);
    setError(null);
    setCurrentFilters(filters);
    try {
      const result = await mockApi.searchCustomers(filters, searchPage, 20);
      setCustomers(result.data);
      setTotal(result.total);
      setPageState(result.page);
      setTotalPages(result.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Search failed'));
    } finally {
      setLoading(false);
    }
  }, []);

  const setPage = useCallback((newPage: number) => {
    search(currentFilters, newPage);
  }, [search, currentFilters]);

  useEffect(() => {
    search({});
  }, [search]);

  return {
    customers,
    total,
    page,
    totalPages,
    loading,
    error,
    search,
    setPage,
    currentFilters,
  };
}

interface UseCustomerOrdersResult {
  orders: Order[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useCustomerOrders(customerId: string | null): UseCustomerOrdersResult {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!customerId) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await mockApi.getCustomerOrders(customerId);
      setOrders(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch orders'));
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return { orders, loading, error, refetch: fetchOrders };
}

interface UseCustomerActivityResult {
  activity: { date: string; type: string; description: string }[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useCustomerActivity(customerId: string | null): UseCustomerActivityResult {
  const [activity, setActivity] = useState<{ date: string; type: string; description: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchActivity = useCallback(async () => {
    if (!customerId) {
      setActivity([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await mockApi.getCustomerActivity(customerId);
      setActivity(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch activity'));
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  return { activity, loading, error, refetch: fetchActivity };
}

interface UseInsightsResult {
  insights: InsightData | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useInsights(): UseInsightsResult {
  const [insights, setInsights] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await mockApi.getInsights();
      setInsights(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch insights'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  return { insights, loading, error, refetch: fetchInsights };
}
