/**
 * Minions - PerformanceAgent (Kevin)
 * ==================================
 * Named after Kevin - the enthusiastic Performance Optimizer.
 * Profiles applications, runs benchmarks, analyzes memory,
 * and detects performance bottlenecks.
 *
 * Responsibilities:
 * - performance/ folder management (benchmarks.json, profiles/, thresholds.json)
 * - Code profiling and hotspot detection
 * - Benchmark running and regression detection
 * - Memory leak detection
 * - Load testing and threshold monitoring
 *
 * @author Kareem Hussein
 * @company Inweb Software Solutions
 */

import EventEmitter from 'events';
import path from 'path';
import fs from 'fs/promises';
import { createLogger } from '../../foundation/common/logger.js';

import Profiler from './Profiler.js';
import BenchmarkRunner from './BenchmarkRunner.js';
import MemoryAnalyzer from './MemoryAnalyzer.js';
import LoadTester from './LoadTester.js';

// Agent States
export const AgentState = {
  IDLE: 'IDLE',
  INITIALIZING: 'INITIALIZING',
  PROFILING: 'PROFILING',
  BENCHMARKING: 'BENCHMARKING',
  ANALYZING: 'ANALYZING',
  LOAD_TESTING: 'LOAD_TESTING',
  PAUSED: 'PAUSED',
  ERROR: 'ERROR',
  SHUTDOWN: 'SHUTDOWN'
};

// Performance Event Types (also defined in eventTypes.js)
export const PerformanceEvents = {
  // Profiling
  PROFILE_STARTED: 'performance:profile:started',
  PROFILE_COMPLETED: 'performance:profile:completed',
  HOTSPOT_DETECTED: 'performance:hotspot:detected',

  // Benchmarking
  BENCHMARK_STARTED: 'performance:benchmark:started',
  BENCHMARK_COMPLETED: 'performance:benchmark:completed',
  BENCHMARK_FAILED: 'performance:benchmark:failed',
  REGRESSION_DETECTED: 'performance:regression:detected',

  // Memory analysis
  MEMORY_ANALYZED: 'performance:memory:analyzed',
  MEMORY_LEAK_DETECTED: 'performance:memory:leak',
  MEMORY_THRESHOLD_EXCEEDED: 'performance:memory:threshold',

  // Bottleneck detection
  BOTTLENECK_DETECTED: 'performance:bottleneck:detected',
  BOTTLENECK_RESOLVED: 'performance:bottleneck:resolved',

  // Load testing
  LOAD_TEST_STARTED: 'performance:loadtest:started',
  LOAD_TEST_COMPLETED: 'performance:loadtest:completed',
  THRESHOLD_EXCEEDED: 'performance:threshold:exceeded',

  // General
  PERFORMANCE_ERROR: 'performance:error'
};

// Performance severity levels
export const Severity = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFO: 'info'
};

// Singleton instance
let instance = null;

export class PerformanceAgent extends EventEmitter {
  constructor(config = {}) {
    super();

    this.name = 'PerformanceAgent';
    this.alias = 'Kevin';
    this.version = '1.0.0';
    this.state = AgentState.IDLE;
    this.logger = createLogger(this.name);

    // Configuration
    this.config = {
      projectRoot: config.projectRoot || process.cwd(),
      performanceDir: config.performanceDir || 'performance',
      profilesDir: config.profilesDir || 'performance/profiles',
      benchmarksFile: config.benchmarksFile || 'benchmarks.json',
      thresholdsFile: config.thresholdsFile || 'thresholds.json',
      enableAutoProfile: config.enableAutoProfile || false,
      cpuThreshold: config.cpuThreshold || 80, // percentage
      memoryThreshold: config.memoryThreshold || 85, // percentage
      responseTimeThreshold: config.responseTimeThreshold || 2000, // ms
      ...config
    };

    // Sub-components
    this.profiler = new Profiler(this.config);
    this.benchmarkRunner = new BenchmarkRunner(this.config);
    this.memoryAnalyzer = new MemoryAnalyzer(this.config);
    this.loadTester = new LoadTester(this.config);

    // Current project context
    this.currentProject = null;
    this.eventBus = null;

    // Metrics
    this.metrics = {
      profilesCompleted: 0,
      hotspotsDetected: 0,
      benchmarksRun: 0,
      regressionsDetected: 0,
      memoryLeaksDetected: 0,
      loadTestsRun: 0,
      thresholdsExceeded: 0,
      lastActivity: null
    };

    // Performance baselines
    this.baselines = {
      cpu: null,
      memory: null,
      responseTime: null
    };

    this._setupInternalHandlers();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config = {}) {
    if (!instance) {
      instance = new PerformanceAgent(config);
    }
    return instance;
  }

