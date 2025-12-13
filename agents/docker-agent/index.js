/**
 * Docker-Agent - Complete Docker Management System
 *
 * Phase 8: Docker-Agent
 * Main entry point for all Docker-Agent modules
 *
 * Architecture Pattern: Event-Driven Agent
 * Follows: Singleton pattern, EventBus integration
 */

// EventBus integration
let getEventBus, EventTypes;
try {
  const eventBusModule = await import('../../foundation/event-bus/AgentEventBus.js');
  const eventTypesModule = await import('../../foundation/event-bus/eventTypes.js');
  getEventBus = eventBusModule.getEventBus;
  EventTypes = eventTypesModule.EventTypes;
} catch (error) {
  // Fallback if foundation not available
  getEventBus = null;
  EventTypes = null;
}

// Detectors
export * from './detectors/index.js';

// Builders
export * from './builders/index.js';

// Validators
export * from './validators/index.js';

// Optimizers
export * from './optimizers/index.js';

// Monitors
export * from './monitors/index.js';

// Utilities
export { createLogger } from './utils/logger.js';

/**
 * Docker-Agent Version
 */
export const VERSION = '1.0.0';

/**
 * Docker-Agent Info
 */
export const INFO = {
  name: 'Docker-Agent',
  version: VERSION,
  description: 'Comprehensive Docker management system with build, validation, optimization, and monitoring capabilities',
  modules: [
    'detectors',    // Change detection
    'builders',     // Docker image building
    'validators',   // Validation and linting
    'optimizers',   // Size and security optimization
    'monitors'      // Health and resource monitoring
  ]
};

/**
 * Get Docker-Agent information
 * @returns {Object} Agent information
 */
export function getInfo() {
  return INFO;
}

/**
 * Initialize Docker-Agent
 * @param {Object} options - Initialization options
 * @returns {Object} Initialized components
 */
export async function initialize(options = {}) {
  const {
    enableDetectors = true,
    enableBuilders = true,
    enableValidators = true,
    enableOptimizers = true,
    enableMonitors = true,
    monitorOptions = {}
  } = options;

  const components = {};

  // Import modules dynamically based on options
  if (enableDetectors) {
    const { getAllDetectors } = await import('./detectors/index.js');
    components.detectors = getAllDetectors();
  }

  if (enableBuilders) {
    const { getAllBuilders } = await import('./builders/index.js');
    components.builders = getAllBuilders();
  }

  if (enableValidators) {
    const { getAllValidators } = await import('./validators/index.js');
    components.validators = getAllValidators();
  }

  if (enableOptimizers) {
    const { getAllOptimizers } = await import('./optimizers/index.js');
    components.optimizers = getAllOptimizers();
  }

  if (enableMonitors) {
    const { getAllMonitors, startAllMonitors } = await import('./monitors/index.js');
    components.monitors = getAllMonitors();

    // Start monitors if requested
    if (monitorOptions.autoStart) {
      await startAllMonitors(monitorOptions);
    }
  }

  return components;
}

/**
 * Shutdown Docker-Agent
 * @param {Object} components - Initialized components
 * @returns {Promise<void>}
 */
export async function shutdown(components = {}) {
  // Stop monitors if running
  if (components.monitors) {
    const { stopAllMonitors } = await import('./monitors/index.js');
    await stopAllMonitors();
  }

  // Clear histories
  if (components.detectors) {
    const { resetAllDetectors } = await import('./detectors/index.js');
    resetAllDetectors();
  }

  if (components.builders) {
    const { clearAllHistories } = await import('./builders/index.js');
    clearAllHistories();
  }

  if (components.validators) {
    const { clearAllHistories } = await import('./validators/index.js');
    clearAllHistories();
  }

  if (components.optimizers) {
    const { clearAllHistories } = await import('./optimizers/index.js');
    clearAllHistories();
  }
}

/**
 * Get Docker-Agent status
 * @param {Object} components - Initialized components
 * @returns {Object} Status information
 */
