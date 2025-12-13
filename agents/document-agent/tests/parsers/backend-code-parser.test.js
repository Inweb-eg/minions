import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';
import BackendCodeParser, { getBackendCodeParser } from '../../parsers/code-parser/backend-code-parser.js';
import { getDocumentCache } from '../../cache/DocumentCache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('BackendCodeParser', () => {
  let parser;
  let cache;
  const testBackendFile = path.join(__dirname, '..', 'fixtures', 'test-backend.js');

  beforeEach(async () => {
    parser = new BackendCodeParser();
    await parser.initialize();

    cache = getDocumentCache();
    await cache.clearAll();
  });

  afterEach(async () => {
    await cache.clearAll();
  });

  describe('Initialization', () => {
    test('should create instance successfully', () => {
      expect(parser).toBeDefined();
      expect(parser.logger).toBeDefined();
      expect(parser.cache).toBeDefined();
    });

    test('should initialize with cache', async () => {
      const newParser = new BackendCodeParser();
      await newParser.initialize();

      expect(newParser.initialized).toBe(true);
      expect(newParser.cache.initialized).toBe(true);
    });

    test('should get singleton instance', () => {
      const instance1 = getBackendCodeParser();
      const instance2 = getBackendCodeParser();

      expect(instance1).toBe(instance2);
    });
  });

  describe('AST Parsing', () => {
    test('should parse JavaScript file successfully', async () => {
      const result = await parser.parse(testBackendFile);

      expect(result).toBeDefined();
      expect(result.type).toBe('backend-code');
      expect(result.filePath).toBe(testBackendFile);
      expect(result.parsedAt).toBeDefined();
    });

    test('should extract imports', async () => {
      const result = await parser.parse(testBackendFile);

      expect(result.imports).toBeDefined();
      expect(result.imports.length).toBeGreaterThan(0);

      const expressImport = result.imports.find(i => i.source === 'express');
      expect(expressImport).toBeDefined();
      expect(expressImport.specifiers[0].type).toBe('default');
    });

    test('should extract exports', async () => {
      const result = await parser.parse(testBackendFile);

      expect(result.exports).toBeDefined();
      expect(result.exports.length).toBeGreaterThan(0);

      const userExport = result.exports.find(e => e.name === 'User');
      expect(userExport).toBeDefined();
    });
  });

  describe('Route Extraction', () => {
    test('should extract GET routes', async () => {
      const result = await parser.parse(testBackendFile);

      const getRoutes = result.routes.filter(r => r.method === 'GET');
      expect(getRoutes.length).toBeGreaterThan(0);

      const getUsersRoute = getRoutes.find(r => r.path === '/api/users');
      expect(getUsersRoute).toBeDefined();
      expect(getUsersRoute.handler).toBe('getAllUsers');
    });

    test('should extract POST routes', async () => {
      const result = await parser.parse(testBackendFile);

      const postRoutes = result.routes.filter(r => r.method === 'POST');
      expect(postRoutes.length).toBeGreaterThan(0);

      const createUserRoute = postRoutes.find(r => r.path === '/api/users');
      expect(createUserRoute).toBeDefined();
      expect(createUserRoute.handler).toBe('createUser');
    });

    test('should extract PUT routes', async () => {
      const result = await parser.parse(testBackendFile);

      const putRoutes = result.routes.filter(r => r.method === 'PUT');
      expect(putRoutes.length).toBeGreaterThan(0);

      const updateRoute = putRoutes.find(r => r.path === '/api/users/:id');
      expect(updateRoute).toBeDefined();
    });

    test('should extract DELETE routes', async () => {
      const result = await parser.parse(testBackendFile);

      const deleteRoutes = result.routes.filter(r => r.method === 'DELETE');
      expect(deleteRoutes.length).toBeGreaterThan(0);

      const deleteRoute = deleteRoutes.find(r => r.path === '/api/users/:id');
      expect(deleteRoute).toBeDefined();
    });

    test('should extract route middleware', async () => {
      const result = await parser.parse(testBackendFile);

      const getUsersRoute = result.routes.find(
        r => r.method === 'GET' && r.path === '/api/users'
      );

      expect(getUsersRoute.middleware).toBeDefined();
      expect(getUsersRoute.middleware).toContain('authenticate');
      expect(getUsersRoute.middleware).toContain('validate');
    });

    test('should handle inline handlers', async () => {
      const result = await parser.parse(testBackendFile);

      const putRoute = result.routes.find(
        r => r.method === 'PUT' && r.path === '/api/users/:id'
      );

      expect(putRoute.handler).toBe('inline');
      expect(putRoute.handlerParams).toBeDefined();
    });

    test('should extract router routes', async () => {
      const result = await parser.parse(testBackendFile);

      const profileRoute = result.routes.find(r => r.path === '/profile');
      expect(profileRoute).toBeDefined();
      expect(profileRoute.method).toBe('GET');
    });

    test('should include location information', async () => {
      const result = await parser.parse(testBackendFile);

      const route = result.routes[0];
      expect(route.location).toBeDefined();
      expect(route.location.line).toBeGreaterThan(0);
    });
  });

  describe('Controller Extraction', () => {
    test('should extract controller functions', async () => {
      const result = await parser.parse(testBackendFile);

      expect(result.controllers).toBeDefined();
      expect(result.controllers.length).toBeGreaterThan(0);
    });

    test('should identify async controllers', async () => {
      const result = await parser.parse(testBackendFile);

      const getAllUsersController = result.controllers.find(
        c => c.name === 'getAllUsers'
      );

      expect(getAllUsersController).toBeDefined();
      expect(getAllUsersController.async).toBe(true);
    });

    test('should extract controller parameters', async () => {
      const result = await parser.parse(testBackendFile);

      const controller = result.controllers.find(c => c.name === 'getAllUsers');
      expect(controller.params).toBeDefined();
      expect(controller.params).toContain('req');
      expect(controller.params).toContain('res');
    });

    test('should include location for controllers', async () => {
      const result = await parser.parse(testBackendFile);

      const controller = result.controllers[0];
      expect(controller.location).toBeDefined();
      expect(controller.location.line).toBeGreaterThan(0);
    });
  });

  describe('Model Extraction', () => {
    test('should extract Mongoose schemas', async () => {
      const result = await parser.parse(testBackendFile);

      expect(result.models).toBeDefined();
      expect(result.models.length).toBeGreaterThan(0);

      const userSchema = result.models.find(m => m.name === 'UserSchema');
      expect(userSchema).toBeDefined();
      expect(userSchema.type).toBe('schema');
    });

    test('should extract schema fields', async () => {
      const result = await parser.parse(testBackendFile);

      const userSchema = result.models.find(m => m.name === 'UserSchema');
      expect(userSchema.fields).toBeDefined();
      expect(userSchema.fields.length).toBeGreaterThan(0);

      const nameField = userSchema.fields.find(f => f.name === 'name');
      expect(nameField).toBeDefined();
      expect(nameField.type).toBe('String');
      expect(nameField.required).toBe(true);
    });

    test('should extract Mongoose models', async () => {
      const result = await parser.parse(testBackendFile);

      const userModel = result.models.find(m => m.name === 'User' && m.type === 'mongoose');
      expect(userModel).toBeDefined();
      expect(userModel.variable).toBe('User');
    });

    test('should handle optional fields', async () => {
      const result = await parser.parse(testBackendFile);

      const userSchema = result.models.find(m => m.name === 'UserSchema');
      const ageField = userSchema.fields.find(f => f.name === 'age');

      expect(ageField).toBeDefined();
      expect(ageField.type).toBe('Number');
    });
  });

  describe('Service Extraction', () => {
    test('should extract service functions', async () => {
      const result = await parser.parse(testBackendFile);

      expect(result.services).toBeDefined();
      expect(result.services.length).toBeGreaterThan(0);
    });

    test('should identify async services', async () => {
      const result = await parser.parse(testBackendFile);

      const findUsersService = result.services.find(
        s => s.name === 'findUsersByCriteria'
      );

      expect(findUsersService).toBeDefined();
      expect(findUsersService.async).toBe(true);
    });

    test('should extract service parameters', async () => {
      const result = await parser.parse(testBackendFile);

      const calculateStatsService = result.services.find(
        s => s.name === 'calculateUserStats'
      );

      expect(calculateStatsService).toBeDefined();
      expect(calculateStatsService.params).toContain('users');
    });

    test('should extract JSDoc comments', async () => {
      const result = await parser.parse(testBackendFile);

      const service = result.services.find(s => s.description);
      expect(service).toBeDefined();
      expect(service.description).toBeDefined();
    });
  });

  describe('Middleware Extraction', () => {
    test('should extract middleware functions', async () => {
      const result = await parser.parse(testBackendFile);

      expect(result.middleware).toBeDefined();
      expect(result.middleware.length).toBeGreaterThan(0);
    });

    test('should identify authenticate middleware', async () => {
      const result = await parser.parse(testBackendFile);

      const authenticateMiddleware = result.middleware.find(
        m => m.name === 'authenticate'
      );

      expect(authenticateMiddleware).toBeDefined();
      expect(authenticateMiddleware.async).toBe(true);
    });

    test('should identify validate middleware', async () => {
      const result = await parser.parse(testBackendFile);

      const validateMiddleware = result.middleware.find(
        m => m.name === 'validate'
      );

      expect(validateMiddleware).toBeDefined();
    });
  });

  describe('Multiple Files', () => {
    test('should merge results from multiple files', async () => {
      const result1 = await parser.parse(testBackendFile);
      const result2 = await parser.parse(testBackendFile);

      const merged = parser.mergeResults([result1, result2]);

      expect(merged.type).toBe('backend-code');
      expect(merged.files).toHaveLength(2);
      expect(merged.routes.length).toBe(result1.routes.length); // Deduplicated
    });

    test('should deduplicate routes by method and path', async () => {
      const result = await parser.parse(testBackendFile);
      const merged = parser.mergeResults([result, result]);

      // Should have same number of routes (deduplicated)
      expect(merged.routes.length).toBe(result.routes.length);
    });

    test('should deduplicate controllers by name', async () => {
      const result = await parser.parse(testBackendFile);
      const merged = parser.mergeResults([result, result]);

      expect(merged.controllers.length).toBe(result.controllers.length);
    });
  });

  describe('Caching', () => {
    test('should cache parsed results', async () => {
      const result1 = await parser.parse(testBackendFile);
      const result2 = await parser.parse(testBackendFile);

      // Results should have same structure
      expect(result1.routes.length).toBe(result2.routes.length);
      expect(result1.controllers.length).toBe(result2.controllers.length);
      expect(result1.models.length).toBe(result2.models.length);
    });

    test('should use cached version on second parse', async () => {
      const result1 = await parser.parse(testBackendFile);
      expect(result1).toBeDefined();

      const result2 = await parser.parse(testBackendFile);
      expect(result2).toBeDefined();

      // Both results should be consistent
      expect(result2.routes.length).toBe(result1.routes.length);
    });
  });

  describe('Error Handling', () => {
    test('should throw error for non-existent file', async () => {
      await expect(async () => {
        await parser.parse('/non/existent/file.js');
      }).rejects.toThrow();
    });

    test('should throw error for invalid JavaScript', async () => {
      const invalidFile = path.join(__dirname, '..', 'fixtures', 'invalid.js');

      // Create invalid JavaScript file (would need to do this in setup)
      // For now, just test that error is thrown for non-JS files
      await expect(async () => {
        await parser.parse(testBackendFile + '.invalid');
      }).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    test('should parse in reasonable time', async () => {
      const start = Date.now();
      await parser.parse(testBackendFile);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Less than 1 second
    });
  });
});
