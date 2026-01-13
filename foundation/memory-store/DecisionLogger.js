import { createLogger } from '../common/logger.js';
import { getMemoryStore, MemoryNamespace } from './MemoryStore.js';
import { getEventBus } from '../event-bus/AgentEventBus.js';

const logger = createLogger('DecisionLogger');

/**
 * Decision types for categorization
 */
export const DecisionType = {
  // Architecture decisions
  ARCHITECTURE: 'architecture',
  TECHNOLOGY_CHOICE: 'technology_choice',
  API_DESIGN: 'api_design',

  // Code decisions
  CODE_GENERATION: 'code_generation',
  CODE_MODIFICATION: 'code_modification',
  REFACTORING: 'refactoring',

  // Test decisions
  TEST_STRATEGY: 'test_strategy',
  FIX_STRATEGY: 'fix_strategy',

  // Planning decisions
  TASK_BREAKDOWN: 'task_breakdown',
  PRIORITIZATION: 'prioritization',
  DEPENDENCY_ORDER: 'dependency_order',

  // Error handling
  ERROR_HANDLING: 'error_handling',
  ROLLBACK: 'rollback',
  RECOVERY: 'recovery',

  // Agent coordination
  AGENT_DELEGATION: 'agent_delegation',
  CONFLICT_RESOLUTION: 'conflict_resolution',

  // Learning-specific types (Phase 0.1)
  SKILL_EXECUTION: 'skill_execution',
  PATTERN_DETECTED: 'pattern_detected',
  LEARNING_UPDATE: 'learning_update',
  REWARD_SIGNAL: 'reward_signal'
};

/**
 * Decision outcome status
 */
export const DecisionOutcome = {
  PENDING: 'pending',
  SUCCESS: 'success',
  PARTIAL_SUCCESS: 'partial_success',
  FAILED: 'failed',
  REVERTED: 'reverted',
  SUPERSEDED: 'superseded'
};

/**
 * Decision Logger - Captures all agent decisions with context and reasoning
 * Enables audit trails and learning from past decisions
 */
class DecisionLogger {
  constructor() {
    this.memoryStore = null;
    this.eventBus = null;
    this.initialized = false;
    this.pendingDecisions = new Map(); // Track in-flight decisions
    this.decisionListeners = [];

    // Learning-specific tracking (Phase 0.1)
    this.patternCounts = new Map(); // Track pattern occurrence counts for skill generation
  }

  /**
   * Initialize the decision logger
   */
  async initialize() {
    if (this.initialized) return;

    this.memoryStore = getMemoryStore();
    await this.memoryStore.initialize();

    this.eventBus = getEventBus();

    this.initialized = true;
    logger.info('Decision logger initialized');
  }

  /**
   * Ensure logger is initialized
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Log a new decision
   * @param {object} decision - Decision details
   * @param {string} decision.agent - Agent making the decision
   * @param {string} decision.type - Decision type from DecisionType enum
   * @param {object} decision.context - Context for the decision
   * @param {any} decision.decision - The actual decision made
   * @param {string} decision.reasoning - Reasoning behind the decision
   * @param {string} decision.parentDecisionId - Optional parent decision ID
   * @returns {string} Decision ID
   */
  async logDecision(decision) {
    await this.ensureInitialized();

    const decisionRecord = {
      id: this.generateDecisionId(),
      agent: decision.agent,
      type: decision.type || DecisionType.CODE_GENERATION,
      context: decision.context,
      decision: decision.decision,
      reasoning: decision.reasoning || null,
      outcome: DecisionOutcome.PENDING,
      timestamp: Date.now(),
      parentDecisionId: decision.parentDecisionId || null,
      metadata: decision.metadata || {}
    };

    // Store in memory
    await this.memoryStore.set(
      MemoryNamespace.DECISIONS,
      decisionRecord.id,
      decisionRecord
    );

    // Track as pending
    this.pendingDecisions.set(decisionRecord.id, decisionRecord);

    // Notify listeners
    this.notifyListeners('decision_logged', decisionRecord);

    // Publish event
    this.eventBus.publish('DECISION_LOGGED', {
      agent: decision.agent,
      decisionId: decisionRecord.id,
      type: decisionRecord.type
    });

    logger.debug(`Decision logged: ${decisionRecord.id} by ${decision.agent}`);

    return decisionRecord.id;
  }

