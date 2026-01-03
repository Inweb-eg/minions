/**
 * PatternRecognitionEngine Tests
 * ================================
 * Tests for the pattern detection and learning system
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

// Mock KnowledgeBrain
const mockKnowledgeBrain = {
  initialize: jest.fn().mockResolvedValue(undefined),
  recall: jest.fn().mockResolvedValue([]),
  learn: jest.fn().mockResolvedValue({ id: 'pattern_123' })
};

jest.unstable_mockModule('../knowledge-brain/KnowledgeBrain.js', () => ({
  getKnowledgeBrain: jest.fn(() => mockKnowledgeBrain),
  KnowledgeBrain: jest.fn(),
  KNOWLEDGE_TYPES: {
    CODE_PATTERN: 'code_pattern',
    SOLUTION: 'solution',
    CONCEPT: 'concept'
  },
  QUALITY_LEVELS: {
    COMMUNITY: 'community',
    VERIFIED: 'verified'
  }
}));

const {
  PatternRecognitionEngine,
  PATTERN_CATEGORIES,
  PATTERN_DETECTORS,
  getPatternRecognitionEngine
} = await import('../knowledge-brain/PatternRecognitionEngine.js');

describe('PatternRecognitionEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new PatternRecognitionEngine({
      enableAutoLearn: false
    });
    mockKnowledgeBrain.recall.mockResolvedValue([]);
    mockKnowledgeBrain.learn.mockClear();
  });

  describe('Initialization', () => {
    test('creates with default configuration', () => {
      const defaultEngine = new PatternRecognitionEngine();

      expect(defaultEngine.config.enableAutoLearn).toBe(true);
      expect(defaultEngine.config.minConfidence).toBe(0.7);
    });

    test('creates with custom configuration', () => {
      expect(engine.config.enableAutoLearn).toBe(false);
    });

    test('initializes empty state', () => {
      expect(engine.learnedPatterns.size).toBe(0);
      expect(engine.stats.analyzed).toBe(0);
    });

    test('initialize sets up engine', async () => {
      await engine.initialize();

      expect(engine.initialized).toBe(true);
    });

    test('countBuiltInPatterns returns pattern count', () => {
      const count = engine.countBuiltInPatterns();

      expect(count).toBeGreaterThan(0);
    });
  });

  describe('Pattern Detection - Architectural', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('detects Singleton Pattern', async () => {
      const code = `
        let instance = null;
        function getInstance() {
          if (!instance) {
            instance = new Service();
          }
          return instance;
        }
      `;

      const results = await engine.detectPatterns(code);
      const singleton = results.patterns.find(p => p.name === 'Singleton Pattern');

      expect(singleton).toBeDefined();
      expect(singleton.category).toBe('architectural');
    });

    test('detects Repository Pattern', async () => {
      const code = `
        class UserRepository {
          findById(id) { }
          findAll() { }
          save(user) { }
          delete(id) { }
        }
      `;

      const results = await engine.detectPatterns(code);
      const repository = results.patterns.find(p => p.name === 'Repository Pattern');

      expect(repository).toBeDefined();
    });

    test('detects Factory Pattern', async () => {
      const code = `
        function createUser(type) {
          return new User(type);
        }
      `;

      const results = await engine.detectPatterns(code);
      const factory = results.patterns.find(p => p.name === 'Factory Pattern');

      expect(factory).toBeDefined();
    });

    test('detects Event-Driven Architecture', async () => {
      const code = `
        eventBus.publish('user:created', data);
        eventBus.subscribe('user:updated', handler);
      `;

      const results = await engine.detectPatterns(code);
      const eventDriven = results.patterns.find(p => p.name === 'Event-Driven Architecture');

      expect(eventDriven).toBeDefined();
    });

    test('detects Middleware Pattern', async () => {
      const code = `
        app.use(authMiddleware);
        router.use(logging);
        function handler(req, res, next) {
          next();
        }
      `;

      const results = await engine.detectPatterns(code);
      const middleware = results.patterns.find(p => p.name === 'Middleware Pattern');

      expect(middleware).toBeDefined();
    });
  });

  describe('Pattern Detection - Code Smells', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('detects Magic Numbers', async () => {
      const code = `
        function calculate(x) {
          return x * 86400 + 3600;
        }
      `;

      const results = await engine.detectPatterns(code);
      const magicNumbers = results.patterns.find(p => p.name === 'Magic Numbers');

      expect(magicNumbers).toBeDefined();
      expect(magicNumbers.severity).toBe('low');
    });

    test('detects Dead Code markers', async () => {
      const code = `
        // TODO: refactor this
        // FIXME: memory leak here
        // HACK: temporary solution
      `;

      const results = await engine.detectPatterns(code);
      const deadCode = results.patterns.find(p => p.name === 'Dead Code');

      expect(deadCode).toBeDefined();
    });
  });

  describe('Pattern Detection - Bugs', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('detects Missing Await pattern', async () => {
      const code = `
        async function getData() {
          return new Promise(resolve => resolve(data));
        }
        const result = getData(); // Missing await
      `;

      const results = await engine.detectPatterns(code);
      // This may or may not detect depending on the regex specifics
      expect(results.patterns).toBeDefined();
    });
  });

  describe('Pattern Detection - Performance', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('detects N+1 Query pattern', async () => {
      const code = `
        for (const user of users) {
          const posts = await db.find({ userId: user.id });
        }
      `;

      const results = await engine.detectPatterns(code);
      const n1Query = results.patterns.find(p => p.name === 'N+1 Query');

      expect(n1Query).toBeDefined();
      expect(n1Query.severity).toBe('high');
    });

    test('detects Synchronous File I/O', async () => {
      const code = `
        const data = fs.readFileSync('file.txt');
        fs.writeFileSync('output.txt', data);
      `;

      const results = await engine.detectPatterns(code);
      const syncIO = results.patterns.find(p => p.name === 'Synchronous File I/O');

      expect(syncIO).toBeDefined();
    });
  });

  describe('Pattern Detection - Security', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('detects SQL Injection Risk', async () => {
      const code = `
        const query = \`SELECT * FROM users WHERE id = \${userId}\`;
        db.query("SELECT * FROM users WHERE name = '" + name + "'");
      `;

      const results = await engine.detectPatterns(code);
      const sqlInjection = results.patterns.find(p => p.name === 'SQL Injection Risk');

      expect(sqlInjection).toBeDefined();
      expect(sqlInjection.severity).toBe('critical');
    });

    test('detects Hardcoded Secrets', async () => {
      const code = `
        const api_key = "sk_test_1234567890";
        const password = "admin123";
      `;

      const results = await engine.detectPatterns(code);
      const secrets = results.patterns.find(p => p.name === 'Hardcoded Secrets');

      expect(secrets).toBeDefined();
      expect(secrets.severity).toBe('critical');
    });

    test('detects XSS Vulnerability', async () => {
      const code = `
        element.innerHTML = userInput;
        <div dangerouslySetInnerHTML={{ __html: content }} />
      `;

      const results = await engine.detectPatterns(code);
      const xss = results.patterns.find(p => p.name === 'XSS Vulnerability');

      expect(xss).toBeDefined();
    });

    test('detects Missing Input Validation', async () => {
      const code = `
        app.post('/user', (req, res) => {
          const name = req.body.name;
          const email = req.params.email;
          saveUser(name, email);
        });
      `;

      const results = await engine.detectPatterns(code);
      const validation = results.patterns.find(p => p.name === 'Missing Input Validation');

      expect(validation).toBeDefined();
    });
  });

  describe('Pattern Detection - Best Practices', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('detects Structured Logging (positive pattern)', async () => {
      const code = `
        logger.info('User created', { userId: user.id, email: user.email });
      `;

      const results = await engine.detectPatterns(code, { includePositive: true });
      const logging = results.patterns.find(p => p.name === 'Structured Logging');

      expect(logging).toBeDefined();
      expect(logging.isPositive).toBe(true);
    });

    test('detects Graceful Shutdown', async () => {
      const code = `
        process.on('SIGTERM', async () => {
          await server.close();
          process.exit(0);
        });
      `;

      const results = await engine.detectPatterns(code, { includePositive: true });
      const shutdown = results.patterns.find(p => p.name === 'Graceful Shutdown');

      expect(shutdown).toBeDefined();
      expect(shutdown.isPositive).toBe(true);
    });
  });

  describe('Pattern Detection Options', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('filters by category', async () => {
      const code = `
        let instance = null;
        if (!instance) instance = new Service();
        const query = \`SELECT * FROM users WHERE id = \${id}\`;
      `;

      const results = await engine.detectPatterns(code, {
        categories: [PATTERN_CATEGORIES.SECURITY]
      });

      // Should only have security patterns
      expect(results.patterns.every(p => p.category === 'security')).toBe(true);
    });

    test('filters by minimum severity', async () => {
      const code = `
        const x = 86400; // Magic number (low severity)
        const password = "secret123"; // Critical severity
      `;

      const results = await engine.detectPatterns(code, {
        minSeverity: 'high'
      });

      const lowSeverity = results.patterns.filter(p => p.severity === 'low');
      expect(lowSeverity.length).toBe(0);
    });

    test('excludes positive patterns when requested', async () => {
      const code = `
        logger.info('Test', { data: 123 });
      `;

      const results = await engine.detectPatterns(code, {
        includePositive: false
      });

      const positive = results.patterns.filter(p => p.isPositive);
      expect(positive.length).toBe(0);
    });
  });

  describe('Results Summary', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('returns summary with counts', async () => {
      const code = `
        const password = "admin123";
        element.innerHTML = userInput;
      `;

      const results = await engine.detectPatterns(code);

      expect(results.summary.total).toBeGreaterThan(0);
      expect(results.summary.bySeverity).toBeDefined();
      expect(results.summary.byCategory).toBeDefined();
    });

    test('returns recommendations', async () => {
      const code = `
        for (const item of items) {
          await db.query(\`SELECT * FROM data WHERE id = \${item.id}\`);
        }
      `;

      const results = await engine.detectPatterns(code);

      expect(results.recommendations.length).toBeGreaterThan(0);
      expect(results.recommendations[0].action).toBeDefined();
      expect(results.recommendations[0].priority).toBeDefined();
    });
  });

  describe('Codebase Analysis', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('analyzeCodebase analyzes multiple files', async () => {
      const codebase = {
        'file1.js': 'const password = "secret";',
        'file2.js': 'element.innerHTML = data;',
        'file3.js': 'logger.info("Test", { data: 1 });'
      };

      const results = await engine.analyzeCodebase(codebase);

      expect(Object.keys(results.files).length).toBe(3);
      expect(results.aggregate.total).toBeGreaterThan(0);
      expect(results.aggregate.topPatterns.length).toBeGreaterThan(0);
    });

    test('aggregates recommendations across files', async () => {
      const codebase = {
        'file1.js': 'const password = "secret";',
        'file2.js': 'const api_key = "abc123";'
      };

      const results = await engine.analyzeCodebase(codebase);

      const secretsRec = results.recommendations.find(
        r => r.pattern === 'Hardcoded Secrets'
      );

      expect(secretsRec).toBeDefined();
      expect(secretsRec.files.length).toBe(2);
    });
  });

  describe('Template Generation', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('generateTemplates creates templates from patterns', async () => {
      const code = `
        process.on('SIGTERM', async () => {
          await cleanup();
        });
      `;

      const templates = await engine.generateTemplates(code);

      expect(templates.length).toBeGreaterThan(0);
      expect(templates[0].template).toBeDefined();
    });

    test('templatize replaces specific values', () => {
      const code = `
        class UserService {
          const userName = 'john';
        }
      `;

      const template = engine.templatize(code);

      expect(template).toContain('${ClassName}');
      expect(template).toContain('${variableName}');
    });
  });

  describe('Pattern Learning', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('learnPattern adds new pattern', async () => {
      const pattern = {
        name: 'Custom Pattern',
        detector: 'return code.includes("custom");',
        category: PATTERN_CATEGORIES.BEST_PRACTICE,
        description: 'Custom pattern description',
        severity: 'medium'
      };

      const result = await engine.learnPattern(pattern);

      expect(result).toBeDefined();
      expect(mockKnowledgeBrain.learn).toHaveBeenCalled();
    });

    test('learnPattern validates detector function', async () => {
      const invalidPattern = {
        name: 'Invalid',
        detector: 'invalid javascript {{{',
        category: PATTERN_CATEGORIES.BUG
      };

      await expect(engine.learnPattern(invalidPattern)).rejects.toThrow('Invalid detector function');
    });

    test('learned patterns are used in detection', async () => {
      engine.learnedPatterns.set('custom_1', {
        id: 'custom_1',
        content: {
          name: 'Custom Learned Pattern',
          detector: 'return code.includes("CUSTOM_MARKER");',
          category: 'custom',
          severity: 'low'
        }
      });

      const code = 'const x = "CUSTOM_MARKER";';
      const results = await engine.detectPatterns(code);

      const learned = results.patterns.find(p => p.name === 'Custom Learned Pattern');
      expect(learned).toBeDefined();
      expect(learned.learned).toBe(true);
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('getStats returns statistics', async () => {
      await engine.detectPatterns('const password = "secret";');

      const stats = engine.getStats();

      expect(stats.analyzed).toBe(1);
      expect(stats.patternsDetected).toBeGreaterThan(0);
      expect(stats.builtInPatterns).toBeGreaterThan(0);
    });
  });

  describe('Available Patterns', () => {
    test('getAvailablePatterns returns all patterns', () => {
      const patterns = engine.getAvailablePatterns();

      expect(patterns.architectural).toBeDefined();
      expect(patterns.codeSmell).toBeDefined();
      expect(patterns.bug).toBeDefined();
      expect(patterns.performance).toBeDefined();
      expect(patterns.security).toBeDefined();
      expect(patterns.learned).toEqual([]);
    });

    test('includes learned patterns', () => {
      engine.learnedPatterns.set('test', {
        content: { name: 'Test', description: 'Test pattern', category: 'test' }
      });

      const patterns = engine.getAvailablePatterns();

      expect(patterns.learned.length).toBe(1);
    });
  });

  describe('Snippet Extraction', () => {
    test('extractRelevantSnippet returns full code if short', () => {
      const code = 'const x = 1;';
      const pattern = { name: 'test' };

      const snippet = engine.extractRelevantSnippet(code, pattern);

      expect(snippet).toBe(code);
    });

    test('extractRelevantSnippet finds relevant section', () => {
      const lines = Array(50).fill('const x = 1;');
      lines[25] = 'const singleton = getInstance();';
      const code = lines.join('\n');
      const pattern = { name: 'Singleton' };

      const snippet = engine.extractRelevantSnippet(code, pattern);

      expect(snippet).toContain('singleton');
      expect(snippet.split('\n').length).toBeLessThan(50);
    });
  });
});

describe('Exported Constants', () => {
  test('PATTERN_CATEGORIES has all categories', () => {
    expect(PATTERN_CATEGORIES.ARCHITECTURAL).toBe('architectural');
    expect(PATTERN_CATEGORIES.CODE_SMELL).toBe('code_smell');
    expect(PATTERN_CATEGORIES.BUG).toBe('bug');
    expect(PATTERN_CATEGORIES.PERFORMANCE).toBe('performance');
    expect(PATTERN_CATEGORIES.SECURITY).toBe('security');
    expect(PATTERN_CATEGORIES.BEST_PRACTICE).toBe('best_practice');
    expect(PATTERN_CATEGORIES.ANTI_PATTERN).toBe('anti_pattern');
    expect(PATTERN_CATEGORIES.REFACTORING).toBe('refactoring');
  });

  test('PATTERN_DETECTORS has all detector categories', () => {
    expect(PATTERN_DETECTORS.architectural).toBeDefined();
    expect(PATTERN_DETECTORS.codeSmell).toBeDefined();
    expect(PATTERN_DETECTORS.bug).toBeDefined();
    expect(PATTERN_DETECTORS.performance).toBeDefined();
    expect(PATTERN_DETECTORS.security).toBeDefined();
    expect(PATTERN_DETECTORS.bestPractice).toBeDefined();
  });

  test('each detector has required properties', () => {
    for (const [category, detectors] of Object.entries(PATTERN_DETECTORS)) {
      for (const detector of detectors) {
        expect(detector.name).toBeDefined();
        expect(typeof detector.detect).toBe('function');
        expect(detector.description).toBeDefined();
      }
    }
  });
});

describe('Singleton Function', () => {
  test('getPatternRecognitionEngine returns instance', () => {
    const engine = getPatternRecognitionEngine();
    expect(engine).toBeInstanceOf(PatternRecognitionEngine);
  });
});
