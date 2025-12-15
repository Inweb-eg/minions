/**
 * MiddlewareGenerator - Express Middleware Code Generation Skill
 *
 * Generates Express middleware:
 * - Authentication middleware
 * - Authorization middleware
 * - Rate limiting
 * - Error handling
 * - Validation
 * - Logging
 */

import { BaseWriterSkill, LANGUAGE, GENERATION_RESULT } from '../../writer-skills/BaseWriterSkill.js';
import { EventTypes } from '../../../foundation/event-bus/eventTypes.js';

/**
 * Middleware types
 */
export const MIDDLEWARE_TYPE = {
  AUTH: 'auth',
  AUTHORIZE: 'authorize',
  RATE_LIMIT: 'rateLimit',
  ERROR_HANDLER: 'errorHandler',
  VALIDATE: 'validate',
  LOGGER: 'logger',
  CORS: 'cors',
  CUSTOM: 'custom'
};

/**
 * MiddlewareGenerator Skill
 */
export class MiddlewareGenerator extends BaseWriterSkill {
  constructor(options = {}) {
    super('MiddlewareGenerator', {
      language: LANGUAGE.JAVASCRIPT,
      ...options
    });

    this.registerTemplates();
  }

  registerTemplates() {
    // Authentication middleware template
    this.registerTemplate('auth', (data) => `
const jwt = require('jsonwebtoken');
${data.imports || ''}

/**
 * JWT Authentication Middleware
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || '${data.jwtSecret || 'your-secret-key'}');

    ${data.loadUser !== false ? `// Load user from database
    const ${data.userModel || 'User'} = require('${data.userModelPath || '../models/User'}');
    const user = await ${data.userModel || 'User'}.findById(decoded.id)${data.userSelect ? `.select('${data.userSelect}')` : ''};

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }

    ${data.checkUserStatus ? `// Check user status
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Account is not active'
      });
    }` : ''}

    req.user = user;` : 'req.user = decoded;'}

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired'
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }
    next(error);
  }
};

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || '${data.jwtSecret || 'your-secret-key'}');

    ${data.loadUser !== false ? `const ${data.userModel || 'User'} = require('${data.userModelPath || '../models/User'}');
    const user = await ${data.userModel || 'User'}.findById(decoded.id);
    req.user = user;` : 'req.user = decoded;'}

    next();
  } catch (error) {
    // Ignore errors for optional auth
    next();
  }
};

module.exports = {
  authenticate,
  optionalAuth
};
`.trim());

    // Authorization middleware template
    this.registerTemplate('authorize', (data) => `
${data.imports || ''}

/**
 * Role-based Authorization Middleware
 * @param {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const userRole = req.user.role || req.user.type;

    if (!roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this resource'
      });
    }

    next();
  };
};

/**
 * Permission-based Authorization Middleware
 * @param {...string} permissions - Required permissions
 */
const requirePermission = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const userPermissions = req.user.permissions || [];

    const hasPermission = permissions.every(permission =>
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    next();
  };
};

/**
 * Resource ownership middleware
 * @param {string} resourceKey - Key to find resource ID in params
 * @param {string} userKey - Key to compare with user ID
 */
const requireOwnership = (resourceKey = 'id', userKey = '_id') => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const resourceId = req.params[resourceKey];
    const userId = req.user[userKey].toString();

    // Admin bypass
    if (req.user.role === 'admin') {
      return next();
    }

    // Check ownership (implement based on your needs)
    // This is a simplified example
    if (resourceId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this resource'
      });
    }

    next();
  };
};

module.exports = {
  authorize,
  requirePermission,
  requireOwnership
};
`.trim());

