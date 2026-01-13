/**
 * ReinforcementLearner - Q-learning for skill and action optimization
 *
 * Features:
 * - State-action value tracking (Q-table)
 * - Epsilon-greedy exploration with decay
 * - Thompson sampling for action selection
 * - Reward calculation from outcomes
 * - Policy persistence via KnowledgeBrain
 * - Integration with DecisionLogger for experience data
 *
 * @module foundation/learning/ReinforcementLearner
 */

import { EventEmitter } from 'events';
import { createLogger } from '../common/logger.js';
import { getEventBus } from '../event-bus/AgentEventBus.js';
import { LearningEvents } from '../event-bus/eventTypes.js';
import { getKnowledgeBrain } from '../knowledge-brain/KnowledgeBrain.js';
import { getDecisionLogger, DecisionType } from '../memory-store/DecisionLogger.js';

const logger = createLogger('ReinforcementLearner');

/**
 * Reward signal constants for consistent reward assignment
 */
export const REWARD_SIGNALS = {
  SUCCESS: 1.0,
  PARTIAL_SUCCESS: 0.5,
  FAILURE: -0.5,
  TIMEOUT: -0.3,
  USER_POSITIVE: 0.8,
  USER_NEGATIVE: -0.8,
  FAST_COMPLETION: 0.2,
  SLOW_COMPLETION: -0.1,
  QUALITY_BONUS: 0.3
};

/**
 * ReinforcementLearner class implementing Q-learning
 * @extends EventEmitter
 */
class ReinforcementLearner extends EventEmitter {
  constructor(options = {}) {
    super();

    this.logger = logger;
    this.eventBus = null;
    this.knowledgeBrain = null;
    this.decisionLogger = null;
    this.initialized = false;

    // Configuration with sensible defaults
    this.config = {
      learningRate: options.learningRate ?? 0.1,           // alpha
      discountFactor: options.discountFactor ?? 0.95,      // gamma
      explorationRate: options.explorationRate ?? 0.2,     // epsilon
      explorationDecay: options.explorationDecay ?? 0.995,
      minExploration: options.minExploration ?? 0.05,
      batchSize: options.batchSize ?? 32,
      saveInterval: options.saveInterval ?? 60000,         // Save policy every minute
      enableAutoSubscribe: options.enableAutoSubscribe ?? true,
      ...options
    };

    // Q-table: Map<stateKey, Map<action, qValue>>
    this.qTable = new Map();

    // Action success tracking for Thompson sampling
    // Map<action, {successes: number, failures: number}>
    this.actionSuccesses = new Map();

    // Episode tracking
    this.currentEpisode = [];
    this.episodeHistory = [];

    // Statistics
    this.stats = {
      totalUpdates: 0,
      averageReward: 0,
      explorationActions: 0,
      exploitationActions: 0,
      lastSaveTime: 0
    };

    // Auto-save interval reference
    this.saveIntervalId = null;
  }

  /**
   * Initialize the learner
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) return;

    try {
      this.eventBus = getEventBus();
      this.knowledgeBrain = getKnowledgeBrain();
      this.decisionLogger = getDecisionLogger();

      await this.knowledgeBrain.initialize();
      await this.decisionLogger.initialize();

      // Load saved policy from KnowledgeBrain
      await this._loadPolicy();

      // Subscribe to relevant events for automatic learning
      if (this.config.enableAutoSubscribe) {
        this._subscribeToEvents();
      }

      // Start auto-save interval
      if (this.config.saveInterval > 0) {
        this.saveIntervalId = setInterval(
          () => this.savePolicy(),
          this.config.saveInterval
        );
      }

      this.initialized = true;
      this.logger.info('ReinforcementLearner initialized', {
        stateCount: this.qTable.size,
        learningRate: this.config.learningRate,
        explorationRate: this.config.explorationRate
      });

    } catch (error) {
      this.logger.error('Failed to initialize ReinforcementLearner:', error);
      throw error;
    }
  }

  /**
   * Subscribe to events for automatic learning
   * @private
   */
  _subscribeToEvents() {
    // Learn from agent completions
    this.eventBus.subscribe('agent:completed', 'reinforcement-learner', async (data) => {
      if (data.state && data.action) {
        const reward = this.calculateReward({
          success: true,
          metrics: { duration: data.execution_time_ms }
        });
        await this.update(data.state, data.action, reward, data.nextState || {});
      }
    });

    // Learn from failures
    this.eventBus.subscribe('agent:failed', 'reinforcement-learner', async (data) => {
      if (data.state && data.action) {
        const reward = this.calculateReward({ success: false });
        await this.update(data.state, data.action, reward, data.nextState || {});
      }
    });

    this.logger.debug('Subscribed to agent events for automatic learning');
  }

