/**
 * LoadTester
 * ----------
 * Runs load tests against endpoints or functions.
 * Measures throughput, latency, and error rates.
 *
 * @author Kareem Hussein
 * @company Inweb Software Solutions
 */

import EventEmitter from 'events';
import fs from 'fs/promises';
import path from 'path';
import { performance } from 'perf_hooks';
import { createLogger } from '../../foundation/common/logger.js';

const logger = createLogger('LoadTester');

export class LoadTester extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = config;
    this.projectPath = null;
    this.tests = new Map();
    this.history = [];
    this.initialized = false;
  }

  /**
   * Initialize the load tester
   */
  async initialize() {
    this.initialized = true;
    logger.debug('LoadTester initialized');
  }

  /**
   * Set the project path
   * @param {string} projectPath - Path to performance directory
   */
  async setProjectPath(projectPath) {
    this.projectPath = projectPath;
    await fs.mkdir(projectPath, { recursive: true });

    // Load existing history
    await this._loadHistory();
  }

  /**
   * Load test history
   */
  async _loadHistory() {
    try {
      const historyPath = path.join(this.projectPath, 'loadtest-history.json');
      const content = await fs.readFile(historyPath, 'utf-8');
      this.history = JSON.parse(content);
      logger.debug(`Loaded ${this.history.length} load test history entries`);
    } catch (error) {
      this.history = [];
    }
  }

  /**
   * Save history
   */
  async _saveHistory() {
    if (!this.projectPath) return;

    const historyPath = path.join(this.projectPath, 'loadtest-history.json');
    await fs.writeFile(historyPath, JSON.stringify(this.history.slice(-50), null, 2));
  }

  /**
   * Run a load test
   * @param {object} options - Load test options
   */
  async run(options = {}) {
    const testId = `loadtest-${Date.now()}`;

    const config = {
      concurrency: options.concurrency || 10,
      duration: options.duration || 10000, // 10 seconds
      rampUp: options.rampUp || 1000, // 1 second ramp up
      target: options.target || null, // URL or function
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body || null,
      thresholds: options.thresholds || {}
    };

    const results = {
      id: testId,
      timestamp: new Date().toISOString(),
      config,
      requests: {
        total: 0,
        successful: 0,
        failed: 0
      },
      responseTimes: [],
      errors: [],
      timeline: []
    };

    logger.info(`Starting load test: ${config.concurrency} concurrent users for ${config.duration}ms`);

    const startTime = Date.now();
    const workers = [];
    let running = true;

    // Create worker functions
    const worker = async (workerId) => {
      while (running && Date.now() - startTime < config.duration) {
        const requestStart = performance.now();

        try {
          if (config.target && typeof config.target === 'function') {
            // Test a function
            await config.target();
            results.requests.successful++;
          } else if (config.target && typeof config.target === 'string') {
            // Test a URL (simulated for now)
            await this._simulateRequest(config.target);
            results.requests.successful++;
          } else {
            // No target, just simulate
            await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
            results.requests.successful++;
          }
        } catch (error) {
          results.requests.failed++;
          results.errors.push({
            workerId,
            timestamp: Date.now(),
            error: error.message
          });
        }

        const requestEnd = performance.now();
        const responseTime = requestEnd - requestStart;

        results.requests.total++;
        results.responseTimes.push(responseTime);

        // Sample timeline (every 10th request)
        if (results.requests.total % 10 === 0) {
          results.timeline.push({
            time: Date.now() - startTime,
            requests: results.requests.total,
            avgResponseTime: this._calculateMean(results.responseTimes.slice(-100))
          });
        }
      }
    };

    // Ramp up workers
    const workersToSpawn = config.concurrency;
    const rampUpDelay = config.rampUp / workersToSpawn;

    for (let i = 0; i < workersToSpawn; i++) {
      await new Promise(resolve => setTimeout(resolve, rampUpDelay));
      workers.push(worker(i));
    }

    // Wait for duration
    await new Promise(resolve => setTimeout(resolve, config.duration));
    running = false;

    // Wait for all workers to complete
    await Promise.all(workers);

    // Calculate statistics
    results.duration = Date.now() - startTime;
    results.responseTimes.sort((a, b) => a - b);

    const times = results.responseTimes;
    results.avgResponseTime = parseFloat(this._calculateMean(times).toFixed(2));
    results.minResponseTime = parseFloat(times[0]?.toFixed(2) || 0);
    results.maxResponseTime = parseFloat(times[times.length - 1]?.toFixed(2) || 0);
    results.medianResponseTime = parseFloat(times[Math.floor(times.length / 2)]?.toFixed(2) || 0);
    results.p95ResponseTime = parseFloat(times[Math.floor(times.length * 0.95)]?.toFixed(2) || 0);
    results.p99ResponseTime = parseFloat(times[Math.floor(times.length * 0.99)]?.toFixed(2) || 0);
    results.stdDev = parseFloat(this._calculateStdDev(times).toFixed(2));
    results.requestsPerSecond = parseFloat((results.requests.total / (results.duration / 1000)).toFixed(2));
    results.errorRate = parseFloat(((results.requests.failed / results.requests.total) * 100).toFixed(2));

    // Check thresholds
    const thresholdViolations = this._checkThresholds(results, config.thresholds);
    results.thresholdViolations = thresholdViolations;

    if (thresholdViolations.length > 0) {
      for (const violation of thresholdViolations) {
        this.emit('threshold_exceeded', violation);
      }
    }

    // Remove raw response times to save space
    delete results.responseTimes;

    // Save to history
    this.history.push(results);
    await this._saveHistory();

    logger.info(`Load test completed: ${results.requestsPerSecond} req/s, ${results.avgResponseTime}ms avg`);

    return results;
  }

  /**
   * Simulate an HTTP request
   */
  async _simulateRequest(url) {
    // In a real implementation, this would use fetch or http module
    // For now, simulate with random delay
    const baseDelay = 20;
    const variability = 30;
    await new Promise(resolve =>
      setTimeout(resolve, baseDelay + Math.random() * variability)
    );
  }

  /**
   * Calculate mean of an array
   */
  _calculateMean(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  /**
   * Calculate standard deviation
   */
  _calculateStdDev(arr) {
    if (arr.length === 0) return 0;
    const mean = this._calculateMean(arr);
    const squareDiffs = arr.map(value => Math.pow(value - mean, 2));
    return Math.sqrt(this._calculateMean(squareDiffs));
  }

  /**
   * Check if results exceed thresholds
   */
  _checkThresholds(results, thresholds) {
    const violations = [];

    if (thresholds.avgResponseTime && results.avgResponseTime > thresholds.avgResponseTime) {
      violations.push({
        metric: 'avgResponseTime',
        actual: results.avgResponseTime,
        threshold: thresholds.avgResponseTime,
        severity: results.avgResponseTime > thresholds.avgResponseTime * 2 ? 'critical' : 'high'
      });
    }

    if (thresholds.p95ResponseTime && results.p95ResponseTime > thresholds.p95ResponseTime) {
      violations.push({
        metric: 'p95ResponseTime',
        actual: results.p95ResponseTime,
        threshold: thresholds.p95ResponseTime,
        severity: 'high'
      });
    }

    if (thresholds.errorRate && results.errorRate > thresholds.errorRate) {
      violations.push({
        metric: 'errorRate',
        actual: results.errorRate,
        threshold: thresholds.errorRate,
        severity: results.errorRate > 5 ? 'critical' : 'high'
      });
    }

    if (thresholds.requestsPerSecond && results.requestsPerSecond < thresholds.requestsPerSecond) {
      violations.push({
        metric: 'requestsPerSecond',
        actual: results.requestsPerSecond,
        threshold: thresholds.requestsPerSecond,
        severity: 'medium'
      });
    }

    return violations;
  }

  /**
   * Run a quick stress test
   * @param {Function} fn - Function to stress test
   * @param {object} options - Options
   */
  async stressTest(fn, options = {}) {
    const concurrency = options.concurrency || 50;
    const requests = options.requests || 1000;

    const results = {
      timestamp: new Date().toISOString(),
      concurrency,
      totalRequests: requests,
      responseTimes: [],
      errors: 0
    };

    const requestsPerWorker = Math.ceil(requests / concurrency);
    const workers = [];

    for (let i = 0; i < concurrency; i++) {
      workers.push(
        (async () => {
          for (let j = 0; j < requestsPerWorker; j++) {
            const start = performance.now();
            try {
              await fn();
            } catch (e) {
              results.errors++;
            }
            results.responseTimes.push(performance.now() - start);
          }
        })()
      );
    }

    const startTime = Date.now();
    await Promise.all(workers);
    results.duration = Date.now() - startTime;

    // Calculate stats
    results.responseTimes.sort((a, b) => a - b);
    const times = results.responseTimes;

    results.stats = {
      avg: parseFloat(this._calculateMean(times).toFixed(2)),
      min: parseFloat(times[0].toFixed(2)),
      max: parseFloat(times[times.length - 1].toFixed(2)),
      p95: parseFloat(times[Math.floor(times.length * 0.95)].toFixed(2)),
      requestsPerSecond: parseFloat((times.length / (results.duration / 1000)).toFixed(2)),
      errorRate: parseFloat(((results.errors / times.length) * 100).toFixed(2))
    };

    delete results.responseTimes;
    return results;
  }

  /**
   * Get load test history
   */
  async getHistory() {
    return [...this.history];
  }

  /**
   * Get summary
   */
  async getSummary() {
    const lastTest = this.history[this.history.length - 1];

    return {
      totalTests: this.history.length,
      lastTest: lastTest?.timestamp || null,
      lastResults: lastTest ? {
        requestsPerSecond: lastTest.requestsPerSecond,
        avgResponseTime: lastTest.avgResponseTime,
        errorRate: lastTest.errorRate
      } : null
    };
  }
}

export default LoadTester;
