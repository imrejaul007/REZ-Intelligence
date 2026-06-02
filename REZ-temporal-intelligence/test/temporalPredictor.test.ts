import { TemporalPredictor } from '../src/services/temporalPredictor';
import type { BehaviorEvent, ActionType } from '../src/types';

describe('TemporalPredictor', () => {
  let predictor: TemporalPredictor;

  beforeEach(() => {
    predictor = new TemporalPredictor({ timeHorizon: 3600000 });
  });

  describe('predictNextAction', () => {
    it('should predict next action based on recent history', () => {
      const events: BehaviorEvent[] = [
        createEvent('session1', 'browse', 0),
        createEvent('session1', 'view_product', 1),
        createEvent('session1', 'add_to_cart', 2)
      ];

      const result = predictor.predictNextAction('user123', events);

      expect(result.userId).toBe('user123');
      expect(result.currentState).toBe('add_to_cart');
      expect(result.predictions.length).toBeGreaterThan(0);
      expect(result.predictedAt).toBeDefined();
    });

    it('should return empty prediction for insufficient data', () => {
      const events: BehaviorEvent[] = [];

      const result = predictor.predictNextAction('user123', events);

      expect(result.predictions.length).toBe(0);
      expect(result.factors.some(f => f.name === 'insufficient_data')).toBe(true);
    });

    it('should include time estimation', () => {
      const events: BehaviorEvent[] = [
        createEvent('session1', 'browse', 0),
        createEvent('session1', 'view_product', 1),
        createEvent('session1', 'add_to_cart', 2)
      ];

      const result = predictor.predictNextAction('user123', events);

      expect(result.predictions[0].estimatedTime).toBeGreaterThanOrEqual(0);
    });

    it('should calculate session context', () => {
      const events: BehaviorEvent[] = [
        createEvent('session1', 'browse', 0),
        createEvent('session1', 'view_product', 1),
        createEvent('session1', 'add_to_cart', 2)
      ];

      const result = predictor.predictNextAction('user123', events);

      expect(result.sessionContext).toBeDefined();
      expect(result.sessionContext?.sessionId).toBe('session1');
      expect(result.sessionContext?.eventsInSession).toBe(3);
    });
  });

  describe('predictTimeBased', () => {
    it('should predict optimal engagement windows', () => {
      const events: BehaviorEvent[] = [];
      
      // Create events at evening hours
      for (let i = 0; i < 10; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(19 + (i % 3), 0, 0, 0);
        
        events.push(createEvent('session' + i, 'browse', date, 0));
        events.push(createEvent('session' + i, 'view_product', date, 1));
      }

      const result = predictor.predictTimeBased('user123', events);

      expect(result.predictions.length).toBeGreaterThan(0);
      expect(result.optimalEngagementWindow).toBeDefined();
      expect(result.optimalEngagementWindow.probability).toBeGreaterThan(0);
    });

    it('should analyze time factors', () => {
      const events: BehaviorEvent[] = [];
      
      // Evening pattern
      for (let i = 0; i < 5; i++) {
        const date = new Date();
        date.setHours(19, 30, 0, 0);
        events.push(createEvent('session' + i, 'browse', date, 0));
      }

      const result = predictor.predictTimeBased('user123', events);

      expect(result.factors.length).toBeGreaterThan(0);
    });
  });

  describe('predictSession', () => {
    it('should predict next session details', () => {
      const events: BehaviorEvent[] = [];
      
      // Multiple sessions with consistent timing
      for (let day = 0; day < 5; day++) {
        const date = new Date();
        date.setDate(date.getDate() - day);
        date.setHours(19, 0, 0, 0);
        
        events.push(createEvent('session' + day, 'browse', date, 0));
        events.push(createEvent('session' + day, 'view_product', date, 1));
        events.push(createEvent('session' + day, 'complete_purchase', date, 2));
      }

      const result = predictor.predictSession('user123', events);

      expect(result.userId).toBe('user123');
      expect(result.nextSession).toBeDefined();
      expect(result.nextSession.predictedType).toBeDefined();
      expect(result.sessionPatterns.length).toBeGreaterThan(0);
    });
  });
});

function createEvent(
  sessionId: string, 
  action: ActionType, 
  minutesOffset: number
): BehaviorEvent {
  const timestamp = new Date();
  timestamp.setMinutes(timestamp.getMinutes() - minutesOffset);

  return {
    eventId: `${sessionId}-${action}-${minutesOffset}`,
    userId: 'user123',
    action,
    timestamp,
    sessionId,
    metadata: {}
  };
}
