# Minions Self-Learning & Self-Evolution Implementation Plan

## Version: 2.0 (Revised)
## Target: Self-Learning Agents with Dynamic Skill Generation
## Architecture Compliance: Strict adherence to Minions patterns

---

# Executive Summary

This plan introduces a **Self-Learning System** that enables Minions agents to:
1. **Learn from experience** - Leverage existing DecisionLogger & KnowledgeBrain
2. **Generate new skills dynamically** - Create skills from repeated patterns
3. **Evolve through reinforcement** - Improve based on Q-learning feedback
4. **Teach other agents** - Share learned skills across the system
5. **A/B test skills** - Compare skill variants for optimization

**Key Changes from v1.0:**
- Removed ExperienceCollector (DecisionLogger already provides this)
- Removed redundant pattern detection (KnowledgeBrain already has vector similarity)
- Extended existing components instead of duplicating
- Replaced vm2 with isolated-vm for security
- Reordered phases for better dependency flow
- Added production canary for generated skills

---

# Architecture Overview

```
+-----------------------------------------------------------------------------+
|                         SELF-LEARNING SYSTEM v2.0                            |
+-----------------------------------------------------------------------------+
|                                                                              |
|  +-----------------------------------------------------------------------+  |
|  |                    EXTENSIONS TO EXISTING COMPONENTS                   |  |
|  |  +------------------+  +------------------+  +----------------------+  |  |
|  |  | DecisionLogger   |  | KnowledgeBrain   |  | MetricsCollector     |  |  |
|  |  | (EXTEND)         |  | (EXTEND)         |  | (USE AS-IS)          |  |  |
|  |  |                  |  |                  |  |                      |  |  |
|  |  | + experience     |  | + LEARNED_SKILL  |  | Already tracks:      |  |  |
|  |  |   tracking       |  | + RL_POLICY      |  | - execution times    |  |  |
|  |  | + pattern counts |  | + EXPERIENCE     |  | - success rates      |  |  |
|  |  | + reward signals |  | + skill storage  |  | - health scores      |  |  |
|  |  +------------------+  +------------------+  +----------------------+  |  |
|  +-----------------------------------------------------------------------+  |
|                                                                              |
|  +-----------------------------------------------------------------------+  |
|  |                      NEW: REINFORCEMENT LEARNING                       |  |
|  |  +------------------+  +------------------+  +----------------------+  |  |
|  |  | Reinforcement    |  | RewardCalculator |  | PolicyStore          |  |  |
|  |  | Learner          |  | (integrated)     |  | (via KnowledgeBrain) |  |  |
|  |  |                  |  |                  |  |                      |  |  |
|  |  | - Q-learning     |  | - Success/fail   |  | - Q-table persist    |  |  |
|  |  | - Thompson       |  | - User feedback  |  | - Action stats       |  |  |
|  |  | - Epsilon-greedy |  | - Time bonuses   |  | - Episode history    |  |  |
|  |  +------------------+  +------------------+  +----------------------+  |  |
|  +-----------------------------------------------------------------------+  |
|                                                                              |
|  +-----------------------------------------------------------------------+  |
|  |                      NEW: SKILL EVOLUTION LAYER                        |  |
|  |  +------------------+  +------------------+  +----------------------+  |  |
|  |  | DynamicSkill     |  | SkillComposer    |  | SkillABTester        |  |  |
|  |  | Generator        |  |                  |  |                      |  |  |
|  |  |                  |  | - Combine skills |  | - Control/Variant    |  |  |
|  |  | - Pattern->Skill |  | - Sequential     |  | - Stats analysis     |  |  |
|  |  | - LLM synthesis  |  | - Parallel       |  | - Winner selection   |  |  |
|  |  | - isolated-vm    |  | - Conditional    |  | - Canary deployment  |  |  |
|  |  +------------------+  +------------------+  +----------------------+  |  |
|  +-----------------------------------------------------------------------+  |
|                                                                              |
|  +-----------------------------------------------------------------------+  |
|  |                      NEW: TEACHING LAYER                               |  |
|  |  +------------------+  +------------------+  +----------------------+  |  |
|  |  | CrossAgent       |  | SkillPackager    |  | MasteryValidator     |  |  |
|  |  | Teacher          |  |                  |  |                      |  |  |
|  |  |                  |  | - Serialize      |  | - Test mastery       |  |  |
|  |  | - Skill share    |  | - Dependencies   |  | - Confidence score   |  |  |
|  |  | - Curriculum     |  | - Versioning     |  | - Certification      |  |  |
|  |  +------------------+  +------------------+  +----------------------+  |  |
|  +-----------------------------------------------------------------------+  |
|                                                                              |
|  Integration Points (EXISTING - No Changes Needed):                          |
|  +------------+  +------------+  +------------+  +------------+             |
|  | EventBus   |  | BaseSkill  |  | Ollama     |  | Orchestr.  |             |
|  | (existing) |  | (existing) |  | (existing) |  | (existing) |             |
|  +------------+  +------------+  +------------+  +------------+             |
|                                                                              |
+-----------------------------------------------------------------------------+
```

---

# Directory Structure

```
foundation/
├── memory-store/
│   └── DecisionLogger.js            # EXTEND: Add experience methods
│
├── knowledge-brain/
│   └── KnowledgeBrain.js            # EXTEND: Add new KNOWLEDGE_TYPES
│
├── learning/                         # NEW: Self-Learning System
│   ├── index.js                      # Module exports and initialization
│   ├── ReinforcementLearner.js       # Q-learning implementation
│   ├── DynamicSkillGenerator.js      # Create skills from patterns
│   ├── SkillComposer.js              # Combine existing skills
│   ├── SkillABTester.js              # A/B testing framework
│   └── tests/
│       ├── reinforcementLearner.test.js
│       └── dynamicSkillGenerator.test.js
│
├── teaching/                         # NEW: Cross-Agent Teaching
│   ├── index.js                      # Module exports
│   ├── CrossAgentTeacher.js          # Agent-to-agent skill transfer
│   ├── SkillPackager.js              # Serialize skills for transfer
│   ├── MasteryValidator.js           # Validate skill acquisition
│   └── tests/
│       └── teaching.test.js
│
└── event-bus/
    └── eventTypes.js                 # EXTEND: Add learning events
```

---

# Phase 0: Extend Existing Components (Prerequisites)

## Feature 0.1: Extend DecisionLogger

### Description
Add experience-specific methods to DecisionLogger to support learning without duplicating functionality.

### File Location
`foundation/memory-store/DecisionLogger.js` (EXTEND)

### New Methods to Add

```javascript
// Add to DecisionLogger class

/**
 * Decision types extension for learning
 */
export const DecisionType = {
  // ... existing types ...

  // NEW: Learning-specific types
  SKILL_EXECUTION: 'skill_execution',
  PATTERN_DETECTED: 'pattern_detected',
  LEARNING_UPDATE: 'learning_update',
  REWARD_SIGNAL: 'reward_signal'
};

// Add to DecisionLogger class:

/**
 * Track pattern occurrence counts
 */
this.patternCounts = new Map();

/**
 * Record a skill execution as a decision
 * @param {Object} execution - Execution details
 */
async logSkillExecution(execution) {
  const { agent, skill, input, output, success, duration, error } = execution;

  const decisionId = await this.logDecision({
    agent,
    type: DecisionType.SKILL_EXECUTION,
    context: { skill, input },
    decision: { output, success, duration },
    reasoning: success ? 'Skill executed successfully' : `Failed: ${error}`,
    metadata: {
      skillName: skill,
      executionTime: duration,
      success
    }
  });

  // Track patterns
  const pattern = `skill:${skill}:${success ? 'success' : 'failure'}`;
  this.incrementPattern(pattern);

  return decisionId;
}

/**
 * Increment pattern count
 * @param {string} pattern - Pattern identifier
 */
incrementPattern(pattern) {
  const count = (this.patternCounts.get(pattern) || 0) + 1;
  this.patternCounts.set(pattern, count);

  // Emit event if threshold reached
  if (count === 3 || count === 5 || count === 10) {
    this.eventBus?.publish('LEARNING_PATTERN_DETECTED', {
      agent: 'decision-logger',
      pattern,
      count,
      timestamp: Date.now()
    });
  }

  return count;
}

/**
 * Get frequent patterns (candidates for skill generation)
 * @param {number} minCount - Minimum occurrence count
 */
getFrequentPatterns(minCount = 3) {
  return Array.from(this.patternCounts.entries())
    .filter(([, count]) => count >= minCount)
    .map(([pattern, count]) => ({ pattern, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Get experiences for a pattern (for RL training)
 * @param {string} pattern - Pattern to query
 */
async getExperiencesForPattern(pattern) {
  const decisions = await this.queryDecisions({
    type: DecisionType.SKILL_EXECUTION,
    limit: 100
  });

  return decisions.filter(d => {
    const skillPattern = `skill:${d.metadata?.skillName}:${d.outcome === 'success' ? 'success' : 'failure'}`;
    return skillPattern === pattern || pattern.includes(d.metadata?.skillName);
  });
}

/**
 * Calculate success rate for a skill
 * @param {string} skillName - Skill name
 */
async getSkillSuccessRate(skillName) {
  const decisions = await this.queryDecisions({
    type: DecisionType.SKILL_EXECUTION
  });

  const skillDecisions = decisions.filter(d => d.metadata?.skillName === skillName);
  if (skillDecisions.length === 0) return 0;

  const successes = skillDecisions.filter(d => d.outcome === 'success').length;
  return successes / skillDecisions.length;
}
```

