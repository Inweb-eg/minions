/**
 * Minions - Vision-Agent
 * ======================
 * The product owner that understands project goals and translates them
 * into actionable requirements for other agents.
 *
 * Responsibilities:
 * - Parse and analyze README.md files for project requirements
 * - Decompose features into Epics → Stories → Tasks
 * - Track product state (planned vs implemented features)
 * - Generate acceptance criteria for features
 *
 * Dependencies: Phase 0 (Foundation)
 */

import EventEmitter from 'events';
import path from 'path';
import fs from 'fs/promises';

import ReadmeParser from './readme-parser.js';
import FeatureDecomposer from './feature-decomposer.js';
import ProductStateManager from './product-state.js';
import AcceptanceGenerator from './acceptance-generator.js';

// Agent States
export const AgentState = {
  IDLE: 'IDLE',
  INITIALIZING: 'INITIALIZING',
  PARSING: 'PARSING',
  DECOMPOSING: 'DECOMPOSING',
  ANALYZING: 'ANALYZING',
  GENERATING: 'GENERATING',
  ERROR: 'ERROR',
  SHUTDOWN: 'SHUTDOWN'
};

// Event Types this agent emits/listens to
export const VisionEvents = {
  // Incoming events (requests to Vision-Agent)
  PARSE_README: 'vision:parse:readme',
  DECOMPOSE_FEATURE: 'vision:decompose:feature',
  GET_PRODUCT_STATE: 'vision:state:get',
  GENERATE_ACCEPTANCE: 'vision:acceptance:generate',

  // Outgoing events (Vision-Agent outputs)
  README_PARSED: 'vision:readme:parsed',
  REQUIREMENTS_READY: 'vision:requirements:ready',
  FEATURE_DECOMPOSED: 'vision:feature:decomposed',
  PRODUCT_STATE_UPDATED: 'vision:state:updated',
  ACCEPTANCE_GENERATED: 'vision:acceptance:generated',
  IMPLICIT_REQUIREMENTS_DETECTED: 'vision:implicit:detected'
};

export class VisionAgent extends EventEmitter {
  constructor(config = {}) {
    super();

    this.name = 'Vision-Agent';
    this.version = '1.0.0';
    this.state = AgentState.IDLE;

    // Configuration
    this.config = {
      projectRoot: config.projectRoot || process.cwd(),
      readmePath: config.readmePath || 'README.md',
      stateDir: config.stateDir || '.vision',
      autoDetectImplicit: config.autoDetectImplicit ?? true,
      complexityThresholds: config.complexityThresholds || {
        simple: 3,
        medium: 8,
        complex: 13
      },
      ...config
    };

    // Initialize sub-components
    this.readmeParser = new ReadmeParser(this.config);
    this.featureDecomposer = new FeatureDecomposer(this.config);
    this.productStateManager = new ProductStateManager(this.config);
    this.acceptanceGenerator = new AcceptanceGenerator(this.config);

    // State storage
    this.currentRequirements = null;
    this.features = new Map();
    this.epics = new Map();
    this.stories = new Map();
    this.tasks = new Map();

    // Metrics
    this.metrics = {
      readmesParsed: 0,
      featuresExtracted: 0,
      epicsCreated: 0,
      storiesCreated: 0,
      tasksCreated: 0,
      acceptanceCriteriaGenerated: 0,
      implicitRequirementsDetected: 0
    };

    this._setupInternalHandlers();
  }

  /**
   * Initialize the Vision-Agent
   */
  async initialize(eventBus = null) {
    this.state = AgentState.INITIALIZING;

    try {
      // Connect to event bus if provided
      if (eventBus) {
        this.eventBus = eventBus;
        this._subscribeToEvents();
      }

      // Create required directories
      await this._ensureDirectories();

      // Load existing state if present
      await this._loadExistingState();

      this.state = AgentState.IDLE;
      this.emit('initialized', { agent: this.name, version: this.version });

      return { success: true, agent: this.name };
    } catch (error) {
      this.state = AgentState.ERROR;
      this.emit('error', { agent: this.name, error: error.message });
      throw error;
    }
  }

