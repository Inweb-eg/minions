import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import MemoryStore, {
  getMemoryStore,
  resetMemoryStore,
  MemoryNamespace
} from '../memory-store/MemoryStore.js';

describe('MemoryStore', () => {
  let memoryStore;

  beforeEach(async () => {
    // Use in-memory mode for tests
    memoryStore = new MemoryStore({ inMemory: true });
    await memoryStore.initialize();
  });

  afterEach(async () => {
    await memoryStore.close();
    resetMemoryStore();
  });

  describe('basic key-value operations', () => {
    test('should set and get values', async () => {
      await memoryStore.set('test', 'key1', { foo: 'bar' });
      const value = await memoryStore.get('test', 'key1');
      expect(value).toEqual({ foo: 'bar' });
    });

    test('should return null for non-existent keys', async () => {
      const value = await memoryStore.get('test', 'nonexistent');
      expect(value).toBeNull();
    });

    test('should overwrite existing values', async () => {
      await memoryStore.set('test', 'key1', { value: 1 });
      await memoryStore.set('test', 'key1', { value: 2 });
      const value = await memoryStore.get('test', 'key1');
      expect(value).toEqual({ value: 2 });
    });

    test('should delete values', async () => {
      await memoryStore.set('test', 'key1', { foo: 'bar' });
      await memoryStore.delete('test', 'key1');
      const value = await memoryStore.get('test', 'key1');
      expect(value).toBeNull();
    });

    test('should check if key exists', async () => {
      await memoryStore.set('test', 'key1', { foo: 'bar' });
      expect(await memoryStore.has('test', 'key1')).toBe(true);
      expect(await memoryStore.has('test', 'nonexistent')).toBe(false);
    });

    test('should store complex nested objects', async () => {
      const complex = {
        nested: {
          deep: {
            value: [1, 2, 3],
            map: { a: 1, b: 2 }
          }
        }
      };
      await memoryStore.set('test', 'complex', complex);
      const value = await memoryStore.get('test', 'complex');
      expect(value).toEqual(complex);
    });
  });

  describe('namespace operations', () => {
    test('should list all keys in a namespace', async () => {
      await memoryStore.set('ns1', 'key1', { v: 1 });
      await memoryStore.set('ns1', 'key2', { v: 2 });
      await memoryStore.set('ns2', 'key3', { v: 3 });

      const keys = await memoryStore.keys('ns1');
      expect(keys).toHaveLength(2);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
    });

    test('should get all entries in a namespace', async () => {
      await memoryStore.set('ns1', 'key1', { v: 1 });
      await memoryStore.set('ns1', 'key2', { v: 2 });

      const all = await memoryStore.getAll('ns1');
      expect(all).toEqual({
        key1: { v: 1 },
        key2: { v: 2 }
      });
    });

    test('should clear a namespace', async () => {
      await memoryStore.set('ns1', 'key1', { v: 1 });
      await memoryStore.set('ns1', 'key2', { v: 2 });
      await memoryStore.set('ns2', 'key3', { v: 3 });

      await memoryStore.clearNamespace('ns1');

      expect(await memoryStore.keys('ns1')).toHaveLength(0);
      expect(await memoryStore.keys('ns2')).toHaveLength(1);
    });
  });

  describe('TTL (expiration)', () => {
    test('should expire values after TTL', async () => {
      await memoryStore.set('test', 'expiring', { v: 1 }, { ttl: 50 });

      // Value should exist initially
      expect(await memoryStore.get('test', 'expiring')).toEqual({ v: 1 });

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      // Value should be gone
      expect(await memoryStore.get('test', 'expiring')).toBeNull();
    });

    test('should cleanup expired entries', async () => {
      await memoryStore.set('test', 'exp1', { v: 1 }, { ttl: 50 });
      await memoryStore.set('test', 'exp2', { v: 2 }, { ttl: 50 });
      await memoryStore.set('test', 'noexp', { v: 3 });

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      await memoryStore.cleanupExpired();

      expect(await memoryStore.get('test', 'exp1')).toBeNull();
      expect(await memoryStore.get('test', 'exp2')).toBeNull();
      expect(await memoryStore.get('test', 'noexp')).toEqual({ v: 3 });
    });
  });

  describe('project and agent state', () => {
    test('should save and load project state', async () => {
      const projectState = {
        name: 'test-project',
        version: '1.0.0',
        features: ['auth', 'api']
      };

      await memoryStore.saveProjectState('project1', projectState);
      const loaded = await memoryStore.loadProjectState('project1');

      expect(loaded.name).toBe('test-project');
      expect(loaded.version).toBe('1.0.0');
      expect(loaded.features).toEqual(['auth', 'api']);
      expect(loaded.lastUpdated).toBeDefined();
    });

    test('should save and load agent state', async () => {
      const agentState = {
        status: 'running',
        lastAction: 'test',
        metrics: { success: 10, failed: 1 }
      };

      await memoryStore.saveAgentState('test-agent', agentState);
      const loaded = await memoryStore.loadAgentState('test-agent');

      expect(loaded.status).toBe('running');
      expect(loaded.lastAction).toBe('test');
      expect(loaded.metrics).toEqual({ success: 10, failed: 1 });
      expect(loaded.lastUpdated).toBeDefined();
    });
  });

  describe('knowledge base', () => {
    test('should add and query knowledge', async () => {
      await memoryStore.addKnowledge('patterns', 'error-handling', {
        pattern: 'try-catch',
        description: 'Basic error handling pattern'
      });

      const results = await memoryStore.queryKnowledge({ category: 'patterns' });
      expect(results).toHaveLength(1);
      expect(results[0].topic).toBe('error-handling');
      expect(results[0].content.pattern).toBe('try-catch');
    });

    test('should find patterns', async () => {
      await memoryStore.addKnowledge('patterns', 'singleton', {
        code: 'getInstance()'
      });
      await memoryStore.addKnowledge('patterns', 'factory', {
        code: 'create()'
      });

      const patterns = await memoryStore.findPatterns('singleton');
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].topic).toContain('singleton');
    });
  });

  describe('query interface', () => {
    test('should query why built this way', async () => {
      // Add some decisions and knowledge
      await memoryStore.set(MemoryNamespace.DECISIONS, 'dec1', {
        context: { file: 'auth.js', action: 'add authentication' },
        decision: 'use JWT',
        reasoning: 'Stateless, scalable'
      });

      await memoryStore.addKnowledge('patterns', 'authentication', {
        recommendation: 'JWT for APIs'
      });

      const analysis = await memoryStore.queryWhyBuiltThisWay('authentication');

      expect(analysis.context).toBe('authentication');
      expect(analysis.decisions).toBeDefined();
      expect(analysis.knowledge).toBeDefined();
    });
  });

  describe('statistics', () => {
    test('should return stats', async () => {
      await memoryStore.set('ns1', 'key1', { v: 1 });
      await memoryStore.set('ns2', 'key2', { v: 2 });

      const stats = await memoryStore.getStats();

      expect(stats.type).toBe('in-memory');
      expect(stats.totalEntries).toBeGreaterThanOrEqual(2);
    });
  });

  describe('singleton pattern', () => {
    test('getMemoryStore should return same instance', () => {
      const store1 = getMemoryStore({ inMemory: true });
      const store2 = getMemoryStore({ inMemory: true });
      expect(store1).toBe(store2);
    });
  });
});
