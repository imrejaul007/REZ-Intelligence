/**
 * REZ Integration SDK - Unit Tests
 *
 * Tests for the unified SDK that connects all REZ apps to REZ Intelligence.
 * Covers: REZIntegration, EventTracker, IdentityManager, RecommendationEngine, FeedbackCollector
 */

// Mock axios before requiring the SDK
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn()
  })),
  interceptors: {
    request: { use: jest.fn(), eject: jest.fn() },
    response: { use: jest.fn(), eject: jest.fn() }
  }
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234')
}));

// Import SDK components
const {
  REZIntegration,
  EventTracker,
  IdentityManager,
  RecommendationEngine,
  FeedbackCollector,
  APP_TYPES,
  EVENT_TYPES,
  DEFAULT_CONFIG
} = require('../src/index.js');

// Import mock server for integration tests
const mockServer = require('./mock-server.js');

describe('REZIntegration', () => {
  let sdk;

  beforeEach(() => {
    jest.clearAllMocks();
    sdk = new REZIntegration({
      appId: 'test-app',
      apiKey: 'test-key',
      baseUrl: 'http://localhost:3000'
    });
  });

  afterEach(() => {
    if (sdk.batchTimer) {
      clearInterval(sdk.batchTimer);
    }
  });

  describe('constructor', () => {
    it('should initialize with config', () => {
      expect(sdk.config.baseUrl).toBe('http://localhost:3000');
      expect(sdk.config.timeout).toBe(DEFAULT_CONFIG.timeout);
      expect(sdk.config.batchSize).toBe(DEFAULT_CONFIG.batchSize);
      expect(sdk.appId).toBe('test-app');
      expect(sdk.apiKey).toBe('test-key');
    });

    it('should merge with default config', () => {
      expect(sdk.config.retryAttempts).toBe(DEFAULT_CONFIG.retryAttempts);
      expect(sdk.config.retryDelay).toBe(DEFAULT_CONFIG.retryDelay);
    });

    it('should initialize sub-modules', () => {
      expect(sdk.events).toBeInstanceOf(EventTracker);
      expect(sdk.identity).toBeInstanceOf(IdentityManager);
      expect(sdk.recommendations).toBeInstanceOf(RecommendationEngine);
      expect(sdk.feedback).toBeInstanceOf(FeedbackCollector);
    });

    it('should initialize event queue', () => {
      expect(Array.isArray(sdk.eventQueue)).toBe(true);
      expect(sdk.eventQueue.length).toBe(0);
    });

    it('should start batch timer', () => {
      expect(sdk.batchTimer).toBeDefined();
    });
  });

  describe('init', () => {
    it('should set user context', async () => {
      const mockRequest = jest.spyOn(sdk, '_request').mockResolvedValue({ success: true });
      await sdk.init({ userId: 'user123', phone: '+919876543210' });

      expect(sdk.userId).toBe('user123');
      expect(sdk.sessionId).toBeDefined();
      expect(mockRequest).toHaveBeenCalled();
    });

    it('should generate session ID if not provided', async () => {
      jest.spyOn(sdk, '_request').mockResolvedValue({ success: true });
      await sdk.init({ userId: 'user123' });

      expect(sdk.sessionId).toBe('test-uuid-1234');
    });

    it('should use provided session ID', async () => {
      jest.spyOn(sdk, '_request').mockResolvedValue({ success: true });
      await sdk.init({ userId: 'user123', sessionId: 'custom-session' });

      expect(sdk.sessionId).toBe('custom-session');
    });

    it('should resolve identity when phone provided', async () => {
      const mockRequest = jest.spyOn(sdk, '_request').mockResolvedValue({ unifiedId: 'uid_abc' });
      await sdk.init({ phone: '+919876543210' });

      expect(mockRequest).toHaveBeenCalledWith(
        'POST',
        '/api/identity/resolve',
        expect.objectContaining({
          identifiers: expect.objectContaining({ phone: '+919876543210' })
        })
      );
    });

    it('should return sdk instance for chaining', async () => {
      jest.spyOn(sdk, '_request').mockResolvedValue({ success: true });
      const result = await sdk.init({ userId: 'user123' });

      expect(result).toBe(sdk);
    });
  });

  describe('setUser', () => {
    it('should update userId', () => {
      sdk.setUser('newUser');
      expect(sdk.userId).toBe('newUser');
    });

    it('should track user switch when changing users', () => {
      sdk.userId = 'oldUser';
      const trackSpy = jest.spyOn(sdk.events, 'track').mockResolvedValue({});
      sdk.setUser('newUser');

      expect(trackSpy).toHaveBeenCalledWith('user_switch', {
        from: 'oldUser',
        to: 'newUser'
      });
    });

    it('should not track switch for same user', () => {
      sdk.userId = 'sameUser';
      const trackSpy = jest.spyOn(sdk.events, 'track').mockResolvedValue({});
      sdk.setUser('sameUser');

      expect(trackSpy).not.toHaveBeenCalled();
    });

    it('should return sdk for chaining', () => {
      const result = sdk.setUser('newUser');
      expect(result).toBe(sdk);
    });
  });

  describe('_getHeaders', () => {
    it('should return headers with app context', () => {
      sdk.userId = 'user123';
      sdk.sessionId = 'session123';
      sdk.deviceId = 'device123';

      const headers = sdk._getHeaders();

      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['X-REZ-App-Id']).toBe('test-app');
      expect(headers['X-REZ-API-Key']).toBe('test-key');
      expect(headers['X-REZ-Session-Id']).toBe('session123');
      expect(headers['X-REZ-Device-Id']).toBe('device123');
      expect(headers['X-REZ-Request-Id']).toBe('test-uuid-1234');
    });
  });

  describe('destroy', () => {
    it('should clear batch timer', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      sdk.destroy();

      expect(clearIntervalSpy).toHaveBeenCalledWith(sdk.batchTimer);
    });

    it('should flush pending events', () => {
      jest.spyOn(sdk, '_flushEventBatch').mockResolvedValue();
      sdk.eventQueue.push({ eventType: 'test' });
      sdk.destroy();

      expect(sdk._flushEventBatch).toHaveBeenCalled();
    });
  });
});

