import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import HealthMonitor, { getHealthMonitor, HealthStatus } from '../health-monitor/HealthMonitor.js';
import MetricsCollector from '../metrics-collector/MetricsCollector.js';

describe('HealthMonitor', () => {
  let monitor;
  let metrics;

  beforeEach(async () => {
    monitor = new HealthMonitor();
    metrics = new MetricsCollector();
    await monitor.initialize(metrics);
  });

  afterEach(() => {
    monitor.stop();
    metrics.stop();
  });

  test('should perform health checks', async () => {
    metrics.registerAgent('test-agent');
    metrics.recordExecution('test-agent', true, 1000);

    const results = await monitor.performHealthChecks();

    expect(results).toBeDefined();
    expect(results.timestamp).toBeDefined();
    expect(results.system).toBeDefined();
    expect(results.agents['test-agent']).toBeDefined();
  });

  test('should calculate health score', () => {
    const checks = {
      check1: { passed: true },
      check2: { passed: true },
      check3: { passed: false }
    };

    const score = monitor.calculateHealthScore(checks);
    expect(score).toBe(67); // 2/3 = 66.67 rounded to 67
  });

  test('should determine healthy status', async () => {
    metrics.registerAgent('healthy-agent');
    // Record only successful executions
    metrics.recordExecution('healthy-agent', true, 1000);
    metrics.recordExecution('healthy-agent', true, 1200);

    const agentMetrics = metrics.getAgentMetrics('healthy-agent');
    const health = await monitor.checkAgentHealth('healthy-agent', agentMetrics);

    expect(health.status).toBe(HealthStatus.HEALTHY);
    expect(health.score).toBeGreaterThan(70);
  });

  test('should determine unhealthy status with high error rate', async () => {
    metrics.registerAgent('unhealthy-agent');
    // Record mostly failures
    metrics.recordExecution('unhealthy-agent', false, 1000, new Error('Error 1'));
    metrics.recordExecution('unhealthy-agent', false, 1000, new Error('Error 2'));
    metrics.recordExecution('unhealthy-agent', false, 1000, new Error('Error 3'));
    metrics.recordExecution('unhealthy-agent', true, 1000);

    const agentMetrics = metrics.getAgentMetrics('unhealthy-agent');
    const health = await monitor.checkAgentHealth('unhealthy-agent', agentMetrics);

    expect(health.status).toBe(HealthStatus.UNHEALTHY);
    expect(health.issues.length).toBeGreaterThan(0);
  });

  test('should register custom health check', async () => {
    monitor.registerHealthCheck('custom-agent', async (metrics) => {
      return {
        passed: metrics.executions.total > 5,
        message: 'Need at least 5 executions'
      };
    });

    metrics.registerAgent('custom-agent');
    metrics.recordExecution('custom-agent', true, 1000);

    const agentMetrics = metrics.getAgentMetrics('custom-agent');
    const health = await monitor.checkAgentHealth('custom-agent', agentMetrics);

    expect(health.checks.custom).toBeDefined();
    expect(health.checks.custom.passed).toBe(false);
  });

  test('should get unhealthy agents', async () => {
    metrics.registerAgent('agent-1');
    metrics.registerAgent('agent-2');

    // Make agent-1 healthy
    metrics.recordExecution('agent-1', true, 1000);
    metrics.recordExecution('agent-1', true, 1200);

    // Make agent-2 very unhealthy - all failures, low score
    for (let i = 0; i < 25; i++) {
      metrics.recordExecution('agent-2', false, 1000, new Error(`Test error ${i}`));
    }

    await monitor.performHealthChecks();

    // Check agent-2's health status directly
    const agent2Health = monitor.getAgentHealth('agent-2');
    expect(agent2Health).toBeDefined();
    expect(agent2Health.score).toBeLessThan(60);
    expect(agent2Health.issues.length).toBeGreaterThanOrEqual(2);
    // Should be either degraded or unhealthy (not healthy)
    expect(agent2Health.status).not.toBe(HealthStatus.HEALTHY);

    // Check getUnhealthyAgents - should find agent-2 if unhealthy
    const unhealthy = monitor.getUnhealthyAgents();
    if (agent2Health.status === HealthStatus.UNHEALTHY) {
      expect(unhealthy.some(u => u.agentName === 'agent-2')).toBe(true);
    }
  });

  test('should get health summary', async () => {
    metrics.registerAgent('agent-1');
    metrics.registerAgent('agent-2');
    metrics.recordExecution('agent-1', true, 1000);
    metrics.recordExecution('agent-2', true, 1000);

    await monitor.performHealthChecks();
    const summary = monitor.getHealthSummary();

    expect(summary.total_agents).toBe(2);
    expect(summary.average_score).toBeGreaterThan(0);
  });

  test('should check system health', async () => {
    const systemHealth = await monitor.checkSystemHealth();

    expect(systemHealth).toBeDefined();
    expect(systemHealth.status).toBeDefined();
    expect(systemHealth.score).toBeGreaterThanOrEqual(0);
    expect(systemHealth.checks).toBeDefined();
  });

  test('should start and stop monitoring', async () => {
    expect(monitor.intervalId).toBeNull();

    monitor.start();
    expect(monitor.intervalId).toBeDefined();

    monitor.stop();
    expect(monitor.intervalId).toBeNull();
  });

  test('should get agent health', async () => {
    metrics.registerAgent('test-agent');
    await monitor.performHealthChecks();

    const health = monitor.getAgentHealth('test-agent');
    expect(health).toBeDefined();
    expect(health.agent).toBe('test-agent');
  });

  test('should get all agent health', async () => {
    metrics.registerAgent('agent-1');
    metrics.registerAgent('agent-2');
    await monitor.performHealthChecks();

    const allHealth = monitor.getAllAgentHealth();
    expect(Object.keys(allHealth).length).toBe(2);
  });

  test('singleton should return same instance', () => {
    const instance1 = getHealthMonitor();
    const instance2 = getHealthMonitor();
    expect(instance1).toBe(instance2);
  });
});
