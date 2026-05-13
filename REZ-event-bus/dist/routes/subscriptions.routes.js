"use strict";
/**
 * Subscriptions Routes
 * API endpoints for managing event subscriptions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriptionRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const subscriber_1 = require("../services/subscriber");
const eventValidator_1 = require("../services/eventValidator");
const logger_1 = require("../services/logger");
const router = (0, express_1.Router)();
exports.subscriptionRoutes = router;
/**
 * POST /subscriptions
 * Create a new subscription
 */
router.post('/', auth_1.verifyInternalToken, (0, auth_1.requirePermission)(auth_1.Permission.SUBSCRIBE), async (req, res) => {
    try {
        const payload = req.body;
        // Validate payload
        eventValidator_1.EventValidator.validateSubscriptionPayload(payload);
        // Ensure at least one URL field is provided
        if (!payload.url && !payload.webhookUrl && !payload.callbackUrl) {
            res.status(400).json({
                error: 'Bad Request',
                code: 'MISSING_URL',
                message: 'At least one of url, webhookUrl, or callbackUrl is required',
                requestId: req.requestId,
            });
            return;
        }
        // Create subscription
        const subscription = await subscriber_1.subscriberService.subscribe(payload);
        logger_1.subscriptionLogger.info('Subscription created via API', {
            subscriptionId: subscription.subscriptionId,
            subscriberId: subscription.subscriberId,
            eventTypes: subscription.eventTypes,
            requestId: req.requestId,
        });
        res.status(201).json({
            success: true,
            subscription,
            requestId: req.requestId,
        });
    }
    catch (error) {
        logger_1.subscriptionLogger.error('Failed to create subscription', {
            error: error instanceof Error ? error.message : 'Unknown error',
            requestId: req.requestId,
        });
        if (error instanceof Error && error.message.includes('Maximum subscriptions')) {
            res.status(429).json({
                error: 'Too Many Requests',
                code: 'MAX_SUBSCRIPTIONS',
                message: error.message,
                requestId: req.requestId,
            });
            return;
        }
        res.status(500).json({
            error: 'Internal Server Error',
            code: 'SUBSCRIPTION_FAILED',
            message: 'Failed to create subscription',
            requestId: req.requestId,
        });
    }
});
/**
 * GET /subscriptions
 * List subscriptions
 */
router.get('/', auth_1.verifyInternalToken, (0, auth_1.requirePermission)(auth_1.Permission.READ), async (req, res) => {
    try {
        const { subscriberId, eventType, status } = req.query;
        let subscriptions;
        if (subscriberId) {
            subscriptions = subscriber_1.subscriberService.getSubscriptionsBySubscriber(subscriberId);
        }
        else if (eventType) {
            subscriptions = subscriber_1.subscriberService.getSubscriptionsByEventType(eventType);
        }
        else {
            // Return all subscriptions stats
            const stats = subscriber_1.subscriberService.getStats();
            res.json({
                stats,
                requestId: req.requestId,
            });
            return;
        }
        // Filter by status if provided
        if (status) {
            subscriptions = subscriptions.filter((s) => s.status === status);
        }
        res.json({
            subscriptions,
            count: subscriptions.length,
            requestId: req.requestId,
        });
    }
    catch (error) {
        logger_1.subscriptionLogger.error('Failed to list subscriptions', {
            error: error instanceof Error ? error.message : 'Unknown error',
            requestId: req.requestId,
        });
        res.status(500).json({
            error: 'Internal Server Error',
            code: 'QUERY_FAILED',
            message: 'Failed to list subscriptions',
            requestId: req.requestId,
        });
    }
});
/**
 * GET /subscriptions/:subscriptionId
 * Get specific subscription
 */