### Implementation Tasks
- Task 0.1.1: Add new DecisionType constants
- Task 0.1.2: Add patternCounts Map to constructor
- Task 0.1.3: Implement logSkillExecution method
- Task 0.1.4: Implement incrementPattern method
- Task 0.1.5: Implement getFrequentPatterns method
- Task 0.1.6: Implement getExperiencesForPattern method
- Task 0.1.7: Implement getSkillSuccessRate method
- Task 0.1.8: Add unit tests for new methods

---

## Feature 0.2: Extend KnowledgeBrain

### Description
Add new knowledge types for learning system artifacts.

### File Location
`foundation/knowledge-brain/KnowledgeBrain.js` (EXTEND)

### New Constants

```javascript
// Extend KNOWLEDGE_TYPES
const KNOWLEDGE_TYPES = {
  // ... existing types ...

  // NEW: Learning-specific types
  LEARNED_SKILL: 'learned_skill',       // Dynamically generated skills
  RL_POLICY: 'rl_policy',               // Reinforcement learning policies
  EXPERIENCE: 'experience',             // Raw experience records
  SKILL_TEST_RESULT: 'skill_test_result', // A/B test results
  TEACHING_CURRICULUM: 'teaching_curriculum' // Cross-agent teaching plans
};
```

### New Methods

```javascript
/**
 * Store a generated skill
 * @param {Object} skill - Generated skill object
 */
async storeLearnedSkill(skill) {
  return this.learn({
    type: KNOWLEDGE_TYPES.LEARNED_SKILL,
    content: skill,
    tags: ['generated-skill', skill.sourcePattern, skill.name],
    quality: QUALITY_LEVELS.EXPERIMENTAL,
    metadata: {
      generatedAt: Date.now(),
      confidence: skill.metadata?.confidence || 0,
      activations: 0
    }
  });
}

/**
 * Get learned skills
 * @param {Object} query - Query parameters
 */
async getLearnedSkills(query = {}) {
  return this.recall({
    type: KNOWLEDGE_TYPES.LEARNED_SKILL,
    ...query
  });
}

/**
 * Store RL policy
 * @param {Object} policy - Policy data
 */
async storeRLPolicy(policy) {
  // Use fixed ID for singleton policy
  const existing = await this.recall({
    type: KNOWLEDGE_TYPES.RL_POLICY,
    limit: 1
  });

  if (existing.length > 0) {
    // Update existing
    const item = existing[0];
    item.content = policy;
    item.lastAccessed = Date.now();
    await this.persistItem(item);
    return item;
  }

  return this.learn({
    type: KNOWLEDGE_TYPES.RL_POLICY,
    content: policy,
    tags: ['reinforcement-learning', 'policy'],
    quality: QUALITY_LEVELS.VERIFIED
  });
}

/**
 * Load RL policy
 */
async loadRLPolicy() {
  const results = await this.recall({
    type: KNOWLEDGE_TYPES.RL_POLICY,
    limit: 1
  });
  return results[0]?.content || null;
}

/**
 * Update skill activation count
 * @param {string} skillId - Skill ID
 * @param {boolean} success - Whether activation succeeded
 */
async updateSkillActivation(skillId, success) {
  const item = this.knowledge.get(skillId);
  if (item && item.type === KNOWLEDGE_TYPES.LEARNED_SKILL) {
    item.metadata.activations = (item.metadata.activations || 0) + 1;
    if (success) {
      item.metadata.successes = (item.metadata.successes || 0) + 1;
    }
    item.metadata.successRate = item.metadata.activations > 0
      ? (item.metadata.successes || 0) / item.metadata.activations
      : 0;

    await this.persistItem(item);
  }
}
```

### Implementation Tasks
- Task 0.2.1: Add new KNOWLEDGE_TYPES constants
- Task 0.2.2: Implement storeLearnedSkill method
- Task 0.2.3: Implement getLearnedSkills method
- Task 0.2.4: Implement storeRLPolicy method
- Task 0.2.5: Implement loadRLPolicy method
- Task 0.2.6: Implement updateSkillActivation method
- Task 0.2.7: Add unit tests for new methods

---

## Feature 0.3: Extend EventTypes

### Description
Add learning-specific event types.

### File Location
`foundation/event-bus/eventTypes.js` (EXTEND)

### New Event Types

```javascript
// Learning Events
export const LearningEvents = {
  // Pattern detection
  LEARNING_PATTERN_DETECTED: 'learning:pattern:detected',
  LEARNING_PATTERN_THRESHOLD: 'learning:pattern:threshold',

  // Skill generation
  LEARNING_SKILL_GENERATING: 'learning:skill:generating',
  LEARNING_SKILL_GENERATED: 'learning:skill:generated',
  LEARNING_SKILL_VALIDATED: 'learning:skill:validated',
  LEARNING_SKILL_DEPLOYED: 'learning:skill:deployed',
  LEARNING_SKILL_FAILED: 'learning:skill:failed',

  // Reinforcement learning
  LEARNING_REWARD_CALCULATED: 'learning:reward:calculated',
  LEARNING_POLICY_UPDATED: 'learning:policy:updated',
  LEARNING_ACTION_SELECTED: 'learning:action:selected',
  LEARNING_EPISODE_ENDED: 'learning:episode:ended',

  // A/B Testing
  LEARNING_ABTEST_STARTED: 'learning:abtest:started',
  LEARNING_ABTEST_COMPLETED: 'learning:abtest:completed',
  LEARNING_ABTEST_WINNER: 'learning:abtest:winner',

  // Teaching
  TEACHING_SKILL_SHARED: 'teaching:skill:shared',
  TEACHING_SKILL_RECEIVED: 'teaching:skill:received',
  TEACHING_MASTERY_ACHIEVED: 'teaching:mastery:achieved',
  TEACHING_CURRICULUM_CREATED: 'teaching:curriculum:created'
};

// Add to EventTypes aggregate
export const EventTypes = {
  // ... existing ...
  ...LearningEvents
};
```

### Implementation Tasks
- Task 0.3.1: Add LearningEvents constant object
- Task 0.3.2: Export LearningEvents
- Task 0.3.3: Add to EventTypes aggregate

---

# Phase 1: Reinforcement Learning (Foundation)

## Feature 1.1: ReinforcementLearner

### Description
Implements Q-learning to optimize skill and action selection based on feedback and outcomes.

### File Location
`foundation/learning/ReinforcementLearner.js`

### Pattern Compliance
- Extends EventEmitter
- Singleton pattern with `getReinforcementLearner()`
- Uses KnowledgeBrain for policy persistence
- Uses DecisionLogger for experience data
- Publishes to EventBus

### Class Structure

