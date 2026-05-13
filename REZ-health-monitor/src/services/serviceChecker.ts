/**
 * Service Checker
 * Checks the health of individual services with circuit breaker integration
 */

import axios, { AxiosError } from 'axios';
import { getHealthMonitorConfig, ServiceConfig } from '../config/index.js';
import {
  CircuitBreaker,
  CircuitState,
  getCircuitBreakerRegistry,
} from './circuitBreaker.js';
import { sendAlert } from './alertService.js';

export interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  latency: number | null;
  uptime: number | null;
  error: string | null;
  timestamp: string;
  circuitState: CircuitState;
  dependencies?: Record<string, string>;
  version?: string;
}

export interface DetailedHealthResult extends HealthCheckResult {
  url: string;
  category: string;
  consecutiveFailures: number;
  lastSuccess: string | null;
  lastFailure: string | null;
}

export class ServiceChecker {
  private readonly config = getHealthMonitorConfig();
  private readonly circuitRegistry = getCircuitBreakerRegistry();
  private healthCache: Map<string, { data: HealthCheckResult; timestamp: number }> = new Map();
  private lastAlertSent: Map<string, Date> = new Map();

  /**
   * Check a single service's health
   */
  async checkService(service: ServiceConfig): Promise<HealthCheckResult> {
    const circuit = this.circuitRegistry.getCircuit(service.name);

    // Check circuit breaker state
    if (!circuit.canExecute()) {
      return {
        name: service.name,
        status: 'down',
        latency: null,
        uptime: null,
        error: `Circuit breaker is ${circuit.getState()}`,
        timestamp: new Date().toISOString(),
        circuitState: circuit.getState(),
      };
    }

    const startTime = Date.now();

    try {
      const response = await axios.get(service.url, {
        timeout: this.config.healthCheck.timeoutMs,
        validateStatus: (status) => status < 500,
      });

      const latency = Date.now() - startTime;

      // Determine health status from response
      let status: 'healthy' | 'degraded' | 'unknown' = 'healthy';
      if (response.data?.status === 'degraded') {
        status = 'degraded';
      } else if (response.data?.status === 'unhealthy') {
        status = 'degraded';
      }

      circuit.recordSuccess();

      const result: HealthCheckResult = {
        name: service.name,
        status,
        latency,
        uptime: response.data?.uptime || null,
        error: null,
        timestamp: new Date().toISOString(),
        circuitState: circuit.getState(),
        dependencies: response.data?.dependencies,
        version: response.data?.version || response.data?.service,
      };

      // Clear any cached error
      this.healthCache.set(service.name, { data: result, timestamp: Date.now() });

      return result;

    } catch (error) {
      const latency = Date.now() - startTime;
      circuit.recordFailure();

      const errorMessage = this.extractErrorMessage(error as AxiosError);
      const status = this.determineStatus(error as AxiosError);

      const result: HealthCheckResult = {
        name: service.name,
        status,
        latency,
        uptime: null,
        error: errorMessage,
        timestamp: new Date().toISOString(),
        circuitState: circuit.getState(),
      };

      // Cache the failed result
      this.healthCache.set(service.name, { data: result, timestamp: Date.now() });

      // Check if we need to send an alert
      this.checkAndSendAlert(service, result);

      return result;
    }
  }

  /**
   * Check all configured services
   */
  async checkAllServices(services: ServiceConfig[]): Promise<HealthCheckResult[]> {
    const results = await Promise.allSettled(
      services.map(service => this.checkService(service))
    );

    return results
      .filter((result): result is PromiseFulfilledResult<HealthCheckResult> => result.status === 'fulfilled')
      .map(result => result.value);
  }

  /**
   * Get detailed health information for a service
   */
  async getDetailedHealth(service: ServiceConfig): Promise<DetailedHealthResult> {
    const basicResult = await this.checkService(service);
    const circuit = this.circuitRegistry.getCircuit(service.name);
    const stats = circuit.getStats();

    return {
      ...basicResult,
      url: service.url,
      category: service.category || 'unknown',
      consecutiveFailures: stats.consecutiveFailures,
      lastSuccess: stats.lastSuccess,
      lastFailure: stats.lastFailure,
    };
  }

  /**
   * Get cached health result if available and fresh
   */
  getCachedHealth(serviceName: string): HealthCheckResult | null {
    const cached = this.healthCache.get(serviceName);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > this.config.cache.ttlMs) {
      return null; // Cache expired
    }

    return cached.data;
  }

  /**
   * Get summary statistics
   */
  getSummary(services: ServiceConfig[]): {
    total: number;
    healthy: number;
    degraded: number;
    down: number;
    overallStatus: 'healthy' | 'degraded' | 'down';
    unavailableServices: string[];
  } {
    const results: HealthCheckResult[] = services.map(s => {
      const cached = this.getCachedHealth(s.name);
      return cached || {
        name: s.name,
        status: 'unknown' as const,
        latency: null,
        uptime: null,
        error: null,
        timestamp: new Date().toISOString(),
        circuitState: CircuitState.CLOSED,
      };
    });

    const healthy = results.filter(r => r.status === 'healthy').length;
    const degraded = results.filter(r => r.status === 'degraded').length;
    const down = results.filter(r => r.status === 'down').length;
    const unavailableServices = this.circuitRegistry.getUnavailableServices();

    let overallStatus: 'healthy' | 'degraded' | 'down' = 'healthy';
    if (down > 0) {
      overallStatus = 'down';
    } else if (degraded > 0) {
      overallStatus = 'degraded';
    }

    return {
      total: services.length,
      healthy,
      degraded,
      down,
      overallStatus,
      unavailableServices,
    };
  }

  /**
   * Clear health cache
   */
  clearCache(): void {
    this.healthCache.clear();
  }

  private extractErrorMessage(error: AxiosError): string {
    if (error.code === 'ECONNREFUSED') {
      return 'Connection refused - service may be down';
    }
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      return 'Request timed out - service may be unresponsive';
    }
    if (error.code === 'ENOTFOUND') {
      return 'Service not found - DNS resolution failed';
    }
    if (error.response) {
      return `HTTP ${error.response.status}: ${error.response.statusText}`;
    }
    return error.message || 'Unknown error';
  }

  private determineStatus(error: AxiosError): 'down' | 'degraded' {
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return 'down';
    }
    return 'degraded';
  }

  private checkAndSendAlert(service: ServiceConfig, result: HealthCheckResult): void {
    // Only alert for circuit breaker openings or prolonged failures
    if (result.circuitState !== CircuitState.OPEN) {
      return;
    }

    const lastAlert = this.lastAlertSent.get(service.name);
    const alertThresholdMs = this.config.alert.thresholdMinutes * 60 * 1000;

    if (lastAlert && Date.now() - lastAlert.getTime() < alertThresholdMs) {
      return; // Don't spam alerts
    }

    this.lastAlertSent.set(service.name, new Date());

    sendAlert({
      serviceName: service.name,
      status: result.status,
      error: result.error,
      circuitState: result.circuitState,
      timestamp: result.timestamp,
    }).catch(err => {
      console.error('Failed to send alert:', err);
    });
  }
}

// Singleton instance
let checkerInstance: ServiceChecker | null = null;

export function getServiceChecker(): ServiceChecker {
  if (!checkerInstance) {
    checkerInstance = new ServiceChecker();
  }
  return checkerInstance;
}
