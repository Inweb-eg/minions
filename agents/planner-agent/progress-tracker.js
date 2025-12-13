/**
 * Progress Tracker
 * ================
 * Tracks real-time completion percentage, velocity calculation,
 * ETA prediction, and blocker identification.
 */

import EventEmitter from 'events';

// Progress status indicators
export const ProgressStatus = {
  ON_TRACK: 'on_track',
  AT_RISK: 'at_risk',
  BEHIND: 'behind',
  BLOCKED: 'blocked',
  COMPLETED: 'completed'
};

export class ProgressTracker extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      velocityWindowSize: config.velocityWindowSize || 10, // Last N tasks for velocity calc
      atRiskThreshold: config.atRiskThreshold || 0.15, // 15% behind schedule
      behindThreshold: config.behindThreshold || 0.30, // 30% behind schedule
      blockerDetectionThreshold: config.blockerDetectionThreshold || 3, // 3 consecutive failures
      ...config
    };

    // Plan tracking
    this.plan = null;
    this.taskStatuses = new Map(); // taskId -> status info

    // Progress metrics
    this.metrics = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      skippedTasks: 0,
      inProgressTasks: 0
    };

    // Velocity tracking
    this.completionTimes = []; // Array of { taskId, duration, complexity }
    this.startTime = null;

    // Blocker detection
    this.consecutiveFailures = new Map(); // agentId -> count
  }

  /**
   * Initialize the tracker
   */
  async initialize() {
    this.startTime = Date.now();
    return { success: true };
  }

  /**
   * Initialize tracking for a plan
   */
  initializePlan(plan) {
    this.plan = plan;
    this.taskStatuses.clear();
    this.completionTimes = [];
    this.consecutiveFailures.clear();
    this.startTime = Date.now();

    // Initialize task statuses
    for (const task of plan.tasks) {
      this.taskStatuses.set(task.id, {
        taskId: task.id,
        status: 'pending',
        complexity: task.complexity || 3,
        startTime: null,
        endTime: null,
        duration: null,
        retries: 0
      });
    }

    // Update metrics
    this.metrics = {
      totalTasks: plan.tasks.length,
      completedTasks: 0,
      failedTasks: 0,
      skippedTasks: 0,
      inProgressTasks: 0
    };

    return { success: true };
  }

  /**
   * Mark task as started
   */
  markTaskStarted(taskId) {
    const status = this.taskStatuses.get(taskId);
    if (status) {
      status.status = 'running';
      status.startTime = Date.now();
      this.metrics.inProgressTasks++;
    }
  }

  /**
   * Mark task as completed
   */
  markTaskCompleted(taskId, result = {}) {
    const status = this.taskStatuses.get(taskId);
    if (!status) return;

    const now = Date.now();
    status.status = 'completed';
    status.endTime = now;
    status.duration = status.startTime ? now - status.startTime : 0;
    status.result = result;

    // Update metrics
    this.metrics.completedTasks++;
    if (status.status === 'running') {
      this.metrics.inProgressTasks--;
    }

    // Track for velocity calculation
    this.completionTimes.push({
      taskId,
      duration: status.duration,
      complexity: status.complexity
    });

    // Keep only last N completions
    if (this.completionTimes.length > this.config.velocityWindowSize) {
      this.completionTimes.shift();
    }

    // Reset consecutive failures for any associated agent
    if (result.agentId) {
      this.consecutiveFailures.set(result.agentId, 0);
    }
  }

  /**
   * Mark task as failed
   */
  markTaskFailed(taskId, error = null, agentId = null) {
    const status = this.taskStatuses.get(taskId);
    if (!status) return;

    status.status = 'failed';
    status.endTime = Date.now();
    status.error = error;
    status.retries++;

    // Update metrics
    this.metrics.failedTasks++;
    if (status.status === 'running') {
      this.metrics.inProgressTasks--;
    }

    // Track consecutive failures for blocker detection
    if (agentId) {
      const failures = (this.consecutiveFailures.get(agentId) || 0) + 1;
      this.consecutiveFailures.set(agentId, failures);

      // Check for potential blocker
      if (failures >= this.config.blockerDetectionThreshold) {
        this.emit('blocker:detected', {
          type: 'consecutive_failures',
          agentId,
          failureCount: failures,
          lastTaskId: taskId,
          error
        });
      }
    }
  }

  /**
   * Mark task as skipped
   */
  markTaskSkipped(taskId, reason = null) {
    const status = this.taskStatuses.get(taskId);
    if (status) {
      status.status = 'skipped';
      status.skipReason = reason;
      this.metrics.skippedTasks++;
    }
  }

  /**
   * Get current progress
   */
  getProgress() {
    const percentage = this._calculatePercentage();
    const velocity = this._calculateVelocity();
    const eta = this._calculateETA(velocity);
    const status = this._determineStatus(percentage);

    return {
      percentage: Math.round(percentage * 100) / 100,
      status,
      metrics: { ...this.metrics },
      velocity: {
        tasksPerHour: velocity.tasksPerHour,
        pointsPerHour: velocity.pointsPerHour
      },
      eta: {
        estimatedCompletion: eta.estimatedCompletion,
        remainingTime: eta.remainingTime,
        remainingTasks: eta.remainingTasks
      },
      elapsed: Date.now() - (this.startTime || Date.now()),
      blockers: this._getActiveBlockers()
    };
  }

  /**
   * Get task status
   */
  getTaskStatus(taskId) {
    return this.taskStatuses.get(taskId);
  }

  /**
   * Get all task statuses
   */
  getAllTaskStatuses() {
    return Array.from(this.taskStatuses.values());
  }

  /**
   * Get progress by phase
   */
  getProgressByPhase() {
    if (!this.plan) return {};

    const phaseProgress = {};

    for (const task of this.plan.tasks) {
      const phase = task.phase || 'unknown';
      if (!phaseProgress[phase]) {
        phaseProgress[phase] = {
          total: 0,
          completed: 0,
          failed: 0,
          percentage: 0
        };
      }

      phaseProgress[phase].total++;

      const status = this.taskStatuses.get(task.id);
      if (status?.status === 'completed') {
        phaseProgress[phase].completed++;
      } else if (status?.status === 'failed') {
        phaseProgress[phase].failed++;
      }
    }

    // Calculate percentages
    for (const phase of Object.keys(phaseProgress)) {
      const p = phaseProgress[phase];
      p.percentage = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
    }

    return phaseProgress;
  }

  /**
   * Get progress report
   */
  getReport() {
    const progress = this.getProgress();
    const phaseProgress = this.getProgressByPhase();

    return {
      summary: {
        progress: progress.percentage,
        status: progress.status,
        elapsed: this._formatDuration(progress.elapsed),
        eta: progress.eta.remainingTime
          ? this._formatDuration(progress.eta.remainingTime)
          : 'Unknown'
      },
      tasks: {
        total: this.metrics.totalTasks,
        completed: this.metrics.completedTasks,
        failed: this.metrics.failedTasks,
        skipped: this.metrics.skippedTasks,
        inProgress: this.metrics.inProgressTasks,
        remaining: this.metrics.totalTasks -
          this.metrics.completedTasks -
          this.metrics.failedTasks -
          this.metrics.skippedTasks
      },
      velocity: progress.velocity,
      phases: phaseProgress,
      blockers: progress.blockers,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Reset tracker
   */
  reset() {
    this.plan = null;
    this.taskStatuses.clear();
    this.completionTimes = [];
    this.consecutiveFailures.clear();
    this.metrics = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      skippedTasks: 0,
      inProgressTasks: 0
    };
  }

  // ==================== Private Methods ====================

  /**
   * Calculate completion percentage
   */
  _calculatePercentage() {
    if (this.metrics.totalTasks === 0) return 0;

    // Weight completed tasks fully, failed/skipped partially
    const effectiveCompleted = this.metrics.completedTasks +
      (this.metrics.skippedTasks * 0.5);

    return (effectiveCompleted / this.metrics.totalTasks) * 100;
  }

  /**
   * Calculate velocity (tasks per hour, points per hour)
   */
  _calculateVelocity() {
    if (this.completionTimes.length === 0) {
      return { tasksPerHour: 0, pointsPerHour: 0 };
    }

    // Calculate average completion time
    const totalDuration = this.completionTimes.reduce((sum, ct) => sum + ct.duration, 0);
    const avgDuration = totalDuration / this.completionTimes.length;

    // Tasks per hour
    const tasksPerHour = avgDuration > 0
      ? (3600000 / avgDuration) // ms to hours
      : 0;

    // Points (complexity) per hour
    const totalComplexity = this.completionTimes.reduce((sum, ct) => sum + ct.complexity, 0);
    const pointsPerHour = totalDuration > 0
      ? (totalComplexity / totalDuration) * 3600000
      : 0;

    return {
      tasksPerHour: Math.round(tasksPerHour * 10) / 10,
      pointsPerHour: Math.round(pointsPerHour * 10) / 10
    };
  }

  /**
   * Calculate ETA based on velocity
   */
  _calculateETA(velocity) {
    const remainingTasks = this.metrics.totalTasks -
      this.metrics.completedTasks -
      this.metrics.failedTasks -
      this.metrics.skippedTasks;

    if (remainingTasks <= 0) {
      return {
        estimatedCompletion: new Date().toISOString(),
        remainingTime: 0,
        remainingTasks: 0
      };
    }

    if (velocity.tasksPerHour <= 0) {
      return {
        estimatedCompletion: null,
        remainingTime: null,
        remainingTasks
      };
    }

    // Estimate remaining time
    const hoursRemaining = remainingTasks / velocity.tasksPerHour;
    const msRemaining = hoursRemaining * 3600000;

    return {
      estimatedCompletion: new Date(Date.now() + msRemaining).toISOString(),
      remainingTime: msRemaining,
      remainingTasks
    };
  }

  /**
   * Determine overall status
   */
  _determineStatus(percentage) {
    // Check for blockers first
    if (this._getActiveBlockers().length > 0) {
      return ProgressStatus.BLOCKED;
    }

    // Check if completed
    if (percentage >= 100) {
      return ProgressStatus.COMPLETED;
    }

    // Calculate expected progress based on elapsed time
    if (!this.plan?.estimatedDuration || !this.startTime) {
      return ProgressStatus.ON_TRACK;
    }

    const elapsed = Date.now() - this.startTime;
    const expectedPercentage = (elapsed / this.plan.estimatedDuration) * 100;
    const deviation = expectedPercentage - percentage;

    if (deviation > this.config.behindThreshold * 100) {
      return ProgressStatus.BEHIND;
    }

    if (deviation > this.config.atRiskThreshold * 100) {
      return ProgressStatus.AT_RISK;
    }

    return ProgressStatus.ON_TRACK;
  }

  /**
   * Get active blockers
   */
  _getActiveBlockers() {
    const blockers = [];

    // Check for agents with consecutive failures
    for (const [agentId, failures] of this.consecutiveFailures) {
      if (failures >= this.config.blockerDetectionThreshold) {
        blockers.push({
          type: 'agent_failures',
          agentId,
          failureCount: failures
        });
      }
    }

    // Check for high failure rate
    if (this.metrics.totalTasks > 0) {
      const failureRate = this.metrics.failedTasks / this.metrics.totalTasks;
      if (failureRate > 0.3) { // More than 30% failure rate
        blockers.push({
          type: 'high_failure_rate',
          rate: failureRate
        });
      }
    }

    return blockers;
  }

  /**
   * Format duration for display
   */
  _formatDuration(ms) {
    if (!ms || ms < 0) return '0s';

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }
}

export default ProgressTracker;
