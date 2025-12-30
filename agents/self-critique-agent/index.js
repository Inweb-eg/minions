/**
 * Minions - SelfCritiqueAgent
 * ===========================
 * Quality assurance agent that reviews code, plans, and outputs
 * for quality issues before they reach production.
 *
 * Responsibilities:
 * - Code review (style, complexity, maintainability)
 * - Plan review (completeness, feasibility, risks)
 * - Output validation (correctness, edge cases)
 * - Test coverage analysis
 * - Documentation quality checks
 *
 * Philosophy: "Catch issues before they become problems"
 */

import EventEmitter from 'events';
import path from 'path';
import fs from 'fs/promises';
import { createLogger } from '../../foundation/common/logger.js';
import { getDecisionLogger, DecisionType, DecisionOutcome } from '../../foundation/memory-store/DecisionLogger.js';

const logger = createLogger('SelfCritiqueAgent');

// Agent States
export const AgentState = {
  IDLE: 'IDLE',
  INITIALIZING: 'INITIALIZING',
  REVIEWING: 'REVIEWING',
  ANALYZING: 'ANALYZING',
  VALIDATING: 'VALIDATING',
  PAUSED: 'PAUSED',
  ERROR: 'ERROR',
  SHUTDOWN: 'SHUTDOWN'
};

// Review Types
export const ReviewType = {
  CODE: 'code',
  PLAN: 'plan',
  OUTPUT: 'output',
  TEST: 'test',
  DOCUMENTATION: 'documentation'
};

// Severity Levels
export const Severity = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFO: 'info'
};

// Event Types
export const CritiqueEvents = {
  REVIEW_STARTED: 'critique:review:started',
  REVIEW_COMPLETED: 'critique:review:completed',
  ISSUE_FOUND: 'critique:issue:found',
  PLAN_APPROVED: 'critique:plan:approved',
  PLAN_REJECTED: 'critique:plan:rejected',
  CODE_APPROVED: 'critique:code:approved',
  CODE_REJECTED: 'critique:code:rejected',
  IMPROVEMENT_SUGGESTED: 'critique:improvement:suggested',
  CRITIQUE_ERROR: 'critique:error'
};

// Singleton instance
let instance = null;

export class SelfCritiqueAgent extends EventEmitter {
  constructor(config = {}) {
    super();

    this.name = 'SelfCritiqueAgent';
    this.alias = 'Critic';
    this.version = '1.0.0';
    this.state = AgentState.IDLE;
    this.logger = logger;

    // Configuration
    this.config = {
      strictMode: config.strictMode || false,
      autoReject: config.autoReject || false,
      minCodeQuality: config.minCodeQuality || 0.7,
      minPlanCompleteness: config.minPlanCompleteness || 0.8,
      maxComplexity: config.maxComplexity || 15,
      requireTests: config.requireTests !== false,
      ...config
    };

    // Decision logger for tracking review decisions
    this.decisionLogger = null;

    // EventBus for publishing events
    this.eventBus = null;

    // Review history
    this.reviewHistory = [];
    this.maxHistory = 100;

    // Metrics
    this.metrics = {
      reviewsCompleted: 0,
      issuesFound: 0,
      plansApproved: 0,
      plansRejected: 0,
      codeApproved: 0,
      codeRejected: 0,
      improvementsSuggested: 0,
      lastActivity: null
    };

    // Quality patterns to check
    this._initializePatterns();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config = {}) {
    if (!instance) {
      instance = new SelfCritiqueAgent(config);
    }
    return instance;
  }

  /**
   * Reset singleton (for testing)
   */
  static resetInstance() {
    if (instance) {
      instance.removeAllListeners();
      instance = null;
    }
  }

  /**
   * Initialize the agent
   */
  async initialize(eventBus = null) {
    this.state = AgentState.INITIALIZING;
    this.logger.info('Initializing SelfCritiqueAgent...');

    try {
      // Initialize DecisionLogger
      this.decisionLogger = getDecisionLogger();
      await this.decisionLogger.initialize();

      if (eventBus) {
        this.eventBus = eventBus;
        this._subscribeToEvents();
      }

      this.state = AgentState.IDLE;
      this.emit('initialized', { agent: this.name, alias: this.alias });

      this.logger.info('SelfCritiqueAgent initialized');
      return { success: true };
    } catch (error) {
      this.state = AgentState.ERROR;
      this.logger.error(`Initialization failed: ${error.message}`);
      throw error;
    }
  }

