/**
 * Agent Coordinator
 * =================
 * Assigns tasks to appropriate agents, monitors progress,
 * handles timeouts, and resolves conflicts between agents.
 */

import EventEmitter from 'events';

// Assignment strategies
export const AssignmentStrategy = {
  CAPABILITY_MATCH: 'capability_match',  // Best matching agent
  LOAD_BALANCED: 'load_balanced',        // Least busy agent
  ROUND_ROBIN: 'round_robin',            // Sequential assignment
  PRIORITY_BASED: 'priority_based'       // High priority agents first
};

// Agent status
export const AgentStatus = {
  AVAILABLE: 'available',
  BUSY: 'busy',
  FAILED: 'failed',
  OFFLINE: 'offline',
  PAUSED: 'paused'
};

export class AgentCoordinator extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      assignmentStrategy: config.assignmentStrategy || AssignmentStrategy.CAPABILITY_MATCH,
      maxTasksPerAgent: config.maxTasksPerAgent || 3,
      taskTimeout: config.taskTimeout || 300000, // 5 minutes
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 5000, // 5 seconds
      healthCheckInterval: config.healthCheckInterval || 30000, // 30 seconds
      ...config
    };

    // Agent registry
    this.agents = new Map();

    // Task assignments
    this.assignments = new Map(); // taskId -> { agentId, status, startTime, retries }

    // Execution state
    this.isPaused = false;
    this.isStopped = false;

    // Event bus reference
    this.eventBus = null;

    // Define known agents and their capabilities
    this._initializeAgentRegistry();
  }

  /**
   * Initialize the coordinator
   */
  async initialize(eventBus = null) {
    this.eventBus = eventBus;

    // Subscribe to agent events if event bus available
    if (this.eventBus) {
      this._subscribeToAgentEvents();
    }

    // Start health monitoring
    this._startHealthMonitoring();

    return { success: true };
  }

  /**
   * Execute a group of tasks
   */
  async executeGroup(group, options = {}) {
    const results = {
      groupId: group.id,
      completed: 0,
      failed: 0,
      errors: [],
      criticalFailure: false
    };

    if (this.isStopped) {
      results.criticalFailure = true;
      results.errors.push({ message: 'Coordinator is stopped' });
      return results;
    }

    const taskPromises = [];

    for (const taskId of group.tasks) {
      if (this.isPaused) {
        await this._waitForResume();
      }

      if (this.isStopped) {
        break;
      }

      // Execute task with retry logic
      const taskPromise = this._executeTaskWithRetry(taskId, options)
        .then(result => {
          if (result.success) {
            results.completed++;
          } else {
            results.failed++;
            results.errors.push({
              taskId,
              error: result.error
            });
          }
          return result;
        })
        .catch(error => {
          results.failed++;
          results.errors.push({
            taskId,
            error: error.message
          });
          return { success: false, error: error.message };
        });

      if (group.canRunInParallel) {
        taskPromises.push(taskPromise);
      } else {
        // Sequential execution
        await taskPromise;
      }
    }

    // Wait for all parallel tasks
    if (group.canRunInParallel && taskPromises.length > 0) {
      await Promise.all(taskPromises);
    }

    // Check for critical failure threshold
    const failureRate = results.failed / group.tasks.length;
    if (failureRate > 0.5) {
      results.criticalFailure = true;
    }

    return results;
  }

  /**
   * Assign a task to an agent
   */
  assignTask(task) {
    const agentId = this._selectAgent(task);

    if (!agentId) {
      return {
        success: false,
        error: 'No suitable agent available for task'
      };
    }

    const assignment = {
      taskId: task.id,
      agentId,
      task,
      status: 'assigned',
      assignedAt: new Date().toISOString(),
      retries: 0
    };

    this.assignments.set(task.id, assignment);

    // Update agent workload
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.currentTasks.push(task.id);
      if (agent.currentTasks.length >= this.config.maxTasksPerAgent) {
        agent.status = AgentStatus.BUSY;
      }
    }

    this.emit('task:assigned', {
      taskId: task.id,
      agentId,
      task
    });

    return { success: true, agentId, assignment };
  }

  /**
   * Report task completion
   */
  reportTaskCompleted(taskId, result = {}) {
    const assignment = this.assignments.get(taskId);
    if (!assignment) {
      return { success: false, error: 'Assignment not found' };
    }

    assignment.status = 'completed';
    assignment.completedAt = new Date().toISOString();
    assignment.result = result;

    // Update agent workload
    this._releaseAgentTask(assignment.agentId, taskId);

    this.emit('task:completed', {
      taskId,
      agentId: assignment.agentId,
      result,
      duration: new Date(assignment.completedAt) - new Date(assignment.assignedAt)
    });

    return { success: true };
  }

  /**
   * Report task failure
   */
  reportTaskFailed(taskId, error) {
    const assignment = this.assignments.get(taskId);
    if (!assignment) {
      return { success: false, error: 'Assignment not found' };
    }

    assignment.status = 'failed';
    assignment.failedAt = new Date().toISOString();
    assignment.error = error;

    // Update agent workload
    this._releaseAgentTask(assignment.agentId, taskId);

    this.emit('task:failed', {
      taskId,
      agentId: assignment.agentId,
      error,
      retries: assignment.retries
    });

    return { success: true };
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId) {
    return this.agents.get(agentId);
  }

  /**
   * Get all agents
   */
  getAgents() {
    return Array.from(this.agents.values());
  }

  /**
   * Get available agents
   */
  getAvailableAgents() {
    return Array.from(this.agents.values())
      .filter(a => a.status === AgentStatus.AVAILABLE);
  }

  /**
   * Get assignment for a task
   */
  getAssignment(taskId) {
    return this.assignments.get(taskId);
  }

  /**
   * Pause execution
   */
  async pause() {
    this.isPaused = true;
    return { success: true };
  }

  /**
   * Resume execution
   */
  async resume() {
    this.isPaused = false;
    this.emit('resumed');
    return { success: true };
  }

  /**
   * Stop execution
   */
  async stop() {
    this.isStopped = true;
    this.isPaused = false;

    // Cancel all pending assignments
    for (const [taskId, assignment] of this.assignments) {
      if (assignment.status === 'assigned' || assignment.status === 'running') {
        assignment.status = 'cancelled';
        this._releaseAgentTask(assignment.agentId, taskId);
      }
    }

    return { success: true };
  }

  /**
   * Shutdown coordinator
   */
  async shutdown() {
    await this.stop();

    if (this._healthCheckTimer) {
      clearInterval(this._healthCheckTimer);
    }

    this.removeAllListeners();
  }

  // ==================== Private Methods ====================

  /**
   * Initialize the agent registry with known agents
   */
  _initializeAgentRegistry() {
    const knownAgents = [
      {
        id: 'architect-agent',
        name: 'Architect-Agent',
        capabilities: ['architecture', 'blueprint', 'design', 'api-contract'],
        phases: ['setup', 'architecture']
      },
      {
        id: 'backend-agent',
        name: 'Backend-Agent',
        capabilities: ['backend', 'api', 'nodejs', 'express', 'database'],
        phases: ['implementation']
      },
      {
        id: 'admin-agent',
        name: 'Admin-Agent',
        capabilities: ['frontend', 'react', 'dashboard', 'admin'],
        phases: ['implementation']
      },
      {
        id: 'users-agent',
        name: 'Users-Agent',
        capabilities: ['mobile', 'flutter', 'users-app'],
        phases: ['implementation']
      },
      {
        id: 'drivers-agent',
        name: 'Drivers-Agent',
        capabilities: ['mobile', 'flutter', 'drivers-app'],
        phases: ['implementation']
      },
      {
        id: 'tester-agent',
        name: 'Tester-Agent',
        capabilities: ['testing', 'unit-test', 'integration-test', 'e2e'],
        phases: ['testing']
      },
      {
        id: 'docker-agent',
        name: 'Docker-Agent',
        capabilities: ['docker', 'container', 'deployment'],
        phases: ['deployment']
      },
      {
        id: 'github-agent',
        name: 'GitHub-Agent',
        capabilities: ['git', 'pr', 'release', 'ci-cd'],
        phases: ['deployment']
      },
      {
        id: 'document-agent',
        name: 'Document-Agent',
        capabilities: ['documentation', 'readme', 'api-docs'],
        phases: ['setup', 'integration']
      },
      {
        id: 'codebase-analyzer',
        name: 'Codebase-Analyzer',
        capabilities: ['analysis', 'security', 'tech-debt', 'code-review'],
        phases: ['testing', 'integration']
      },
      {
        id: 'vision-agent',
        name: 'Vision-Agent',
        capabilities: ['requirements', 'features', 'decomposition', 'acceptance'],
        phases: ['setup']
      }
    ];

    for (const agentConfig of knownAgents) {
      this.agents.set(agentConfig.id, {
        ...agentConfig,
        status: AgentStatus.AVAILABLE,
        currentTasks: [],
        completedTasks: 0,
        failedTasks: 0,
        lastHealthCheck: null
      });
    }
  }

  /**
   * Select best agent for a task
   */
  _selectAgent(task) {
    const strategy = this.config.assignmentStrategy;

    // If task has pre-assigned agent, use it
    if (task.agent) {
      const agent = this.agents.get(task.agent);
      if (agent && agent.status === AgentStatus.AVAILABLE) {
        return task.agent;
      }
    }

    // Find candidates based on capabilities
    const candidates = this._findCandidateAgents(task);

    if (candidates.length === 0) {
      return null;
    }

    switch (strategy) {
      case AssignmentStrategy.CAPABILITY_MATCH:
        return this._selectByCapabilityScore(candidates, task);

      case AssignmentStrategy.LOAD_BALANCED:
        return this._selectLeastLoaded(candidates);

      case AssignmentStrategy.ROUND_ROBIN:
        return this._selectRoundRobin(candidates);

      case AssignmentStrategy.PRIORITY_BASED:
        return candidates[0].id; // Already sorted by priority

      default:
        return candidates[0].id;
    }
  }

  /**
   * Find candidate agents for a task
   */
  _findCandidateAgents(task) {
    const candidates = [];
    const taskCategory = task.category?.toLowerCase() || '';
    const taskPhase = task.phase;

    for (const agent of this.agents.values()) {
      // Skip unavailable agents
      if (agent.status !== AgentStatus.AVAILABLE) {
        continue;
      }

      // Skip agents at capacity
      if (agent.currentTasks.length >= this.config.maxTasksPerAgent) {
        continue;
      }

      // Check phase match
      if (taskPhase && agent.phases && !agent.phases.includes(taskPhase)) {
        continue;
      }

      // Calculate capability score
      let score = 0;
      for (const cap of agent.capabilities) {
        if (taskCategory.includes(cap) || cap.includes(taskCategory)) {
          score += 10;
        }
        if (task.name?.toLowerCase().includes(cap)) {
          score += 5;
        }
        if (task.description?.toLowerCase().includes(cap)) {
          score += 2;
        }
      }

      if (score > 0 || !taskCategory) {
        candidates.push({ ...agent, score });
      }
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    return candidates;
  }

  /**
   * Select agent by capability score
   */
  _selectByCapabilityScore(candidates, task) {
    return candidates[0]?.id || null;
  }

  /**
   * Select least loaded agent
   */
  _selectLeastLoaded(candidates) {
    candidates.sort((a, b) => a.currentTasks.length - b.currentTasks.length);
    return candidates[0]?.id || null;
  }

  /**
   * Select agent in round-robin fashion
   */
  _selectRoundRobin(candidates) {
    if (!this._roundRobinIndex) {
      this._roundRobinIndex = 0;
    }

    const index = this._roundRobinIndex % candidates.length;
    this._roundRobinIndex++;

    return candidates[index]?.id || null;
  }

  /**
   * Execute task with retry logic
   */
  async _executeTaskWithRetry(taskId, options = {}) {
    const maxRetries = options.maxRetries || this.config.maxRetries;
    const timeout = options.timeout || this.config.taskTimeout;

    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Get or create assignment
        let assignment = this.assignments.get(taskId);

        if (!assignment) {
          // Need task details - this would come from the plan
          return { success: false, error: 'Task not found in assignments' };
        }

        assignment.retries = attempt;
        assignment.status = 'running';
        assignment.lastAttemptAt = new Date().toISOString();

        // Execute with timeout
        const result = await this._executeTaskWithTimeout(assignment, timeout);

        if (result.success) {
          this.reportTaskCompleted(taskId, result);
          return result;
        }

        lastError = result.error;

      } catch (error) {
        lastError = error.message;

        // Wait before retry
        if (attempt < maxRetries) {
          await this._delay(this.config.retryDelay * (attempt + 1));
        }
      }
    }

    // All retries exhausted
    this.reportTaskFailed(taskId, lastError);

    return {
      success: false,
      error: lastError,
      retriesExhausted: true
    };
  }

  /**
   * Execute task with timeout
   */
  async _executeTaskWithTimeout(assignment, timeout) {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve({
          success: false,
          error: `Task timed out after ${timeout}ms`
        });
      }, timeout);

      // Simulate task execution
      // In real implementation, this would dispatch to the actual agent
      this._dispatchToAgent(assignment)
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          resolve({ success: false, error: error.message });
        });
    });
  }

  /**
   * Dispatch task to agent for execution
   */
  async _dispatchToAgent(assignment) {
    const { agentId, task } = assignment;

    // Emit task started
    this.emit('task:started', { taskId: task.id, agentId });

    // In real implementation, this would:
    // 1. Send task to agent via event bus
    // 2. Wait for completion event
    // 3. Return result

    // For now, simulate successful execution
    if (this.eventBus) {
      // Publish task to agent
      this.eventBus.publish(`${agentId}:task:execute`, {
        taskId: task.id,
        task,
        assignedBy: 'planner-agent'
      });

      // In real implementation, we'd wait for completion event
      // For now, return success
      return { success: true, taskId: task.id };
    }

    // Fallback: simulate completion
    return { success: true, taskId: task.id };
  }

  /**
   * Release task from agent
   */
  _releaseAgentTask(agentId, taskId) {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.currentTasks = agent.currentTasks.filter(id => id !== taskId);
      if (agent.currentTasks.length < this.config.maxTasksPerAgent) {
        agent.status = AgentStatus.AVAILABLE;
      }
    }
  }

  /**
   * Subscribe to agent events
   */
  _subscribeToAgentEvents() {
    if (!this.eventBus) return;

    // Listen for agent completion events
    this.eventBus.subscribe('AGENT_COMPLETED', 'planner-coordinator', (data) => {
      if (data.taskId) {
        this.reportTaskCompleted(data.taskId, data.result);
      }
    });

    // Listen for agent failure events
    this.eventBus.subscribe('AGENT_FAILED', 'planner-coordinator', (data) => {
      if (data.taskId) {
        this.reportTaskFailed(data.taskId, data.error);
      }
    });
  }

  /**
   * Start health monitoring
   */
  _startHealthMonitoring() {
    this._healthCheckTimer = setInterval(() => {
      this._performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  /**
   * Perform health check on agents
   */
  _performHealthCheck() {
    const now = new Date().toISOString();

    for (const agent of this.agents.values()) {
      agent.lastHealthCheck = now;

      // Check for stuck tasks
      for (const taskId of agent.currentTasks) {
        const assignment = this.assignments.get(taskId);
        if (assignment) {
          const elapsed = Date.now() - new Date(assignment.assignedAt).getTime();
          if (elapsed > this.config.taskTimeout * 2) {
            // Task is stuck
            this.emit('warning', {
              message: `Task ${taskId} appears stuck on ${agent.id}`,
              elapsed
            });
          }
        }
      }
    }
  }

  /**
   * Wait for resume signal
   */
  async _waitForResume() {
    return new Promise((resolve) => {
      const handler = () => {
        this.removeListener('resumed', handler);
        resolve();
      };
      this.on('resumed', handler);
    });
  }

  /**
   * Delay helper
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default AgentCoordinator;
