import { describe, test, expect } from '@jest/globals';
import { getEventBus } from '../event-bus/AgentEventBus.js';
import { getMetricsCollector } from '../metrics-collector/MetricsCollector.js';
import { getRollbackManager } from '../rollback-manager/RollbackManager.js';
import { getAlertingSystem } from '../alerting/AlertingSystem.js';
import { getHealthMonitor } from '../health-monitor/HealthMonitor.js';
import { EventTypes } from '../event-bus/eventTypes.js';

describe('Phase 0 Integration', () => {
  test('all components should work together', async () => {
    const eventBus = getEventBus();
    const metrics = getMetricsCollector();
    const rollback = getRollbackManager();
    const alerting = getAlertingSystem();
    const health = getHealthMonitor();

    // Initialize all components
    await rollback.initialize();
    await alerting.initialize();
    await health.initialize(metrics);
    metrics.start();

    // Create checkpoint
    const checkpointId = await rollback.createCheckpoint('integration-test');

    // Register agent
    metrics.registerAgent('test-agent');

    // Publish event
    let eventReceived = false;
    eventBus.subscribe(EventTypes.CODE_GENERATED, 'test', () => {
      eventReceived = true;
    });

    eventBus.publish(EventTypes.CODE_GENERATED, {
      agent: 'test-agent',
      files: ['test.js']
    });

    // Collect metrics
    await metrics.collect();
    const agentMetrics = metrics.getAgentMetrics('test-agent');

    // Perform health check
    const healthResults = await health.performHealthChecks();

    // Assertions
    expect(eventReceived).toBe(true);
    expect(agentMetrics).toBeDefined();
    expect(checkpointId).toBeDefined();
    expect(healthResults).toBeDefined();
    expect(healthResults.agents['test-agent']).toBeDefined();

    // Cleanup
    metrics.stop();
    health.stop();
  });

  test('metrics should trigger alerts on high error rate', async () => {
    const metrics = getMetricsCollector();
    const alerting = getAlertingSystem();

    await alerting.initialize();
    metrics.start();

    // Register agent and record many failures
    metrics.registerAgent('failing-agent');
    for (let i = 0; i < 15; i++) {
      metrics.recordExecution('failing-agent', false, 1000, new Error('Test error'));
    }

    // Collect metrics (will trigger alert check)
    await metrics.collect();

    // Give async alert handlers time to execute
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check if alert was created
    const activeAlerts = alerting.getActiveAlerts();
    const hasErrorRateAlert = activeAlerts.some(a =>
      a.source === 'failing-agent' && a.message.includes('Error rate')
    );

    expect(hasErrorRateAlert).toBe(true);

    // Cleanup
    metrics.stop();
  });

  test('health monitor should detect unhealthy agents', async () => {
    const metrics = getMetricsCollector();
    const health = getHealthMonitor();

    await health.initialize(metrics);

    // Create healthy and unhealthy agents
    metrics.registerAgent('healthy-agent');
    metrics.registerAgent('unhealthy-agent');

    // Healthy agent - successful executions
    for (let i = 0; i < 10; i++) {
      metrics.recordExecution('healthy-agent', true, 1000);
    }

    // Unhealthy agent - all failures
    for (let i = 0; i < 20; i++) {
      metrics.recordExecution('unhealthy-agent', false, 1000, new Error('Failed'));
    }

    // Perform health checks
    const healthResults = await health.performHealthChecks();

    // Check results
    expect(healthResults.agents['healthy-agent']).toBeDefined();
    expect(healthResults.agents['unhealthy-agent']).toBeDefined();

    const healthyScore = healthResults.agents['healthy-agent'].score;
    const unhealthyScore = healthResults.agents['unhealthy-agent'].score;

    expect(healthyScore).toBeGreaterThan(unhealthyScore);
    expect(unhealthyScore).toBeLessThan(60);

    // Cleanup
    health.stop();
    metrics.stop();
  });

  test('rollback should integrate with event bus', async () => {
    const eventBus = getEventBus();
    const rollback = getRollbackManager();

    await rollback.initialize();

    // Subscribe to rollback events
    let rollbackEventReceived = false;
    eventBus.subscribe(EventTypes.ROLLBACK_COMPLETED, 'test', (data) => {
      rollbackEventReceived = true;
      expect(data.checkpoint_id).toBeDefined();
    });

    // Create and rollback checkpoint
    const checkpointId = await rollback.createCheckpoint('test-rollback');
    await rollback.rollback(checkpointId, 'Integration test');

    // Give async event time to propagate
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(rollbackEventReceived).toBe(true);
  });

  test('event bus should handle high event volume', () => {
    const eventBus = getEventBus();
    let eventsReceived = 0;

    eventBus.subscribe(EventTypes.CODE_GENERATED, 'volume-test', () => {
      eventsReceived++;
    });

    // Publish 1000 events
    for (let i = 0; i < 1000; i++) {
      eventBus.publish(EventTypes.CODE_GENERATED, {
        agent: 'test-agent',
        iteration: i
      });
    }

    // Should handle all events
    expect(eventsReceived).toBe(1000);

    // Event history should be limited
    const history = eventBus.getHistory();
    expect(history.length).toBeLessThanOrEqual(1000);
  });
});