  // ==================== Code Review ====================

  /**
   * Review code for quality issues
   * @param {string} code - Code to review
   * @param {object} options - Review options
   * @returns {object} Review result
   */
  async reviewCode(code, options = {}) {
    this.state = AgentState.REVIEWING;
    this.logger.info('Reviewing code...');

    const review = {
      type: ReviewType.CODE,
      timestamp: Date.now(),
      issues: [],
      suggestions: [],
      metrics: {},
      approved: true
    };

    try {
      this.emit(CritiqueEvents.REVIEW_STARTED, { type: ReviewType.CODE });

      // Calculate code metrics
      review.metrics = this._calculateCodeMetrics(code);

      // Check for quality issues
      review.issues = this._findCodeIssues(code, options);

      // Generate suggestions
      review.suggestions = this._generateCodeSuggestions(code, review.issues);

      // Calculate overall quality score
      review.qualityScore = this._calculateQualityScore(review);

      // Determine approval
      review.approved = this._shouldApproveCode(review);

      // Track critical issues
      const criticalIssues = review.issues.filter(i => i.severity === Severity.CRITICAL);
      if (criticalIssues.length > 0 && this.config.autoReject) {
        review.approved = false;
        review.rejectionReason = `${criticalIssues.length} critical issue(s) found`;
      }

      // Log the decision
      if (this.decisionLogger) {
        await this.decisionLogger.logDecision({
          agent: this.name,
          type: DecisionType.CODE_GENERATION,
          context: { codeLength: code.length, options },
          decision: { approved: review.approved, qualityScore: review.qualityScore },
          reasoning: review.approved
            ? `Code approved with quality score ${(review.qualityScore * 100).toFixed(1)}%`
            : `Code rejected: ${review.rejectionReason || 'Quality below threshold'}`
        });
      }

      // Update metrics
      this.metrics.reviewsCompleted++;
      this.metrics.issuesFound += review.issues.length;
      this.metrics.improvementsSuggested += review.suggestions.length;
      if (review.approved) {
        this.metrics.codeApproved++;
      } else {
        this.metrics.codeRejected++;
      }
      this.metrics.lastActivity = new Date().toISOString();

      // Emit events
      this.emit(review.approved ? CritiqueEvents.CODE_APPROVED : CritiqueEvents.CODE_REJECTED, review);
      this.emit(CritiqueEvents.REVIEW_COMPLETED, review);

      // Track in history
      this._addToHistory(review);

      this.state = AgentState.IDLE;
      return review;
    } catch (error) {
      this.state = AgentState.ERROR;
      this.logger.error(`Code review failed: ${error.message}`);
      this.emit(CritiqueEvents.CRITIQUE_ERROR, { error: error.message });
      throw error;
    }
  }

  // ==================== Plan Review ====================

