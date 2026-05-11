import client, { Registry, Counter, Histogram, Gauge } from 'prom-client';
import { v4 as uuidv4 } from 'uuid';

export interface MetricDataPoint {
  timestamp: string;
  value: number;
  labels?: Record<string, string>;
}

export interface TimeSeriesMetric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram';
  description: string;
  labels: string[];
  dataPoints: MetricDataPoint[];
}

class MetricsCollector {
  private registry: Registry;
  private counters: Map<string, Counter<string>> = new Map();
  private gauges: Map<string, Gauge<string>> = new Map();
  private histograms: Map<string, Histogram<string>> = new Map();
  private timeSeriesData: Map<string, MetricDataPoint[]> = new Map();
  private readonly maxDataPoints = 1000;

  constructor() {
    this.registry = new Registry();
    client.collectDefaultMetrics({ register: this.registry });
  }

  getRegistry(): Registry {
    return this.registry;
  }

  createCounter(name: string, help: string, labelNames: string[] = []): Counter<string> {
    if (this.counters.has(name)) {
      return this.counters.get(name)!;
    }
    const counter = new Counter({ name, help, labelNames, registers: [this.registry] });
    this.counters.set(name, counter);
    this.timeSeriesData.set(name, []);
    return counter;
  }

  createGauge(name: string, help: string, labelNames: string[] = []): Gauge<string> {
    if (this.gauges.has(name)) {
      return this.gauges.get(name)!;
    }
    const gauge = new Gauge({ name, help, labelNames, registers: [this.registry] });
    this.gauges.set(name, gauge);
    this.timeSeriesData.set(name, []);
    return gauge;
  }

  createHistogram(name: string, help: string, buckets: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10], labelNames: string[] = []): Histogram<string> {
    if (this.histograms.has(name)) {
      return this.histograms.get(name)!;
    }
    const histogram = new Histogram({ name, help, buckets, labelNames, registers: [this.registry] });
    this.histograms.set(name, histogram);
    this.timeSeriesData.set(name, []);
    return histogram;
  }

  incrementCounter(name: string, labels: Record<string, string> = {}): void {
    const counter = this.counters.get(name);
    if (counter) {
      counter.inc(labels);
      this.recordTimeSeries(name, counter.collect().reduce((acc: number, m) => {
        if (m.values.length > 0) {
          return acc + m.values[0].value;
        }
        return acc;
      }, 0), labels);
    }
  }

  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const gauge = this.gauges.get(name);
    if (gauge) {
      gauge.set(labels, value);
      this.recordTimeSeries(name, value, labels);
    }
  }

  observeHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
    const histogram = this.histograms.get(name);
    if (histogram) {
      histogram.observe(labels, value);
      this.recordTimeSeries(name, value, labels);
    }
  }

  private recordTimeSeries(name: string, value: number, labels?: Record<string, string>): void {
    const dataPoints = this.timeSeriesData.get(name) || [];
    dataPoints.push({
      timestamp: new Date().toISOString(),
      value,
      labels
    });
    if (dataPoints.length > this.maxDataPoints) {
      dataPoints.shift();
    }
    this.timeSeriesData.set(name, dataPoints);
  }

  getTimeSeries(name: string, startTime?: string, endTime?: string): MetricDataPoint[] {
    let dataPoints = this.timeSeriesData.get(name) || [];

    if (startTime) {
      const start = new Date(startTime).getTime();
      dataPoints = dataPoints.filter(dp => new Date(dp.timestamp).getTime() >= start);
    }

    if (endTime) {
      const end = new Date(endTime).getTime();
      dataPoints = dataPoints.filter(dp => new Date(dp.timestamp).getTime() <= end);
    }

    return dataPoints;
  }

  getAllTimeSeries(): TimeSeriesMetric[] {
    const metrics: TimeSeriesMetric[] = [];

    this.counters.forEach((counter, name) => {
      metrics.push({
        name,
        type: 'counter',
        description: counter.describe().toString(),
        labels: counter.labelNames,
        dataPoints: this.timeSeriesData.get(name) || []
      });
    });

    this.gauges.forEach((gauge, name) => {
      metrics.push({
        name,
        type: 'gauge',
        description: gauge.describe().toString(),
        labels: gauge.labelNames,
        dataPoints: this.timeSeriesData.get(name) || []
      });
    });

    this.histograms.forEach((histogram, name) => {
      metrics.push({
        name,
        type: 'histogram',
        description: histogram.describe().toString(),
        labels: histogram.labelNames,
        dataPoints: this.timeSeriesData.get(name) || []
      });
    });

    return metrics;
  }

  async getPrometheusMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getMetricsSummary(): {
    counters: string[];
    gauges: string[];
    histograms: string[];
    totalTimeSeriesPoints: number;
  } {
    return {
      counters: Array.from(this.counters.keys()),
      gauges: Array.from(this.gauges.keys()),
      histograms: Array.from(this.histograms.keys()),
      totalTimeSeriesPoints: Array.from(this.timeSeriesData.values()).reduce((sum, dp) => sum + dp.length, 0)
    };
  }
}

export const metrics = new MetricsCollector();

// Initialize standard metrics
metrics.createCounter('http_requests_total', 'Total HTTP requests', ['method', 'route', 'status']);
metrics.createCounter('errors_total', 'Total errors', ['service', 'type']);
metrics.createGauge('active_connections', 'Number of active connections', ['service']);
metrics.createHistogram('http_request_duration_seconds', 'HTTP request duration in seconds', [0.01, 0.05, 0.1, 0.5, 1, 2, 5], ['method', 'route']);
metrics.createGauge('memory_usage_bytes', 'Memory usage in bytes', ['service']);
