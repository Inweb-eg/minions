import { getEventBus } from '../../foundation/event-bus/AgentEventBus.js';
import { EventTypes } from '../../foundation/event-bus/eventTypes.js';
import { getMetricsCollector } from '../../foundation/metrics-collector/MetricsCollector.js';
import { getRollbackManager } from '../../foundation/rollback-manager/RollbackManager.js';
import { getDependencyGraph } from './dependency-graph.js';
import { getAutonomousLoopManager } from './autonomous-loop-manager.js';
import { createLogger } from '../../foundation/common/logger.js';

const logger = createLogger('Orchestrator');

// Dynamic agent registry - agents register themselves at runtime
const agentRegistry = new Map();

// Cache loaded agents
const loadedAgents = new Map();

/**
 * Orchestrates execution of multiple agents
 * Handles dependency resolution, parallel execution, error recovery, and autonomous loops
 *
 * This is a GENERIC orchestrator - agents register themselves dynamically
 */
class Orchestrator {
  constructor() {
    this.eventBus = getEventBus ? getEventBus() : null;
    this.metricsCollector = getMetricsCollector ? getMetricsCollector() : null;
    this.rollbackManager = getRollbackManager ? getRollbackManager() : null;
    this.dependencyGraph = getDependencyGraph ? getDependencyGraph() : null;
    this.autonomousLoopManager = getAutonomousLoopManager ? getAutonomousLoopManager() : null;
    this.maxConcurrency = 5; // Max agents running in parallel
    this.currentlyRunning = new Set();
    this.executionQueue = [];
    this.executionResults = new Map();
    this.isExecuting = false;
    this.validationAgents = []; // Agents that provide pre-execution validation (e.g., Tom)
    this.requireValidation = true; // Whether to require validation before execution
  }

  /**
   * Initialize the orchestrator
   */
  async initialize() {
    if (this.rollbackManager) {
      await this.rollbackManager.initialize();
    }
    if (this.metricsCollector) {
      this.metricsCollector.start();
    }

    logger.info('Orchestrator initialized with autonomous loop support');
  }

  /**
   * Register an agent with its loader function and dependencies
   * @param {string} agentName - Unique agent name
   * @param {Function} loaderFn - Async function that returns the agent instance
   * @param {Array<string>} dependencies - Array of agent names this agent depends on
   */
  registerAgent(agentName, loaderFn, dependencies = []) {
    agentRegistry.set(agentName, loaderFn);

    if (this.dependencyGraph) {
      this.dependencyGraph.addAgent(agentName, dependencies);
    }
    if (this.metricsCollector) {
      this.metricsCollector.registerAgent(agentName);
    }

    logger.info(`Registered agent: ${agentName} (dependencies: ${dependencies.join(', ') || 'none'})`);
  }

  /**
   * Register a validation agent (e.g., Tom for security validation)
   * @param {object} agent - Agent with validateBeforeExecution method
   */
  registerValidationAgent(agent) {
    if (agent && typeof agent.validateBeforeExecution === 'function') {
      this.validationAgents.push(agent);
      logger.info(`Registered validation agent: ${agent.name || agent.alias || 'unknown'}`);
    } else {
      logger.warn('Attempted to register invalid validation agent (missing validateBeforeExecution method)');
    }
  }

  /**
   * Unregister a validation agent
   * @param {object} agent - Agent to unregister
   */
  unregisterValidationAgent(agent) {
    const index = this.validationAgents.indexOf(agent);
    if (index > -1) {
      this.validationAgents.splice(index, 1);
      logger.info(`Unregistered validation agent: ${agent.name || agent.alias || 'unknown'}`);
    }
  }

  /**
   * Run pre-execution validation with all registered validation agents
   * @returns {object} Validation result with canProceed flag
   */
  async runPreExecutionValidation() {
    if (!this.requireValidation || this.validationAgents.length === 0) {
      return { canProceed: true, validations: [] };
    }

    logger.info('Running pre-execution validation...');
    const validations = [];
    let canProceed = true;

    for (const agent of this.validationAgents) {
      try {
        const result = await agent.validateBeforeExecution();
        validations.push({
          agent: agent.name || agent.alias || 'unknown',
          ...result
        });

        // Check if any critical errors prevent execution
        if (!result.valid && result.errors?.some(e => e.severity === 'critical')) {
          canProceed = false;
          logger.warn(`Validation failed for ${agent.name || agent.alias}: critical errors found`);
        }
      } catch (error) {
        logger.error(`Validation error for ${agent.name || agent.alias}: ${error.message}`);
        validations.push({
          agent: agent.name || agent.alias || 'unknown',
          valid: false,
          error: error.message
        });
      }
    }

    // Publish validation event
    if (this.eventBus) {
      this.eventBus.publish(EventTypes.PRE_EXECUTION_VALIDATION, {
        canProceed,
        validations,
        timestamp: Date.now()
      });
    }

    logger.info(`Pre-execution validation complete: ${canProceed ? 'PASSED' : 'FAILED'}`);
    return { canProceed, validations };
  }

