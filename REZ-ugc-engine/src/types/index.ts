/**
 * REZ UGC Engine - Types
 */

export type UGCType = 'review' | 'photo' | 'video' | 'comment' | 'answer' | 'tip';

export interface UGCContent {
  id: string;
  type: UGCType;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  entityType: 'product' | 'merchant' | 'order';
  entityId: string;
  title?: string;
  content: string;
  media?: Media[];
  rating?: number; // 1-5
  upvotes: number;
  downvotes: number;
  status: 'pending' | 'approved' | 'rejected';
  moderationReason?: string;
  verified: boolean; // Verified purchase
  featured: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Media {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnail?: string;
  width?: number;
  height?: number;
}

export interface UGCEngagement {
  id: string;
  contentId: string;
  userId: string;
  action: 'view' | 'like' | 'comment' | 'share' | 'save';
  createdAt: Date;
}

export interface UGCModeration {
  id: string;
  contentId: string;
  type: 'auto' | 'manual';
  action: 'approve' | 'reject' | 'flag';
  reason?: string;
  moderatorId?: string;
  reviewedAt: Date;
}

export interface UGCReport {
  id: string;
  contentId: string;
  reporterId: string;
  reason: 'spam' | 'abuse' | 'fake' | 'inappropriate' | 'copyright';
  description?: string;
  status: 'pending' | 'reviewed' | 'resolved';
  resolution?: string;
  createdAt: Date;
}

export interface UGCRights {
  id: string;
  contentId: string;
  ownerId: string;
  license: 'all_rights_reserved' | 'cc_by' | 'cc_by_nc' | 'commercial';
  canReuse: boolean;
  canModify: boolean;
  canCommercialize: boolean;
}

export interface UGCStats {
  entityType: string;
  entityId: string;
  totalContent: number;
  avgRating: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  verifiedReviews: number;
}
