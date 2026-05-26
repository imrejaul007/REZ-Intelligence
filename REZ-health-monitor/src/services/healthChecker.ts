import axios, { AxiosError } from 'axios';
import { ServiceHealth, HealthStatus, ServiceConfig, CachedHealthData } from '../types/index.js';
import { logWarn } from './logger.js';

// Cache TTL in milliseconds (30 seconds)
const CACHE_TTL = 30000;

// Health cache
const healthCache = new Map<string, CachedHealthData>();

// Default services to monitor
const DEFAULT_SERVICES: ServiceConfig[] = [
  { name: 'REZ-event-platform', url: 'http://localhost:4008/health' },
  { name: 'REZ-identity-graph', url: 'http://localhost:4050/health' },
  { name: 'REZ-reorder-engine', url: 'http://localhost:4040/health' },
  { name: 'REZ-taste-profile', url: 'http://localhost:4041/health' },
  { name: 'REZ-demand-forecast', url: 'http://localhost:4042/health' },
  { name: 'REZ-price-predictor', url: 'http://localhost:4043/health' },
  { name: 'REZ-memory-engine', url: 'http://localhost:4051/health' },
  { name: 'REZ-ai-router', url: 'http://localhost:4052/health' },
  { name: 'REZ-knowledge-graph', url: 'http://localhost:4060/health' },
  { name: 'REZ-merchant-brain', url: 'http://localhost:4061/health' },
  { name: 'REZ-autonomous-agents', url: 'http://localhost:4062/health' },
  { name: 'REZ-payments-brain', url: 'http://localhost:4070/health' },
  { name: 'REZ-inventory-sync', url: 'http://localhost:4071/health' },
  { name: 'REZ-creator-network', url: 'http://localhost:4072/health' },
  { name: 'REZ-merchant-os', url: 'http://localhost:4073/health' },
  { name: 'REZ-feedback-collector', url: 'http://localhost:4085/health' },
  { name: 'REZ-unified-recommendations', url: 'http://localhost:4090/health' },
  { name: 'REZ-integration-sdk', url: 'http://localhost:4091/health' },
  { name: 'REZ-identity-bridge', url: 'http://localhost:4092/health' },
  { name: 'REZ-notification-router', url: 'http://localhost:4093/health' },
  { name: 'REZ-realtime-gateway', url: 'http://localhost:4094/health' },
  { name: 'REZ-validation-dashboard', url: 'http://localhost:4100/health' },
  { name: 'REZ-flywheel-mvp', url: 'http://localhost:4101/health' },
];

// Get configured services
export function getServices(): ServiceConfig[] {
  const configEnv = process.env.SERVICES_CONFIG;

  if (configEnv) {
    try {
      const services: ServiceConfig[] = configEnv.split(',').map((entry) => {
        const [name, url] = entry.split(':');
        if (!name || !url) {
          throw new Error(`Invalid service config: ${entry}`);
        }
        return { name: name.trim(), url: url.trim() };
      });
      return services;
    } catch (error) {
      logWarn('Failed to parse SERVICES_CONFIG, using defaults', {
        error: (error as Error).message,
      });
    }
  }

  return DEFAULT_SERVICES;
}

// Determine health status from error
function getStatusFromError(error: AxiosError): HealthStatus {
  if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
    return 'down';
  }
  return 'degraded';
}

// Check a single service health
export async function checkService(service: ServiceConfig): Promise<ServiceHealth> {
  const cacheKey = service.name;
  const cached = healthCache.get(cacheKey);

  // Return cached data if still valid
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const startTime = Date.now();

  try {
    const response = await axios.get(service.url, { timeout: 5000 });
    const latency = Date.now() - startTime;

    const data: ServiceHealth = {
      name: service.name,
      status: 'healthy',
      latency,
      uptime: response.data?.uptime || null,
      timestamp: new Date().toISOString(),
    };

    healthCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch (error) {
    const axiosError = error as AxiosError;
    const latency = Date.now() - startTime;

    logWarn(`Service health check failed: ${service.name}`, {
      error: axiosError.message,
      code: axiosError.code,
    });

    const data: ServiceHealth = {
      name: service.name,
      status: getStatusFromError(axiosError),
      latency,
      error: axiosError.message,
      timestamp: new Date().toISOString(),
    };

    healthCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }
}

// Check all services
export async function checkAllServices(): Promise<ServiceHealth[]> {
  const services = getServices();
  const results = await Promise.allSettled(services.map((service) => checkService(service)));

  return results
    .filter((result): result is PromiseFulfilledResult<ServiceHealth> => result.status === 'fulfilled')
    .map((result) => result.value);
}

// Clear health cache
export function clearCache(): void {
  healthCache.clear();
}