  /**
   * Review a plan for completeness and feasibility
   * @param {object} plan - Plan to review
   * @param {object} context - Project context
   * @returns {object} Review result
   */
  async reviewPlan(plan, context = {}) {
    this.state = AgentState.REVIEWING;
    this.logger.info(`Reviewing plan: ${plan.id || 'unnamed'}`);

    const review = {
      type: ReviewType.PLAN,
      planId: plan.id,
      timestamp: Date.now(),
      issues: [],
      suggestions: [],
      scores: {},
      approved: true
    };

    try {
      this.emit(CritiqueEvents.REVIEW_STARTED, { type: ReviewType.PLAN, planId: plan.id });

      // Score plan aspects
      review.scores.completeness = this._scorePlanCompleteness(plan);
      review.scores.feasibility = this._scorePlanFeasibility(plan);
      review.scores.dependencies = this._scorePlanDependencies(plan);
      review.scores.risk = this._assessPlanRisk(plan);

      // Calculate overall score
      review.overallScore = (
        review.scores.completeness * 0.3 +
        review.scores.feasibility * 0.3 +
        review.scores.dependencies * 0.2 +
        (1 - review.scores.risk) * 0.2
      );

      // Find issues
      review.issues = this._findPlanIssues(plan, review.scores);

      // Generate suggestions
      review.suggestions = this._generatePlanSuggestions(plan, review.issues);

      // Determine approval
      review.approved = review.overallScore >= this.config.minPlanCompleteness &&
                       review.issues.filter(i => i.severity === Severity.CRITICAL).length === 0;

      if (!review.approved) {
        review.rejectionReason = review.overallScore < this.config.minPlanCompleteness
          ? `Plan score ${(review.overallScore * 100).toFixed(1)}% below threshold`
          : 'Critical issues found';
      }

      // Log decision
      if (this.decisionLogger) {
        await this.decisionLogger.logDecision({
          agent: this.name,
          type: DecisionType.PRIORITIZATION,
          context: { planId: plan.id, taskCount: plan.tasks?.length || 0 },
          decision: { approved: review.approved, overallScore: review.overallScore },
          reasoning: review.approved
            ? `Plan approved with score ${(review.overallScore * 100).toFixed(1)}%`
            : `Plan rejected: ${review.rejectionReason}`
        });
      }

      // Update metrics
      this.metrics.reviewsCompleted++;
      this.metrics.issuesFound += review.issues.length;
      if (review.approved) {
        this.metrics.plansApproved++;
      } else {
        this.metrics.plansRejected++;
      }
      this.metrics.lastActivity = new Date().toISOString();

      // Emit events
      this.emit(review.approved ? CritiqueEvents.PLAN_APPROVED : CritiqueEvents.PLAN_REJECTED, review);
      this.emit(CritiqueEvents.REVIEW_COMPLETED, review);

      this._addToHistory(review);

      this.state = AgentState.IDLE;
      return review;
    } catch (error) {
      this.state = AgentState.ERROR;
      this.logger.error(`Plan review failed: ${error.message}`);
      throw error;
    }
  }

  // ==================== Test Coverage Review ====================

  /**
   * Review test coverage
   * @param {object} coverageData - Coverage data
   * @param {object} options - Review options
   * @returns {object} Review result
   */
  async reviewTestCoverage(coverageData, options = {}) {
    this.state = AgentState.REVIEWING;

    const review = {
      type: ReviewType.TEST,
      timestamp: Date.now(),
      issues: [],
      suggestions: [],
      metrics: {},
      approved: true
    };

    try {
      // Analyze coverage
      review.metrics = {
        lineCoverage: coverageData.lines?.pct || 0,
        branchCoverage: coverageData.branches?.pct || 0,
        functionCoverage: coverageData.functions?.pct || 0,
        statementCoverage: coverageData.statements?.pct || 0
      };

      // Check thresholds
      const minCoverage = options.minCoverage || 80;

      if (review.metrics.lineCoverage < minCoverage) {
        review.issues.push({
          severity: Severity.HIGH,
          type: 'low_coverage',
          message: `Line coverage ${review.metrics.lineCoverage}% below ${minCoverage}% threshold`
        });
      }

      if (review.metrics.branchCoverage < minCoverage) {
        review.issues.push({
          severity: Severity.MEDIUM,
          type: 'low_branch_coverage',
          message: `Branch coverage ${review.metrics.branchCoverage}% below threshold`
        });
      }

      // Identify uncovered areas
      if (coverageData.uncovered && coverageData.uncovered.length > 0) {
        review.suggestions.push({
          type: 'add_tests',
          message: `Add tests for ${coverageData.uncovered.length} uncovered areas`,
          files: coverageData.uncovered.slice(0, 5)
        });
      }

      review.approved = review.issues.filter(i => i.severity === Severity.CRITICAL || i.severity === Severity.HIGH).length === 0;

      this.metrics.reviewsCompleted++;
      this.metrics.issuesFound += review.issues.length;

      this.emit(CritiqueEvents.REVIEW_COMPLETED, review);
      this._addToHistory(review);

      this.state = AgentState.IDLE;
      return review;
    } catch (error) {
      this.state = AgentState.ERROR;
      throw error;
    }
  }

  // ==================== Output Validation ====================

