import { describe, test, expect, beforeEach } from '@jest/globals';
import BackendDigest, { getBackendDigest } from '../../digest-generators/backend-digest.js';

describe('BackendDigest', () => {
  let digest;

  beforeEach(() => {
    digest = new BackendDigest();
  });

  describe('Initialization', () => {
    test('should create instance successfully', () => {
      expect(digest).toBeDefined();
      expect(digest.logger).toBeDefined();
    });

    test('should get singleton instance', () => {
      const instance1 = getBackendDigest();
      const instance2 = getBackendDigest();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Digest Generation', () => {
    test('should generate complete backend digest', () => {
      const mockAPI = {
        endpoints: [
          {
            path: '/api/users',
            method: 'GET',
            summary: 'Get all users',
            parameters: []
          }
        ],
        models: [
          {
            name: 'User',
            properties: {
              id: { type: 'string' },
              email: { type: 'string' }
            },
            required: ['id', 'email']
          }
        ]
      };

      const result = digest.generate({ api: mockAPI });

      expect(result).toBeDefined();
      expect(result.platform).toBe('backend');
      expect(result.framework).toBe('express');
      expect(result.routes).toBeDefined();
      expect(result.controllers).toBeDefined();
      expect(result.models).toBeDefined();
    });

    test('should handle empty input', () => {
      const result = digest.generate({});

      expect(result).toBeDefined();
      expect(result.routes).toHaveLength(0);
      expect(result.controllers).toHaveLength(0);
      expect(result.models).toHaveLength(0);
    });
  });

  describe('API Processing', () => {
    test('should group endpoints by resource', () => {
      const endpoints = [
        { path: '/api/users', method: 'GET' },
        { path: '/api/users/:id', method: 'GET' },
        { path: '/api/rides', method: 'POST' }
      ];

      const grouped = digest.groupEndpointsByResource(endpoints);

      expect(grouped.users).toHaveLength(2);
      expect(grouped.rides).toHaveLength(1);
    });

    test('should generate routes from endpoints', () => {
      const mockAPI = {
        endpoints: [
          {
            path: '/api/users',
            method: 'GET',
            summary: 'Get users'
          },
          {
            path: '/api/users',
            method: 'POST',
            summary: 'Create user'
          }
        ]
      };

      const result = digest.generate({ api: mockAPI });

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].resource).toBe('users');
      expect(result.routes[0].endpoints).toHaveLength(2);
    });

    test('should generate controllers from endpoints', () => {
      const mockAPI = {
        endpoints: [
          {
            path: '/api/users',
            method: 'GET',
            summary: 'Get all users',
            description: 'Retrieve list of users'
          }
        ]
      };

      const result = digest.generate({ api: mockAPI });

      expect(result.controllers).toHaveLength(1);
      expect(result.controllers[0].name).toBe('UsersController');
      expect(result.controllers[0].methods).toHaveLength(1);
    });

    test('should generate models from API schemas', () => {
      const mockAPI = {
        endpoints: [], // Add empty endpoints array
        models: [
          {
            name: 'User',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              age: { type: 'integer' }
            },
            required: ['id', 'name']
          }
        ]
      };

      const result = digest.generate({ api: mockAPI });

      expect(result.models).toHaveLength(1);
      expect(result.models[0].name).toBe('User');
      expect(result.models[0].schema).toBeDefined();
      expect(result.models[0].schema.id.type).toBe('String');
    });

    test('should generate authentication middleware', () => {
      const mockAPI = {
        security: [
          {
            name: 'bearerAuth',
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        ],
        endpoints: []
      };

      const result = digest.generate({ api: mockAPI });

      expect(result.middleware).toHaveLength(1);
      expect(result.middleware[0].name).toBe('bearerAuthAuth');
      expect(result.middleware[0].type).toBe('http');
    });
  });

  describe('Handler Name Generation', () => {
    test('should generate correct handler names', () => {
      expect(digest.getHandlerName({ method: 'GET', path: '/api/users' }))
        .toBe('getAllUsers');

      expect(digest.getHandlerName({ method: 'GET', path: '/api/users/:id' }))
        .toBe('getUsersById');

      expect(digest.getHandlerName({ method: 'POST', path: '/api/users' }))
        .toBe('createUsers');

      expect(digest.getHandlerName({ method: 'PUT', path: '/api/users/:id' }))
        .toBe('updateUsers');

      expect(digest.getHandlerName({ method: 'DELETE', path: '/api/users/:id' }))
        .toBe('deleteUsers');
    });
  });

  describe('Middleware Generation', () => {
    test('should add authentication middleware for secured endpoints', () => {
      const endpoint = {
        method: 'GET',
        path: '/api/users',
        security: [{ bearerAuth: [] }]
      };

      const middleware = digest.getMiddleware(endpoint);

      expect(middleware).toContain('authenticate');
      expect(middleware).toContain('validate');
    });

    test('should add validation middleware', () => {
      const endpoint = {
        method: 'POST',
        path: '/api/users'
      };

      const middleware = digest.getMiddleware(endpoint);

      expect(middleware).toContain('validate');
    });
  });

  describe('Validation Generation', () => {
    test('should extract path parameters', () => {
      const endpoint = {
        method: 'GET',
        path: '/api/users/:id',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ]
      };

      const validation = digest.getValidation(endpoint);

      expect(validation.params).toHaveLength(1);
      expect(validation.params[0].name).toBe('id');
      expect(validation.params[0].required).toBe(true);
    });

    test('should extract query parameters', () => {
      const endpoint = {
        method: 'GET',
        path: '/api/users',
        parameters: [
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer' }
          }
        ]
      };

      const validation = digest.getValidation(endpoint);

      expect(validation.query).toHaveLength(1);
      expect(validation.query[0].name).toBe('page');
    });

    test('should extract request body schema', () => {
      const endpoint = {
        method: 'POST',
        path: '/api/users',
        requestBody: {
          required: true,
          schema: { type: 'object' }
        }
      };

      const validation = digest.getValidation(endpoint);

      expect(validation.body).toBeDefined();
      expect(validation.body.type).toBe('object');
    });
  });

  describe('Service Method Extraction', () => {
    test('should extract service methods from endpoints', () => {
      const endpoints = [
        {
          method: 'GET',
          path: '/api/users',
          description: 'Get all users'
        }
      ];

      const methods = digest.extractServiceMethods(endpoints, 'users');

      expect(methods).toHaveLength(1);
      expect(methods[0].name).toBe('getAllUsers');
      expect(methods[0].implementation).toBeDefined();
    });

    test('should generate database operations', () => {
      const endpoint = { method: 'GET', path: '/api/users/:id' };

      const operations = digest.getDatabaseOperations(endpoint, 'users');

      expect(operations).toContain('Users.findById(id)');
    });
  });

  describe('Schema Conversion', () => {
    test('should convert API schema to Mongoose schema', () => {
      const model = {
        name: 'User',
        properties: {
          name: { type: 'string', description: 'User name' },
          age: { type: 'integer' },
          active: { type: 'boolean' }
        },
        required: ['name']
      };

      const schema = digest.convertToMongooseSchema(model);

      expect(schema.name.type).toBe('String');
      expect(schema.name.required).toBe(true);
      expect(schema.age.type).toBe('Number');
      expect(schema.active.type).toBe('Boolean');
    });

    test('should map types correctly', () => {
      expect(digest.mapTypeToMongoose('string')).toBe('String');
      expect(digest.mapTypeToMongoose('number')).toBe('Number');
      expect(digest.mapTypeToMongoose('integer')).toBe('Number');
      expect(digest.mapTypeToMongoose('boolean')).toBe('Boolean');
      expect(digest.mapTypeToMongoose('array')).toBe('Array');
      expect(digest.mapTypeToMongoose('object')).toBe('Object');
    });
  });

  describe('Architecture Processing', () => {
    test('should extract patterns from architecture', () => {
      const mockArchitecture = {
        patterns: [
          { name: 'repository pattern', context: 'Data access layer' },
          { name: 'singleton', context: 'Shared services' }
        ]
      };

      const result = digest.generate({ architecture: mockArchitecture });

      expect(result.patterns).toHaveLength(2);
      expect(result.patterns[0].name).toBe('repository pattern');
    });

    test('should extract dependencies from technologies', () => {
      const mockArchitecture = {
        technologies: {
          backend: [
            { name: 'Socket.io' }
          ],
          database: [
            { name: 'PostgreSQL' }
          ]
        }
      };

      const result = digest.generate({ architecture: mockArchitecture });

      expect(result.dependencies).toContain('socket.io');
      expect(result.dependencies).toContain('pg');
    });

    test('should map components to services', () => {
      const mockArchitecture = {
        components: [
          {
            name: 'AuthService',
            type: 'service',
            description: 'Handles authentication',
            responsibilities: ['Login', 'Logout']
          }
        ]
      };

      const result = digest.generate({ architecture: mockArchitecture });

      const authService = result.services.find(s => s.name === 'AuthService');
      expect(authService).toBeDefined();
      expect(authService.responsibilities).toContain('Login');
    });
  });

  describe('Feature Processing', () => {
    test('should generate validators from business rules', () => {
      const mockFeatures = {
        businessRules: [
          'Users cannot book multiple rides simultaneously',
          'Drivers must accept within 30 seconds'
        ]
      };

      const result = digest.generate({ features: mockFeatures });

      expect(result.validators.length).toBeGreaterThan(0);
    });

    test('should extract requirements as best practices', () => {
      const mockFeatures = {
        requirements: [
          'Response time must be < 2 seconds',
          'Support 1000 concurrent users'
        ]
      };

      const result = digest.generate({ features: mockFeatures });

      expect(result.bestPractices.length).toBeGreaterThan(0);
      expect(result.bestPractices[0].category).toBe('implementation');
    });
  });

  describe('Controller Implementation', () => {
    test('should generate implementation guidance', () => {
      const endpoint = {
        method: 'GET',
        path: '/api/users/:id',
        description: 'Get user by ID'
      };

      const impl = digest.generateControllerImplementation(endpoint, 'users');

      expect(impl.steps).toBeDefined();
      expect(impl.errorHandling).toBeDefined();
      expect(impl.example).toBeDefined();
      expect(impl.example).toContain('async');
    });

    test('should include error handling guidance', () => {
      const endpoint = { method: 'GET', path: '/api/users' };

      const impl = digest.generateControllerImplementation(endpoint, 'users');

      expect(impl.errorHandling).toContain('ValidationError -> 400');
      expect(impl.errorHandling).toContain('NotFoundError -> 404');
    });
  });

  describe('Dependencies', () => {
    test('should add express as dependency', () => {
      const mockAPI = {
        endpoints: [{ path: '/api/test', method: 'GET' }]
      };

      const result = digest.generate({ api: mockAPI });

      expect(result.dependencies).toContain('express');
    });

    test('should add mongoose for models', () => {
      const mockAPI = {
        models: [{ name: 'User', properties: {} }],
        endpoints: []
      };

      const result = digest.generate({ api: mockAPI });

      expect(result.dependencies).toContain('mongoose');
    });
  });

  describe('Utility Methods', () => {
    test('should capitalize strings correctly', () => {
      expect(digest.capitalize('user')).toBe('User');
      expect(digest.capitalize('userService')).toBe('UserService');
      expect(digest.capitalize('')).toBe('');
    });
  });
});
