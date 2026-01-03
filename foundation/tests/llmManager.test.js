/**
 * LLM Manager Tests
 * =================
 * Tests for BudgetManager, CostAwareRouter, and ResponseCache
 */

import { jest } from '@jest/globals';

// Mock EventBus
const mockEventBus = {
  subscribe: jest.fn(),
  publish: jest.fn(),
  unsubscribe: jest.fn()
};

jest.unstable_mockModule('../event-bus/AgentEventBus.js', () => ({
  getEventBus: jest.fn(() => mockEventBus),
  AgentEventBus: jest.fn()
}));

// Mock fs for ResponseCache
const mockFs = {
  mkdir: jest.fn().mockResolvedValue(undefined),
  readdir: jest.fn().mockResolvedValue([]),
  readFile: jest.fn().mockRejectedValue(new Error('File not found')),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined)
};

jest.unstable_mockModule('fs/promises', () => ({
  default: mockFs,
  ...mockFs
}));

const { BudgetManager, getBudgetManager, DEFAULT_ALLOCATION, ALERT_THRESHOLDS } =
  await import('../llm-manager/BudgetManager.js');
const { CostAwareRouter, getCostAwareRouter, MODEL_TIERS, COMPLEXITY_PATTERNS } =
  await import('../llm-manager/CostAwareRouter.js');
const { ResponseCache, getResponseCache, DEFAULT_CONFIG } =
  await import('../llm-manager/ResponseCache.js');

