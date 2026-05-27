export { locationService, LocationService } from './locationService.js';
export { analyticsService, AnalyticsService } from './analyticsService.js';
export { segmentService, SegmentService } from './segmentService.js';

export {
  detectAllPatterns,
  detectCommuterPattern,
  detectMallGoerPattern,
  detectTravelerPattern,
  detectGymEnthusiastPattern,
  detectFoodiePattern,
  detectExplorerPattern,
  getPrimaryPattern
} from './patternDetectionService.js';

export {
  classifyUserSegments,
  getSegmentDescription,
  getAllSegments
} from './segmentService.js';
