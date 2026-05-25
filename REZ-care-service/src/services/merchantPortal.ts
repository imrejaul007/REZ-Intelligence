/**
 * REZ Care - Merchant Support Portal
 *
 * Each merchant gets their own:
 * - Support inbox
 * - Ticket management
 * - Knowledge base
 * - Analytics
 * - Team management
 */

import axios from 'axios';
import { logger } from '../utils/logger';

const REZ_CARE_URL = process.env.REZ_CARE_URL || 'http://localhost:4058';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'rez-internal-token';

export interface MerchantPortal {
  merchantId: string;
  merchantName: string;
  email: string;
  industry: string;
  supportEmail: string;
  domain: string;
}

export interface MerchantTicket {
  id: string;
  ticketNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  subject: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'assigned' | 'in_progress' | 'pending' | 'resolved' | 'closed';
  platform: string;
  channel: 'email' | 'whatsapp' | 'chat' | 'in_app';
  sentiment?: 'positive' | 'neutral' | 'negative' | 'critical_negative';
  assignedTo?: string;
  messages: TicketMessage[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface TicketMessage {
  id: string;
  sender: 'customer' | 'agent' | 'system' | 'merchant';
  senderName: string;
  content: string;
  attachments?: string[];
  timestamp: string;
  isRead: boolean;
}

export interface MerchantFAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  language: string;
  order: number;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  isPublished: boolean;
}

export interface MerchantStats {
  openTickets: number;
  avgResponseTime: number;
  resolutionRate: number;
  csatScore: number;
  ticketsToday: number;
  ticketsThisWeek: number;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
  byStatus: Record<string, number>;
}

/**
 * Merchant Support Portal Service
 */
class MerchantPortalService {
  private headers = {
    'Content-Type': 'application/json',
    'X-Internal-Token': INTERNAL_TOKEN,
  };

  // ============================================
  // TICKET MANAGEMENT
  // ============================================

  /**
   * Get merchant's tickets
   */
  async getTickets(merchantId: string, filters?: {
    status?: string;
    category?: string;
    priority?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ tickets: MerchantTicket[]; total: number }> {
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.category) params.append('category', filters.category);
      if (filters?.page) params.append('page', String(filters.page));
      if (filters?.limit) params.append('limit', String(filters.limit));
      if (filters?.search) params.append('search', filters.search);

      const res = await axios.get(
        `${REZ_CARE_URL}/api/merchant/${merchantId}/tickets?${params}`,
        { headers: this.headers }
      );

      return res.data;
    } catch (error) {
      logger.error('[MerchantPortal] Failed to get tickets', error);
      return { tickets: [], total: 0 };
    }
  }

  /**
   * Get single ticket
   */
  async getTicket(merchantId: string, ticketId: string): Promise<MerchantTicket | null> {
    try {
      const res = await axios.get(
        `${REZ_CARE_URL}/api/merchant/${merchantId}/tickets/${ticketId}`,
        { headers: this.headers }
      );
      return res.data;
    } catch {
      return null;
    }
  }

