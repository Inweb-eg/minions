/**
 * Reviews Module - Code Review Engine
 *
 * Phase 9.2: Code Review Engine
 * Exports all code review components
 */

export {
  BaseReviewer,
  REVIEW_SEVERITY,
  REVIEW_EVENT
} from './base-reviewer.js';

export {
  CodeAnalyzer,
  getCodeAnalyzer,
  CODE_LANGUAGE
} from './code-analyzer.js';

export {
  ReviewCommenter,
  getReviewCommenter,
  COMMENT_TYPE
} from './review-commenter.js';

export {
  ReviewDecision,
  getReviewDecision,
  DECISION_CRITERIA
} from './review-decision.js';

import { getCodeAnalyzer as _getCodeAnalyzer } from './code-analyzer.js';
import { getReviewCommenter as _getReviewCommenter } from './review-commenter.js';
import { getReviewDecision as _getReviewDecision } from './review-decision.js';

/**
 * Get all reviewers
 * @returns {Object} All reviewer instances
 */
export function getAllReviewers() {
  return {
    analyzer: _getCodeAnalyzer(),
    commenter: _getReviewCommenter(),
    decision: _getReviewDecision()
  };
}

/**
 * Initialize all reviewers
 * @param {Object} options - Initialization options
 * @returns {Promise<Object>} Initialized reviewers
 */
export async function initializeReviewers(options = {}) {
  const reviewers = getAllReviewers();

  await Promise.all([
    reviewers.analyzer.initialize(options),
    reviewers.commenter.initialize(options),
    reviewers.decision.initialize(options)
  ]);

  return reviewers;
}

/**
 * Perform complete code review
 * @param {Object} options - Review options
 * @returns {Promise<Object>} Complete review result
 */
export async function performCodeReview(options = {}) {
  const {
    prNumber,
    postComments = true,
    autoDecision = true,
    ...reviewOptions
  } = options;

  const reviewers = getAllReviewers();

  // Step 1: Analyze code
  const analysisResult = await reviewers.analyzer.review({ prNumber, ...reviewOptions });

  // Step 2: Make decision
  const decisionResult = autoDecision
    ? await reviewers.decision.review({
        prNumber,
        codeAnalysisResult: analysisResult,
        ...reviewOptions
      })
    : analysisResult;

  // Step 3: Post comments
  if (postComments) {
    await reviewers.commenter.review({
      prNumber,
      reviewResult: decisionResult,
      ...reviewOptions
    });
  }

  return {
    analysis: analysisResult,
    decision: decisionResult,
    summary: {
      issuesFound: analysisResult.issues.length,
      event: decisionResult.event,
      approved: decisionResult.approved
    }
  };
}

/**
 * Clear all review histories
 */
export function clearAllReviewHistories() {
  const reviewers = getAllReviewers();
  Object.values(reviewers).forEach(reviewer => reviewer.clearHistory());
}
