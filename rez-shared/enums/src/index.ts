// Canonical enum registry for REZ ecosystem

export enum OrderStatus {
  CART = 'CART',
  CHECKOUT = 'CHECKOUT',
  PAID = 'PAID',
  FULFILLED = 'FULFILLED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentStatus {
  INIT = 'INIT',
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  MERCHANT = 'MERCHANT',
  ADMIN = 'ADMIN',
  SUPPORT = 'SUPPORT',
}

export enum TransactionType {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
  REFUND = 'REFUND',
  CHARGEBACK = 'CHARGEBACK',
}

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
  IN_APP = 'IN_APP',
}

// Helper functions for enum operations
export const OrderStatusValues = Object.values(OrderStatus);
export const PaymentStatusValues = Object.values(PaymentStatus);
export const UserRoleValues = Object.values(UserRole);

export const isValidOrderStatus = (status: string): status is OrderStatus =>
  OrderStatusValues.includes(status as OrderStatus);

export const isValidPaymentStatus = (status: string): status is PaymentStatus =>
  PaymentStatusValues.includes(status as PaymentStatus);

export const isValidUserRole = (role: string): role is UserRole =>
  UserRoleValues.includes(role as UserRole);