  /**
   * Reset singleton (for testing)
   */
  static resetInstance() {
    if (instance) {
      instance.removeAllListeners();
      instance = null;
    }
  }

  /**
   * Initialize the agent with optional eventBus connection
   */
  async initialize(eventBus = null) {
    this.state = AgentState.INITIALIZING;
    this.logger.info(`Initializing ${this.name} (${this.alias})...`);

    try {
      if (eventBus) {
        this.eventBus = eventBus;
        this._subscribeToEvents();
      }

      // Initialize sub-components
      await this.profiler.initialize();
      await this.benchmarkRunner.initialize();
      await this.memoryAnalyzer.initialize();
      await this.loadTester.initialize();

      // Wire up sub-component events
      this._wireSubComponents();

      this.state = AgentState.IDLE;
      this.metrics.lastActivity = new Date().toISOString();

      this.emit('initialized', {
        agent: this.name,
        alias: this.alias,
        version: this.version
      });

      this.logger.info(`${this.alias} initialized successfully`);
      return { success: true, agent: this.name };
    } catch (error) {
      this.state = AgentState.ERROR;
      this.logger.error(`Failed to initialize: ${error.message}`);
      this.emit('error', { agent: this.name, error: error.message });
      throw error;
    }
  }

  /**
   * Set the current project context
   * @param {object} project - Project from ProjectManagerAgent
   */
  async setProject(project) {
    this.currentProject = project;
    this.logger.info(`Project context set: ${project.name}`);

    // Update sub-components with project context
    const projectPerfPath = path.join(project.workspacePath, this.config.performanceDir);
    const projectProfilesPath = path.join(project.workspacePath, this.config.profilesDir);

    await this.profiler.setProjectPath(projectProfilesPath);
    await this.benchmarkRunner.setProjectPath(projectPerfPath);
    await this.memoryAnalyzer.setProjectPath(projectPerfPath);
    await this.loadTester.setProjectPath(projectPerfPath);

    // Load baselines
    await this._loadBaselines();

    return { success: true, project: project.name };
  }

  /**
   * Load performance baselines
   */
  async _loadBaselines() {
    try {
      const thresholdsPath = path.join(
        this.currentProject.workspacePath,
        this.config.performanceDir,
        this.config.thresholdsFile
      );
      const content = await fs.readFile(thresholdsPath, 'utf-8');
      const thresholds = JSON.parse(content);

      this.baselines = {
        cpu: thresholds.cpu || this.config.cpuThreshold,
        memory: thresholds.memory || this.config.memoryThreshold,
        responseTime: thresholds.responseTime || this.config.responseTimeThreshold,
        ...thresholds.baselines
      };

      this.logger.debug('Performance baselines loaded');
    } catch (error) {
      this.logger.debug('No existing baselines, using defaults');
    }
  }

  // ==========================================
  // Profiling
  // ==========================================

