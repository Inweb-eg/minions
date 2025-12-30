/**
 * BrainController - Central Decision Authority
 * =============================================
 * The Engineering Brain's core decision-making component.
 *
 * Philosophy: "The LLM proposes, the Brain decides."
 *
 * This component:
 * - Makes ALL strategic decisions (with logging)
 * - Evaluates alternatives before choosing
 * - Coordinates agents (Silas, Lucy, Nefario)
 * - Manages execution lifecycle
 * - Tracks reasoning for every decision
 *
 * Extracted from GruAgent to separate UI concerns from decision logic.
 */

import EventEmitter from 'events';
import { createLogger } from '../common/logger.js';
import { getDecisionLogger, DecisionType, DecisionOutcome } from '../memory-store/DecisionLogger.js';
import { getEventBus } from '../event-bus/AgentEventBus.js';

const logger = createLogger('BrainController');

/**
 * Brain states
 */
export const BrainState = {
  IDLE: 'idle',
  ANALYZING: 'analyzing',
  PLANNING: 'planning',
  DECIDING: 'deciding',
  EXECUTING: 'executing',
  MONITORING: 'monitoring',
  PAUSED: 'paused',
  ERROR: 'error'
};

/**
 * Decision categories for the brain
 */
export const BrainDecisionCategory = {
  // High-level strategy
  PROJECT_APPROACH: 'project_approach',
  EXECUTION_STRATEGY: 'execution_strategy',

  // Agent coordination
  AGENT_SELECTION: 'agent_selection',
  AGENT_DELEGATION: 'agent_delegation',

  // Plan evaluation
  PLAN_APPROVAL: 'plan_approval',
  PLAN_MODIFICATION: 'plan_modification',

  // Execution control
  EXECUTION_START: 'execution_start',
  EXECUTION_PAUSE: 'execution_pause',
  EXECUTION_RESUME: 'execution_resume',
  EXECUTION_ABORT: 'execution_abort',

  // Error handling
  ERROR_RECOVERY: 'error_recovery',
  ROLLBACK_DECISION: 'rollback_decision'
};

/**
 * BrainController - The central decision authority
 */
export class BrainController extends EventEmitter {
  constructor(config = {}) {
    super();

    this.name = 'BrainController';
    this.state = BrainState.IDLE;
    this.logger = logger;

    // Configuration
    this.config = {
      autoApprove: config.autoApprove || false,
      maxRetries: config.maxRetries || 3,
      decisionTimeout: config.decisionTimeout || 30000,
      ...config
    };

    // Core dependencies
    this.decisionLogger = null;
    this.eventBus = null;

    // Agent references
    this.agents = {
      silas: null,    // ProjectManagerAgent
      lucy: null,     // ProjectCompletionAgent
      nefario: null,  // NefarioAgent (Dr. Nefario)
      tom: null       // SecurityRiskAgent
    };

    // Current context
    this.currentProject = null;
    this.currentPlan = null;
    this.currentExecution = null;

    // Decision history (in-memory for fast access)
    this.recentDecisions = [];
    this.maxRecentDecisions = 100;

    // Pending decisions waiting for evaluation
    this.pendingEvaluations = new Map();
  }

  /**
   * Initialize the brain controller
   */
  async initialize() {
    this.logger.info('Initializing BrainController...');

    // Get core dependencies
    this.decisionLogger = getDecisionLogger();
    await this.decisionLogger.initialize();

    this.eventBus = getEventBus();
    this._subscribeToEvents();

    this.state = BrainState.IDLE;
    this.emit('initialized');

    this.logger.info('BrainController initialized - ready to make decisions');
    return { success: true };
  }

  /**
   * Set agent references
   * @param {object} agents - { silas, lucy, nefario, tom }
   */
  setAgents(agents) {
    if (agents.silas) this.agents.silas = agents.silas;
    if (agents.lucy) this.agents.lucy = agents.lucy;
    if (agents.nefario) this.agents.nefario = agents.nefario;
    if (agents.tom) this.agents.tom = agents.tom;

    this.logger.info('Agents connected to BrainController');
  }

