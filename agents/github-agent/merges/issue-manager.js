/**
 * IssueManager - Manages GitHub Issues
 *
 * Phase 9.3: Merge & Issue Management
 * Creates and manages issues from test failures and other events
 */

import { BaseManager, OPERATION_STATUS } from '../branches/base-manager.js';

/**
 * Issue priority
 */
export const ISSUE_PRIORITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

/**
 * Issue type
 */
export const ISSUE_TYPE = {
  BUG: 'bug',
  FEATURE: 'enhancement',
  TASK: 'task',
  QUESTION: 'question',
  DOCUMENTATION: 'documentation'
};

/**
 * IssueManager
 * Manages GitHub issues
 */
export class IssueManager extends BaseManager {
  constructor() {
    super('IssueManager', 'issue');
  }

  /**
   * Create issue
   * @param {Object} options - Issue options
   * @returns {Promise<Object>} Result
   */
  async createIssue(options = {}) {
    this.ensureInitialized();

    const {
      title,
      body,
      labels = [],
      assignees = [],
      milestone = null,
      autoAssign = true
    } = options;

    this.logger.info(`Creating issue: ${title}`);

    try {
      // Auto-assign if requested
      let finalAssignees = assignees;
      if (autoAssign && assignees.length === 0) {
        finalAssignees = await this.selectAssignees(title, body, labels);
      }

      const { data: issue } = await this.octokit.rest.issues.create({
        owner: this.owner,
        repo: this.repo,
        title,
        body,
        labels,
        assignees: finalAssignees,
        milestone
      });

      const result = this.createResult({
        success: true,
        data: {
          number: issue.number,
          url: issue.html_url,
          title: issue.title,
          state: issue.state
        }
      });

      this.recordOperation(result);
      this.logger.info(`Issue created successfully: #${issue.number}`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to create issue: ${error.message}`);

      const result = this.createResult({
        success: false,
        error: error.message
      });

      this.recordOperation(result);
      throw error;
    }
  }

  /**
   * Create issue from test failure
   * @param {Object} options - Test failure options
   * @returns {Promise<Object>} Result
   */
  async createIssueFromTestFailure(options = {}) {
    const {
      testName,
      errorMessage,
      stackTrace,
      file,
      line,
      prNumber = null,
      assignees = []
    } = options;

    this.logger.info(`Creating issue from test failure: ${testName}`);

    const title = `Test Failure: ${testName}`;

    const body = this.generateTestFailureBody({
      testName,
      errorMessage,
      stackTrace,
      file,
      line,
      prNumber
    });

    const labels = ['bug', 'test-failure'];
    if (prNumber) {
      labels.push('pr-related');
    }

    return this.createIssue({
      title,
      body,
      labels,
      assignees,
      autoAssign: assignees.length === 0
    });
  }

  /**
   * Generate test failure body
   * @param {Object} data - Test failure data
   * @returns {string} Issue body
   */
  generateTestFailureBody(data) {
    const { testName, errorMessage, stackTrace, file, line, prNumber } = data;

    const sections = [];

    sections.push('## Test Failure Report');
    sections.push('');
    sections.push(`**Test:** ${testName}`);
    sections.push('');

    if (file) {
      sections.push(`**File:** \`${file}${line ? `:${line}` : ''}\``);
      sections.push('');
    }

    if (errorMessage) {
      sections.push('### Error Message');
      sections.push('');
      sections.push('```');
      sections.push(errorMessage);
      sections.push('```');
      sections.push('');
    }

    if (stackTrace) {
      sections.push('<details>');
      sections.push('<summary>Stack Trace</summary>');
      sections.push('');
      sections.push('```');
      sections.push(stackTrace);
      sections.push('```');
      sections.push('</details>');
      sections.push('');
    }

    if (prNumber) {
      sections.push(`**Related PR:** #${prNumber}`);
      sections.push('');
    }

    sections.push('### Action Items');
    sections.push('');
    sections.push('- [ ] Investigate test failure');
    sections.push('- [ ] Fix the issue');
    sections.push('- [ ] Verify fix with tests');
    sections.push('- [ ] Update documentation if needed');
    sections.push('');

    sections.push('---');
    sections.push('');
    sections.push('🤖 Auto-generated from test failure by [Claude Code](https://claude.com/claude-code)');

    return sections.join('\n');
  }

  /**
   * Select assignees
   * @param {string} title - Issue title
   * @param {string} body - Issue body
   * @param {Array} labels - Labels
   * @returns {Promise<Array>} Selected assignees
   */
  async selectAssignees(title, body, labels) {
    try {
      // Get repository collaborators
      const { data: collaborators } = await this.octokit.rest.repos.listCollaborators({
        owner: this.owner,
        repo: this.repo
      });

      // Filter out bots
      const users = collaborators
        .filter(user => !user.login.includes('[bot]'))
        .map(user => user.login);

      // Simple selection: assign to first available user
      // In production, this could be more sophisticated (workload balancing, expertise matching, etc.)
      if (users.length > 0) {
        return [users[0]];
      }

      return [];
    } catch (error) {
      this.logger.warn(`Failed to select assignees: ${error.message}`);
      return [];
    }
  }