describe('EventTracker', () => {
  let tracker;
  let mockSdk;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSdk = {
      appId: 'test-app',
      userId: 'user123',
      sessionId: 'session123',
      deviceId: 'device123',
      config: { batchSize: 10, batchInterval: 5000 },
      eventQueue: [],
      _request: jest.fn(),
      _flushEventBatch: jest.fn().mockResolvedValue()
    };
    tracker = new EventTracker(mockSdk);
  });

  describe('track', () => {
    it('should create event with required fields', async () => {
      const event = await tracker.track('order_completed', { orderId: 'ord123', amount: 500 });

      expect(event.eventId).toBe('test-uuid-1234');
      expect(event.eventType).toBe('order_completed');
      expect(event.properties.orderId).toBe('ord123');
      expect(event.properties.amount).toBe(500);
      expect(event.timestamp).toBeDefined();
      expect(event.appId).toBe('test-app');
      expect(event.userId).toBe('user123');
      expect(event.sessionId).toBe('session123');
      expect(event.deviceId).toBe('device123');
    });

    it('should add event to queue', async () => {
      await tracker.track('page_view', { page: '/home' });
      expect(mockSdk.eventQueue.length).toBe(1);
      expect(mockSdk.eventQueue[0].eventType).toBe('page_view');
    });

    it('should flush batch when size reached', async () => {
      mockSdk.config.batchSize = 2;
      tracker = new EventTracker(mockSdk);

      await tracker.track('event1', {});
      await tracker.track('event2', {});

      expect(mockSdk._flushEventBatch).toHaveBeenCalled();
    });

    it('should include context when available', async () => {
      const event = await tracker.track('test_event', {});

      expect(event.context).toBeDefined();
      expect(event.context).toHaveProperty('url');
      expect(event.context).toHaveProperty('referrer');
      expect(event.context).toHaveProperty('userAgent');
    });
  });

  describe('trackBatch', () => {
    it('should track multiple events', async () => {
      mockSdk._request.mockResolvedValue({ success: true });
      const events = [
        { eventType: 'event1', properties: { key: 'value1' } },
        { eventType: 'event2', properties: { key: 'value2' } }
      ];

      const result = await tracker.trackBatch(events);

      expect(mockSdk._request).toHaveBeenCalledWith(
        'POST',
        '/api/events/batch',
        expect.objectContaining({ events: expect.any(Array) })
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('orderCompleted', () => {
    it('should track order with correct event type', async () => {
      const orderData = {
        orderId: 'ord123',
        merchantId: 'merch123',
        amount: 500,
        items: [{ name: 'Biryani', price: 500 }],
        paymentMethod: 'upi'
      };

      await tracker.orderCompleted(orderData);

      expect(mockSdk.eventQueue.length).toBe(1);
      expect(mockSdk.eventQueue[0].eventType).toBe(EVENT_TYPES.ORDER_COMPLETED);
      expect(mockSdk.eventQueue[0].properties.orderId).toBe('ord123');
      expect(mockSdk.eventQueue[0].properties.merchantId).toBe('merch123');
      expect(mockSdk.eventQueue[0].properties.amount).toBe(500);
      expect(mockSdk.eventQueue[0].properties.items).toEqual(orderData.items);
      expect(mockSdk.eventQueue[0].properties.paymentMethod).toBe('upi');
    });
  });

  describe('qrScan', () => {
    it('should track QR scan event', async () => {
      await tracker.qrScan({ merchantId: 'merch123' });

      expect(mockSdk.eventQueue[0].eventType).toBe(EVENT_TYPES.QR_SCAN);
      expect(mockSdk.eventQueue[0].properties.merchantId).toBe('merch123');
      expect(mockSdk.eventQueue[0].properties.source).toBe('direct');
    });

    it('should include custom source', async () => {
      await tracker.qrScan({ merchantId: 'merch123', source: 'nfc' });

      expect(mockSdk.eventQueue[0].properties.source).toBe('nfc');
    });
  });

  describe('pageView', () => {
    it('should track page view', async () => {
      await tracker.pageView({ page: '/home', category: 'homepage', merchantId: 'merch123' });

      expect(mockSdk.eventQueue[0].eventType).toBe(EVENT_TYPES.PAGE_VIEW);
      expect(mockSdk.eventQueue[0].properties.page).toBe('/home');
      expect(mockSdk.eventQueue[0].properties.category).toBe('homepage');
      expect(mockSdk.eventQueue[0].properties.merchantId).toBe('merch123');
    });
  });

  describe('search', () => {
    it('should track search event', async () => {
      await tracker.search({ query: 'biryani', results: 10, clicked: true });

      expect(mockSdk.eventQueue[0].eventType).toBe(EVENT_TYPES.SEARCH);
      expect(mockSdk.eventQueue[0].properties.query).toBe('biryani');
      expect(mockSdk.eventQueue[0].properties.results).toBe(10);
      expect(mockSdk.eventQueue[0].properties.clicked).toBe(true);
    });
  });

  describe('nudgeFeedback', () => {
    it('should track nudge sent when no conversion or click', async () => {
      await tracker.nudgeFeedback({ nudgeId: 'nudge123', merchantId: 'merch123' });

      expect(mockSdk.eventQueue[0].eventType).toBe(EVENT_TYPES.NUDGE_SENT);
    });

    it('should track nudge clicked when clicked flag is true', async () => {
      await tracker.nudgeFeedback({ nudgeId: 'nudge123', merchantId: 'merch123', clicked: true });

      expect(mockSdk.eventQueue[0].eventType).toBe(EVENT_TYPES.NUDGE_CLICKED);
    });

    it('should track nudge converted when converted flag is true', async () => {
      await tracker.nudgeFeedback({ nudgeId: 'nudge123', merchantId: 'merch123', converted: true });

      expect(mockSdk.eventQueue[0].eventType).toBe(EVENT_TYPES.NUDGE_CONVERTED);
    });

    it('should prioritize converted over clicked', async () => {
      await tracker.nudgeFeedback({
        nudgeId: 'nudge123',
        merchantId: 'merch123',
        clicked: true,
        converted: true
      });

      expect(mockSdk.eventQueue[0].eventType).toBe(EVENT_TYPES.NUDGE_CONVERTED);
    });
  });
});

describe('IdentityManager', () => {
  let manager;
  let mockSdk;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSdk = {
      userId: 'user123',
      appId: 'test-app',
      _request: jest.fn()
    };
    manager = new IdentityManager(mockSdk);
  });

  describe('resolve', () => {
    it('should resolve identity with phone', async () => {
      mockSdk._request.mockResolvedValue({ unifiedId: 'uid_abc123' });

      const result = await manager.resolve({ phone: '+919876543210' });

      expect(result.unifiedId).toBe('uid_abc123');
      expect(mockSdk._request).toHaveBeenCalledWith(
        'POST',
        '/api/identity/resolve',
        expect.objectContaining({
          identifiers: { phone: '+919876543210' }
        })
      );
    });

    it('should resolve identity with email', async () => {
      mockSdk._request.mockResolvedValue({ unifiedId: 'uid_xyz' });

      const result = await manager.resolve({ email: 'test@example.com' });

      expect(result.unifiedId).toBe('uid_xyz');
    });

    it('should update sdk userId on successful resolution', async () => {
      mockSdk._request.mockResolvedValue({ unifiedId: 'uid_new' });

      await manager.resolve({ phone: '+919876543210' });

      expect(mockSdk.userId).toBe('uid_new');
    });

    it('should set resolved flag on success', async () => {
      mockSdk._request.mockResolvedValue({ unifiedId: 'uid_new' });

      await manager.resolve({ phone: '+919876543210' });

      expect(manager.resolved).toBe(true);
    });

    it('should handle resolution failure gracefully', async () => {
      mockSdk._request.mockRejectedValue(new Error('Service unavailable'));
      const result = await manager.resolve({ phone: '+919876543210' });

      expect(result).toBeNull();
    });

    it('should include source in request', async () => {
      mockSdk._request.mockResolvedValue({ unifiedId: 'uid_abc' });

      await manager.resolve({ phone: '+919876543210' });

      expect(mockSdk._request).toHaveBeenCalledWith(
        'POST',
        '/api/identity/resolve',
        expect.objectContaining({ source: 'test-app' })
      );
    });
  });

  describe('link', () => {
    it('should link identifiers to user', async () => {
      mockSdk._request.mockResolvedValue({ success: true });

      const result = await manager.link({ phone: '+919876543210', email: 'test@example.com' });

      expect(mockSdk._request).toHaveBeenCalledWith(
        'POST',
        '/api/identity/user123/link',
        expect.objectContaining({
          identifiers: { phone: '+919876543210', email: 'test@example.com' }
        })
      );
    });
  });

  describe('updateContext', () => {
    it('should update user context', async () => {
      mockSdk._request.mockResolvedValue({ success: true });

      await manager.updateContext({ preference: 'biryani' });

      expect(mockSdk._request).toHaveBeenCalledWith(
        'PATCH',
        '/api/identity/user123/context',
        expect.objectContaining({
          metadata: { preference: 'biryani' }
        })
      );
    });
  });

  describe('getProfile', () => {
    it('should get unified user profile', async () => {
      const profile = { userId: 'user123', name: 'Test User', preferences: {} };
      mockSdk._request.mockResolvedValue(profile);

      const result = await manager.getProfile();

      expect(mockSdk._request).toHaveBeenCalledWith('GET', '/api/identity/user123');
      expect(result).toEqual(profile);
    });
  });
});

describe('RecommendationEngine', () => {
  let engine;
  let mockSdk;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSdk = {
      userId: 'user123',
      sessionId: 'session123',
      appId: 'test-app',
      _request: jest.fn()
    };
    engine = new RecommendationEngine(mockSdk);
  });

  describe('get', () => {
    it('should fetch recommendations', async () => {
      mockSdk._request.mockResolvedValue({
        recommendations: [
          { itemId: 'item1', score: 0.9 },
          { itemId: 'item2', score: 0.8 }
        ]
      });

      const result = await engine.get('user123', { types: ['reorder'] });

      expect(result.recommendations.length).toBe(2);
      expect(mockSdk._request).toHaveBeenCalledWith(
        'GET',
        '/api/recommendations/user123',
        expect.any(Object)
      );
    });

    it('should use sdk userId when not provided', async () => {
      mockSdk._request.mockResolvedValue({ recommendations: [] });

      await engine.get();

      expect(mockSdk._request).toHaveBeenCalledWith(
        'GET',
        '/api/recommendations/user123',
        expect.any(Object)
      );
    });

    it('should include context in request', async () => {
      mockSdk._request.mockResolvedValue({ recommendations: [] });

      await engine.get('user123');

      expect(mockSdk._request).toHaveBeenCalledWith(
        'GET',
        '/api/recommendations/user123',
        expect.objectContaining({
          context: expect.objectContaining({
            appId: 'test-app',
            sessionId: 'session123'
          })
        })
      );
    });

    it('should set default types', async () => {
      mockSdk._request.mockResolvedValue({ recommendations: [] });

      await engine.get('user123');

      expect(mockSdk._request).toHaveBeenCalledWith(
        'GET',
        '/api/recommendations/user123',
        expect.objectContaining({
          types: ['reorder', 'cross_sell', 'personalized']
        })
      );
    });

    it('should respect limit parameter', async () => {
      mockSdk._request.mockResolvedValue({ recommendations: [] });

      await engine.get('user123', { limit: 5 });

      expect(mockSdk._request).toHaveBeenCalledWith(
        'GET',
        '/api/recommendations/user123',
        expect.objectContaining({ limit: 5 })
      );
    });
  });

  describe('getReorders', () => {
    it('should get reorder recommendations', async () => {
      mockSdk._request.mockResolvedValue({ recommendations: [] });

      await engine.getReorders('user123');

      expect(mockSdk._request).toHaveBeenCalledWith(
        'GET',
        '/api/recommendations/user123',
        expect.objectContaining({ types: ['reorder'] })
      );
    });

    it('should merge additional options', async () => {
      mockSdk._request.mockResolvedValue({ recommendations: [] });

      await engine.getReorders('user123', { limit: 5, context: { merchantId: 'merch123' } });

      expect(mockSdk._request).toHaveBeenCalledWith(
        'GET',
        '/api/recommendations/user123',
        expect.objectContaining({
          types: ['reorder'],
          limit: 5,
          context: { merchantId: 'merch123' }
        })
      );
    });
  });

  describe('getCrossSell', () => {
    it('should get cross-sell recommendations', async () => {
      mockSdk._request.mockResolvedValue({ recommendations: [] });

      await engine.getCrossSell('user123');

      expect(mockSdk._request).toHaveBeenCalledWith(
        'GET',
        '/api/recommendations/user123',
        expect.objectContaining({ types: ['cross_sell'] })
      );
    });
  });

  describe('getOffers', () => {
    it('should get offer recommendations', async () => {
      mockSdk._request.mockResolvedValue({ recommendations: [] });

      await engine.getOffers('user123');

      expect(mockSdk._request).toHaveBeenCalledWith(
        'GET',
        '/api/recommendations/user123',
        expect.objectContaining({ types: ['offer'] })
      );
    });
  });

  describe('getSearchResults', () => {
    it('should rank search results', async () => {
      mockSdk._request.mockResolvedValue({ results: [{ itemId: 'item1' }] });

      const result = await engine.getSearchResults('biryani', { limit: 10 });

      expect(mockSdk._request).toHaveBeenCalledWith(
        'POST',
        '/api/search/rank',
        expect.objectContaining({
          query: 'biryani',
          userId: 'user123',
          limit: 10
        })
      );
    });

    it('should include app context', async () => {
      mockSdk._request.mockResolvedValue({ results: [] });

      await engine.getSearchResults('biryani');

      expect(mockSdk._request).toHaveBeenCalledWith(
        'POST',
        '/api/search/rank',
        expect.objectContaining({
          context: expect.objectContaining({ appId: 'test-app' })
        })
      );
    });
  });
});

