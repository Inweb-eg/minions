/**
 * Tester Agent - Main Entry Point
 *
 * Phase 7: Tester-Agent
 * Multi-platform test runner, generator, analyzer, benchmarking, and reporting
 *
 * Exports:
 * - Main TesterAgent orchestrator
 * - Individual test runners
 * - Test generators
 * - Test analyzers
 * - Performance benchmarks
 * - Report generators
 * - Mock generator
 * - Utilities
 */

export { TesterAgent, getTesterAgent, main } from './tester-agent.js';

// Test Runners
export { BackendTestRunner, getBackendTestRunner } from './runners/backend-test-runner.js';
export { FlutterTestRunner, getFlutterTestRunner } from './runners/flutter-test-runner.js';
export { ReactTestRunner, getReactTestRunner } from './runners/react-test-runner.js';
export { E2ETestRunner, getE2ETestRunner } from './runners/e2e-test-runner.js';
export { BaseTestRunner, TEST_STATUS, TEST_PRIORITY } from './runners/base-test-runner.js';

// Test Generators
export { BackendTestGenerator, getBackendTestGenerator } from './generators/backend-test-generator.js';
export { ReactTestGenerator, getReactTestGenerator } from './generators/react-test-generator.js';
export { BaseTestGenerator, TEST_TYPE, EDGE_CASE } from './generators/base-test-generator.js';

// Mock Generator
export { MockGenerator, getMockGenerator, MOCK_TYPE } from './generators/mock-generator.js';

// Test Analyzers
export { CoverageAnalyzer, getCoverageAnalyzer, COVERAGE_THRESHOLDS, GAP_TYPE } from './analyzers/coverage-analyzer.js';
export { RegressionDetector, getRegressionDetector, REGRESSION_TYPE } from './analyzers/regression-detector.js';
export { FlakyTestDetector, getFlakyTestDetector, FLAKINESS_PATTERN } from './analyzers/flaky-test-detector.js';
export { PerformanceAnalyzer, getPerformanceAnalyzer, PERFORMANCE_ISSUE, PERFORMANCE_THRESHOLDS } from './analyzers/performance-analyzer.js';
export { MutationEngine, getMutationEngine, MUTATION_OPERATOR, MUTANT_STATUS } from './analyzers/mutation-engine.js';
export { TestQualityAnalyzer, getTestQualityAnalyzer, QUALITY_GRADE, QUALITY_METRIC } from './analyzers/test-quality-analyzer.js';
export { BaseAnalyzer, ANALYSIS_STATUS, SEVERITY } from './analyzers/base-analyzer.js';

// Performance Benchmarks
export { BackendBenchmark, getBackendBenchmark, BACKEND_BENCHMARK_TYPE } from './benchmarks/backend-benchmark.js';
export { FrontendBenchmark, getFrontendBenchmark, FRONTEND_BENCHMARK_TYPE, WEB_VITALS } from './benchmarks/frontend-benchmark.js';
export { BenchmarkRegressionDetector, getBenchmarkRegressionDetector, REGRESSION_THRESHOLDS } from './benchmarks/benchmark-regression-detector.js';
export { LoadTestRunner, getLoadTestRunner, LOAD_TEST_PHASE } from './benchmarks/load-test-runner.js';
export { BaseBenchmark, BENCHMARK_STATUS, METRIC_TYPE, PERFORMANCE_BASELINE } from './benchmarks/base-benchmark.js';

// Report Generators
export { TestReportGenerator, getTestReportGenerator } from './reports/test-report-generator.js';
export { CoverageReportGenerator, getCoverageReportGenerator } from './reports/coverage-report-generator.js';
export { PerformanceReportGenerator, getPerformanceReportGenerator } from './reports/performance-report-generator.js';
export { BugReportGenerator, getBugReportGenerator, BUG_SEVERITY } from './reports/bug-report-generator.js';
export { FixSuggestionGenerator, getFixSuggestionGenerator, FIX_CONFIDENCE, FIX_TYPE } from './reports/fix-suggestion-generator.js';
export { BaseReportGenerator, REPORT_FORMAT, REPORT_TYPE } from './reports/base-report-generator.js';

// Utilities
export { createLogger } from './utils/logger.js';
