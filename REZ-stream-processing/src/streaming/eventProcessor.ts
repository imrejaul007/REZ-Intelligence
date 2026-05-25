/**
 * REZ Stream Processing - Event Processor
 * Core stream processing logic for real-time event handling
 */

import mongoose, { Schema, Document } from 'mongoose';
import { kafkaService } from '../kafka/kafkaService.js';
import { logger } from '../utils/logger.js';
import {
  StreamEvent,
  StreamEventType,
  AggregationWindow,
  AggregationResult
} from '../types/index.js';

export interface StreamProcessorConfig {
  name: string;
  inputTopics: string[];
  outputTopic?: string;
  transformations: TransformationType[];
}

export type TransformationType =
  | 'identity'      // No transformation
  | 'filter'         // Filter events
  | 'map'            // Transform event shape
  | 'enrich'         // Add external data
  | 'aggregate'      // Window aggregation
  | 'fanout';        // Split to multiple outputs

export interface ProcessedEvent {
  originalEvent: StreamEvent;
  transformedData: Record<string, unknown>;
  metadata: {
    processedAt: Date;
    processor: string;
    transformations: string[];
  };
}

// Mongoose model for storing processed events
export interface IStreamEventDocument extends Document {
  eventId: string;
  eventType: string;
  source: string;
  timestamp: Date;
  data: Record<string, unknown>;
  metadata: Record<string, unknown>;
  processedAt: Date;
}

const streamEventSchema = new Schema<IStreamEventDocument>({
  eventId: { type: String, required: true, index: true },
  eventType: { type: String, required: true, index: true },
  source: { type: String, required: true, index: true },
  timestamp: { type: Date, required: true, index: true },
  data: { type: Schema.Types.Mixed, required: true },
  metadata: { type: Schema.Types.Mixed },
  processedAt: { type: Date, default: Date.now, index: true }
});

streamEventSchema.index({ eventType: 1, timestamp: -1 });
streamEventSchema.index({ source: 1, timestamp: -1 });

let StreamEventModel: mongoose.Model<IStreamEventDocument>;

export class EventProcessor {
  private processors: Map<string, StreamProcessorConfig> = new Map();
  private aggregationWindows: Map<string, AggregationWindow> = new Map();
  private windowData: Map<string, Map<string, StreamEvent[]>> = new Map();

  /**
   * Initialize MongoDB connection for event storage
   */
  async connectToMongo(uri: string): Promise<void> {
    try {
      await mongoose.connect(uri);
      StreamEventModel = mongoose.model<IStreamEventDocument>('StreamEvent', streamEventSchema);
      logger.info('Stream processor connected to MongoDB');
    } catch (error) {
      logger.error('MongoDB connection failed', { error });
      throw error;
    }
  }

  /**
   * Register a stream processor
   */
  registerProcessor(config: StreamProcessorConfig): void {
    this.processors.set(config.name, config);
    logger.info('Processor registered', { name: config.name, topics: config.inputTopics });
  }