describe('FeedbackCollector', () => {
  let collector;
  let mockSdk;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSdk = {
      userId: 'user123',
      appId: 'test-app',
      _request: jest.fn()
    };
    collector = new FeedbackCollector(mockSdk);
  });

  describe('conversion', () => {
    it('should track conversion', async () => {
      mockSdk._request.mockResolvedValue({ success: true });

      await collector.conversion('nudge123', {
        converted: true,
        orderId: 'ord123',
        amount: 500
      });

      expect(mockSdk._request).toHaveBeenCalledWith(
        'POST',
        '/api/feedback/conversion',
        expect.objectContaining({
          nudgeId: 'nudge123',
          converted: true,
          orderId: 'ord123',
          amount: 500
        })
      );
    });

    it('should default converted to true', async () => {
      mockSdk._request.mockResolvedValue({ success: true });

      await collector.conversion('nudge123', {});

      expect(mockSdk._request).toHaveBeenCalledWith(
        'POST',
        '/api/feedback/conversion',
        expect.objectContaining({ converted: true })
      );
    });

    it('should include user and app context', async () => {
      mockSdk._request.mockResolvedValue({ success: true });

      await collector.conversion('nudge123', {});

      expect(mockSdk._request).toHaveBeenCalledWith(
        'POST',
        '/api/feedback/conversion',
        expect.objectContaining({
          userId: 'user123',
          appId: 'test-app'
        })
      );
    });
  });

  describe('recommendationFeedback', () => {
    it('should track recommendation feedback', async () => {
      mockSdk._request.mockResolvedValue({ success: true });

      await collector.recommendationFeedback('rec123', {
        action: 'click',
        itemId: 'item1'
      });

      expect(mockSdk._request).toHaveBeenCalledWith(
        'POST',
        '/api/feedback/recommendation',
        expect.objectContaining({
          recommendationId: 'rec123',
          action: 'click',
          itemId: 'item1'
        })
      );
    });

    it('should support dismiss action', async () => {
      mockSdk._request.mockResolvedValue({ success: true });

      await collector.recommendationFeedback('rec123', {
        action: 'dismiss',
        itemId: 'item1'
      });

      expect(mockSdk._request).toHaveBeenCalledWith(
        'POST',
        '/api/feedback/recommendation',
        expect.objectContaining({ action: 'dismiss' })
      );
    });
  });

  describe('modelFeedback', () => {
    it('should track model feedback', async () => {
      mockSdk._request.mockResolvedValue({ success: true });

      await collector.modelFeedback('model123', {
        prediction: 'biryani',
        actual: 'biryani',
        correct: true
      });

      expect(mockSdk._request).toHaveBeenCalledWith(
        'POST',
        '/api/feedback/model',
        expect.objectContaining({
          modelId: 'model123',
          prediction: 'biryani',
          actual: 'biryani',
          correct: true
        })
      );
    });
  });
});

