/**
 * NefarioAgent (Dr. Nefario)
 * --------------------------
 * User-facing planning assistant that converts conversation summaries
 * into Minions-format execution plans.
 *
 * Named after Dr. Nefario from Despicable Me - the inventor who creates
 * the gadgets and plans for the minions to execute.
 *
 * Part of Minions Client Interface System
 */

import EventEmitter from 'events';
import { createLogger } from '../../foundation/common/logger.js';
import OllamaAdapter from '../gru-agent/OllamaAdapter.js';

// Agent States
export const NefarioState = {
  IDLE: 'idle',
  INITIALIZING: 'initializing',
  GENERATING: 'generating',
  REFINING: 'refining',
  COMPLETE: 'complete',
  ERROR: 'error'
};

// Task categories
const TaskCategories = {
  SETUP: 'setup',
  BACKEND: 'backend',
  FRONTEND: 'frontend',
  DATABASE: 'database',
  API: 'api',
  TESTING: 'testing',
  DOCUMENTATION: 'documentation',
  DEPLOYMENT: 'deployment',
  INFRASTRUCTURE: 'infrastructure',
  SECURITY: 'security'
};

// Task types
const TaskTypes = {
  IMPLEMENTATION: 'implementation',
  CONFIGURATION: 'configuration',
  INTEGRATION: 'integration',
  TESTING: 'testing',
  DOCUMENTATION: 'documentation',
  RESEARCH: 'research'
};

// Phases
const Phases = {
  SETUP: 'setup',
  IMPLEMENTATION: 'implementation',
  TESTING: 'testing',
  DEPLOYMENT: 'deployment'
};

// System prompt for plan generation
const PLANNING_SYSTEM_PROMPT = `You are Dr. Nefario, a meticulous planning genius who creates detailed execution plans for software projects.

Your role is to convert project requirements into structured task lists that can be executed by autonomous agents.

When generating plans, you MUST:
1. Break down features into atomic, actionable tasks
2. Identify dependencies between tasks
3. Assign appropriate categories (setup, backend, frontend, database, api, testing, documentation, deployment)
4. Set realistic complexity scores (1-5 scale)
5. Organize tasks into phases (setup, implementation, testing, deployment)
6. Consider security and best practices

Output your plan in this exact JSON format:
{
  "name": "Project Name",
  "description": "Brief project description",
  "tasks": [
    {
      "id": "task-1",
      "name": "Task name",
      "description": "Detailed task description",
      "type": "implementation|configuration|integration|testing|documentation|research",
      "category": "setup|backend|frontend|database|api|testing|documentation|deployment|infrastructure|security",
      "phase": "setup|implementation|testing|deployment",
      "priority": 1-5,
      "complexity": 1-5,
      "dependencies": ["task-id"],
      "agent": "agent-name or null"
    }
  ],
  "technologies": {
    "language": "primary language",
    "framework": "main framework",
    "database": "database if any",
    "other": ["other technologies"]
  }
}

IMPORTANT:
- Tasks must have unique IDs starting with "task-"
- Dependencies must reference valid task IDs
- Setup tasks should have no dependencies
- Testing tasks should depend on implementation tasks
- Be thorough but not excessive - aim for 5-20 tasks depending on project size`;

let instance = null;

export class NefarioAgent extends EventEmitter {
  constructor(config = {}) {
    super();
    this.logger = createLogger('NefarioAgent');

    this.config = {
      ollamaConfig: config.ollamaConfig || {},
      maxRetries: config.maxRetries || 3,
      ...config
    };

    this.state = NefarioState.IDLE;
    this.aiAdapter = null;
    this.currentPlan = null;
    this.planHistory = [];
    this.isInitialized = false;
  }

  /**
   * Get singleton instance
   */
  static getInstance(config = {}) {
    if (!instance) {
      instance = new NefarioAgent(config);
    }
    return instance;
  }

