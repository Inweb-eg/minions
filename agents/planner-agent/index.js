/**
 * Minions - Planner-Agent
 * =======================
 * The execution engine that converts plans into action, coordinates agent work,
 * and drives the project toward completion without human intervention.
 *
 * Responsibilities:
 * - Generate execution plans from Vision-Agent tasks
 * - Coordinate agent assignments and monitor progress
 * - Track completion percentage and identify blockers
 * - Manage Build → Test → Fix iteration cycles
 *
 * Dependencies: Phase 0 (Foundation), Phase 1 (Vision-Agent), Phase 2 (Architect-Agent)
 */

import EventEmitter from 'events';
import path from 'path';
import fs from 'fs/promises';

import ExecutionPlanner from './execution-planner.js';
import AgentCoordinator from './coordinator.js';
import ProgressTracker from './progress-tracker.js';
import IterationManager from './iteration-manager.js';

// Agent States
export const AgentState = {
  IDLE: 'IDLE',
  INITIALIZING: 'INITIALIZING',
  PLANNING: 'PLANNING',
  EXECUTING: 'EXECUTING',
  COORDINATING: 'COORDINATING',
  ITERATING: 'ITERATING',
  WAITING: 'WAITING',
  BLOCKED: 'BLOCKED',
  ERROR: 'ERROR',
  SHUTDOWN: 'SHUTDOWN'
};

// Event Types this agent emits/listens to
export const PlannerEvents = {
  // Incoming events (requests to Planner-Agent)
  CREATE_PLAN: 'planner:plan:create',
  EXECUTE_PLAN: 'planner:plan:execute',
  PAUSE_EXECUTION: 'planner:execution:pause',
  RESUME_EXECUTION: 'planner:execution:resume',
  CANCEL_EXECUTION: 'planner:execution:cancel',
  GET_STATUS: 'planner:status:get',

  // Outgoing events (Planner-Agent outputs)
  PLAN_CREATED: 'planner:plan:created',
  PLAN_UPDATED: 'planner:plan:updated',
  EXECUTION_STARTED: 'planner:execution:started',
  EXECUTION_PAUSED: 'planner:execution:paused',
  EXECUTION_RESUMED: 'planner:execution:resumed',
  EXECUTION_COMPLETED: 'planner:execution:completed',
  EXECUTION_FAILED: 'planner:execution:failed',
  TASK_ASSIGNED: 'planner:task:assigned',
  TASK_STARTED: 'planner:task:started',
  TASK_COMPLETED: 'planner:task:completed',
  TASK_FAILED: 'planner:task:failed',
  PROGRESS_UPDATED: 'planner:progress:updated',
  BLOCKER_DETECTED: 'planner:blocker:detected',
  BLOCKER_RESOLVED: 'planner:blocker:resolved',
  ITERATION_STARTED: 'planner:iteration:started',
  ITERATION_COMPLETED: 'planner:iteration:completed',
  ESCALATION_REQUIRED: 'planner:escalation:required'
};

// Execution status
export const ExecutionStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

export class PlannerAgent extends EventEmitter {
  constructor(config = {}) {
    super();

    this.name = 'Planner-Agent';
    this.version = '1.0.0';
    this.state = AgentState.IDLE;

    // Configuration
    this.config = {
      projectRoot: config.projectRoot || process.cwd(),
      stateDir: config.stateDir || '.planner',
      maxConcurrentTasks: config.maxConcurrentTasks || 3,
      maxRetries: config.maxRetries || 3,
      taskTimeout: config.taskTimeout || 300000, // 5 minutes
      iterationTimeout: config.iterationTimeout || 1800000, // 30 minutes
      checkpointInterval: config.checkpointInterval || 60000, // 1 minute
      enableAutoRetry: config.enableAutoRetry ?? true,
      ...config
    };

    // Initialize sub-components
    this.executionPlanner = new ExecutionPlanner(this.config);
    this.coordinator = new AgentCoordinator(this.config);
    this.progressTracker = new ProgressTracker(this.config);
    this.iterationManager = new IterationManager(this.config);

    // State storage
    this.currentPlan = null;
    this.executionHistory = [];
    this.blockers = new Map();
    this.checkpoints = [];

    // Metrics
    this.metrics = {
      plansCreated: 0,
      plansExecuted: 0,
      plansCompleted: 0,
      plansFailed: 0,
      tasksAssigned: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      iterationsRun: 0,
      blockersDetected: 0,
      blockersResolved: 0,
      totalExecutionTime: 0
    };

    this._setupInternalHandlers();
  }