  /**
   * Unregister an agent
   * @param {string} agentName - Agent name to unregister
   */
  unregisterAgent(agentName) {
    agentRegistry.delete(agentName);
    loadedAgents.delete(agentName);
    logger.info(`Unregistered agent: ${agentName}`);
  }

  /**
   * Get list of registered agents
   * @returns {Array<string>} List of agent names
   */
  getRegisteredAgents() {
    return Array.from(agentRegistry.keys());
  }

  /**
   * Build execution plan based on changed files
   */
  buildExecutionPlan(changedFiles = []) {
    if (!this.dependencyGraph) {
      return { groups: [], totalAgents: 0, affectedFiles: changedFiles };
    }

    let agentsToRun;

    if (changedFiles.length === 0) {
      // Run all agents if no specific files changed
      agentsToRun = Array.from(this.dependencyGraph.nodes.keys());
    } else {
      // Run only affected agents
      agentsToRun = this.dependencyGraph.getAffectedAgents(changedFiles);
    }

    // Build execution order
    this.dependencyGraph.buildExecutionOrder();
    const parallelGroups = this.dependencyGraph.getParallelGroups();

    // Filter to only include agents that need to run
    const filteredGroups = parallelGroups.map(group => ({
      level: group.level,
      agents: group.agents.filter(agent => agentsToRun.includes(agent))
    })).filter(group => group.agents.length > 0);

    logger.info(`Execution plan built: ${filteredGroups.length} levels, ${agentsToRun.length} total agents`);

    return {
      groups: filteredGroups,
      totalAgents: agentsToRun.length,
      affectedFiles: changedFiles
    };
  }

