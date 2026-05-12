/**
 * IVR (Interactive Voice Response) Menu System
 * Handles menu navigation, option selection, and branching logic
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import {
  IvrMenu,
  IvrMenuItem,
  IvrOption,
  VoiceAgentResponse,
  ConversationState,
  VoiceAgentType
} from '../types';

export interface IvrContext {
  menuId: string;
  currentMenu: IvrMenu;
  depth: number;
  retryCount: number;
  selectedOptions: IvrOption[];
  timestamp: Date;
}

export class IvrService {
  private menus: Map<string, IvrMenu> = new Map();
  private contexts: Map<string, IvrContext> = new Map();

  constructor() {
    this.initializeDefaultMenus();
  }

  /**
   * Initialize default IVR menus
   */
  private initializeDefaultMenus(): void {
    // Main welcome menu
    const mainMenu: IvrMenu = {
      id: 'main',
      name: 'Main Menu',
      prompt: 'Welcome to ReZ. For sales, press 1. For customer support, press 2. For general information, press 3. To speak with an operator, press 0. To hear these options again, press star.',
      items: [
        {
          key: IvrOption.SALES,
          prompt: 'Sales',
          description: 'Connect with our sales team',
          agentType: VoiceAgentType.SALES
        },
        {
          key: IvrOption.SUPPORT,
          prompt: 'Support',
          description: 'Get help with existing orders or products',
          agentType: VoiceAgentType.SUPPORT
        },
        {
          key: IvrOption.INFO,
          prompt: 'Information',
          description: 'Business hours, locations, and general info',
          agentType: VoiceAgentType.INFO
        },
        {
          key: IvrOption.OPERATOR,
          prompt: 'Operator',
          description: 'Speak with a human representative',
          agentType: undefined
        },
        {
          key: IvrOption.REPEAT,
          prompt: 'Repeat',
          description: 'Hear menu options again',
          agentType: undefined
        }
      ],
      timeoutSeconds: 5,
      maxRetries: 3
    };

    // Sales sub-menu
    const salesMenu: IvrMenu = {
      id: 'sales',
      name: 'Sales Menu',
      prompt: 'You selected sales. Are you interested in hotels, travel packages, or advertising? For hotels, press 1. For travel packages, press 2. For advertising, press 3. To go back to the main menu, press 9.',
      items: [
        {
          key: '1',
          prompt: 'Hotels',
          description: 'Hotel booking services',
          agentType: VoiceAgentType.SALES
        },
        {
          key: '2',
          prompt: 'Travel Packages',
          description: 'Complete travel packages',
          agentType: VoiceAgentType.SALES
        },
        {
          key: '3',
          prompt: 'Advertising',
          description: 'AdBazaar advertising services',
          agentType: VoiceAgentType.SALES
        },
        {
          key: '9',
          prompt: 'Back',
          description: 'Return to main menu',
          agentType: undefined
        }
      ],
      timeoutSeconds: 5,
      maxRetries: 2
    };

    // Support sub-menu
    const supportMenu: IvrMenu = {
      id: 'support',
      name: 'Support Menu',
      prompt: 'You selected customer support. For order status, press 1. For refunds and cancellations, press 2. For technical support, press 3. To leave a voicemail, press star. To go back, press 9.',
      items: [
        {
          key: '1',
          prompt: 'Order Status',
          description: 'Check order status',
          agentType: VoiceAgentType.SUPPORT
        },
        {
          key: '2',
          prompt: 'Refunds',
          description: 'Refund and cancellation requests',
          agentType: VoiceAgentType.SUPPORT
        },
        {
          key: '3',
          prompt: 'Technical Support',
          description: 'Technical help',
          agentType: VoiceAgentType.SUPPORT
        },
        {
          key: IvrOption.REPEAT,
          prompt: 'Voicemail',
          description: 'Leave a voicemail',
          agentType: undefined
        },
        {
          key: '9',
          prompt: 'Back',
          description: 'Return to main menu',
          agentType: undefined
        }
      ],
      timeoutSeconds: 5,
      maxRetries: 2
    };

    this.menus.set('main', mainMenu);
    this.menus.set('sales', salesMenu);
    this.menus.set('support', supportMenu);
  }

  /**
   * Create a new IVR session
   */
  createSession(sessionId?: string): string {
    const id = sessionId || uuidv4();
    const mainMenu = this.menus.get('main');

    if (!mainMenu) {
      throw new Error('Main menu not found');
    }

    const context: IvrContext = {
      menuId: 'main',
      currentMenu: mainMenu,
      depth: 0,
      retryCount: 0,
      selectedOptions: [],
      timestamp: new Date()
    };

    this.contexts.set(id, context);
    logger.info('IVR session created', { sessionId: id, menu: mainMenu.name });

    return id;
  }

  /**
   * Get current context for a session
   */
  getContext(sessionId: string): IvrContext | null {
    return this.contexts.get(sessionId) || null;
  }

  /**
   * Process user input (DTMF digits)
   */
  processInput(sessionId: string, digits: string): IvrContext {
    const context = this.contexts.get(sessionId);

    if (!context) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const normalizedDigits = digits.trim().toLowerCase();
    const selectedItem = context.currentMenu.items.find(
      item => item.key.toLowerCase() === normalizedDigits
    );

    if (selectedItem) {
      return this.handleSelection(sessionId, selectedItem);
    } else {
      return this.handleInvalidInput(sessionId);
    }
  }

  /**
   * Handle valid menu selection
   */
  private handleSelection(sessionId: string, item: IvrMenuItem): IvrContext {
    const context = this.contexts.get(sessionId);

    if (!context) {
      throw new Error(`Session ${sessionId} not found`);
    }

    context.selectedOptions.push(item.key);

    if (item.key === IvrOption.REPEAT) {
      // Just repeat the current menu
      logger.info('IVR repeat requested', { sessionId, menu: context.currentMenu.name });
      return context;
    }

    if (item.agentType) {
      // Navigate to agent
      context.depth++;
      logger.info('IVR navigating to agent', {
        sessionId,
        agentType: item.agentType,
        depth: context.depth
      });
      return context;
    }

    if (item.key === IvrOption.OPERATOR) {
      // Flag for transfer to operator
      context.depth++;
      logger.info('IVR operator transfer requested', { sessionId });
      return context;
    }

    // Check if this is a sub-menu
    const subMenuId = this.getSubMenuId(item.key);
    if (subMenuId && this.menus.has(subMenuId)) {
      const subMenu = this.menus.get(subMenuId)!;
      context.menuId = subMenuId;
      context.currentMenu = subMenu;
      context.depth++;
      logger.info('IVR navigating to sub-menu', {
        sessionId,
        menu: subMenu.name,
        depth: context.depth
      });
    }

    return context;
  }

  /**
   * Handle invalid input
   */
  private handleInvalidInput(sessionId: string): IvrContext {
    const context = this.contexts.get(sessionId);

    if (!context) {
      throw new Error(`Session ${sessionId} not found`);
    }

    context.retryCount++;

    if (context.retryCount >= context.currentMenu.maxRetries) {
      // Max retries reached, offer to transfer to operator
      logger.warn('IVR max retries reached', {
        sessionId,
        retries: context.retryCount
      });
    }

    logger.info('IVR invalid input', {
      sessionId,
      retryCount: context.retryCount,
      maxRetries: context.currentMenu.maxRetries
    });

    return context;
  }

  /**
   * Navigate back to previous menu
   */
  goBack(sessionId: string): IvrContext | null {
    const context = this.contexts.get(sessionId);

    if (!context || context.depth <= 0) {
      return null;
    }

    context.depth--;
    context.selectedOptions.pop();

    // Reset to main menu or previous sub-menu
    if (context.depth === 0) {
      const mainMenu = this.menus.get('main')!;
      context.menuId = 'main';
      context.currentMenu = mainMenu;
    }

    logger.info('IVR navigated back', {
      sessionId,
      menuId: context.menuId,
      depth: context.depth
    });

    return context;
  }

  /**
   * Get the appropriate prompt for current state
   */
  getPrompt(sessionId: string): string {
    const context = this.contexts.get(sessionId);

    if (!context) {
      return 'Welcome. Please wait for assistance.';
    }

    if (context.retryCount > 0 && context.retryCount < context.currentMenu.maxRetries) {
      return `Invalid selection. ${context.currentMenu.prompt}`;
    }

    return context.currentMenu.prompt;
  }

  /**
   * Check if session should transfer to agent
   */
  shouldTransferToAgent(sessionId: string): {
    shouldTransfer: boolean;
    agentType?: VoiceAgentType;
    isOperator?: boolean;
  } {
    const context = this.contexts.get(sessionId);

    if (!context) {
      return { shouldTransfer: false };
    }

    const lastOption = context.selectedOptions[context.selectedOptions.length - 1];

    if (lastOption === IvrOption.OPERATOR) {
      return { shouldTransfer: true, isOperator: true };
    }

    const selectedItem = context.currentMenu.items.find(
      item => item.key === lastOption
    );

    if (selectedItem?.agentType) {
      return { shouldTransfer: true, agentType: selectedItem.agentType };
    }

    return { shouldTransfer: false };
  }

  /**
   * Check if session should record voicemail
   */
  shouldRecordVoicemail(sessionId: string): boolean {
    const context = this.contexts.get(sessionId);

    if (!context) {
      return false;
    }

    const lastOption = context.selectedOptions[context.selectedOptions.length - 1];
    return lastOption === IvrOption.REPEAT && context.retryCount >= context.currentMenu.maxRetries;
  }

  /**
   * Handle timeout
   */
  handleTimeout(sessionId: string): IvrContext {
    const context = this.contexts.get(sessionId);

    if (!context) {
      throw new Error(`Session ${sessionId} not found`);
    }

    context.retryCount++;

    logger.info('IVR timeout', {
      sessionId,
      retryCount: context.retryCount
    });

    return context;
  }

  /**
   * End IVR session
   */
  endSession(sessionId: string): void {
    const context = this.contexts.get(sessionId);
    if (context) {
      logger.info('IVR session ended', {
        sessionId,
        totalDepth: context.depth,
        selectedOptions: context.selectedOptions.join(',')
      });
    }
    this.contexts.delete(sessionId);
  }

  /**
   * Add custom menu
   */
  addMenu(menu: IvrMenu): void {
    this.menus.set(menu.id, menu);
    logger.info('IVR menu added', { menuId: menu.id, menuName: menu.name });
  }

  /**
   * Get menu by ID
   */
  getMenu(menuId: string): IvrMenu | undefined {
    return this.menus.get(menuId);
  }

  /**
   * Get all available menus
   */
  getAllMenus(): IvrMenu[] {
    return Array.from(this.menus.values());
  }

  /**
   * Generate TwiML for current menu state
   */
  generateTwiML(sessionId: string, actionUrl: string): string {
    const context = this.contexts.get(sessionId);

    if (!context) {
      return this.generateErrorTwiML('Session expired. Please call again.');
    }

    const transferInfo = this.shouldTransferToAgent(sessionId);
    const recordVoicemail = this.shouldRecordVoicemail(sessionId);

    if (recordVoicemail) {
      return this.generateVoicemailTwiML(actionUrl);
    }

    if (transferInfo.shouldTransfer) {
      if (transferInfo.isOperator) {
        return this.generateTransferTwiML(
          process.env.OPERATOR_PHONE_NUMBER || '',
          `Transferring you to an operator. Please hold.`
        );
      } else if (transferInfo.agentType) {
        // Agent will handle from here
        return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-US">Connecting you to ${transferInfo.agentType} support. Please hold.</Say>
  <Pause length="2"/>
</Response>`;
      }
    }

    // Generate gather for menu
    return this.generateMenuTwiML(context, actionUrl);
  }

  /**
   * Generate menu gather TwiML
   */
  private generateMenuTwiML(context: IvrContext, actionUrl: string): string {
    const prompt = this.getPrompt(context.sessionId || '');
    const numDigits = 1;
    const timeout = context.currentMenu.timeoutSeconds;

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="${numDigits}" timeout="${timeout}" action="${actionUrl}" method="POST">
    <Say voice="alice" language="en-US">${this.escapeXml(prompt)}</Say>
  </Gather>
  <Redirect method="POST">${actionUrl}</Redirect>
</Response>`;
  }

  /**
   * Generate error TwiML
   */
  private generateErrorTwiML(message: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-US">${this.escapeXml(message)}</Say>
</Response>`;
  }

  /**
   * Generate transfer TwiML
   */
  private generateTransferTwiML(number: string, message: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-US">${this.escapeXml(message)}</Say>
  <Dial timeout="30" record="record-from-ringing">
    <Number>${this.escapeXml(number)}</Number>
  </Dial>
</Response>`;
  }

  /**
   * Generate voicemail TwiML
   */
  private generateVoicemailTwiML(actionUrl: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-US">You have reached the voicemail. Please leave a message after the tone.</Say>
  <Record
    maxLength="300"
    timeout="5"
    transcribe="true"
    playBeep="true"
    action="${actionUrl}"
    method="POST"
    recordingStatusCallback="${actionUrl}"
  />
</Response>`;
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Get sub-menu ID from key
   */
  private getSubMenuId(key: string): string | null {
    const subMenuMap: Record<string, string> = {
      '1': 'sales',
      '2': 'support'
    };
    return subMenuMap[key] || null;
  }

  /**
   * Build conversation state from IVR selections
   */
  buildConversationContext(sessionId: string): {
    state: ConversationState;
    agentType?: VoiceAgentType;
    metadata: Record<string, unknown>;
  } {
    const context = this.contexts.get(sessionId);

    if (!context) {
      return { state: ConversationState.GREETING, metadata: {} };
    }

    const transferInfo = this.shouldTransferToAgent(sessionId);

    if (transferInfo.shouldTransfer) {
      return {
        state: ConversationState.TRANSFER,
        agentType: transferInfo.agentType,
        metadata: {
          selectedOptions: context.selectedOptions,
          depth: context.depth
        }
      };
    }

    if (context.retryCount >= context.currentMenu.maxRetries) {
      return {
        state: ConversationState.VOICEMAIL,
        metadata: {
          retryCount: context.retryCount,
          menuId: context.menuId
        }
      };
    }

    return {
      state: ConversationState.IVR_MENU,
      metadata: {
        menuId: context.menuId,
        depth: context.depth,
        retryCount: context.retryCount
      }
    };
  }
}

// Extend IvrContext to include sessionId
declare module '../types' {
  interface IvrContext {
    sessionId?: string;
  }
}

// Singleton instance
let ivrServiceInstance: IvrService | null = null;

export function getIvrService(): IvrService {
  if (!ivrServiceInstance) {
    ivrServiceInstance = new IvrService();
  }
  return ivrServiceInstance;
}

export default IvrService;
