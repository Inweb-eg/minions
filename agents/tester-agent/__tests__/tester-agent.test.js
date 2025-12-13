/**
 * Tester Agent - Integration Tests
 *
 * Phase 7.1: Smart Test Runners
 * Tests main orchestrator and test runner integration
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { TesterAgent, getTesterAgent } from '../tester-agent.js';
import { TEST_STATUS, TEST_PRIORITY } from '../runners/base-test-runner.js';

describe('TesterAgent', () => {
  let agent;

  beforeEach(() => {
    agent = new TesterAgent();
  });

  describe('Initialization', () => {
    it('should create agent instance', () => {
      expect(agent).toBeInstanceOf(TesterAgent);
    });

    it('should have all test runners', () => {
      expect(agent.runners).toHaveProperty('backend');
      expect(agent.runners).toHaveProperty('flutter');
      expect(agent.runners).toHaveProperty('react');
      expect(agent.runners).toHaveProperty('e2e');
    });

    it('should have separate Flutter runners for users and drivers', () => {
      expect(agent.runners.flutter).toHaveProperty('users');
      expect(agent.runners.flutter).toHaveProperty('drivers');
    });

    it('should return singleton instance', () => {
      const instance1 = getTesterAgent();
      const instance2 = getTesterAgent();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Summary Generation', () => {
    it('should generate summary with no results', () => {
      const summary = agent.generateSummary({});

      expect(summary.totalTests).toBe(0);
      expect(summary.totalPassed).toBe(0);
      expect(summary.totalFailed).toBe(0);
      expect(summary.platformCount).toBe(0);
      expect(summary.passRate).toBe(0);
      expect(summary.status).toBe('passed');
    });

    it('should generate summary with passing tests', () => {
      const platforms = {
        backend: {
          total: 10,
          passed: 10,
          failed: 0,
          skipped: 0,
          duration: 5000
        },
        react: {
          total: 5,
          passed: 5,
          failed: 0,
          skipped: 0,
          duration: 3000
        }
      };

      const summary = agent.generateSummary(platforms);

      expect(summary.totalTests).toBe(15);
      expect(summary.totalPassed).toBe(15);
      expect(summary.totalFailed).toBe(0);
      expect(summary.platformCount).toBe(2);
      expect(summary.passRate).toBe('100.00');
      expect(summary.status).toBe('passed');
      expect(summary.totalDuration).toBe(8000);
    });

    it('should generate summary with failing tests', () => {
      const platforms = {
        backend: {
          total: 10,
          passed: 8,
          failed: 2,
          skipped: 0,
          duration: 5000
        },
        react: {
          total: 5,
          passed: 4,
          failed: 1,
          skipped: 0,
          duration: 3000
        }
      };

      const summary = agent.generateSummary(platforms);

      expect(summary.totalTests).toBe(15);
      expect(summary.totalPassed).toBe(12);
      expect(summary.totalFailed).toBe(3);
      expect(summary.platformCount).toBe(2);
      expect(summary.passRate).toBe('80.00');
      expect(summary.status).toBe('failed');
    });

    it('should handle platforms with errors', () => {
      const platforms = {
        backend: {
          total: 10,
          passed: 10,
          failed: 0,
          skipped: 0,
          duration: 5000
        },
        react: {
          error: 'Failed to run tests'
        }
      };

      const summary = agent.generateSummary(platforms);

      expect(summary.totalTests).toBe(10);
      expect(summary.platformCount).toBe(1);
    });
  });

  describe('Failed Tests Extraction', () => {
    it('should extract failed tests from platforms', () => {
      const platforms = {
        backend: {
          file: 'backend/test.js',
          tests: [
            { name: 'test 1', status: TEST_STATUS.PASSED },
            { name: 'test 2', status: TEST_STATUS.FAILED, error: 'assertion failed' },
            { name: 'test 3', status: TEST_STATUS.PASSED }
          ]
        },
        react: {
          file: 'react/test.jsx',
          tests: [
            { name: 'test 4', status: TEST_STATUS.FAILED, error: 'component error' }
          ]
        }
      };

      const failed = agent.extractFailedTests(platforms);

      expect(failed).toHaveLength(2);
      expect(failed[0].platform).toBe('backend');
      expect(failed[0].name).toBe('test 2');
      expect(failed[0].error).toBe('assertion failed');
      expect(failed[1].platform).toBe('react');
      expect(failed[1].name).toBe('test 4');
    });

    it('should return empty array with no failures', () => {
      const platforms = {
        backend: {
          tests: [
            { name: 'test 1', status: TEST_STATUS.PASSED },
            { name: 'test 2', status: TEST_STATUS.PASSED }
          ]
        }
      };

      const failed = agent.extractFailedTests(platforms);

      expect(failed).toHaveLength(0);
    });
  });

  describe('Manager Report', () => {
    it('should generate manager-compatible report', () => {
      const results = {
        timestamp: '2025-01-01T00:00:00.000Z',
        platforms: {
          backend: {
            total: 10,
            passed: 10,
            failed: 0,
            tests: []
          }
        },
        summary: {
          status: 'passed',
          totalTests: 10,
          totalPassed: 10,
          totalFailed: 0,
          passRate: '100.00',
          totalDuration: 5000
        }
      };

      const report = agent.generateManagerReport(results);

      expect(report.agentName).toBe('tester-agent');
      expect(report.status).toBe('success');
      expect(report.summary.totalTests).toBe(10);
      expect(report.summary.passed).toBe(10);
      expect(report.summary.failed).toBe(0);
      expect(report.platforms).toContain('backend');
      expect(report.timestamp).toBe('2025-01-01T00:00:00.000Z');
    });

    it('should set failure status for failed tests', () => {
      const results = {
        timestamp: '2025-01-01T00:00:00.000Z',
        platforms: {
          backend: {
            total: 10,
            passed: 8,
            failed: 2,
            tests: []
          }
        },
        summary: {
          status: 'failed',
          totalTests: 10,
          totalPassed: 8,
          totalFailed: 2,
          passRate: '80.00',
          totalDuration: 5000
        }
      };

      const report = agent.generateManagerReport(results);

      expect(report.status).toBe('failure');
    });
  });

  describe('Summary Formatting', () => {
    it('should format summary correctly', () => {
      const summary = {
        status: 'passed',
        platformCount: 3,
        totalTests: 50,
        totalPassed: 48,
        totalFailed: 2,
        totalSkipped: 0,
        passRate: '96.00',
        totalDuration: 15000
      };

      const formatted = agent.formatSummary(summary);

      expect(formatted).toContain('TEST SUMMARY');
      expect(formatted).toContain('✅ PASSED');
      expect(formatted).toContain('Platforms: 3');
      expect(formatted).toContain('Total Tests: 50');
      expect(formatted).toContain('Passed:  48');
      expect(formatted).toContain('Failed:  2');
      expect(formatted).toContain('Pass Rate: 96.00%');
      expect(formatted).toContain('Duration: 15.00s');
    });

    it('should show failed status', () => {
      const summary = {
        status: 'failed',
        platformCount: 2,
        totalTests: 20,
        totalPassed: 15,
        totalFailed: 5,
        totalSkipped: 0,
        passRate: '75.00',
        totalDuration: 10000
      };

      const formatted = agent.formatSummary(summary);

      expect(formatted).toContain('❌ FAILED');
    });
  });

  describe('Constants Export', () => {
    it('should export TEST_STATUS constants', () => {
      expect(TEST_STATUS.PASSED).toBe('passed');
      expect(TEST_STATUS.FAILED).toBe('failed');
      expect(TEST_STATUS.SKIPPED).toBe('skipped');
      expect(TEST_STATUS.PENDING).toBe('pending');
      expect(TEST_STATUS.RUNNING).toBe('running');
    });

    it('should export TEST_PRIORITY constants', () => {
      expect(TEST_PRIORITY.CRITICAL).toBe('critical');
      expect(TEST_PRIORITY.HIGH).toBe('high');
      expect(TEST_PRIORITY.MEDIUM).toBe('medium');
      expect(TEST_PRIORITY.LOW).toBe('low');
    });
  });
});
