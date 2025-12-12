/**
 * Autonomous Loop Manager
 *
 * Manages the test → fix → verify autonomous loop
 * Coordinates agents to auto-fix test failures
 *
 * Architecture Pattern: Event-Driven Orchestration
 * Follows: Singleton pattern, async/await, EventBus integration
 *
 * This is a GENERIC implementation - platform-specific agent routing
 * is configured via registerAgentMatcher()
 */

import { getEventBus } from '../../foundation/event-bus/AgentEventBus.js';
import { EventTypes } from '../../foundation/event-bus/eventTypes.js';
import { createLogger } from '../../foundation/common/logger.js';
import { getMetricsCollector } from '../../foundation/metrics-collector/MetricsCollector.js';
import { getRollbackManager } from '../../foundation/rollback-manager/RollbackManager.js';
import { getAutoFixer } from '../skills/auto-fixer/index.js';

const logger = createLogger('AutonomousLoopManager');

/**
 * Autonomous Loop Manager
 * Coordinates the test-fix-verify cycle
 */
class AutonomousLoopManager {
  constructor() {
    this.eventBus = getEventBus ? getEventBus() : null;
    this.metricsCollector = getMetricsCollector ? getMetricsCollector() : null;
    this.rollbackManager = getRollbackManager ? getRollbackManager() : null;
    this.autoFixer = null; // Lazy-loaded to avoid circular deps

    // Loop state
    this.isRunning = false;
    this.currentLoop = null;
    this.loopHistory = [];
    this.maxIterations = 5; // Prevent infinite loops

    // Agent registry
    this.agents = new Map();

    // Agent matchers - functions that determine which agent handles a failure
    // Default matcher just returns 'default-agent'
    this.agentMatchers = [];

    // Unsubscribe functions
    this.unsubscribers = [];

    // Subscribe to test events
    if (this.eventBus) {
      this.subscribeToEvents();
    }

    logger.info('AutonomousLoopManager initialized');
  }

  /**
   * Get AutoFixer instance (lazy load)
   */
  getAutoFixer() {
    if (!this.autoFixer) {
      this.autoFixer = getAutoFixer({
        maxIterations: this.maxIterations,
        projectRoot: process.cwd()
      });
    }
    return this.autoFixer;
  }

  /**
   * Subscribe to relevant events
   */
  subscribeToEvents() {
    // Listen for test completion/failure
    this.unsubscribers.push(
      this.eventBus.subscribe(
        EventTypes.TESTS_COMPLETED,
        'autonomous-loop-manager',
        this.handleTestsCompleted.bind(this)
      )
    );

    this.unsubscribers.push(
      this.eventBus.subscribe(
        EventTypes.TESTS_FAILED,
        'autonomous-loop-manager',
        this.handleTestsFailed.bind(this)
      )
    );

    // Listen for agent completion
    this.unsubscribers.push(
      this.eventBus.subscribe(
        EventTypes.AGENT_COMPLETED,
        'autonomous-loop-manager',
        this.handleAgentCompleted.bind(this)
      )
    );

    // Listen for code generation
    this.unsubscribers.push(
      this.eventBus.subscribe(
        EventTypes.CODE_GENERATED,
        'autonomous-loop-manager',
        this.handleCodeGenerated.bind(this)
      )
    );

    logger.info('Subscribed to EventBus events');
  }

  /**
   * Cleanup subscriptions
   */
  cleanup() {
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
    this.unsubscribers = [];
    logger.info('Cleaned up event subscriptions');
  }

  /**
   * Register an agent for auto-fixing
   * @param {string} name - Agent name
   * @param {Object} agent - Agent instance with autoFix method
   */
  registerAgent(name, agent) {
    this.agents.set(name, agent);
    logger.info(`Registered agent: ${name}`);
  }

  /**
   * Register an agent matcher function
   * Matchers are called in order until one returns a non-null agent name
   *
   * @param {Function} matcherFn - Function(failure, platform) => agentName | null
   *
   * @example
   * // Route failures based on file path
   * loopManager.registerAgentMatcher((failure, platform) => {
   *   if (failure.file?.includes('api/')) return 'api-agent';
   *   if (failure.file?.includes('frontend/')) return 'frontend-agent';
   *   return null; // Let next matcher handle it
   * });
   */
  registerAgentMatcher(matcherFn) {
    this.agentMatchers.push(matcherFn);
    logger.info('Registered agent matcher function');
  }

  /**
   * Handle tests completed event (all passed)
   * @param {Object} data - Event data
   */
  async handleTestsCompleted(data) {
    logger.info('All tests passed!');

    if (this.currentLoop) {
      // Loop completed successfully
      await this.completeLoop('success', {
        iterations: this.currentLoop.iteration,
        duration: Date.now() - this.currentLoop.startTime,
        finalResult: data.results
      });
    }
  }

