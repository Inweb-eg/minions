/**
 * Ecosystem Tests
 * ================
 * Tests for PluginMarketplace and SelfImprovingEngine
 */

import { jest } from '@jest/globals';

// Mock dependencies
const mockEventBus = {
  subscribe: jest.fn(),
  publish: jest.fn(),
  unsubscribe: jest.fn()
};

const mockKnowledgeBrain = {
  initialize: jest.fn().mockResolvedValue(undefined),
  recall: jest.fn().mockResolvedValue([]),
  learn: jest.fn().mockResolvedValue({ id: 'memory_123' })
};

jest.unstable_mockModule('../event-bus/AgentEventBus.js', () => ({
  getEventBus: jest.fn(() => mockEventBus),
  AgentEventBus: jest.fn()
}));

jest.unstable_mockModule('../knowledge-brain/KnowledgeBrain.js', () => ({
  getKnowledgeBrain: jest.fn(() => mockKnowledgeBrain),
  KnowledgeBrain: jest.fn()
}));

const {
  PluginMarketplace,
  PLUGIN_CATEGORIES,
  PLUGIN_STATUS,
  SECURITY_LEVELS,
  getPluginMarketplace
} = await import('../ecosystem/PluginMarketplace.js');

const {
  SelfImprovingEngine,
  IMPROVEMENT_CATEGORIES,
  ANALYSIS_TYPES,
  IMPROVEMENT_STATUS,
  getSelfImprovingEngine
} = await import('../ecosystem/SelfImprovingEngine.js');

