/**
 * Benchmark Regression Detector - Performance Regression Detection
 *
 * Phase 7.4: Performance & Benchmarking
 * Detects performance regressions by comparing benchmark results over time
 */

import { BaseAnalyzer, ANALYSIS_STATUS, SEVERITY } from '../analyzers/base-analyzer.js';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Regression severity thresholds
 */
export const REGRESSION_THRESHOLDS = {
  MINOR: 1.1,      // 10% slower
  MODERATE: 1.25,  // 25% slower
  MAJOR: 1.5,      // 50% slower
  CRITICAL: 2.0    // 100% slower (2x)
};

/**
 * BenchmarkRegressionDetector
 * Detects performance regressions in benchmark results
 */
export class BenchmarkRegressionDetector extends BaseAnalyzer {
  constructor() {
    super('BenchmarkRegressionDetector', 'benchmark_regression');
    this.historyPath = '.benchmark-history';
    this.maxHistorySize = 30; // Keep last 30 runs
  }

  /**
   * Analyze benchmarks for regressions
   * @param {Object} input - Current benchmark results
   * @param {Object} options - Options
   * @returns {Promise<Object>} Analysis result
   */
  async analyze(input, options = {}) {
    this.startAnalysis();

    try {
      const {
        results,
        runId = this.generateRunId(),
        historyPath = this.historyPath,
        thresholds = REGRESSION_THRESHOLDS
      } = input;

      this.historyPath = historyPath;

      // Load history
      const history = this.loadHistory();

      // Add current results to history
      const historyEntry = {
        runId,
        timestamp: new Date().toISOString(),
        results: this.normalizeResults(results)
      };

      history.push(historyEntry);

      // Trim history if too large
      if (history.length > this.maxHistorySize) {
        history.shift();
      }

      // Save updated history
      this.saveHistory(history);

      // Detect regressions
      const regressions = this.detectRegressions(history, thresholds, options);

      // Analyze trends
      const trends = this.analyzeTrends(history);

      // Compare with baseline
      const baselineComparison = options.baseline
        ? this.compareWithBaseline(results, options.baseline, thresholds)
        : null;

      const duration = this.endAnalysis();

      return {
        success: true,
        regressions,
        trends,
        baselineComparison,
        history: history.length,
        duration
      };
    } catch (error) {
      this.logger.error(`Regression detection failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate unique run ID
   * @returns {string} Run ID
   */
  generateRunId() {
    return `bench-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Normalize benchmark results
   * @param {Object|Array} results - Benchmark results
   * @returns {Object} Normalized results
   */
  normalizeResults(results) {
    const normalized = {
      metrics: {},
      summary: {}
    };

    // Handle different result formats
    if (results.metrics) {
      // Already in correct format
      normalized.metrics = results.metrics;
      normalized.summary = results.summary || {};
    } else if (results.summary && results.summary.metrics) {
      // Summary format
      normalized.metrics = results.summary.metrics;
      normalized.summary = results.summary;
    }

    return normalized;
  }

  /**
   * Load benchmark history
   * @returns {Array} History entries
   */
  loadHistory() {
    const historyFile = path.join(this.historyPath, 'benchmark-history.json');

    if (!fs.existsSync(historyFile)) {
      this.logger.info('No benchmark history found, starting fresh');
      return [];
    }

    const history = this.readJSON(historyFile);
    if (!history || !Array.isArray(history)) {
      this.logger.warn('Invalid history format, starting fresh');
      return [];
    }

    this.logger.info(`Loaded ${history.length} historical benchmark runs`);
    return history;
  }

  /**
   * Save benchmark history
   * @param {Array} history - History entries
   * @returns {boolean} Success
   */
  saveHistory(history) {
    const historyFile = path.join(this.historyPath, 'benchmark-history.json');

    // Ensure directory exists
    if (!fs.existsSync(this.historyPath)) {
      fs.mkdirSync(this.historyPath, { recursive: true });
    }

    return this.writeJSON(historyFile, history);
  }

  /**
   * Detect regressions in benchmark history
   * @param {Array} history - Benchmark history
   * @param {Object} thresholds - Regression thresholds
   * @param {Object} options - Options
   * @returns {Array} Detected regressions
   */
  detectRegressions(history, thresholds, options = {}) {
    if (history.length < 2) {
      this.logger.info('Not enough history for regression detection');
      return [];
    }

    const regressions = [];
    const current = history[history.length - 1];
    const previous = history[history.length - 2];

    // Compare metrics
    const currentMetrics = current.results.metrics || {};
    const previousMetrics = previous.results.metrics || {};

    Object.keys(currentMetrics).forEach(metricName => {
      const currentStats = currentMetrics[metricName];
      const previousStats = previousMetrics[metricName];

      if (!currentStats || !previousStats) {
        return;
      }

      // Compare average values
      const currentAvg = currentStats.avg;
      const previousAvg = previousStats.avg;

      if (!currentAvg || !previousAvg) {
        return;
      }

      // Calculate regression ratio
      const ratio = currentAvg / previousAvg;

      // Check if regression occurred
      if (ratio > thresholds.MINOR) {
        const severity = this.calculateRegressionSeverity(ratio, thresholds);

        const regression = {
          metric: metricName,
          previousValue: previousAvg,
          currentValue: currentAvg,
          ratio,
          percentIncrease: ((ratio - 1) * 100).toFixed(2),
          severity,
          previousRun: previous.runId,
          currentRun: current.runId,
          timestamp: current.timestamp
        };

        regressions.push(regression);

        this.logResult(
          `Performance regression detected: ${metricName} increased by ${regression.percentIncrease}%`,
          ANALYSIS_STATUS.WARNING,
          severity,
          regression
        );
      }
    });

    this.logger.info(`Detected ${regressions.length} performance regressions`);
    return regressions;
  }

  /**
   * Calculate regression severity
   * @param {number} ratio - Regression ratio
   * @param {Object} thresholds - Thresholds
   * @returns {string} Severity
   */
  calculateRegressionSeverity(ratio, thresholds) {
    if (ratio >= thresholds.CRITICAL) return SEVERITY.CRITICAL;
    if (ratio >= thresholds.MAJOR) return SEVERITY.HIGH;
    if (ratio >= thresholds.MODERATE) return SEVERITY.MEDIUM;
    return SEVERITY.LOW;
  }

  /**
   * Analyze trends in benchmark results
   * @param {Array} history - Benchmark history
   * @returns {Object} Trend analysis
   */
  analyzeTrends(history) {
    if (history.length < 3) {
      return { insufficient_data: true };
    }

    const trends = {};

    // Analyze last 5 runs
    const recentHistory = history.slice(-5);

    // Get all metric names
    const allMetrics = new Set();
    recentHistory.forEach(entry => {
      Object.keys(entry.results.metrics || {}).forEach(metric => {
        allMetrics.add(metric);
      });
    });

    // Analyze each metric
    allMetrics.forEach(metricName => {
      const values = [];

      recentHistory.forEach(entry => {
        const metricStats = entry.results.metrics?.[metricName];
        if (metricStats && metricStats.avg) {
          values.push(metricStats.avg);
        }
      });

      if (values.length >= 3) {
        trends[metricName] = {
          direction: this.calculateTrendDirection(values),
          values,
          changePercent: this.calculateTotalChange(values)
        };
      }
    });

    return trends;
  }

  /**
   * Calculate trend direction
   * @param {Array} values - Metric values
   * @returns {string} Trend direction
   */
  calculateTrendDirection(values) {
    if (values.length < 2) return 'stable';

    const first = values[0];
    const last = values[values.length - 1];
    const change = ((last - first) / first) * 100;

    if (Math.abs(change) < 5) return 'stable';
    if (change > 0) return 'degrading';  // Higher values = worse performance
    return 'improving';
  }

  /**
   * Calculate total change percentage
   * @param {Array} values - Values
   * @returns {number} Change percentage
   */
  calculateTotalChange(values) {
    if (values.length < 2) return 0;

    const first = values[0];
    const last = values[values.length - 1];

    return ((last - first) / first) * 100;
  }

  /**
   * Compare with baseline
   * @param {Object} results - Current results
   * @param {Object} baseline - Baseline results
   * @param {Object} thresholds - Thresholds
   * @returns {Object} Comparison
   */
  compareWithBaseline(results, baseline, thresholds) {
    const comparison = {
      metrics: {},
      summary: {
        total: 0,
        regressions: 0,
        improvements: 0,
        stable: 0
      }
    };

    const currentMetrics = results.metrics || {};
    const baselineMetrics = baseline.metrics || {};

    Object.keys(currentMetrics).forEach(metricName => {
      const current = currentMetrics[metricName];
      const base = baselineMetrics[metricName];

      if (!current || !base || !current.avg || !base.avg) {
        return;
      }

      const ratio = current.avg / base.avg;
      const percentChange = ((ratio - 1) * 100).toFixed(2);

      let status = 'stable';
      let severity = SEVERITY.INFO;

      if (ratio > thresholds.MINOR) {
        status = 'regression';
        severity = this.calculateRegressionSeverity(ratio, thresholds);
        comparison.summary.regressions++;
      } else if (ratio < 0.9) {  // 10% improvement
        status = 'improvement';
        comparison.summary.improvements++;
      } else {
        comparison.summary.stable++;
      }

      comparison.summary.total++;

      comparison.metrics[metricName] = {
        baseline: base.avg,
        current: current.avg,
        ratio,
        percentChange,
        status,
        severity
      };
    });

    return comparison;
  }

  /**
   * Get regression summary
   * @param {Array} regressions - Regressions
   * @returns {Object} Summary
   */
  getRegressionSummary(regressions) {
    const summary = {
      total: regressions.length,
      bySeverity: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      },
      mostSevere: []
    };

    regressions.forEach(regression => {
      summary.bySeverity[regression.severity]++;
    });

    // Get top 5 most severe
    summary.mostSevere = regressions
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 5);

    return summary;
  }

  /**
   * Clear history
   */
  clearHistory() {
    const historyFile = path.join(this.historyPath, 'benchmark-history.json');
    if (fs.existsSync(historyFile)) {
      fs.unlinkSync(historyFile);
      this.logger.info('Benchmark history cleared');
    }
  }

  /**
   * Categorize regression severity
   * @param {number} percentIncrease - Percent increase
   * @returns {string} Severity level
   */
  categorizeSeverity(percentIncrease) {
    if (percentIncrease >= REGRESSION_THRESHOLDS.CRITICAL) {
      return 'critical';
    } else if (percentIncrease >= REGRESSION_THRESHOLDS.WARNING) {
      return 'warning';
    } else {
      return 'info';
    }
  }

  /**
   * Analyze trend from history
   * @param {Array} history - Historical data points
   * @returns {Object} Trend analysis
   */
  analyzeTrend(history) {
    if (history.length < 2) {
      return {
        direction: 'stable',
        percentChange: 0,
        commits: history.length
      };
    }

    const first = history[0];
    const last = history[history.length - 1];

    // Get metric value (could be responseTime, apiResponseTime, etc.)
    const firstValue = first.value || first.responseTime || first.apiResponseTime || 0;
    const lastValue = last.value || last.responseTime || last.apiResponseTime || 0;

    const percentChange = ((lastValue - firstValue) / firstValue) * 100;

    let direction;
    if (percentChange > 10) {
      direction = 'degrading';
    } else if (percentChange < -10) {
      direction = 'improving';
    } else {
      direction = 'stable';
    }

    // Calculate average change per commit
    const averageChange = percentChange / (history.length - 1);

    return {
      direction,
      percentChange,
      commits: history.length,
      averageChange,
      firstValue,
      lastValue
    };
  }

  /**
   * Check if regression is statistically significant
   * @param {Array} baselineSamples - Baseline measurements
   * @param {Array} currentSamples - Current measurements
   * @param {Object} options - Statistical options
   * @returns {boolean} Whether regression is significant
   */
  isStatisticallySignificant(baselineSamples, currentSamples, options = {}) {
    const { confidenceLevel = 0.95 } = options;

    // Calculate means
    const baselineMean = baselineSamples.reduce((sum, v) => sum + v, 0) / baselineSamples.length;
    const currentMean = currentSamples.reduce((sum, v) => sum + v, 0) / currentSamples.length;

    // Simple threshold-based significance (>20% difference)
    const percentDifference = Math.abs((currentMean - baselineMean) / baselineMean) * 100;

    return percentDifference > 20;
  }

  /**
   * Establish performance baseline
   * @param {Object} benchmarkResults - Benchmark results
   * @returns {Object} Baseline
   */
  establishBaseline(benchmarkResults) {
    this.logger.info('Establishing performance baseline');

    const baseline = {
      metrics: { ...benchmarkResults },
      createdAt: new Date().toISOString(),
      version: '1.0.0'
    };

    // Save baseline
    this.saveHistory({
      timestamp: Date.now(),
      baseline: true,
      ...benchmarkResults
    });

    return baseline;
  }

  /**
   * Update baseline with recent results
   * @param {Object} oldBaseline - Previous baseline
   * @param {Array} recentResults - Recent benchmark results
   * @returns {Object} Updated baseline
   */
  updateBaseline(oldBaseline, recentResults) {
    this.logger.info('Updating performance baseline');

    // Calculate new baseline from recent results (average)
    const newBaseline = {};

    // Get all metric keys
    const metricKeys = Object.keys(recentResults[0] || {}).filter(
      key => typeof recentResults[0][key] === 'number'
    );

    // Calculate average for each metric
    for (const key of metricKeys) {
      const values = recentResults.map(r => r[key]).filter(v => v !== undefined);
      newBaseline[key] = values.reduce((sum, v) => sum + v, 0) / values.length;
    }

    return {
      ...newBaseline,
      createdAt: new Date().toISOString(),
      previousBaseline: oldBaseline.createdAt
    };
  }

  /**
   * Compare current results to multiple baselines
   * @param {Object} current - Current results
   * @param {Object} baselines - Multiple baselines (production, staging, etc.)
   * @returns {Object} Comparisons
   */
  compareToBaselines(current, baselines) {
    this.logger.debug('Comparing to multiple baselines');

    const comparisons = {};

    for (const [name, baseline] of Object.entries(baselines)) {
      const comparison = {};

      // Compare each metric
      for (const [metric, baselineValue] of Object.entries(baseline)) {
        if (typeof baselineValue === 'number' && current[metric] !== undefined) {
          const currentValue = current[metric];
          const percentIncrease = ((currentValue - baselineValue) / baselineValue) * 100;

          comparison[metric] = {
            baseline: baselineValue,
            current: currentValue,
            percentIncrease,
            regression: percentIncrease > REGRESSION_THRESHOLDS.WARNING
          };
        }
      }

      comparisons[name] = comparison;
    }

    return comparisons;
  }
}

/**
 * Get singleton instance
 */
let detectorInstance = null;

export function getBenchmarkRegressionDetector() {
  if (!detectorInstance) {
    detectorInstance = new BenchmarkRegressionDetector();
  }
  return detectorInstance;
}
