/**
 * DynamicSkillGenerator - Creates skills from detected patterns
 *
 * Part of the Minions Self-Learning System (Phase 2)
 *
 * Features:
 * - Pattern observation via DecisionLogger
 * - LLM-based skill code synthesis via OllamaAdapter
 * - Safe sandbox testing via isolated-vm (NOT vm2)
 * - Automatic skill registration
 * - Canary deployment for production safety
 * - Versioning and evolution tracking
 *
 * Pattern Compliance:
 * - Extends BaseSkill (follows skill pattern)
 * - Uses OllamaAdapter for LLM synthesis
 * - Uses DecisionLogger for pattern data
 * - Uses KnowledgeBrain for skill storage
 * - Uses isolated-vm for sandboxing
 * - Publishes to EventBus
 * - Singleton pattern with getDynamicSkillGenerator()
 */

import { BaseSkill, SKILL_STATUS, createSkillGetter } from '../../agents/skills/BaseSkill.js';
import { LearningEvents } from '../event-bus/eventTypes.js';
import { getKnowledgeBrain } from '../knowledge-brain/KnowledgeBrain.js';
import { getDecisionLogger } from '../memory-store/DecisionLogger.js';
import { OllamaAdapter } from '../../agents/gru-agent/OllamaAdapter.js';

// Lazy load isolated-vm to allow operation without it installed
let ivm = null;

/**
 * Prompt template for LLM skill generation
 */
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

/**
 * Generation status constants
 */
export const GENERATION_STATUS = {
  ANALYZING: 'analyzing',
  SYNTHESIZING: 'synthesizing',
  TESTING: 'testing',
  VALIDATING: 'validating',
  CANARY: 'canary',
  COMPLETE: 'complete',
  FAILED: 'failed'
};

/**
 * Skill template types
 */
export const SKILL_TEMPLATES = {
  TRANSFORMER: 'transformer',
  ANALYZER: 'analyzer',
  GENERATOR: 'generator',
  VALIDATOR: 'validator',
  ORCHESTRATOR: 'orchestrator'
};