describe('Constants', () => {
  describe('APP_TYPES', () => {
    it('should have all required app types', () => {
      expect(APP_TYPES.CONSUMER).toBe('consumer');
      expect(APP_TYPES.MERCHANT).toBe('merchant');
      expect(APP_TYPES.ADMIN).toBe('admin');
      expect(APP_TYPES.HOTEL).toBe('hotel');
      expect(APP_TYPES.DO).toBe('do');
      expect(APP_TYPES.RENDES).toBe('rendes');
      expect(APP_TYPES.ADS).toBe('ads');
      expect(APP_TYPES.CREATOR).toBe('creator');
    });
  });

  describe('EVENT_TYPES', () => {
    it('should have discovery event types', () => {
      expect(EVENT_TYPES.QR_SCAN).toBe('qr_scan');
      expect(EVENT_TYPES.PAGE_VIEW).toBe('page_view');
      expect(EVENT_TYPES.SEARCH).toBe('search');
    });

    it('should have engagement event types', () => {
      expect(EVENT_TYPES.ITEM_VIEW).toBe('item_view');
      expect(EVENT_TYPES.ADD_TO_CART).toBe('add_to_cart');
      expect(EVENT_TYPES.REMOVE_FROM_CART).toBe('remove_from_cart');
    });

    it('should have transaction event types', () => {
      expect(EVENT_TYPES.ORDER_STARTED).toBe('order_started');
      expect(EVENT_TYPES.ORDER_COMPLETED).toBe('order_completed');
      expect(EVENT_TYPES.ORDER_CANCELLED).toBe('order_cancelled');
      expect(EVENT_TYPES.ORDER_REFUNDED).toBe('order_refunded');
      expect(EVENT_TYPES.PAYMENT_COMPLETED).toBe('payment_completed');
    });

    it('should have user event types', () => {
      expect(EVENT_TYPES.SIGNUP).toBe('signup');
      expect(EVENT_TYPES.LOGIN).toBe('login');
      expect(EVENT_TYPES.PROFILE_UPDATE).toBe('profile_update');
    });

    it('should have notification event types', () => {
      expect(EVENT_TYPES.NUDGE_SENT).toBe('nudge_sent');
      expect(EVENT_TYPES.NUDGE_CLICKED).toBe('nudge_clicked');
      expect(EVENT_TYPES.NUDGE_CONVERTED).toBe('nudge_converted');
    });
  });

  describe('DEFAULT_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_CONFIG.baseUrl).toBe('https://api.rez.money');
      expect(DEFAULT_CONFIG.timeout).toBe(10000);
      expect(DEFAULT_CONFIG.retryAttempts).toBe(3);
      expect(DEFAULT_CONFIG.retryDelay).toBe(1000);
      expect(DEFAULT_CONFIG.batchSize).toBe(10);
      expect(DEFAULT_CONFIG.batchInterval).toBe(5000);
    });
  });
});

