/**
 * HealthMonitor - Monitors Container Health Status
 *
 * Phase 8.5: Monitors & Integration
 * Monitors Docker container health checks and status
 */

import { BaseMonitor, MONITOR_STATUS, ALERT_SEVERITY } from './base-monitor.js';
import Docker from 'dockerode';

/**
 * Health status
 */
export const HEALTH_STATUS = {
  HEALTHY: 'healthy',
  UNHEALTHY: 'unhealthy',
  STARTING: 'starting',
  NONE: 'none'
};

/**
 * HealthMonitor
 * Monitors container health
 */
export class HealthMonitor extends BaseMonitor {
  constructor() {
    super('HealthMonitor', 'health');
    this.docker = new Docker();
    this.monitoredContainers = new Map();
    this.healthCheckInterval = 30000; // 30 seconds
  }

  /**
   * Start monitoring
   * @param {Object} options - Monitoring options
   * @returns {Promise<void>}
   */
  async start(options = {}) {
    const {
      containers = [],
      interval = this.healthCheckInterval,
      autoDiscover = true
    } = options;

    if (this.status === MONITOR_STATUS.RUNNING) {
      this.logger.warn('Health monitor is already running');
      return;
    }

    this.logger.info('Starting health monitor');
    this.status = MONITOR_STATUS.RUNNING;
    this.startTime = Date.now();
    this.healthCheckInterval = interval;

    // Add specified containers
    containers.forEach(containerId => {
      this.addContainer(containerId);
    });

    // Auto-discover running containers
    if (autoDiscover) {
      await this.discoverContainers();
    }

    // Start monitoring loop
    this.monitoringInterval = setInterval(async () => {
      if (this.status === MONITOR_STATUS.RUNNING) {
        await this.checkAllContainers();
      }
    }, this.healthCheckInterval);

    this.emit('started');
    this.logger.info(`Health monitor started (interval: ${interval}ms)`);
  }

  /**
   * Stop monitoring
   * @returns {Promise<void>}
   */
  async stop() {
    if (this.status === MONITOR_STATUS.STOPPED) {
      return;
    }

    this.logger.info('Stopping health monitor');

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.status = MONITOR_STATUS.STOPPED;
    this.emit('stopped');
    this.logger.info('Health monitor stopped');
  }

  /**
   * Collect metrics
   * @returns {Promise<Object>} Metrics
   */
  async collect() {
    const metrics = {
      totalContainers: this.monitoredContainers.size,
      healthy: 0,
      unhealthy: 0,
      starting: 0,
      noHealthCheck: 0,
      containers: []
    };

    for (const [containerId, containerData] of this.monitoredContainers) {
      const health = containerData.lastStatus;

      if (health === HEALTH_STATUS.HEALTHY) metrics.healthy++;
      else if (health === HEALTH_STATUS.UNHEALTHY) metrics.unhealthy++;
      else if (health === HEALTH_STATUS.STARTING) metrics.starting++;
      else metrics.noHealthCheck++;

      metrics.containers.push({
        id: containerId,
        name: containerData.name,
        status: health,
        lastCheck: containerData.lastCheck
      });
    }

    this.recordMetric({
      name: 'health_status',
      ...metrics
    });

    return metrics;
  }

  /**
   * Add container to monitoring
   * @param {string} containerId - Container ID
   */
  addContainer(containerId) {
    if (!this.monitoredContainers.has(containerId)) {
      this.monitoredContainers.set(containerId, {
        id: containerId,
        name: null,
        lastStatus: HEALTH_STATUS.NONE,
        lastCheck: null,
        failureCount: 0
      });
      this.logger.info(`Added container to monitoring: ${containerId}`);
    }
  }

  /**
   * Remove container from monitoring
   * @param {string} containerId - Container ID
   */
  removeContainer(containerId) {
    if (this.monitoredContainers.has(containerId)) {
      this.monitoredContainers.delete(containerId);
      this.logger.info(`Removed container from monitoring: ${containerId}`);
    }
  }

  /**
   * Discover running containers
   * @returns {Promise<void>}
   */
  async discoverContainers() {
    try {
      const containers = await this.docker.listContainers({ all: false });

      containers.forEach(containerInfo => {
        this.addContainer(containerInfo.Id);
      });

      this.logger.info(`Discovered ${containers.length} running containers`);
    } catch (error) {
      this.logger.error(`Failed to discover containers: ${error.message}`);
    }
  }

  /**
   * Check all monitored containers
   * @returns {Promise<void>}
   */
  async checkAllContainers() {
    for (const [containerId, containerData] of this.monitoredContainers) {
      try {
        await this.checkContainer(containerId);
      } catch (error) {
        this.logger.error(`Failed to check container ${containerId}: ${error.message}`);

        // Remove container if it no longer exists
        if (error.statusCode === 404) {
          this.removeContainer(containerId);
        }
      }
    }
  }

