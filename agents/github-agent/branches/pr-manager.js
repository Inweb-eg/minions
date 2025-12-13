/**
 * PRManager - Manages Pull Requests
 *
 * Phase 9.1: Branch & PR Management
 * Creates and manages pull requests with smart descriptions and reviewer selection
 */

import { BaseManager, OPERATION_STATUS } from './base-manager.js';
import simpleGit from 'simple-git';

/**
 * PR state
 */
export const PR_STATE = {
  OPEN: 'open',
  CLOSED: 'closed',
  MERGED: 'merged',
  DRAFT: 'draft'
};

/**
 * PRManager
 * Manages pull requests
 */
export class PRManager extends BaseManager {
  constructor() {
    super('PRManager', 'pr');
    this.git = null;
  }

  /**
   * Initialize
   * @param {Object} options - Initialization options
   * @returns {Promise<void>}
   */
  async initialize(options = {}) {
    await super.initialize(options);

    const { workingDir = process.cwd() } = options;
    this.git = simpleGit(workingDir);

    this.logger.info('PR Manager initialized');
  }

  /**
   * Create pull request
   * @param {Object} options - PR options
   * @returns {Promise<Object>} Result
   */
  async createPR(options = {}) {
    this.ensureInitialized();

    const {
      head,
      base = null,
      title,
      body = null,
      draft = false,
      autoGenerate = true,
      assignReviewers = true,
      labels = []
    } = options;

    try {
      const baseBranch = base || await this.getDefaultBranch();

      this.logger.info(`Creating PR: ${head} → ${baseBranch}`);

      // Auto-generate title and body if not provided
      let prTitle = title;
      let prBody = body;

      if (autoGenerate) {
        const generated = await this.generatePRContent(head, baseBranch);
        prTitle = prTitle || generated.title;
        prBody = prBody || generated.body;
      }

      // Create PR
      const { data: pr } = await this.octokit.rest.pulls.create({
        owner: this.owner,
        repo: this.repo,
        title: prTitle,
        head,
        base: baseBranch,
        body: prBody,
        draft
      });

      // Add labels if provided
      if (labels.length > 0) {
        await this.addLabels(pr.number, labels);
      }

      // Auto-assign reviewers
      if (assignReviewers) {
        await this.assignReviewers(pr.number, head);
      }

      const result = this.createResult({
        success: true,
        data: {
          number: pr.number,
          url: pr.html_url,
          title: pr.title,
          state: pr.state,
          draft: pr.draft
        }
      });

      this.recordOperation(result);
      this.logger.info(`PR created successfully: #${pr.number}`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to create PR: ${error.message}`);

      const result = this.createResult({
        success: false,
        error: error.message
      });

      this.recordOperation(result);
      throw error;
    }
  }

  /**
   * Generate PR content
   * @param {string} head - Head branch
   * @param {string} base - Base branch
   * @returns {Promise<Object>} Generated content
   */
  async generatePRContent(head, base) {
    try {
      // Get commit messages
      const commits = await this.getCommits(head, base);

      // Generate title from first commit or branch name
      const title = commits.length > 0
        ? commits[0].message.split('\n')[0]
        : this.generateTitleFromBranch(head);

      // Generate body from commits
      const body = this.generatePRBody(commits, head, base);

      return { title, body };
    } catch (error) {
      this.logger.warn(`Failed to generate PR content: ${error.message}`);
      return {
        title: `Merge ${head} into ${base}`,
        body: 'Auto-generated pull request'
      };
    }
  }

  /**
   * Get commits between branches
   * @param {string} head - Head branch
   * @param {string} base - Base branch
   * @returns {Promise<Array>} Commits
   */
  async getCommits(head, base) {
    const { data: commits } = await this.octokit.rest.repos.compareCommits({
      owner: this.owner,
      repo: this.repo,
      base,
      head
    });

    return commits.commits.map(commit => ({
      sha: commit.sha,
      message: commit.commit.message,
      author: commit.commit.author.name,
      date: commit.commit.author.date
    }));
  }

  /**
   * Generate title from branch name
   * @param {string} branchName - Branch name
   * @returns {string} Title
   */
  generateTitleFromBranch(branchName) {
    // Remove prefix (feature/, bugfix/, etc.)
    let title = branchName.replace(/^(feature|bugfix|hotfix|release|chore)\//, '');

    // Convert kebab-case to Title Case
    title = title
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    return title;
  }

  /**
   * Generate PR body
   * @param {Array} commits - Commits
   * @param {string} head - Head branch
   * @param {string} base - Base branch
   * @returns {string} PR body
   */
  generatePRBody(commits, head, base) {
    const sections = [];

    // Summary section
    sections.push('## Summary');
    sections.push('');
    sections.push(`This PR merges \`${head}\` into \`${base}\`.`);
    sections.push('');

    // Changes section
    if (commits.length > 0) {
      sections.push('## Changes');
      sections.push('');

      commits.forEach(commit => {
        const message = commit.message.split('\n')[0];
        sections.push(`- ${message} (${commit.sha.substring(0, 7)})`);
      });

      sections.push('');
    }

    // Test plan section
    sections.push('## Test Plan');
    sections.push('');
    sections.push('- [ ] Unit tests pass');
    sections.push('- [ ] Integration tests pass');
    sections.push('- [ ] Manual testing completed');
    sections.push('');

    // Footer
    sections.push('---');
    sections.push('');
    sections.push('🤖 Generated with [Claude Code](https://claude.com/claude-code)');

    return sections.join('\n');
  }

  /**
   * Assign reviewers
   * @param {number} prNumber - PR number
   * @param {string} branchName - Branch name
   * @returns {Promise<Object>} Result
   */
  async assignReviewers(prNumber, branchName) {
    try {
      const reviewers = await this.selectReviewers(branchName);

      if (reviewers.length === 0) {
        this.logger.info('No reviewers selected');
        return this.createResult({ success: true, data: { reviewers: [] } });
      }

      await this.octokit.rest.pulls.requestReviewers({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
        reviewers
      });

      this.logger.info(`Assigned reviewers: ${reviewers.join(', ')}`);

      return this.createResult({
        success: true,
        data: { reviewers }
      });
    } catch (error) {
      this.logger.error(`Failed to assign reviewers: ${error.message}`);
      return this.createResult({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Select reviewers
   * @param {string} branchName - Branch name
   * @returns {Promise<Array>} Reviewer usernames
   */
  async selectReviewers(branchName) {
    try {
      // Get repository collaborators
      const { data: collaborators } = await this.octokit.rest.repos.listCollaborators({
        owner: this.owner,
        repo: this.repo
      });

      // Filter out bots and select based on branch type
      const reviewers = collaborators
        .filter(user => !user.login.includes('[bot]'))
        .map(user => user.login)
        .slice(0, 2); // Select up to 2 reviewers

      return reviewers;
    } catch (error) {
      this.logger.warn(`Failed to select reviewers: ${error.message}`);
      return [];
    }
  }

  /**
   * Add labels to PR
   * @param {number} prNumber - PR number
   * @param {Array} labels - Label names
   * @returns {Promise<Object>} Result
   */
  async addLabels(prNumber, labels) {
    try {
      await this.octokit.rest.issues.addLabels({
        owner: this.owner,
        repo: this.repo,
        issue_number: prNumber,
        labels
      });

      this.logger.info(`Added labels to PR #${prNumber}: ${labels.join(', ')}`);

      return this.createResult({
        success: true,
        data: { labels }
      });
    } catch (error) {
      this.logger.error(`Failed to add labels: ${error.message}`);
      return this.createResult({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get PR
   * @param {number} prNumber - PR number
   * @returns {Promise<Object>} PR data
   */
  async getPR(prNumber) {
    this.ensureInitialized();

    const { data: pr } = await this.octokit.rest.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber
    });

    return pr;
  }

  /**
   * List PRs
   * @param {Object} options - List options
   * @returns {Promise<Object>} PR list
   */
  async listPRs(options = {}) {
    this.ensureInitialized();

    const {
      state = PR_STATE.OPEN,
      base = null,
      head = null,
      sort = 'created',
      direction = 'desc',
      perPage = 30
    } = options;

    try {
      const { data: prs } = await this.octokit.rest.pulls.list({
        owner: this.owner,
        repo: this.repo,
        state,
        base,
        head,
        sort,
        direction,
        per_page: perPage
      });

      return this.createResult({
        success: true,
        data: {
          prs: prs.map(pr => ({
            number: pr.number,
            title: pr.title,
            state: pr.state,
            draft: pr.draft,
            head: pr.head.ref,
            base: pr.base.ref,
            url: pr.html_url,
            createdAt: pr.created_at,
            updatedAt: pr.updated_at
          })),
          count: prs.length
        }
      });
    } catch (error) {
      this.logger.error(`Failed to list PRs: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update PR
   * @param {number} prNumber - PR number
   * @param {Object} updates - Updates
   * @returns {Promise<Object>} Result
   */
  async updatePR(prNumber, updates = {}) {
    this.ensureInitialized();

    try {
      const { data: pr } = await this.octokit.rest.pulls.update({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
        ...updates
      });

      return this.createResult({
        success: true,
        data: {
          number: pr.number,
          title: pr.title,
          state: pr.state
        }
      });
    } catch (error) {
      this.logger.error(`Failed to update PR: ${error.message}`);
      throw error;
    }
  }

  /**
   * Close PR
   * @param {number} prNumber - PR number
   * @returns {Promise<Object>} Result
   */
  async closePR(prNumber) {
    return this.updatePR(prNumber, { state: 'closed' });
  }

  /**
   * Convert PR to draft
   * @param {number} prNumber - PR number
   * @returns {Promise<Object>} Result
   */
  async convertToDraft(prNumber) {
    this.ensureInitialized();

    try {
      await this.octokit.graphql(`
        mutation {
          convertPullRequestToDraft(input: {pullRequestId: "${prNumber}"}) {
            pullRequest {
              id
              isDraft
            }
          }
        }
      `);

      return this.createResult({
        success: true,
        data: { prNumber, draft: true }
      });
    } catch (error) {
      this.logger.error(`Failed to convert PR to draft: ${error.message}`);
      throw error;
    }
  }

  /**
   * Mark PR as ready
   * @param {number} prNumber - PR number
   * @returns {Promise<Object>} Result
   */
  async markAsReady(prNumber) {
    this.ensureInitialized();

    try {
      await this.octokit.graphql(`
        mutation {
          markPullRequestReadyForReview(input: {pullRequestId: "${prNumber}"}) {
            pullRequest {
              id
              isDraft
            }
          }
        }
      `);

      return this.createResult({
        success: true,
        data: { prNumber, draft: false }
      });
    } catch (error) {
      this.logger.error(`Failed to mark PR as ready: ${error.message}`);
      throw error;
    }
  }
}

/**
 * Get singleton instance
 */
let managerInstance = null;

export function getPRManager() {
  if (!managerInstance) {
    managerInstance = new PRManager();
  }
  return managerInstance;
}
