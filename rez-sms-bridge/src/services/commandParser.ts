export interface ParsedCommand {
  valid: boolean;
  command?: string;
  action?: string;
  params?: Record<string, string>;
  error?: string;
}

export class CommandParser {
  /**
   * Parse SMS command string into structured data
   *
   * Supported patterns:
   * - REZ ORDER <item> [quantity] [special instructions]
   * - REZ STATUS <orderId>
   * - REZ HELP
   * - REZ CANCEL <orderId>
   * - REZ FEEDBACK <orderId> <rating> [comment]
   */
  parse(input: string): ParsedCommand {
    if (!input || typeof input !== 'string') {
      return {
        valid: false,
        error: 'Empty or invalid input',
      };
    }

    // Normalize input
    const normalizedInput = input.trim().toUpperCase();

    // Check for REZ prefix
    if (!normalizedInput.startsWith('REZ')) {
      return {
        valid: false,
        error: 'Missing REZ prefix',
      };
    }

    // Remove REZ prefix and parse
    const commandPart = normalizedInput.slice(3).trim();
    const parts = commandPart.split(/\s+/).filter(Boolean);

    if (parts.length === 0) {
      return {
        valid: false,
        error: 'No command provided after REZ',
      };
    }

    const action = parts[0].toLowerCase();

    switch (action) {
      case 'help':
        return this.parseHelpCommand(parts);

      case 'order':
        return this.parseOrderCommand(parts);

      case 'status':
        return this.parseStatusCommand(parts);

      case 'cancel':
        return this.parseCancelCommand(parts);

      case 'feedback':
      case 'review':
        return this.parseFeedbackCommand(parts);

      case 'track':
        return this.parseTrackCommand(parts);

      case 'menu':
        return this.parseMenuCommand(parts);

      case 'account':
      case 'profile':
        return this.parseAccountCommand(parts);

      default:
        return {
          valid: false,
          error: `Unknown command: ${action}. Try: ORDER, STATUS, HELP, CANCEL, FEEDBACK`,
        };
    }
  }

  private parseHelpCommand(parts: string[]): ParsedCommand {
    return {
      valid: true,
      command: 'help',
      action: 'help',
      params: {},
    };
  }

  private parseOrderCommand(parts: string[]): ParsedCommand {
    // Format: ORDER <item> [qty] [special instructions...]
    if (parts.length < 2) {
      return {
        valid: false,
        error: 'ORDER requires item name. Format: REZ ORDER <item> [qty] [notes]',
      };
    }

    // Check if second part is a quantity (number)
    let itemIndex = 1;
    let quantity = 1;
    let specialInstructions = '';

    if (/^\d+$/.test(parts[1])) {
      quantity = parseInt(parts[1], 10);
      itemIndex = 2;
    }

    if (parts.length > itemIndex + 1) {
      // Special instructions start from itemIndex + 1
      specialInstructions = parts.slice(itemIndex + 1).join(' ');
    }

    const item = parts[itemIndex];

    // Validate item name (alphanumeric with spaces/hyphens)
    if (!/^[a-zA-Z0-9\s\-]+$/.test(item)) {
      return {
        valid: false,
        error: 'Invalid item name. Use alphanumeric characters only.',
      };
    }

    return {
      valid: true,
      command: 'order',
      action: 'create_order',
      params: {
        item,
        quantity: quantity.toString(),
        specialInstructions,
      },
    };
  }

  private parseStatusCommand(parts: string[]): ParsedCommand {
    // Format: STATUS <orderId>
    if (parts.length < 2) {
      return {
        valid: false,
        error: 'STATUS requires order ID. Format: REZ STATUS <orderId>',
      };
    }

    const orderId = parts[1];

    return {
      valid: true,
      command: 'status',
      action: 'get_order_status',
      params: {
        orderId,
      },
    };
  }

  private parseCancelCommand(parts: string[]): ParsedCommand {
    // Format: CANCEL <orderId>
    if (parts.length < 2) {
      return {
        valid: false,
        error: 'CANCEL requires order ID. Format: REZ CANCEL <orderId>',
      };
    }

    const orderId = parts[1];
    const reason = parts.slice(2).join(' ') || 'Customer requested cancellation via SMS';

    return {
      valid: true,
      command: 'cancel',
      action: 'cancel_order',
      params: {
        orderId,
        reason,
      },
    };
  }

  private parseFeedbackCommand(parts: string[]): ParsedCommand {
    // Format: FEEDBACK <orderId> <rating> [comment]
    if (parts.length < 3) {
      return {
        valid: false,
        error: 'FEEDBACK requires order ID and rating (1-5). Format: REZ FEEDBACK <orderId> <1-5> [comment]',
      };
    }

    const orderId = parts[1];
    const rating = parseInt(parts[2], 10);

    if (isNaN(rating) || rating < 1 || rating > 5) {
      return {
        valid: false,
        error: 'Rating must be a number between 1 and 5',
      };
    }

    const comment = parts.slice(3).join(' ');

    return {
      valid: true,
      command: 'feedback',
      action: 'submit_feedback',
      params: {
        orderId,
        rating: rating.toString(),
        comment,
      },
    };
  }

  private parseTrackCommand(parts: string[]): ParsedCommand {
    // Format: TRACK <orderId>
    if (parts.length < 2) {
      return {
        valid: false,
        error: 'TRACK requires order ID. Format: REZ TRACK <orderId>',
      };
    }

    return {
      valid: true,
      command: 'track',
      action: 'track_order',
      params: {
        orderId: parts[1],
      },
    };
  }

  private parseMenuCommand(parts: string[]): ParsedCommand {
    // Format: MENU [category]
    const category = parts[1] || 'all';

    return {
      valid: true,
      command: 'menu',
      action: 'get_menu',
      params: {
        category,
      },
    };
  }

  private parseAccountCommand(parts: string[]): ParsedCommand {
    // Format: ACCOUNT [info|orders|address]
    const subCommand = parts[1]?.toLowerCase() || 'info';

    return {
      valid: true,
      command: 'account',
      action: 'get_account_info',
      params: {
        infoType: subCommand,
      },
    };
  }
}

export const commandParser = new CommandParser();