  /**
   * Select an action given current state using epsilon-greedy strategy
   * @param {Object|string} state - Current state
   * @param {string[]} availableActions - Available actions to choose from
   * @returns {Object} Selected action with metadata {action, isExploration, stateKey}
   */
  selectAction(state, availableActions) {
    if (!availableActions || availableActions.length === 0) {
      throw new Error('No available actions provided');
    }

    const stateKey = this._stateToKey(state);
    let action, isExploration;

    // Epsilon-greedy selection
    if (Math.random() < this.config.explorationRate) {
      // Explore: random action
      this.stats.explorationActions++;
      action = this._randomSelect(availableActions);
      isExploration = true;
      this.logger.debug('Exploring with random action', { action, state: stateKey });
    } else {
      // Exploit: best known action
      this.stats.exploitationActions++;
      action = this._getBestAction(stateKey, availableActions);
      isExploration = false;
      this.logger.debug('Exploiting with best action', { action, state: stateKey });
    }

    // Publish action selection event
    this.eventBus?.publish(LearningEvents.ACTION_SELECTED, {
      agent: 'reinforcement-learner',
      state: stateKey,
      action,
      isExploration,
      explorationRate: this.config.explorationRate
    });

    return { action, isExploration, stateKey };
  }

  /**
   * Select action using Thompson Sampling
   * Better for exploring uncertain actions - samples from posterior distributions
   * @param {Object|string} state - Current state
   * @param {string[]} availableActions - Available actions to choose from
   * @returns {Object} Selected action with samples {action, sample, allSamples}
   */
  selectActionThompson(state, availableActions) {
    if (!availableActions || availableActions.length === 0) {
      throw new Error('No available actions provided');
    }

    // Sample from beta distributions for each action
    const samples = availableActions.map(action => {
      const stats = this.actionSuccesses.get(action) || { successes: 1, failures: 1 };
      const sample = this._sampleBeta(stats.successes, stats.failures);
      return { action, sample, stats };
    });

    // Select action with highest sample
    samples.sort((a, b) => b.sample - a.sample);

    const selected = samples[0];

    this.logger.debug('Thompson sampling selected action', {
      action: selected.action,
      sample: selected.sample
    });

    return {
      action: selected.action,
      sample: selected.sample,
      allSamples: samples
    };
  }

