/**
 * ReviewCommenter - Posts Review Comments to GitHub
 *
 * Phase 9.2: Code Review Engine
 * Posts review comments and decisions to pull requests
 */

import { BaseReviewer, REVIEW_SEVERITY, REVIEW_EVENT } from './base-reviewer.js';

/**
 * Comment type
 */
export const COMMENT_TYPE = {
  REVIEW: 'review',
  INLINE: 'inline',
  GENERAL: 'general'
};

/**
 * ReviewCommenter
 * Posts review comments
 */
export class ReviewCommenter extends BaseReviewer {
  constructor() {
    super('ReviewCommenter', 'commenter');
  }

  /**
   * Post review
   * @param {Object} options - Review options
   * @returns {Promise<Object>} Result
   */
  async review(options = {}) {
    this.ensureInitialized();

    const {
      prNumber,
      reviewResult,
      postInlineComments = true,
      postSummary = true
    } = options;

    this.logger.info(`Posting review for PR #${prNumber}`);

    try {
      const result = {
        prNumber,
        commentsPosted: [],
        summaryPosted: false,
        reviewPosted: false
      };

      // Post inline comments
      if (postInlineComments && reviewResult.issues.length > 0) {
        const inlineComments = await this.postInlineComments(prNumber, reviewResult.issues);
        result.commentsPosted = inlineComments;
      }

      // Post review with summary
      if (postSummary) {
        const summary = this.formatSummary(reviewResult);
        const reviewResponse = await this.postReview(prNumber, reviewResult.event, summary);
        result.summaryPosted = true;
        result.reviewPosted = true;
        result.reviewId = reviewResponse.id;
      }

      this.recordReview(reviewResult);
      this.logger.info(`Review posted successfully for PR #${prNumber}`);

      return this.createResult({
        issues: [],
        approved: reviewResult.event === REVIEW_EVENT.APPROVE,
        event: reviewResult.event,
        metadata: result
      });
    } catch (error) {
      this.logger.error(`Failed to post review: ${error.message}`);
      throw error;
    }
  }

  /**
   * Post inline comments
   * @param {number} prNumber - PR number
   * @param {Array} issues - Review issues
   * @returns {Promise<Array>} Posted comments
   */
  async postInlineComments(prNumber, issues) {
    const postedComments = [];

    for (const issue of issues) {
      if (!issue.file || !issue.line) {
        continue; // Skip issues without file/line info
      }

      try {
        const comment = await this.postInlineComment(prNumber, issue);
        postedComments.push({
          issueId: issue.rule,
          commentId: comment.id,
          file: issue.file,
          line: issue.line
        });
      } catch (error) {
        this.logger.error(`Failed to post inline comment: ${error.message}`);
      }
    }

    this.logger.info(`Posted ${postedComments.length} inline comments`);
    return postedComments;
  }

