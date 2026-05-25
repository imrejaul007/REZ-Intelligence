/**
 * REZ Geo Intelligence Core - Services Index
 */

export { graphService } from './graphService.js';
export { eventGraphService } from './eventGraphService.js';
export type { ZEventsEvent, EventBookingSignal } from './eventGraphService.js';
export { demandPredictionService } from './demandService.js';
export { recommendationService } from './recommendationService.js';
export type { RecommendationContext } from './recommendationService.js';
export { eventBusIntegration, GEOSUBSCRIBED_EVENTS } from './eventBusIntegration.js';
export type {
  ZEventsEventPayload,
  ZEventsBookingPayload,
  UserLocationPayload,
  ZEventsCheckinPayload
} from './eventBusIntegration.js';

// Zone Hierarchy & Synthetic Demand (NEW)
export { zoneHierarchyService, ZoneHierarchyService } from './zoneHierarchyService.js';
export {
  CityZoneModel,
  DistrictZoneModel,
  NeighborhoodZoneModel,
  MicroZoneModel,
  VenueClusterModel
} from './zoneHierarchyService.js';
export { syntheticDemandService } from './syntheticDemandService.js';
// Note: SyntheticDemandService is a class but not exported as type in the source file
// Use InstanceType<typeof SyntheticDemandService> if needed
export { SyntheticDemandIndexModel } from './syntheticDemandService.js';