  // ==================== Decision Making ====================

  /**
   * Make a decision with full logging and reasoning
   * This is the CORE method - all brain decisions go through here
   *
   * @param {object} options - Decision options
   * @param {string} options.category - Decision category
   * @param {object} options.context - Context for the decision
   * @param {any[]} options.alternatives - Alternative choices
   * @param {function} options.evaluator - Function to score alternatives
   * @param {string} options.reasoning - Why this decision is being made
   * @returns {object} Decision result
   */
  async makeDecision(options) {
    const { category, context, alternatives = [], evaluator, reasoning } = options;

    this.state = BrainState.DECIDING;

    // Evaluate alternatives if provided
    let selectedAlternative = null;
    let evaluationResults = [];

    if (alternatives.length > 0 && evaluator) {
      evaluationResults = await Promise.all(
        alternatives.map(async (alt) => ({
          alternative: alt,
          score: await evaluator(alt, context)
        }))
      );

      // Sort by score descending
      evaluationResults.sort((a, b) => b.score - a.score);
      selectedAlternative = evaluationResults[0];
    }

    // Build decision record
    const decision = {
      category,
      context,
      alternatives: evaluationResults,
      selected: selectedAlternative?.alternative || null,
      reasoning: reasoning || this._generateReasoning(category, selectedAlternative, evaluationResults),
      timestamp: Date.now()
    };

    // Log the decision
    const decisionId = await this.decisionLogger.logDecision({
      agent: this.name,
      type: this._mapCategoryToType(category),
      context,
      decision: decision.selected,
      reasoning: decision.reasoning,
      metadata: {
        alternatives: evaluationResults,
        category
      }
    });

    decision.id = decisionId;

    // Track in recent decisions
    this._trackRecentDecision(decision);

    // Emit decision event
    this.emit('decision:made', decision);
    this.eventBus.publish('brain:decision:made', {
      decisionId,
      category,
      selected: decision.selected
    });

    this.state = BrainState.IDLE;

    return decision;
  }

  /**
   * Evaluate a plan and decide whether to approve
   * @param {object} plan - The plan to evaluate
   * @param {object} projectContext - Project context
   * @returns {object} Evaluation result
   */
  async evaluatePlan(plan, projectContext = {}) {
    this.state = BrainState.ANALYZING;
    this.logger.info(`Evaluating plan: ${plan.id || 'unnamed'}`);

    const evaluation = {
      planId: plan.id,
      scores: {},
      issues: [],
      recommendations: [],
      approved: false
    };

    // Score various aspects
    evaluation.scores.completeness = this._scorePlanCompleteness(plan);
    evaluation.scores.feasibility = this._scorePlanFeasibility(plan, projectContext);
    evaluation.scores.risk = this._scorePlanRisk(plan);
    evaluation.scores.dependencies = this._scoreDependencyStructure(plan);

    // Overall score
    const weights = { completeness: 0.3, feasibility: 0.3, risk: 0.25, dependencies: 0.15 };
    evaluation.overallScore = Object.entries(evaluation.scores)
      .reduce((sum, [key, score]) => sum + score * weights[key], 0);

    // Identify issues
    if (evaluation.scores.completeness < 0.6) {
      evaluation.issues.push({
        severity: 'high',
        message: 'Plan appears incomplete - missing task definitions or descriptions'
      });
    }

    if (evaluation.scores.risk > 0.7) {
      evaluation.issues.push({
        severity: 'high',
        message: 'Plan has high complexity or risk factors'
      });
    }

    if (evaluation.scores.dependencies < 0.5) {
      evaluation.issues.push({
        severity: 'medium',
        message: 'Dependency structure may have circular references or gaps'
      });
    }

    // Make approval decision
    const approvalAlternatives = [
      { action: 'approve', condition: 'Plan meets quality thresholds' },
      { action: 'modify', condition: 'Plan needs adjustments before execution' },
      { action: 'reject', condition: 'Plan has critical issues requiring redesign' }
    ];

    const decision = await this.makeDecision({
      category: BrainDecisionCategory.PLAN_APPROVAL,
      context: { plan, evaluation, projectContext },
      alternatives: approvalAlternatives,
      evaluator: (alt) => {
        if (alt.action === 'approve' && evaluation.overallScore >= 0.7 && evaluation.issues.filter(i => i.severity === 'high').length === 0) {
          return 1.0;
        }
        if (alt.action === 'modify' && evaluation.overallScore >= 0.5) {
          return 0.7;
        }
        if (alt.action === 'reject') {
          return evaluation.overallScore < 0.4 ? 0.8 : 0.2;
        }
        return 0.3;
      },
      reasoning: `Plan evaluation: overall score ${(evaluation.overallScore * 100).toFixed(1)}%, ${evaluation.issues.length} issues identified`
    });

    evaluation.approved = decision.selected?.action === 'approve';
    evaluation.decision = decision;

    this.currentPlan = evaluation.approved ? plan : null;

    this.emit('plan:evaluated', evaluation);

    return evaluation;
  }

