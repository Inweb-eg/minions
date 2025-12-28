/**
 * PluginMarketplace - Community-Driven Agent Ecosystem
 *
 * Revolutionary Enhancement: Extensible marketplace for custom agents
 *
 * Features:
 * - Plugin discovery and installation
 * - Security scanning before installation
 * - Sandbox testing for plugins
 * - Rating and review system
 * - Revenue sharing for developers
 * - Version management
 * - Dependency resolution
 */

import { createLogger } from '../common/logger.js';
import { getEventBus } from '../event-bus/AgentEventBus.js';
import { EventTypes } from '../event-bus/eventTypes.js';

const logger = createLogger('PluginMarketplace');

// Plugin categories
const PLUGIN_CATEGORIES = {
  AGENT: 'agent',
  SKILL: 'skill',
  INTEGRATION: 'integration',
  ANALYZER: 'analyzer',
  GENERATOR: 'generator',
  MONITOR: 'monitor',
  THEME: 'theme'
};

// Plugin status
const PLUGIN_STATUS = {
  AVAILABLE: 'available',
  INSTALLED: 'installed',
  DISABLED: 'disabled',
  UPDATING: 'updating',
  DEPRECATED: 'deprecated'
};

// Security scan levels
const SECURITY_LEVELS = {
  VERIFIED: { name: 'verified', badge: '✓', trust: 1.0 },
  REVIEWED: { name: 'reviewed', badge: '○', trust: 0.8 },
  COMMUNITY: { name: 'community', badge: '◇', trust: 0.5 },
  UNVERIFIED: { name: 'unverified', badge: '⚠', trust: 0.2 }
};

class PluginMarketplace {
  constructor(options = {}) {
    this.logger = logger;
    this.eventBus = null;
    this.initialized = false;

    // Configuration
    this.config = {
      registryUrl: options.registryUrl || 'https://registry.minions.ai',
      enableSecurityScan: options.enableSecurityScan !== false,
      enableSandbox: options.enableSandbox !== false,
      revSharePercentage: options.revSharePercentage || 70,
      trialDays: options.trialDays || 7
    };

    // State
    this.installedPlugins = new Map();
    this.availablePlugins = new Map();
    this.pluginConfigs = new Map();
    this.ratings = new Map();

    // Featured/sample plugins (would come from registry in production)
    this.registry = this.initializeSampleRegistry();

    // Statistics
    this.stats = {
      totalInstalls: 0,
      totalUninstalls: 0,
      securityScans: 0,
      sandboxTests: 0,
      failedInstalls: 0
    };
  }

  /**
   * Initialize sample registry
   */
  initializeSampleRegistry() {
    return new Map([
      ['code-reviewer', {
        id: 'code-reviewer',
        name: 'Advanced Code Reviewer',
        description: 'AI-powered code review with style and security analysis',
        version: '2.0.0',
        author: 'minions-core',
        category: PLUGIN_CATEGORIES.ANALYZER,
        downloads: 15420,
        rating: 4.8,
        price: 0,
        security: SECURITY_LEVELS.VERIFIED,
        dependencies: [],
        capabilities: ['review', 'security-scan', 'style-check']
      }],
      ['api-generator', {
        id: 'api-generator',
        name: 'REST API Generator',
        description: 'Generate complete REST APIs from specifications',
        version: '1.5.0',
        author: 'minions-core',
        category: PLUGIN_CATEGORIES.GENERATOR,
        downloads: 12300,
        rating: 4.7,
        price: 0,
        security: SECURITY_LEVELS.VERIFIED,
        dependencies: [],
        capabilities: ['generate-api', 'openapi', 'swagger']
      }],
      ['test-writer', {
        id: 'test-writer',
        name: 'Smart Test Generator',
        description: 'Automatically generate comprehensive tests with edge cases',
        version: '1.3.0',
        author: 'community',
        category: PLUGIN_CATEGORIES.GENERATOR,
        downloads: 8950,
        rating: 4.5,
        price: 9.99,
        security: SECURITY_LEVELS.REVIEWED,
        dependencies: [],
        capabilities: ['unit-tests', 'integration-tests', 'e2e-tests']
      }],
      ['docker-agent', {
        id: 'docker-agent',
        name: 'Docker Integration Agent',
        description: 'Manage Docker containers and compose files',
        version: '1.0.0',
        author: 'community',
        category: PLUGIN_CATEGORIES.INTEGRATION,
        downloads: 6780,
        rating: 4.3,
        price: 0,
        security: SECURITY_LEVELS.COMMUNITY,
        dependencies: [],
        capabilities: ['docker-build', 'docker-compose', 'container-management']
      }],
      ['security-squad', {
        id: 'security-squad',
        name: 'Security Analysis Squad',
        description: 'Comprehensive security scanning with vulnerability detection',
        version: '2.1.0',
        author: 'security-team',
        category: PLUGIN_CATEGORIES.ANALYZER,
        downloads: 11200,
        rating: 4.9,
        price: 19.99,
        security: SECURITY_LEVELS.VERIFIED,
        dependencies: ['code-reviewer'],
        capabilities: ['vulnerability-scan', 'dependency-audit', 'owasp-check']
      }],
      ['performance-optimizer', {
        id: 'performance-optimizer',
        name: 'Auto Performance Optimizer',
        description: 'Automatically optimize code for performance',
        version: '1.2.0',
        author: 'community',
        category: PLUGIN_CATEGORIES.AGENT,
        downloads: 4500,
        rating: 4.2,
        price: 14.99,
        security: SECURITY_LEVELS.REVIEWED,
        dependencies: [],
        capabilities: ['profiling', 'optimization', 'caching']
      }]
    ]);
  }