  /**
   * Profile application or specific code
   * @param {object} options - Profile options
   */
  async profile(options = {}) {
    if (!this.currentProject) {
      throw new Error('No project context set. Call setProject() first.');
    }

    this.state = AgentState.PROFILING;
    this.logger.info(`Starting profile for: ${this.currentProject.name}`);

    const profileId = `profile-${Date.now()}`;

    try {
      this.emit(PerformanceEvents.PROFILE_STARTED, {
        profileId,
        project: this.currentProject.name,
        options
      });

      const result = await this.profiler.profile(options);

      // Detect hotspots
      const hotspots = this._detectHotspots(result);
      result.hotspots = hotspots;

      for (const hotspot of hotspots) {
        this.metrics.hotspotsDetected++;
        this.emit(PerformanceEvents.HOTSPOT_DETECTED, {
          profileId,
          hotspot
        });
      }

      this.metrics.profilesCompleted++;
      this.metrics.lastActivity = new Date().toISOString();

      this.emit(PerformanceEvents.PROFILE_COMPLETED, {
        profileId,
        result
      });

      if (this.eventBus) {
        this.eventBus.publish(PerformanceEvents.PROFILE_COMPLETED, {
          profileId,
          project: this.currentProject.name,
          result
        });
      }

      this.state = AgentState.IDLE;
      return result;
    } catch (error) {
      this.state = AgentState.ERROR;
      this.logger.error(`Profile failed: ${error.message}`);
      this.emit(PerformanceEvents.PERFORMANCE_ERROR, { profileId, error: error.message });
      throw error;
    }
  }

  /**
   * Detect performance hotspots from profile
   */
  _detectHotspots(profileResult) {
    const hotspots = [];

    if (profileResult.cpuProfile) {
      // Find functions that consume > 5% of total time
      for (const node of profileResult.cpuProfile.nodes || []) {
        if (node.selfTime > profileResult.cpuProfile.totalTime * 0.05) {
          hotspots.push({
            type: 'cpu',
            severity: node.selfTime > profileResult.cpuProfile.totalTime * 0.2 ? 'high' : 'medium',
            location: node.functionName,
            file: node.fileName,
            line: node.lineNumber,
            selfTime: node.selfTime,
            percentage: ((node.selfTime / profileResult.cpuProfile.totalTime) * 100).toFixed(2)
          });
        }
      }
    }

    return hotspots;
  }

  /**
   * Profile a specific function
   * @param {Function} fn - Function to profile
   * @param {*} args - Arguments to pass
   */
  async profileFunction(fn, ...args) {
    return await this.profiler.profileFunction(fn, ...args);
  }

  // ==========================================
  // Benchmarking
  // ==========================================

