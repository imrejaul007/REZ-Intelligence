/**
 * REZ Conversation Intelligence - Action Item Extraction Service
 *
 * Identifies tasks and action items from conversation messages.
 * Extracts assignees, due dates, priorities, and task descriptions.
 *
 * Port: Part of REZ-Conversation-Intelligence
 */

import logger from './utils/logger.js';
import { config } from '../config/index.js';

// ============================================================================
// Types
// ============================================================================

export interface ActionItem {
  id: string;
  conversationId: string;
  description: string;
  assignee?: string;
  assigneeId?: string;
  dueDate?: Date;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  confidence: number;
  sourceMessageId: string;
  sourceMessageContent: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  notes?: string;
  tags?: string[];
}

export interface ActionItemExtraction {
  conversationId: string;
  actionItems: ActionItem[];
  totalTasks: number;
  pendingTasks: number;
  completedTasks: number;
  highPriorityTasks: number;
  extractedAt: Date;
}

export interface TaskPattern {
  type: 'commitment' | 'request' | 'question' | 'deadline';
  pattern: RegExp;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  template: (match: RegExpMatchArray) => string;
}

// ============================================================================
// Task Patterns
// ============================================================================

const TASK_PATTERNS: TaskPattern[] = [
  // Commitments (I will do)
  {
    type: 'commitment',
    pattern: /\b(i(?:'ll|'ll| will|ve)\s+(?:send|send you|email|call|fix|update|review|check|look|get|prepare|create|send|share|forward|confirm|callback|reply|respond|get back|track|follow up|escalate)\b/i,
    priority: 'medium',
    template: (match) => `Will ${match[0].replace(/i(?:'ll|'ll| will|ve)\s+/i, '')}`
  },
  {
    type: 'commitment',
    pattern: /\b(will|shall)\s+(?:send|email|call|fix|update|review|check|look|get|prepare|create|send|share|forward|confirm|callback|reply|respond|track|follow up|escalate)\b/i,
    priority: 'medium',
    template: (match) => match[0]
  },
  {
    type: 'commitment',
    pattern: /\b(i(?:'m|' am)\s+going to\s+(send|email|call|fix|update|review|check|look|get|prepare|create|share|forward|confirm|track|follow up|escalate)\b/i,
    priority: 'medium',
    template: (match) => `Going to ${match[1]}`
  },

  // Requests (Can you / Please)
  {
    type: 'request',
    pattern: /\b(can you|could you|would you|please|kindly)\s+(send|email|call|fix|update|check|review|look|send|provide|share|forward|confirm|callback|reply|clarify|explain|help|assist|arrange|schedule|book|send)\b/i,
    priority: 'high',
    template: (match) => `${match[1].charAt(0).toUpperCase() + match[1].slice(1)} ${match[2]}`
  },
  {
    type: 'request',
    pattern: /\b(need to|must|should)\s+(?:have\s+)?(send|email|call|fix|update|check|review|look|send|provide|share|forward|confirm|clarify|explain|help|arrange|schedule|book)\b/i,
    priority: 'high',
    template: (match) => `Required: ${match[2]}`
  },

  // Deadlines
  {
    type: 'deadline',
    pattern: /\b(by\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|end of (?:day|week|month)|this (?:week|month)))\b/i,
    priority: 'high',
    template: (match) => `Due ${match[1]}`
  },
  {
    type: 'deadline',
    pattern: /\b(within|before|after|until|till)\s+(\d+\s+(?:day|week|month|hour)s?)\b/i,
    priority: 'medium',
    template: (match) => `Due ${match[1]} ${match[2]}`
  },
  {
    type: 'deadline',
    pattern: /\b(urgent|asap|immediately|right away)\b/i,
    priority: 'urgent',
    template: () => 'Urgent - Immediate action required'
  },

  // Questions (follow-up)
  {
    type: 'question',
    pattern: /\b(follow up|follow-up|followup)\s+(on|with|about)?\s*(.*?)(?:\?|$)/i,
    priority: 'medium',
    template: (match) => `Follow up ${match[2] || ''} ${match[3] || ''}`.trim()
  },
  {
    type: 'question',
    pattern: /\b(check back|touch base|connect)\s+(on|with|about)?\s*(.*?)(?:\?|$)/i,
    priority: 'low',
    template: (match) => `${match[1]} ${match[2] || ''} ${match[3] || ''}`.trim()
  }
];

// ============================================================================
// Priority Keywords
// ============================================================================

const PRIORITY_KEYWORDS: Record<string, 'low' | 'medium' | 'high' | 'urgent'> = {
  // Urgent
  'urgent': 'urgent',
  'asap': 'urgent',
  'immediately': 'urgent',
  'right now': 'urgent',
  'emergency': 'urgent',
  'critical': 'urgent',
  'important': 'high',

  // High
  'important': 'high',
  'priority': 'high',
  'high priority': 'high',
  'as soon as possible': 'high',
  'soon': 'high',
  'quickly': 'high',

  // Medium
  'when you get a chance': 'medium',
  'when possible': 'medium',
  'eventually': 'medium',
  'no rush': 'low',
  'whenever': 'low'
};

// ============================================================================
// Assignee Patterns
// ============================================================================

const ASSIGNEE_PATTERNS = [
  /\b(i|me|my)\b/i,           // Self-assignment
  /\b(you|your)\b/i,           // Other party
  /\b(we|us|our)\b/i,          // Team
  /\b(someone|team|anyone)\b/i, // Delegation
  /@(\w+)/g,                    // @mentions
  /\b(?:send to|email to|call|contact)\s+(\w+)/gi // Direct assignment
];

// ============================================================================
// Date Extraction Patterns
// ============================================================================

const DATE_PATTERNS: Array<{ pattern: RegExp; extractor: (match: RegExpMatchArray) => Date | undefined }> = [
  {
    pattern: /\b(tomorrow)\b/i,
    extractor: () => {
      const date = new Date();
      date.setDate(date.getDate() + 1);
      return date;
    }
  },
  {
    pattern: /\b(today)\b/i,
    extractor: () => new Date()
  },
  {
    pattern: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    extractor: (match) => {
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const targetDay = days.indexOf(match[1].toLowerCase());
      const date = new Date();
      const currentDay = date.getDay();
      const diff = (targetDay - currentDay + 7) % 7 || 7;
      date.setDate(date.getDate() + diff);
      return date;
    }
  },
  {
    pattern: /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/,
    extractor: (match) => {
      const date = new Date();
      date.setMonth(parseInt(match[1]) - 1);
      date.setDate(parseInt(match[2]));
      const year = match[3].length === 2 ? 2000 + parseInt(match[3]) : parseInt(match[3]);
      date.setFullYear(year);
      return date;
    }
  },
  {
    pattern: /\b(within|in|after)\s+(\d+)\s+(days?|weeks?|hours?)\b/i,
    extractor: (match) => {
      const num = parseInt(match[2]);
      const unit = match[3].toLowerCase();
      const date = new Date();

      if (unit.startsWith('day')) date.setDate(date.getDate() + num);
      else if (unit.startsWith('week')) date.setDate(date.getDate() + num * 7);
      else if (unit.startsWith('hour')) date.setHours(date.getHours() + num);

      return date;
    }
  }
];

// ============================================================================
// Action Item Extractor Service
// ============================================================================

export class ActionItemExtractor {
  private confidenceThreshold: number;
  private enableDateExtraction: boolean;
  private enableAssigneeExtraction: boolean;

  constructor() {
    this.confidenceThreshold = config.ACTION_ITEM_CONFIDENCE_THRESHOLD || 0.5;
    this.enableDateExtraction = true;
    this.enableAssigneeExtraction = true;
  }

  /**
   * Extract action items from conversation messages
   */
  async extractActionItems(
    conversationId: string,
    messages: Array<{ id: string; content: string; senderType: string; senderId: string; timestamp: Date }>
  ): Promise<ActionItemExtraction> {
    const actionItems: ActionItem[] = [];
    const seenDescriptions = new Set<string>();

    logger.info('Extracting action items', { conversationId, messageCount: messages.length });

    for (const message of messages) {
      const items = this.extractFromMessage(message, conversationId);

      for (const item of items) {
        // Deduplicate similar items
        const normalizedDesc = item.description.toLowerCase().trim();
        if (!seenDescriptions.has(normalizedDesc)) {
          seenDescriptions.add(normalizedDesc);
          actionItems.push(item);
        }
      }
    }

    // Sort by priority and confidence
    actionItems.sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.confidence - a.confidence;
    });

    const result: ActionItemExtraction = {
      conversationId,
      actionItems,
      totalTasks: actionItems.length,
      pendingTasks: actionItems.filter(i => i.status === 'pending').length,
      completedTasks: actionItems.filter(i => i.status === 'completed').length,
      highPriorityTasks: actionItems.filter(i =>
        i.priority === 'high' || i.priority === 'urgent'
      ).length,
      extractedAt: new Date()
    };

    logger.info('Action items extracted', {
      conversationId,
      totalTasks: result.totalTasks,
      highPriority: result.highPriorityTasks
    });

    return result;
  }

  /**
   * Extract action items from a single message
   */
  private extractFromMessage(
    message: { id: string; content: string; senderType: string; senderId: string; timestamp: Date },
    conversationId: string
  ): ActionItem[] {
    const items: ActionItem[] = [];
    const text = message.content;

    // Try each pattern
    for (const taskPattern of TASK_PATTERNS) {
      const matches = text.matchAll(new RegExp(taskPattern.pattern.source, taskPattern.pattern.flags));

      for (const match of matches) {
        const description = taskPattern.template(match);
        const priority = this.extractPriority(text, match);
        const assignee = this.extractAssignee(text, message);
        const dueDate = this.extractDueDate(text);

        // Calculate confidence based on pattern match quality
        const confidence = this.calculateConfidence(taskPattern, match, priority);

        if (confidence >= this.confidenceThreshold) {
          items.push({
            id: this.generateId(),
            conversationId,
            description,
            assignee,
            assigneeId: assignee === 'self' ? message.senderId : undefined,
            dueDate,
            priority,
            status: 'pending',
            confidence,
            sourceMessageId: message.id,
            sourceMessageContent: message.content.substring(0, 200),
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      }
    }

    return items;
  }

  /**
   * Extract priority from text
   */
  private extractPriority(
    text: string,
    match: RegExpMatchArray
  ): 'low' | 'medium' | 'high' | 'urgent' {
    // Check for explicit priority keywords
    const lowerText = text.toLowerCase();

    for (const [keyword, priority] of Object.entries(PRIORITY_KEYWORDS)) {
      if (lowerText.includes(keyword)) {
        return priority;
      }
    }

    // Default to pattern priority
    return 'medium';
  }

  /**
   * Extract assignee from text
   */
  private extractAssignee(
    text: string,
    message: { content: string; senderType: string; senderId: string }
  ): string | undefined {
    if (!this.enableAssigneeExtraction) return undefined;

    // Check @mentions
    const atMentions = text.match(/@(\w+)/g);
    if (atMentions && atMentions.length > 0) {
      return atMentions[0].substring(1); // Remove @ symbol
    }

    // Check first person (self)
    if (/\b(i|my|me)\b/i.test(text) && message.senderType !== 'user') {
      return 'self';
    }

    // Check second person (other party)
    if (/\b(you|your)\b/i.test(text)) {
      return 'other';
    }

    return undefined;
  }

  /**
   * Extract due date from text
   */
  private extractDueDate(text: string): Date | undefined {
    if (!this.enableDateExtraction) return undefined;

    for (const datePattern of DATE_PATTERNS) {
      const match = text.match(datePattern.pattern);
      if (match) {
        const date = datePattern.extractor(match);
        if (date && date > new Date()) {
          return date;
        }
      }
    }

    return undefined;
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    pattern: TaskPattern,
    match: RegExpMatchArray,
    priority: 'low' | 'medium' | 'high' | 'urgent'
  ): number {
    let confidence = 0.5;

    // Higher confidence for explicit commitments
    if (pattern.type === 'commitment') {
      confidence += 0.2;
    }

    // Higher confidence for requests
    if (pattern.type === 'request') {
      confidence += 0.15;
    }

    // Higher confidence for urgent/important items
    if (priority === 'urgent' || priority === 'high') {
      confidence += 0.1;
    }

    // Higher confidence for longer descriptions
    const descLength = match[0].length;
    if (descLength > 30) confidence += 0.1;
    else if (descLength > 50) confidence += 0.15;

    // Cap at 0.95
    return Math.min(confidence, 0.95);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Extract action items from single text
   */
  async extractFromText(text: string, conversationId: string = 'unknown'): Promise<ActionItem[]> {
    const mockMessage = {
      id: this.generateId(),
      content: text,
      senderType: 'unknown' as const,
      senderId: 'unknown',
      timestamp: new Date()
    };

    const result = await this.extractActionItems(conversationId, [mockMessage]);
    return result.actionItems;
  }

  /**
   * Update action item status
   */
  updateStatus(
    item: ActionItem,
    newStatus: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  ): ActionItem {
    const updated = { ...item };
    updated.status = newStatus;
    updated.updatedAt = new Date();

    if (newStatus === 'completed') {
      updated.completedAt = new Date();
    }

    return updated;
  }

  /**
   * Get overdue tasks
   */
  getOverdueTasks(items: ActionItem[]): ActionItem[] {
    const now = new Date();
    return items.filter(item =>
      item.status !== 'completed' &&
      item.status !== 'cancelled' &&
      item.dueDate &&
      item.dueDate < now
    );
  }

  /**
   * Get tasks by assignee
   */
  getTasksByAssignee(items: ActionItem[]): Record<string, ActionItem[]> {
    const byAssignee: Record<string, ActionItem[]> = {
      'unassigned': []
    };

    for (const item of items) {
      const key = item.assignee || 'unassigned';
      if (!byAssignee[key]) {
        byAssignee[key] = [];
      }
      byAssignee[key].push(item);
    }

    return byAssignee;
  }
}

// Export singleton instance
export const actionItemExtractor = new ActionItemExtractor();
export default actionItemExtractor;
