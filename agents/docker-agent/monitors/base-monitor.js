/**
 * BaseMonitor - Abstract Base Class for Docker Monitors
 *
 * Phase 8.5: Monitors & Integration
 * Base class for all Docker monitoring mechanisms
 */

import { createLogger } from '../utils/logger.js';
import { EventEmitter } from 'events';

/**
 * Monitor status
 */
export const MONITOR_STATUS = {
  RUNNING: 'running',
  STOPPED: 'stopped',
  PAUSED: 'paused',
  ERROR: 'error'
};

/**
 * Alert severity
 */
export const ALERT_SEVERITY = {
  CRITICAL: 'critical',
  WARNING: 'warning',
  INFO: 'info'
};

/**
 * BaseMonitor
 * Abstract base class for all monitors
 */
export class BaseMonitor extends EventEmitter {
  constructor(name, type) {
    super();

    if (this.constructor === BaseMonitor) {
      throw new Error('BaseMonitor is abstract and cannot be instantiated directly');
    }

    this.name = name;
    this.type = type;
    this.logger = createLogger(name);
    this.status = MONITOR_STATUS.STOPPED;
    this.monitoringInterval = null;
    this.alertHistory = [];
    this.metrics = [];
  }

  /**
   * Start monitoring (must be implemented by subclasses)
   * @param {Object} options - Monitoring options
   * @returns {Promise<void>}
   */
  async start(options = {}) {
    throw new Error('start() must be implemented by subclass');
  }

  /**
   * Stop monitoring (must be implemented by subclasses)
   * @returns {Promise<void>}
   */
  async stop() {
    throw new Error('stop() must be implemented by subclass');
  }

  /**
   * Collect metrics (must be implemented by subclasses)
   * @returns {Promise<Object>} Metrics
   */
  async collect() {
    throw new Error('collect() must be implemented by subclass');
  }

  /**
   * Create alert
   * @param {Object} alertData - Alert data
   * @returns {Object} Alert
   */
  createAlert(alertData) {
    const {
      severity = ALERT_SEVERITY.INFO,
      message,
      metric = null,
      threshold = null,
      currentValue = null,
      recommendation = null
    } = alertData;

    const alert = {
      severity,
      message,
      metric,
      threshold,
      currentValue,
      recommendation,
      monitor: this.name,
      timestamp: new Date().toISOString()
    };

    this.recordAlert(alert);
    this.emit('alert', alert);

    return alert;
  }

  /**
   * Record alert in history
   * @param {Object} alert - Alert
   */
  recordAlert(alert) {
    this.alertHistory.push(alert);

    // Keep only last 1000 alerts
    if (this.alertHistory.length > 1000) {
      this.alertHistory = this.alertHistory.slice(-1000);
    }

    this.logger.warn(`Alert: [${alert.severity}] ${alert.message}`);
  }

  /**
   * Record metrics
   * @param {Object} metric - Metric data
   */
  recordMetric(metric) {
    this.metrics.push({
      ...metric,
      timestamp: new Date().toISOString()
    });

    // Keep only last 10000 metrics
    if (this.metrics.length > 10000) {
      this.metrics = this.metrics.slice(-10000);
    }

    this.emit('metric', metric);
  }

  /**
   * Get alert history
   * @param {Object} filter - Filter options
   * @returns {Array} Filtered alerts
   */
  getAlertHistory(filter = {}) {
    let alerts = [...this.alertHistory];

    if (filter.severity) {
      alerts = alerts.filter(a => a.severity === filter.severity);
    }

    if (filter.since) {
      const since = new Date(filter.since);
      alerts = alerts.filter(a => new Date(a.timestamp) >= since);
    }

    if (filter.limit) {
      alerts = alerts.slice(-filter.limit);
    }

    return alerts;
  }

  /**
   * Get metrics
   * @param {Object} filter - Filter options
   * @returns {Array} Filtered metrics
   */
  getMetrics(filter = {}) {
    let metrics = [...this.metrics];

    if (filter.metric) {
      metrics = metrics.filter(m => m.name === filter.metric);
    }

    if (filter.since) {
      const since = new Date(filter.since);
      metrics = metrics.filter(m => new Date(m.timestamp) >= since);
    }

    if (filter.limit) {
      metrics = metrics.slice(-filter.limit);
    }

    return metrics;
  }

  /**
   * Clear alert history
   */
  clearAlertHistory() {
    this.alertHistory = [];
    this.logger.info('Alert history cleared');
  }

  /**
   * Clear metrics
   */
  clearMetrics() {
    this.metrics = [];
    this.logger.info('Metrics cleared');
  }

  /**
   * Get alert statistics
   * @returns {Object} Statistics
   */
  getAlertStatistics() {
    const total = this.alertHistory.length;
    const critical = this.alertHistory.filter(a => a.severity === ALERT_SEVERITY.CRITICAL).length;
    const warnings = this.alertHistory.filter(a => a.severity === ALERT_SEVERITY.WARNING).length;
    const info = this.alertHistory.filter(a => a.severity === ALERT_SEVERITY.INFO).length;

    return {
      total,
      critical,
      warnings,
      info,
      criticalRate: total > 0 ? ((critical / total) * 100).toFixed(2) : 0,
      warningRate: total > 0 ? ((warnings / total) * 100).toFixed(2) : 0
    };
  }

  /**
   * Check if monitor is running
   * @returns {boolean} Is running
   */
  isRunning() {
    return this.status === MONITOR_STATUS.RUNNING;
  }

  /**
   * Check if monitor is stopped
   * @returns {boolean} Is stopped
   */
  isStopped() {
    return this.status === MONITOR_STATUS.STOPPED;
  }

  /**
   * Pause monitoring
   */
  pause() {
    if (this.status === MONITOR_STATUS.RUNNING) {
      this.status = MONITOR_STATUS.PAUSED;
      this.logger.info('Monitor paused');
      this.emit('paused');
    }
  }

  /**
   * Resume monitoring
   */
  resume() {
    if (this.status === MONITOR_STATUS.PAUSED) {
      this.status = MONITOR_STATUS.RUNNING;
      this.logger.info('Monitor resumed');
      this.emit('resumed');
    }
  }

  /**
   * Get monitor status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      name: this.name,
      type: this.type,
      status: this.status,
      alerts: this.alertHistory.length,
      metrics: this.metrics.length,
      uptime: this.calculateUptime()
    };
  }

  /**
   * Calculate uptime
   * @returns {number|null} Uptime in milliseconds
   */
  calculateUptime() {
    if (this.startTime) {
      return Date.now() - this.startTime;
    }
    return null;
  }

  /**
   * Format uptime
   * @param {number} ms - Milliseconds
   * @returns {string} Formatted uptime
   */
  formatUptime(ms) {
    if (!ms) return 'N/A';

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}
