/**
 * PermissionManager
 * -----------------
 * Three-tier permission system for controlling agent actions.
 * Inspired by Claude Code's Rules → Modes → Dialog pattern, adapted for Minions.
 *
 * Tier 1: System Mode (supervised, autonomous, plan-only)
 * Tier 2: Static Rules (allow/deny patterns per agent/action)
 * Tier 3: Event-based approval (emits events for Gru UI to approve/deny)
 */

import { createLogger } from '../common/logger.js';
import { getEventBus } from '../event-bus/AgentEventBus.js';

export const PermissionEvents = {
  PERMISSION_REQUESTED: 'permission:requested',
  PERMISSION_GRANTED: 'permission:granted',
  PERMISSION_DENIED: 'permission:denied',
  MODE_CHANGED: 'permission:mode:changed',
  RULE_ADDED: 'permission:rule:added',
  RULE_REMOVED: 'permission:rule:removed'
};

const logger = createLogger('PermissionManager');

/**
 * System-wide execution modes
 */
export const PermissionMode = {
  AUTONOMOUS: 'autonomous',   // Allow rules execute immediately, no rules = allow
  SUPERVISED: 'supervised',   // Allow rules execute immediately, no rules = request approval
  PLAN_ONLY: 'plan-only'      // All write/modify actions denied, read-only allowed
};

/**
 * Action types that can be controlled
 */
export const ActionType = {
  EXECUTE: 'execute',                    // Run an agent
  FILE_WRITE: 'file:write',             // Write/modify files
  FILE_DELETE: 'file:delete',           // Delete files
  SHELL_COMMAND: 'shell:command',       // Execute shell commands
  EXTERNAL_API: 'external:api',        // Call external APIs
  PROJECT_MODIFY: 'project:modify',    // Modify project structure
  GIT_OPERATION: 'git:operation',      // Git operations (commit, push, etc.)
  SKILL_EXECUTE: 'skill:execute'       // Execute a skill
};

/**
 * Permission check result
 */
export class PermissionResult {
  constructor(allowed, reason, requiresApproval = false) {
    this.allowed = allowed;
    this.reason = reason;
    this.requiresApproval = requiresApproval;
    this.timestamp = Date.now();
  }

  static allow(reason = 'Allowed by rule') {
    return new PermissionResult(true, reason);
  }

  static deny(reason = 'Denied by rule') {
    return new PermissionResult(false, reason);
  }

  static requestApproval(reason = 'Requires approval') {
    return new PermissionResult(false, reason, true);
  }
}

class PermissionManager {
  constructor() {
    this.mode = PermissionMode.AUTONOMOUS;
    this.rules = new Map();       // Map<string, Rule[]> keyed by "agentName" or "*"
    this.pendingApprovals = new Map(); // Map<requestId, { resolve, reject, context }>
    this.eventBus = null;
    this.ruleIdCounter = 0;

    // Metrics
    this.metrics = {
      totalChecks: 0,
      allowed: 0,
      denied: 0,
      approvalRequests: 0,
      approvalGranted: 0,
      approvalDenied: 0
    };
  }

  /**
   * Initialize the permission manager
   */
  initialize() {
    try {
      this.eventBus = getEventBus();
    } catch (e) {
      logger.warn('EventBus not available for PermissionManager');
    }

    logger.info(`PermissionManager initialized in ${this.mode} mode`);
  }

  /**
   * Set the system-wide permission mode
   * @param {string} mode - One of PermissionMode values
   */
  setMode(mode) {
    if (!Object.values(PermissionMode).includes(mode)) {
      throw new Error(`Invalid permission mode: ${mode}. Valid modes: ${Object.values(PermissionMode).join(', ')}`);
    }

    const previousMode = this.mode;
    this.mode = mode;

    if (this.eventBus) {
      this.eventBus.publish(PermissionEvents.MODE_CHANGED, {
        previousMode,
        newMode: mode,
        timestamp: Date.now()
      });
    }

    logger.info(`Permission mode changed: ${previousMode} → ${mode}`);
  }

  /**
   * Get the current permission mode
   * @returns {string}
   */
  getMode() {
    return this.mode;
  }

  /**
   * Add a permission rule
   * @param {string} agentName - Agent name or '*' for all agents
   * @param {string} actionType - One of ActionType values
   * @param {string} decision - 'allow' or 'deny'
   * @param {object} options - Optional: { pattern, description }
   * @returns {string} Rule ID
   */
  addRule(agentName, actionType, decision, options = {}) {
    const ruleId = `rule-${++this.ruleIdCounter}`;
    const rule = {
      id: ruleId,
      agentName,
      actionType,
      decision, // 'allow' or 'deny'
      pattern: options.pattern || null,   // Optional glob/regex pattern for details matching
      description: options.description || '',
      createdAt: Date.now()
    };

    const key = agentName;
    if (!this.rules.has(key)) {
      this.rules.set(key, []);
    }
    this.rules.get(key).push(rule);

    if (this.eventBus) {
      this.eventBus.publish(PermissionEvents.RULE_ADDED, { rule });
    }

    logger.info(`Rule added: ${decision} ${actionType} for ${agentName} (${ruleId})`);
    return ruleId;
  }

