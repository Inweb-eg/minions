import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import ChangeDetector, { getChangeDetector } from '../../../.claude/agents/manager-agent/change-detector.js';

describe('ChangeDetector', () => {
  let detector;

  beforeEach(async () => {
    detector = new ChangeDetector();
    await detector.initialize();
  });

  afterEach(() => {
    if (detector.monitoringEnabled) {
      detector.stopMonitoring();
    }
  });

  test('should initialize with current commit', async () => {
    expect(detector.lastCheckCommit).toBeTruthy();
    expect(detector.lastCheckCommit).toHaveLength(40); // Full git SHA
  });

  test('should get current commit hash', async () => {
    const commit = await detector.getCurrentCommit();
    expect(commit).toBeTruthy();
    expect(commit).toMatch(/^[a-f0-9]{40}$/); // Valid git SHA
  });

  test('should get changed files', async () => {
    const files = await detector.getChangedFiles();
    expect(Array.isArray(files)).toBe(true);
    // Note: May be empty if no changes
  });

  test('should categorize backend files correctly', () => {
    const category = detector.categorizeFile('backend/src/controllers/user.js');
    expect(category).toBe('backend');
  });

  test('should categorize frontend files correctly', () => {
    expect(detector.categorizeFile('admin-dashboard/src/App.jsx')).toBe('frontend');
    expect(detector.categorizeFile('users/lib/screens/home.dart')).toBe('frontend');
    expect(detector.categorizeFile('drivers/lib/widgets/map.dart')).toBe('frontend');
  });

  test('should categorize documentation files correctly', () => {
    expect(detector.categorizeFile('docs/api/endpoints.md')).toBe('docs');
    expect(detector.categorizeFile('README.md')).toBe('docs');
  });

  test('should categorize test files correctly', () => {
    expect(detector.categorizeFile('tests/user.test.js')).toBe('tests');
    expect(detector.categorizeFile('backend/test/auth.test.js')).toBe('tests');
  });

  test('should determine CRITICAL priority for migrations', () => {
    const priority = detector.determinePriority('backend/migrations/001_create_users.sql');
    expect(priority).toBe(detector.PRIORITY.CRITICAL);
  });

  test('should determine CRITICAL priority for security files', () => {
    const priority = detector.determinePriority('backend/src/auth/security.js');
    expect(priority).toBe(detector.PRIORITY.CRITICAL);
  });

  test('should determine HIGH priority for API changes', () => {
    const priority = detector.determinePriority('backend/src/controllers/api.js');
    expect(priority).toBe(detector.PRIORITY.HIGH);
  });

  test('should determine LOW priority for documentation', () => {
    const priority = detector.determinePriority('docs/guide.md');
    expect(priority).toBe(detector.PRIORITY.LOW);
  });

  test('should detect breaking changes in migrations', () => {
    expect(detector.isBreakingChange('backend/migrations/002_alter_users.sql')).toBe(true);
  });

  test('should detect breaking changes in routes', () => {
    expect(detector.isBreakingChange('backend/src/routes/api.js')).toBe(true);
  });

  test('should not detect breaking changes in tests', () => {
    expect(detector.isBreakingChange('tests/user.test.js')).toBe(false);
  });

  test('should detect security impact in auth files', () => {
    expect(detector.hasSecurityImpact('backend/src/auth/jwt.js')).toBe(true);
  });

  test('should detect security impact in env files', () => {
    expect(detector.hasSecurityImpact('.env')).toBe(true);
  });

  test('should not detect security impact in regular files', () => {
    expect(detector.hasSecurityImpact('backend/src/utils/format.js')).toBe(false);
  });

  test('should analyze changes comprehensively', () => {
    const files = [
      'backend/src/controllers/user.js',
      'admin-dashboard/src/App.jsx',
      'docs/api.md',
      'backend/migrations/001_create_users.sql',
      'tests/user.test.js'
    ];

    const analysis = detector.analyzeChanges(files);

    expect(analysis.totalFiles).toBe(5);
    expect(analysis.byCategory.backend.length).toBe(1); // Only user.js
    expect(analysis.byCategory.database.length).toBe(1); // Migration file
    expect(analysis.byCategory.frontend.length).toBe(1);
    expect(analysis.byCategory.docs.length).toBe(1);
    expect(analysis.byCategory.tests.length).toBe(1);
    expect(analysis.breakingChanges.length).toBe(1); // Migration
    expect(analysis.securityImpact).toBe(false);
  });

  test('should perform impact analysis', async () => {
    const files = ['backend/src/controllers/user.js'];

    const impact = await detector.performImpactAnalysis(files);

    expect(impact.affectedAgents).toBeDefined();
    expect(Array.isArray(impact.affectedAgents)).toBe(true);
    expect(impact.changeAnalysis).toBeDefined();
    expect(impact.executionPriority).toBeDefined();
  });

  test('should handle empty file list in impact analysis', async () => {
    const impact = await detector.performImpactAnalysis([]);

    expect(impact.affectedAgents).toEqual([]);
    expect(impact.changeAnalysis.totalFiles).toBe(0);
    expect(impact.executionPriority).toEqual([]);
  });

  test('should prioritize agent execution', () => {
    const agents = ['backend-agent', 'document-agent', 'tester-agent'];
    const changeAnalysis = {
      totalFiles: 3,
      byCategory: {
        backend: ['backend/src/controllers/user.js'],
        docs: ['docs/api.md'],
        tests: ['tests/user.test.js'],
        frontend: [],
        database: [],
        config: [],
        other: []
      },
      byPriority: {
        1: [],
        2: ['backend/src/controllers/user.js'],
        3: ['tests/user.test.js'],
        4: ['docs/api.md']
      },
      breakingChanges: [],
      securityImpact: false
    };

    const prioritized = detector.prioritizeAgentExecution(agents, changeAnalysis);

    expect(prioritized).toHaveLength(3);
    expect(prioritized[0].agent).toBe('backend-agent'); // Should be highest priority
    expect(prioritized[0].priority).toBe(detector.PRIORITY.CRITICAL);
  });

  test('should calculate agent priority based on changes', () => {
    const changeAnalysis = {
      byCategory: {
        backend: ['backend/src/controllers/user.js'],
        docs: [],
        tests: [],
        frontend: [],
        database: [],
        config: [],
        other: []
      },
      securityImpact: false
    };

    const priority = detector.calculateAgentPriority('backend-agent', changeAnalysis);
    expect(priority).toBe(detector.PRIORITY.CRITICAL);
  });

  test('should provide priority reasoning', () => {
    const changeAnalysis = {
      byCategory: {
        backend: ['file1.js', 'file2.js'],
        docs: [],
        tests: [],
        frontend: [],
        database: [],
        config: [],
        other: []
      },
      breakingChanges: ['backend/migrations/001.sql'],
      securityImpact: true
    };

    const reasoning = detector.getAgentPriorityReasoning('backend-agent', changeAnalysis);

    expect(reasoning).toContain('backend files changed');
    expect(reasoning).toContain('breaking changes');
    expect(reasoning).toContain('Security-related changes');
  });

  test('should get overall priority from change analysis', () => {
    const criticalAnalysis = {
      securityImpact: true,
      breakingChanges: ['file1.js'],
      byPriority: { 1: [], 2: [], 3: [], 4: [] }
    };

    expect(detector.getOverallPriority(criticalAnalysis)).toBe(detector.PRIORITY.CRITICAL);

    const lowAnalysis = {
      securityImpact: false,
      breakingChanges: [],
      byPriority: { 1: [], 2: [], 3: [], 4: ['docs/readme.md'] }
    };

    expect(detector.getOverallPriority(lowAnalysis)).toBe(detector.PRIORITY.LOW);
  });

  test('should start and stop monitoring', () => {
    expect(detector.monitoringEnabled).toBe(false);

    detector.startMonitoring(1000);
    expect(detector.monitoringEnabled).toBe(true);
    expect(detector.monitoringInterval).toBeTruthy();

    detector.stopMonitoring();
    expect(detector.monitoringEnabled).toBe(false);
    expect(detector.monitoringInterval).toBe(null);
  });

  test('should not start monitoring twice', () => {
    detector.startMonitoring(1000);
    const firstInterval = detector.monitoringInterval;

    detector.startMonitoring(1000);
    expect(detector.monitoringInterval).toBe(firstInterval);

    detector.stopMonitoring();
  });

  test('should get monitoring status', () => {
    const status = detector.getStatus();

    expect(status.enabled).toBe(false);
    expect(status.lastCommit).toBeTruthy();
    expect(status.interval).toBe('inactive');

    detector.startMonitoring(1000);
    const activeStatus = detector.getStatus();

    expect(activeStatus.enabled).toBe(true);
    expect(activeStatus.interval).toBe('active');

    detector.stopMonitoring();
  });

  test('singleton should return same instance', () => {
    const detector1 = getChangeDetector();
    const detector2 = getChangeDetector();
    expect(detector1).toBe(detector2);
  });
});
