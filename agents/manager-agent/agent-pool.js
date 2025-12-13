import { createLogger } from '../../foundation/common/logger.js';
import { getEventBus } from '../../foundation/event-bus/AgentEventBus.js';
import { EventTypes } from '../../foundation/event-bus/eventTypes.js';

const logger = createLogger('AgentPool');

/**
 * Manages lifecycle and execution of agents
 * Handles timeout, retry, circular update prevention, and rate limiting
 */
class AgentPool {
  constructor() {
    this.eventBus = getEventBus ? getEventBus() : null;
    this.agents = new Map(); // agent name -> agent state
    this.executionHistory = []; // Track recent executions
    this.maxHistorySize = 1000;
    this.circularUpdateWindow = 300000; // 5 minutes
    this.circularUpdateThreshold = 3; // Max times agent can run in window
    this.cooldownPeriod = 10000; // 10 seconds between executions
    this.maxRetries = 3;
    this.defaultTimeout = 300000; // 5 minutes
    this.rateLimitWindow = 60000; // 1 minute
    this.rateLimitMax = 10; // Max 10 executions per minute per agent
  }

  /**
   * Initialize the agent pool
   */
  async initialize() {
    logger.info('Agent pool initialized');
  }

  /**
   * Register an agent in the pool
   */
  registerAgent(agentName, config = {}) {
    if (this.agents.has(agentName)) {
      logger.warn(`Agent ${agentName} already registered, updating config`);
    }

    this.agents.set(agentName, {
      name: agentName,
      status: 'idle', // idle, running, failed, cooldown
      lastExecutionTime: null,
      lastExecutionDuration: null,
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      retryCount: 0,
      config: {
        timeout: config.timeout || this.defaultTimeout,
        maxRetries: config.maxRetries !== undefined ? config.maxRetries : this.maxRetries,
        cooldown: config.cooldown || this.cooldownPeriod
      }
    });

    logger.debug(`Registered agent: ${agentName}`);
  }

  /**
   * Get agent state
   */
  getAgent(agentName) {
    return this.agents.get(agentName);
  }

  /**
   * Check if agent is in cooldown
   */
  isInCooldown(agentName) {
    const agent = this.agents.get(agentName);
    if (!agent || !agent.lastExecutionTime) return false;

    const timeSinceExecution = Date.now() - agent.lastExecutionTime;
    return timeSinceExecution < agent.config.cooldown;
  }

  /**
   * Check if agent has hit rate limit
   */
  isRateLimited(agentName) {
    const now = Date.now();
    const windowStart = now - this.rateLimitWindow;

    const recentExecutions = this.executionHistory.filter(
      exec => exec.agent === agentName && exec.startTime >= windowStart
    );

    return recentExecutions.length >= this.rateLimitMax;
  }

  /**
   * Check for circular updates (same agent running too frequently)
   */
  hasCircularUpdate(agentName) {
    const now = Date.now();
    const windowStart = now - this.circularUpdateWindow;

    const recentExecutions = this.executionHistory.filter(
      exec => exec.agent === agentName && exec.startTime >= windowStart
    );

    if (recentExecutions.length >= this.circularUpdateThreshold) {
      logger.warn(
        `Circular update detected for ${agentName}: ${recentExecutions.length} executions in ${this.circularUpdateWindow}ms window`
      );
      return true;
    }

    return false;
  }

  /**
   * Check if agent can execute
   */
  canExecute(agentName) {
    const agent = this.agents.get(agentName);
    if (!agent) {
      logger.error(`Agent ${agentName} not registered`);
      return { allowed: false, reason: 'not_registered' };
    }

    if (agent.status === 'running') {
      return { allowed: false, reason: 'already_running' };
    }

    if (this.isInCooldown(agentName)) {
      const remainingCooldown = agent.config.cooldown - (Date.now() - agent.lastExecutionTime);
      return {
        allowed: false,
        reason: 'cooldown',
        remainingMs: remainingCooldown
      };
    }

    if (this.isRateLimited(agentName)) {
      return { allowed: false, reason: 'rate_limited' };
    }

    if (this.hasCircularUpdate(agentName)) {
      return { allowed: false, reason: 'circular_update' };
    }

    return { allowed: true };
  }