  /**
   * Execute the orchestration plan
   */
  async execute(changedFiles = []) {
    if (this.isExecuting) {
      throw new Error('Orchestration already in progress');
    }

    this.isExecuting = true;
    const startTime = Date.now();

    try {
      // Run pre-execution validation
      const validation = await this.runPreExecutionValidation();
      if (!validation.canProceed) {
        throw new Error(`Pre-execution validation failed: ${JSON.stringify(validation.validations)}`);
      }

      // Create checkpoint before execution
      let checkpointId = null;
      if (this.rollbackManager) {
        checkpointId = await this.rollbackManager.createCheckpoint('orchestration', {
          changedFiles,
          timestamp: startTime
        });
      }

      logger.info('Starting orchestration execution');

      // Build execution plan
      const plan = this.buildExecutionPlan(changedFiles);

      // Reset execution state
      this.executionResults.clear();
      this.currentlyRunning.clear();

      // Execute each level sequentially, but agents within a level in parallel
      for (const group of plan.groups) {
        logger.info(`Executing level ${group.level}: ${group.agents.join(', ')}`);

        await this.executeParallelGroup(group.agents);

        // Check if any agent failed
        const failures = group.agents.filter(agent => {
          const result = this.executionResults.get(agent);
          return result && !result.success;
        });

        if (failures.length > 0) {
          logger.error(`Agents failed: ${failures.join(', ')}`);

          // Rollback on failure
          if (this.rollbackManager && checkpointId) {
            await this.rollbackManager.rollback(checkpointId, `Agent failures: ${failures.join(', ')}`);
          }

          throw new Error(`Orchestration failed: ${failures.join(', ')}`);
        }
      }

      // Commit checkpoint on success
      if (this.rollbackManager && checkpointId) {
        await this.rollbackManager.commitCheckpoint(checkpointId);
      }

      const duration = Date.now() - startTime;
      logger.info(`Orchestration completed successfully in ${duration}ms`);

      return {
        success: true,
        duration,
        results: Object.fromEntries(this.executionResults),
        agentsExecuted: plan.totalAgents
      };

    } catch (error) {
      logger.error('Orchestration failed:', error);
      throw error;
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Execute a group of agents in parallel with concurrency control
   */
  async executeParallelGroup(agents) {
    const queue = [...agents];
    const executing = new Map(); // Map<agentName, {promise, settled}>

    while (queue.length > 0 || executing.size > 0) {
      // Start new agents up to maxConcurrency
      while (executing.size < this.maxConcurrency && queue.length > 0) {
        const agentName = queue.shift();
        const entry = { settled: false };

        // Wrap promise to track when it settles
        const promise = this.executeAgent(agentName)
          .then(result => {
            entry.settled = true;
            return result;
          })
          .catch(error => {
            entry.settled = true;
            throw error;
          });

        entry.promise = promise;
        executing.set(agentName, entry);
        this.currentlyRunning.add(agentName);
      }

      // Wait for at least one agent to complete
      if (executing.size > 0) {
        const promises = Array.from(executing.values()).map(e => e.promise);
        await Promise.race(promises.map(p => p.catch(() => {}))); // Catch to prevent unhandled rejection

        // Remove completed agents (those that have settled)
        for (const [agentName, entry] of executing) {
          if (entry.settled) {
            executing.delete(agentName);
          }
        }
      }
    }
  }

  /**
   * Load an agent by name
   */
  async loadAgent(agentName) {
    if (loadedAgents.has(agentName)) {
      return loadedAgents.get(agentName);
    }

    const loader = agentRegistry.get(agentName);
    if (!loader) {
      logger.warn(`No loader found for agent: ${agentName}`);
      return null;
    }

    try {
      const agent = await loader();
      if (agent) {
        loadedAgents.set(agentName, agent);
        return agent;
      }
    } catch (error) {
      logger.warn(`Failed to load agent ${agentName}: ${error.message}`);
    }

    return null;
  }

  /**
   * Execute a single agent
   */
  async executeAgent(agentName) {
    const startTime = Date.now();

    try {
      logger.info(`Starting agent: ${agentName}`);

      // Publish agent started event
      if (this.eventBus) {
        this.eventBus.publish(EventTypes.AGENT_STARTED, {
          agent: agentName,
          timestamp: startTime
        });
      }

      // Load and execute the actual agent
      const agent = await this.loadAgent(agentName);

      if (agent) {
        // Check if agent has an execute method
        if (typeof agent.execute === 'function') {
          await agent.execute();
        } else if (typeof agent.run === 'function') {
          await agent.run();
        } else if (typeof agent.analyze === 'function') {
          await agent.analyze();
        } else {
          // Agent loaded but no standard execution method
          logger.debug(`Agent ${agentName} loaded but has no standard execute method`);
        }
      } else {
        // Agent could not be loaded - just log and continue
        logger.debug(`Agent ${agentName} not available, skipping execution`);
      }

      const duration = Date.now() - startTime;

      // Record success
      this.executionResults.set(agentName, {
        success: true,
        duration,
        timestamp: startTime,
        agentLoaded: !!agent
      });

      if (this.metricsCollector) {
        this.metricsCollector.recordExecution(agentName, true, duration);
      }

      // Publish agent completed event
      if (this.eventBus) {
        this.eventBus.publish(EventTypes.AGENT_COMPLETED, {
          agent: agentName,
          execution_time_ms: duration
        });
      }

      logger.info(`Agent completed: ${agentName} (${duration}ms)`);

    } catch (error) {
      const duration = Date.now() - startTime;

      // Record failure
      this.executionResults.set(agentName, {
        success: false,
        error: error.message,
        duration,
        timestamp: startTime
      });

      if (this.metricsCollector) {
        this.metricsCollector.recordExecution(agentName, false, duration, error);
      }

      // Publish agent failed event
      if (this.eventBus) {
        this.eventBus.publish(EventTypes.AGENT_FAILED, {
          agent: agentName,
          error: error.message,
          execution_time_ms: duration
        });
      }

      logger.error(`Agent failed: ${agentName}:`, error);
      throw error;

    } finally {
      this.currentlyRunning.delete(agentName);
    }
  }

  /**
   * Get current execution status
   */
  getStatus() {
    return {
      isExecuting: this.isExecuting,
      currentlyRunning: Array.from(this.currentlyRunning),
      completedAgents: this.executionResults.size,
      registeredAgents: this.getRegisteredAgents(),
      results: Object.fromEntries(this.executionResults)
    };
  }

  /**
   * Stop execution (emergency stop)
   */
  async stop() {
    if (!this.isExecuting) {
      logger.warn('No execution in progress');
      return;
    }

    logger.warn('Emergency stop requested');
    this.isExecuting = false;

    // Wait for currently running agents to finish
    while (this.currentlyRunning.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    logger.info('Orchestration stopped');
  }
}

// Singleton instance
let instance = null;

export function getOrchestrator() {
  if (!instance) {
    instance = new Orchestrator();
  }
  return instance;
}

export default Orchestrator;
