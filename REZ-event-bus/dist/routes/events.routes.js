"use strict";
/**
 * Events Routes
 * API endpoints for publishing and querying events
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const publisher_1 = require("../services/publisher");
const eventValidator_1 = require("../services/eventValidator");
const eventSchema_1 = require("../services/eventSchema");
const logger_1 = require("../services/logger");
const router = (0, express_1.Router)();
exports.eventRoutes = router;
/**
 * POST /events/publish
 * Publish a single event
 */
router.post('/publish', auth_1.verifyInternalToken, (0, auth_1.requirePermission)(auth_1.Permission.PUBLISH), async (req, res) => {
    try {
        const payload = req.body;
        // Validate payload
        eventValidator_1.EventValidator.validateEventPayload(payload);
        // Get publisher service
        const publisher = (0, publisher_1.getPublisherService)();
        // Publish event
        const result = await publisher.publish(payload);
        if (result.success) {
            res.status(201).json({
                success: true,
                eventId: result.eventId,
                eventType: result.eventType,
                channels: result.channels,
                subscriberCount: result.subscriberCount,
                timestamp: result.timestamp,
                requestId: req.requestId,
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: result.error,
                eventType: result.eventType,
                requestId: req.requestId,
            });
        }
    }
    catch (error) {
        logger_1.eventLogger.error('Publish failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            requestId: req.requestId,
            body: req.body,
        });
        if (error instanceof eventValidator_1.ValidationError) {
            res.status(400).json({
                error: 'Validation Error',
                code: 'VALIDATION_ERROR',
                message: error.message,
                details: error.details,
                requestId: req.requestId,
            });
            return;
        }
        res.status(500).json({
            error: 'Internal Server Error',
            code: 'PUBLISH_FAILED',
            message: 'Failed to publish event',
            requestId: req.requestId,
        });
    }
});
/**
 * POST /events/publish/batch
 * Publish multiple events
 */
router.post('/publish/batch', auth_1.verifyInternalToken, (0, auth_1.requirePermission)(auth_1.Permission.PUBLISH), async (req, res) => {
    try {
        const { events, atomic = false } = req.body;
        if (!Array.isArray(events) || events.length === 0) {
            res.status(400).json({
                error: 'Bad Request',
                code: 'INVALID_BATCH',
                message: 'events must be a non-empty array',
                requestId: req.requestId,
            });
            return;
        }
        // Validate all events first
        const validation = eventValidator_1.EventValidator.validateBatchPayload(events);
        if (!validation.valid) {
            res.status(400).json({
                error: 'Validation Error',
                code: 'VALIDATION_ERROR',
                message: 'Some events failed validation',
                errors: validation.errors,
                requestId: req.requestId,
            });
            return;
        }
        // Get publisher service
        const publisher = (0, publisher_1.getPublisherService)();
        // Publish batch
        const result = await publisher.publishBatch(events, atomic);
        res.status(result.success ? 201 : 207).json({
            success: result.success,
            total: events.length,
            results: result.results,
            requestId: req.requestId,
        });
    }
    catch (error) {
        logger_1.eventLogger.error('Batch publish failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            requestId: req.requestId,
        });
        res.status(500).json({
            error: 'Internal Server Error',
            code: 'BATCH_PUBLISH_FAILED',
            message: 'Failed to publish batch',
            requestId: req.requestId,
        });
    }
});
/**
 * GET /events/types
 * Get all valid event types
 */
router.get('/types', async (req, res) => {
    const eventTypes = (0, eventSchema_1.getValidEventTypes)();
    const typesInfo = eventTypes.map((type) => ({
        type,
        ...(0, eventSchema_1.getEventTypeInfo)(type),
    }));
    res.json({
        eventTypes,
        count: eventTypes.length,
        typesInfo,
        requestId: req.requestId,
    });
});
/**
 * GET /events/history
 * Get event history
 */
router.get('/history', auth_1.verifyInternalToken, (0, auth_1.requirePermission)(auth_1.Permission.READ), async (req, res) => {
    try {
        const { eventType, limit = '100', offset = '0' } = req.query;
        const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 1000);
        const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);
        // Get from Redis
        const redisPubSub = req.app.get('redisPubSub');
        const events = await redisPubSub.getEventHistory(eventType, parsedLimit, parsedOffset);
        res.json({
            events,
            count: events.length,
            limit: parsedLimit,
            offset: parsedOffset,
            requestId: req.requestId,
        });
    }
    catch (error) {
        logger_1.eventLogger.error('Failed to get event history', {
            error: error instanceof Error ? error.message : 'Unknown error',
            requestId: req.requestId,
        });
        res.status(500).json({
            error: 'Internal Server Error',
            code: 'QUERY_FAILED',
            message: 'Failed to get event history',
            requestId: req.requestId,
        });
    }
});
/**
 * GET /events/:eventId
 * Get specific event by ID
 */
router.get('/:eventId', auth_1.verifyInternalToken, (0, auth_1.requirePermission)(auth_1.Permission.READ), async (req, res) => {
    try {
        const { eventId } = req.params;
        const { eventType } = req.query;
        if (!eventType) {
            res.status(400).json({
                error: 'Bad Request',
                code: 'MISSING_PARAMETER',
                message: 'eventType query parameter is required',
                requestId: req.requestId,
            });
            return;
        }
        const redisPubSub = req.app.get('redisPubSub');
        const event = await redisPubSub.getStoredEvent(eventId, eventType);
        if (!event) {
            res.status(404).json({
                error: 'Not Found',
                code: 'EVENT_NOT_FOUND',
                message: `Event ${eventId} not found`,
                requestId: req.requestId,
            });
            return;
        }
        res.json({
            event,
            requestId: req.requestId,
        });
    }
    catch (error) {
        logger_1.eventLogger.error('Failed to get event', {
            error: error instanceof Error ? error.message : 'Unknown error',
            requestId: req.requestId,
        });
        res.status(500).json({
            error: 'Internal Server Error',
            code: 'QUERY_FAILED',
            message: 'Failed to get event',
            requestId: req.requestId,
        });
    }
});
/**
 * GET /events/stats
 * Get event statistics
 */
router.get('/stats', auth_1.verifyInternalToken, (0, auth_1.requirePermission)(auth_1.Permission.READ), async (req, res) => {
    try {
        const publisher = (0, publisher_1.getPublisherService)();
        const stats = publisher.getStats();
        res.json({
            stats,
            requestId: req.requestId,
        });
    }
    catch (error) {
        logger_1.eventLogger.error('Failed to get stats', {
            error: error instanceof Error ? error.message : 'Unknown error',
            requestId: req.requestId,
        });
        res.status(500).json({
            error: 'Internal Server Error',
            code: 'STATS_FAILED',
            message: 'Failed to get statistics',
            requestId: req.requestId,
        });
    }
});
//# sourceMappingURL=events.routes.js.map