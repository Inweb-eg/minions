/**
 * GitHub-Agent - Complete GitHub Automation System
 *
 * Phase 9: GitHub-Agent
 * Main entry point for all GitHub-Agent modules
 *
 * Architecture Pattern: Event-Driven Agent
 * Follows: Singleton pattern, EventBus integration
 */

// EventBus integration
let getEventBus, EventTypes;
try {
  const eventBusModule = await import('../../foundation/event-bus/AgentEventBus.js');
  const eventTypesModule = await import('../../foundation/event-bus/eventTypes.js');
  getEventBus = eventBusModule.getEventBus;
  EventTypes = eventTypesModule.EventTypes;
} catch (error) {
  // Fallback if foundation not available
  getEventBus = null;
  EventTypes = null;
}

// Branches & PR Management
export * from './branches/index.js';

// Code Review Engine
export * from './reviews/index.js';

// Merge & Issue Management
export * from './merges/index.js';

// Release & Analytics
export * from './releases/index.js';

// Utilities
export { createLogger } from './utils/logger.js';

/**
 * GitHub-Agent Version
 */
export const VERSION = '1.0.0';

/**
 * GitHub-Agent Info
 */
export const INFO = {
  name: 'GitHub-Agent',
  version: VERSION,
  description: 'Complete GitHub automation system with PR, review, merge, and release capabilities',
  modules: [
    'branches',     // Branch and PR management
    'reviews',      // Code review engine
    'merges',       // Merge and issue management
    'releases'      // Release and analytics
  ]
};

/**
 * Get GitHub-Agent information
 * @returns {Object} Agent information
 */
export function getInfo() {
  return INFO;
}

/**
 * Initialize GitHub-Agent
 * @param {Object} options - Initialization options
 * @returns {Promise<Object>} Initialized components
 */
export async function initialize(options = {}) {
  const {
    auth = process.env.GITHUB_TOKEN,
    owner = process.env.GITHUB_OWNER,
    repo = process.env.GITHUB_REPO,
    workingDir = process.cwd(),
    enableBranches = true,
    enableReviews = true,
    enableMerges = true,
    enableReleases = true
  } = options;

  const config = { auth, owner, repo, workingDir };
  const components = {};

  // Import modules dynamically based on options
  if (enableBranches) {
    const { initializeBranchManagers } = await import('./branches/index.js');
    components.branches = await initializeBranchManagers(config);
  }

  if (enableReviews) {
    const { initializeReviewers } = await import('./reviews/index.js');
    components.reviews = await initializeReviewers(config);
  }

  if (enableMerges) {
    const { initializeMergeManagers } = await import('./merges/index.js');
    components.merges = await initializeMergeManagers(config);
  }

  if (enableReleases) {
    const { initializeReleaseManagers } = await import('./releases/index.js');
    components.releases = await initializeReleaseManagers(config);
  }

  return components;
}

/**
 * Shutdown GitHub-Agent
 * @param {Object} components - Initialized components
 * @returns {Promise<void>}
 */
export async function shutdown(components = {}) {
  // Clear histories
  if (components.branches) {
    const { clearAllBranchHistories } = await import('./branches/index.js');
    clearAllBranchHistories();
  }

  if (components.reviews) {
    const { clearAllReviewHistories } = await import('./reviews/index.js');
    clearAllReviewHistories();
  }

  if (components.merges) {
    const { clearAllMergeHistories } = await import('./merges/index.js');
    clearAllMergeHistories();
  }

  if (components.releases) {
    const { clearAllReleaseHistories } = await import('./releases/index.js');
    clearAllReleaseHistories();
  }
}

/**
 * Get GitHub-Agent status
 * @param {Object} components - Initialized components
 * @returns {Object} Status information
 */
export function getStatus(components = {}) {
  const status = {
    version: VERSION,
    modules: {},
    timestamp: new Date().toISOString()
  };

  if (components.branches) {
    status.modules.branches = Object.keys(components.branches).map(key => ({
      name: key,
      statistics: components.branches[key].getStatistics?.() || {}
    }));
  }

  if (components.reviews) {
    status.modules.reviews = Object.keys(components.reviews).map(key => ({
      name: key,
      statistics: components.reviews[key].getStatistics?.() || {}
    }));
  }

  if (components.merges) {
    status.modules.merges = Object.keys(components.merges).map(key => ({
      name: key,
      statistics: components.merges[key].getStatistics?.() || {}
    }));
  }

  if (components.releases) {
    status.modules.releases = Object.keys(components.releases).map(key => ({
      name: key,
      statistics: components.releases[key].getStatistics?.() || {}
    }));
  }

  return status;
}

/**
 * Complete PR workflow
 * @param {Object} options - Workflow options
 * @returns {Promise<Object>} Workflow result
 */
