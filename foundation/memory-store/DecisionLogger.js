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
  CONFLICT_RESOLUTION: 'conflict_resolution'
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
