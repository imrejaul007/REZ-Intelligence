import { z } from 'zod';

// OpenAPI schema registry for cross-service contracts
export const OpenAPISchemaRegistry = {
  version: '3.0.0',
  info: {
    title: 'REZ API',
    version: '1.0.0',
    description: 'Canonical API contracts for REZ ecosystem',
  },
};

// Zod-based schema definitions for runtime validation
export const PaymentSchema = z.object({
  id: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  status: z.enum(['INIT', 'PENDING', 'SUCCESS', 'FAILED']),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const OrderSchema = z.object({
  id: z.string().uuid(),
  paymentId: z.string().uuid(),
  status: z.enum(['CART', 'CHECKOUT', 'PAID', 'FULFILLED', 'DELIVERED', 'CANCELLED', 'REFUNDED']),
  items: z.array(z.object({
    sku: z.string(),
    quantity: z.number().int().positive(),
    price: z.number().positive(),
  })),
  total: z.number().positive(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// tRPC procedure definitions (placeholder for actual tRPC router)
export const APIContractRegistry = {
  payment: {
    create: PaymentSchema,
    update: PaymentSchema.partial(),
  },
  order: {
    create: OrderSchema,
    get: OrderSchema.pick({ id: true }),
  },
};

export type Payment = z.infer<typeof PaymentSchema>;
export type Order = z.infer<typeof OrderSchema>;
