import { SequenceAnalyzer } from '../src/services/sequenceAnalyzer';
import type { BehaviorEvent, ActionType } from '../src/types';

describe('SequenceAnalyzer', () => {
  let analyzer: SequenceAnalyzer;

  beforeEach(() => {
    analyzer = new SequenceAnalyzer({ order: 1, minFrequency: 2 });
  });

  describe('buildMarkovModel', () => {
    it('should build a valid Markov chain model', () => {
      const sequences: ActionType[][] = [
        ['browse', 'view_product', 'add_to_cart', 'complete_purchase'],
        ['browse', 'view_product', 'add_to_cart'],
        ['browse', 'search', 'view_product']
      ];

      const model = analyzer.buildMarkovModel({
        userId: 'user123',
        sequences
      });

      expect(model.userId).toBe('user123');
      expect(model.states.length).toBeGreaterThan(0);
      expect(model.order).toBe(1);
      expect(model.entropy).toBeGreaterThanOrEqual(0);
      expect(model.eventCount).toBe(10);
    });

    it('should calculate transition probabilities', () => {
      const sequences: ActionType[][] = [
        ['browse', 'view_product', 'add_to_cart'],
        ['browse', 'view_product', 'add_to_cart'],
        ['browse', 'view_product', 'search']
      ];

      const model = analyzer.buildMarkovModel({
        userId: 'user123',
        sequences
      });

      // browse -> view_product should be 1.0 (3 out of 3 times)
      expect(model.transitionMatrix['browse']['view_product']).toBe(1.0);
      
      // view_product -> add_to_cart should be ~0.67 (2 out of 3 times)
      expect(model.transitionMatrix['view_product']['add_to_cart']).toBeCloseTo(0.667, 1);
    });
  });

  describe('predictNextAction', () => {
    it('should predict next actions based on current state', () => {
      const sequences: ActionType[][] = [
        ['browse', 'view_product', 'add_to_cart'],
        ['browse', 'view_product', 'add_to_cart'],
        ['browse', 'view_product', 'search']
      ];

      const model = analyzer.buildMarkovModel({
        userId: 'user123',
        sequences
      });

      const predictions = analyzer.predictNextAction(model, 'view_product');

      expect(predictions.length).toBeGreaterThan(0);
      expect(predictions[0].action).toBe('add_to_cart');
      expect(predictions[0].probability).toBeGreaterThan(0);
    });

    it('should return empty predictions for unknown state', () => {
      const model = analyzer.buildMarkovModel({
        userId: 'user123',
        sequences: [['browse', 'view_product']]
      });

      const predictions = analyzer.predictNextAction(model, 'unknown_action' as ActionType);

      expect(predictions.length).toBe(0);
    });
  });

  describe('detectPatterns', () => {
    it('should detect sequential patterns', () => {
      const events: BehaviorEvent[] = [
        createEvent('session1', 'browse', 0),
        createEvent('session1', 'view_product', 1),
        createEvent('session1', 'add_to_cart', 2),
        createEvent('session2', 'browse', 100),
        createEvent('session2', 'view_product', 101),
        createEvent('session2', 'add_to_cart', 102)
      ];

      const patterns = analyzer.detectPatterns(events, 2);

      expect(patterns.length).toBeGreaterThan(0);
      
      // Should detect browse -> view_product -> add_to_cart pattern
      const fullSequence = patterns.find(p => 
        p.sequence.length === 3 && 
        p.sequence[0] === 'browse' &&
        p.sequence[1] === 'view_product' &&
        p.sequence[2] === 'add_to_cart'
      );
      expect(fullSequence).toBeDefined();
      expect(fullSequence?.frequency).toBe(2);
    });

    it('should not detect patterns below minimum frequency', () => {
      const events: BehaviorEvent[] = [
        createEvent('session1', 'browse', 0),
        createEvent('session1', 'view_product', 1),
        createEvent('session1', 'add_to_cart', 2)
      ];

      const patterns = analyzer.detectPatterns(events, 3);

      // Should not detect patterns with frequency < 3
      expect(patterns.length).toBe(0);
    });
  });

  describe('analyzeSequence', () => {
    it('should perform complete sequence analysis', () => {
      const events: BehaviorEvent[] = [
        createEvent('session1', 'browse', 0),
        createEvent('session1', 'view_product', 1),
        createEvent('session1', 'add_to_cart', 2),
        createEvent('session1', 'complete_purchase', 3)
      ];

      const result = analyzer.analyzeSequence('user123', events, {
        includeMarkovModel: true,
        minEvents: 2
      });

      expect(result.userId).toBe('user123');
      expect(result.totalEvents).toBe(4);
      expect(result.totalSessions).toBe(1);
      expect(result.markovModel).toBeDefined();
      expect(result.conversionFunnel.length).toBeGreaterThan(0);
    });

    it('should generate insights', () => {
      const events: BehaviorEvent[] = [
        createEvent('session1', 'browse', 0),
        createEvent('session1', 'view_product', 1),
        createEvent('session1', 'add_to_cart', 2)
      ];

      const result = analyzer.analyzeSequence('user123', events, {
        minEvents: 1
      });

      // Cart without purchase = abandonment insight
      expect(result.insights.some(i => i.includes('abandonment'))).toBe(true);
    });
  });
});

// Helper function to create test events
function createEvent(sessionId: string, action: ActionType, minutesOffset: number): BehaviorEvent {
  const timestamp = new Date();
  timestamp.setMinutes(timestamp.getMinutes() - (100 - minutesOffset));

  return {
    eventId: `${sessionId}-${action}-${minutesOffset}`,
    userId: 'user123',
    action,
    timestamp,
    sessionId,
    metadata: {}
  };
}