  /**
   * Update Q-value from experience (Q-learning update rule)
   * Q(s,a) = Q(s,a) + α[r + γ*max(Q(s',a')) - Q(s,a)]
   * @param {Object|string} state - State
   * @param {string} action - Action taken
   * @param {number} reward - Reward received
   * @param {Object|string} nextState - Next state (can be empty object for terminal states)
   * @returns {Promise<number>} New Q-value
   */
  async update(state, action, reward, nextState) {
    const stateKey = this._stateToKey(state);
    const nextStateKey = this._stateToKey(nextState);

    // Get current Q-value
    const currentQ = this._getQ(stateKey, action);

    // Get max Q-value for next state
    const maxNextQ = this._getMaxQ(nextStateKey);

    // Q-learning update: Q(s,a) = Q(s,a) + α[r + γ*max(Q(s',a')) - Q(s,a)]
    const newQ = currentQ + this.config.learningRate * (
      reward + this.config.discountFactor * maxNextQ - currentQ
    );

    // Update Q-table
    this._setQ(stateKey, action, newQ);

    // Update action success tracking for Thompson sampling
    this._updateActionStats(action, reward > 0);

    // Decay exploration rate
    this.config.explorationRate = Math.max(
      this.config.minExploration,
      this.config.explorationRate * this.config.explorationDecay
    );

    // Update statistics
    this.stats.totalUpdates++;
    const n = this.stats.totalUpdates;
    this.stats.averageReward = (this.stats.averageReward * (n - 1) + reward) / n;

    // Add to current episode
    this.currentEpisode.push({
      state: stateKey,
      action,
      reward,
      nextState: nextStateKey,
      timestamp: Date.now()
    });

    // Log decision to DecisionLogger
    if (this.decisionLogger) {
      await this.decisionLogger.logDecision({
        agent: 'reinforcement-learner',
        type: DecisionType.LEARNING_UPDATE,
        context: { state: stateKey, action },
        decision: { reward, newQ, explorationRate: this.config.explorationRate },
        reasoning: `Q-value updated from ${currentQ.toFixed(4)} to ${newQ.toFixed(4)}`,
        metadata: {
          previousQ: currentQ,
          newQ,
          reward,
          learningRate: this.config.learningRate,
          discountFactor: this.config.discountFactor
        }
      });
    }

    // Publish policy update event
    this.eventBus?.publish(LearningEvents.POLICY_UPDATED, {
      agent: 'reinforcement-learner',
      state: stateKey,
      action,
      reward,
      previousQ: currentQ,
      newQ,
      totalUpdates: this.stats.totalUpdates
    });

    // Emit local event
    this.emit('update', { stateKey, action, reward, previousQ: currentQ, newQ });

    return newQ;
  }

  /**
   * Calculate reward from outcome
   * @param {Object} outcome - Outcome details
   * @param {boolean} outcome.success - Whether the action succeeded
   * @param {boolean} [outcome.partial] - Whether it was a partial success
   * @param {Object} [outcome.metrics] - Performance metrics
   * @param {number} [outcome.metrics.duration] - Duration in ms
   * @param {number} [outcome.metrics.quality] - Quality score 0-1
   * @param {Object} [outcome.feedback] - User feedback
   * @param {number} [outcome.feedback.rating] - User rating 1-5
   * @returns {number} Calculated reward
   */
  calculateReward(outcome) {
    let reward = 0;

    // Base reward from success/failure
    if (outcome.success) {
      reward += REWARD_SIGNALS.SUCCESS;
    } else if (outcome.partial) {
      reward += REWARD_SIGNALS.PARTIAL_SUCCESS;
    } else {
      reward += REWARD_SIGNALS.FAILURE;
    }

    // Time bonus/penalty
    if (outcome.metrics?.duration !== undefined) {
      if (outcome.metrics.duration < 1000) {
        reward += REWARD_SIGNALS.FAST_COMPLETION;
      } else if (outcome.metrics.duration > 10000) {
        reward += REWARD_SIGNALS.SLOW_COMPLETION;
      }
    }

    // Quality bonus
    if (outcome.metrics?.quality !== undefined && outcome.metrics.quality > 0.8) {
      reward += REWARD_SIGNALS.QUALITY_BONUS;
    }

    // User feedback
    if (outcome.feedback?.rating !== undefined) {
      if (outcome.feedback.rating >= 4) {
        reward += REWARD_SIGNALS.USER_POSITIVE;
      } else if (outcome.feedback.rating <= 2) {
        reward += REWARD_SIGNALS.USER_NEGATIVE;
      }
    }

    // Timeout penalty
    if (outcome.timeout) {
      reward += REWARD_SIGNALS.TIMEOUT;
    }

    // Publish reward calculation event
    this.eventBus?.publish(LearningEvents.REWARD_CALCULATED, {
      agent: 'reinforcement-learner',
      outcome: {
        success: outcome.success,
        partial: outcome.partial,
        hasMetrics: !!outcome.metrics,
        hasFeedback: !!outcome.feedback
      },
      reward
    });

    return reward;
  }