  /**
   * Handle tests failed event (trigger auto-fix)
   * @param {Object} data - Event data
   */
  async handleTestsFailed(data) {
    const failureCount = data.summary?.totalFailed || data.summary?.failed || 0;
    logger.warn(`Tests failed: ${failureCount} failures detected`);

    // Check if we're already in a loop
    if (this.currentLoop && this.currentLoop.iteration >= this.maxIterations) {
      logger.error(`Max iterations (${this.maxIterations}) reached. Aborting auto-fix loop.`);
      await this.completeLoop('max_iterations_reached', {
        iterations: this.currentLoop.iteration,
        remainingFailures: (data.failures || []).length
      });
      return;
    }

    // Start or continue the auto-fix loop
    await this.startAutoFixLoop(data);
  }

  /**
   * Start the autonomous auto-fix loop
   *
   * Architecture: Tiered Fix Strategy
   * ---------------------------------
   * 1. AutoFixer skill (pattern-based) - Quick fixes for common issues
   * 2. Platform Agents (domain experts) - Platform-specific fixes
   * 3. Results merged and remaining failures tracked
   *
   * @param {Object} testResults - Test results from Tester-Agent
   */
  async startAutoFixLoop(testResults) {
    try {
      // Initialize loop if not already running
      if (!this.currentLoop) {
        this.currentLoop = {
          id: this.generateLoopId(),
          startTime: Date.now(),
          iteration: 0,
          fixesApplied: [],
          originalFailures: (testResults.failures || []).length,
          tierResults: { autoFixer: null, platformAgents: null }
        };
        logger.info(`Starting autonomous loop: ${this.currentLoop.id}`);
      }

      this.currentLoop.iteration++;
      logger.info(`Loop iteration ${this.currentLoop.iteration}/${this.maxIterations}`);

      // Create checkpoint before applying fixes
      let checkpointId = null;
      if (this.rollbackManager) {
        checkpointId = await this.rollbackManager.createCheckpoint('auto-fix-loop', {
          loopId: this.currentLoop.id,
          iteration: this.currentLoop.iteration,
          failures: testResults.failures
        });
      }

      // ============================================
      // TIER 1: AutoFixer Skill (Pattern-based fixes)
      // ============================================
      logger.info('[Tier 1] Running AutoFixer skill for pattern-based fixes...');
      const autoFixer = this.getAutoFixer();
      await autoFixer.initialize();

      const autoFixResult = await autoFixer.handleTestFailure({
        testOutput: testResults.output || testResults.raw || '',
        platform: testResults.platform || 'default',
        failedTests: testResults.failures || []
      });

      this.currentLoop.tierResults.autoFixer = autoFixResult;
      const tier1Fixed = autoFixResult.fixes?.length || 0;
      logger.info(`[Tier 1] AutoFixer applied ${tier1Fixed} fixes`);

      // ============================================
      // TIER 2: Platform Agents (Domain-specific fixes)
      // ============================================
      // Only dispatch to platform agents if there are remaining failures
      const remainingFailures = autoFixResult.remainingFailures || [];

      if (remainingFailures.length > 0 && !autoFixResult.success) {
        logger.info(`[Tier 2] Dispatching ${remainingFailures.length} remaining failures to platform agents...`);

        // Group failures by platform/agent
        const agentTasks = this.groupFailuresByAgent(remainingFailures, testResults.platform);

        if (Object.keys(agentTasks).length > 0) {
          const platformResult = await this.triggerAgentFixes({ agentTasks });
          this.currentLoop.tierResults.platformAgents = platformResult;

          logger.info(`[Tier 2] Platform agents triggered for ${platformResult.fixesAttempted} fixes`);
        }
      }

      // ============================================
      // Record and evaluate results
      // ============================================
      this.currentLoop.fixesApplied.push({
        iteration: this.currentLoop.iteration,
        tier1: autoFixResult,
        tier2: this.currentLoop.tierResults.platformAgents,
        checkpointId
      });

      // Determine overall success
      const totalFixed = tier1Fixed + (this.currentLoop.tierResults.platformAgents?.fixesApplied || 0);

      if (autoFixResult.success) {
        logger.info(`Fix loop completed successfully: ${totalFixed} total fixes applied`);
        await this.completeLoop('success', {
          iterations: this.currentLoop.iteration,
          totalFixes: totalFixed,
          tier1Fixes: tier1Fixed,
          tier2Fixes: this.currentLoop.tierResults.platformAgents?.fixesApplied || 0
        });
      } else {
        logger.warn(`Fix loop partially completed: ${totalFixed} fixes applied, some issues remain`);

        // Log suggestions for manual review
        if (autoFixResult.suggestions && autoFixResult.suggestions.length > 0) {
          logger.info('Suggestions available for manual review:');
          autoFixResult.suggestions.forEach((s, i) => {
            logger.info(`  ${i + 1}. ${s.test}: ${s.message}`);
          });
        }

        await this.completeLoop('partial_fix', {
          iterations: this.currentLoop.iteration,
          totalFixes: totalFixed,
          tier1Fixes: tier1Fixed,
          tier2Fixes: this.currentLoop.tierResults.platformAgents?.fixesApplied || 0,
          message: autoFixResult.message,
          suggestions: autoFixResult.suggestions,
          remainingFailures: remainingFailures.length
        });
      }

    } catch (error) {
      logger.error('Error in auto-fix loop:', error.message);
      logger.error('Stack trace:', error.stack);
      await this.completeLoop('error', { error: error.message, stack: error.stack });
    }
  }

