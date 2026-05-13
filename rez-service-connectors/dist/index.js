"use strict";
/**
 * Service Connectors Index
 *
 * Exports all service connectors for the ReZ Orchestrator.
 * Each connector provides typed methods to interact with backend services.
 *
 * Usage:
 * ```typescript
 * import { PaymentConnector, WalletConnector, OrderConnector } from '@rez/service-connectors';
 *
 * const payment = new PaymentConnector({ baseUrl: 'http://localhost:4001' });
 * const result = await payment.initiate({ orderId: '...', amount: 100, paymentMethod: 'upi' });
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceManager = exports.ServiceClient = exports.getAnalyticsConnector = exports.AnalyticsConnector = exports.getNotificationConnector = exports.NotificationConnector = exports.getBookingConnector = exports.BookingConnector = exports.getOrderConnector = exports.OrderConnector = exports.getWalletConnector = exports.WalletConnector = exports.getPaymentConnector = exports.PaymentConnector = void 0;
exports.getServiceManager = getServiceManager;
// Connectors
const payment_1 = require("./connectors/payment");
Object.defineProperty(exports, "PaymentConnector", { enumerable: true, get: function () { return payment_1.PaymentConnector; } });
Object.defineProperty(exports, "getPaymentConnector", { enumerable: true, get: function () { return payment_1.getPaymentConnector; } });
const wallet_1 = require("./connectors/wallet");
Object.defineProperty(exports, "WalletConnector", { enumerable: true, get: function () { return wallet_1.WalletConnector; } });
Object.defineProperty(exports, "getWalletConnector", { enumerable: true, get: function () { return wallet_1.getWalletConnector; } });
const order_1 = require("./connectors/order");
Object.defineProperty(exports, "OrderConnector", { enumerable: true, get: function () { return order_1.OrderConnector; } });
Object.defineProperty(exports, "getOrderConnector", { enumerable: true, get: function () { return order_1.getOrderConnector; } });
const booking_1 = require("./connectors/booking");
Object.defineProperty(exports, "BookingConnector", { enumerable: true, get: function () { return booking_1.BookingConnector; } });
Object.defineProperty(exports, "getBookingConnector", { enumerable: true, get: function () { return booking_1.getBookingConnector; } });
const notification_1 = require("./connectors/notification");
Object.defineProperty(exports, "NotificationConnector", { enumerable: true, get: function () { return notification_1.NotificationConnector; } });
Object.defineProperty(exports, "getNotificationConnector", { enumerable: true, get: function () { return notification_1.getNotificationConnector; } });
const analytics_1 = require("./connectors/analytics");
Object.defineProperty(exports, "AnalyticsConnector", { enumerable: true, get: function () { return analytics_1.AnalyticsConnector; } });
Object.defineProperty(exports, "getAnalyticsConnector", { enumerable: true, get: function () { return analytics_1.getAnalyticsConnector; } });
// Utility classes
var client_1 = require("./utils/client");
Object.defineProperty(exports, "ServiceClient", { enumerable: true, get: function () { return client_1.ServiceClient; } });
/**
 * Orchestrator Service Manager
 *
 * Provides a unified interface to manage all service connectors.
 * Useful for health checks and batch operations.
 */
class ServiceManager {
    connectors;
    constructor() {
        this.connectors = {
            payment: (0, payment_1.getPaymentConnector)(),
            wallet: (0, wallet_1.getWalletConnector)(),
            order: (0, order_1.getOrderConnector)(),
            booking: (0, booking_1.getBookingConnector)(),
            notification: (0, notification_1.getNotificationConnector)(),
            analytics: (0, analytics_1.getAnalyticsConnector)(),
        };
    }
    /**
     * Get all service health statuses
     *
     * @returns Map of service name to health status
     */
    async getAllHealthStatuses() {
        const results = await Promise.allSettled([
            this.connectors.payment.healthCheck().then((r) => ['payment', r]),
            this.connectors.wallet.healthCheck().then((r) => ['wallet', r]),
            this.connectors.order.healthCheck().then((r) => ['order', r]),
            this.connectors.booking.healthCheck().then((r) => ['booking', r]),
            this.connectors.notification.healthCheck().then((r) => ['notification', r]),
            this.connectors.analytics.healthCheck().then((r) => ['analytics', r]),
        ]);
        const healthMap = {};
        for (const result of results) {
            if (result.status === 'fulfilled') {
                healthMap[result.value[0]] = result.value[1];
            }
            else {
                healthMap[result.reason?.service || 'unknown'] = { healthy: false };
            }
        }
        return healthMap;
    }
    /**
     * Check if all services are healthy
     *
     * @returns true if all services are healthy
     */
    async isHealthy() {
        const statuses = await this.getAllHealthStatuses();
        return Object.values(statuses).every((s) => s.healthy);
    }
    // Convenience getters for individual connectors
    get payment() {
        return this.connectors.payment;
    }
    get wallet() {
        return this.connectors.wallet;
    }
    get order() {
        return this.connectors.order;
    }
    get booking() {
        return this.connectors.booking;
    }
    get notification() {
        return this.connectors.notification;
    }
    get analytics() {
        return this.connectors.analytics;
    }
}
exports.ServiceManager = ServiceManager;
// Default singleton instance
let serviceManagerInstance = null;
function getServiceManager() {
    if (!serviceManagerInstance) {
        serviceManagerInstance = new ServiceManager();
    }
    return serviceManagerInstance;
}
exports.default = ServiceManager;
//# sourceMappingURL=index.js.map