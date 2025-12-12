import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import AlertingSystem, { getAlertingSystem, AlertSeverity } from '../alerting/AlertingSystem.js';
import MetricsCollector from '../metrics-collector/MetricsCollector.js';

describe('AlertingSystem', () => {
  let alerting;
  let metrics;

  beforeEach(async () => {
    alerting = new AlertingSystem();
    metrics = new MetricsCollector();
    await alerting.initialize();
  });

  afterEach(() => {
    metrics.stop();
  });

  test('should create alert', () => {
    const alert = alerting.createAlert({
      severity: AlertSeverity.P1_CRITICAL,
      title: 'Test Alert',
      message: 'This is a test alert',
      source: 'test-agent'
    });

    expect(alert).toBeDefined();
    expect(alert.id).toBeDefined();
    expect(alert.severity).toBe(AlertSeverity.P1_CRITICAL);
    expect(alert.status).toBe('active');
    expect(alert.acknowledged).toBe(false);
  });

  test('should suppress duplicate alerts', () => {
    alerting.createAlert({
      severity: AlertSeverity.P2_HIGH,
      title: 'Duplicate Test',
      message: 'Original',
      source: 'test-agent'
    });

    const duplicate = alerting.createAlert({
      severity: AlertSeverity.P2_HIGH,
      title: 'Duplicate Test',
      message: 'Duplicate',
      source: 'test-agent'
    });

    expect(duplicate).toBeNull();
  });

  test('should get active alerts', () => {
    alerting.createAlert({
      severity: AlertSeverity.P1_CRITICAL,
      title: 'Alert 1',
      message: 'Message 1',
      source: 'agent-1'
    });

    alerting.createAlert({
      severity: AlertSeverity.P2_HIGH,
      title: 'Alert 2',
      message: 'Message 2',
      source: 'agent-2'
    });

    const activeAlerts = alerting.getActiveAlerts();
    expect(activeAlerts.length).toBe(2);
    // Should be sorted by severity (P1 first)
    expect(activeAlerts[0].severity).toBe(AlertSeverity.P1_CRITICAL);
  });

  test('should filter alerts by severity', () => {
    alerting.createAlert({
      severity: AlertSeverity.P1_CRITICAL,
      title: 'Critical Alert',
      message: 'Critical',
      source: 'test'
    });

    alerting.createAlert({
      severity: AlertSeverity.P2_HIGH,
      title: 'High Alert',
      message: 'High',
      source: 'test'
    });

    const criticalAlerts = alerting.getActiveAlerts({
      severity: AlertSeverity.P1_CRITICAL
    });

    expect(criticalAlerts.length).toBe(1);
    expect(criticalAlerts[0].severity).toBe(AlertSeverity.P1_CRITICAL);
  });

  test('should acknowledge alert', () => {
    const alert = alerting.createAlert({
      severity: AlertSeverity.P2_HIGH,
      title: 'Test',
      message: 'Test',
      source: 'test'
    });

    alerting.acknowledgeAlert(alert.id);

    const acknowledged = alerting.getActiveAlerts().find(a => a.id === alert.id);
    expect(acknowledged.acknowledged).toBe(true);
    expect(acknowledged.acknowledged_at).toBeDefined();
  });

  test('should resolve alert', () => {
    const alert = alerting.createAlert({
      severity: AlertSeverity.P2_HIGH,
      title: 'Test',
      message: 'Test',
      source: 'test'
    });

    alerting.resolveAlert(alert.id, 'Fixed manually');

    const activeAlerts = alerting.getActiveAlerts();
    expect(activeAlerts.find(a => a.id === alert.id)).toBeUndefined();
  });

  test('should register alert handler', async () => {
    let handlerCalled = false;
    let receivedAlert = null;

    alerting.registerHandler('test-handler', async (alert) => {
      handlerCalled = true;
      receivedAlert = alert;
    });

    const alert = alerting.createAlert({
      severity: AlertSeverity.P2_HIGH,
      title: 'Handler Test',
      message: 'Test',
      source: 'test'
    });

    // Give async handler time to execute
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(handlerCalled).toBe(true);
    expect(receivedAlert.id).toBe(alert.id);
  });

  test('should update thresholds', () => {
    alerting.updateThresholds(AlertSeverity.P1_CRITICAL, {
      error_rate: 20
    });

    expect(alerting.thresholds[AlertSeverity.P1_CRITICAL].error_rate).toBe(20);
  });

  test('should clear old alerts', () => {
    const alert = alerting.createAlert({
      severity: AlertSeverity.P2_HIGH,
      title: 'Old Alert',
      message: 'Test',
      source: 'test'
    });

    alerting.resolveAlert(alert.id, 'Resolved');

    const cleared = alerting.clearOldAlerts(0);
    expect(cleared).toBeGreaterThanOrEqual(1);
  });

  test('should get alert history', () => {
    alerting.createAlert({
      severity: AlertSeverity.P2_HIGH,
      title: 'Alert 1',
      message: 'Test',
      source: 'test'
    });

    alerting.createAlert({
      severity: AlertSeverity.P3_MEDIUM,
      title: 'Alert 2',
      message: 'Test',
      source: 'test'
    });

    const history = alerting.getAlertHistory();
    expect(history.length).toBeGreaterThanOrEqual(2);
  });

  test('singleton should return same instance', () => {
    const instance1 = getAlertingSystem();
    const instance2 = getAlertingSystem();
    expect(instance1).toBe(instance2);
  });
});