  /**
   * Initialize the marketplace
   */
  async initialize() {
    if (this.initialized) return;

    try {
      this.eventBus = getEventBus();

      // Load available plugins from registry
      await this.refreshRegistry();
    } catch (error) {
      this.logger.warn('Initialization issue', error);
    }

    this.initialized = true;
    this.logger.info('PluginMarketplace initialized', {
      availablePlugins: this.registry.size
    });
  }

  /**
   * Refresh plugin registry
   */
  async refreshRegistry() {
    // In production, fetch from remote registry
    // For now, use local sample registry
    this.availablePlugins = new Map(this.registry);
    this.logger.info('Registry refreshed', { plugins: this.availablePlugins.size });
  }

  /**
   * Search plugins
   */
  async searchPlugins(query, options = {}) {
    const {
      category,
      minRating = 0,
      maxPrice,
      securityLevel,
      sortBy = 'downloads'
    } = options;

    let results = Array.from(this.availablePlugins.values());

    // Filter by query
    if (query) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(p =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.description.toLowerCase().includes(lowerQuery) ||
        p.capabilities.some(c => c.toLowerCase().includes(lowerQuery))
      );
    }

    // Filter by category
    if (category) {
      results = results.filter(p => p.category === category);
    }

    // Filter by rating
    results = results.filter(p => p.rating >= minRating);

    // Filter by price
    if (maxPrice !== undefined) {
      results = results.filter(p => p.price <= maxPrice);
    }

    // Filter by security level
    if (securityLevel) {
      results = results.filter(p => p.security.name === securityLevel);
    }

    // Sort
    switch (sortBy) {
      case 'downloads':
        results.sort((a, b) => b.downloads - a.downloads);
        break;
      case 'rating':
        results.sort((a, b) => b.rating - a.rating);
        break;
      case 'name':
        results.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'price':
        results.sort((a, b) => a.price - b.price);
        break;
    }

