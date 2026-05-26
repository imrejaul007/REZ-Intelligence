/**
 * REZ Care - Multi-Tenant Email Service
 *
 * Handles different support emails for different clients:
 * - Each merchant can have their own support email
 * - Each brand can have their own inbox
 * - Emails are tagged with client/merchant context
 * - Custom branding per client
 */

import { emailIntegration, EmailMessage } from './emailIntegration';
import { logger } from '../utils/logger.js';

// Client configuration interface
export interface ClientConfig {
  clientId: string;
  clientName: string;
  email: string;
  domain: string;
  color: string; // Brand color
  logo?: string;
  language: string;
  timezone: string;
  industry: string;
  customResponses?: Record<string, string>;
  routingRules?: {
    category: string;
    priority: string;
    agentTeam?: string;
  }[];
  autoResponseTemplate?: string;
  smtpConfig?: {
    host: string;
    port: number;
    user: string;
    password: string;
  };
}

// Client registry
const clients: Map<string, ClientConfig> = new Map();
const emailToClient: Map<string, string> = new Map();

/**
 * Multi-Tenant Email Service
 */
class MultiTenantEmail {
  /**
   * Register a new client
   */
  registerClient(config: ClientConfig): void {
    clients.set(config.clientId, config);
    emailToClient.set(config.email.toLowerCase(), config.clientId);
    emailToClient.set(`support@${config.domain}`.toLowerCase(), config.clientId);

    logger.info('[MultiTenant] Registered client', {
      clientId: config.clientId,
      email: config.email,
    });
  }

  /**
   * Get client by email address
   */
  getClientByEmail(email: string): ClientConfig | null {
    const normalizedEmail = email.toLowerCase().trim();
    const clientId = emailToClient.get(normalizedEmail);
    if (clientId) {
      return clients.get(clientId) || null;
    }

    // Try to match domain
    for (const [_, client] of clients) {
      if (normalizedEmail.endsWith(`@${client.domain}`)) {
        return client;
      }
    }

    return null;
  }

  /**
   * Get client by ID
   */
  getClient(clientId: string): ClientConfig | null {
    return clients.get(clientId) || null;
  }

  /**
   * Get all registered clients
   */
  getAllClients(): ClientConfig[] {
    return Array.from(clients.values());
  }

  /**
   * Process email with client context
   */
  async processEmailForClient(rawEmail: EmailMessage): Promise<{
    email: EmailMessage;
    client: ClientConfig;
    parsed;
    actions: string[];
  }> {
    // Find the client
    const client = this.getClientByEmail(rawEmail.to);

    if (!client) {
      logger.warn('[MultiTenant] Unknown client for email', { to: rawEmail.to });
      // Process as generic support
      const parsed = await emailIntegration.processEmail(rawEmail);
      return {
        email: rawEmail,
        client: {
          clientId: 'unknown',
          clientName: 'Unknown',
          email: rawEmail.to,
          domain: '',
          color: '#0066CC',
          language: 'en',
          timezone: 'UTC',
          industry: 'other',
        },
        parsed,
        actions: ['client_not_found'],
      };
    }

    logger.info('[MultiTenant] Processing email for client', {
      clientId: client.clientId,
      from: rawEmail.from,
      subject: rawEmail.subject,
    });

    // Enrich email with client context
    const enrichedEmail = this.enrichWithClientContext(rawEmail, client);

    // Process through email integration
    const parsed = await emailIntegration.processEmail(enrichedEmail);

    // Apply client-specific routing rules
    const routingActions = this.applyRoutingRules(parsed, client);

    return {
      email: enrichedEmail,
      client,
      parsed,
      actions: routingActions,
    };
  }

  /**
   * Enrich email with client context
   */
  private enrichWithClientContext(email: EmailMessage, client: ClientConfig): EmailMessage {
    return {
      ...email,
      // Add client metadata
      to: email.to,
      // Preserve original but tag for client routing
      messageId: `${client.clientId}-${email.messageId}`,
    };
  }

  /**
   * Apply client-specific routing rules
   */
  private applyRoutingRules(parsed, client: ClientConfig): string[] {
    const actions: string[] = [];

    if (!client.routingRules) return actions;

    // Find matching rule
    const matchingRule = client.routingRules.find(rule =>
      parsed.category === rule.category
    );

    if (matchingRule) {
      actions.push(`route_to_team:${matchingRule.agentTeam || 'default'}`);
      actions.push(`set_priority:${matchingRule.priority}`);

      // Override priority if specified
      if (matchingRule.priority) {
        parsed.priority = matchingRule.priority;
      }
    }

    return actions;
  }

