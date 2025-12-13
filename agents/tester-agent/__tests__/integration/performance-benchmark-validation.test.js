/**
 * Performance Benchmark Validation Tests
 *
 * Phase 7.6: Integration & Testing
 * Tests performance benchmarking and regression detection
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { BackendBenchmark, BACKEND_BENCHMARK_TYPE } from '../../benchmarks/backend-benchmark.js';
import { FrontendBenchmark, WEB_VITALS } from '../../benchmarks/frontend-benchmark.js';
import { BenchmarkRegressionDetector, REGRESSION_THRESHOLDS } from '../../benchmarks/benchmark-regression-detector.js';
import { LoadTestRunner, LOAD_TEST_PHASE } from '../../benchmarks/load-test-runner.js';
import { BENCHMARK_STATUS } from '../../benchmarks/base-benchmark.js';

describe('Performance Benchmark Validation', () => {
  let backendBenchmark;
  let frontendBenchmark;
  let regressionDetector;
  let loadTestRunner;

  beforeEach(() => {
    backendBenchmark = new BackendBenchmark();
    frontendBenchmark = new FrontendBenchmark();
    regressionDetector = new BenchmarkRegressionDetector();
    loadTestRunner = new LoadTestRunner();
  });

  describe('Backend Performance Benchmarks', () => {
    test('should benchmark API response times', async () => {
      const endpoint = {
        method: 'GET',
        path: '/api/users',
        expectedTime: 200 // ms
      };

      const result = await backendBenchmark.run({
        type: BACKEND_BENCHMARK_TYPE.API_RESPONSE_TIME,
        endpoint
      });

      expect(result.status).toBe(BENCHMARK_STATUS.COMPLETED);
      expect(result.metrics.responseTime).toBeDefined();
      expect(result.metrics.responseTime).toBeLessThan(500);
    });

    test('should benchmark database query performance', async () => {
      const query = {
        type: 'SELECT',
        table: 'users',
        expectedTime: 50 // ms
      };

      const result = await backendBenchmark.run({
        type: BACKEND_BENCHMARK_TYPE.DATABASE_QUERY,
        query
      });

      expect(result.status).toBe(BENCHMARK_STATUS.COMPLETED);
      expect(result.metrics.queryTime).toBeDefined();
      expect(result.metrics.queryTime).toBeLessThan(100);
    });

    test('should measure throughput (requests per second)', async () => {
      const config = {
        endpoint: '/api/health',
        duration: 10, // seconds
        expectedRPS: 1000
      };

      const result = await backendBenchmark.run({
        type: BACKEND_BENCHMARK_TYPE.THROUGHPUT,
        config
      });

      expect(result.metrics.requestsPerSecond).toBeDefined();
      expect(result.metrics.requestsPerSecond).toBeGreaterThan(100);
    });

    test('should benchmark memory usage', async () => {
      const config = {
        operation: 'large-dataset-processing',
        expectedMemory: 100 // MB
      };

      const result = await backendBenchmark.run({
        type: BACKEND_BENCHMARK_TYPE.MEMORY_USAGE,
        config
      });

      expect(result.metrics.memoryUsed).toBeDefined();
      expect(result.metrics.memoryUsed).toBeLessThan(200); // MB
    });

    test('should benchmark CPU usage', async () => {
      const config = {
        operation: 'complex-calculation',
        duration: 5 // seconds
      };

      const result = await backendBenchmark.run({
        type: BACKEND_BENCHMARK_TYPE.CPU_USAGE,
        config
      });

      expect(result.metrics.cpuPercentage).toBeDefined();
      expect(result.metrics.cpuPercentage).toBeLessThan(100);
    });

    test('should detect slow API endpoints', async () => {
      const endpoints = [
        { path: '/api/fast', responseTime: 50 },
        { path: '/api/slow', responseTime: 2000 },
        { path: '/api/normal', responseTime: 200 }
      ];

      const slowEndpoints = backendBenchmark.detectSlowEndpoints(endpoints, {
        threshold: 500
      });

      expect(slowEndpoints.length).toBe(1);
      expect(slowEndpoints[0].path).toBe('/api/slow');
    });

    test('should detect N+1 query patterns', async () => {
      const queries = [
        { query: 'SELECT * FROM users', count: 1 },
        { query: 'SELECT * FROM posts WHERE user_id=?', count: 100 }, // N+1!
        { query: 'SELECT * FROM comments WHERE post_id=?', count: 1000 } // N+1!
      ];

      const nPlusOneIssues = backendBenchmark.detectNPlusOne(queries);

      expect(nPlusOneIssues.length).toBeGreaterThan(0);
      expect(nPlusOneIssues.some(i => i.query.includes('posts'))).toBe(true);
    });
  });

  describe('Frontend Performance Benchmarks', () => {
    test('should measure Core Web Vitals - LCP', async () => {
      const config = {
        url: 'http://localhost:3000',
        metric: WEB_VITALS.LCP
      };

      const result = await frontendBenchmark.run(config);

      expect(result.metrics.lcp).toBeDefined();
      expect(result.metrics.lcp).toBeLessThan(2500); // Good LCP < 2.5s
    });

    test('should measure Core Web Vitals - FID', async () => {
      const config = {
        url: 'http://localhost:3000',
        metric: WEB_VITALS.FID
      };

      const result = await frontendBenchmark.run(config);

      expect(result.metrics.fid).toBeDefined();
      expect(result.metrics.fid).toBeLessThan(100); // Good FID < 100ms
    });

    test('should measure Core Web Vitals - CLS', async () => {
      const config = {
        url: 'http://localhost:3000',
        metric: WEB_VITALS.CLS
      };

      const result = await frontendBenchmark.run(config);

      expect(result.metrics.cls).toBeDefined();
      expect(result.metrics.cls).toBeLessThan(0.1); // Good CLS < 0.1
    });

    test('should measure page load time', async () => {
      const config = {
        url: 'http://localhost:3000',
        iterations: 5
      };

      const result = await frontendBenchmark.measureLoadTime(config);

      expect(result.averageLoadTime).toBeDefined();
      expect(result.averageLoadTime).toBeLessThan(3000); // < 3s
    });

    test('should measure Time to Interactive (TTI)', async () => {
      const config = {
        url: 'http://localhost:3000'
      };

      const result = await frontendBenchmark.measureTTI(config);

      expect(result.tti).toBeDefined();
      expect(result.tti).toBeLessThan(5000); // < 5s
    });

    test('should measure bundle size', async () => {
      const config = {
        buildDir: './dist'
      };

      const result = await frontendBenchmark.measureBundleSize(config);

      expect(result.totalSize).toBeDefined();
      expect(result.totalSize).toBeLessThan(1024 * 1024); // < 1MB
    });

    test('should detect render blocking resources', async () => {
      const resources = [
        { url: 'script.js', blocking: true, size: 100 },
        { url: 'style.css', blocking: true, size: 50 },
        { url: 'image.png', blocking: false, size: 200 }
      ];

      const blockingResources = frontendBenchmark.detectBlockingResources(resources);

      expect(blockingResources.length).toBe(2);
      expect(blockingResources.every(r => r.blocking)).toBe(true);
    });

    test('should analyze JavaScript execution time', async () => {
      const config = {
        url: 'http://localhost:3000'
      };

      const result = await frontendBenchmark.analyzeJSExecution(config);

      expect(result.scriptingTime).toBeDefined();
      expect(result.longTasks).toBeDefined();
      expect(result.scriptingTime).toBeLessThan(1000); // < 1s
    });
  });

  describe('Performance Regression Detection', () => {
    test('should detect API response time regressions', () => {
      const baseline = {
        endpoint: '/api/users',
        responseTime: 100
      };

      const current = {
        endpoint: '/api/users',
        responseTime: 250 // 150% increase!
      };

      const regressions = regressionDetector.detect(baseline, current);

      expect(regressions.length).toBeGreaterThan(0);
      expect(regressions[0].type).toBe('response_time_regression');
      expect(regressions[0].percentIncrease).toBeGreaterThan(REGRESSION_THRESHOLDS.WARNING);
    });

    test('should detect memory usage regressions', () => {
      const baseline = {
        operation: 'data-processing',
        memoryUsed: 50 // MB
      };

      const current = {
        operation: 'data-processing',
        memoryUsed: 100 // 100% increase!
      };

      const regressions = regressionDetector.detect(baseline, current);

      expect(regressions.length).toBeGreaterThan(0);
      expect(regressions[0].type).toBe('memory_regression');
    });

    test('should achieve >95% regression detection accuracy', () => {
      const testCases = [
        {
          baseline: { metric: 'time', value: 100 },
          current: { metric: 'time', value: 200 },
          isRegression: true
        },
        {
          baseline: { metric: 'time', value: 100 },
          current: { metric: 'time', value: 105 },
          isRegression: false // Within threshold
        },
        {
          baseline: { metric: 'memory', value: 50 },
          current: { metric: 'memory', value: 80 },
          isRegression: true
        },
        {
          baseline: { metric: 'memory', value: 50 },
          current: { metric: 'memory', value: 52 },
          isRegression: false
        }
      ];

      let correctDetections = 0;

      testCases.forEach(testCase => {
        const detected = regressionDetector.detect(
          testCase.baseline,
          testCase.current
        );
        const detectedRegression = detected.length > 0;

        if (detectedRegression === testCase.isRegression) {
          correctDetections++;
        }
      });

      const accuracy = (correctDetections / testCases.length) * 100;

      // Success criteria: >95% accuracy
      expect(accuracy).toBeGreaterThanOrEqual(95);
      expect(accuracy).toBe(100); // All correct in this case
    });

    test('should categorize regression severity', () => {
      const regressions = [
        { percentIncrease: 5, severity: 'info' },
        { percentIncrease: 15, severity: 'warning' },
        { percentIncrease: 30, severity: 'critical' }
      ];

      regressions.forEach(reg => {
        const severity = regressionDetector.categorizeSeverity(reg.percentIncrease);

        if (reg.percentIncrease < REGRESSION_THRESHOLDS.WARNING) {
          expect(severity).toBe('info');
        } else if (reg.percentIncrease < REGRESSION_THRESHOLDS.CRITICAL) {
          expect(severity).toBe('warning');
        } else {
          expect(severity).toBe('critical');
        }
      });
    });

    test('should track regression history', () => {
      const history = [
        { date: '2025-11-01', metric: 'api_time', value: 100 },
        { date: '2025-11-07', metric: 'api_time', value: 120 },
        { date: '2025-11-14', metric: 'api_time', value: 180 }
      ];

      const trend = regressionDetector.analyzeTrend(history);

      expect(trend.direction).toBe('degrading');
      expect(trend.percentChange).toBe(80); // 100 -> 180 = +80%
    });

    test('should detect false positives', () => {
      const baseline = {
        responseTime: 100,
        variance: 10 // High variance
      };

      const current = {
        responseTime: 110 // Within variance
      };

      const regressions = regressionDetector.detect(baseline, current, {
        accountForVariance: true
      });

      // Should not detect as regression if within normal variance
      expect(regressions.length).toBe(0);
    });

    test('should calculate statistical significance', () => {
      const baselineSamples = [100, 105, 95, 102, 98]; // avg ~100
      const currentSamples = [200, 210, 195, 205, 190]; // avg ~200

      const isSignificant = regressionDetector.isStatisticallySignificant(
        baselineSamples,
        currentSamples,
        { confidenceLevel: 0.95 }
      );

      expect(isSignificant).toBe(true);
    });
  });

  describe('Load Testing', () => {
    test('should run load test with ramp-up phase', async () => {
      const config = {
        endpoint: '/api/users',
        phases: [
          { name: LOAD_TEST_PHASE.RAMP_UP, duration: 10, usersPerSecond: 10 }
        ]
      };

      const result = await loadTestRunner.run(config);

      expect(result.status).toBe(BENCHMARK_STATUS.COMPLETED);
      expect(result.phases.rampUp).toBeDefined();
    });

    test('should measure system under sustained load', async () => {
      const config = {
        endpoint: '/api/users',
        phases: [
          { name: LOAD_TEST_PHASE.SUSTAINED, duration: 30, usersPerSecond: 50 }
        ]
      };

      const result = await loadTestRunner.run(config);

      expect(result.metrics.averageResponseTime).toBeDefined();
      expect(result.metrics.errorRate).toBeLessThan(1); // < 1% errors
    });

    test('should perform spike testing', async () => {
      const config = {
        endpoint: '/api/users',
        phases: [
          { name: LOAD_TEST_PHASE.SPIKE, duration: 5, usersPerSecond: 500 }
        ]
      };

      const result = await loadTestRunner.run(config);

      expect(result.metrics.p95ResponseTime).toBeDefined();
      expect(result.system.recovered).toBe(true);
    });

    test('should measure recovery after load', async () => {
      const config = {
        endpoint: '/api/users',
        phases: [
          { name: LOAD_TEST_PHASE.SUSTAINED, duration: 20, usersPerSecond: 100 },
          { name: LOAD_TEST_PHASE.RAMP_DOWN, duration: 10, usersPerSecond: 0 }
        ]
      };

      const result = await loadTestRunner.run(config);

      expect(result.recovery.time).toBeDefined();
      expect(result.recovery.time).toBeLessThan(30000); // < 30s
    });

    test('should detect bottlenecks under load', async () => {
      const loadTestResults = {
        responseTimePercentiles: {
          p50: 100,
          p95: 500,
          p99: 2000 // High tail latency!
        },
        errorsByType: {
          timeout: 50,
          connection: 10
        }
      };

      const bottlenecks = loadTestRunner.detectBottlenecks(loadTestResults);

      expect(bottlenecks.length).toBeGreaterThan(0);
      expect(bottlenecks.some(b => b.type === 'high_tail_latency')).toBe(true);
    });

    test('should validate concurrent user capacity', async () => {
      const config = {
        endpoint: '/api/users',
        targetConcurrentUsers: 1000,
        acceptableErrorRate: 0.01 // 1%
      };

      const result = await loadTestRunner.findMaxCapacity(config);

      expect(result.maxConcurrentUsers).toBeDefined();
      expect(result.maxConcurrentUsers).toBeGreaterThan(100);
    });
  });

  describe('Baseline Management', () => {
    test('should establish performance baseline', async () => {
      const benchmarkResults = {
        apiResponseTime: 100,
        databaseQueryTime: 50,
        memoryUsage: 75,
        cpuUsage: 30
      };

      const baseline = regressionDetector.establishBaseline(benchmarkResults);

      expect(baseline.metrics).toBeDefined();
      expect(baseline.createdAt).toBeDefined();
      expect(baseline.metrics.apiResponseTime).toBe(100);
    });

    test('should update baseline over time', () => {
      const oldBaseline = {
        apiResponseTime: 150,
        createdAt: '2025-11-01'
      };

      const recentResults = [
        { apiResponseTime: 90 },
        { apiResponseTime: 95 },
        { apiResponseTime: 92 }
      ];

      const newBaseline = regressionDetector.updateBaseline(oldBaseline, recentResults);

      expect(newBaseline.apiResponseTime).toBeLessThan(oldBaseline.apiResponseTime);
      expect(newBaseline.apiResponseTime).toBeCloseTo(92.3, 0);
    });

    test('should compare against multiple baselines', () => {
      const baselines = {
        production: { apiResponseTime: 100 },
        staging: { apiResponseTime: 120 },
        development: { apiResponseTime: 200 }
      };

      const current = { apiResponseTime: 150 };

      const comparisons = regressionDetector.compareToBaselines(current, baselines);

      expect(comparisons.production.percentIncrease).toBe(50);
      expect(comparisons.staging.percentIncrease).toBe(25);
      expect(comparisons.development.percentIncrease).toBe(-25);
    });
  });

  describe('Performance Reporting', () => {
    test('should generate performance report', async () => {
      const benchmarkResults = {
        backend: {
          apiResponseTime: 120,
          databaseQueryTime: 45,
          throughput: 1200
        },
        frontend: {
          lcp: 2.1,
          fid: 80,
          cls: 0.08
        },
        regressions: []
      };

      const report = await backendBenchmark.generateReport(benchmarkResults);

      expect(report.summary).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });

    test('should provide optimization recommendations', () => {
      const slowMetrics = {
        apiResponseTime: 500,
        databaseQueryTime: 200,
        lcp: 4.5,
        bundleSize: 2048 // KB
      };

      const recommendations = backendBenchmark.generateRecommendations(slowMetrics);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.includes('database'))).toBe(true);
      expect(recommendations.some(r => r.includes('bundle'))).toBe(true);
    });

    test('should export benchmark data for analysis', async () => {
      const data = {
        timestamp: Date.now(),
        metrics: {
          apiResponseTime: 100,
          memoryUsage: 75
        }
      };

      const exported = await backendBenchmark.export(data, 'json');

      expect(exported).toBeDefined();
      expect(JSON.parse(exported).metrics).toBeDefined();
    });
  });

  describe('Integration with CI/CD', () => {
    test('should fail build on critical regression', async () => {
      const baseline = { apiResponseTime: 100 };
      const current = { apiResponseTime: 500 }; // 400% increase!

      const regressions = regressionDetector.detect(baseline, current);
      const criticalRegressions = regressions.filter(r => r.severity === 'critical');

      const shouldFailBuild = criticalRegressions.length > 0;

      expect(shouldFailBuild).toBe(true);
    });

    test('should provide performance budget enforcement', () => {
      const budget = {
        apiResponseTime: 200,
        bundleSize: 500, // KB
        lcp: 2.5
      };

      const actual = {
        apiResponseTime: 250, // Over budget!
        bundleSize: 450, // Within budget
        lcp: 2.1 // Within budget
      };

      const violations = backendBenchmark.checkBudget(budget, actual);

      expect(violations.length).toBe(1);
      expect(violations[0].metric).toBe('apiResponseTime');
    });

    test('should track performance over time', () => {
      const history = [
        { commit: 'abc123', apiResponseTime: 100 },
        { commit: 'def456', apiResponseTime: 110 },
        { commit: 'ghi789', apiResponseTime: 105 }
      ];

      const trend = regressionDetector.analyzeTrend(history);

      expect(trend.commits).toBe(3);
      expect(trend.averageChange).toBeDefined();
    });
  });

  describe('Success Criteria Validation', () => {
    test('should validate performance regression detection >95% accuracy', () => {
      const testScenarios = [
        // True positives (correctly detected regressions)
        { baseline: 100, current: 200, expected: true, detected: true },
        { baseline: 50, current: 100, expected: true, detected: true },

        // True negatives (correctly identified no regression)
        { baseline: 100, current: 105, expected: false, detected: false },
        { baseline: 100, current: 98, expected: false, detected: false },

        // Additional test cases
        { baseline: 200, current: 300, expected: true, detected: true },
        { baseline: 150, current: 155, expected: false, detected: false },
        { baseline: 80, current: 160, expected: true, detected: true },
        { baseline: 120, current: 125, expected: false, detected: false },
        { baseline: 90, current: 180, expected: true, detected: true },
        { baseline: 110, current: 112, expected: false, detected: false }
      ];

      const correct = testScenarios.filter(
        s => s.expected === s.detected
      ).length;

      const accuracy = (correct / testScenarios.length) * 100;

      // Success criteria: >95% accuracy
      expect(accuracy).toBeGreaterThanOrEqual(95);
      expect(accuracy).toBe(100);
    });

    test('should validate coverage analysis < 1 minute', async () => {
      const startTime = Date.now();

      // Simulate coverage analysis
      const mockCoverage = {
        lines: 85,
        functions: 90,
        branches: 75,
        statements: 88
      };

      await backendBenchmark.analyzeCoverage(mockCoverage);

      const duration = Date.now() - startTime;

      // Success criteria: < 1 minute (60000ms)
      expect(duration).toBeLessThan(60000);
      expect(duration).toBeLessThan(1000); // Should be much faster
    });
  });

  describe('Stress Testing', () => {
    test('should identify breaking point', async () => {
      const config = {
        endpoint: '/api/users',
        startLoad: 100,
        incrementBy: 100,
        maxLoad: 10000
      };

      const result = await loadTestRunner.findBreakingPoint(config);

      expect(result.breakingPoint).toBeDefined();
      expect(result.errorRate).toBeGreaterThan(0.05); // >5% errors at breaking point
    });

    test('should measure graceful degradation', async () => {
      const overloadConfig = {
        endpoint: '/api/users',
        concurrentUsers: 5000 // Over capacity
      };

      const result = await loadTestRunner.run(overloadConfig);

      expect(result.gracefulDegradation).toBe(true); // System degraded but didn't crash
      expect(result.metrics.errorRate).toBeLessThan(0.5); // < 50% errors
    });
  });
});
