import { getEventBus } from '../event-bus/AgentEventBus.js';
import { EventTypes } from '../event-bus/eventTypes.js';
import { createLogger } from '../common/logger.js';

const logger = createLogger('MetricsCollector');

/**
 * Collects and aggregates metrics from all agents
 * Runs every 30 seconds to gather system health data
 */
class MetricsCollector {
  constructor() {
    this.eventBus = getEventBus();
    this.metrics = new Map(); // agent name -> metrics
    this.history = []; // Time-series data
    this.maxHistorySize = 2880; // 24 hours at 30-sec intervals
    this.collectionInterval = 30000; // 30 seconds
    this.intervalId = null;
  }

  /**
   * Start collecting metrics
   */
  start() {
    logger.info('Starting metrics collection (30-second intervals)');

    // Initial collection
    this.collect();

    // Schedule recurring collection
    this.intervalId = setInterval(() => {
      this.collect();
    }, this.collectionInterval);

    // Subscribe to events for real-time updates
    this.subscribeToEvents();
  }

  /**
   * Stop collecting metrics
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Stopped metrics collection');
    }
  }

  /**
   * Collect metrics from all agents
   */
  async collect() {
    const timestamp = Date.now();
    const snapshot = {
      timestamp,
      agents: {},
      system: await this.getSystemMetrics()
    };

    // Collect from each agent
    for (const [agentName, agentMetrics] of this.metrics.entries()) {
      snapshot.agents[agentName] = { ...agentMetrics };
    }

    // Store in history
    this.history.push(snapshot);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    // Publish metrics event
    this.eventBus.publish(EventTypes.METRICS_COLLECTED, {
      agent: 'metrics-collector',
      snapshot
    });

    logger.debug(`Metrics collected: ${Object.keys(snapshot.agents).length} agents`);
  }

  /**
   * Register an agent and initialize its metrics
   */
  registerAgent(agentName) {
    if (!this.metrics.has(agentName)) {
      this.metrics.set(agentName, {
        name: agentName,
        status: 'idle',
        executions: {
          total: 0,
          successful: 0,
          failed: 0,
          success_rate: 0
        },
        performance: {
          avg_execution_time_ms: 0,
          min_execution_time_ms: 0,
          max_execution_time_ms: 0,
          p95_execution_time_ms: 0
        },
        errors: {
          total: 0,
          rate: 0,
          last_error: null,
          last_error_time: null
        },
        health: {
          score: 100,
          last_check: Date.now(),
          issues: []
        }
      });
      logger.info(`Registered agent: ${agentName}`);
    }
  }

  /**
   * Update agent metrics
   */
  updateAgentMetrics(agentName, updates) {
    if (!this.metrics.has(agentName)) {
      this.registerAgent(agentName);
    }

    const metrics = this.metrics.get(agentName);

    // Deep merge updates
    Object.keys(updates).forEach(key => {
      if (typeof updates[key] === 'object' && !Array.isArray(updates[key])) {
        metrics[key] = { ...metrics[key], ...updates[key] };
      } else {
        metrics[key] = updates[key];
      }
    });

    this.metrics.set(agentName, metrics);
  }

  /**
   * Record agent execution
   */
  recordExecution(agentName, success, executionTimeMs, error = null) {
    const metrics = this.metrics.get(agentName);
    if (!metrics) return;

    // Update execution counts
    metrics.executions.total++;
    if (success) {
      metrics.executions.successful++;
    } else {
      metrics.executions.failed++;
    }
    metrics.executions.success_rate =
      (metrics.executions.successful / metrics.executions.total) * 100;

    // Update performance metrics
    const times = [
      metrics.performance.min_execution_time_ms || executionTimeMs,
      executionTimeMs,
      metrics.performance.max_execution_time_ms || executionTimeMs
    ];

    metrics.performance.min_execution_time_ms = Math.min(...times.filter(t => t > 0));
    metrics.performance.max_execution_time_ms = Math.max(...times);

    // Update average (running average)
    const prevAvg = metrics.performance.avg_execution_time_ms || 0;
    const n = metrics.executions.total;
    metrics.performance.avg_execution_time_ms =
      ((prevAvg * (n - 1)) + executionTimeMs) / n;

    // Update errors
    if (!success && error) {
      metrics.errors.total++;
      metrics.errors.rate = (metrics.errors.total / metrics.executions.total) * 100;
      metrics.errors.last_error = error.message || String(error);
      metrics.errors.last_error_time = Date.now();
    }

    this.metrics.set(agentName, metrics);
  }

