import { z } from 'zod';
export declare const CircuitBreakerOptionsSchema: z.ZodObject<{
    timeout: z.ZodDefault<z.ZodNumber>;
    errorThresholdPercentage: z.ZodDefault<z.ZodNumber>;
    resetTimeout: z.ZodDefault<z.ZodNumber>;
    volumeThreshold: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    timeout: number;
    errorThresholdPercentage: number;
    resetTimeout: number;
    volumeThreshold: number;
}, {
    timeout?: number | undefined;
    errorThresholdPercentage?: number | undefined;
    resetTimeout?: number | undefined;
    volumeThreshold?: number | undefined;
}>;
export type CircuitBreakerOptions = z.infer<typeof CircuitBreakerOptionsSchema>;
export declare const RetryOptionsSchema: z.ZodObject<{
    maxAttempts: z.ZodDefault<z.ZodNumber>;
    initialDelay: z.ZodDefault<z.ZodNumber>;
    maxDelay: z.ZodDefault<z.ZodNumber>;
    factor: z.ZodDefault<z.ZodNumber>;
    jitter: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    factor: number;
    jitter: boolean;
}, {
    maxAttempts?: number | undefined;
    initialDelay?: number | undefined;
    maxDelay?: number | undefined;
    factor?: number | undefined;
    jitter?: boolean | undefined;
}>;
export type RetryOptions = z.infer<typeof RetryOptionsSchema>;
export declare const SDKConfigSchema: z.ZodObject<{
    agentId: z.ZodString;
    internalTokens: z.ZodRecord<z.ZodString, z.ZodString>;
    services: z.ZodObject<{
        paymentService: z.ZodOptional<z.ZodString>;
        walletService: z.ZodOptional<z.ZodString>;
        orderService: z.ZodOptional<z.ZodString>;
        bookingService: z.ZodOptional<z.ZodString>;
        notificationService: z.ZodOptional<z.ZodString>;
        analyticsService: z.ZodOptional<z.ZodString>;
        catalogService: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        paymentService?: string | undefined;
        walletService?: string | undefined;
        orderService?: string | undefined;
        bookingService?: string | undefined;
        notificationService?: string | undefined;
        analyticsService?: string | undefined;
        catalogService?: string | undefined;
    }, {
        paymentService?: string | undefined;
        walletService?: string | undefined;
        orderService?: string | undefined;
        bookingService?: string | undefined;
        notificationService?: string | undefined;
        analyticsService?: string | undefined;
        catalogService?: string | undefined;
    }>;
    circuitBreaker: z.ZodOptional<z.ZodObject<{
        timeout: z.ZodDefault<z.ZodNumber>;
        errorThresholdPercentage: z.ZodDefault<z.ZodNumber>;
        resetTimeout: z.ZodDefault<z.ZodNumber>;
        volumeThreshold: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        timeout: number;
        errorThresholdPercentage: number;
        resetTimeout: number;
        volumeThreshold: number;
    }, {
        timeout?: number | undefined;
        errorThresholdPercentage?: number | undefined;
        resetTimeout?: number | undefined;
        volumeThreshold?: number | undefined;
    }>>;
    retry: z.ZodOptional<z.ZodObject<{
        maxAttempts: z.ZodDefault<z.ZodNumber>;
        initialDelay: z.ZodDefault<z.ZodNumber>;
        maxDelay: z.ZodDefault<z.ZodNumber>;
        factor: z.ZodDefault<z.ZodNumber>;
        jitter: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        maxAttempts: number;
        initialDelay: number;
        maxDelay: number;
        factor: number;
        jitter: boolean;
    }, {
        maxAttempts?: number | undefined;
        initialDelay?: number | undefined;
        maxDelay?: number | undefined;
        factor?: number | undefined;
        jitter?: boolean | undefined;
    }>>;
    timeout: z.ZodDefault<z.ZodNumber>;
    logger: z.ZodOptional<z.ZodType<Logger, z.ZodTypeDef, Logger>>;
}, "strip", z.ZodTypeAny, {
    timeout: number;
    agentId: string;
    internalTokens: Record<string, string>;
    services: {
        paymentService?: string | undefined;
        walletService?: string | undefined;
        orderService?: string | undefined;
        bookingService?: string | undefined;
        notificationService?: string | undefined;
        analyticsService?: string | undefined;
        catalogService?: string | undefined;
    };
    circuitBreaker?: {
        timeout: number;
        errorThresholdPercentage: number;
        resetTimeout: number;
        volumeThreshold: number;
    } | undefined;
    retry?: {
        maxAttempts: number;
        initialDelay: number;
        maxDelay: number;
        factor: number;
        jitter: boolean;
    } | undefined;
    logger?: Logger | undefined;
}, {
    agentId: string;
    internalTokens: Record<string, string>;
    services: {
        paymentService?: string | undefined;
        walletService?: string | undefined;
        orderService?: string | undefined;
        bookingService?: string | undefined;
        notificationService?: string | undefined;
        analyticsService?: string | undefined;
        catalogService?: string | undefined;
    };
    timeout?: number | undefined;
    circuitBreaker?: {
        timeout?: number | undefined;
        errorThresholdPercentage?: number | undefined;
        resetTimeout?: number | undefined;
        volumeThreshold?: number | undefined;
    } | undefined;
    retry?: {
        maxAttempts?: number | undefined;
        initialDelay?: number | undefined;
        maxDelay?: number | undefined;
        factor?: number | undefined;
        jitter?: boolean | undefined;
    } | undefined;
    logger?: Logger | undefined;
}>;
export type SDKConfig = z.infer<typeof SDKConfigSchema>;
export declare const PaymentMethodSchema: z.ZodEnum<["upi", "card", "netbanking", "wallet", "cod", "bank_transfer"]>;
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;
export declare const PaymentStatusSchema: z.ZodEnum<["created", "pending", "authorized", "captured", "failed", "refunded", "partially_refunded", "cancelled"]>;
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;
export declare const ProcessPaymentOptionsSchema: z.ZodObject<{
    currency: z.ZodDefault<z.ZodString>;
    customerEmail: z.ZodOptional<z.ZodString>;
    customerPhone: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    currency: string;
    customerEmail?: string | undefined;
    customerPhone?: string | undefined;
    description?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
}, {
    currency?: string | undefined;
    customerEmail?: string | undefined;
    customerPhone?: string | undefined;
    description?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
}>;
export type ProcessPaymentOptions = z.infer<typeof ProcessPaymentOptionsSchema>;
export declare const ProcessPaymentRequestSchema: z.ZodObject<{
    orderId: z.ZodString;
    amount: z.ZodNumber;
    method: z.ZodEnum<["upi", "card", "netbanking", "wallet", "cod", "bank_transfer"]>;
    options: z.ZodOptional<z.ZodObject<{
        currency: z.ZodDefault<z.ZodString>;
        customerEmail: z.ZodOptional<z.ZodString>;
        customerPhone: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        currency: string;
        customerEmail?: string | undefined;
        customerPhone?: string | undefined;
        description?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }, {
        currency?: string | undefined;
        customerEmail?: string | undefined;
        customerPhone?: string | undefined;
        description?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    orderId: string;
    amount: number;
    method: "upi" | "card" | "netbanking" | "wallet" | "cod" | "bank_transfer";
    options?: {
        currency: string;
        customerEmail?: string | undefined;
        customerPhone?: string | undefined;
        description?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    } | undefined;
}, {
    orderId: string;
    amount: number;
    method: "upi" | "card" | "netbanking" | "wallet" | "cod" | "bank_transfer";
    options?: {
        currency?: string | undefined;
        customerEmail?: string | undefined;
        customerPhone?: string | undefined;
        description?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    } | undefined;
}>;
export type ProcessPaymentRequest = z.infer<typeof ProcessPaymentRequestSchema>;
export declare const PaymentResultSchema: z.ZodObject<{
    paymentId: z.ZodString;
    orderId: z.ZodString;
    status: z.ZodEnum<["created", "pending", "authorized", "captured", "failed", "refunded", "partially_refunded", "cancelled"]>;
    amount: z.ZodNumber;
    currency: z.ZodString;
    method: z.ZodEnum<["upi", "card", "netbanking", "wallet", "cod", "bank_transfer"]>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    receiptUrl: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    status: "created" | "pending" | "authorized" | "captured" | "failed" | "refunded" | "partially_refunded" | "cancelled";
    currency: string;
    orderId: string;
    amount: number;
    method: "upi" | "card" | "netbanking" | "wallet" | "cod" | "bank_transfer";
    paymentId: string;
    createdAt: string;
    updatedAt: string;
    metadata?: Record<string, unknown> | undefined;
    receiptUrl?: string | undefined;
}, {
    status: "created" | "pending" | "authorized" | "captured" | "failed" | "refunded" | "partially_refunded" | "cancelled";
    currency: string;
    orderId: string;
    amount: number;
    method: "upi" | "card" | "netbanking" | "wallet" | "cod" | "bank_transfer";
    paymentId: string;
    createdAt: string;
    updatedAt: string;
    metadata?: Record<string, unknown> | undefined;
    receiptUrl?: string | undefined;
}>;
export type PaymentResult = z.infer<typeof PaymentResultSchema>;
export declare const WalletTransactionTypeSchema: z.ZodEnum<["credit", "debit", "refund", "cashback", "reversal"]>;
export type WalletTransactionType = z.infer<typeof WalletTransactionTypeSchema>;
export declare const WalletBalanceResultSchema: z.ZodObject<{
    userId: z.ZodString;
    balance: z.ZodNumber;
    currency: z.ZodString;
    availableBalance: z.ZodNumber;
    pendingBalance: z.ZodNumber;
    lastUpdated: z.ZodString;
}, "strip", z.ZodTypeAny, {
    currency: string;
    userId: string;
    balance: number;
    availableBalance: number;
    pendingBalance: number;
    lastUpdated: string;
}, {
    currency: string;
    userId: string;
    balance: number;
    availableBalance: number;
    pendingBalance: number;
    lastUpdated: string;
}>;
export type WalletBalanceResult = z.infer<typeof WalletBalanceResultSchema>;
export declare const WalletTransactionResultSchema: z.ZodObject<{
    transactionId: z.ZodString;
    userId: z.ZodString;
    type: z.ZodEnum<["credit", "debit", "refund", "cashback", "reversal"]>;
    amount: z.ZodNumber;
    currency: z.ZodString;
    balance: z.ZodNumber;
    status: z.ZodEnum<["pending", "completed", "failed", "reversed"]>;
    description: z.ZodOptional<z.ZodString>;
    reference: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "credit" | "debit" | "refund" | "cashback" | "reversal";
    status: "pending" | "failed" | "completed" | "reversed";
    currency: string;
    amount: number;
    createdAt: string;
    userId: string;
    balance: number;
    transactionId: string;
    description?: string | undefined;
    reference?: string | undefined;
}, {
    type: "credit" | "debit" | "refund" | "cashback" | "reversal";
    status: "pending" | "failed" | "completed" | "reversed";
    currency: string;
    amount: number;
    createdAt: string;
    userId: string;
    balance: number;
    transactionId: string;
    description?: string | undefined;
    reference?: string | undefined;
}>;
export type WalletTransactionResult = z.infer<typeof WalletTransactionResultSchema>;
export declare const OrderItemSchema: z.ZodObject<{
    productId: z.ZodString;
    quantity: z.ZodNumber;
    price: z.ZodNumber;
    name: z.ZodOptional<z.ZodString>;
    sku: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    productId: string;
    quantity: number;
    price: number;
    metadata?: Record<string, unknown> | undefined;
    name?: string | undefined;
    sku?: string | undefined;
}, {
    productId: string;
    quantity: number;
    price: number;
    metadata?: Record<string, unknown> | undefined;
    name?: string | undefined;
    sku?: string | undefined;
}>;
export type OrderItem = z.infer<typeof OrderItemSchema>;
export declare const AddressSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    line1: z.ZodString;
    line2: z.ZodOptional<z.ZodString>;
    city: z.ZodString;
    state: z.ZodString;
    postalCode: z.ZodString;
    country: z.ZodDefault<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    line1: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    name?: string | undefined;
    line2?: string | undefined;
    phone?: string | undefined;
}, {
    line1: string;
    city: string;
    state: string;
    postalCode: string;
    name?: string | undefined;
    line2?: string | undefined;
    country?: string | undefined;
    phone?: string | undefined;
}>;
export type Address = z.infer<typeof AddressSchema>;
export declare const OrderStatusSchema: z.ZodEnum<["created", "pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"]>;
export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export declare const CreateOrderRequestSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        productId: z.ZodString;
        quantity: z.ZodNumber;
        price: z.ZodNumber;
        name: z.ZodOptional<z.ZodString>;
        sku: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        productId: string;
        quantity: number;
        price: number;
        metadata?: Record<string, unknown> | undefined;
        name?: string | undefined;
        sku?: string | undefined;
    }, {
        productId: string;
        quantity: number;
        price: number;
        metadata?: Record<string, unknown> | undefined;
        name?: string | undefined;
        sku?: string | undefined;
    }>, "many">;
    customerId: z.ZodString;
    shippingAddress: z.ZodOptional<z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        line1: z.ZodString;
        line2: z.ZodOptional<z.ZodString>;
        city: z.ZodString;
        state: z.ZodString;
        postalCode: z.ZodString;
        country: z.ZodDefault<z.ZodString>;
        phone: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        name?: string | undefined;
        line2?: string | undefined;
        phone?: string | undefined;
    }, {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        name?: string | undefined;
        line2?: string | undefined;
        country?: string | undefined;
        phone?: string | undefined;
    }>>;
    billingAddress: z.ZodOptional<z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        line1: z.ZodString;
        line2: z.ZodOptional<z.ZodString>;
        city: z.ZodString;
        state: z.ZodString;
        postalCode: z.ZodString;
        country: z.ZodDefault<z.ZodString>;
        phone: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        name?: string | undefined;
        line2?: string | undefined;
        phone?: string | undefined;
    }, {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        name?: string | undefined;
        line2?: string | undefined;
        country?: string | undefined;
        phone?: string | undefined;
    }>>;
    paymentMethod: z.ZodOptional<z.ZodEnum<["upi", "card", "netbanking", "wallet", "cod", "bank_transfer"]>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    items: {
        productId: string;
        quantity: number;
        price: number;
        metadata?: Record<string, unknown> | undefined;
        name?: string | undefined;
        sku?: string | undefined;
    }[];
    customerId: string;
    metadata?: Record<string, unknown> | undefined;
    shippingAddress?: {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        name?: string | undefined;
        line2?: string | undefined;
        phone?: string | undefined;
    } | undefined;
    billingAddress?: {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        name?: string | undefined;
        line2?: string | undefined;
        phone?: string | undefined;
    } | undefined;
    paymentMethod?: "upi" | "card" | "netbanking" | "wallet" | "cod" | "bank_transfer" | undefined;
}, {
    items: {
        productId: string;
        quantity: number;
        price: number;
        metadata?: Record<string, unknown> | undefined;
        name?: string | undefined;
        sku?: string | undefined;
    }[];
    customerId: string;
    metadata?: Record<string, unknown> | undefined;
    shippingAddress?: {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        name?: string | undefined;
        line2?: string | undefined;
        country?: string | undefined;
        phone?: string | undefined;
    } | undefined;
    billingAddress?: {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        name?: string | undefined;
        line2?: string | undefined;
        country?: string | undefined;
        phone?: string | undefined;
    } | undefined;
    paymentMethod?: "upi" | "card" | "netbanking" | "wallet" | "cod" | "bank_transfer" | undefined;
}>;
export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>;
export declare const OrderResultSchema: z.ZodObject<{
    orderId: z.ZodString;
    customerId: z.ZodString;
    status: z.ZodEnum<["created", "pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"]>;
    items: z.ZodArray<z.ZodObject<{
        productId: z.ZodString;
        quantity: z.ZodNumber;
        price: z.ZodNumber;
        name: z.ZodOptional<z.ZodString>;
        sku: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        productId: string;
        quantity: number;
        price: number;
        metadata?: Record<string, unknown> | undefined;
        name?: string | undefined;
        sku?: string | undefined;
    }, {
        productId: string;
        quantity: number;
        price: number;
        metadata?: Record<string, unknown> | undefined;
        name?: string | undefined;
        sku?: string | undefined;
    }>, "many">;
    subtotal: z.ZodNumber;
    tax: z.ZodNumber;
    shipping: z.ZodNumber;
    total: z.ZodNumber;
    currency: z.ZodString;
    shippingAddress: z.ZodOptional<z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        line1: z.ZodString;
        line2: z.ZodOptional<z.ZodString>;
        city: z.ZodString;
        state: z.ZodString;
        postalCode: z.ZodString;
        country: z.ZodDefault<z.ZodString>;
        phone: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        name?: string | undefined;
        line2?: string | undefined;
        phone?: string | undefined;
    }, {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        name?: string | undefined;
        line2?: string | undefined;
        country?: string | undefined;
        phone?: string | undefined;
    }>>;
    billingAddress: z.ZodOptional<z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        line1: z.ZodString;
        line2: z.ZodOptional<z.ZodString>;
        city: z.ZodString;
        state: z.ZodString;
        postalCode: z.ZodString;
        country: z.ZodDefault<z.ZodString>;
        phone: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        name?: string | undefined;
        line2?: string | undefined;
        phone?: string | undefined;
    }, {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        name?: string | undefined;
        line2?: string | undefined;
        country?: string | undefined;
        phone?: string | undefined;
    }>>;
    paymentId: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    status: "created" | "pending" | "refunded" | "cancelled" | "confirmed" | "processing" | "shipped" | "delivered";
    currency: string;
    orderId: string;
    createdAt: string;
    updatedAt: string;
    items: {
        productId: string;
        quantity: number;
        price: number;
        metadata?: Record<string, unknown> | undefined;
        name?: string | undefined;
        sku?: string | undefined;
    }[];
    customerId: string;
    subtotal: number;
    tax: number;
    shipping: number;
    total: number;
    metadata?: Record<string, unknown> | undefined;
    paymentId?: string | undefined;
    shippingAddress?: {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        name?: string | undefined;
        line2?: string | undefined;
        phone?: string | undefined;
    } | undefined;
    billingAddress?: {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        name?: string | undefined;
        line2?: string | undefined;
        phone?: string | undefined;
    } | undefined;
}, {
    status: "created" | "pending" | "refunded" | "cancelled" | "confirmed" | "processing" | "shipped" | "delivered";
    currency: string;
    orderId: string;
    createdAt: string;
    updatedAt: string;
    items: {
        productId: string;
        quantity: number;
        price: number;
        metadata?: Record<string, unknown> | undefined;
        name?: string | undefined;
        sku?: string | undefined;
    }[];
    customerId: string;
    subtotal: number;
    tax: number;
    shipping: number;
    total: number;
    metadata?: Record<string, unknown> | undefined;
    paymentId?: string | undefined;
    shippingAddress?: {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        name?: string | undefined;
        line2?: string | undefined;
        country?: string | undefined;
        phone?: string | undefined;
    } | undefined;
    billingAddress?: {
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        name?: string | undefined;
        line2?: string | undefined;
        country?: string | undefined;
        phone?: string | undefined;
    } | undefined;
}>;
export type OrderResult = z.infer<typeof OrderResultSchema>;
export declare const BookingServiceTypeSchema: z.ZodEnum<["hotel", "flight", "train", "bus", "cab", "experience", "restaurant", "spa", "event"]>;
export type BookingServiceType = z.infer<typeof BookingServiceTypeSchema>;
export declare const BookingStatusSchema: z.ZodEnum<["pending", "confirmed", "cancelled", "completed", "failed", "on_hold"]>;
export type BookingStatus = z.infer<typeof BookingStatusSchema>;
export declare const CreateBookingRequestSchema: z.ZodObject<{
    serviceType: z.ZodEnum<["hotel", "flight", "train", "bus", "cab", "experience", "restaurant", "spa", "event"]>;
    serviceId: z.ZodString;
    checkIn: z.ZodOptional<z.ZodString>;
    checkOut: z.ZodOptional<z.ZodString>;
    guestDetails: z.ZodOptional<z.ZodObject<{
        name: z.ZodString;
        email: z.ZodOptional<z.ZodString>;
        phone: z.ZodOptional<z.ZodString>;
        adults: z.ZodDefault<z.ZodNumber>;
        children: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        adults: number;
        children: number;
        phone?: string | undefined;
        email?: string | undefined;
    }, {
        name: string;
        phone?: string | undefined;
        email?: string | undefined;
        adults?: number | undefined;
        children?: number | undefined;
    }>>;
    customerId: z.ZodString;
    paymentMethod: z.ZodOptional<z.ZodEnum<["upi", "card", "netbanking", "wallet", "cod", "bank_transfer"]>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    customerId: string;
    serviceType: "hotel" | "flight" | "train" | "bus" | "cab" | "experience" | "restaurant" | "spa" | "event";
    serviceId: string;
    metadata?: Record<string, unknown> | undefined;
    paymentMethod?: "upi" | "card" | "netbanking" | "wallet" | "cod" | "bank_transfer" | undefined;
    checkIn?: string | undefined;
    checkOut?: string | undefined;
    guestDetails?: {
        name: string;
        adults: number;
        children: number;
        phone?: string | undefined;
        email?: string | undefined;
    } | undefined;
}, {
    customerId: string;
    serviceType: "hotel" | "flight" | "train" | "bus" | "cab" | "experience" | "restaurant" | "spa" | "event";
    serviceId: string;
    metadata?: Record<string, unknown> | undefined;
    paymentMethod?: "upi" | "card" | "netbanking" | "wallet" | "cod" | "bank_transfer" | undefined;
    checkIn?: string | undefined;
    checkOut?: string | undefined;
    guestDetails?: {
        name: string;
        phone?: string | undefined;
        email?: string | undefined;
        adults?: number | undefined;
        children?: number | undefined;
    } | undefined;
}>;
export type CreateBookingRequest = z.infer<typeof CreateBookingRequestSchema>;
export declare const BookingResultSchema: z.ZodObject<{
    bookingId: z.ZodString;
    serviceType: z.ZodEnum<["hotel", "flight", "train", "bus", "cab", "experience", "restaurant", "spa", "event"]>;
    serviceId: z.ZodString;
    customerId: z.ZodString;
    status: z.ZodEnum<["pending", "confirmed", "cancelled", "completed", "failed", "on_hold"]>;
    checkIn: z.ZodOptional<z.ZodString>;
    checkOut: z.ZodOptional<z.ZodString>;
    confirmationCode: z.ZodOptional<z.ZodString>;
    totalAmount: z.ZodNumber;
    currency: z.ZodString;
    paymentId: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "failed" | "cancelled" | "completed" | "confirmed" | "on_hold";
    currency: string;
    createdAt: string;
    updatedAt: string;
    customerId: string;
    serviceType: "hotel" | "flight" | "train" | "bus" | "cab" | "experience" | "restaurant" | "spa" | "event";
    serviceId: string;
    bookingId: string;
    totalAmount: number;
    metadata?: Record<string, unknown> | undefined;
    paymentId?: string | undefined;
    checkIn?: string | undefined;
    checkOut?: string | undefined;
    confirmationCode?: string | undefined;
}, {
    status: "pending" | "failed" | "cancelled" | "completed" | "confirmed" | "on_hold";
    currency: string;
    createdAt: string;
    updatedAt: string;
    customerId: string;
    serviceType: "hotel" | "flight" | "train" | "bus" | "cab" | "experience" | "restaurant" | "spa" | "event";
    serviceId: string;
    bookingId: string;
    totalAmount: number;
    metadata?: Record<string, unknown> | undefined;
    paymentId?: string | undefined;
    checkIn?: string | undefined;
    checkOut?: string | undefined;
    confirmationCode?: string | undefined;
}>;
export type BookingResult = z.infer<typeof BookingResultSchema>;
export declare const NotificationChannelSchema: z.ZodEnum<["email", "sms", "push", "whatsapp", "in_app"]>;
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;
export declare const NotificationTemplateSchema: z.ZodEnum<["order_confirmation", "order_shipped", "order_delivered", "payment_success", "payment_failed", "refund_initiated", "refund_completed", "booking_confirmed", "booking_cancelled", "promo_offer", "welcome", "password_reset", "custom"]>;
export type NotificationTemplate = z.infer<typeof NotificationTemplateSchema>;
export declare const SendNotificationRequestSchema: z.ZodObject<{
    userId: z.ZodString;
    template: z.ZodEnum<["order_confirmation", "order_shipped", "order_delivered", "payment_success", "payment_failed", "refund_initiated", "refund_completed", "booking_confirmed", "booking_cancelled", "promo_offer", "welcome", "password_reset", "custom"]>;
    channel: z.ZodDefault<z.ZodUnion<[z.ZodEnum<["email", "sms", "push", "whatsapp", "in_app"]>, z.ZodArray<z.ZodEnum<["email", "sms", "push", "whatsapp", "in_app"]>, "many">]>>;
    data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    priority: z.ZodDefault<z.ZodEnum<["high", "normal", "low"]>>;
    scheduledAt: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    userId: string;
    template: "custom" | "order_confirmation" | "order_shipped" | "order_delivered" | "payment_success" | "payment_failed" | "refund_initiated" | "refund_completed" | "booking_confirmed" | "booking_cancelled" | "promo_offer" | "welcome" | "password_reset";
    channel: "push" | "email" | "sms" | "whatsapp" | "in_app" | ("push" | "email" | "sms" | "whatsapp" | "in_app")[];
    data: Record<string, unknown>;
    priority: "high" | "normal" | "low";
    metadata?: Record<string, unknown> | undefined;
    scheduledAt?: string | undefined;
}, {
    userId: string;
    template: "custom" | "order_confirmation" | "order_shipped" | "order_delivered" | "payment_success" | "payment_failed" | "refund_initiated" | "refund_completed" | "booking_confirmed" | "booking_cancelled" | "promo_offer" | "welcome" | "password_reset";
    data: Record<string, unknown>;
    metadata?: Record<string, unknown> | undefined;
    channel?: "push" | "email" | "sms" | "whatsapp" | "in_app" | ("push" | "email" | "sms" | "whatsapp" | "in_app")[] | undefined;
    priority?: "high" | "normal" | "low" | undefined;
    scheduledAt?: string | undefined;
}>;
export type SendNotificationRequest = z.infer<typeof SendNotificationRequestSchema>;
export declare const NotificationResultSchema: z.ZodObject<{
    notificationId: z.ZodString;
    userId: z.ZodString;
    template: z.ZodEnum<["order_confirmation", "order_shipped", "order_delivered", "payment_success", "payment_failed", "refund_initiated", "refund_completed", "booking_confirmed", "booking_cancelled", "promo_offer", "welcome", "password_reset", "custom"]>;
    channel: z.ZodEnum<["email", "sms", "push", "whatsapp", "in_app"]>;
    status: z.ZodEnum<["queued", "sent", "delivered", "failed"]>;
    sentAt: z.ZodOptional<z.ZodString>;
    deliveredAt: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    status: "failed" | "delivered" | "queued" | "sent";
    userId: string;
    template: "custom" | "order_confirmation" | "order_shipped" | "order_delivered" | "payment_success" | "payment_failed" | "refund_initiated" | "refund_completed" | "booking_confirmed" | "booking_cancelled" | "promo_offer" | "welcome" | "password_reset";
    channel: "push" | "email" | "sms" | "whatsapp" | "in_app";
    notificationId: string;
    metadata?: Record<string, unknown> | undefined;
    sentAt?: string | undefined;
    deliveredAt?: string | undefined;
}, {
    status: "failed" | "delivered" | "queued" | "sent";
    userId: string;
    template: "custom" | "order_confirmation" | "order_shipped" | "order_delivered" | "payment_success" | "payment_failed" | "refund_initiated" | "refund_completed" | "booking_confirmed" | "booking_cancelled" | "promo_offer" | "welcome" | "password_reset";
    channel: "push" | "email" | "sms" | "whatsapp" | "in_app";
    notificationId: string;
    metadata?: Record<string, unknown> | undefined;
    sentAt?: string | undefined;
    deliveredAt?: string | undefined;
}>;
export type NotificationResult = z.infer<typeof NotificationResultSchema>;
export declare const TrackEventRequestSchema: z.ZodObject<{
    event: z.ZodString;
    data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    timestamp: z.ZodOptional<z.ZodString>;
    userId: z.ZodOptional<z.ZodString>;
    sessionId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    event: string;
    data: Record<string, unknown>;
    userId?: string | undefined;
    timestamp?: string | undefined;
    sessionId?: string | undefined;
}, {
    event: string;
    data: Record<string, unknown>;
    userId?: string | undefined;
    timestamp?: string | undefined;
    sessionId?: string | undefined;
}>;
export type TrackEventRequest = z.infer<typeof TrackEventRequestSchema>;
export declare const AnalyticsResultSchema: z.ZodObject<{
    eventId: z.ZodString;
    event: z.ZodString;
    timestamp: z.ZodString;
    processed: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    event: string;
    timestamp: string;
    eventId: string;
    processed: boolean;
}, {
    event: string;
    timestamp: string;
    eventId: string;
    processed: boolean;
}>;
export type AnalyticsResult = z.infer<typeof AnalyticsResultSchema>;
export declare const ProductSearchFiltersSchema: z.ZodObject<{
    query: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
    priceRange: z.ZodOptional<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
    rating: z.ZodOptional<z.ZodNumber>;
    inStock: z.ZodOptional<z.ZodBoolean>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    sortBy: z.ZodOptional<z.ZodEnum<["price", "rating", "popularity", "newest"]>>;
    sortOrder: z.ZodOptional<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    query?: string | undefined;
    category?: string | undefined;
    priceRange?: [number, number] | undefined;
    rating?: number | undefined;
    inStock?: boolean | undefined;
    tags?: string[] | undefined;
    sortBy?: "price" | "rating" | "popularity" | "newest" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}, {
    query?: string | undefined;
    category?: string | undefined;
    priceRange?: [number, number] | undefined;
    rating?: number | undefined;
    inStock?: boolean | undefined;
    tags?: string[] | undefined;
    sortBy?: "price" | "rating" | "popularity" | "newest" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}>;