  /**
   * Parse README and extract requirements
   */
  async parseReadme(readmePath = null) {
    this.state = AgentState.PARSING;

    try {
      const targetPath = readmePath || path.join(this.config.projectRoot, this.config.readmePath);

      // Parse the README
      const parseResult = await this.readmeParser.parse(targetPath);

      // Extract features
      const features = parseResult.features || [];
      features.forEach(feature => {
        this.features.set(feature.id, feature);
        // Also register with product state manager
        this.productStateManager.addFeature(feature);
      });

      // Detect implicit requirements
      let implicitRequirements = [];
      if (this.config.autoDetectImplicit) {
        implicitRequirements = await this.readmeParser.detectImplicitRequirements(parseResult);
        this.metrics.implicitRequirementsDetected += implicitRequirements.length;

        if (implicitRequirements.length > 0) {
          this.emit(VisionEvents.IMPLICIT_REQUIREMENTS_DETECTED, { implicitRequirements });
        }
      }

      // Store requirements
      this.currentRequirements = {
        ...parseResult,
        implicitRequirements,
        parsedAt: new Date().toISOString()
      };

      // Update metrics
      this.metrics.readmesParsed++;
      this.metrics.featuresExtracted += features.length;

      // Persist state
      await this._saveState();

      // Emit events
      this.emit(VisionEvents.README_PARSED, { parseResult });
      this.emit(VisionEvents.REQUIREMENTS_READY, { requirements: this.currentRequirements });

      // Publish to event bus
      if (this.eventBus) {
        this.eventBus.publish(VisionEvents.REQUIREMENTS_READY, {
          agent: this.name,
          requirements: this.currentRequirements
        });
      }

      this.state = AgentState.IDLE;

      return {
        success: true,
        requirements: this.currentRequirements,
        featuresCount: features.length,
        implicitCount: implicitRequirements.length
      };
    } catch (error) {
      this.state = AgentState.ERROR;
      this.emit('error', { operation: 'parseReadme', error: error.message });
      throw error;
    }
  }

  /**
   * Decompose a feature into Epic → Stories → Tasks
   */
  async decomposeFeature(featureId, options = {}) {
    this.state = AgentState.DECOMPOSING;

    try {
      const feature = this.features.get(featureId);
      if (!feature) {
        throw new Error(`Feature not found: ${featureId}`);
      }

      // Decompose into Epic
      const epic = await this.featureDecomposer.createEpic(feature, options);
      this.epics.set(epic.id, epic);
      this.metrics.epicsCreated++;

      // Create Stories from Epic
      const stories = await this.featureDecomposer.createStories(epic, options);
      stories.forEach(story => {
        this.stories.set(story.id, story);
      });
      this.metrics.storiesCreated += stories.length;

      // Create Tasks from Stories
      const tasks = [];
      for (const story of stories) {
        const storyTasks = await this.featureDecomposer.createTasks(story, options);
        storyTasks.forEach(task => {
          this.tasks.set(task.id, task);
          tasks.push(task);
        });
      }
      this.metrics.tasksCreated += tasks.length;

      // Update product state
      await this.productStateManager.addDecomposition(featureId, {
        epic,
        stories,
        tasks
      });

      // Persist state
      await this._saveState();

      const result = {
        featureId,
        epic,
        stories,
        tasks,
        totalComplexity: epic.complexity + stories.reduce((sum, s) => sum + s.complexity, 0)
      };

      // Emit events
      this.emit(VisionEvents.FEATURE_DECOMPOSED, result);

      if (this.eventBus) {
        this.eventBus.publish(VisionEvents.FEATURE_DECOMPOSED, {
          agent: this.name,
          ...result
        });
      }

      this.state = AgentState.IDLE;

      return {
        success: true,
        ...result
      };
    } catch (error) {
      this.state = AgentState.ERROR;
      this.emit('error', { operation: 'decomposeFeature', error: error.message });
      throw error;
    }
  }

