import { jest } from '@jest/globals';
import {
  getResultManager,
  resetResultManager
} from '../results/ResultManager.js';
import fs from 'fs/promises';
import path from 'path';

describe('ResultManager', () => {
  let rm;
  const testDir = '/tmp/minions-test-results-' + Date.now();

  beforeEach(() => {
    resetResultManager();
    rm = getResultManager();
    rm.resultsDir = testDir;
  });

  afterEach(async () => {
    resetResultManager();
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (e) { /* ignore */ }
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      expect(getResultManager()).toBe(rm);
    });
  });

  describe('capture - small results', () => {
    beforeEach(async () => {
      await rm.initialize();
    });

    it('should capture small results in memory', async () => {
      const result = await rm.capture('test-agent', { status: 'ok', data: [1, 2, 3] });

      expect(result).toBeTruthy();
      expect(result.storage).toBe('memory');
      expect(result.data).toEqual({ status: 'ok', data: [1, 2, 3] });
      expect(result.agentName).toBe('test-agent');
    });

    it('should generate preview', async () => {
      const result = await rm.capture('test-agent', 'Hello world');

      expect(result.preview).toBe('"Hello world"');
      expect(result.hasMore).toBe(false);
    });

    it('should return null for null/undefined results', async () => {
      expect(await rm.capture('test', null)).toBeNull();
      expect(await rm.capture('test', undefined)).toBeNull();
    });

    it('should track metrics', async () => {
      await rm.capture('a', 'result1');
      await rm.capture('b', 'result2');

      const metrics = rm.getMetrics();
      expect(metrics.totalCaptured).toBe(2);
      expect(metrics.inMemory).toBe(2);
    });
  });

  describe('capture - large results', () => {
    beforeEach(async () => {
      rm.sizeThreshold = 100; // Low threshold for testing
      await rm.initialize();
    });

    it('should persist large results to disk', async () => {
      const largeData = 'x'.repeat(200);
      const result = await rm.capture('test-agent', largeData);

      expect(result.storage).toBe('disk');
      expect(result.data).toBeNull(); // Not in memory
      expect(result.filePath).toBeTruthy();
      expect(result.preview.length).toBeLessThanOrEqual(2000);
      expect(result.hasMore).toBe(true);
    });

    it('should be retrievable from disk', async () => {
      const largeData = 'x'.repeat(200);
      const captured = await rm.capture('test-agent', largeData);

      const full = await rm.getFullResult(captured.id);
      expect(full).toBe(largeData);
    });

    it('should track disk metrics', async () => {
      await rm.capture('test', 'x'.repeat(200));
      expect(rm.getMetrics().onDisk).toBe(1);
    });
  });

  describe('result retrieval', () => {
    beforeEach(async () => {
      await rm.initialize();
    });

    it('should get results for an agent', async () => {
      await rm.capture('agent-a', 'result1');
      await rm.capture('agent-a', 'result2');
      await rm.capture('agent-b', 'result3');

      const results = rm.getResults('agent-a');
      expect(results.length).toBe(2);
    });

    it('should limit results per agent to 10', async () => {
      for (let i = 0; i < 15; i++) {
        await rm.capture('agent-a', `result-${i}`);
      }

      const results = rm.getResults('agent-a');
      expect(results.length).toBe(10);
    });

    it('should return empty for unknown agent', () => {
      expect(rm.getResults('unknown')).toEqual([]);
    });

    it('should get all results', async () => {
      await rm.capture('a', 'r1');
      await rm.capture('b', 'r2');

      const all = rm.getAllResults();
      expect(Object.keys(all)).toEqual(['a', 'b']);
    });
  });

  describe('getFullResult', () => {
    beforeEach(async () => {
      await rm.initialize();
    });

    it('should return in-memory result directly', async () => {
      const captured = await rm.capture('test', { key: 'value' });
      const full = await rm.getFullResult(captured.id);
      expect(full).toEqual({ key: 'value' });
    });

    it('should return null for unknown result', async () => {
      expect(await rm.getFullResult('nonexistent')).toBeNull();
    });
  });

  describe('clear', () => {
    beforeEach(async () => {
      await rm.initialize();
    });

    it('should clear specific agent', async () => {
      await rm.capture('a', 'r1');
      await rm.capture('b', 'r2');

      await rm.clear('a');
      expect(rm.getResults('a')).toEqual([]);
      expect(rm.getResults('b').length).toBe(1);
    });

    it('should clear all', async () => {
      await rm.capture('a', 'r1');
      await rm.capture('b', 'r2');

      await rm.clear();
      expect(rm.getResults('a')).toEqual([]);
      expect(rm.getResults('b')).toEqual([]);
    });
  });
});
