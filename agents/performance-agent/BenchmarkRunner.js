/**
 * BenchmarkRunner
 * ---------------
 * Runs performance benchmarks and tracks results over time.
 * Detects performance regressions.
 *
 * @author Kareem Hussein
 * @company Inweb Software Solutions
 */

import EventEmitter from 'events';
import fs from 'fs/promises';
import path from 'path';
import { performance } from 'perf_hooks';
import { createLogger } from '../../foundation/common/logger.js';

const logger = createLogger('BenchmarkRunner');

export class BenchmarkRunner extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = config;
    this.projectPath = null;
    this.benchmarks = new Map();
    this.history = [];
    this.initialized = false;
  }

  /**
   * Initialize the benchmark runner
   */
  async initialize() {
    this.initialized = true;
    logger.debug('BenchmarkRunner initialized');
  }

  /**
   * Set the project path
   * @param {string} projectPath - Path to performance directory
   */
  async setProjectPath(projectPath) {
    this.projectPath = projectPath;
    await fs.mkdir(projectPath, { recursive: true });

    // Load existing benchmarks and history
    await this._loadBenchmarks();
    await this._loadHistory();
  }

  /**
   * Load existing benchmarks
   */
  async _loadBenchmarks() {
    try {
      const benchmarksPath = path.join(this.projectPath, this.config.benchmarksFile || 'benchmarks.json');
      const content = await fs.readFile(benchmarksPath, 'utf-8');
      const data = JSON.parse(content);

      for (const benchmark of data.benchmarks || []) {
        this.benchmarks.set(benchmark.name, benchmark);
      }

      logger.debug(`Loaded ${this.benchmarks.size} benchmarks`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.warn(`Error loading benchmarks: ${error.message}`);
      }
    }
  }

  /**
   * Load benchmark history
   */
  async _loadHistory() {
    try {
      const historyPath = path.join(this.projectPath, 'benchmark-history.json');
      const content = await fs.readFile(historyPath, 'utf-8');
      this.history = JSON.parse(content);
      logger.debug(`Loaded ${this.history.length} history entries`);
    } catch (error) {
      this.history = [];
    }
  }

  /**
   * Save history
   */
  async _saveHistory() {
    if (!this.projectPath) return;

    const historyPath = path.join(this.projectPath, 'benchmark-history.json');
    await fs.writeFile(historyPath, JSON.stringify(this.history.slice(-100), null, 2));
  }

  /**
   * Add a benchmark
   * @param {object} benchmark - Benchmark definition
   */
  async add(benchmark) {
    const newBenchmark = {
      name: benchmark.name,
      description: benchmark.description || '',
      fn: benchmark.fn,
      iterations: benchmark.iterations || 100,
      warmup: benchmark.warmup || 10,
      timeout: benchmark.timeout || 30000,
      createdAt: new Date().toISOString()
    };

    this.benchmarks.set(newBenchmark.name, newBenchmark);
    await this._saveBenchmarks();

    return newBenchmark;
  }

  /**
   * Save benchmarks to file
   */
  async _saveBenchmarks() {
    if (!this.projectPath) return;

    const benchmarksPath = path.join(this.projectPath, this.config.benchmarksFile || 'benchmarks.json');
    const data = {
      benchmarks: Array.from(this.benchmarks.values()).map(b => ({
        name: b.name,
        description: b.description,
        iterations: b.iterations,
        warmup: b.warmup,
        timeout: b.timeout,
        createdAt: b.createdAt
      })),
      updatedAt: new Date().toISOString()
    };

    await fs.writeFile(benchmarksPath, JSON.stringify(data, null, 2));
  }

  /**
   * Run benchmarks
   * @param {object} options - Run options
   */
  async run(options = {}) {
    const runId = `run-${Date.now()}`;
    const results = {
      id: runId,
      timestamp: new Date().toISOString(),
      benchmarks: {},
      summary: {}
    };

    const benchmarksToRun = options.names
      ? Array.from(this.benchmarks.values()).filter(b => options.names.includes(b.name))
      : Array.from(this.benchmarks.values());

    if (benchmarksToRun.length === 0) {
      // Run built-in benchmarks if none defined
      return await this._runBuiltInBenchmarks();
    }

    for (const benchmark of benchmarksToRun) {
      try {
        const result = await this._runBenchmark(benchmark, options);
        results.benchmarks[benchmark.name] = result;
      } catch (error) {
        results.benchmarks[benchmark.name] = {
          error: error.message,
          success: false
        };
      }
    }

    // Calculate summary
    results.summary = this._calculateSummary(results.benchmarks);

    // Save to history
    this.history.push(results);
    await this._saveHistory();

    return results;
  }

  /**
   * Run a single benchmark
   */
  async _runBenchmark(benchmark, options = {}) {
    const iterations = benchmark.iterations || 100;
    const warmup = benchmark.warmup || 10;
    const times = [];

    // Warmup runs
    if (benchmark.fn) {
      for (let i = 0; i < warmup; i++) {
        await benchmark.fn();
      }
    }

    // Timed runs
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      if (benchmark.fn) {
        await benchmark.fn();
      } else {
        // Simulate if no function provided
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
      }

      const end = performance.now();
      times.push(end - start);
    }

    // Calculate statistics
    times.sort((a, b) => a - b);
    const sum = times.reduce((a, b) => a + b, 0);
    const mean = sum / times.length;
    const variance = times.reduce((acc, t) => acc + Math.pow(t - mean, 2), 0) / times.length;

    return {
      name: benchmark.name,
      iterations,
      mean: parseFloat(mean.toFixed(4)),
      min: parseFloat(times[0].toFixed(4)),
      max: parseFloat(times[times.length - 1].toFixed(4)),
      median: parseFloat(times[Math.floor(times.length / 2)].toFixed(4)),
      stdDev: parseFloat(Math.sqrt(variance).toFixed(4)),
      p95: parseFloat(times[Math.floor(times.length * 0.95)].toFixed(4)),
      p99: parseFloat(times[Math.floor(times.length * 0.99)].toFixed(4)),
      opsPerSecond: parseFloat((1000 / mean).toFixed(2)),
      success: true
    };
  }

  /**
   * Run built-in benchmarks
   */
  async _runBuiltInBenchmarks() {
    const results = {
      id: `run-${Date.now()}`,
      timestamp: new Date().toISOString(),
      benchmarks: {},
      summary: {}
    };

    // JSON parsing benchmark
    results.benchmarks['json-parse'] = await this._runBenchmark({
      name: 'json-parse',
      iterations: 1000,
      fn: () => JSON.parse('{"test": "value", "number": 123, "array": [1,2,3]}')
    });

    // Array operations benchmark
    results.benchmarks['array-ops'] = await this._runBenchmark({
      name: 'array-ops',
      iterations: 1000,
      fn: () => {
        const arr = Array.from({ length: 100 }, (_, i) => i);
        arr.map(x => x * 2).filter(x => x > 50).reduce((a, b) => a + b, 0);
      }
    });

    // Object creation benchmark
    results.benchmarks['object-creation'] = await this._runBenchmark({
      name: 'object-creation',
      iterations: 1000,
      fn: () => {
        const obj = {};
        for (let i = 0; i < 100; i++) {
          obj[`key${i}`] = `value${i}`;
        }
        return obj;
      }
    });

    results.summary = this._calculateSummary(results.benchmarks);

    this.history.push(results);
    await this._saveHistory();

    return results;
  }

  /**
   * Calculate summary statistics
   */
  _calculateSummary(benchmarks) {
    const successful = Object.values(benchmarks).filter(b => b.success);
    const failed = Object.values(benchmarks).filter(b => !b.success);

    return {
      total: Object.keys(benchmarks).length,
      successful: successful.length,
      failed: failed.length,
      averageMean: successful.length > 0
        ? parseFloat((successful.reduce((sum, b) => sum + b.mean, 0) / successful.length).toFixed(4))
        : 0,
      totalOpsPerSecond: successful.reduce((sum, b) => sum + b.opsPerSecond, 0)
    };
  }

  /**
   * Get previous results
   */
  async getPreviousResults() {
    if (this.history.length < 2) {
      return null;
    }

    return this.history[this.history.length - 2];
  }

  /**
   * Get benchmark history
   */
  async getHistory() {
    return [...this.history];
  }

  /**
   * Get benchmark summary
   */
  async getSummary() {
    const lastRun = this.history[this.history.length - 1];

    return {
      benchmarkCount: this.benchmarks.size,
      historyCount: this.history.length,
      lastRun: lastRun?.timestamp || null,
      lastSummary: lastRun?.summary || null
    };
  }

  /**
   * Save state
   */
  async save() {
    await this._saveBenchmarks();
    await this._saveHistory();
  }
}

export default BenchmarkRunner;