  /**
   * Generate client-specific auto-response
   */
  generateClientResponse(parsed, client: ClientConfig): {
    to: string;
    subject: string;
    body: string;
    html?: string;
  } {
    const greeting = parsed.customerName
      ? `Hi ${parsed.customerName},\n\n`
      : `Hi,\n\n`;

    // Check for custom response template
    if (client.customResponses?.[parsed.category]) {
      return {
        to: parsed.customerEmail,
        subject: `Re: ${parsed.subject}`,
        body: greeting + client.customResponses[parsed.category],
      };
    }

    // Default response with client branding
    const defaultResponses: Record<string, string> = {
      urgent: `Thank you for contacting ${client.clientName} support.\n\nYour message has been marked as urgent and our team is prioritizing it.\n\nWe'll respond within 2 hours.\n\nTicket: {{ticketId}}\n\nBest regards,\n${client.clientName} Support Team`,

      order: `Thank you for reaching out to ${client.clientName}.\n\nWe've received your message and our team is looking into it.\n\nYou'll receive a response within 24 hours.\n\nTicket: {{ticketId}}\n\nBest regards,\n${client.clientName} Support Team`,

      payment: `Thank you for contacting ${client.clientName} billing support.\n\nOur billing team will review your case and respond within 12 hours.\n\nTicket: {{ticketId}}\n\nBest regards,\n${client.clientName} Support Team`,

      default: `Thank you for contacting ${client.clientName}.\n\nWe've received your message and our team will respond within 24 hours.\n\nTicket: {{ticketId}}\n\nBest regards,\n${client.clientName} Support Team`,
    };

    const responseKey = parsed.priority === 'urgent' ? 'urgent'
      : parsed.category === 'order' ? 'order'
      : parsed.category === 'payment' ? 'payment'
      : 'default';

    return {
      to: parsed.customerEmail,
      subject: `Re: ${parsed.subject}`,
      body: defaultResponses[responseKey],
    };
  }

  /**
   * Create branded HTML email
   */
  createBrandedHTML(response: { to: string; subject: string; body: string }, client: ClientConfig): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${client.clientName} Support</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: ${client.color}; padding: 20px; color: white; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; color: #333; line-height: 1.6; }
    .content p { margin: 0 0 15px 0; }
    .footer { background: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #666; }
    .ticket { background: ${client.color}10; border-left: 4px solid ${client.color}; padding: 10px 15px; margin: 20px 0; }
    .ticket strong { color: ${client.color}; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${client.clientName} Support</h1>
    </div>
    <div class="content">
      ${response.body.split('\n\n').map(p => `<p>${p}</p>`).join('')}
      <div class="ticket">
        <strong>Ticket ID:</strong> {{ticketId}}
      </div>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} ${client.clientName}. All rights reserved.</p>
      <p>This email was sent from ${client.email}</p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Setup default clients (merchant examples)
   */
  setupDefaultClients(): void {
    // Hotel client
    this.registerClient({
      clientId: 'hotel_chain_1',
      clientName: 'Grand Hotel',
      email: 'support@grandhotel.com',
      domain: 'grandhotel.com',
      color: '#1E3A5F',
      language: 'en',
      timezone: 'America/New_York',
      industry: 'hospitality',
      routingRules: [
        { category: 'booking', priority: 'high', agentTeam: 'reservations' },
        { category: 'room_service', priority: 'medium', agentTeam: 'hospitality' },
      ],
    });

    // Restaurant client
    this.registerClient({
      clientId: 'restaurant_1',
      clientName: 'Pizza Palace',
      email: 'support@pizzapalace.com',
      domain: 'pizzapalace.com',
      color: '#E74C3C',
      language: 'en',
      timezone: 'America/Los_Angeles',
      industry: 'culinary',
      routingRules: [
        { category: 'order', priority: 'high', agentTeam: 'orders' },
        { category: 'delivery', priority: 'medium', agentTeam: 'delivery' },
      ],
    });

    // Gym client
    this.registerClient({
      clientId: 'gym_1',
      clientName: 'FitLife Gym',
      email: 'support@fitlifegym.com',
      domain: 'fitlifegym.com',
      color: '#27AE60',
      language: 'en',
      timezone: 'America/Chicago',
      industry: 'fitness',
      routingRules: [
        { category: 'membership', priority: 'high', agentTeam: 'membership' },
        { category: 'class', priority: 'medium', agentTeam: 'classes' },
      ],
    });

    logger.info('[MultiTenant] Setup default clients', { count: clients.size });
  }

  /**
   * Get client statistics
   */
  getClientStats(clientId: string): {
    totalEmails: number;
    openTickets: number;
    avgResponseTime: number;
  } {
    // In real implementation, query from database
    return {
      totalEmails: 0,
      openTickets: 0,
      avgResponseTime: 0,
    };
  }
}

export const multiTenantEmail = new MultiTenantEmail();
export { MultiTenantEmail };
