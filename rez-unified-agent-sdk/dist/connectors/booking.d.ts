import { BaseConnector } from './baseConnector';
import type { Logger, RetryOptions, CircuitBreakerOptions, CreateBookingRequest, BookingResult } from '../types';
export interface BookingSearchParams {
    serviceType?: string;
    serviceId?: string;
    customerId?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    pageSize?: number;
}
export interface BookingListResult {
    bookings: BookingResult[];
    total: number;
    page: number;
    pageSize: number;
}
export interface BookingCancellation {
    bookingId: string;
    reason: string;
    cancelledAt: string;
    refundId?: string;
}
export interface BookingModification {
    bookingId: string;
    modifications: {
        field: string;
        oldValue: string;
        newValue: string;
    }[];
    modifiedAt: string;
}
export declare class BookingConnector extends BaseConnector {
    constructor(baseUrl: string, authToken: string, options?: {
        logger?: Logger;
        timeout?: number;
        retry?: RetryOptions;
        circuitBreaker?: CircuitBreakerOptions;
    });
    /**
     * Create a new booking
     */
    createBooking(request: CreateBookingRequest): Promise<BookingResult>;
    /**
     * Get booking by ID
     */
    getBooking(bookingId: string): Promise<BookingResult>;
    /**
     * Search bookings
     */
    searchBookings(params: BookingSearchParams): Promise<BookingListResult>;
    /**
     * Get bookings by customer
     */
    getCustomerBookings(customerId: string, options?: {
        page?: number;
        pageSize?: number;
        status?: string;
        serviceType?: string;
    }): Promise<BookingListResult>;
    /**
     * Cancel booking
     */
    cancelBooking(bookingId: string, reason: string, requestRefund?: boolean): Promise<BookingCancellation>;
    /**
     * Confirm booking
     */
    confirmBooking(bookingId: string, paymentId: string): Promise<BookingResult>;
    /**
     * Modify booking
     */
    modifyBooking(bookingId: string, modifications: Record<string, unknown>): Promise<BookingModification>;
    /**
     * Get booking by confirmation code
     */
    getByConfirmationCode(confirmationCode: string): Promise<BookingResult>;
    /**
     * Get service availability
     */
    getAvailability(serviceType: string, serviceId: string, dateRange: {
        start: string;
        end: string;
    }, guests?: {
        adults?: number;
        children?: number;
    }): Promise<{
        available: boolean;
        dateRange: {
            start: string;
            end: string;
        };
        price: number;
        currency: string;
        availableUnits?: number;
    }>;
    /**
     * Check-in for booking
     */
    checkIn(bookingId: string, checkInDetails?: {
        guestSignature?: string;
        idVerified?: boolean;
        notes?: string;
    }): Promise<BookingResult>;
    /**
     * Check-out from booking
     */
    checkOut(bookingId: string, checkOutDetails?: {
        checkoutTime?: string;
        damageReported?: boolean;
        notes?: string;
    }): Promise<BookingResult>;
    /**
     * Get booking history
     */
    getBookingHistory(bookingId: string): Promise<{
        status: string;
        createdAt: string;
        history: {
            status: string;
            timestamp: string;
            notes?: string;
        }[];
    }>;
}
export declare function createBookingConnector(baseUrl: string, authToken: string, options?: {
    logger?: Logger;
    timeout?: number;
    retry?: RetryOptions;
    circuitBreaker?: CircuitBreakerOptions;
}): BookingConnector;
//# sourceMappingURL=booking.d.ts.map