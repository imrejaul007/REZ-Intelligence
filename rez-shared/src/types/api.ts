/**
 * Canonical API response types for all REZ apps.
 *
 * These types are a superset of both merchant and admin app formats.
 * Backend may return either nested or flat pagination — consumers should
 * handle both via the helper functions below.
 */

// ── Pagination ──────────────────────────────────────────────────────────────

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext?: boolean;
  hasPrev?: boolean;
}

// ── API Response ────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  timestamp?: string;
  /** Flat pagination (admin-style) — some endpoints return this at the top level */
  pagination?: Pagination;
}

// ── Paginated Response ──────────────────────────────────────────────────────

/**
 * Paginated response with nested data.items[] (merchant-style).
 * Some endpoints return this shape; others return flat ApiResponse with pagination.
 */
export interface PaginatedResponse<T = unknown> {
  success: boolean;
  message?: string;
  data: {
    items: T[];
    pagination: Pagination;
  };
}

// ── API Error ───────────────────────────────────────────────────────────────

export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
  statusCode?: number;
  timestamp?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Extract items array from either response format */
export function getItems<T>(response: PaginatedResponse<T> | ApiResponse<T[]>): T[] {
  if ('data' in response && response.data) {
    // Nested format: { data: { items: [...], pagination } }
    if (typeof response.data === 'object' && 'items' in (response.data as any)) {
      return (response.data as any).items;
    }
    // Flat format: { data: [...], pagination }
    if (Array.isArray(response.data)) {
      return response.data;
    }
  }
  return [];
}

/** Extract pagination from either response format */
export function getPagination(response: PaginatedResponse<any> | ApiResponse<any>): Pagination | null {
  if ('data' in response && response.data && typeof response.data === 'object' && 'pagination' in (response.data as any)) {
    return (response.data as any).pagination;
  }
  if ('pagination' in response && response.pagination) {
    return response.pagination;
  }
  return null;
}
