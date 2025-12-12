import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import MetricsCollector, { getMetricsCollector } from '../metrics-collector/MetricsCollector.js';

describe('MetricsCollector', () => {
  let collector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  afterEach(() => {
    collector.stop();
  });

  test('should register new agent', () => {
    collector.registerAgent('test-agent');
    const metrics = collector.getAgentMetrics('test-agent');

    expect(metrics).toBeDefined();
    expect(metrics.name).toBe('test-agent');
    expect(metrics.status).toBe('idle');
    expect(metrics.health.score).toBe(100);
  });

  test('should record successful execution', () => {
    collector.registerAgent('test-agent');
    collector.recordExecution('test-agent', true, 1500);

    const metrics = collector.getAgentMetrics('test-agent');
    expect(metrics.executions.total).toBe(1);
    expect(metrics.executions.successful).toBe(1);
    expect(metrics.executions.success_rate).toBe(100);
    expect(metrics.performance.avg_execution_time_ms).toBe(1500);
  });

  test('should record failed execution', () => {
    collector.registerAgent('test-agent');
    collector.recordExecution('test-agent', false, 1000, new Error('Test error'));

    const metrics = collector.getAgentMetrics('test-agent');
    expect(metrics.executions.total).toBe(1);
    expect(metrics.executions.failed).toBe(1);
    expect(metrics.executions.success_rate).toBe(0);
    expect(metrics.errors.total).toBe(1);
    expect(metrics.errors.last_error).toBe('Test error');
  });

  test('should calculate success rate correctly', () => {
    collector.registerAgent('test-agent');
    collector.recordExecution('test-agent', true, 1000);
    collector.recordExecution('test-agent', true, 1200);
    collector.recordExecution('test-agent', false, 1100, new Error('Fail'));
    collector.recordExecution('test-agent', true, 900);

    const metrics = collector.getAgentMetrics('test-agent');
    expect(metrics.executions.total).toBe(4);
    expect(metrics.executions.successful).toBe(3);
    expect(metrics.executions.success_rate).toBe(75);
  });

  test('should track min/max/avg execution times', () => {
    collector.registerAgent('test-agent');
    collector.recordExecution('test-agent', true, 1000);
    collector.recordExecution('test-agent', true, 2000);
    collector.recordExecution('test-agent', true, 1500);

    const metrics = collector.getAgentMetrics('test-agent');
    expect(metrics.performance.min_execution_time_ms).toBe(1000);
    expect(metrics.performance.max_execution_time_ms).toBe(2000);
    expect(metrics.performance.avg_execution_time_ms).toBe(1500);
  });

  test('should calculate system health score', () => {
    collector.registerAgent('agent-1');
    collector.registerAgent('agent-2');

    collector.updateAgentMetrics('agent-1', { health: { score: 90 } });
    collector.updateAgentMetrics('agent-2', { health: { score: 80 } });

    const systemHealth = collector.calculateSystemHealth();
    expect(systemHealth).toBeGreaterThan(80);
    expect(systemHealth).toBeLessThanOrEqual(90);
  });

  test('should store metrics history', async () => {
    collector.registerAgent('test-agent');

    await collector.collect();
    await collector.collect();

    const history = collector.getHistory();
    expect(history.length).toBe(2);
    expect(history[0].timestamp).toBeLessThan(history[1].timestamp);
  });

  test('singleton should return same instance', () => {
    const collector1 = getMetricsCollector();
    const collector2 = getMetricsCollector();
    expect(collector1).toBe(collector2);
  });

  test('should update agent metrics', () => {
    collector.registerAgent('test-agent');
    collector.updateAgentMetrics('test-agent', {
      status: 'running',
      executions: { total: 5 }
    });

    const metrics = collector.getAgentMetrics('test-agent');
    expect(metrics.status).toBe('running');
    expect(metrics.executions.total).toBe(5);
  });

  test('should get all metrics', () => {
    collector.registerAgent('agent-1');
    collector.registerAgent('agent-2');

    const allMetrics = collector.getAllMetrics();
    expect(Object.keys(allMetrics).length).toBe(2);
    expect(allMetrics['agent-1']).toBeDefined();
    expect(allMetrics['agent-2']).toBeDefined();
  });

  test('should filter history by time range', async () => {
    const now = Date.now();
    collector.registerAgent('test-agent');

    await collector.collect();
    await new Promise(resolve => setTimeout(resolve, 50));
    await collector.collect();

    const history = collector.getHistory({ since: now });
    expect(history.length).toBeGreaterThan(0);
    expect(history.every(h => h.timestamp >= now)).toBe(true);
  });

  test('should limit history size', async () => {
    collector.maxHistorySize = 3;
    collector.registerAgent('test-agent');

    for (let i = 0; i < 5; i++) {
      await collector.collect();
    }

    const history = collector.getHistory();
    expect(history.length).toBe(3);
  });

  test('should get agent weights correctly', () => {
    expect(collector.getAgentWeight('manager-agent')).toBe(1.5);
    expect(collector.getAgentWeight('backend-agent')).toBe(1.2);
    expect(collector.getAgentWeight('unknown-agent')).toBe(1.0);
  });
});
