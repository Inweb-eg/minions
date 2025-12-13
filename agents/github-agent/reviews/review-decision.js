/**
 * ReviewDecision - Makes Approval/Rejection Decisions
 *
 * Phase 9.2: Code Review Engine
 * Makes intelligent decisions on whether to approve, request changes, or comment
 */

import { BaseReviewer, REVIEW_SEVERITY, REVIEW_EVENT } from './base-reviewer.js';

/**
 * Decision criteria
 */
export const DECISION_CRITERIA = {
  CODE_QUALITY: 'code_quality',
  TESTS: 'tests',
  SIZE: 'size',
  CONFLICTS: 'conflicts',
  CI_STATUS: 'ci_status',
  SECURITY: 'security'
};

/**
 * ReviewDecision
 * Makes review decisions
 */
export class ReviewDecision extends BaseReviewer {
  constructor() {
    super('ReviewDecision', 'decision');
    this.criteria = this.initializeCriteria();
  }

  /**
   * Initialize decision criteria
   * @returns {Object} Criteria weights
   */
  initializeCriteria() {
    return {
      [DECISION_CRITERIA.CODE_QUALITY]: 0.3,
      [DECISION_CRITERIA.TESTS]: 0.2,
      [DECISION_CRITERIA.SIZE]: 0.1,
      [DECISION_CRITERIA.CONFLICTS]: 0.15,
      [DECISION_CRITERIA.CI_STATUS]: 0.15,
      [DECISION_CRITERIA.SECURITY]: 0.1
    };
  }