  /**
   * Decompose all features
   */
  async decomposeAllFeatures(options = {}) {
    const results = [];

    for (const [featureId] of this.features) {
      try {
        const result = await this.decomposeFeature(featureId, options);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          featureId,
          error: error.message
        });
      }
    }

    return {
      success: true,
      results,
      summary: {
        totalFeatures: this.features.size,
        totalEpics: this.epics.size,
        totalStories: this.stories.size,
        totalTasks: this.tasks.size
      }
    };
  }

  /**
   * Generate acceptance criteria for a feature/story
   */
  async generateAcceptanceCriteria(itemId, itemType = 'feature') {
    this.state = AgentState.GENERATING;

    try {
      let item;
      switch (itemType) {
        case 'feature':
          item = this.features.get(itemId);
          break;
        case 'epic':
          item = this.epics.get(itemId);
          break;
        case 'story':
          item = this.stories.get(itemId);
          break;
        default:
          throw new Error(`Unknown item type: ${itemType}`);
      }

      if (!item) {
        throw new Error(`${itemType} not found: ${itemId}`);
      }

      const acceptanceCriteria = await this.acceptanceGenerator.generate(item, itemType);
      this.metrics.acceptanceCriteriaGenerated += acceptanceCriteria.length;

      // Attach to item
      item.acceptanceCriteria = acceptanceCriteria;

      // Persist state
      await this._saveState();

      const result = {
        itemId,
        itemType,
        acceptanceCriteria
      };

      // Emit events
      this.emit(VisionEvents.ACCEPTANCE_GENERATED, result);

      if (this.eventBus) {
        this.eventBus.publish(VisionEvents.ACCEPTANCE_GENERATED, {
          agent: this.name,
          ...result
        });
      }

      this.state = AgentState.IDLE;

      return {
        success: true,
        ...result
      };
    } catch (error) {
      this.state = AgentState.ERROR;
      this.emit('error', { operation: 'generateAcceptanceCriteria', error: error.message });
      throw error;
    }
  }

  /**
   * Get current product state
   */
  getProductState() {
    return this.productStateManager.getState();
  }

  /**
   * Update feature status (planned → in_progress → implemented)
   */
  async updateFeatureStatus(featureId, status, metadata = {}) {
    const result = await this.productStateManager.updateStatus(featureId, status, metadata);

    if (result.success) {
      this.emit(VisionEvents.PRODUCT_STATE_UPDATED, {
        featureId,
        status,
        metadata
      });

      if (this.eventBus) {
        this.eventBus.publish(VisionEvents.PRODUCT_STATE_UPDATED, {
          agent: this.name,
          featureId,
          status,
          metadata
        });
      }
    }

    return result;
  }

  /**
   * Get all features
   */
  getFeatures() {
    return Array.from(this.features.values());
  }

  /**
   * Get feature by ID
   */
  getFeature(featureId) {
    return this.features.get(featureId) || null;
  }

  /**
   * Get all epics
   */
  getEpics() {
    return Array.from(this.epics.values());
  }

  /**
   * Get all stories
   */
  getStories(epicId = null) {
    const stories = Array.from(this.stories.values());
    if (epicId) {
      return stories.filter(s => s.epicId === epicId);
    }
    return stories;
  }

  /**
   * Get all tasks
   */
  getTasks(storyId = null) {
    const tasks = Array.from(this.tasks.values());
    if (storyId) {
      return tasks.filter(t => t.storyId === storyId);
    }
    return tasks;
  }

  /**
   * Get current requirements
   */
  getRequirements() {
    return this.currentRequirements;
  }

  /**
   * Get agent metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      state: this.state,
      featuresCount: this.features.size,
      epicsCount: this.epics.size,
      storiesCount: this.stories.size,
      tasksCount: this.tasks.size
    };
  }

  /**
   * Shutdown the agent
   */
  async shutdown() {
    this.state = AgentState.SHUTDOWN;

    // Persist current state
    await this._saveState();

    this.emit('shutdown', { agent: this.name });
    this.removeAllListeners();
  }

  // ==================== Private Methods ====================

  _setupInternalHandlers() {
    // Handle sub-component events
    this.readmeParser.on('warning', (warning) => {
      this.emit('warning', { source: 'ReadmeParser', ...warning });
    });

    this.featureDecomposer.on('complexity:high', (data) => {
      this.emit('warning', { source: 'FeatureDecomposer', message: 'High complexity detected', ...data });
    });
  }

  _subscribeToEvents() {
    if (!this.eventBus) return;

    // Listen for README parse requests
    this.eventBus.subscribe(VisionEvents.PARSE_README, this.name, async (data) => {
      await this.parseReadme(data.readmePath);
    });

    // Listen for feature decomposition requests
    this.eventBus.subscribe(VisionEvents.DECOMPOSE_FEATURE, this.name, async (data) => {
      await this.decomposeFeature(data.featureId, data.options);
    });

    // Listen for product state requests
    this.eventBus.subscribe(VisionEvents.GET_PRODUCT_STATE, this.name, async (data) => {
      const state = this.getProductState();
      if (this.eventBus && data.requestId) {
        this.eventBus.publish(`vision:state:result:${data.requestId}`, {
          agent: this.name,
          state
        });
      }
    });

    // Listen for acceptance criteria generation requests
    this.eventBus.subscribe(VisionEvents.GENERATE_ACCEPTANCE, this.name, async (data) => {
      await this.generateAcceptanceCriteria(data.itemId, data.itemType);
    });
  }

  async _ensureDirectories() {
    const stateDir = path.join(this.config.projectRoot, this.config.stateDir);
    await fs.mkdir(stateDir, { recursive: true });
  }

  async _loadExistingState() {
    try {
      const statePath = path.join(
        this.config.projectRoot,
        this.config.stateDir,
        'vision-state.json'
      );

      const data = await fs.readFile(statePath, 'utf-8');
      const state = JSON.parse(data);

      // Restore state
      if (state.requirements) {
        this.currentRequirements = state.requirements;
      }

      if (state.features) {
        state.features.forEach(f => this.features.set(f.id, f));
      }

      if (state.epics) {
        state.epics.forEach(e => this.epics.set(e.id, e));
      }

      if (state.stories) {
        state.stories.forEach(s => this.stories.set(s.id, s));
      }

      if (state.tasks) {
        state.tasks.forEach(t => this.tasks.set(t.id, t));
      }

      if (state.metrics) {
        this.metrics = { ...this.metrics, ...state.metrics };
      }

      // Restore product state manager
      await this.productStateManager.loadState(state.productState);

    } catch (error) {
      // No existing state - that's okay
    }
  }

  async _saveState() {
    const statePath = path.join(
      this.config.projectRoot,
      this.config.stateDir,
      'vision-state.json'
    );

    const state = {
      requirements: this.currentRequirements,
      features: Array.from(this.features.values()),
      epics: Array.from(this.epics.values()),
      stories: Array.from(this.stories.values()),
      tasks: Array.from(this.tasks.values()),
      metrics: this.metrics,
      productState: this.productStateManager.getState(),
      savedAt: new Date().toISOString()
    };

    await fs.writeFile(statePath, JSON.stringify(state, null, 2));
  }
}

// Export singleton factory
let instance = null;

export function getVisionAgent(config) {
  if (!instance) {
    instance = new VisionAgent(config);
  }
  return instance;
}

export function resetVisionAgent() {
  if (instance) {
    instance.shutdown().catch(() => {});
    instance = null;
  }
}

// Re-export sub-components with all types
export { ReadmeParser, FeatureType, SectionType } from './readme-parser.js';
export { FeatureDecomposer, ComplexityLevel, WorkItemType, StoryCategory } from './feature-decomposer.js';
export { ProductStateManager, FeatureStatus, ProgressMethod } from './product-state.js';
export { AcceptanceGenerator, CriteriaFormat, CriteriaCategory } from './acceptance-generator.js';

export default VisionAgent;
