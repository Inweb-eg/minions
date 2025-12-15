import { describe, test, expect, beforeEach } from '@jest/globals';
import { MiddlewareGenerator, getMiddlewareGenerator, MIDDLEWARE_TYPE } from '../skills/middleware-generator.js';

describe('MiddlewareGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new MiddlewareGenerator({ dryRun: true });
  });

  describe('MIDDLEWARE_TYPE constants', () => {
    test('should define all middleware types', () => {
      expect(MIDDLEWARE_TYPE.AUTH).toBe('auth');
      expect(MIDDLEWARE_TYPE.VALIDATION).toBe('validation');
      expect(MIDDLEWARE_TYPE.RATE_LIMIT).toBe('rateLimit');
      expect(MIDDLEWARE_TYPE.ERROR_HANDLER).toBe('errorHandler');
      expect(MIDDLEWARE_TYPE.CUSTOM).toBe('custom');
    });
  });

  describe('generate auth middleware', () => {
    test('should generate JWT authentication middleware', async () => {
      const result = await generator.generate({
        name: 'auth',
        type: MIDDLEWARE_TYPE.AUTH,
        options: {
          jwtSecret: 'process.env.JWT_SECRET'
        }
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain("const jwt = require('jsonwebtoken')");
      expect(result.code).toContain('jwt.verify');
      expect(result.code).toContain('process.env.JWT_SECRET');
      expect(result.code).toContain('req.user');
    });

    test('should include excluded paths', async () => {
      const result = await generator.generate({
        name: 'auth',
        type: MIDDLEWARE_TYPE.AUTH,
        options: {
          excludePaths: ['/api/auth/login', '/api/auth/register']
        }
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('/api/auth/login');
      expect(result.code).toContain('/api/auth/register');
      expect(result.code).toContain('excludedPaths');
    });

    test('should handle Bearer token extraction', async () => {
      const result = await generator.generate({
        name: 'auth',
        type: MIDDLEWARE_TYPE.AUTH
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('authorization');
      expect(result.code).toContain('Bearer');
      expect(result.code).toContain('split');
    });
  });

  describe('generate rate limit middleware', () => {
    test('should generate rate limiting middleware', async () => {
      const result = await generator.generate({
        name: 'rateLimit',
        type: MIDDLEWARE_TYPE.RATE_LIMIT,
        options: {
          windowMs: 60000,
          maxRequests: 100
        }
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('rateLimit');
      expect(result.code).toContain('windowMs');
      expect(result.code).toContain('60000');
      expect(result.code).toContain('100');
    });

    test('should include custom message', async () => {
      const result = await generator.generate({
        name: 'rateLimit',
        type: MIDDLEWARE_TYPE.RATE_LIMIT,
        options: {
          message: 'Too many requests, please try again later'
        }
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('Too many requests');
    });
  });

  describe('generate error handler middleware', () => {
    test('should generate error handling middleware', async () => {
      const result = await generator.generate({
        name: 'errorHandler',
        type: MIDDLEWARE_TYPE.ERROR_HANDLER
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('(err, req, res, next)');
      expect(result.code).toContain('err.status');
      expect(result.code).toContain('err.message');
      expect(result.code).toContain('console.error');
    });

    test('should include stack trace in development', async () => {
      const result = await generator.generate({
        name: 'errorHandler',
        type: MIDDLEWARE_TYPE.ERROR_HANDLER
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('NODE_ENV');
      expect(result.code).toContain('development');
      expect(result.code).toContain('stack');
    });
  });

  describe('generate validation middleware', () => {
    test('should generate validation middleware', async () => {
      const result = await generator.generate({
        name: 'validate',
        type: MIDDLEWARE_TYPE.VALIDATION,
        options: {
          schema: 'userSchema'
        }
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('validate');
      expect(result.code).toContain('schema');
      expect(result.code).toContain('req.body');
    });
  });

  describe('generate custom middleware', () => {
    test('should generate custom middleware template', async () => {
      const result = await generator.generate({
        name: 'logger',
        type: MIDDLEWARE_TYPE.CUSTOM
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('(req, res, next)');
      expect(result.code).toContain('next()');
    });
  });

  describe('validation', () => {
    test('should fail with missing name', async () => {
      const result = await generator.generate({
        type: MIDDLEWARE_TYPE.AUTH
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Missing required field: 'name'");
    });
  });

  describe('singleton', () => {
    test('getMiddlewareGenerator should return singleton', () => {
      const gen1 = getMiddlewareGenerator();
      const gen2 = getMiddlewareGenerator();

      expect(gen1).toBe(gen2);
    });
  });
});