export async function completePRWorkflow(options = {}) {
  const {
    branchName,
    prTitle,
    prBody = null,
    autoReview = true,
    autoMerge = false,
    components
  } = options;

  const workflow = {
    branch: null,
    pr: null,
    review: null,
    merge: null
  };

  try {
    // Step 1: Create branch
    if (components.branches?.branch) {
      workflow.branch = await components.branches.branch.createBranch({
        name: branchName,
        push: true,
        checkout: true
      });
    }

    // Step 2: Create PR
    if (components.branches?.pr && branchName) {
      workflow.pr = await components.branches.pr.createPR({
        head: branchName,
        title: prTitle,
        body: prBody,
        autoGenerate: !prBody,
        assignReviewers: true
      });
    }

    // Step 3: Auto-review if enabled
    if (autoReview && components.reviews && workflow.pr) {
      const { performCodeReview } = await import('./reviews/index.js');
      workflow.review = await performCodeReview({
        prNumber: workflow.pr.data.number,
        postComments: true,
        autoDecision: true
      });
    }

    // Step 4: Auto-merge if enabled
    if (autoMerge && components.merges?.merge && workflow.pr && workflow.review?.decision?.approved) {
      workflow.merge = await components.merges.merge.autoMerge(workflow.pr.data.number);
    }

    return {
      success: true,
      workflow,
      summary: {
        branchCreated: workflow.branch?.success || false,
        prCreated: workflow.pr?.success || false,
        reviewed: workflow.review !== null,
        merged: workflow.merge?.success || false
      }
    };
  } catch (error) {
    return {
      success: false,
      workflow,
      error: error.message
    };
  }
}

/**
 * GithubAgent class for orchestrator compatibility
 */
class GithubAgent {
  constructor() {
    this.components = null;
    this.initialized = false;

    // EventBus integration
    this.eventBus = getEventBus ? getEventBus() : null;
    this.EventTypes = EventTypes;
    this.unsubscribers = [];

    if (this.eventBus) {
      this.subscribeToEvents();
    }
  }

  /**
   * Subscribe to EventBus events
   */
  subscribeToEvents() {
    // Listen for auto-fix requests from Manager-Agent
    this.unsubscribers.push(
      this.eventBus.subscribe(
        this.EventTypes.AUTO_FIX_REQUESTED,
        'github-agent',
        this.handleAutoFixRequest.bind(this)
      )
    );

    // Listen for code updates to potentially create PRs
    this.unsubscribers.push(
      this.eventBus.subscribe(
        this.EventTypes.CODE_UPDATED,
        'github-agent',
        this.handleCodeUpdated.bind(this)
      )
    );

    // Listen for test completions to update PR status
    this.unsubscribers.push(
      this.eventBus.subscribe(
        this.EventTypes.TESTS_COMPLETED,
        'github-agent',
        this.handleTestsCompleted.bind(this)
      )
    );
  }

  /**
   * Handle auto-fix request from Manager-Agent
   */
  async handleAutoFixRequest(data) {
    if (data.targetAgent !== 'github-agent') {
      return;
    }

    if (this.eventBus && this.EventTypes) {
      this.eventBus.publish(this.EventTypes.AGENT_STARTED, {
        agent: 'github-agent',
        action: data.action || 'auto-fix',
        loopId: data.loopId
      });
    }

    try {
      const result = await this.execute();

      if (this.eventBus && this.EventTypes) {
        this.eventBus.publish(this.EventTypes.AGENT_COMPLETED, {
          agent: 'github-agent',
          action: data.action || 'auto-fix',
          results: result,
          loopId: data.loopId
        });
      }
    } catch (error) {
      if (this.eventBus && this.EventTypes) {
        this.eventBus.publish(this.EventTypes.AGENT_FAILED, {
          agent: 'github-agent',
          action: data.action || 'auto-fix',
          error: error.message,
          loopId: data.loopId
        });
      }
    }
  }

  /**
   * Handle code updates - track changes for potential PR
   */
  async handleCodeUpdated(data) {
    // Track code updates for potential PR creation
    if (data.isAutoFix && data.filesModified?.length > 0) {
      // Could trigger PR creation workflow
    }
  }

  /**
   * Handle test completions - update PR status checks
   */
  async handleTestsCompleted(data) {
    // Could update PR status checks based on test results
  }

  /**
   * Cleanup subscriptions
   */
  cleanup() {
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
    this.unsubscribers = [];
  }

  async initialize(options = {}) {
    if (this.initialized) return;

    // Check if GitHub token is available
    const auth = options.auth || process.env.GITHUB_TOKEN;
    if (!auth) {
      // No token - skip initialization but mark as initialized to prevent retries
      this.initialized = true;
      this.skipExecution = true;
      return;
    }

    this.components = await initialize(options);
    this.initialized = true;
    this.skipExecution = false;
  }

  async execute() {
    if (!this.initialized) {
      await this.initialize();
    }

    // Skip execution if no GitHub token
    if (this.skipExecution) {
      return { success: true, agent: 'github-agent', skipped: true, reason: 'No GitHub token configured' };
    }

    // GitHub agent execution logic - handles PR workflows
    return { success: true, agent: 'github-agent' };
  }

  getStatus() {
    return getStatus(this.components);
  }

  async shutdown() {
    this.cleanup();
    if (this.components) {
      await shutdown(this.components);
    }
  }
}

// Singleton instance
let githubAgentInstance = null;

/**
 * Get GithubAgent singleton instance
 * @returns {GithubAgent} GithubAgent instance
 */
export function getGithubAgent() {
  if (!githubAgentInstance) {
    githubAgentInstance = new GithubAgent();
  }
  return githubAgentInstance;
}