  /**
   * Decide which agent should handle a task
   * @param {object} task - Task to delegate
   * @returns {object} Delegation decision
   */
  async delegateTask(task) {
    this.logger.info(`Deciding agent for task: ${task.name || task.id}`);

    const agentCapabilities = {
      silas: ['project_setup', 'project_scan', 'framework_detection', 'configuration'],
      lucy: ['gap_detection', 'completion_tracking', 'autonomous_loop', 'verification'],
      nefario: ['plan_generation', 'code_generation', 'task_execution', 'implementation'],
      tom: ['security_scan', 'vulnerability_check', 'risk_assessment', 'validation']
    };

    const availableAgents = Object.entries(this.agents)
      .filter(([name, agent]) => agent !== null)
      .map(([name]) => ({
        name,
        capabilities: agentCapabilities[name] || []
      }));

    const decision = await this.makeDecision({
      category: BrainDecisionCategory.AGENT_DELEGATION,
      context: { task },
      alternatives: availableAgents,
      evaluator: (agent) => {
        const taskCategory = task.category?.toLowerCase() || '';
        const taskType = task.type?.toLowerCase() || '';

        // Score based on capability match
        let score = 0;
        for (const capability of agent.capabilities) {
          if (taskCategory.includes(capability) || taskType.includes(capability)) {
            score += 0.4;
          }
          if (task.name?.toLowerCase().includes(capability)) {
            score += 0.2;
          }
        }

        return Math.min(score, 1.0);
      },
      reasoning: `Task delegation for ${task.category || 'general'} task`
    });

    return {
      task,
      delegatedTo: decision.selected?.name || 'nefario',
      decision
    };
  }

  // ==================== Execution Control ====================

