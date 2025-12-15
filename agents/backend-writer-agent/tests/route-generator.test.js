import { describe, test, expect, beforeEach } from '@jest/globals';
import { RouteGenerator, getRouteGenerator, ROUTE_TYPE } from '../skills/route-generator.js';

describe('RouteGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new RouteGenerator({ dryRun: true });
  });

  describe('ROUTE_TYPE constants', () => {
    test('should define all route types', () => {
      expect(ROUTE_TYPE.CRUD).toBe('crud');
      expect(ROUTE_TYPE.READONLY).toBe('readonly');
      expect(ROUTE_TYPE.CUSTOM).toBe('custom');
    });
  });

  describe('generate', () => {
    test('should generate Express router with endpoints', async () => {
      const result = await generator.generate({
        name: 'users',
        basePath: '/api/users',
        endpoints: [
          { method: 'GET', path: '/', handler: 'list' },
          { method: 'POST', path: '/', handler: 'create' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain("const express = require('express')");
      expect(result.code).toContain('const router = express.Router()');
      expect(result.code).toContain("router.get('/'");
      expect(result.code).toContain("router.post('/'");
    });

    test('should include middleware in routes', async () => {
      const result = await generator.generate({
        name: 'users',
        basePath: '/api/users',
        endpoints: [
          { method: 'GET', path: '/', handler: 'list', middleware: ['auth'] },
          { method: 'POST', path: '/', handler: 'create', middleware: ['auth', 'validate'] }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('auth');
      expect(result.code).toContain('validate');
    });

    test('should generate route with path parameters', async () => {
      const result = await generator.generate({
        name: 'users',
        basePath: '/api/users',
        endpoints: [
          { method: 'GET', path: '/:id', handler: 'getById' },
          { method: 'PUT', path: '/:id', handler: 'update' },
          { method: 'DELETE', path: '/:id', handler: 'delete' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain("router.get('/:id'");
      expect(result.code).toContain("router.put('/:id'");
      expect(result.code).toContain("router.delete('/:id'");
    });

    test('should include controller imports', async () => {
      const result = await generator.generate({
        name: 'users',
        basePath: '/api/users',
        controller: 'userController',
        endpoints: [
          { method: 'GET', path: '/', handler: 'list' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('userController');
    });

    test('should generate CRUD routes shorthand', async () => {
      const result = await generator.generate({
        name: 'users',
        basePath: '/api/users',
        type: ROUTE_TYPE.CRUD
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain("router.get('/'"); // list
      expect(result.code).toContain("router.post('/'"); // create
      expect(result.code).toContain("router.get('/:id'"); // getById
      expect(result.code).toContain("router.put('/:id'"); // update
      expect(result.code).toContain("router.delete('/:id'"); // delete
    });

    test('should generate readonly routes', async () => {
      const result = await generator.generate({
        name: 'users',
        basePath: '/api/users',
        type: ROUTE_TYPE.READONLY
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain("router.get('/'");
      expect(result.code).toContain("router.get('/:id'");
      expect(result.code).not.toContain("router.post");
      expect(result.code).not.toContain("router.put");
      expect(result.code).not.toContain("router.delete");
    });

    test('should export router', async () => {
      const result = await generator.generate({
        name: 'users',
        basePath: '/api/users',
        endpoints: []
      });

      expect(result.success).toBe(true);
      expect(result.code).toContain('module.exports = router');
    });

    test('should fail with missing name', async () => {
      const result = await generator.generate({
        basePath: '/api/users',
        endpoints: []
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Missing required field: 'name'");
    });
  });

  describe('singleton', () => {
    test('getRouteGenerator should return singleton', () => {
      const gen1 = getRouteGenerator();
      const gen2 = getRouteGenerator();

      expect(gen1).toBe(gen2);
    });
  });
});
