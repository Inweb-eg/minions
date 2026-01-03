/**
 * Base Benchmark - Abstract Base Class
 *
 * Phase 7.4: Performance & Benchmarking
 * Provides common functionality for all performance benchmarks
 */

import { createLogger } from '../utils/logger.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Benchmark status
 */
export const BENCHMARK_STATUS = {
  PASS: 'pass',
  FAIL: 'fail',
  WARNING: 'warning',
  TIMEOUT: 'timeout',
  COMPLETED: 'completed',
  RUNNING: 'running'
};

/**
 * Benchmark metric types
 */
export const METRIC_TYPE = {
  DURATION: 'duration',          // Time taken (ms)
  THROUGHPUT: 'throughput',      // Operations per second
  LATENCY: 'latency',            // Response time (ms)
  MEMORY: 'memory',              // Memory usage (bytes)
  CPU: 'cpu',                    // CPU usage (%)
  CUSTOM: 'custom'               // Custom metric
};

/**
 * Performance thresholds
 */
export const PERFORMANCE_BASELINE = {
  API_RESPONSE: 200,        // ms
  DB_QUERY: 100,            // ms
  PAGE_LOAD: 3000,          // ms
  TTI: 5000,                // ms (Time to Interactive)
  LCP: 2500,                // ms (Largest Contentful Paint)
  FCP: 1800,                // ms (First Contentful Paint)
  CLS: 0.1                  // Cumulative Layout Shift
};

/**
 * BaseBenchmark
 * Abstract base class for all performance benchmarks
 */
export class BaseBenchmark {
  /**
   * @param {string} name - Benchmark name
   * @param {string} type - Benchmark type
   */
  constructor(name, type) {
    if (this.constructor === BaseBenchmark) {
      throw new Error('BaseBenchmark is abstract and cannot be instantiated directly');
    }

    this.name = name;
    this.type = type;
    this.logger = createLogger(name);
    this.results = [];
    this.metrics = {};
    this.startTime = null;
    this.endTime = null;
  }

  /**
   * Run benchmark - must be implemented by subclass
   * @param {Object} config - Benchmark configuration
   * @param {Object} options - Benchmark options
   * @returns {Promise<Object>} Benchmark result
   */
  async run(config, options = {}) {
    throw new Error('run() must be implemented by subclass');
  }

  /**
   * Start benchmark timer
   */
  startBenchmark() {
    this.startTime = Date.now();
    this.logger.info(`Starting ${this.type} benchmark...`);
  }

  /**
   * End benchmark timer
   * @returns {number} Duration in milliseconds
   */
  endBenchmark() {
    this.endTime = Date.now();
    const duration = this.endTime - this.startTime;
    this.logger.info(`${this.type} benchmark completed in ${duration}ms`);
    return duration;
  }

  /**
   * Record metric
   * @param {string} name - Metric name
   * @param {number} value - Metric value
   * @param {string} type - Metric type
   * @param {string} unit - Unit of measurement
   */
  recordMetric(name, value, type = METRIC_TYPE.DURATION, unit = 'ms') {
    const metric = {
      name,
      value,
      type,
      unit,
      timestamp: Date.now()
    };

    if (!this.metrics[name]) {
      this.metrics[name] = [];
    }
    this.metrics[name].push(metric);

    this.logger.debug(`Recorded metric: ${name} = ${value}${unit}`);
  }