  /**
   * Post inline comment
   * @param {number} prNumber - PR number
   * @param {Object} issue - Review issue
   * @returns {Promise<Object>} Comment response
   */
  async postInlineComment(prNumber, issue) {
    const body = this.formatComment(issue);

    // Get the commit SHA for the latest commit in the PR
    const { data: pr } = await this.octokit.rest.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber
    });

    const { data: comment } = await this.octokit.rest.pulls.createReviewComment({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
      body,
      commit_id: pr.head.sha,
      path: issue.file,
      line: issue.line,
      side: 'RIGHT'
    });

    return comment;
  }

  /**
   * Post review
   * @param {number} prNumber - PR number
   * @param {string} event - Review event
   * @param {string} body - Review body
   * @returns {Promise<Object>} Review response
   */
  async postReview(prNumber, event, body) {
    const { data: review } = await this.octokit.rest.pulls.createReview({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
      event,
      body
    });

    this.logger.info(`Posted review with event: ${event}`);
    return review;
  }

  /**
   * Post general comment
   * @param {number} prNumber - PR number
   * @param {string} body - Comment body
   * @returns {Promise<Object>} Comment response
   */
  async postGeneralComment(prNumber, body) {
    const { data: comment } = await this.octokit.rest.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: prNumber,
      body
    });

    this.logger.info(`Posted general comment on PR #${prNumber}`);
    return comment;
  }

  /**
   * Update review comment
   * @param {number} commentId - Comment ID
   * @param {string} body - Updated body
   * @returns {Promise<Object>} Updated comment
   */
  async updateComment(commentId, body) {
    const { data: comment } = await this.octokit.rest.pulls.updateReviewComment({
      owner: this.owner,
      repo: this.repo,
      comment_id: commentId,
      body
    });

    this.logger.info(`Updated comment #${commentId}`);
    return comment;
  }

  /**
   * Delete review comment
   * @param {number} commentId - Comment ID
   * @returns {Promise<void>}
   */
  async deleteComment(commentId) {
    await this.octokit.rest.pulls.deleteReviewComment({
      owner: this.owner,
      repo: this.repo,
      comment_id: commentId
    });

    this.logger.info(`Deleted comment #${commentId}`);
  }

  /**
   * Get PR comments
   * @param {number} prNumber - PR number
   * @returns {Promise<Array>} Comments
   */
  async getPRComments(prNumber) {
    const { data: comments } = await this.octokit.rest.pulls.listReviewComments({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber
    });

    return comments;
  }

  /**
   * Get PR reviews
   * @param {number} prNumber - PR number
   * @returns {Promise<Array>} Reviews
   */
  async getPRReviews(prNumber) {
    const { data: reviews } = await this.octokit.rest.pulls.listReviews({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber
    });

    return reviews;
  }

  /**
   * Dismiss review
   * @param {number} prNumber - PR number
   * @param {number} reviewId - Review ID
   * @param {string} message - Dismissal message
   * @returns {Promise<Object>} Dismissed review
   */
  async dismissReview(prNumber, reviewId, message) {
    const { data: review } = await this.octokit.rest.pulls.dismissReview({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
      review_id: reviewId,
      message
    });

    this.logger.info(`Dismissed review #${reviewId}`);
    return review;
  }

  /**
   * React to comment
   * @param {number} commentId - Comment ID
   * @param {string} reaction - Reaction ('+1', '-1', 'laugh', 'confused', 'heart', 'hooray', 'rocket', 'eyes')
   * @returns {Promise<Object>} Reaction response
   */
  async reactToComment(commentId, reaction) {
    const { data: reactionResponse } = await this.octokit.rest.reactions.createForIssueComment({
      owner: this.owner,
      repo: this.repo,
      comment_id: commentId,
      content: reaction
    });

    this.logger.info(`Reacted to comment #${commentId} with ${reaction}`);
    return reactionResponse;
  }

  /**
   * Resolve conversation
   * @param {number} commentId - Comment ID
   * @returns {Promise<void>}
   */
  async resolveConversation(commentId) {
    // Note: This requires GraphQL API
    const query = `
      mutation {
        resolveReviewThread(input: {threadId: "${commentId}"}) {
          thread {
            id
            isResolved
          }
        }
      }
    `;

    await this.octokit.graphql(query);
    this.logger.info(`Resolved conversation #${commentId}`);
  }

  /**
   * Post approval
   * @param {number} prNumber - PR number
   * @param {string} message - Approval message
   * @returns {Promise<Object>} Review response
   */
  async postApproval(prNumber, message = '✅ Code looks good!') {
    return this.postReview(prNumber, REVIEW_EVENT.APPROVE, message);
  }

  /**
   * Request changes
   * @param {number} prNumber - PR number
   * @param {string} message - Request message
   * @returns {Promise<Object>} Review response
   */
  async requestChanges(prNumber, message) {
    return this.postReview(prNumber, REVIEW_EVENT.REQUEST_CHANGES, message);
  }

  /**
   * Post comment review
   * @param {number} prNumber - PR number
   * @param {string} message - Comment message
   * @returns {Promise<Object>} Review response
   */
  async postCommentReview(prNumber, message) {
    return this.postReview(prNumber, REVIEW_EVENT.COMMENT, message);
  }
}

/**
 * Get singleton instance
 */
let commenterInstance = null;

export function getReviewCommenter() {
  if (!commenterInstance) {
    commenterInstance = new ReviewCommenter();
  }
  return commenterInstance;
}
