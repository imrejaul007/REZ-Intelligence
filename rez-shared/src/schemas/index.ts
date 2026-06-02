// Selective exports to avoid duplicate exports
// validationSchemas exports CreateProductRequest, UpdateOrderStatusRequest
// zod exports the same - prefer zod schemas
export {
  ProductImageSchema,
  ProductPricingSchema,
  ProductRatingSchema,
  CreateProductSchema,
  UpdateProductSchema,
  ProductResponseSchema,
  ProductListResponseSchema,
  type CreateProductRequest,
  type UpdateProductRequest,
  type ProductResponse,
  type ProductListResponse,
} from './zod/product.schema';

export {
  ORDER_STATUS,
  OrderItemSchema,
  OrderTotalsSchema,
  OrderPaymentSchema,
  OrderDeliverySchema,
  CreateOrderSchema,
  UpdateOrderStatusSchema,
  OrderResponseSchema,
  OrderListResponseSchema,
  type CreateOrderRequest,
  type UpdateOrderStatusRequest,
  type OrderResponse,
  type OrderListResponse,
  type OrderStatus,
} from './zod/order.schema';

export {
  PAYMENT_STATUS,
  PAYMENT_METHOD,
  PAYMENT_GATEWAY,
  PAYMENT_PURPOSE,
  PaymentUserDetailsSchema,
  PaymentGatewayResponseSchema,
  CreatePaymentSchema,
  UpdatePaymentStatusSchema,
  PaymentResponseSchema,
  PaymentListResponseSchema,
  type CreatePaymentRequest,
  type UpdatePaymentStatusRequest,
  type PaymentResponse,
  type PaymentListResponse,
  type PaymentStatus,
  type PaymentMethod,
  type PaymentGateway,
  type PaymentPurpose,
} from './zod/payment.schema';

export {
  COIN_TYPE,
  COIN_TRANSACTION_TYPE,
  TRANSACTION_STATUS,
  WalletBalanceSchema,
  CoinSchema,
  WalletDebitSchema,
  WalletCreditSchema,
  CoinTransactionResponseSchema,
  CoinTransactionListResponseSchema,
  WalletBalanceResponseSchema,
  type WalletDebitRequest,
  type WalletCreditRequest,
  type CoinTransactionResponse,
  type CoinTransactionListResponse,
  type WalletBalanceResponse,
  type CoinType,
  type CoinTransactionType,
  type TransactionStatus,
} from './zod/wallet.schema';

// API contracts
export * from './apiContracts';