  /**
   * Initialize the Planner-Agent
   */
  async initialize(eventBus = null) {
    this.state = AgentState.INITIALIZING;

    try {
      // Connect to event bus if provided
      if (eventBus) {
        this.eventBus = eventBus;
        this._subscribeToEvents();
      }

      // Create required directories
      await this._ensureDirectories();

      // Load existing state if present
      await this._loadExistingState();

      // Initialize sub-components
      await this.coordinator.initialize(eventBus);
      await this.progressTracker.initialize();
      await this.iterationManager.initialize(eventBus);

      this.state = AgentState.IDLE;
      this.emit('initialized', { agent: this.name, version: this.version });

      return { success: true, agent: this.name };
    } catch (error) {
      this.state = AgentState.ERROR;
      this.emit('error', { agent: this.name, error: error.message });
      throw error;
    }
  }

  /**
   * Create an execution plan from tasks
   */
  async createPlan(tasks, options = {}) {
    this.state = AgentState.PLANNING;

    try {
      const plan = await this.executionPlanner.createPlan(tasks, {
        maxConcurrency: this.config.maxConcurrentTasks,
        ...options
      });

      this.currentPlan = plan;
      this.metrics.plansCreated++;

      // Initialize progress tracking
      this.progressTracker.initializePlan(plan);

      // Persist state
      await this._saveState();

      // Emit events
      this.emit(PlannerEvents.PLAN_CREATED, { plan });

      if (this.eventBus) {
        this.eventBus.publish(PlannerEvents.PLAN_CREATED, {
          agent: this.name,
          plan
        });
      }

      this.state = AgentState.IDLE;

      return {
        success: true,
        plan,
        taskCount: plan.tasks.length,
        estimatedDuration: plan.estimatedDuration
      };
    } catch (error) {
      this.state = AgentState.ERROR;
      this.emit('error', { operation: 'createPlan', error: error.message });
      throw error;
    }
  }

