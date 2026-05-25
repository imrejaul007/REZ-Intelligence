/**
 * REZ Care - Email Poller Service
 *
 * Polls IMAP email servers for new support emails.
 * Supports Gmail, Outlook, custom IMAP servers.
 */

import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { emailIntegration, EmailMessage } from './emailIntegration';
import { logger } from '../utils/logger';

export interface IMAPConfig {
  user: string;
  password: string;
  host: string;
  port: number;
  tls: boolean;
  box: string;
  searchCriteria: string[];
  pollInterval: number; // milliseconds
}

const DEFAULT_CONFIG: Partial<IMAPConfig> = {
  host: 'imap.gmail.com',
  port: 993,
  tls: true,
  box: 'INBOX',
  searchCriteria: ['UNSEEN'],
  pollInterval: 60000, // 1 minute
};

class EmailPoller {
  private imap: Imap | null = null;
  private config: IMAPConfig | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private lastUid: number = 0;

  /**
   * Start polling emails
   */
  start(config: Partial<IMAPConfig>): void {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    } as IMAPConfig;

    // Validate config
    if (!this.config.user || !this.config.password) {
      logger.error('[EmailPoller] Missing user or password');
      return;
    }

    this.isRunning = true;
    logger.info('[EmailPoller] Starting email poller', { host: this.config.host });

    // Initial connect
    this.connect();

    // Set up polling interval
    this.pollTimer = setInterval(() => {
      if (this.isRunning) {
        this.checkNewEmails();
      }
    }, this.config.pollInterval);
  }

  /**
   * Stop polling
   */
  stop(): void {
    this.isRunning = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.imap) {
      this.imap.end();
      this.imap = null;
    }
    logger.info('[EmailPoller] Stopped email poller');
  }

  /**
   * Connect to IMAP server
   */
  private connect(): void {
    if (!this.config) return;

    this.imap = new Imap({
      user: this.config.user,
      password: this.config.password,
      host: this.config.host,
      port: this.config.port,
      tls: this.config.tls,
      tlsOptions: { rejectUnauthorized: false },
    });

    this.imap.on('ready', () => {
      logger.info('[EmailPoller] Connected to IMAP server');
      this.imap?.openBox(this.config!.box, true, (err) => {
        if (err) {
          logger.error('[EmailPoller] Failed to open mailbox', err);
        } else {
          logger.info(`[EmailPoller] Opened ${this.config!.box}`);
          this.checkNewEmails();
        }
      });
    });

    this.imap.on('error', (err) => {
      logger.error('[EmailPoller] IMAP error', err);
      // Reconnect after error
      setTimeout(() => this.connect(), 30000);
    });

    this.imap.on('end', () => {
      logger.info('[EmailPoller] IMAP connection ended');
    });

    this.imap.connect();
  }

  /**
   * Check for new emails
   */
  private checkNewEmails(): void {
    if (!this.imap || !this.isRunning) return;

    try {
      // Search for unseen emails since last UID
      const searchCriteria: unknown[] = ['UNSEEN'];
      if (this.lastUid > 0) {
        searchCriteria.push(['UID', `${this.lastUid + 1}:*`]);
      }

      this.imap.search(searchCriteria, (err, results) => {
        if (err) {
          logger.error('[EmailPoller] Search failed', err);
          return;
        }

        if (!results || results.length === 0) {
          return;
        }

        logger.info(`[EmailPoller] Found ${results.length} new emails`);

        // Fetch and process each email
        const fetch = this.imap!.fetch(results, {
          bodies: '',
          struct: true,
        });

        fetch.on('message', (msg) => {
          let uid: number | null = null;

          msg.on('attributes', (attrs) => {
            uid = attrs.uid;
            if (uid && uid > this.lastUid) {
              this.lastUid = uid;
            }
          });

          msg.on('body', async (stream) => {
            try {
              const parsed = await simpleParser(stream as unknown);
              const email = this.convertToEmailMessage(parsed, uid);

              logger.info('[EmailPoller] Processing email', {
                from: email.from,
                subject: email.subject,
              });

              // Process through email integration
              await emailIntegration.processEmailPipeline(email);
            } catch (error) {
              logger.error('[EmailPoller] Failed to parse email', error);
            }
          });

          msg.on('error', (err) => {
            logger.error('[EmailPoller] Message error', err);
          });
        });

        fetch.on('error', (err) => {
          logger.error('[EmailPoller] Fetch error', err);
        });

        fetch.on('end', () => {
          logger.info('[EmailPoller] Finished processing new emails');
        });
      });
    } catch (error) {
      logger.error('[EmailPoller] Check failed', error);
    }
  }

  /**
   * Convert mailparser parsed email to EmailMessage
   */
  private convertToEmailMessage(parsed, uid?: number | null): EmailMessage {
    return {
      from: parsed.from?.value?.[0]?.text || parsed.from?.text || '',
      to: parsed.to?.value?.[0]?.text || parsed.to?.text || '',
      subject: parsed.subject || '',
      body: parsed.text || parsed.textAsHtml || '',
      html: parsed.html || undefined,
      attachments: parsed.attachments?.map((a) => a.filename) || [],
      date: parsed.date?.toISOString() || new Date().toISOString(),
      messageId: parsed.messageId || `imap-${uid || Date.now()}`,
      inReplyTo: parsed.inReplyTo || undefined,
    };
  }

  /**
   * Get current status
   */
  getStatus(): { running: boolean; lastUid: number; config?: IMAPConfig } {
    return {
      running: this.isRunning,
      lastUid: this.lastUid,
      config: this.config ? {
        ...this.config,
        password: '***', // Hide password
      } : undefined,
    };
  }
}

export const emailPoller = new EmailPoller();
