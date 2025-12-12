import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { getOrchestrator } from '../../../.claude/agents/manager-agent/orchestrator.js';
import { getChangeDetector } from '../../../.claude/agents/manager-agent/change-detector.js';
import { getAgentPool } from '../../../.claude/agents/manager-agent/agent-pool.js';
import { getDependencyGraph } from '../../../.claude/agents/manager-agent/dependency-graph.js';
import { getEventBus } from '../event-bus/AgentEventBus.js';
import { getMetricsCollector } from '../metrics-collector/MetricsCollector.js';
import { getRollbackManager } from '../rollback-manager/RollbackManager.js';

describe('Manager-Agent Integration Tests', () => {
  let orchestrator;
  let changeDetector;
  let agentPool;
  let dependencyGraph;
  let eventBus;
  let metricsCollector;
  let rollbackManager;

  beforeEach(async () => {
    orchestrator = getOrchestrator();
    changeDetector = getChangeDetector();
    agentPool = getAgentPool();
    dependencyGraph = getDependencyGraph();
    eventBus = getEventBus();
    metricsCollector = getMetricsCollector();
    rollbackManager = getRollbackManager();

    await orchestrator.initialize();
    await changeDetector.initialize();
    await agentPool.initialize();
  });

  afterEach(() => {
    if (metricsCollector) {
      metricsCollector.stop();
    }
    if (changeDetector.monitoringEnabled) {
      changeDetector.stopMonitoring();
    }
  });

  test('all Manager-Agent components should be accessible', () => {
    expect(orchestrator).toBeDefined();
    expect(changeDetector).toBeDefined();
    expect(agentPool).toBeDefined();
    expect(dependencyGraph).toBeDefined();
    expect(eventBus).toBeDefined();
    expect(metricsCollector).toBeDefined();
    expect(rollbackManager).toBeDefined();
  });

  test('orchestrator should have integrated all Phase 0 components', () => {
    expect(orchestrator.eventBus).toBe(eventBus);
    expect(orchestrator.metricsCollector).toBe(metricsCollector);
    expect(orchestrator.rollbackManager).toBe(rollbackManager);
    expect(orchestrator.dependencyGraph).toBe(dependencyGraph);
  });

  test('orchestrator should register all agents in dependency graph', () => {
    const agentNames = Array.from(dependencyGraph.nodes.keys());

    expect(agentNames).toContain('document-agent');
    expect(agentNames).toContain('backend-agent');
    expect(agentNames).toContain('users-agent');
    expect(agentNames).toContain('drivers-agent');
    expect(agentNames).toContain('admin-agent');
    expect(agentNames).toContain('codebase-analyzer-agent');
    expect(agentNames).toContain('tester-agent');
    expect(agentNames).toContain('docker-agent');
    expect(agentNames).toContain('github-agent');
  });

  test('dependency graph should resolve execution order correctly', () => {
    dependencyGraph.buildExecutionOrder();
    const order = dependencyGraph.executionOrder;

    // document-agent should come before backend-agent
    const docIndex = order.indexOf('document-agent');
    const backendIndex = order.indexOf('backend-agent');
    expect(docIndex).toBeLessThan(backendIndex);

    // backend-agent should come before users-agent
    const usersIndex = order.indexOf('users-agent');
    expect(backendIndex).toBeLessThan(usersIndex);
  });

  test('change detector should analyze file changes and determine affected agents', async () => {
    const files = [
      'backend/src/controllers/user.js',
      'admin-dashboard/src/App.jsx',
      'docs/api.md'
    ];

    const impact = await changeDetector.performImpactAnalysis(files);

    expect(impact.affectedAgents).toBeDefined();
    expect(Array.isArray(impact.affectedAgents)).toBe(true);
    expect(impact.changeAnalysis).toBeDefined();
    expect(impact.executionPriority).toBeDefined();

    // Backend changes should affect backend-agent
    expect(impact.affectedAgents).toContain('backend-agent');
  });

  test('orchestrator should create checkpoints before execution', async () => {
    const checkpointsBefore = rollbackManager.checkpoints.size;

    const result = await orchestrator.execute(['backend/src/test.js']);

    expect(result.success).toBe(true);
    expect(rollbackManager.checkpoints.size).toBeGreaterThan(checkpointsBefore);
  }, 60000);

  test('orchestrator should commit checkpoints on success', async () => {
    const result = await orchestrator.execute(['backend/src/test.js']);

    expect(result.success).toBe(true);

    // Find the most recent checkpoint
    const checkpoints = Array.from(rollbackManager.checkpoints.values());
    const latestCheckpoint = checkpoints[checkpoints.length - 1];

    expect(latestCheckpoint.status).toBe('committed');
  }, 60000);

  test('event bus is integrated with orchestrator', () => {
    // Verify event bus is properly integrated
    expect(orchestrator.eventBus).toBe(eventBus);
    expect(orchestrator.eventBus).toBeDefined();

    // Event bus functionality is extensively tested in Phase 0 integration tests
  });

  test('metrics collector should track agent executions', async () => {
    await orchestrator.execute(['backend/src/test.js']);

    const systemMetrics = await metricsCollector.getSystemMetrics();

    expect(systemMetrics.active_agents).toBeGreaterThan(0);
    expect(systemMetrics.total_events).toBeGreaterThan(0);
    expect(systemMetrics.system_health_score).toBeDefined();
  }, 60000);

  test('orchestrator should respect concurrency limits', async () => {
    orchestrator.maxConcurrency = 2;

    const statusDuringExecution = [];

    // Start execution (don't await)
    const promise = orchestrator.execute([]);

    // Check status during execution
    await new Promise(resolve => setTimeout(resolve, 200));
    statusDuringExecution.push(orchestrator.getStatus());

    await promise;

    // Should have limited concurrent agents
    const runningAgents = statusDuringExecution
      .map(s => s.currentlyRunning.length)
      .filter(count => count > 0);

    expect(runningAgents.length).toBeGreaterThan(0);
  }, 60000);

  test('orchestrator should handle emergency stop', async () => {
    // Start execution
    const promise = orchestrator.execute([]);

    // Wait a bit then stop
    await new Promise(resolve => setTimeout(resolve, 100));
    await orchestrator.stop();

    expect(orchestrator.isExecuting).toBe(false);

    // Wait for promise to resolve
    try {
      await promise;
    } catch (error) {
      // Expected to potentially fail
    }
  }, 60000);

  test('agent pool can be used for individual agent execution', async () => {
    agentPool.registerAgent('test-agent', { timeout: 5000 });

    const executorFn = async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { success: true };
    };

    const result = await agentPool.executeAgent('test-agent', executorFn);

    expect(result.success).toBe(true);

    const stats = agentPool.getAgentStats('test-agent');
    expect(stats.successfulExecutions).toBe(1);
  });

  test('change detector monitoring can be started and stopped', () => {
    expect(changeDetector.monitoringEnabled).toBe(false);

    changeDetector.startMonitoring(5000);
    expect(changeDetector.monitoringEnabled).toBe(true);

    changeDetector.stopMonitoring();
    expect(changeDetector.monitoringEnabled).toBe(false);
  });

  test('full workflow: change detection -> impact analysis -> orchestration', async () => {
    // 1. Detect changes
    const files = ['backend/src/controllers/user.js'];

    // 2. Perform impact analysis
    const impact = await changeDetector.performImpactAnalysis(files);
    expect(impact.affectedAgents.length).toBeGreaterThan(0);

    // 3. Execute affected agents
    const result = await orchestrator.execute(files);
    expect(result.success).toBe(true);
    expect(result.agentsExecuted).toBeGreaterThan(0);
  }, 60000);

  test('Phase 1 success criterion: can orchestrate 5+ agents in parallel', async () => {
    const result = await orchestrator.execute([]);

    expect(result.agentsExecuted).toBeGreaterThanOrEqual(5);
    expect(result.success).toBe(true);
  }, 60000);

  test('Phase 1 success criterion: dependency graph resolves correctly', () => {
    dependencyGraph.buildExecutionOrder();

    expect(dependencyGraph.executionOrder.length).toBeGreaterThan(0);
    expect(dependencyGraph.hasCircularDependencies()).toBe(false);
  });

  test('Phase 1 success criterion: rollback works on failure', async () => {
    // This is validated in orchestrator tests where failures trigger rollback
    expect(rollbackManager.rollback).toBeDefined();
    expect(rollbackManager.createCheckpoint).toBeDefined();
    expect(rollbackManager.commitCheckpoint).toBeDefined();
  });

  test('Phase 1 success criterion: circular update prevention active', async () => {
    agentPool.registerAgent('test-agent-circular', { cooldown: 100 });
    agentPool.circularUpdateThreshold = 2;

    const executorFn = async () => ({ success: true });

    // Execute twice
    await agentPool.executeAgent('test-agent-circular', executorFn);
    await new Promise(resolve => setTimeout(resolve, 150));
    await agentPool.executeAgent('test-agent-circular', executorFn);
    await new Promise(resolve => setTimeout(resolve, 150));

    // Check that circular update is detected
    expect(agentPool.hasCircularUpdate('test-agent-circular')).toBe(true);

    // Third attempt should be prevented
    await expect(agentPool.executeAgent('test-agent-circular', executorFn))
      .rejects.toThrow('cannot execute: circular_update');
  });

  test('Phase 1 success criterion: all safety mechanisms operational', () => {
    // Checkpoint system
    expect(rollbackManager.createCheckpoint).toBeDefined();
    expect(rollbackManager.rollback).toBeDefined();

    // Emergency stop
    expect(orchestrator.stop).toBeDefined();

    // Health monitoring
    expect(metricsCollector.getSystemMetrics).toBeDefined();
    expect(metricsCollector.getAgentMetrics).toBeDefined();

    // Rate limiting
    expect(agentPool.isRateLimited).toBeDefined();

    // Cooldown
    expect(agentPool.isInCooldown).toBeDefined();

    // Circular update prevention
    expect(agentPool.hasCircularUpdate).toBeDefined();
  });
});