  /**
   * Start execution of a plan
   * @param {object} plan - Plan to execute
   * @param {object} context - Execution context
   * @returns {object} Execution result
   */
  async startExecution(plan, context = {}) {
    this.logger.info('BrainController: Starting execution');

    // First, evaluate if we should proceed
    const preCheckDecision = await this.makeDecision({
      category: BrainDecisionCategory.EXECUTION_START,
      context: { plan, projectContext: context },
      alternatives: [
        { action: 'proceed', reason: 'Plan is ready for execution' },
        { action: 'delay', reason: 'Prerequisites not met' },
        { action: 'abort', reason: 'Critical issues prevent execution' }
      ],
      evaluator: (alt) => {
        if (alt.action === 'proceed' && this.currentPlan) {
          return 0.9;
        }
        if (alt.action === 'delay') {
          return 0.5;
        }
        return 0.2;
      },
      reasoning: 'Evaluating execution readiness'
    });

    if (preCheckDecision.selected?.action !== 'proceed') {
      return {
        success: false,
        reason: preCheckDecision.selected?.reason || 'Execution not approved',
        decision: preCheckDecision
      };
    }

    this.state = BrainState.EXECUTING;

    this.currentExecution = {
      planId: plan.id,
      startedAt: Date.now(),
      status: 'running',
      tasksCompleted: 0,
      tasksFailed: 0
    };

    // Execute via Nefario if available
    if (this.agents.nefario) {
      try {
        const result = await this.agents.nefario.executePlan(plan, context);

        this.currentExecution.status = result.success ? 'completed' : 'failed';
        this.currentExecution.result = result;

        // Update decision outcome
        await this.decisionLogger.updateOutcome(
          preCheckDecision.id,
          result.success ? DecisionOutcome.SUCCESS : DecisionOutcome.PARTIAL_SUCCESS,
          { result }
        );

        this.emit('execution:completed', this.currentExecution);

        return {
          success: result.success,
          execution: this.currentExecution,
          result
        };
      } catch (error) {
        this.currentExecution.status = 'error';
        this.currentExecution.error = error.message;

        await this.decisionLogger.updateOutcome(
          preCheckDecision.id,
          DecisionOutcome.FAILED,
          { error: error.message }
        );

        this.emit('execution:error', { error, execution: this.currentExecution });

        throw error;
      }
    }

    return {
      success: false,
      reason: 'No execution agent (Nefario) available'
    };
  }

  /**
   * Pause current execution
   * @param {string} reason - Reason for pausing
   */
  async pauseExecution(reason = 'User requested') {
    const decision = await this.makeDecision({
      category: BrainDecisionCategory.EXECUTION_PAUSE,
      context: { execution: this.currentExecution, reason },
      alternatives: [
        { action: 'pause', saveState: true },
        { action: 'continue', ignoreRequest: true }
      ],
      evaluator: (alt) => alt.action === 'pause' ? 0.9 : 0.1,
      reasoning: `Pause requested: ${reason}`
    });

    if (decision.selected?.action === 'pause') {
      this.state = BrainState.PAUSED;

      if (this.agents.lucy) {
        await this.agents.lucy.pauseCompletion();
      }

      this.emit('execution:paused', { reason, decision });
    }

    return { paused: decision.selected?.action === 'pause', decision };
  }

  /**
   * Resume execution
   */
  async resumeExecution() {
    const decision = await this.makeDecision({
      category: BrainDecisionCategory.EXECUTION_RESUME,
      context: { execution: this.currentExecution },
      alternatives: [
        { action: 'resume', fromState: true },
        { action: 'restart', fromBeginning: true }
      ],
      evaluator: (alt) => alt.action === 'resume' ? 0.9 : 0.3,
      reasoning: 'Resuming execution from saved state'
    });

    this.state = BrainState.EXECUTING;

    if (this.agents.lucy) {
      await this.agents.lucy.resumeCompletion();
    }

    this.emit('execution:resumed', { decision });

    return { resumed: true, decision };
  }

  /**
   * Abort execution
   * @param {string} reason - Reason for aborting
   */
  async abortExecution(reason = 'User requested') {
    const decision = await this.makeDecision({
      category: BrainDecisionCategory.EXECUTION_ABORT,
      context: { execution: this.currentExecution, reason },
      alternatives: [
        { action: 'abort', cleanup: true },
        { action: 'abort', cleanup: false },
        { action: 'continue' }
      ],
      evaluator: (alt) => {
        if (alt.action === 'abort' && alt.cleanup) return 0.8;
        if (alt.action === 'abort') return 0.6;
        return 0.2;
      },
      reasoning: `Abort requested: ${reason}`
    });

    if (decision.selected?.action === 'abort') {
      this.state = BrainState.IDLE;

      if (this.agents.lucy) {
        await this.agents.lucy.stopCompletion();
      }

      if (this.currentExecution) {
        this.currentExecution.status = 'aborted';
        this.currentExecution.abortReason = reason;
      }

      this.emit('execution:aborted', { reason, decision });
    }

    return { aborted: decision.selected?.action === 'abort', decision };
  }

