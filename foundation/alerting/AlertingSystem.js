import { getEventBus } from '../event-bus/AgentEventBus.js';
import { EventTypes } from '../event-bus/eventTypes.js';
import { getMetricsCollector } from '../metrics-collector/MetricsCollector.js';
import { createLogger } from '../common/logger.js';

const logger = createLogger('AlertingSystem');

/**
 * Alert severity levels
 */
export const AlertSeverity = {
  P1_CRITICAL: 'P1_CRITICAL',   // Immediate action required
  P2_HIGH: 'P2_HIGH',           // Action required soon
  P3_MEDIUM: 'P3_MEDIUM'        // Monitor closely
};

/**
 * Manages alerts and notifications for system health and errors
 * Integrates with metrics to trigger alerts based on thresholds
 */
class AlertingSystem {
  constructor() {
    this.eventBus = getEventBus();
    this.metricsCollector = null;
    this.alerts = [];
    this.alertHistory = [];
    this.maxHistorySize = 1000;
    this.thresholds = this.getDefaultThresholds();
    this.alertHandlers = new Map();
  }

  /**
   * Initialize alerting system
   */
  async initialize() {
    this.metricsCollector = getMetricsCollector();
    this.subscribeToEvents();
    logger.info('Alerting system initialized');
  }

  /**
   * Get default alert thresholds
   */
  getDefaultThresholds() {
    return {
      [AlertSeverity.P1_CRITICAL]: {
        error_rate: 10,           // > 10% error rate
        agent_unhealthy: 1,       // > 0 unhealthy agents
        execution_time_ms: 600000, // > 10 minutes
        system_health_score: 50    // < 50 system health
      },
      [AlertSeverity.P2_HIGH]: {
        error_rate: 5,            // > 5% error rate
        execution_time_ms: 300000, // > 5 minutes
        system_health_score: 70,   // < 70 system health
        memory_usage_mb: 500       // > 500MB memory
      },
      [AlertSeverity.P3_MEDIUM]: {
        error_rate: 2,            // > 2% error rate
        execution_time_ms: 120000, // > 2 minutes
        queue_size: 100            // > 100 items in queue
      }
    };
  }

  /**
   * Subscribe to critical events
   */
  subscribeToEvents() {
    // Agent failure events
    this.eventBus.subscribe(EventTypes.AGENT_FAILED, 'alerting-system', (data) => {
      this.createAlert({
        severity: AlertSeverity.P1_CRITICAL,
        title: `Agent Failed: ${data.agent}`,
        message: `Agent ${data.agent} failed: ${data.error}`,
        source: data.agent,
        metadata: data
      });
    });

    // Error events
    this.eventBus.subscribe(EventTypes.ERROR_OCCURRED, 'alerting-system', (data) => {
      this.createAlert({
        severity: AlertSeverity.P2_HIGH,
        title: `Error in ${data.agent}`,
        message: data.error,
        source: data.agent,
        metadata: data
      });
    });

    // Metrics collected - check thresholds
    this.eventBus.subscribe(EventTypes.METRICS_COLLECTED, 'alerting-system', (data) => {
      this.checkMetricsThresholds(data.snapshot);
    });
  }

  /**
   * Check metrics against thresholds
   */
  checkMetricsThresholds(snapshot) {
    if (!snapshot || !snapshot.system) return;

    // Check system health score
    const systemHealth = snapshot.system.system_health_score;
    if (systemHealth < this.thresholds[AlertSeverity.P1_CRITICAL].system_health_score) {
      this.createAlert({
        severity: AlertSeverity.P1_CRITICAL,
        title: 'Critical System Health',
        message: `System health score: ${systemHealth}% (threshold: ${this.thresholds[AlertSeverity.P1_CRITICAL].system_health_score}%)`,
        source: 'system',
        metadata: { system_health: systemHealth }
      });
    } else if (systemHealth < this.thresholds[AlertSeverity.P2_HIGH].system_health_score) {
      this.createAlert({
        severity: AlertSeverity.P2_HIGH,
        title: 'Low System Health',
        message: `System health score: ${systemHealth}%`,
        source: 'system',
        metadata: { system_health: systemHealth }
      });
    }

    // Check memory usage
    const memoryUsage = snapshot.system.memory_usage_mb;
    if (memoryUsage > this.thresholds[AlertSeverity.P2_HIGH].memory_usage_mb) {
      this.createAlert({
        severity: AlertSeverity.P2_HIGH,
        title: 'High Memory Usage',
        message: `Memory usage: ${memoryUsage}MB (threshold: ${this.thresholds[AlertSeverity.P2_HIGH].memory_usage_mb}MB)`,
        source: 'system',
        metadata: { memory_usage_mb: memoryUsage }
      });
    }

    // Check individual agent metrics
    if (snapshot.agents) {
      Object.values(snapshot.agents).forEach(agentMetrics => {
        this.checkAgentThresholds(agentMetrics);
      });
    }
  }

