/**
 * Profiler
 * --------
 * CPU and execution profiling for performance analysis.
 * Detects hotspots and provides optimization recommendations.
 *
 * @author Kareem Hussein
 * @company Inweb Software Solutions
 */

import EventEmitter from 'events';
import fs from 'fs/promises';
import path from 'path';
import { performance, PerformanceObserver } from 'perf_hooks';
import { createLogger } from '../../foundation/common/logger.js';

const logger = createLogger('Profiler');

export class Profiler extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = config;
    this.projectPath = null;
    this.profiles = [];
    this.initialized = false;
    this.observer = null;
  }

  /**
   * Initialize the profiler
   */
  async initialize() {
    // Setup performance observer
    this.observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      for (const entry of entries) {
        this.profiles.push({
          name: entry.name,
          entryType: entry.entryType,
          startTime: entry.startTime,
          duration: entry.duration
        });
      }
    });

    this.observer.observe({ entryTypes: ['measure', 'function'] });

    this.initialized = true;
    logger.debug('Profiler initialized');
  }

  /**
   * Set the project path
   * @param {string} projectPath - Path to profiles directory
   */
  async setProjectPath(projectPath) {
    this.projectPath = projectPath;
    await fs.mkdir(projectPath, { recursive: true });

    // Load existing profiles
    await this._loadProfiles();
  }

  /**
   * Load existing profiles
   */
  async _loadProfiles() {
    try {
      const files = await fs.readdir(this.projectPath);
      const profileFiles = files.filter(f => f.endsWith('.json'));

      this.profiles = [];
      for (const file of profileFiles.slice(-10)) { // Keep last 10
        const content = await fs.readFile(path.join(this.projectPath, file), 'utf-8');
        this.profiles.push(JSON.parse(content));
      }

      logger.debug(`Loaded ${this.profiles.length} profiles`);
    } catch (error) {
      this.profiles = [];
    }
  }

  /**
   * Profile code execution
   * @param {object} options - Profile options
   */
  async profile(options = {}) {
    const profileId = `profile-${Date.now()}`;

    const result = {
      id: profileId,
      timestamp: new Date().toISOString(),
      duration: 0,
      cpuProfile: null,
      memoryProfile: null,
      measurements: []
    };

    const startTime = performance.now();

    try {
      // Collect CPU metrics
      result.cpuProfile = await this._collectCPUMetrics(options);

      // Collect memory metrics
      result.memoryProfile = this._collectMemoryMetrics();

      result.duration = performance.now() - startTime;

      // Save profile
      await this._saveProfile(result);

      return result;
    } catch (error) {
      logger.error(`Profile failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Collect CPU metrics
   */
  async _collectCPUMetrics(options) {
    const cpuUsage = process.cpuUsage();

    // Simulate profiling period
    const duration = options.duration || 1000;
    await new Promise(resolve => setTimeout(resolve, duration));

    const cpuUsageAfter = process.cpuUsage(cpuUsage);

    return {
      user: cpuUsageAfter.user / 1000, // Convert to ms
      system: cpuUsageAfter.system / 1000,
      total: (cpuUsageAfter.user + cpuUsageAfter.system) / 1000,
      duration,
      utilization: ((cpuUsageAfter.user + cpuUsageAfter.system) / (duration * 1000)) * 100
    };
  }

  /**
   * Collect memory metrics
   */
  _collectMemoryMetrics() {
    const memUsage = process.memoryUsage();

    return {
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
      rss: memUsage.rss,
      heapUsedPercent: ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2)
    };
  }

  /**
   * Profile a specific function
   * @param {Function} fn - Function to profile
   * @param {*} args - Arguments to pass
   */
  async profileFunction(fn, ...args) {
    const name = fn.name || 'anonymous';
    const measureName = `fn:${name}:${Date.now()}`;

    performance.mark(`${measureName}:start`);

    const memBefore = process.memoryUsage();
    const cpuBefore = process.cpuUsage();

    let result;
    let error = null;

    try {
      result = await fn(...args);
    } catch (e) {
      error = e;
    }

    const cpuAfter = process.cpuUsage(cpuBefore);
    const memAfter = process.memoryUsage();

    performance.mark(`${measureName}:end`);
    performance.measure(measureName, `${measureName}:start`, `${measureName}:end`);

    const measure = performance.getEntriesByName(measureName)[0];

    const profile = {
      name,
      duration: measure?.duration || 0,
      cpu: {
        user: cpuAfter.user / 1000,
        system: cpuAfter.system / 1000
      },
      memory: {
        heapDelta: memAfter.heapUsed - memBefore.heapUsed,
        externalDelta: memAfter.external - memBefore.external
      },
      success: !error,
      error: error?.message
    };

    // Check for hotspot
    if (profile.duration > 100) { // > 100ms
      this.emit('hotspot', {
        type: 'slow_function',
        name,
        duration: profile.duration,
        threshold: 100
      });
    }

    if (error) throw error;
    return { result, profile };
  }

  /**
   * Get a quick CPU profile
   */
  async getQuickProfile() {
    const cpuUsage = process.cpuUsage();
    await new Promise(resolve => setTimeout(resolve, 100));
    const cpuUsageAfter = process.cpuUsage(cpuUsage);

    return {
      cpuUsage: ((cpuUsageAfter.user + cpuUsageAfter.system) / 100000) * 100,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get profiler summary
   */
  async getSummary() {
    return {
      profileCount: this.profiles.length,
      lastProfile: this.profiles[this.profiles.length - 1]?.timestamp || null,
      averageDuration: this.profiles.length > 0
        ? (this.profiles.reduce((sum, p) => sum + (p.duration || 0), 0) / this.profiles.length).toFixed(2)
        : 0
    };
  }

  /**
   * Save a profile
   */
  async _saveProfile(profile) {
    if (!this.projectPath) return;

    const filename = `${profile.id}.json`;
    const filepath = path.join(this.projectPath, filename);
    await fs.writeFile(filepath, JSON.stringify(profile, null, 2));

    this.profiles.push(profile);
    logger.debug(`Profile saved: ${filename}`);
  }

  /**
   * Save state
   */
  async save() {
    // Profiles are saved individually
  }
}

export default Profiler;
