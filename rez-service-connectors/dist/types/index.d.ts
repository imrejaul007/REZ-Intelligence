/**
 * Common types shared across all service connectors
 */
export interface ServiceConfig {
    baseUrl: string;
    internalToken: string;
    timeout?: number;
    maxRetries?: number;
}
export interface ServiceResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: ServiceError;
}
export interface ServiceError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
}
export interface PaginationParams {
    page?: number;
    limit?: number;
    offset?: number;
}
export interface PaginatedResponse<T> {
    items: T[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}
export type PaymentMethod = 'upi' | 'card' | 'wallet' | 'netbanking' | 'cod' | 'razorpay' | 'bnpl';
export type PaymentPurpose = 'wallet_topup' | 'order_payment' | 'event_booking' | 'financial_service' | 'other';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled';
export interface InitiatePaymentRequest {
    orderId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    purpose?: PaymentPurpose;
    orchestratorIdempotencyKey?: string;
    userDetails?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}
export interface InitiatePaymentResponse {
    paymentId: string;
    razorpayOrderId?: string;
    status: PaymentStatus;
    amount: number;
    createdAt: string;
}
export interface CapturePaymentRequest {
    paymentId: string;
    razorpayPaymentId: string;
    razorpayOrderId: string;
    razorpaySignature: string;
}
export interface RefundRequest {
    paymentId: string;
    amount: number;
    reason?: string;
    idempotencyKey?: string;
}
export type CoinType = 'rez' | 'prive' | 'branded' | 'promo' | 'cashback' | 'referral';
export interface WalletBalance {
    userId: string;
    balances: {
        coinType: CoinType;
        balance: number;
        updatedAt: string;
    }[];
    totalValueInr: number;
}
export interface CreditRequest {
    userId: string;
    amount: number;
    coinType: CoinType;
    source: string;
    description?: string;
    idempotencyKey?: string;
}
export interface DebitRequest {
    amount: number;
    source: string;
    description?: string;
    idempotencyKey?: string;
}
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled' | 'refunded';
export interface CreateOrderRequest {
    merchantId: string;
    userId: string;
    items: {
        productId: string;
        name: string;
        quantity: number;
        price: number;
        options?: Record<string, unknown>;
    }[];
    total: number;
    paymentMethod: PaymentMethod;
    deliveryAddress?: Record<string, unknown>;
    notes?: string;
    metadata?: Record<string, unknown>;
}
export interface OrderResponse {
    orderId: string;
    orderNumber: string;
    status: OrderStatus;
    total: number;
    createdAt: string;
    updatedAt: string;
    merchantId: string;
    userId: string;
}
export interface UpdateOrderStatusRequest {
    status: OrderStatus;
    reason?: string;
    metadata?: Record<string, unknown>;
}
export type BookingType = 'hotel' | 'flight' | 'train' | 'bus' | 'cab';
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'refunded' | 'failed';
export interface GuestInfo {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    dateOfBirth?: string;
}
export interface PricingInfo {
    baseAmount: number;
    taxes?: number;
    fees?: number;
    discount?: number;
    total: number;
    currency?: string;
}
export interface CreateBookingRequest {
    type: BookingType;
    userId: string;
    source?: string;
    externalBookingId?: string;
    confirmationNumber?: string;
    propertyId?: string;
    propertyName?: string;
    roomTypeId?: string;
    roomName?: string;
    flightId?: string;
    trainId?: string;
    busId?: string;
    cabId?: string;
    checkIn?: string;
    checkOut?: string;
    departureDate?: string;
    returnDate?: string;
    guests: GuestInfo[];
    contactEmail: string;
    contactPhone: string;
    pricing: PricingInfo;
    paymentId?: string;
    paymentStatus?: string;
    paymentMethod?: string;
    metadata?: Record<string, unknown>;
}
export interface BookingResponse {
    bookingId: string;
    type: BookingType;
    status: BookingStatus;
    confirmationNumber: string;
    total: number;
    createdAt: string;
    updatedAt: string;
}
export interface UpdateBookingStatusRequest {
    status: BookingStatus;
    reason?: string;
    metadata?: Record<string, unknown>;
}
export type NotificationChannel = 'push' | 'sms' | 'email' | 'in_app';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
export interface SendNotificationRequest {
    userId: string;
    type: string;
    channel: NotificationChannel;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    priority?: NotificationPriority;
}
export interface NotificationResponse {
    notificationId: string;
    status: string;
    createdAt: string;
}
export interface NotificationListParams extends PaginationParams {
    unreadOnly?: boolean;
}
export interface DateRange {
    startDate: string;
    endDate: string;
}
export interface DashboardSummary {
    kpis: Record<string, number>;
    trends: Record<string, number>;
    charts: Record<string, unknown[]>;
    lastUpdated: string;
}
export interface KPIResponse {
    kpis: Record<string, number>;
    trends: Record<string, number>;
    lastUpdated: string;
}
export interface AnalyticsQueryParams {
    startDate?: string;
    endDate?: string;
    merchantId?: string;
    userId?: string;
    granularity?: 'hour' | 'day' | 'week' | 'month';
}
//# sourceMappingURL=index.d.ts.map