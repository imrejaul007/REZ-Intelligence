/**
 * Event Ordering & Causal Consistency Utilities
 *
 * BE-EVT-032: Implements event versioning and causal ordering guarantees
 * across multiple queues (notification, media, analytics).
 *
 * Uses event versioning + causality tracking to maintain ordering invariants
 * for state machines (e.g., order lifecycle: created → paid → shipped → delivered).
 */

import type Redis from 'ioredis';
const warn = (msg: string) => { console.warn(`[eventOrdering] ${msg}`); };

/**
 * Event versioning for causal consistency
 * Each event in a causal chain has a version number and parent version reference
 */
export interface VersionedEvent {
  eventId: string;
  version: number; // Monotonically increasing version
  parentVersion?: number; // Version of the causally-preceding event
  entityId: string; // The entity this event pertains to (e.g., orderId)
  entityType: string; // Type of entity (order, product, user, etc.)
  causality?: {
    entityId: string;
    requiredVersion: number; // This event can only be processed after parent reaches this version
  };
  [key: string]: any;
}

/**
 * Track causal dependencies for events
 * Prevents out-of-order processing of dependent events
 */
export class CausalityTracker {
  private redis: Redis;
  private readonly namespace = 'causality';

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Get the current version of an entity
   */
  async getEntityVersion(entityType: string, entityId: string): Promise<number> {
    const key = `${this.namespace}:${entityType}:${entityId}:version`;
    const version = await this.redis.get(key);
    return version ? parseInt(version, 10) : 0;
  }

  /**
   * Increment entity version and return the new version
   */
  async incrementEntityVersion(entityType: string, entityId: string): Promise<number> {
    const key = `${this.namespace}:${entityType}:${entityId}:version`;
    const newVersion = await this.redis.incr(key);
    // Set expiry to 30 days (for cleanup of old versions)
    await this.redis.expire(key, 30 * 24 * 60 * 60);
    return newVersion;
  }

  /**
   * Check if an event is ready to be processed based on causal dependencies
   */
  async canProcessEvent(event: VersionedEvent): Promise<boolean> {
    // If no causal dependency, can always process
    if (!event.causality) {
      return true;
    }

    const { entityId, requiredVersion } = event.causality;
    const currentVersion = await this.getEntityVersion(event.entityType, entityId);

    // Can only process if the required version has been reached
    return currentVersion >= requiredVersion;
  }

  /**
   * Record that an event version was processed
   */
  async recordEventProcessed(event: VersionedEvent): Promise<void> {
    const key = `${this.namespace}:${event.entityType}:${event.entityId}:processed:${event.version}`;
    await this.redis.setex(key, 30 * 24 * 60 * 60, '1'); // Keep for 30 days
  }

  /**
   * Check if an event version has already been processed (for idempotency)
   */
  async isEventProcessed(event: VersionedEvent): Promise<boolean> {
    const key = `${this.namespace}:${event.entityType}:${event.entityId}:processed:${event.version}`;
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  /**
   * Clear causality tracking for an entity (cleanup after saga completion)
   */
  async clearEntityTracking(entityType: string, entityId: string): Promise<void> {
    const pattern = `${this.namespace}:${entityType}:${entityId}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

/**
 * Event ordering strategy for saga patterns
 *
 * Saga pattern: Long-running transaction across multiple services
 * Each step must wait for the previous step to complete
 *
 * Example order processing saga:
 * 1. order.created (v1)
 * 2. payment.processed (v1, requires order v1)
 * 3. inventory.reserved (v1, requires payment v1)
 * 4. order.shipped (v1, requires inventory v1)
 * 5. customer.notified (v1, requires order v1)
 */
export class SagaOrchestrator {
  private causality: CausalityTracker;

  constructor(redis: Redis) {
    this.causality = new CausalityTracker(redis);
  }

  /**
   * Define a saga step with its causal dependencies
   */
  async defineStep(
    stepName: string,
    entityType: string,
    entityId: string,
    requiredPreviousSteps: Array<{ stepName: string; entityType: string; entityId: string }> = [],
  ): Promise<VersionedEvent> {
    const currentVersion = await this.causality.getEntityVersion(entityType, entityId);

    // Calculate required version based on previous steps
    let requiredVersion = currentVersion;
    for (const prev of requiredPreviousSteps) {
      const prevVersion = await this.causality.getEntityVersion(prev.entityType, prev.entityId);
      requiredVersion = Math.max(requiredVersion, prevVersion);
    }

    return {
      eventId: `${stepName}:${entityId}:${Date.now()}`,
      version: currentVersion + 1,
      entityId,
      entityType,
      causality: requiredPreviousSteps.length > 0
        ? { entityId, requiredVersion }
        : undefined,
    };
  }

  /**
   * Check if a step can be executed
   */
  async canExecuteStep(event: VersionedEvent): Promise<boolean> {
    // Check idempotency
    const isProcessed = await this.causality.isEventProcessed(event);
    if (isProcessed) {
      return false; // Already executed
    }

    // Check causality
    return await this.causality.canProcessEvent(event);
  }

  /**
   * Mark a step as completed
   */
  async markStepCompleted(event: VersionedEvent): Promise<void> {
    await this.causality.incrementEntityVersion(event.entityType, event.entityId);
    await this.causality.recordEventProcessed(event);
  }

  /**
   * Rollback a saga (for compensation transactions)
   */
  async rollbackSaga(entityType: string, entityId: string): Promise<void> {
    await this.causality.clearEntityTracking(entityType, entityId);
  }
}

/**
 * Event stream consistency checker
 * Validates that events conform to ordering guarantees
 */
export class EventStreamValidator {
  /**
   * Validate event ordering within a single entity's event stream
   */
  static validateEntityEventOrder(events: VersionedEvent[]): boolean {
    if (events.length === 0) return true;

    // Sort by version
    const sorted = [...events].sort((a, b) => a.version - b.version);

    // Check version continuity
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].version !== sorted[i - 1].version + 1) {
        warn(
          `Event ordering violation: expected v${sorted[i - 1].version + 1}, got v${sorted[i].version}`,
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Validate causal ordering across multiple event streams
   */
  static validateCausalOrdering(events: VersionedEvent[]): boolean {
    const entityVersions = new Map<string, number>();

    // Process events in version order
    for (const event of events) {
      const key = `${event.entityType}:${event.entityId}`;
      const currentVersion = entityVersions.get(key) || 0;

      if (!event.causality) {
        // No dependency, can process
        entityVersions.set(key, Math.max(currentVersion, event.version));
        continue;
      }

      // Check if dependency is satisfied
      const depKey = `${event.causality.entityId}`;
      const depVersion = entityVersions.get(depKey) || 0;

      if (depVersion < event.causality.requiredVersion) {
        warn(
          `Causal ordering violation: ${key} v${event.version} requires ${depKey} v${event.causality.requiredVersion}, but only v${depVersion} is available`,
        );
        return false;
      }

      entityVersions.set(key, Math.max(currentVersion, event.version));
    }

    return true;
  }
}