  /**
   * End current episode and store it in history
   * Episodes are sequences of (state, action, reward) tuples
   */
  endEpisode() {
    if (this.currentEpisode.length > 0) {
      const episode = {
        id: `ep_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        steps: [...this.currentEpisode],
        totalReward: this.currentEpisode.reduce((sum, step) => sum + step.reward, 0),
        stepCount: this.currentEpisode.length,
        startTime: this.currentEpisode[0]?.timestamp || Date.now(),
        endTime: Date.now()
      };

      this.episodeHistory.push(episode);

      // Keep only last 100 episodes to prevent memory bloat
      if (this.episodeHistory.length > 100) {
        this.episodeHistory.shift();
      }

      // Reset current episode
      this.currentEpisode = [];

      // Publish episode ended event
      this.eventBus?.publish(LearningEvents.EPISODE_ENDED, {
        agent: 'reinforcement-learner',
        episodeId: episode.id,
        totalReward: episode.totalReward,
        steps: episode.stepCount,
        episodeCount: this.episodeHistory.length
      });

      this.emit('episode:ended', episode);

      this.logger.debug('Episode ended', {
        episodeId: episode.id,
        totalReward: episode.totalReward,
        steps: episode.stepCount
      });

      return episode;
    }
    return null;
  }

  /**
   * Sample from Beta distribution (approximation using Gamma)
   * Used for Thompson sampling
   * @param {number} alpha - Alpha parameter (successes + 1)
   * @param {number} beta - Beta parameter (failures + 1)
   * @returns {number} Sample from Beta(alpha, beta)
   * @private
   */
  _sampleBeta(alpha, beta) {
    const gammaAlpha = this._sampleGamma(alpha);
    const gammaBeta = this._sampleGamma(beta);
    return gammaAlpha / (gammaAlpha + gammaBeta);
  }

  /**
   * Sample from Gamma distribution (Marsaglia and Tsang's method)
   * @param {number} shape - Shape parameter
   * @returns {number} Sample from Gamma(shape, 1)
   * @private
   */
  _sampleGamma(shape) {
    if (shape < 1) {
      return this._sampleGamma(shape + 1) * Math.pow(Math.random(), 1 / shape);
    }

    const d = shape - 1/3;
    const c = 1 / Math.sqrt(9 * d);

    while (true) {
      let x, v;
      do {
        x = this._normalRandom();
        v = 1 + c * x;
      } while (v <= 0);

      v = v * v * v;
      const u = Math.random();

      if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  }

  /**
   * Generate standard normal random variable (Box-Muller transform)
   * @returns {number} Sample from N(0, 1)
   * @private
   */
  _normalRandom() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  /**
   * Get Q-value for a state-action pair
   * @param {string} stateKey - State key
   * @param {string} action - Action
   * @returns {number} Q-value (0 if not found)
   * @private
   */
  _getQ(stateKey, action) {
    const stateActions = this.qTable.get(stateKey);
    if (!stateActions) return 0;
    return stateActions.get(action) || 0;
  }

  /**
   * Set Q-value for a state-action pair
   * @param {string} stateKey - State key
   * @param {string} action - Action
   * @param {number} value - Q-value
   * @private
   */
  _setQ(stateKey, action, value) {
    if (!this.qTable.has(stateKey)) {
      this.qTable.set(stateKey, new Map());
    }
    this.qTable.get(stateKey).set(action, value);
  }

  /**
   * Get maximum Q-value for a state
   * @param {string} stateKey - State key
   * @returns {number} Maximum Q-value (0 if no actions)
   * @private
   */
  _getMaxQ(stateKey) {
    const stateActions = this.qTable.get(stateKey);
    if (!stateActions || stateActions.size === 0) return 0;
    return Math.max(...stateActions.values());
  }

  /**
   * Get best action for a state (highest Q-value)
   * @param {string} stateKey - State key
   * @param {string[]} availableActions - Available actions
   * @returns {string} Best action
   * @private
   */
  _getBestAction(stateKey, availableActions) {
    let bestAction = availableActions[0];
    let bestQ = -Infinity;

    for (const action of availableActions) {
      const q = this._getQ(stateKey, action);
      if (q > bestQ) {
        bestQ = q;
        bestAction = action;
      }
    }

    return bestAction;
  }

  /**
   * Update action success statistics for Thompson sampling
   * @param {string} action - Action
   * @param {boolean} success - Whether action was successful
   * @private
   */
  _updateActionStats(action, success) {
    if (!this.actionSuccesses.has(action)) {
      this.actionSuccesses.set(action, { successes: 1, failures: 1 }); // Prior: Beta(1,1)
    }

    const stats = this.actionSuccesses.get(action);
    if (success) {
      stats.successes++;
    } else {
      stats.failures++;
    }
  }

  /**
   * Convert state to string key for Q-table lookup
   * @param {Object|string} state - State object or string
   * @returns {string} State key
   * @private
   */
  _stateToKey(state) {
    if (typeof state === 'string') return state;
    if (state === null || state === undefined) return 'null';
    return JSON.stringify(state);
  }

  /**
   * Random selection from array
   * @param {any[]} array - Array to select from
   * @returns {any} Randomly selected element
   * @private
   */
  _randomSelect(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Save policy to KnowledgeBrain for persistence
   * @returns {Promise<void>}
   */
  async savePolicy() {
    if (!this.knowledgeBrain) return;

    const policy = {
      qTable: Array.from(this.qTable.entries()).map(([state, actions]) => ({
        state,
        actions: Array.from(actions.entries())
      })),
      actionSuccesses: Array.from(this.actionSuccesses.entries()),
      explorationRate: this.config.explorationRate,
      stats: { ...this.stats },
      config: {
        learningRate: this.config.learningRate,
        discountFactor: this.config.discountFactor,
        minExploration: this.config.minExploration
      },
      savedAt: Date.now()
    };

    await this.knowledgeBrain.storeRLPolicy(policy);
    this.stats.lastSaveTime = Date.now();

    this.logger.info('Policy saved', {
      states: this.qTable.size,
      actions: this.actionSuccesses.size
    });
  }

  /**
   * Load policy from KnowledgeBrain
   * @returns {Promise<void>}
   * @private
   */
  async _loadPolicy() {
    if (!this.knowledgeBrain) return;

    try {
      const policy = await this.knowledgeBrain.loadRLPolicy();

      if (policy) {
        // Restore Q-table
        if (policy.qTable) {
          for (const { state, actions } of policy.qTable) {
            this.qTable.set(state, new Map(actions));
          }
        }

        // Restore action successes
        if (policy.actionSuccesses) {
          for (const [action, stats] of policy.actionSuccesses) {
            this.actionSuccesses.set(action, stats);
          }
        }

        // Restore exploration rate (but respect config if provided)
        if (policy.explorationRate !== undefined && !this.config._explorationRateOverridden) {
          this.config.explorationRate = policy.explorationRate;
        }

        // Restore stats
        if (policy.stats) {
          this.stats = { ...this.stats, ...policy.stats };
        }

        this.logger.info('Policy loaded', {
          states: this.qTable.size,
          actions: this.actionSuccesses.size
        });
      }
    } catch (error) {
      this.logger.warn('Failed to load policy:', error);
    }
  }

  /**
   * Get Q-values for a specific state
   * @param {Object|string} state - State to query
   * @returns {Object} Q-values as {action: value} object
   */
  getQValues(state) {
    const stateKey = this._stateToKey(state);
    const stateActions = this.qTable.get(stateKey);
    if (!stateActions) return {};
    return Object.fromEntries(stateActions);
  }

  /**
   * Get all Q-values (entire Q-table)
   * @returns {Object} Q-table as nested object {state: {action: value}}
   */
  getAllQValues() {
    const result = {};
    for (const [state, actions] of this.qTable) {
      result[state] = Object.fromEntries(actions);
    }
    return result;
  }

  /**
   * Get action statistics for Thompson sampling
   * @param {string} action - Action to query
   * @returns {Object} Statistics {successes, failures}
   */
  getActionStats(action) {
    return this.actionSuccesses.get(action) || { successes: 0, failures: 0 };
  }

  /**
   * Get all action statistics
   * @returns {Object} All action stats as {action: {successes, failures}}
   */
  getAllActionStats() {
    return Object.fromEntries(this.actionSuccesses);
  }

  /**
   * Get learner statistics
   * @returns {Object} Statistics summary
   */
  getStats() {
    return {
      ...this.stats,
      stateCount: this.qTable.size,
      actionCount: this.actionSuccesses.size,
      explorationRate: this.config.explorationRate,
      episodeCount: this.episodeHistory.length,
      currentEpisodeSteps: this.currentEpisode.length,
      config: {
        learningRate: this.config.learningRate,
        discountFactor: this.config.discountFactor,
        minExploration: this.config.minExploration
      }
    };
  }

  /**
   * Get episode history
   * @param {number} [limit] - Maximum episodes to return
   * @returns {Object[]} Episode history
   */
  getEpisodeHistory(limit) {
    if (limit) {
      return this.episodeHistory.slice(-limit);
    }
    return [...this.episodeHistory];
  }

  /**
   * Get current episode steps
   * @returns {Object[]} Current episode steps
   */
  getCurrentEpisode() {
    return [...this.currentEpisode];
  }

  /**
   * Manually set exploration rate
   * @param {number} rate - New exploration rate (0-1)
   */
  setExplorationRate(rate) {
    if (rate < 0 || rate > 1) {
      throw new Error('Exploration rate must be between 0 and 1');
    }
    this.config.explorationRate = rate;
    this.config._explorationRateOverridden = true;
  }

  /**
   * Reset the learner (clear Q-table and statistics)
   * @param {boolean} [keepConfig=true] - Whether to keep configuration
   */
  reset(keepConfig = true) {
    this.qTable.clear();
    this.actionSuccesses.clear();
    this.currentEpisode = [];
    this.episodeHistory = [];
    this.stats = {
      totalUpdates: 0,
      averageReward: 0,
      explorationActions: 0,
      exploitationActions: 0,
      lastSaveTime: 0
    };

    if (!keepConfig) {
      this.config.explorationRate = 0.2;
    }

    this.logger.info('ReinforcementLearner reset');
  }

  /**
   * Shutdown the learner
   * @returns {Promise<void>}
   */
  async shutdown() {
    // Clear auto-save interval
    if (this.saveIntervalId) {
      clearInterval(this.saveIntervalId);
      this.saveIntervalId = null;
    }

    // Save policy before shutdown
    await this.savePolicy();

    this.initialized = false;
    this.logger.info('ReinforcementLearner shut down');
  }
}

// Singleton instance
let instance = null;

/**
 * Get the singleton ReinforcementLearner instance
 * @param {Object} [options] - Configuration options (only used on first call)
 * @returns {ReinforcementLearner} The singleton instance
 */
export function getReinforcementLearner(options = {}) {
  if (!instance) {
    instance = new ReinforcementLearner(options);
  }
  return instance;
}

/**
 * Reset the singleton (primarily for testing)
 */
export function resetReinforcementLearner() {
  if (instance) {
    // Clear interval to prevent memory leaks in tests
    if (instance.saveIntervalId) {
      clearInterval(instance.saveIntervalId);
    }
    instance = null;
  }
}

export { ReinforcementLearner };
export default ReinforcementLearner;
