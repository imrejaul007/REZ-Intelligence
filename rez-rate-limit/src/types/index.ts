export interface RateLimitConfig {
  windowSizeMs: number;
  maxRequests: number;
  burstLimit?: number;
  burstWindowMs?: number;
}

export interface RateLimitKey {
  type: 'user' | 'ip' | 'endpoint';
  identifier: string;
  endpoint?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterMs?: number;
}

export interface SlidingWindowRecord {
  timestamp: number;
  count: number;
}

export interface EndpointLimit {
  endpoint: string;
  windowSizeMs: number;
  maxRequests: number;
}

export interface UserLimit {
  userId: string;
  windowSizeMs: number;
  maxRequests: number;
  burstLimit?: number;
}

export interface IpLimit {
  ip: string;
  windowSizeMs: number;
  maxRequests: number;
  burstLimit?: number;
}

export interface GlobalConfig {
  defaultWindowMs: number;
  defaultMaxRequests: number;
  defaultBurstLimit?: number;
  defaultBurstWindowMs?: number;
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
}

export interface RateLimitResponse {
  success: boolean;
  data?: RateLimitResult;
  error?: string;
}

export interface ManagementStats {
  totalRequests: number;
  allowedRequests: number;
  blockedRequests: number;
  byUser: Map<string, number>;
  byIp: Map<string, number>;
  byEndpoint: Map<string, number>;
}