  /**
   * Update decision outcome
   * @param {string} decisionId - Decision ID
   * @param {string} outcome - Outcome from DecisionOutcome enum
   * @param {object} details - Additional outcome details
   */
  async updateOutcome(decisionId, outcome, details = {}) {
    await this.ensureInitialized();

    const decision = await this.memoryStore.get(MemoryNamespace.DECISIONS, decisionId);

    if (!decision) {
      logger.warn(`Decision not found: ${decisionId}`);
      return;
    }

    decision.outcome = outcome;
    decision.outcomeDetails = details;
    decision.completedAt = Date.now();
    decision.duration = decision.completedAt - decision.timestamp;

    await this.memoryStore.set(MemoryNamespace.DECISIONS, decisionId, decision);

    // Remove from pending
    this.pendingDecisions.delete(decisionId);

    // Add to knowledge base if successful
    if (outcome === DecisionOutcome.SUCCESS && decision.reasoning) {
      await this.learnFromDecision(decision);
    }

    // Notify listeners
    this.notifyListeners('decision_completed', decision);

    logger.debug(`Decision ${decisionId} outcome: ${outcome}`);
  }

  /**
   * Learn from a successful decision - add to knowledge base
   * @param {object} decision - The successful decision
   */
  async learnFromDecision(decision) {
    await this.memoryStore.addKnowledge(
      'decision_patterns',
      `${decision.type}:${decision.agent}`,
      {
        context: decision.context,
        decision: decision.decision,
        reasoning: decision.reasoning
      },
      {
        source: `decision:${decision.id}`,
        confidence: 1.0
      }
    );
  }

  /**
   * Get decision by ID
   * @param {string} decisionId - Decision ID
   * @returns {object|null} Decision record
   */
  async getDecision(decisionId) {
    await this.ensureInitialized();
    return await this.memoryStore.get(MemoryNamespace.DECISIONS, decisionId);
  }

  /**
   * Query decisions with filters
   * @param {object} query - Query parameters
   * @param {string} query.agent - Filter by agent
   * @param {string} query.type - Filter by decision type
   * @param {string} query.outcome - Filter by outcome
   * @param {number} query.since - Filter by timestamp (after)
   * @param {number} query.until - Filter by timestamp (before)
   * @param {number} query.limit - Maximum results
   * @returns {object[]} Array of decisions
   */
  async queryDecisions(query = {}) {
    await this.ensureInitialized();

    const allDecisions = await this.memoryStore.getAll(MemoryNamespace.DECISIONS);
    let decisions = Object.values(allDecisions);

    // Apply filters
    if (query.agent) {
      decisions = decisions.filter(d => d.agent === query.agent);
    }

    if (query.type) {
      decisions = decisions.filter(d => d.type === query.type);
    }

    if (query.outcome) {
      decisions = decisions.filter(d => d.outcome === query.outcome);
    }

    if (query.since) {
      decisions = decisions.filter(d => d.timestamp >= query.since);
    }

    if (query.until) {
      decisions = decisions.filter(d => d.timestamp <= query.until);
    }

    // Sort by timestamp descending
    decisions.sort((a, b) => b.timestamp - a.timestamp);

    // Apply limit
    if (query.limit) {
      decisions = decisions.slice(0, query.limit);
    }

    return decisions;
  }

  /**
   * Get decision chain (decision and all its children)
   * @param {string} rootDecisionId - Root decision ID
   * @returns {object[]} Array of decisions in the chain
   */
  async getDecisionChain(rootDecisionId) {
    await this.ensureInitialized();

    const chain = [];
    const root = await this.getDecision(rootDecisionId);

    if (!root) return chain;

    chain.push(root);

    // Find all child decisions
    const allDecisions = await this.memoryStore.getAll(MemoryNamespace.DECISIONS);
    const children = Object.values(allDecisions)
      .filter(d => d.parentDecisionId === rootDecisionId)
      .sort((a, b) => a.timestamp - b.timestamp);

    for (const child of children) {
      const childChain = await this.getDecisionChain(child.id);
      chain.push(...childChain);
    }

    return chain;
  }

