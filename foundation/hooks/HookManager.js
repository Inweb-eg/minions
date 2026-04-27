/**
 * HookManager
 * -----------
 * Structured hook system for intercepting, modifying, or denying operations.
 * Inspired by Claude Code's PreToolUse/PostToolUse pattern.
 *
 * Hook points are well-defined moments in the execution lifecycle.
 * Hooks execute in priority order and can allow, deny, or modify the operation context.
 */

import { createLogger } from '../common/logger.js';
import { getEventBus } from '../event-bus/AgentEventBus.js';

export const HookEvents = {
  HOOK_REGISTERED: 'hook:registered',
  HOOK_UNREGISTERED: 'hook:unregistered',
  HOOK_EXECUTED: 'hook:executed',
  HOOK_DENIED: 'hook:denied',
  HOOK_ERROR: 'hook:error'
};

const logger = createLogger('HookManager');

/**
 * Well-defined hook points in the execution lifecycle
 */
export const HookPoint = {
  PRE_AGENT_EXECUTION: 'pre:agent:execution',
  POST_AGENT_EXECUTION: 'post:agent:execution',
  PRE_SKILL_EXECUTION: 'pre:skill:execution',
  POST_SKILL_EXECUTION: 'post:skill:execution',
  PRE_PROJECT_MODIFICATION: 'pre:project:modification',
  POST_PROJECT_MODIFICATION: 'post:project:modification',
  PRE_SYSTEM_EXECUTION: 'pre:system:execution',
  POST_SYSTEM_EXECUTION: 'post:system:execution'
};

/**
 * Hook execution result actions
 */
export const HookAction = {
  ALLOW: 'allow',
  DENY: 'deny',
  MODIFY: 'modify'
};

/**
 * What happens when a hook throws an error
 */
export const FailBehavior = {
  ALLOW: 'allow',   // Error = treat as allow (default, non-blocking)
  DENY: 'deny'      // Error = treat as deny (strict mode)
};

/**
 * Result of executing all hooks at a hook point
 */
export class HookResult {
  constructor(action, data = null, reason = '', hookName = '') {
    this.action = action;
    this.data = data;
    this.reason = reason;
    this.hookName = hookName;
    this.timestamp = Date.now();
  }

  static allow(data = null) {
    return new HookResult(HookAction.ALLOW, data);
  }

  static deny(reason, hookName = '') {
    return new HookResult(HookAction.DENY, null, reason, hookName);
  }

  static modify(data, hookName = '') {
    return new HookResult(HookAction.MODIFY, data, 'Modified by hook', hookName);
  }

  get allowed() {
    return this.action !== HookAction.DENY;
  }
}

class HookManager {
  constructor() {
    this.hooks = new Map(); // Map<HookPoint, HookEntry[]> sorted by priority
    this.eventBus = null;
    this.hookIdCounter = 0;

    // Metrics
    this.metrics = {
      totalExecutions: 0,
      allows: 0,
      denies: 0,
      modifications: 0,
      errors: 0
    };
  }

  /**
   * Initialize the hook manager
   */
  initialize() {
    try {
      this.eventBus = getEventBus();
    } catch (e) {
      logger.warn('EventBus not available for HookManager');
    }

    logger.info('HookManager initialized');
  }

  /**
   * Register a hook at a specific hook point
   * @param {string} hookPoint - One of HookPoint values
   * @param {Function} handler - async (context) => { action, data?, reason? }
   * @param {object} options - { name, priority (0-100, lower=first), agentFilter, failBehavior }
   * @returns {Function} Unregister function
   */
  register(hookPoint, handler, options = {}) {
    if (!Object.values(HookPoint).includes(hookPoint)) {
      throw new Error(`Invalid hook point: ${hookPoint}. Valid: ${Object.values(HookPoint).join(', ')}`);
    }

    if (typeof handler !== 'function') {
      throw new Error('Hook handler must be a function');
    }

    const hookId = `hook-${++this.hookIdCounter}`;
    const entry = {
      id: hookId,
      name: options.name || hookId,
      priority: options.priority ?? 50,  // Default middle priority
      handler,
      agentFilter: options.agentFilter || null,  // string or string[] to filter by agent name
      failBehavior: options.failBehavior || FailBehavior.ALLOW,
      createdAt: Date.now()
    };

    if (!this.hooks.has(hookPoint)) {
      this.hooks.set(hookPoint, []);
    }

    const hooks = this.hooks.get(hookPoint);
    hooks.push(entry);
    // Keep sorted by priority (lower number = higher priority = runs first)
    hooks.sort((a, b) => a.priority - b.priority);

    if (this.eventBus) {
      this.eventBus.publish(HookEvents.HOOK_REGISTERED, {
        hookId, hookPoint, name: entry.name, priority: entry.priority
      });
    }

    logger.info(`Hook registered: ${entry.name} at ${hookPoint} (priority: ${entry.priority})`);

    // Return unregister function
    return () => this.unregister(hookId);
  }

  /**
   * Unregister a hook by ID
   * @param {string} hookId
   * @returns {boolean}
   */
  unregister(hookId) {
    for (const [point, hooks] of this.hooks.entries()) {
      const index = hooks.findIndex(h => h.id === hookId);
      if (index !== -1) {
        const removed = hooks.splice(index, 1)[0];
        if (hooks.length === 0) {
          this.hooks.delete(point);
        }
        if (this.eventBus) {
          this.eventBus.publish(HookEvents.HOOK_UNREGISTERED, {
            hookId, hookPoint: point, name: removed.name
          });
        }
        logger.info(`Hook unregistered: ${removed.name} (${hookId})`);
        return true;
      }
    }
    return false;
  }

