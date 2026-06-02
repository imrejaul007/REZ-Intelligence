export declare enum OrderStatus {
    CART = "CART",
    CHECKOUT = "CHECKOUT",
    PAID = "PAID",
    FULFILLED = "FULFILLED",
    DELIVERED = "DELIVERED",
    CANCELLED = "CANCELLED",
    REFUNDED = "REFUNDED"
}
export declare enum PaymentStatus {
    INIT = "INIT",
    PENDING = "PENDING",
    SUCCESS = "SUCCESS",
    FAILED = "FAILED"
}
export declare enum UserRole {
    CUSTOMER = "CUSTOMER",
    MERCHANT = "MERCHANT",
    ADMIN = "ADMIN",
    SUPPORT = "SUPPORT"
}
export declare enum TransactionType {
    DEBIT = "DEBIT",
    CREDIT = "CREDIT",
    REFUND = "REFUND",
    CHARGEBACK = "CHARGEBACK"
}
export declare enum NotificationChannel {
    EMAIL = "EMAIL",
    SMS = "SMS",
    PUSH = "PUSH",
    IN_APP = "IN_APP"
}
export declare const OrderStatusValues: OrderStatus[];
export declare const PaymentStatusValues: PaymentStatus[];
export declare const UserRoleValues: UserRole[];
export declare const isValidOrderStatus: (status: string) => status is OrderStatus;
export declare const isValidPaymentStatus: (status: string) => status is PaymentStatus;
export declare const isValidUserRole: (role: string) => role is UserRole;
