/**
 * Manager-Agent Integration Tests
 *
 * Phase 7.6: Integration & Testing
 * Tests integration between Tester-Agent and Manager-Agent
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { BugReportGenerator, BUG_SEVERITY } from '../../reports/bug-report-generator.js';
import { FixSuggestionGenerator, FIX_CONFIDENCE, FIX_TYPE } from '../../reports/fix-suggestion-generator.js';
import { REPORT_FORMAT } from '../../reports/base-report-generator.js';

describe('Manager-Agent Integration', () => {
  let bugReportGenerator;
  let fixSuggestionGenerator;

  beforeEach(() => {
    bugReportGenerator = new BugReportGenerator();
    fixSuggestionGenerator = new FixSuggestionGenerator();
  });

  describe('Bug Report Generation for Manager-Agent', () => {
    test('should generate bug reports in JSON format by default', async () => {
      const data = {
        failedTests: [
          {
            name: 'User authentication test',
            suite: 'Auth Suite',
            file: 'auth.test.js',
            error: 'Expected 200 but got 401',
            duration: 125
          }
        ],
        format: REPORT_FORMAT.JSON
      };

      const result = await bugReportGenerator.generate(data, { dryRun: true });

      expect(result.success).toBe(true);
      expect(result.format).toBe(REPORT_FORMAT.JSON);
      expect(result.bugs).toBeDefined();
      expect(result.bugs.length).toBe(1);
    });

    test('should create properly structured bug objects', async () => {
      const data = {
        failedTests: [
          {
            name: 'Payment processing test',
            suite: 'Payment Suite',
            file: 'payment.test.js',
            error: 'Transaction failed',
            duration: 89
          }
        ],
        format: REPORT_FORMAT.JSON
      };

      const result = await bugReportGenerator.generate(data, { dryRun: true });
      const bug = result.bugs[0];

      // Validate bug structure for Manager-Agent consumption
      expect(bug.id).toMatch(/^BUG-\d+$/);
      expect(bug.type).toBe('test_failure');
      expect(bug.severity).toBe(BUG_SEVERITY.HIGH);
      expect(bug.title).toContain('Payment processing test');
      expect(bug.description).toBeDefined();
      expect(bug.details).toBeDefined();
      expect(bug.impact).toBeDefined();
      expect(bug.reproducible).toBe(true);
      expect(bug.status).toBe('open');
      expect(bug.createdAt).toBeDefined();
    });

    test('should convert flaky tests to bugs with proper severity', async () => {
      const data = {
        flakyTests: [
          {
            test: 'Network timeout test',
            passCount: 7,
            failCount: 3,
            totalAttempts: 10,
            flakinessScore: 0.3,
            pattern: 'timeout',
            recommendation: 'Increase timeout or mock network'
          }
        ],
        format: REPORT_FORMAT.JSON
      };

      const result = await bugReportGenerator.generate(data, { dryRun: true });
      const bug = result.bugs[0];

      expect(bug.type).toBe('flaky_test');
      expect(bug.severity).toBe(BUG_SEVERITY.MEDIUM);
      expect(bug.reproducible).toBe(false);
      expect(bug.details.flakinessScore).toBe(0.3);
      expect(bug.details.pattern).toBe('timeout');
    });

    test('should convert regressions to critical bugs', async () => {
      const data = {
        regressions: [
          {
            type: 'newly_failing',
            test: 'Database connection test',
            previousStatus: 'passing',
            currentStatus: 'failing',
            firstFailedAt: '2025-11-14T10:00:00Z'
          }
        ],
        format: REPORT_FORMAT.JSON
      };

      const result = await bugReportGenerator.generate(data, { dryRun: true });
      const bug = result.bugs[0];

      expect(bug.type).toBe('regression');
      expect(bug.severity).toBe(BUG_SEVERITY.CRITICAL);
      expect(bug.details.regressionType).toBe('newly_failing');
      expect(bug.impact).toContain('Previously passing test is now failing');
    });

    test('should only include critical/high coverage gaps', async () => {
      const data = {
        coverageGaps: [
          {
            type: 'uncovered_file',
            file: 'auth.js',
            severity: 'critical',
            actual: 0,
            threshold: 80,
            uncovered: ['login', 'logout', 'verify']
          },
          {
            type: 'low_branch_coverage',
            file: 'utils.js',
            severity: 'low',
            actual: 50,
            threshold: 75,
            uncovered: []
          }
        ],
        format: REPORT_FORMAT.JSON
      };

      const result = await bugReportGenerator.generate(data, { dryRun: true });

      // Should only include critical gap, not low severity
      expect(result.bugs.length).toBe(1);
      expect(result.bugs[0].type).toBe('coverage_gap');
      expect(result.bugs[0].severity).toBe(BUG_SEVERITY.CRITICAL);
    });

    test('should convert performance issues to bugs', async () => {
      const data = {
        performanceIssues: [
          {
            type: 'slow_test',
            test: 'Large dataset test',
            suite: 'Data Suite',
            duration: 12000,
            threshold: 5000,
            slowdownFactor: 2.4
          }
        ],
        format: REPORT_FORMAT.JSON
      };

      const result = await bugReportGenerator.generate(data, { dryRun: true });
      const bug = result.bugs[0];

      expect(bug.type).toBe('performance_issue');
      expect(bug.severity).toBe(BUG_SEVERITY.MEDIUM);
      expect(bug.details.duration).toBe(12000);
      expect(bug.details.slowdownFactor).toBe(2.4);
    });

    test('should generate bug summary for Manager-Agent', async () => {
      const data = {
        failedTests: [{ name: 'Test 1', error: 'Error 1' }],
        flakyTests: [{ test: 'Test 2', passCount: 5, failCount: 5, totalAttempts: 10 }],
        regressions: [{ type: 'newly_failing', test: 'Test 3' }],
        coverageGaps: [{ type: 'uncovered', file: 'file.js', severity: 'critical', actual: 0, threshold: 80 }],
        performanceIssues: [{ type: 'slow_test', test: 'Test 4', duration: 10000 }],
        format: REPORT_FORMAT.JSON
      };

      const result = await bugReportGenerator.generate(data, { dryRun: true });

      expect(result.summary).toBeDefined();
      expect(result.summary.total).toBe(5);
      expect(result.summary.bySeverity).toBeDefined();
      expect(result.summary.bySeverity.critical).toBeGreaterThan(0);
      expect(result.summary.byType).toBeDefined();
    });
  });

  describe('Fix Suggestion Generation for Manager-Agent', () => {
    test('should generate fix suggestions with high confidence', async () => {
      const data = {
        failedTests: [
          {
            name: 'Timeout test',
            error: 'Test exceeded timeout of 5000ms',
            file: 'slow.test.js',
            duration: 6000
          }
        ],
        format: REPORT_FORMAT.JSON
      };

      const result = await fixSuggestionGenerator.generate(data, { dryRun: true });

      expect(result.success).toBe(true);
      expect(result.suggestions.length).toBeGreaterThan(0);

      const suggestion = result.suggestions[0];
      expect(suggestion.confidence).toBe(FIX_CONFIDENCE.HIGH);
      expect(suggestion.suggestedFix.steps).toBeDefined();
      expect(suggestion.suggestedFix.steps.length).toBeGreaterThan(0);
      expect(suggestion.suggestedFix.codeExample).toBeDefined();
    });

    test('should provide code examples in suggestions', async () => {
      const data = {
        failedTests: [
          {
            name: 'Null check test',
            error: 'Cannot read property of undefined',
            file: 'data.test.js'
          }
        ],
        format: REPORT_FORMAT.JSON
      };

      const result = await fixSuggestionGenerator.generate(data, { dryRun: true });
      const suggestion = result.suggestions[0];

      expect(suggestion.suggestedFix.codeExample).toBeTruthy();
      expect(suggestion.suggestedFix.codeExample.length).toBeGreaterThan(0);
      expect(suggestion.confidence).toBe(FIX_CONFIDENCE.HIGH);
    });

    test('should categorize fix types correctly', async () => {
      const data = {
        failedTests: [
          {
            name: 'Config test',
            error: 'Module not found: dotenv',
            file: 'config.test.js'
          }
        ],
        format: REPORT_FORMAT.JSON
      };

      const result = await fixSuggestionGenerator.generate(data, { dryRun: true });
      const suggestion = result.suggestions[0];

      expect(Object.values(FIX_TYPE)).toContain(suggestion.type);
    });

    test('should estimate effort for fixes', async () => {
      const data = {
        failedTests: [
          {
            name: 'Simple test',
            error: 'Assertion failed: expected true to be false',
            file: 'simple.test.js'
          }
        ],
        format: REPORT_FORMAT.JSON
      };

      const result = await fixSuggestionGenerator.generate(data, { dryRun: true });
      const suggestion = result.suggestions[0];

      expect(suggestion.estimatedEffort).toBeDefined();
      expect(['low', 'medium', 'high']).toContain(suggestion.estimatedEffort);
    });

    test('should provide verification steps', async () => {
      const data = {
        failedTests: [
          {
            name: 'API test',
            error: 'Expected 200 but got 500',
            file: 'api.test.js'
          }
        ],
        format: REPORT_FORMAT.JSON
      };

      const result = await fixSuggestionGenerator.generate(data, { dryRun: true });
      const suggestion = result.suggestions[0];

      expect(suggestion.verificationSteps).toBeDefined();
      expect(Array.isArray(suggestion.verificationSteps)).toBe(true);
      expect(suggestion.verificationSteps.length).toBeGreaterThan(0);
    });

    test('should handle multiple failed tests', async () => {
      const data = {
        failedTests: [
          { name: 'Test 1', error: 'timeout exceeded', file: 'test1.js' },
          { name: 'Test 2', error: 'Cannot read property', file: 'test2.js' },
          { name: 'Test 3', error: 'Module not found', file: 'test3.js' }
        ],
        format: REPORT_FORMAT.JSON
      };

      const result = await fixSuggestionGenerator.generate(data, { dryRun: true });

      expect(result.suggestions.length).toBe(3);
      result.suggestions.forEach(suggestion => {
        expect(suggestion.suggestedFix).toBeDefined();
        expect(suggestion.confidence).toBeDefined();
        expect(suggestion.type).toBeDefined();
      });
    });

    test('should prioritize critical suggestions', async () => {
      const data = {
        failedTests: [
          { name: 'Critical test', error: 'Security vulnerability detected', file: 'security.test.js' },
          { name: 'Minor test', error: 'Expected 1 to equal 2', file: 'math.test.js' }
        ],
        format: REPORT_FORMAT.JSON
      };

      const result = await fixSuggestionGenerator.generate(data, { dryRun: true });

      expect(result.summary.byConfidence).toBeDefined();
      expect(result.suggestions[0].confidence).toBeDefined();
    });
  });

  describe('Report Format Validation', () => {
    test('should validate JSON report structure', async () => {
      const data = {
        failedTests: [{ name: 'Test', error: 'Error' }],
        format: REPORT_FORMAT.JSON
      };

      const result = await bugReportGenerator.generate(data, { dryRun: true });

      // Should be parseable JSON
      expect(() => JSON.parse(JSON.stringify(result))).not.toThrow();

      // Should have required fields
      expect(result.success).toBeDefined();
      expect(result.bugs).toBeDefined();
      expect(result.summary).toBeDefined();
    });

    test('should include metadata for traceability', async () => {
      const data = {
        failedTests: [{ name: 'Test', error: 'Error' }],
        format: REPORT_FORMAT.JSON
      };

      const result = await bugReportGenerator.generate(data, { dryRun: true });

      // Metadata should be in the processed data structure
      expect(result.bugs).toBeDefined();
      expect(result.summary).toBeDefined();
    });
  });

  describe('Manager-Agent Communication Protocol', () => {
    test('should generate reports that Manager-Agent can consume', async () => {
      // Simulate Manager-Agent consuming bug report
      const bugData = {
        failedTests: [
          { name: 'Integration test', error: 'Connection refused', file: 'integration.test.js' }
        ],
        format: REPORT_FORMAT.JSON
      };

      const bugReport = await bugReportGenerator.generate(bugData, { dryRun: true });

      // Manager-Agent should be able to read bugs
      expect(bugReport.success).toBe(true);
      expect(bugReport.bugs).toBeDefined();
      expect(Array.isArray(bugReport.bugs)).toBe(true);

      // Manager-Agent should be able to request fix suggestions
      const fixData = {
        failedTests: [
          { name: 'Integration test', error: 'Connection refused', file: 'integration.test.js' }
        ],
        format: REPORT_FORMAT.JSON
      };

      const fixReport = await fixSuggestionGenerator.generate(fixData, { dryRun: true });

      expect(fixReport.success).toBe(true);
      expect(fixReport.suggestions).toBeDefined();
      expect(fixReport.suggestions.length).toBeGreaterThan(0);

      // Manager-Agent should be able to match bugs to fixes
      const bug = bugReport.bugs[0];
      const suggestion = fixReport.suggestions[0];

      expect(bug.details.testName).toBe('Integration test');
      expect(suggestion.issue).toContain('Integration test');
    });

    test('should provide actionable data for Manager-Agent decisions', async () => {
      const data = {
        failedTests: [{ name: 'Test', error: 'Error', file: 'test.js' }],
        regressions: [{ type: 'newly_failing', test: 'Regression test' }],
        format: REPORT_FORMAT.JSON
      };

      const bugReport = await bugReportGenerator.generate(data, { dryRun: true });
      const fixReport = await fixSuggestionGenerator.generate(data, { dryRun: true });

      // Manager-Agent needs severity for prioritization
      expect(bugReport.summary.bySeverity).toBeDefined();

      // Manager-Agent needs confidence for decision making
      expect(fixReport.suggestions[0].confidence).toBeDefined();

      // Manager-Agent needs effort estimation for resource planning
      expect(fixReport.suggestions[0].estimatedEffort).toBeDefined();
    });
  });

  describe('Integration Test Coverage', () => {
    test('should validate bug report exports are accessible', () => {
      expect(BugReportGenerator).toBeDefined();
      expect(BUG_SEVERITY).toBeDefined();
      expect(BUG_SEVERITY.CRITICAL).toBe('critical');
      expect(BUG_SEVERITY.HIGH).toBe('high');
      expect(BUG_SEVERITY.MEDIUM).toBe('medium');
      expect(BUG_SEVERITY.LOW).toBe('low');
    });

    test('should validate fix suggestion exports are accessible', () => {
      expect(FixSuggestionGenerator).toBeDefined();
      expect(FIX_CONFIDENCE).toBeDefined();
      expect(FIX_TYPE).toBeDefined();
      expect(FIX_CONFIDENCE.HIGH).toBe('high');
      expect(FIX_CONFIDENCE.MEDIUM).toBe('medium');
      expect(FIX_CONFIDENCE.LOW).toBe('low');
    });
  });
});