  /**
   * Validate agent output
   * @param {any} output - Output to validate
   * @param {object} expectedSchema - Expected output schema
   * @returns {object} Validation result
   */
  async validateOutput(output, expectedSchema = {}) {
    this.state = AgentState.VALIDATING;

    const validation = {
      type: ReviewType.OUTPUT,
      timestamp: Date.now(),
      valid: true,
      issues: [],
      warnings: []
    };

    try {
      // Check for null/undefined
      if (output === null || output === undefined) {
        validation.valid = false;
        validation.issues.push({
          severity: Severity.CRITICAL,
          message: 'Output is null or undefined'
        });
        return validation;
      }

      // Type checking
      if (expectedSchema.type && typeof output !== expectedSchema.type) {
        validation.valid = false;
        validation.issues.push({
          severity: Severity.HIGH,
          message: `Expected type ${expectedSchema.type}, got ${typeof output}`
        });
      }

      // Required fields check
      if (expectedSchema.required && Array.isArray(expectedSchema.required)) {
        for (const field of expectedSchema.required) {
          if (!(field in output)) {
            validation.valid = false;
            validation.issues.push({
              severity: Severity.HIGH,
              message: `Missing required field: ${field}`
            });
          }
        }
      }

      // Properties validation
      if (expectedSchema.properties && typeof output === 'object') {
        for (const [key, schema] of Object.entries(expectedSchema.properties)) {
          if (key in output) {
            const value = output[key];
            if (schema.type && typeof value !== schema.type) {
              validation.warnings.push({
                message: `Field ${key} expected ${schema.type}, got ${typeof value}`
              });
            }
          }
        }
      }

      this.metrics.reviewsCompleted++;
      this.emit(CritiqueEvents.REVIEW_COMPLETED, validation);

      this.state = AgentState.IDLE;
      return validation;
    } catch (error) {
      this.state = AgentState.ERROR;
      throw error;
    }
  }

  // ==================== Private Methods ====================

  _initializePatterns() {
    // Code smell patterns
    this.codeSmellPatterns = [
      { pattern: /function\s*\([^)]*\)\s*\{[\s\S]{500,}\}/g, name: 'Long function', severity: Severity.MEDIUM },
      { pattern: /if\s*\([^)]*\)\s*\{[\s\S]*if\s*\([^)]*\)\s*\{[\s\S]*if\s*\([^)]*\)\s*\{/g, name: 'Deeply nested conditionals', severity: Severity.MEDIUM },
      { pattern: /catch\s*\(\s*\w*\s*\)\s*\{\s*\}/g, name: 'Empty catch block', severity: Severity.HIGH },
      { pattern: /console\.(log|debug|info)\s*\(/g, name: 'Console statement', severity: Severity.LOW },
      { pattern: /TODO|FIXME|HACK|XXX/gi, name: 'TODO comment', severity: Severity.INFO },
      { pattern: /\bvar\s+/g, name: 'Using var instead of let/const', severity: Severity.LOW },
      { pattern: /==(?!=)/g, name: 'Loose equality', severity: Severity.LOW },
      { pattern: /new\s+Array\s*\(\s*\)/g, name: 'Array constructor', severity: Severity.INFO }
    ];

    // Complexity indicators
    this.complexityIndicators = [
      { pattern: /\bif\b/g, weight: 1 },
      { pattern: /\belse\b/g, weight: 1 },
      { pattern: /\bfor\b/g, weight: 2 },
      { pattern: /\bwhile\b/g, weight: 2 },
      { pattern: /\bswitch\b/g, weight: 1 },
      { pattern: /\bcase\b/g, weight: 0.5 },
      { pattern: /\bcatch\b/g, weight: 1 },
      { pattern: /\?\s*[^:]+\s*:/g, weight: 1 }, // Ternary
      { pattern: /&&|\|\|/g, weight: 0.5 }
    ];
  }