  /**
   * Remove a permission rule by ID
   * @param {string} ruleId - Rule ID to remove
   * @returns {boolean} Whether the rule was found and removed
   */
  removeRule(ruleId) {
    for (const [key, rules] of this.rules.entries()) {
      const index = rules.findIndex(r => r.id === ruleId);
      if (index !== -1) {
        const removed = rules.splice(index, 1)[0];
        if (rules.length === 0) {
          this.rules.delete(key);
        }
        if (this.eventBus) {
          this.eventBus.publish(PermissionEvents.RULE_REMOVED, { rule: removed });
        }
        logger.info(`Rule removed: ${ruleId}`);
        return true;
      }
    }
    return false;
  }

  /**
   * Check permission for an action
   * @param {string} agentName - Agent requesting the action
   * @param {string} actionType - Type of action
   * @param {object} details - Action-specific details (e.g., { path, command })
   * @returns {PermissionResult}
   */
  checkPermission(agentName, actionType, details = {}) {
    this.metrics.totalChecks++;

    // Tier 1: System Mode check
    const modeResult = this._checkMode(actionType);
    if (modeResult) {
      this._recordResult(modeResult, agentName, actionType, details);
      return modeResult;
    }

    // Tier 2: Explicit rules check (deny rules first, then allow)
    const rulesResult = this._checkRules(agentName, actionType, details);
    if (rulesResult) {
      this._recordResult(rulesResult, agentName, actionType, details);
      return rulesResult;
    }

    // Tier 3: Default based on mode
    const defaultResult = this._getDefaultDecision(agentName, actionType, details);
    this._recordResult(defaultResult, agentName, actionType, details);
    return defaultResult;
  }

  /**
   * Tier 1: Check system mode constraints
   * @returns {PermissionResult|null} Result if mode determines outcome, null to continue
   */
  _checkMode(actionType) {
    if (this.mode === PermissionMode.PLAN_ONLY) {
      // Plan-only mode: deny write operations, allow everything else
      const writeActions = [
        ActionType.FILE_WRITE, ActionType.FILE_DELETE,
        ActionType.SHELL_COMMAND, ActionType.GIT_OPERATION,
        ActionType.PROJECT_MODIFY
      ];

      if (writeActions.includes(actionType)) {
        return PermissionResult.deny('Write operations denied in plan-only mode');
      }

      // Non-write actions (EXECUTE, SKILL_EXECUTE, EXTERNAL_API) are allowed
      return PermissionResult.allow('Read/execute allowed in plan-only mode');
    }

    return null; // Mode doesn't determine outcome, continue to rules
  }

  /**
   * Tier 2: Check explicit rules
   * @returns {PermissionResult|null} Result if a rule matches, null to continue
   */
  _checkRules(agentName, actionType, details) {
    // Collect applicable rules: agent-specific + wildcard
    const agentRules = this.rules.get(agentName) || [];
    const wildcardRules = this.rules.get('*') || [];
    const allRules = [...agentRules, ...wildcardRules];

    // Filter to matching action type
    const matchingRules = allRules.filter(rule => {
      if (rule.actionType !== actionType && rule.actionType !== '*') return false;
      if (rule.pattern) {
        return this._matchPattern(rule.pattern, details);
      }
      return true;
    });

    // Deny rules take priority
    const denyRule = matchingRules.find(r => r.decision === 'deny');
    if (denyRule) {
      return PermissionResult.deny(`Denied by rule: ${denyRule.description || denyRule.id}`);
    }

    // Then allow rules
    const allowRule = matchingRules.find(r => r.decision === 'allow');
    if (allowRule) {
      return PermissionResult.allow(`Allowed by rule: ${allowRule.description || allowRule.id}`);
    }

    return null; // No matching rules, continue to default
  }

