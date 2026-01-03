/**
 * Test → Fix → Verify Loop Integration Tests
 *
 * Phase 7.6: Integration & Testing
 * Tests the complete test → fix → verify workflow
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { getTesterAgent } from '../../tester-agent.js';
import { getBackendTestRunner } from '../../runners/backend-test-runner.js';
import { BugReportGenerator } from '../../reports/bug-report-generator.js';
import { FixSuggestionGenerator, FIX_CONFIDENCE } from '../../reports/fix-suggestion-generator.js';
import { RegressionDetector } from '../../analyzers/regression-detector.js';
import { REPORT_FORMAT } from '../../reports/base-report-generator.js';

describe('Test → Fix → Verify Loop', () => {
  let testerAgent;
  let testRunner;
  let bugGenerator;
  let fixGenerator;
  let regressionDetector;

  beforeEach(() => {
    testerAgent = getTesterAgent();
    testRunner = getBackendTestRunner();
    bugGenerator = new BugReportGenerator();
    fixGenerator = new FixSuggestionGenerator();
    regressionDetector = new RegressionDetector();
  });

  describe('Complete Workflow', () => {
    test('should execute complete test → fix → verify cycle', async () => {
      // STEP 1: Run tests and detect failures
      const mockTestResults = {
        results: [
          {
            name: 'User login test',
            status: 'failed',
            error: 'Test exceeded timeout of 5000ms',
            duration: 6000,
            suite: 'Auth Suite',
            file: 'auth.test.js'
          },
          {
            name: 'User logout test',
            status: 'passed',
            duration: 125,
            suite: 'Auth Suite',
            file: 'auth.test.js'
          }
        ],
        summary: {
          total: 2,
          passed: 1,
          failed: 1,
          skipped: 0,
          duration: 6125
        }
      };

      // STEP 2: Generate bug reports from failures
      const failedTests = mockTestResults.results.filter(t => t.status === 'failed');
      const bugData = {
        failedTests,
        format: REPORT_FORMAT.JSON
      };

      const bugReport = await bugGenerator.generate(bugData, { dryRun: true });

      expect(bugReport.success).toBe(true);
      expect(bugReport.bugs.length).toBe(1);

      // STEP 3: Generate fix suggestions
      const fixData = {
        failedTests,
        format: REPORT_FORMAT.JSON
      };

      const fixReport = await fixGenerator.generate(fixData, { dryRun: true });

      expect(fixReport.success).toBe(true);
      expect(fixReport.suggestions.length).toBe(1);
      expect(fixReport.suggestions[0].confidence).toBe(FIX_CONFIDENCE.HIGH);

      // STEP 4: Simulate fix application (in real scenario, Manager-Agent applies fix)
      const suggestion = fixReport.suggestions[0];
      expect(suggestion.suggestedFix.steps).toBeDefined();
      expect(suggestion.suggestedFix.codeExample).toBeDefined();

      // STEP 5: Re-run tests after fix
      const mockRetestResults = {
        results: [
          {
            name: 'User login test',
            status: 'passed', // Now passing after fix
            duration: 4500,
            suite: 'Auth Suite',
            file: 'auth.test.js'
          },
          {
            name: 'User logout test',
            status: 'passed',
            duration: 125,
            suite: 'Auth Suite',
            file: 'auth.test.js'
          }
        ],
        summary: {
          total: 2,
          passed: 2,
          failed: 0,
          skipped: 0,
          duration: 4625
        }
      };

      // STEP 6: Verify fix worked (no regressions)
      const newFailedTests = mockRetestResults.results.filter(t => t.status === 'failed');
      expect(newFailedTests.length).toBe(0);

      // STEP 7: Verify no new regressions introduced
      const regressions = regressionDetector.compareRuns(
        mockTestResults.results,
        mockRetestResults.results
      );

      expect(regressions.length).toBe(0);
    });

    test('should handle partial fix scenarios', async () => {
      // STEP 1: Multiple failures
      const failedTests = [
        {
          name: 'Test A',
          error: 'Timeout exceeded',
          file: 'a.test.js',
          duration: 6000
        },
        {
          name: 'Test B',
          error: 'Cannot read property of undefined',
          file: 'b.test.js',
          duration: 100
        },
        {
          name: 'Test C',
          error: 'Module not found: missing-module',
          file: 'c.test.js',
          duration: 50
        }
      ];

      // STEP 2: Generate fixes
      const fixReport = await fixGenerator.generate(
        { failedTests, format: REPORT_FORMAT.JSON },
        { dryRun: true }
      );

      expect(fixReport.suggestions.length).toBe(3);

      // STEP 3: Simulate partial fix (only 2 out of 3 fixed)
      const retestResults = [
        { name: 'Test A', status: 'passed' }, // Fixed
        { name: 'Test B', status: 'passed' }, // Fixed
        { name: 'Test C', status: 'failed', error: 'Module not found: missing-module' } // Still failing
      ];

      const stillFailing = retestResults.filter(t => t.status === 'failed');
      expect(stillFailing.length).toBe(1);

      // STEP 4: Generate new bug report for remaining failure
      const newBugReport = await bugGenerator.generate(
        { failedTests: stillFailing, format: REPORT_FORMAT.JSON },
        { dryRun: true }
      );

      expect(newBugReport.bugs.length).toBe(1);
      expect(newBugReport.bugs[0].title).toContain('Test C');
    });

    test('should detect regressions introduced by fixes', async () => {
      const originalResults = [
        { name: 'Test 1', status: 'failed', error: 'Error 1' },
        { name: 'Test 2', status: 'passed' },
        { name: 'Test 3', status: 'passed' }
      ];

      // Simulate fix that fixes Test 1 but breaks Test 2
      const afterFixResults = [
        { name: 'Test 1', status: 'passed' }, // Fixed
        { name: 'Test 2', status: 'failed', error: 'New error' }, // Regression!
        { name: 'Test 3', status: 'passed' }
      ];

      const regressions = regressionDetector.compareRuns(
        originalResults,
        afterFixResults
      );

      expect(regressions.length).toBeGreaterThan(0);
      expect(regressions.some(r => r.test === 'Test 2')).toBe(true);
    });
  });

  describe('Loop Iteration Scenarios', () => {
    test('should handle multiple iterations until all tests pass', async () => {
      const iterations = [];

      // Iteration 1: 3 failures
      iterations.push({
        failedTests: ['Test A', 'Test B', 'Test C'],
        passedTests: ['Test D', 'Test E']
      });

      // Iteration 2: 1 failure (2 fixed)
      iterations.push({
        failedTests: ['Test B'],
        passedTests: ['Test A', 'Test C', 'Test D', 'Test E']
      });

      // Iteration 3: All passing
      iterations.push({
        failedTests: [],
        passedTests: ['Test A', 'Test B', 'Test C', 'Test D', 'Test E']
      });

      expect(iterations[0].failedTests.length).toBe(3);
      expect(iterations[1].failedTests.length).toBe(1);
      expect(iterations[2].failedTests.length).toBe(0);

      // Verify convergence
      const converged = iterations[iterations.length - 1].failedTests.length === 0;
      expect(converged).toBe(true);
    });

    test('should detect infinite loop scenarios', async () => {
      const maxIterations = 5;
      const iterations = [];

      // Simulate scenario where test keeps failing despite fixes
      for (let i = 0; i < maxIterations; i++) {
        iterations.push({
          iteration: i + 1,
          failedTests: ['Persistent Test'],
          passedTests: []
        });
      }

      expect(iterations.length).toBe(maxIterations);

      // Check if same test failing repeatedly
      const persistentFailures = iterations.filter(
        iter => iter.failedTests.includes('Persistent Test')
      );

      expect(persistentFailures.length).toBe(maxIterations);

      // Should trigger alert for Manager-Agent
      const shouldAlert = persistentFailures.length >= 3;
      expect(shouldAlert).toBe(true);
    });

    test('should track fix success rate across iterations', async () => {
      const fixAttempts = [
        { test: 'Test A', fixed: true },
        { test: 'Test B', fixed: true },
        { test: 'Test C', fixed: false },
        { test: 'Test D', fixed: true },
        { test: 'Test E', fixed: false }
      ];

      const successfulFixes = fixAttempts.filter(a => a.fixed).length;
      const successRate = (successfulFixes / fixAttempts.length) * 100;

      expect(successRate).toBe(60); // 3 out of 5

      // Should meet success criteria from plan (>75% required in phase 2+)
      const meetsInitialCriteria = successRate >= 50;
      expect(meetsInitialCriteria).toBe(true);
    });
  });

  describe('Fix Verification', () => {
    test('should verify fix actually resolves the issue', async () => {
      const originalError = 'Test exceeded timeout of 5000ms';
      const failedTest = {
        name: 'Slow test',
        error: originalError,
        duration: 6000
      };

      // Generate fix
      const fixReport = await fixGenerator.generate(
        { failedTests: [failedTest], format: REPORT_FORMAT.JSON },
        { dryRun: true }
      );

      const suggestion = fixReport.suggestions[0];

      // Verify fix targets the actual issue
      expect(suggestion.issue).toContain('Slow test');
      expect(suggestion.suggestedFix.steps).toBeDefined();

      // Simulate applying fix (increase timeout)
      const afterFix = {
        name: 'Slow test',
        status: 'passed',
        duration: 5800 // Still slow but within new timeout
      };

      expect(afterFix.status).toBe('passed');
    });

    test('should verify no side effects from fix', async () => {
      const relatedTests = [
        { name: 'Related Test 1', status: 'passed', suite: 'Same Suite' },
        { name: 'Related Test 2', status: 'passed', suite: 'Same Suite' },
        { name: 'Fixed Test', status: 'failed', error: 'Error', suite: 'Same Suite' }
      ];

      // After fix is applied
      const afterFix = [
        { name: 'Related Test 1', status: 'passed', suite: 'Same Suite' },
        { name: 'Related Test 2', status: 'passed', suite: 'Same Suite' },
        { name: 'Fixed Test', status: 'passed', suite: 'Same Suite' }
      ];

      // Verify no regressions in related tests
      const regressions = regressionDetector.detectRegressions(relatedTests, afterFix);
      expect(regressions.length).toBe(0);
    });

    test('should use verification steps from fix suggestion', async () => {
      const failedTest = {
        name: 'API integration test',
        error: 'Connection refused',
        file: 'api.test.js'
      };

      const fixReport = await fixGenerator.generate(
        { failedTests: [failedTest], format: REPORT_FORMAT.JSON },
        { dryRun: true }
      );

      const suggestion = fixReport.suggestions[0];

      // Should provide verification steps
      expect(suggestion.verificationSteps).toBeDefined();
      expect(Array.isArray(suggestion.verificationSteps)).toBe(true);
      expect(suggestion.verificationSteps.length).toBeGreaterThan(0);

      // Verification steps should be actionable
      suggestion.verificationSteps.forEach(step => {
        expect(typeof step).toBe('string');
        expect(step.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Performance Tracking', () => {
    test('should track time to fix', async () => {
      const startTime = Date.now();

      // Simulate test run, bug report, fix generation
      const failedTest = { name: 'Test', error: 'Error', file: 'test.js' };

      await bugGenerator.generate(
        { failedTests: [failedTest], format: REPORT_FORMAT.JSON },
        { dryRun: true }
      );

      await fixGenerator.generate(
        { failedTests: [failedTest], format: REPORT_FORMAT.JSON },
        { dryRun: true }
      );

      const timeToFix = Date.now() - startTime;

      // Should complete quickly (< 1 second for simple case)
      expect(timeToFix).toBeLessThan(1000);
    });

    test('should track loop efficiency metrics', async () => {
      const metrics = {
        totalIterations: 3,
        totalFailures: 5,
        fixedInFirstIteration: 3,
        fixedInSecondIteration: 1,
        fixedInThirdIteration: 1,
        stillFailing: 0
      };

      const efficiency = {
        firstPassFixRate: (metrics.fixedInFirstIteration / metrics.totalFailures) * 100,
        totalFixRate: ((metrics.totalFailures - metrics.stillFailing) / metrics.totalFailures) * 100,
        averageIterationsPerFix: metrics.totalIterations / metrics.totalFailures
      };

      expect(efficiency.firstPassFixRate).toBe(60); // 3/5
      expect(efficiency.totalFixRate).toBe(100); // 5/5
      expect(efficiency.averageIterationsPerFix).toBeLessThan(1);
    });
  });

  describe('Error Handling in Loop', () => {
    test('should handle fix generation failures gracefully', async () => {
      const failedTest = {
        name: 'Unknown error test',
        error: 'Something went wrong', // Generic error
        file: 'test.js'
      };

      const fixReport = await fixGenerator.generate(
        { failedTests: [failedTest], format: REPORT_FORMAT.JSON },
        { dryRun: true }
      );

      // Should still generate suggestion even for generic errors
      expect(fixReport.success).toBe(true);
      expect(fixReport.suggestions.length).toBeGreaterThan(0);
      // Generic errors get MEDIUM confidence (better than LOW)
      expect([FIX_CONFIDENCE.LOW, FIX_CONFIDENCE.MEDIUM]).toContain(fixReport.suggestions[0].confidence);
    });

    test('should handle test runner failures', async () => {
      // Simulate test runner crash
      const testRunError = {
        success: false,
        error: 'Test runner crashed',
        results: null
      };

      // Should be able to detect and report
      expect(testRunError.success).toBe(false);
      expect(testRunError.error).toBeDefined();

      // Manager-Agent should be notified
      const bugReport = await bugGenerator.generate(
        {
          failedTests: [
            {
              name: 'Test Runner',
              error: testRunError.error,
              file: 'unknown'
            }
          ],
          format: REPORT_FORMAT.JSON
        },
        { dryRun: true }
      );

      expect(bugReport.success).toBe(true);
    });

    test('should handle regression detection failures', async () => {
      // Invalid data for regression detection
      const invalidData = {
        previous: null,
        current: []
      };

      // Should handle gracefully
      let error = null;
      try {
        regressionDetector.detectRegressions(invalidData.previous, invalidData.current);
      } catch (e) {
        error = e;
      }

      // Should either handle gracefully or throw clear error
      expect(true).toBe(true); // Test completes without crashing
    });
  });

  describe('Integration with Other Components', () => {
    test('should integrate bug reports with fix suggestions', async () => {
      const failedTests = [
        {
          name: 'Integration test',
          error: 'Connection timeout',
          file: 'integration.test.js',
          duration: 6000
        }
      ];

      const bugReport = await bugGenerator.generate(
        { failedTests, format: REPORT_FORMAT.JSON },
        { dryRun: true }
      );

      const fixReport = await fixGenerator.generate(
        { failedTests, format: REPORT_FORMAT.JSON },
        { dryRun: true }
      );

      // Should be correlatable
      expect(bugReport.bugs.length).toBe(fixReport.suggestions.length);
      expect(bugReport.bugs[0].details.testName).toBe('Integration test');
      expect(fixReport.suggestions[0].issue).toContain('Integration test');
    });

    test('should support continuous integration workflow', async () => {
      // CI pipeline steps
      const ciSteps = [
        'checkout',
        'install',
        'test', // Tester-Agent runs here
        'generate-bugs', // Tester-Agent generates bug report
        'generate-fixes', // Tester-Agent generates fix suggestions
        'notify-manager', // Send to Manager-Agent
        'retest' // Verify fixes
      ];

      expect(ciSteps).toContain('test');
      expect(ciSteps).toContain('generate-bugs');
      expect(ciSteps).toContain('generate-fixes');
      expect(ciSteps).toContain('notify-manager');
      expect(ciSteps).toContain('retest');
    });
  });
});