  /**
   * Execute the current plan
   */
  async executePlan(planId = null) {
    if (!this.currentPlan && !planId) {
      throw new Error('No plan available to execute');
    }

    const plan = planId ? await this._loadPlan(planId) : this.currentPlan;
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    this.state = AgentState.EXECUTING;
    plan.status = ExecutionStatus.RUNNING;
    plan.startedAt = new Date().toISOString();

    this.metrics.plansExecuted++;

    // Emit execution started
    this.emit(PlannerEvents.EXECUTION_STARTED, { planId: plan.id });

    if (this.eventBus) {
      this.eventBus.publish(PlannerEvents.EXECUTION_STARTED, {
        agent: this.name,
        planId: plan.id
      });
    }

    try {
      // Execute plan through coordinator
      const result = await this._executeWithCoordinator(plan);

      plan.status = result.success ? ExecutionStatus.COMPLETED : ExecutionStatus.FAILED;
      plan.completedAt = new Date().toISOString();
      plan.result = result;

      // Update metrics
      if (result.success) {
        this.metrics.plansCompleted++;
      } else {
        this.metrics.plansFailed++;
      }

      this.metrics.totalExecutionTime += Date.now() - new Date(plan.startedAt).getTime();

      // Record in history
      this.executionHistory.push({
        planId: plan.id,
        status: plan.status,
        startedAt: plan.startedAt,
        completedAt: plan.completedAt,
        result: result.summary
      });

      // Persist state
      await this._saveState();

      // Emit completion
      const eventType = result.success
        ? PlannerEvents.EXECUTION_COMPLETED
        : PlannerEvents.EXECUTION_FAILED;

      this.emit(eventType, { planId: plan.id, result });

      if (this.eventBus) {
        this.eventBus.publish(eventType, {
          agent: this.name,
          planId: plan.id,
          result
        });
      }

      this.state = AgentState.IDLE;

      return result;
    } catch (error) {
      plan.status = ExecutionStatus.FAILED;
      plan.completedAt = new Date().toISOString();
      plan.error = error.message;

      this.metrics.plansFailed++;
      this.state = AgentState.ERROR;

      this.emit(PlannerEvents.EXECUTION_FAILED, {
        planId: plan.id,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Pause plan execution
   */
  async pauseExecution() {
    if (this.state !== AgentState.EXECUTING) {
      return { success: false, error: 'No execution in progress' };
    }

    this.state = AgentState.WAITING;

    if (this.currentPlan) {
      this.currentPlan.status = ExecutionStatus.PAUSED;
    }

    // Create checkpoint
    await this._createCheckpoint();

    // Pause coordinator
    await this.coordinator.pause();

    this.emit(PlannerEvents.EXECUTION_PAUSED, { planId: this.currentPlan?.id });

    return { success: true };
  }

  /**
   * Resume plan execution
   */
  async resumeExecution() {
    if (this.state !== AgentState.WAITING || !this.currentPlan) {
      return { success: false, error: 'No paused execution to resume' };
    }

    this.state = AgentState.EXECUTING;
    this.currentPlan.status = ExecutionStatus.RUNNING;

    // Resume coordinator
    await this.coordinator.resume();

    this.emit(PlannerEvents.EXECUTION_RESUMED, { planId: this.currentPlan.id });

    return { success: true };
  }

  /**
   * Cancel plan execution
   */
  async cancelExecution() {
    if (!this.currentPlan) {
      return { success: false, error: 'No execution to cancel' };
    }

    this.currentPlan.status = ExecutionStatus.CANCELLED;
    this.currentPlan.completedAt = new Date().toISOString();

    // Stop coordinator
    await this.coordinator.stop();

    this.state = AgentState.IDLE;

    this.emit(PlannerEvents.EXECUTION_COMPLETED, {
      planId: this.currentPlan.id,
      cancelled: true
    });

    return { success: true };
  }

  /**
   * Run a Build → Test → Fix iteration cycle
   */
  async runIteration(options = {}) {
    this.state = AgentState.ITERATING;

    try {
      const result = await this.iterationManager.runCycle({
        maxRetries: this.config.maxRetries,
        timeout: this.config.iterationTimeout,
        ...options
      });

      this.metrics.iterationsRun++;

      this.emit(PlannerEvents.ITERATION_COMPLETED, { result });

      if (this.eventBus) {
        this.eventBus.publish(PlannerEvents.ITERATION_COMPLETED, {
          agent: this.name,
          result
        });
      }

      this.state = AgentState.IDLE;

      return result;
    } catch (error) {
      this.state = AgentState.ERROR;
      throw error;
    }
  }

  /**
   * Report a blocker
   */
  async reportBlocker(blocker) {
    const blockerId = `blocker-${Date.now()}`;

    const blockerRecord = {
      id: blockerId,
      ...blocker,
      reportedAt: new Date().toISOString(),
      status: 'active'
    };

    this.blockers.set(blockerId, blockerRecord);
    this.metrics.blockersDetected++;

    // Update state if critical
    if (blocker.severity === 'critical') {
      this.state = AgentState.BLOCKED;
    }

    this.emit(PlannerEvents.BLOCKER_DETECTED, { blocker: blockerRecord });

    if (this.eventBus) {
      this.eventBus.publish(PlannerEvents.BLOCKER_DETECTED, {
        agent: this.name,
        blocker: blockerRecord
      });
    }

    // Check if escalation is needed
    if (blocker.requiresHuman || blocker.severity === 'critical') {
      this.emit(PlannerEvents.ESCALATION_REQUIRED, {
        blocker: blockerRecord,
        reason: blocker.reason || 'Critical blocker requires human intervention'
      });
    }

    return { success: true, blockerId };
  }

  /**
   * Resolve a blocker
   */
  async resolveBlocker(blockerId, resolution) {
    const blocker = this.blockers.get(blockerId);
    if (!blocker) {
      return { success: false, error: 'Blocker not found' };
    }

    blocker.status = 'resolved';
    blocker.resolution = resolution;
    blocker.resolvedAt = new Date().toISOString();

    this.metrics.blockersResolved++;

    // Check if we can unblock
    const activeBlockers = Array.from(this.blockers.values())
      .filter(b => b.status === 'active');

    if (activeBlockers.length === 0 && this.state === AgentState.BLOCKED) {
      this.state = AgentState.IDLE;
    }

    this.emit(PlannerEvents.BLOCKER_RESOLVED, { blockerId, resolution });

    return { success: true };
  }

  /**
   * Get current progress
   */
  getProgress() {
    return this.progressTracker.getProgress();
  }

  /**
   * Get execution status
   */
  getStatus() {
    return {
      state: this.state,
      currentPlan: this.currentPlan ? {
        id: this.currentPlan.id,
        status: this.currentPlan.status,
        progress: this.progressTracker.getProgress()
      } : null,
      activeBlockers: Array.from(this.blockers.values())
        .filter(b => b.status === 'active'),
      metrics: this.getMetrics()
    };
  }

  /**
   * Get current plan
   */
  getPlan() {
    return this.currentPlan;
  }

  /**
   * Get execution history
   */
  getHistory(limit = 10) {
    return this.executionHistory.slice(-limit);
  }

  /**
   * Get agent metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      state: this.state,
      currentProgress: this.progressTracker.getProgress(),
      activeBlockers: this.blockers.size,
      uptime: this._getUptime()
    };
  }

  /**
   * Shutdown the agent
   */
  async shutdown() {
    this.state = AgentState.SHUTDOWN;

    // Create final checkpoint
    await this._createCheckpoint();

    // Persist state
    await this._saveState();

    // Shutdown sub-components
    await this.coordinator.shutdown();
    await this.iterationManager.shutdown();

    this.emit('shutdown', { agent: this.name });
    this.removeAllListeners();
  }

  // ==================== Private Methods ====================

  _setupInternalHandlers() {
    // Handle sub-component events
    this.executionPlanner.on('warning', (warning) => {
      this.emit('warning', { source: 'ExecutionPlanner', ...warning });
    });

    this.coordinator.on('task:assigned', (data) => {
      this.metrics.tasksAssigned++;
      this.emit(PlannerEvents.TASK_ASSIGNED, data);
    });

    this.coordinator.on('task:completed', (data) => {
      this.metrics.tasksCompleted++;
      this.progressTracker.markTaskCompleted(data.taskId);
      this.emit(PlannerEvents.TASK_COMPLETED, data);
      this._emitProgressUpdate();
    });

    this.coordinator.on('task:failed', (data) => {
      this.metrics.tasksFailed++;
      this.progressTracker.markTaskFailed(data.taskId);
      this.emit(PlannerEvents.TASK_FAILED, data);
    });

    this.progressTracker.on('blocker:detected', (data) => {
      this.reportBlocker(data);
    });

    this.iterationManager.on('iteration:started', (data) => {
      this.emit(PlannerEvents.ITERATION_STARTED, data);
    });
  }

  _subscribeToEvents() {
    if (!this.eventBus) return;

    // Listen for plan creation requests
    this.eventBus.subscribe(PlannerEvents.CREATE_PLAN, this.name, async (data) => {
      await this.createPlan(data.tasks, data.options);
    });

    // Listen for execution requests
    this.eventBus.subscribe(PlannerEvents.EXECUTE_PLAN, this.name, async (data) => {
      await this.executePlan(data.planId);
    });

    // Listen for pause requests
    this.eventBus.subscribe(PlannerEvents.PAUSE_EXECUTION, this.name, async () => {
      await this.pauseExecution();
    });

    // Listen for resume requests
    this.eventBus.subscribe(PlannerEvents.RESUME_EXECUTION, this.name, async () => {
      await this.resumeExecution();
    });

    // Listen for status requests
    this.eventBus.subscribe(PlannerEvents.GET_STATUS, this.name, async (data) => {
      const status = this.getStatus();
      if (this.eventBus && data.requestId) {
        this.eventBus.publish(`planner:status:result:${data.requestId}`, {
          agent: this.name,
          status
        });
      }
    });

    // Listen for Vision-Agent feature decomposed events
    this.eventBus.subscribe('vision:feature:decomposed', this.name, async (data) => {
      // Auto-create plan from decomposed features if configured
      if (this.config.autoCreatePlans && data.tasks) {
        await this.createPlan(data.tasks, { source: 'vision-agent' });
      }
    });

    // Listen for test events for iteration management
    this.eventBus.subscribe('TESTS_FAILED', this.name, async (data) => {
      if (this.config.enableAutoRetry && this.state === AgentState.EXECUTING) {
        await this.runIteration({ triggeredBy: 'test-failure', testData: data });
      }
    });
  }

  async _executeWithCoordinator(plan) {
    const startTime = Date.now();

    // Get execution order from plan
    const executionGroups = this.executionPlanner.getExecutionGroups(plan);

    const results = {
      success: true,
      tasksCompleted: 0,
      tasksFailed: 0,
      errors: [],
      summary: {}
    };

    // Execute each group (groups can run in parallel)
    for (const group of executionGroups) {
      if (this.state === AgentState.WAITING) {
        // Paused - wait for resume
        await this._waitForResume();
      }

      if (this.currentPlan?.status === ExecutionStatus.CANCELLED) {
        results.success = false;
        results.cancelled = true;
        break;
      }

      // Execute group tasks through coordinator
      const groupResult = await this.coordinator.executeGroup(group, {
        timeout: this.config.taskTimeout,
        maxRetries: this.config.maxRetries
      });

      results.tasksCompleted += groupResult.completed;
      results.tasksFailed += groupResult.failed;

      if (groupResult.errors.length > 0) {
        results.errors.push(...groupResult.errors);
      }

      // Check for critical failures
      if (groupResult.criticalFailure) {
        results.success = false;
        break;
      }

      // Update progress
      this._emitProgressUpdate();

      // Checkpoint periodically
      if (Date.now() - startTime > this.config.checkpointInterval) {
        await this._createCheckpoint();
      }
    }

    results.duration = Date.now() - startTime;
    results.summary = {
      totalTasks: plan.tasks.length,
      completed: results.tasksCompleted,
      failed: results.tasksFailed,
      duration: results.duration
    };

    return results;
  }

  async _waitForResume() {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.state !== AgentState.WAITING) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 1000);
    });
  }

