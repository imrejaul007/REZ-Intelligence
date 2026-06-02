import mongoose from 'mongoose';
import Redis from 'ioredis';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: { status: string; latency?: number; error?: string };
    redis: { status: string; latency?: number; error?: string };
    memory: { status: string; used: number; total: number };
    cpu: { status: string; load: number };
  };
}

export class HealthCheck {
  private startTime = Date.now();
  private redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  async check(): Promise<HealthCheckResult> {
    const [dbCheck, redisCheck, memCheck] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkMemory(),
    ]);

    const isHealthy =
      dbCheck.status === 'healthy' &&
      redisCheck.status === 'healthy' &&
      memCheck.status === 'healthy';

    const isDegraded =
      dbCheck.status === 'healthy' &&
      redisCheck.status === 'degraded';

    return {
      status: isHealthy ? 'healthy' : isDegraded ? 'degraded' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      checks: {
        database: dbCheck,
        redis: redisCheck,
        memory: memCheck,
        cpu: this.checkCPU(),
      },
    };
  }

  private async checkDatabase(): Promise<{ status: string; latency?: number; error?: string }> {
    const start = Date.now();
    try {
      await mongoose.connection.db?.admin().ping();
      return { status: 'healthy', latency: Date.now() - start };
    } catch (error) {
      return { status: 'unhealthy', error: (error as Error).message };
    }
  }

  private async checkRedis(): Promise<{ status: string; latency?: number; error?: string }> {
    const start = Date.now();
    try {
      await this.redis.ping();
      const latency = Date.now() - start;
      if (latency > 100) return { status: 'degraded', latency };
      return { status: 'healthy', latency };
    } catch (error) {
      return { status: 'unhealthy', error: (error as Error).message };
    }
  }

  private checkMemory(): { status: string; used: number; total: number } {
    const used = process.memoryUsage();
    const total = used.heapTotal;
    const ratio = used.heapUsed / total;

    if (ratio > 0.9) return { status: 'unhealthy', used: used.heapUsed, total };
    if (ratio > 0.7) return { status: 'degraded', used: used.heapUsed, total };
    return { status: 'healthy', used: used.heapUsed, total };
  }

  private checkCPU(): { status: string; load: number } {
    const load = process.cpuUsage().user / 1000000;
    if (load > 80) return { status: 'degraded', load };
    return { status: 'healthy', load };
  }
}

// Express middleware for health endpoint
export function healthCheckEndpoint(app: any, path: string = '/health') {
  const healthCheck = new HealthCheck();

  app.get(path, async (_req: any, res: any) => {
    const result = await healthCheck.check();
    const status = result.status === 'healthy' ? 200 : result.status === 'degraded' ? 200 : 503;
    res.status(status).json(result);
  });

  app.get('/health/live', (_req: any, res: any) => {
    res.json({ status: 'alive' });
  });

  app.get('/health/ready', async (_req: any, res: any) => {
    const result = await healthCheck.check();
    const status = result.status === 'healthy' ? 200 : 503;
    res.status(status).json(result);
  });
}
