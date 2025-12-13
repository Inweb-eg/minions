import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { getBreakingChangeDetector } from '../../parsers/code-parser/breaking-change-detector.js';
import { getOpenAPIUpdater } from '../../parsers/code-parser/openapi-updater.js';
import { getIntegrationDocsUpdater } from '../../parsers/code-parser/integration-docs-updater.js';
import { getChangelogUpdater } from '../../parsers/code-parser/changelog-updater.js';
import { getDocumentCache } from '../../cache/DocumentCache.js';

/**
 * Integration Tests - Phase 2.2 MODE 2 (Code → Docs)
 *
 * Tests the complete pipeline from parsed code to documentation generation:
 * 1. Start with parsed backend code structure (routes, models, services)
 * 2. Detect breaking changes
 * 3. Generate/update OpenAPI specification
 * 4. Generate/update integration documentation
 * 5. Generate/update CHANGELOG
 */
describe('Code → Docs Pipeline Integration', () => {
  let breakingChangeDetector;
  let openAPIUpdater;
  let integrationDocsUpdater;
  let changelogUpdater;
  let cache;

  beforeEach(async () => {
    breakingChangeDetector = getBreakingChangeDetector();
    openAPIUpdater = getOpenAPIUpdater();
    integrationDocsUpdater = getIntegrationDocsUpdater();
    changelogUpdater = getChangelogUpdater();
    cache = getDocumentCache();

    // Initialize only components that have initialize() method
    await openAPIUpdater.initialize();
    await integrationDocsUpdater.initialize();
    await changelogUpdater.initialize();

    // Clear cache for clean test state
    await cache.clearAll();
  });

  afterEach(async () => {
    await cache.clearAll();
  });

  describe('Complete Pipeline - New API Development', () => {
    test('should generate complete documentation suite from new code', () => {
      // Mock parsed code structure (as if from BackendCodeParser)
      const parsedCode = {
        routes: [
          { method: 'GET', path: '/api/users', handler: 'getUsers', middleware: ['authenticate'] },
          { method: 'POST', path: '/api/users', handler: 'createUser', middleware: ['authenticate'] },
          { method: 'GET', path: '/api/users/:id', handler: 'getUser', middleware: ['authenticate'] },
          { method: 'PUT', path: '/api/users/:id', handler: 'updateUser', middleware: ['authenticate'] },
          { method: 'DELETE', path: '/api/users/:id', handler: 'deleteUser', middleware: ['authenticate'] }
        ],
        models: [
          {
            name: 'UserSchema',
            type: 'schema',
            fields: [
              { name: 'username', type: 'String', required: true },
              { name: 'email', type: 'String', required: true },
              { name: 'password', type: 'String', required: true },
              { name: 'role', type: 'String', required: false },
              { name: 'createdAt', type: 'Date', required: false }
            ]
          }
        ]
      };

      // Step 1: Generate OpenAPI specification
      const openAPISpec = openAPIUpdater.generate(parsedCode, {
        title: 'User Management API',
        version: '1.0.0',
        description: 'API for managing users'
      });

      // Validate OpenAPI generation
      expect(openAPISpec.openapi).toBe('3.0.0');
      expect(openAPISpec.info.version).toBe('1.0.0');
      expect(Object.keys(openAPISpec.paths).length).toBeGreaterThan(0);
      expect(openAPISpec.components.schemas.User).toBeDefined();
      // Security schemes should be generated since routes have authenticate middleware
      expect(openAPISpec.components.securitySchemes).toBeDefined();

      // Step 2: Generate integration documentation
      const integrationDocs = integrationDocsUpdater.generate(parsedCode, {
        title: 'User Management API - Integration Guide',
        version: '1.0.0'
      });

      // Validate integration docs generation
      expect(integrationDocs.sections.gettingStarted).toBeDefined();
      expect(integrationDocs.sections.authentication).toBeDefined();
      expect(integrationDocs.sections.endpoints).toBeDefined();
      expect(integrationDocs.sections.models).toBeDefined();
      expect(integrationDocs.sections.codeExamples).toBeDefined();

      // Step 3: Generate CHANGELOG entry
      const changes = {
        additions: parsedCode.routes.map(route => ({
          type: 'route_added',
          category: 'routes',
          message: `Added ${route.method} ${route.path}`,
          newValue: route
        }))
      };

      const changelogEntry = changelogUpdater.generateEntry(changes, {
        version: '1.0.0',
        date: '2024-01-01'
      });

      // Validate CHANGELOG generation
      expect(changelogEntry.version).toBe('1.0.0');
      expect(changelogEntry.sections.added.length).toBe(5);
      expect(changelogEntry.breakingChanges).toHaveLength(0);
    });
  });

  describe('Complete Pipeline - Breaking Changes', () => {
    test('should detect breaking changes and update all documentation', () => {
      // Original parsed code
      const oldParsedCode = {
        routes: [
          { method: 'GET', path: '/api/users', handler: 'getUsers', middleware: [] },
          { method: 'POST', path: '/api/users', handler: 'createUser', middleware: [] },
          { method: 'DELETE', path: '/api/admin/users/:id', handler: 'deleteUser', middleware: ['authenticate'] }
        ],
        models: [
          {
            name: 'UserSchema',
            type: 'schema',
            fields: [
              { name: 'username', type: 'String', required: true },
              { name: 'email', type: 'String', required: true },
              { name: 'age', type: 'Number', required: false }
            ]
          }
        ]
      };

      // New parsed code with breaking changes
      const newParsedCode = {
        routes: [
          { method: 'GET', path: '/api/users', handler: 'getUsers', middleware: ['authenticate'] },
          { method: 'POST', path: '/api/users', handler: 'createUser', middleware: ['authenticate'] }
        ],
        models: [
          {
            name: 'UserSchema',
            type: 'schema',
            fields: [
              { name: 'username', type: 'String', required: true },
              { name: 'email', type: 'String', required: true },
              { name: 'birthDate', type: 'Date', required: true }
            ]
          }
        ]
      };

      // Step 1: Detect breaking changes
      const changes = breakingChangeDetector.detect(oldParsedCode, newParsedCode);

      // Validate breaking change detection
      expect(changes.breaking.length).toBeGreaterThan(0);

      // Should detect removed route
      const removedRoute = changes.breaking.find(c => c.type === 'route_removed');
      expect(removedRoute).toBeDefined();

      // Should detect removed field
      const removedField = changes.breaking.find(c =>
        c.type === 'field_removed' && c.field === 'age'
      );
      expect(removedField).toBeDefined();

      // Should detect required field added
      const requiredFieldAdded = changes.breaking.find(c =>
        c.type === 'required_field_added' && c.field === 'birthDate'
      );
      expect(requiredFieldAdded).toBeDefined();

      // Step 2: Update OpenAPI specification
      const existingOpenAPISpec = openAPIUpdater.generate(oldParsedCode, {
        version: '1.0.0'
      });

      const updatedOpenAPISpec = openAPIUpdater.update(
        existingOpenAPISpec,
        changes,
        newParsedCode
      );

      // Validate OpenAPI update (should bump major version due to breaking changes)
      expect(updatedOpenAPISpec.info.version).toBe('2.0.0');
      expect(updatedOpenAPISpec.paths['/api/admin/users/:id']).toBeUndefined();
      expect(updatedOpenAPISpec.components.schemas.User.properties.age).toBeUndefined();
      expect(updatedOpenAPISpec.components.schemas.User.properties.birthDate).toBeDefined();
      expect(updatedOpenAPISpec.components.schemas.User.required).toContain('birthDate');

      // Step 3: Update integration documentation
      const existingDocs = integrationDocsUpdater.generate(oldParsedCode, {
        version: '1.0.0'
      });

      const updatedDocs = integrationDocsUpdater.update(
        existingDocs,
        changes,
        newParsedCode,
        { version: '2.0.0' }
      );

      // Validate integration docs update
      expect(updatedDocs.version).toBe('2.0.0');
      expect(updatedDocs.changes.length).toBeGreaterThan(0);
      expect(updatedDocs.migrations.length).toBeGreaterThan(0);
      expect(updatedDocs.deprecations.length).toBeGreaterThan(0);

      // Step 4: Update CHANGELOG
      const changelogEntry = changelogUpdater.generateEntry(changes, {
        version: '2.0.0',
        date: '2024-02-01'
      });

      // Validate CHANGELOG update
      expect(changelogEntry.version).toBe('2.0.0');
      expect(changelogEntry.breakingChanges.length).toBeGreaterThan(0);
      expect(changelogEntry.sections.removed.length).toBeGreaterThan(0);
      expect(changelogEntry.sections.changed.length).toBeGreaterThan(0);
      expect(changelogEntry.summary).toContain('breaking changes');
    });
  });

  describe('Complete Pipeline - Non-Breaking Changes', () => {
    test('should handle non-breaking changes with minor version bump', () => {
      // Original parsed code
      const oldParsedCode = {
        routes: [
          { method: 'GET', path: '/api/users', handler: 'getUsers', middleware: ['authenticate'] },
          { method: 'POST', path: '/api/users', handler: 'createUser', middleware: ['authenticate'] }
        ],
        models: [
          {
            name: 'UserSchema',
            type: 'schema',
            fields: [
              { name: 'username', type: 'String', required: true },
              { name: 'email', type: 'String', required: true }
            ]
          }
        ]
      };

      // New parsed code with non-breaking changes
      const newParsedCode = {
        routes: [
          { method: 'GET', path: '/api/users', handler: 'getUsers', middleware: ['authenticate'] },
          { method: 'POST', path: '/api/users', handler: 'createUser', middleware: ['authenticate'] },
          { method: 'GET', path: '/api/users/stats', handler: 'getUserStats', middleware: ['authenticate'] }
        ],
        models: [
          {
            name: 'UserSchema',
            type: 'schema',
            fields: [
              { name: 'username', type: 'String', required: true },
              { name: 'email', type: 'String', required: true },
              { name: 'bio', type: 'String', required: false }
            ]
          }
        ]
      };

      // Step 1: Detect changes
      const changes = breakingChangeDetector.detect(oldParsedCode, newParsedCode);

      // Validate non-breaking changes
      expect(changes.breaking).toHaveLength(0);
      expect(changes.additions.length).toBeGreaterThan(0);

      // Step 2: Update OpenAPI specification (minor version bump)
      const existingOpenAPISpec = openAPIUpdater.generate(oldParsedCode, {
        version: '1.0.0'
      });

      const updatedOpenAPISpec = openAPIUpdater.update(
        existingOpenAPISpec,
        changes,
        newParsedCode
      );

      // Should bump minor version
      expect(updatedOpenAPISpec.info.version).toBe('1.1.0');

      // Step 3: Generate CHANGELOG entry
      const changelogEntry = changelogUpdater.generateEntry(changes, {
        version: '1.1.0',
        date: '2024-01-15'
      });

      // Should have additions but no breaking changes
      expect(changelogEntry.sections.added.length).toBeGreaterThan(0);
      expect(changelogEntry.breakingChanges).toHaveLength(0);
      expect(changelogEntry.summary).not.toContain('breaking');
    });
  });

  describe('Pipeline Performance', () => {
    test('should process large codebase efficiently', () => {
      // Generate large codebase structure
      const routes = [];
      for (let i = 0; i < 100; i++) {
        routes.push({
          method: 'GET',
          path: `/api/resource${i}`,
          handler: `getResource${i}`,
          middleware: ['authenticate']
        });
      }

      const models = [];
      for (let i = 0; i < 50; i++) {
        models.push({
          name: `Model${i}Schema`,
          type: 'schema',
          fields: [
            { name: 'id', type: 'ObjectId', required: true },
            { name: 'name', type: 'String', required: true },
            { name: 'value', type: 'Number', required: false }
          ]
        });
      }

      const parsedCode = { routes, models };

      const startTime = Date.now();

      // Step 1: Generate OpenAPI
      const openAPISpec = openAPIUpdater.generate(parsedCode, {
        version: '1.0.0'
      });

      // Step 2: Generate integration docs
      const integrationDocs = integrationDocsUpdater.generate(parsedCode, {
        version: '1.0.0'
      });

      // Step 3: Generate CHANGELOG
      const changes = {
        additions: routes.map(r => ({
          type: 'route_added',
          category: 'routes',
          newValue: r
        }))
      };
      const changelogEntry = changelogUpdater.generateEntry(changes, {
        version: '1.0.0'
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (less than 2 seconds)
      expect(duration).toBeLessThan(2000);

      // Validate output
      expect(Object.keys(openAPISpec.paths).length).toBeGreaterThan(0);
      expect(Object.keys(openAPISpec.components.schemas).length).toBe(50);
      expect(integrationDocs.sections.endpoints).toBeDefined();
      expect(changelogEntry.sections.added.length).toBe(100);
    });
  });

  describe('Pipeline Error Handling', () => {
    test('should handle empty parsed data', () => {
      const emptyParsedCode = {
        routes: [],
        models: []
      };

      // Should not throw
      expect(() => {
        openAPIUpdater.generate(emptyParsedCode);
      }).not.toThrow();

      expect(() => {
        integrationDocsUpdater.generate(emptyParsedCode);
      }).not.toThrow();
    });

    test('should handle missing fields in parsed data', () => {
      const incompleteParsedCode = {
        routes: [
          { method: 'GET', path: '/test' }
          // Missing handler, middleware
        ],
        models: [
          { name: 'TestSchema' }
          // Missing fields
        ]
      };

      // Should not throw
      expect(() => {
        openAPIUpdater.generate(incompleteParsedCode);
      }).not.toThrow();

      expect(() => {
        integrationDocsUpdater.generate(incompleteParsedCode);
      }).not.toThrow();
    });

    test('should handle empty changes gracefully', () => {
      const emptyChanges = {
        breaking: [],
        nonBreaking: [],
        additions: []
      };

      const changelogEntry = changelogUpdater.generateEntry(emptyChanges, {
        version: '1.0.1'
      });

      expect(changelogEntry.version).toBe('1.0.1');
      expect(changelogEntry.breakingChanges).toHaveLength(0);
      expect(changelogUpdater.countTotalChanges(changelogEntry)).toBe(0);
    });
  });

  describe('Pipeline Consistency', () => {
    test('should maintain consistency across all documentation', () => {
      const parsedCode = {
        routes: [
          {
            method: 'POST',
            path: '/api/orders',
            handler: 'createOrder',
            middleware: ['authenticate', 'validateOrder']
          }
        ],
        models: [
          {
            name: 'OrderSchema',
            type: 'schema',
            fields: [
              { name: 'orderId', type: 'String', required: true },
              { name: 'amount', type: 'Number', required: true },
              { name: 'status', type: 'String', required: true }
            ]
          }
        ]
      };

      // Generate all documentation
      const openAPISpec = openAPIUpdater.generate(parsedCode, { version: '1.0.0' });
      const integrationDocs = integrationDocsUpdater.generate(parsedCode, { version: '1.0.0' });
      const changes = {
        additions: [
          {
            type: 'route_added',
            category: 'routes',
            newValue: parsedCode.routes[0]
          }
        ]
      };
      const changelogEntry = changelogUpdater.generateEntry(changes, { version: '1.0.0' });

      // Verify consistency - same version across all docs
      expect(openAPISpec.info.version).toBe('1.0.0');
      expect(integrationDocs.version).toBe('1.0.0');
      expect(changelogEntry.version).toBe('1.0.0');

      // Verify consistency - same endpoint in all docs
      expect(openAPISpec.paths['/api/orders'].post).toBeDefined();
      expect(integrationDocs.sections.endpoints).toBeDefined();
      expect(changelogEntry.sections.added.some(item =>
        item.description.includes('/api/orders')
      )).toBe(true);

      // Verify consistency - same model in all docs
      expect(openAPISpec.components.schemas.Order).toBeDefined();
      expect(openAPISpec.components.schemas.Order.properties.orderId).toBeDefined();
      expect(openAPISpec.components.schemas.Order.properties.amount).toBeDefined();
      expect(openAPISpec.components.schemas.Order.properties.status).toBeDefined();
    });
  });
});