  /**
   * Group failures by target agent based on platform/file patterns
   * Uses registered agent matchers to determine routing
   *
   * @param {Array} failures - Remaining failures to fix
   * @param {string} defaultPlatform - Default platform from test results
   * @returns {Object} Tasks grouped by agent name
   */
  groupFailuresByAgent(failures, defaultPlatform) {
    const agentTasks = {};
    const defaultAgent = 'default-agent';

    failures.forEach(failure => {
      let targetAgent = null;

      // Try each matcher in order
      for (const matcher of this.agentMatchers) {
        try {
          targetAgent = matcher(failure, defaultPlatform);
          if (targetAgent) break;
        } catch (error) {
          logger.warn(`Agent matcher error: ${error.message}`);
        }
      }

      // Fall back to default agent if no matcher returned a result
      if (!targetAgent) {
        targetAgent = defaultAgent;
      }

      if (!agentTasks[targetAgent]) {
        agentTasks[targetAgent] = [];
      }

      agentTasks[targetAgent].push({
        ...failure,
        severity: this.inferSeverity(failure)
      });
    });

    return agentTasks;
  }

  /**
   * Analyze test failures and create fix strategy
   * @param {Object} testResults - Test results
   * @returns {Object} Fix strategy
   */
  async analyzeFailures(testResults) {
    const failures = testResults.failures || [];
    const strategy = {
      totalFailures: failures.length,
      autoFixableCount: 0,
      manualFixRequired: [],
      agentTasks: testResults.autoFixable || {}
    };

    // Count auto-fixable failures
    Object.values(strategy.agentTasks).forEach(tasks => {
      strategy.autoFixableCount += tasks.length;
    });

    // Identify failures that need manual intervention
    failures.forEach(failure => {
      if (!failure.autoFixable) {
        strategy.manualFixRequired.push({
          platform: failure.platform,
          test: failure.testName,
          severity: failure.severity,
          error: failure.error
        });
      }
    });

    // Prioritize by severity
    strategy.priority = this.prioritizeFixTasks(strategy);

    return strategy;
  }

