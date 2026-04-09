import { jest } from '@jest/globals';
import {
  getErrorRecoveryPipeline,
  resetErrorRecoveryPipeline,
  RecoveryStage,
  CRITICAL_STRATEGY
} from '../recovery/ErrorRecoveryPipeline.js';

// Mock EventBus
jest.unstable_mockModule('../event-bus/AgentEventBus.js', () => ({
  getEventBus: jest.fn(() => ({
    publish: jest.fn(),
    subscribe: jest.fn()
  }))
}));

describe('ErrorRecoveryPipeline', () => {
  let pipeline;

  beforeEach(() => {
    resetErrorRecoveryPipeline();
    pipeline = getErrorRecoveryPipeline();
    pipeline.initialize();
  });

  afterEach(() => {
    resetErrorRecoveryPipeline();
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      expect(getErrorRecoveryPipeline()).toBe(pipeline);
    });

    it('should return fresh instance after reset', () => {
      resetErrorRecoveryPipeline();
      expect(getErrorRecoveryPipeline()).not.toBe(pipeline);
    });
  });

  describe('strategy management', () => {
    it('should return default strategy for unknown agents', () => {
      const strategy = pipeline.getStrategy('unknown-agent');
      expect(strategy.maxRetries).toBe(2);
      expect(strategy.skipable).toBe(true);
    });

    it('should return custom strategy when set', () => {
      pipeline.setStrategy('critical-agent', CRITICAL_STRATEGY);
      const strategy = pipeline.getStrategy('critical-agent');
      expect(strategy.skipable).toBe(false);
      expect(strategy.maxRetries).toBe(1);
    });

    it('should merge custom strategy with defaults', () => {
      pipeline.setStrategy('agent-a', { maxRetries: 5 });
      const strategy = pipeline.getStrategy('agent-a');
      expect(strategy.maxRetries).toBe(5);
      expect(strategy.skipable).toBe(true); // From default
    });
  });

  describe('recovery - retry with backoff', () => {
    it('should recover on successful retry', async () => {
      let attempts = 0;
      const result = await pipeline.recover('agent-a', new Error('Transient error'), {
        retryFn: async () => {
          attempts++;
          if (attempts < 2) throw new Error('Still failing');
          // Success on second attempt
        }
      });

      expect(result.recovered).toBe(true);
      expect(result.stage).toBe(RecoveryStage.RETRY_WITH_BACKOFF);
      expect(result.action).toBe('retried');
    }, 15000);

    it('should exhaust retries and escalate', async () => {
      pipeline.setStrategy('agent-a', {
        maxRetries: 1,
        backoffBase: 10, // Fast for testing
        stages: [RecoveryStage.RETRY_WITH_BACKOFF, RecoveryStage.SKIP_AND_CONTINUE]
      });

      const result = await pipeline.recover('agent-a', new Error('Persistent error'), {
        retryFn: async () => { throw new Error('Still failing'); }
      });

      expect(result.recovered).toBe(true);
      expect(result.stage).toBe(RecoveryStage.SKIP_AND_CONTINUE);
      expect(result.action).toBe('skipped');
    }, 15000);

    it('should not retry without retryFn', async () => {
      pipeline.setStrategy('agent-a', {
        stages: [RecoveryStage.RETRY_WITH_BACKOFF, RecoveryStage.SKIP_AND_CONTINUE]
      });

      const result = await pipeline.recover('agent-a', new Error('Error'), {});

      // Should skip retry (no retryFn) and fall through to skip
      expect(result.recovered).toBe(true);
      expect(result.stage).toBe(RecoveryStage.SKIP_AND_CONTINUE);
    });
  });

  describe('recovery - rollback checkpoint', () => {
    it('should rollback and retry successfully', async () => {
      const mockRollbackManager = {
        getCheckpoint: jest.fn(() => ({ status: 'active' })),
        rollback: jest.fn()
      };

      pipeline.rollbackManager = mockRollbackManager;
      pipeline.setStrategy('agent-a', {
        stages: [RecoveryStage.ROLLBACK_CHECKPOINT],
        backoffBase: 10
      });

      let retried = false;
      const result = await pipeline.recover('agent-a', new Error('Error'), {
        checkpointId: 'cp-123',
        retryFn: async () => { retried = true; }
      });

      expect(result.recovered).toBe(true);
      expect(result.stage).toBe(RecoveryStage.ROLLBACK_CHECKPOINT);
      expect(mockRollbackManager.rollback).toHaveBeenCalledWith('cp-123', expect.any(String));
      expect(retried).toBe(true);
    });

    it('should fail without checkpoint', async () => {
      pipeline.setStrategy('agent-a', {
        stages: [RecoveryStage.ROLLBACK_CHECKPOINT]
      });

      const result = await pipeline.recover('agent-a', new Error('Error'), {});
      expect(result.recovered).toBe(false);
    });
  });

  describe('recovery - skip and continue', () => {
    it('should skip when agent is skipable', async () => {
      pipeline.setStrategy('agent-a', {
        stages: [RecoveryStage.SKIP_AND_CONTINUE],
        skipable: true
      });

      const result = await pipeline.recover('agent-a', new Error('Error'), {});
      expect(result.recovered).toBe(true);
      expect(result.action).toBe('skipped');
    });

    it('should not skip when agent is not skipable', async () => {
      pipeline.setStrategy('agent-a', {
        stages: [RecoveryStage.SKIP_AND_CONTINUE],
        skipable: false
      });

      const result = await pipeline.recover('agent-a', new Error('Error'), {});
      expect(result.recovered).toBe(false);
    });
  });

  describe('recovery - abort group', () => {
    it('should abort group when streaming executor available', async () => {
      const mockStreamingExecutor = {
        abortGroup: jest.fn(),
        abortSystem: jest.fn()
      };

      pipeline.streamingExecutor = mockStreamingExecutor;
      pipeline.setStrategy('agent-a', {
        stages: [RecoveryStage.ABORT_GROUP]
      });

      const result = await pipeline.recover('agent-a', new Error('Fatal'), {
        groupId: 'group-1'
      });

      expect(result.recovered).toBe(true);
      expect(result.action).toBe('group_aborted');
      expect(mockStreamingExecutor.abortGroup).toHaveBeenCalledWith(
        'group-1', expect.any(String), expect.objectContaining({ sourceAgent: 'agent-a' })
      );
    });

    it('should fail without groupId', async () => {
      const mockStreamingExecutor = { abortGroup: jest.fn() };
      pipeline.streamingExecutor = mockStreamingExecutor;
      pipeline.setStrategy('agent-a', {
        stages: [RecoveryStage.ABORT_GROUP]
      });

      const result = await pipeline.recover('agent-a', new Error('Fatal'), {});
      expect(result.recovered).toBe(false);
    });
  });

  describe('recovery - abort execution', () => {
    it('should abort entire system', async () => {
      const mockStreamingExecutor = { abortSystem: jest.fn() };
      pipeline.streamingExecutor = mockStreamingExecutor;
      pipeline.setStrategy('agent-a', {
        stages: [RecoveryStage.ABORT_EXECUTION]
      });

      const result = await pipeline.recover('agent-a', new Error('Fatal'), {});
      expect(result.recovered).toBe(true);
      expect(result.action).toBe('execution_aborted');
      expect(mockStreamingExecutor.abortSystem).toHaveBeenCalled();
    });
  });

  describe('recovery - stage escalation', () => {
    it('should walk through stages until one succeeds', async () => {
      pipeline.setStrategy('agent-a', {
        maxRetries: 1,
        backoffBase: 10,
        stages: [
          RecoveryStage.RETRY_WITH_BACKOFF,
          RecoveryStage.SKIP_AND_CONTINUE
        ],
        skipable: true
      });

      const result = await pipeline.recover('agent-a', new Error('Error'), {
        retryFn: async () => { throw new Error('Still failing'); }
      });

      expect(result.recovered).toBe(true);
      expect(result.stage).toBe(RecoveryStage.SKIP_AND_CONTINUE);

      const metrics = pipeline.getMetrics();
      expect(metrics.stageAttempts[RecoveryStage.RETRY_WITH_BACKOFF]).toBe(1);
      expect(metrics.stageAttempts[RecoveryStage.SKIP_AND_CONTINUE]).toBe(1);
    }, 15000);

    it('should report failure when all stages exhausted', async () => {
      pipeline.setStrategy('agent-a', {
        maxRetries: 1,
        backoffBase: 10,
        stages: [RecoveryStage.RETRY_WITH_BACKOFF],
        skipable: false
      });

      const result = await pipeline.recover('agent-a', new Error('Error'), {
        retryFn: async () => { throw new Error('Nope'); }
      });

      expect(result.recovered).toBe(false);
      expect(result.action).toBe('exhausted');
    }, 15000);
  });

  describe('metrics', () => {
    it('should track recovery attempts', async () => {
      pipeline.setStrategy('agent-a', {
        stages: [RecoveryStage.SKIP_AND_CONTINUE],
        skipable: true
      });

      await pipeline.recover('agent-a', new Error('Error'), {});
      await pipeline.recover('agent-a', new Error('Error 2'), {});

      const metrics = pipeline.getMetrics();
      expect(metrics.totalRecoveries).toBe(2);
      expect(metrics.successfulRecoveries).toBe(2);
    });
  });

  describe('circuit breaker integration', () => {
    it('should skip retries when circuit breaker is open', async () => {
      const mockRegistry = {
        get: jest.fn(() => ({
          canExecute: () => false // Circuit is open
        }))
      };

      pipeline.circuitBreakerRegistry = mockRegistry;
      pipeline.setStrategy('agent-a', {
        stages: [RecoveryStage.RETRY_WITH_BACKOFF, RecoveryStage.SKIP_AND_CONTINUE],
        skipable: true
      });

      const result = await pipeline.recover('agent-a', new Error('Error'), {
        retryFn: async () => { throw new Error('Still failing'); }
      });

      // Should skip retry (circuit open) and fall through to skip
      expect(result.recovered).toBe(true);
      expect(result.stage).toBe(RecoveryStage.SKIP_AND_CONTINUE);
    });
  });
});
