/**
 * AuthManager
 * -----------
 * Authentication and authorization system for Minions.
 * Supports API keys, sessions, and JWT tokens.
 *
 * @author Kareem Hussein
 * @company Inweb Software Solutions
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import { createLogger } from '../common/logger.js';
import { getEventBus } from '../event-bus/AgentEventBus.js';
import { InfrastructureEvents } from '../event-bus/eventTypes.js';

const logger = createLogger('AuthManager');

/**
 * Authentication methods
 */
export const AuthMethod = {
  API_KEY: 'api_key',
  SESSION: 'session',
  JWT: 'jwt',
  NONE: 'none'
};

/**
 * Permission levels
 */
export const PermissionLevel = {
  NONE: 0,
  READ: 1,
  WRITE: 2,
  ADMIN: 3
};

/**
 * AuthManager class
 */
export class AuthManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.enableAuth = options.enableAuth !== false;
    this.defaultMethod = options.defaultMethod || AuthMethod.API_KEY;
    this.sessionTimeout = options.sessionTimeout || 3600000; // 1 hour
    this.tokenSecret = options.tokenSecret || this.generateSecret();
    this.maxSessions = options.maxSessions || 100;

    this.apiKeys = new Map(); // key -> { name, permissions, createdAt }
    this.sessions = new Map(); // sessionId -> { userId, permissions, createdAt, lastAccess }
    this.users = new Map(); // userId -> { name, passwordHash, permissions }

    this.eventBus = null;
    this.cleanupInterval = null;
    this.initialized = false;

    // Metrics
    this.metrics = {
      totalAuth: 0,
      successfulAuth: 0,
      failedAuth: 0,
      activeSessions: 0,
      byMethod: {}
    };
  }

  /**
   * Initialize the auth manager
   */
  async initialize() {
    if (this.initialized) return;

    try {
      this.eventBus = getEventBus();
    } catch (e) {
      logger.warn('EventBus not available');
    }

    // Start session cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanupExpiredSessions(), 60000);

    // Initialize default admin API key if none exist
    if (this.apiKeys.size === 0 && this.enableAuth) {
      const defaultKey = this.generateApiKey('default-admin', PermissionLevel.ADMIN);
      logger.info('Generated default admin API key', { key: defaultKey.key });
    }

    this.initialized = true;
    logger.info('AuthManager initialized', {
      enableAuth: this.enableAuth,
      defaultMethod: this.defaultMethod
    });
  }

  /**
   * Generate a random secret
   * @returns {string}
   */
  generateSecret() {
    return crypto.randomBytes(32).toString('hex');
  }

  // ==================== API Key Management ====================

  /**
   * Generate a new API key
   * @param {string} name - Key name/identifier
   * @param {number} permissions - Permission level
   * @returns {object} API key info
   */
  generateApiKey(name, permissions = PermissionLevel.READ) {
    const key = `mk_${crypto.randomBytes(24).toString('hex')}`;

    this.apiKeys.set(key, {
      name,
      permissions,
      createdAt: Date.now(),
      lastUsed: null,
      usageCount: 0
    });

    logger.info(`API key generated: ${name}`);

    return { key, name, permissions };
  }

  /**
   * Validate an API key
   * @param {string} key - API key to validate
   * @returns {object|null} Key info or null if invalid
   */
  validateApiKey(key) {
    const keyInfo = this.apiKeys.get(key);

    if (!keyInfo) {
      return null;
    }

    // Update usage
    keyInfo.lastUsed = Date.now();
    keyInfo.usageCount++;

    return {
      valid: true,
      name: keyInfo.name,
      permissions: keyInfo.permissions
    };
  }

  /**
   * Revoke an API key
   * @param {string} key - API key to revoke
   * @returns {boolean}
   */
  revokeApiKey(key) {
    const deleted = this.apiKeys.delete(key);
    if (deleted) {
      logger.info('API key revoked');
    }
    return deleted;
  }

  /**
   * List all API keys (without the actual key values)
   * @returns {object[]}
   */
  listApiKeys() {
    const keys = [];
    for (const [key, info] of this.apiKeys) {
      keys.push({
        keyPrefix: key.substring(0, 10) + '...',
        name: info.name,
        permissions: info.permissions,
        createdAt: info.createdAt,
        lastUsed: info.lastUsed,
        usageCount: info.usageCount
      });
    }
    return keys;
  }

  // ==================== Session Management ====================

  /**
   * Create a new session
   * @param {string} userId - User identifier
   * @param {number} permissions - Permission level
   * @returns {object} Session info
   */
  createSession(userId, permissions = PermissionLevel.READ) {
    // Check max sessions
    if (this.sessions.size >= this.maxSessions) {
      this.cleanupExpiredSessions();

      if (this.sessions.size >= this.maxSessions) {
        throw new Error('Maximum sessions reached');
      }
    }

    const sessionId = crypto.randomBytes(32).toString('hex');

    this.sessions.set(sessionId, {
      userId,
      permissions,
      createdAt: Date.now(),
      lastAccess: Date.now(),
      data: {}
    });

    this.metrics.activeSessions = this.sessions.size;

    logger.debug(`Session created for user: ${userId}`);

    return {
      sessionId,
      userId,
      permissions,
      expiresAt: Date.now() + this.sessionTimeout
    };
  }

  /**
   * Validate a session
   * @param {string} sessionId - Session ID
   * @returns {object|null} Session info or null if invalid
   */
  validateSession(sessionId) {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return null;
    }

    // Check expiration
    if (Date.now() - session.lastAccess > this.sessionTimeout) {
      this.sessions.delete(sessionId);
      this.metrics.activeSessions = this.sessions.size;
      return null;
    }

    // Update last access
    session.lastAccess = Date.now();

    return {
      valid: true,
      userId: session.userId,
      permissions: session.permissions,
      data: session.data
    };
  }

  /**
   * Update session data
   * @param {string} sessionId - Session ID
   * @param {object} data - Data to merge
   */
  updateSessionData(sessionId, data) {
    const session = this.sessions.get(sessionId);

    if (session) {
      session.data = { ...session.data, ...data };
      session.lastAccess = Date.now();
    }
  }

  /**
   * Destroy a session
   * @param {string} sessionId - Session ID
   * @returns {boolean}
   */
  destroySession(sessionId) {
    const deleted = this.sessions.delete(sessionId);
    this.metrics.activeSessions = this.sessions.size;
    return deleted;
  }

  /**
   * Cleanup expired sessions
   */
  cleanupExpiredSessions() {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastAccess > this.sessionTimeout) {
        this.sessions.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.metrics.activeSessions = this.sessions.size;
      logger.debug(`Cleaned up ${cleaned} expired sessions`);
    }
  }

  // ==================== JWT Token Management ====================

  /**
   * Generate a JWT-like token (simplified implementation)
   * @param {object} payload - Token payload
   * @param {number} expiresIn - Expiration in ms (default: 1 hour)
   * @returns {string} Token
   */
  generateToken(payload, expiresIn = 3600000) {
    const header = Buffer.from(JSON.stringify({
      alg: 'HS256',
      typ: 'JWT'
    })).toString('base64url');

    const tokenPayload = Buffer.from(JSON.stringify({
      ...payload,
      iat: Date.now(),
      exp: Date.now() + expiresIn
    })).toString('base64url');

    const signature = this.signData(`${header}.${tokenPayload}`);

    return `${header}.${tokenPayload}.${signature}`;
  }

  /**
   * Validate a JWT-like token
   * @param {string} token - Token to validate
   * @returns {object|null} Payload or null if invalid
   */
  validateToken(token) {
    try {
      const parts = token.split('.');

      if (parts.length !== 3) {
        return null;
      }

      const [header, payload, signature] = parts;

      // Verify signature
      const expectedSignature = this.signData(`${header}.${payload}`);

      if (signature !== expectedSignature) {
        return null;
      }

      // Decode payload
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());

      // Check expiration
      if (decoded.exp && decoded.exp < Date.now()) {
        return null;
      }

      return {
        valid: true,
        ...decoded
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Refresh a token
   * @param {string} token - Current token
   * @param {number} expiresIn - New expiration
   * @returns {string|null} New token or null
   */
  refreshToken(token, expiresIn = 3600000) {
    const validated = this.validateToken(token);

    if (!validated) {
      return null;
    }

    // Remove old timing fields
    delete validated.iat;
    delete validated.exp;
    delete validated.valid;

    return this.generateToken(validated, expiresIn);
  }

  /**
   * Sign data with HMAC
   * @param {string} data - Data to sign
   * @returns {string} Signature
   */
  signData(data) {
    return crypto
      .createHmac('sha256', this.tokenSecret)
      .update(data)
      .digest('base64url');
  }

  // ==================== User Management ====================

  /**
   * Create a user
   * @param {string} userId - User ID
   * @param {string} password - Plain text password
   * @param {object} options - User options
   * @returns {object} User info
   */
  createUser(userId, password, options = {}) {
    if (this.users.has(userId)) {
      throw new Error('User already exists');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = this.hashPassword(password, salt);

    this.users.set(userId, {
      name: options.name || userId,
      passwordHash,
      salt,
      permissions: options.permissions || PermissionLevel.READ,
      createdAt: Date.now(),
      lastLogin: null,
      metadata: options.metadata || {}
    });

    logger.info(`User created: ${userId}`);

    return { userId, name: options.name || userId };
  }

  /**
   * Authenticate a user
   * @param {string} userId - User ID
   * @param {string} password - Password
   * @returns {object|null} User info or null if failed
   */
  authenticateUser(userId, password) {
    const user = this.users.get(userId);

    if (!user) {
      return null;
    }

    const hash = this.hashPassword(password, user.salt);

    if (hash !== user.passwordHash) {
      return null;
    }

    user.lastLogin = Date.now();

    return {
      userId,
      name: user.name,
      permissions: user.permissions
    };
  }

  /**
   * Hash a password
   * @param {string} password - Password
   * @param {string} salt - Salt
   * @returns {string} Hash
   */
  hashPassword(password, salt) {
    return crypto
      .pbkdf2Sync(password, salt, 10000, 64, 'sha512')
      .toString('hex');
  }

  /**
   * Change user password
   * @param {string} userId - User ID
   * @param {string} newPassword - New password
   */
  changePassword(userId, newPassword) {
    const user = this.users.get(userId);

    if (!user) {
      throw new Error('User not found');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    user.salt = salt;
    user.passwordHash = this.hashPassword(newPassword, salt);

    logger.info(`Password changed for user: ${userId}`);
  }

  /**
   * Delete a user
   * @param {string} userId - User ID
   */
  deleteUser(userId) {
    this.users.delete(userId);
    logger.info(`User deleted: ${userId}`);
  }

  // ==================== Authentication Flow ====================

  /**
   * Authenticate a request
   * @param {object} credentials - Credentials object
   * @returns {object} Authentication result
   */
  authenticate(credentials) {
    this.metrics.totalAuth++;

    if (!this.enableAuth) {
      return {
        authenticated: true,
        method: AuthMethod.NONE,
        permissions: PermissionLevel.ADMIN
      };
    }

    let result = null;

    // Try API key
    if (credentials.apiKey) {
      result = this.validateApiKey(credentials.apiKey);
      if (result) {
        result.method = AuthMethod.API_KEY;
      }
    }

    // Try session
    if (!result && credentials.sessionId) {
      result = this.validateSession(credentials.sessionId);
      if (result) {
        result.method = AuthMethod.SESSION;
      }
    }

    // Try token
    if (!result && credentials.token) {
      result = this.validateToken(credentials.token);
      if (result) {
        result.method = AuthMethod.JWT;
      }
    }

    // Try user/password
    if (!result && credentials.userId && credentials.password) {
      const user = this.authenticateUser(credentials.userId, credentials.password);
      if (user) {
        // Create session for successful login
        const session = this.createSession(user.userId, user.permissions);
        result = {
          ...user,
          method: AuthMethod.SESSION,
          sessionId: session.sessionId
        };
      }
    }

    if (result && result.valid !== false) {
      this.metrics.successfulAuth++;
      this.updateMethodMetrics(result.method, true);

      this.publishEvent(InfrastructureEvents.AUTH_SUCCESS, {
        method: result.method,
        userId: result.userId || result.name
      });

      return {
        authenticated: true,
        ...result
      };
    }

    this.metrics.failedAuth++;
    this.updateMethodMetrics(credentials.method || 'unknown', false);

    this.publishEvent(InfrastructureEvents.AUTH_FAILED, {
      method: credentials.method || 'unknown',
      reason: 'Invalid credentials'
    });

    return {
      authenticated: false,
      error: 'Authentication failed'
    };
  }

  /**
   * Check if user has required permission
   * @param {number} userPermissions - User's permission level
   * @param {number} requiredLevel - Required permission level
   * @returns {boolean}
   */
  hasPermission(userPermissions, requiredLevel) {
    return userPermissions >= requiredLevel;
  }

  /**
   * Update method-specific metrics
   */
  updateMethodMetrics(method, success) {
    if (!this.metrics.byMethod[method]) {
      this.metrics.byMethod[method] = { success: 0, failed: 0 };
    }

    if (success) {
      this.metrics.byMethod[method].success++;
    } else {
      this.metrics.byMethod[method].failed++;
    }
  }

  /**
   * Publish event to event bus
   */
  publishEvent(eventType, data) {
    if (this.eventBus) {
      this.eventBus.publish(eventType, {
        ...data,
        timestamp: Date.now()
      });
    }
    this.emit(eventType, data);
  }

  // ==================== Express Middleware ====================

  /**
   * Create Express middleware for authentication
   * @param {object} options - Middleware options
   * @returns {Function} Express middleware
   */
  middleware(options = {}) {
    const requiredLevel = options.requiredLevel || PermissionLevel.READ;

    return (req, res, next) => {
      // Extract credentials from request
      const credentials = {
        apiKey: req.headers['x-api-key'] || req.query.apiKey,
        token: this.extractBearerToken(req.headers.authorization),
        sessionId: req.cookies?.sessionId || req.headers['x-session-id']
      };

      const result = this.authenticate(credentials);

      if (!result.authenticated) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!this.hasPermission(result.permissions, requiredLevel)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // Attach auth info to request
      req.auth = result;
      next();
    };
  }

  /**
   * Extract bearer token from authorization header
   * @param {string} header - Authorization header
   * @returns {string|null}
   */
  extractBearerToken(header) {
    if (!header) return null;

    const parts = header.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      return parts[1];
    }

    return null;
  }

  // ==================== WebSocket Authentication ====================

  /**
   * Authenticate a WebSocket connection
   * @param {object} request - HTTP upgrade request
   * @returns {object} Authentication result
   */
  authenticateWebSocket(request) {
    const url = new URL(request.url, `http://${request.headers.host}`);

    const credentials = {
      apiKey: url.searchParams.get('apiKey') || request.headers['x-api-key'],
      token: this.extractBearerToken(request.headers.authorization),
      sessionId: request.headers['x-session-id']
    };

    return this.authenticate(credentials);
  }

  // ==================== Status and Metrics ====================

  /**
   * Get current status
   * @returns {object}
   */
  getStatus() {
    return {
      enabled: this.enableAuth,
      defaultMethod: this.defaultMethod,
      apiKeyCount: this.apiKeys.size,
      activeSessions: this.sessions.size,
      userCount: this.users.size,
      initialized: this.initialized
    };
  }

  /**
   * Get metrics
   * @returns {object}
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalAuth > 0
        ? ((this.metrics.successfulAuth / this.metrics.totalAuth) * 100).toFixed(2)
        : 0
    };
  }

  /**
   * Shutdown the auth manager
   */
  async shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.sessions.clear();
    this.initialized = false;

    logger.info('AuthManager shutdown');
  }
}

// Singleton instance
let instance = null;

/**
 * Get the AuthManager singleton
 * @param {object} options - Configuration options
 * @returns {AuthManager}
 */
export function getAuthManager(options = {}) {
  if (!instance) {
    instance = new AuthManager(options);
  }
  return instance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetAuthManager() {
  if (instance) {
    instance.shutdown();
  }
  instance = null;
}

export default AuthManager;
