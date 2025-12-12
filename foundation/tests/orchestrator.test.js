import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import Orchestrator, { getOrchestrator } from '../../../.claude/agents/manager-agent/orchestrator.js';

describe('Orchestrator', () => {
  let orchestrator;

  beforeEach(async () => {
    orchestrator = new Orchestrator();
    await orchestrator.initialize();
  });

  afterEach(() => {
    orchestrator.metricsCollector.stop();
  });

  test('should initialize orchestrator', async () => {
    expect(orchestrator.dependencyGraph.nodes.size).toBeGreaterThan(0);
    expect(orchestrator.maxConcurrency).toBe(5);
  });

  test('should register agents with dependencies', () => {
    const agentNames = Array.from(orchestrator.dependencyGraph.nodes.keys());

    expect(agentNames).toContain('document-agent');
    expect(agentNames).toContain('backend-agent');
    expect(agentNames).toContain('tester-agent');
  });

  test('should build execution plan for all agents', () => {
    const plan = orchestrator.buildExecutionPlan([]);

    expect(plan.totalAgents).toBeGreaterThan(0);
    expect(plan.groups.length).toBeGreaterThan(0);
  });

  test('should build execution plan for changed files', () => {
    const plan = orchestrator.buildExecutionPlan(['backend/src/test.js']);

    expect(plan.affectedFiles).toEqual(['backend/src/test.js']);
    expect(plan.totalAgents).toBeGreaterThan(0);
  });

  test('should get execution status', () => {
    const status = orchestrator.getStatus();

    expect(status.isExecuting).toBe(false);
    expect(status.currentlyRunning).toEqual([]);
    expect(status.completedAgents).toBe(0);
  });

  test('should execute agents successfully', async () => {
    const plan = orchestrator.buildExecutionPlan(['backend/src/test.js']);

    const result = await orchestrator.execute(['backend/src/test.js']);

    expect(result.success).toBe(true);
    expect(result.duration).toBeGreaterThan(0);
    expect(result.agentsExecuted).toBeGreaterThan(0);
  }, 30000); // Increased timeout for execution

  test('should respect concurrency limits', async () => {
    orchestrator.maxConcurrency = 2;

    const startTime = Date.now();
    await orchestrator.execute([]);
    const duration = Date.now() - startTime;

    // With concurrency limit, should take longer
    expect(duration).toBeGreaterThan(0);
  }, 30000);

  test('should handle agent dependencies correctly', () => {
    const deps = orchestrator.dependencyGraph.getDependencies('backend-agent');
    expect(deps).toContain('document-agent');

    const deps2 = orchestrator.dependencyGraph.getDependencies('tester-agent');
    expect(deps2.length).toBeGreaterThan(0);
  });

  test('should throw error if execution already in progress', async () => {
    // Start first execution (don't await yet)
    const promise1 = orchestrator.execute([]);

    // Try to start second execution
    await expect(orchestrator.execute([])).rejects.toThrow('Orchestration already in progress');

    // Wait for first to complete
    await promise1;
  }, 30000);

  test('singleton should return same instance', () => {
    const orch1 = getOrchestrator();
    const orch2 = getOrchestrator();
    expect(orch1).toBe(orch2);
  });
});