export type ProductSearchFilters = z.infer<typeof ProductSearchFiltersSchema>;
export declare const ProductSchema: z.ZodObject<{
    productId: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    price: z.ZodNumber;
    currency: z.ZodString;
    images: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    category: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    rating: z.ZodOptional<z.ZodNumber>;
    reviewCount: z.ZodOptional<z.ZodNumber>;
    inStock: z.ZodBoolean;
    availableQuantity: z.ZodOptional<z.ZodNumber>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    currency: string;
    productId: string;
    price: number;
    name: string;
    inStock: boolean;
    description?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    category?: string | undefined;
    rating?: number | undefined;
    tags?: string[] | undefined;
    images?: string[] | undefined;
    reviewCount?: number | undefined;
    availableQuantity?: number | undefined;
}, {
    currency: string;
    productId: string;
    price: number;
    name: string;
    inStock: boolean;
    description?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    category?: string | undefined;
    rating?: number | undefined;
    tags?: string[] | undefined;
    images?: string[] | undefined;
    reviewCount?: number | undefined;
    availableQuantity?: number | undefined;
}>;
export type Product = z.infer<typeof ProductSchema>;
export declare const ProductSearchResultSchema: z.ZodObject<{
    products: z.ZodArray<z.ZodObject<{
        productId: z.ZodString;
        name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        price: z.ZodNumber;
        currency: z.ZodString;
        images: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        category: z.ZodOptional<z.ZodString>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        rating: z.ZodOptional<z.ZodNumber>;
        reviewCount: z.ZodOptional<z.ZodNumber>;
        inStock: z.ZodBoolean;
        availableQuantity: z.ZodOptional<z.ZodNumber>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        currency: string;
        productId: string;
        price: number;
        name: string;
        inStock: boolean;
        description?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
        category?: string | undefined;
        rating?: number | undefined;
        tags?: string[] | undefined;
        images?: string[] | undefined;
        reviewCount?: number | undefined;
        availableQuantity?: number | undefined;
    }, {
        currency: string;
        productId: string;
        price: number;
        name: string;
        inStock: boolean;
        description?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
        category?: string | undefined;
        rating?: number | undefined;
        tags?: string[] | undefined;
        images?: string[] | undefined;
        reviewCount?: number | undefined;
        availableQuantity?: number | undefined;
    }>, "many">;
    total: z.ZodNumber;
    page: z.ZodNumber;
    pageSize: z.ZodNumber;
    totalPages: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    total: number;
    products: {
        currency: string;
        productId: string;
        price: number;
        name: string;
        inStock: boolean;
        description?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
        category?: string | undefined;
        rating?: number | undefined;
        tags?: string[] | undefined;
        images?: string[] | undefined;
        reviewCount?: number | undefined;
        availableQuantity?: number | undefined;
    }[];
    page: number;
    pageSize: number;
    totalPages: number;
}, {
    total: number;
    products: {
        currency: string;
        productId: string;
        price: number;
        name: string;
        inStock: boolean;
        description?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
        category?: string | undefined;
        rating?: number | undefined;
        tags?: string[] | undefined;
        images?: string[] | undefined;
        reviewCount?: number | undefined;
        availableQuantity?: number | undefined;
    }[];
    page: number;
    pageSize: number;
    totalPages: number;
}>;
export type ProductSearchResult = z.infer<typeof ProductSearchResultSchema>;
export declare const ServiceHealthSchema: z.ZodObject<{
    status: z.ZodEnum<["healthy", "degraded", "unhealthy", "unknown"]>;
    latency: z.ZodOptional<z.ZodNumber>;
    lastChecked: z.ZodString;
    error: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "unknown" | "healthy" | "degraded" | "unhealthy";
    lastChecked: string;
    latency?: number | undefined;
    error?: string | undefined;
}, {
    status: "unknown" | "healthy" | "degraded" | "unhealthy";
    lastChecked: string;
    latency?: number | undefined;
    error?: string | undefined;
}>;
export type ServiceHealth = z.infer<typeof ServiceHealthSchema>;
export declare const HealthStatusSchema: z.ZodObject<{
    overall: z.ZodEnum<["healthy", "degraded", "unhealthy", "unknown"]>;
    services: z.ZodRecord<z.ZodString, z.ZodObject<{
        status: z.ZodEnum<["healthy", "degraded", "unhealthy", "unknown"]>;
        latency: z.ZodOptional<z.ZodNumber>;
        lastChecked: z.ZodString;
        error: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "unknown" | "healthy" | "degraded" | "unhealthy";
        lastChecked: string;
        latency?: number | undefined;
        error?: string | undefined;
    }, {
        status: "unknown" | "healthy" | "degraded" | "unhealthy";
        lastChecked: string;
        latency?: number | undefined;
        error?: string | undefined;
    }>>;
    checkedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    services: Record<string, {
        status: "unknown" | "healthy" | "degraded" | "unhealthy";
        lastChecked: string;
        latency?: number | undefined;
        error?: string | undefined;
    }>;
    overall: "unknown" | "healthy" | "degraded" | "unhealthy";
    checkedAt: string;
}, {
    services: Record<string, {
        status: "unknown" | "healthy" | "degraded" | "unhealthy";
        lastChecked: string;
        latency?: number | undefined;
        error?: string | undefined;
    }>;
    overall: "unknown" | "healthy" | "degraded" | "unhealthy";
    checkedAt: string;
}>;
export type HealthStatus = z.infer<typeof HealthStatusSchema>;
export declare const EventPayloadSchema: z.ZodObject<{
    type: z.ZodString;
    payload: z.ZodUnknown;
    timestamp: z.ZodDefault<z.ZodString>;
    source: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    type: string;
    timestamp: string;
    metadata?: Record<string, unknown> | undefined;
    payload?: unknown;
    source?: string | undefined;
}, {
    type: string;
    metadata?: Record<string, unknown> | undefined;
    timestamp?: string | undefined;
    payload?: unknown;
    source?: string | undefined;
}>;
export type EventPayload = z.infer<typeof EventPayloadSchema>;
export declare class SDKError extends Error {
    readonly code: string;
    readonly statusCode?: number | undefined;
    readonly details?: Record<string, unknown> | undefined;
    constructor(message: string, code: string, statusCode?: number | undefined, details?: Record<string, unknown> | undefined);
}
export declare class ServiceError extends SDKError {
    readonly service: string;
    constructor(message: string, statusCode: number, service: string, details?: Record<string, unknown>);
}
export declare class CircuitOpenError extends SDKError {
    readonly service: string;
    readonly failureCount: number;
    constructor(service: string, failureCount: number);
}
export declare class ValidationError extends SDKError {
    readonly validationErrors: z.ZodError['errors'];
    constructor(message: string, validationErrors: z.ZodError['errors']);
}
export declare class AuthenticationError extends SDKError {
    readonly service: string;
    constructor(message: string, service: string);
}
export declare class TimeoutError extends SDKError {
    readonly service: string;
    readonly timeout: number;
    constructor(service: string, timeout: number);
}
export declare class RetryExhaustedError extends SDKError {
    readonly service: string;
    readonly attempts: number;
    readonly lastError: Error;
    constructor(message: string, service: string, attempts: number, lastError: Error);
}
export interface HttpRequestConfig {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    url: string;
    headers?: Record<string, string>;
    data?: unknown;
    params?: Record<string, string>;
    timeout?: number;
}
export interface HttpResponse<T> {
    data: T;
    status: number;
    statusText: string;
    headers: Record<string, string>;
}
export interface HttpClient {
    request<T>(config: HttpRequestConfig): Promise<HttpResponse<T>>;
}
export interface Logger {
    error(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    info(message: string, meta?: Record<string, unknown>): void;
    debug(message: string, meta?: Record<string, unknown>): void;
}
//# sourceMappingURL=index.d.ts.map