  /**
   * Initialize the agent
   */
  async initialize() {
    if (this.isInitialized) {
      return { success: true };
    }

    this.state = NefarioState.INITIALIZING;
    this.logger.info('Initializing Dr. Nefario...');

    try {
      // Initialize AI adapter
      this.aiAdapter = new OllamaAdapter(this.config.ollamaConfig);
      await this.aiAdapter.initialize();

      this.isInitialized = true;
      this.state = NefarioState.IDLE;
      this.logger.info('Dr. Nefario initialized successfully');

      this.emit('initialized');
      return { success: true };
    } catch (error) {
      this.state = NefarioState.ERROR;
      this.logger.error(`Initialization failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate a plan from conversation summary
   * @param {object} projectInfo - Project information from Gru
   */
  async generatePlan(projectInfo) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.state = NefarioState.GENERATING;
    this.logger.info('Generating plan...');
    this.emit('generating', { project: projectInfo.name });

    try {
      // Build the prompt for AI
      const prompt = this._buildPlanningPrompt(projectInfo);

      // Generate plan using AI
      const response = await this.aiAdapter.chat([
        { role: 'user', content: prompt }
      ], PLANNING_SYSTEM_PROMPT);

      // Parse the response
      const rawPlan = this._parseAIResponse(response);

      // Convert to Minions format
      const minionsPlan = this._convertToMinionsPlan(rawPlan, projectInfo);

      this.currentPlan = minionsPlan;
      this.state = NefarioState.COMPLETE;

      this.logger.info(`Plan generated with ${minionsPlan.tasks.length} tasks`);
      this.emit('plan:generated', { plan: minionsPlan });

      return minionsPlan;
    } catch (error) {
      this.state = NefarioState.ERROR;
      this.logger.error(`Plan generation failed: ${error.message}`);
      this.emit('error', { error: error.message });
      throw error;
    }
  }

  /**
   * Refine existing plan based on feedback
   * @param {string} feedback - User feedback
   */
  async refinePlan(feedback) {
    if (!this.currentPlan) {
      throw new Error('No plan to refine');
    }

    this.state = NefarioState.REFINING;
    this.logger.info('Refining plan based on feedback...');
    this.emit('refining', { feedback });

    try {
      // Store old plan in history
      this.planHistory.push({ ...this.currentPlan });

      // Build refinement prompt
      const prompt = this._buildRefinementPrompt(this.currentPlan, feedback);

      // Get refined plan from AI
      const response = await this.aiAdapter.chat([
        { role: 'user', content: prompt }
      ], PLANNING_SYSTEM_PROMPT);

      // Parse and convert
      const rawPlan = this._parseAIResponse(response);
      const refinedPlan = this._convertToMinionsPlan(rawPlan, {
        name: this.currentPlan.metadata?.projectName,
        type: this.currentPlan.metadata?.projectType
      });

      // Preserve plan ID for versioning
      refinedPlan.id = this.currentPlan.id;
      refinedPlan.version = this._incrementVersion(this.currentPlan.version);

      this.currentPlan = refinedPlan;
      this.state = NefarioState.COMPLETE;

      this.logger.info('Plan refined successfully');
      this.emit('plan:refined', { plan: refinedPlan });

      return refinedPlan;
    } catch (error) {
      this.state = NefarioState.ERROR;
      this.logger.error(`Plan refinement failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate plan for existing project
   * @param {object} projectInfo - Project info including detected structure
   */
  async generatePlanForExisting(projectInfo) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.state = NefarioState.GENERATING;
    this.logger.info('Generating completion plan for existing project...');
    this.emit('generating', { project: projectInfo.name, type: 'existing' });

    try {
      // Build prompt including detected structure
      const prompt = this._buildExistingProjectPrompt(projectInfo);

      const response = await this.aiAdapter.chat([
        { role: 'user', content: prompt }
      ], PLANNING_SYSTEM_PROMPT);

      const rawPlan = this._parseAIResponse(response);
      const minionsPlan = this._convertToMinionsPlan(rawPlan, projectInfo);

      this.currentPlan = minionsPlan;
      this.state = NefarioState.COMPLETE;

      this.logger.info(`Completion plan generated with ${minionsPlan.tasks.length} tasks`);
      this.emit('plan:generated', { plan: minionsPlan });

      return minionsPlan;
    } catch (error) {
      this.state = NefarioState.ERROR;
      this.logger.error(`Plan generation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build planning prompt from project info
   * @private
   */
  _buildPlanningPrompt(projectInfo) {
    let prompt = `Create a detailed execution plan for the following project:\n\n`;

    if (projectInfo.name) {
      prompt += `**Project Name:** ${projectInfo.name}\n`;
    }

    if (projectInfo.description) {
      prompt += `**Description:** ${projectInfo.description}\n`;
    }

    if (projectInfo.type) {
      prompt += `**Type:** ${projectInfo.type}\n`;
    }

    if (projectInfo.features && projectInfo.features.length > 0) {
      prompt += `\n**Features to implement:**\n`;
      projectInfo.features.forEach((f, i) => {
        if (typeof f === 'string') {
          prompt += `${i + 1}. ${f}\n`;
        } else {
          prompt += `${i + 1}. ${f.name}: ${f.description || ''}\n`;
        }
      });
    }

    if (projectInfo.technologies) {
      prompt += `\n**Technologies:**\n`;
      for (const [key, value] of Object.entries(projectInfo.technologies)) {
        prompt += `- ${key}: ${value}\n`;
      }
    }

    if (projectInfo.requirements) {
      prompt += `\n**Additional Requirements:**\n${projectInfo.requirements}\n`;
    }

    prompt += `\nGenerate a comprehensive plan with tasks organized by phase and proper dependencies.`;

    return prompt;
  }

  /**
   * Build prompt for existing project analysis
   * @private
   */
  _buildExistingProjectPrompt(projectInfo) {
    let prompt = `Create a completion plan for an existing project:\n\n`;

    prompt += `**Project Name:** ${projectInfo.name}\n`;
    prompt += `**Project Path:** ${projectInfo.sourcePath || projectInfo.path}\n`;

    if (projectInfo.detectedStructure) {
      const structure = projectInfo.detectedStructure;

      if (structure.framework && structure.framework.length > 0) {
        prompt += `\n**Detected Frameworks:** ${structure.framework.join(', ')}\n`;
      }

      if (structure.language && structure.language.length > 0) {
        prompt += `**Languages:** ${structure.language.join(', ')}\n`;
      }

      if (structure.components && structure.components.length > 0) {
        prompt += `\n**Project Components:**\n`;
        structure.components.forEach(comp => {
          prompt += `- ${comp.name} (${comp.type}): ${comp.path}\n`;
        });
      }
    }

    if (projectInfo.goals && projectInfo.goals.length > 0) {
      prompt += `\n**Goals to achieve:**\n`;
      projectInfo.goals.forEach((g, i) => {
        prompt += `${i + 1}. ${g}\n`;
      });
    }

    if (projectInfo.gaps && projectInfo.gaps.length > 0) {
      prompt += `\n**Known gaps to address:**\n`;
      projectInfo.gaps.forEach((gap, i) => {
        prompt += `${i + 1}. ${gap}\n`;
      });
    }

    prompt += `\nAnalyze the existing structure and create tasks to complete/improve the project.`;
    prompt += `\nFocus on: missing features, test coverage, documentation, and code quality.`;

    return prompt;
  }

  /**
   * Build refinement prompt
   * @private
   */
  _buildRefinementPrompt(currentPlan, feedback) {
    let prompt = `Refine the following plan based on user feedback:\n\n`;

    prompt += `**Current Plan:**\n`;
    prompt += `- ${currentPlan.tasks.length} tasks\n`;
    prompt += `- Tasks: ${currentPlan.tasks.map(t => t.name).join(', ')}\n\n`;

    prompt += `**User Feedback:**\n${feedback}\n\n`;

    prompt += `Generate an updated plan addressing the feedback. Keep task IDs consistent where possible.`;

    return prompt;
  }

  /**
   * Parse AI response to extract JSON plan
   * @private
   */
  _parseAIResponse(response) {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // If no JSON found, create basic structure from text
      return this._createPlanFromText(response);
    } catch (error) {
      this.logger.warn(`Failed to parse AI response as JSON: ${error.message}`);
      return this._createPlanFromText(response);
    }
  }

  /**
   * Create plan structure from text response
   * @private
   */
  _createPlanFromText(text) {
    // Extract task-like lines
    const lines = text.split('\n').filter(line => line.trim());
    const tasks = [];

    let taskId = 1;
    for (const line of lines) {
      // Look for numbered items or bullet points
      const match = line.match(/^[\d\-\*\•]\s*(.+)/);
      if (match) {
        tasks.push({
          id: `task-${taskId}`,
          name: match[1].trim().substring(0, 100),
          description: '',
          type: 'implementation',
          category: this._inferCategory(match[1]),
          phase: this._inferPhase(match[1]),
          priority: 3,
          complexity: 3,
          dependencies: taskId > 1 ? [`task-${taskId - 1}`] : []
        });
        taskId++;
      }
    }

    // If no tasks found, create a generic one
    if (tasks.length === 0) {
      tasks.push({
        id: 'task-1',
        name: 'Review project requirements',
        description: 'Analyze requirements and plan implementation',
        type: 'research',
        category: 'setup',
        phase: 'setup',
        priority: 5,
        complexity: 2,
        dependencies: []
      });
    }

    return {
      name: 'Generated Project',
      description: 'Auto-generated plan',
      tasks
    };
  }

  /**
   * Infer task category from name
   * @private
   */
  _inferCategory(taskName) {
    const lower = taskName.toLowerCase();

    if (lower.includes('test') || lower.includes('spec')) return TaskCategories.TESTING;
    if (lower.includes('setup') || lower.includes('install') || lower.includes('init')) return TaskCategories.SETUP;
    if (lower.includes('frontend') || lower.includes('ui') || lower.includes('component')) return TaskCategories.FRONTEND;
    if (lower.includes('backend') || lower.includes('server') || lower.includes('api')) return TaskCategories.BACKEND;
    if (lower.includes('database') || lower.includes('db') || lower.includes('schema')) return TaskCategories.DATABASE;
    if (lower.includes('doc') || lower.includes('readme')) return TaskCategories.DOCUMENTATION;
    if (lower.includes('deploy') || lower.includes('build') || lower.includes('release')) return TaskCategories.DEPLOYMENT;
    if (lower.includes('security') || lower.includes('auth')) return TaskCategories.SECURITY;

    return TaskCategories.BACKEND;
  }

  /**
   * Infer task phase from name
   * @private
   */
  _inferPhase(taskName) {
    const lower = taskName.toLowerCase();

    if (lower.includes('setup') || lower.includes('init') || lower.includes('install')) return Phases.SETUP;
    if (lower.includes('test') || lower.includes('spec') || lower.includes('verify')) return Phases.TESTING;
    if (lower.includes('deploy') || lower.includes('release') || lower.includes('build')) return Phases.DEPLOYMENT;

    return Phases.IMPLEMENTATION;
  }

  /**
   * Convert raw plan to Minions format
   * @private
   */
  _convertToMinionsPlan(rawPlan, projectInfo) {
    const planId = `plan-${Date.now()}`;
    const tasks = this._normalizeTasks(rawPlan.tasks || []);

    // Build execution groups by phase
    const executionGroups = this._buildExecutionGroups(tasks);

    // Build dependency graph
    const dependencyGraph = this._buildDependencyGraph(tasks);

    // Organize tasks by phase
    const phases = this._organizeByPhase(tasks);

    // Calculate checkpoints
    const checkpoints = this._generateCheckpoints(executionGroups);

    // Calculate total duration
    const estimatedDuration = tasks.reduce((sum, t) => {
      const baseDuration = 900000; // 15 minutes base
      return sum + (baseDuration * (t.complexity || 3) / 3);
    }, 0);

    return {
      id: planId,
      version: '1.0',
      status: 'pending',
      tasks,
      executionGroups,
      checkpoints,
      dependencyGraph,
      phases,
      estimatedDuration,
      taskCount: tasks.length,
      metadata: {
        createdAt: new Date().toISOString(),
        source: 'nefario',
        projectName: rawPlan.name || projectInfo?.name,
        projectType: projectInfo?.type,
        technologies: rawPlan.technologies || {},
        maxConcurrency: 3
      }
    };
  }

  /**
   * Normalize task structure
   * @private
   */
  _normalizeTasks(tasks) {
    return tasks.map((task, index) => ({
      id: task.id || `task-${index + 1}`,
      name: task.name || `Task ${index + 1}`,
      description: task.description || '',
      type: task.type || TaskTypes.IMPLEMENTATION,
      priority: Math.min(5, Math.max(1, task.priority || 3)),
      complexity: Math.min(5, Math.max(1, task.complexity || 3)),
      dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
      category: task.category || TaskCategories.BACKEND,
      estimatedDuration: 900000 * (task.complexity || 3) / 3,
      status: 'pending',
      agent: task.agent || this._assignAgent(task.category),
      phase: task.phase || Phases.IMPLEMENTATION,
      metadata: {
        source: 'nefario'
      }
    }));
  }

  /**
   * Assign agent based on category
   * @private
   */
  _assignAgent(category) {
    const agentMap = {
      [TaskCategories.BACKEND]: 'backend-agent',
      [TaskCategories.FRONTEND]: 'frontend-agent',
      [TaskCategories.DATABASE]: 'database-agent',
      [TaskCategories.API]: 'api-agent',
      [TaskCategories.TESTING]: 'tester-agent',
      [TaskCategories.DOCUMENTATION]: 'docs-agent',
      [TaskCategories.DEPLOYMENT]: 'deploy-agent',
      [TaskCategories.SETUP]: null,
      [TaskCategories.INFRASTRUCTURE]: 'infra-agent',
      [TaskCategories.SECURITY]: 'security-agent'
    };

    return agentMap[category] || null;
  }

  /**
   * Build execution groups from tasks
   * @private
   */
  _buildExecutionGroups(tasks) {
    const groups = [];
    const phaseOrder = ['setup', 'implementation', 'testing', 'deployment'];

    phaseOrder.forEach((phase, order) => {
      const phaseTasks = tasks.filter(t => t.phase === phase);
      if (phaseTasks.length > 0) {
        groups.push({
          id: `group-${order + 1}`,
          phase,
          tasks: phaseTasks.map(t => t.id),
          canRunInParallel: phase !== 'setup',
          order
        });
      }
    });

    return groups;
  }

  /**
   * Build dependency graph
   * @private
   */
  _buildDependencyGraph(tasks) {
    const graph = {};

    for (const task of tasks) {
      graph[task.id] = {
        dependencies: task.dependencies || [],
        dependents: []
      };
    }

    // Calculate dependents
    for (const task of tasks) {
      for (const depId of task.dependencies || []) {
        if (graph[depId]) {
          graph[depId].dependents.push(task.id);
        }
      }
    }

    return graph;
  }

  /**
   * Organize tasks by phase
   * @private
   */
  _organizeByPhase(tasks) {
    const phases = {
      setup: [],
      implementation: [],
      testing: [],
      deployment: []
    };

    for (const task of tasks) {
      const phase = task.phase || 'implementation';
      if (phases[phase]) {
        phases[phase].push(task);
      } else {
        phases.implementation.push(task);
      }
    }

    return phases;
  }

  /**
   * Generate checkpoints for plan
   * @private
   */
  _generateCheckpoints(executionGroups) {
    const checkpoints = [];

    for (let i = 0; i < executionGroups.length; i++) {
      const group = executionGroups[i];
      const nextGroup = executionGroups[i + 1];

      if (nextGroup) {
        checkpoints.push({
          id: `checkpoint-phase-${nextGroup.phase}`,
          afterGroup: group.id,
          type: 'phase_transition',
          description: `Checkpoint after ${group.phase} phase`
        });
      }
    }

    // Add final checkpoint
    if (executionGroups.length > 0) {
      const lastGroup = executionGroups[executionGroups.length - 1];
      checkpoints.push({
        id: 'checkpoint-final',
        afterGroup: lastGroup.id,
        type: 'final',
        description: 'Final checkpoint before completion'
      });
    }

    return checkpoints;
  }

  /**
   * Increment version string
   * @private
   */
  _incrementVersion(version) {
    if (!version) return '1.1';
    const parts = version.split('.');
    const minor = parseInt(parts[1] || 0) + 1;
    return `${parts[0]}.${minor}`;
  }

  /**
   * Get current plan
   */
  getCurrentPlan() {
    return this.currentPlan;
  }

  /**
   * Get plan history
   */
  getPlanHistory() {
    return [...this.planHistory];
  }

  /**
   * Get state
   */
  getState() {
    return this.state;
  }

  /**
   * Create human-readable plan summary
   * @param {object} plan - Minions plan
   */
  createReadableSummary(plan) {
    if (!plan) return 'No plan available.';

    const lines = [];

    lines.push(`**Project:** ${plan.metadata?.projectName || 'Unnamed Project'}`);
    lines.push(`**Tasks:** ${plan.taskCount}`);
    lines.push('');

    // Group by phase
    for (const [phase, tasks] of Object.entries(plan.phases || {})) {
      if (tasks.length > 0) {
        lines.push(`**${phase.charAt(0).toUpperCase() + phase.slice(1)} Phase:**`);
        for (const task of tasks) {
          const complexity = '*'.repeat(task.complexity || 3);
          lines.push(`  - ${task.name} [${complexity}]`);
        }
        lines.push('');
      }
    }

    if (plan.metadata?.technologies) {
      lines.push('**Technologies:**');
      for (const [key, value] of Object.entries(plan.metadata.technologies)) {
        if (value) {
          lines.push(`  - ${key}: ${Array.isArray(value) ? value.join(', ') : value}`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Reset agent state
   */
  reset() {
    this.state = NefarioState.IDLE;
    this.currentPlan = null;
    this.emit('reset');
  }

  /**
   * Shutdown
   */
  async shutdown() {
    this.logger.info('Shutting down Dr. Nefario...');

    if (this.aiAdapter) {
      await this.aiAdapter.shutdown();
    }

    this.reset();
    this.removeAllListeners();
    this.isInitialized = false;
    instance = null;

    this.logger.info('Dr. Nefario shutdown complete');
  }
}

/**
 * Get singleton instance of NefarioAgent
 */
export function getNefarioAgent(config = {}) {
  return NefarioAgent.getInstance(config);
}

export default NefarioAgent;
