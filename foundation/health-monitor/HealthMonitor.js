import { getEventBus } from '../event-bus/AgentEventBus.js';
import { EventTypes } from '../event-bus/eventTypes.js';
import { getMetricsCollector } from '../metrics-collector/MetricsCollector.js';
import { createLogger } from '../common/logger.js';

const logger = createLogger('HealthMonitor');

/**
 * Agent health status
 */
export const HealthStatus = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy',
  UNKNOWN: 'unknown'
};

/**
 * Monitors health of all agents and the overall system
 * Performs periodic health checks and publishes status
 */
class HealthMonitor {
  constructor() {
    this.eventBus = getEventBus();
    this.metricsCollector = null;
    this.healthChecks = new Map(); // agent name -> health check function
    this.healthStatus = new Map(); // agent name -> current status
    this.checkInterval = 60000; // 60 seconds
    this.intervalId = null;
  }

  /**
   * Initialize health monitor
   * @param {MetricsCollector} metricsCollector - Optional metrics collector instance (for testing)
   */
  async initialize(metricsCollector = null) {
    this.metricsCollector = metricsCollector || getMetricsCollector();
    logger.info('Health monitor initialized');
  }

  /**
   * Start health monitoring
   */
  start() {
    logger.info(`Starting health monitoring (${this.checkInterval / 1000}-second intervals)`);

    // Initial check
    this.performHealthChecks();

    // Schedule recurring checks
    this.intervalId = setInterval(() => {
      this.performHealthChecks();
    }, this.checkInterval);
  }

  /**
   * Stop health monitoring
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Stopped health monitoring');
    }
  }

  /**
   * Perform health checks on all agents
   */
  async performHealthChecks() {
    const timestamp = Date.now();
    const results = {
      timestamp,
      agents: {},
      system: await this.checkSystemHealth()
    };

    // Get all registered agents from metrics collector
    const allMetrics = this.metricsCollector?.getAllMetrics() || {};

    for (const [agentName, metrics] of Object.entries(allMetrics)) {
      results.agents[agentName] = await this.checkAgentHealth(agentName, metrics);
    }

    // Update health status
    Object.entries(results.agents).forEach(([agentName, health]) => {
      this.healthStatus.set(agentName, health);
    });

    // Publish health check event
    this.eventBus.publish(EventTypes.AGENT_HEALTH_CHECK, {
      agent: 'health-monitor',
      results
    });

    logger.debug(`Health checks completed: ${Object.keys(results.agents).length} agents`);
    return results;
  }

  /**
   * Check health of a specific agent
   */
  async checkAgentHealth(agentName, metrics) {
    const health = {
      agent: agentName,
      status: HealthStatus.UNKNOWN,
      score: 0,
      checks: {},
      issues: [],
      timestamp: Date.now()
    };

    if (!metrics) {
      health.status = HealthStatus.UNKNOWN;
      health.issues.push('No metrics available');
      return health;
    }

    // Check 1: Error rate
    const errorRate = metrics.errors?.rate || 0;
    health.checks.error_rate = {
      passed: errorRate < 5,
      value: errorRate,
      threshold: 5
    };
    if (errorRate >= 10) {
      health.issues.push(`High error rate: ${errorRate}%`);
    } else if (errorRate >= 5) {
      health.issues.push(`Elevated error rate: ${errorRate}%`);
    }

    // Check 2: Success rate
    const successRate = metrics.executions?.success_rate || 100;
    health.checks.success_rate = {
      passed: successRate >= 90,
      value: successRate,
      threshold: 90
    };
    if (successRate < 90) {
      health.issues.push(`Low success rate: ${successRate}%`);
    }

    // Check 3: Execution time
    const avgExecTime = metrics.performance?.avg_execution_time_ms || 0;
    health.checks.execution_time = {
      passed: avgExecTime < 300000, // 5 minutes
      value: avgExecTime,
      threshold: 300000
    };
    if (avgExecTime > 300000) {
      health.issues.push(`Slow execution: ${avgExecTime}ms average`);
    }

    // Check 4: Recent errors
    const recentErrorTime = metrics.errors?.last_error_time || 0;
    const timeSinceError = Date.now() - recentErrorTime;
    health.checks.recent_errors = {
      passed: timeSinceError > 600000 || recentErrorTime === 0, // 10 minutes
      value: timeSinceError,
      threshold: 600000
    };
    if (recentErrorTime > 0 && timeSinceError < 600000) {
      health.issues.push(`Recent error: ${metrics.errors.last_error}`);
    }

    // Execute custom health check if registered
    if (this.healthChecks.has(agentName)) {
      try {
        const customCheck = await this.healthChecks.get(agentName)(metrics);
        health.checks.custom = customCheck;
        if (!customCheck.passed) {
          health.issues.push(customCheck.message || 'Custom health check failed');
        }
      } catch (error) {
        logger.error(`Custom health check failed for ${agentName}:`, error);
        health.issues.push(`Health check error: ${error.message}`);
      }
    }

    // Calculate health score (0-100)
    health.score = this.calculateHealthScore(health.checks);

    // Determine status based on score and issues
    if (health.score >= 80 && health.issues.length === 0) {
      health.status = HealthStatus.HEALTHY;
    } else if (health.score >= 60 || health.issues.length <= 2) {
      health.status = HealthStatus.DEGRADED;
    } else {
      health.status = HealthStatus.UNHEALTHY;
    }

    return health;
  }

