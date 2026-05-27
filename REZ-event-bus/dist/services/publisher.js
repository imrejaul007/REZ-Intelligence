"use strict";
/**
 * Publisher Service
 * High-level event publishing service combining Redis and Kafka
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublisherService = void 0;
exports.initPublisherService = initPublisherService;
exports.getPublisherService = getPublisherService;
const uuid_1 = require("uuid");
const Event_1 = require("../models/Event");
const eventSchema_1 = require("./eventSchema");
const eventValidator_1 = require("./eventValidator");
const logger_1 = require("./logger");
/**
 * Publisher Service
 */
class PublisherService {
    redisPubSub;
    kafkaProducer;
    publishedEvents;
    failedEvents;
    constructor(redisPubSub, kafkaProducer) {
        this.redisPubSub = redisPubSub;
        this.kafkaProducer = kafkaProducer;
        this.publishedEvents = 0;
        this.failedEvents = 0;
    }
    /**
     * Publish a single event
     */
    async publish(payload) {
        const startTime = Date.now();
        const eventId = (0, uuid_1.v4)();
        const channels = [];
        try {
            // Validate event type
            eventValidator_1.EventValidator.validateEventType(payload.eventType);
            // Validate payload size
            eventValidator_1.EventValidator.validatePayloadSize(payload.payload);
            // Create event object
            const event = (0, Event_1.createEvent)({
                eventType: payload.eventType,
                payload: payload.payload,
                source: payload.source,
                correlationId: payload.correlationId || (0, uuid_1.v4)(),
                causationId: payload.causationId,
                priority: payload.priority,
                tags: payload.tags,
            });
            event.status = Event_1.EventStatus.PUBLISHED;
            // Build channel list
            channels.push(`events.${payload.eventType}`);
            // Add category channel
            const eventInfo = (0, eventSchema_1.getEventTypeInfo)(payload.eventType);
            channels.push(`events.category.${eventInfo.category.toLowerCase()}`);
            // Add source channel
            channels.push(`events.source.${payload.source}`);
            // Add user-specific channel if userId is in payload
            const userId = payload.payload['userId'];
            if (userId) {
                channels.push(`events.user.${userId}`);
            }
            // Publish to Redis for real-time subscribers
            const subscriberCounts = await this.redisPubSub.publishToChannels(channels, event);
            const subscriberCount = subscriberCounts.reduce((sum, count) => sum + count, 0);
            // Store in Redis for replay
            await this.redisPubSub.storeEvent(event);
            // Publish to Kafka for durable streaming
            try {
                await this.kafkaProducer.publish(event);
            }
            catch (kafkaError) {
                // Log but don't fail - Redis is primary for real-time
                logger_1.eventLogger.warn('Kafka publish failed, event stored in Redis only', {
                    eventId,
                    error: kafkaError instanceof Error ? kafkaError.message : String(kafkaError),
                });
            }
            this.publishedEvents++;
            const duration = Date.now() - startTime;
            logger_1.eventLogger.info('Event published', {
                eventId,
                eventType: payload.eventType,
                channels,
                subscriberCount,
                durationMs: duration,
            });
            return {
                success: true,
                eventId,
                eventType: payload.eventType,
                channels,
                subscriberCount,
                timestamp: event.metadata.timestamp,
            };
        }
        catch (error) {
            this.failedEvents++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.eventLogger.error('Event publish failed', {
                eventType: payload.eventType,
                error: errorMessage,
            });
            return {
                success: false,
                eventId,
                eventType: payload.eventType,
                channels,
                subscriberCount: 0,
                timestamp: new Date().toISOString(),
                error: errorMessage,
            };
        }
    }
    /**
     * Publish batch of events
     */
    async publishBatch(payloads, atomic = false) {
        const results = [];
        let allSuccess = true;
        for (const payload of payloads) {
            const result = await this.publish(payload);
            results.push(result);
            if (atomic && !result.success) {
                // Stop processing if atomic and one fails
                allSuccess = false;
                break;
            }
            if (!result.success) {
                allSuccess = false;
            }
        }
        return { results, success: allSuccess };
    }
    /**
     * Publish high-priority event
     */
    async publishUrgent(eventType, payload, source, correlationId) {
        return this.publish({
            eventType,
            payload,
            source,
            correlationId,
            priority: payload['priority'] || Event_1.EventPriority.NORMAL,
        });
    }
    /**
     * Get publisher statistics
     */
    getStats() {
        const total = this.publishedEvents + this.failedEvents;
        return {
            publishedEvents: this.publishedEvents,
            failedEvents: this.failedEvents,
            successRate: total > 0 ? this.publishedEvents / total : 1,
        };
    }
    /**
     * Reset statistics
     */
    resetStats() {
        this.publishedEvents = 0;
        this.failedEvents = 0;
    }
}
exports.PublisherService = PublisherService;
// Will be initialized in index.ts
let publisherService = null;
function initPublisherService(redisPubSub, kafkaProducer) {
    publisherService = new PublisherService(redisPubSub, kafkaProducer);
    return publisherService;
}
function getPublisherService() {
    if (!publisherService) {
        throw new Error('PublisherService not initialized');
    }
    return publisherService;
}
exports.default = PublisherService;
//# sourceMappingURL=publisher.js.map