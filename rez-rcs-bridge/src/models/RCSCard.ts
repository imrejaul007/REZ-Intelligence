import { z } from 'zod';

/**
 * RCS Button Types supported by carriers
 */
export enum RCSButtonType {
  URL = 'url',
  PHONE = 'phone',
  REPLY = 'reply',
  QUICK_REPLY = 'quickReply',
  COPY = 'copy',
  LOCATION = 'location',
}

/**
 * RCS Button schema with validation
 */
export const RCSButtonSchema = z.object({
  type: z.nativeEnum(RCSButtonType),
  title: z.string().min(1).max(25),
  value: z.string().max(500).optional(),
  url: z.string().url().optional(),
  phoneNumber: z.string().optional(),
});

export type RCSButton = z.infer<typeof RCSButtonSchema>;

/**
 * RCS Card schema - Rich card message format
 */
export const RCSCardSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(500).optional(),
  imageUrl: z.string().url().optional(),
  imageAltText: z.string().max(50).optional(),
  buttons: z.array(RCSButtonSchema).max(4).optional(),
  mediaHeight: z.enum(['short', 'medium', 'tall']).default('medium'),
});

export type RCSCard = z.infer<typeof RCSCardSchema>;

/**
 * RCS Carousel schema - Multiple cards in horizontal scroll
 */
export const RCSCarouselSchema = z.object({
  cards: z.array(RCSCardSchema).min(1).max(10),
});

export type RCSCarousel = z.infer<typeof RCSCarouselSchema>;

/**
 * RCS Message types
 */
export enum RCSMessageType {
  TEXT = 'text',
  RICH_CARD = 'richCard',
  CAROUSEL = 'carousel',
  TEXT_WITH_SUGGESTIONS = 'textWithSuggestions',
}

/**
 * RCS Message Status
 */
export enum RCSMessageStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

/**
 * RCS Message payload for sending
 */
export interface RCSOutboundMessage {
  to: string;
  from?: string;
  type: RCSMessageType;
  content: RCSCard | RCSCard[] | string;
  messageId?: string;
  timestamp?: Date;
  tags?: Record<string, string>;
}

/**
 * RCS Inbound message from webhook
 */
export interface RCSInboundMessage {
  messageId: string;
  from: string;
  to: string;
  type: RCSMessageType;
  content: string | RCSCard;
  timestamp: Date;
  carrier: 'jio' | 'airtel' | 'unknown';
}

/**
 * RCS API Response
 */
export interface RCSApiResponse {
  success: boolean;
  messageId?: string;
  status?: RCSMessageStatus;
  error?: {
    code: string;
    message: string;
  };
  carrier: 'jio' | 'airtel';
  timestamp: Date;
}

/**
 * Phone number validation for India
 */
export function validateIndianPhoneNumber(phone: string): boolean {
  // Indian phone numbers: +91 followed by 10 digits
  const indianRegex = /^(\+91)?[6-9]\d{9}$/;
  return indianRegex.test(phone.replace(/\s/g, ''));
}

/**
 * Normalize Indian phone number to E.164 format
 */
export function normalizePhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\s/g, '').replace(/^0/, '');
  if (cleaned.startsWith('+91')) {
    return cleaned;
  }
  if (cleaned.startsWith('91')) {
    return `+${cleaned}`;
  }
  return `+91${cleaned}`;
}
