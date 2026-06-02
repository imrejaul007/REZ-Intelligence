/**
 * @rez/shared — canonical type definitions barrel
 *
 * Re-exports all entity types from the single source of truth.
 * Import with:
 *   import type { User, UserRole } from '@rez/shared/types';
 *   import type { Order, OrderTotals } from '@rez/shared/types';
 */

export * from './user.types';
export * from './merchant.types';
export * from './offer.types';
export * from './order.types';
export * from './wallet.types';
export * from './booking.types';
export * from './campaign.types';
export * from './razorpay.types';

// Re-export API response types for convenience
export * from './api';