  /**
   * Add benchmark result
   * @param {Object} result - Result to add
   */
  addResult(result) {
    this.results.push({
      ...result,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get all results
   * @returns {Array} All results
   */
  getResults() {
    return this.results;
  }

  /**
   * Clear results and metrics
   */
  clearResults() {
    this.results = [];
    this.metrics = {};
  }

  /**
   * Calculate statistics for a metric
   * @param {string} metricName - Metric name
   * @returns {Object} Statistics
   */
  calculateStatistics(metricName) {
    const metricData = this.metrics[metricName];
    if (!metricData || metricData.length === 0) {
      return null;
    }

    const values = metricData.map(m => m.value).sort((a, b) => a - b);
    const sum = values.reduce((acc, val) => acc + val, 0);
    const avg = sum / values.length;

    // Calculate standard deviation
    const variance = values.reduce((acc, val) => {
      return acc + Math.pow(val - avg, 2);
    }, 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Calculate percentiles
    const p50 = values[Math.floor(values.length * 0.5)];
    const p95 = values[Math.floor(values.length * 0.95)];
    const p99 = values[Math.floor(values.length * 0.99)];

    return {
      count: values.length,
      min: values[0],
      max: values[values.length - 1],
      avg,
      median: p50,
      stdDev,
      p50,
      p95,
      p99
    };
  }

  /**
   * Compare with baseline
   * @param {string} metricName - Metric name
   * @param {number} baseline - Baseline value
   * @returns {Object} Comparison result
   */
  compareWithBaseline(metricName, baseline) {
    const stats = this.calculateStatistics(metricName);
    if (!stats) {
      return { status: 'no_data' };
    }

    const avgValue = stats.avg;
    const difference = avgValue - baseline;
    const percentDiff = (difference / baseline) * 100;

    let status = BENCHMARK_STATUS.PASS;
    if (avgValue > baseline * 1.5) {
      status = BENCHMARK_STATUS.FAIL;
    } else if (avgValue > baseline * 1.2) {
      status = BENCHMARK_STATUS.WARNING;
    }

    return {
      status,
      baseline,
      actual: avgValue,
      difference,
      percentDiff,
      betterThanBaseline: avgValue < baseline
    };
  }

  /**
   * Generate benchmark summary
   * @returns {Object} Summary
   */
  generateSummary() {
    const summary = {
      name: this.name,
      type: this.type,
      duration: this.endTime && this.startTime ? this.endTime - this.startTime : 0,
      resultsCount: this.results.length,
      metrics: {},
      averages: this.getAverageMetrics()
    };

    // Calculate statistics for each metric
    Object.keys(this.metrics).forEach(metricName => {
      summary.metrics[metricName] = this.calculateStatistics(metricName);
    });

    return summary;
  }

  /**
   * Get average values for all metrics
   * @returns {Object} Metric averages
   */
  getAverageMetrics() {
    const averages = {};

    Object.keys(this.metrics).forEach(metricName => {
      const stats = this.calculateStatistics(metricName);
      if (stats) {
        averages[metricName] = stats.avg;
      }
    });

    return averages;
  }

  /**
   * Save results to file
   * @param {string} filePath - File path
   * @param {string} format - Format (json, csv)
   * @returns {boolean} Success
   */
  saveResults(filePath, format = 'json') {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (format === 'json') {
        const data = {
          benchmark: this.name,
          type: this.type,
          summary: this.generateSummary(),
          results: this.results,
          metrics: this.metrics,
          timestamp: new Date().toISOString()
        };

        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      } else if (format === 'csv') {
        // Simple CSV export for metrics
        const lines = ['Metric,Value,Unit,Timestamp'];

        Object.entries(this.metrics).forEach(([name, data]) => {
          data.forEach(metric => {
            lines.push(`${name},${metric.value},${metric.unit},${metric.timestamp}`);
          });
        });

        fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
      }

      this.logger.success(`Results saved to: ${filePath}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to save results: ${error.message}`);
      return false;
    }
  }

  /**
   * Load historical results
   * @param {string} filePath - File path
   * @returns {Object|null} Historical data
   */
  loadHistoricalResults(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      this.logger.error(`Failed to load historical results: ${error.message}`);
      return null;
    }
  }

  /**
   * Format duration
   * @param {number} ms - Duration in milliseconds
   * @returns {string} Formatted duration
   */
  formatDuration(ms) {
    if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`;
    if (ms < 1000) return `${ms.toFixed(2)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
  }

  /**
   * Format bytes
   * @param {number} bytes - Bytes
   * @returns {string} Formatted bytes
   */
  formatBytes(bytes) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
  }

  /**
   * Measure async operation
   * @param {Function} fn - Async function to measure
   * @param {string} metricName - Metric name
   * @returns {Promise<any>} Function result
   */
  async measureAsync(fn, metricName) {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.recordMetric(metricName, duration, METRIC_TYPE.DURATION, 'ms');
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.recordMetric(metricName, duration, METRIC_TYPE.DURATION, 'ms');
      throw error;
    }
  }

  /**
   * Measure sync operation
   * @param {Function} fn - Function to measure
   * @param {string} metricName - Metric name
   * @returns {any} Function result
   */
  measureSync(fn, metricName) {
    const start = Date.now();
    try {
      const result = fn();
      const duration = Date.now() - start;
      this.recordMetric(metricName, duration, METRIC_TYPE.DURATION, 'ms');
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.recordMetric(metricName, duration, METRIC_TYPE.DURATION, 'ms');
      throw error;
    }
  }

  /**
   * Run warmup iterations
   * @param {Function} fn - Function to warm up
   * @param {number} iterations - Number of warmup iterations
   * @returns {Promise<void>}
   */
  async warmup(fn, iterations = 3) {
    this.logger.info(`Running ${iterations} warmup iterations...`);
    for (let i = 0; i < iterations; i++) {
      await fn();
    }
    this.logger.info('Warmup complete');
  }

  /**
   * Sleep utility
   * @param {number} ms - Milliseconds
   * @returns {Promise} Promise that resolves after delay
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