```javascript
/**
 * ReinforcementLearner - Q-learning for skill optimization
 *
 * Features:
 * - State-action value tracking (Q-table)
 * - Epsilon-greedy exploration
 * - Thompson sampling for action selection
 * - Reward calculation from outcomes
 * - Policy persistence via KnowledgeBrain
 * - Integration with DecisionLogger for experiences
 */

import { EventEmitter } from 'events';
import { createLogger } from '../common/logger.js';
import { getEventBus } from '../event-bus/AgentEventBus.js';
import { LearningEvents } from '../event-bus/eventTypes.js';
import { getKnowledgeBrain } from '../knowledge-brain/KnowledgeBrain.js';
import { getDecisionLogger } from '../memory-store/DecisionLogger.js';

const logger = createLogger('ReinforcementLearner');

// Reward constants
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

class ReinforcementLearner extends EventEmitter {
  constructor(options = {}) {
    super();

    this.logger = logger;
    this.eventBus = null;
    this.knowledgeBrain = null;
    this.decisionLogger = null;
    this.initialized = false;

    // Configuration
    this.config = {
      learningRate: options.learningRate || 0.1,        // alpha
      discountFactor: options.discountFactor || 0.95,   // gamma
      explorationRate: options.explorationRate || 0.2,  // epsilon
      explorationDecay: options.explorationDecay || 0.995,
      minExploration: options.minExploration || 0.05,
      batchSize: options.batchSize || 32,
      saveInterval: options.saveInterval || 60000,      // Save policy every minute
      ...options
    };

    // Q-table: Map<stateKey, Map<action, qValue>>
    this.qTable = new Map();

    // Action success tracking for Thompson sampling
    this.actionSuccesses = new Map();  // action -> {successes, failures}

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

    // Auto-save interval
    this.saveIntervalId = null;
  }

  /**
   * Initialize the learner
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

      // Subscribe to relevant events
      this._subscribeToEvents();

      // Start auto-save
      this.saveIntervalId = setInterval(
        () => this.savePolicy(),
        this.config.saveInterval
      );

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
   */
  _subscribeToEvents() {
    // Learn from agent completions
    this.eventBus.subscribe('AGENT_COMPLETED', 'reinforcement-learner', async (data) => {
      if (data.state && data.action) {
        const reward = this.calculateReward({
          success: true,
          metrics: { duration: data.execution_time_ms }
        });
        await this.update(data.state, data.action, reward, data.nextState || {});
      }
    });

    // Learn from failures
    this.eventBus.subscribe('AGENT_FAILED', 'reinforcement-learner', async (data) => {
      if (data.state && data.action) {
        const reward = this.calculateReward({ success: false });
        await this.update(data.state, data.action, reward, data.nextState || {});
      }
    });
  }

  /**
   * Select an action given current state
   * @param {Object|string} state - Current state
   * @param {string[]} availableActions - Available actions
   * @returns {Object} Selected action with metadata
   */
  selectAction(state, availableActions) {
    if (availableActions.length === 0) {
      throw new Error('No available actions');
    }

    const stateKey = this._stateToKey(state);
    let action, isExploration;

    // Epsilon-greedy with decay
    if (Math.random() < this.config.explorationRate) {
      // Explore: random action
      this.stats.explorationActions++;
      action = this._randomSelect(availableActions);
      isExploration = true;
      this.logger.debug('Exploring with random action', { action });
    } else {
      // Exploit: best known action
      this.stats.exploitationActions++;
      action = this._getBestAction(stateKey, availableActions);
      isExploration = false;
      this.logger.debug('Exploiting with best action', { action });
    }

    // Publish event
    this.eventBus?.publish(LearningEvents.LEARNING_ACTION_SELECTED, {
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
   * Better for exploring uncertain actions
   * @param {Object|string} state - Current state
   * @param {string[]} availableActions - Available actions
   * @returns {Object} Selected action with samples
   */
  selectActionThompson(state, availableActions) {
    if (availableActions.length === 0) {
      throw new Error('No available actions');
    }

    // Sample from beta distributions for each action
    const samples = availableActions.map(action => {
      const stats = this.actionSuccesses.get(action) || { successes: 1, failures: 1 };
      const sample = this._sampleBeta(stats.successes, stats.failures);
      return { action, sample, stats };
    });

    // Select action with highest sample
    samples.sort((a, b) => b.sample - a.sample);

    return {
      action: samples[0].action,
      sample: samples[0].sample,
      allSamples: samples
    };
  }

  /**
   * Update Q-value from experience
   * @param {Object|string} state - State
   * @param {string} action - Action taken
   * @param {number} reward - Reward received
   * @param {Object|string} nextState - Next state
   * @returns {number} New Q-value
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

    // Update action success tracking
    this._updateActionStats(action, reward > 0);

    // Decay exploration rate
    this.config.explorationRate = Math.max(
      this.config.minExploration,
      this.config.explorationRate * this.config.explorationDecay
    );

    // Update stats
    this.stats.totalUpdates++;
    const n = this.stats.totalUpdates;
    this.stats.averageReward = (this.stats.averageReward * (n - 1) + reward) / n;

    // Add to current episode
    this.currentEpisode.push({ state: stateKey, action, reward, nextState: nextStateKey });

    // Log decision
    await this.decisionLogger?.logDecision({
      agent: 'reinforcement-learner',
      type: 'LEARNING_UPDATE',
      context: { state: stateKey, action },
      decision: { reward, newQ, explorationRate: this.config.explorationRate },
      reasoning: `Q-value updated from ${currentQ.toFixed(3)} to ${newQ.toFixed(3)}`
    });

    // Publish event
    this.eventBus?.publish(LearningEvents.LEARNING_POLICY_UPDATED, {
      agent: 'reinforcement-learner',
      state: stateKey,
      action,
      reward,
      newQ,
      totalUpdates: this.stats.totalUpdates
    });

    this.emit('update', { stateKey, action, reward, newQ });

    return newQ;
  }

  /**
   * Calculate reward from outcome
   * @param {Object} outcome - Outcome details
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
    if (outcome.metrics?.duration) {
      if (outcome.metrics.duration < 1000) {
        reward += REWARD_SIGNALS.FAST_COMPLETION;
      } else if (outcome.metrics.duration > 10000) {
        reward += REWARD_SIGNALS.SLOW_COMPLETION;
      }
    }

    // Quality bonus
    if (outcome.metrics?.quality && outcome.metrics.quality > 0.8) {
      reward += REWARD_SIGNALS.QUALITY_BONUS;
    }

    // User feedback
    if (outcome.feedback?.rating) {
      if (outcome.feedback.rating >= 4) {
        reward += REWARD_SIGNALS.USER_POSITIVE;
      } else if (outcome.feedback.rating <= 2) {
        reward += REWARD_SIGNALS.USER_NEGATIVE;
      }
    }

    // Publish reward calculation
    this.eventBus?.publish(LearningEvents.LEARNING_REWARD_CALCULATED, {
      agent: 'reinforcement-learner',
      outcome,
      reward
    });

    return reward;
  }

  /**
   * End current episode
   */
  endEpisode() {
    if (this.currentEpisode.length > 0) {
      const episode = {
        steps: this.currentEpisode,
        totalReward: this.currentEpisode.reduce((sum, step) => sum + step.reward, 0),
        timestamp: Date.now()
      };

      this.episodeHistory.push(episode);

      // Keep last 100 episodes
      if (this.episodeHistory.length > 100) {
        this.episodeHistory.shift();
      }

      this.currentEpisode = [];

      // Publish event
      this.eventBus?.publish(LearningEvents.LEARNING_EPISODE_ENDED, {
        agent: 'reinforcement-learner',
        totalReward: episode.totalReward,
        steps: episode.steps.length,
        episodeCount: this.episodeHistory.length
      });
    }
  }

  /**
   * Beta distribution sampling (approximation)
   */
  _sampleBeta(alpha, beta) {
    const gammaAlpha = this._sampleGamma(alpha);
    const gammaBeta = this._sampleGamma(beta);
    return gammaAlpha / (gammaAlpha + gammaBeta);
  }

  /**
   * Gamma distribution sampling (Marsaglia and Tsang's method)
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
   * Standard normal random (Box-Muller transform)
   */
  _normalRandom() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  /**
   * Get Q-value
   */
  _getQ(stateKey, action) {
    const stateActions = this.qTable.get(stateKey);
    if (!stateActions) return 0;
    return stateActions.get(action) || 0;
  }

  /**
   * Set Q-value
   */
  _setQ(stateKey, action, value) {
    if (!this.qTable.has(stateKey)) {
      this.qTable.set(stateKey, new Map());
    }
    this.qTable.get(stateKey).set(action, value);
  }

  /**
   * Get max Q-value for a state
   */
  _getMaxQ(stateKey) {
    const stateActions = this.qTable.get(stateKey);
    if (!stateActions || stateActions.size === 0) return 0;
    return Math.max(...stateActions.values());
  }

  /**
   * Get best action for a state
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
   * Update action success statistics
   */
  _updateActionStats(action, success) {
    if (!this.actionSuccesses.has(action)) {
      this.actionSuccesses.set(action, { successes: 1, failures: 1 });
    }

    const stats = this.actionSuccesses.get(action);
    if (success) {
      stats.successes++;
    } else {
      stats.failures++;
    }
  }

  /**
   * Convert state to string key
   */
  _stateToKey(state) {
    if (typeof state === 'string') return state;
    return JSON.stringify(state);
  }

  /**
   * Random selection
   */
  _randomSelect(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Save policy to KnowledgeBrain
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
      stats: this.stats,
      savedAt: Date.now()
    };

    await this.knowledgeBrain.storeRLPolicy(policy);
    this.stats.lastSaveTime = Date.now();

    this.logger.info('Policy saved', { states: this.qTable.size });
  }

  /**
   * Load policy from KnowledgeBrain
   */
  async _loadPolicy() {
    if (!this.knowledgeBrain) return;

    try {
      const policy = await this.knowledgeBrain.loadRLPolicy();

      if (policy) {
        // Restore Q-table
        for (const { state, actions } of policy.qTable || []) {
          this.qTable.set(state, new Map(actions));
        }

        // Restore action successes
        for (const [action, stats] of policy.actionSuccesses || []) {
          this.actionSuccesses.set(action, stats);
        }

        // Restore exploration rate
        if (policy.explorationRate) {
          this.config.explorationRate = policy.explorationRate;
        }

        this.logger.info('Policy loaded', { states: this.qTable.size });
      }
    } catch (error) {
      this.logger.warn('Failed to load policy:', error);
    }
  }

  /**
   * Get Q-table for specific state
   */
  getQValues(state) {
    const stateKey = this._stateToKey(state);
    const stateActions = this.qTable.get(stateKey);
    if (!stateActions) return {};
    return Object.fromEntries(stateActions);
  }

  /**
   * Get action statistics
   */
  getActionStats(action) {
    return this.actionSuccesses.get(action) || { successes: 0, failures: 0 };
  }

  /**
   * Get policy statistics
   */
  getStats() {
    return {
      ...this.stats,
      stateCount: this.qTable.size,
      actionCount: this.actionSuccesses.size,
      explorationRate: this.config.explorationRate,
      episodeCount: this.episodeHistory.length,
      currentEpisodeSteps: this.currentEpisode.length
    };
  }

  /**
   * Shutdown
   */
  async shutdown() {
    if (this.saveIntervalId) {
      clearInterval(this.saveIntervalId);
      this.saveIntervalId = null;
    }

    await this.savePolicy();
    this.initialized = false;
    this.logger.info('ReinforcementLearner shut down');
  }
}

// Singleton
let instance = null;

export function getReinforcementLearner(options = {}) {
  if (!instance) {
    instance = new ReinforcementLearner(options);
  }
  return instance;
}

export function resetReinforcementLearner() {
  if (instance) {
    instance.shutdown();
    instance = null;
  }
}

export { REWARD_SIGNALS };
export default ReinforcementLearner;
```