  /**
   * Start processing events from Kafka
   */
  async startProcessing(): Promise<void> {
    const allTopics = new Set<string>();
    this.processors.forEach(p => {
      p.inputTopics.forEach(t => allTopics.add(t));
    });

    if (allTopics.size === 0) {
      logger.warn('No topics configured for processing');
      return;
    }

    const topics = Array.from(allTopics);
    await kafkaService.createConsumer('rez-stream-processor', topics);

    await kafkaService.startConsumer(async (topic: string, message: Record<string, unknown>) => {
      await this.handleMessage(topic, message);
    });

    logger.info('Stream processing started', { topics });
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(topic: string, message: Record<string, unknown>): Promise<void> {
    const startTime = Date.now();

    try {
      // Find matching processors
      const matchingProcessors = Array.from(this.processors.values())
        .filter(p => p.inputTopics.includes(topic));

      for (const processor of matchingProcessors) {
        await this.processWith(processor, message);
      }

      // Store event if model available
      if (StreamEventModel && message.eventId) {
        await this.storeEvent(message);
      }

      logger.debug('Message processed', {
        topic,
        processorCount: matchingProcessors.length,
        durationMs: Date.now() - startTime
      });
    } catch (error) {
      logger.error('Message handling failed', { topic, error });
    }
  }

  /**
   * Process message with specific processor
   */
  private async processWith(
    processor: StreamProcessorConfig,
    message: Record<string, unknown>
  ): Promise<ProcessedEvent | null> {
    const event: StreamEvent = {
      id: (message.eventId || message.id || `evt_${Date.now()}`) as string,
      type: (message.eventType || message.type || 'unknown') as StreamEventType,
      source: (message.source || 'unknown') as string,
      timestamp: new Date(message.timestamp || Date.now()),
      data: (message.data || message) as Record<string, unknown>,
      metadata: message.metadata as Record<string, unknown> | undefined
    };

    let transformedData = event.data;
    const appliedTransformations: string[] = [];

    for (const transformation of processor.transformations) {
      switch (transformation) {
        case 'identity':
          appliedTransformations.push('identity');
          break;

        case 'filter':
          // Filter out test events
          if (event.source === 'test' || event.data.isTest === true) {
            logger.debug('Event filtered', { eventId: event.id });
            return null;
          }
          appliedTransformations.push('filter');
          break;

        case 'map':
          transformedData = this.mapEvent(event);
          appliedTransformations.push('map');
          break;

        case 'enrich':
          transformedData = await this.enrichEvent(transformedData);
          appliedTransformations.push('enrich');
          break;

        case 'aggregate':
          await this.aggregateEvent(event, processor.name);
          appliedTransformations.push('aggregate');
          break;

        case 'fanout':
          await this.fanoutEvent(event, processor);
          appliedTransformations.push('fanout');
          break;
      }
    }

    // Send to output topic if configured
    if (processor.outputTopic) {
      await kafkaService.send(processor.outputTopic, {
        value: {
          originalEvent: event,
          transformedData,
          metadata: {
            processedAt: new Date().toISOString(),
            processor: processor.name,
            transformations: appliedTransformations
          }
        }
      });
    }

    return {
      originalEvent: event,
      transformedData,
      metadata: {
        processedAt: new Date(),
        processor: processor.name,
        transformations: appliedTransformations
      }
    };
  }

  /**
   * Map event to standardized format
   */
  private mapEvent(event: StreamEvent): Record<string, unknown> {
    return {
      eventId: event.id,
      eventType: event.type,
      source: event.source,
      timestamp: event.timestamp.toISOString(),
      ...event.data,
      _normalized: true
    };
  }

  /**
   * Enrich event with additional data
   */
  private async enrichEvent(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    // Add processing timestamp
    const enriched = {
      ...data,
      _enriched: true,
      _processedAt: new Date().toISOString(),
      _timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };

    // Add user context if userId present
    if (data.userId) {
      enriched._hasUserContext = true;
    }

    // Add location context if coordinates present
    if (data.latitude && data.longitude) {
      enriched._hasLocationContext = true;
    }

    return enriched;
  }

  // ============================================
  // AGGREGATION
  // ============================================

  /**
   * Define aggregation window
   */
  defineWindow(windowId: string, config: AggregationWindow): void {
    this.aggregationWindows.set(windowId, config);
    this.windowData.set(windowId, new Map());
    logger.info('Aggregation window defined', { windowId, config });
  }

  /**
   * Aggregate event into window
   */
  private async aggregateEvent(event: StreamEvent, windowId: string): Promise<void> {
    const window = this.aggregationWindows.get(windowId);
    if (!window) return;

    const windows = this.windowData.get(windowId)!;
    const now = Date.now();
    const windowStart = this.getWindowStart(now, window);

    // Find matching window key
    let windowKey: string | null = null;
    for (const [key, start] of windows.entries()) {
      if (Math.abs(start - windowStart) < window.sizeMs) {
        windowKey = key;
        break;
      }
    }

    if (!windowKey) {
      windowKey = `${windowStart}_${now}`;
      windows.set(windowKey, []);
    }

    const events = windows.get(windowKey)!;
    events.push(event);

    // Clean up old windows
    this.cleanupWindows(windowId);
  }

  /**
   * Get window start time
   */
  private getWindowStart(timestamp: number, window: AggregationWindow): number {
    const windowMs = window.sizeMs;

    switch (window.type) {
      case 'tumbling':
        return Math.floor(timestamp / windowMs) * windowMs;

      case 'sliding':
        return Math.floor(timestamp / (window.slideMs || windowMs)) * (window.slideMs || windowMs);

      case 'session':
        // Session windows use activity to determine boundaries
        return timestamp - (timestamp % windowMs);

      default:
        return Math.floor(timestamp / windowMs) * windowMs;
    }
  }

  /**
   * Get aggregation results
   */
  getAggregation(windowId: string, windowKey: string): AggregationResult | null {
    const window = this.aggregationWindows.get(windowId);
    const windows = this.windowData.get(windowId);

    if (!window || !windows) return null;

    const events = windows.get(windowKey);
    if (!events || events.length === 0) return null;

    const metrics: Record<string, number | string> = {};

    // Count by type
    const typeCounts: Record<string, number> = {};
    for (const event of events) {
      typeCounts[event.type] = (typeCounts[event.type] || 0) + 1;
    }
    metrics.typeCounts = JSON.stringify(typeCounts);

    // Sum values if numeric field present
    const valueField = 'amount' || 'value';
    let sum = 0;
    let count = 0;
    for (const event of events) {
      const value = event.data[valueField];
      if (typeof value === 'number') {
        sum += value;
        count++;
      }
    }
    if (count > 0) {
      metrics.sum = sum;
      metrics.avg = sum / count;
    }

    return {
      windowId,
      startTime: new Date(parseInt(windowKey.split('_')[0])),
      endTime: new Date(),
      metrics,
      count: events.length
    };
  }

  /**
   * Cleanup old windows
   */
  private cleanupWindows(windowId: string): void {
    const window = this.aggregationWindows.get(windowId);
    const windows = this.windowData.get(windowId);
    if (!window || !windows) return;

    const cutoff = Date.now() - (window.sizeMs * 3); // Keep 3 windows of data

    for (const [key, start] of windows.entries()) {
      if (start < cutoff) {
        windows.delete(key);
      }
    }
  }

  // ============================================
  // FANOUT
  // ============================================

  /**
   * Fanout event to multiple topics
   */
  private async fanoutEvent(event: StreamEvent, processor: StreamProcessorConfig): Promise<void> {
    if (!processor.outputTopic) return;

    // Extract subtopics from event data
    const categories = event.data.categories as string[] | undefined;
    const regions = event.data.regions as string[] | undefined;

    const fanoutTopics: string[] = [];

    if (categories && categories.length > 0) {
      categories.forEach(cat => {
        fanoutTopics.push(`${processor.outputTopic}.${cat}`);
      });
    }

    if (regions && regions.length > 0) {
      regions.forEach(region => {
        fanoutTopics.push(`${processor.outputTopic}.${region}`);
      });
    }

    // Send to all fanout topics
    for (const topic of fanoutTopics) {
      await kafkaService.send(topic, {
        value: {
          ...event.data,
          _fanoutFrom: processor.outputTopic,
          _fanoutTime: new Date().toISOString()
        }
      });
    }

    if (fanoutTopics.length > 0) {
      logger.debug('Event fanned out', {
        originalTopic: processor.outputTopic,
        fanoutCount: fanoutTopics.length
      });
    }
  }

  // ============================================
  // STORAGE
  // ============================================

  /**
   * Store event in MongoDB
   */
  private async storeEvent(message: Record<string, unknown>): Promise<void> {
    try {
      const doc = new StreamEventModel({
        eventId: message.eventId || message.id,
        eventType: message.eventType || message.type,
        source: message.source,
        timestamp: new Date(message.timestamp || Date.now()),
        data: message.data || message,
        metadata: message.metadata,
        processedAt: new Date()
      });

      await doc.save();
    } catch (error) {
      logger.error('Event storage failed', { error });
    }
  }

  /**
   * Get recent events
   */
  async getRecentEvents(
    eventType?: string,
    limit = 100
  ): Promise<IStreamEventDocument[]> {
    if (!StreamEventModel) return [];

    const query = eventType ? { eventType } : {};
    return StreamEventModel.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  }

  /**
   * Get event counts by type
   */
  async getEventCounts(
    since: Date,
    groupBy: 'eventType' | 'source' = 'eventType'
  ): Promise<Record<string, number>> {
    if (!StreamEventModel) return {};

    const results = await StreamEventModel.aggregate([
      {
        $match: {
          timestamp: { $gte: since }
        }
      },
      {
        $group: {
          _id: `$${groupBy}`,
          count: { $sum: 1 }
        }
      }
    ]);

    const counts: Record<string, number> = {};
    for (const r of results) {
      counts[r._id as string] = r.count;
    }

    return counts;
  }
}

export const eventProcessor = new EventProcessor();