  /**
   * Pattern matching for rule details
   */
  _matchPattern(pattern, details) {
    if (!details) return false;

    // Simple string matching against detail values
    const detailString = JSON.stringify(details).toLowerCase();
    const patternLower = pattern.toLowerCase();

    // Support basic glob: * matches anything
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + patternLower.replace(/\*/g, '.*') + '$');
      return regex.test(detailString);
    }

    return detailString.includes(patternLower);
  }

  /**
   * Tier 3: Default decision based on mode
   */
  _getDefaultDecision(agentName, actionType, details) {
    switch (this.mode) {
      case PermissionMode.AUTONOMOUS:
        // In autonomous mode, no matching rule = allow
        return PermissionResult.allow('Default allow in autonomous mode');

      case PermissionMode.SUPERVISED:
        // In supervised mode, no matching rule = request approval
        return PermissionResult.requestApproval(
          `No rule found for ${agentName}:${actionType} in supervised mode`
        );

      default:
        return PermissionResult.deny('Unknown mode');
    }
  }

  /**
   * Record a permission result and publish events
   */
  _recordResult(result, agentName, actionType, details) {
    if (result.allowed) {
      this.metrics.allowed++;
    } else if (result.requiresApproval) {
      this.metrics.approvalRequests++;
    } else {
      this.metrics.denied++;
    }

    if (!this.eventBus) return;

    if (result.allowed) {
      this.eventBus.publish(PermissionEvents.PERMISSION_GRANTED, {
        agentName, actionType, details, reason: result.reason
      });
    } else if (result.requiresApproval) {
      this.eventBus.publish(PermissionEvents.PERMISSION_REQUESTED, {
        agentName, actionType, details, reason: result.reason
      });
    } else {
      this.eventBus.publish(PermissionEvents.PERMISSION_DENIED, {
        agentName, actionType, details, reason: result.reason
      });
    }
  }

  /**
   * Approve a pending permission request (called from Gru UI)
   * @param {string} requestId - The request to approve
   * @param {boolean} addRule - Whether to add a permanent allow rule
   */
  approveRequest(requestId, addRule = false) {
    const pending = this.pendingApprovals.get(requestId);
    if (!pending) {
      logger.warn(`No pending approval found: ${requestId}`);
      return false;
    }

    this.metrics.approvalGranted++;
    this.pendingApprovals.delete(requestId);

    if (addRule) {
      this.addRule(pending.context.agentName, pending.context.actionType, 'allow', {
        description: `Auto-created from approval of ${requestId}`
      });
    }

    if (pending.resolve) {
      pending.resolve(PermissionResult.allow('Approved by user'));
    }

    return true;
  }

  /**
   * Deny a pending permission request
   * @param {string} requestId - The request to deny
   * @param {boolean} addRule - Whether to add a permanent deny rule
   */
  denyRequest(requestId, addRule = false) {
    const pending = this.pendingApprovals.get(requestId);
    if (!pending) {
      logger.warn(`No pending approval found: ${requestId}`);
      return false;
    }

    this.metrics.approvalDenied++;
    this.pendingApprovals.delete(requestId);

    if (addRule) {
      this.addRule(pending.context.agentName, pending.context.actionType, 'deny', {
        description: `Auto-created from denial of ${requestId}`
      });
    }

    if (pending.resolve) {
      pending.resolve(PermissionResult.deny('Denied by user'));
    }

    return true;
  }

  /**
   * Request approval asynchronously (for supervised mode integration)
   * @returns {Promise<PermissionResult>}
   */
  requestApproval(agentName, actionType, details = {}) {
    const requestId = `approval-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

    return new Promise((resolve) => {
      this.pendingApprovals.set(requestId, {
        resolve,
        context: { agentName, actionType, details },
        createdAt: Date.now()
      });

      if (this.eventBus) {
        this.eventBus.publish(PermissionEvents.PERMISSION_REQUESTED, {
          requestId,
          agentName,
          actionType,
          details,
          timestamp: Date.now()
        });
      }

      logger.info(`Approval requested: ${requestId} for ${agentName}:${actionType}`);
    });
  }

  /**
   * Load rules from a configuration object
   * @param {object} config - { rules: [{ agent, action, decision, pattern?, description? }] }
   */
  loadRules(config) {
    if (!config || !Array.isArray(config.rules)) return;

    for (const rule of config.rules) {
      this.addRule(rule.agent || '*', rule.action, rule.decision, {
        pattern: rule.pattern,
        description: rule.description
      });
    }

    if (config.mode && Object.values(PermissionMode).includes(config.mode)) {
      this.setMode(config.mode);
    }

    logger.info(`Loaded ${config.rules.length} rules from config`);
  }

  /**
   * Get all rules for an agent
   */
  getRulesForAgent(agentName) {
    const agentRules = this.rules.get(agentName) || [];
    const wildcardRules = this.rules.get('*') || [];
    return [...agentRules, ...wildcardRules];
  }

  /**
   * Get all rules
   */
  getAllRules() {
    const allRules = [];
    for (const rules of this.rules.values()) {
      allRules.push(...rules);
    }
    return allRules;
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      mode: this.mode,
      totalRules: this.getAllRules().length,
      pendingApprovals: this.pendingApprovals.size
    };
  }

  /**
   * Reset (for testing)
   */
  reset() {
    this.mode = PermissionMode.AUTONOMOUS;
    this.rules.clear();
    this.pendingApprovals.clear();
    this.ruleIdCounter = 0;
    this.metrics = {
      totalChecks: 0,
      allowed: 0,
      denied: 0,
      approvalRequests: 0,
      approvalGranted: 0,
      approvalDenied: 0
    };
  }
}

// Singleton
let instance = null;

export function getPermissionManager() {
  if (!instance) {
    instance = new PermissionManager();
  }
  return instance;
}

export function resetPermissionManager() {
  if (instance) {
    instance.reset();
  }
  instance = null;
}

export default PermissionManager;
