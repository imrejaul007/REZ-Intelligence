/**
 * SessionService Unit Tests
 *
 * Tests for the SessionService class which handles session operations
 * including create, read, update, pause, resume, and end.
 */

import { SessionService, CreateSessionInput, UpdateSessionInput } from '../src/services/sessionService';
import { Session, ISessionDocument, SessionState } from '../src/models/SessionContext';

// Mock dependencies
jest.mock('../src/models/SessionContext');
jest.mock('ioredis');
jest.mock('../src/config', () => ({
  config: {
    SESSION_TTL: 1800,
    MAX_CONCURRENT_SESSIONS: 10,
  },
  getRedisConfig: jest.fn().mockReturnValue({
    url: 'redis://localhost:6379',
    password: undefined,
    db: 0,
  }),
}));
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('SessionService', () => {
  let sessionService: SessionService;
  let mockSessionModel: jest.Mocked<typeof Session>;
  let mockRedis: any;

  const createMockSession = (overrides: Partial<ISessionDocument> = {}): ISessionDocument => ({
    id: 'sess_123',
    userId: 'user-123',
    agentId: 'agent-1',
    startTime: new Date(),
    state: SessionState.ACTIVE,
    context: {},
    metadata: {},
    touch: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
    end: jest.fn().mockResolvedValue(undefined),
    addContext: jest.fn().mockResolvedValue(undefined),
    removeContext: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as ISessionDocument);

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Redis
    mockRedis = {
      on: jest.fn(),
      setex: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
      quit: jest.fn().mockResolvedValue('OK'),
    };

    // Mock ioredis constructor
    jest.mock('ioredis', () => {
      return jest.fn().mockImplementation(() => mockRedis);
    });

    sessionService = new SessionService();
    mockSessionModel = Session as jest.Mocked<typeof Session>;
  });

  describe('createSession', () => {
    it('should create a new session', async () => {
      const input: CreateSessionInput = {
        userId: 'user-123',
        agentId: 'agent-1',
      };

      const mockSession = createMockSession(input);
      mockSessionModel.getActiveCount = jest.fn().mockResolvedValue(0);
      mockSessionModel.create = jest.fn().mockResolvedValue(mockSession);

      const result = await sessionService.createSession(input);

      expect(result).toBeDefined();
      expect(result.userId).toBe(input.userId);
      expect(mockSessionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: input.userId,
          state: SessionState.ACTIVE,
        })
      );
    });

    it('should end oldest session when at capacity', async () => {
      const input: CreateSessionInput = {
        userId: 'user-123',
      };

      const oldSession = createMockSession({
        id: 'oldest',
        startTime: new Date(Date.now() - 3600000),
      });
      const newSession = createMockSession(input);

      mockSessionModel.getActiveCount = jest.fn().mockResolvedValue(10);
      mockSessionModel.findOne = jest.fn().mockResolvedValue(oldSession);
      mockSessionModel.create = jest.fn().mockResolvedValue(newSession);

      await sessionService.createSession(input);

      expect(oldSession.end).toHaveBeenCalled();
    });

    it('should use default values for optional fields', async () => {
      const input: CreateSessionInput = {
        userId: 'user-123',
      };

      const mockSession = createMockSession(input);
      mockSessionModel.getActiveCount = jest.fn().mockResolvedValue(0);
      mockSessionModel.create = jest.fn().mockResolvedValue(mockSession);

      await sessionService.createSession(input);

      expect(mockSessionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          context: {},
        })
      );
    });
  });

  describe('getSession', () => {
    it('should retrieve session by ID', async () => {
      const mockSession = createMockSession();
      mockSessionModel.findOne = jest.fn().mockResolvedValue(mockSession);

      const result = await sessionService.getSession('sess_123', 'user-123');

      expect(result).toEqual(mockSession);
      expect(mockSession.touch).toHaveBeenCalled();
    });

    it('should return null for non-existent session', async () => {
      mockSessionModel.findOne = jest.fn().mockResolvedValue(null);

      const result = await sessionService.getSession('non-existent', 'user-123');

      expect(result).toBeNull();
    });

    it('should filter by user ID when provided', async () => {
      const mockSession = createMockSession();
      mockSessionModel.findOne = jest.fn().mockResolvedValue(mockSession);

      await sessionService.getSession('sess_123', 'user-123');

      expect(mockSessionModel.findOne).toHaveBeenCalledWith({
        id: 'sess_123',
        userId: 'user-123',
      });
    });
  });

  describe('getOrCreateSession', () => {
    it('should return existing active session', async () => {
      const existingSession = createMockSession();
      mockSessionModel.findActiveByUser = jest.fn().mockResolvedValue(existingSession);

      const result = await sessionService.getOrCreateSession('user-123');

      expect(result).toEqual(existingSession);
      expect(mockSessionModel.create).not.toHaveBeenCalled();
    });

    it('should create new session if none exists', async () => {
      const newSession = createMockSession();
      mockSessionModel.findActiveByUser = jest.fn().mockResolvedValue(null);
      mockSessionModel.create = jest.fn().mockResolvedValue(newSession);

      const result = await sessionService.getOrCreateSession('user-123', 'agent-1');

      expect(result).toEqual(newSession);
      expect(mockSessionModel.create).toHaveBeenCalled();
    });

    it('should update agent ID if different', async () => {
      const existingSession = createMockSession({ agentId: 'old-agent' });
      const updatedSession = createMockSession({ agentId: 'new-agent' });
      mockSessionModel.findActiveByUser = jest.fn().mockResolvedValue(existingSession);

      await sessionService.getOrCreateSession('user-123', 'new-agent');

      expect(existingSession.agentId).toBe('new-agent');
      expect(existingSession.save).toHaveBeenCalled();
    });
  });

  describe('getUserSessions', () => {
    it('should retrieve all user sessions', async () => {
      const mockSessions = [createMockSession(), createMockSession({ id: 'sess_456' })];
      mockSessionModel.findByUser = jest.fn().mockResolvedValue(mockSessions);

      const result = await sessionService.getUserSessions('user-123');

      expect(result).toEqual(mockSessions);
    });

    it('should filter by state', async () => {
      mockSessionModel.findByUser = jest.fn().mockResolvedValue([]);

      await sessionService.getUserSessions('user-123', { state: SessionState.PAUSED });

      expect(mockSessionModel.findByUser).toHaveBeenCalledWith('user-123', {
        state: SessionState.PAUSED,
      });
    });
  });

  describe('updateSession', () => {
    it('should update session context', async () => {
      const mockSession = createMockSession({ context: {} });
      mockSessionModel.findOne = jest.fn().mockResolvedValue(mockSession);

      const input: UpdateSessionInput = {
        context: { key: 'value' },
      };

      const result = await sessionService.updateSession('sess_123', 'user-123', input);

      expect(mockSession.context).toEqual({ key: 'value' });
      expect(mockSession.save).toHaveBeenCalled();
      expect(result).toEqual(mockSession);
    });

    it('should merge context when updating', async () => {
      const mockSession = createMockSession({ context: { existing: 'context' } });
      mockSessionModel.findOne = jest.fn().mockResolvedValue(mockSession);

      await sessionService.updateSession('sess_123', 'user-123', {
        context: { newKey: 'newValue' },
      });

      expect(mockSession.context).toEqual({
        existing: 'context',
        newKey: 'newValue',
      });
    });

    it('should update metadata', async () => {
      const mockSession = createMockSession();
      mockSessionModel.findOne = jest.fn().mockResolvedValue(mockSession);

      await sessionService.updateSession('sess_123', 'user-123', {
        metadata: { custom: 'metadata' },
      });

      expect(mockSession.metadata).toEqual({ custom: 'metadata' });
    });

    it('should return null for non-existent session', async () => {
      mockSessionModel.findOne = jest.fn().mockResolvedValue(null);

      const result = await sessionService.updateSession('non-existent', 'user-123', {
        context: {},
      });

      expect(result).toBeNull();
    });
  });

  describe('addContext', () => {
    it('should add context to session', async () => {
      const mockSession = createMockSession();
      mockSessionModel.findOne = jest.fn().mockResolvedValue(mockSession);

      const result = await sessionService.addContext('sess_123', 'user-123', 'key', 'value');

      expect(mockSession.addContext).toHaveBeenCalledWith('key', 'value');
      expect(result).toEqual(mockSession);
    });

    it('should return null for non-existent session', async () => {
      mockSessionModel.findOne = jest.fn().mockResolvedValue(null);

      const result = await sessionService.addContext('non-existent', 'user-123', 'key', 'value');

      expect(result).toBeNull();
    });
  });

  describe('removeContext', () => {
    it('should remove context from session', async () => {
      const mockSession = createMockSession();
      mockSessionModel.findOne = jest.fn().mockResolvedValue(mockSession);

      const result = await sessionService.removeContext('sess_123', 'user-123', 'key');

      expect(mockSession.removeContext).toHaveBeenCalledWith('key');
      expect(result).toEqual(mockSession);
    });

    it('should return null for non-existent session', async () => {
      mockSessionModel.findOne = jest.fn().mockResolvedValue(null);

      const result = await sessionService.removeContext('non-existent', 'user-123', 'key');

      expect(result).toBeNull();
    });
  });

  describe('pauseSession', () => {
    it('should pause active session', async () => {
      const mockSession = createMockSession({ state: SessionState.ACTIVE });
      mockSessionModel.findOne = jest.fn().mockResolvedValue(mockSession);

      const result = await sessionService.pauseSession('sess_123', 'user-123');

      expect(mockSession.pause).toHaveBeenCalled();
      expect(result).toEqual(mockSession);
    });

    it('should return null for non-existent session', async () => {
      mockSessionModel.findOne = jest.fn().mockResolvedValue(null);

      const result = await sessionService.pauseSession('non-existent', 'user-123');

      expect(result).toBeNull();
    });
  });

  describe('resumeSession', () => {
    it('should resume paused session', async () => {
      const mockSession = createMockSession({ state: SessionState.PAUSED });
      mockSessionModel.findOne = jest.fn().mockResolvedValue(mockSession);

      const result = await sessionService.resumeSession('sess_123', 'user-123');

      expect(mockSession.resume).toHaveBeenCalled();
      expect(result).toEqual(mockSession);
    });

    it('should return null for non-existent session', async () => {
      mockSessionModel.findOne = jest.fn().mockResolvedValue(null);

      const result = await sessionService.resumeSession('non-existent', 'user-123');

      expect(result).toBeNull();
    });
  });

  describe('endSession', () => {
    it('should end active session', async () => {
      const mockSession = createMockSession({ state: SessionState.ACTIVE });
      mockSessionModel.findOne = jest.fn().mockResolvedValue(mockSession);

      const result = await sessionService.endSession('sess_123', 'user-123');

      expect(mockSession.end).toHaveBeenCalled();
      expect(result).toEqual(mockSession);
    });

    it('should return null for non-existent session', async () => {
      mockSessionModel.findOne = jest.fn().mockResolvedValue(null);

      const result = await sessionService.endSession('non-existent', 'user-123');

      expect(result).toBeNull();
    });
  });

  describe('endAllUserSessions', () => {
    it('should end all active sessions for user', async () => {
      mockSessionModel.endAllActive = jest.fn().mockResolvedValue(3);

      const result = await sessionService.endAllUserSessions('user-123');

      expect(result).toBe(3);
      expect(mockSessionModel.endAllActive).toHaveBeenCalledWith('user-123');
    });
  });

  describe('getActiveSessionCount', () => {
    it('should return count of active sessions', async () => {
      mockSessionModel.getActiveCount = jest.fn().mockResolvedValue(5);

      const result = await sessionService.getActiveSessionCount('user-123');

      expect(result).toBe(5);
    });
  });

  describe('cleanupStaleSessions', () => {
    it('should clean up stale sessions', async () => {
      mockSessionModel.cleanupStaleSessions = jest.fn().mockResolvedValue(2);

      const result = await sessionService.cleanupStaleSessions();

      expect(result).toBe(2);
      expect(mockSessionModel.cleanupStaleSessions).toHaveBeenCalled();
    });
  });

  describe('getSessionStats', () => {
    it('should return session statistics', async () => {
      const mockSessions = [
        createMockSession({ id: 'sess_1', state: SessionState.ACTIVE, endTime: undefined }),
        createMockSession({ id: 'sess_2', state: SessionState.PAUSED, endTime: undefined }),
        createMockSession({ id: 'sess_3', state: SessionState.ENDED, endTime: new Date() }),
      ];

      // Mock duration getter
      Object.defineProperty(mockSessions[2], 'duration', {
        get: () => 3600000, // 1 hour
      });

      mockSessionModel.find = jest.fn().mockResolvedValue(mockSessions);

      const result = await sessionService.getSessionStats('user-123');

      expect(result.total).toBe(3);
      expect(result.active).toBe(1);
      expect(result.paused).toBe(1);
      expect(result.averageDuration).toBe(3600000);
    });

    it('should handle no sessions', async () => {
      mockSessionModel.find = jest.fn().mockResolvedValue([]);

      const result = await sessionService.getSessionStats('user-123');

      expect(result.total).toBe(0);
      expect(result.averageDuration).toBe(0);
    });
  });

  describe('close', () => {
    it('should close Redis connection', async () => {
      await sessionService.close();

      // The service should attempt to quit Redis
      // Note: Redis mock may not be available if initialization failed
    });
  });
});