  /**
   * Check container health
   * @param {string} containerId - Container ID
   * @returns {Promise<Object>} Health check result
   */
  async checkContainer(containerId) {
    const container = this.docker.getContainer(containerId);
    const info = await container.inspect();

    const containerData = this.monitoredContainers.get(containerId);
    if (!containerData) {
      return null;
    }

    // Update container name
    containerData.name = info.Name.replace(/^\//, '');
    containerData.lastCheck = new Date().toISOString();

    // Check if container is running
    if (!info.State.Running) {
      containerData.lastStatus = HEALTH_STATUS.NONE;
      this.createAlert({
        severity: ALERT_SEVERITY.CRITICAL,
        message: `Container ${containerData.name} is not running`,
        metric: 'container_status',
        currentValue: info.State.Status,
        recommendation: 'Restart the container'
      });
      return { status: 'not_running' };
    }

    // Check health status
    if (info.State.Health) {
      const health = info.State.Health;
      const previousStatus = containerData.lastStatus;
      const currentStatus = health.Status;

      containerData.lastStatus = currentStatus;

      // Check for status changes
      if (previousStatus !== currentStatus) {
        this.handleHealthStatusChange(containerId, containerData, previousStatus, currentStatus, health);
      }

      // Check for unhealthy status
      if (currentStatus === HEALTH_STATUS.UNHEALTHY) {
        containerData.failureCount++;

        this.createAlert({
          severity: ALERT_SEVERITY.CRITICAL,
          message: `Container ${containerData.name} is unhealthy (failures: ${containerData.failureCount})`,
          metric: 'health_status',
          currentValue: currentStatus,
          recommendation: 'Check container logs and health check command'
        });
      } else {
        containerData.failureCount = 0;
      }

      return {
        status: currentStatus,
        failingStreak: health.FailingStreak,
        log: health.Log
      };
    } else {
      containerData.lastStatus = HEALTH_STATUS.NONE;
      return { status: 'no_healthcheck' };
    }
  }

  /**
   * Handle health status change
   * @param {string} containerId - Container ID
   * @param {Object} containerData - Container data
   * @param {string} previousStatus - Previous status
   * @param {string} currentStatus - Current status
   * @param {Object} health - Health info
   */
  handleHealthStatusChange(containerId, containerData, previousStatus, currentStatus, health) {
    this.logger.info(`Container ${containerData.name} health changed: ${previousStatus} → ${currentStatus}`);

    if (currentStatus === HEALTH_STATUS.HEALTHY && previousStatus === HEALTH_STATUS.UNHEALTHY) {
      this.createAlert({
        severity: ALERT_SEVERITY.INFO,
        message: `Container ${containerData.name} recovered and is now healthy`,
        metric: 'health_status',
        currentValue: currentStatus
      });
    } else if (currentStatus === HEALTH_STATUS.UNHEALTHY) {
      const lastLog = health.Log?.[health.Log.length - 1];

      this.createAlert({
        severity: ALERT_SEVERITY.CRITICAL,
        message: `Container ${containerData.name} became unhealthy`,
        metric: 'health_status',
        currentValue: currentStatus,
        recommendation: lastLog?.Output ? `Last check output: ${lastLog.Output.trim()}` : 'Check container logs'
      });
    }
  }

  /**
   * Get container health summary
   * @returns {Object} Health summary
   */
  getHealthSummary() {
    const summary = {
      total: this.monitoredContainers.size,
      healthy: 0,
      unhealthy: 0,
      starting: 0,
      noHealthCheck: 0,
      containers: []
    };

    for (const [containerId, containerData] of this.monitoredContainers) {
      const status = containerData.lastStatus;

      if (status === HEALTH_STATUS.HEALTHY) summary.healthy++;
      else if (status === HEALTH_STATUS.UNHEALTHY) summary.unhealthy++;
      else if (status === HEALTH_STATUS.STARTING) summary.starting++;
      else summary.noHealthCheck++;

      summary.containers.push({
        id: containerId.substring(0, 12),
        name: containerData.name,
        status: status,
        failureCount: containerData.failureCount,
        lastCheck: containerData.lastCheck
      });
    }

    return summary;
  }

  /**
   * Get unhealthy containers
   * @returns {Array} Unhealthy containers
   */
  getUnhealthyContainers() {
    const unhealthy = [];

    for (const [containerId, containerData] of this.monitoredContainers) {
      if (containerData.lastStatus === HEALTH_STATUS.UNHEALTHY) {
        unhealthy.push({
          id: containerId,
          name: containerData.name,
          failureCount: containerData.failureCount,
          lastCheck: containerData.lastCheck
        });
      }
    }

    return unhealthy;
  }

  /**
   * Set health check interval
   * @param {number} interval - Interval in milliseconds
   */
  setInterval(interval) {
    this.healthCheckInterval = interval;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = setInterval(async () => {
        if (this.status === MONITOR_STATUS.RUNNING) {
          await this.checkAllContainers();
        }
      }, this.healthCheckInterval);
    }

    this.logger.info(`Health check interval updated: ${interval}ms`);
  }
}

/**
 * Get singleton instance
 */
let monitorInstance = null;

export function getHealthMonitor() {
  if (!monitorInstance) {
    monitorInstance = new HealthMonitor();
  }
  return monitorInstance;
}
