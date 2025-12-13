/**
 * Monitors Module - Docker Monitoring System
 *
 * Phase 8.5: Monitors & Integration
 * Exports all monitors
 */

export {
  BaseMonitor,
  MONITOR_STATUS,
  ALERT_SEVERITY
} from './base-monitor.js';

export {
  HealthMonitor,
  getHealthMonitor,
  HEALTH_STATUS
} from './health-monitor.js';

export {
  ResourceMonitor,
  getResourceMonitor
} from './resource-monitor.js';

import { getHealthMonitor as _getHealthMonitor } from './health-monitor.js';
import { getResourceMonitor as _getResourceMonitor } from './resource-monitor.js';

/**
 * Get all monitors
 * @returns {Object} All monitor instances
 */
export function getAllMonitors() {
  return {
    health: _getHealthMonitor(),
    resource: _getResourceMonitor()
  };
}

/**
 * Start all monitors
 * @param {Object} options - Start options
 * @returns {Promise<void>}
 */
export async function startAllMonitors(options = {}) {
  const {
    containers = [],
    autoDiscover = true,
    healthInterval = 30000,
    resourceInterval = 10000,
    thresholds = {}
  } = options;

  const monitors = getAllMonitors();

  await Promise.all([
    monitors.health.start({
      containers,
      autoDiscover,
      interval: healthInterval
    }),
    monitors.resource.start({
      containers,
      autoDiscover,
      interval: resourceInterval,
      thresholds
    })
  ]);
}

/**
 * Stop all monitors
 * @returns {Promise<void>}
 */
export async function stopAllMonitors() {
  const monitors = getAllMonitors();

  await Promise.all([
    monitors.health.stop(),
    monitors.resource.stop()
  ]);
}

/**
 * Get monitoring dashboard data
 * @returns {Object} Dashboard data
 */
export function getMonitoringDashboard() {
  const monitors = getAllMonitors();

  return {
    health: monitors.health.getHealthSummary(),
    resources: monitors.resource.getResourceSummary(),
    alerts: {
      health: monitors.health.getAlertHistory({ limit: 10 }),
      resource: monitors.resource.getAlertHistory({ limit: 10 })
    },
    status: {
      health: monitors.health.getStatus(),
      resource: monitors.resource.getStatus()
    }
  };
}

/**
 * Get all alerts
 * @param {Object} filter - Filter options
 * @returns {Object} All alerts
 */
export function getAllAlerts(filter = {}) {
  const monitors = getAllMonitors();

  return {
    health: monitors.health.getAlertHistory(filter),
    resource: monitors.resource.getAlertHistory(filter),
    total: monitors.health.getAlertHistory(filter).length +
           monitors.resource.getAlertHistory(filter).length
  };
}

/**
 * Clear all alert histories
 */
export function clearAllAlertHistories() {
  const monitors = getAllMonitors();
  monitors.health.clearAlertHistory();
  monitors.resource.clearAlertHistory();
}

/**
 * Clear all metrics
 */
export function clearAllMetrics() {
  const monitors = getAllMonitors();
  monitors.health.clearMetrics();
  monitors.resource.clearMetrics();
}

/**
 * Setup monitor event handlers
 * @param {Object} handlers - Event handlers
 */
export function setupMonitorHandlers(handlers = {}) {
  const monitors = getAllMonitors();

  // Health monitor events
  if (handlers.onHealthAlert) {
    monitors.health.on('alert', handlers.onHealthAlert);
  }

  if (handlers.onHealthMetric) {
    monitors.health.on('metric', handlers.onHealthMetric);
  }

  // Resource monitor events
  if (handlers.onResourceAlert) {
    monitors.resource.on('alert', handlers.onResourceAlert);
  }

  if (handlers.onResourceMetric) {
    monitors.resource.on('metric', handlers.onResourceMetric);
  }

  // Common events
  const allMonitors = Object.values(monitors);
  allMonitors.forEach(monitor => {
    if (handlers.onStarted) {
      monitor.on('started', () => handlers.onStarted(monitor.name));
    }

    if (handlers.onStopped) {
      monitor.on('stopped', () => handlers.onStopped(monitor.name));
    }

    if (handlers.onPaused) {
      monitor.on('paused', () => handlers.onPaused(monitor.name));
    }

    if (handlers.onResumed) {
      monitor.on('resumed', () => handlers.onResumed(monitor.name));
    }
  });
}
