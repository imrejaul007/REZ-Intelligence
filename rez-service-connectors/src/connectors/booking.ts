/**
 * Booking Service Connector
 *
 * Connects to rez-booking-service (Port 4020) for hotel, travel,
 * and event booking management.
 */

import { ServiceClient, ClientConfig } from '../utils/client';
import type {
  CreateBookingRequest,
  BookingResponse,
  UpdateBookingStatusRequest,
  BookingType,
  BookingStatus,
  ServiceResponse,
  PaginationParams,
  PaginatedResponse,
} from '../types';

/**
 * Booking Connector Configuration
 */
interface BookingConfig extends ClientConfig {
  baseUrl: string;
  internalToken: string;
}

const DEFAULT_CONFIG: Partial<BookingConfig> = {
  timeout: 30000,
  maxRetries: 3,
};

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
export class BookingConnector extends ServiceClient {
  private config: BookingConfig;

  constructor(config: Partial<BookingConfig> = {}) {
    const bookingUrl = config.baseUrl || process.env.BOOKING_SERVICE_URL || 'http://localhost:4020';
    const internalToken = config.internalToken || getInternalToken();

    const mergedConfig: BookingConfig = {
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
  async create(request: CreateBookingRequest): Promise<BookingResponse> {
    return this.safeRequest<BookingResponse>({
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
  async getBooking(bookingId: string): Promise<ServiceResponse> {
    return this.safeRequest<ServiceResponse>({
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
  async getByConfirmationNumber(confirmationNumber: string): Promise<ServiceResponse> {
    return this.safeRequest<ServiceResponse>({
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
  async listBookings(params: BookingListParams = {}): Promise<PaginatedResponse<BookingResponse>> {
    return this.safeRequest<PaginatedResponse<BookingResponse>>({
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
  async updateStatus(bookingId: string, request: UpdateBookingStatusRequest): Promise<ServiceResponse> {
    return this.safeRequest<ServiceResponse>({
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
  async cancel(bookingId: string, request: CancellationRequest = {}): Promise<ServiceResponse> {
    return this.safeRequest<ServiceResponse>({
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
  async addPayment(
    bookingId: string,
    paymentId: string,
    paymentStatus: string = 'pending'
  ): Promise<ServiceResponse> {
    return this.safeRequest<ServiceResponse>({
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
  async updateGuests(
    bookingId: string,
    guests: CreateBookingRequest['guests']
  ): Promise<ServiceResponse> {
    return this.safeRequest<ServiceResponse>({
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
  async getStatus(bookingId: string): Promise<{ status: BookingStatus }> {
    return this.safeRequest<{ status: BookingStatus }>({
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
  async getByUser(
    userId: string,
    params: Partial<BookingListParams> = {}
  ): Promise<PaginatedResponse<BookingResponse>> {
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
  async getByType(
    type: BookingType,
    params: Partial<BookingListParams> = {}
  ): Promise<PaginatedResponse<BookingResponse>> {
    return this.listBookings({ type, ...params });
  }

  /**
   * Health check for booking service
   *
   * @returns Health status
   */
  async healthCheck(): Promise<{ healthy: boolean; latency?: number }> {
    const start = Date.now();
    try {
      await this.client.get('/health');
      return { healthy: true, latency: Date.now() - start };
    } catch {
      return { healthy: false, latency: Date.now() - start };
    }
  }
}

/**
 * Get internal token from environment
 */
function getInternalToken(): string {
  const tokensJson = process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}';
  try {
    const tokens = JSON.parse(tokensJson);
    return tokens.orchestrator || tokens.booking || '';
  } catch {
    console.warn('[BookingConnector] Failed to parse INTERNAL_SERVICE_TOKENS_JSON');
    return '';
  }
}

// Singleton instance
let bookingInstance: BookingConnector | null = null;

export function getBookingConnector(config?: Partial<BookingConfig>): BookingConnector {
  if (!bookingInstance) {
    bookingInstance = new BookingConnector(config);
  }
  return bookingInstance;
}

export default BookingConnector;
