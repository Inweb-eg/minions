import { jest } from '@jest/globals';
import {
  getPermissionManager,
  resetPermissionManager,
  PermissionMode,
  ActionType,
  PermissionResult
} from '../permissions/PermissionManager.js';

// Mock EventBus
jest.unstable_mockModule('../event-bus/AgentEventBus.js', () => ({
  getEventBus: jest.fn(() => ({
    publish: jest.fn(),
    subscribe: jest.fn()
  }))
}));

describe('PermissionManager', () => {
  let pm;

  beforeEach(() => {
    resetPermissionManager();
    pm = getPermissionManager();
    pm.initialize();
  });

  afterEach(() => {
    resetPermissionManager();
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      const pm2 = getPermissionManager();
      expect(pm).toBe(pm2);
    });

    it('should return fresh instance after reset', () => {
      resetPermissionManager();
      const pm2 = getPermissionManager();
      expect(pm).not.toBe(pm2);
    });
  });

  describe('mode management', () => {
    it('should default to autonomous mode', () => {
      expect(pm.getMode()).toBe(PermissionMode.AUTONOMOUS);
    });

    it('should change mode', () => {
      pm.setMode(PermissionMode.SUPERVISED);
      expect(pm.getMode()).toBe(PermissionMode.SUPERVISED);
    });

    it('should reject invalid modes', () => {
      expect(() => pm.setMode('invalid')).toThrow('Invalid permission mode');
    });
  });

  describe('rule management', () => {
    it('should add and retrieve rules', () => {
      const ruleId = pm.addRule('test-agent', ActionType.EXECUTE, 'allow');
      expect(ruleId).toBeTruthy();

      const rules = pm.getRulesForAgent('test-agent');
      expect(rules.length).toBe(1);
      expect(rules[0].decision).toBe('allow');
    });

    it('should remove rules', () => {
      const ruleId = pm.addRule('test-agent', ActionType.EXECUTE, 'allow');
      expect(pm.removeRule(ruleId)).toBe(true);
      expect(pm.getRulesForAgent('test-agent').length).toBe(0);
    });

    it('should return false for non-existent rule removal', () => {
      expect(pm.removeRule('non-existent')).toBe(false);
    });

    it('should support wildcard agent rules', () => {
      pm.addRule('*', ActionType.FILE_WRITE, 'deny');
      const rules = pm.getRulesForAgent('any-agent');
      expect(rules.length).toBe(1);
      expect(rules[0].decision).toBe('deny');
    });

    it('should load rules from config', () => {
      pm.loadRules({
        mode: PermissionMode.SUPERVISED,
        rules: [
          { agent: 'agent-a', action: ActionType.EXECUTE, decision: 'allow' },
          { agent: '*', action: ActionType.SHELL_COMMAND, decision: 'deny' }
        ]
      });

      expect(pm.getMode()).toBe(PermissionMode.SUPERVISED);
      expect(pm.getAllRules().length).toBe(2);
    });
  });

  describe('permission checking - autonomous mode', () => {
    it('should allow by default in autonomous mode', () => {
      const result = pm.checkPermission('test-agent', ActionType.EXECUTE);
      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('autonomous');
    });

    it('should deny when explicit deny rule exists', () => {
      pm.addRule('test-agent', ActionType.SHELL_COMMAND, 'deny');
      const result = pm.checkPermission('test-agent', ActionType.SHELL_COMMAND);
      expect(result.allowed).toBe(false);
    });

    it('should allow when explicit allow rule exists', () => {
      pm.addRule('test-agent', ActionType.FILE_WRITE, 'allow');
      const result = pm.checkPermission('test-agent', ActionType.FILE_WRITE);
      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('rule');
    });

    it('should prioritize deny over allow rules', () => {
      pm.addRule('test-agent', ActionType.EXECUTE, 'allow');
      pm.addRule('test-agent', ActionType.EXECUTE, 'deny');
      const result = pm.checkPermission('test-agent', ActionType.EXECUTE);
      expect(result.allowed).toBe(false);
    });
  });

  describe('permission checking - supervised mode', () => {
    beforeEach(() => {
      pm.setMode(PermissionMode.SUPERVISED);
    });

    it('should request approval when no rules match', () => {
      const result = pm.checkPermission('test-agent', ActionType.EXECUTE);
      expect(result.allowed).toBe(false);
      expect(result.requiresApproval).toBe(true);
    });

    it('should still allow when explicit allow rule exists', () => {
      pm.addRule('test-agent', ActionType.EXECUTE, 'allow');
      const result = pm.checkPermission('test-agent', ActionType.EXECUTE);
      expect(result.allowed).toBe(true);
    });
  });

  describe('permission checking - plan-only mode', () => {
    beforeEach(() => {
      pm.setMode(PermissionMode.PLAN_ONLY);
    });

    it('should deny write operations', () => {
      const result = pm.checkPermission('test-agent', ActionType.FILE_WRITE);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('plan-only');
    });

    it('should deny shell commands', () => {
      const result = pm.checkPermission('test-agent', ActionType.SHELL_COMMAND);
      expect(result.allowed).toBe(false);
    });

    it('should deny git operations', () => {
      const result = pm.checkPermission('test-agent', ActionType.GIT_OPERATION);
      expect(result.allowed).toBe(false);
    });

    it('should allow execute actions (agents can still run)', () => {
      const result = pm.checkPermission('test-agent', ActionType.EXECUTE);
      expect(result.allowed).toBe(true);
    });
  });

  describe('pattern matching', () => {
    it('should match pattern in details', () => {
      pm.addRule('test-agent', ActionType.FILE_WRITE, 'deny', {
        pattern: '*.env*'
      });

      const result = pm.checkPermission('test-agent', ActionType.FILE_WRITE, {
        path: '/project/.env.local'
      });
      expect(result.allowed).toBe(false);
    });

    it('should allow when pattern does not match', () => {
      pm.addRule('test-agent', ActionType.FILE_WRITE, 'deny', {
        pattern: '*.env*'
      });

      const result = pm.checkPermission('test-agent', ActionType.FILE_WRITE, {
        path: '/project/src/index.js'
      });
      // No matching deny rule, falls through to autonomous default
      expect(result.allowed).toBe(true);
    });
  });

  describe('approval workflow', () => {
    it('should handle approval requests', () => {
      const promise = pm.requestApproval('test-agent', ActionType.EXECUTE);
      expect(pm.pendingApprovals.size).toBe(1);

      // Get the request ID
      const requestId = Array.from(pm.pendingApprovals.keys())[0];
      pm.approveRequest(requestId);

      return promise.then(result => {
        expect(result.allowed).toBe(true);
      });
    });

    it('should handle denial requests', () => {
      const promise = pm.requestApproval('test-agent', ActionType.EXECUTE);
      const requestId = Array.from(pm.pendingApprovals.keys())[0];
      pm.denyRequest(requestId);

      return promise.then(result => {
        expect(result.allowed).toBe(false);
      });
    });

    it('should auto-create rules on approval with addRule flag', () => {
      const promise = pm.requestApproval('test-agent', ActionType.EXECUTE);
      const requestId = Array.from(pm.pendingApprovals.keys())[0];
      pm.approveRequest(requestId, true); // addRule = true

      return promise.then(() => {
        const rules = pm.getRulesForAgent('test-agent');
        expect(rules.some(r => r.decision === 'allow')).toBe(true);
      });
    });
  });

  describe('metrics', () => {
    it('should track permission checks', () => {
      pm.checkPermission('a', ActionType.EXECUTE);
      pm.checkPermission('b', ActionType.EXECUTE);
      pm.addRule('c', ActionType.EXECUTE, 'deny');
      pm.checkPermission('c', ActionType.EXECUTE);

      const metrics = pm.getMetrics();
      expect(metrics.totalChecks).toBe(3);
      expect(metrics.allowed).toBe(2);
      expect(metrics.denied).toBe(1);
    });
  });
});