### Implementation Tasks
- Task 1.1.1: Create ReinforcementLearner class
- Task 1.1.2: Implement Q-table with state-action values
- Task 1.1.3: Implement epsilon-greedy action selection
- Task 1.1.4: Implement Thompson sampling
- Task 1.1.5: Implement Q-learning update rule
- Task 1.1.6: Implement reward calculation
- Task 1.1.7: Implement KnowledgeBrain policy persistence
- Task 1.1.8: Integrate with DecisionLogger for experience data
- Task 1.1.9: Create singleton pattern
- Task 1.1.10: Add unit tests (85%+ coverage)

---

# Phase 2: Dynamic Skill Generator

## Feature 2.1: DynamicSkillGenerator

### Description
Observes patterns via DecisionLogger and automatically generates new skills when repeated patterns are detected. Uses Ollama for LLM synthesis and isolated-vm for safe sandboxing.

### File Location
`foundation/learning/DynamicSkillGenerator.js`

### Pattern Compliance
- Extends BaseSkill (follows skill pattern)
- Uses OllamaAdapter for LLM synthesis
- Uses DecisionLogger for pattern data (NOT ExperienceCollector)
- Uses KnowledgeBrain for skill storage
- Uses isolated-vm for sandboxing (NOT vm2)
- Publishes to EventBus

### Class Structure

```javascript
/**
 * DynamicSkillGenerator - Creates skills from detected patterns
 *
 * Features:
 * - Pattern observation via DecisionLogger
 * - LLM-based skill code synthesis via OllamaAdapter
 * - Safe sandbox testing via isolated-vm
 * - Automatic skill registration
 * - Canary deployment for production safety
 * - Versioning and evolution tracking
 */

import { BaseSkill, SKILL_STATUS, createSkillGetter } from '../../agents/skills/BaseSkill.js';
import { LearningEvents } from '../event-bus/eventTypes.js';
import { getKnowledgeBrain, KNOWLEDGE_TYPES } from '../knowledge-brain/KnowledgeBrain.js';
import { getDecisionLogger } from '../memory-store/DecisionLogger.js';
import OllamaAdapter from '../../agents/gru-agent/OllamaAdapter.js';
import ivm from 'isolated-vm';

const SKILL_GENERATION_PROMPT = `You are an expert JavaScript developer specializing in creating reusable skills for an AI agent framework called Minions.

Given the following pattern of behavior that has been detected:
{pattern_description}

And these example executions:
{example_executions}

Generate a reusable skill class that:
1. Extends BaseSkill from '../../agents/skills/BaseSkill.js'
2. Implements the detected pattern as a reusable method
3. Includes proper error handling with try/catch
4. Uses the singleton pattern with createSkillGetter
5. Follows this exact structure:

\`\`\`javascript
import { BaseSkill, SKILL_STATUS, createSkillGetter } from '../../agents/skills/BaseSkill.js';
import { EventTypes } from '../../foundation/event-bus/eventTypes.js';

class {SkillName} extends BaseSkill {
  constructor(options = {}) {
    super('{skill-name}', options);
    // Initialize skill-specific state
  }

  async onInitialize() {
    // Custom initialization
  }

  async execute(input) {
    this.startRun();
    try {
      // Core skill logic here
      const result = // ... implementation
      this.completeRun();
      return result;
    } catch (error) {
      this.failRun(error);
      throw error;
    }
  }
}

export const get{SkillName} = createSkillGetter({SkillName});
export default {SkillName};
\`\`\`

Respond with ONLY the JavaScript code, no explanations.`;

export const GENERATION_STATUS = {
  ANALYZING: 'analyzing',
  SYNTHESIZING: 'synthesizing',
  TESTING: 'testing',
  VALIDATING: 'validating',
  CANARY: 'canary',
  COMPLETE: 'complete',
  FAILED: 'failed'
};

export const SKILL_TEMPLATES = {
  TRANSFORMER: 'transformer',
  ANALYZER: 'analyzer',
  GENERATOR: 'generator',
  VALIDATOR: 'validator',
  ORCHESTRATOR: 'orchestrator'
};

class DynamicSkillGenerator extends BaseSkill {
  constructor(options = {}) {
    super('DynamicSkillGenerator', options);

    // Configuration
    this.config = {
      minPatternCount: options.minPatternCount || 3,
      confidenceThreshold: options.confidenceThreshold || 0.7,
      maxGenerationsPerDay: options.maxGenerationsPerDay || 10,
      sandboxTimeout: options.sandboxTimeout || 5000,
      sandboxMemoryLimit: options.sandboxMemoryLimit || 128, // MB
      enableAutoGeneration: options.enableAutoGeneration ?? true,
      enableCanaryDeployment: options.enableCanaryDeployment ?? true,
      canaryPercentage: options.canaryPercentage || 0.1, // 10% of traffic
      canaryDuration: options.canaryDuration || 3600000, // 1 hour
      ollamaHost: options.ollamaHost || process.env.OLLAMA_HOST || 'http://localhost:11434',
      ollamaModel: options.ollamaModel || process.env.OLLAMA_MODEL || 'deepseek-coder:6.7b',
      ...options
    };

    // Components
    this.decisionLogger = null;
    this.knowledgeBrain = null;
    this.ollamaAdapter = null;
    this.isolate = null;

    // State
    this.generatedSkills = new Map();
    this.generationQueue = [];
    this.generationHistory = [];
    this.dailyGenerations = 0;
    this.lastResetDate = new Date().toDateString();
    this.canarySkills = new Map(); // Skills in canary deployment

    // Statistics
    this.stats = {
      skillsGenerated: 0,
      skillsValidated: 0,
      skillsFailed: 0,
      skillsPromoted: 0,    // Promoted from canary
      skillsRejected: 0,    // Failed canary
      averageConfidence: 0
    };
  }