  /**
   * Get system-level metrics
   */
  async getSystemMetrics() {
    const eventHistory = this.eventBus.getHistory({ since: Date.now() - 3600000 }); // Last hour

    return {
      uptime_seconds: process.uptime(),
      memory_usage_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total_events: eventHistory.length,
      events_per_minute: Math.round(eventHistory.length / 60),
      active_agents: this.metrics.size,
      system_health_score: this.calculateSystemHealth()
    };
  }

  /**
   * Calculate overall system health (0-100)
   */
  calculateSystemHealth() {
    if (this.metrics.size === 0) return 100;

    let totalScore = 0;
    let totalWeight = 0;

    for (const [agentName, metrics] of this.metrics.entries()) {
      const weight = this.getAgentWeight(agentName);
      totalScore += metrics.health.score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 100;
  }

  /**
   * Get agent weight for health calculation
   */
  getAgentWeight(agentName) {
    const weights = {
      'manager-agent': 1.5,
      'tester-agent': 1.3,
      'backend-agent': 1.2,
      'codebase-analyzer-agent': 1.2,
      'docker-agent': 1.2,
      'github-agent': 1.1,
      'document-agent': 1.0,
      'users-agent': 1.0,
      'drivers-agent': 1.0,
      'admin-agent': 1.0
    };
    return weights[agentName] || 1.0;
  }

  /**
   * Subscribe to agent events for real-time metrics updates
   */
  subscribeToEvents() {
    // Agent lifecycle events
    this.eventBus.subscribe(EventTypes.AGENT_STARTED, 'metrics-collector', (data) => {
      this.registerAgent(data.agent);
      this.updateAgentMetrics(data.agent, { status: 'running' });
    });

    this.eventBus.subscribe(EventTypes.AGENT_COMPLETED, 'metrics-collector', (data) => {
      this.updateAgentMetrics(data.agent, { status: 'completed' });
      if (data.execution_time_ms) {
        this.recordExecution(data.agent, true, data.execution_time_ms);
      }
    });

    this.eventBus.subscribe(EventTypes.AGENT_FAILED, 'metrics-collector', (data) => {
      this.updateAgentMetrics(data.agent, { status: 'failed' });
      this.recordExecution(data.agent, false, data.execution_time_ms || 0, data.error);
    });

    // Error events
    this.eventBus.subscribe(EventTypes.ERROR_OCCURRED, 'metrics-collector', (data) => {
      const metrics = this.metrics.get(data.agent);
      if (metrics) {
        metrics.errors.total++;
        metrics.errors.last_error = data.error;
        metrics.errors.last_error_time = Date.now();
        metrics.health.score = Math.max(0, metrics.health.score - 5);
        this.metrics.set(data.agent, metrics);
      }
    });
  }

  /**
   * Get current metrics for an agent
   */
  getAgentMetrics(agentName) {
    return this.metrics.get(agentName);
  }

  /**
   * Get all current metrics
   */
  getAllMetrics() {
    return Object.fromEntries(this.metrics);
  }

  /**
   * Get historical metrics
   */
  getHistory(options = {}) {
    let history = [...this.history];

    if (options.since) {
      history = history.filter(h => h.timestamp >= options.since);
    }

    if (options.until) {
      history = history.filter(h => h.timestamp <= options.until);
    }

    if (options.limit) {
      history = history.slice(-options.limit);
    }

    return history;
  }
}

// Singleton instance
let instance = null;

export function getMetricsCollector() {
  if (!instance) {
    instance = new MetricsCollector();
  }
  return instance;
}

export default MetricsCollector;