  /**
   * Get reasoning trail for a context
   * "Why was this built this way?"
   * @param {string} context - Context to query
   * @returns {object} Reasoning analysis
   */
  async getReasoningTrail(context) {
    await this.ensureInitialized();

    // Query the memory store for related decisions
    const analysis = await this.memoryStore.queryWhyBuiltThisWay(context);

    // Enhance with related patterns
    const relatedDecisions = await this.queryDecisions({
      outcome: DecisionOutcome.SUCCESS,
      limit: 50
    });

    // Find decisions with similar context
    const contextStr = typeof context === 'string' ? context : JSON.stringify(context);
    const similar = relatedDecisions.filter(d => {
      const decisionContext = JSON.stringify(d.context);
      return decisionContext.includes(contextStr) ||
             contextStr.includes(d.type);
    });

    return {
      query: context,
      directDecisions: analysis.decisions,
      similarDecisions: similar.slice(0, 10),
      patterns: analysis.patterns,
      relatedKnowledge: analysis.knowledge
    };
  }

  /**
   * Get agent's decision history
   * @param {string} agentName - Agent name
   * @param {object} options - Query options
   * @returns {object} Agent decision summary
   */
  async getAgentDecisionHistory(agentName, options = {}) {
    const decisions = await this.queryDecisions({
      agent: agentName,
      limit: options.limit || 100
    });

    const summary = {
      agent: agentName,
      totalDecisions: decisions.length,
      byType: {},
      byOutcome: {},
      recentDecisions: decisions.slice(0, 10),
      averageDuration: 0
    };

    let totalDuration = 0;
    let durationCount = 0;

    for (const decision of decisions) {
      // Count by type
      summary.byType[decision.type] = (summary.byType[decision.type] || 0) + 1;

      // Count by outcome
      summary.byOutcome[decision.outcome] = (summary.byOutcome[decision.outcome] || 0) + 1;

      // Calculate average duration
      if (decision.duration) {
        totalDuration += decision.duration;
        durationCount++;
      }
    }

    if (durationCount > 0) {
      summary.averageDuration = totalDuration / durationCount;
    }

    return summary;
  }

