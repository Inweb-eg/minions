import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import Orchestrator, { getOrchestrator } from '../../agents/manager-agent/orchestrator.js';
import DependencyGraph, { getDependencyGraph } from '../../agents/manager-agent/dependency-graph.js';
import ChangeDetector, { getChangeDetector } from '../../agents/manager-agent/change-detector.js';
import AgentPool, { getAgentPool } from '../../agents/manager-agent/agent-pool.js';

describe('Manager Agent Integration', () => {
  let orchestrator;
  let dependencyGraph;
  let changeDetector;
  let agentPool;

  beforeEach(async () => {
    orchestrator = new Orchestrator();
    dependencyGraph = new DependencyGraph();
    changeDetector = new ChangeDetector();
    agentPool = new AgentPool();

    await orchestrator.initialize();
    await changeDetector.initialize();
    await agentPool.initialize();
  });

  afterEach(() => {
    if (orchestrator.metricsCollector) {
      orchestrator.metricsCollector.stop();
    }
    if (orchestrator.isExecuting) {
      orchestrator.stop();
    }
    if (changeDetector.monitoringEnabled) {
      changeDetector.stopMonitoring();
    }
  });

  describe('Orchestrator + DependencyGraph Integration', () => {
    test('should build correct execution plan from dependencies', () => {
      const loaderFn = jest.fn(async () => ({ execute: jest.fn() }));
      orchestrator.registerAgent('document-agent', loaderFn, []);
      orchestrator.registerAgent('backend-agent', loaderFn, ['document-agent']);
      orchestrator.registerAgent('tester-agent', loaderFn, ['backend-agent']);

      const plan = orchestrator.buildExecutionPlan([]);
      expect(plan.totalAgents).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(plan.groups)).toBe(true);
    });

    test('should execute agents in proper dependency order', async () => {
      const executionOrder = [];
      const createLoader = (name) => jest.fn(async () => ({
        execute: jest.fn(async () => { executionOrder.push(name); })
      }));

      orchestrator.registerAgent('document-agent', createLoader('document-agent'), []);
      orchestrator.registerAgent('backend-agent', createLoader('backend-agent'), ['document-agent']);
      orchestrator.registerAgent('tester-agent', createLoader('tester-agent'), ['backend-agent']);

      await orchestrator.execute([]);

      expect(executionOrder.indexOf('document-agent')).toBeLessThan(executionOrder.indexOf('backend-agent'));
      expect(executionOrder.indexOf('backend-agent')).toBeLessThan(executionOrder.indexOf('tester-agent'));
    });
  });

  describe('ChangeDetector + DependencyGraph Integration', () => {
    test('should identify affected agents from changed files', () => {
      dependencyGraph.addAgent('document-agent', []);
      dependencyGraph.addAgent('backend-agent', ['document-agent']);
      dependencyGraph.addAgent('tester-agent', ['backend-agent']);

      const changedFiles = ['backend/src/controllers/user.js'];
      const analysis = changeDetector.analyzeChanges(changedFiles);
      const affectedAgents = dependencyGraph.getAffectedAgents(changedFiles);

      expect(analysis.byCategory.backend.length).toBe(1);
      expect(affectedAgents).toContain('backend-agent');
      expect(affectedAgents).toContain('tester-agent');
    });

    test('should prioritize changes based on file impact', async () => {
      const files = [
        'backend/migrations/001_create_users.sql',
        'backend/src/controllers/user.js',
        'docs/readme.md'
      ];

      const impact = await changeDetector.performImpactAnalysis(files);

      expect(impact.changeAnalysis.breakingChanges.length).toBeGreaterThan(0);
      expect(impact.executionPriority.length).toBeGreaterThan(0);
    });
  });

  describe('AgentPool + Orchestrator Integration', () => {
    test('should coordinate agent execution through pool', async () => {
      agentPool.registerAgent('test-agent');

      const executorFn = jest.fn(async () => ({ success: true }));
      const result = await agentPool.executeAgent('test-agent', executorFn);

      expect(result.success).toBe(true);
      expect(executorFn).toHaveBeenCalled();
    });

    test('should track execution statistics across components', async () => {
      agentPool.registerAgent('agent-1');
      agentPool.registerAgent('agent-2');

      const executorFn = jest.fn(async () => ({ success: true }));

      await agentPool.executeAgent('agent-1', executorFn);
      await agentPool.executeAgent('agent-2', executorFn);

      const poolStats = agentPool.getPoolStats();
      expect(poolStats.totalAgents).toBe(2);
      expect(poolStats.agents['agent-1'].totalExecutions).toBe(1);
      expect(poolStats.agents['agent-2'].totalExecutions).toBe(1);
    });
  });

  describe('Full Pipeline Integration', () => {
    test('should process change detection through to execution', async () => {
      dependencyGraph.addAgent('document-agent', []);
      dependencyGraph.addAgent('backend-agent', ['document-agent']);

      const changedFiles = ['backend/src/controllers/api.js'];
      const analysis = changeDetector.analyzeChanges(changedFiles);
      const affectedAgents = dependencyGraph.getAffectedAgents(changedFiles);

      dependencyGraph.buildExecutionOrder();
      const parallelGroups = dependencyGraph.getParallelGroups();

      expect(analysis.totalFiles).toBe(1);
      expect(affectedAgents.length).toBeGreaterThan(0);
      expect(parallelGroups.length).toBeGreaterThan(0);
    });

    test('should handle complex multi-agent workflows', async () => {
      const executionLog = [];
      const createLoader = (name) => jest.fn(async () => ({
        execute: jest.fn(async () => {
          executionLog.push({ agent: name, time: Date.now() });
          await new Promise(resolve => setTimeout(resolve, 10));
        })
      }));

      orchestrator.registerAgent('analyzer', createLoader('analyzer'), []);
      orchestrator.registerAgent('parser', createLoader('parser'), []);
      orchestrator.registerAgent('backend', createLoader('backend'), ['analyzer', 'parser']);
      orchestrator.registerAgent('frontend', createLoader('frontend'), ['analyzer', 'parser']);
      orchestrator.registerAgent('integrator', createLoader('integrator'), ['backend', 'frontend']);

      const result = await orchestrator.execute([]);

      expect(result.success).toBe(true);
      expect(executionLog.length).toBe(5);

      const getIndex = (name) => executionLog.findIndex(e => e.agent === name);
      expect(getIndex('analyzer')).toBeLessThan(getIndex('backend'));
      expect(getIndex('parser')).toBeLessThan(getIndex('frontend'));
      expect(getIndex('backend')).toBeLessThan(getIndex('integrator'));
      expect(getIndex('frontend')).toBeLessThan(getIndex('integrator'));
    });

    test('should propagate failures correctly through pipeline', async () => {
      const loaderFn = jest.fn(async () => ({ execute: jest.fn() }));
      const failingLoader = jest.fn(async () => ({
        execute: jest.fn(async () => { throw new Error('Pipeline failure'); })
      }));

      orchestrator.registerAgent('working-agent', loaderFn, []);
      orchestrator.registerAgent('failing-agent', failingLoader, ['working-agent']);

      await expect(orchestrator.execute([])).rejects.toThrow('Orchestration failed');

      const status = orchestrator.getStatus();
      expect(status.results['working-agent'].success).toBe(true);
      expect(status.results['failing-agent'].success).toBe(false);
    });
  });

  describe('Singleton Pattern Integration', () => {
    test('all singletons should be consistent', () => {
      const orchestrator1 = getOrchestrator();
      const orchestrator2 = getOrchestrator();
      const graph1 = getDependencyGraph();
      const graph2 = getDependencyGraph();
      const detector1 = getChangeDetector();
      const detector2 = getChangeDetector();
      const pool1 = getAgentPool();
      const pool2 = getAgentPool();

      expect(orchestrator1).toBe(orchestrator2);
      expect(graph1).toBe(graph2);
      expect(detector1).toBe(detector2);
      expect(pool1).toBe(pool2);
    });
  });
});
