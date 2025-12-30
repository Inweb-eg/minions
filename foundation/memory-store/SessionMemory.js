/**
 * SessionMemory - Short-term Context Layer
 * =========================================
 * Provides transient memory for conversation context and working state.
 *
 * Memory Hierarchy:
 * ├── Session Memory (this) - Per-session conversation context, auto-expires
 * ├── Working Memory (this) - Current task state, cleared on task completion
 * ├── Project Memory        - Per-project knowledge (MemoryStore)
 * ├── Solution Memory       - What worked/failed tracking
 * └── Pattern Memory        - Reusable templates (KnowledgeBrain)
 *
 * Features:
 * - Session-scoped storage with automatic TTL
 * - Working memory for in-progress task state
 * - Conversation history tracking
 * - Solution success/failure registry
 * - Integration with persistent MemoryStore
 */

import EventEmitter from 'events';
import { createLogger } from '../common/logger.js';
import { getMemoryStore, MemoryNamespace } from './MemoryStore.js';

const logger = createLogger('SessionMemory');

/**
 * Memory types
 */
export const MemoryType = {
  SESSION: 'session',
  WORKING: 'working',
  CONVERSATION: 'conversation',
  SOLUTION: 'solution'
};

/**
 * Solution outcome for tracking
 */
export const SolutionOutcome = {
  SUCCESS: 'success',
  PARTIAL: 'partial',
  FAILED: 'failed',
  REVERTED: 'reverted'
};

/**
 * SessionMemory - Short-term memory layer
 */
