/**
 * UNIFIED MESSAGING TYPES
 */

export type Channel = 'whatsapp' | 'sms' | 'email' | 'push' | 'in_app';
export type MessageType = 'marketing' | 'transactional' | 'support' | 'commerce' | 'notification' | 'ai_commerce' | 'broadcast';
export type MessageStatus = 'draft' | 'queued' | 'sent' | 'delivered' | 'read' | 'clicked' | 'failed' | 'unsubscribed';

export interface Message {
  id: string;
  sender: { type: 'platform' | 'merchant' | 'support' | 'ai'; merchantId?: string };
  recipient: { userId?: string; phone?: string; email?: string; deviceToken?: string };
  content: {
    type: MessageType;
    channel: Channel;
    subject?: string;
    body: string;
    media?: { type: 'image' | 'video' | 'document'; url: string; caption?: string }[];
    buttons?: { id: string; text: string; action: 'url' | 'reply' | 'call'; value: string }[];
  };
  ai?: { intentDetected?: string; confidence?: number; responseGenerated?: boolean };
  status: MessageStatus;
  attribution?: { campaignId?: string; merchantId?: string; source: string };
  createdAt: Date;
  updatedAt: Date;
}

export interface MerchantWhatsAppNumber {
  id: string;
  merchantId: string;
  phoneNumber: string;
  wabaId: string;
  config: {
    businessName: string;
    autoReply: boolean;
    aiAssistant: boolean;
    aiPersona: string;
    workingHours: { enabled: boolean; timezone: string };
  };
  integrations: { orders: boolean; campaigns: boolean; support: boolean; commerce: boolean };
  limits: { monthly: number; daily: number; templateCooldown: number };
  status: 'active' | 'pending' | 'suspended';
  stats: { totalMessages: number; monthlyMessages: number; avgResponseTime: number };
  createdAt: Date;
}

export interface Conversation {
  id: string;
  participants: {
    customer: { userId?: string; phone: string; name?: string };
    merchant?: { merchantId: string; whatsappNumberId: string };
  };
  channel: Channel;
  merchantWhatsAppId?: string;
  ai?: { active: boolean; intent?: string; turnCount: number };
  messages: string[];
  status: 'active' | 'waiting_customer' | 'waiting_agent' | 'resolved' | 'escalated';
  lastMessageAt: Date;
  createdAt: Date;
}

export interface AIContext {
  user: { userId: string; phone: string; name?: string; segments: string[] };
  merchant?: { merchantId: string; name: string; category: string; whatsappNumberId: string };
  conversation: { turnCount: number; lastIntent?: string };
  signals: { recentSearches?: string[]; timeOfDay: string; dayOfWeek: string };
}
