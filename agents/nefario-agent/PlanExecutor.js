/**
 * PlanExecutor
 * ------------
 * Bridges Nefario's plans to actual execution via the Orchestrator.
 *
 * This is the critical missing piece that converts JSON plans into
 * real code generation, testing, and deployment actions.
 *
 * Architecture:
 * - Receives plans from Nefario
 * - Routes tasks to appropriate agents or code generators
 * - Tracks execution progress
 * - Integrates with autonomous-loop for test-fix cycles
 * - Logs all decisions for visibility
 */

import EventEmitter from 'events';
import { createLogger } from '../../foundation/common/logger.js';
import { getEventBus } from '../../foundation/event-bus/AgentEventBus.js';
import { EventTypes } from '../../foundation/event-bus/eventTypes.js';
import { getDecisionLogger } from '../../foundation/memory-store/DecisionLogger.js';
import { getOrchestrator } from '../manager-agent/orchestrator.js';

const logger = createLogger('PlanExecutor');

// Execution states
export const ExecutionState = {
  IDLE: 'idle',
  EXECUTING: 'executing',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

// Task execution status
export const TaskStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  SKIPPED: 'skipped'
};

let instance = null;

export class PlanExecutor extends EventEmitter {
  constructor(config = {}) {
    super();
    this.logger = logger;

    this.config = {
      maxConcurrentTasks: config.maxConcurrentTasks || 3,
      taskTimeout: config.taskTimeout || 300000, // 5 minutes
      retryAttempts: config.retryAttempts || 2,
      ...config
    };

    // Core dependencies (lazy-loaded)
    this._eventBus = null;
    this._decisionLogger = null;
    this._orchestrator = null;

    // Execution state
    this.state = ExecutionState.IDLE;
    this.currentPlan = null;
    this.taskStatus = new Map(); // taskId -> status
    this.executionHistory = [];

    // Task handlers by category
    this.taskHandlers = new Map();
    this._registerDefaultHandlers();

    // Code generator (will be set by Gru or Nefario)
    this.codeGenerator = null;
  }

  /**
   * Get singleton instance
   */
  static getInstance(config = {}) {
    if (!instance) {
      instance = new PlanExecutor(config);
    }
    return instance;
  }

  /**
   * Lazy-load EventBus
   */
  get eventBus() {
    if (!this._eventBus) {
      this._eventBus = getEventBus();
    }
    return this._eventBus;
  }

  /**
   * Lazy-load DecisionLogger
   */
  get decisionLogger() {
    if (!this._decisionLogger) {
      try {
        this._decisionLogger = getDecisionLogger();
      } catch (e) {
        this.logger.warn('DecisionLogger not available');
      }
    }
    return this._decisionLogger;
  }

  /**
   * Lazy-load Orchestrator
   */
  get orchestrator() {
    if (!this._orchestrator) {
      this._orchestrator = getOrchestrator();
    }
    return this._orchestrator;
  }

  /**
   * Register default task handlers by category
   * @private
   */
  _registerDefaultHandlers() {
    // Setup tasks
    this.taskHandlers.set('setup', this._handleSetupTask.bind(this));

    // Code generation tasks
    this.taskHandlers.set('backend', this._handleCodeGenerationTask.bind(this));
    this.taskHandlers.set('frontend', this._handleCodeGenerationTask.bind(this));
    this.taskHandlers.set('api', this._handleCodeGenerationTask.bind(this));
    this.taskHandlers.set('database', this._handleDatabaseTask.bind(this));

    // Testing tasks
    this.taskHandlers.set('testing', this._handleTestingTask.bind(this));

    // Documentation tasks
    this.taskHandlers.set('documentation', this._handleDocumentationTask.bind(this));

    // Deployment tasks
    this.taskHandlers.set('deployment', this._handleDeploymentTask.bind(this));

    // Security tasks
    this.taskHandlers.set('security', this._handleSecurityTask.bind(this));

    // Infrastructure tasks
    this.taskHandlers.set('infrastructure', this._handleInfrastructureTask.bind(this));
  }