  /**
   * Initialize the generator
   */
  async onInitialize() {
    // Initialize dependencies (use existing singletons)
    this.decisionLogger = getDecisionLogger();
    this.knowledgeBrain = getKnowledgeBrain();

    await this.decisionLogger.initialize();
    await this.knowledgeBrain.initialize();

    // Initialize Ollama adapter
    this.ollamaAdapter = new OllamaAdapter({
      ollamaHost: this.config.ollamaHost,
      model: this.config.ollamaModel
    });
    await this.ollamaAdapter.initialize();

    // Initialize isolated-vm isolate
    this.isolate = new ivm.Isolate({ memoryLimit: this.config.sandboxMemoryLimit });

    // Subscribe to pattern detection from DecisionLogger
    if (this.config.enableAutoGeneration) {
      this.subscribe('LEARNING_PATTERN_DETECTED', this._handlePatternDetected.bind(this));
    }

    this.logger.info('DynamicSkillGenerator initialized', {
      model: this.config.ollamaModel,
      autoGeneration: this.config.enableAutoGeneration,
      canaryEnabled: this.config.enableCanaryDeployment
    });
  }

  /**
   * Handle detected pattern from DecisionLogger
   */
  async _handlePatternDetected({ pattern, count }) {
    // Check if we should generate
    if (!this._shouldGenerate(pattern, count)) return;

    // Add to generation queue
    this.generationQueue.push({ pattern, count });

    // Process queue if not already processing
    if (this.generationQueue.length === 1) {
      await this._processQueue();
    }
  }

  /**
   * Check if skill generation should proceed
   */
  _shouldGenerate(pattern, count) {
    // Reset daily counter if new day
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      this.dailyGenerations = 0;
      this.lastResetDate = today;
    }

    // Check limits
    if (this.dailyGenerations >= this.config.maxGenerationsPerDay) {
      this.logger.debug('Daily generation limit reached');
      return false;
    }

    // Check if skill already exists for this pattern
    if (this.generatedSkills.has(pattern)) {
      return false;
    }

    // Check minimum count
    if (count < this.config.minPatternCount) {
      return false;
    }

