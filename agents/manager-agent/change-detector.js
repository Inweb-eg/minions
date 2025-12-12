import { exec } from 'child_process';
import { promisify } from 'util';
import { createLogger } from '../../../agents/foundation/common/logger.js';
import { getDependencyGraph } from './dependency-graph.js';
import { getEventBus } from '../../../agents/foundation/event-bus/AgentEventBus.js';
import { EventTypes } from '../../../agents/foundation/event-bus/eventTypes.js';

const execPromise = promisify(exec);
const logger = createLogger('ChangeDetector');

/**
 * Detects and analyzes code changes to determine which agents need to run
 * Monitors git for changes and performs impact analysis
 */
class ChangeDetector {
  constructor() {
    this.eventBus = getEventBus ? getEventBus() : null;
    this.dependencyGraph = getDependencyGraph();
    this.lastCheckCommit = null;
    this.monitoringInterval = null;
    this.monitoringEnabled = false;

    // Change priority levels
    this.PRIORITY = {
      CRITICAL: 1,    // Breaking changes, security fixes
      HIGH: 2,        // Feature changes, API modifications
      MEDIUM: 3,      // Bug fixes, minor updates
      LOW: 4          // Documentation, comments, formatting
    };
  }

  /**
   * Initialize the change detector
   */
  async initialize() {
    try {
      // Get current commit as baseline
      this.lastCheckCommit = await this.getCurrentCommit();
      logger.info(`Change detector initialized at commit: ${this.lastCheckCommit.slice(0, 7)}`);
    } catch (error) {
      logger.error('Failed to initialize change detector:', error);
      throw error;
    }
  }

  /**
   * Get current git commit hash
   */
  async getCurrentCommit() {
    try {
      const { stdout } = await execPromise('git rev-parse HEAD');
      return stdout.trim();
    } catch (error) {
      logger.error('Failed to get current commit:', error);
      throw new Error('Not a git repository or git not available');
    }
  }

  /**
   * Get list of changed files since last check
   */
  async getChangedFiles() {
    try {
      // Get both staged and unstaged changes
      const { stdout: staged } = await execPromise('git diff --cached --name-only');
      const { stdout: unstaged } = await execPromise('git diff --name-only');
      const { stdout: untracked } = await execPromise('git ls-files --others --exclude-standard');

      const allChanges = [
        ...staged.split('\n').filter(Boolean),
        ...unstaged.split('\n').filter(Boolean),
        ...untracked.split('\n').filter(Boolean)
      ];

      // Remove duplicates
      const uniqueChanges = [...new Set(allChanges)];

      logger.debug(`Detected ${uniqueChanges.length} changed files`);

      return uniqueChanges;
    } catch (error) {
      logger.error('Failed to get changed files:', error);
      return [];
    }
  }

  /**
   * Get files changed between two commits
   */
  async getChangedFilesBetweenCommits(fromCommit, toCommit = 'HEAD') {
    try {
      const { stdout } = await execPromise(`git diff --name-only ${fromCommit}..${toCommit}`);
      const files = stdout.split('\n').filter(Boolean);

      logger.debug(`Found ${files.length} changed files between ${fromCommit.slice(0, 7)} and ${toCommit}`);

      return files;
    } catch (error) {
      logger.error('Failed to get changed files between commits:', error);
      return [];
    }
  }

  /**
   * Analyze file changes and determine their type and priority
   */
  analyzeChanges(files) {
    const analysis = {
      totalFiles: files.length,
      byCategory: {
        backend: [],
        frontend: [],
        database: [],
        docs: [],
        tests: [],
        config: [],
        other: []
      },
      byPriority: {
        [this.PRIORITY.CRITICAL]: [],
        [this.PRIORITY.HIGH]: [],
        [this.PRIORITY.MEDIUM]: [],
        [this.PRIORITY.LOW]: []
      },
      breakingChanges: [],
      securityImpact: false
    };

    for (const file of files) {
      const category = this.categorizeFile(file);
      const priority = this.determinePriority(file);
      const isBreaking = this.isBreakingChange(file);

      // Categorize
      if (analysis.byCategory[category]) {
        analysis.byCategory[category].push(file);
      } else {
        analysis.byCategory.other.push(file);
      }

      // Prioritize
      if (analysis.byPriority[priority]) {
        analysis.byPriority[priority].push(file);
      }

      // Check for breaking changes
      if (isBreaking) {
        analysis.breakingChanges.push(file);
      }

      // Check for security impact
      if (this.hasSecurityImpact(file)) {
        analysis.securityImpact = true;
      }
    }

    logger.info(`Change analysis: ${files.length} files, ${analysis.breakingChanges.length} breaking changes`);

    return analysis;
  }

