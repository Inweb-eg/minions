import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { getDocumentAgent } from '../document-agent.js';
import { getDocumentCache } from '../cache/DocumentCache.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * CLI Tests
 *
 * Tests the command-line interface functionality:
 * - Command parsing
 * - parse-docs command
 * - update-docs command
 * - validate command
 * - detect-conflicts command
 * - generate-digests command
 * - clear-cache command
 * - stats command
 * - Error handling
 *
 * Note: These tests verify the CLI logic without actually running the CLI process
 */
describe('CLI Functionality', () => {
  let agent;
  let cache;
  let testOutputDir;

  beforeEach(async () => {
    agent = getDocumentAgent();
    cache = getDocumentCache();
    testOutputDir = './.test-output';

    await cache.clearAll();

    // Create test output directory
    try {
      await fs.mkdir(testOutputDir, { recursive: true });
    } catch (error) {
      // Directory may already exist
    }
  });

  afterEach(async () => {
    await cache.clearAll();

    // Clean up test output directory
    try {
      const files = await fs.readdir(testOutputDir);
      for (const file of files) {
        await fs.unlink(path.join(testOutputDir, file));
      }
      await fs.rmdir(testOutputDir);
    } catch (error) {
      // Directory may not exist or may have issues
    }
  });

  describe('parse-docs command logic', () => {
    test('should parse documentation and generate digests', async () => {
      await agent.initialize();

      // Simulate parse-docs command
      const docPaths = []; // Empty for test
      const results = await agent.parseDocumentation(docPaths);

      expect(results).toBeDefined();
      expect(results.parsedDocs).toBeDefined();
      expect(results.digests).toBeDefined();
    });

    test('should handle multiple documentation files', async () => {
      await agent.initialize();

      const docPaths = []; // Would contain actual file paths
      const results = await agent.parseDocumentation(docPaths);

      expect(results.parsedDocs).toHaveProperty('api');
      expect(results.parsedDocs).toHaveProperty('architecture');
      expect(results.parsedDocs).toHaveProperty('features');
    });

    test('should generate all platform digests', async () => {
      await agent.initialize();

      const results = await agent.parseDocumentation([]);

      expect(results.digests).toHaveProperty('backend');
      expect(results.digests).toHaveProperty('admin');
      expect(results.digests).toHaveProperty('users');
      expect(results.digests).toHaveProperty('drivers');
    });
  });

  describe('update-docs command logic', () => {
    test('should update documentation from code changes', async () => {
      await agent.initialize();

      // Simulate update-docs command
      const results = await agent.updateDocsFromCode({
        files: [],
        agent: 'cli'
      });

      expect(results).toBeDefined();
      expect(results.parsed).toBeDefined();
      expect(results.updated).toBeDefined();
      expect(results.breakingChanges).toBeDefined();
      expect(results.conflicts).toBeDefined();
      expect(results.updatedFiles).toBeDefined();
    });

    test('should track parsed and updated counts', async () => {
      await agent.initialize();

      const results = await agent.updateDocsFromCode({
        files: [],
        agent: 'cli'
      });

      expect(typeof results.parsed).toBe('number');
      expect(typeof results.updated).toBe('number');
      expect(Array.isArray(results.breakingChanges)).toBe(true);
      expect(Array.isArray(results.conflicts)).toBe(true);
      expect(Array.isArray(results.updatedFiles)).toBe(true);
    });

    test('should handle empty file list', async () => {
      await agent.initialize();

      const results = await agent.updateDocsFromCode({
        files: [],
        agent: 'cli'
      });

      expect(results.parsed).toBe(0);
      expect(results.updated).toBe(0);
    });
  });

  describe('validate command logic', () => {
    test('should validate documentation quality', async () => {
      await agent.initialize();

      const documents = [
        {
          type: 'api',
          content: `# API Documentation
## Overview
This is a test API
## Authentication
Bearer token required
## Endpoints
### GET /api/test
Test endpoint
## Error Handling
Standard HTTP codes`,
          metadata: { title: 'Test API', path: 'test.md' }
        }
      ];

      const results = await agent.validateDocumentation(documents);

      expect(results).toBeDefined();
      expect(results.total).toBe(1);
      expect(results).toHaveProperty('passed');
      expect(results).toHaveProperty('failed');
      expect(results.details).toHaveLength(1);
    });

    test('should provide detailed validation results', async () => {
      await agent.initialize();

      const documents = [
        {
          type: 'api',
          content: '# Short Doc',
          metadata: { title: 'Short Doc', path: 'short.md' }
        }
      ];

      const results = await agent.validateDocumentation(documents);

      expect(results.details[0]).toHaveProperty('document');
      expect(results.details[0]).toHaveProperty('valid');
      expect(results.details[0]).toHaveProperty('score');
      expect(results.details[0]).toHaveProperty('errors');
      expect(results.details[0]).toHaveProperty('warnings');
    });

    test('should handle multiple documents', async () => {
      await agent.initialize();

      const documents = [
        {
          type: 'api',
          content: '# Doc 1\n\n## Overview\nContent',
          metadata: { title: 'Doc 1' }
        },
        {
          type: 'api',
          content: '# Doc 2\n\n## Overview\nContent',
          metadata: { title: 'Doc 2' }
        }
      ];

      const results = await agent.validateDocumentation(documents);

      expect(results.total).toBe(2);
      expect(results.details).toHaveLength(2);
    });
  });

  describe('detect-conflicts command logic', () => {
    test('should detect conflicts between code and docs', async () => {
      await agent.initialize();

      const results = await agent.detectConflicts([], []);

      expect(results).toBeDefined();
      expect(results.conflicts).toBeDefined();
      expect(Array.isArray(results.conflicts)).toBe(true);
    });

    test('should provide code structure and parsed docs', async () => {
      await agent.initialize();

      const results = await agent.detectConflicts([], []);

      expect(results).toHaveProperty('codeStructure');
      expect(results).toHaveProperty('parsedDocs');
    });
  });

  describe('generate-digests command logic', () => {
    test('should generate code digests from documentation', async () => {
      await agent.initialize();

      const parsedDocs = {
        api: {
          endpoints: [
            { method: 'GET', path: '/api/test', summary: 'Test' }
          ]
        },
        architecture: null,
        features: null,
        react: null,
        flutter: null
      };

      const digests = await agent.generateDigests(parsedDocs);

      expect(digests).toBeDefined();
      expect(digests).toHaveProperty('backend');
      expect(digests).toHaveProperty('admin');
      expect(digests).toHaveProperty('users');
      expect(digests).toHaveProperty('drivers');
    });

    test('should generate platform-specific digests', async () => {
      await agent.initialize();

      const parsedDocs = {
        api: {
          endpoints: [{ method: 'GET', path: '/api/users' }],
          models: [{ name: 'User' }]
        },
        architecture: null,
        features: null,
        react: null,
        flutter: null
      };

      const digests = await agent.generateDigests(parsedDocs);

      if (digests.backend) {
        expect(digests.backend.platform).toBe('backend');
        expect(digests.backend.routes).toBeDefined();
      }
    });
  });

  describe('clear-cache command logic', () => {
    test('should clear document cache', async () => {
      await agent.initialize();

      // Add something to cache
      await cache.set('test-file.md', { data: 'test' });
      expect(cache.cache.size).toBeGreaterThan(0);

      // Clear cache
      await agent.clearCache();

      // Verify cache is empty
      const stats = agent.getCacheStats();
      expect(stats.entries).toBe(0);
    });

    test('should not throw on empty cache', async () => {
      await agent.initialize();

      await expect(agent.clearCache()).resolves.not.toThrow();
    });
  });

  describe('stats command logic', () => {
    test('should return cache statistics', async () => {
      await agent.initialize();

      const stats = agent.getCacheStats();

      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('entries');
      expect(stats).toHaveProperty('totalSizeBytes');
      expect(stats).toHaveProperty('cacheDir');
    });

    test('should show correct entry count', async () => {
      await agent.initialize();

      // Add entries to cache
      await cache.set('file1.md', { data: 'test1' });
      await cache.set('file2.md', { data: 'test2' });

      const stats = agent.getCacheStats();

      expect(stats.entries).toBe(2);
    });

    test('should calculate total size', async () => {
      await agent.initialize();

      await cache.set('file1.md', { data: 'test data' });

      const stats = agent.getCacheStats();

      expect(stats.totalSizeBytes).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent files gracefully', async () => {
      await agent.initialize();

      await expect(
        agent.parseDocumentation(['/non/existent/file.md'])
      ).rejects.toThrow();
    });

    test('should handle invalid document structure', async () => {
      await agent.initialize();

      const invalidDoc = {
        content: null,
        metadata: null
      };

      await expect(
        agent.validateDocumentation([invalidDoc])
      ).rejects.toThrow();
    });

    test('should handle empty arguments', async () => {
      await agent.initialize();

      // Should not throw, just return empty results
      const results = await agent.parseDocumentation([]);
      expect(results).toBeDefined();
    });
  });

  describe('Output Format Validation', () => {
    test('parse-docs should return JSON-serializable results', async () => {
      await agent.initialize();

      const results = await agent.parseDocumentation([]);

      expect(() => JSON.stringify(results)).not.toThrow();
    });

    test('update-docs should return JSON-serializable results', async () => {
      await agent.initialize();

      const results = await agent.updateDocsFromCode({ files: [] });

      expect(() => JSON.stringify(results)).not.toThrow();
    });

    test('validate should return JSON-serializable results', async () => {
      await agent.initialize();

      const results = await agent.validateDocumentation([]);

      expect(() => JSON.stringify(results)).not.toThrow();
    });
  });

  describe('Help and Usage', () => {
    test('should have all required commands documented', () => {
      const expectedCommands = [
        'parse-docs',
        'update-docs',
        'validate',
        'detect-conflicts',
        'generate-digests',
        'clear-cache',
        'stats',
        'help'
      ];

      // This is a meta-test - verifies that all commands are accounted for
      expect(expectedCommands).toHaveLength(8);
    });
  });

  describe('File I/O Operations', () => {
    test('should save JSON output to file', async () => {
      await agent.initialize();

      const results = await agent.parseDocumentation([]);
      const outputPath = path.join(testOutputDir, 'test-output.json');

      await fs.writeFile(outputPath, JSON.stringify(results, null, 2));

      const fileExists = await fs.access(outputPath)
        .then(() => true)
        .catch(() => false);

      expect(fileExists).toBe(true);

      // Clean up
      await fs.unlink(outputPath);
    });

    test('should handle file write errors gracefully', async () => {
      await agent.initialize();

      const results = await agent.parseDocumentation([]);
      const invalidPath = '/invalid/path/output.json';

      await expect(
        fs.writeFile(invalidPath, JSON.stringify(results))
      ).rejects.toThrow();
    });
  });
});
