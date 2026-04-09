import { jest } from '@jest/globals';
import {
  getStreamingExecutor,
  resetStreamingExecutor,
  AbortReason,
  ProgressStatus
} from '../streaming/StreamingExecutor.js';

// Mock EventBus
jest.unstable_mockModule('../event-bus/AgentEventBus.js', () => ({
  getEventBus: jest.fn(() => ({
    publish: jest.fn(),
    subscribe: jest.fn()
  }))
}));

describe('StreamingExecutor', () => {
  let se;

  beforeEach(() => {
    resetStreamingExecutor();
    se = getStreamingExecutor();
    se.initialize();
  });

  afterEach(() => {
    resetStreamingExecutor();
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      expect(getStreamingExecutor()).toBe(se);
    });

    it('should return fresh instance after reset', () => {
      resetStreamingExecutor();
      expect(getStreamingExecutor()).not.toBe(se);
    });
  });

  describe('abort controller hierarchy', () => {
    it('should create system-level controller', () => {
      const controller = se.createSystemAbort();
      expect(controller).toBeInstanceOf(AbortController);
      expect(controller.signal.aborted).toBe(false);
    });

    it('should create group-level controller', () => {
      se.createSystemAbort();
      const controller = se.createGroupAbort('group-1');
      expect(controller).toBeInstanceOf(AbortController);
    });

    it('should create agent-level controller', () => {
      se.createSystemAbort();
      se.createGroupAbort('group-1');
      const controller = se.createAgentAbort('agent-a', 'group-1');
      expect(controller).toBeInstanceOf(AbortController);
    });

    it('should cascade system abort to groups', () => {
      se.createSystemAbort();
      const groupController = se.createGroupAbort('group-1');

      se.abortSystem(AbortReason.USER_REQUESTED);

      expect(groupController.signal.aborted).toBe(true);
    });

    it('should cascade group abort to agents', () => {
      se.createSystemAbort();
      se.createGroupAbort('group-1');
      const agentController = se.createAgentAbort('agent-a', 'group-1');

      se.abortGroup('group-1', AbortReason.CRITICAL_FAILURE);

      expect(agentController.signal.aborted).toBe(true);
    });

    it('should cascade system abort through group to agents', () => {
      se.createSystemAbort();
      se.createGroupAbort('group-1');
      const agentController = se.createAgentAbort('agent-a', 'group-1');

      se.abortSystem(AbortReason.SYSTEM_SHUTDOWN);

      expect(agentController.signal.aborted).toBe(true);
    });

    it('should not cascade agent abort to siblings', () => {
      se.createSystemAbort();
      se.createGroupAbort('group-1');
      se.createAgentAbort('agent-a', 'group-1');
      const agentB = se.createAgentAbort('agent-b', 'group-1');

      se.abortAgent('agent-a', AbortReason.CRITICAL_FAILURE);

      // Agent-level abort does NOT cascade (only group abort does)
      expect(agentB.signal.aborted).toBe(false);
    });
  });

  describe('cascading group abort', () => {
    it('should abort all agents in group', () => {
      se.createSystemAbort();
      se.createGroupAbort('group-1');
      const controllerA = se.createAgentAbort('agent-a', 'group-1');
      const controllerB = se.createAgentAbort('agent-b', 'group-1');
      const controllerC = se.createAgentAbort('agent-c', 'group-1');

      se.abortGroup('group-1', AbortReason.CRITICAL_FAILURE, {
        cascade: true, sourceAgent: 'agent-a'
      });

      expect(controllerA.signal.aborted).toBe(true);
      expect(controllerB.signal.aborted).toBe(true);
      expect(controllerC.signal.aborted).toBe(true);
    });

    it('should not affect agents in other groups', () => {
      se.createSystemAbort();
      se.createGroupAbort('group-1');
      se.createGroupAbort('group-2');
      se.createAgentAbort('agent-a', 'group-1');
      const controllerB = se.createAgentAbort('agent-b', 'group-2');

      se.abortGroup('group-1', AbortReason.CRITICAL_FAILURE);

      expect(controllerB.signal.aborted).toBe(false);
    });

    it('should track cascaded abort metrics', () => {
      se.createSystemAbort();
      se.createGroupAbort('group-1');
      se.createAgentAbort('agent-a', 'group-1');
      se.createAgentAbort('agent-b', 'group-1');
      se.createAgentAbort('agent-c', 'group-1');

      se.abortGroup('group-1', AbortReason.CRITICAL_FAILURE, {
        cascade: true, sourceAgent: 'agent-a'
      });

      const metrics = se.getMetrics();
      expect(metrics.totalAborts).toBe(1); // group abort
      expect(metrics.cascadedAborts).toBe(2); // agent-b and agent-c
    });
  });

  describe('progress tracking', () => {
    it('should track agent progress', () => {
      se.createSystemAbort();
      se.createGroupAbort('g1');
      se.createAgentAbort('agent-a', 'g1');

      se.markStarted('agent-a');
      let progress = se.getProgress('agent-a');
      expect(progress.status).toBe(ProgressStatus.RUNNING);

      se.reportProgress('agent-a', { percent: 50, message: 'Halfway' });
      progress = se.getProgress('agent-a');
      expect(progress.percent).toBe(50);
      expect(progress.message).toBe('Halfway');

      se.markCompleted('agent-a');
      progress = se.getProgress('agent-a');
      expect(progress.status).toBe(ProgressStatus.COMPLETED);
      expect(progress.percent).toBe(100);
    });

    it('should clamp percent between 0 and 100', () => {
      se.createSystemAbort();
      se.createGroupAbort('g1');
      se.createAgentAbort('agent-a', 'g1');

      se.reportProgress('agent-a', { percent: 150 });
      expect(se.getProgress('agent-a').percent).toBe(100);

      se.reportProgress('agent-a', { percent: -10 });
      expect(se.getProgress('agent-a').percent).toBe(0);
    });

    it('should return all progress when no agent specified', () => {
      se.createSystemAbort();
      se.createGroupAbort('g1');
      se.createAgentAbort('a', 'g1');
      se.createAgentAbort('b', 'g1');

      se.markStarted('a');
      se.markStarted('b');

      const allProgress = se.getProgress();
      expect(Object.keys(allProgress).length).toBe(2);
    });

    it('should mark failed agents', () => {
      se.createSystemAbort();
      se.createGroupAbort('g1');
      se.createAgentAbort('agent-a', 'g1');

      se.markFailed('agent-a', new Error('Something broke'));
      const progress = se.getProgress('agent-a');
      expect(progress.status).toBe(ProgressStatus.FAILED);
      expect(progress.message).toContain('Something broke');
    });
  });

  describe('isAborted checks', () => {
    it('should return false for non-aborted agents', () => {
      se.createSystemAbort();
      se.createGroupAbort('g1');
      se.createAgentAbort('agent-a', 'g1');
      expect(se.isAborted('agent-a')).toBe(false);
    });

    it('should return true after agent abort', () => {
      se.createSystemAbort();
      se.createGroupAbort('g1');
      se.createAgentAbort('agent-a', 'g1');
      se.abortAgent('agent-a');
      expect(se.isAborted('agent-a')).toBe(true);
    });

    it('should return false for unknown agents', () => {
      expect(se.isAborted('unknown')).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should clean up group resources', () => {
      se.createSystemAbort();
      se.createGroupAbort('g1');
      se.createAgentAbort('agent-a', 'g1');

      se.cleanupGroup('g1');

      expect(se.isAborted('agent-a')).toBe(false); // controller removed
      expect(se.getProgress('agent-a')).toBeTruthy(); // progress preserved
    });

    it('should reset all state', () => {
      se.createSystemAbort();
      se.createGroupAbort('g1');
      se.createAgentAbort('a', 'g1');
      se.reportProgress('a', { percent: 50 });

      se.reset();

      expect(se.isSystemAborted()).toBe(false);
      expect(se.getProgress('a')).toBeNull();
      expect(se.getMetrics().totalAborts).toBe(0);
    });
  });
});