  /**
   * Categorize a file by its path
   */
  categorizeFile(file) {
    // Check for tests first (before backend/frontend) as test files can be anywhere
    if (file.match(/\.test\.(js|ts|dart)$/) || file.match(/^tests?\//)) return 'tests';
    if (file.match(/\.sql$|migrations\//)) return 'database';
    if (file.match(/^docs\/.*\.md$/) || file.match(/README\.md$/)) return 'docs';
    if (file.match(/^backend\/.*\.(js|ts)$/)) return 'backend';
    if (file.match(/^(admin-dashboard|users|drivers)\/.*\.(js|jsx|ts|tsx|dart)$/)) return 'frontend';
    if (file.match(/\.(json|yaml|yml|config\.js|rc)$/) || file.match(/^\..*rc$/)) return 'config';
    return 'other';
  }

  /**
   * Determine priority of a file change
   */
  determinePriority(file) {
    // CRITICAL: Database migrations, security files, core API
    if (file.match(/migrations\//) ||
        file.match(/security|auth|crypto/i) ||
        file.match(/backend\/.*routes.*\.js/) ||
        file.match(/package\.json/) ||
        file.match(/Dockerfile/)) {
      return this.PRIORITY.CRITICAL;
    }

    // HIGH: API changes, model changes, major features
    if (file.match(/backend\/.*models.*\.js/) ||
        file.match(/backend\/.*controllers.*\.js/) ||
        file.match(/backend\/.*services.*\.js/) ||
        file.match(/.*\/(models|repositories|services)\/.*\.(js|dart)/)) {
      return this.PRIORITY.HIGH;
    }

    // LOW: Documentation, tests, comments
    if (file.match(/\.md$/) ||
        file.match(/\.test\.(js|ts|dart)$/) ||
        file.match(/^tests?\//)) {
      return this.PRIORITY.LOW;
    }

    // MEDIUM: Everything else
    return this.PRIORITY.MEDIUM;
  }

  /**
   * Check if a change is breaking
   */
  isBreakingChange(file) {
    // Breaking changes typically involve:
    // - Database migrations (schema changes)
    // - API route changes
    // - Model changes
    // - Public API modifications
    return Boolean(
      file.match(/migrations\//) ||
      file.match(/backend\/.*routes.*\.js/) ||
      file.match(/backend\/.*models.*\.js/) ||
      file.match(/openapi\.yaml/)
    );
  }

  /**
   * Check if a change has security implications
   */
  hasSecurityImpact(file) {
    return Boolean(
      file.match(/security|auth|crypto|password|token|jwt|session/i) ||
      file.match(/\.env/) ||
      file.match(/credentials/i)
    );
  }

  /**
   * Perform impact analysis to determine affected agents
   */
  async performImpactAnalysis(changedFiles) {
    if (!changedFiles || changedFiles.length === 0) {
      logger.debug('No changed files to analyze');
      return {
        affectedAgents: [],
        changeAnalysis: this.analyzeChanges([]),
        executionPriority: []
      };
    }

    // Analyze the changes
    const changeAnalysis = this.analyzeChanges(changedFiles);

    // Get affected agents from dependency graph
    const affectedAgents = this.dependencyGraph.getAffectedAgents(changedFiles);

    // Prioritize agent execution based on change priority
    const executionPriority = this.prioritizeAgentExecution(affectedAgents, changeAnalysis);

    logger.info(`Impact analysis: ${affectedAgents.length} agents affected`);

    // Publish event
    if (this.eventBus) {
      this.eventBus.publish(EventTypes.CHANGE_DETECTED, {
        agent: 'change-detector',
        changedFiles: changedFiles.length,
        affectedAgents: affectedAgents.length,
        breakingChanges: changeAnalysis.breakingChanges.length,
        securityImpact: changeAnalysis.securityImpact,
        priority: this.getOverallPriority(changeAnalysis)
      });
    }

    return {
      affectedAgents,
      changeAnalysis,
      executionPriority
    };
  }

  /**
   * Prioritize agent execution based on change analysis
   */
  prioritizeAgentExecution(agents, changeAnalysis) {
    const prioritized = agents.map(agent => ({
      agent,
      priority: this.calculateAgentPriority(agent, changeAnalysis),
      reasoning: this.getAgentPriorityReasoning(agent, changeAnalysis)
    }));

    // Sort by priority (lower number = higher priority)
    prioritized.sort((a, b) => a.priority - b.priority);

    logger.debug(`Agent execution priority: ${prioritized.map(p => `${p.agent} (P${p.priority})`).join(', ')}`);

    return prioritized;
  }

  /**
   * Calculate priority for a specific agent based on changes
   */
  calculateAgentPriority(agent, changeAnalysis) {
    // Base priority from agent dependencies
    const agentDependencies = this.dependencyGraph.getDependencies(agent);
    let priority = agentDependencies.length + 2; // Base priority

    // Adjust based on change categories
    if (agent === 'backend-agent' && changeAnalysis.byCategory.backend.length > 0) {
      priority = this.PRIORITY.CRITICAL;
    } else if (agent === 'document-agent' && changeAnalysis.byCategory.docs.length > 0) {
      priority = this.PRIORITY.LOW;
    } else if (agent === 'tester-agent' && changeAnalysis.byCategory.tests.length > 0) {
      priority = this.PRIORITY.MEDIUM;
    } else if (changeAnalysis.securityImpact) {
      priority = this.PRIORITY.CRITICAL;
    }

    return priority;
  }

  /**
   * Get reasoning for agent priority
   */
  getAgentPriorityReasoning(agent, changeAnalysis) {
    const reasons = [];

    if (agent === 'backend-agent' && changeAnalysis.byCategory.backend.length > 0) {
      reasons.push(`${changeAnalysis.byCategory.backend.length} backend files changed`);
    }

    if (changeAnalysis.breakingChanges.length > 0) {
      reasons.push(`${changeAnalysis.breakingChanges.length} breaking changes detected`);
    }

    if (changeAnalysis.securityImpact) {
      reasons.push('Security-related changes detected');
    }

    return reasons.length > 0 ? reasons.join(', ') : 'Standard priority';
  }

  /**
   * Get overall priority from change analysis
   */
  getOverallPriority(changeAnalysis) {
    if (changeAnalysis.securityImpact || changeAnalysis.breakingChanges.length > 0) {
      return this.PRIORITY.CRITICAL;
    }

    if (changeAnalysis.byPriority[this.PRIORITY.CRITICAL].length > 0) {
      return this.PRIORITY.CRITICAL;
    }

    if (changeAnalysis.byPriority[this.PRIORITY.HIGH].length > 0) {
      return this.PRIORITY.HIGH;
    }

    if (changeAnalysis.byPriority[this.PRIORITY.MEDIUM].length > 0) {
      return this.PRIORITY.MEDIUM;
    }

    return this.PRIORITY.LOW;
  }

  /**
   * Start monitoring for changes
   */
  startMonitoring(intervalMs = 30000) {
    if (this.monitoringEnabled) {
      logger.warn('Monitoring already enabled');
      return;
    }

    this.monitoringEnabled = true;

    logger.info(`Starting change monitoring (interval: ${intervalMs}ms)`);

    this.monitoringInterval = setInterval(async () => {
      try {
        const currentCommit = await this.getCurrentCommit();

        if (currentCommit !== this.lastCheckCommit) {
          logger.info(`Commit changed: ${this.lastCheckCommit.slice(0, 7)} → ${currentCommit.slice(0, 7)}`);

          // Get changed files
          const changedFiles = await this.getChangedFilesBetweenCommits(
            this.lastCheckCommit,
            currentCommit
          );

          // Perform impact analysis
          const impact = await this.performImpactAnalysis(changedFiles);

          // Publish comprehensive change event
          if (this.eventBus) {
            this.eventBus.publish(EventTypes.CHANGE_DETECTED, {
              agent: 'change-detector',
              type: 'commit',
              fromCommit: this.lastCheckCommit,
              toCommit: currentCommit,
              files: changedFiles,
              ...impact
            });
          }

          this.lastCheckCommit = currentCommit;
        }
      } catch (error) {
        logger.error('Error during change monitoring:', error);
      }
    }, intervalMs);
  }

  /**
   * Stop monitoring for changes
   */
  stopMonitoring() {
    if (!this.monitoringEnabled) {
      logger.warn('Monitoring not enabled');
      return;
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.monitoringEnabled = false;
    logger.info('Change monitoring stopped');
  }

  /**
   * Get current monitoring status
   */
  getStatus() {
    return {
      enabled: this.monitoringEnabled,
      lastCommit: this.lastCheckCommit,
      interval: this.monitoringInterval ? 'active' : 'inactive'
    };
  }
}

// Singleton instance
let instance = null;

export function getChangeDetector() {
  if (!instance) {
    instance = new ChangeDetector();
  }
  return instance;
}

export default ChangeDetector;
