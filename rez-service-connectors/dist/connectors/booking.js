"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingConnector = void 0;
exports.getBookingConnector = getBookingConnector;
const logger_js_1 = __importDefault(require("./utils/logger.js"));
/**
 * Booking Service Connector
 *
 * Connects to rez-booking-service (Port 4020) for hotel, travel,
 * and event booking management.
 */
const client_1 = require("../utils/client");
const DEFAULT_CONFIG = {
    timeout: 30000,
    maxRetries: 3,
};
/**
 * Booking Connector
 *
 * Provides methods to interact with the booking service:
 * - Create bookings (hotel, flight, train, bus, cab)
 * - Get booking details
 * - Update booking status
 * - List bookings with filters
 * - Cancel bookings
 */
class BookingConnector extends client_1.ServiceClient {
    config;
    constructor(config = {}) {
        const bookingUrl = config.baseUrl || process.env.BOOKING_SERVICE_URL || 'http://localhost:4020';
        const internalToken = config.internalToken || getInternalToken();
        const mergedConfig = {
            ...DEFAULT_CONFIG,
            ...config,
            baseUrl: bookingUrl,
            internalToken,
            serviceName: 'booking-service',
        };
        super(mergedConfig);
        this.config = mergedConfig;
    }
    /**
     * Create a new booking
     *
     * Supports hotel, flight, train, bus, and cab bookings.
     *
     * @param request - Booking creation parameters
     * @returns Created booking details
     */
    async create(request) {
        return this.safeRequest({
            method: 'POST',
            url: '/api/bookings',
            data: {
                ...request,
                metadata: {
                    ...request.metadata,
                    createdBy: 'orchestrator',
                    createdAt: new Date().toISOString(),
                },
            },
        });
    }
    /**
     * Get booking by ID
     *
     * Retrieves full booking details including guest information and pricing.
     *
     * @param bookingId - The booking ID
     * @returns Booking details
     */
    async getBooking(bookingId) {
        return this.safeRequest({
            method: 'GET',
            url: `/api/bookings/${bookingId}`,
        });
    }
    /**
     * Get booking by confirmation number
     *
     * Alternative lookup by external confirmation number.
     *
     * @param confirmationNumber - The booking confirmation number
     * @returns Booking details
     */
    async getByConfirmationNumber(confirmationNumber) {
        return this.safeRequest({
            method: 'GET',
            url: `/api/bookings/confirmation/${confirmationNumber}`,
        });
    }
    /**
     * List bookings
     *
     * Returns paginated list of bookings with optional filters.
     *
     * @param params - List parameters including filters and pagination
     * @returns Paginated booking list
     */
    async listBookings(params = {}) {
        return this.safeRequest({
            method: 'GET',
            url: '/api/bookings',
            params: {
                userId: params.userId,
                type: params.type,
                status: params.status,
                source: params.source,
                dateFrom: params.dateFrom,
                dateTo: params.dateTo,
                page: params.page || 1,
                limit: params.limit || 20,
            },
        });
    }
    /**
     * Update booking status
     *
     * Updates booking status following the state machine rules.
     *
     * @param bookingId - The booking ID
     * @param request - Status update parameters
     * @returns Updated booking
     */
    async updateStatus(bookingId, request) {
        return this.safeRequest({
            method: 'PATCH',
            url: `/api/bookings/${bookingId}/status`,
            data: {
                status: request.status,
                reason: request.reason,
                metadata: request.metadata,
            },
        });
    }
    /**
     * Cancel a booking
     *
     * Cancels a booking. May trigger refund workflow.
     *
     * @param bookingId - The booking ID
     * @param request - Cancellation parameters
     * @returns Cancellation result
     */
    async cancel(bookingId, request = {}) {
        return this.safeRequest({
            method: 'POST',
            url: `/api/bookings/${bookingId}/cancel`,
            data: {
                reason: request.reason,
                refundRequested: request.refundRequested ?? true,
                metadata: {
                    ...request.metadata,
                    cancelledBy: 'orchestrator',
                    cancelledAt: new Date().toISOString(),
                },
            },
        });
    }
    /**
     * Add payment to booking
     *
     * Links a payment to an existing booking.
     *
     * @param bookingId - The booking ID
     * @param paymentId - The payment ID to link
     * @param paymentStatus - Payment status
     * @returns Updated booking
     */
    async addPayment(bookingId, paymentId, paymentStatus = 'pending') {
        return this.safeRequest({
            method: 'PATCH',
            url: `/api/bookings/${bookingId}/payment`,
            data: {
                paymentId,
                paymentStatus,
                linkedAt: new Date().toISOString(),
                linkedBy: 'orchestrator',
            },
        });
    }
    /**
     * Update guest information
     *
     * Updates guest details for a booking.
     *
     * @param bookingId - The booking ID
     * @param guests - Updated guest information
     * @returns Updated booking
     */
    async updateGuests(bookingId, guests) {
        return this.safeRequest({
            method: 'PATCH',
            url: `/api/bookings/${bookingId}/guests`,
            data: { guests },
        });
    }
    /**
     * Get booking status
     *
     * Lightweight endpoint to get only the booking status.
     *
     * @param bookingId - The booking ID
     * @returns Booking status
     */
    async getStatus(bookingId) {
        return this.safeRequest({
            method: 'GET',
            url: `/api/bookings/${bookingId}/status`,
        });
    }
    /**
     * Get bookings by user
     *
     * Returns all bookings for a specific user.
     *
     * @param userId - The user ID
     * @param params - Optional filters
     * @returns Paginated booking list
     */
    async getByUser(userId, params = {}) {
        return this.listBookings({ userId, ...params });
    }
    /**
     * Get bookings by type
     *
     * Returns all bookings of a specific type.
     *
     * @param type - The booking type
     * @param params - Optional filters
     * @returns Paginated booking list
     */
    async getByType(type, params = {}) {
        return this.listBookings({ type, ...params });
    }
    /**
     * Health check for booking service
     *
     * @returns Health status
     */
    async healthCheck() {
        const start = Date.now();
        try {
            await this.client.get('/health');
            return { healthy: true, latency: Date.now() - start };
        }
        catch {
            return { healthy: false, latency: Date.now() - start };
        }
    }
}
exports.BookingConnector = BookingConnector;
/**
 * Get internal token from environment
 */
function getInternalToken() {
    const tokensJson = process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}';
    try {
        const tokens = JSON.parse(tokensJson);
        return tokens.orchestrator || tokens.booking || '';
    }
    catch {
        logger_js_1.default.warn('[BookingConnector] Failed to parse INTERNAL_SERVICE_TOKENS_JSON');
        return '';
    }
}
// Singleton instance
let bookingInstance = null;
function getBookingConnector(config) {
    if (!bookingInstance) {
        bookingInstance = new BookingConnector(config);
    }
    return bookingInstance;
}
exports.default = BookingConnector;
//# sourceMappingURL=booking.js.map