  /**
   * Run benchmarks
   * @param {object} options - Benchmark options
   */
  async runBenchmarks(options = {}) {
    if (!this.currentProject) {
      throw new Error('No project context set. Call setProject() first.');
    }

    this.state = AgentState.BENCHMARKING;
    this.logger.info('Running benchmarks...');

    const runId = `benchmark-${Date.now()}`;

    try {
      this.emit(PerformanceEvents.BENCHMARK_STARTED, {
        runId,
        project: this.currentProject.name
      });

      const results = await this.benchmarkRunner.run(options);

      // Check for regressions
      const regressions = await this._detectRegressions(results);
      results.regressions = regressions;

      if (regressions.length > 0) {
        this.metrics.regressionsDetected += regressions.length;

        for (const regression of regressions) {
          this.emit(PerformanceEvents.REGRESSION_DETECTED, {
            runId,
            regression
          });

          if (this.eventBus) {
            this.eventBus.publish(PerformanceEvents.REGRESSION_DETECTED, regression);
          }
        }
      }

      this.metrics.benchmarksRun++;
      this.metrics.lastActivity = new Date().toISOString();

      this.emit(PerformanceEvents.BENCHMARK_COMPLETED, {
        runId,
        results
      });

      if (this.eventBus) {
        this.eventBus.publish(PerformanceEvents.BENCHMARK_COMPLETED, {
          runId,
          project: this.currentProject.name,
          results
        });
      }

      this.state = AgentState.IDLE;
      return results;
    } catch (error) {
      this.state = AgentState.ERROR;
      this.logger.error(`Benchmarks failed: ${error.message}`);

      this.emit(PerformanceEvents.BENCHMARK_FAILED, {
        runId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Detect performance regressions
   */
  async _detectRegressions(results) {
    const regressions = [];
    const previousResults = await this.benchmarkRunner.getPreviousResults();

    if (!previousResults) {
      return regressions;
    }

    for (const [name, current] of Object.entries(results.benchmarks || {})) {
      const previous = previousResults.benchmarks?.[name];

      if (previous) {
        // Check for significant slowdown (> 10%)
        const percentChange = ((current.mean - previous.mean) / previous.mean) * 100;

        if (percentChange > 10) {
          regressions.push({
            benchmark: name,
            previous: previous.mean,
            current: current.mean,
            percentChange: percentChange.toFixed(2),
            severity: percentChange > 50 ? 'critical' : percentChange > 25 ? 'high' : 'medium'
          });
        }
      }
    }

    return regressions;
  }

  /**
   * Add a benchmark
   * @param {object} benchmark - Benchmark definition
   */
  async addBenchmark(benchmark) {
    return await this.benchmarkRunner.add(benchmark);
  }

  /**
   * Get benchmark history
   */
  async getBenchmarkHistory() {
    return await this.benchmarkRunner.getHistory();
  }

  // ==========================================
  // Memory Analysis
  // ==========================================

  /**
   * Analyze memory usage
   * @param {object} options - Analysis options
   */
  async analyzeMemory(options = {}) {
    this.state = AgentState.ANALYZING;
    this.logger.info('Analyzing memory...');

    try {
      const analysis = await this.memoryAnalyzer.analyze(options);

      // Check for memory leaks
      if (analysis.potentialLeaks && analysis.potentialLeaks.length > 0) {
        this.metrics.memoryLeaksDetected += analysis.potentialLeaks.length;

        for (const leak of analysis.potentialLeaks) {
          this.emit(PerformanceEvents.MEMORY_LEAK_DETECTED, leak);

          if (this.eventBus) {
            this.eventBus.publish(PerformanceEvents.MEMORY_LEAK_DETECTED, leak);
          }
        }
      }

      // Check memory threshold
      if (analysis.heapUsedPercent > this.baselines.memory) {
        this.metrics.thresholdsExceeded++;

        this.emit(PerformanceEvents.MEMORY_THRESHOLD_EXCEEDED, {
          current: analysis.heapUsedPercent,
          threshold: this.baselines.memory,
          details: analysis
        });
      }

      this.emit(PerformanceEvents.MEMORY_ANALYZED, analysis);

      this.state = AgentState.IDLE;
      return analysis;
    } catch (error) {
      this.state = AgentState.ERROR;
      throw error;
    }
  }

  /**
   * Take a heap snapshot
   */
  async takeHeapSnapshot() {
    return await this.memoryAnalyzer.takeSnapshot();
  }

  /**
   * Compare heap snapshots
   * @param {string} snapshot1 - First snapshot ID
   * @param {string} snapshot2 - Second snapshot ID
   */
  async compareSnapshots(snapshot1, snapshot2) {
    return await this.memoryAnalyzer.compare(snapshot1, snapshot2);
  }

  // ==========================================
  // Load Testing
  // ==========================================

  /**
   * Run a load test
   * @param {object} options - Load test options
   */
  async runLoadTest(options = {}) {
    this.state = AgentState.LOAD_TESTING;
    this.logger.info('Running load test...');

    const testId = `loadtest-${Date.now()}`;

    try {
      this.emit(PerformanceEvents.LOAD_TEST_STARTED, {
        testId,
        options
      });

      const results = await this.loadTester.run(options);

      // Check thresholds
      const exceeded = this._checkLoadTestThresholds(results);
      results.thresholdsExceeded = exceeded;

      if (exceeded.length > 0) {
        this.metrics.thresholdsExceeded += exceeded.length;

        for (const violation of exceeded) {
          this.emit(PerformanceEvents.THRESHOLD_EXCEEDED, violation);

          if (this.eventBus) {
            this.eventBus.publish(PerformanceEvents.THRESHOLD_EXCEEDED, violation);
          }
        }
      }

      this.metrics.loadTestsRun++;
      this.metrics.lastActivity = new Date().toISOString();

      this.emit(PerformanceEvents.LOAD_TEST_COMPLETED, {
        testId,
        results
      });

      if (this.eventBus) {
        this.eventBus.publish(PerformanceEvents.LOAD_TEST_COMPLETED, {
          testId,
          results
        });
      }

      this.state = AgentState.IDLE;
      return results;
    } catch (error) {
      this.state = AgentState.ERROR;
      this.logger.error(`Load test failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check load test results against thresholds
   */
  _checkLoadTestThresholds(results) {
    const exceeded = [];

    if (results.avgResponseTime > this.baselines.responseTime) {
      exceeded.push({
        metric: 'avgResponseTime',
        current: results.avgResponseTime,
        threshold: this.baselines.responseTime,
        severity: results.avgResponseTime > this.baselines.responseTime * 2 ? 'critical' : 'high'
      });
    }

    if (results.p95ResponseTime > this.baselines.responseTime * 2) {
      exceeded.push({
        metric: 'p95ResponseTime',
        current: results.p95ResponseTime,
        threshold: this.baselines.responseTime * 2,
        severity: 'high'
      });
    }

    if (results.errorRate > 1) {
      exceeded.push({
        metric: 'errorRate',
        current: results.errorRate,
        threshold: 1,
        severity: results.errorRate > 5 ? 'critical' : 'high'
      });
    }

    return exceeded;
  }

  // ==========================================
  // Bottleneck Detection
  // ==========================================

  /**
   * Detect performance bottlenecks
   */
  async detectBottlenecks() {
    this.state = AgentState.ANALYZING;
    this.logger.info('Detecting bottlenecks...');

    const bottlenecks = [];

    try {
      // Analyze CPU
      const cpuAnalysis = await this.profiler.getQuickProfile();
      if (cpuAnalysis.cpuUsage > this.config.cpuThreshold) {
        bottlenecks.push({
          type: 'cpu',
          severity: cpuAnalysis.cpuUsage > 95 ? 'critical' : 'high',
          current: cpuAnalysis.cpuUsage,
          threshold: this.config.cpuThreshold,
          recommendation: 'Optimize CPU-intensive operations or scale horizontally'
        });
      }

      // Analyze memory
      const memoryAnalysis = await this.memoryAnalyzer.getQuickAnalysis();
      if (memoryAnalysis.heapUsedPercent > this.config.memoryThreshold) {
        bottlenecks.push({
          type: 'memory',
          severity: memoryAnalysis.heapUsedPercent > 95 ? 'critical' : 'high',
          current: memoryAnalysis.heapUsedPercent,
          threshold: this.config.memoryThreshold,
          recommendation: 'Check for memory leaks or increase heap size'
        });
      }

      // Emit events for detected bottlenecks
      for (const bottleneck of bottlenecks) {
        this.emit(PerformanceEvents.BOTTLENECK_DETECTED, bottleneck);

        if (this.eventBus) {
          this.eventBus.publish(PerformanceEvents.BOTTLENECK_DETECTED, bottleneck);
        }
      }

      this.state = AgentState.IDLE;
      return {
        bottlenecks,
        timestamp: new Date().toISOString(),
        status: bottlenecks.length === 0 ? 'healthy' : 'issues_detected'
      };
    } catch (error) {
      this.state = AgentState.ERROR;
      throw error;
    }
  }

  // ==========================================
  // Thresholds Management
  // ==========================================

  /**
   * Set performance thresholds
   * @param {object} thresholds - Threshold values
   */
  async setThresholds(thresholds) {
    this.baselines = {
      ...this.baselines,
      ...thresholds
    };

    // Save to file
    const thresholdsPath = path.join(
      this.currentProject.workspacePath,
      this.config.performanceDir,
      this.config.thresholdsFile
    );

    await fs.mkdir(path.dirname(thresholdsPath), { recursive: true });
    await fs.writeFile(thresholdsPath, JSON.stringify({
      ...thresholds,
      baselines: this.baselines,
      updatedAt: new Date().toISOString(),
      updatedBy: this.alias
    }, null, 2));

    this.logger.info('Performance thresholds updated');
    return this.baselines;
  }

  /**
   * Get current thresholds
   */
  getThresholds() {
    return { ...this.baselines };
  }

  // ==========================================
  // Status & Metrics
  // ==========================================

  /**
   * Get agent status
   */
  getStatus() {
    return {
      name: this.name,
      alias: this.alias,
      version: this.version,
      state: this.state,
      currentProject: this.currentProject?.name || null,
      thresholds: this.baselines,
      metrics: { ...this.metrics }
    };
  }

  /**
   * Get performance summary for current project
   */
  async getPerformanceSummary() {
    if (!this.currentProject) {
      return null;
    }

    const [profileSummary, benchmarkSummary, memorySummary] = await Promise.all([
      this.profiler.getSummary(),
      this.benchmarkRunner.getSummary(),
      this.memoryAnalyzer.getSummary()
    ]);

    return {
      project: this.currentProject.name,
      profile: profileSummary,
      benchmarks: benchmarkSummary,
      memory: memorySummary,
      thresholds: this.baselines,
      metrics: this.metrics
    };
  }

  // ==========================================
  // Shutdown
  // ==========================================

  /**
   * Graceful shutdown
   */
  async shutdown() {
    this.logger.info(`Shutting down ${this.alias}...`);
    this.state = AgentState.SHUTDOWN;

    // Save any pending state
    await this.profiler.save();
    await this.benchmarkRunner.save();

    // Unsubscribe from events
    if (this.eventBus && this._unsubscribers) {
      this._unsubscribers.forEach(fn => fn());
    }

    this.removeAllListeners();
    this.logger.info(`${this.alias} shutdown complete`);
  }

  // ==========================================
  // Private Methods
  // ==========================================

  _setupInternalHandlers() {
    this.on('error', (data) => {
      this.logger.error(`Error: ${data.error}`);
    });
  }

  _subscribeToEvents() {
    this._unsubscribers = [];

    if (this.eventBus.subscribe) {
      // Subscribe to test completion to run performance checks
      this._unsubscribers.push(
        this.eventBus.subscribe('TESTS_COMPLETED', this.alias, async (data) => {
          if (this.config.enableAutoProfile && data.success) {
            await this.detectBottlenecks();
          }
        })
      );

      // Subscribe to deployment events
      this._unsubscribers.push(
        this.eventBus.subscribe('EXECUTION_COMPLETED', this.alias, async (data) => {
          // Could run post-deployment performance checks
          this.logger.debug('Execution completed, performance monitoring available');
        })
      );
    }
  }

  _wireSubComponents() {
    // Forward profiler events
    this.profiler.on('hotspot', (data) => {
      this.emit(PerformanceEvents.HOTSPOT_DETECTED, data);
    });

    // Forward benchmark events
    this.benchmarkRunner.on('regression', (data) => {
      this.emit(PerformanceEvents.REGRESSION_DETECTED, data);
    });

    // Forward memory analyzer events
    this.memoryAnalyzer.on('leak', (data) => {
      this.emit(PerformanceEvents.MEMORY_LEAK_DETECTED, data);
    });

    // Forward load tester events
    this.loadTester.on('threshold_exceeded', (data) => {
      this.emit(PerformanceEvents.THRESHOLD_EXCEEDED, data);
    });
  }
}

// Factory function
export function getPerformanceAgent(config = {}) {
  return PerformanceAgent.getInstance(config);
}

export default PerformanceAgent;
