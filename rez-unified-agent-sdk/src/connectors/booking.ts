import { BaseConnector } from './baseConnector';
import type {
  Logger,
  RetryOptions,
  CircuitBreakerOptions,
  CreateBookingRequest,
  BookingResult,
  HttpResponse,
} from '../types';

// ============================================================================
// Booking Service Types
// ============================================================================

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

// ============================================================================
// Booking Connector
// ============================================================================

export class BookingConnector extends BaseConnector {
  constructor(
    baseUrl: string,
    authToken: string,
    options: {
      logger?: Logger;
      timeout?: number;
      retry?: RetryOptions;
      circuitBreaker?: CircuitBreakerOptions;
    } = {},
  ) {
    super('booking-service', baseUrl, authToken, options);
  }

  /**
   * Create a new booking
   */
  async createBooking(request: CreateBookingRequest): Promise<BookingResult> {
    this.logger.info('Creating booking', {
      serviceType: request.serviceType,
      serviceId: request.serviceId,
      customerId: request.customerId,
    });

    const response = await this.post<BookingResult>('/bookings', request);
    this.logger.info('Booking created successfully', {
      bookingId: response.data.bookingId,
      serviceType: request.serviceType,
    });
    return response.data;
  }

  /**
   * Get booking by ID
   */
  async getBooking(bookingId: string): Promise<BookingResult> {
    this.logger.debug('Getting booking', { bookingId });

    const response = await this.get<BookingResult>(`/bookings/${bookingId}`);
    return response.data;
  }

  /**
   * Search bookings
   */
  async searchBookings(params: BookingSearchParams): Promise<BookingListResult> {
    this.logger.debug('Searching bookings', params as unknown as Record<string, unknown>);

    const queryParams: Record<string, string> = {};

    if (params.serviceType) queryParams.serviceType = params.serviceType;
    if (params.serviceId) queryParams.serviceId = params.serviceId;
    if (params.customerId) queryParams.customerId = params.customerId;
    if (params.status) queryParams.status = params.status;
    if (params.fromDate) queryParams.fromDate = params.fromDate;
    if (params.toDate) queryParams.toDate = params.toDate;
    if (params.page !== undefined) queryParams.page = String(params.page);
    if (params.pageSize !== undefined) queryParams.pageSize = String(params.pageSize);

    const response = await this.get<BookingListResult>('/bookings/search', queryParams);
    return response.data;
  }

  /**
   * Get bookings by customer
   */
  async getCustomerBookings(
    customerId: string,
    options?: {
      page?: number;
      pageSize?: number;
      status?: string;
      serviceType?: string;
    },
  ): Promise<BookingListResult> {
    this.logger.debug('Getting customer bookings', { customerId, options });

    const params: Record<string, string> = {};

    if (options?.page) params.page = String(options.page);
    if (options?.pageSize) params.pageSize = String(options.pageSize);
    if (options?.status) params.status = options.status;
    if (options?.serviceType) params.serviceType = options.serviceType;

    const response = await this.get<BookingListResult>(
      `/bookings/customer/${customerId}`,
      params,
    );
    return response.data;
  }

  /**
   * Cancel booking
   */
  async cancelBooking(
    bookingId: string,
    reason: string,
    requestRefund?: boolean,
  ): Promise<BookingCancellation> {
    this.logger.info('Cancelling booking', { bookingId, reason });

    const response = await this.post<BookingCancellation>(`/bookings/${bookingId}/cancel`, {
      reason,
      requestRefund,
    });
    this.logger.info('Booking cancelled', { bookingId });
    return response.data;
  }

  /**
   * Confirm booking
   */
  async confirmBooking(
    bookingId: string,
    paymentId: string,
  ): Promise<BookingResult> {
    this.logger.info('Confirming booking', { bookingId, paymentId });

    const response = await this.post<BookingResult>(`/bookings/${bookingId}/confirm`, {
      paymentId,
    });
    this.logger.info('Booking confirmed', { bookingId });
    return response.data;
  }

  /**
   * Modify booking
   */
  async modifyBooking(
    bookingId: string,
    modifications: Record<string, unknown>,
  ): Promise<BookingModification> {
    this.logger.info('Modifying booking', { bookingId, modifications });

    const response = await this.patch<BookingModification>(
      `/bookings/${bookingId}`,
      modifications,
    );
    this.logger.info('Booking modified', { bookingId });
    return response.data;
  }

  /**
   * Get booking by confirmation code
   */
  async getByConfirmationCode(confirmationCode: string): Promise<BookingResult> {
    this.logger.debug('Getting booking by confirmation code', { confirmationCode });

    const response = await this.get<BookingResult>(
      `/bookings/confirmation/${confirmationCode}`,
    );
    return response.data;
  }

  /**
   * Get service availability
   */
  async getAvailability(
    serviceType: string,
    serviceId: string,
    dateRange: {
      start: string;
      end: string;
    },
    guests?: {
      adults?: number;
      children?: number;
    },
  ): Promise<{
    available: boolean;
    dateRange: { start: string; end: string };
    price: number;
    currency: string;
    availableUnits?: number;
  }> {
    this.logger.debug('Checking availability', { serviceType, serviceId, dateRange });

    const response = await this.post<{
      available: boolean;
      dateRange: { start: string; end: string };
      price: number;
      currency: string;
      availableUnits?: number;
    }>('/bookings/availability', {
      serviceType,
      serviceId,
      dateRange,
      guests,
    });
    return response.data;
  }

  /**
   * Check-in for booking
   */
  async checkIn(
    bookingId: string,
    checkInDetails?: {
      guestSignature?: string;
      idVerified?: boolean;
      notes?: string;
    },
  ): Promise<BookingResult> {
    this.logger.info('Checking in booking', { bookingId });

    const response = await this.post<BookingResult>(`/bookings/${bookingId}/check-in`, {
      checkInDetails,
    });
    this.logger.info('Booking checked in', { bookingId });
    return response.data;
  }

  /**
   * Check-out from booking
   */
  async checkOut(
    bookingId: string,
    checkOutDetails?: {
      checkoutTime?: string;
      damageReported?: boolean;
      notes?: string;
    },
  ): Promise<BookingResult> {
    this.logger.info('Checking out booking', { bookingId });

    const response = await this.post<BookingResult>(`/bookings/${bookingId}/check-out`, {
      checkOutDetails,
    });
    this.logger.info('Booking checked out', { bookingId });
    return response.data;
  }

  /**
   * Get booking history
   */
  async getBookingHistory(
    bookingId: string,
  ): Promise<{
    status: string;
    createdAt: string;
    history: { status: string; timestamp: string; notes?: string }[];
  }> {
    this.logger.debug('Getting booking history', { bookingId });

    const response = await this.get<{
      status: string;
      createdAt: string;
      history: { status: string; timestamp: string; notes?: string }[];
    }>(`/bookings/${bookingId}/history`);
    return response.data;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createBookingConnector(
  baseUrl: string,
  authToken: string,
  options?: {
    logger?: Logger;
    timeout?: number;
    retry?: RetryOptions;
    circuitBreaker?: CircuitBreakerOptions;
  },
): BookingConnector {
  return new BookingConnector(baseUrl, authToken, options);
}
