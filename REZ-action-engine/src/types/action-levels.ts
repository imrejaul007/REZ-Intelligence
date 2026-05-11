/**
 * Action Safety Levels
 *
 * Defines the risk level for each action type to determine
 * whether automation is allowed or human approval is required.
 */

export enum ActionLevel {
  /**
   * Safe actions - notifications, recommendations, logging
   * Examples: send notification, log event, create draft
   */
  SAFE = 1,

  /**
   * Semi-safe actions - suggestions requiring 1-click approval
   * Examples: reorder suggestion, price adjustment preview
   */
  SEMI_SAFE = 2,

  /**
   * Risky actions - requires manual review and approval
   * Examples: bulk operations, price changes, inventory adjustments
   */
  RISKY = 3,

  /**
   * Forbidden actions - never automate, always block
   * Examples: delete all data, bypass payments, modify security
   */
  FORBIDDEN = 4
}

/**
 * Action execution status
 */
export enum ActionStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * Core action definition
 */
export interface Action {
  id: string;
  name: string;
  level: ActionLevel;
  eventTrigger: string;
  description: string;
  autoExecute: boolean;
  requiresApproval?: boolean;
  timeoutMs?: number;
  retryable?: boolean;
  maxRetries?: number;
}

/**
 * Action execution request
 */
export interface ActionRequest {
  actionId: string;
  eventId: string;
  payload: Record<string, unknown>;
  userId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Action execution result
 */
export interface ActionResult {
  success: boolean;
  actionId: string;
  executionId: string;
  status: ActionStatus;
  output?: Record<string, unknown>;
  error?: string;
  executedAt: Date;
  executionTimeMs?: number;
}

/**
 * Approval request for human-in-loop
 */
export interface ApprovalRequest {
  id: string;
  actionId: string;
  eventId: string;
  payload: Record<string, unknown>;
  status: ActionStatus;
  requestedAt: Date;
  requestedBy?: string;
  approvedAt?: Date;
  approvedBy?: string;
  rejectedAt?: Date;
  rejectedBy?: string;
  rejectionReason?: string;
}

/**
 * Policy rule for action execution
 */
export interface PolicyRule {
  actionLevel: ActionLevel;
  autoApprove: boolean;
  requireReason: boolean;
  maxExecutionsPerHour?: number;
}

/**
 * Action policy configuration
 */
export const ACTION_POLICIES: Record<ActionLevel, PolicyRule> = {
  [ActionLevel.SAFE]: {
    actionLevel: ActionLevel.SAFE,
    autoApprove: true,
    requireReason: false,
    maxExecutionsPerHour: 1000
  },
  [ActionLevel.SEMI_SAFE]: {
    actionLevel: ActionLevel.SEMI_SAFE,
    autoApprove: false,
    requireReason: false,
    maxExecutionsPerHour: 100
  },
  [ActionLevel.RISKY]: {
    actionLevel: ActionLevel.RISKY,
    autoApprove: false,
    requireReason: true,
    maxExecutionsPerHour: 10
  },
  [ActionLevel.FORBIDDEN]: {
    actionLevel: ActionLevel.FORBIDDEN,
    autoApprove: false,
    requireReason: false,
    maxExecutionsPerHour: 0
  }
};

/**
 * Level display names
 */
export const ACTION_LEVEL_NAMES: Record<ActionLevel, string> = {
  [ActionLevel.SAFE]: 'Safe',
  [ActionLevel.SEMI_SAFE]: 'Semi-Safe',
  [ActionLevel.RISKY]: 'Risky',
  [ActionLevel.FORBIDDEN]: 'Forbidden'
};