  /**
   * Check individual agent against thresholds
   */
  checkAgentThresholds(agentMetrics) {
    const { name, errors, performance } = agentMetrics;

    // Check error rate
    if (errors.rate >= this.thresholds[AlertSeverity.P1_CRITICAL].error_rate) {
      this.createAlert({
        severity: AlertSeverity.P1_CRITICAL,
        title: `Critical Error Rate: ${name}`,
        message: `Error rate: ${errors.rate}%`,
        source: name,
        metadata: agentMetrics
      });
    } else if (errors.rate >= this.thresholds[AlertSeverity.P2_HIGH].error_rate) {
      this.createAlert({
        severity: AlertSeverity.P2_HIGH,
        title: `High Error Rate: ${name}`,
        message: `Error rate: ${errors.rate}%`,
        source: name,
        metadata: agentMetrics
      });
    }

    // Check execution time
    const avgExecTime = performance.avg_execution_time_ms;
    if (avgExecTime > this.thresholds[AlertSeverity.P1_CRITICAL].execution_time_ms) {
      this.createAlert({
        severity: AlertSeverity.P1_CRITICAL,
        title: `Slow Agent Execution: ${name}`,
        message: `Average execution time: ${avgExecTime}ms`,
        source: name,
        metadata: agentMetrics
      });
    }
  }

  /**
   * Create a new alert
   */
  createAlert(alertData) {
    const alert = {
      id: this.generateAlertId(),
      ...alertData,
      timestamp: Date.now(),
      status: 'active',
      acknowledged: false
    };

    // Check for duplicate recent alerts (within 5 minutes)
    const isDuplicate = this.alerts.some(existing =>
      existing.title === alert.title &&
      existing.source === alert.source &&
      Date.now() - existing.timestamp < 300000 && // 5 minutes
      existing.status === 'active'
    );

    if (isDuplicate) {
      logger.debug(`Duplicate alert suppressed: ${alert.title}`);
      return null;
    }

    this.alerts.push(alert);
    this.alertHistory.push(alert);

    if (this.alertHistory.length > this.maxHistorySize) {
      this.alertHistory.shift();
    }

    // Publish alert event
    this.eventBus.publish(EventTypes.ALERT_TRIGGERED, {
      agent: 'alerting-system',
      alert
    });

    // Execute registered handlers
    this.executeAlertHandlers(alert);

    logger.warn(`Alert created [${alert.severity}]: ${alert.title}`);
    return alert;
  }

  /**
   * Register an alert handler (for email, Slack, etc.)
   */
  registerHandler(name, handler) {
    this.alertHandlers.set(name, handler);
    logger.info(`Alert handler registered: ${name}`);
  }

  /**
   * Execute all registered alert handlers
   */
  async executeAlertHandlers(alert) {
    for (const [name, handler] of this.alertHandlers.entries()) {
      try {
        await handler(alert);
      } catch (error) {
        logger.error(`Alert handler '${name}' failed:`, error);
      }
    }
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledged_at = Date.now();
      logger.info(`Alert acknowledged: ${alertId}`);
    }
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId, resolution) {
    const index = this.alerts.findIndex(a => a.id === alertId);
    if (index > -1) {
      this.alerts[index].status = 'resolved';
      this.alerts[index].resolved_at = Date.now();
      this.alerts[index].resolution = resolution;
      logger.info(`Alert resolved: ${alertId}`);
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(filter = {}) {
    let alerts = this.alerts.filter(a => a.status === 'active');

    if (filter.severity) {
      alerts = alerts.filter(a => a.severity === filter.severity);
    }

    if (filter.source) {
      alerts = alerts.filter(a => a.source === filter.source);
    }

    return alerts.sort((a, b) => {
      // Sort by severity (P1 first), then by timestamp (newest first)
      const severityOrder = { P1_CRITICAL: 0, P2_HIGH: 1, P3_MEDIUM: 2 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      return severityDiff !== 0 ? severityDiff : b.timestamp - a.timestamp;
    });
  }

  /**
   * Get alert history
   */
  getAlertHistory(options = {}) {
    let history = [...this.alertHistory];

    if (options.since) {
      history = history.filter(a => a.timestamp >= options.since);
    }

    if (options.limit) {
      history = history.slice(-options.limit);
    }

    return history;
  }

  /**
   * Update alert thresholds
   */
  updateThresholds(severity, thresholds) {
    this.thresholds[severity] = { ...this.thresholds[severity], ...thresholds };
    logger.info(`Thresholds updated for ${severity}`);
  }

  /**
   * Generate unique alert ID
   */
  generateAlertId() {
    return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  }

  /**
   * Clear resolved alerts older than specified age
   */
  clearOldAlerts(maxAge = 86400000) { // Default: 24 hours
    const now = Date.now();
    const initialCount = this.alerts.length;

    this.alerts = this.alerts.filter(alert =>
      alert.status === 'active' || (now - alert.timestamp) < maxAge
    );

    const clearedCount = initialCount - this.alerts.length;
    if (clearedCount > 0) {
      logger.info(`Cleared ${clearedCount} old alerts`);
    }
    return clearedCount;
  }
}

// Singleton instance
let instance = null;

export function getAlertingSystem() {
  if (!instance) {
    instance = new AlertingSystem();
  }
  return instance;
}

export default AlertingSystem;
