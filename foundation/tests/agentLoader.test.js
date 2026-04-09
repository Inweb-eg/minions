import { jest } from '@jest/globals';
import {
  getAgentLoader,
  resetAgentLoader,
  LoadPriority
} from '../loader/AgentLoader.js';

describe('AgentLoader', () => {
  let loader;

  beforeEach(() => {
    resetAgentLoader();
    loader = getAgentLoader();
  });

  afterEach(() => {
    resetAgentLoader();
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      expect(getAgentLoader()).toBe(loader);
    });

    it('should return fresh after reset', () => {
      resetAgentLoader();
      expect(getAgentLoader()).not.toBe(loader);
    });
  });

  describe('registration', () => {
    it('should register agents', () => {
      loader.register('test', async () => ({}));
      const stats = loader.getStats();
      expect(stats.totalRegistered).toBe(1);
      expect(stats.deferred).toBe(1); // Default priority
    });

    it('should register eager agents', () => {
      loader.register('test', async () => ({}), { priority: LoadPriority.EAGER });
      const stats = loader.getStats();
      expect(stats.eager).toBe(1);
    });
  });

  describe('eager initialization', () => {
    it('should initialize eager agents in parallel', async () => {
      const order = [];
      loader.register('a', async () => {
        await new Promise(r => setTimeout(r, 50));
        order.push('a');
        return { initialize: async () => {} };
      }, { priority: LoadPriority.EAGER });

      loader.register('b', async () => {
        await new Promise(r => setTimeout(r, 50));
        order.push('b');
        return { initialize: async () => {} };
      }, { priority: LoadPriority.EAGER });

      const startTime = Date.now();
      const result = await loader.initializeEager();
      const duration = Date.now() - startTime;

      expect(result.loaded).toEqual(['a', 'b']);
      expect(result.failed).toEqual([]);
      // Parallel: should take ~50ms not ~100ms
      expect(duration).toBeLessThan(150);
    });

    it('should handle failures gracefully', async () => {
      loader.register('good', async () => ({
        initialize: async () => {}
      }), { priority: LoadPriority.EAGER });

      loader.register('bad', async () => {
        throw new Error('Import failed');
      }, { priority: LoadPriority.EAGER });

      const result = await loader.initializeEager();
      expect(result.loaded).toEqual(['good']);
      expect(result.failed).toEqual(['bad']);
    });

    it('should not initialize deferred agents', async () => {
      let loaded = false;
      loader.register('deferred', async () => {
        loaded = true;
        return {};
      }, { priority: LoadPriority.DEFERRED });

      await loader.initializeEager();
      expect(loaded).toBe(false);
    });
  });

  describe('on-demand loading', () => {
    it('should load deferred agents on demand', async () => {
      const agent = { name: 'test-agent', initialize: jest.fn() };
      loader.register('test', async () => agent);

      const result = await loader.getAgent('test');
      expect(result).toBe(agent);
      expect(agent.initialize).toHaveBeenCalled();
    });

    it('should cache loaded agents', async () => {
      let importCount = 0;
      loader.register('test', async () => {
        importCount++;
        return { initialize: async () => {} };
      });

      await loader.getAgent('test');
      await loader.getAgent('test');
      expect(importCount).toBe(1); // Only imported once
    });

    it('should return null for unknown agents', async () => {
      const result = await loader.getAgent('nonexistent');
      expect(result).toBeNull();
    });

    it('should return null for previously failed agents', async () => {
      loader.register('bad', async () => { throw new Error('fail'); });

      const result1 = await loader.getAgent('bad');
      expect(result1).toBeNull();

      const result2 = await loader.getAgent('bad');
      expect(result2).toBeNull(); // Cached failure
    });
  });

  describe('factory pattern', () => {
    it('should use factory function when specified', async () => {
      const agent = { name: 'factory-agent' };
      loader.register('test', async () => ({
        getTestAgent: () => agent
      }), { factory: 'getTestAgent' });

      const result = await loader.getAgent('test');
      expect(result).toBe(agent);
    });

    it('should pass factoryArgs when specified', async () => {
      const agent = { name: 'configured-agent' };
      loader.register('test', async () => ({
        createAgent: (config) => {
          expect(config.port).toBe(3000);
          return agent;
        }
      }), { factory: 'createAgent', factoryArgs: { port: 3000 } });

      const result = await loader.getAgent('test');
      expect(result).toBe(agent);
    });
  });

  describe('statistics', () => {
    it('should track load times', async () => {
      loader.register('test', async () => ({
        initialize: async () => await new Promise(r => setTimeout(r, 20))
      }), { priority: LoadPriority.EAGER });

      await loader.initializeEager();
      const stats = loader.getStats();

      expect(stats.loaded).toBe(1);
      expect(stats.loadTimes.test).toBeGreaterThan(0);
      expect(stats.totalStartupTime).toBeGreaterThan(0);
    });

    it('should report loaded agents', async () => {
      const agent = { name: 'a', initialize: jest.fn() };
      loader.register('a', async () => agent, { priority: LoadPriority.EAGER });
      loader.register('b', async () => ({})); // Deferred, not loaded

      await loader.initializeEager();
      const loaded = loader.getLoadedAgents();

      expect(loaded.a).toBe(agent);
      expect(loaded.b).toBeUndefined();
    });
  });

  describe('isLoaded', () => {
    it('should return false before loading', () => {
      loader.register('test', async () => ({}));
      expect(loader.isLoaded('test')).toBe(false);
    });

    it('should return true after loading', async () => {
      loader.register('test', async () => ({
        initialize: async () => {}
      }), { priority: LoadPriority.EAGER });

      await loader.initializeEager();
      expect(loader.isLoaded('test')).toBe(true);
    });
  });
});