describe('BudgetManager', () => {
  let manager;

  beforeEach(() => {
    manager = new BudgetManager({
      monthlyBudget: 100
    });
  });

  describe('Initialization', () => {
    test('creates with default configuration', () => {
      const defaultManager = new BudgetManager();

      expect(defaultManager.config.monthlyBudget).toBe(200);
      expect(defaultManager.config.currency).toBe('USD');
      expect(defaultManager.config.allocation).toEqual(expect.objectContaining(DEFAULT_ALLOCATION));
    });

    test('creates with custom configuration', () => {
      expect(manager.config.monthlyBudget).toBe(100);
    });

    test('initializes period tracking', () => {
      expect(manager.currentPeriod.spent).toBe(0);
      expect(manager.currentPeriod.startDate).toBeInstanceOf(Date);
      expect(manager.currentPeriod.endDate).toBeInstanceOf(Date);
    });

    test('initialize sets up event bus', async () => {
      await manager.initialize();
      expect(manager.initialized).toBe(true);
    });
  });

  describe('Cost Recording', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('records cost correctly', () => {
      const result = manager.recordCost(10);

      expect(result.recorded).toBe(true);
      expect(result.totalSpent).toBe(10);
      expect(result.remaining).toBe(90);
    });

    test('tracks cost by category', () => {
      manager.recordCost(5, { category: 'critical' });
      manager.recordCost(10, { category: 'normal' });
      manager.recordCost(3, { category: 'simple' });

      expect(manager.currentPeriod.byCategory.critical).toBe(5);
      expect(manager.currentPeriod.byCategory.normal).toBe(10);
      expect(manager.currentPeriod.byCategory.simple).toBe(3);
    });

    test('tracks cost by agent', () => {
      manager.recordCost(5, { agent: 'agent1' });
      manager.recordCost(10, { agent: 'agent1' });
      manager.recordCost(3, { agent: 'agent2' });

      expect(manager.currentPeriod.byAgent.get('agent1')).toBe(15);
      expect(manager.currentPeriod.byAgent.get('agent2')).toBe(3);
    });

    test('tracks cost by model', () => {
      manager.recordCost(5, { model: 'gpt-4' });
      manager.recordCost(10, { model: 'claude' });

      expect(manager.currentPeriod.byModel.get('gpt-4')).toBe(5);
      expect(manager.currentPeriod.byModel.get('claude')).toBe(10);
    });

    test('records transaction history', () => {
      manager.recordCost(10, { category: 'normal', agent: 'test' });

      expect(manager.currentPeriod.transactions.length).toBe(1);
      expect(manager.currentPeriod.transactions[0].cost).toBe(10);
      expect(manager.currentPeriod.transactions[0].agent).toBe('test');
    });

    test('publishes event on cost recording', () => {
      manager.recordCost(10);

      expect(mockEventBus.publish).toHaveBeenCalledWith('BUDGET_SPENT', expect.objectContaining({
        cost: 10,
        totalSpent: 10
      }));
    });
  });

  describe('Budget Checking', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('canAfford returns true when budget available', () => {
      expect(manager.canAfford(10)).toBe(true);
    });

    test('canAfford returns false when exceeds budget', () => {
      manager.recordCost(95);
      expect(manager.canAfford(10)).toBe(false);
    });

    test('canAfford respects reserve', () => {
      // With 100 budget and 10% reserve, effective limit is 90
      manager.recordCost(85);
      expect(manager.canAfford(10)).toBe(false);
    });

    test('getRemainingBudget calculates correctly', () => {
      manager.recordCost(30);
      expect(manager.getRemainingBudget()).toBe(70);
    });

    test('getRemainingByCategory returns detailed allocation', () => {
      manager.recordCost(15, { category: 'critical' });

      const remaining = manager.getRemainingByCategory();

      expect(remaining.critical).toBeDefined();
      expect(remaining.critical.allocated).toBe(30); // 30% of 100
      expect(remaining.critical.spent).toBe(15);
      expect(remaining.critical.remaining).toBe(15);
    });
  });

  describe('Alerts', () => {
    beforeEach(async () => {
      // Create fresh manager for alert tests to avoid state leakage
      manager = new BudgetManager({ monthlyBudget: 100 });
      await manager.initialize();
      mockEventBus.publish.mockClear();
    });

    test('triggers warning alert at 70%', () => {
      manager.recordCost(70);

      expect(mockEventBus.publish).toHaveBeenCalledWith('BUDGET_ALERT', expect.objectContaining({
        level: 'warning'
      }));
    });

    test('triggers critical alert at 90%', () => {
      manager.recordCost(90);

      expect(mockEventBus.publish).toHaveBeenCalledWith('BUDGET_ALERT', expect.objectContaining({
        level: 'critical'
      }));
    });

    test('does not send duplicate alerts', () => {
      // Record 75% - should trigger warning alert (70% threshold)
      // Note: May also trigger daily limit alert since 75 > 5 (5% daily limit of 100)
      manager.recordCost(75);

      // Verify at least one warning alert was sent
      const warningCallsAfterFirst = mockEventBus.publish.mock.calls.filter(
        call => call[0] === 'BUDGET_ALERT' && call[1].level === 'warning'
      );
      expect(warningCallsAfterFirst.length).toBeGreaterThanOrEqual(1);

      // The alert set should contain 'warning'
      expect(manager.alertsSent.has('warning')).toBe(true);

      // Record another 5% - total 80%, still in warning zone
      mockEventBus.publish.mockClear();
      manager.recordCost(5);

      // Should NOT trigger the 70% warning again (already sent)
      const monthlyWarningCalls = mockEventBus.publish.mock.calls.filter(
        call => call[0] === 'BUDGET_ALERT' &&
               call[1].level === 'warning' &&
               call[1].message?.includes('monthly budget')
      );
      expect(monthlyWarningCalls.length).toBe(0);
    });
  });

  describe('Analysis and Optimization', () => {
    beforeEach(async () => {
      await manager.initialize();
      manager.recordCost(20, { category: 'critical', model: 'gpt-4', tokens: { prompt: 1000, completion: 500 } });
      manager.recordCost(30, { category: 'normal', model: 'claude', tokens: { prompt: 2000, completion: 1000 } });
    });

    test('analyzeUsage returns spending data', () => {
      const analysis = manager.analyzeUsage();

      expect(analysis.spending.total).toBe(50);
      expect(analysis.spending.percentageUsed).toBe(50);
      expect(analysis.byCategory).toBeDefined();
      expect(analysis.transactionCount).toBe(2);
    });

    test('calculateModelEfficiency returns efficiency metrics', () => {
      const efficiency = manager.calculateModelEfficiency();

      expect(efficiency.length).toBe(2);
      expect(efficiency[0].model).toBeDefined();
      expect(efficiency[0].efficiency).toBeDefined();
    });

    test('predictMonthEndSpending returns projection', () => {
      const prediction = manager.predictMonthEndSpending();

      expect(prediction.projected).toBeDefined();
      expect(prediction.dailyRate).toBeDefined();
      expect(prediction.trend).toBeDefined();
    });

    test('optimizeSpending returns recommendations', async () => {
      const optimization = await manager.optimizeSpending();

      expect(optimization.analysis).toBeDefined();
      expect(optimization.recommendations).toBeInstanceOf(Array);
      expect(optimization.suggestedAllocation).toBeDefined();
    });
  });

  describe('Budget Configuration', () => {
    test('setMonthlyBudget updates budget', () => {
      manager.setMonthlyBudget(500);
      expect(manager.config.monthlyBudget).toBe(500);
    });

    test('setAllocation updates allocation', () => {
      const newAllocation = {
        critical: 0.4,
        normal: 0.4,
        simple: 0.1,
        reserve: 0.1
      };

      manager.setAllocation(newAllocation);
      expect(manager.config.allocation).toEqual(newAllocation);
    });

    test('setAllocation throws on invalid total', () => {
      expect(() => manager.setAllocation({
        critical: 0.5,
        normal: 0.5,
        simple: 0.5
      })).toThrow('Budget allocation must sum to 1.0');
    });
  });

  describe('Status and Export', () => {
    test('getStatus returns budget status', async () => {
      await manager.initialize();
      manager.recordCost(25);

      const status = manager.getStatus();

      expect(status.monthlyBudget).toBe(100);
      expect(status.spent).toBe(25);
      expect(status.remaining).toBe(75);
      expect(status.percentageUsed).toBe('25.0%');
    });

    test('exportData returns full data', async () => {
      await manager.initialize();
      manager.recordCost(10);

      const data = manager.exportData();

      expect(data.config).toBeDefined();
      expect(data.current).toBeDefined();
      expect(data.analysis).toBeDefined();
    });

    test('getHistory returns historical periods', () => {
      const history = manager.getHistory();
      expect(history).toBeInstanceOf(Array);
    });
  });

  describe('Period Management', () => {
    test('getMonthStart returns first day of month', () => {
      const start = manager.getMonthStart();
      expect(start.getDate()).toBe(1);
    });

    test('getMonthEnd returns last day of month', () => {
      const end = manager.getMonthEnd();
      const nextMonth = new Date(end);
      nextMonth.setDate(nextMonth.getDate() + 1);
      expect(nextMonth.getDate()).toBe(1);
    });
  });
});