  // ==================== Gap Detection & Resolution ====================

  /**
   * Analyze project for gaps and decide on resolution strategy
   * @param {object} project - Project to analyze
   * @returns {object} Gap analysis and resolution plan
   */
  async analyzeAndResolveGaps(project) {
    this.state = BrainState.ANALYZING;
    this.logger.info(`Analyzing gaps for project: ${project.name || project.path}`);

    let gaps = [];

    // Use Lucy for gap detection if available
    if (this.agents.lucy) {
      const analysis = await this.agents.lucy.detectGaps(project, {
        includeCodeQuality: true,
        includeTestCoverage: true,
        includeSecurity: true
      });
      gaps = analysis.gaps || [];
    }

    if (gaps.length === 0) {
      this.logger.info('No gaps detected');
      return { gaps: [], resolutionPlan: null };
    }

    // Prioritize gaps
    const prioritizedGaps = this._prioritizeGaps(gaps);

    // Decide resolution strategy
    const decision = await this.makeDecision({
      category: BrainDecisionCategory.EXECUTION_STRATEGY,
      context: { project, gaps: prioritizedGaps },
      alternatives: [
        { strategy: 'sequential', description: 'Fix gaps one at a time' },
        { strategy: 'parallel', description: 'Fix independent gaps in parallel' },
        { strategy: 'prioritized', description: 'Fix critical gaps first, defer minor ones' }
      ],
      evaluator: (alt) => {
        const criticalCount = prioritizedGaps.filter(g => g.priority === 'critical').length;
        const totalCount = prioritizedGaps.length;

        if (alt.strategy === 'prioritized' && criticalCount > 0) return 0.9;
        if (alt.strategy === 'parallel' && totalCount > 3 && criticalCount === 0) return 0.8;
        if (alt.strategy === 'sequential') return 0.6;
        return 0.5;
      },
      reasoning: `Gap resolution for ${prioritizedGaps.length} identified gaps`
    });

    // Generate resolution plan if Nefario is available
    let resolutionPlan = null;
    if (this.agents.nefario && prioritizedGaps.length > 0) {
      resolutionPlan = await this.agents.nefario.generatePlan({
        type: 'gap_resolution',
        gaps: prioritizedGaps,
        strategy: decision.selected?.strategy
      });
    }

    this.emit('gaps:analyzed', {
      gaps: prioritizedGaps,
      strategy: decision.selected?.strategy,
      resolutionPlan
    });

    return {
      gaps: prioritizedGaps,
      strategy: decision.selected?.strategy,
      resolutionPlan,
      decision
    };
  }

  // ==================== Status & Queries ====================

  /**
   * Get current brain status
   */
  getStatus() {
    return {
      state: this.state,
      currentProject: this.currentProject?.name || null,
      currentPlan: this.currentPlan?.id || null,
      currentExecution: this.currentExecution,
      recentDecisions: this.recentDecisions.slice(0, 10),
      agents: {
        silas: !!this.agents.silas,
        lucy: !!this.agents.lucy,
        nefario: !!this.agents.nefario,
        tom: !!this.agents.tom
      }
    };
  }

  /**
   * Query decision history
   * @param {object} query - Query parameters
   */
  async queryDecisions(query = {}) {
    return await this.decisionLogger.queryDecisions({
      agent: this.name,
      ...query
    });
  }

  /**
   * Get reasoning trail for a context
   * @param {string} context - Context to query
   */
  async getReasoningTrail(context) {
    return await this.decisionLogger.getReasoningTrail(context);
  }

  // ==================== Private Methods ====================