describe('Integration Tests with Mock Server', () => {
  let server;
  let mockSdk;

  beforeAll(async () => {
    server = await mockServer.start(3001);
  });

  afterAll(() => {
    mockServer.stop();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockServer.reset();
    mockSdk = {
      userId: 'user123',
      appId: 'test-app',
      sessionId: 'session123',
      deviceId: 'device123',
      config: { batchSize: 10, batchInterval: 5000 },
      eventQueue: [],
      _request: jest.fn(),
      _flushEventBatch: jest.fn()
    };
  });

  describe('End-to-End Event Flow', () => {
    it('should track and batch events', async () => {
      const tracker = new EventTracker(mockSdk);
      mockSdk._request.mockResolvedValue({ success: true });

      await tracker.track('page_view', { page: '/home' });
      await tracker.track('page_view', { page: '/menu' });

      expect(mockSdk.eventQueue.length).toBe(2);
      expect(mockSdk._flushEventBatch).not.toHaveBeenCalled();
    });
  });

  describe('End-to-End Identity Resolution', () => {
    it('should resolve and update user ID', async () => {
      const manager = new IdentityManager(mockSdk);
      mockSdk._request.mockResolvedValue({ unifiedId: 'uid_integration_test' });

      const result = await manager.resolve({ phone: '+919876543210' });

      expect(result.unifiedId).toBe('uid_integration_test');
      expect(mockSdk.userId).toBe('uid_integration_test');
    });
  });
});
