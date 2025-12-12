/**
 * Autonomous Build Manager
 *
 * Manages the autonomous building of complete projects.
 * Coordinates agents to generate code for features until projects are complete.
 *
 * Architecture Pattern: Event-Driven Orchestration
 *
 * This is a GENERIC implementation - project-specific features are loaded
 * from configuration files or registered via registerFeature().
 *
 * Flow:
 * 1. Load project specifications/features from config
 * 2. Prioritize and queue features
 * 3. Dispatch feature generation to appropriate agents
 * 4. Verify generated code (run tests)
 * 5. Loop until all features complete
 */

import { getEventBus } from '../../foundation/event-bus/AgentEventBus.js';
import { EventTypes } from '../../foundation/event-bus/eventTypes.js';
import { createLogger } from '../../foundation/common/logger.js';
import { getMetricsCollector } from '../../foundation/metrics-collector/MetricsCollector.js';
import { getRollbackManager } from '../../foundation/rollback-manager/RollbackManager.js';
import path from 'path';
import fs from 'fs';

const logger = createLogger('AutonomousBuildManager');

/**
 * Feature status enum
 */
export const FeatureStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  GENERATED: 'generated',
  TESTING: 'testing',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

/**
 * Autonomous Build Manager
 * Coordinates the continuous building of projects
 */
class AutonomousBuildManager {
  constructor() {
    this.eventBus = getEventBus ? getEventBus() : null;
    this.metricsCollector = getMetricsCollector ? getMetricsCollector() : null;
    this.rollbackManager = getRollbackManager ? getRollbackManager() : null;

    // Build state
    this.isRunning = false;
    this.currentBuild = null;
    this.buildHistory = [];
    this.maxIterations = 50; // Max features per session

    // Feature queue
    this.featureQueue = [];
    this.completedFeatures = [];
    this.failedFeatures = [];

    // Platform to agent mapping - configurable
    this.platformAgents = new Map();

    // Agent references (lazy-loaded)
    this.agents = new Map();

    // Agent loaders - registered dynamically
    this.agentLoaders = new Map();

    // Event subscriptions
    this.unsubscribers = [];

    // Project root - defaults to current working directory
    this.projectRoot = process.cwd();

    if (this.eventBus) {
      this.subscribeToEvents();
    }

    logger.info('AutonomousBuildManager initialized');
  }

  /**
   * Configure the build manager
   * @param {Object} config - Configuration options
   */
  configure(config = {}) {
    if (config.projectRoot) {
      this.projectRoot = config.projectRoot;
    }
    if (config.maxIterations) {
      this.maxIterations = config.maxIterations;
    }
    logger.info('Build manager configured', { projectRoot: this.projectRoot, maxIterations: this.maxIterations });
  }

  /**
   * Register a platform-to-agent mapping
   * @param {string} platform - Platform name (e.g., 'backend', 'frontend')
   * @param {string} agentName - Agent name to handle this platform
   */
  registerPlatformAgent(platform, agentName) {
    this.platformAgents.set(platform, agentName);
    logger.info(`Registered platform agent: ${platform} -> ${agentName}`);
  }

  /**
   * Register an agent loader function
   * @param {string} agentName - Agent name
   * @param {Function} loaderFn - Async function that returns the agent instance
   */
  registerAgentLoader(agentName, loaderFn) {
    this.agentLoaders.set(agentName, loaderFn);
    logger.info(`Registered agent loader: ${agentName}`);
  }