  /**
   * Check overall system health
   */
  async checkSystemHealth() {
    const systemHealth = {
      status: HealthStatus.UNKNOWN,
      score: 0,
      checks: {},
      issues: []
    };

    // Get system metrics
    const allMetrics = this.metricsCollector?.getAllMetrics() || {};
    const agentCount = Object.keys(allMetrics).length;

    // Check 1: All agents have metrics
    systemHealth.checks.agents_registered = {
      passed: agentCount > 0,
      value: agentCount
    };
    if (agentCount === 0) {
      systemHealth.issues.push('No agents registered');
    }

    // Check 2: Memory usage
    const memoryUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    systemHealth.checks.memory_usage = {
      passed: memoryUsage < 500,
      value: memoryUsage,
      threshold: 500
    };
    if (memoryUsage >= 500) {
      systemHealth.issues.push(`High memory usage: ${memoryUsage}MB`);
    }

    // Check 3: Process uptime
    const uptime = process.uptime();
    systemHealth.checks.uptime = {
      passed: uptime > 0,
      value: uptime
    };

    // Check 4: Event bus health
    const eventHistory = this.eventBus.getHistory({ since: Date.now() - 60000 });
    systemHealth.checks.event_bus = {
      passed: true,
      value: eventHistory.length
    };

    // Calculate system health score
    systemHealth.score = this.calculateHealthScore(systemHealth.checks);

    // Determine system status
    if (systemHealth.score >= 80 && systemHealth.issues.length === 0) {
      systemHealth.status = HealthStatus.HEALTHY;
    } else if (systemHealth.score >= 60) {
      systemHealth.status = HealthStatus.DEGRADED;
    } else {
      systemHealth.status = HealthStatus.UNHEALTHY;
    }

    return systemHealth;
  }

  /**
   * Calculate health score from checks (0-100)
   */
  calculateHealthScore(checks) {
    const checkResults = Object.values(checks);
    if (checkResults.length === 0) return 0;

    const passedChecks = checkResults.filter(c => c.passed).length;
    return Math.round((passedChecks / checkResults.length) * 100);
  }

  /**
   * Register a custom health check for an agent
   */
  registerHealthCheck(agentName, checkFunction) {
    this.healthChecks.set(agentName, checkFunction);
    logger.info(`Health check registered for ${agentName}`);
  }

  /**
   * Get health status for a specific agent
   */
  getAgentHealth(agentName) {
    return this.healthStatus.get(agentName);
  }

  /**
   * Get health status for all agents
   */
  getAllAgentHealth() {
    return Object.fromEntries(this.healthStatus);
  }

  /**
   * Get list of unhealthy agents
   */
  getUnhealthyAgents() {
    const unhealthy = [];
    for (const [agentName, health] of this.healthStatus.entries()) {
      if (health.status === HealthStatus.UNHEALTHY) {
        unhealthy.push({ agentName, health });
      }
    }
    return unhealthy;
  }

  /**
   * Get system-wide health summary
   */
  getHealthSummary() {
    const allHealth = this.getAllAgentHealth();
    const agents = Object.values(allHealth);

    return {
      total_agents: agents.length,
      healthy: agents.filter(h => h.status === HealthStatus.HEALTHY).length,
      degraded: agents.filter(h => h.status === HealthStatus.DEGRADED).length,
      unhealthy: agents.filter(h => h.status === HealthStatus.UNHEALTHY).length,
      unknown: agents.filter(h => h.status === HealthStatus.UNKNOWN).length,
      average_score: agents.length > 0
        ? Math.round(agents.reduce((sum, h) => sum + h.score, 0) / agents.length)
        : 0
    };
  }
}

// Singleton instance
let instance = null;

export function getHealthMonitor() {
  if (!instance) {
    instance = new HealthMonitor();
  }
  return instance;
}

export default HealthMonitor;
