/**
 * MemoryService Unit Tests
 *
 * Tests for the MemoryService class which handles memory operations
 * including create, read, update, delete, and search.
 */

import { MemoryService, CreateMemoryInput, UpdateMemoryInput, SearchMemoriesInput } from '../src/services/memoryService';
import { Memory, IMemoryDocument } from '../src/models/UserMemory';
import { MemoryType } from '../src/models/UserMemory';

// Mock dependencies
jest.mock('../src/models/UserMemory');
jest.mock('../src/config', () => ({
  config: {
    SHORT_TERM_MEMORY_TTL: 3600,
    MAX_SHORT_TERM_MEMORIES: 100,
  },
}));
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('MemoryService', () => {
  let memoryService: MemoryService;
  let mockMemoryModel: jest.Mocked<typeof Memory>;

  const createMockMemory = (overrides: Partial<IMemoryDocument> = {}): IMemoryDocument => ({
    id: 'mem_123',
    userId: 'user-123',
    type: MemoryType.SHORT_TERM,
    content: 'Test memory content',
    importance: 5,
    metadata: {},
    tags: [],
    source: 'test',
    expiresAt: new Date(Date.now() + 3600000),
    accessCount: 0,
    lastAccessed: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    incrementAccess: jest.fn().mockResolvedValue(undefined),
    access: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue(undefined),
    deleteOne: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as IMemoryDocument);

  beforeEach(() => {
    jest.clearAllMocks();
    memoryService = new MemoryService();
    mockMemoryModel = Memory as jest.Mocked<typeof Memory>;
  });

  describe('createMemory', () => {
    it('should create a new memory with default values', async () => {
      const input: CreateMemoryInput = {
        userId: 'user-123',
        content: 'Test memory',
      };

      const mockMemory = createMockMemory({
        userId: input.userId,
        content: input.content,
      });

      mockMemoryModel.countDocuments = jest.fn().mockResolvedValue(0);
      mockMemoryModel.create = jest.fn().mockResolvedValue(mockMemory);

      const result = await memoryService.createMemory(input);

      expect(result).toBeDefined();
      expect(mockMemoryModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: input.userId,
          content: input.content,
        })
      );
    });

    it('should set expiration for short-term memories', async () => {
      const input: CreateMemoryInput = {
        userId: 'user-123',
        content: 'Short-term memory',
        type: MemoryType.SHORT_TERM,
      };

      mockMemoryModel.countDocuments = jest.fn().mockResolvedValue(0);
      mockMemoryModel.create = jest.fn().mockImplementation(async (data) =>
        createMockMemory(data)
      );

      await memoryService.createMemory(input);

      expect(mockMemoryModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresAt: expect.any(Date),
        })
      );
    });

    it('should not set expiration for long-term memories', async () => {
      const input: CreateMemoryInput = {
        userId: 'user-123',
        content: 'Long-term memory',
        type: MemoryType.LONG_TERM,
      };

      mockMemoryModel.create = jest.fn().mockImplementation(async (data) =>
        createMockMemory(data)
      );

      await memoryService.createMemory(input);

      expect(mockMemoryModel.create).toHaveBeenCalledWith(
        expect.not.objectContaining({
          expiresAt: expect.any(Date),
        })
      );
    });

    it('should evict least important memory when at capacity', async () => {
      const input: CreateMemoryInput = {
        userId: 'user-123',
        content: 'New memory',
        type: MemoryType.SHORT_TERM,
      };

      // Mock at capacity
      mockMemoryModel.countDocuments = jest.fn().mockResolvedValue(100);

      const oldestMemory = createMockMemory({
        id: 'oldest',
        importance: 1,
      });

      mockMemoryModel.findOne = jest.fn().mockResolvedValue(oldestMemory);
      mockMemoryModel.create = jest.fn().mockResolvedValue(createMockMemory(input));

      await memoryService.createMemory(input);

      expect(oldestMemory.deleteOne).toHaveBeenCalled();
    });

    it('should include tags and metadata in memory', async () => {
      const input: CreateMemoryInput = {
        userId: 'user-123',
        content: 'Tagged memory',
        tags: ['important', 'work'],
        metadata: { key: 'value' },
        source: 'test',
      };

      mockMemoryModel.countDocuments = jest.fn().mockResolvedValue(0);
      mockMemoryModel.create = jest.fn().mockImplementation(async (data) =>
        createMockMemory(data)
      );

      await memoryService.createMemory(input);

      expect(mockMemoryModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['important', 'work'],
          metadata: { key: 'value' },
          source: 'test',
        })
      );
    });
  });

  describe('getMemory', () => {
    it('should retrieve memory by ID', async () => {
      const mockMemory = createMockMemory();
      mockMemoryModel.findOne = jest.fn().mockResolvedValue(mockMemory);

      const result = await memoryService.getMemory('mem_123', 'user-123');

      expect(result).toEqual(mockMemory);
      expect(mockMemory.incrementAccess).toHaveBeenCalled();
    });

    it('should return null for non-existent memory', async () => {
      mockMemoryModel.findOne = jest.fn().mockResolvedValue(null);

      const result = await memoryService.getMemory('non-existent', 'user-123');

      expect(result).toBeNull();
    });

    it('should filter by user ID', async () => {
      const mockMemory = createMockMemory();
      mockMemoryModel.findOne = jest.fn().mockResolvedValue(mockMemory);

      await memoryService.getMemory('mem_123', 'user-123');

      expect(mockMemoryModel.findOne).toHaveBeenCalledWith({
        id: 'mem_123',
        userId: 'user-123',
      });
    });
  });

  describe('getUserMemories', () => {
    it('should retrieve all user memories with defaults', async () => {
      const mockMemories = [createMockMemory(), createMockMemory({ id: 'mem_456' })];
      mockMemoryModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(mockMemories),
          }),
        }),
      });

      const result = await memoryService.getUserMemories({ userId: 'user-123' });

      expect(result).toEqual(mockMemories);
    });

    it('should filter by type', async () => {
      const mockMemories = [createMockMemory({ type: MemoryType.LONG_TERM })];
      mockMemoryModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(mockMemories),
          }),
        }),
      });

      await memoryService.getUserMemories({
        userId: 'user-123',
        type: MemoryType.LONG_TERM,
      });

      expect(mockMemoryModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ type: MemoryType.LONG_TERM })
      );
    });

    it('should filter by tags', async () => {
      mockMemoryModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      await memoryService.getUserMemories({
        userId: 'user-123',
        tags: ['important'],
      });

      expect(mockMemoryModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ tags: { $in: ['important'] } })
      );
    });

    it('should filter by minimum importance', async () => {
      mockMemoryModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      await memoryService.getUserMemories({
        userId: 'user-123',
        minImportance: 7,
      });

      expect(mockMemoryModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ importance: { $gte: 7 } })
      );
    });

    it('should apply text search when query is provided', async () => {
      const mockMemories = [createMockMemory({ content: 'search term found' })];
      mockMemoryModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(mockMemories),
          }),
        }),
      });

      const result = await memoryService.getUserMemories({
        userId: 'user-123',
        query: 'search term',
      });

      expect(result).toHaveLength(1);
    });
  });

  describe('updateMemory', () => {
    it('should update memory content', async () => {
      const mockMemory = createMockMemory();
      mockMemoryModel.findOne = jest.fn().mockResolvedValue(mockMemory);

      const input: UpdateMemoryInput = {
        content: 'Updated content',
      };

      const result = await memoryService.updateMemory('mem_123', 'user-123', input);

      expect(mockMemory.content).toBe('Updated content');
      expect(mockMemory.save).toHaveBeenCalled();
      expect(result).toEqual(mockMemory);
    });

    it('should update importance', async () => {
      const mockMemory = createMockMemory({ importance: 5 });
      mockMemoryModel.findOne = jest.fn().mockResolvedValue(mockMemory);

      await memoryService.updateMemory('mem_123', 'user-123', { importance: 8 });

      expect(mockMemory.importance).toBe(8);
    });

    it('should update metadata', async () => {
      const mockMemory = createMockMemory();
      mockMemoryModel.findOne = jest.fn().mockResolvedValue(mockMemory);

      await memoryService.updateMemory('mem_123', 'user-123', {
        metadata: { newKey: 'newValue' },
      });

      expect(mockMemory.metadata).toEqual({ newKey: 'newValue' });
    });

    it('should return null for non-existent memory', async () => {
      mockMemoryModel.findOne = jest.fn().mockResolvedValue(null);

      const result = await memoryService.updateMemory('non-existent', 'user-123', {
        content: 'test',
      });

      expect(result).toBeNull();
    });
  });

  describe('deleteMemory', () => {
    it('should delete existing memory', async () => {
      mockMemoryModel.deleteOne = jest.fn().mockResolvedValue({ deletedCount: 1 });

      const result = await memoryService.deleteMemory('mem_123', 'user-123');

      expect(result).toBe(true);
      expect(mockMemoryModel.deleteOne).toHaveBeenCalledWith({
        id: 'mem_123',
        userId: 'user-123',
      });
    });

    it('should return false when memory not found', async () => {
      mockMemoryModel.deleteOne = jest.fn().mockResolvedValue({ deletedCount: 0 });

      const result = await memoryService.deleteMemory('non-existent', 'user-123');

      expect(result).toBe(false);
    });
  });

  describe('deleteAllUserMemories', () => {
    it('should delete all user memories', async () => {
      mockMemoryModel.deleteMany = jest.fn().mockResolvedValue({ deletedCount: 10 });

      const result = await memoryService.deleteAllUserMemories('user-123');

      expect(result).toBe(10);
      expect(mockMemoryModel.deleteMany).toHaveBeenCalledWith({ userId: 'user-123' });
    });

    it('should filter by type when specified', async () => {
      mockMemoryModel.deleteMany = jest.fn().mockResolvedValue({ deletedCount: 5 });

      await memoryService.deleteAllUserMemories('user-123', MemoryType.SHORT_TERM);

      expect(mockMemoryModel.deleteMany).toHaveBeenCalledWith({
        userId: 'user-123',
        type: MemoryType.SHORT_TERM,
      });
    });
  });

  describe('consolidateMemories', () => {
    it('should consolidate important old memories to long-term', async () => {
      const mockMemory = createMockMemory({
        type: MemoryType.SHORT_TERM,
        importance: 8,
        createdAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), // 35 days ago
      });
      mockMemory.type = MemoryType.SHORT_TERM;

      mockMemoryModel.find = jest.fn().mockResolvedValue([mockMemory]);

      const result = await memoryService.consolidateMemories('user-123');

      expect(result).toBe(1);
      expect(mockMemory.type).toBe(MemoryType.LONG_TERM);
      expect(mockMemory.save).toHaveBeenCalled();
    });

    it('should not consolidate recent memories', async () => {
      mockMemoryModel.find = jest.fn().mockResolvedValue([]);

      const result = await memoryService.consolidateMemories('user-123');

      expect(result).toBe(0);
    });
  });

  describe('semanticSearch', () => {
    it('should search memories by keyword', async () => {
      const mockMemories = [
        createMockMemory({ content: 'JavaScript programming tutorial' }),
      ];
      mockMemoryModel.find = jest.fn().mockResolvedValue(mockMemories);

      const result = await memoryService.semanticSearch('user-123', 'JavaScript', 10);

      expect(result).toHaveLength(1);
    });

    it('should boost by importance and recency', async () => {
      const oldMemory = createMockMemory({
        content: 'old content',
        importance: 2,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      });
      const newMemory = createMockMemory({
        content: 'new content',
        importance: 8,
        createdAt: new Date(),
      });

      mockMemoryModel.find = jest.fn().mockResolvedValue([oldMemory, newMemory]);

      const result = await memoryService.semanticSearch('user-123', 'content', 10);

      // Higher importance and more recent should be first
      expect(result[0].id).toBe(newMemory.id);
    });

    it('should limit results', async () => {
      mockMemoryModel.find = jest.fn().mockResolvedValue([]);

      await memoryService.semanticSearch('user-123', 'test', 5);

      expect(mockMemoryModel.find).toHaveBeenCalledWith({
        userId: 'user-123',
        type: { $in: [MemoryType.LONG_TERM, MemoryType.SEMANTIC] },
      });
    });
  });

  describe('getMemoryStats', () => {
    it('should return memory statistics', async () => {
      const mockMemories = [
        createMockMemory({ type: MemoryType.SHORT_TERM, importance: 5, accessCount: 3 }),
        createMockMemory({ type: MemoryType.SHORT_TERM, importance: 7, accessCount: 5 }),
        createMockMemory({ type: MemoryType.LONG_TERM, importance: 9, accessCount: 10 }),
      ];
      mockMemoryModel.find = jest.fn().mockResolvedValue(mockMemories);

      const result = await memoryService.getMemoryStats('user-123');

      expect(result.total).toBe(3);
      expect(result.byType[MemoryType.SHORT_TERM]).toBe(2);
      expect(result.byType[MemoryType.LONG_TERM]).toBe(1);
      expect(result.averageImportance).toBe(7);
      expect(result.totalAccessCount).toBe(18);
    });

    it('should handle empty results', async () => {
      mockMemoryModel.find = jest.fn().mockResolvedValue([]);

      const result = await memoryService.getMemoryStats('user-123');

      expect(result.total).toBe(0);
      expect(result.averageImportance).toBe(0);
    });
  });

  describe('cleanupExpired', () => {
    it('should delete expired memories', async () => {
      mockMemoryModel.deleteExpired = jest.fn().mockResolvedValue(5);

      const result = await memoryService.cleanupExpired();

      expect(result).toBe(5);
      expect(mockMemoryModel.deleteExpired).toHaveBeenCalled();
    });
  });

  describe('batchCreateMemories', () => {
    it('should create multiple memories', async () => {
      const inputs: CreateMemoryInput[] = [
        { userId: 'user-123', content: 'Memory 1' },
        { userId: 'user-123', content: 'Memory 2' },
      ];

      mockMemoryModel.countDocuments = jest.fn().mockResolvedValue(0);
      mockMemoryModel.create = jest.fn().mockImplementation(async (data) =>
        createMockMemory(data)
      );

      const result = await memoryService.batchCreateMemories(inputs);

      expect(result).toHaveLength(2);
      expect(mockMemoryModel.create).toHaveBeenCalledTimes(2);
    });
  });
});