    return true;
  }

  /**
   * Process generation queue
   */
  async _processQueue() {
    while (this.generationQueue.length > 0) {
      const item = this.generationQueue.shift();

      try {
        await this.generateSkill(item.pattern);
      } catch (error) {
        this.logger.error(`Failed to generate skill for pattern ${item.pattern}:`, error);
      }
    }
  }

  /**
   * Generate a skill from a pattern
   */
  async generateSkill(pattern) {
    this.startRun();
    const startTime = Date.now();

    const generationId = this._generateId();
    const generationState = {
      id: generationId,
      pattern,
      status: GENERATION_STATUS.ANALYZING,
      startTime,
      skill: null,
      error: null
    };

    this.generationHistory.push(generationState);
    this.emit('generation:started', { id: generationId, pattern });

    // Publish event
    this.publish(LearningEvents.LEARNING_SKILL_GENERATING, {
      generationId,
      pattern
    });

    try {
      // Step 1: Analyze pattern using DecisionLogger data
      generationState.status = GENERATION_STATUS.ANALYZING;
      const analysis = await this._analyzePattern(pattern);

      if (analysis.confidence < this.config.confidenceThreshold) {
        throw new Error(`Confidence too low: ${analysis.confidence.toFixed(2)}`);
      }

      // Step 2: Synthesize skill code using LLM
      generationState.status = GENERATION_STATUS.SYNTHESIZING;
      const synthesized = await this._synthesizeSkill(pattern, analysis);

      // Step 3: Test in isolated-vm sandbox
      generationState.status = GENERATION_STATUS.TESTING;
      const testResult = await this._sandboxTest(synthesized);

      if (!testResult.passed) {
        throw new Error(`Sandbox test failed: ${testResult.error}`);
      }

      // Step 4: Validate structure
      generationState.status = GENERATION_STATUS.VALIDATING;
      const skill = await this._registerSkill(synthesized, analysis, testResult);

      // Step 5: Canary deployment (if enabled)
      if (this.config.enableCanaryDeployment) {
        generationState.status = GENERATION_STATUS.CANARY;
        await this._startCanaryDeployment(skill);
      }

      // Update state
      generationState.status = GENERATION_STATUS.COMPLETE;
      generationState.skill = skill;
      this.generatedSkills.set(pattern, skill);
      this.dailyGenerations++;

      // Update stats
      this.stats.skillsGenerated++;
      this.stats.skillsValidated++;
      this._updateAverageConfidence(analysis.confidence);

      // Store in KnowledgeBrain
      await this.knowledgeBrain.storeLearnedSkill(skill);

      // Publish event
      this.publish(LearningEvents.LEARNING_SKILL_GENERATED, {
        skillId: skill.id,
        skillName: skill.name,
        pattern,
        confidence: analysis.confidence,
        canaryDeployment: this.config.enableCanaryDeployment
      });

      this.emit('generation:complete', { id: generationId, skill });
      this.completeRun();

      return skill;

    } catch (error) {
      generationState.status = GENERATION_STATUS.FAILED;
      generationState.error = error.message;
      this.stats.skillsFailed++;

      // Publish failure event
      this.publish(LearningEvents.LEARNING_SKILL_FAILED, {
        generationId,
        pattern,
        error: error.message
      });

      this.emit('generation:failed', { id: generationId, error: error.message });
      this.failRun(error);
      throw error;
    }
  }

  /**
   * Analyze a pattern using DecisionLogger data
   */
  async _analyzePattern(pattern) {
    // Get experiences from DecisionLogger (not ExperienceCollector)
    const experiences = await this.decisionLogger.getExperiencesForPattern(pattern);

    if (experiences.length === 0) {
      return { confidence: 0, examples: [], description: '' };
    }

    // Calculate success rate
    const successCount = experiences.filter(e => e.outcome === 'success').length;
    const successRate = successCount / experiences.length;

    // Extract common elements
    const agents = [...new Set(experiences.map(e => e.agent))];
    const skills = [...new Set(experiences.map(e => e.metadata?.skillName).filter(Boolean))];

    // Build description
    const description = `Pattern "${pattern}" observed ${experiences.length} times ` +
      `with ${(successRate * 100).toFixed(0)}% success rate. ` +
      `Skills: ${skills.join(', ') || 'none'}. ` +
      `Agents: ${agents.join(', ')}.`;

    return {
      confidence: successRate,
      examples: experiences.slice(0, 5),
      description,
      successRate,
      skills,
      agents
    };
  }

  /**
   * Synthesize skill code using LLM
   */
  async _synthesizeSkill(pattern, analysis) {
    // Build prompt
    const prompt = SKILL_GENERATION_PROMPT
      .replace('{pattern_description}', analysis.description)
      .replace('{example_executions}', JSON.stringify(analysis.examples.slice(0, 3), null, 2))
      .replace(/{SkillName}/g, this._patternToClassName(pattern))
      .replace(/{skill-name}/g, this._patternToSkillName(pattern));

    // Call LLM
    const response = await this.ollamaAdapter.chat(
      [{ role: 'user', content: prompt }],
      'You are an expert JavaScript developer. Generate clean, production-ready code.'
    );

    // Extract code from response
    const code = this._extractCode(response.content);

    return {
      name: this._patternToClassName(pattern),
      skillName: this._patternToSkillName(pattern),
      code,
      pattern,
      analysis
    };
  }

  /**
   * Extract code from LLM response
   */
  _extractCode(content) {
    // Try to extract from code blocks
    const codeBlockMatch = content.match(/```(?:javascript|js)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    // If no code block, assume entire response is code
    return content.trim();
  }

  /**
   * Test skill in isolated-vm sandbox (NOT vm2)
   */
  async _sandboxTest(synthesized) {
    try {
      // Create context in isolate
      const context = await this.isolate.createContext();

      // Create script with timeout
      const script = await this.isolate.compileScript(`
        (function() {
          // Basic syntax validation
          ${synthesized.code}
          return { valid: true };
        })()
      `);

      // Run with timeout
      try {
        await script.run(context, { timeout: this.config.sandboxTimeout });
      } catch (e) {
        // Syntax error or runtime error in sandbox
        return {
          passed: false,
          error: `Sandbox execution failed: ${e.message}`
        };
      }

      // Check for required patterns
      const hasBaseSkill = synthesized.code.includes('extends BaseSkill');
      const hasExecute = synthesized.code.includes('async execute');
      const hasExport = synthesized.code.includes('export');
      const hasErrorHandling = synthesized.code.includes('catch');

      if (!hasBaseSkill || !hasExecute || !hasExport) {
        return {
          passed: false,
          error: 'Missing required skill structure (BaseSkill, execute, export)'
        };
      }

      // Check for dangerous patterns
      const dangerous = [
        /process\.exit/,
        /require\s*\(/,
        /import\s*\(/,  // Dynamic imports
        /eval\s*\(/,
        /Function\s*\(/,
        /child_process/,
        /fs\./,
        /exec\s*\(/,
        /__proto__/,
        /constructor\s*\[/
      ];

      for (const pattern of dangerous) {
        if (pattern.test(synthesized.code)) {
          return {
            passed: false,
            error: `Dangerous pattern detected: ${pattern}`
          };
        }
      }

      return {
        passed: true,
        warnings: [],
        metrics: {
          codeLines: synthesized.code.split('\n').length,
          hasErrorHandling,
          hasLogging: synthesized.code.includes('logger')
        }
      };

    } catch (error) {
      return {
        passed: false,
        error: error.message
      };
    }
  }

  /**
   * Register the skill
   */
  async _registerSkill(synthesized, analysis, testResult) {
    const skill = {
      id: `skill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: synthesized.name,
      skillName: synthesized.skillName,
      description: analysis.description,
      version: '1.0.0',
      sourcePattern: synthesized.pattern,
      code: synthesized.code,
      dependencies: this._extractDependencies(synthesized.code),
      inputSchema: {},
      outputSchema: {},
      testCases: [],
      metadata: {
        generatedAt: Date.now(),
        generatedBy: 'DynamicSkillGenerator',
        llmModel: this.config.ollamaModel,
        confidence: analysis.confidence,
        validated: testResult.passed,
        activations: 0,
        successRate: 0,
        inCanary: false,
        promoted: false
      }
    };

    return skill;
  }

  /**
   * Start canary deployment for a skill
   */
  async _startCanaryDeployment(skill) {
    skill.metadata.inCanary = true;
    skill.metadata.canaryStartTime = Date.now();
    skill.metadata.canaryEndTime = Date.now() + this.config.canaryDuration;
    skill.metadata.canaryActivations = 0;
    skill.metadata.canarySuccesses = 0;

    this.canarySkills.set(skill.id, skill);

    this.logger.info(`Started canary deployment for skill: ${skill.name}`, {
      skillId: skill.id,
      duration: this.config.canaryDuration,
      percentage: this.config.canaryPercentage
    });

    // Schedule canary evaluation
    setTimeout(() => this._evaluateCanary(skill.id), this.config.canaryDuration);
  }

  /**
   * Evaluate canary deployment results
   */
  async _evaluateCanary(skillId) {
    const skill = this.canarySkills.get(skillId);
    if (!skill) return;

    const successRate = skill.metadata.canaryActivations > 0
      ? skill.metadata.canarySuccesses / skill.metadata.canaryActivations
      : 0;

    const minActivations = 5;
    const minSuccessRate = 0.7;

    if (skill.metadata.canaryActivations >= minActivations && successRate >= minSuccessRate) {
      // Promote to production
      skill.metadata.inCanary = false;
      skill.metadata.promoted = true;
      skill.metadata.promotedAt = Date.now();
      this.stats.skillsPromoted++;

      // Publish promotion event
      this.publish(LearningEvents.LEARNING_SKILL_DEPLOYED, {
        skillId: skill.id,
        skillName: skill.name,
        successRate,
        activations: skill.metadata.canaryActivations
      });

      this.logger.info(`Skill promoted from canary: ${skill.name}`, {
        successRate,
        activations: skill.metadata.canaryActivations
      });
    } else {
      // Reject skill
      skill.metadata.inCanary = false;
      skill.metadata.rejected = true;
      skill.metadata.rejectedAt = Date.now();
      skill.metadata.rejectionReason = skill.metadata.canaryActivations < minActivations
        ? `Insufficient activations (${skill.metadata.canaryActivations}/${minActivations})`
        : `Low success rate (${(successRate * 100).toFixed(0)}%/${(minSuccessRate * 100)}%)`;

      this.stats.skillsRejected++;
      this.generatedSkills.delete(skill.sourcePattern);

      this.logger.warn(`Skill rejected from canary: ${skill.name}`, {
        reason: skill.metadata.rejectionReason,
        successRate,
        activations: skill.metadata.canaryActivations
      });
    }

    this.canarySkills.delete(skillId);

    // Update in KnowledgeBrain
    await this.knowledgeBrain.storeLearnedSkill(skill);
  }

  /**
   * Record skill activation (for canary tracking)
   */
  async recordSkillActivation(skillId, success) {
    const skill = this.canarySkills.get(skillId) || this.generatedSkills.get(skillId);
    if (!skill) return;

    skill.metadata.activations++;
    if (success) {
      skill.metadata.successes = (skill.metadata.successes || 0) + 1;
    }
    skill.metadata.successRate = skill.metadata.activations > 0
      ? (skill.metadata.successes || 0) / skill.metadata.activations
      : 0;

    // Track canary metrics
    if (skill.metadata.inCanary) {
      skill.metadata.canaryActivations++;
      if (success) {
        skill.metadata.canarySuccesses++;
      }
    }

    // Update in KnowledgeBrain
    await this.knowledgeBrain.updateSkillActivation(skillId, success);
  }

  /**
   * Check if request should use canary skill
   */
  shouldUseCanarySkill(skillId) {
    const skill = this.canarySkills.get(skillId);
    if (!skill || !skill.metadata.inCanary) return false;

    // Random percentage check
    return Math.random() < this.config.canaryPercentage;
  }

  /**
   * Extract dependencies from code
   */
  _extractDependencies(code) {
    const deps = [];
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(code)) !== null) {
      deps.push(match[1]);
    }

    return deps;
  }

  /**
   * Convert pattern to class name
   */
  _patternToClassName(pattern) {
    return pattern
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('') + 'Skill';
  }

  /**
   * Convert pattern to skill name
   */
  _patternToSkillName(pattern) {
    return pattern
      .replace(/[^a-zA-Z0-9]/g, '-')
      .toLowerCase()
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') + '-skill';
  }

  /**
   * Update average confidence
   */
  _updateAverageConfidence(confidence) {
    const n = this.stats.skillsGenerated;
    this.stats.averageConfidence = (
      (this.stats.averageConfidence * (n - 1) + confidence) / n
    );
  }

  /**
   * Generate unique ID
   */
  _generateId() {
    return `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get generated skills
   */
  getGeneratedSkills() {
    return Array.from(this.generatedSkills.values());
  }

  /**
   * Get skill by pattern
   */
  getSkillByPattern(pattern) {
    return this.generatedSkills.get(pattern);
  }

  /**
   * Get skills in canary deployment
   */
  getCanarySkills() {
    return Array.from(this.canarySkills.values());
  }

  /**
   * Get generation history
   */
  getHistory() {
    return this.generationHistory;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...super.getStatus(),
      ...this.stats,
      queueLength: this.generationQueue.length,
      dailyGenerations: this.dailyGenerations,
      dailyLimit: this.config.maxGenerationsPerDay,
      canaryCount: this.canarySkills.size
    };
  }

  /**
   * Shutdown
   */
  async onShutdown() {
    if (this.ollamaAdapter) {
      await this.ollamaAdapter.shutdown();
    }
    if (this.isolate) {
      this.isolate.dispose();
    }
  }
}

// Singleton getter
export const getDynamicSkillGenerator = createSkillGetter(DynamicSkillGenerator);

export default DynamicSkillGenerator;
```

### Implementation Tasks
- Task 2.1.1: Create DynamicSkillGenerator extending BaseSkill
- Task 2.1.2: Implement pattern analysis using DecisionLogger
- Task 2.1.3: Implement LLM synthesis with OllamaAdapter
- Task 2.1.4: Implement sandbox testing with isolated-vm (NOT vm2)
- Task 2.1.5: Implement skill registration and storage
- Task 2.1.6: Implement canary deployment system
- Task 2.1.7: Implement auto-generation on pattern detection
- Task 2.1.8: Add generation queue and rate limiting
- Task 2.1.9: Create singleton pattern with getter
- Task 2.1.10: Add unit tests (85%+ coverage)

---

# Phase 3: Skill A/B Testing

## Feature 3.1: SkillABTester

### Description
Provides A/B testing framework to compare skill variants and determine optimal implementations.

### File Location
`foundation/learning/SkillABTester.js`

### Class Structure

```javascript
/**
 * SkillABTester - A/B testing framework for skills
 *
 * Features:
 * - Create skill variants (control vs treatment)
 * - Statistical significance testing
 * - Automatic winner selection
 * - Integration with ReinforcementLearner for decisions
 */

import { EventEmitter } from 'events';
import { createLogger } from '../common/logger.js';
import { getEventBus } from '../event-bus/AgentEventBus.js';
import { LearningEvents } from '../event-bus/eventTypes.js';
import { getKnowledgeBrain, KNOWLEDGE_TYPES } from '../knowledge-brain/KnowledgeBrain.js';
import { getReinforcementLearner } from './ReinforcementLearner.js';

const logger = createLogger('SkillABTester');

export const TEST_STATUS = {
  RUNNING: 'running',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

class SkillABTester extends EventEmitter {
  constructor(options = {}) {
    super();

    this.logger = logger;
    this.eventBus = null;
    this.knowledgeBrain = null;
    this.reinforcementLearner = null;
    this.initialized = false;

    // Configuration
    this.config = {
      minSampleSize: options.minSampleSize || 30,
      confidenceLevel: options.confidenceLevel || 0.95,
      maxTestDuration: options.maxTestDuration || 86400000, // 24 hours
      ...options
    };

    // Active tests
    this.activeTests = new Map();

    // Test history
    this.testHistory = [];
  }

  async initialize() {
    if (this.initialized) return;

    this.eventBus = getEventBus();
    this.knowledgeBrain = getKnowledgeBrain();
    this.reinforcementLearner = getReinforcementLearner();

    await this.knowledgeBrain.initialize();
    await this.reinforcementLearner.initialize();

    this.initialized = true;
    this.logger.info('SkillABTester initialized');
  }

  /**
   * Start an A/B test
   * @param {Object} controlSkill - Control (existing) skill
   * @param {Object} treatmentSkill - Treatment (new) skill
   * @param {Object} options - Test options
   */
  async startTest(controlSkill, treatmentSkill, options = {}) {
    const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const test = {
      id: testId,
      controlSkill,
      treatmentSkill,
      status: TEST_STATUS.RUNNING,
      startTime: Date.now(),
      endTime: null,
      config: {
        trafficSplit: options.trafficSplit || 0.5, // 50/50 split
        minSampleSize: options.minSampleSize || this.config.minSampleSize,
        confidenceLevel: options.confidenceLevel || this.config.confidenceLevel
      },
      results: {
        control: { activations: 0, successes: 0, totalDuration: 0 },
        treatment: { activations: 0, successes: 0, totalDuration: 0 }
      },
      winner: null
    };

    this.activeTests.set(testId, test);

    // Publish event
    this.eventBus?.publish(LearningEvents.LEARNING_ABTEST_STARTED, {
      testId,
      controlSkill: controlSkill.name,
      treatmentSkill: treatmentSkill.name,
      trafficSplit: test.config.trafficSplit
    });

    this.logger.info('A/B test started', {
      testId,
      control: controlSkill.name,
      treatment: treatmentSkill.name
    });

    // Schedule auto-evaluation
    setTimeout(() => this._checkTestCompletion(testId), this.config.maxTestDuration);

    return testId;
  }

  /**
   * Select which variant to use for a request
   */
  selectVariant(testId) {
    const test = this.activeTests.get(testId);
    if (!test || test.status !== TEST_STATUS.RUNNING) {
      return null;
    }

    // Use RL for smart selection if enough data
    const totalActivations = test.results.control.activations + test.results.treatment.activations;
    if (totalActivations >= 10) {
      const { action } = this.reinforcementLearner.selectAction(
        `abtest:${testId}`,
        ['control', 'treatment']
      );
      return action === 'control' ? test.controlSkill : test.treatmentSkill;
    }

    // Random selection based on traffic split
    return Math.random() < test.config.trafficSplit
      ? test.treatmentSkill
      : test.controlSkill;
  }

  /**
   * Record test result
   */
  async recordResult(testId, variant, success, duration) {
    const test = this.activeTests.get(testId);
    if (!test || test.status !== TEST_STATUS.RUNNING) return;

    const results = variant === 'control' ? test.results.control : test.results.treatment;
    results.activations++;
    if (success) results.successes++;
    results.totalDuration += duration;

    // Update RL
    const reward = this.reinforcementLearner.calculateReward({
      success,
      metrics: { duration }
    });
    await this.reinforcementLearner.update(
      `abtest:${testId}`,
      variant,
      reward,
      `abtest:${testId}:next`
    );

    // Check if we can determine a winner
    await this._checkTestCompletion(testId);
  }

  /**
   * Check if test can be completed
   */
  async _checkTestCompletion(testId) {
    const test = this.activeTests.get(testId);
    if (!test || test.status !== TEST_STATUS.RUNNING) return;

    const { control, treatment } = test.results;
    const totalSamples = control.activations + treatment.activations;

    // Check minimum sample size
    if (control.activations < test.config.minSampleSize ||
        treatment.activations < test.config.minSampleSize) {
      return;
    }

    // Calculate success rates
    const controlRate = control.successes / control.activations;
    const treatmentRate = treatment.successes / treatment.activations;

    // Simple statistical test (z-test for proportions)
    const significance = this._calculateSignificance(
      controlRate, control.activations,
      treatmentRate, treatment.activations
    );

    if (significance >= test.config.confidenceLevel) {
      // We have a statistically significant winner
      test.winner = treatmentRate > controlRate ? 'treatment' : 'control';
      test.status = TEST_STATUS.COMPLETED;
      test.endTime = Date.now();
      test.significance = significance;

      this.testHistory.push(test);
      this.activeTests.delete(testId);

      // Publish result
      this.eventBus?.publish(LearningEvents.LEARNING_ABTEST_COMPLETED, {
        testId,
        winner: test.winner,
        controlRate,
        treatmentRate,
        significance,
        totalSamples
      });

      this.logger.info('A/B test completed', {
        testId,
        winner: test.winner,
        controlRate: (controlRate * 100).toFixed(1) + '%',
        treatmentRate: (treatmentRate * 100).toFixed(1) + '%'
      });
    }
  }

  /**
   * Calculate statistical significance (z-test)
   */
  _calculateSignificance(p1, n1, p2, n2) {
    const p = (p1 * n1 + p2 * n2) / (n1 + n2);
    const se = Math.sqrt(p * (1 - p) * (1/n1 + 1/n2));

    if (se === 0) return 0;

    const z = Math.abs(p1 - p2) / se;

    // Convert z-score to p-value (approximation)
    const pValue = 2 * (1 - this._normalCDF(z));

    return 1 - pValue;
  }

  /**
   * Standard normal CDF approximation
   */
  _normalCDF(x) {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }

  /**
   * Get active tests
   */
  getActiveTests() {
    return Array.from(this.activeTests.values());
  }

  /**
   * Get test history
   */
  getTestHistory() {
    return this.testHistory;
  }

  /**
   * Cancel a test
   */
  cancelTest(testId) {
    const test = this.activeTests.get(testId);
    if (test) {
      test.status = TEST_STATUS.CANCELLED;
      test.endTime = Date.now();
      this.testHistory.push(test);
      this.activeTests.delete(testId);
    }
  }
}

// Singleton
let instance = null;

export function getSkillABTester(options = {}) {
  if (!instance) {
    instance = new SkillABTester(options);
  }
  return instance;
}

export function resetSkillABTester() {
  instance = null;
}

export default SkillABTester;
```

### Implementation Tasks
- Task 3.1.1: Create SkillABTester class
- Task 3.1.2: Implement test creation and management
- Task 3.1.3: Implement variant selection with RL integration
- Task 3.1.4: Implement result recording
- Task 3.1.5: Implement statistical significance testing
- Task 3.1.6: Implement automatic winner determination
- Task 3.1.7: Add unit tests

---

# Phase 4: Cross-Agent Teaching

## Feature 4.1: CrossAgentTeacher

### Description
Enables agents to share learned skills with each other, creating a collaborative learning ecosystem.

### File Location
`foundation/teaching/CrossAgentTeacher.js`

### Implementation Tasks
- Task 4.1.1: Create CrossAgentTeacher class
- Task 4.1.2: Implement skill packaging for transfer
- Task 4.1.3: Implement skill reception and validation
- Task 4.1.4: Implement mastery tracking
- Task 4.1.5: Implement curriculum generation
- Task 4.1.6: Add unit tests

---

# Phase 5: Module Integration

## Feature 5.1: Learning Module Index

### File Location
`foundation/learning/index.js`

### Implementation

```javascript
/**
 * Learning Module - Self-Learning System for Minions
 *
 * This module provides:
 * - ReinforcementLearner: Q-learning optimization
 * - DynamicSkillGenerator: Creates skills from patterns
 * - SkillABTester: A/B testing framework
 *
 * NOTE: This module extends existing components:
 * - DecisionLogger: Extended with experience methods
 * - KnowledgeBrain: Extended with learning-specific types
 * - MetricsCollector: Used as-is for metrics
 */

// Core learning components
import ReinforcementLearner, {
  getReinforcementLearner,
  resetReinforcementLearner,
  REWARD_SIGNALS
} from './ReinforcementLearner.js';

import DynamicSkillGenerator, {
  getDynamicSkillGenerator,
  GENERATION_STATUS,
  SKILL_TEMPLATES
} from './DynamicSkillGenerator.js';

import SkillABTester, {
  getSkillABTester,
  resetSkillABTester,
  TEST_STATUS
} from './SkillABTester.js';

// Re-export existing extended components
export { getDecisionLogger } from '../memory-store/DecisionLogger.js';
export { getKnowledgeBrain, KNOWLEDGE_TYPES } from '../knowledge-brain/KnowledgeBrain.js';
export { getMetricsCollector } from '../metrics-collector/MetricsCollector.js';

// Export classes
export {
  ReinforcementLearner,
  DynamicSkillGenerator,
  SkillABTester
};

// Export singleton getters
export {
  getReinforcementLearner,
  getDynamicSkillGenerator,
  getSkillABTester
};

// Export reset functions (for testing)
export {
  resetReinforcementLearner,
  resetSkillABTester
};

// Export constants
export {
  REWARD_SIGNALS,
  GENERATION_STATUS,
  SKILL_TEMPLATES,
  TEST_STATUS
};

/**
 * Initialize the complete learning system
 * @param {Object} options - Configuration options
 */
export async function initializeLearningSystem(options = {}) {
  const {
    enableAutoGeneration = true,
    enableCanary = true,
    learningRate = 0.1,
    minPatternCount = 3
  } = options;

  // Get singleton instances
  const reinforcementLearner = getReinforcementLearner({ learningRate });
  const skillGenerator = getDynamicSkillGenerator({
    enableAutoGeneration,
    enableCanaryDeployment: enableCanary,
    minPatternCount
  });
  const abTester = getSkillABTester();

  // Initialize all components
  await Promise.all([
    reinforcementLearner.initialize(),
    skillGenerator.initialize(),
    abTester.initialize()
  ]);

  return {
    reinforcementLearner,
    skillGenerator,
    abTester
  };
}

/**
 * Get learning system statistics
 */
export function getLearningStats() {
  const rl = getReinforcementLearner();
  const generator = getDynamicSkillGenerator();
  const abTester = getSkillABTester();

  return {
    reinforcement: rl.getStats(),
    skillGeneration: generator.getStats(),
    abTesting: {
      activeTests: abTester.getActiveTests().length,
      completedTests: abTester.getTestHistory().length
    }
  };
}

/**
 * Quick helper to select optimal action with RL
 */
export async function selectOptimalAction(state, availableActions) {
  const learner = getReinforcementLearner();
  await learner.initialize();
  return learner.selectAction(state, availableActions);
}

// Default export
export default {
  initializeLearningSystem,
  getLearningStats,
  selectOptimalAction,
  getReinforcementLearner,
  getDynamicSkillGenerator,
  getSkillABTester
};
```

---

# Removed Components (From v1.0)

The following components were **removed** because they duplicate existing functionality:

| Removed | Reason | Use Instead |
|---------|--------|-------------|
| `ExperienceCollector` | Duplicates DecisionLogger | Extend DecisionLogger |
| Pattern detection in ExperienceCollector | Duplicates KnowledgeBrain | Use KnowledgeBrain vector similarity |
| Experience persistence | Duplicates MemoryStore | Use existing MemoryStore |
| Statistics tracking | Duplicates MetricsCollector | Use existing MetricsCollector |
| `AutonomousHookRegistry` | Over-engineering for initial release | Defer to v3.0 |
| `HookValidator` | Part of removed hook system | Defer to v3.0 |
| `HookChainBuilder` | Part of removed hook system | Defer to v3.0 |
| `MetaLearningEngine` | Over-engineering for initial release | Defer to v3.0 |
| `SkillDNA` | Over-engineering for initial release | Defer to v3.0 |

---

# Implementation Order (Revised)

| Phase | Feature | Dependencies | Priority |
|-------|---------|--------------|----------|
| 0.1 | Extend DecisionLogger | None | Critical |
| 0.2 | Extend KnowledgeBrain | None | Critical |
| 0.3 | Extend EventTypes | None | Critical |
| 1 | ReinforcementLearner | Phase 0 | High |
| 2 | DynamicSkillGenerator | Phase 0, Phase 1 | High |
| 3 | SkillABTester | Phase 1 | Medium |
| 4 | CrossAgentTeacher | Phase 2 | Medium |
| 5 | Module Integration | All above | High |

---

# Testing Strategy

## Unit Tests
- Each component has isolated unit tests
- Mock existing components (EventBus, KnowledgeBrain, DecisionLogger)
- Test all public methods
- 85%+ coverage required

## Integration Tests
- Test component interactions
- Test event flow through extended components
- Test persistence via KnowledgeBrain
- Test LLM integration with mock Ollama

## End-to-End Tests
- Full learning cycle (pattern → skill → deployment)
- Reinforcement learning optimization
- A/B testing with winner selection
- Canary deployment and promotion

---

# Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Pattern Detection (via DecisionLogger) | >90% | Detected patterns / Total patterns |
| Skill Generation Success | >70% | Valid skills / Generated skills |
| Canary Promotion Rate | >60% | Promoted skills / Generated skills |
| RL Improvement | >20% | Post-learning success rate vs baseline |
| System Stability | >99.5% | Uptime during learning operations |
| Test Coverage | >85% | All new code |

---

# Security Considerations

1. **Sandbox Security**: Using `isolated-vm` instead of deprecated `vm2`
2. **Code Validation**: Dangerous pattern detection before execution
3. **Rate Limiting**: Max 10 skill generations per day
4. **Canary Deployment**: Only 10% traffic to new skills initially
5. **Promotion Gates**: Minimum activations + success rate required

---

# Risk Mitigation

| Risk | Mitigation |
|------|------------|
| LLM Unavailable | Template-based fallback generation |
| Sandbox Escape | isolated-vm with memory limits + pattern blocklist |
| Bad Skill Generation | Canary deployment catches issues before full rollout |
| Memory Bloat | Use existing MemoryStore limits + KnowledgeBrain pruning |
| Infinite Loops | Max iterations in generation queue |
| Performance Impact | Async processing, rate limiting, batching |

---

# Next Steps

1. Review and approve this revised plan
2. Create development branch: `feature/self-learning-system-v2`
3. Implement Phase 0 (Extend existing components)
4. Implement Phase 1 (ReinforcementLearner)
5. Implement Phase 2 (DynamicSkillGenerator)
6. Continue with remaining phases
7. Integration testing
8. Documentation updates
9. Merge and release

---

**Document Version**: 2.0
**Last Updated**: December 2024
**Changes from v1.0**: Removed duplicates, extended existing components, replaced vm2, added canary deployment
**Framework**: Minions
