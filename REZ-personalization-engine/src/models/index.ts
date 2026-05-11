/**
 * Models index - TypeScript exports
 * Migration from JavaScript to TypeScript
 */

export { ContentItem, default as ContentItemModel } from './ContentItem';
export { Interaction, default as InteractionModel } from './Interaction';
export { PersonalizationCampaign, default as PersonalizationCampaignModel } from './PersonalizationCampaign';
export { UserDNAProfile, default as UserDNAProfileModel } from './UserDNAProfile';

// Re-export types for convenience
export type {
  IContentItem,
  IContentItemDocument,
  IContentItemModel,
  IInteraction,
  IInteractionDocument,
  IInteractionModel,
  IPersonalizationCampaign,
  IPersonalizationCampaignDocument,
  IPersonalizationCampaignModel,
  IUserDNAProfile,
  IUserDNAProfileDocument,
  IUserDNAProfileModel,
} from '../types/index';
