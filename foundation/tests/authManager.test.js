/**
 * AuthManager Tests
 * =================
 * Tests for authentication and authorization system
 */

import { jest } from '@jest/globals';

// Mock EventBus
const mockEventBus = {
  subscribe: jest.fn(),
  publish: jest.fn(),
  unsubscribe: jest.fn()
};

jest.unstable_mockModule('../event-bus/AgentEventBus.js', () => ({
  getEventBus: jest.fn(() => mockEventBus),
  AgentEventBus: jest.fn()
}));

const {
  AuthManager,
  AuthMethod,
  PermissionLevel,
  getAuthManager,
  resetAuthManager
} = await import('../auth/AuthManager.js');

describe('AuthManager', () => {
  let authManager;

  beforeEach(async () => {
    resetAuthManager();
    authManager = new AuthManager({
      enableAuth: true,
      sessionTimeout: 1000 // 1 second for testing
    });
    mockEventBus.publish.mockClear();
  });

  afterEach(async () => {
    await authManager.shutdown();
  });

  describe('Initialization', () => {
    test('creates with default options', () => {
      const manager = new AuthManager();

      expect(manager.enableAuth).toBe(true);
      expect(manager.defaultMethod).toBe(AuthMethod.API_KEY);
      expect(manager.initialized).toBe(false);
    });

    test('creates with custom options', () => {
      const manager = new AuthManager({
        enableAuth: false,
        defaultMethod: AuthMethod.JWT,
        sessionTimeout: 5000,
        maxSessions: 50
      });

      expect(manager.enableAuth).toBe(false);
      expect(manager.defaultMethod).toBe(AuthMethod.JWT);
      expect(manager.sessionTimeout).toBe(5000);
      expect(manager.maxSessions).toBe(50);
    });

    test('initialize sets up manager', async () => {
      await authManager.initialize();

      expect(authManager.initialized).toBe(true);
      expect(authManager.apiKeys.size).toBe(1); // Default admin key
    });

    test('initialize is idempotent', async () => {
      await authManager.initialize();
      await authManager.initialize();

      expect(authManager.apiKeys.size).toBe(1);
    });

    test('initialize skips default key when auth disabled', async () => {
      const manager = new AuthManager({ enableAuth: false });
      await manager.initialize();

      expect(manager.apiKeys.size).toBe(0);
      await manager.shutdown();
    });
  });

  describe('API Key Management', () => {
    test('generateApiKey creates new key', () => {
      const result = authManager.generateApiKey('test-key', PermissionLevel.WRITE);

      expect(result.key).toMatch(/^mk_/);
      expect(result.name).toBe('test-key');
      expect(result.permissions).toBe(PermissionLevel.WRITE);
    });

    test('generateApiKey with default permissions', () => {
      const result = authManager.generateApiKey('test-key');

      expect(result.permissions).toBe(PermissionLevel.READ);
    });

    test('validateApiKey returns info for valid key', () => {
      const { key } = authManager.generateApiKey('test-key', PermissionLevel.ADMIN);

      const result = authManager.validateApiKey(key);

      expect(result.valid).toBe(true);
      expect(result.name).toBe('test-key');
      expect(result.permissions).toBe(PermissionLevel.ADMIN);
    });

    test('validateApiKey updates usage stats', () => {
      const { key } = authManager.generateApiKey('test-key');

      authManager.validateApiKey(key);
      authManager.validateApiKey(key);

      const keyInfo = authManager.apiKeys.get(key);
      expect(keyInfo.usageCount).toBe(2);
      expect(keyInfo.lastUsed).toBeDefined();
    });

    test('validateApiKey returns null for invalid key', () => {
      const result = authManager.validateApiKey('invalid-key');

      expect(result).toBeNull();
    });

    test('revokeApiKey removes key', () => {
      const { key } = authManager.generateApiKey('test-key');

      const deleted = authManager.revokeApiKey(key);

      expect(deleted).toBe(true);
      expect(authManager.validateApiKey(key)).toBeNull();
    });

    test('revokeApiKey returns false for non-existent key', () => {
      const deleted = authManager.revokeApiKey('non-existent');

      expect(deleted).toBe(false);
    });

    test('listApiKeys returns masked keys', () => {
      authManager.generateApiKey('key1', PermissionLevel.READ);
      authManager.generateApiKey('key2', PermissionLevel.WRITE);

      const keys = authManager.listApiKeys();

      expect(keys).toHaveLength(2);
      expect(keys[0].keyPrefix).toMatch(/^mk_.+\.\.\.$/);
      expect(keys[0].name).toBeDefined();
    });
  });

  describe('Session Management', () => {
    test('createSession creates new session', () => {
      const session = authManager.createSession('user1', PermissionLevel.WRITE);

      expect(session.sessionId).toBeDefined();
      expect(session.userId).toBe('user1');
      expect(session.permissions).toBe(PermissionLevel.WRITE);
      expect(session.expiresAt).toBeGreaterThan(Date.now());
    });

    test('createSession with default permissions', () => {
      const session = authManager.createSession('user1');

      expect(session.permissions).toBe(PermissionLevel.READ);
    });

    test('validateSession returns session info', () => {
      const { sessionId } = authManager.createSession('user1', PermissionLevel.ADMIN);

      const result = authManager.validateSession(sessionId);

      expect(result.valid).toBe(true);
      expect(result.userId).toBe('user1');
      expect(result.permissions).toBe(PermissionLevel.ADMIN);
    });

    test('validateSession returns null for invalid session', () => {
      const result = authManager.validateSession('invalid-session');

      expect(result).toBeNull();
    });

    test('validateSession returns null for expired session', async () => {
      const { sessionId } = authManager.createSession('user1');

      // Wait for expiration (sessionTimeout is 1 second)
      await new Promise(resolve => setTimeout(resolve, 1100));

      const result = authManager.validateSession(sessionId);

      expect(result).toBeNull();
    });

    test('updateSessionData updates session', () => {
      const { sessionId } = authManager.createSession('user1');

      authManager.updateSessionData(sessionId, { key: 'value' });

      const session = authManager.validateSession(sessionId);
      expect(session.data.key).toBe('value');
    });

    test('updateSessionData does nothing for invalid session', () => {
      expect(() => {
        authManager.updateSessionData('invalid', { key: 'value' });
      }).not.toThrow();
    });

    test('destroySession removes session', () => {
      const { sessionId } = authManager.createSession('user1');

      const deleted = authManager.destroySession(sessionId);

      expect(deleted).toBe(true);
      expect(authManager.validateSession(sessionId)).toBeNull();
    });

    test('createSession throws when max sessions reached', () => {
      const manager = new AuthManager({ maxSessions: 2 });

      manager.createSession('user1');
      manager.createSession('user2');

      expect(() => manager.createSession('user3')).toThrow('Maximum sessions reached');
    });

    test('cleanupExpiredSessions removes old sessions', async () => {
      authManager.createSession('user1');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      authManager.cleanupExpiredSessions();

      expect(authManager.sessions.size).toBe(0);
    });
  });

  describe('JWT Token Management', () => {
    test('generateToken creates valid token', () => {
      const token = authManager.generateToken({ userId: 'user1' });

      expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    });

    test('validateToken returns payload for valid token', () => {
      const token = authManager.generateToken({ userId: 'user1', role: 'admin' });

      const result = authManager.validateToken(token);

      expect(result.valid).toBe(true);
      expect(result.userId).toBe('user1');
      expect(result.role).toBe('admin');
    });

    test('validateToken returns null for invalid token', () => {
      const result = authManager.validateToken('invalid.token.here');

      expect(result).toBeNull();
    });

    test('validateToken returns null for tampered token', () => {
      const token = authManager.generateToken({ userId: 'user1' });
      const parts = token.split('.');
      parts[1] = Buffer.from('{"userId":"hacker"}').toString('base64url');
      const tamperedToken = parts.join('.');

      const result = authManager.validateToken(tamperedToken);

      expect(result).toBeNull();
    });

    test('validateToken returns null for expired token', async () => {
      const token = authManager.generateToken({ userId: 'user1' }, 100); // 100ms expiration

      await new Promise(resolve => setTimeout(resolve, 150));

      const result = authManager.validateToken(token);

      expect(result).toBeNull();
    });

    test('validateToken returns null for malformed token', () => {
      expect(authManager.validateToken('not.enough')).toBeNull();
      expect(authManager.validateToken('')).toBeNull();
    });

    test('refreshToken creates new token', async () => {
      const token = authManager.generateToken({ userId: 'user1' });

      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 5));

      const newToken = authManager.refreshToken(token);

      expect(newToken).not.toBe(token);
      const validated = authManager.validateToken(newToken);
      expect(validated.userId).toBe('user1');
    });

    test('refreshToken returns null for invalid token', () => {
      const result = authManager.refreshToken('invalid.token');

      expect(result).toBeNull();
    });
  });

  describe('User Management', () => {
    test('createUser creates new user', () => {
      const result = authManager.createUser('user1', 'password123', {
        name: 'Test User',
        permissions: PermissionLevel.ADMIN
      });

      expect(result.userId).toBe('user1');
      expect(result.name).toBe('Test User');
    });

    test('createUser with default options', () => {
      const result = authManager.createUser('user1', 'password123');

      expect(result.name).toBe('user1');
    });

    test('createUser throws for duplicate user', () => {
      authManager.createUser('user1', 'password123');

      expect(() => authManager.createUser('user1', 'password456')).toThrow('User already exists');
    });

    test('authenticateUser returns user info for valid credentials', () => {
      authManager.createUser('user1', 'password123', {
        permissions: PermissionLevel.WRITE
      });

      const result = authManager.authenticateUser('user1', 'password123');

      expect(result.userId).toBe('user1');
      expect(result.permissions).toBe(PermissionLevel.WRITE);
    });

    test('authenticateUser returns null for invalid user', () => {
      const result = authManager.authenticateUser('nonexistent', 'password');

      expect(result).toBeNull();
    });

    test('authenticateUser returns null for wrong password', () => {
      authManager.createUser('user1', 'password123');

      const result = authManager.authenticateUser('user1', 'wrongpassword');

      expect(result).toBeNull();
    });

    test('changePassword updates password', () => {
      authManager.createUser('user1', 'oldpassword');

      authManager.changePassword('user1', 'newpassword');

      expect(authManager.authenticateUser('user1', 'oldpassword')).toBeNull();
      expect(authManager.authenticateUser('user1', 'newpassword')).not.toBeNull();
    });

    test('changePassword throws for non-existent user', () => {
      expect(() => authManager.changePassword('nonexistent', 'password')).toThrow('User not found');
    });

    test('deleteUser removes user', () => {
      authManager.createUser('user1', 'password123');

      authManager.deleteUser('user1');

      expect(authManager.authenticateUser('user1', 'password123')).toBeNull();
    });
  });

  describe('Authentication Flow', () => {
    beforeEach(async () => {
      await authManager.initialize();
    });

    test('authenticate with API key', () => {
      const { key } = authManager.generateApiKey('test', PermissionLevel.WRITE);

      const result = authManager.authenticate({ apiKey: key });

      expect(result.authenticated).toBe(true);
      expect(result.method).toBe(AuthMethod.API_KEY);
      expect(result.permissions).toBe(PermissionLevel.WRITE);
    });

    test('authenticate with session', () => {
      const { sessionId } = authManager.createSession('user1', PermissionLevel.ADMIN);

      const result = authManager.authenticate({ sessionId });

      expect(result.authenticated).toBe(true);
      expect(result.method).toBe(AuthMethod.SESSION);
    });

    test('authenticate with token', () => {
      const token = authManager.generateToken({ userId: 'user1', permissions: PermissionLevel.READ });

      const result = authManager.authenticate({ token });

      expect(result.authenticated).toBe(true);
      expect(result.method).toBe(AuthMethod.JWT);
    });

    test('authenticate with user credentials', () => {
      authManager.createUser('user1', 'password123', {
        permissions: PermissionLevel.WRITE
      });

      const result = authManager.authenticate({ userId: 'user1', password: 'password123' });

      expect(result.authenticated).toBe(true);
      expect(result.sessionId).toBeDefined(); // Session created
    });

    test('authenticate fails with invalid credentials', () => {
      const result = authManager.authenticate({ apiKey: 'invalid' });

      expect(result.authenticated).toBe(false);
      expect(result.error).toBe('Authentication failed');
    });

    test('authenticate bypasses when auth disabled', () => {
      const manager = new AuthManager({ enableAuth: false });

      const result = manager.authenticate({});

      expect(result.authenticated).toBe(true);
      expect(result.method).toBe(AuthMethod.NONE);
      expect(result.permissions).toBe(PermissionLevel.ADMIN);
    });

    test('authenticate publishes success event', () => {
      const { key } = authManager.generateApiKey('test');

      authManager.authenticate({ apiKey: key });

      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    test('authenticate publishes failure event', () => {
      authManager.authenticate({ apiKey: 'invalid' });

      expect(mockEventBus.publish).toHaveBeenCalled();
    });
  });

  describe('Permission Checking', () => {
    test('hasPermission returns true for sufficient permissions', () => {
      expect(authManager.hasPermission(PermissionLevel.ADMIN, PermissionLevel.READ)).toBe(true);
      expect(authManager.hasPermission(PermissionLevel.WRITE, PermissionLevel.WRITE)).toBe(true);
    });

    test('hasPermission returns false for insufficient permissions', () => {
      expect(authManager.hasPermission(PermissionLevel.READ, PermissionLevel.WRITE)).toBe(false);
      expect(authManager.hasPermission(PermissionLevel.NONE, PermissionLevel.READ)).toBe(false);
    });
  });

  describe('Express Middleware', () => {
    test('middleware authenticates valid request', async () => {
      await authManager.initialize();
      const { key } = authManager.generateApiKey('test', PermissionLevel.WRITE);

      const middleware = authManager.middleware({ requiredLevel: PermissionLevel.READ });

      const req = {
        headers: { 'x-api-key': key },
        query: {},
        cookies: {}
      };
      const res = { status: jest.fn(() => ({ json: jest.fn() })) };
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.auth).toBeDefined();
      expect(req.auth.authenticated).toBe(true);
    });

    test('middleware rejects unauthorized request', async () => {
      await authManager.initialize();

      const middleware = authManager.middleware();

      const req = { headers: {}, query: {}, cookies: {} };
      const jsonMock = jest.fn();
      const res = { status: jest.fn(() => ({ json: jsonMock })) };
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(next).not.toHaveBeenCalled();
    });

    test('middleware rejects insufficient permissions', async () => {
      await authManager.initialize();
      const { key } = authManager.generateApiKey('test', PermissionLevel.READ);

      const middleware = authManager.middleware({ requiredLevel: PermissionLevel.ADMIN });

      const req = { headers: { 'x-api-key': key }, query: {}, cookies: {} };
      const jsonMock = jest.fn();
      const res = { status: jest.fn(() => ({ json: jsonMock })) };
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Forbidden' });
    });

    test('middleware extracts bearer token', async () => {
      await authManager.initialize();
      const token = authManager.generateToken({ userId: 'user1', permissions: PermissionLevel.WRITE });

      const middleware = authManager.middleware();

      const req = {
        headers: { authorization: `Bearer ${token}` },
        query: {},
        cookies: {}
      };
      const res = { status: jest.fn() };
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Bearer Token Extraction', () => {
    test('extractBearerToken extracts valid token', () => {
      const token = authManager.extractBearerToken('Bearer mytoken123');

      expect(token).toBe('mytoken123');
    });

    test('extractBearerToken returns null for invalid format', () => {
      expect(authManager.extractBearerToken('Basic abc123')).toBeNull();
      expect(authManager.extractBearerToken('Bearer')).toBeNull();
      expect(authManager.extractBearerToken(null)).toBeNull();
    });
  });

  describe('WebSocket Authentication', () => {
    test('authenticateWebSocket with query param', async () => {
      await authManager.initialize();
      const { key } = authManager.generateApiKey('test');

      const request = {
        url: `/ws?apiKey=${key}`,
        headers: { host: 'localhost' }
      };

      const result = authManager.authenticateWebSocket(request);

      expect(result.authenticated).toBe(true);
    });

    test('authenticateWebSocket with header', async () => {
      await authManager.initialize();
      const { key } = authManager.generateApiKey('test');

      const request = {
        url: '/ws',
        headers: {
          host: 'localhost',
          'x-api-key': key
        }
      };

      const result = authManager.authenticateWebSocket(request);

      expect(result.authenticated).toBe(true);
    });
  });

  describe('Status and Metrics', () => {
    test('getStatus returns current state', async () => {
      await authManager.initialize();
      authManager.createSession('user1');

      const status = authManager.getStatus();

      expect(status.enabled).toBe(true);
      expect(status.apiKeyCount).toBe(1);
      expect(status.activeSessions).toBe(1);
      expect(status.initialized).toBe(true);
    });

    test('getMetrics returns auth metrics', async () => {
      await authManager.initialize();
      const { key } = authManager.generateApiKey('test');

      authManager.authenticate({ apiKey: key });
      authManager.authenticate({ apiKey: 'invalid' });

      const metrics = authManager.getMetrics();

      expect(metrics.totalAuth).toBe(2);
      expect(metrics.successfulAuth).toBe(1);
      expect(metrics.failedAuth).toBe(1);
      expect(metrics.successRate).toBe('50.00');
    });

    test('getMetrics handles zero auth attempts', () => {
      const metrics = authManager.getMetrics();

      expect(metrics.successRate).toBe(0);
    });
  });

  describe('Shutdown', () => {
    test('shutdown clears state', async () => {
      await authManager.initialize();
      authManager.createSession('user1');

      await authManager.shutdown();

      expect(authManager.sessions.size).toBe(0);
      expect(authManager.initialized).toBe(false);
    });
  });

  describe('Singleton', () => {
    test('getAuthManager returns singleton', () => {
      resetAuthManager();

      const instance1 = getAuthManager();
      const instance2 = getAuthManager();

      expect(instance1).toBe(instance2);
    });

    test('resetAuthManager clears singleton', async () => {
      const instance1 = getAuthManager();
      await instance1.initialize();

      resetAuthManager();

      const instance2 = getAuthManager();
      expect(instance2).not.toBe(instance1);
      expect(instance2.initialized).toBe(false);
    });
  });
});

describe('AuthMethod Constants', () => {
  test('has all auth methods', () => {
    expect(AuthMethod.API_KEY).toBe('api_key');
    expect(AuthMethod.SESSION).toBe('session');
    expect(AuthMethod.JWT).toBe('jwt');
    expect(AuthMethod.NONE).toBe('none');
  });
});

describe('PermissionLevel Constants', () => {
  test('has correct permission hierarchy', () => {
    expect(PermissionLevel.NONE).toBe(0);
    expect(PermissionLevel.READ).toBe(1);
    expect(PermissionLevel.WRITE).toBe(2);
    expect(PermissionLevel.ADMIN).toBe(3);
  });
});