  /**
   * Register a decision listener
   * @param {function} listener - Listener function
   * @returns {function} Unsubscribe function
   */
  onDecision(listener) {
    this.decisionListeners.push(listener);
    return () => {
      const index = this.decisionListeners.indexOf(listener);
      if (index > -1) {
        this.decisionListeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners
   * @param {string} event - Event type
   * @param {object} data - Event data
   */
  notifyListeners(event, data) {
    for (const listener of this.decisionListeners) {
      try {
        listener(event, data);
      } catch (error) {
        logger.error('Error in decision listener:', error);
      }
    }
  }

  /**
   * Get pending decisions
   * @returns {object[]} Array of pending decisions
   */
  getPendingDecisions() {
    return Array.from(this.pendingDecisions.values());
  }

  /**
   * Get statistics about decisions
   * @returns {object} Statistics
   */
  async getStats() {
    await this.ensureInitialized();

    const allDecisions = await this.memoryStore.getAll(MemoryNamespace.DECISIONS);
    const decisions = Object.values(allDecisions);

    const stats = {
      totalDecisions: decisions.length,
      pendingDecisions: this.pendingDecisions.size,
      byAgent: {},
      byType: {},
      byOutcome: {},
      successRate: 0
    };

    let successCount = 0;
    let completedCount = 0;

    for (const decision of decisions) {
      stats.byAgent[decision.agent] = (stats.byAgent[decision.agent] || 0) + 1;
      stats.byType[decision.type] = (stats.byType[decision.type] || 0) + 1;
      stats.byOutcome[decision.outcome] = (stats.byOutcome[decision.outcome] || 0) + 1;

      if (decision.outcome !== DecisionOutcome.PENDING) {
        completedCount++;
        if (decision.outcome === DecisionOutcome.SUCCESS) {
          successCount++;
        }
      }
    }

    if (completedCount > 0) {
      stats.successRate = successCount / completedCount;
    }

    return stats;
  }

  /**
   * Generate unique decision ID
   * @returns {string} Decision ID
   */
  generateDecisionId() {
    return `dec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ============================================================================
  // LEARNING SYSTEM EXTENSIONS (Phase 0.1)
  // These methods support the self-learning system by tracking skill executions
  // and detecting patterns that can be converted into generated skills.
  // ============================================================================

  /**
   * Record a skill execution as a decision
   * Tracks skill executions for pattern detection and learning
   * @param {object} execution - Execution details
   * @param {string} execution.agent - Agent executing the skill
   * @param {string} execution.skill - Skill name
   * @param {any} execution.input - Skill input
   * @param {any} execution.output - Skill output
   * @param {boolean} execution.success - Whether execution succeeded
   * @param {number} execution.duration - Execution duration in ms
   * @param {string} [execution.error] - Error message if failed
   * @returns {Promise<string>} Decision ID
   */
  async logSkillExecution(execution) {
    await this.ensureInitialized();

    const { agent, skill, input, output, success, duration, error } = execution;

    const decisionId = await this.logDecision({
      agent,
      type: DecisionType.SKILL_EXECUTION,
      context: { skill, input },
      decision: { output, success, duration },
      reasoning: success ? 'Skill executed successfully' : `Failed: ${error || 'Unknown error'}`,
      metadata: {
        skillName: skill,
        executionTime: duration,
        success,
        error: error || null
      }
    });

    // Update outcome immediately since we know the result
    await this.updateOutcome(
      decisionId,
      success ? DecisionOutcome.SUCCESS : DecisionOutcome.FAILED,
      { duration, error }
    );

    // Track pattern for potential skill generation
    const pattern = `skill:${skill}:${success ? 'success' : 'failure'}`;
    this.incrementPattern(pattern);

    // Also track generic skill pattern
    this.incrementPattern(`skill:${skill}`);

    logger.debug(`Skill execution logged: ${skill} by ${agent}`, { success, duration });

    return decisionId;
  }

  /**
   * Increment pattern occurrence count
   * Emits events when threshold counts are reached for skill generation
   * @param {string} pattern - Pattern identifier (e.g., "skill:code-reviewer:success")
   * @returns {number} New count for the pattern
   */
  incrementPattern(pattern) {
    const count = (this.patternCounts.get(pattern) || 0) + 1;
    this.patternCounts.set(pattern, count);

    // Emit event at significant thresholds for skill generation consideration
    const thresholds = [3, 5, 10, 25, 50, 100];
    if (thresholds.includes(count)) {
      this.eventBus?.publish('LEARNING_PATTERN_DETECTED', {
        agent: 'decision-logger',
        pattern,
        count,
        timestamp: Date.now()
      });

      logger.debug(`Pattern threshold reached: ${pattern} (count: ${count})`);
    }

    return count;
  }

  /**
   * Get patterns that have occurred frequently
   * Used by DynamicSkillGenerator to identify candidates for skill generation
   * @param {number} [minCount=3] - Minimum occurrence count to include
   * @returns {Array<{pattern: string, count: number}>} Sorted array of frequent patterns
   */
  getFrequentPatterns(minCount = 3) {
    return Array.from(this.patternCounts.entries())
      .filter(([, count]) => count >= minCount)
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get experiences (skill executions) matching a pattern
   * Used by DynamicSkillGenerator to analyze patterns for skill synthesis
   * @param {string} pattern - Pattern to query (e.g., "skill:code-reviewer:success")
   * @param {number} [limit=100] - Maximum experiences to return
   * @returns {Promise<object[]>} Array of matching decision records
   */
  async getExperiencesForPattern(pattern, limit = 100) {
    await this.ensureInitialized();

    const decisions = await this.queryDecisions({
      type: DecisionType.SKILL_EXECUTION,
      limit: limit * 2 // Query more to filter
    });

    // Parse pattern to extract skill name and outcome filter
    const patternParts = pattern.split(':');
    const skillName = patternParts[1]; // e.g., "code-reviewer" from "skill:code-reviewer:success"
    const outcomeFilter = patternParts[2]; // e.g., "success" or "failure"

    return decisions.filter(d => {
      // Match by skill name
      if (d.metadata?.skillName !== skillName && !pattern.includes(d.metadata?.skillName)) {
        return false;
      }

      // If outcome specified in pattern, filter by it
      if (outcomeFilter === 'success' && d.outcome !== DecisionOutcome.SUCCESS) {
        return false;
      }
      if (outcomeFilter === 'failure' && d.outcome !== DecisionOutcome.FAILED) {
        return false;
      }

      return true;
    }).slice(0, limit);
  }

  /**
   * Calculate success rate for a specific skill
   * Used for reinforcement learning reward signals and skill evaluation
   * @param {string} skillName - Name of the skill
   * @returns {Promise<number>} Success rate between 0 and 1
   */
  async getSkillSuccessRate(skillName) {
    await this.ensureInitialized();

    const decisions = await this.queryDecisions({
      type: DecisionType.SKILL_EXECUTION
    });

    const skillDecisions = decisions.filter(d => d.metadata?.skillName === skillName);

    if (skillDecisions.length === 0) {
      return 0;
    }

    const successes = skillDecisions.filter(d => d.outcome === DecisionOutcome.SUCCESS).length;
    return successes / skillDecisions.length;
  }

  /**
   * Get skill execution statistics
   * Provides detailed metrics for a specific skill
   * @param {string} skillName - Name of the skill
   * @returns {Promise<object>} Skill statistics
   */
  async getSkillStats(skillName) {
    await this.ensureInitialized();

    const decisions = await this.queryDecisions({
      type: DecisionType.SKILL_EXECUTION
    });

    const skillDecisions = decisions.filter(d => d.metadata?.skillName === skillName);

    if (skillDecisions.length === 0) {
      return {
        skillName,
        executions: 0,
        successes: 0,
        failures: 0,
        successRate: 0,
        averageDuration: 0,
        agents: []
      };
    }

    const successes = skillDecisions.filter(d => d.outcome === DecisionOutcome.SUCCESS);
    const failures = skillDecisions.filter(d => d.outcome === DecisionOutcome.FAILED);
    const agents = [...new Set(skillDecisions.map(d => d.agent))];

    let totalDuration = 0;
    let durationCount = 0;
    for (const d of skillDecisions) {
      if (d.metadata?.executionTime) {
        totalDuration += d.metadata.executionTime;
        durationCount++;
      }
    }

    return {
      skillName,
      executions: skillDecisions.length,
      successes: successes.length,
      failures: failures.length,
      successRate: successes.length / skillDecisions.length,
      averageDuration: durationCount > 0 ? totalDuration / durationCount : 0,
      agents,
      recentExecutions: skillDecisions.slice(0, 10)
    };
  }

  /**
   * Reset pattern counts (primarily for testing)
   */
  resetPatternCounts() {
    this.patternCounts.clear();
    logger.debug('Pattern counts reset');
  }

  /**
   * Get current pattern counts
   * @returns {Map<string, number>} Pattern counts map
   */
  getPatternCounts() {
    return new Map(this.patternCounts);
  }
}

// Singleton instance
let instance = null;

/**
 * Get the singleton DecisionLogger instance
 * @returns {DecisionLogger} The singleton instance
 */
export function getDecisionLogger() {
  if (!instance) {
    instance = new DecisionLogger();
  }
  return instance;
}

/**
 * Reset the singleton (primarily for testing)
 */
export function resetDecisionLogger() {
  instance = null;
}

export default DecisionLogger;