    // Rate limiting middleware template
    this.registerTemplate('rateLimit', (data) => `
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
${data.useRedis ? `const { createClient } = require('redis');

// Redis client for rate limiting
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});
redisClient.connect().catch(console.error);` : ''}

/**
 * Default rate limiter
 */
const defaultLimiter = rateLimit({
  windowMs: ${data.windowMs || 15 * 60 * 1000}, // ${data.windowMinutes || 15} minutes
  max: ${data.max || 100}, // Limit each IP to ${data.max || 100} requests per window
  message: {
    success: false,
    error: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  ${data.useRedis ? `store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args)
  }),` : ''}
});

/**
 * Strict rate limiter for sensitive endpoints
 */
const strictLimiter = rateLimit({
  windowMs: ${data.strictWindowMs || 60 * 60 * 1000}, // 1 hour
  max: ${data.strictMax || 5}, // 5 attempts per hour
  message: {
    success: false,
    error: 'Too many attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  ${data.useRedis ? `store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args)
  }),` : ''}
});

/**
 * Auth rate limiter (login, register)
 */
const authLimiter = rateLimit({
  windowMs: ${data.authWindowMs || 15 * 60 * 1000}, // 15 minutes
  max: ${data.authMax || 10}, // 10 attempts
  message: {
    success: false,
    error: 'Too many authentication attempts'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  ${data.useRedis ? `store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args)
  }),` : ''}
});

/**
 * Create custom rate limiter
 */
const createLimiter = (options = {}) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000,
    max: options.max || 100,
    message: options.message || {
      success: false,
      error: 'Too many requests'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: options.keyGenerator,
    skip: options.skip,
    ${data.useRedis ? `store: new RedisStore({
      sendCommand: (...args) => redisClient.sendCommand(args)
    }),` : ''}
  });
};

module.exports = {
  defaultLimiter,
  strictLimiter,
  authLimiter,
  createLimiter
};
`.trim());

    // Error handler middleware template
    this.registerTemplate('errorHandler', (data) => `
${data.imports || ''}

/**
 * Custom error classes
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400);
    this.errors = errors;
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409);
  }
}

class ExternalServiceError extends AppError {
  constructor(service, message) {
    super(\`\${service} error: \${message}\`, 502);
    this.service = service;
  }
}

/**
 * Not found handler for unmatched routes
 */
const notFoundHandler = (req, res, next) => {
  next(new NotFoundError(\`Route \${req.originalUrl} not found\`));
};

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log error
  console.error('Error:', {
    message: err.message,
    stack: ${data.showStackInProd ? 'err.stack' : "process.env.NODE_ENV !== 'production' ? err.stack : undefined"},
    path: req.path,
    method: req.method
  });

  // Default error values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errors = err.errors || undefined;

  // Handle specific error types
  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  }

  if (err.name === 'ValidationError' && err.errors) {
    statusCode = 400;
    message = 'Validation failed';
    errors = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message
    }));
  }

  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyPattern)[0];
    message = \`\${field} already exists\`;
  }

  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Send response
  res.status(statusCode).json({
    success: false,
    error: message,
    ...(errors && { errors }),
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  ExternalServiceError,
  notFoundHandler,
  errorHandler
};
`.trim());

    // Validation middleware template
    this.registerTemplate('validate', (data) => `
const Joi = require('joi');
${data.imports || ''}

/**
 * Validation middleware factory
 * @param {Object} schema - Joi schema object with body, query, params
 */
const validate = (schema) => {
  return (req, res, next) => {
    const validationErrors = [];

    // Validate body
    if (schema.body) {
      const { error, value } = schema.body.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        validationErrors.push(...error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message,
          location: 'body'
        })));
      } else {
        req.body = value;
      }
    }

    // Validate query
    if (schema.query) {
      const { error, value } = schema.query.validate(req.query, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        validationErrors.push(...error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message,
          location: 'query'
        })));
      } else {
        req.query = value;
      }
    }

    // Validate params
    if (schema.params) {
      const { error, value } = schema.params.validate(req.params, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        validationErrors.push(...error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message,
          location: 'params'
        })));
      } else {
        req.params = value;
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors: validationErrors
      });
    }

    next();
  };
};

/**
 * Common validation schemas
 */
const commonSchemas = {
  objectId: Joi.string().regex(/^[0-9a-fA-F]{24}$/),
  pagination: {
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string()
  },
  email: Joi.string().email().lowercase().trim(),
  password: Joi.string().min(${data.minPasswordLength || 8}).max(128),
  phone: Joi.string().pattern(/^\\+?[1-9]\\d{1,14}$/),
  uuid: Joi.string().uuid()
};

module.exports = {
  validate,
  commonSchemas,
  Joi
};
`.trim());

    // Logger middleware template
    this.registerTemplate('logger', (data) => `
const morgan = require('morgan');
${data.useWinston ? `const winston = require('winston');

// Winston logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: '${data.serviceName || 'api'}' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    ${data.logToFile ? `new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })` : ''}
  ]
});` : ''}

/**
 * Request logging middleware
 */
const requestLogger = morgan(${data.morganFormat ? `'${data.morganFormat}'` : `process.env.NODE_ENV === 'production' ? 'combined' : 'dev'`}${data.useWinston ? `, {
  stream: {
    write: (message) => logger.http(message.trim())
  }
}` : ''});

/**
 * Custom request logger with additional context
 */
const customLogger = (req, res, next) => {
  const start = Date.now();

  // Log request
  ${data.useWinston ? `logger.info` : `console.log`}({
    type: 'request',
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: req.user?.id || req.user?._id
  });

  // Log response on finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    ${data.useWinston ? `logger.info` : `console.log`}({
      type: 'response',
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: \`\${duration}ms\`
    });
  });

  next();
};

module.exports = {
  requestLogger,
  customLogger,
  ${data.useWinston ? 'logger' : ''}
};
`.trim());

    // CORS middleware template
    this.registerTemplate('cors', (data) => `
const cors = require('cors');

/**
 * CORS configuration
 */
const corsOptions = {
  origin: ${data.origins ? JSON.stringify(data.origins) : `process.env.CORS_ORIGIN?.split(',') || '*'`},
  methods: ${JSON.stringify(data.methods || ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])},
  allowedHeaders: ${JSON.stringify(data.allowedHeaders || ['Content-Type', 'Authorization', 'X-Requested-With'])},
  exposedHeaders: ${JSON.stringify(data.exposedHeaders || ['X-Total-Count', 'X-Page', 'X-Limit'])},
  credentials: ${data.credentials ?? true},
  maxAge: ${data.maxAge || 86400}
};

/**
 * CORS middleware
 */
const corsMiddleware = cors(corsOptions);

/**
 * Preflight handler for complex requests
 */
const preflightHandler = cors({
  ...corsOptions,
  preflightContinue: false,
  optionsSuccessStatus: 204
});

module.exports = {
  corsMiddleware,
  preflightHandler,
  corsOptions
};
`.trim());

    // Custom middleware template
    this.registerTemplate('custom', (data) => `
${data.imports || ''}

/**
 * ${data.description || data.name + ' Middleware'}
 */
const ${this.toCamelCase(data.name)} = ${data.async !== false ? 'async ' : ''}(req, res, next) => {
  try {
    ${data.body || '// TODO: Implement middleware logic'}

    next();
  } catch (error) {
    next(error);
  }
};

${data.additionalMiddleware || ''}

module.exports = {
  ${this.toCamelCase(data.name)}
};
`.trim());
  }

  /**
   * Generate middleware
   * @param {Object} spec - Middleware specification
   * @returns {Promise<Object>} Generation result
   */
  async generate(spec) {
    this.startRun();

    try {
      // Validate spec
      const validation = this.validateSpec(spec, {
        required: ['name'],
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: Object.values(MIDDLEWARE_TYPE) }
        }
      });

      if (!validation.valid) {
        this.failRun(new Error(validation.errors.join(', ')));
        return { success: false, errors: validation.errors };
      }

      // Determine template
      const templateName = spec.type || MIDDLEWARE_TYPE.CUSTOM;

      // Build output path
      const fileName = this.toKebabCase(spec.name) + '.middleware.js';
      const outputPath = spec.outputPath || `src/middleware/${fileName}`;

      // Generate and write
      const result = await this.generateAndWrite(spec, templateName, outputPath, {
        overwrite: spec.overwrite || false
      });

      if (result.success) {
        this.publish(EventTypes.BACKEND_MIDDLEWARE_GENERATED, {
          name: spec.name,
          type: templateName,
          path: result.path
        });
      }

      this.completeRun();
      return result;
    } catch (error) {
      this.failRun(error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Convert to camelCase
   */
  toCamelCase(str) {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }

  /**
   * Convert to kebab-case
   */
  toKebabCase(str) {
    return str.replace(/([A-Z])/g, (match, p1, offset) => {
      return (offset > 0 ? '-' : '') + p1.toLowerCase();
    }).replace(/^-/, '');
  }
}

// Singleton getter
let instance = null;

export function getMiddlewareGenerator(options = {}) {
  if (!instance) {
    instance = new MiddlewareGenerator(options);
  }
  return instance;
}

export default MiddlewareGenerator;
