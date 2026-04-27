import { jest } from '@jest/globals';
import {
  getHookManager,
  resetHookManager,
  HookPoint,
  HookAction,
  HookResult,
  FailBehavior
} from '../hooks/HookManager.js';

// Mock EventBus
jest.unstable_mockModule('../event-bus/AgentEventBus.js', () => ({
  getEventBus: jest.fn(() => ({
    publish: jest.fn(),
    subscribe: jest.fn()
  }))
}));

describe('HookManager', () => {
  let hm;

  beforeEach(() => {
    resetHookManager();
    hm = getHookManager();
    hm.initialize();
  });

  afterEach(() => {
    resetHookManager();
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      expect(getHookManager()).toBe(hm);
    });

    it('should return fresh instance after reset', () => {
      resetHookManager();
      expect(getHookManager()).not.toBe(hm);
    });
  });

  describe('registration', () => {
    it('should register a hook', () => {
      hm.register(HookPoint.PRE_AGENT_EXECUTION, async () => ({ action: HookAction.ALLOW }), {
        name: 'test-hook'
      });

      const hooks = hm.getRegistered(HookPoint.PRE_AGENT_EXECUTION);
      expect(hooks.length).toBe(1);
      expect(hooks[0].name).toBe('test-hook');
    });

    it('should reject invalid hook points', () => {
      expect(() => hm.register('invalid', async () => ({}))).toThrow('Invalid hook point');
    });

    it('should reject non-function handlers', () => {
      expect(() => hm.register(HookPoint.PRE_AGENT_EXECUTION, 'not-a-function')).toThrow('must be a function');
    });

    it('should return unregister function', () => {
      const unregister = hm.register(HookPoint.PRE_AGENT_EXECUTION, async () => ({ action: HookAction.ALLOW }));
      expect(hm.getRegistered(HookPoint.PRE_AGENT_EXECUTION).length).toBe(1);

      unregister();
      expect(hm.getRegistered(HookPoint.PRE_AGENT_EXECUTION).length).toBe(0);
    });

    it('should sort hooks by priority', () => {
      hm.register(HookPoint.PRE_AGENT_EXECUTION, async () => ({}), { name: 'low', priority: 90 });
      hm.register(HookPoint.PRE_AGENT_EXECUTION, async () => ({}), { name: 'high', priority: 10 });
      hm.register(HookPoint.PRE_AGENT_EXECUTION, async () => ({}), { name: 'mid', priority: 50 });

      const hooks = hm.getRegistered(HookPoint.PRE_AGENT_EXECUTION);
      expect(hooks[0].name).toBe('high');
      expect(hooks[1].name).toBe('mid');
      expect(hooks[2].name).toBe('low');
    });
  });

  describe('execution - allow', () => {
    it('should return allow when no hooks registered', async () => {
      const result = await hm.execute(HookPoint.PRE_AGENT_EXECUTION, { agentName: 'test' });
      expect(result.allowed).toBe(true);
    });

    it('should return allow when all hooks allow', async () => {
      hm.register(HookPoint.PRE_AGENT_EXECUTION, async () => ({ action: HookAction.ALLOW }));
      hm.register(HookPoint.PRE_AGENT_EXECUTION, async () => ({ action: HookAction.ALLOW }));

      const result = await hm.execute(HookPoint.PRE_AGENT_EXECUTION, { agentName: 'test' });
      expect(result.allowed).toBe(true);
    });

    it('should treat no return as implicit allow', async () => {
      hm.register(HookPoint.PRE_AGENT_EXECUTION, async () => {});

      const result = await hm.execute(HookPoint.PRE_AGENT_EXECUTION, { agentName: 'test' });
      expect(result.allowed).toBe(true);
    });
  });

  describe('execution - deny', () => {
    it('should return deny when a hook denies', async () => {
      hm.register(HookPoint.PRE_AGENT_EXECUTION, async () => ({
        action: HookAction.DENY, reason: 'Not allowed'
      }));

      const result = await hm.execute(HookPoint.PRE_AGENT_EXECUTION, { agentName: 'test' });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Not allowed');
    });

    it('should stop executing hooks after a deny', async () => {
      let secondCalled = false;

      hm.register(HookPoint.PRE_AGENT_EXECUTION, async () => ({
        action: HookAction.DENY, reason: 'blocked'
      }), { priority: 10 });

      hm.register(HookPoint.PRE_AGENT_EXECUTION, async () => {
        secondCalled = true;
        return { action: HookAction.ALLOW };
      }, { priority: 20 });

      await hm.execute(HookPoint.PRE_AGENT_EXECUTION, { agentName: 'test' });
      expect(secondCalled).toBe(false);
    });
  });

  describe('execution - modify', () => {
    it('should modify context data', async () => {
      hm.register(HookPoint.PRE_AGENT_EXECUTION, async (context) => ({
        action: HookAction.MODIFY,
        data: { extra: 'injected' }
      }), { priority: 10 });

      let receivedContext;
      hm.register(HookPoint.PRE_AGENT_EXECUTION, async (context) => {
        receivedContext = context;
        return { action: HookAction.ALLOW };
      }, { priority: 20 });

      const result = await hm.execute(HookPoint.PRE_AGENT_EXECUTION, { agentName: 'test' });
      expect(result.allowed).toBe(true);
      expect(result.data.extra).toBe('injected');
      expect(receivedContext.extra).toBe('injected');
    });
  });

  describe('execution - agent filter', () => {
    it('should only run hooks matching agent filter', async () => {
      let called = false;
      hm.register(HookPoint.PRE_AGENT_EXECUTION, async () => {
        called = true;
        return { action: HookAction.DENY, reason: 'blocked' };
      }, { agentFilter: 'specific-agent' });

      const result = await hm.execute(HookPoint.PRE_AGENT_EXECUTION, { agentName: 'other-agent' });
      expect(result.allowed).toBe(true);
      expect(called).toBe(false);
    });

    it('should run hooks when agent matches filter', async () => {
      hm.register(HookPoint.PRE_AGENT_EXECUTION, async () => ({
        action: HookAction.DENY, reason: 'blocked'
      }), { agentFilter: 'target-agent' });

      const result = await hm.execute(HookPoint.PRE_AGENT_EXECUTION, { agentName: 'target-agent' });
      expect(result.allowed).toBe(false);
    });

    it('should support array of agent filters', async () => {
      hm.register(HookPoint.PRE_AGENT_EXECUTION, async () => ({
        action: HookAction.DENY, reason: 'blocked'
      }), { agentFilter: ['agent-a', 'agent-b'] });

      const resultA = await hm.execute(HookPoint.PRE_AGENT_EXECUTION, { agentName: 'agent-a' });
      expect(resultA.allowed).toBe(false);

      const resultC = await hm.execute(HookPoint.PRE_AGENT_EXECUTION, { agentName: 'agent-c' });
      expect(resultC.allowed).toBe(true);
    });
  });

  describe('execution - error handling', () => {
    it('should treat hook errors as allow by default', async () => {
      hm.register(HookPoint.PRE_AGENT_EXECUTION, async () => {
        throw new Error('Hook crashed');
      });

      const result = await hm.execute(HookPoint.PRE_AGENT_EXECUTION, { agentName: 'test' });
      expect(result.allowed).toBe(true);
    });

    it('should treat hook errors as deny in strict mode', async () => {
      hm.register(HookPoint.PRE_AGENT_EXECUTION, async () => {
        throw new Error('Hook crashed');
      }, { failBehavior: FailBehavior.DENY });

      const result = await hm.execute(HookPoint.PRE_AGENT_EXECUTION, { agentName: 'test' });
      expect(result.allowed).toBe(false);
    });
  });

  describe('metrics', () => {
    it('should track execution metrics', async () => {
      hm.register(HookPoint.PRE_AGENT_EXECUTION, async () => ({ action: HookAction.ALLOW }));
      hm.register(HookPoint.POST_AGENT_EXECUTION, async () => ({
        action: HookAction.DENY, reason: 'test'
      }));

      await hm.execute(HookPoint.PRE_AGENT_EXECUTION, {});
      await hm.execute(HookPoint.POST_AGENT_EXECUTION, {});

      const metrics = hm.getMetrics();
      expect(metrics.totalExecutions).toBe(2);
      expect(metrics.allows).toBe(1);
      expect(metrics.denies).toBe(1);
    });
  });
});
