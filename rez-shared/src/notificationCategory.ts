// DM-HIGH-04: Canonical notification categories
// All notification services must use these exported values for consistent categorization.

export const NOTIFICATION_CATEGORIES = {
  ORDER: 'order',
  PAYMENT: 'payment',
  LOYALTY: 'loyalty',
  PROMOTION: 'promotion',
  ACCOUNT: 'account',
  SECURITY: 'security',
  SUPPORT: 'support',
  SYSTEM: 'system',
  MARKETING: 'marketing',
  OFFER: 'offer',
} as const;
export type NotificationCategory = typeof NOTIFICATION_CATEGORIES[keyof typeof NOTIFICATION_CATEGORIES];
