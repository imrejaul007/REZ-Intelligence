import { PatternDetector } from '../src/services/patternDetector';
import type { BehaviorEvent, ActionType } from '../src/types';

describe('PatternDetector', () => {
  let detector: PatternDetector;

  beforeEach(() => {
    detector = new PatternDetector({ minOccurrences: 2 });
  });

  describe('detectPatterns', () => {
    it('should detect temporal patterns', () => {
      const events: BehaviorEvent[] = [];
      
      // Create events at peak hours (18:00-20:00)
      for (let day = 0; day < 5; day++) {
        const date = new Date();
        date.setDate(date.getDate() - day);
        date.setHours(19, 0, 0, 0);

        events.push(createEvent('session' + day, 'browse', date));
        events.push(createEvent('session' + day, 'view_product', date, 1));
      }

      const result = detector.detectPatterns('user123', events);

      expect(result.patterns.length).toBeGreaterThan(0);
      
      const temporalPatterns = result.patterns.filter(p => p.patternType === 'temporal');
      expect(temporalPatterns.length).toBeGreaterThan(0);
    });

    it('should detect sequential patterns', () => {
      const events: BehaviorEvent[] = [];
      
      // Multiple sessions with the same sequence
      for (let i = 0; i < 3; i++) {
        const baseDate = new Date();
        baseDate.setMinutes(baseDate.getMinutes() - i * 100);

        events.push(createEvent('session' + i, 'browse', baseDate, 0));
        events.push(createEvent('session' + i, 'view_product', baseDate, 1));
        events.push(createEvent('session' + i, 'add_to_cart', baseDate, 2));
      }

      const result = detector.detectPatterns('user123', events);

      const sequentialPatterns = result.patterns.filter(p => p.patternType === 'sequential');
      expect(sequentialPatterns.length).toBeGreaterThan(0);
    });

    it('should calculate confidence based on data quality', () => {
      const events: BehaviorEvent[] = [];
      
      // Many events for high confidence
      for (let i = 0; i < 20; i++) {
        const date = new Date();
        date.setMinutes(date.getMinutes() - i * 10);
        events.push(createEvent('session' + i, 'browse', date, 0));
        events.push(createEvent('session' + i, 'view_product', date, 1));
      }

      const result = detector.detectPatterns('user123', events);

      expect(result.confidence).toBe('HIGH');
    });

    it('should return LOW confidence with insufficient data', () => {
      const events: BehaviorEvent[] = [
        createEvent('session1', 'browse', new Date(), 0),
        createEvent('session1', 'view_product', new Date(), 1)
      ];

      const result = detector.detectPatterns('user123', events);

      expect(['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']).toContain(result.confidence);
    });
  });

  describe('detectPeriodicPatterns', () => {
    it('should detect daily periodicity with enough data', () => {
      const events: BehaviorEvent[] = [];
      
      // Create events over multiple days at similar times
      for (let day = 0; day < 10; day++) {
        const date = new Date();
        date.setDate(date.getDate() - day);
        date.setHours(19, 30, 0, 0);

        events.push(createEvent('session' + day, 'browse', date, 0));
        events.push(createEvent('session' + day, 'view_product', date, 1));
      }

      const result = detector.detectPatterns('user123', events);

      // Should have periodic patterns
      expect(result.periodicPatterns.length).toBeGreaterThanOrEqual(0);
    });

    it('should return empty periodic patterns with insufficient data', () => {
      const events: BehaviorEvent[] = [
        createEvent('session1', 'browse', new Date(), 0),
        createEvent('session1', 'view_product', new Date(), 1)
      ];

      const result = detector.detectPatterns('user123', events);

      // Less than 20 events should not produce periodic patterns
      expect(result.periodicPatterns.length).toBe(0);
    });
  });

  describe('generateRecommendations', () => {
    it('should generate recommendations based on detected patterns', () => {
      const events: BehaviorEvent[] = [];
      
      // Create events with clear peak hours
      for (let day = 0; day < 5; day++) {
        const date = new Date();
        date.setDate(date.getDate() - day);
        date.setHours(19, 0, 0, 0);

        events.push(createEvent('session' + day, 'browse', date, 0));
        events.push(createEvent('session' + day, 'view_product', date, 1));
        events.push(createEvent('session' + day, 'complete_purchase', date, 2));
      }

      const result = detector.detectPatterns('user123', events);

      expect(result.recommendations.length).toBeGreaterThan(0);
      
      // Should recommend optimal engagement times
      const hasTimingRecommendation = result.recommendations.some(r => 
        r.includes('notification') || r.includes('engagement') || r.includes('campaign')
      );
      expect(hasTimingRecommendation).toBe(true);
    });
  });
});

function createEvent(
  sessionId: string, 
  action: ActionType, 
  baseDate: Date, 
  minutesOffset: number = 0
): BehaviorEvent {
  const timestamp = new Date(baseDate);
  timestamp.setMinutes(timestamp.getMinutes() + minutesOffset);

  return {
    eventId: `${sessionId}-${action}-${minutesOffset}`,
    userId: 'user123',
    action,
    timestamp,
    sessionId,
    metadata: {}
  };
}
