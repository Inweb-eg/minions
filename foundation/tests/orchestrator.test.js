import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import Orchestrator, { getOrchestrator } from '../../agents/manager-agent/orchestrator.js';

describe('Orchestrator', () => {
  let orchestrator;

  beforeEach(async () => {
    orchestrator = new Orchestrator();
    await orchestrator.initialize();
  });

  afterEach(() => {
    if (orchestrator.metricsCollector) {
      orchestrator.metricsCollector.stop();
    }
    if (orchestrator.isExecuting) {
      orchestrator.stop();
    }
  });

  test('should initialize orchestrator', async () => {
    expect(orchestrator.isExecuting).toBe(false);
    expect(orchestrator.maxConcurrency).toBe(5);
    expect(orchestrator.currentlyRunning.size).toBe(0);
  });

  test('should register agents with dependencies', () => {
    const loaderFn = jest.fn(async () => ({ execute: jest.fn() }));
    orchestrator.registerAgent('document-agent', loaderFn, []);
    orchestrator.registerAgent('backend-agent', loaderFn, ['document-agent']);
    orchestrator.registerAgent('tester-agent', loaderFn, ['backend-agent']);

    const agents = orchestrator.getRegisteredAgents();
    expect(agents).toContain('document-agent');
    expect(agents).toContain('backend-agent');
    expect(agents).toContain('tester-agent');
  });

  test('should build execution plan for all agents', () => {
    const loaderFn = jest.fn(async () => ({ execute: jest.fn() }));
    orchestrator.registerAgent('agent-1', loaderFn, []);
    orchestrator.registerAgent('agent-2', loaderFn, ['agent-1']);

    const plan = orchestrator.buildExecutionPlan([]);

    expect(plan.totalAgents).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(plan.groups)).toBe(true);
  });

  test('should build execution plan for changed files', () => {
    const loaderFn = jest.fn(async () => ({ execute: jest.fn() }));
    orchestrator.registerAgent('backend-agent', loaderFn, []);

    const plan = orchestrator.buildExecutionPlan(['backend/src/test.js']);

    expect(plan.affectedFiles).toEqual(['backend/src/test.js']);
  });

  test('should get execution status', () => {
    const loaderFn = jest.fn(async () => ({ execute: jest.fn() }));
    orchestrator.registerAgent('test-agent', loaderFn, []);

    const status = orchestrator.getStatus();

    expect(status.isExecuting).toBe(false);
    expect(status.currentlyRunning).toEqual([]);
    expect(status.registeredAgents).toContain('test-agent');
  });

  test('should execute agents successfully', async () => {
    const executeFn = jest.fn(async () => {});
    const loaderFn = jest.fn(async () => ({ execute: executeFn }));
    orchestrator.registerAgent('test-agent', loaderFn, []);

    const result = await orchestrator.execute([]);

    expect(result.success).toBe(true);
    expect(result.duration).toBeGreaterThan(0);
  }, 30000);

  test('should respect concurrency limits', async () => {
    let maxConcurrent = 0;
    let currentConcurrent = 0;
    const loaderFn = jest.fn(async () => ({
      execute: jest.fn(async () => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        await new Promise(resolve => setTimeout(resolve, 50));
        currentConcurrent--;
      })
    }));

    orchestrator.maxConcurrency = 2;
    orchestrator.registerAgent('agent-1', loaderFn, []);
    orchestrator.registerAgent('agent-2', loaderFn, []);
    orchestrator.registerAgent('agent-3', loaderFn, []);

    await orchestrator.execute([]);

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  }, 30000);

  test('should handle agent dependencies correctly', () => {
    const loaderFn = jest.fn(async () => ({ execute: jest.fn() }));
    orchestrator.registerAgent('document-agent', loaderFn, []);
    orchestrator.registerAgent('backend-agent', loaderFn, ['document-agent']);
    orchestrator.registerAgent('tester-agent', loaderFn, ['backend-agent']);

    const deps = orchestrator.dependencyGraph.getDependencies('backend-agent');
    expect(deps).toContain('document-agent');

    const deps2 = orchestrator.dependencyGraph.getDependencies('tester-agent');
    expect(deps2).toContain('backend-agent');
  });

  test('should throw error if execution already in progress', async () => {
    const loaderFn = jest.fn(async () => ({
      execute: jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      })
    }));
    orchestrator.registerAgent('slow-agent', loaderFn, []);

    const promise1 = orchestrator.execute([]);

    await expect(orchestrator.execute([])).rejects.toThrow('Orchestration already in progress');

    await promise1;
  }, 30000);

  test('singleton should return same instance', () => {
    const orch1 = getOrchestrator();
    const orch2 = getOrchestrator();
    expect(orch1).toBe(orch2);
  });
});
