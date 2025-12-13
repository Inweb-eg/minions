import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import APIParser, { getAPIParser } from '../../parsers/docs-parser/api-parser.js';
import { getDocumentCache } from '../../cache/DocumentCache.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('APIParser', () => {
  let parser;
  let cache;
  const fixturesDir = path.join(__dirname, '../fixtures');
  const testOpenAPIFile = path.join(fixturesDir, 'test-api.yaml');
  const testMarkdownFile = path.join(fixturesDir, 'test-api.md');

  beforeEach(async () => {
    parser = new APIParser();
    await parser.initialize();
    cache = getDocumentCache();
    // Clear cache before each test
    await cache.clearAll();
  });

  afterEach(async () => {
    // Clean up cache after tests
    await cache.clearAll();
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      const newParser = new APIParser();
      await newParser.initialize();
      expect(newParser.initialized).toBe(true);
    });

    test('should initialize cache', async () => {
      expect(cache.initialized).toBe(true);
    });

    test('should get singleton instance', () => {
      const instance1 = getAPIParser();
      const instance2 = getAPIParser();
      expect(instance1).toBe(instance2);
    });
  });

  describe('OpenAPI Parsing', () => {
    test('should parse OpenAPI YAML spec successfully', async () => {
      const result = await parser.parseOpenAPI(testOpenAPIFile);

      expect(result).toBeDefined();
      expect(result.type).toBe('openapi');
      expect(result.version).toBe('3.0.0');
      expect(result.title).toBe('TukTuk Test API');
      expect(result.description).toContain('Test API');
      expect(result.apiVersion).toBe('1.0.0');
    });

    test('should extract base URL correctly', async () => {
      const result = await parser.parseOpenAPI(testOpenAPIFile);
      expect(result.baseUrl).toBe('https://api.tuktuk.baghdad/v1');
    });

    test('should extract security schemes', async () => {
      const result = await parser.parseOpenAPI(testOpenAPIFile);

      expect(result.security).toBeDefined();
      expect(result.security.length).toBeGreaterThan(0);

      const bearerAuth = result.security.find(s => s.name === 'bearerAuth');
      expect(bearerAuth).toBeDefined();
      expect(bearerAuth.type).toBe('http');
      expect(bearerAuth.scheme).toBe('bearer');
      expect(bearerAuth.bearerFormat).toBe('JWT');
    });

    test('should extract all endpoints', async () => {
      const result = await parser.parseOpenAPI(testOpenAPIFile);

      expect(result.endpoints).toBeDefined();
      expect(result.endpoints.length).toBeGreaterThan(0);

      // Check for specific endpoints
      const getUsersEndpoint = result.endpoints.find(
        e => e.method === 'GET' && e.path === '/users'
      );
      expect(getUsersEndpoint).toBeDefined();
      expect(getUsersEndpoint.summary).toBe('List all users');

      const postUsersEndpoint = result.endpoints.find(
        e => e.method === 'POST' && e.path === '/users'
      );
      expect(postUsersEndpoint).toBeDefined();
      expect(postUsersEndpoint.summary).toBe('Create a new user');
    });

    test('should extract endpoint parameters correctly', async () => {
      const result = await parser.parseOpenAPI(testOpenAPIFile);

      const getUsersEndpoint = result.endpoints.find(
        e => e.method === 'GET' && e.path === '/users'
      );

      expect(getUsersEndpoint.parameters).toBeDefined();
      expect(getUsersEndpoint.parameters.length).toBeGreaterThan(0);

      const pageParam = getUsersEndpoint.parameters.find(p => p.name === 'page');
      expect(pageParam).toBeDefined();
      expect(pageParam.in).toBe('query');
      expect(pageParam.required).toBe(false);
    });

    test('should extract request body schema', async () => {
      const result = await parser.parseOpenAPI(testOpenAPIFile);

      const postUsersEndpoint = result.endpoints.find(
        e => e.method === 'POST' && e.path === '/users'
      );

      expect(postUsersEndpoint.requestBody).toBeDefined();
      expect(postUsersEndpoint.requestBody.required).toBe(true);
      expect(postUsersEndpoint.requestBody.contentType).toBe('application/json');
      expect(postUsersEndpoint.requestBody.schema).toBeDefined();
    });

    test('should extract response schemas', async () => {
      const result = await parser.parseOpenAPI(testOpenAPIFile);

      const getUsersEndpoint = result.endpoints.find(
        e => e.method === 'GET' && e.path === '/users'
      );

      expect(getUsersEndpoint.responses).toBeDefined();
      expect(getUsersEndpoint.responses['200']).toBeDefined();
      expect(getUsersEndpoint.responses['200'].description).toBe('Successful response');
      expect(getUsersEndpoint.responses['401']).toBeDefined();
    });

    test('should extract models/schemas', async () => {
      const result = await parser.parseOpenAPI(testOpenAPIFile);

      expect(result.models).toBeDefined();
      expect(result.models.length).toBeGreaterThan(0);

      const userModel = result.models.find(m => m.name === 'User');
      expect(userModel).toBeDefined();
      expect(userModel.type).toBe('object');
      expect(userModel.required).toContain('id');
      expect(userModel.required).toContain('email');
      expect(userModel.properties).toBeDefined();
      expect(userModel.properties.id).toBeDefined();
    });

    test('should extract tags', async () => {
      const result = await parser.parseOpenAPI(testOpenAPIFile);

      const getUsersEndpoint = result.endpoints.find(
        e => e.method === 'GET' && e.path === '/users'
      );

      expect(getUsersEndpoint.tags).toContain('Users');
    });
  });

  describe('Markdown Parsing', () => {
    test('should parse Markdown API docs successfully', async () => {
      const result = await parser.parseMarkdown(testMarkdownFile);

      expect(result).toBeDefined();
      expect(result.type).toBe('markdown');
      expect(result.title).toBe('TukTuk API Documentation');
      expect(result.baseUrl).toBe('https://api.tuktuk.baghdad');
    });

    test('should extract endpoints from markdown', async () => {
      const result = await parser.parseMarkdown(testMarkdownFile);

      expect(result.endpoints).toBeDefined();
      expect(result.endpoints.length).toBeGreaterThan(0);

      // Check for GET /api/users
      const getUsersEndpoint = result.endpoints.find(
        e => e.method === 'GET' && e.path.includes('/api/users')
      );
      expect(getUsersEndpoint).toBeDefined();
    });

    test('should extract endpoint descriptions', async () => {
      const result = await parser.parseMarkdown(testMarkdownFile);

      const getUsersEndpoint = result.endpoints.find(
        e => e.method === 'GET' && e.path.includes('/api/users')
      );

      expect(getUsersEndpoint.description).toBeDefined();
      expect(getUsersEndpoint.description.length).toBeGreaterThan(0);
    });

    test('should extract parameters from markdown', async () => {
      const result = await parser.parseMarkdown(testMarkdownFile);

      const getUsersEndpoint = result.endpoints.find(
        e => e.method === 'GET' && e.path.includes('/api/users')
      );

      expect(getUsersEndpoint.parameters).toBeDefined();
      expect(getUsersEndpoint.parameters.length).toBeGreaterThan(0);

      const pageParam = getUsersEndpoint.parameters.find(p => p.name === 'page');
      expect(pageParam).toBeDefined();
    });

    test('should extract request body examples', async () => {
      const result = await parser.parseMarkdown(testMarkdownFile);

      const postRidesEndpoint = result.endpoints.find(
        e => e.method === 'POST' && e.path.includes('/api/rides')
      );

      expect(postRidesEndpoint).toBeDefined();
      expect(postRidesEndpoint.requestBody).toBeDefined();
    });

    test('should extract response examples', async () => {
      const result = await parser.parseMarkdown(testMarkdownFile);

      const postRidesEndpoint = result.endpoints.find(
        e => e.method === 'POST' && e.path.includes('/api/rides')
      );

      expect(postRidesEndpoint.responses).toBeDefined();
      expect(postRidesEndpoint.responses['200']).toBeDefined();
    });

    test('should handle DELETE endpoints', async () => {
      const result = await parser.parseMarkdown(testMarkdownFile);

      const deleteRideEndpoint = result.endpoints.find(
        e => e.method === 'DELETE'
      );

      expect(deleteRideEndpoint).toBeDefined();
    });

    test('should handle PUT endpoints', async () => {
      const result = await parser.parseMarkdown(testMarkdownFile);

      const putUserEndpoint = result.endpoints.find(
        e => e.method === 'PUT'
      );

      expect(putUserEndpoint).toBeDefined();
    });
  });

  describe('Caching', () => {
    test('should cache parsed OpenAPI results', async () => {
      // First parse - should not be cached
      const result1 = await parser.parse(testOpenAPIFile);
      expect(result1.cached).toBeUndefined();

      // Second parse - should be cached
      const result2 = await parser.parse(testOpenAPIFile);
      expect(result2.cached).toBe(true);
    });

    test('should cache parsed Markdown results', async () => {
      // First parse
      const result1 = await parser.parse(testMarkdownFile);
      expect(result1.cached).toBeUndefined();

      // Second parse - should be cached
      const result2 = await parser.parse(testMarkdownFile);
      expect(result2.cached).toBe(true);
    });

    test('should invalidate cache when file changes', async () => {
      // First parse
      await parser.parse(testOpenAPIFile);

      // Simulate file change by clearing cache for this file
      await cache.clear(testOpenAPIFile);

      // Next parse should not be cached
      const result = await parser.parse(testOpenAPIFile);
      expect(result.cached).toBeUndefined();
    });
  });

  describe('Multiple File Parsing', () => {
    test('should parse multiple files and merge results', async () => {
      const result = await parser.parseMultiple([testOpenAPIFile, testMarkdownFile]);

      expect(result).toBeDefined();
      expect(result.type).toBe('merged');
      expect(result.sources).toHaveLength(2);
      expect(result.endpoints).toBeDefined();
      expect(result.endpoints.length).toBeGreaterThan(0);
    });

    test('should deduplicate endpoints from multiple sources', async () => {
      const result = await parser.parseMultiple([testOpenAPIFile, testMarkdownFile]);

      // Check for duplicates
      const paths = result.endpoints.map(e => `${e.method}:${e.path}`);
      const uniquePaths = new Set(paths);

      expect(paths.length).toBe(uniquePaths.size);
    });

    test('should merge models from multiple sources', async () => {
      const result = await parser.parseMultiple([testOpenAPIFile, testMarkdownFile]);

      expect(result.models).toBeDefined();
      // OpenAPI file has models, markdown doesn't
      expect(result.models.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should throw error for unsupported file types', async () => {
      const invalidFile = path.join(fixturesDir, 'test.txt');

      await expect(parser.parse(invalidFile)).rejects.toThrow('Unsupported file type');
    });

    test('should handle invalid YAML gracefully', async () => {
      const invalidYaml = path.join(fixturesDir, 'invalid.yaml');

      // Create invalid YAML file
      await fs.writeFile(invalidYaml, 'invalid: yaml: content: {');

      await expect(parser.parseOpenAPI(invalidYaml)).rejects.toThrow();

      // Clean up
      await fs.unlink(invalidYaml);
    });

    test('should handle missing files gracefully', async () => {
      const missingFile = path.join(fixturesDir, 'non-existent.yaml');

      await expect(parser.parse(missingFile)).rejects.toThrow();
    });
  });

  describe('Metadata', () => {
    test('should add parsing metadata to results', async () => {
      const result = await parser.parse(testOpenAPIFile);

      expect(result.filePath).toBe(testOpenAPIFile);
      expect(result.parsedAt).toBeDefined();
      expect(result.parser).toBe('APIParser');
    });
  });

  describe('Performance', () => {
    test('should parse OpenAPI file in reasonable time', async () => {
      const startTime = Date.now();
      await parser.parse(testOpenAPIFile);
      const endTime = Date.now();

      const duration = endTime - startTime;
      // Should parse in less than 1 second
      expect(duration).toBeLessThan(1000);
    });

    test('should benefit from caching (faster second parse)', async () => {
      // First parse
      const start1 = Date.now();
      await parser.parse(testOpenAPIFile);
      const duration1 = Date.now() - start1;

      // Second parse (cached)
      const start2 = Date.now();
      await parser.parse(testOpenAPIFile);
      const duration2 = Date.now() - start2;

      // Cached version should be faster
      expect(duration2).toBeLessThan(duration1);
    });
  });
});