/**
 * DynamicSkillGenerator - Main class for generating skills from patterns
 */
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
    this.ivmAvailable = false;

    // State
    this.generatedSkills = new Map();
    this.generationQueue = [];
    this.generationHistory = [];
    this.dailyGenerations = 0;
    this.lastResetDate = new Date().toDateString();
    this.canarySkills = new Map(); // Skills in canary deployment
    this.canaryTimers = new Map(); // Timer IDs for canary evaluation

    // Statistics
    this.stats = {
      skillsGenerated: 0,
      skillsValidated: 0,
      skillsFailed: 0,
      skillsPromoted: 0,    // Promoted from canary
      skillsRejected: 0,    // Failed canary
      averageConfidence: 0
    };

    // Internal event listeners (since BaseSkill doesn't extend EventEmitter)
    this._eventListeners = new Map();
  }

  /**
   * Register an event listener
   * @param {string} event - Event name
   * @param {Function} listener - Listener function
   */
  on(event, listener) {
    if (!this._eventListeners.has(event)) {
      this._eventListeners.set(event, []);
    }
    this._eventListeners.get(event).push(listener);
  }

  /**
   * Emit an event to internal listeners
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  emit(event, data) {
    const listeners = this._eventListeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(data);
        } catch (error) {
          this.logger.error(`Error in event listener for ${event}:`, error);
        }
      }
    }
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

    // Try to initialize isolated-vm (may not be available)
    await this._initializeSandbox();

    // Subscribe to pattern detection from DecisionLogger
    if (this.config.enableAutoGeneration) {
      this.subscribe(LearningEvents.PATTERN_DETECTED, this._handlePatternDetected.bind(this));
    }

    this.logger.info('DynamicSkillGenerator initialized', {
      model: this.config.ollamaModel,
      autoGeneration: this.config.enableAutoGeneration,
      canaryEnabled: this.config.enableCanaryDeployment,
      sandboxAvailable: this.ivmAvailable
    });
  }

  /**
   * Initialize the isolated-vm sandbox
   */
  async _initializeSandbox() {
    try {
      // Dynamically import isolated-vm
      const ivmModule = await import('isolated-vm');
      ivm = ivmModule.default || ivmModule;
      this.isolate = new ivm.Isolate({ memoryLimit: this.config.sandboxMemoryLimit });
      this.ivmAvailable = true;
      this.logger.info('isolated-vm sandbox initialized');
    } catch (error) {
      this.ivmAvailable = false;
      this.logger.warn('isolated-vm not available, using basic validation only:', error.message);
    }
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
   * @param {string} pattern - The pattern to generate a skill from
   * @returns {Object} Generated skill object
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
    this.publish(LearningEvents.SKILL_GENERATING, {
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

      // Step 3: Test in sandbox
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
      this.publish(LearningEvents.SKILL_GENERATED, {
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
      this.publish(LearningEvents.SKILL_FAILED, {
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
    // Get experiences from DecisionLogger
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
   * Test skill in sandbox (isolated-vm if available, basic validation otherwise)
   */
  async _sandboxTest(synthesized) {
    // Always run basic validation
    const basicResult = this._basicValidation(synthesized);
    if (!basicResult.passed) {
      return basicResult;
    }

    // If isolated-vm is available, run additional sandbox test
    if (this.ivmAvailable && this.isolate) {
      return this._isolatedVmTest(synthesized);
    }

    return basicResult;
  }

  /**
   * Basic validation without isolated-vm
   */
  _basicValidation(synthesized) {
    try {
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
   * Test skill in isolated-vm sandbox
   */
  async _isolatedVmTest(synthesized) {
    try {
      // Create context in isolate
      const context = await this.isolate.createContext();

      // Create script with timeout - we wrap in an IIFE to validate syntax
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

      // Already passed basic validation
      return {
        passed: true,
        warnings: [],
        metrics: {
          codeLines: synthesized.code.split('\n').length,
          hasErrorHandling: synthesized.code.includes('catch'),
          hasLogging: synthesized.code.includes('logger'),
          sandboxValidated: true
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
        sandboxValidated: testResult.metrics?.sandboxValidated || false,
        activations: 0,
        successes: 0,
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
    const timerId = setTimeout(
      () => this._evaluateCanary(skill.id),
      this.config.canaryDuration
    );
    this.canaryTimers.set(skill.id, timerId);
  }

  /**
   * Evaluate canary deployment results
   */
  async _evaluateCanary(skillId) {
    // Clean up timer reference
    this.canaryTimers.delete(skillId);

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
      this.publish(LearningEvents.SKILL_DEPLOYED, {
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
    // Check both maps for the skill
    let skill = this.canarySkills.get(skillId);
    if (!skill) {
      // Try to find by iterating generatedSkills
      for (const [, s] of this.generatedSkills) {
        if (s.id === skillId) {
          skill = s;
          break;
        }
      }
    }

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
   * Get skill by ID
   */
  getSkillById(skillId) {
    for (const skill of this.generatedSkills.values()) {
      if (skill.id === skillId) return skill;
    }
    return this.canarySkills.get(skillId) || null;
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
      canaryCount: this.canarySkills.size,
      generatedCount: this.generatedSkills.size,
      sandboxAvailable: this.ivmAvailable
    };
  }

  /**
   * Reset the generator state (for testing)
   */
  reset() {
    super.reset();
    this.generatedSkills.clear();
    this.generationQueue = [];
    this.generationHistory = [];
    this.dailyGenerations = 0;
    this.lastResetDate = new Date().toDateString();

    // Clear canary timers
    for (const timerId of this.canaryTimers.values()) {
      clearTimeout(timerId);
    }
    this.canaryTimers.clear();
    this.canarySkills.clear();

    // Clear event listeners
    this._eventListeners.clear();

    this.stats = {
      skillsGenerated: 0,
      skillsValidated: 0,
      skillsFailed: 0,
      skillsPromoted: 0,
      skillsRejected: 0,
      averageConfidence: 0
    };
  }

  /**
   * Shutdown
   */
  async onShutdown() {
    // Clear canary timers
    for (const timerId of this.canaryTimers.values()) {
      clearTimeout(timerId);
    }
    this.canaryTimers.clear();

    if (this.ollamaAdapter) {
      await this.ollamaAdapter.shutdown();
    }
    if (this.isolate) {
      this.isolate.dispose();
    }
  }
}

// Singleton instance
let instance = null;

/**
 * Get the singleton DynamicSkillGenerator instance
 * @param {Object} options - Configuration options
 * @returns {DynamicSkillGenerator} The singleton instance
 */
export function getDynamicSkillGenerator(options = {}) {
  if (!instance) {
    instance = new DynamicSkillGenerator(options);
  }
  return instance;
}

/**
 * Reset the singleton (primarily for testing)
 */
export function resetDynamicSkillGenerator() {
  if (instance) {
    instance.reset();
  }
  instance = null;
}

export { DynamicSkillGenerator };
export default DynamicSkillGenerator;