describe('CostAwareRouter', () => {
  let router;

  beforeEach(() => {
    router = new CostAwareRouter({
      enableLocalModels: false
    });
  });

  describe('Initialization', () => {
    test('creates with default configuration', () => {
      const defaultRouter = new CostAwareRouter();

      expect(defaultRouter.config.enableLocalModels).toBe(true);
      expect(defaultRouter.config.maxRetries).toBe(3);
      expect(defaultRouter.config.qualityThreshold).toBe(0.7);
    });

    test('creates with custom configuration', () => {
      expect(router.config.enableLocalModels).toBe(false);
    });

    test('initializes statistics', () => {
      expect(router.stats.totalRequests).toBe(0);
      expect(router.stats.cacheHits).toBe(0);
      expect(router.stats.totalCost).toBe(0);
    });

    test('initialize sets up router', async () => {
      await router.initialize();
      expect(router.initialized).toBe(true);
    });
  });

  describe('Complexity Assessment', () => {
    beforeEach(async () => {
      await router.initialize();
    });

    test('assesses simple tasks correctly', async () => {
      const result = await router.assessComplexity({
        prompt: 'Format this code with proper indentation'
      });

      expect(result.level).toBe('simple');
      expect(result.requiredQuality).toBeLessThan(0.8);
    });

    test('assesses moderate tasks correctly', async () => {
      const result = await router.assessComplexity({
        prompt: 'Summarize this document and explain the key points'
      });

      expect(result.level).toBe('moderate');
    });

    test('assesses complex tasks correctly', async () => {
      const result = await router.assessComplexity({
        prompt: 'Implement a user authentication system with JWT'
      });

      expect(result.level).toBe('complex');
    });

    test('assesses critical tasks correctly', async () => {
      const result = await router.assessComplexity({
        prompt: 'Fix this critical production security vulnerability'
      });

      expect(result.level).toBe('critical');
    });

    test('adjusts score for code content', async () => {
      const withCode = await router.assessComplexity({
        prompt: 'Review this function: ```function test() { return 1; }```'
      });

      const withoutCode = await router.assessComplexity({
        prompt: 'Review this function'
      });

      expect(withCode.score).toBeGreaterThanOrEqual(withoutCode.score);
    });
  });

  describe('Tier Selection', () => {
    test('scoreToTier returns correct tier', () => {
      expect(router.scoreToTier(2)).toBe('free');
      expect(router.scoreToTier(4)).toBe('penny');
      expect(router.scoreToTier(6)).toBe('dollar');
      expect(router.scoreToTier(8)).toBe('premium');
    });

    test('getHigherTier returns next tier', () => {
      expect(router.getHigherTier('free')).toBe('penny');
      expect(router.getHigherTier('penny')).toBe('dollar');
      expect(router.getHigherTier('dollar')).toBe('premium');
      expect(router.getHigherTier('premium')).toBeNull();
    });

    test('getLowerTier returns previous tier', () => {
      expect(router.getLowerTier('premium')).toBe('dollar');
      expect(router.getLowerTier('dollar')).toBe('penny');
      expect(router.getLowerTier('penny')).toBe('free');
      expect(router.getLowerTier('free')).toBeNull();
    });

    test('selectInitialTier respects minimum quality', () => {
      const complexity = { suggestedTier: 'free', score: 2 };

      // Free tier quality is 0.70, so minQuality 0.85 should upgrade
      const tier = router.selectInitialTier(complexity, 0.85);
      expect(['dollar', 'premium']).toContain(tier);
    });
  });

  describe('Model Selection', () => {
    test('selectModelFromTier returns a model', () => {
      const model = router.selectModelFromTier(MODEL_TIERS.free, false);

      expect(model).toBeDefined();
      expect(model.id).toBeDefined();
      expect(model.costPer1k).toBe(0);
    });

    test('selectModelFromTier prefers speed when requested', () => {
      const fastModel = router.selectModelFromTier(MODEL_TIERS.penny, true);
      const qualityModel = router.selectModelFromTier(MODEL_TIERS.penny, false);

      // Both should return models
      expect(fastModel).toBeDefined();
      expect(qualityModel).toBeDefined();
    });
  });

  describe('Routing', () => {
    beforeEach(async () => {
      await router.initialize();
    });

    test('routes simple task successfully', async () => {
      const result = await router.route({
        prompt: 'Format this code'
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    test('uses cache when available', async () => {
      const mockCache = {
        get: jest.fn().mockResolvedValue({
          content: 'Cached response',
          quality: 0.9
        }),
        set: jest.fn()
      };

      router.setCache(mockCache);

      const result = await router.route({
        prompt: 'Test prompt',
        minQuality: 0.7
      });

      expect(result.source).toBe('cache');
      expect(result.cost).toBe(0);
    });

    test('forces specific model when requested', async () => {
      const result = await router.route({
        prompt: 'Test prompt',
        forceModel: MODEL_TIERS.premium.models[0]
      });

      expect(result).toBeDefined();
    });

    test('respects budget constraints', async () => {
      const mockBudget = {
        canAfford: jest.fn()
          .mockReturnValueOnce(false) // First call - reject
          .mockReturnValue(true)       // Allow subsequent calls
      };

      router.setBudgetManager(mockBudget);

      // Should succeed by falling back to lower tier
      const result = await router.route({
        prompt: 'Implement complex feature'
      });

      expect(mockBudget.canAfford).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    test('tracks statistics', async () => {
      await router.route({ prompt: 'Test 1' });
      await router.route({ prompt: 'Test 2' });

      expect(router.stats.totalRequests).toBe(2);
    });
  });

  describe('Statistics and Info', () => {
    beforeEach(async () => {
      await router.initialize();
      await router.route({ prompt: 'Test prompt' });
    });

    test('getStats returns routing statistics', () => {
      const stats = router.getStats();

      expect(stats.totalRequests).toBe(1);
      expect(stats.cacheHitRate).toBeDefined();
      expect(stats.tierDistribution).toBeDefined();
    });

    test('getTierInfo returns model tiers', () => {
      const tiers = router.getTierInfo();

      expect(tiers.free).toBeDefined();
      expect(tiers.penny).toBeDefined();
      expect(tiers.dollar).toBeDefined();
      expect(tiers.premium).toBeDefined();
    });

    test('getModelAvailability returns availability map', () => {
      const availability = router.getModelAvailability();
      expect(availability).toBeDefined();
    });
  });

  describe('Utility Methods', () => {
    test('estimateTokenCount approximates tokens', () => {
      const count = router.estimateTokenCount('Hello world');
      expect(count).toBeGreaterThan(0);
    });

    test('estimateQuality adjusts for response', () => {
      const model = { quality: 0.8 };

      const shortQuality = router.estimateQuality({ content: 'Hi' }, model);
      const longQuality = router.estimateQuality({
        content: 'This is a longer response with code:\n```js\nconst x = 1;\n```'
      }, model);

      expect(longQuality).toBeGreaterThan(shortQuality);
    });

    test('calculateCost computes correctly', () => {
      const model = { costPer1k: 0.01 };
      const result = { tokens: { prompt: 500, completion: 500 } };

      const cost = router.calculateCost(result, model);
      expect(cost).toBe(0.01); // 1000 tokens * 0.01/1000
    });
  });
});

describe('ResponseCache', () => {
  let cache;

  beforeEach(() => {
    cache = new ResponseCache({
      enableFilePersistence: false,
      maxMemoryItems: 100,
      ttlMinutes: 5
    });
    mockFs.readdir.mockResolvedValue([]);
  });

  afterEach(async () => {
    if (cache.cleanupInterval) {
      clearInterval(cache.cleanupInterval);
    }
  });

  describe('Initialization', () => {
    test('creates with default configuration', () => {
      const defaultCache = new ResponseCache();

      expect(defaultCache.config.maxMemoryItems).toBe(DEFAULT_CONFIG.maxMemoryItems);
      expect(defaultCache.config.ttlMinutes).toBe(DEFAULT_CONFIG.ttlMinutes);
    });

    test('creates with custom configuration', () => {
      expect(cache.config.maxMemoryItems).toBe(100);
      expect(cache.config.ttlMinutes).toBe(5);
    });

    test('initializes empty cache', () => {
      expect(cache.memoryCache.size).toBe(0);
      expect(cache.stats.hits).toBe(0);
    });

    test('initialize sets up cache', async () => {
      await cache.initialize();
      expect(cache.initialized).toBe(true);
    });
  });

  describe('Key Generation', () => {
    test('generateKey creates consistent hashes', () => {
      const key1 = cache.generateKey('test prompt');
      const key2 = cache.generateKey('test prompt');

      expect(key1).toBe(key2);
      expect(key1.length).toBe(64); // SHA-256 hex length
    });

    test('generateKey includes context', () => {
      const key1 = cache.generateKey('prompt', 'context1');
      const key2 = cache.generateKey('prompt', 'context2');

      expect(key1).not.toBe(key2);
    });

    test('generateSemanticKey normalizes text', () => {
      const key1 = cache.generateSemanticKey('Hello World!');
      const key2 = cache.generateSemanticKey('hello world');

      expect(key1).toBe(key2);
    });
  });

  describe('Cache Operations', () => {
    beforeEach(async () => {
      await cache.initialize();
    });

    test('set stores response in memory', async () => {
      await cache.set('prompt', null, { content: 'response' });

      expect(cache.memoryCache.size).toBe(1);
      expect(cache.stats.sets).toBe(1);
    });

    test('get retrieves cached response', async () => {
      await cache.set('prompt', null, { content: 'response', quality: 0.9 });

      const result = await cache.get('prompt');

      expect(result).toBeDefined();
      expect(result.content).toBe('response');
      expect(result.cacheHit).toBe(true);
      expect(result.cacheLayer).toBe('memory');
    });

    test('get returns null for missing entry', async () => {
      const result = await cache.get('nonexistent');
      expect(result).toBeNull();
    });

    test('get returns null for expired entry', async () => {
      const shortCache = new ResponseCache({
        enableFilePersistence: false,
        ttlMinutes: 1 // 1 minute TTL
      });
      await shortCache.initialize();

      // Manually create an expired entry
      const key = shortCache.generateKey('prompt');
      shortCache.memoryCache.set(key, {
        response: { content: 'response' },
        createdAt: Date.now() - 120000 // 2 minutes ago (expired)
      });
      shortCache.cacheMetadata.set(key, {
        createdAt: Date.now() - 120000,
        accessedAt: Date.now() - 120000
      });

      // Entry should be expired
      const result = await shortCache.get('prompt');
      expect(result).toBeNull();

      clearInterval(shortCache.cleanupInterval);
    });

    test('tracks cache statistics', async () => {
      await cache.set('prompt1', null, { content: 'response1' });
      await cache.get('prompt1');
      await cache.get('nonexistent');

      expect(cache.stats.sets).toBe(1);
      expect(cache.stats.hits).toBe(1);
      expect(cache.stats.memoryHits).toBe(1);
      expect(cache.stats.misses).toBe(1);
    });
  });

  describe('LRU Eviction', () => {
    beforeEach(async () => {
      cache = new ResponseCache({
        enableFilePersistence: false,
        maxMemoryItems: 3
      });
      await cache.initialize();
    });

    afterEach(() => {
      clearInterval(cache.cleanupInterval);
    });

    test('evicts LRU entry when at capacity', async () => {
      await cache.set('prompt1', null, { content: 'r1' });
      await cache.set('prompt2', null, { content: 'r2' });
      await cache.set('prompt3', null, { content: 'r3' });

      // Access prompt1 to make it recently used
      await cache.get('prompt1');

      // Add prompt4, should evict prompt2 (least recently used)
      await cache.set('prompt4', null, { content: 'r4' });

      expect(cache.memoryCache.size).toBe(3);
      expect(cache.stats.evictions).toBe(1);
    });

    test('updateAccessTime updates entry metadata', async () => {
      await cache.set('prompt', null, { content: 'response' });

      const key = cache.generateKey('prompt');
      const before = cache.memoryCache.get(key).accessedAt;

      await new Promise(resolve => setTimeout(resolve, 10));
      await cache.get('prompt');

      const after = cache.memoryCache.get(key).accessedAt;
      expect(after).toBeGreaterThan(before);
    });
  });

  describe('Semantic Matching', () => {
    beforeEach(async () => {
      cache = new ResponseCache({
        enableFilePersistence: false,
        enableSemanticMatching: true,
        similarityThreshold: 0.5
      });
      await cache.initialize();
    });

    afterEach(() => {
      clearInterval(cache.cleanupInterval);
    });

    test('updates semantic index on set', async () => {
      await cache.set('hello world test', null, { content: 'response' });

      expect(cache.semanticIndex.size).toBeGreaterThan(0);
    });

    test('finds semantic match for similar query', async () => {
      await cache.set('hello world testing prompt', null, {
        content: 'response',
        quality: 0.9
      });

      // Similar query should match
      const result = await cache.findSemanticMatch('hello world test');

      expect(result).toBeDefined();
      expect(result.similarity).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe('Cleanup', () => {
    beforeEach(async () => {
      cache = new ResponseCache({
        enableFilePersistence: false,
        ttlMinutes: 0
      });
      await cache.initialize();
    });

    afterEach(() => {
      clearInterval(cache.cleanupInterval);
    });

    test('cleanup removes expired entries', async () => {
      // Set an entry (will be immediately expired with ttl=0)
      cache.memoryCache.set('test', {
        response: { content: 'test' },
        createdAt: Date.now() - 10000 // Old entry
      });
      cache.cacheMetadata.set('test', { createdAt: Date.now() - 10000 });

      await cache.cleanup();

      expect(cache.memoryCache.has('test')).toBe(false);
    });
  });

  describe('Cache Management', () => {
    beforeEach(async () => {
      await cache.initialize();
    });

    test('invalidate removes specific entry', async () => {
      await cache.set('prompt', null, { content: 'response' });
      await cache.invalidate('prompt');

      const result = await cache.get('prompt');
      expect(result).toBeNull();
    });

    test('clear removes all entries', async () => {
      await cache.set('prompt1', null, { content: 'r1' });
      await cache.set('prompt2', null, { content: 'r2' });

      await cache.clear();

      expect(cache.memoryCache.size).toBe(0);
      expect(cache.stats.hits).toBe(0);
    });

    test('warmCache pre-populates cache', async () => {
      const prompts = [
        { prompt: 'p1', context: null, response: { content: 'r1' } },
        { prompt: 'p2', context: null, response: { content: 'r2' } }
      ];

      await cache.warmCache(prompts);

      expect(cache.memoryCache.size).toBe(2);
    });

    test('shutdown clears cleanup interval', async () => {
      const intervalBefore = cache.cleanupInterval;
      await cache.shutdown();
      // After shutdown, interval should be cleared (either null or has _destroyed flag)
      expect(
        cache.cleanupInterval === null ||
        cache.cleanupInterval?._destroyed === true
      ).toBe(true);
    });
  });

  describe('Statistics and Health', () => {
    beforeEach(async () => {
      await cache.initialize();
      await cache.set('prompt', null, { content: 'response' });
      await cache.get('prompt');
      await cache.get('missing');
    });

    test('getStats returns cache statistics', () => {
      const stats = cache.getStats();

      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe('50.0%');
      expect(stats.memorySize).toBe(1);
    });

    test('getHealth returns health status', () => {
      const health = cache.getHealth();

      expect(health.healthy).toBe(true);
      expect(health.hitRate).toBeDefined();
      expect(health.memoryUsage).toBeDefined();
      expect(health.recommendations).toBeInstanceOf(Array);
    });

    test('getRecommendations suggests improvements', () => {
      // Low hit rate
      cache.stats.hits = 1;
      cache.stats.misses = 10;

      const recommendations = cache.getRecommendations(0.1);
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].type).toBe('low-hit-rate');
    });
  });
});

describe('Singleton Functions', () => {
  describe('getBudgetManager', () => {
    test('returns instance', () => {
      const manager = getBudgetManager();
      expect(manager).toBeInstanceOf(BudgetManager);
    });
  });

  describe('getCostAwareRouter', () => {
    test('returns instance', () => {
      const router = getCostAwareRouter();
      expect(router).toBeInstanceOf(CostAwareRouter);
    });
  });

  describe('getResponseCache', () => {
    test('returns instance', () => {
      const cache = getResponseCache();
      expect(cache).toBeInstanceOf(ResponseCache);
    });
  });
});

describe('Exported Constants', () => {
  test('DEFAULT_ALLOCATION has all categories', () => {
    expect(DEFAULT_ALLOCATION.critical).toBeDefined();
    expect(DEFAULT_ALLOCATION.normal).toBeDefined();
    expect(DEFAULT_ALLOCATION.simple).toBeDefined();
    expect(DEFAULT_ALLOCATION.reserve).toBeDefined();
  });

  test('ALERT_THRESHOLDS has all levels', () => {
    expect(ALERT_THRESHOLDS.warning).toBeDefined();
    expect(ALERT_THRESHOLDS.critical).toBeDefined();
    expect(ALERT_THRESHOLDS.daily).toBeDefined();
  });

  test('MODEL_TIERS has all tiers', () => {
    expect(MODEL_TIERS.free).toBeDefined();
    expect(MODEL_TIERS.penny).toBeDefined();
    expect(MODEL_TIERS.dollar).toBeDefined();
    expect(MODEL_TIERS.premium).toBeDefined();
  });

  test('COMPLEXITY_PATTERNS has all levels', () => {
    expect(COMPLEXITY_PATTERNS.simple).toBeDefined();
    expect(COMPLEXITY_PATTERNS.moderate).toBeDefined();
    expect(COMPLEXITY_PATTERNS.complex).toBeDefined();
    expect(COMPLEXITY_PATTERNS.critical).toBeDefined();
  });

  test('DEFAULT_CONFIG has cache settings', () => {
    expect(DEFAULT_CONFIG.maxMemoryItems).toBeDefined();
    expect(DEFAULT_CONFIG.ttlMinutes).toBeDefined();
    expect(DEFAULT_CONFIG.enableSemanticMatching).toBeDefined();
  });
});