    return results;
  }

  /**
   * Install a plugin
   */
  async installPlugin(pluginId, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const plugin = this.availablePlugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    if (this.installedPlugins.has(pluginId)) {
      throw new Error(`Plugin already installed: ${pluginId}`);
    }

    this.logger.info(`Installing plugin: ${plugin.name}`);

    // Check dependencies
    for (const depId of plugin.dependencies) {
      if (!this.installedPlugins.has(depId)) {
        this.logger.info(`Installing dependency: ${depId}`);
        await this.installPlugin(depId);
      }
    }

    // Security scan
    if (this.config.enableSecurityScan) {
      const scanResult = await this.securityScan(plugin);
      this.stats.securityScans++;

      if (!scanResult.passed) {
        this.stats.failedInstalls++;
        throw new Error(`Security scan failed: ${scanResult.reason}`);
      }
    }

    // Sandbox test
    if (this.config.enableSandbox) {
      const testResult = await this.sandboxTest(plugin);
      this.stats.sandboxTests++;

      if (!testResult.passed) {
        this.stats.failedInstalls++;
        throw new Error(`Sandbox test failed: ${testResult.reason}`);
      }
    }

    // Install plugin
    const installation = {
      plugin,
      installedAt: Date.now(),
      version: plugin.version,
      status: PLUGIN_STATUS.INSTALLED,
      config: options.config || {}
    };

    this.installedPlugins.set(pluginId, installation);
    this.stats.totalInstalls++;

    // Emit event
    if (this.eventBus) {
      this.eventBus.publish(EventTypes.AGENT_REGISTERED, {
        agent: 'plugin-marketplace',
        type: 'plugin-installed',
        pluginId,
        pluginName: plugin.name
      });
    }

    this.logger.info(`Plugin installed: ${plugin.name}`);

    return {
      success: true,
      plugin: installation,
      message: `Successfully installed ${plugin.name} v${plugin.version}`
    };
  }

  /**
   * Security scan for plugin
   */
  async securityScan(plugin) {
    this.logger.debug(`Security scanning: ${plugin.name}`);

    // Simulate security scan
    return new Promise((resolve) => {
      setTimeout(() => {
        // Trust level based on security rating
        const passed = plugin.security.trust >= 0.5;
        resolve({
          passed,
          trustLevel: plugin.security.name,
          reason: passed ? 'Passed security review' : 'Insufficient trust level',
          details: {
            noMalware: true,
            noNetworkAccess: plugin.security.trust >= 0.8,
            sandboxed: true
          }
        });
      }, 100);
    });
  }

  /**
   * Sandbox test for plugin
   */
  async sandboxTest(plugin) {
    this.logger.debug(`Sandbox testing: ${plugin.name}`);

    // Simulate sandbox testing
    return new Promise((resolve) => {
      setTimeout(() => {
        const passed = Math.random() > 0.1; // 90% pass rate
        resolve({
          passed,
          duration: Math.random() * 2000 + 500,
          reason: passed ? 'All tests passed' : 'Resource limit exceeded',
          metrics: {
            memoryUsage: Math.random() * 50 + 10,
            cpuUsage: Math.random() * 30 + 5,
            apiCalls: Math.floor(Math.random() * 10)
          }
        });
      }, 200);
    });
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(pluginId) {
    const installation = this.installedPlugins.get(pluginId);
    if (!installation) {
      throw new Error(`Plugin not installed: ${pluginId}`);
    }

    // Check dependents
    for (const [id, inst] of this.installedPlugins) {
      if (inst.plugin.dependencies.includes(pluginId)) {
        throw new Error(`Cannot uninstall: ${id} depends on this plugin`);
      }
    }

    this.installedPlugins.delete(pluginId);
    this.stats.totalUninstalls++;

    this.logger.info(`Plugin uninstalled: ${installation.plugin.name}`);

    return {
      success: true,
      message: `Successfully uninstalled ${installation.plugin.name}`
    };
  }

  /**
   * Update a plugin
   */
  async updatePlugin(pluginId) {
    const installation = this.installedPlugins.get(pluginId);
    if (!installation) {
      throw new Error(`Plugin not installed: ${pluginId}`);
    }

    const latestPlugin = this.availablePlugins.get(pluginId);
    if (!latestPlugin) {
      throw new Error(`Plugin not found in registry: ${pluginId}`);
    }

    if (latestPlugin.version === installation.version) {
      return {
        success: true,
        message: 'Already at latest version',
        updated: false
      };
    }

    // Update
    installation.status = PLUGIN_STATUS.UPDATING;

    await this.uninstallPlugin(pluginId);
    await this.installPlugin(pluginId, { config: installation.config });

    this.logger.info(`Plugin updated: ${latestPlugin.name} to v${latestPlugin.version}`);

    return {
      success: true,
      message: `Updated to v${latestPlugin.version}`,
      updated: true,
      previousVersion: installation.version,
      newVersion: latestPlugin.version
    };
  }

  /**
   * Enable/disable a plugin
   */
  async setPluginEnabled(pluginId, enabled) {
    const installation = this.installedPlugins.get(pluginId);
    if (!installation) {
      throw new Error(`Plugin not installed: ${pluginId}`);
    }

    installation.status = enabled ? PLUGIN_STATUS.INSTALLED : PLUGIN_STATUS.DISABLED;
    this.logger.info(`Plugin ${enabled ? 'enabled' : 'disabled'}: ${installation.plugin.name}`);

    return { success: true, status: installation.status };
  }

  /**
   * Configure a plugin
   */
  async configurePlugin(pluginId, config) {
    const installation = this.installedPlugins.get(pluginId);
    if (!installation) {
      throw new Error(`Plugin not installed: ${pluginId}`);
    }

    installation.config = { ...installation.config, ...config };
    this.pluginConfigs.set(pluginId, installation.config);

    this.logger.info(`Plugin configured: ${installation.plugin.name}`);

    return { success: true, config: installation.config };
  }

  /**
   * Rate a plugin
   */
  async ratePlugin(pluginId, rating, review = '') {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const plugin = this.availablePlugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    if (!this.ratings.has(pluginId)) {
      this.ratings.set(pluginId, []);
    }

    this.ratings.get(pluginId).push({
      rating,
      review,
      timestamp: Date.now()
    });

    // Update average rating
    const ratings = this.ratings.get(pluginId);
    const avgRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
    plugin.rating = Math.round(avgRating * 10) / 10;

    this.logger.info(`Plugin rated: ${plugin.name} - ${rating}/5`);

    return { success: true, newRating: plugin.rating };
  }

  /**
   * Publish a plugin
   */
  async publishPlugin(pluginData, pricing = {}) {
    const {
      id,
      name,
      description,
      version,
      author,
      category,
      capabilities,
      code
    } = pluginData;

    if (!id || !name || !description) {
      throw new Error('Missing required fields');
    }

    // Security review
    const securityResult = await this.securityScan({
      ...pluginData,
      security: SECURITY_LEVELS.UNVERIFIED
    });

    if (!securityResult.passed) {
      throw new Error('Security review failed');
    }

    const plugin = {
      id,
      name,
      description,
      version: version || '1.0.0',
      author: author || 'anonymous',
      category: category || PLUGIN_CATEGORIES.SKILL,
      downloads: 0,
      rating: 0,
      price: pricing.monthly || 0,
      security: SECURITY_LEVELS.COMMUNITY,
      dependencies: pluginData.dependencies || [],
      capabilities: capabilities || [],
      publishedAt: Date.now()
    };

    this.availablePlugins.set(id, plugin);
    this.registry.set(id, plugin);

    this.logger.info(`Plugin published: ${name}`);

    return {
      success: true,
      plugin,
      message: `Successfully published ${name}`
    };
  }

  /**
   * Get installed plugins
   */
  getInstalledPlugins() {
    return Array.from(this.installedPlugins.values());
  }

  /**
   * Get plugin by ID
   */
  getPlugin(pluginId) {
    return this.installedPlugins.get(pluginId) ||
           this.availablePlugins.get(pluginId);
  }

  /**
   * Get categories
   */
  getCategories() {
    return Object.values(PLUGIN_CATEGORIES);
  }

  /**
   * Get featured plugins
   */
  getFeaturedPlugins() {
    return Array.from(this.availablePlugins.values())
      .filter(p => p.downloads > 5000)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 6);
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      installedCount: this.installedPlugins.size,
      availableCount: this.availablePlugins.size,
      categories: Object.values(PLUGIN_CATEGORIES).length
    };
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance of PluginMarketplace
 * @param {Object} options Configuration options
 * @returns {PluginMarketplace}
 */
export function getPluginMarketplace(options = {}) {
  if (!instance) {
    instance = new PluginMarketplace(options);
  }
  return instance;
}

export {
  PluginMarketplace,
  PLUGIN_CATEGORIES,
  PLUGIN_STATUS,
  SECURITY_LEVELS
};

export default PluginMarketplace;
