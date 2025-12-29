/**
 * MemoryAnalyzer
 * --------------
 * Analyzes memory usage, detects leaks, and tracks memory patterns.
 *
 * @author Kareem Hussein
 * @company Inweb Software Solutions
 */

import EventEmitter from 'events';
import fs from 'fs/promises';
import path from 'path';
import v8 from 'v8';
import { createLogger } from '../../foundation/common/logger.js';

const logger = createLogger('MemoryAnalyzer');

export class MemoryAnalyzer extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = config;
    this.projectPath = null;
    this.snapshots = [];
    this.history = [];
    this.initialized = false;

    // Memory tracking
    this.baseline = null;
    this.samples = [];
    this.sampleInterval = null;
  }

  /**
   * Initialize the memory analyzer
   */
  async initialize() {
    this.initialized = true;
    logger.debug('MemoryAnalyzer initialized');
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

    // Establish baseline
    this.baseline = this._getMemorySnapshot();
  }

  /**
   * Load memory analysis history
   */
  async _loadHistory() {
    try {
      const historyPath = path.join(this.projectPath, 'memory-history.json');
      const content = await fs.readFile(historyPath, 'utf-8');
      this.history = JSON.parse(content);
      logger.debug(`Loaded ${this.history.length} memory history entries`);
    } catch (error) {
      this.history = [];
    }
  }

  /**
   * Save history
   */
  async _saveHistory() {
    if (!this.projectPath) return;

    const historyPath = path.join(this.projectPath, 'memory-history.json');
    await fs.writeFile(historyPath, JSON.stringify(this.history.slice(-100), null, 2));
  }

  /**
   * Get current memory snapshot
   */
  _getMemorySnapshot() {
    const mem = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();

    return {
      timestamp: Date.now(),
      heapTotal: mem.heapTotal,
      heapUsed: mem.heapUsed,
      external: mem.external,
      arrayBuffers: mem.arrayBuffers,
      rss: mem.rss,
      heapSizeLimit: heapStats.heap_size_limit,
      totalHeapSize: heapStats.total_heap_size,
      usedHeapSize: heapStats.used_heap_size,
      totalPhysicalSize: heapStats.total_physical_size,
      mallocedMemory: heapStats.malloced_memory
    };
  }

  /**
   * Analyze memory usage
   * @param {object} options - Analysis options
   */
  async analyze(options = {}) {
    const duration = options.duration || 5000;
    const sampleRate = options.sampleRate || 100;

    const analysis = {
      id: `mem-${Date.now()}`,
      timestamp: new Date().toISOString(),
      duration,
      samples: [],
      potentialLeaks: [],
      recommendations: []
    };

    // Collect samples
    const startTime = Date.now();
    while (Date.now() - startTime < duration) {
      analysis.samples.push(this._getMemorySnapshot());
      await new Promise(resolve => setTimeout(resolve, sampleRate));
    }

    // Analyze samples
    if (analysis.samples.length > 1) {
      const first = analysis.samples[0];
      const last = analysis.samples[analysis.samples.length - 1];

      analysis.heapGrowth = last.heapUsed - first.heapUsed;
      analysis.heapGrowthPercent = ((analysis.heapGrowth / first.heapUsed) * 100).toFixed(2);

      // Calculate average and peak
      const heapValues = analysis.samples.map(s => s.heapUsed);
      analysis.heapAverage = Math.round(heapValues.reduce((a, b) => a + b, 0) / heapValues.length);
      analysis.heapPeak = Math.max(...heapValues);
      analysis.heapMin = Math.min(...heapValues);

      // Detect potential memory leak
      if (analysis.heapGrowthPercent > 10 && duration > 3000) {
        const leak = {
          type: 'heap_growth',
          severity: analysis.heapGrowthPercent > 25 ? 'high' : 'medium',
          growth: analysis.heapGrowth,
          growthPercent: analysis.heapGrowthPercent,
          message: `Heap grew by ${analysis.heapGrowthPercent}% during ${duration}ms`
        };

        analysis.potentialLeaks.push(leak);
        this.emit('leak', leak);
      }

      // Check for high memory usage
      const heapUsedPercent = (last.heapUsed / last.heapSizeLimit) * 100;
      analysis.heapUsedPercent = parseFloat(heapUsedPercent.toFixed(2));

      if (heapUsedPercent > 80) {
        analysis.recommendations.push({
          type: 'high_memory',
          severity: heapUsedPercent > 90 ? 'critical' : 'high',
          message: `Heap usage at ${heapUsedPercent.toFixed(1)}% of limit`,
          action: 'Consider increasing heap size or optimizing memory usage'
        });
      }
    }

    // Save to history
    this.history.push({
      id: analysis.id,
      timestamp: analysis.timestamp,
      heapGrowth: analysis.heapGrowth,
      heapUsedPercent: analysis.heapUsedPercent,
      potentialLeaks: analysis.potentialLeaks.length
    });
    await this._saveHistory();

    return analysis;
  }

  /**
   * Get quick memory analysis
   */
  async getQuickAnalysis() {
    const mem = this._getMemorySnapshot();

    return {
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      heapUsedPercent: parseFloat(((mem.heapUsed / mem.heapTotal) * 100).toFixed(2)),
      heapUsedMB: parseFloat((mem.heapUsed / 1024 / 1024).toFixed(2)),
      rssMB: parseFloat((mem.rss / 1024 / 1024).toFixed(2)),
      externalMB: parseFloat((mem.external / 1024 / 1024).toFixed(2)),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Take a heap snapshot
   */
  async takeSnapshot() {
    const snapshot = {
      id: `snapshot-${Date.now()}`,
      timestamp: new Date().toISOString(),
      memory: this._getMemorySnapshot(),
      heapSpaceStats: v8.getHeapSpaceStatistics()
    };

    this.snapshots.push(snapshot);

    // Keep only last 10 snapshots
    if (this.snapshots.length > 10) {
      this.snapshots = this.snapshots.slice(-10);
    }

    return snapshot;
  }

  /**
   * Compare two snapshots
   * @param {string} snapshot1Id - First snapshot ID
   * @param {string} snapshot2Id - Second snapshot ID
   */
  async compare(snapshot1Id, snapshot2Id) {
    const s1 = this.snapshots.find(s => s.id === snapshot1Id);
    const s2 = this.snapshots.find(s => s.id === snapshot2Id);

    if (!s1 || !s2) {
      throw new Error('Snapshot not found');
    }

    const comparison = {
      snapshot1: snapshot1Id,
      snapshot2: snapshot2Id,
      timeDelta: new Date(s2.timestamp) - new Date(s1.timestamp),
      heapDelta: s2.memory.heapUsed - s1.memory.heapUsed,
      heapDeltaPercent: ((s2.memory.heapUsed - s1.memory.heapUsed) / s1.memory.heapUsed * 100).toFixed(2),
      rssDelta: s2.memory.rss - s1.memory.rss,
      externalDelta: s2.memory.external - s1.memory.external
    };

    // Analyze heap spaces
    comparison.heapSpaceDeltas = {};
    for (let i = 0; i < s1.heapSpaceStats.length; i++) {
      const space1 = s1.heapSpaceStats[i];
      const space2 = s2.heapSpaceStats[i];

      if (space1 && space2) {
        comparison.heapSpaceDeltas[space1.space_name] = {
          sizeDelta: space2.space_size - space1.space_size,
          usedDelta: space2.space_used_size - space1.space_used_size
        };
      }
    }

    // Determine if there might be a leak
    comparison.possibleLeak = comparison.heapDelta > 0 &&
      parseFloat(comparison.heapDeltaPercent) > 5 &&
      comparison.timeDelta < 60000; // Within a minute

    return comparison;
  }

  /**
   * Start continuous monitoring
   * @param {number} interval - Sample interval in ms
   */
  startMonitoring(interval = 1000) {
    this.stopMonitoring();

    this.sampleInterval = setInterval(() => {
      const sample = this._getMemorySnapshot();
      this.samples.push(sample);

      // Keep only last 1000 samples
      if (this.samples.length > 1000) {
        this.samples = this.samples.slice(-1000);
      }

      // Check for sudden spikes
      if (this.samples.length > 10) {
        const recent = this.samples.slice(-10);
        const avgHeap = recent.reduce((sum, s) => sum + s.heapUsed, 0) / 10;

        if (sample.heapUsed > avgHeap * 1.5) {
          this.emit('spike', {
            current: sample.heapUsed,
            average: avgHeap,
            increase: ((sample.heapUsed - avgHeap) / avgHeap * 100).toFixed(2)
          });
        }
      }
    }, interval);

    logger.debug(`Memory monitoring started (${interval}ms interval)`);
  }

  /**
   * Stop continuous monitoring
   */
  stopMonitoring() {
    if (this.sampleInterval) {
      clearInterval(this.sampleInterval);
      this.sampleInterval = null;
      logger.debug('Memory monitoring stopped');
    }
  }

  /**
   * Get memory summary
   */
  async getSummary() {
    const current = this._getMemorySnapshot();
    const baselineComparison = this.baseline
      ? {
          heapGrowth: current.heapUsed - this.baseline.heapUsed,
          heapGrowthPercent: ((current.heapUsed - this.baseline.heapUsed) / this.baseline.heapUsed * 100).toFixed(2)
        }
      : null;

    return {
      current: {
        heapUsedMB: (current.heapUsed / 1024 / 1024).toFixed(2),
        heapTotalMB: (current.heapTotal / 1024 / 1024).toFixed(2),
        rssMB: (current.rss / 1024 / 1024).toFixed(2),
        heapUsedPercent: ((current.heapUsed / current.heapTotal) * 100).toFixed(2)
      },
      baseline: baselineComparison,
      snapshotCount: this.snapshots.length,
      historyCount: this.history.length
    };
  }
}

export default MemoryAnalyzer;
