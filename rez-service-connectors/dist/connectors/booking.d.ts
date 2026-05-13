/**
 * Booking Service Connector
 *
 * Connects to rez-booking-service (Port 4020) for hotel, travel,
 * and event booking management.
 */
import { ServiceClient, ClientConfig } from '../utils/client';
import type { CreateBookingRequest, BookingResponse, UpdateBookingStatusRequest, BookingType, BookingStatus, ServiceResponse, PaginationParams, PaginatedResponse } from '../types';
/**
 * Booking Connector Configuration
 */
interface BookingConfig extends ClientConfig {
    baseUrl: string;
    internalToken: string;
}
export interface BookingListParams extends PaginationParams {
    userId?: string;
    type?: BookingType;
    status?: BookingStatus;
    source?: string;
    dateFrom?: string;
    dateTo?: string;
}
export interface CancellationRequest {
    reason?: string;
    refundRequested?: boolean;
    metadata?: Record<string, unknown>;
}
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
export declare class BookingConnector extends ServiceClient {
    private config;
    constructor(config?: Partial<BookingConfig>);
    /**
     * Create a new booking
     *
     * Supports hotel, flight, train, bus, and cab bookings.
     *
     * @param request - Booking creation parameters
     * @returns Created booking details
     */
    create(request: CreateBookingRequest): Promise<BookingResponse>;
    /**
     * Get booking by ID
     *
     * Retrieves full booking details including guest information and pricing.
     *
     * @param bookingId - The booking ID
     * @returns Booking details
     */
    getBooking(bookingId: string): Promise<ServiceResponse>;
    /**
     * Get booking by confirmation number
     *
     * Alternative lookup by external confirmation number.
     *
     * @param confirmationNumber - The booking confirmation number
     * @returns Booking details
     */
    getByConfirmationNumber(confirmationNumber: string): Promise<ServiceResponse>;
    /**
     * List bookings
     *
     * Returns paginated list of bookings with optional filters.
     *
     * @param params - List parameters including filters and pagination
     * @returns Paginated booking list
     */
    listBookings(params?: BookingListParams): Promise<PaginatedResponse<BookingResponse>>;
    /**
     * Update booking status
     *
     * Updates booking status following the state machine rules.
     *
     * @param bookingId - The booking ID
     * @param request - Status update parameters
     * @returns Updated booking
     */
    updateStatus(bookingId: string, request: UpdateBookingStatusRequest): Promise<ServiceResponse>;
    /**
     * Cancel a booking
     *
     * Cancels a booking. May trigger refund workflow.
     *
     * @param bookingId - The booking ID
     * @param request - Cancellation parameters
     * @returns Cancellation result
     */
    cancel(bookingId: string, request?: CancellationRequest): Promise<ServiceResponse>;
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
    addPayment(bookingId: string, paymentId: string, paymentStatus?: string): Promise<ServiceResponse>;
    /**
     * Update guest information
     *
     * Updates guest details for a booking.
     *
     * @param bookingId - The booking ID
     * @param guests - Updated guest information
     * @returns Updated booking
     */
    updateGuests(bookingId: string, guests: CreateBookingRequest['guests']): Promise<ServiceResponse>;
    /**
     * Get booking status
     *
     * Lightweight endpoint to get only the booking status.
     *
     * @param bookingId - The booking ID
     * @returns Booking status
     */
    getStatus(bookingId: string): Promise<{
        status: BookingStatus;
    }>;
    /**
     * Get bookings by user
     *
     * Returns all bookings for a specific user.
     *
     * @param userId - The user ID
     * @param params - Optional filters
     * @returns Paginated booking list
     */
    getByUser(userId: string, params?: Partial<BookingListParams>): Promise<PaginatedResponse<BookingResponse>>;
    /**
     * Get bookings by type
     *
     * Returns all bookings of a specific type.
     *
     * @param type - The booking type
     * @param params - Optional filters
     * @returns Paginated booking list
     */
    getByType(type: BookingType, params?: Partial<BookingListParams>): Promise<PaginatedResponse<BookingResponse>>;
    /**
     * Health check for booking service
     *
     * @returns Health status
     */
    healthCheck(): Promise<{
        healthy: boolean;
        latency?: number;
    }>;
}
export declare function getBookingConnector(config?: Partial<BookingConfig>): BookingConnector;
export default BookingConnector;
//# sourceMappingURL=booking.d.ts.map