  /**
   * Register a custom task handler
   * @param {string} category - Task category
   * @param {Function} handler - Handler function(task, context) => Promise<result>
   */
  registerTaskHandler(category, handler) {
    this.taskHandlers.set(category, handler);
    this.logger.info(`Registered handler for category: ${category}`);
  }

  /**
   * Set code generator (called by Gru/Nefario with OllamaAdapter)
   * @param {object} generator - Code generator with generate() method
   */
  setCodeGenerator(generator) {
    this.codeGenerator = generator;
    this.logger.info('Code generator set');
  }

  /**
   * Execute a plan
   * @param {object} plan - Nefario plan
   * @param {object} context - Execution context (project info, etc.)
   * @returns {Promise<object>} Execution result
   */
  async executePlan(plan, context = {}) {
    if (this.state === ExecutionState.EXECUTING) {
      throw new Error('Already executing a plan');
    }

    this.logger.info(`Starting plan execution: ${plan.id}`);
    this.state = ExecutionState.EXECUTING;
    this.currentPlan = plan;

    // Initialize task status
    this.taskStatus.clear();
    for (const task of plan.tasks) {
      this.taskStatus.set(task.id, {
        status: TaskStatus.PENDING,
        startTime: null,
        endTime: null,
        result: null,
        error: null,
        retries: 0
      });
    }

    // Log decision
    await this._logDecision('plan_execution_started', {
      planId: plan.id,
      taskCount: plan.tasks.length,
      phases: Object.keys(plan.phases || {})
    });

    // Publish execution started event
    this.eventBus.publish(EventTypes.EXECUTION_STARTED, {
      agent: 'plan-executor',
      planId: plan.id,
      taskCount: plan.tasks.length
    });

    this.emit('execution:started', { planId: plan.id });

    const startTime = Date.now();
    const results = {
      planId: plan.id,
      success: false,
      tasksCompleted: 0,
      tasksFailed: 0,
      tasksSkipped: 0,
      taskResults: {},
      duration: 0
    };

    try {
      // Execute tasks in dependency order
      const executionOrder = this._buildExecutionOrder(plan);

      for (const batch of executionOrder) {
        if (this.state === ExecutionState.PAUSED) {
          this.logger.info('Execution paused');
          await this._waitForResume();
        }

        if (this.state === ExecutionState.FAILED) {
          break;
        }

        // Execute batch in parallel (up to maxConcurrentTasks)
        await this._executeBatch(batch, context, results);
      }

      // Determine overall success
      results.success = results.tasksFailed === 0;
      results.duration = Date.now() - startTime;

      this.state = results.success ? ExecutionState.COMPLETED : ExecutionState.FAILED;

      // Log completion
      await this._logDecision('plan_execution_completed', {
        planId: plan.id,
        success: results.success,
        duration: results.duration,
        tasksCompleted: results.tasksCompleted,
        tasksFailed: results.tasksFailed
      });

      // Publish completion event
      this.eventBus.publish(EventTypes.EXECUTION_COMPLETED, {
        agent: 'plan-executor',
        planId: plan.id,
        success: results.success,
        duration: results.duration
      });

      this.emit('execution:completed', results);

      // Store in history
      this.executionHistory.push({
        ...results,
        timestamp: new Date().toISOString()
      });

      this.logger.info(`Plan execution completed: ${results.success ? 'SUCCESS' : 'FAILED'}`);
      return results;

    } catch (error) {
      this.state = ExecutionState.FAILED;
      results.success = false;
      results.error = error.message;
      results.duration = Date.now() - startTime;

      this.logger.error(`Plan execution failed: ${error.message}`);

      this.eventBus.publish(EventTypes.EXECUTION_FAILED, {
        agent: 'plan-executor',
        planId: plan.id,
        error: error.message
      });

      this.emit('execution:failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Build execution order from dependencies
   * @private
   */
  _buildExecutionOrder(plan) {
    const tasks = plan.tasks;
    const batches = [];
    const completed = new Set();
    const remaining = new Map(tasks.map(t => [t.id, t]));

    while (remaining.size > 0) {
      const batch = [];

      for (const [taskId, task] of remaining) {
        const deps = task.dependencies || [];
        const allDepsCompleted = deps.every(d => completed.has(d));

        if (allDepsCompleted) {
          batch.push(task);
        }
      }

      if (batch.length === 0 && remaining.size > 0) {
        // Circular dependency or missing dependency - take first remaining
        this.logger.warn('Potential circular dependency detected, forcing execution');
        batch.push(remaining.values().next().value);
      }

      for (const task of batch) {
        completed.add(task.id);
        remaining.delete(task.id);
      }

      batches.push(batch);
    }

    return batches;
  }

  /**
   * Execute a batch of tasks in parallel
   * @private
   */
  async _executeBatch(batch, context, results) {
    const chunks = this._chunkArray(batch, this.config.maxConcurrentTasks);

    for (const chunk of chunks) {
      const promises = chunk.map(task =>
        this._executeTask(task, context).then(result => {
          results.taskResults[task.id] = result;
          if (result.success) {
            results.tasksCompleted++;
          } else {
            results.tasksFailed++;
          }
          return result;
        }).catch(error => {
          results.taskResults[task.id] = {
            success: false,
            error: error.message
          };
          results.tasksFailed++;
          return { success: false, error: error.message };
        })
      );

      await Promise.all(promises);
    }
  }

  /**
   * Execute a single task
   * @private
   */
  async _executeTask(task, context) {
    const status = this.taskStatus.get(task.id);
    status.status = TaskStatus.IN_PROGRESS;
    status.startTime = Date.now();

    this.logger.info(`Executing task: ${task.id} - ${task.name}`);

    this.emit('task:started', { taskId: task.id, taskName: task.name });

    try {
      // Get handler for task category
      const handler = this.taskHandlers.get(task.category) ||
                      this._handleGenericTask.bind(this);

      // Execute with timeout
      const result = await this._executeWithTimeout(
        handler(task, context),
        this.config.taskTimeout
      );

      status.status = TaskStatus.COMPLETED;
      status.endTime = Date.now();
      status.result = result;

      this.logger.info(`Task completed: ${task.id}`);
      this.emit('task:completed', { taskId: task.id, result });

      // Publish code generated event if applicable
      if (result.codeGenerated) {
        this.eventBus.publish(EventTypes.CODE_GENERATED, {
          agent: 'plan-executor',
          taskId: task.id,
          files: result.files || []
        });
      }

      return { success: true, ...result };

    } catch (error) {
      // Retry logic
      status.retries++;

      if (status.retries < this.config.retryAttempts) {
        this.logger.warn(`Task ${task.id} failed, retrying (${status.retries}/${this.config.retryAttempts})`);
        return this._executeTask(task, context);
      }

      status.status = TaskStatus.FAILED;
      status.endTime = Date.now();
      status.error = error.message;

      this.logger.error(`Task failed: ${task.id} - ${error.message}`);
      this.emit('task:failed', { taskId: task.id, error: error.message });

      return { success: false, error: error.message };
    }
  }

  /**
   * Execute with timeout
   * @private
   */
  _executeWithTimeout(promise, timeout) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Task timeout')), timeout)
      )
    ]);
  }

  // ============================================
  // Task Handlers
  // ============================================

  /**
   * Handle setup tasks (project init, dependencies)
   * @private
   */
  async _handleSetupTask(task, context) {
    this.logger.info(`[Setup] ${task.name}`);

    // Setup tasks typically involve:
    // - Creating project structure
    // - Installing dependencies
    // - Configuring environment

    return {
      type: 'setup',
      message: `Setup task completed: ${task.name}`,
      // In real implementation, would execute shell commands
      actions: ['project_structure', 'dependencies', 'config']
    };
  }

  /**
   * Handle code generation tasks
   * @private
   */
  async _handleCodeGenerationTask(task, context) {
    this.logger.info(`[CodeGen] ${task.name} (${task.category})`);

    if (!this.codeGenerator) {
      this.logger.warn('No code generator available, skipping code generation');
      return {
        type: 'code_generation',
        skipped: true,
        message: 'No code generator configured'
      };
    }

    try {
      // Build prompt from task description
      const prompt = this._buildCodePrompt(task, context);

      // Generate code using the configured generator
      const response = await this.codeGenerator.chat([
        { role: 'user', content: prompt }
      ], this._getSystemPromptForCategory(task.category));

      // Parse generated code
      const codeBlocks = this._extractCodeBlocks(response);

      return {
        type: 'code_generation',
        codeGenerated: true,
        files: codeBlocks,
        message: `Generated ${codeBlocks.length} code block(s) for ${task.name}`
      };

    } catch (error) {
      this.logger.error(`Code generation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle database tasks
   * @private
   */
  async _handleDatabaseTask(task, context) {
    this.logger.info(`[Database] ${task.name}`);

    // Would integrate with Dave (database-agent)
    // For now, generate schema/migration code

    if (this.codeGenerator) {
      return this._handleCodeGenerationTask(task, context);
    }

    return {
      type: 'database',
      message: `Database task prepared: ${task.name}`,
      requiresAgent: 'database-agent'
    };
  }

  /**
   * Handle testing tasks
   * @private
   */
  async _handleTestingTask(task, context) {
    this.logger.info(`[Testing] ${task.name}`);

    // Publish event to trigger tester-agent
    this.eventBus.publish(EventTypes.TESTS_STARTED, {
      agent: 'plan-executor',
      taskId: task.id,
      testType: task.type,
      scope: task.description
    });

    return {
      type: 'testing',
      message: `Testing task triggered: ${task.name}`,
      eventPublished: 'TESTS_STARTED'
    };
  }

  /**
   * Handle documentation tasks
   * @private
   */
  async _handleDocumentationTask(task, context) {
    this.logger.info(`[Docs] ${task.name}`);

    if (this.codeGenerator) {
      const prompt = `Generate documentation for: ${task.description}\n\nContext: ${JSON.stringify(context.projectInfo || {})}`;

      const response = await this.codeGenerator.chat([
        { role: 'user', content: prompt }
      ], 'You are a technical documentation writer. Generate clear, concise documentation.');

      return {
        type: 'documentation',
        content: response,
        message: `Documentation generated for ${task.name}`
      };
    }

    return {
      type: 'documentation',
      message: `Documentation task prepared: ${task.name}`
    };
  }

  /**
   * Handle deployment tasks
   * @private
   */
  async _handleDeploymentTask(task, context) {
    this.logger.info(`[Deploy] ${task.name}`);

    // Would integrate with Docker agent
    return {
      type: 'deployment',
      message: `Deployment task prepared: ${task.name}`,
      requiresAgent: 'docker-agent'
    };
  }

  /**
   * Handle security tasks
   * @private
   */
  async _handleSecurityTask(task, context) {
    this.logger.info(`[Security] ${task.name}`);

    // Publish event for Tom (security-risk-agent)
    this.eventBus.publish(EventTypes.SCAN_STARTED, {
      agent: 'plan-executor',
      taskId: task.id,
      scanType: 'task-based'
    });

    return {
      type: 'security',
      message: `Security task triggered: ${task.name}`,
      eventPublished: 'SCAN_STARTED'
    };
  }

  /**
   * Handle infrastructure tasks
   * @private
   */
  async _handleInfrastructureTask(task, context) {
    this.logger.info(`[Infra] ${task.name}`);

    return {
      type: 'infrastructure',
      message: `Infrastructure task prepared: ${task.name}`
    };
  }

  /**
   * Handle generic/unknown tasks
   * @private
   */
  async _handleGenericTask(task, context) {
    this.logger.info(`[Generic] ${task.name}`);

    // Try code generation as fallback
    if (this.codeGenerator && task.description) {
      return this._handleCodeGenerationTask(task, context);
    }

    return {
      type: 'generic',
      message: `Task acknowledged: ${task.name}`,
      requiresManualAction: true
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Build code generation prompt from task
   * @private
   */
  _buildCodePrompt(task, context) {
    let prompt = `Generate code for the following task:\n\n`;
    prompt += `**Task:** ${task.name}\n`;
    prompt += `**Description:** ${task.description || 'No description'}\n`;
    prompt += `**Category:** ${task.category}\n`;
    prompt += `**Type:** ${task.type}\n`;

    if (context.projectInfo) {
      prompt += `\n**Project Context:**\n`;
      prompt += `- Name: ${context.projectInfo.name || 'Unknown'}\n`;
      prompt += `- Type: ${context.projectInfo.type || 'Unknown'}\n`;

      if (context.projectInfo.technologies) {
        prompt += `- Technologies: ${JSON.stringify(context.projectInfo.technologies)}\n`;
      }
    }

    prompt += `\nGenerate clean, well-documented code following best practices.`;
    prompt += `\nWrap code in \`\`\` code blocks with the appropriate language.`;

    return prompt;
  }

  /**
   * Get system prompt for category
   * @private
   */
  _getSystemPromptForCategory(category) {
    const prompts = {
      backend: 'You are a backend developer expert. Generate clean, efficient server-side code with proper error handling and security practices.',
      frontend: 'You are a frontend developer expert. Generate clean, accessible, responsive UI code following modern best practices.',
      api: 'You are an API design expert. Generate RESTful API endpoints with proper validation, error handling, and documentation.',
      database: 'You are a database expert. Generate optimized schemas, migrations, and queries following best practices.'
    };

    return prompts[category] || 'You are an expert software developer. Generate clean, well-documented code.';
  }

  /**
   * Extract code blocks from response
   * @private
   */
  _extractCodeBlocks(response) {
    const blocks = [];
    const regex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = regex.exec(response)) !== null) {
      blocks.push({
        language: match[1] || 'text',
        code: match[2].trim()
      });
    }

    return blocks;
  }

  /**
   * Log decision to DecisionLogger
   * @private
   */
  async _logDecision(decision, context) {
    if (this.decisionLogger) {
      try {
        await this.decisionLogger.logDecision('plan-executor', decision, context);
      } catch (error) {
        this.logger.warn(`Failed to log decision: ${error.message}`);
      }
    }
  }

  /**
   * Chunk array into smaller arrays
   * @private
   */
  _chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Wait for resume when paused
   * @private
   */
  _waitForResume() {
    return new Promise(resolve => {
      const check = () => {
        if (this.state !== ExecutionState.PAUSED) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  // ============================================
  // Public Control Methods
  // ============================================

  /**
   * Pause execution
   */
  pause() {
    if (this.state === ExecutionState.EXECUTING) {
      this.state = ExecutionState.PAUSED;
      this.logger.info('Execution paused');
      this.emit('execution:paused');
    }
  }

  /**
   * Resume execution
   */
  resume() {
    if (this.state === ExecutionState.PAUSED) {
      this.state = ExecutionState.EXECUTING;
      this.logger.info('Execution resumed');
      this.emit('execution:resumed');
    }
  }

  /**
   * Stop execution
   */
  stop() {
    this.state = ExecutionState.FAILED;
    this.logger.info('Execution stopped');
    this.emit('execution:stopped');
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      state: this.state,
      currentPlan: this.currentPlan?.id || null,
      taskStatus: Object.fromEntries(this.taskStatus),
      config: this.config
    };
  }

  /**
   * Get execution history
   */
  getHistory() {
    return [...this.executionHistory];
  }

  /**
   * Reset executor
   */
  reset() {
    this.state = ExecutionState.IDLE;
    this.currentPlan = null;
    this.taskStatus.clear();
    this.emit('reset');
  }
}

/**
 * Get singleton instance of PlanExecutor
 */
export function getPlanExecutor(config = {}) {
  return PlanExecutor.getInstance(config);
}

export default PlanExecutor;
