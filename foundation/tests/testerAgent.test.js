/**
 * TesterAgent Tests
 * ==================
 * Tests for the multi-platform test orchestrator agent.
 */

import { jest } from '@jest/globals';
import { TesterAgent, getTesterAgent } from '../../agents/tester-agent/index.js';

// Mock the test runners to avoid actual test execution
jest.unstable_mockModule('../../agents/tester-agent/runners/backend-test-runner.js', () => ({
  getBackendTestRunner: jest.fn(() => ({
    runTests: jest.fn().mockResolvedValue({
      total: 10,
      passed: 9,
      failed: 1,
      skipped: 0,
      duration: 1500,
      tests: [
        { name: 'test 1', status: 'passed' },
        { name: 'test 2', status: 'failed', error: 'Expected true to be false' }
      ]
    })
  })),
  BackendTestRunner: jest.fn()
}));

jest.unstable_mockModule('../../agents/tester-agent/runners/flutter-test-runner.js', () => ({
  getFlutterTestRunner: jest.fn(() => ({
    runTests: jest.fn().mockResolvedValue({
      total: 5,
      passed: 5,
      failed: 0,
      skipped: 0,
      duration: 2000
    })
  })),
  FlutterTestRunner: jest.fn()
}));

jest.unstable_mockModule('../../agents/tester-agent/runners/react-test-runner.js', () => ({
  getReactTestRunner: jest.fn(() => ({
    runTests: jest.fn().mockResolvedValue({
      total: 8,
      passed: 7,
      failed: 1,
      skipped: 0,
      duration: 1000
    })
  })),
  ReactTestRunner: jest.fn()
}));

jest.unstable_mockModule('../../agents/tester-agent/runners/e2e-test-runner.js', () => ({
  getE2ETestRunner: jest.fn(() => ({
    runTests: jest.fn().mockResolvedValue({
      total: 3,
      passed: 3,
      failed: 0,
      skipped: 0,
      duration: 5000
    })
  })),
  E2ETestRunner: jest.fn()
}));