  _emitProgressUpdate() {
    const progress = this.progressTracker.getProgress();

    this.emit(PlannerEvents.PROGRESS_UPDATED, { progress });

    if (this.eventBus) {
      this.eventBus.publish(PlannerEvents.PROGRESS_UPDATED, {
        agent: this.name,
        progress
      });
    }
  }

  async _createCheckpoint() {
    const checkpoint = {
      id: `checkpoint-${Date.now()}`,
      timestamp: new Date().toISOString(),
      state: this.state,
      plan: this.currentPlan,
      progress: this.progressTracker.getProgress(),
      blockers: Array.from(this.blockers.entries())
    };

    this.checkpoints.push(checkpoint);

    // Keep only last 10 checkpoints
    if (this.checkpoints.length > 10) {
      this.checkpoints.shift();
    }

    await this._saveState();

    return checkpoint;
  }

  async _loadPlan(planId) {
    // Check current plan
    if (this.currentPlan?.id === planId) {
      return this.currentPlan;
    }

    // Check history
    const historyEntry = this.executionHistory.find(h => h.planId === planId);
    if (historyEntry) {
      // Load from file if needed
      const planPath = path.join(
        this.config.projectRoot,
        this.config.stateDir,
        'plans',
        `${planId}.json`
      );

      try {
        const data = await fs.readFile(planPath, 'utf-8');
        return JSON.parse(data);
      } catch (error) {
        return null;
      }
    }

    return null;
  }