  /**
   * Subscribe to relevant events
   */
  subscribeToEvents() {
    // Listen for code generation completion
    this.unsubscribers.push(
      this.eventBus.subscribe(
        EventTypes.CODE_GENERATED,
        'autonomous-build-manager',
        this.handleCodeGenerated.bind(this)
      )
    );

    // Listen for test results
    this.unsubscribers.push(
      this.eventBus.subscribe(
        EventTypes.TESTS_COMPLETED,
        'autonomous-build-manager',
        this.handleTestsCompleted.bind(this)
      )
    );

    this.unsubscribers.push(
      this.eventBus.subscribe(
        EventTypes.TESTS_FAILED,
        'autonomous-build-manager',
        this.handleTestsFailed.bind(this)
      )
    );

    // Listen for agent failures
    this.unsubscribers.push(
      this.eventBus.subscribe(
        EventTypes.AGENT_FAILED,
        'autonomous-build-manager',
        this.handleAgentFailed.bind(this)
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
   * Load project specifications from docs or config
   * @returns {Array} List of features to build
   */
  async loadProjectSpecs() {
    const specsPath = path.join(this.projectRoot, 'docs', 'project-specs.json');
    const featuresPath = path.join(this.projectRoot, 'docs', 'features.json');
    const minionsConfigPath = path.join(this.projectRoot, 'minions.config.json');

    let features = [];

    // Try loading from minions config
    if (fs.existsSync(minionsConfigPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(minionsConfigPath, 'utf-8'));
        features = config.features || [];
        logger.info(`Loaded ${features.length} features from minions.config.json`);
      } catch (error) {
        logger.warn(`Error loading minions config: ${error.message}`);
      }
    }

    // Try loading from specs file
    if (features.length === 0 && fs.existsSync(specsPath)) {
      try {
        const specs = JSON.parse(fs.readFileSync(specsPath, 'utf-8'));
        features = specs.features || [];
        logger.info(`Loaded ${features.length} features from project-specs.json`);
      } catch (error) {
        logger.warn(`Error loading project specs: ${error.message}`);
      }
    }

    // Try loading from features file
    if (features.length === 0 && fs.existsSync(featuresPath)) {
      try {
        features = JSON.parse(fs.readFileSync(featuresPath, 'utf-8'));
        logger.info(`Loaded ${features.length} features from features.json`);
      } catch (error) {
        logger.warn(`Error loading features: ${error.message}`);
      }
    }

    if (features.length === 0) {
      logger.warn('No features found. Create a minions.config.json or docs/features.json file.');
    }

    return features;
  }

  /**
   * Register a feature to build
   * @param {Object} feature - Feature definition
   */
  registerFeature(feature) {
    if (!feature.id || !feature.name || !feature.platform) {
      throw new Error('Feature must have id, name, and platform');
    }

    this.featureQueue.push({
      ...feature,
      priority: feature.priority || 99,
      dependencies: feature.dependencies || []
    });

    logger.info(`Registered feature: ${feature.name} (${feature.platform})`);
  }

  /**
   * Start autonomous build loop
   * @param {Object} options - Build options
   */
  async start(options = {}) {
    if (this.isRunning) {
      logger.warn('Build loop already running');
      return { success: false, message: 'Already running' };
    }

    this.isRunning = true;
    const startTime = Date.now();

    logger.info('Starting autonomous build loop...');

    try {
      // Initialize build state
      this.currentBuild = {
        id: this.generateBuildId(),
        startTime,
        iteration: 0,
        featuresCompleted: 0,
        featuresTotal: 0
      };

      // Load project specifications if queue is empty
      if (this.featureQueue.length === 0) {
        const features = await this.loadProjectSpecs();
        this.featureQueue = this.prioritizeFeatures(features);
      }

      this.currentBuild.featuresTotal = this.featureQueue.length;

      logger.info(`Build started: ${this.featureQueue.length} features queued`);

      // Publish build started event
      if (this.eventBus) {
        this.eventBus.publish(EventTypes.BUILD_STARTED, {
          agent: 'autonomous-build-manager',
          buildId: this.currentBuild.id,
          featuresCount: this.featureQueue.length
        });
      }

      // Process features
      while (this.featureQueue.length > 0 && this.isRunning) {
        this.currentBuild.iteration++;

        if (this.currentBuild.iteration > this.maxIterations) {
          logger.warn(`Max iterations (${this.maxIterations}) reached`);
          break;
        }

        // Get next feature respecting dependencies
        const feature = this.getNextFeature();
        if (!feature) {
          logger.info('No more features ready to build (waiting for dependencies)');
          break;
        }

        logger.info(`Building feature: ${feature.name} (${feature.platform})`);

        // Build the feature
        const result = await this.buildFeature(feature);

        if (result.success) {
          this.completedFeatures.push({ ...feature, result });
          this.currentBuild.featuresCompleted++;
          logger.info(`Feature completed: ${feature.name}`);
        } else {
          this.failedFeatures.push({ ...feature, result });
          logger.error(`Feature failed: ${feature.name} - ${result.error}`);
        }

        // Small delay between features
        await this.sleep(100);
      }

      // Complete build
      const duration = Date.now() - startTime;
      const buildResult = {
        success: this.failedFeatures.length === 0,
        buildId: this.currentBuild.id,
        duration,
        featuresCompleted: this.completedFeatures.length,
        featuresFailed: this.failedFeatures.length,
        featuresRemaining: this.featureQueue.length
      };

      // Publish build completed
      if (this.eventBus) {
        this.eventBus.publish(EventTypes.BUILD_COMPLETED, {
          agent: 'autonomous-build-manager',
          ...buildResult
        });
      }

      logger.info(`Build completed: ${buildResult.featuresCompleted} features built in ${duration}ms`);

      // Store in history
      this.buildHistory.push({
        ...this.currentBuild,
        endTime: Date.now(),
        result: buildResult
      });

      return buildResult;

    } catch (error) {
      logger.error('Build loop error:', error);

      if (this.eventBus) {
        this.eventBus.publish(EventTypes.BUILD_FAILED, {
          agent: 'autonomous-build-manager',
          buildId: this.currentBuild?.id,
          error: error.message
        });
      }

      return { success: false, error: error.message };

    } finally {
      this.isRunning = false;
      this.currentBuild = null;
    }
  }

  /**
   * Stop the build loop
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping build loop...');
    this.isRunning = false;
  }

  /**
   * Prioritize features by dependencies and priority
   * @param {Array} features - Features to prioritize
   * @returns {Array} Prioritized feature queue
   */
  prioritizeFeatures(features) {
    // Sort by priority (lower number = higher priority)
    // Then by dependency count (fewer deps first)
    return [...features].sort((a, b) => {
      const priorityDiff = (a.priority || 99) - (b.priority || 99);
      if (priorityDiff !== 0) return priorityDiff;
      return (a.dependencies?.length || 0) - (b.dependencies?.length || 0);
    });
  }

  /**
   * Get next feature that has all dependencies met
   * @returns {Object|null} Next feature or null
   */
  getNextFeature() {
    const completedIds = new Set(this.completedFeatures.map(f => f.id));

    const index = this.featureQueue.findIndex(feature => {
      const deps = feature.dependencies || [];
      return deps.every(depId => completedIds.has(depId));
    });

    if (index === -1) {
      return null;
    }

    return this.featureQueue.splice(index, 1)[0];
  }

  /**
   * Build a single feature
   * @param {Object} feature - Feature to build
   * @returns {Object} Build result
   */
  async buildFeature(feature) {
    const startTime = Date.now();

    try {
      // Create checkpoint
      let checkpointId = null;
      if (this.rollbackManager) {
        checkpointId = await this.rollbackManager.createCheckpoint('feature-build', {
          featureId: feature.id,
          featureName: feature.name
        });
      }

      // Get the appropriate agent
      const agentName = this.platformAgents.get(feature.platform);
      if (!agentName) {
        throw new Error(`No agent registered for platform: ${feature.platform}. Use registerPlatformAgent() first.`);
      }

      const agent = await this.loadAgent(agentName);
      if (!agent) {
        throw new Error(`Agent not available: ${agentName}. Use registerAgentLoader() first.`);
      }

      // Generate code for the feature
      let result;
      if (typeof agent.generateCode === 'function') {
        result = await agent.generateCode(feature.digest || feature);
      } else if (typeof agent.generate === 'function') {
        result = await agent.generate(feature.digest || feature);
      } else if (typeof agent.execute === 'function') {
        result = await agent.execute(feature);
      } else {
        // Agent doesn't have generation capability - skip
        logger.warn(`Agent ${agentName} doesn't have code generation capability`);
        return { success: true, skipped: true, reason: 'No generation capability' };
      }

      // Write generated code to disk if provided
      if (result && result.code) {
        await this.writeGeneratedCode(feature, result);
      }

      // Commit checkpoint on success
      if (this.rollbackManager && checkpointId) {
        await this.rollbackManager.commitCheckpoint(checkpointId);
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        duration,
        filesGenerated: result?.code ? Object.keys(result.code).length : 0,
        quality: result?.validation?.score || 100
      };

    } catch (error) {
      logger.error(`Error building feature ${feature.name}:`, error);

      // Rollback on failure
      if (this.rollbackManager) {
        await this.rollbackManager.rollback(null, `Feature build failed: ${feature.name}`);
      }

      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Write generated code to disk
   * @param {Object} feature - Feature being built
   * @param {Object} result - Generation result
   */
  async writeGeneratedCode(feature, result) {
    const basePath = feature.outputPath || this.projectRoot;

    // Ensure base path exists
    if (!fs.existsSync(basePath)) {
      fs.mkdirSync(basePath, { recursive: true });
    }

    // Write each generated file
    const codeObj = result.code;
    for (const [key, component] of Object.entries(codeObj)) {
      if (!component || !component.code) continue;

      const filePath = path.join(basePath, component.path || `${key}.js`);
      const fileDir = path.dirname(filePath);

      // Ensure directory exists
      if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir, { recursive: true });
      }

      // Write file
      fs.writeFileSync(filePath, component.code, 'utf-8');
      logger.info(`Generated: ${filePath}`);
    }

    // Publish code generated event
    if (this.eventBus) {
      this.eventBus.publish(EventTypes.CODE_GENERATED, {
        agent: 'autonomous-build-manager',
        feature: feature.name,
        platform: feature.platform,
        filesGenerated: Object.keys(codeObj).length
      });
    }
  }

  /**
   * Load an agent by name
   * @param {string} agentName - Agent name
   * @returns {Object|null} Agent instance
   */
  async loadAgent(agentName) {
    if (this.agents.has(agentName)) {
      return this.agents.get(agentName);
    }

    const loader = this.agentLoaders.get(agentName);
    if (!loader) {
      return null;
    }

    try {
      const agent = await loader();
      this.agents.set(agentName, agent);
      return agent;
    } catch (error) {
      logger.warn(`Failed to load agent ${agentName}: ${error.message}`);
      return null;
    }
  }

  /**
   * Handle code generated event
   */
  handleCodeGenerated(data) {
    logger.debug(`Code generated event from ${data.agent}`);
  }

  /**
   * Handle tests completed event
   */
  handleTestsCompleted(data) {
    logger.debug('Tests completed event received');
  }

  /**
   * Handle tests failed event
   */
  handleTestsFailed(data) {
    logger.warn(`Tests failed: ${data.summary?.failed || 'unknown'} failures`);
  }

  /**
   * Handle agent failed event
   */
  handleAgentFailed(data) {
    logger.error(`Agent ${data.agent} failed: ${data.error}`);
  }

  /**
   * Get current build status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      currentBuild: this.currentBuild,
      queueLength: this.featureQueue.length,
      completed: this.completedFeatures.length,
      failed: this.failedFeatures.length
    };
  }

  /**
   * Get build history
   */
  getHistory(limit = 10) {
    return this.buildHistory.slice(-limit);
  }

  /**
   * Generate unique build ID
   */
  generateBuildId() {
    return `build-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
let instance = null;

export function getAutonomousBuildManager() {
  if (!instance) {
    instance = new AutonomousBuildManager();
  }
  return instance;
}

export default AutonomousBuildManager;