describe('TesterAgent', () => {
  let agent;

  beforeEach(() => {
    // Create fresh instance for each test
    agent = new TesterAgent();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('creates with default configuration', () => {
      expect(agent.projectRoot).toBe(process.cwd());
      expect(agent.platformPaths.size).toBe(0);
      expect(agent.platformAgentMapping.size).toBe(0);
    });

    test('has all test runners initialized', () => {
      expect(agent.runners.backend).toBeDefined();
      expect(agent.runners.flutter).toBeInstanceOf(Map);
      expect(agent.runners.react).toBeDefined();
      expect(agent.runners.e2e).toBeDefined();
    });
  });

  describe('Singleton Pattern', () => {
    test('getTesterAgent returns singleton instance', () => {
      const instance1 = getTesterAgent();
      const instance2 = getTesterAgent();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Configuration', () => {
    test('configure sets project root', () => {
      agent.configure({
        projectRoot: '/custom/path'
      });

      expect(agent.projectRoot).toBe('/custom/path');
    });

    test('configure sets platforms', () => {
      agent.configure({
        platforms: {
          api: '/path/to/api',
          web: { path: '/path/to/web', type: 'vitest' }
        }
      });

      expect(agent.platformPaths.get('api')).toEqual({ path: '/path/to/api', type: 'auto' });
      expect(agent.platformPaths.get('web')).toEqual({ path: '/path/to/web', type: 'vitest' });
    });

    test('configure sets agent mapping', () => {
      agent.configure({
        agentMapping: {
          backend: 'backend-writer-agent',
          flutter: 'flutter-writer-agent'
        }
      });

      expect(agent.platformAgentMapping.get('backend')).toBe('backend-writer-agent');
      expect(agent.platformAgentMapping.get('flutter')).toBe('flutter-writer-agent');
    });
  });

  describe('Platform Registration', () => {
    test('registerPlatform adds new platform', () => {
      agent.registerPlatform('mobile', {
        path: '/path/to/mobile',
        type: 'flutter'
      });

      expect(agent.platformPaths.has('mobile')).toBe(true);
      expect(agent.platformPaths.get('mobile').type).toBe('flutter');
    });

    test('registerPlatform sets agent mapping', () => {
      agent.registerPlatform('mobile', {
        path: '/path/to/mobile',
        type: 'flutter',
        agent: 'flutter-writer-agent'
      });

      expect(agent.platformAgentMapping.get('mobile')).toBe('flutter-writer-agent');
    });
  });

  describe('Test Type Detection', () => {
    test('detects jest for backend paths', () => {
      expect(agent.detectTestType('/project/backend')).toBe('jest');
      expect(agent.detectTestType('/project/api')).toBe('jest');
      expect(agent.detectTestType('/project/server')).toBe('jest');
    });

    test('detects flutter for app paths', () => {
      expect(agent.detectTestType('/project/flutter')).toBe('flutter');
      expect(agent.detectTestType('/project/mobile-app')).toBe('flutter');
    });

    test('detects vitest for react paths', () => {
      expect(agent.detectTestType('/project/react')).toBe('vitest');
      expect(agent.detectTestType('/project/dashboard')).toBe('vitest');
      expect(agent.detectTestType('/project/admin')).toBe('vitest');
    });

    test('detects playwright for e2e paths', () => {
      expect(agent.detectTestType('/project/e2e')).toBe('playwright');
      expect(agent.detectTestType('/project/playwright')).toBe('playwright');
    });

    test('defaults to jest for unknown paths', () => {
      expect(agent.detectTestType('/project/unknown')).toBe('jest');
    });
  });

  describe('Summary Generation', () => {
    test('generateSummary aggregates platform results', () => {
      const platforms = {
        backend: { total: 10, passed: 9, failed: 1, skipped: 0, duration: 1000 },
        frontend: { total: 5, passed: 5, failed: 0, skipped: 0, duration: 500 }
      };

      const summary = agent.generateSummary(platforms);

      expect(summary.totalTests).toBe(15);
      expect(summary.totalPassed).toBe(14);
      expect(summary.totalFailed).toBe(1);
      expect(summary.totalDuration).toBe(1500);
      expect(summary.platformCount).toBe(2);
      expect(summary.status).toBe('failed');
    });

    test('generateSummary calculates pass rate', () => {
      const platforms = {
        backend: { total: 100, passed: 90, failed: 10, skipped: 0, duration: 1000 }
      };

      const summary = agent.generateSummary(platforms);

      expect(summary.passRate).toBe('90.00');
    });

    test('generateSummary handles empty results', () => {
      const summary = agent.generateSummary({});

      expect(summary.totalTests).toBe(0);
      expect(summary.passRate).toBe(0);
      expect(summary.status).toBe('passed');
    });

    test('generateSummary skips error results', () => {
      const platforms = {
        backend: { total: 10, passed: 10, failed: 0, skipped: 0, duration: 1000 },
        broken: { error: 'Connection failed' }
      };

      const summary = agent.generateSummary(platforms);

      expect(summary.totalTests).toBe(10);
      expect(summary.platformCount).toBe(1);
    });
  });

  describe('Summary Formatting', () => {
    test('formatSummary creates readable output', () => {
      const summary = {
        status: 'passed',
        platformCount: 2,
        totalTests: 50,
        totalPassed: 48,
        totalFailed: 2,
        totalSkipped: 0,
        passRate: '96.00',
        totalDuration: 3000
      };

      const formatted = agent.formatSummary(summary);

      expect(formatted).toContain('TEST SUMMARY');
      expect(formatted).toContain('Status: PASSED');
      expect(formatted).toContain('Platforms: 2');
      expect(formatted).toContain('Total Tests: 50');
      expect(formatted).toContain('Pass Rate: 96.00%');
    });

    test('formatSummary shows FAILED status', () => {
      const summary = {
        status: 'failed',
        platformCount: 1,
        totalTests: 10,
        totalPassed: 5,
        totalFailed: 5,
        totalSkipped: 0,
        passRate: '50.00',
        totalDuration: 1000
      };

      const formatted = agent.formatSummary(summary);

      expect(formatted).toContain('Status: FAILED');
    });
  });

  describe('Failure Extraction', () => {
    test('extractFailures returns failure details', () => {
      const results = {
        platforms: {
          backend: {
            total: 10,
            passed: 9,
            failed: 1,
            tests: [
              { name: 'working test', status: 'passed' },
              { name: 'broken test', status: 'failed', error: 'Expected true to be false' }
            ]
          }
        }
      };

      const failures = agent.extractFailures(results);

      expect(failures.length).toBe(1);
      expect(failures[0].platform).toBe('backend');
      expect(failures[0].testName).toBe('broken test');
      expect(failures[0].error).toBe('Expected true to be false');
    });

    test('extractFailures handles platform errors', () => {
      const results = {
        platforms: {
          broken: { error: 'Connection failed' }
        }
      };

      const failures = agent.extractFailures(results);

      expect(failures.length).toBe(1);
      expect(failures[0].type).toBe('platform_error');
      expect(failures[0].severity).toBe('high');
    });
  });

  describe('Auto-Fix Detection', () => {
    test('isTestAutoFixable detects module not found', () => {
      expect(agent.isTestAutoFixable({ error: "cannot find module 'lodash'" })).toBe(true);
    });

    test('isTestAutoFixable detects undefined variable', () => {
      expect(agent.isTestAutoFixable({ error: 'myFunction is not defined' })).toBe(true);
    });

    test('isTestAutoFixable detects 404 errors', () => {
      expect(agent.isTestAutoFixable({ error: 'Expected status 200, got 404 not found' })).toBe(true);
    });

    test('isTestAutoFixable detects validation failures', () => {
      expect(agent.isTestAutoFixable({ error: 'validation failed for email' })).toBe(true);
    });

    test('isTestAutoFixable detects null type errors', () => {
      expect(agent.isTestAutoFixable({ error: "TypeError: Cannot read property 'x' of null" })).toBe(true);
    });

    test('isTestAutoFixable returns false for unknown errors', () => {
      expect(agent.isTestAutoFixable({ error: 'Some random error' })).toBe(false);
    });
  });

  describe('Failure Severity', () => {
    test('determineFailureSeverity returns critical for security', () => {
      expect(agent.determineFailureSeverity({ name: 'security test', error: '' })).toBe('critical');
      expect(agent.determineFailureSeverity({ name: 'auth test', error: '' })).toBe('critical');
      expect(agent.determineFailureSeverity({ name: 'payment processing', error: '' })).toBe('critical');
    });

    test('determineFailureSeverity returns high for core functionality', () => {
      expect(agent.determineFailureSeverity({ name: 'core feature', error: '' })).toBe('high');
      expect(agent.determineFailureSeverity({ name: 'main flow', error: '' })).toBe('high');
      expect(agent.determineFailureSeverity({ name: 'data integrity check', error: '' })).toBe('high');
    });

    test('determineFailureSeverity returns medium for features', () => {
      expect(agent.determineFailureSeverity({ name: 'feature test', error: '' })).toBe('medium');
      expect(agent.determineFailureSeverity({ name: 'component test', error: '' })).toBe('medium');
    });

    test('determineFailureSeverity returns low by default', () => {
      expect(agent.determineFailureSeverity({ name: 'misc test', error: '' })).toBe('low');
    });
  });

  describe('Fix Suggestions', () => {
    test('suggestFix suggests import for module not found', () => {
      const suggestion = agent.suggestFix({ error: "cannot find module 'lodash'" });
      expect(suggestion).toContain('lodash');
    });

    test('suggestFix suggests definition for undefined', () => {
      const suggestion = agent.suggestFix({ error: 'myFunction is not defined' });
      expect(suggestion).toContain('myFunction');
    });

    test('suggestFix suggests endpoint for 404', () => {
      const suggestion = agent.suggestFix({ error: 'got 404 not found' });
      expect(suggestion).toContain('endpoint');
    });

    test('suggestFix suggests validation for validation errors', () => {
      const suggestion = agent.suggestFix({ error: 'validation failed' });
      expect(suggestion).toContain('validation');
    });

    test('suggestFix suggests null check for TypeError null', () => {
      const suggestion = agent.suggestFix({ error: 'TypeError: something null' });
      expect(suggestion).toContain('null');
    });

    test('suggestFix provides generic suggestion for unknown', () => {
      const suggestion = agent.suggestFix({ error: 'unknown error' });
      expect(suggestion).toContain('Review');
    });
  });

  describe('Manager Report Generation', () => {
    test('generateManagerReport creates proper structure', () => {
      const results = {
        timestamp: '2024-01-01T00:00:00.000Z',
        platforms: {
          backend: { total: 10, passed: 9, failed: 1, tests: [] }
        },
        summary: {
          status: 'failed',
          totalTests: 10,
          totalPassed: 9,
          totalFailed: 1,
          passRate: '90.00',
          totalDuration: 1000
        }
      };

      const report = agent.generateManagerReport(results);

      expect(report.agentName).toBe('tester-agent');
      expect(report.status).toBe('failure');
      expect(report.summary.totalTests).toBe(10);
      expect(report.platforms).toContain('backend');
    });

    test('generateManagerReport sets success status when passed', () => {
      const results = {
        timestamp: '2024-01-01T00:00:00.000Z',
        platforms: {},
        summary: { status: 'passed', totalTests: 10, totalPassed: 10, totalFailed: 0, passRate: '100.00', totalDuration: 1000 }
      };

      const report = agent.generateManagerReport(results);

      expect(report.status).toBe('success');
    });
  });

  describe('Auto-Fixable Failures Identification', () => {
    test('identifyAutoFixableFailures groups by agent', () => {
      agent.platformAgentMapping.set('backend', 'backend-writer-agent');

      const results = {
        platforms: {
          backend: {
            tests: [
              { name: 'import test', status: 'failed', error: "cannot find module 'utils'" }
            ]
          }
        }
      };

      const autoFixable = agent.identifyAutoFixableFailures(results);

      expect(autoFixable['backend-writer-agent']).toBeDefined();
      expect(autoFixable['backend-writer-agent'].length).toBe(1);
      expect(autoFixable['backend-writer-agent'][0].suggestedFix).toContain('utils');
    });

    test('identifyAutoFixableFailures uses default agent when not mapped', () => {
      const results = {
        platforms: {
          unmapped: {
            tests: [
              { name: 'test', status: 'failed', error: 'myVar is not defined' }
            ]
          }
        }
      };

      const autoFixable = agent.identifyAutoFixableFailures(results);

      expect(autoFixable['default-agent']).toBeDefined();
    });
  });

  describe('Default Platforms', () => {
    test('getDefaultPlatforms returns backend with project root', () => {
      agent.projectRoot = '/my/project';
      const platforms = agent.getDefaultPlatforms();

      expect(platforms.length).toBe(1);
      expect(platforms[0][0]).toBe('backend');
      expect(platforms[0][1].path).toContain('/my/project');
      expect(platforms[0][1].type).toBe('jest');
    });

    test('getDefaultPlatforms respects basePath option', () => {
      const platforms = agent.getDefaultPlatforms({ basePath: '/custom/base' });

      expect(platforms[0][1].path).toContain('/custom/base');
    });
  });

  describe('Platform Tests', () => {
    test('runPlatformTests throws for unregistered platform', async () => {
      await expect(agent.runPlatformTests('unknown'))
        .rejects.toThrow('Platform not registered');
    });

    test('runPlatformTests runs registered platform', async () => {
      // Mock the runner
      const mockResult = { total: 5, passed: 5, failed: 0 };
      agent.runners.backend.runTests = jest.fn().mockResolvedValue(mockResult);

      agent.registerPlatform('api', {
        path: '/path/to/api',
        type: 'jest'
      });

      const result = await agent.runPlatformTests('api');

      expect(agent.runners.backend.runTests).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });
  });

  describe('Failed Tests Extraction', () => {
    test('extractFailedTests returns failed test details', () => {
      const platforms = {
        backend: {
          file: 'test.js',
          tests: [
            { name: 'passing', status: 'passed' },
            { name: 'failing', status: 'failed', error: 'assertion error' }
          ]
        }
      };

      const failed = agent.extractFailedTests(platforms);

      expect(failed.length).toBe(1);
      expect(failed[0].name).toBe('failing');
      expect(failed[0].platform).toBe('backend');
    });

    test('extractFailedTests handles empty results', () => {
      const failed = agent.extractFailedTests({});

      expect(failed).toEqual([]);
    });
  });
});