  _getUptime() {
    if (!this._startTime) {
      this._startTime = Date.now();
    }
    return Date.now() - this._startTime;
  }

  async _ensureDirectories() {
    const dirs = [
      path.join(this.config.projectRoot, this.config.stateDir),
      path.join(this.config.projectRoot, this.config.stateDir, 'plans'),
      path.join(this.config.projectRoot, this.config.stateDir, 'checkpoints')
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async _loadExistingState() {
    try {
      const statePath = path.join(
        this.config.projectRoot,
        this.config.stateDir,
        'planner-state.json'
      );

      const data = await fs.readFile(statePath, 'utf-8');
      const state = JSON.parse(data);

      // Restore state
      if (state.currentPlan) {
        this.currentPlan = state.currentPlan;
      }

      if (state.executionHistory) {
        this.executionHistory = state.executionHistory;
      }

      if (state.blockers) {
        state.blockers.forEach(([id, blocker]) => {
          this.blockers.set(id, blocker);
        });
      }

      if (state.checkpoints) {
        this.checkpoints = state.checkpoints;
      }

      if (state.metrics) {
        this.metrics = { ...this.metrics, ...state.metrics };
      }

    } catch (error) {
      // No existing state - that's okay
    }
  }

  async _saveState() {
    const statePath = path.join(
      this.config.projectRoot,
      this.config.stateDir,
      'planner-state.json'
    );

    const state = {
      currentPlan: this.currentPlan,
      executionHistory: this.executionHistory,
      blockers: Array.from(this.blockers.entries()),
      checkpoints: this.checkpoints,
      metrics: this.metrics,
      savedAt: new Date().toISOString()
    };

    await fs.writeFile(statePath, JSON.stringify(state, null, 2));

    // Also save current plan separately if exists
    if (this.currentPlan) {
      const planPath = path.join(
        this.config.projectRoot,
        this.config.stateDir,
        'plans',
        `${this.currentPlan.id}.json`
      );

      await fs.writeFile(planPath, JSON.stringify(this.currentPlan, null, 2));
    }
  }
}

// Export singleton factory
let instance = null;

export function getPlannerAgent(config) {
  if (!instance) {
    instance = new PlannerAgent(config);
  }
  return instance;
}

export function resetPlannerAgent() {
  if (instance) {
    instance.shutdown().catch(() => {});
    instance = null;
  }
}

// Re-export sub-components with all types
export { ExecutionPlanner, PlanPhase, TaskPriority, TaskStatus } from './execution-planner.js';
export { AgentCoordinator, AssignmentStrategy, AgentStatus } from './coordinator.js';
export { ProgressTracker, ProgressStatus } from './progress-tracker.js';
export { IterationManager, IterationPhase, IterationStatus, EscalationLevel } from './iteration-manager.js';

export default PlannerAgent;