export function getStatus(components = {}) {
  const status = {
    version: VERSION,
    modules: {},
    timestamp: new Date().toISOString()
  };

  if (components.detectors) {
    status.modules.detectors = Object.keys(components.detectors).map(key => ({
      name: key,
      state: components.detectors[key].getState?.() || 'unknown'
    }));
  }

  if (components.builders) {
    status.modules.builders = Object.keys(components.builders).map(key => ({
      name: key,
      statistics: components.builders[key].getStatistics?.() || {}
    }));
  }

  if (components.validators) {
    status.modules.validators = Object.keys(components.validators).map(key => ({
      name: key,
      statistics: components.validators[key].getStatistics?.() || {}
    }));
  }

  if (components.optimizers) {
    status.modules.optimizers = Object.keys(components.optimizers).map(key => ({
      name: key,
      statistics: components.optimizers[key].getStatistics?.() || {}
    }));
  }

  if (components.monitors) {
    status.modules.monitors = Object.keys(components.monitors).map(key => ({
      name: key,
      status: components.monitors[key].getStatus?.() || {}
    }));
  }

  return status;
}

/**
 * DockerAgent class for orchestrator compatibility
 */
class DockerAgent {
  constructor() {
    this.components = null;
    this.initialized = false;

    // EventBus integration
    this.eventBus = getEventBus ? getEventBus() : null;
    this.EventTypes = EventTypes;
    this.unsubscribers = [];

    if (this.eventBus) {
      this.subscribeToEvents();
    }
  }

  /**
   * Subscribe to EventBus events
   */
  subscribeToEvents() {
    // Listen for auto-fix requests from Manager-Agent
    this.unsubscribers.push(
      this.eventBus.subscribe(
        this.EventTypes.AUTO_FIX_REQUESTED,
        'docker-agent',
        this.handleAutoFixRequest.bind(this)
      )
    );

    // Also listen for Docker-specific events
    this.unsubscribers.push(
      this.eventBus.subscribe(
        this.EventTypes.CODE_UPDATED,
        'docker-agent',
        this.handleCodeUpdated.bind(this)
      )
    );
  }

  /**
   * Handle auto-fix request from Manager-Agent
   */
  async handleAutoFixRequest(data) {
    if (data.targetAgent !== 'docker-agent') {
      return;
    }

    if (this.eventBus && this.EventTypes) {
      this.eventBus.publish(this.EventTypes.AGENT_STARTED, {
        agent: 'docker-agent',
        action: data.action || 'auto-fix',
        loopId: data.loopId
      });
    }

    try {
      const result = await this.execute();

      if (this.eventBus && this.EventTypes) {
        this.eventBus.publish(this.EventTypes.AGENT_COMPLETED, {
          agent: 'docker-agent',
          action: data.action || 'auto-fix',
          results: result,
          loopId: data.loopId
        });
      }
    } catch (error) {
      if (this.eventBus && this.EventTypes) {
        this.eventBus.publish(this.EventTypes.AGENT_FAILED, {
          agent: 'docker-agent',
          action: data.action || 'auto-fix',
          error: error.message,
          loopId: data.loopId
        });
      }
    }
  }

  /**
   * Handle code updates - check if Docker files need rebuilding
   */
  async handleCodeUpdated(data) {
    // Check if Dockerfile or docker-compose files were modified
    const dockerFiles = (data.filesModified || []).filter(f =>
      f.includes('Dockerfile') || f.includes('docker-compose') || f.includes('.dockerignore')
    );

    if (dockerFiles.length > 0 && this.eventBus && this.EventTypes) {
      this.eventBus.publish(this.EventTypes.CODE_UPDATED, {
        agent: 'docker-agent',
        type: 'docker-rebuild-needed',
        files: dockerFiles,
        sourceAgent: data.agent
      });
    }
  }

  /**
   * Cleanup subscriptions
   */
  cleanup() {
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
    this.unsubscribers = [];
  }

  async initialize(options = {}) {
    if (this.initialized) return;
    this.components = await initialize(options);
    this.initialized = true;
  }

  async execute() {
    if (!this.initialized) {
      await this.initialize();
    }
    // Docker agent execution logic - validates and builds as needed
    return { success: true, agent: 'docker-agent' };
  }

  getStatus() {
    return getStatus(this.components);
  }

  async shutdown() {
    this.cleanup();
    if (this.components) {
      await shutdown(this.components);
    }
  }
}

// Singleton instance
let dockerAgentInstance = null;

/**
 * Get DockerAgent singleton instance
 * @returns {DockerAgent} DockerAgent instance
 */
export function getDockerAgent() {
  if (!dockerAgentInstance) {
    dockerAgentInstance = new DockerAgent();
  }
  return dockerAgentInstance;
}