  /**
   * Make review decision
   * @param {Object} options - Decision options
   * @returns {Promise<Object>} Decision result
   */
  async review(options = {}) {
    this.ensureInitialized();

    const {
      prNumber,
      codeAnalysisResult,
      requireTests = true,
      requireCIPass = true,
      maxPRSize = 500
    } = options;

    this.logger.info(`Making review decision for PR #${prNumber}`);

    try {
      // Get PR data
      const pr = await this.getPR(prNumber);

      // Evaluate criteria
      const evaluations = {
        codeQuality: this.evaluateCodeQuality(codeAnalysisResult),
        tests: await this.evaluateTests(pr),
        size: this.evaluatePRSize(pr, maxPRSize),
        conflicts: this.evaluateConflicts(pr),
        ciStatus: await this.evaluateCIStatus(pr),
        security: this.evaluateSecurity(codeAnalysisResult)
      };

      // Calculate overall score
      const score = this.calculateScore(evaluations);

      // Make decision
      const decision = this.makeDecision(score, evaluations, {
        requireTests,
        requireCIPass
      });

      const result = this.createResult({
        issues: codeAnalysisResult?.issues || [],
        approved: decision.event === REVIEW_EVENT.APPROVE,
        event: decision.event,
        summary: decision.summary,
        metadata: {
          prNumber,
          score,
          evaluations,
          decision: decision.reason
        }
      });

      this.recordReview(result);
      this.logger.info(`Decision made: ${decision.event} (score: ${score})`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to make decision: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get PR data
   * @param {number} prNumber - PR number
   * @returns {Promise<Object>} PR data
   */
  async getPR(prNumber) {
    const { data: pr } = await this.octokit.rest.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber
    });

    return pr;
  }

  /**
   * Evaluate code quality
   * @param {Object} analysisResult - Code analysis result
   * @returns {Object} Evaluation
   */
  evaluateCodeQuality(analysisResult) {
    if (!analysisResult) {
      return { score: 0.5, passed: true, reason: 'No analysis available' };
    }

    const { counts } = analysisResult;
    const critical = counts?.critical || 0;
    const high = counts?.high || 0;
    const medium = counts?.medium || 0;

    // Calculate score based on issues
    let score = 1.0;
    score -= critical * 0.3;  // -30% per critical
    score -= high * 0.15;     // -15% per high
    score -= medium * 0.05;   // -5% per medium

    score = Math.max(0, Math.min(1, score)); // Clamp to 0-1

    const passed = critical === 0 && high === 0;

    return {
      score,
      passed,
      reason: passed
        ? 'Code quality is acceptable'
        : `Found ${critical} critical and ${high} high severity issues`
    };
  }

  /**
   * Evaluate tests
   * @param {Object} pr - PR data
   * @returns {Promise<Object>} Evaluation
   */
  async evaluateTests(pr) {
    try {
      // Check if PR includes test files
      const { data: files } = await this.octokit.rest.pulls.listFiles({
        owner: this.owner,
        repo: this.repo,
        pull_number: pr.number
      });

      const hasTestFiles = files.some(file =>
        file.filename.includes('.test.') ||
        file.filename.includes('.spec.') ||
        file.filename.includes('__tests__/')
      );

      const hasSourceChanges = files.some(file =>
        !file.filename.includes('.test.') &&
        !file.filename.includes('.spec.') &&
        (file.filename.endsWith('.js') ||
         file.filename.endsWith('.ts') ||
         file.filename.endsWith('.dart'))
      );

      const passed = !hasSourceChanges || hasTestFiles;

      return {
        score: passed ? 1.0 : 0.5,
        passed,
        reason: passed
          ? 'Tests included or no source changes'
          : 'Source changes without test coverage'
      };
    } catch (error) {
      this.logger.error(`Failed to evaluate tests: ${error.message}`);
      return { score: 0.5, passed: true, reason: 'Could not evaluate tests' };
    }
  }

  /**
   * Evaluate PR size
   * @param {Object} pr - PR data
   * @param {number} maxSize - Max acceptable size
   * @returns {Object} Evaluation
   */
  evaluatePRSize(pr, maxSize) {
    const additions = pr.additions || 0;
    const deletions = pr.deletions || 0;
    const totalChanges = additions + deletions;

    const passed = totalChanges <= maxSize;
    const score = passed ? 1.0 : Math.max(0.3, 1 - ((totalChanges - maxSize) / maxSize));

    return {
      score,
      passed,
      reason: passed
        ? `PR size is acceptable (${totalChanges} lines)`
        : `PR is large (${totalChanges} lines) - consider breaking into smaller PRs`
    };
  }

  /**
   * Evaluate conflicts
   * @param {Object} pr - PR data
   * @returns {Object} Evaluation
   */
  evaluateConflicts(pr) {
    const mergeable = pr.mergeable;
    const passed = mergeable !== false;

    return {
      score: passed ? 1.0 : 0.0,
      passed,
      reason: passed
        ? 'No merge conflicts'
        : 'PR has merge conflicts that must be resolved'
    };
  }

  /**
   * Evaluate CI status
   * @param {Object} pr - PR data
   * @returns {Promise<Object>} Evaluation
   */
  async evaluateCIStatus(pr) {
    try {
      const { data: checks } = await this.octokit.rest.checks.listForRef({
        owner: this.owner,
        repo: this.repo,
        ref: pr.head.sha
      });

      if (checks.total_count === 0) {
        return { score: 1.0, passed: true, reason: 'No CI checks configured' };
      }

      const allPassed = checks.check_runs.every(check =>
        check.conclusion === 'success' || check.conclusion === 'skipped'
      );

      const failedChecks = checks.check_runs.filter(check =>
        check.conclusion === 'failure'
      );

      return {
        score: allPassed ? 1.0 : 0.0,
        passed: allPassed,
        reason: allPassed
          ? 'All CI checks passed'
          : `${failedChecks.length} CI check(s) failed`
      };
    } catch (error) {
      this.logger.error(`Failed to evaluate CI status: ${error.message}`);
      return { score: 0.5, passed: true, reason: 'Could not evaluate CI status' };
    }
  }

  /**
   * Evaluate security
   * @param {Object} analysisResult - Code analysis result
   * @returns {Object} Evaluation
   */
  evaluateSecurity(analysisResult) {
    if (!analysisResult) {
      return { score: 1.0, passed: true, reason: 'No security scan available' };
    }

    const securityIssues = (analysisResult.issues || []).filter(issue =>
      issue.severity === REVIEW_SEVERITY.CRITICAL &&
      (issue.message.toLowerCase().includes('security') ||
       issue.message.toLowerCase().includes('password') ||
       issue.message.toLowerCase().includes('api key') ||
       issue.message.toLowerCase().includes('xss') ||
       issue.message.toLowerCase().includes('eval'))
    );

    const passed = securityIssues.length === 0;

    return {
      score: passed ? 1.0 : 0.0,
      passed,
      reason: passed
        ? 'No security issues found'
        : `Found ${securityIssues.length} security issue(s)`
    };
  }

  /**
   * Calculate overall score
   * @param {Object} evaluations - Criteria evaluations
   * @returns {number} Overall score (0-1)
   */
  calculateScore(evaluations) {
    let totalScore = 0;

    totalScore += evaluations.codeQuality.score * this.criteria[DECISION_CRITERIA.CODE_QUALITY];
    totalScore += evaluations.tests.score * this.criteria[DECISION_CRITERIA.TESTS];
    totalScore += evaluations.size.score * this.criteria[DECISION_CRITERIA.SIZE];
    totalScore += evaluations.conflicts.score * this.criteria[DECISION_CRITERIA.CONFLICTS];
    totalScore += evaluations.ciStatus.score * this.criteria[DECISION_CRITERIA.CI_STATUS];
    totalScore += evaluations.security.score * this.criteria[DECISION_CRITERIA.SECURITY];

    return Math.round(totalScore * 100) / 100; // Round to 2 decimals
  }

  /**
   * Make decision
   * @param {number} score - Overall score
   * @param {Object} evaluations - Criteria evaluations
   * @param {Object} requirements - Requirements
   * @returns {Object} Decision
   */
  makeDecision(score, evaluations, requirements) {
    const { requireTests, requireCIPass } = requirements;

    // Hard blockers
    if (!evaluations.conflicts.passed) {
      return {
        event: REVIEW_EVENT.REQUEST_CHANGES,
        reason: 'Merge conflicts must be resolved',
        summary: '❌ **Merge conflicts detected**\n\nPlease resolve conflicts before this PR can be merged.'
      };
    }

    if (!evaluations.security.passed) {
      return {
        event: REVIEW_EVENT.REQUEST_CHANGES,
        reason: 'Security issues must be fixed',
        summary: '🚨 **Security issues detected**\n\nCritical security issues must be addressed before merging.'
      };
    }

    if (requireCIPass && !evaluations.ciStatus.passed) {
      return {
        event: REVIEW_EVENT.REQUEST_CHANGES,
        reason: 'CI checks must pass',
        summary: '⚠️ **CI checks failed**\n\nAll CI checks must pass before this PR can be merged.'
      };
    }

    if (!evaluations.codeQuality.passed) {
      return {
        event: REVIEW_EVENT.REQUEST_CHANGES,
        reason: evaluations.codeQuality.reason,
        summary: `⚠️ **Code quality issues**\n\n${evaluations.codeQuality.reason}`
      };
    }

    // Soft blockers
    if (requireTests && !evaluations.tests.passed) {
      return {
        event: REVIEW_EVENT.COMMENT,
        reason: evaluations.tests.reason,
        summary: `💡 **Recommendation**\n\n${evaluations.tests.reason}\n\nConsider adding tests for better coverage.`
      };
    }

    // Approve based on score
    if (score >= 0.8) {
      return {
        event: REVIEW_EVENT.APPROVE,
        reason: 'All criteria met',
        summary: `✅ **Approved!**\n\nCode quality score: ${(score * 100).toFixed(0)}%\n\nAll review criteria have been met.`
      };
    } else if (score >= 0.6) {
      return {
        event: REVIEW_EVENT.COMMENT,
        reason: 'Minor issues found',
        summary: `💡 **Looks mostly good**\n\nCode quality score: ${(score * 100).toFixed(0)}%\n\nSome minor improvements suggested, but not blocking.`
      };
    } else {
      return {
        event: REVIEW_EVENT.REQUEST_CHANGES,
        reason: 'Multiple issues need attention',
        summary: `⚠️ **Changes requested**\n\nCode quality score: ${(score * 100).toFixed(0)}%\n\nPlease address the issues identified in this review.`
      };
    }
  }

  /**
   * Set criteria weights
   * @param {Object} weights - Criteria weights
   */
  setCriteriaWeights(weights) {
    this.criteria = { ...this.criteria, ...weights };
    this.logger.info('Criteria weights updated');
  }

  /**
   * Get criteria weights
   * @returns {Object} Criteria weights
   */
  getCriteriaWeights() {
    return { ...this.criteria };
  }
}

/**
 * Get singleton instance
 */
let decisionInstance = null;

export function getReviewDecision() {
  if (!decisionInstance) {
    decisionInstance = new ReviewDecision();
  }
  return decisionInstance;
}
