// Services barrel export
export {
  aggregateSignals,
  updateCategorySignals,
  fetchLocationSignals,
  fetchBehavioralSignals,
  fetchSocialSignals,
  fetchCompetitorSignals,
  checkSignalServicesHealth,
  default as signalAggregator
} from './signalAggregator.js';

export {
  createProfile,
  getProfile,
  getProfileByIdentifier,
  enrichProfile,
  mergeProfiles,
  searchProfiles,
  getProfilesBySegment,
  getSegmentStats,
  updateProfileSegments,
  deleteProfile,
  default as profileService
} from './profileService.js';