  /**
   * Execute an agent with timeout and retry logic
   */
  async executeAgent(agentName, executorFn, context = {}) {
    const canExecuteResult = this.canExecute(agentName);

    if (!canExecuteResult.allowed) {
      const error = new Error(`Agent ${agentName} cannot execute: ${canExecuteResult.reason}`);
      error.reason = canExecuteResult.reason;
      error.details = canExecuteResult;
      throw error;
    }

    const agent = this.agents.get(agentName);
    const startTime = Date.now();

    // Record execution start
    const executionRecord = {
      agent: agentName,
      startTime,
      endTime: null,
      duration: null,
      success: false,
      error: null,
      retryAttempt: agent.retryCount
    };

    this.executionHistory.push(executionRecord);
    this.trimExecutionHistory();

    // Update agent state
    agent.status = 'running';
    agent.totalExecutions++;

    // Publish agent started event
    if (this.eventBus) {
      this.eventBus.publish(EventTypes.AGENT_STARTED, {
        agent: agentName,
        timestamp: startTime,
        context
      });
    }

    logger.info(`Executing agent: ${agentName} (attempt ${agent.retryCount + 1}/${agent.config.maxRetries + 1})`);

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(
        executorFn,
        agent.config.timeout,
        agentName
      );

      // Success
      const endTime = Date.now();
      const duration = endTime - startTime;

      agent.status = 'idle';
      agent.lastExecutionTime = endTime;
      agent.lastExecutionDuration = duration;
      agent.successfulExecutions++;
      agent.retryCount = 0;

      executionRecord.endTime = endTime;
      executionRecord.duration = duration;
      executionRecord.success = true;

      // Publish success event
      if (this.eventBus) {
        this.eventBus.publish(EventTypes.AGENT_COMPLETED, {
          agent: agentName,
          execution_time_ms: duration,
          result
        });
      }

      logger.info(`Agent ${agentName} completed successfully in ${duration}ms`);

      return result;

    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      executionRecord.endTime = endTime;
      executionRecord.duration = duration;
      executionRecord.error = error.message;

      logger.error(`Agent ${agentName} failed:`, error);

      // Check if should retry
      if (agent.retryCount < agent.config.maxRetries && !error.isTimeout) {
        agent.retryCount++;
        agent.status = 'idle';

        logger.info(`Retrying agent ${agentName} (attempt ${agent.retryCount + 1}/${agent.config.maxRetries + 1})`);

        // Wait before retry (exponential backoff)
        const retryDelay = Math.min(1000 * Math.pow(2, agent.retryCount - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, retryDelay));

        // Recursive retry
        return this.executeAgent(agentName, executorFn, context);
      }

      // Max retries reached or timeout
      agent.status = 'failed';
      agent.lastExecutionTime = endTime;
      agent.lastExecutionDuration = duration;
      agent.failedExecutions++;
      agent.retryCount = 0;

      // Publish failed event
      if (this.eventBus) {
        this.eventBus.publish(EventTypes.AGENT_FAILED, {
          agent: agentName,
          error: error.message,
          execution_time_ms: duration,
          retries: agent.retryCount
        });
      }

      throw error;
    }
  }

  /**
   * Execute function with timeout
   */
  async executeWithTimeout(fn, timeoutMs, agentName) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const error = new Error(`Agent ${agentName} timed out after ${timeoutMs}ms`);
        error.isTimeout = true;
        reject(error);
      }, timeoutMs);

      Promise.resolve(fn())
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Trim execution history to max size
   */
  trimExecutionHistory() {
    if (this.executionHistory.length > this.maxHistorySize) {
      const excess = this.executionHistory.length - this.maxHistorySize;
      this.executionHistory.splice(0, excess);
    }
  }

  /**
   * Get execution statistics for an agent
   */
  getAgentStats(agentName) {
    const agent = this.agents.get(agentName);
    if (!agent) {
      return null;
    }

    const recentExecutions = this.executionHistory.filter(
      exec => exec.agent === agentName
    );

    const successRate = agent.totalExecutions > 0
      ? (agent.successfulExecutions / agent.totalExecutions) * 100
      : 0;

    const avgDuration = recentExecutions.length > 0
      ? recentExecutions.reduce((sum, exec) => sum + (exec.duration || 0), 0) / recentExecutions.length
      : 0;

    return {
      name: agentName,
      status: agent.status,
      totalExecutions: agent.totalExecutions,
      successfulExecutions: agent.successfulExecutions,
      failedExecutions: agent.failedExecutions,
      successRate: successRate.toFixed(2) + '%',
      averageDuration: Math.round(avgDuration) + 'ms',
      lastExecutionTime: agent.lastExecutionTime,
      lastExecutionDuration: agent.lastExecutionDuration,
      isInCooldown: this.isInCooldown(agentName),
      isRateLimited: this.isRateLimited(agentName),
      recentExecutionCount: recentExecutions.length
    };
  }

  /**
   * Get pool statistics
   */
  getPoolStats() {
    const stats = {
      totalAgents: this.agents.size,
      idleAgents: 0,
      runningAgents: 0,
      failedAgents: 0,
      cooldownAgents: 0,
      totalExecutions: 0,
      agents: {}
    };

    for (const [name, agent] of this.agents) {
      stats.totalExecutions += agent.totalExecutions;

      switch (agent.status) {
        case 'idle':
          stats.idleAgents++;
          break;
        case 'running':
          stats.runningAgents++;
          break;
        case 'failed':
          stats.failedAgents++;
          break;
        case 'cooldown':
          stats.cooldownAgents++;
          break;
      }

      stats.agents[name] = this.getAgentStats(name);
    }

    return stats;
  }

  /**
   * Reset agent state
   */
  resetAgent(agentName) {
    const agent = this.agents.get(agentName);
    if (!agent) {
      logger.warn(`Cannot reset agent ${agentName}: not registered`);
      return false;
    }

    agent.status = 'idle';
    agent.retryCount = 0;

    logger.info(`Reset agent: ${agentName}`);
    return true;
  }

  /**
   * Clear execution history for an agent
   */
  clearAgentHistory(agentName) {
    this.executionHistory = this.executionHistory.filter(
      exec => exec.agent !== agentName
    );

    logger.info(`Cleared execution history for agent: ${agentName}`);
  }

  /**
   * Clear all execution history
   */
  clearAllHistory() {
    this.executionHistory = [];
    logger.info('Cleared all execution history');
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentName) {
    if (!this.agents.has(agentName)) {
      logger.warn(`Cannot unregister agent ${agentName}: not registered`);
      return false;
    }

    this.agents.delete(agentName);
    this.clearAgentHistory(agentName);

    logger.info(`Unregistered agent: ${agentName}`);
    return true;
  }
}

// Singleton instance
let instance = null;

export function getAgentPool() {
  if (!instance) {
    instance = new AgentPool();
  }
  return instance;
}

export default AgentPool;
