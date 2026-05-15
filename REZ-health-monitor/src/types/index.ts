// Service health status types
export type HealthStatus = 'healthy' | 'degraded' | 'down';

export interface ServiceHealth {
  name: string;
  status: HealthStatus;
  latency?: number;
  uptime?: number;
  timestamp: string;
  error?: string;
}

export interface HealthSummary {
  total: number;
  healthy: number;
  degraded: number;
  down: number;
  overallStatus: HealthStatus;
}

export interface HealthCheckResponse {
  success: boolean;
  timestamp: string;
  summary: HealthSummary;
  services: ServiceHealth[];
}

export interface SingleServiceHealthResponse {
  success: boolean;
  name: string;
  status: HealthStatus;
  latency?: number;
  uptime?: number;
  timestamp: string;
  error?: string;
}

export interface HealthCheckRequest {
  serviceName?: string;
}

export interface CachedHealthData {
  data: ServiceHealth;
  timestamp: number;
}

// Service configuration
export interface ServiceConfig {
  name: string;
  url: string;
}

// Dashboard HTML
export interface DashboardContext {
  services: ServiceHealth[];
  summary: HealthSummary;
}

// API Response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