  /**
   * Execute all hooks at a hook point
   * @param {string} hookPoint - The hook point to execute
   * @param {object} context - Context passed to each hook (e.g., { agentName, actionType, ... })
   * @returns {Promise<HookResult>} Aggregated result
   */
  async execute(hookPoint, context = {}) {
    this.metrics.totalExecutions++;

    const hooks = this.hooks.get(hookPoint) || [];
    if (hooks.length === 0) {
      return HookResult.allow(context);
    }

    // Filter hooks by agent if context has agentName
    const applicableHooks = hooks.filter(hook => {
      if (!hook.agentFilter) return true;
      if (!context.agentName) return true;

      const filters = Array.isArray(hook.agentFilter) ? hook.agentFilter : [hook.agentFilter];
      return filters.includes(context.agentName) || filters.includes('*');
    });

    if (applicableHooks.length === 0) {
      return HookResult.allow(context);
    }

    let currentData = { ...context };

    for (const hook of applicableHooks) {
      try {
        const result = await hook.handler(currentData);

        if (!result || !result.action) {
          // No result = implicit allow
          continue;
        }

        if (result.action === HookAction.DENY) {
          this.metrics.denies++;
          const hookResult = HookResult.deny(
            result.reason || `Denied by hook: ${hook.name}`,
            hook.name
          );

          if (this.eventBus) {
            this.eventBus.publish(HookEvents.HOOK_DENIED, {
              hookPoint, hookName: hook.name, reason: hookResult.reason, context: currentData
            });
          }

          logger.info(`Hook denied: ${hook.name} at ${hookPoint}`);
          return hookResult;
        }

        if (result.action === HookAction.MODIFY && result.data) {
          this.metrics.modifications++;
          currentData = { ...currentData, ...result.data };
          logger.debug(`Hook modified context: ${hook.name} at ${hookPoint}`);
        }

        // HookAction.ALLOW or no action = continue to next hook

      } catch (error) {
        this.metrics.errors++;
        logger.error(`Hook error: ${hook.name} at ${hookPoint}:`, error);

        if (this.eventBus) {
          this.eventBus.publish(HookEvents.HOOK_ERROR, {
            hookPoint, hookName: hook.name, error: error.message
          });
        }

        // Check fail behavior
        if (hook.failBehavior === FailBehavior.DENY) {
          this.metrics.denies++;
          return HookResult.deny(`Hook error (strict mode): ${hook.name} - ${error.message}`, hook.name);
        }
        // FailBehavior.ALLOW: continue to next hook
      }
    }

    // All hooks passed
    this.metrics.allows++;

    if (this.eventBus) {
      this.eventBus.publish(HookEvents.HOOK_EXECUTED, {
        hookPoint, hooksRun: applicableHooks.length, result: 'allow'
      });
    }

    // Return allow with potentially modified data
    return HookResult.allow(currentData);
  }

  /**
   * Get registered hooks for a hook point
   * @param {string} hookPoint - Optional, if omitted returns all hooks
   * @returns {object[]}
   */
  getRegistered(hookPoint) {
    if (hookPoint) {
      return (this.hooks.get(hookPoint) || []).map(h => ({
        id: h.id, name: h.name, priority: h.priority,
        agentFilter: h.agentFilter, failBehavior: h.failBehavior
      }));
    }

    const all = {};
    for (const [point, hooks] of this.hooks.entries()) {
      all[point] = hooks.map(h => ({
        id: h.id, name: h.name, priority: h.priority,
        agentFilter: h.agentFilter, failBehavior: h.failBehavior
      }));
    }
    return all;
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      registeredHooks: this._countHooks()
    };
  }

  /**
   * Count total registered hooks
   */
  _countHooks() {
    let count = 0;
    for (const hooks of this.hooks.values()) {
      count += hooks.length;
    }
    return count;
  }

  /**
   * Reset (for testing)
   */
  reset() {
    this.hooks.clear();
    this.hookIdCounter = 0;
    this.metrics = {
      totalExecutions: 0,
      allows: 0,
      denies: 0,
      modifications: 0,
      errors: 0
    };
  }
}

// Singleton
let instance = null;

export function getHookManager() {
  if (!instance) {
    instance = new HookManager();
  }
  return instance;
}

export function resetHookManager() {
  if (instance) {
    instance.reset();
  }
  instance = null;
}

/**
 * Wire PermissionManager as a built-in hook on the HookManager.
 * Call this after both are initialized.
 * @param {HookManager} hookManager
 * @param {PermissionManager} permissionManager
 */
export function installPermissionHooks(hookManager, permissionManager) {
  // High priority (10) so permissions are checked before other hooks
  hookManager.register(HookPoint.PRE_AGENT_EXECUTION, async (context) => {
    const result = permissionManager.checkPermission(
      context.agentName,
      'execute',
      context
    );
    if (result.allowed) {
      return { action: HookAction.ALLOW };
    }
    return { action: HookAction.DENY, reason: result.reason };
  }, { name: 'permission-check', priority: 10 });

  hookManager.register(HookPoint.PRE_PROJECT_MODIFICATION, async (context) => {
    const result = permissionManager.checkPermission(
      context.agentName || '*',
      'project:modify',
      context
    );
    if (result.allowed) {
      return { action: HookAction.ALLOW };
    }
    return { action: HookAction.DENY, reason: result.reason };
  }, { name: 'permission-check-project', priority: 10 });

  hookManager.register(HookPoint.PRE_SKILL_EXECUTION, async (context) => {
    const result = permissionManager.checkPermission(
      context.agentName || '*',
      'skill:execute',
      context
    );
    if (result.allowed) {
      return { action: HookAction.ALLOW };
    }
    return { action: HookAction.DENY, reason: result.reason };
  }, { name: 'permission-check-skill', priority: 10 });

  logger.info('Permission hooks installed on HookManager');
}

export default HookManager;