router.get('/:subscriptionId', auth_1.verifyInternalToken, (0, auth_1.requirePermission)(auth_1.Permission.READ), async (req, res) => {
    try {
        const { subscriptionId } = req.params;
        const subscription = subscriber_1.subscriberService.getSubscription(subscriptionId);
        if (!subscription) {
            res.status(404).json({
                error: 'Not Found',
                code: 'SUBSCRIPTION_NOT_FOUND',
                message: `Subscription ${subscriptionId} not found`,
                requestId: req.requestId,
            });
            return;
        }
        res.json({
            subscription,
            requestId: req.requestId,
        });
    }
    catch (error) {
        logger_1.subscriptionLogger.error('Failed to get subscription', {
            error: error instanceof Error ? error.message : 'Unknown error',
            requestId: req.requestId,
        });
        res.status(500).json({
            error: 'Internal Server Error',
            code: 'QUERY_FAILED',
            message: 'Failed to get subscription',
            requestId: req.requestId,
        });
    }
});
/**
 * PUT /subscriptions/:subscriptionId
 * Update subscription
 */
router.put('/:subscriptionId', auth_1.verifyInternalToken, (0, auth_1.requirePermission)(auth_1.Permission.SUBSCRIBE), async (req, res) => {
    try {
        const { subscriptionId } = req.params;
        const updates = req.body;
        // Validate URL if provided
        if (updates.url || updates.webhookUrl || updates.callbackUrl) {
            const url = updates.url || updates.webhookUrl || updates.callbackUrl;
            try {
                new URL(url);
            }
            catch {
                res.status(400).json({
                    error: 'Bad Request',
                    code: 'INVALID_URL',
                    message: 'Invalid URL format',
                    requestId: req.requestId,
                });
                return;
            }
        }
        const subscription = await subscriber_1.subscriberService.updateSubscription(subscriptionId, updates);
        logger_1.subscriptionLogger.info('Subscription updated via API', {
            subscriptionId,
            requestId: req.requestId,
        });
        res.json({
            success: true,
            subscription,
            requestId: req.requestId,
        });
    }
    catch (error) {
        logger_1.subscriptionLogger.error('Failed to update subscription', {
            error: error instanceof Error ? error.message : 'Unknown error',
            subscriptionId: req.params.subscriptionId,
            requestId: req.requestId,
        });
        if (error instanceof Error && error.message.includes('not found')) {
            res.status(404).json({
                error: 'Not Found',
                code: 'SUBSCRIPTION_NOT_FOUND',
                message: error.message,
                requestId: req.requestId,
            });
            return;
        }
        res.status(500).json({
            error: 'Internal Server Error',
            code: 'UPDATE_FAILED',
            message: 'Failed to update subscription',
            requestId: req.requestId,
        });
    }
});
/**
 * DELETE /subscriptions/:subscriptionId
 * Delete subscription
 */
router.delete('/:subscriptionId', auth_1.verifyInternalToken, (0, auth_1.requirePermission)(auth_1.Permission.SUBSCRIBE), async (req, res) => {
    try {
        const { subscriptionId } = req.params;
        await subscriber_1.subscriberService.unsubscribe(subscriptionId);
        logger_1.subscriptionLogger.info('Subscription deleted via API', {
            subscriptionId,
            requestId: req.requestId,
        });
        res.json({
            success: true,
            requestId: req.requestId,
        });
    }
    catch (error) {
        logger_1.subscriptionLogger.error('Failed to delete subscription', {
            error: error instanceof Error ? error.message : 'Unknown error',
            subscriptionId: req.params.subscriptionId,
            requestId: req.requestId,
        });
        if (error instanceof Error && error.message.includes('not found')) {
            res.status(404).json({
                error: 'Not Found',
                code: 'SUBSCRIPTION_NOT_FOUND',
                message: error.message,
                requestId: req.requestId,
            });
            return;
        }
        res.status(500).json({
            error: 'Internal Server Error',
            code: 'DELETE_FAILED',
            message: 'Failed to delete subscription',
            requestId: req.requestId,
        });
    }
});
/**
 * GET /subscriptions/stats
 * Get subscription statistics
 */
router.get('/stats', auth_1.verifyInternalToken, (0, auth_1.requirePermission)(auth_1.Permission.READ), async (req, res) => {
    try {
        const stats = subscriber_1.subscriberService.getStats();
        res.json({
            stats,
            requestId: req.requestId,
        });
    }
    catch (error) {
        logger_1.subscriptionLogger.error('Failed to get subscription stats', {
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
//# sourceMappingURL=subscriptions.routes.js.map