  _subscribeToEvents() {
    // Listen for agent events to inform decisions
    this.eventBus.subscribe('agent:completed', this.name, (data) => {
      this._onAgentCompleted(data);
    });

    this.eventBus.subscribe('agent:failed', this.name, (data) => {
      this._onAgentFailed(data);
    });

    this.eventBus.subscribe('tests:failed', this.name, (data) => {
      this._onTestsFailed(data);
    });
  }

  _onAgentCompleted(data) {
    this.logger.debug(`Agent completed: ${data.agent}`);
    // Could trigger next decision based on completion
  }

  _onAgentFailed(data) {
    this.logger.warn(`Agent failed: ${data.agent} - ${data.error}`);
    // Could trigger recovery decision
  }

  _onTestsFailed(data) {
    this.logger.warn(`Tests failed: ${data.failedCount} failures`);
    // Could trigger auto-fix decision
  }

  _trackRecentDecision(decision) {
    this.recentDecisions.unshift(decision);
    if (this.recentDecisions.length > this.maxRecentDecisions) {
      this.recentDecisions.pop();
    }
  }

  _mapCategoryToType(category) {
    const mapping = {
      [BrainDecisionCategory.PROJECT_APPROACH]: DecisionType.ARCHITECTURE,
      [BrainDecisionCategory.EXECUTION_STRATEGY]: DecisionType.TASK_BREAKDOWN,
      [BrainDecisionCategory.AGENT_SELECTION]: DecisionType.AGENT_DELEGATION,
      [BrainDecisionCategory.AGENT_DELEGATION]: DecisionType.AGENT_DELEGATION,
      [BrainDecisionCategory.PLAN_APPROVAL]: DecisionType.PRIORITIZATION,
      [BrainDecisionCategory.PLAN_MODIFICATION]: DecisionType.REFACTORING,
      [BrainDecisionCategory.EXECUTION_START]: DecisionType.TASK_BREAKDOWN,
      [BrainDecisionCategory.EXECUTION_PAUSE]: DecisionType.ERROR_HANDLING,
      [BrainDecisionCategory.EXECUTION_RESUME]: DecisionType.RECOVERY,
      [BrainDecisionCategory.EXECUTION_ABORT]: DecisionType.ROLLBACK,
      [BrainDecisionCategory.ERROR_RECOVERY]: DecisionType.ERROR_HANDLING,
      [BrainDecisionCategory.ROLLBACK_DECISION]: DecisionType.ROLLBACK
    };
    return mapping[category] || DecisionType.CODE_GENERATION;
  }

  _generateReasoning(category, selected, alternatives) {
    if (!selected) {
      return `No suitable alternative found for ${category}`;
    }

    const otherScores = alternatives
      .filter(a => a !== selected)
      .map(a => `${JSON.stringify(a.alternative)}: ${(a.score * 100).toFixed(0)}%`)
      .join(', ');

    return `Selected ${JSON.stringify(selected.alternative)} (score: ${(selected.score * 100).toFixed(0)}%) over alternatives: ${otherScores || 'none'}`;
  }

  _scorePlanCompleteness(plan) {
    if (!plan || !plan.tasks) return 0;

    let score = 0;
    const tasks = plan.tasks || [];

    // Has tasks
    if (tasks.length > 0) score += 0.3;

    // Tasks have descriptions
    const withDescriptions = tasks.filter(t => t.description && t.description.length > 10).length;
    score += (withDescriptions / Math.max(tasks.length, 1)) * 0.3;

    // Tasks have categories
    const withCategories = tasks.filter(t => t.category).length;
    score += (withCategories / Math.max(tasks.length, 1)) * 0.2;

    // Has phases or groups
    if (plan.phases && Object.keys(plan.phases).length > 0) score += 0.1;
    if (plan.executionGroups && plan.executionGroups.length > 0) score += 0.1;

    return Math.min(score, 1.0);
  }

