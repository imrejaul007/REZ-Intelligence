import { v4 as uuidv4 } from 'uuid';

export type SpanStatus = 'OK' | 'ERROR' | 'UNSET';

export interface SpanEvent {
  name: string;
  timestamp: string;
  attributes?: Record<string, unknown>;
}

export interface SpanLink {
  traceId: string;
  spanId: string;
}

export interface Span {
  id: string;
  traceId: string;
  parentId?: string;
  name: string;
  service: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  status: SpanStatus;
  attributes: Record<string, unknown>;
  events: SpanEvent[];
  links: SpanLink[];
  kind: 'SERVER' | 'CLIENT' | 'PRODUCER' | 'CONSUMER' | 'INTERNAL';
}

export interface Trace {
  id: string;
  traceId: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  spans: Span[];
  serviceCount: number;
  spanCount: number;
  status: SpanStatus;
}

export interface TraceQuery {
  service?: string;
  operationName?: string;
  startTime?: string;
  endTime?: string;
  status?: SpanStatus;
  limit?: number;
  offset?: number;
}

class TraceCollector {
  private spans: Map<string, Span> = new Map();
  private traces: Map<string, Trace> = new Map();
  private readonly maxTraces = 5000;
  private readonly maxSpansPerTrace = 1000;

  private createSpan(
    name: string,
    service: string,
    traceId: string,
    parentId?: string,
    kind: Span['kind'] = 'INTERNAL',
    attributes: Record<string, unknown> = {}
  ): Span {
    const span: Span = {
      id: uuidv4(),
      traceId,
      parentId,
      name,
      service,
      startTime: new Date().toISOString(),
      status: 'UNSET',
      attributes,
      events: [],
      links: [],
      kind
    };

    this.spans.set(span.id, span);
    return span;
  }

  startSpan(
    name: string,
    service: string,
    traceId?: string,
    parentId?: string,
    kind: Span['kind'] = 'INTERNAL',
    attributes: Record<string, unknown> = {}
  ): Span {
    if (!traceId) {
      traceId = uuidv4();
    }
    return this.createSpan(name, service, traceId, parentId, kind, attributes);
  }

  endSpan(spanId: string, status: SpanStatus = 'OK', attributes?: Record<string, unknown>): Span | undefined {
    const span = this.spans.get(spanId);
    if (!span) {
      return undefined;
    }

    span.endTime = new Date().toISOString();
    span.duration = new Date(span.endTime).getTime() - new Date(span.startTime).getTime();
    span.status = status;

    if (attributes) {
      span.attributes = { ...span.attributes, ...attributes };
    }

    this.updateTraceFromSpan(span);
    return span;
  }

  addSpanEvent(spanId: string, name: string, attributes?: Record<string, unknown>): void {
    const span = this.spans.get(spanId);
    if (!span) {
      return;
    }

    span.events.push({
      name,
      timestamp: new Date().toISOString(),
      attributes
    });
  }

  linkSpans(spanId: string, linkedTraceId: string, linkedSpanId: string): void {
    const span = this.spans.get(spanId);
    if (!span) {
      return;
    }

    span.links.push({ traceId: linkedTraceId, spanId: linkedSpanId });
  }

  private updateTraceFromSpan(span: Span): void {
    let trace = this.traces.get(span.traceId);

    if (!trace) {
      trace = {
        id: uuidv4(),
        traceId: span.traceId,
        startTime: span.startTime,
        spans: [],
        serviceCount: 0,
        spanCount: 0,
        status: 'UNSET'
      };
      this.traces.set(span.traceId, trace);

      if (this.traces.size > this.maxTraces) {
        const oldestTraceId = this.traces.keys().next().value;
        if (oldestTraceId) {
          this.traces.delete(oldestTraceId);
        }
      }
    }

    const existingSpanIndex = trace.spans.findIndex(s => s.id === span.id);
    if (existingSpanIndex >= 0) {
      trace.spans[existingSpanIndex] = span;
    } else if (trace.spans.length < this.maxSpansPerTrace) {
      trace.spans.push(span);
    }

    trace.endTime = span.endTime || trace.endTime;
    trace.duration = new Date(trace.endTime!).getTime() - new Date(trace.startTime).getTime();

    const services = new Set(trace.spans.map(s => s.service));
    trace.serviceCount = services.size;
    trace.spanCount = trace.spans.length;

    const hasError = trace.spans.some(s => s.status === 'ERROR');
    trace.status = hasError ? 'ERROR' : trace.spans.every(s => s.status === 'OK') ? 'OK' : 'UNSET';
  }

  getTrace(traceId: string): Trace | undefined {
    return this.traces.get(traceId);
  }

  getSpan(spanId: string): Span | undefined {
    return this.spans.get(spanId);
  }

  queryTraces(query: TraceQuery): { traces: Trace[]; total: number } {
    let filtered = Array.from(this.traces.values());

    if (query.service) {
      filtered = filtered.filter(trace =>
        trace.spans.some(span => span.service === query.service)
      );
    }

    if (query.operationName) {
      filtered = filtered.filter(trace =>
        trace.spans.some(span => span.name === query.operationName)
      );
    }

    if (query.status) {
      filtered = filtered.filter(trace => trace.status === query.status);
    }

    if (query.startTime) {
      const start = new Date(query.startTime).getTime();
      filtered = filtered.filter(trace => new Date(trace.startTime).getTime() >= start);
    }

    if (query.endTime) {
      const end = new Date(query.endTime).getTime();
      filtered = filtered.filter(trace => {
        if (!trace.endTime) return false;
        return new Date(trace.endTime).getTime() <= end;
      });
    }

    const total = filtered.length;
    const offset = query.offset || 0;
    const limit = query.limit || 50;

    filtered = filtered
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(offset, offset + limit);

    return { traces: filtered, total };
  }

  getTraceStats(): {
    totalTraces: number;
    totalSpans: number;
    byStatus: Record<SpanStatus, number>;
    byService: Record<string, number>;
    averageDuration: number;
  } {
    const traces = Array.from(this.traces.values());
    const allSpans = Array.from(this.spans.values());

    const byStatus: Record<SpanStatus, number> = { OK: 0, ERROR: 0, UNSET: 0 };
    const byService: Record<string, number> = {};

    for (const span of allSpans) {
      byStatus[span.status]++;
      byService[span.service] = (byService[span.service] || 0) + 1;
    }

    const durations = traces.filter(t => t.duration).map(t => t.duration!);
    const averageDuration = durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0;

    return {
      totalTraces: traces.length,
      totalSpans: allSpans.length,
      byStatus,
      byService,
      averageDuration
    };
  }
}

export const traces = new TraceCollector();