export class SessionMemory extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      sessionTTL: config.sessionTTL || 3600000, // 1 hour default
      workingTTL: config.workingTTL || 1800000, // 30 min default
      maxConversationHistory: config.maxConversationHistory || 100,
      maxSolutionHistory: config.maxSolutionHistory || 500,
      persistToStore: config.persistToStore !== false, // Default true
      ...config
    };

    // Session storage (per session ID)
    this.sessions = new Map();

    // Working memory (current task state)
    this.workingMemory = new Map();

    // Conversation history (per session)
    this.conversations = new Map();

    // Solution registry (what worked, what failed)
    this.solutions = {
      successful: [],
      failed: [],
      byContext: new Map() // Quick lookup by context hash
    };

    // Cleanup timer
    this._cleanupInterval = null;

    // Persistent store reference
    this._persistentStore = null;
  }

  /**
   * Initialize the session memory
   */
  async initialize() {
    logger.info('Initializing SessionMemory...');

    // Get persistent store if enabled
    if (this.config.persistToStore) {
      this._persistentStore = getMemoryStore();
      await this._persistentStore.initialize();
    }

    // Start cleanup timer
    this._startCleanup();

    logger.info('SessionMemory initialized');
    return { success: true };
  }

  // ==================== Session Memory ====================

  /**
   * Create or get a session
   * @param {string} sessionId - Session identifier
   * @returns {object} Session object
   */
  getSession(sessionId) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        id: sessionId,
        createdAt: Date.now(),
        lastAccess: Date.now(),
        context: {},
        metadata: {}
      });

      // Initialize conversation history for this session
      this.conversations.set(sessionId, []);

      this.emit('session:created', { sessionId });
    }

    const session = this.sessions.get(sessionId);
    session.lastAccess = Date.now();
    return session;
  }

  /**
   * Store session context
   * @param {string} sessionId - Session identifier
   * @param {string} key - Context key
   * @param {any} value - Context value
   */
  setSessionContext(sessionId, key, value) {
    const session = this.getSession(sessionId);
    session.context[key] = value;
    session.lastAccess = Date.now();

    this.emit('session:context:set', { sessionId, key });
  }

  /**
   * Get session context
   * @param {string} sessionId - Session identifier
   * @param {string} key - Context key (optional, returns all if not provided)
   * @returns {any} Context value or full context object
   */
  getSessionContext(sessionId, key = null) {
    const session = this.sessions.get(sessionId);
    if (!session) return key ? null : {};

    session.lastAccess = Date.now();
    return key ? session.context[key] : session.context;
  }

  /**
   * Close a session
   * @param {string} sessionId - Session identifier
   * @param {boolean} persist - Whether to persist to long-term memory
   */
  async closeSession(sessionId, persist = false) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Persist if requested and store is available
    if (persist && this._persistentStore) {
      await this._persistentStore.set(
        MemoryNamespace.SESSIONS,
        sessionId,
        {
          ...session,
          closedAt: Date.now(),
          conversation: this.conversations.get(sessionId) || []
        }
      );
    }

    this.sessions.delete(sessionId);
    this.conversations.delete(sessionId);

    this.emit('session:closed', { sessionId, persisted: persist });
  }

  // ==================== Working Memory ====================

  /**
   * Set working memory for current task
   * @param {string} taskId - Task identifier
   * @param {object} state - Task state
   */
  setWorkingState(taskId, state) {
    this.workingMemory.set(taskId, {
      ...state,
      taskId,
      updatedAt: Date.now(),
      createdAt: this.workingMemory.get(taskId)?.createdAt || Date.now()
    });

    this.emit('working:updated', { taskId });
  }

  /**
   * Get working memory for a task
   * @param {string} taskId - Task identifier
   * @returns {object|null} Task state
   */
  getWorkingState(taskId) {
    return this.workingMemory.get(taskId) || null;
  }

  /**
   * Update working memory partially
   * @param {string} taskId - Task identifier
   * @param {object} updates - Partial updates
   */
  updateWorkingState(taskId, updates) {
    const current = this.workingMemory.get(taskId) || { taskId };
    this.workingMemory.set(taskId, {
      ...current,
      ...updates,
      updatedAt: Date.now()
    });

    this.emit('working:updated', { taskId, updates: Object.keys(updates) });
  }

  /**
   * Clear working memory for a task
   * @param {string} taskId - Task identifier
   */
  clearWorkingState(taskId) {
    this.workingMemory.delete(taskId);
    this.emit('working:cleared', { taskId });
  }

  /**
   * Get all active working states
   * @returns {object[]} Array of working states
   */
  getAllWorkingStates() {
    return Array.from(this.workingMemory.values());
  }

  // ==================== Conversation History ====================

  /**
   * Add message to conversation history
   * @param {string} sessionId - Session identifier
   * @param {object} message - Message object { role, content, timestamp }
   */
  addConversationMessage(sessionId, message) {
    this.getSession(sessionId); // Ensure session exists

    const history = this.conversations.get(sessionId) || [];
    history.push({
      ...message,
      timestamp: message.timestamp || Date.now()
    });

    // Trim if exceeds max
    while (history.length > this.config.maxConversationHistory) {
      history.shift();
    }

    this.conversations.set(sessionId, history);
    this.emit('conversation:message', { sessionId, role: message.role });
  }

  /**
   * Get conversation history
   * @param {string} sessionId - Session identifier
   * @param {number} limit - Maximum messages to return
   * @returns {object[]} Conversation messages
   */
  getConversationHistory(sessionId, limit = null) {
    const history = this.conversations.get(sessionId) || [];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Get conversation context (last N messages formatted for LLM)
   * @param {string} sessionId - Session identifier
   * @param {number} contextWindow - Number of messages for context
   * @returns {object[]} Formatted messages for LLM
   */
  getConversationContext(sessionId, contextWindow = 10) {
    const history = this.getConversationHistory(sessionId, contextWindow);
    return history.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  // ==================== Solution Registry ====================

  /**
   * Register a solution attempt
   * @param {object} solution - Solution details
   * @param {string} solution.context - Problem context (e.g., "fix authentication bug")
   * @param {string} solution.approach - Approach taken
   * @param {string} solution.outcome - Outcome from SolutionOutcome
   * @param {object} solution.details - Additional details
   */
  registerSolution(solution) {
    const record = {
      id: `sol_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      context: solution.context,
      approach: solution.approach,
      outcome: solution.outcome,
      details: solution.details || {},
      timestamp: Date.now()
    };

    // Add to appropriate list
    if (solution.outcome === SolutionOutcome.SUCCESS) {
      this.solutions.successful.push(record);
      this._trimSolutionList(this.solutions.successful);
    } else {
      this.solutions.failed.push(record);
      this._trimSolutionList(this.solutions.failed);
    }

    // Index by context hash for quick lookup
    const contextHash = this._hashContext(solution.context);
    if (!this.solutions.byContext.has(contextHash)) {
      this.solutions.byContext.set(contextHash, []);
    }
    this.solutions.byContext.get(contextHash).push(record);

    this.emit('solution:registered', { id: record.id, outcome: solution.outcome });

    return record.id;
  }

  /**
   * Query solutions for a context
   * @param {string} context - Problem context to search
   * @returns {object} Solutions analysis
   */
  querySolutions(context) {
    const contextHash = this._hashContext(context);
    const directMatches = this.solutions.byContext.get(contextHash) || [];

    // Also search for partial matches in successful solutions
    const contextLower = context.toLowerCase();
    const relatedSuccesses = this.solutions.successful.filter(s =>
      s.context.toLowerCase().includes(contextLower) ||
      contextLower.includes(s.context.toLowerCase())
    );

    const relatedFailures = this.solutions.failed.filter(s =>
      s.context.toLowerCase().includes(contextLower) ||
      contextLower.includes(s.context.toLowerCase())
    );

    return {
      directMatches,
      relatedSuccesses: relatedSuccesses.slice(0, 5),
      relatedFailures: relatedFailures.slice(0, 5),
      recommendation: this._generateRecommendation(relatedSuccesses, relatedFailures)
    };
  }

  /**
   * Get successful approaches for a context type
   * @param {string} contextType - Type of problem (e.g., "authentication", "performance")
   * @returns {object[]} Successful approaches
   */
  getSuccessfulApproaches(contextType) {
    const typeLower = contextType.toLowerCase();
    return this.solutions.successful
      .filter(s => s.context.toLowerCase().includes(typeLower))
      .map(s => ({
        context: s.context,
        approach: s.approach,
        timestamp: s.timestamp
      }));
  }

  /**
   * Get approaches to avoid for a context type
   * @param {string} contextType - Type of problem
   * @returns {object[]} Failed approaches to avoid
   */
  getApproachesToAvoid(contextType) {
    const typeLower = contextType.toLowerCase();
    return this.solutions.failed
      .filter(s => s.context.toLowerCase().includes(typeLower))
      .map(s => ({
        context: s.context,
        approach: s.approach,
        reason: s.details?.failureReason || 'Unknown',
        timestamp: s.timestamp
      }));
  }

  // ==================== Statistics & Queries ====================

  /**
   * Get memory statistics
   * @returns {object} Statistics
   */
  getStats() {
    return {
      sessions: {
        active: this.sessions.size,
        totalConversations: Array.from(this.conversations.values())
          .reduce((sum, c) => sum + c.length, 0)
      },
      working: {
        activeTasks: this.workingMemory.size
      },
      solutions: {
        successful: this.solutions.successful.length,
        failed: this.solutions.failed.length,
        successRate: this._calculateSuccessRate()
      }
    };
  }

  /**
   * Get session summary
   * @param {string} sessionId - Session identifier
   * @returns {object} Session summary
   */
  getSessionSummary(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const conversation = this.conversations.get(sessionId) || [];

    return {
      id: sessionId,
      duration: Date.now() - session.createdAt,
      messageCount: conversation.length,
      contextKeys: Object.keys(session.context),
      lastActivity: new Date(session.lastAccess).toISOString()
    };
  }

  // ==================== Private Methods ====================

  _startCleanup() {
    // Run cleanup every 5 minutes
    this._cleanupInterval = setInterval(() => {
      this._cleanupExpired();
    }, 300000);
  }

  _cleanupExpired() {
    const now = Date.now();
    let cleanedSessions = 0;
    let cleanedWorking = 0;

    // Clean expired sessions
    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastAccess > this.config.sessionTTL) {
        this.sessions.delete(sessionId);
        this.conversations.delete(sessionId);
        cleanedSessions++;
      }
    }

    // Clean expired working memory
    for (const [taskId, state] of this.workingMemory) {
      if (now - state.updatedAt > this.config.workingTTL) {
        this.workingMemory.delete(taskId);
        cleanedWorking++;
      }
    }

    if (cleanedSessions > 0 || cleanedWorking > 0) {
      logger.debug(`Cleaned ${cleanedSessions} sessions, ${cleanedWorking} working states`);
    }
  }

  _trimSolutionList(list) {
    while (list.length > this.config.maxSolutionHistory) {
      list.shift();
    }
  }

  _hashContext(context) {
    // Simple hash for context lookup
    const str = context.toLowerCase().trim();
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  _generateRecommendation(successes, failures) {
    if (successes.length === 0 && failures.length === 0) {
      return 'No prior solutions found for this context.';
    }

    if (successes.length > failures.length) {
      const topApproach = successes[0];
      return `Recommended approach: "${topApproach.approach}" (worked ${successes.length} time(s))`;
    }

    if (failures.length > 0) {
      const commonFailure = failures[0];
      return `Avoid: "${commonFailure.approach}" (failed ${failures.length} time(s)). Try alternative approach.`;
    }

    return 'Mixed results. Review both successful and failed approaches.';
  }

  _calculateSuccessRate() {
    const total = this.solutions.successful.length + this.solutions.failed.length;
    if (total === 0) return 0;
    return this.solutions.successful.length / total;
  }

  /**
   * Reset all memory (for testing)
   */
  reset() {
    this.sessions.clear();
    this.workingMemory.clear();
    this.conversations.clear();
    this.solutions.successful = [];
    this.solutions.failed = [];
    this.solutions.byContext.clear();
  }

  /**
   * Shutdown
   */
  async shutdown() {
    logger.info('Shutting down SessionMemory...');

    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
      this._cleanupInterval = null;
    }

    // Persist active sessions if store is available
    if (this._persistentStore) {
      for (const [sessionId] of this.sessions) {
        await this.closeSession(sessionId, true);
      }
    }

    this.reset();
    this.removeAllListeners();

    logger.info('SessionMemory shutdown complete');
  }
}

// Singleton instance
let instance = null;

/**
 * Get the singleton SessionMemory instance
 * @param {object} config - Configuration options
 * @returns {SessionMemory} The singleton instance
 */
export function getSessionMemory(config = {}) {
  if (!instance) {
    instance = new SessionMemory(config);
  }
  return instance;
}

/**
 * Reset the singleton (primarily for testing)
 */
export async function resetSessionMemory() {
  if (instance) {
    await instance.shutdown();
    instance = null;
  }
}

export default SessionMemory;
