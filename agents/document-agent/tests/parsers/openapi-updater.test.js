import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import OpenAPIUpdater, { getOpenAPIUpdater } from '../../parsers/code-parser/openapi-updater.js';
import { getDocumentCache } from '../../cache/DocumentCache.js';

describe('OpenAPIUpdater', () => {
  let updater;
  let cache;

  beforeEach(async () => {
    updater = new OpenAPIUpdater();
    await updater.initialize();

    cache = getDocumentCache();
    await cache.clearAll();
  });

  afterEach(async () => {
    await cache.clearAll();
  });

  describe('Initialization', () => {
    test('should create instance successfully', () => {
      expect(updater).toBeDefined();
      expect(updater.logger).toBeDefined();
      expect(updater.cache).toBeDefined();
    });

    test('should get singleton instance', () => {
      const instance1 = getOpenAPIUpdater();
      const instance2 = getOpenAPIUpdater();

      expect(instance1).toBe(instance2);
    });
  });

  describe('OpenAPI Generation', () => {
    test('should generate basic OpenAPI spec', () => {
      const parsedCode = {
        routes: [
          {
            method: 'GET',
            path: '/api/users',
            handler: 'getAllUsers',
            middleware: []
          }
        ],
        models: [],
        middleware: []
      };

      const spec = updater.generate(parsedCode);

      expect(spec.openapi).toBe('3.0.0');
      expect(spec.info.title).toBeDefined();
      expect(spec.info.version).toBeDefined();
      expect(spec.paths['/api/users']).toBeDefined();
      expect(spec.paths['/api/users'].get).toBeDefined();
    });

    test('should include custom options', () => {
      const parsedCode = { routes: [], models: [], middleware: [] };
      const options = {
        title: 'My API',
        version: '2.0.0',
        description: 'Custom API description'
      };

      const spec = updater.generate(parsedCode, options);

      expect(spec.info.title).toBe('My API');
      expect(spec.info.version).toBe('2.0.0');
      expect(spec.info.description).toBe('Custom API description');
    });

    test('should generate paths for multiple routes', () => {
      const parsedCode = {
        routes: [
          { method: 'GET', path: '/api/users', handler: 'getAllUsers', middleware: [] },
          { method: 'POST', path: '/api/users', handler: 'createUser', middleware: [] },
          { method: 'GET', path: '/api/users/:id', handler: 'getUserById', middleware: [] }
        ],
        models: [],
        middleware: []
      };

      const spec = updater.generate(parsedCode);

      expect(Object.keys(spec.paths).length).toBe(2); // /api/users and /api/users/:id
      expect(spec.paths['/api/users'].get).toBeDefined();
      expect(spec.paths['/api/users'].post).toBeDefined();
      expect(spec.paths['/api/users/:id'].get).toBeDefined();
    });

    test('should generate request body for POST routes', () => {
      const parsedCode = {
        routes: [
          { method: 'POST', path: '/api/users', handler: 'createUser', middleware: [] }
        ],
        models: [],
        middleware: []
      };

      const spec = updater.generate(parsedCode);

      expect(spec.paths['/api/users'].post.requestBody).toBeDefined();
      expect(spec.paths['/api/users'].post.requestBody.required).toBe(true);
      expect(spec.paths['/api/users'].post.requestBody.content['application/json']).toBeDefined();
    });

    test('should generate path parameters', () => {
      const parsedCode = {
        routes: [
          { method: 'GET', path: '/api/users/:id', handler: 'getUserById', middleware: [] }
        ],
        models: [],
        middleware: []
      };

      const spec = updater.generate(parsedCode);

      const parameters = spec.paths['/api/users/:id'].get.parameters;
      expect(parameters.length).toBe(1);
      expect(parameters[0].name).toBe('id');
      expect(parameters[0].in).toBe('path');
      expect(parameters[0].required).toBe(true);
    });

    test('should generate multiple path parameters', () => {
      const parsedCode = {
        routes: [
          { method: 'GET', path: '/api/users/:userId/posts/:postId', handler: 'getPost', middleware: [] }
        ],
        models: [],
        middleware: []
      };

      const spec = updater.generate(parsedCode);

      const parameters = spec.paths['/api/users/:userId/posts/:postId'].get.parameters;
      expect(parameters.length).toBe(2);
      expect(parameters.some(p => p.name === 'userId')).toBe(true);
      expect(parameters.some(p => p.name === 'postId')).toBe(true);
    });
  });

  describe('Schema Generation', () => {
    test('should generate schemas from models', () => {
      const parsedCode = {
        routes: [],
        models: [
          {
            name: 'UserSchema',
            type: 'schema',
            fields: [
              { name: 'name', type: 'String', required: true },
              { name: 'email', type: 'String', required: true },
              { name: 'age', type: 'Number', required: false }
            ]
          }
        ],
        middleware: []
      };

      const spec = updater.generate(parsedCode);

      expect(spec.components.schemas.User).toBeDefined();
      expect(spec.components.schemas.User.type).toBe('object');
      expect(spec.components.schemas.User.properties.name).toBeDefined();
      expect(spec.components.schemas.User.properties.name.type).toBe('string');
      expect(spec.components.schemas.User.required).toContain('name');
      expect(spec.components.schemas.User.required).toContain('email');
    });

    test('should map Mongoose types to OpenAPI types', () => {
      const parsedCode = {
        routes: [],
        models: [
          {
            name: 'TestSchema',
            type: 'schema',
            fields: [
              { name: 'stringField', type: 'String', required: false },
              { name: 'numberField', type: 'Number', required: false },
              { name: 'booleanField', type: 'Boolean', required: false },
              { name: 'dateField', type: 'Date', required: false }
            ]
          }
        ],
        middleware: []
      };

      const spec = updater.generate(parsedCode);

      expect(spec.components.schemas.Test.properties.stringField.type).toBe('string');
      expect(spec.components.schemas.Test.properties.numberField.type).toBe('number');
      expect(spec.components.schemas.Test.properties.booleanField.type).toBe('boolean');
      expect(spec.components.schemas.Test.properties.dateField.type).toBe('string');
    });

    test('should handle schemas with no required fields', () => {
      const parsedCode = {
        routes: [],
        models: [
          {
            name: 'UserSchema',
            type: 'schema',
            fields: [
              { name: 'name', type: 'String', required: false },
              { name: 'age', type: 'Number', required: false }
            ]
          }
        ],
        middleware: []
      };

      const spec = updater.generate(parsedCode);

      expect(spec.components.schemas.User.required).toBeUndefined();
    });
  });

  describe('Security Generation', () => {
    test('should generate security schemes for auth middleware', () => {
      const parsedCode = {
        routes: [],
        models: [],
        middleware: [
          { name: 'authenticate', async: true }
        ]
      };

      const spec = updater.generate(parsedCode);

      expect(spec.components.securitySchemes.bearerAuth).toBeDefined();
      expect(spec.components.securitySchemes.bearerAuth.type).toBe('http');
      expect(spec.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
    });

    test('should add security to routes with auth middleware', () => {
      const parsedCode = {
        routes: [
          { method: 'GET', path: '/api/users', handler: 'getAllUsers', middleware: ['authenticate'] }
        ],
        models: [],
        middleware: []
      };

      const spec = updater.generate(parsedCode);

      expect(spec.paths['/api/users'].get.security).toBeDefined();
      expect(spec.paths['/api/users'].get.security.length).toBeGreaterThan(0);
    });

    test('should not add security to public routes', () => {
      const parsedCode = {
        routes: [
          { method: 'GET', path: '/api/public', handler: 'getPublic', middleware: [] }
        ],
        models: [],
        middleware: []
      };

      const spec = updater.generate(parsedCode);

      expect(spec.paths['/api/public'].get.security).toEqual([]);
    });
  });

  describe('Spec Updates', () => {
    test('should update spec with route additions', () => {
      const existingSpec = {
        openapi: '3.0.0',
        info: { title: 'API', version: '1.0.0' },
        paths: {},
        components: { schemas: {}, securitySchemes: {} }
      };

      const changes = {
        additions: [
          {
            type: 'route_added',
            category: 'routes',
            newValue: { method: 'POST', path: '/api/users', handler: 'createUser', middleware: [] }
          }
        ]
      };

      const parsedCode = {
        routes: [
          { method: 'POST', path: '/api/users', handler: 'createUser', middleware: [] }
        ]
      };

      const updatedSpec = updater.update(existingSpec, changes, parsedCode);

      expect(updatedSpec.paths['/api/users']).toBeDefined();
      expect(updatedSpec.paths['/api/users'].post).toBeDefined();
      expect(updatedSpec.info.version).toBe('1.1.0'); // Minor bump for additions
    });

    test('should update spec with route removals', () => {
      const existingSpec = {
        openapi: '3.0.0',
        info: { title: 'API', version: '1.0.0' },
        paths: {
          '/api/users': {
            get: { summary: 'Get users' },
            post: { summary: 'Create user' }
          }
        },
        components: { schemas: {}, securitySchemes: {} }
      };

      const changes = {
        breaking: [
          {
            type: 'route_removed',
            category: 'routes',
            oldValue: { method: 'POST', path: '/api/users' }
          }
        ]
      };

      const parsedCode = { routes: [] };

      const updatedSpec = updater.update(existingSpec, changes, parsedCode);

      expect(updatedSpec.paths['/api/users'].post).toBeUndefined();
      expect(updatedSpec.paths['/api/users'].get).toBeDefined(); // Other methods remain
      expect(updatedSpec.info.version).toBe('2.0.0'); // Major bump for breaking changes
    });

    test('should remove path when all methods removed', () => {
      const existingSpec = {
        openapi: '3.0.0',
        info: { title: 'API', version: '1.0.0' },
        paths: {
          '/api/users': {
            get: { summary: 'Get users' }
          }
        },
        components: { schemas: {}, securitySchemes: {} }
      };

      const changes = {
        breaking: [
          {
            type: 'route_removed',
            category: 'routes',
            oldValue: { method: 'GET', path: '/api/users' }
          }
        ]
      };

      const parsedCode = { routes: [] };

      const updatedSpec = updater.update(existingSpec, changes, parsedCode);

      expect(updatedSpec.paths['/api/users']).toBeUndefined();
    });

    test('should update spec with model additions', () => {
      const existingSpec = {
        openapi: '3.0.0',
        info: { title: 'API', version: '1.0.0' },
        paths: {},
        components: { schemas: {}, securitySchemes: {} }
      };

      const changes = {
        additions: [
          {
            type: 'model_added',
            category: 'models',
            newValue: {
              name: 'UserSchema',
              type: 'schema',
              fields: [
                { name: 'name', type: 'String', required: true }
              ]
            }
          }
        ]
      };

      const parsedCode = {
        models: [
          {
            name: 'UserSchema',
            type: 'schema',
            fields: [
              { name: 'name', type: 'String', required: true }
            ]
          }
        ]
      };

      const updatedSpec = updater.update(existingSpec, changes, parsedCode);

      expect(updatedSpec.components.schemas.User).toBeDefined();
    });

    test('should update spec with model removals', () => {
      const existingSpec = {
        openapi: '3.0.0',
        info: { title: 'API', version: '1.0.0' },
        paths: {},
        components: {
          schemas: {
            User: { type: 'object', properties: {} }
          },
          securitySchemes: {}
        }
      };

      const changes = {
        breaking: [
          {
            type: 'model_removed',
            category: 'models',
            oldValue: { name: 'UserSchema' }
          }
        ]
      };

      const parsedCode = { models: [] };

      const updatedSpec = updater.update(existingSpec, changes, parsedCode);

      expect(updatedSpec.components.schemas.User).toBeUndefined();
    });

    test('should update spec with field type changes', () => {
      const existingSpec = {
        openapi: '3.0.0',
        info: { title: 'API', version: '1.0.0' },
        paths: {},
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                age: { type: 'string' }
              }
            }
          },
          securitySchemes: {}
        }
      };

      const changes = {
        breaking: [
          {
            type: 'field_type_changed',
            category: 'models',
            model: 'UserSchema',
            field: 'age',
            newValue: { type: 'Number' }
          }
        ]
      };

      const parsedCode = { models: [] };

      const updatedSpec = updater.update(existingSpec, changes, parsedCode);

      expect(updatedSpec.components.schemas.User.properties.age.type).toBe('number');
    });
  });

  describe('Version Bumping', () => {
    test('should bump major version for breaking changes', () => {
      const existingSpec = {
        openapi: '3.0.0',
        info: { title: 'API', version: '1.2.3' },
        paths: {},
        components: { schemas: {}, securitySchemes: {} }
      };

      const changes = {
        breaking: [{ type: 'route_removed', category: 'routes' }]
      };

      const updatedSpec = updater.update(existingSpec, changes, {});

      expect(updatedSpec.info.version).toBe('2.0.0');
    });

    test('should bump minor version for additions', () => {
      const existingSpec = {
        openapi: '3.0.0',
        info: { title: 'API', version: '1.2.3' },
        paths: {},
        components: { schemas: {}, securitySchemes: {} }
      };

      const changes = {
        additions: [{ type: 'route_added', category: 'routes' }]
      };

      const updatedSpec = updater.update(existingSpec, changes, {});

      expect(updatedSpec.info.version).toBe('1.3.0');
    });

    test('should bump patch version for non-breaking changes', () => {
      const existingSpec = {
        openapi: '3.0.0',
        info: { title: 'API', version: '1.2.3' },
        paths: {},
        components: { schemas: {}, securitySchemes: {} }
      };

      const changes = {
        nonBreaking: [{ type: 'route_handler_changed', category: 'routes' }]
      };

      const updatedSpec = updater.update(existingSpec, changes, {});

      expect(updatedSpec.info.version).toBe('1.2.4');
    });
  });

  describe('Validation', () => {
    test('should validate valid spec', () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'API', version: '1.0.0' },
        paths: {
          '/api/users': {
            get: { summary: 'Get users' }
          }
        }
      };

      const validation = updater.validate(spec);

      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    test('should detect missing openapi version', () => {
      const spec = {
        info: { title: 'API', version: '1.0.0' },
        paths: {}
      };

      const validation = updater.validate(spec);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing openapi version');
    });

    test('should detect missing info fields', () => {
      const spec = {
        openapi: '3.0.0',
        paths: {}
      };

      const validation = updater.validate(spec);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('info'))).toBe(true);
    });

    test('should detect empty paths', () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'API', version: '1.0.0' },
        paths: {}
      };

      const validation = updater.validate(spec);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('No paths defined');
    });
  });

  describe('Export', () => {
    test('should export spec as JSON', () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'API', version: '1.0.0' },
        paths: {}
      };

      const exported = updater.export(spec, 'json');

      expect(typeof exported).toBe('string');
      expect(JSON.parse(exported)).toEqual(spec);
    });

    test('should default to JSON format', () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'API', version: '1.0.0' },
        paths: {}
      };

      const exported = updater.export(spec);

      expect(typeof exported).toBe('string');
      expect(JSON.parse(exported)).toEqual(spec);
    });
  });

  describe('Helper Methods', () => {
    test('should extract tags from path', () => {
      expect(updater.extractTags('/api/users')).toEqual(['api']);
      expect(updater.extractTags('/api/users/:id')).toEqual(['api']);
      expect(updater.extractTags('/')).toEqual(['default']);
    });

    test('should convert path to operation ID', () => {
      expect(updater.pathToOperationId('/api/users')).toBe('api_users');
      expect(updater.pathToOperationId('/api/users/:id')).toBe('api_users_id');
    });
  });
});