  /**
   * Prioritize fix tasks by severity
   * @param {Object} strategy - Fix strategy
   * @returns {Array} Prioritized task list
   */
  prioritizeFixTasks(strategy) {
    const allTasks = [];

    // Collect all tasks with agent info
    Object.entries(strategy.agentTasks).forEach(([agent, tasks]) => {
      tasks.forEach(task => {
        allTasks.push({
          agent,
          ...task,
          severity: this.inferSeverity(task)
        });
      });
    });

    // Sort by severity: critical > high > medium > low
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    allTasks.sort((a, b) => {
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    return allTasks;
  }

  /**
   * Infer severity from task
   * @param {Object} task - Fix task
   * @returns {string} Severity level
   */
  inferSeverity(task) {
    const combined = (task.test || '') + (task.error || '');

    if (/security|auth|payment|transaction/i.test(combined)) return 'critical';
    if (/core|main|primary|data/i.test(combined)) return 'high';
    if (/feature|component|widget/i.test(combined)) return 'medium';
    return 'low';
  }

  /**
   * Trigger agents to apply fixes
   * @param {Object} strategy - Fix strategy
   * @returns {Object} Fix results
   */
  async triggerAgentFixes(strategy) {
    const results = {
      fixesApplied: 0,
      fixesAttempted: 0,
      failures: [],
      agentResults: {}
    };

    // Execute fixes in parallel (agents handle their own concurrency)
    const agentPromises = Object.entries(strategy.agentTasks).map(async ([agentName, tasks]) => {
      try {
        logger.info(`Triggering ${agentName} to fix ${tasks.length} issues`);

        // Publish event for agent to handle
        if (this.eventBus) {
          this.eventBus.publish(EventTypes.AUTO_FIX_REQUESTED, {
            agent: 'autonomous-loop-manager',
            targetAgent: agentName,
            action: 'auto-fix',
            tasks,
            loopId: this.currentLoop.id,
            iteration: this.currentLoop.iteration
          });
        }

        results.fixesAttempted += tasks.length;

        // Note: Actual fix results will come via AGENT_COMPLETED events
        return { agent: agentName, status: 'triggered', taskCount: tasks.length };

      } catch (error) {
        logger.error(`Error triggering ${agentName}:`, error);
        results.failures.push({
          agent: agentName,
          error: error.message
        });
        return { agent: agentName, status: 'failed', error: error.message };
      }
    });

    const agentResults = await Promise.all(agentPromises);
    results.agentResults = agentResults;

    // Count successfully triggered agents
    // Actual fix confirmation will come via AGENT_COMPLETED events
    const successfulTriggers = agentResults.filter(r => r.status === 'triggered');
    results.fixesApplied = successfulTriggers.reduce((sum, r) => sum + (r.taskCount || 0), 0);

    return results;
  }

  /**
   * Trigger test re-run after fixes applied
   */
  async triggerTestRerun() {
    logger.info('Triggering test re-run...');

    // Publish event to trigger tester-agent
    if (this.eventBus) {
      this.eventBus.publish(EventTypes.TESTS_STARTED, {
        agent: 'autonomous-loop-manager',
        reason: 'auto-fix-verification',
        loopId: this.currentLoop.id,
        iteration: this.currentLoop.iteration
      });
    }

    // Note: In real implementation, we would call tester-agent directly
    // or have it listen to this event
  }

  /**
   * Handle agent completed event
   * @param {Object} data - Event data
   */
  async handleAgentCompleted(data) {
    if (!this.currentLoop) return;

    logger.info(`Agent ${data.agent} completed execution`);

    // Track agent completion
    // In a full implementation, we would track which agents have completed
    // and only trigger test re-run when all required agents are done
  }

  /**
   * Handle code generated event
   * @param {Object} data - Event data
   */
  async handleCodeGenerated(data) {
    if (!this.currentLoop) return;

    logger.info(`Code generated by ${data.agent}`);

    // Track code generation
    // Could be used to trigger incremental testing
  }

  /**
   * Complete the autonomous loop
   * @param {string} status - Loop completion status
   * @param {Object} details - Completion details
   */
  async completeLoop(status, details = {}) {
    if (!this.currentLoop) return;

    const loopResult = {
      ...this.currentLoop,
      status,
      endTime: Date.now(),
      totalDuration: Date.now() - this.currentLoop.startTime,
      ...details
    };

    logger.info(`Loop ${this.currentLoop.id} completed with status: ${status}`);
    logger.info(`Total iterations: ${this.currentLoop.iteration}`);
    logger.info(`Total duration: ${loopResult.totalDuration}ms`);

    // Store in history
    this.loopHistory.push(loopResult);
    if (this.loopHistory.length > 100) {
      this.loopHistory.shift(); // Keep last 100 loops
    }

    // Record metrics
    if (this.metricsCollector) {
      this.metricsCollector.recordExecution('autonomous-loop', true, loopResult.totalDuration);
    }

    // Publish loop completion event
    if (this.eventBus) {
      this.eventBus.publish(EventTypes.AGENT_COMPLETED, {
        agent: 'autonomous-loop-manager',
        loopId: this.currentLoop.id,
        status,
        iterations: this.currentLoop.iteration,
        duration: loopResult.totalDuration,
        fixesApplied: this.currentLoop.fixesApplied.length
      });
    }

    // Reset current loop
    this.currentLoop = null;
    this.isRunning = false;
  }

  /**
   * Generate unique loop ID
   * @returns {string} Loop ID
   */
  generateLoopId() {
    return `loop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get loop history
   * @param {number} limit - Number of recent loops to return
   * @returns {Array} Loop history
   */
  getHistory(limit = 10) {
    return this.loopHistory.slice(-limit);
  }

  /**
   * Get current loop status
   * @returns {Object|null} Current loop state
   */
  getCurrentStatus() {
    return this.currentLoop;
  }

  /**
   * Set max iterations
   * @param {number} max - Maximum iterations
   */
  setMaxIterations(max) {
    this.maxIterations = max;
    logger.info(`Max iterations set to: ${max}`);
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance
 */
export function getAutonomousLoopManager() {
  if (!instance) {
    instance = new AutonomousLoopManager();
  }
  return instance;
}

export default AutonomousLoopManager;