  _calculateCodeMetrics(code) {
    const lines = code.split('\n');

    return {
      totalLines: lines.length,
      codeLines: lines.filter(l => l.trim() && !l.trim().startsWith('//')).length,
      commentLines: lines.filter(l => l.trim().startsWith('//')).length,
      blankLines: lines.filter(l => !l.trim()).length,
      complexity: this._calculateComplexity(code),
      functions: (code.match(/function\s*\w*\s*\(/g) || []).length,
      classes: (code.match(/class\s+\w+/g) || []).length,
      imports: (code.match(/import\s+/g) || []).length
    };
  }

  _calculateComplexity(code) {
    let complexity = 1; // Base complexity

    for (const { pattern, weight } of this.complexityIndicators) {
      const matches = code.match(pattern) || [];
      complexity += matches.length * weight;
    }

    return Math.round(complexity);
  }

  _findCodeIssues(code, options) {
    const issues = [];

    // Check code smell patterns
    for (const { pattern, name, severity } of this.codeSmellPatterns) {
      pattern.lastIndex = 0;
      const matches = code.match(pattern);
      if (matches && matches.length > 0) {
        issues.push({
          type: 'code_smell',
          name,
          severity,
          count: matches.length,
          message: `Found ${matches.length} instance(s) of: ${name}`
        });
      }
    }

    // Check complexity
    const complexity = this._calculateComplexity(code);
    if (complexity > this.config.maxComplexity) {
      issues.push({
        type: 'high_complexity',
        severity: Severity.MEDIUM,
        message: `Cyclomatic complexity ${complexity} exceeds threshold ${this.config.maxComplexity}`
      });
    }

    // Check for very long lines
    const lines = code.split('\n');
    const longLines = lines.filter(l => l.length > 120);
    if (longLines.length > 0) {
      issues.push({
        type: 'long_lines',
        severity: Severity.INFO,
        message: `${longLines.length} lines exceed 120 characters`
      });
    }

    return issues;
  }

  _generateCodeSuggestions(code, issues) {
    const suggestions = [];

    // Suggest based on issues
    for (const issue of issues) {
      if (issue.name === 'Empty catch block') {
        suggestions.push({
          type: 'improvement',
          message: 'Handle or log errors in catch blocks'
        });
      }
      if (issue.name === 'Console statement') {
        suggestions.push({
          type: 'cleanup',
          message: 'Remove console statements or use a logger'
        });
      }
      if (issue.type === 'high_complexity') {
        suggestions.push({
          type: 'refactor',
          message: 'Consider breaking down complex functions into smaller ones'
        });
      }
    }

    return suggestions;
  }

  _calculateQualityScore(review) {
    let score = 1.0;

    // Penalize for issues
    for (const issue of review.issues) {
      switch (issue.severity) {
        case Severity.CRITICAL: score -= 0.3; break;
        case Severity.HIGH: score -= 0.15; break;
        case Severity.MEDIUM: score -= 0.05; break;
        case Severity.LOW: score -= 0.02; break;
      }
    }

    // Penalize for high complexity
    if (review.metrics.complexity > this.config.maxComplexity) {
      score -= 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  _shouldApproveCode(review) {
    if (this.config.strictMode) {
      return review.issues.length === 0;
    }

    return review.qualityScore >= this.config.minCodeQuality &&
           review.issues.filter(i => i.severity === Severity.CRITICAL).length === 0;
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

    // Has phases
    if (plan.phases && Object.keys(plan.phases).length > 0) score += 0.1;

    // Has execution groups
    if (plan.executionGroups && plan.executionGroups.length > 0) score += 0.1;

    return Math.min(score, 1.0);
  }

  _scorePlanFeasibility(plan) {
    if (!plan || !plan.tasks) return 0;

    let score = 0.7; // Base score

    const tasks = plan.tasks || [];

    // Penalize very large plans
    if (tasks.length > 50) score -= 0.2;
    else if (tasks.length > 20) score -= 0.1;

    // Penalize high complexity
    const avgComplexity = tasks.reduce((sum, t) => sum + (t.complexity || 3), 0) / Math.max(tasks.length, 1);
    if (avgComplexity > 4) score -= 0.1;

    // Bonus for reasonable size
    if (tasks.length >= 3 && tasks.length <= 15) score += 0.1;

    return Math.max(0, Math.min(score, 1.0));
  }

  _scorePlanDependencies(plan) {
    if (!plan || !plan.tasks) return 0.5;

    const tasks = plan.tasks || [];
    const taskIds = new Set(tasks.map(t => t.id));

    let score = 1.0;

    // Check for invalid dependencies
    for (const task of tasks) {
      for (const dep of task.dependencies || []) {
        if (!taskIds.has(dep)) {
          score -= 0.1;
        }
        if (dep === task.id) {
          score -= 0.2; // Self-dependency
        }
      }
    }

    return Math.max(0, score);
  }

  _assessPlanRisk(plan) {
    if (!plan || !plan.tasks) return 0;

    let risk = 0;
    const tasks = plan.tasks || [];

    // High complexity = higher risk
    const avgComplexity = tasks.reduce((sum, t) => sum + (t.complexity || 3), 0) / Math.max(tasks.length, 1);
    risk += avgComplexity * 0.1;

    // Many tasks = higher risk
    risk += Math.min(tasks.length * 0.01, 0.2);

    // Security-related = higher risk
    const securityTasks = tasks.filter(t => t.category?.includes('security')).length;
    risk += securityTasks * 0.05;

    return Math.min(risk, 1.0);
  }

  _findPlanIssues(plan, scores) {
    const issues = [];

    if (scores.completeness < 0.5) {
      issues.push({
        severity: Severity.HIGH,
        type: 'incomplete_plan',
        message: 'Plan appears incomplete - missing task details'
      });
    }

    if (scores.feasibility < 0.5) {
      issues.push({
        severity: Severity.MEDIUM,
        type: 'feasibility_concern',
        message: 'Plan may be too complex or ambitious'
      });
    }

    if (scores.dependencies < 0.7) {
      issues.push({
        severity: Severity.MEDIUM,
        type: 'dependency_issues',
        message: 'Plan has dependency problems'
      });
    }

    if (scores.risk > 0.7) {
      issues.push({
        severity: Severity.HIGH,
        type: 'high_risk',
        message: 'Plan has high risk factors'
      });
    }

    return issues;
  }

  _generatePlanSuggestions(plan, issues) {
    const suggestions = [];

    for (const issue of issues) {
      if (issue.type === 'incomplete_plan') {
        suggestions.push({
          type: 'add_details',
          message: 'Add descriptions and categories to all tasks'
        });
      }
      if (issue.type === 'high_risk') {
        suggestions.push({
          type: 'risk_mitigation',
          message: 'Consider breaking into smaller phases with checkpoints'
        });
      }
    }

    return suggestions;
  }

  _addToHistory(review) {
    this.reviewHistory.unshift(review);
    if (this.reviewHistory.length > this.maxHistory) {
      this.reviewHistory.pop();
    }
  }

  _subscribeToEvents() {
    if (!this.eventBus) return;

    // Subscribe to code generation for auto-review
    if (this.eventBus.subscribe) {
      this.eventBus.subscribe('code:generated', this.name, async (data) => {
        if (data.code && this.config.autoReview) {
          await this.reviewCode(data.code);
        }
      });

      // Subscribe to plan generation for auto-review
      this.eventBus.subscribe('plan:generated', this.name, async (data) => {
        if (data.plan && this.config.autoReview) {
          await this.reviewPlan(data.plan);
        }
      });
    }
  }

  // ==================== Status & Queries ====================

  /**
   * Get agent status
   */
  getStatus() {
    return {
      name: this.name,
      alias: this.alias,
      version: this.version,
      state: this.state,
      metrics: { ...this.metrics }
    };
  }

  /**
   * Get review history
   * @param {number} limit - Maximum entries to return
   */
  getHistory(limit = 10) {
    return this.reviewHistory.slice(0, limit);
  }

  /**
   * Get approval rate
   */
  getApprovalRate() {
    const total = this.metrics.plansApproved + this.metrics.plansRejected +
                  this.metrics.codeApproved + this.metrics.codeRejected;
    if (total === 0) return 0;

    const approved = this.metrics.plansApproved + this.metrics.codeApproved;
    return approved / total;
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      reviewsCompleted: 0,
      issuesFound: 0,
      plansApproved: 0,
      plansRejected: 0,
      codeApproved: 0,
      codeRejected: 0,
      improvementsSuggested: 0,
      lastActivity: null
    };
  }

  /**
   * Shutdown
   */
  async shutdown() {
    this.logger.info('Shutting down SelfCritiqueAgent...');
    this.state = AgentState.SHUTDOWN;
    this.removeAllListeners();
    this.logger.info('SelfCritiqueAgent shutdown complete');
  }
}

// Factory function
export function getSelfCritiqueAgent(config = {}) {
  return SelfCritiqueAgent.getInstance(config);
}

export default SelfCritiqueAgent;
