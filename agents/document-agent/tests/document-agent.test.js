import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { getDocumentAgent } from '../document-agent.js';
import { getDocumentCache } from '../cache/DocumentCache.js';

/**
 * Document Agent Tests
 *
 * Tests the main DocumentAgent orchestrator class:
 * - Initialization
 * - EventBus integration
 * - Code → Docs pipeline
 * - Docs → Code pipeline
 * - Document validation
 * - Conflict detection
 * - Error handling
 */
describe('DocumentAgent', () => {
  let agent;
  let cache;

  beforeEach(async () => {
    agent = getDocumentAgent();
    cache = getDocumentCache();
    await cache.clearAll();
  });

  afterEach(async () => {
    await cache.clearAll();
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      await agent.initialize();

      expect(agent.initialized).toBe(true);
      expect(agent.logger).toBeDefined();
      expect(agent.cache).toBeDefined();
    });

    test('should not re-initialize if already initialized', async () => {
      await agent.initialize();
      const firstInit = agent.initialized;

      await agent.initialize();
      const secondInit = agent.initialized;

      expect(firstInit).toBe(true);
      expect(secondInit).toBe(true);
    });

    test('should initialize all parsers', async () => {
      await agent.initialize();

      expect(agent.apiParser.initialized).toBe(true);
      expect(agent.backendCodeParser.initialized).toBe(true);
    });

    test('should initialize cache', async () => {
      await agent.initialize();

      expect(cache.initialized).toBe(true);
    });
  });

  describe('Component Integration', () => {
    test('should have all code parsers integrated', () => {
      expect(agent.backendCodeParser).toBeDefined();
      expect(agent.documentVersioner).toBeDefined();
      expect(agent.breakingChangeDetector).toBeDefined();
      expect(agent.impactAnalyzer).toBeDefined();
      expect(agent.openAPIUpdater).toBeDefined();
      expect(agent.changelogUpdater).toBeDefined();
      expect(agent.integrationDocsUpdater).toBeDefined();
      expect(agent.conflictDetector).toBeDefined();
    });

    test('should have all docs parsers integrated', () => {
      expect(agent.apiParser).toBeDefined();
      expect(agent.featureParser).toBeDefined();
      expect(agent.architectureParser).toBeDefined();
      expect(agent.reactParser).toBeDefined();
      expect(agent.flutterParser).toBeDefined();
    });

    test('should have all digest generators integrated', () => {
      expect(agent.backendDigest).toBeDefined();
      expect(agent.adminDigest).toBeDefined();
      expect(agent.userDigest).toBeDefined();
      expect(agent.driverDigest).toBeDefined();
    });

    test('should have validators integrated', () => {
      expect(agent.documentValidator).toBeDefined();
      expect(agent.digestValidator).toBeDefined();
    });

    test('should have cache integrated', () => {
      expect(agent.cache).toBeDefined();
    });
  });

  describe('EventBus Integration', () => {
    test('should have EventBus reference if available', () => {
      // EventBus may not be available in test environment
      if (agent.eventBus) {
        expect(agent.eventBus).toBeDefined();
        expect(agent.EventTypes).toBeDefined();
      }
    });

    test('should handle missing EventBus gracefully', () => {
      // Agent should work even without EventBus
      expect(() => {
        const testAgent = getDocumentAgent();
        expect(testAgent).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('updateDocsFromCode() - Code → Docs Pipeline', () => {
    test('should handle empty file list', async () => {
      await agent.initialize();

      const results = await agent.updateDocsFromCode({
        files: [],
        agent: 'test-agent'
      });

      expect(results).toBeDefined();
      expect(results.parsed).toBe(0);
      expect(results.updated).toBe(0);
      expect(results.breakingChanges).toEqual([]);
      expect(results.conflicts).toEqual([]);
      expect(results.updatedFiles).toEqual([]);
    });

    test('should initialize if not already initialized', async () => {
      expect(agent.initialized).toBe(false);

      await agent.updateDocsFromCode({
        files: ['test.js'],
        agent: 'test-agent'
      });

      expect(agent.initialized).toBe(true);
    });

    test('should return proper structure', async () => {
      await agent.initialize();

      const results = await agent.updateDocsFromCode({
        files: [],
        agent: 'test-agent'
      });

      expect(results).toHaveProperty('parsed');
      expect(results).toHaveProperty('updated');
      expect(results).toHaveProperty('breakingChanges');
      expect(results).toHaveProperty('conflicts');
      expect(results).toHaveProperty('updatedFiles');
    });
  });

  describe('parseDocumentation() - Docs → Code Pipeline', () => {
    test('should initialize if not already initialized', async () => {
      expect(agent.initialized).toBe(false);

      await agent.parseDocumentation([]);

      expect(agent.initialized).toBe(true);
    });

    test('should return proper structure', async () => {
      await agent.initialize();

      const results = await agent.parseDocumentation([]);

      expect(results).toHaveProperty('parsedDocs');
      expect(results).toHaveProperty('digests');
      expect(results).toHaveProperty('validation');

      expect(results.parsedDocs).toHaveProperty('api');
      expect(results.parsedDocs).toHaveProperty('architecture');
      expect(results.parsedDocs).toHaveProperty('features');
      expect(results.parsedDocs).toHaveProperty('react');
      expect(results.parsedDocs).toHaveProperty('flutter');

      expect(results.digests).toHaveProperty('backend');
      expect(results.digests).toHaveProperty('admin');
      expect(results.digests).toHaveProperty('users');
      expect(results.digests).toHaveProperty('drivers');
    });

    test('should handle empty doc paths', async () => {
      await agent.initialize();

      const results = await agent.parseDocumentation([]);

      expect(results.parsedDocs.api).toBeNull();
      expect(results.parsedDocs.architecture).toBeNull();
      expect(results.parsedDocs.features).toBeNull();
    });
  });

  describe('generateDigests()', () => {
    test('should generate digests from parsed docs', async () => {
      await agent.initialize();

      const parsedDocs = {
        api: {
          endpoints: [
            { method: 'GET', path: '/api/users', summary: 'Get users' }
          ],
          models: [
            { name: 'User', type: 'object' }
          ]
        },
        architecture: null,
        features: null,
        react: null,
        flutter: null
      };

      const digests = await agent.generateDigests(parsedDocs);

      expect(digests).toHaveProperty('backend');
      expect(digests).toHaveProperty('admin');
      expect(digests).toHaveProperty('users');
      expect(digests).toHaveProperty('drivers');
    });

    test('should generate backend digest when API docs present', async () => {
      await agent.initialize();

      const parsedDocs = {
        api: {
          endpoints: [
            { method: 'GET', path: '/api/users', summary: 'Get users' }
          ]
        },
        architecture: null,
        features: null,
        react: null,
        flutter: null
      };

      const digests = await agent.generateDigests(parsedDocs);

      expect(digests.backend).toBeDefined();
      expect(digests.backend.platform).toBe('backend');
      expect(digests.backend.routes).toBeDefined();
    });

    test('should handle null parsed docs', async () => {
      await agent.initialize();

      const parsedDocs = {
        api: null,
        architecture: null,
        features: null,
        react: null,
        flutter: null
      };

      const digests = await agent.generateDigests(parsedDocs);

      expect(digests.backend).toBeNull();
      expect(digests.admin).toBeNull();
      expect(digests.users).toBeNull();
      expect(digests.drivers).toBeNull();
    });
  });

  describe('validateDocumentation()', () => {
    test('should validate documents', async () => {
      await agent.initialize();

      const documents = [
        {
          type: 'api',
          content: '# API\n\n## Overview\nTest API',
          metadata: { title: 'Test API' }
        }
      ];

      const results = await agent.validateDocumentation(documents);

      expect(results).toHaveProperty('total');
      expect(results).toHaveProperty('passed');
      expect(results).toHaveProperty('failed');
      expect(results).toHaveProperty('details');
      expect(results.total).toBe(1);
    });

    test('should handle empty document list', async () => {
      await agent.initialize();

      const results = await agent.validateDocumentation([]);

      expect(results.total).toBe(0);
      expect(results.passed).toBe(0);
      expect(results.failed).toBe(0);
      expect(results.details).toEqual([]);
    });

    test('should count passed and failed documents', async () => {
      await agent.initialize();

      const documents = [
        {
          type: 'api',
          content: `# API Title
## Overview
Description
## Authentication
Auth details
## Endpoints
### GET /api/test
Test endpoint
## Error Handling
Errors`,
          metadata: { title: 'Good API Doc' }
        },
        {
          type: 'api',
          content: '# Bad Doc',
          metadata: { title: 'Bad Doc' }
        }
      ];

      const results = await agent.validateDocumentation(documents);

      expect(results.total).toBe(2);
      expect(results.passed + results.failed).toBe(2);
    });
  });

  describe('detectConflicts()', () => {
    test('should detect conflicts between code and docs', async () => {
      await agent.initialize();

      const results = await agent.detectConflicts([], []);

      expect(results).toHaveProperty('conflicts');
      expect(results).toHaveProperty('codeStructure');
      expect(results).toHaveProperty('parsedDocs');
    });

    test('should handle empty file lists', async () => {
      await agent.initialize();

      const results = await agent.detectConflicts([], []);

      expect(results.conflicts).toBeDefined();
      expect(Array.isArray(results.conflicts)).toBe(true);
    });
  });

  describe('Cache Management', () => {
    test('should clear cache', async () => {
      await agent.initialize();

      // Add something to cache
      await cache.set('test-key', { data: 'test' });

      // Clear cache
      await agent.clearCache();

      // Verify cache is empty
      const stats = agent.getCacheStats();
      expect(stats.entries).toBe(0);
    });

    test('should get cache statistics', async () => {
      await agent.initialize();

      const stats = agent.getCacheStats();

      expect(stats).toHaveProperty('entries');
      expect(stats).toHaveProperty('totalSizeBytes');
      expect(stats).toHaveProperty('cacheDir');
      expect(typeof stats.entries).toBe('number');
    });
  });

  describe('Error Handling', () => {
    test('should handle parse errors gracefully', async () => {
      await agent.initialize();

      // Try to parse non-existent file
      await expect(
        agent.parseDocumentation(['/non/existent/file.md'])
      ).rejects.toThrow();
    });

    test('should handle invalid document structure', async () => {
      await agent.initialize();

      const invalidDoc = {
        // Missing required fields
        content: null,
        metadata: null
      };

      await expect(
        agent.validateDocumentation([invalidDoc])
      ).rejects.toThrow();
    });
  });

  describe('Singleton Pattern', () => {
    test('should return same instance', () => {
      const agent1 = getDocumentAgent();
      const agent2 = getDocumentAgent();

      expect(agent1).toBe(agent2);
    });
  });
});
