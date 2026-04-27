/**
 * AgentLoader
 * -----------
 * Deferred/lazy agent loading with parallel initialization.
 * Inspired by Claude Code's shouldDefer/alwaysLoad pattern.
 *
 * Agents are categorized:
 * - EAGER: loaded and initialized at startup (critical agents)
 * - DEFERRED: loaded on first use (optional agents)
 *
 * Eager agents initialize in parallel (not sequential) for faster startup.
 * Deferred agents loaded via loadAgent() on demand.
 */

import { createLogger } from '../common/logger.js';

const logger = createLogger('AgentLoader');

/**
 * Agent loading priority
 */
export const LoadPriority = {
  EAGER: 'eager',       // Load at startup
  DEFERRED: 'deferred'  // Load on first use
};

class AgentLoader {
  constructor() {
    this.registry = new Map();    // name → { importFn, initFn, priority, instance, loaded, error }
    this.loadTimes = new Map();   // name → duration in ms
    this.totalStartupTime = 0;
  }

  /**
   * Register an agent for loading
   * @param {string} name - Agent name
   * @param {Function} importFn - async () => module (dynamic import)
   * @param {object} options - { priority, initFn, factory }
   *   priority: 'eager' | 'deferred' (default: 'deferred')
   *   initFn: async (module) => agent instance (default: module.default or module.getInstance())
   *   factory: string - name of factory function in module (e.g., 'getGruAgent')
   */
  register(name, importFn, options = {}) {
    this.registry.set(name, {
      importFn,
      priority: options.priority || LoadPriority.DEFERRED,
      initFn: options.initFn || null,
      factory: options.factory || null,
      factoryArgs: options.factoryArgs || null,
      instance: null,
      loaded: false,
      error: null
    });

    logger.debug(`Agent registered: ${name} (${options.priority || 'deferred'})`);
  }

  /**
   * Initialize all EAGER agents in parallel
   * @returns {{ loaded: string[], failed: string[], duration: number }}
   */
  async initializeEager() {
    const startTime = Date.now();
    const eagerAgents = [];

    for (const [name, entry] of this.registry) {
      if (entry.priority === LoadPriority.EAGER) {
        eagerAgents.push(name);
      }
    }

    if (eagerAgents.length === 0) {
      logger.info('No eager agents to initialize');
      return { loaded: [], failed: [], duration: 0 };
    }

    logger.info(`Initializing ${eagerAgents.length} eager agents in parallel: ${eagerAgents.join(', ')}`);

    // Load all eager agents in parallel
    const results = await Promise.allSettled(
      eagerAgents.map(name => this._loadAndInit(name))
    );

    const loaded = [];
    const failed = [];

    for (let i = 0; i < eagerAgents.length; i++) {
      const name = eagerAgents[i];
      if (results[i].status === 'fulfilled') {
        loaded.push(name);
      } else {
        failed.push(name);
        logger.warn(`Eager agent failed: ${name} - ${results[i].reason?.message || results[i].reason}`);
      }
    }

    this.totalStartupTime = Date.now() - startTime;
    logger.info(`Eager init complete: ${loaded.length} loaded, ${failed.length} failed (${this.totalStartupTime}ms)`);

    return { loaded, failed, duration: this.totalStartupTime };
  }

  /**
   * Get an agent instance (loads on demand if deferred)
   * @param {string} name
   * @returns {Promise<object|null>}
   */
  async getAgent(name) {
    const entry = this.registry.get(name);
    if (!entry) {
      logger.warn(`Unknown agent: ${name}`);
      return null;
    }

    if (entry.loaded && entry.instance) {
      return entry.instance;
    }

    if (entry.error) {
      logger.warn(`Agent ${name} previously failed to load: ${entry.error}`);
      return null;
    }

    // Load on demand
    try {
      await this._loadAndInit(name);
      return entry.instance;
    } catch (error) {
      logger.warn(`Failed to load agent ${name} on demand: ${error.message}`);
      return null;
    }
  }

  /**
   * Internal: load module and initialize agent
   */
  async _loadAndInit(name) {
    const entry = this.registry.get(name);
    if (!entry) throw new Error(`Agent not registered: ${name}`);
    if (entry.loaded) return entry.instance;

    const startTime = Date.now();

    try {
      // Dynamic import
      const module = await entry.importFn();

      // Get agent instance
      let instance;
      if (entry.initFn) {
        instance = await entry.initFn(module);
      } else if (entry.factory && typeof module[entry.factory] === 'function') {
        instance = entry.factoryArgs
          ? module[entry.factory](entry.factoryArgs)
          : module[entry.factory]();
      } else if (typeof module.getInstance === 'function') {
        instance = module.getInstance();
      } else if (module.default && typeof module.default === 'function') {
        instance = new module.default();
      } else {
        instance = module.default || module;
      }

      // Initialize if method exists
      if (instance && typeof instance.initialize === 'function') {
        await instance.initialize();
      }

      entry.instance = instance;
      entry.loaded = true;

      const duration = Date.now() - startTime;
      this.loadTimes.set(name, duration);
      logger.info(`Agent loaded: ${name} (${duration}ms)`);

      return instance;

    } catch (error) {
      entry.error = error.message;
      const duration = Date.now() - startTime;
      this.loadTimes.set(name, duration);
      logger.error(`Agent load failed: ${name} (${duration}ms):`, error);
      throw error;
    }
  }

  /**
   * Check if an agent is loaded
   */
  isLoaded(name) {
    const entry = this.registry.get(name);
    return entry ? entry.loaded : false;
  }

  /**
   * Get loading statistics
   */
  getStats() {
    const stats = {
      totalRegistered: this.registry.size,
      eager: 0,
      deferred: 0,
      loaded: 0,
      failed: 0,
      totalStartupTime: this.totalStartupTime,
      loadTimes: Object.fromEntries(this.loadTimes)
    };

    for (const entry of this.registry.values()) {
      if (entry.priority === LoadPriority.EAGER) stats.eager++;
      else stats.deferred++;
      if (entry.loaded) stats.loaded++;
      if (entry.error) stats.failed++;
    }

    return stats;
  }

  /**
   * Get all loaded agent instances
   */
  getLoadedAgents() {
    const agents = {};
    for (const [name, entry] of this.registry) {
      if (entry.loaded && entry.instance) {
        agents[name] = entry.instance;
      }
    }
    return agents;
  }

  /**
   * Reset (for testing)
   */
  reset() {
    this.registry.clear();
    this.loadTimes.clear();
    this.totalStartupTime = 0;
  }
}

// Singleton
let instance = null;

export function getAgentLoader() {
  if (!instance) {
    instance = new AgentLoader();
  }
  return instance;
}

export function resetAgentLoader() {
  if (instance) {
    instance.reset();
  }
  instance = null;
}

export default AgentLoader;
