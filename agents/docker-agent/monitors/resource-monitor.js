/**
 * ResourceMonitor - Monitors Container Resource Usage
 *
 * Phase 8.5: Monitors & Integration
 * Monitors Docker container CPU, memory, and network usage
 */

import { BaseMonitor, MONITOR_STATUS, ALERT_SEVERITY } from './base-monitor.js';
import Docker from 'dockerode';

/**
 * ResourceMonitor
 * Monitors container resource usage
 */
export class ResourceMonitor extends BaseMonitor {
  constructor() {
    super('ResourceMonitor', 'resources');
    this.docker = new Docker();
    this.monitoredContainers = new Map();
    this.resourceCheckInterval = 10000; // 10 seconds
    this.thresholds = {
      cpu: 80,          // 80% CPU usage
      memory: 85,       // 85% memory usage
      networkRx: 100 * 1024 * 1024,  // 100 MB/s received
      networkTx: 100 * 1024 * 1024   // 100 MB/s transmitted
    };
  }

  /**
   * Start monitoring
   * @param {Object} options - Monitoring options
   * @returns {Promise<void>}
   */
  async start(options = {}) {
    const {
      containers = [],
      interval = this.resourceCheckInterval,
      autoDiscover = true,
      thresholds = {}
    } = options;

    if (this.status === MONITOR_STATUS.RUNNING) {
      this.logger.warn('Resource monitor is already running');
      return;
    }

    this.logger.info('Starting resource monitor');
    this.status = MONITOR_STATUS.RUNNING;
    this.startTime = Date.now();
    this.resourceCheckInterval = interval;
    this.thresholds = { ...this.thresholds, ...thresholds };

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
    }, this.resourceCheckInterval);

    this.emit('started');
    this.logger.info(`Resource monitor started (interval: ${interval}ms)`);
  }

  /**
   * Stop monitoring
   * @returns {Promise<void>}
   */
  async stop() {
    if (this.status === MONITOR_STATUS.STOPPED) {
      return;
    }

    this.logger.info('Stopping resource monitor');

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.status = MONITOR_STATUS.STOPPED;
    this.emit('stopped');
    this.logger.info('Resource monitor stopped');
  }

  /**
   * Collect metrics
   * @returns {Promise<Object>} Metrics
   */
  async collect() {
    const metrics = {
      totalContainers: this.monitoredContainers.size,
      totalCpu: 0,
      totalMemory: 0,
      containers: []
    };

    for (const [containerId, containerData] of this.monitoredContainers) {
      if (containerData.lastStats) {
        metrics.totalCpu += containerData.lastStats.cpuPercent || 0;
        metrics.totalMemory += containerData.lastStats.memoryUsage || 0;

        metrics.containers.push({
          id: containerId,
          name: containerData.name,
          cpu: containerData.lastStats.cpuPercent,
          memory: containerData.lastStats.memoryUsage,
          memoryPercent: containerData.lastStats.memoryPercent,
          network: containerData.lastStats.network
        });
      }
    }

    this.recordMetric({
      name: 'resource_usage',
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
        lastStats: null,
        previousStats: null,
        lastCheck: null
      });
      this.logger.info(`Added container to resource monitoring: ${containerId}`);
    }
  }

  /**
   * Remove container from monitoring
   * @param {string} containerId - Container ID
   */
  removeContainer(containerId) {
    if (this.monitoredContainers.has(containerId)) {
      this.monitoredContainers.delete(containerId);
      this.logger.info(`Removed container from resource monitoring: ${containerId}`);
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

      this.logger.info(`Discovered ${containers.length} running containers for resource monitoring`);
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
   * Check container resources
   * @param {string} containerId - Container ID
   * @returns {Promise<Object>} Resource stats
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

    // Get container stats
    const stats = await container.stats({ stream: false });
    const calculatedStats = this.calculateStats(stats);

    // Store previous stats
    containerData.previousStats = containerData.lastStats;
    containerData.lastStats = calculatedStats;

    // Check thresholds
    this.checkThresholds(containerId, containerData, calculatedStats);

    return calculatedStats;
  }

  /**
   * Calculate statistics from raw stats
   * @param {Object} stats - Raw Docker stats
   * @returns {Object} Calculated stats
   */
  calculateStats(stats) {
    // Calculate CPU percentage
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - (stats.precpu_stats.cpu_usage?.total_usage || 0);
    const systemDelta = stats.cpu_stats.system_cpu_usage - (stats.precpu_stats.system_cpu_usage || 0);
    const cpuCount = stats.cpu_stats.online_cpus || 1;

    let cpuPercent = 0;
    if (systemDelta > 0 && cpuDelta > 0) {
      cpuPercent = (cpuDelta / systemDelta) * cpuCount * 100.0;
    }

    // Calculate memory usage
    const memoryUsage = stats.memory_stats.usage || 0;
    const memoryLimit = stats.memory_stats.limit || 0;
    const memoryPercent = memoryLimit > 0 ? (memoryUsage / memoryLimit) * 100 : 0;

    // Calculate network I/O
    const networks = stats.networks || {};
    let networkRx = 0;
    let networkTx = 0;

    Object.values(networks).forEach(network => {
      networkRx += network.rx_bytes || 0;
      networkTx += network.tx_bytes || 0;
    });

    return {
      cpuPercent: parseFloat(cpuPercent.toFixed(2)),
      memoryUsage,
      memoryLimit,
      memoryPercent: parseFloat(memoryPercent.toFixed(2)),
      network: {
        rx: networkRx,
        tx: networkTx,
        rxFormatted: this.formatBytes(networkRx),
        txFormatted: this.formatBytes(networkTx)
      },
      blockIO: {
        read: stats.blkio_stats.io_service_bytes_recursive?.find(io => io.op === 'Read')?.value || 0,
        write: stats.blkio_stats.io_service_bytes_recursive?.find(io => io.op === 'Write')?.value || 0
      }
    };
  }

  /**
   * Check resource thresholds
   * @param {string} containerId - Container ID
   * @param {Object} containerData - Container data
   * @param {Object} stats - Calculated stats
   */
  checkThresholds(containerId, containerData, stats) {
    // Check CPU threshold
    if (stats.cpuPercent > this.thresholds.cpu) {
      this.createAlert({
        severity: ALERT_SEVERITY.WARNING,
        message: `Container ${containerData.name} CPU usage is high: ${stats.cpuPercent}%`,
        metric: 'cpu_usage',
        threshold: this.thresholds.cpu,
        currentValue: stats.cpuPercent,
        recommendation: 'Consider scaling or optimizing the application'
      });
    }

    // Check memory threshold
    if (stats.memoryPercent > this.thresholds.memory) {
      this.createAlert({
        severity: ALERT_SEVERITY.WARNING,
        message: `Container ${containerData.name} memory usage is high: ${stats.memoryPercent}%`,
        metric: 'memory_usage',
        threshold: this.thresholds.memory,
        currentValue: stats.memoryPercent,
        recommendation: 'Check for memory leaks or increase memory limits'
      });
    }

    // Check if approaching memory limit
    if (stats.memoryPercent > 95) {
      this.createAlert({
        severity: ALERT_SEVERITY.CRITICAL,
        message: `Container ${containerData.name} is approaching memory limit: ${stats.memoryPercent}%`,
        metric: 'memory_usage',
        threshold: 95,
        currentValue: stats.memoryPercent,
        recommendation: 'Immediate action required - container may be killed by OOM'
      });
    }
  }

  /**
   * Get resource summary
   * @returns {Object} Resource summary
   */
  getResourceSummary() {
    const summary = {
      total: this.monitoredContainers.size,
      containers: []
    };

    let totalCpu = 0;
    let totalMemory = 0;
    let highCpuCount = 0;
    let highMemoryCount = 0;

    for (const [containerId, containerData] of this.monitoredContainers) {
      if (containerData.lastStats) {
        const stats = containerData.lastStats;

        totalCpu += stats.cpuPercent;
        totalMemory += stats.memoryUsage;

        if (stats.cpuPercent > this.thresholds.cpu) highCpuCount++;
        if (stats.memoryPercent > this.thresholds.memory) highMemoryCount++;

        summary.containers.push({
          id: containerId.substring(0, 12),
          name: containerData.name,
          cpu: `${stats.cpuPercent}%`,
          memory: `${this.formatBytes(stats.memoryUsage)} / ${this.formatBytes(stats.memoryLimit)}`,
          memoryPercent: `${stats.memoryPercent}%`,
          network: {
            rx: stats.network.rxFormatted,
            tx: stats.network.txFormatted
          }
        });
      }
    }

    summary.totalCpu = parseFloat(totalCpu.toFixed(2));
    summary.totalMemory = this.formatBytes(totalMemory);
    summary.highCpuCount = highCpuCount;
    summary.highMemoryCount = highMemoryCount;

    return summary;
  }

  /**
   * Get container with highest resource usage
   * @param {string} metric - Metric type ('cpu' or 'memory')
   * @returns {Object|null} Container with highest usage
   */
  getHighestUsage(metric = 'cpu') {
    let highest = null;
    let highestValue = 0;

    for (const [containerId, containerData] of this.monitoredContainers) {
      if (containerData.lastStats) {
        const value = metric === 'cpu'
          ? containerData.lastStats.cpuPercent
          : containerData.lastStats.memoryPercent;

        if (value > highestValue) {
          highestValue = value;
          highest = {
            id: containerId,
            name: containerData.name,
            value,
            stats: containerData.lastStats
          };
        }
      }
    }

    return highest;
  }

  /**
   * Format bytes
   * @param {number} bytes - Bytes
   * @returns {string} Formatted size
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));

    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
  }

  /**
   * Set resource thresholds
   * @param {Object} thresholds - Thresholds
   */
  setThresholds(thresholds) {
    this.thresholds = { ...this.thresholds, ...thresholds };
    this.logger.info('Resource thresholds updated');
  }

  /**
   * Get resource thresholds
   * @returns {Object} Thresholds
   */
  getThresholds() {
    return { ...this.thresholds };
  }

  /**
   * Set monitoring interval
   * @param {number} interval - Interval in milliseconds
   */
  setInterval(interval) {
    this.resourceCheckInterval = interval;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = setInterval(async () => {
        if (this.status === MONITOR_STATUS.RUNNING) {
          await this.checkAllContainers();
        }
      }, this.resourceCheckInterval);
    }

    this.logger.info(`Resource check interval updated: ${interval}ms`);
  }
}

/**
 * Get singleton instance
 */
let monitorInstance = null;

export function getResourceMonitor() {
  if (!monitorInstance) {
    monitorInstance = new ResourceMonitor();
  }
  return monitorInstance;
}
