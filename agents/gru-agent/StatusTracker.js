/**
 * StatusTracker
 * -------------
 * Tracks execution status and broadcasts updates to the UI in real-time.
 *
 * Part of Gru Agent - Minions Client Interface System
 */

import EventEmitter from 'events';
import { createLogger } from '../../foundation/common/logger.js';

// Status phases
export const Phase = {
  IDLE: 'idle',
  PLANNING: 'planning',
  CONNECTING: 'connecting',
  SCANNING: 'scanning',
  ANALYZING: 'analyzing',
  BUILDING: 'building',
  TESTING: 'testing',
  FIXING: 'fixing',
  VERIFYING: 'verifying',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  ERROR: 'error'
};

export class StatusTracker extends EventEmitter {
  constructor(config = {}) {
    super();
    this.logger = createLogger('StatusTracker');

    this.config = {
      maxHistoryLength: config.maxHistoryLength || 100,
      ...config
    };

    this.currentPhase = Phase.IDLE;
    this.currentProject = null;
    this.progress = 0;
    this.history = [];
    this.startTime = null;
    this.errors = [];
    this.isTracking = false;
  }

  /**
   * Start tracking execution
   * @param {object} project - Project being executed
   */
  start(project) {
    this.currentProject = project;
    this.currentPhase = Phase.PLANNING;
    this.progress = 0;
    this.startTime = new Date();
    this.errors = [];
    this.isTracking = true;

    this._addToHistory({
      phase: Phase.PLANNING,
      message: `Starting execution for project: ${project.name}`,
      progress: 0
    });

    this.emit('started', this.getStatus());
    return this.getStatus();
  }

  /**
   * Update current status
   * @param {object} update - Status update
   */
  update(update) {
    const { phase, message, progress, data } = update;

    if (phase) {
      this.currentPhase = phase;
    }

    if (progress !== undefined) {
      this.progress = Math.min(100, Math.max(0, progress));
    }

    this._addToHistory({
      phase: this.currentPhase,
      message: message || `Phase: ${this.currentPhase}`,
      progress: this.progress,
      data
    });

    const status = this.getStatus();
    this.emit('updated', status);

    return status;
  }

  /**
   * Handle Silas (ProjectManager) events
   * @param {string} event - Event name
   * @param {object} data - Event data
   */
  onSilasEvent(event, data) {
    const eventMap = {
      'project:connecting': { phase: Phase.CONNECTING, message: 'Connecting to project...' },
      'project:connected': { phase: Phase.CONNECTING, message: 'Project connected successfully', progress: 10 },
      'project:scanning': { phase: Phase.SCANNING, message: 'Scanning project structure...' },
      'project:scanned': { phase: Phase.SCANNING, message: 'Project scan complete', progress: 20 },
      'project:error': { phase: Phase.ERROR, message: data?.error || 'Project error' }
    };

    const mapping = eventMap[event];
    if (mapping) {
      this.update({
        ...mapping,
        data: { source: 'silas', event, ...data }
      });
    }
  }

  /**
   * Handle Lucy (ProjectCompletion) events
   * @param {string} event - Event name
   * @param {object} data - Event data
   */
  onLucyEvent(event, data) {
    const eventMap = {
      'completion:started': { phase: Phase.ANALYZING, message: 'Starting autonomous completion...', progress: 25 },
      'completion:iteration:started': {
        phase: Phase.ANALYZING,
        message: `Iteration ${data?.iteration || '?'} started...`
      },
      'completion:gap:detected': {
        phase: Phase.ANALYZING,
        message: `Found ${data?.gaps?.length || 0} gaps to address`
      },
      'completion:progress:updated': {
        phase: Phase.BUILDING,
        message: `Progress: ${data?.percentage || 0}%`,
        progress: Math.min(90, 25 + (data?.percentage || 0) * 0.65)
      },
      'completion:gap:resolved': {
        phase: Phase.BUILDING,
        message: `Resolved: ${data?.gap?.description || 'gap'}`
      },
      'completion:paused': { phase: Phase.PAUSED, message: 'Execution paused' },
      'completion:resumed': { phase: Phase.BUILDING, message: 'Execution resumed' },
      'completion:finished': {
        phase: Phase.COMPLETED,
        message: `Completed at ${data?.percentage || 100}%`,
        progress: 100
      },
      'completion:error': { phase: Phase.ERROR, message: data?.error || 'Completion error' }
    };

    const mapping = eventMap[event];
    if (mapping) {
      this.update({
        ...mapping,
        data: { source: 'lucy', event, ...data }
      });
    }
  }

  /**
   * Add error
   * @param {object} error - Error details
   */
  addError(error) {
    this.errors.push({
      timestamp: new Date().toISOString(),
      ...error
    });

    this.update({
      phase: Phase.ERROR,
      message: error.message || 'An error occurred',
      data: { error }
    });
  }

  /**
   * Set phase to paused
   */
  pause() {
    this.update({
      phase: Phase.PAUSED,
      message: 'Execution paused by user'
    });
  }

  /**
   * Resume from paused
   */
  resume() {
    this.update({
      phase: Phase.BUILDING,
      message: 'Execution resumed'
    });
  }

  /**
   * Mark as completed
   */
  complete(summary = {}) {
    this.update({
      phase: Phase.COMPLETED,
      message: summary.message || 'Execution completed successfully',
      progress: 100,
      data: summary
    });

    this.isTracking = false;
  }

  /**
   * Get current status
   */
  getStatus() {
    const now = new Date();
    const elapsed = this.startTime
      ? Math.round((now - this.startTime) / 1000)
      : 0;

    return {
      phase: this.currentPhase,
      progress: this.progress,
      project: this.currentProject?.name || null,
      isTracking: this.isTracking,
      elapsed,
      elapsedFormatted: this._formatDuration(elapsed),
      errors: this.errors,
      lastUpdate: this.history.length > 0
        ? this.history[this.history.length - 1]
        : null
    };
  }

  /**
   * Get status history
   * @param {number} limit - Maximum entries to return
   */
  getHistory(limit = 0) {
    if (limit > 0) {
      return this.history.slice(-limit);
    }
    return [...this.history];
  }

  /**
   * Add entry to history
   * @private
   */
  _addToHistory(entry) {
    this.history.push({
      timestamp: new Date().toISOString(),
      ...entry
    });

    // Trim history if too long
    if (this.history.length > this.config.maxHistoryLength) {
      this.history = this.history.slice(-this.config.maxHistoryLength);
    }
  }

  /**
   * Format duration in seconds to human readable
   * @private
   */
  _formatDuration(seconds) {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) {
      return `${mins}m ${secs}s`;
    }
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  }

  /**
   * Reset tracker
   */
  reset() {
    this.currentPhase = Phase.IDLE;
    this.currentProject = null;
    this.progress = 0;
    this.history = [];
    this.startTime = null;
    this.errors = [];
    this.isTracking = false;

    this.emit('reset');
  }

  /**
   * Shutdown
   */
  async shutdown() {
    this.reset();
    this.removeAllListeners();
  }
}

export default StatusTracker;
