/**
 * Execution Plan Generator
 * ========================
 * Converts Vision-Agent tasks into executable plans with
 * topological sorting, parallel execution groups, and checkpoints.
 */

import EventEmitter from 'events';

// Plan execution phases
export const PlanPhase = {
  SETUP: 'setup',
  ARCHITECTURE: 'architecture',
  IMPLEMENTATION: 'implementation',
  TESTING: 'testing',
  INTEGRATION: 'integration',
  DEPLOYMENT: 'deployment'
};

// Task priority levels
export const TaskPriority = {
  CRITICAL: 1,    // Must complete first
  HIGH: 2,        // Important for progress
  MEDIUM: 3,      // Normal priority
  LOW: 4,         // Can be deferred
  OPTIONAL: 5     // Nice to have
};

// Task status
export const TaskStatus = {
  PENDING: 'pending',
  READY: 'ready',      // Dependencies met
  ASSIGNED: 'assigned',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
  BLOCKED: 'blocked'
};

export class ExecutionPlanner extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      maxConcurrency: config.maxConcurrency || 3,
      defaultPriority: config.defaultPriority || TaskPriority.MEDIUM,
      enableParallelExecution: config.enableParallelExecution ?? true,
      checkpointFrequency: config.checkpointFrequency || 5, // Every 5 tasks
      ...config
    };

    // Phase ordering for plan generation
    this.phaseOrder = [
      PlanPhase.SETUP,
      PlanPhase.ARCHITECTURE,
      PlanPhase.IMPLEMENTATION,
      PlanPhase.TESTING,
      PlanPhase.INTEGRATION,
      PlanPhase.DEPLOYMENT
    ];

    // Agent capabilities mapping
    this.agentCapabilities = {
      'architect-agent': [PlanPhase.SETUP, PlanPhase.ARCHITECTURE],
      'backend-agent': [PlanPhase.IMPLEMENTATION],
      'admin-agent': [PlanPhase.IMPLEMENTATION],
      'users-agent': [PlanPhase.IMPLEMENTATION],
      'drivers-agent': [PlanPhase.IMPLEMENTATION],
      'tester-agent': [PlanPhase.TESTING],
      'docker-agent': [PlanPhase.DEPLOYMENT],
      'github-agent': [PlanPhase.DEPLOYMENT],
      'document-agent': [PlanPhase.SETUP, PlanPhase.INTEGRATION],
      'codebase-analyzer': [PlanPhase.TESTING, PlanPhase.INTEGRATION]
    };
  }

  /**
   * Create an execution plan from tasks
   */
  async createPlan(tasks, options = {}) {
    const planId = `plan-${Date.now()}`;

    // Normalize and validate tasks
    const normalizedTasks = this._normalizeTasks(tasks);

    // Build dependency graph
    const dependencyGraph = this._buildDependencyGraph(normalizedTasks);

    // Check for circular dependencies
    if (this._hasCircularDependencies(dependencyGraph)) {
      throw new Error('Circular dependencies detected in task graph');
    }

    // Topological sort
    const sortedTasks = this._topologicalSort(normalizedTasks, dependencyGraph);

    // Assign phases
    const phasedTasks = this._assignPhases(sortedTasks);

    // Create execution groups for parallel execution
    const executionGroups = this._createExecutionGroups(phasedTasks, dependencyGraph);

    // Assign agents
    const assignedTasks = this._assignAgents(phasedTasks);

    // Place checkpoints
    const checkpoints = this._placeCheckpoints(executionGroups);

    // Estimate duration
    const estimatedDuration = this._estimateDuration(assignedTasks);

    const plan = {
      id: planId,
      version: '1.0',
      status: 'pending',
      tasks: assignedTasks,
      executionGroups,
      checkpoints,
      dependencyGraph: this._serializeDependencyGraph(dependencyGraph),
      phases: this._groupByPhase(assignedTasks),
      estimatedDuration,
      taskCount: assignedTasks.length,
      metadata: {
        createdAt: new Date().toISOString(),
        source: options.source || 'manual',
        maxConcurrency: options.maxConcurrency || this.config.maxConcurrency
      }
    };

    return plan;
  }

  /**
   * Get execution groups from plan
   */
  getExecutionGroups(plan) {
    return plan.executionGroups || [];
  }

  /**
   * Get next executable tasks
   */
  getNextTasks(plan, completedTaskIds = []) {
    const completedSet = new Set(completedTaskIds);
    const readyTasks = [];

    for (const task of plan.tasks) {
      if (task.status !== TaskStatus.PENDING && task.status !== TaskStatus.READY) {
        continue;
      }

      // Check if all dependencies are completed
      const dependencies = task.dependencies || [];
      const allDependenciesMet = dependencies.every(depId => completedSet.has(depId));

      if (allDependenciesMet) {
        task.status = TaskStatus.READY;
        readyTasks.push(task);
      }
    }

    // Sort by priority and return up to maxConcurrency
    readyTasks.sort((a, b) => a.priority - b.priority);

    return readyTasks.slice(0, this.config.maxConcurrency);
  }

  /**
   * Update task status in plan
   */
  updateTaskStatus(plan, taskId, status, result = null) {
    const task = plan.tasks.find(t => t.id === taskId);
    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    task.status = status;
    task.updatedAt = new Date().toISOString();

    if (result) {
      task.result = result;
    }

    if (status === TaskStatus.COMPLETED) {
      task.completedAt = new Date().toISOString();
    } else if (status === TaskStatus.FAILED) {
      task.failedAt = new Date().toISOString();
    }

    return { success: true, task };
  }

  /**
   * Normalize tasks to standard format
   */
  _normalizeTasks(tasks) {
    return tasks.map((task, index) => ({
      id: task.id || `task-${index + 1}`,
      name: task.name || task.title || `Task ${index + 1}`,
      description: task.description || '',
      type: task.type || 'implementation',
      priority: task.priority || this.config.defaultPriority,
      complexity: task.complexity || 3,
      dependencies: task.dependencies || [],
      category: task.category || this._inferCategory(task),
      estimatedDuration: task.estimatedDuration || this._estimateTaskDuration(task),
      status: TaskStatus.PENDING,
      agent: task.agent || null,
      phase: task.phase || null,
      metadata: {
        source: task.source || 'unknown',
        storyId: task.storyId,
        epicId: task.epicId,
        featureId: task.featureId
      }
    }));
  }

  /**
   * Build dependency graph from tasks
   */
  _buildDependencyGraph(tasks) {
    const graph = new Map();

    // Initialize all tasks in graph
    for (const task of tasks) {
      graph.set(task.id, {
        task,
        dependencies: new Set(task.dependencies),
        dependents: new Set()
      });
    }

    // Build reverse dependencies (dependents)
    for (const task of tasks) {
      for (const depId of task.dependencies) {
        const depNode = graph.get(depId);
        if (depNode) {
          depNode.dependents.add(task.id);
        } else {
          this.emit('warning', {
            message: `Task ${task.id} depends on non-existent task ${depId}`
          });
        }
      }
    }

    return graph;
  }

  /**
   * Check for circular dependencies using DFS
   */
  _hasCircularDependencies(graph) {
    const visited = new Set();
    const visiting = new Set();

    const visit = (taskId) => {
      if (visiting.has(taskId)) {
        return true; // Cycle detected
      }
      if (visited.has(taskId)) {
        return false;
      }

      visiting.add(taskId);

      const node = graph.get(taskId);
      if (node) {
        for (const depId of node.dependencies) {
          if (visit(depId)) {
            return true;
          }
        }
      }

      visiting.delete(taskId);
      visited.add(taskId);

      return false;
    };

    for (const taskId of graph.keys()) {
      if (visit(taskId)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Topological sort of tasks
   */
  _topologicalSort(tasks, graph) {
    const sorted = [];
    const visited = new Set();

    const visit = (taskId) => {
      if (visited.has(taskId)) return;
      visited.add(taskId);

      const node = graph.get(taskId);
      if (node) {
        for (const depId of node.dependencies) {
          visit(depId);
        }
        sorted.push(node.task);
      }
    };

    for (const task of tasks) {
      visit(task.id);
    }

    return sorted;
  }

  /**
   * Assign phases to tasks
   */
  _assignPhases(tasks) {
    return tasks.map(task => {
      if (task.phase) return task;

      // Infer phase from category
      const category = task.category?.toLowerCase() || '';
      const type = task.type?.toLowerCase() || '';

      let phase = PlanPhase.IMPLEMENTATION;

      if (/setup|config|init/.test(category) || /setup|config/.test(type)) {
        phase = PlanPhase.SETUP;
      } else if (/architect|design|blueprint/.test(category)) {
        phase = PlanPhase.ARCHITECTURE;
      } else if (/test|spec|coverage/.test(category) || /test/.test(type)) {
        phase = PlanPhase.TESTING;
      } else if (/integrat|connect|api/.test(category)) {
        phase = PlanPhase.INTEGRATION;
      } else if (/deploy|docker|release/.test(category)) {
        phase = PlanPhase.DEPLOYMENT;
      }

      return { ...task, phase };
    });
  }

  /**
   * Create execution groups for parallel execution
   */
  _createExecutionGroups(tasks, graph) {
    const groups = [];
    const scheduled = new Set();
    let remainingTasks = [...tasks];

    while (remainingTasks.length > 0) {
      // Find all tasks whose dependencies are satisfied
      const readyTasks = remainingTasks.filter(task => {
        const node = graph.get(task.id);
        if (!node) return true;

        for (const depId of node.dependencies) {
          if (!scheduled.has(depId)) {
            return false;
          }
        }
        return true;
      });

      if (readyTasks.length === 0) {
        // Remaining tasks have unmet dependencies (shouldn't happen after topo sort)
        this.emit('warning', {
          message: `${remainingTasks.length} tasks have unmet dependencies`
        });
        break;
      }

      // Group by phase for better organization
      const phaseGroups = this._groupByPhase(readyTasks);

      for (const [phase, phaseTasks] of Object.entries(phaseGroups)) {
        // Split into concurrent groups based on maxConcurrency
        for (let i = 0; i < phaseTasks.length; i += this.config.maxConcurrency) {
          const groupTasks = phaseTasks.slice(i, i + this.config.maxConcurrency);

          groups.push({
            id: `group-${groups.length + 1}`,
            phase,
            tasks: groupTasks.map(t => t.id),
            canRunInParallel: this.config.enableParallelExecution,
            order: groups.length
          });

          groupTasks.forEach(t => scheduled.add(t.id));
        }
      }

      // Update remaining tasks
      remainingTasks = remainingTasks.filter(t => !scheduled.has(t.id));
    }

    return groups;
  }

  /**
   * Assign agents to tasks
   */
  _assignAgents(tasks) {
    return tasks.map(task => {
      if (task.agent) return task;

      // Infer agent from phase and category
      let agent = null;
      const category = task.category?.toLowerCase() || '';
      const phase = task.phase;

      // Direct category matching
      if (/backend|api|server|node/.test(category)) {
        agent = 'backend-agent';
      } else if (/frontend|admin|dashboard|react/.test(category)) {
        agent = 'admin-agent';
      } else if (/flutter|mobile|user/.test(category)) {
        agent = 'users-agent';
      } else if (/driver/.test(category)) {
        agent = 'drivers-agent';
      } else if (/test|spec/.test(category)) {
        agent = 'tester-agent';
      } else if (/doc|readme/.test(category)) {
        agent = 'document-agent';
      } else if (/docker|container|deploy/.test(category)) {
        agent = 'docker-agent';
      } else if (/git|pr|release/.test(category)) {
        agent = 'github-agent';
      } else if (/security|analysis/.test(category)) {
        agent = 'codebase-analyzer';
      } else if (phase === PlanPhase.ARCHITECTURE) {
        agent = 'architect-agent';
      }

      return { ...task, agent };
    });
  }

  /**
   * Place checkpoints in execution plan
   */
  _placeCheckpoints(executionGroups) {
    const checkpoints = [];

    // Checkpoint after each phase change
    let lastPhase = null;
    let taskCount = 0;

    for (const group of executionGroups) {
      taskCount += group.tasks.length;

      // Phase change checkpoint
      if (lastPhase && group.phase !== lastPhase) {
        checkpoints.push({
          id: `checkpoint-phase-${group.phase}`,
          afterGroup: group.id,
          type: 'phase_transition',
          description: `Checkpoint after ${lastPhase} phase`
        });
      }

      // Frequency-based checkpoint
      if (taskCount >= this.config.checkpointFrequency) {
        checkpoints.push({
          id: `checkpoint-${checkpoints.length + 1}`,
          afterGroup: group.id,
          type: 'periodic',
          description: `Periodic checkpoint after ${taskCount} tasks`
        });
        taskCount = 0;
      }

      lastPhase = group.phase;
    }

    // Final checkpoint
    if (executionGroups.length > 0) {
      checkpoints.push({
        id: 'checkpoint-final',
        afterGroup: executionGroups[executionGroups.length - 1].id,
        type: 'final',
        description: 'Final checkpoint before completion'
      });
    }

    return checkpoints;
  }

  /**
   * Estimate total plan duration
   */
  _estimateDuration(tasks) {
    // Sum up task durations, accounting for parallelism
    let totalDuration = 0;

    const phases = this._groupByPhase(tasks);
    for (const phaseTasks of Object.values(phases)) {
      // For each phase, estimate based on longest parallel path
      const phaseDuration = Math.max(
        ...phaseTasks.map(t => t.estimatedDuration || this._estimateTaskDuration(t))
      );
      totalDuration += phaseDuration;
    }

    return totalDuration;
  }

  /**
   * Estimate single task duration based on complexity
   */
  _estimateTaskDuration(task) {
    const complexity = task.complexity || 3;
    // Base: 5 minutes per complexity point
    return complexity * 5 * 60 * 1000;
  }

  /**
   * Infer category from task
   */
  _inferCategory(task) {
    const text = `${task.name} ${task.description || ''}`.toLowerCase();

    if (/backend|api|server|endpoint|database/.test(text)) return 'backend';
    if (/frontend|ui|component|page|dashboard/.test(text)) return 'frontend';
    if (/test|spec|coverage/.test(text)) return 'testing';
    if (/doc|readme|comment/.test(text)) return 'documentation';
    if (/deploy|docker|release/.test(text)) return 'devops';
    if (/architect|design|structure/.test(text)) return 'architecture';

    return 'implementation';
  }

  /**
   * Group tasks by phase
   */
  _groupByPhase(tasks) {
    const groups = {};

    for (const task of tasks) {
      const phase = task.phase || PlanPhase.IMPLEMENTATION;
      if (!groups[phase]) {
        groups[phase] = [];
      }
      groups[phase].push(task);
    }

    return groups;
  }

  /**
   * Serialize dependency graph for storage
   */
  _serializeDependencyGraph(graph) {
    const serialized = {};

    for (const [taskId, node] of graph) {
      serialized[taskId] = {
        dependencies: Array.from(node.dependencies),
        dependents: Array.from(node.dependents)
      };
    }

    return serialized;
  }
}

export default ExecutionPlanner;