describe('PluginMarketplace', () => {
  let marketplace;

  beforeEach(() => {
    marketplace = new PluginMarketplace();
    mockEventBus.publish.mockClear();
    // Mock sandboxTest to always pass for deterministic tests
    marketplace.sandboxTest = jest.fn().mockResolvedValue({
      passed: true,
      duration: 1000,
      reason: 'All tests passed',
      metrics: { memoryUsage: 30, cpuUsage: 10, apiCalls: 5 }
    });
  });

  describe('Initialization', () => {
    test('creates with default options', () => {
      expect(marketplace.config.enableSecurityScan).toBe(true);
      expect(marketplace.config.enableSandbox).toBe(true);
      expect(marketplace.initialized).toBe(false);
    });

    test('creates with custom options', () => {
      const custom = new PluginMarketplace({
        enableSecurityScan: false,
        revSharePercentage: 80
      });

      expect(custom.config.enableSecurityScan).toBe(false);
      expect(custom.config.revSharePercentage).toBe(80);
    });

    test('initializes sample registry', () => {
      expect(marketplace.registry.size).toBeGreaterThan(0);
    });

    test('initialize sets up marketplace', async () => {
      await marketplace.initialize();

      expect(marketplace.initialized).toBe(true);
      expect(marketplace.availablePlugins.size).toBeGreaterThan(0);
    });

    test('initialize is idempotent', async () => {
      await marketplace.initialize();
      await marketplace.initialize();

      expect(marketplace.initialized).toBe(true);
    });
  });

  describe('Plugin Search', () => {
    beforeEach(async () => {
      await marketplace.initialize();
    });

    test('searchPlugins returns all plugins without query', async () => {
      const results = await marketplace.searchPlugins();

      expect(results.length).toBeGreaterThan(0);
    });

    test('searchPlugins filters by query', async () => {
      const results = await marketplace.searchPlugins('code');

      expect(results.length).toBeGreaterThan(0);
      results.forEach(p => {
        const hasMatch = p.name.toLowerCase().includes('code') ||
                        p.description.toLowerCase().includes('code') ||
                        p.capabilities.some(c => c.includes('code'));
        expect(hasMatch).toBe(true);
      });
    });

    test('searchPlugins filters by category', async () => {
      const results = await marketplace.searchPlugins('', {
        category: PLUGIN_CATEGORIES.GENERATOR
      });

      results.forEach(p => {
        expect(p.category).toBe(PLUGIN_CATEGORIES.GENERATOR);
      });
    });

    test('searchPlugins filters by minimum rating', async () => {
      const results = await marketplace.searchPlugins('', { minRating: 4.5 });

      results.forEach(p => {
        expect(p.rating).toBeGreaterThanOrEqual(4.5);
      });
    });

    test('searchPlugins filters by max price', async () => {
      const results = await marketplace.searchPlugins('', { maxPrice: 0 });

      results.forEach(p => {
        expect(p.price).toBe(0);
      });
    });

    test('searchPlugins sorts by downloads', async () => {
      const results = await marketplace.searchPlugins('', { sortBy: 'downloads' });

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].downloads).toBeGreaterThanOrEqual(results[i].downloads);
      }
    });

    test('searchPlugins sorts by rating', async () => {
      const results = await marketplace.searchPlugins('', { sortBy: 'rating' });

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].rating).toBeGreaterThanOrEqual(results[i].rating);
      }
    });

    test('searchPlugins sorts by name', async () => {
      const results = await marketplace.searchPlugins('', { sortBy: 'name' });

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].name.localeCompare(results[i].name)).toBeLessThanOrEqual(0);
      }
    });

    test('searchPlugins sorts by price', async () => {
      const results = await marketplace.searchPlugins('', { sortBy: 'price' });

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].price).toBeLessThanOrEqual(results[i].price);
      }
    });
  });

  describe('Plugin Installation', () => {
    beforeEach(async () => {
      await marketplace.initialize();
    });

    test('installPlugin installs available plugin', async () => {
      const result = await marketplace.installPlugin('code-reviewer');

      expect(result.success).toBe(true);
      expect(result.plugin).toBeDefined();
      expect(marketplace.installedPlugins.has('code-reviewer')).toBe(true);
    });

    test('installPlugin throws for non-existent plugin', async () => {
      await expect(marketplace.installPlugin('non-existent'))
        .rejects.toThrow('Plugin not found');
    });

    test('installPlugin throws for already installed plugin', async () => {
      await marketplace.installPlugin('code-reviewer');

      await expect(marketplace.installPlugin('code-reviewer'))
        .rejects.toThrow('Plugin already installed');
    });

    test('installPlugin installs dependencies', async () => {
      await marketplace.installPlugin('security-squad');

      expect(marketplace.installedPlugins.has('code-reviewer')).toBe(true);
      expect(marketplace.installedPlugins.has('security-squad')).toBe(true);
    });

    test('installPlugin publishes event', async () => {
      await marketplace.installPlugin('code-reviewer');

      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    test('installPlugin updates stats', async () => {
      await marketplace.installPlugin('code-reviewer');

      expect(marketplace.stats.totalInstalls).toBe(1);
    });
  });

  describe('Security Scanning', () => {
    test('securityScan passes for verified plugins', async () => {
      const plugin = { security: SECURITY_LEVELS.VERIFIED, name: 'test' };

      const result = await marketplace.securityScan(plugin);

      expect(result.passed).toBe(true);
    });

    test('securityScan fails for unverified plugins', async () => {
      const plugin = { security: SECURITY_LEVELS.UNVERIFIED, name: 'test' };

      const result = await marketplace.securityScan(plugin);

      expect(result.passed).toBe(false);
    });
  });

  describe('Sandbox Testing', () => {
    test('sandboxTest returns result', async () => {
      // Create fresh marketplace without mock to test real sandboxTest
      const realMarketplace = new PluginMarketplace();
      const plugin = { name: 'test' };

      const result = await realMarketplace.sandboxTest(plugin);

      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('metrics');
    });
  });

  describe('Plugin Uninstallation', () => {
    beforeEach(async () => {
      await marketplace.initialize();
      await marketplace.installPlugin('code-reviewer');
    });

    test('uninstallPlugin removes plugin', async () => {
      const result = await marketplace.uninstallPlugin('code-reviewer');

      expect(result.success).toBe(true);
      expect(marketplace.installedPlugins.has('code-reviewer')).toBe(false);
    });

    test('uninstallPlugin throws for non-installed plugin', async () => {
      await expect(marketplace.uninstallPlugin('non-installed'))
        .rejects.toThrow('Plugin not installed');
    });

    test('uninstallPlugin throws if plugin is a dependency', async () => {
      await marketplace.installPlugin('security-squad');

      await expect(marketplace.uninstallPlugin('code-reviewer'))
        .rejects.toThrow('depends on this plugin');
    });
  });

  describe('Plugin Update', () => {
    beforeEach(async () => {
      await marketplace.initialize();
      await marketplace.installPlugin('code-reviewer');
    });

    test('updatePlugin returns when already at latest', async () => {
      const result = await marketplace.updatePlugin('code-reviewer');

      expect(result.updated).toBe(false);
      expect(result.message).toBe('Already at latest version');
    });

    test('updatePlugin throws for non-installed plugin', async () => {
      await expect(marketplace.updatePlugin('non-installed'))
        .rejects.toThrow('Plugin not installed');
    });
  });

  describe('Plugin Configuration', () => {
    beforeEach(async () => {
      await marketplace.initialize();
      await marketplace.installPlugin('code-reviewer');
    });

    test('setPluginEnabled toggles status', async () => {
      const result = await marketplace.setPluginEnabled('code-reviewer', false);

      expect(result.success).toBe(true);
      expect(result.status).toBe(PLUGIN_STATUS.DISABLED);
    });

    test('configurePlugin updates config', async () => {
      const result = await marketplace.configurePlugin('code-reviewer', { key: 'value' });

      expect(result.success).toBe(true);
      expect(result.config.key).toBe('value');
    });
  });

  describe('Plugin Rating', () => {
    beforeEach(async () => {
      await marketplace.initialize();
    });

    test('ratePlugin updates rating', async () => {
      const result = await marketplace.ratePlugin('code-reviewer', 5, 'Great plugin!');

      expect(result.success).toBe(true);
      expect(result.newRating).toBeGreaterThan(0);
    });

    test('ratePlugin throws for invalid rating', async () => {
      await expect(marketplace.ratePlugin('code-reviewer', 6))
        .rejects.toThrow('Rating must be between 1 and 5');
    });

    test('ratePlugin throws for non-existent plugin', async () => {
      await expect(marketplace.ratePlugin('non-existent', 5))
        .rejects.toThrow('Plugin not found');
    });
  });

  describe('Plugin Publishing', () => {
    beforeEach(async () => {
      await marketplace.initialize();
    });

    test('publishPlugin adds to registry', async () => {
      // Mock security scan to pass
      marketplace.securityScan = jest.fn().mockResolvedValue({ passed: true });

      const result = await marketplace.publishPlugin({
        id: 'my-plugin',
        name: 'My Plugin',
        description: 'A custom plugin',
        capabilities: ['custom']
      });

      expect(result.success).toBe(true);
      expect(marketplace.availablePlugins.has('my-plugin')).toBe(true);
    });

    test('publishPlugin throws for missing fields', async () => {
      await expect(marketplace.publishPlugin({ id: 'test' }))
        .rejects.toThrow('Missing required fields');
    });
  });

  describe('Getters', () => {
    beforeEach(async () => {
      await marketplace.initialize();
      await marketplace.installPlugin('code-reviewer');
    });

    test('getInstalledPlugins returns installed', () => {
      const installed = marketplace.getInstalledPlugins();

      expect(installed.length).toBe(1);
    });

    test('getPlugin returns plugin', () => {
      const plugin = marketplace.getPlugin('code-reviewer');

      expect(plugin).toBeDefined();
    });

    test('getCategories returns categories', () => {
      const categories = marketplace.getCategories();

      expect(categories).toContain(PLUGIN_CATEGORIES.AGENT);
    });

    test('getFeaturedPlugins returns popular plugins', () => {
      const featured = marketplace.getFeaturedPlugins();

      expect(featured.length).toBeGreaterThan(0);
    });

    test('getStats returns statistics', () => {
      const stats = marketplace.getStats();

      expect(stats.totalInstalls).toBe(1);
      expect(stats.installedCount).toBe(1);
    });
  });
});

