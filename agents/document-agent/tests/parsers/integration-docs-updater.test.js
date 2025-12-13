import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import IntegrationDocsUpdater, { getIntegrationDocsUpdater } from '../../parsers/code-parser/integration-docs-updater.js';
import { getDocumentCache } from '../../cache/DocumentCache.js';

describe('IntegrationDocsUpdater', () => {
  let updater;
  let cache;

  beforeEach(async () => {
    updater = new IntegrationDocsUpdater();
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
      const instance1 = getIntegrationDocsUpdater();
      const instance2 = getIntegrationDocsUpdater();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Documentation Generation', () => {
    test('should generate complete integration docs', () => {
      const parsedCode = {
        routes: [
          { method: 'GET', path: '/api/users', handler: 'getAllUsers', middleware: [] }
        ],
        models: [
          {
            name: 'UserSchema',
            type: 'schema',
            fields: [
              { name: 'name', type: 'String', required: true }
            ]
          }
        ],
        middleware: []
      };

      const docs = updater.generate(parsedCode);

      expect(docs.title).toBeDefined();
      expect(docs.version).toBeDefined();
      expect(docs.sections.gettingStarted).toBeDefined();
      expect(docs.sections.authentication).toBeDefined();
      expect(docs.sections.endpoints).toBeDefined();
      expect(docs.sections.models).toBeDefined();
      expect(docs.sections.errorHandling).toBeDefined();
    });

    test('should include custom options', () => {
      const parsedCode = { routes: [], models: [], middleware: [] };
      const options = {
        title: 'Custom Integration Guide',
        version: '2.0.0'
      };

      const docs = updater.generate(parsedCode, options);

      expect(docs.title).toBe('Custom Integration Guide');
      expect(docs.version).toBe('2.0.0');
    });

    test('should generate getting started section', () => {
      const parsedCode = { routes: [], models: [], middleware: [] };
      const docs = updater.generate(parsedCode);

      expect(docs.sections.gettingStarted.title).toBe('Getting Started');
      expect(docs.sections.gettingStarted.content).toBeDefined();
      expect(docs.sections.gettingStarted.baseURL).toBeDefined();
    });

    test('should generate authentication section with auth middleware', () => {
      const parsedCode = {
        routes: [],
        models: [],
        middleware: [
          { name: 'authenticate', async: true }
        ]
      };

      const docs = updater.generate(parsedCode);

      expect(docs.sections.authentication.required).toBe(true);
      expect(docs.sections.authentication.type).toBe('Bearer Token');
    });

    test('should generate authentication section without auth middleware', () => {
      const parsedCode = {
        routes: [],
        models: [],
        middleware: []
      };

      const docs = updater.generate(parsedCode);

      expect(docs.sections.authentication.required).toBe(false);
    });

    test('should generate endpoints section', () => {
      const parsedCode = {
        routes: [
          { method: 'GET', path: '/api/users', handler: 'getAllUsers', middleware: ['authenticate'] },
          { method: 'POST', path: '/api/users', handler: 'createUser', middleware: [] }
        ],
        models: [],
        middleware: []
      };

      const docs = updater.generate(parsedCode);

      expect(docs.sections.endpoints.endpoints.length).toBe(2);
      expect(docs.sections.endpoints.endpoints[0].requiresAuth).toBe(true);
      expect(docs.sections.endpoints.endpoints[1].requiresAuth).toBe(false);
    });

    test('should generate models section', () => {
      const parsedCode = {
        routes: [],
        models: [
          {
            name: 'UserSchema',
            type: 'schema',
            fields: [
              { name: 'name', type: 'String', required: true },
              { name: 'age', type: 'Number', required: false }
            ]
          }
        ],
        middleware: []
      };

      const docs = updater.generate(parsedCode);

      expect(docs.sections.models.models.length).toBe(1);
      expect(docs.sections.models.models[0].name).toBe('User');
      expect(docs.sections.models.models[0].fields.length).toBe(2);
    });

    test('should generate error handling section', () => {
      const parsedCode = { routes: [], models: [], middleware: [] };
      const docs = updater.generate(parsedCode);

      expect(docs.sections.errorHandling.commonErrors).toBeDefined();
      expect(docs.sections.errorHandling.commonErrors.length).toBeGreaterThan(0);
      expect(docs.sections.errorHandling.errorFormat).toBeDefined();
    });
  });

  describe('Documentation Updates', () => {
    test('should update docs with route additions', () => {
      const existingDocs = {
        version: '1.0.0',
        sections: {}
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

      const parsedCode = { routes: [], models: [], middleware: [] };

      const updatedDocs = updater.update(existingDocs, changes, parsedCode);

      expect(updatedDocs.changes.length).toBe(1);
      expect(updatedDocs.changes[0].type).toBe('endpoint_added');
      expect(updatedDocs.changes[0].severity).toBe('addition');
    });

    test('should update docs with route removals', () => {
      const existingDocs = {
        version: '1.0.0',
        sections: {}
      };

      const changes = {
        breaking: [
          {
            type: 'route_removed',
            category: 'routes',
            oldValue: { method: 'DELETE', path: '/api/users/:id' }
          }
        ]
      };

      const parsedCode = { routes: [], models: [], middleware: [] };

      const updatedDocs = updater.update(existingDocs, changes, parsedCode);

      expect(updatedDocs.changes.length).toBe(1);
      expect(updatedDocs.changes[0].type).toBe('endpoint_removed');
      expect(updatedDocs.changes[0].severity).toBe('breaking');
    });

    test('should update auth documentation for auth changes', () => {
      const existingDocs = {
        version: '1.0.0',
        sections: {}
      };

      const changes = {
        breaking: [
          {
            type: 'route_middleware_removed',
            category: 'routes',
            removed: ['authenticate'],
            route: 'GET /api/users'
          }
        ]
      };

      const parsedCode = { routes: [], models: [], middleware: [] };

      const updatedDocs = updater.update(existingDocs, changes, parsedCode);

      expect(updatedDocs.changes.length).toBe(1);
      expect(updatedDocs.changes[0].type).toBe('authentication_changed');
      expect(updatedDocs.changes[0].severity).toBe('critical');
    });

    test('should include lastUpdated timestamp', () => {
      const existingDocs = { version: '1.0.0', sections: {} };
      const changes = { additions: [] };
      const parsedCode = { routes: [], models: [], middleware: [] };

      const updatedDocs = updater.update(existingDocs, changes, parsedCode);

      expect(updatedDocs.lastUpdated).toBeDefined();
      expect(new Date(updatedDocs.lastUpdated)).toBeInstanceOf(Date);
    });
  });

  describe('Migration Guides', () => {
    test('should generate migration guide for breaking changes', () => {
      const existingDocs = { version: '1.0.0', sections: {} };

      const changes = {
        breaking: [
          {
            type: 'route_removed',
            category: 'routes',
            message: 'Route removed: GET /api/users',
            impact: 'Clients will receive 404',
            oldValue: { method: 'GET', path: '/api/users' }
          }
        ]
      };

      const parsedCode = { routes: [], models: [], middleware: [] };

      const updatedDocs = updater.update(existingDocs, changes, parsedCode);

      expect(updatedDocs.migrations.length).toBe(1);
      expect(updatedDocs.migrations[0].breakingChanges.length).toBe(1);
      expect(updatedDocs.migrations[0].steps.length).toBeGreaterThan(0);
    });

    test('should generate migration steps for route changes', () => {
      const existingDocs = { version: '1.0.0', sections: {} };

      const changes = {
        breaking: [
          {
            type: 'route_removed',
            category: 'routes',
            message: 'Route removed',
            impact: 'Breaking change',
            oldValue: { method: 'GET', path: '/api/users' }
          }
        ]
      };

      const parsedCode = { routes: [], models: [], middleware: [] };

      const updatedDocs = updater.update(existingDocs, changes, parsedCode);

      const migration = updatedDocs.migrations[0];
      expect(migration.steps[0].description).toContain('Remove calls to');
      expect(migration.steps[0].code).toBeDefined();
    });

    test('should generate migration steps for model changes', () => {
      const existingDocs = { version: '1.0.0', sections: {} };

      const changes = {
        breaking: [
          {
            type: 'field_removed',
            category: 'models',
            message: 'Field removed',
            model: 'UserSchema',
            field: 'email'
          }
        ]
      };

      const parsedCode = { routes: [], models: [], middleware: [] };

      const updatedDocs = updater.update(existingDocs, changes, parsedCode);

      const migration = updatedDocs.migrations[0];
      expect(migration.steps[0].description).toContain('Update UserSchema');
      expect(migration.steps[0].field).toBe('email');
    });

    test('should not generate migration for non-breaking changes', () => {
      const existingDocs = { version: '1.0.0', sections: {} };

      const changes = {
        nonBreaking: [
          { type: 'route_handler_changed', category: 'routes' }
        ]
      };

      const parsedCode = { routes: [], models: [], middleware: [] };

      const updatedDocs = updater.update(existingDocs, changes, parsedCode);

      expect(updatedDocs.migrations.length).toBe(0);
    });
  });

  describe('Deprecation Notices', () => {
    test('should add deprecation notice for removed routes', () => {
      const existingDocs = { version: '1.0.0', sections: {} };

      const changes = {
        breaking: [
          {
            type: 'route_removed',
            category: 'routes',
            oldValue: { method: 'GET', path: '/api/users' }
          }
        ]
      };

      const parsedCode = { routes: [], models: [], middleware: [] };

      const updatedDocs = updater.update(existingDocs, changes, parsedCode);

      expect(updatedDocs.deprecations.length).toBe(1);
      expect(updatedDocs.deprecations[0].type).toBe('endpoint');
      expect(updatedDocs.deprecations[0].deprecatedIn).toBe('1.0.0');
      expect(updatedDocs.deprecations[0].removedIn).toBe('2.0.0');
    });
  });

  describe('Code Example Generation', () => {
    test('should generate JavaScript example', () => {
      const route = {
        method: 'GET',
        path: '/api/users',
        middleware: []
      };

      const example = updater.generateJavaScriptExample(route);

      expect(example).toContain('fetch');
      expect(example).toContain('GET');
      expect(example).toContain('/api/users');
    });

    test('should include auth in JavaScript example', () => {
      const route = {
        method: 'GET',
        path: '/api/users',
        middleware: ['authenticate']
      };

      const example = updater.generateJavaScriptExample(route);

      expect(example).toContain('Authorization');
      expect(example).toContain('Bearer');
    });

    test('should include body for POST in JavaScript example', () => {
      const route = {
        method: 'POST',
        path: '/api/users',
        middleware: []
      };

      const example = updater.generateJavaScriptExample(route);

      expect(example).toContain('body: JSON.stringify');
    });

    test('should generate cURL example', () => {
      const route = {
        method: 'GET',
        path: '/api/users',
        middleware: []
      };

      const example = updater.generateCurlExample(route);

      expect(example).toContain('curl');
      expect(example).toContain('-X GET');
      expect(example).toContain('/api/users');
    });

    test('should include auth in cURL example', () => {
      const route = {
        method: 'GET',
        path: '/api/users',
        middleware: ['authenticate']
      };

      const example = updater.generateCurlExample(route);

      expect(example).toContain('Authorization: Bearer');
    });

    test('should include body for POST in cURL example', () => {
      const route = {
        method: 'POST',
        path: '/api/users',
        middleware: []
      };

      const example = updater.generateCurlExample(route);

      expect(example).toContain('-d');
    });

    test('should generate Python example', () => {
      const route = {
        method: 'GET',
        path: '/api/users',
        middleware: []
      };

      const example = updater.generatePythonExample(route);

      expect(example).toContain('import requests');
      expect(example).toContain('requests.get');
    });

    test('should include auth in Python example', () => {
      const route = {
        method: 'POST',
        path: '/api/users',
        middleware: ['authenticate']
      };

      const example = updater.generatePythonExample(route);

      expect(example).toContain('headers');
      expect(example).toContain('Authorization');
    });

    test('should add code examples to updated docs', () => {
      const existingDocs = { version: '1.0.0', sections: {} };

      const changes = {
        additions: [
          {
            type: 'route_added',
            category: 'routes',
            newValue: { method: 'GET', path: '/api/users', middleware: [] }
          }
        ]
      };

      const parsedCode = { routes: [], models: [], middleware: [] };

      const updatedDocs = updater.update(existingDocs, changes, parsedCode);

      expect(updatedDocs.sections.codeExamples).toBeDefined();
      expect(updatedDocs.sections.codeExamples.length).toBe(1);
      expect(updatedDocs.sections.codeExamples[0].examples.javascript).toBeDefined();
      expect(updatedDocs.sections.codeExamples[0].examples.curl).toBeDefined();
      expect(updatedDocs.sections.codeExamples[0].examples.python).toBeDefined();
    });
  });

  describe('Helper Methods', () => {
    test('should extract parameters from path', () => {
      const params = updater.extractParameters('/api/users/:id');

      expect(params.length).toBe(1);
      expect(params[0].name).toBe('id');
      expect(params[0].type).toBe('path');
      expect(params[0].required).toBe(true);
    });

    test('should extract multiple parameters', () => {
      const params = updater.extractParameters('/api/users/:userId/posts/:postId');

      expect(params.length).toBe(2);
      expect(params[0].name).toBe('userId');
      expect(params[1].name).toBe('postId');
    });

    test('should handle paths with no parameters', () => {
      const params = updater.extractParameters('/api/users');

      expect(params.length).toBe(0);
    });

    test('should generate model example', () => {
      const model = {
        name: 'UserSchema',
        fields: [
          { name: 'name', type: 'String' },
          { name: 'age', type: 'Number' },
          { name: 'active', type: 'Boolean' }
        ]
      };

      const example = updater.generateModelExample(model);

      expect(example.name).toBe('example string');
      expect(example.age).toBe(123);
      expect(example.active).toBe(true);
    });

    test('should generate endpoint usage description', () => {
      expect(updater.generateEndpointUsage({ method: 'GET', path: '/api/users' }))
        .toContain('Retrieve');
      expect(updater.generateEndpointUsage({ method: 'POST', path: '/api/users' }))
        .toContain('Create');
      expect(updater.generateEndpointUsage({ method: 'PUT', path: '/api/users' }))
        .toContain('Update');
      expect(updater.generateEndpointUsage({ method: 'DELETE', path: '/api/users' }))
        .toContain('Delete');
    });

    test('should get example values for types', () => {
      expect(updater.getExampleValue('String')).toBe('example string');
      expect(updater.getExampleValue('Number')).toBe(123);
      expect(updater.getExampleValue('Boolean')).toBe(true);
      expect(updater.getExampleValue('Date')).toContain('2024');
      expect(updater.getExampleValue('ObjectId')).toHaveLength(24);
    });

    test('should bump version correctly', () => {
      expect(updater.bumpVersion('1.0.0', 'major')).toBe('2.0.0');
      expect(updater.bumpVersion('1.2.3', 'minor')).toBe('1.3.0');
      expect(updater.bumpVersion('1.2.3', 'patch')).toBe('1.2.4');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty changes', () => {
      const existingDocs = { version: '1.0.0', sections: {} };
      const changes = { breaking: [], additions: [], nonBreaking: [] };
      const parsedCode = { routes: [], models: [], middleware: [] };

      const updatedDocs = updater.update(existingDocs, changes, parsedCode);

      expect(updatedDocs.changes.length).toBe(0);
      expect(updatedDocs.migrations.length).toBe(0);
    });

    test('should handle missing oldValue in changes', () => {
      const existingDocs = { version: '1.0.0', sections: {} };
      const changes = {
        breaking: [
          { type: 'route_removed', category: 'routes' }
        ]
      };
      const parsedCode = { routes: [], models: [], middleware: [] };

      const updatedDocs = updater.update(existingDocs, changes, parsedCode);

      expect(updatedDocs).toBeDefined();
    });

    test('should handle routes without middleware', () => {
      const route = {
        method: 'GET',
        path: '/api/public'
      };

      const example = updater.generateJavaScriptExample(route);

      expect(example).toBeDefined();
      expect(example).not.toContain('Authorization');
    });
  });
});
