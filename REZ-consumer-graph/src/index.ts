/**
 * REZ Consumer Graph - Unified Consumer Identity
 * Main entry point for the Consumer Graph service
 */

export { ConsumerGraph } from './ConsumerGraph';
export { ConsumerProfile } from './ConsumerProfile';
export { IdentityResolver } from './IdentityResolver';
export { GraphEngine } from './graph/GraphEngine';
export { RelationshipMapper } from './graph/RelationshipMapper';
export { DeviceResolver } from './identity/DeviceResolver';
export { CrossPlatformLinker } from './identity/CrossPlatformLinker';

// Module exports
export { WalletModule } from './modules/WalletModule';
export { BrowsingModule } from './modules/BrowsingModule';
export { LoyaltyModule } from './modules/LoyaltyModule';
export { PaymentModule } from './modules/PaymentModule';
export { DOOHModule } from './modules/DOOHModule';
export { ReferralModule } from './modules/ReferralModule';
export { HotelModule } from './modules/HotelModule';
export { IntentModule } from './modules/IntentModule';

// Types
export * from './types';