describe('PLUGIN_CATEGORIES', () => {
  test('has all categories', () => {
    expect(PLUGIN_CATEGORIES.AGENT).toBe('agent');
    expect(PLUGIN_CATEGORIES.SKILL).toBe('skill');
    expect(PLUGIN_CATEGORIES.INTEGRATION).toBe('integration');
  });
});

describe('PLUGIN_STATUS', () => {
  test('has all statuses', () => {
    expect(PLUGIN_STATUS.AVAILABLE).toBe('available');
    expect(PLUGIN_STATUS.INSTALLED).toBe('installed');
    expect(PLUGIN_STATUS.DISABLED).toBe('disabled');
  });
});

describe('SECURITY_LEVELS', () => {
  test('has all levels with trust scores', () => {
    expect(SECURITY_LEVELS.VERIFIED.trust).toBe(1.0);
    expect(SECURITY_LEVELS.COMMUNITY.trust).toBe(0.5);
    expect(SECURITY_LEVELS.UNVERIFIED.trust).toBe(0.2);
  });
});

describe('SelfImprovingEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new SelfImprovingEngine({
      requireApproval: false,
      minImprovementThreshold: 1
    });
    mockEventBus.publish.mockClear();
    mockKnowledgeBrain.learn.mockClear();
  });

  describe('Initialization', () => {
    test('creates with default options', () => {
      const defaultEngine = new SelfImprovingEngine();

      expect(defaultEngine.config.minImprovementThreshold).toBe(5);
      expect(defaultEngine.config.requireApproval).toBe(true);
    });

    test('creates with custom options', () => {
      expect(engine.config.requireApproval).toBe(false);
      expect(engine.config.minImprovementThreshold).toBe(1);
    });

    test('initialize sets up engine', async () => {
      await engine.initialize();

      expect(engine.initialized).toBe(true);
      expect(engine.selfAnalysis).toBeDefined();
    });

    test('initialize is idempotent', async () => {
      await engine.initialize();
      await engine.initialize();

      expect(engine.stats.analysesPerformed).toBe(1);
    });
  });

  describe('Self Analysis', () => {
    test('analyzeSelf returns comprehensive analysis', async () => {
      const analysis = await engine.analyzeSelf();

      expect(analysis.timestamp).toBeDefined();
      expect(analysis.codeQuality).toBeDefined();
      expect(analysis.performance).toBeDefined();
      expect(analysis.errorPatterns).toBeDefined();
      expect(analysis.usagePatterns).toBeDefined();
      expect(analysis.resourceUsage).toBeDefined();
      expect(analysis.healthScore).toBeDefined();
      expect(analysis.weaknesses).toBeDefined();
    });

    test('analyzeCodeQuality returns metrics', async () => {
      const result = await engine.analyzeCodeQuality();

      expect(result.score).toBeGreaterThan(0);
      expect(result.issues).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    test('analyzePerformance returns metrics', async () => {
      const result = await engine.analyzePerformance();

      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(result.memoryUsage).toBeGreaterThan(0);
      expect(result.bottlenecks).toBeDefined();
    });

    test('analyzeErrorPatterns returns patterns', async () => {
      const result = await engine.analyzeErrorPatterns();

      expect(result.totalErrors).toBeDefined();
      expect(result.errorRate).toBeDefined();
      expect(result.commonErrors).toBeDefined();
    });

    test('analyzeUsagePatterns returns patterns', async () => {
      const result = await engine.analyzeUsagePatterns();

      expect(result.peakUsageHour).toBeDefined();
      expect(result.mostUsedFeatures).toBeDefined();
    });

    test('analyzeResourceUsage returns metrics', async () => {
      const result = await engine.analyzeResourceUsage();

      expect(result.memory).toBeDefined();
      expect(result.storage).toBeDefined();
      expect(result.apiCalls).toBeDefined();
    });
  });

  describe('Health Score Calculation', () => {
    test('calculateHealthScore returns weighted score', async () => {
      const analysis = await engine.analyzeSelf();

      expect(analysis.healthScore).toBeGreaterThan(0);
      expect(analysis.healthScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Weakness Identification', () => {
    test('identifyWeaknesses finds weaknesses', async () => {
      const analysis = await engine.analyzeSelf();

      expect(Array.isArray(analysis.weaknesses)).toBe(true);
      analysis.weaknesses.forEach(w => {
        expect(w.category).toBeDefined();
        expect(w.description).toBeDefined();
        expect(w.potentialGain).toBeDefined();
      });
    });
  });

  describe('Improvement Generation', () => {
    test('generateImprovements creates improvements', async () => {
      const improvements = await engine.generateImprovements();

      expect(improvements.length).toBeGreaterThan(0);
      improvements.forEach(i => {
        expect(i.id).toBeDefined();
        expect(i.strategy).toBeDefined();
        expect(i.status).toBe(IMPROVEMENT_STATUS.PROPOSED);
      });
    });

    test('generateImprovementForWeakness creates improvement', async () => {
      const weakness = {
        category: IMPROVEMENT_CATEGORIES.PERFORMANCE,
        area: 'test',
        description: 'Test weakness',
        potentialGain: 10
      };

      const improvement = await engine.generateImprovementForWeakness(weakness);

      expect(improvement.strategy).toBeDefined();
      expect(improvement.estimatedGain).toBe(10);
    });
  });

  describe('Improvement Testing', () => {
    test('testImprovement tests and approves', async () => {
      await engine.generateImprovements();
      const improvement = engine.pendingImprovements[0];

      const result = await engine.testImprovement(improvement.id);

      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('actualGain');
      expect(result).toHaveProperty('duration');
    });

    test('testImprovement throws for non-existent', async () => {
      await expect(engine.testImprovement('non-existent'))
        .rejects.toThrow('Improvement not found');
    });
  });

  describe('Improvement Application', () => {
    test('applyImprovement applies approved improvement', async () => {
      await engine.generateImprovements();
      const improvement = engine.pendingImprovements[0];

      // Force approval
      improvement.status = IMPROVEMENT_STATUS.APPROVED;
      improvement.testResult = { actualGain: 10 };

      const result = await engine.applyImprovement(improvement.id);

      expect(result.success).toBe(true);
      expect(result.newVersion).toBeDefined();
      expect(engine.improvementHistory).toContainEqual(
        expect.objectContaining({ id: improvement.id })
      );
    });

    test('applyImprovement throws for non-approved', async () => {
      await engine.generateImprovements();
      const improvement = engine.pendingImprovements[0];

      await expect(engine.applyImprovement(improvement.id))
        .rejects.toThrow('must be approved');
    });

    test('applyImprovement publishes event', async () => {
      await engine.generateImprovements();
      const improvement = engine.pendingImprovements[0];
      improvement.status = IMPROVEMENT_STATUS.APPROVED;
      improvement.testResult = { actualGain: 10 };

      await engine.applyImprovement(improvement.id);

      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    test('applyImprovement learns from improvement', async () => {
      await engine.generateImprovements();
      const improvement = engine.pendingImprovements[0];
      improvement.status = IMPROVEMENT_STATUS.APPROVED;
      improvement.testResult = { actualGain: 10 };

      await engine.applyImprovement(improvement.id);

      expect(mockKnowledgeBrain.learn).toHaveBeenCalled();
    });
  });

  describe('Rollback', () => {
    test('rollbackImprovement restores version', async () => {
      await engine.generateImprovements();
      const improvement = engine.pendingImprovements[0];
      improvement.status = IMPROVEMENT_STATUS.APPROVED;
      improvement.testResult = { actualGain: 10 };

      const originalVersion = engine.currentVersion;
      await engine.applyImprovement(improvement.id);

      const result = await engine.rollbackImprovement(improvement.id);

      expect(result.success).toBe(true);
      expect(result.restoredVersion).toBe(originalVersion);
    });

    test('rollbackImprovement throws for non-existent', async () => {
      await expect(engine.rollbackImprovement('non-existent'))
        .rejects.toThrow('Improvement not found in history');
    });
  });

  describe('Self Upgrade Cycle', () => {
    test('upgradeItself runs full cycle', async () => {
      const result = await engine.upgradeItself();

      expect(result.success).toBe(true);
      expect(result.previousVersion).toBeDefined();
    });

    test('upgradeItself skips when optimal', async () => {
      // Mock optimal health
      engine.calculateHealthScore = () => 99;

      const result = await engine.upgradeItself();

      expect(result.message).toContain('optimal');
    });
  });

  describe('Task Recording', () => {
    test('recordTaskCompletion updates metrics', () => {
      engine.recordTaskCompletion(true, 100);
      engine.recordTaskCompletion(false, 200);

      expect(engine.metrics.tasksCompleted).toBe(2);
      expect(engine.metrics.errorCount).toBe(1);
      expect(engine.metrics.avgResponseTime).toBe(150);
    });
  });

  describe('Getters', () => {
    test('getVersion returns current version', () => {
      expect(engine.getVersion()).toBe('2.0.0');
    });

    test('getImprovementHistory returns history', async () => {
      expect(engine.getImprovementHistory()).toEqual([]);
    });

    test('getPendingImprovements returns pending', async () => {
      await engine.generateImprovements();

      expect(engine.getPendingImprovements().length).toBeGreaterThan(0);
    });

    test('getSelfAnalysis returns analysis', async () => {
      await engine.analyzeSelf();

      expect(engine.getSelfAnalysis()).toBeDefined();
    });

    test('getStats returns statistics', () => {
      const stats = engine.getStats();

      expect(stats.currentVersion).toBe('2.0.0');
      expect(stats.analysesPerformed).toBeDefined();
    });
  });
});

describe('IMPROVEMENT_CATEGORIES', () => {
  test('has all categories', () => {
    expect(IMPROVEMENT_CATEGORIES.PERFORMANCE).toBe('performance');
    expect(IMPROVEMENT_CATEGORIES.RELIABILITY).toBe('reliability');
    expect(IMPROVEMENT_CATEGORIES.EFFICIENCY).toBe('efficiency');
    expect(IMPROVEMENT_CATEGORIES.SECURITY).toBe('security');
  });
});

describe('IMPROVEMENT_STATUS', () => {
  test('has all statuses', () => {
    expect(IMPROVEMENT_STATUS.PROPOSED).toBe('proposed');
    expect(IMPROVEMENT_STATUS.TESTING).toBe('testing');
    expect(IMPROVEMENT_STATUS.APPROVED).toBe('approved');
    expect(IMPROVEMENT_STATUS.DEPLOYED).toBe('deployed');
    expect(IMPROVEMENT_STATUS.ROLLED_BACK).toBe('rolled_back');
  });
});