  _scorePlanFeasibility(plan, context) {
    if (!plan || !plan.tasks) return 0;

    let score = 0.5; // Base score

    const tasks = plan.tasks || [];

    // Penalize very large plans
    if (tasks.length > 50) score -= 0.2;
    else if (tasks.length > 20) score -= 0.1;

    // Penalize high complexity tasks
    const highComplexity = tasks.filter(t => (t.complexity || 1) > 3).length;
    score -= (highComplexity / Math.max(tasks.length, 1)) * 0.2;

    // Bonus for reasonable task sizes
    if (tasks.length >= 3 && tasks.length <= 15) score += 0.2;

    return Math.max(0, Math.min(score, 1.0));
  }

  _scorePlanRisk(plan) {
    if (!plan || !plan.tasks) return 0;

    let riskScore = 0;
    const tasks = plan.tasks || [];

    // High complexity = high risk
    const avgComplexity = tasks.reduce((sum, t) => sum + (t.complexity || 1), 0) / Math.max(tasks.length, 1);
    riskScore += avgComplexity * 0.15;

    // Many dependencies = higher risk
    const totalDeps = tasks.reduce((sum, t) => sum + (t.dependencies?.length || 0), 0);
    riskScore += (totalDeps / Math.max(tasks.length, 1)) * 0.1;

    // Security-related tasks = higher risk
    const securityTasks = tasks.filter(t =>
      t.category?.includes('security') ||
      t.name?.toLowerCase().includes('auth')
    ).length;
    riskScore += (securityTasks / Math.max(tasks.length, 1)) * 0.2;

    return Math.min(riskScore, 1.0);
  }

  _scoreDependencyStructure(plan) {
    if (!plan || !plan.tasks) return 0;

    const tasks = plan.tasks || [];
    const taskIds = new Set(tasks.map(t => t.id));

    let score = 1.0;

    // Check for invalid dependencies
    for (const task of tasks) {
      const deps = task.dependencies || [];
      for (const dep of deps) {
        if (!taskIds.has(dep)) {
          score -= 0.1; // Penalize missing dependency
        }
      }
    }

    // Check for circular dependencies (simple check)
    // Full cycle detection would require graph traversal
    for (const task of tasks) {
      const deps = task.dependencies || [];
      if (deps.includes(task.id)) {
        score -= 0.3; // Self-dependency
      }
    }

    return Math.max(0, score);
  }

  _prioritizeGaps(gaps) {
    return gaps.map(gap => {
      let priority = 'low';

      // Security gaps are critical
      if (gap.type?.includes('security') || gap.category === 'security') {
        priority = 'critical';
      }
      // Missing tests are high priority
      else if (gap.type?.includes('test') || gap.category === 'testing') {
        priority = 'high';
      }
      // Code quality issues are medium
      else if (gap.type?.includes('quality') || gap.category === 'code_quality') {
        priority = 'medium';
      }

      return { ...gap, priority };
    }).sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Reset the brain controller
   */
  reset() {
    this.state = BrainState.IDLE;
    this.currentProject = null;
    this.currentPlan = null;
    this.currentExecution = null;
    this.recentDecisions = [];
    this.pendingEvaluations.clear();

    this.emit('reset');
  }

  /**
   * Shutdown the brain controller
   */
  async shutdown() {
    this.logger.info('Shutting down BrainController');
    this.reset();
    this.removeAllListeners();
  }
}

// Singleton instance
let instance = null;

/**
 * Get the singleton BrainController instance
 * @param {object} config - Configuration options
 * @returns {BrainController} The singleton instance
 */
export function getBrainController(config = {}) {
  if (!instance) {
    instance = new BrainController(config);
  }
  return instance;
}

/**
 * Reset the singleton (primarily for testing)
 */
export async function resetBrainController() {
  if (instance) {
    await instance.shutdown();
    instance = null;
  }
}

export default BrainController;
