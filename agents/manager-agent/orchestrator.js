import { getEventBus } from '../../foundation/event-bus/AgentEventBus.js';
import { EventTypes } from '../../foundation/event-bus/eventTypes.js';
import { getMetricsCollector } from '../../foundation/metrics-collector/MetricsCollector.js';
import { getRollbackManager } from '../../foundation/rollback-manager/RollbackManager.js';
import { getDependencyGraph } from './dependency-graph.js';
import { getAutonomousLoopManager } from './autonomous-loop-manager.js';
import { createLogger } from '../../foundation/common/logger.js';
import { getHookManager, HookPoint } from '../../foundation/hooks/HookManager.js';
import { getStreamingExecutor, AbortReason } from '../../foundation/streaming/StreamingExecutor.js';
import { getErrorRecoveryPipeline } from '../../foundation/recovery/ErrorRecoveryPipeline.js';

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
    this.hookManager = null;
    this.streamingExecutor = null;
    this.recoveryPipeline = null;
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

    try { this.hookManager = getHookManager(); this.hookManager.initialize(); } catch (e) { /* optional */ }
    try { this.streamingExecutor = getStreamingExecutor(); this.streamingExecutor.initialize(); } catch (e) { /* optional */ }
    try {
      this.recoveryPipeline = getErrorRecoveryPipeline();
      this.recoveryPipeline.initialize({
        rollbackManager: this.rollbackManager,
        streamingExecutor: this.streamingExecutor
      });
    } catch (e) { /* optional */ }

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
      // Run pre-system hooks
      if (this.hookManager) {
        const hookResult = await this.hookManager.execute(HookPoint.PRE_SYSTEM_EXECUTION, {
          changedFiles, timestamp: startTime
        });
        if (!hookResult.allowed) {
          throw new Error(`Pre-system hook denied execution: ${hookResult.reason}`);
        }
      }

      // Run pre-execution validation
      const validation = await this.runPreExecutionValidation();
      if (!validation.canProceed) {
        throw new Error(`Pre-execution validation failed: ${JSON.stringify(validation.validations)}`);
      }

      // Create system-level AbortController
      if (this.streamingExecutor) {
        this.streamingExecutor.createSystemAbort();
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
        if (this.streamingExecutor && this.streamingExecutor.isSystemAborted()) {
          logger.warn('System aborted, stopping execution');
          break;
        }

        const groupId = `level-${group.level}-${Date.now()}`;
        logger.info(`Executing level ${group.level}: ${group.agents.join(', ')}`);

        await this.executeParallelGroup(group.agents, groupId, checkpointId);

        if (this.streamingExecutor) {
          this.streamingExecutor.markGroupCompleted(groupId);
          this.streamingExecutor.cleanupGroup(groupId);
        }

        // Check if any agent failed (only non-recovered failures)
        const failures = group.agents.filter(agent => {
          const result = this.executionResults.get(agent);
          return result && !result.success && !result.recovered && !result.skipped;
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

      // Run post-system hooks
      if (this.hookManager) {
        await this.hookManager.execute(HookPoint.POST_SYSTEM_EXECUTION, {
          results: Object.fromEntries(this.executionResults),
          duration: Date.now() - startTime
        });
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
      if (this.streamingExecutor) {
        this.streamingExecutor.reset();
      }
    }
  }

  /**
   * Execute a group of agents in parallel with concurrency control
   */
  async executeParallelGroup(agents, groupId = null, checkpointId = null) {
    if (this.streamingExecutor && groupId) {
      this.streamingExecutor.createGroupAbort(groupId);
    }

    const queue = [...agents];
    const executing = new Map();

    while (queue.length > 0 || executing.size > 0) {
      if (this.streamingExecutor && groupId) {
        const gc = this.streamingExecutor.groupControllers?.get(groupId);
        if (gc?.signal?.aborted || this.streamingExecutor.isSystemAborted()) {
          for (const a of queue) {
            this.executionResults.set(a, { success: false, error: 'Aborted', duration: 0, aborted: true });
          }
          queue.length = 0;
          break;
        }
      }

      while (executing.size < this.maxConcurrency && queue.length > 0) {
        const agentName = queue.shift();
        const entry = { settled: false };

        if (this.streamingExecutor && groupId) {
          this.streamingExecutor.createAgentAbort(agentName, groupId);
        }

        const promise = this.executeAgent(agentName, groupId, checkpointId)
          .then(result => {
            entry.settled = true;
            return result;
          })
          .catch(error => {
            entry.settled = true;
            if (error.critical && this.streamingExecutor && groupId) {
              this.streamingExecutor.abortGroup(groupId, AbortReason.CRITICAL_FAILURE, {
                cascade: true, sourceAgent: agentName
              });
            }
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
  async executeAgent(agentName, groupId = null, checkpointId = null) {
    const startTime = Date.now();

    try {
      logger.info(`Starting agent: ${agentName}`);

      // Run pre-agent hooks (includes permission check if installed)
      if (this.hookManager) {
        const hookResult = await this.hookManager.execute(HookPoint.PRE_AGENT_EXECUTION, {
          agentName, groupId, timestamp: startTime
        });
        if (!hookResult.allowed) {
          logger.warn(`Agent ${agentName} denied by hook: ${hookResult.reason}`);
          this.executionResults.set(agentName, {
            success: false, denied: true, reason: hookResult.reason,
            duration: Date.now() - startTime, timestamp: startTime
          });
          return;
        }
      }

      if (this.streamingExecutor) this.streamingExecutor.markStarted(agentName);

      if (this.eventBus) {
        this.eventBus.publish(EventTypes.AGENT_STARTED, { agent: agentName, timestamp: startTime });
      }

      if (this.streamingExecutor && this.streamingExecutor.isAborted(agentName)) {
        throw Object.assign(new Error(`Agent ${agentName} aborted`), { aborted: true });
      }

      const agent = await this.loadAgent(agentName);
      if (agent) {
        const signal = this.streamingExecutor ? this.streamingExecutor.getAgentSignal(agentName) : null;
        const opts = signal ? { signal } : undefined;
        if (typeof agent.execute === 'function') await agent.execute(opts);
        else if (typeof agent.run === 'function') await agent.run(opts);
        else if (typeof agent.analyze === 'function') await agent.analyze(opts);
        else logger.debug(`Agent ${agentName} loaded but has no standard execute method`);
      } else {
        logger.debug(`Agent ${agentName} not available, skipping execution`);
      }

      const duration = Date.now() - startTime;
      if (this.streamingExecutor) this.streamingExecutor.markCompleted(agentName);

      this.executionResults.set(agentName, {
        success: true, duration, timestamp: startTime, agentLoaded: !!agent
      });
      if (this.metricsCollector) this.metricsCollector.recordExecution(agentName, true, duration);
      if (this.hookManager) {
        await this.hookManager.execute(HookPoint.POST_AGENT_EXECUTION, { agentName, success: true, duration });
      }
      if (this.eventBus) {
        this.eventBus.publish(EventTypes.AGENT_COMPLETED, { agent: agentName, execution_time_ms: duration });
      }
      logger.info(`Agent completed: ${agentName} (${duration}ms)`);

    } catch (error) {
      const duration = Date.now() - startTime;
      if (this.streamingExecutor) this.streamingExecutor.markFailed(agentName, error);

      // Attempt recovery before recording failure
      if (this.recoveryPipeline && !error.aborted) {
        const self = this;
        const recovery = await this.recoveryPipeline.recover(agentName, error, {
          groupId, checkpointId,
          signal: this.streamingExecutor ? this.streamingExecutor.getAgentSignal(agentName) : null,
          retryFn: async () => {
            const a = await self.loadAgent(agentName);
            if (a && typeof a.execute === 'function') await a.execute();
            else if (a && typeof a.run === 'function') await a.run();
          }
        });
        if (recovery.recovered) {
          const td = Date.now() - startTime;
          this.executionResults.set(agentName, {
            success: true, [recovery.action === 'skipped' ? 'skipped' : 'recovered']: true,
            duration: td, timestamp: startTime, recoveryStage: recovery.stage
          });
          if (this.streamingExecutor) this.streamingExecutor.markCompleted(agentName);
          if (this.metricsCollector) this.metricsCollector.recordExecution(agentName, true, td);
          logger.info(`Agent ${agentName} recovered via ${recovery.stage} (${td}ms)`);
          return;
        }
      }

      this.executionResults.set(agentName, {
        success: false, error: error.message, duration, timestamp: startTime
      });
      if (this.metricsCollector) this.metricsCollector.recordExecution(agentName, false, duration, error);
      if (this.hookManager) {
        await this.hookManager.execute(HookPoint.POST_AGENT_EXECUTION, {
          agentName, success: false, error: error.message, duration
        });
      }
      if (this.eventBus) {
        this.eventBus.publish(EventTypes.AGENT_FAILED, {
          agent: agentName, error: error.message, execution_time_ms: duration
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
    if (this.streamingExecutor) this.streamingExecutor.abortSystem(AbortReason.USER_REQUESTED);
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