  /**
   * Respond to ticket
   */
  async respondToTicket(
    merchantId: string,
    ticketId: string,
    message: string,
    agentName: string
  ): Promise<boolean> {
    try {
      await axios.post(
        `${REZ_CARE_URL}/api/merchant/${merchantId}/tickets/${ticketId}/respond`,
        { message, agentName },
        { headers: this.headers }
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Assign ticket to team member
   */
  async assignTicket(
    merchantId: string,
    ticketId: string,
    agentId: string
  ): Promise<boolean> {
    try {
      await axios.post(
        `${REZ_CARE_URL}/api/merchant/${merchantId}/tickets/${ticketId}/assign`,
        { agentId },
        { headers: this.headers }
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Resolve ticket
   */
  async resolveTicket(
    merchantId: string,
    ticketId: string,
    resolution: string
  ): Promise<boolean> {
    try {
      await axios.post(
        `${REZ_CARE_URL}/api/merchant/${merchantId}/tickets/${ticketId}/resolve`,
        { resolution },
        { headers: this.headers }
      );
      return true;
    } catch {
      return false;
    }
  }

  // ============================================
  // KNOWLEDGE BASE
  // ============================================

  /**
   * Get merchant's FAQ list
   */
  async getFAQs(merchantId: string): Promise<MerchantFAQ[]> {
    try {
      const res = await axios.get(
        `${REZ_CARE_URL}/api/merchant/${merchantId}/kb`,
        { headers: this.headers }
      );
      return res.data?.faqs || [];
    } catch {
      return [];
    }
  }

  /**
   * Create FAQ
   */
  async createFAQ(
    merchantId: string,
    faq: Omit<MerchantFAQ, 'id' | 'viewCount' | 'helpfulCount' | 'notHelpfulCount'>
  ): Promise<string | null> {
    try {
      const res = await axios.post(
        `${REZ_CARE_URL}/api/merchant/${merchantId}/kb`,
        faq,
        { headers: this.headers }
      );
      return res.data?.id;
    } catch {
      return null;
    }
  }

  /**
   * Update FAQ
   */
  async updateFAQ(
    merchantId: string,
    faqId: string,
    updates: Partial<MerchantFAQ>
  ): Promise<boolean> {
    try {
      await axios.put(
        `${REZ_CARE_URL}/api/merchant/${merchantId}/kb/${faqId}`,
        updates,
        { headers: this.headers }
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete FAQ
   */
  async deleteFAQ(merchantId: string, faqId: string): Promise<boolean> {
    try {
      await axios.delete(
        `${REZ_CARE_URL}/api/merchant/${merchantId}/kb/${faqId}`,
        { headers: this.headers }
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Import bulk FAQs
   */
  async importFAQs(merchantId: string, faqs: Omit<MerchantFAQ, 'id'>[]): Promise<number> {
    try {
      const res = await axios.post(
        `${REZ_CARE_URL}/api/merchant/${merchantId}/kb/import`,
        { faqs },
        { headers: this.headers }
      );
      return res.data?.imported || 0;
    } catch {
      return 0;
    }
  }

  // ============================================
  // ANALYTICS
  // ============================================

  /**
   * Get merchant statistics
   */
  async getStats(merchantId: string): Promise<MerchantStats> {
    try {
      const res = await axios.get(
        `${REZ_CARE_URL}/api/merchant/${merchantId}/stats`,
        { headers: this.headers }
      );
      return res.data;
    } catch {
      return {
        openTickets: 0,
        avgResponseTime: 0,
        resolutionRate: 0,
        csatScore: 0,
        ticketsToday: 0,
        ticketsThisWeek: 0,
        byCategory: {},
        byPriority: {},
        byStatus: {},
      };
    }
  }

  /**
   * Get response time trends
   */
  async getResponseTrends(merchantId: string, days: number = 7): Promise<unknown[]> {
    try {
      const res = await axios.get(
        `${REZ_CARE_URL}/api/merchant/${merchantId}/trends/response`,
        { params: { days }, headers: this.headers }
      );
      return res.data?.trends || [];
    } catch {
      return [];
    }
  }

  // ============================================
  // TEAM MANAGEMENT
  // ============================================

  /**
   * Get support team members
   */
  async getTeamMembers(merchantId: string): Promise<unknown[]> {
    try {
      const res = await axios.get(
        `${REZ_CARE_URL}/api/merchant/${merchantId}/team`,
        { headers: this.headers }
      );
      return res.data?.members || [];
    } catch {
      return [];
    }
  }

  /**
   * Add team member
   */
  async addTeamMember(
    merchantId: string,
    member: { name: string; email: string; role: string }
  ): Promise<string | null> {
    try {
      const res = await axios.post(
        `${REZ_CARE_URL}/api/merchant/${merchantId}/team`,
        member,
        { headers: this.headers }
      );
      return res.data?.id;
    } catch {
      return null;
    }
  }

  // ============================================
  // SETTINGS
  // ============================================

  /**
   * Get merchant settings
   */
  async getSettings(merchantId: string): Promise<unknown> {
    try {
      const res = await axios.get(
        `${REZ_CARE_URL}/api/merchant/${merchantId}/settings`,
        { headers: this.headers }
      );
      return res.data;
    } catch {
      return null;
    }
  }

  /**
   * Update merchant settings
   */
  async updateSettings(merchantId: string, settings): Promise<boolean> {
    try {
      await axios.put(
        `${REZ_CARE_URL}/api/merchant/${merchantId}/settings`,
        settings,
        { headers: this.headers }
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Configure auto-response settings
   */
  async configureAutoResponse(
    merchantId: string,
    config: {
      enabled: boolean;
      template?: string;
      delay?: number;
    }
  ): Promise<boolean> {
    try {
      await axios.post(
        `${REZ_CARE_URL}/api/merchant/${merchantId}/auto-response`,
        config,
        { headers: this.headers }
      );
      return true;
    } catch {
      return false;
    }
  }
}

export const merchantPortal = new MerchantPortalService();
export { MerchantPortalService };