  /**
   * Update issue
   * @param {number} issueNumber - Issue number
   * @param {Object} updates - Updates
   * @returns {Promise<Object>} Result
   */
  async updateIssue(issueNumber, updates = {}) {
    this.ensureInitialized();

    try {
      const { data: issue } = await this.octokit.rest.issues.update({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        ...updates
      });

      return this.createResult({
        success: true,
        data: {
          number: issue.number,
          state: issue.state
        }
      });
    } catch (error) {
      this.logger.error(`Failed to update issue: ${error.message}`);
      throw error;
    }
  }

  /**
   * Close issue
   * @param {number} issueNumber - Issue number
   * @param {string} reason - Close reason
   * @returns {Promise<Object>} Result
   */
  async closeIssue(issueNumber, reason = null) {
    this.logger.info(`Closing issue #${issueNumber}`);

    const updates = { state: 'closed' };
    if (reason) {
      updates.state_reason = reason; // 'completed' or 'not_planned'
    }

    return this.updateIssue(issueNumber, updates);
  }

  /**
   * Reopen issue
   * @param {number} issueNumber - Issue number
   * @returns {Promise<Object>} Result
   */
  async reopenIssue(issueNumber) {
    this.logger.info(`Reopening issue #${issueNumber}`);
    return this.updateIssue(issueNumber, { state: 'open' });
  }

  /**
   * Add comment to issue
   * @param {number} issueNumber - Issue number
   * @param {string} body - Comment body
   * @returns {Promise<Object>} Result
   */
  async addComment(issueNumber, body) {
    this.ensureInitialized();

    try {
      const { data: comment } = await this.octokit.rest.issues.createComment({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        body
      });

      this.logger.info(`Added comment to issue #${issueNumber}`);

      return this.createResult({
        success: true,
        data: {
          commentId: comment.id,
          url: comment.html_url
        }
      });
    } catch (error) {
      this.logger.error(`Failed to add comment: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add labels to issue
   * @param {number} issueNumber - Issue number
   * @param {Array} labels - Label names
   * @returns {Promise<Object>} Result
   */
  async addLabels(issueNumber, labels) {
    this.ensureInitialized();

    try {
      await this.octokit.rest.issues.addLabels({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        labels
      });

      this.logger.info(`Added labels to issue #${issueNumber}: ${labels.join(', ')}`);

      return this.createResult({
        success: true,
        data: { labels }
      });
    } catch (error) {
      this.logger.error(`Failed to add labels: ${error.message}`);
      throw error;
    }
  }

  /**
   * Assign users to issue
   * @param {number} issueNumber - Issue number
   * @param {Array} assignees - User logins
   * @returns {Promise<Object>} Result
   */
  async assignUsers(issueNumber, assignees) {
    this.ensureInitialized();

    try {
      await this.octokit.rest.issues.addAssignees({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        assignees
      });

      this.logger.info(`Assigned users to issue #${issueNumber}: ${assignees.join(', ')}`);

      return this.createResult({
        success: true,
        data: { assignees }
      });
    } catch (error) {
      this.logger.error(`Failed to assign users: ${error.message}`);
      throw error;
    }
  }

  /**
   * List issues
   * @param {Object} options - List options
   * @returns {Promise<Object>} Issues list
   */
  async listIssues(options = {}) {
    this.ensureInitialized();

    const {
      state = 'open',
      labels = null,
      assignee = null,
      sort = 'created',
      direction = 'desc',
      perPage = 30
    } = options;

    try {
      const { data: issues } = await this.octokit.rest.issues.listForRepo({
        owner: this.owner,
        repo: this.repo,
        state,
        labels,
        assignee,
        sort,
        direction,
        per_page: perPage
      });

      // Filter out pull requests (GitHub API returns both)
      const onlyIssues = issues.filter(issue => !issue.pull_request);

      return this.createResult({
        success: true,
        data: {
          issues: onlyIssues.map(issue => ({
            number: issue.number,
            title: issue.title,
            state: issue.state,
            labels: issue.labels.map(l => l.name),
            assignees: issue.assignees.map(a => a.login),
            url: issue.html_url,
            createdAt: issue.created_at,
            updatedAt: issue.updated_at
          })),
          count: onlyIssues.length
        }
      });
    } catch (error) {
      this.logger.error(`Failed to list issues: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get issue
   * @param {number} issueNumber - Issue number
   * @returns {Promise<Object>} Issue data
   */
  async getIssue(issueNumber) {
    this.ensureInitialized();

    const { data: issue } = await this.octokit.rest.issues.get({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber
    });

    return issue;
  }

  /**
   * Link issue to PR
   * @param {number} issueNumber - Issue number
   * @param {number} prNumber - PR number
   * @returns {Promise<Object>} Result
   */
  async linkIssueToPR(issueNumber, prNumber) {
    const message = `This issue is addressed by #${prNumber}`;
    return this.addComment(issueNumber, message);
  }

  /**
   * Close issue with PR reference
   * @param {number} issueNumber - Issue number
   * @param {number} prNumber - PR number
   * @returns {Promise<Object>} Result
   */
  async closeWithPR(issueNumber, prNumber) {
    await this.addComment(issueNumber, `Fixed in #${prNumber}`);
    return this.closeIssue(issueNumber, 'completed');
  }
}

/**
 * Get singleton instance
 */
let managerInstance = null;

export function getIssueManager() {
  if (!managerInstance) {
    managerInstance = new IssueManager();
  }
  return managerInstance;
}
