import { logger } from '../utils/logger';

export interface ParsedCommand {
  command: string;
  action: string;
  params: Record<string, string>;
  original: string;
}

export class CommandParser {
  private static readonly COMMAND_PREFIX = 'REZ';
  private static readonly COMMANDS = [
    'ORDER', 'STATUS', 'HELP', 'CANCEL', 'FEEDBACK',
    'TRACK', 'BOOK', 'PAY', 'SUPPORT', 'INFO'
  ];

  parse(emailSubject: string, emailBody: string): ParsedCommand | null {
    const text = `${emailSubject} ${emailBody}`.toUpperCase();

    // Check for REZ command prefix
    if (!text.includes(this.COMMAND_PREFIX)) {
      return null;
    }

    // Extract command
    for (const cmd of this.COMMANDS) {
      if (text.includes(cmd)) {
        return this.extractCommand(cmd, emailSubject, emailBody);
      }
    }

    // Default to INFO command
    return {
      command: 'INFO',
      action: 'general_inquiry',
      params: { subject: emailSubject },
      original: emailBody
    };
  }

  private extractCommand(cmd: string, subject: string, body: string): ParsedCommand {
    const text = `${subject} ${body}`;
    const params: Record<string, string> = {};

    switch (cmd) {
      case 'ORDER':
        params.orderId = this.extractParam(text, ['order', 'id', '#']);
        params.item = this.extractParam(text, ['item', 'product', 'food']);
        params.quantity = this.extractParam(text, ['qty', 'quantity', 'x']);
        return { command: 'ORDER', action: 'place_order', params, original: text };

      case 'STATUS':
        params.orderId = this.extractParam(text, ['order', 'id', '#']);
        return { command: 'STATUS', action: 'check_status', params, original: text };

      case 'CANCEL':
        params.orderId = this.extractParam(text, ['order', 'id', '#']);
        params.reason = this.extractParam(text, ['reason', 'why']);
        return { command: 'CANCEL', action: 'cancel_order', params, original: text };

      case 'TRACK':
        params.orderId = this.extractParam(text, ['order', 'id', '#']);
        return { command: 'TRACK', action: 'track_order', params, original: text };

      case 'BOOK':
        params.service = this.extractParam(text, ['service', 'type']);
        params.date = this.extractParam(text, ['date', 'when']);
        params.guests = this.extractParam(text, ['guests', 'people']);
        return { command: 'BOOK', action: 'create_booking', params, original: text };

      case 'SUPPORT':
        params.issue = this.extractParam(text, ['issue', 'problem']);
        params.priority = this.extractParam(text, ['priority', 'urgent']);
        return { command: 'SUPPORT', action: 'create_ticket', params, original: text };

      case 'FEEDBACK':
        params.orderId = this.extractParam(text, ['order', 'id', '#']);
        params.rating = this.extractParam(text, ['rating', 'stars', '/5']);
        params.comment = this.extractParam(text, ['comment', 'note']);
        return { command: 'FEEDBACK', action: 'submit_feedback', params, original: text };

      case 'PAY':
        params.orderId = this.extractParam(text, ['order', 'id', '#']);
        params.method = this.extractParam(text, ['method', 'via']);
        return { command: 'PAY', action: 'process_payment', params, original: text };

      default:
        return {
          command: 'INFO',
          action: 'general_inquiry',
          params: { subject, body },
          original: text
        };
    }
  }

  private extractParam(text: string, keywords: string[]): string {
    for (const keyword of keywords) {
      const regex = new RegExp(`${keyword}[\\s:]*([\\w-]+)`, 'i');
      const match = text.match(regex);
      if (match) {
        return match[1];
      }
    }
    return '';
  }
}

export const commandParser = new CommandParser();
