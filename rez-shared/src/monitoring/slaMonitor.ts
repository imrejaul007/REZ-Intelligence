interface SLAConfig {
  name: string;
  targetLatency: number; // ms
  targetAvailability: number; // 0-1
  windowMs: number;
}

interface SLAMetrics {
  name: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  availability: number;
  compliance: boolean;
}

class SLAMonitor {
  private configs: SLAConfig[] = [];
  private metrics: Map<string, { latencies: number[]; success: number; total: number }> = new Map();

  register(config: SLAConfig): void {
    this.configs.push(config);
    this.metrics.set(config.name, { latencies: [], success: 0, total: 0 });
  }

  record(name: string, latency: number, success: boolean): void {
    const metric = this.metrics.get(name);
    if (!metric) return;

    metric.latencies.push(latency);
    metric.total++;
    if (success) metric.success++;

    // Keep only last 10000 latencies
    if (metric.latencies.length > 10000) {
      metric.latencies.shift();
    }
  }

  getMetrics(name: string): SLAMetrics | null {
    const config = this.configs.find(c => c.name === name);
    const metric = this.metrics.get(name);
    if (!config || !metric) return null;

    const latencies = [...metric.latencies].sort((a, b) => a - b);

    return {
      name,
      totalRequests: metric.total,
      successfulRequests: metric.success,
      failedRequests: metric.total - metric.success,
      latencyP50: percentile(latencies, 50),
      latencyP95: percentile(latencies, 95),
      latencyP99: percentile(latencies, 99),
      availability: metric.total > 0 ? metric.success / metric.total : 1,
      compliance: this.checkCompliance(config, metric),
    };
  }

  private checkCompliance(config: SLAConfig, metric: typeof this.metrics extends Map<string, infer V> ? V : never): boolean {
    const availability = metric.total > 0 ? metric.success / metric.total : 1;
    const latencyP95 = percentile([...metric.latencies].sort((a, b) => a - b), 95);

    return availability >= config.targetAvailability && latencyP95 <= config.targetLatency;
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

export const slaMonitor = new SLAMonitor();
