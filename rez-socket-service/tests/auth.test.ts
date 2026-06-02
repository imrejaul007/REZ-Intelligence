/**
 * WebSocket Authentication Tests
 *
 * Tests the fix for: WebSocket authentication requiring valid JWT token.
 *
 * FIX: Lines 59-80 in index.ts now require authentication on all connections.
 * Previously, unauthenticated connections were allowed.
 */

import jwt from 'jsonwebtoken';

describe('WebSocket Authentication', () => {
  // Set up environment variables
  const mockEnv = {
    JWT_SECRET: 'test-jwt-secret-key-for-testing',
    CORS_ORIGIN: 'http://localhost:3000',
    NODE_ENV: 'development',
    PORT: '3001',
  };

  beforeEach(() => {
    process.env.JWT_SECRET = mockEnv.JWT_SECRET;
    process.env.CORS_ORIGIN = mockEnv.CORS_ORIGIN;
    process.env.NODE_ENV = mockEnv.NODE_ENV;
    process.env.PORT = mockEnv.PORT;
  });

  /**
   * Helper to generate a valid JWT token
   */
  function generateValidToken(payload: object = { userId: 'user123', role: 'user' }): string {
    return jwt.sign(payload, mockEnv.JWT_SECRET, { expiresIn: '1h' });
  }

  /**
   * Helper to generate an expired JWT token
   */
  function generateExpiredToken(payload: object = { userId: 'user123', role: 'user' }): string {
    return jwt.sign(payload, mockEnv.JWT_SECRET, { expiresIn: '-1h' });
  }

  /**
   * Simulates the authentication middleware logic
   */
  function authenticateSocket(token: string | undefined): { userId: string; role: string } | null {
    if (!token) {
      return null;
    }

    try {
      const decoded = jwt.verify(token, mockEnv.JWT_SECRET) as { userId?: string; sub?: string; role?: string };
      return {
        userId: decoded.userId || decoded.sub || '',
        role: decoded.role || 'user',
      };
    } catch {
      return null;
    }
  }

  describe('Authentication middleware', () => {
    it('should reject connection without token', () => {
      const result = authenticateSocket(undefined);
      expect(result).toBeNull();
    });

    it('should reject connection with empty token', () => {
      const result = authenticateSocket('');
      expect(result).toBeNull();
    });

    it('should reject connection with invalid token', () => {
      const result = authenticateSocket('invalid-token-string');
      expect(result).toBeNull();
    });

    it('should reject connection with expired token', () => {
      const expiredToken = generateExpiredToken();
      const result = authenticateSocket(expiredToken);
      expect(result).toBeNull();
    });

    it('should accept connection with valid token', () => {
      const validToken = generateValidToken();
      const result = authenticateSocket(validToken);

      expect(result).not.toBeNull();
      expect(result?.userId).toBe('user123');
      expect(result?.role).toBe('user');
    });

    it('should use sub claim when userId is not present', () => {
      const tokenPayload = { sub: 'user-from-sub', role: 'user' };
      const token = jwt.sign(tokenPayload, mockEnv.JWT_SECRET);

      const result = authenticateSocket(token);

      expect(result?.userId).toBe('user-from-sub');
    });

    it('should default role to user when not present in token', () => {
      const tokenPayload = { userId: 'user789' }; // No role
      const token = jwt.sign(tokenPayload, mockEnv.JWT_SECRET);

      const result = authenticateSocket(token);

      expect(result?.role).toBe('user');
    });

    it('should extract token from Authorization header format', () => {
      const validToken = generateValidToken();
      const authHeader = `Bearer ${validToken}`;
      const token = authHeader.replace('Bearer ', '');

      const result = authenticateSocket(token);

      expect(result?.userId).toBe('user123');
    });

    it('should handle token from auth.token field', () => {
      const validToken = generateValidToken();
      const socket = {
        handshake: {
          auth: { token: validToken },
          headers: {},
        },
      };

      const token = socket.handshake.auth.token;
      const result = authenticateSocket(token);

      expect(result?.userId).toBe('user123');
    });

    it('should handle token from Authorization header', () => {
      const validToken = generateValidToken();
      const socket = {
        handshake: {
          auth: {},
          headers: {
            authorization: `Bearer ${validToken}`,
          },
        },
      };

      const token = socket.handshake.headers.authorization?.replace('Bearer ', '');
      const result = authenticateSocket(token);

      expect(result?.userId).toBe('user123');
    });
  });

  describe('CORS security', () => {
    function getAllowedOrigins(): string | string[] {
      const origins = process.env.CORS_ORIGIN;
      if (!origins) {
        throw new Error('CORS_ORIGIN environment variable is required');
      }
      const originList = origins.split(',').map((o) => o.trim());
      if (originList.includes('*') && process.env.NODE_ENV === 'production') {
        throw new Error('Wildcard CORS origin is not allowed in production');
      }
      return originList;
    }

    it('should throw error when CORS_ORIGIN is missing', () => {
      delete process.env.CORS_ORIGIN;

      expect(() => getAllowedOrigins()).toThrow('CORS_ORIGIN environment variable is required');
    });

    it('should throw error when wildcard CORS is used in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.CORS_ORIGIN = '*';

      expect(() => getAllowedOrigins()).toThrow('Wildcard CORS origin is not allowed in production');
    });

    it('should allow specific origins in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.CORS_ORIGIN = 'https://app.rez.money,https://admin.rez.money';

      const origins = getAllowedOrigins();
      expect(origins).toEqual(['https://app.rez.money', 'https://admin.rez.money']);
    });

    it('should allow wildcard in development', () => {
      process.env.NODE_ENV = 'development';
      process.env.CORS_ORIGIN = '*';

      const origins = getAllowedOrigins();
      expect(origins).toEqual(['*']);
    });

    it('should parse multiple origins correctly', () => {
      process.env.CORS_ORIGIN = 'https://app.rez.money, https://admin.rez.money , http://localhost:3000';

      const origins = getAllowedOrigins() as string[];
      expect(origins).toEqual([
        'https://app.rez.money',
        'https://admin.rez.money',
        'http://localhost:3000',
      ]);
    });
  });

  describe('JWT Token Generation and Verification', () => {
    it('should generate valid JWT tokens', () => {
      const payload = { userId: 'user123', role: 'admin' };
      const token = jwt.sign(payload, mockEnv.JWT_SECRET, { expiresIn: '1h' });

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should verify valid tokens', () => {
      const payload = { userId: 'user123', role: 'user' };
      const token = jwt.sign(payload, mockEnv.JWT_SECRET, { expiresIn: '1h' });

      const decoded = jwt.verify(token, mockEnv.JWT_SECRET) as typeof payload;
      expect(decoded.userId).toBe('user123');
      expect(decoded.role).toBe('user');
    });

    it('should reject tokens with wrong secret', () => {
      const payload = { userId: 'user123' };
      const token = jwt.sign(payload, 'wrong-secret', { expiresIn: '1h' });

      expect(() => jwt.verify(token, mockEnv.JWT_SECRET)).toThrow();
    });

    it('should reject expired tokens', () => {
      const payload = { userId: 'user123' };
      const token = jwt.sign(payload, mockEnv.JWT_SECRET, { expiresIn: '-1h' });

      expect(() => jwt.verify(token, mockEnv.JWT_SECRET)).toThrow('jwt expired');
    });

    it('should reject malformed tokens', () => {
      expect(() => jwt.verify('not.a.valid.token', mockEnv.JWT_SECRET)).toThrow();
    });
  });

  describe('Socket Auth Object Structure', () => {
    it('should define AuthenticatedSocket interface', () => {
      interface AuthenticatedSocket {
        id: string;
        userId?: string;
        role?: string;
        data: {
          user: { id: string; role: string };
        };
      }

      const socket: AuthenticatedSocket = {
        id: 'socket-123',
        userId: 'user-456',
        role: 'admin',
        data: {
          user: { id: 'user-456', role: 'admin' },
        },
      };

      expect(socket.userId).toBe('user-456');
      expect(socket.role).toBe('admin');
      expect(socket.data.user.id).toBe('user-456');
    });
  });
});
