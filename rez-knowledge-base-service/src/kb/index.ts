/**
 * Knowledge Base Index
 * Exports all QR context knowledge bases
 */

// Hotel Room Service KB
export { hotelRoomKB } from './hotel-room';
export type { HotelRoomKB } from './hotel-room';

// Restaurant Menu KB
export { restaurantMenuKB } from './restaurant-menu';
export type { RestaurantMenuKB } from './restaurant-menu';

// Store Merchant KB
export { storeMerchantKB } from './store-merchant';
export type { StoreMerchantKB } from './store-merchant';

// Campaign/Ads KB
export { campaignAdsKB } from './campaign-ads';
export type { CampaignAdsKB } from './campaign-ads';

// Unified Router
export {
  UnifiedKnowledgeRouter,
  routeToKnowledgeBase,
  detectQueryContext,
  createContextFromQR,
  matchQueryIntent,
  searchKBItems,
  getQuestionResponse,
  QRContextSource,
  getAllKnowledgeBases
} from './unifiedRouter';
export type {
  QRContextSource as QRContextSourceType,
  QRContext,
  KnowledgeBaseInfo
} from './unifiedRouter';

// ====== RE-EXPORT TYPES FOR CONVENIENCE ======

import type { HotelRoomKB } from './hotel-room';
import type { RestaurantMenuKB } from './restaurant-menu';
import type { StoreMerchantKB } from './store-merchant';
import type { CampaignAdsKB } from './campaign-ads';
import type { QRContext, QRContextSource } from './unifiedRouter';

export type AllKnowledgeBases = {
  hotelRoom: HotelRoomKB;
  restaurantMenu: RestaurantMenuKB;
  storeMerchant: StoreMerchantKB;
  campaignAds: CampaignAdsKB;
};

export type KnowledgeBaseUnion = HotelRoomKB | RestaurantMenuKB | StoreMerchantKB | CampaignAdsKB;
