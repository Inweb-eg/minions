import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import AgentPool, { getAgentPool } from '../../../.claude/agents/manager-agent/agent-pool.js';

describe('AgentPool', () => {
  let pool;

  beforeEach(async () => {
    pool = new AgentPool();
    await pool.initialize();
  });

  test('should initialize agent pool', () => {
    expect(pool.agents.size).toBe(0);
    expect(pool.executionHistory.length).toBe(0);
  });

  test('should register an agent', () => {
    pool.registerAgent('test-agent');

    expect(pool.agents.has('test-agent')).toBe(true);

    const agent = pool.getAgent('test-agent');
    expect(agent.name).toBe('test-agent');
    expect(agent.status).toBe('idle');
    expect(agent.totalExecutions).toBe(0);
  });

  test('should register agent with custom config', () => {
    pool.registerAgent('test-agent', {
      timeout: 60000,
      maxRetries: 5,
      cooldown: 5000
    });

    const agent = pool.getAgent('test-agent');
    expect(agent.config.timeout).toBe(60000);
    expect(agent.config.maxRetries).toBe(5);
    expect(agent.config.cooldown).toBe(5000);
  });

  test('should update agent config on re-registration', () => {
    pool.registerAgent('test-agent', { timeout: 30000 });
    pool.registerAgent('test-agent', { timeout: 60000 });

    const agent = pool.getAgent('test-agent');
    expect(agent.config.timeout).toBe(60000);
  });

  test('should execute agent successfully', async () => {
    pool.registerAgent('test-agent');

    const executorFn = jest.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { success: true };
    });

    const result = await pool.executeAgent('test-agent', executorFn);

    expect(result).toEqual({ success: true });
    expect(executorFn).toHaveBeenCalledTimes(1);

    const agent = pool.getAgent('test-agent');
    expect(agent.status).toBe('idle');
    expect(agent.successfulExecutions).toBe(1);
    expect(agent.failedExecutions).toBe(0);
    expect(agent.lastExecutionTime).toBeTruthy();
  });

  test('should handle agent execution failure', async () => {
    pool.registerAgent('test-agent', { maxRetries: 0 });

    const executorFn = jest.fn(async () => {
      throw new Error('Test error');
    });

    await expect(pool.executeAgent('test-agent', executorFn))
      .rejects.toThrow('Test error');

    const agent = pool.getAgent('test-agent');
    expect(agent.status).toBe('failed');
    expect(agent.failedExecutions).toBe(1);
    expect(agent.successfulExecutions).toBe(0);
  });

  test('should retry on failure', async () => {
    pool.registerAgent('test-agent', { maxRetries: 2, cooldown: 100 });

    let attemptCount = 0;
    const executorFn = jest.fn(async () => {
      attemptCount++;
      if (attemptCount < 3) {
        throw new Error('Retry me');
      }
      return { success: true };
    });

    const result = await pool.executeAgent('test-agent', executorFn);

    expect(result).toEqual({ success: true });
    expect(executorFn).toHaveBeenCalledTimes(3);

    const agent = pool.getAgent('test-agent');
    expect(agent.successfulExecutions).toBe(1);
    expect(agent.retryCount).toBe(0); // Reset after success
  }, 30000);

  test('should timeout long-running agent', async () => {
    pool.registerAgent('test-agent', { timeout: 500, maxRetries: 0 });

    const executorFn = jest.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return { success: true };
    });

    await expect(pool.executeAgent('test-agent', executorFn))
      .rejects.toThrow('timed out after 500ms');

    const agent = pool.getAgent('test-agent');
    expect(agent.status).toBe('failed');
  }, 10000);

  test('should enforce cooldown period', async () => {
    pool.registerAgent('test-agent', { cooldown: 1000 });

    const executorFn = jest.fn(async () => ({ success: true }));

    // First execution
    await pool.executeAgent('test-agent', executorFn);

    expect(pool.isInCooldown('test-agent')).toBe(true);

    // Second execution should fail
    const canExecute = pool.canExecute('test-agent');
    expect(canExecute.allowed).toBe(false);
    expect(canExecute.reason).toBe('cooldown');

    // Wait for cooldown
    await new Promise(resolve => setTimeout(resolve, 1100));

    expect(pool.isInCooldown('test-agent')).toBe(false);
  }, 10000);

  test('should detect already running agent', async () => {
    pool.registerAgent('test-agent');

    const executorFn = jest.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { success: true };
    });

    // Start first execution (don't await)
    const promise1 = pool.executeAgent('test-agent', executorFn);

    // Try to start second execution
    const canExecute = pool.canExecute('test-agent');
    expect(canExecute.allowed).toBe(false);
    expect(canExecute.reason).toBe('already_running');

    await promise1; // Wait for first to complete
  });

  test('should enforce rate limiting', async () => {
    pool.registerAgent('test-agent', { cooldown: 100 });
    pool.rateLimitMax = 3; // Allow only 3 executions per window

    const executorFn = jest.fn(async () => ({ success: true }));

    // Execute 3 times
    for (let i = 0; i < 3; i++) {
      await pool.executeAgent('test-agent', executorFn);
      await new Promise(resolve => setTimeout(resolve, 150)); // Wait for cooldown
    }

    // 4th execution should be rate limited
    expect(pool.isRateLimited('test-agent')).toBe(true);

    const canExecute = pool.canExecute('test-agent');
    expect(canExecute.allowed).toBe(false);
    expect(canExecute.reason).toBe('rate_limited');
  }, 15000);

  test('should detect circular updates', async () => {
    pool.registerAgent('test-agent', { cooldown: 100 });
    pool.circularUpdateThreshold = 2; // Allow only 2 executions in window
    pool.circularUpdateWindow = 10000; // 10 second window

    const executorFn = jest.fn(async () => ({ success: true }));

    // Execute 2 times
    for (let i = 0; i < 2; i++) {
      await pool.executeAgent('test-agent', executorFn);
      await new Promise(resolve => setTimeout(resolve, 150)); // Wait for cooldown
    }

    // 3rd execution should detect circular update
    expect(pool.hasCircularUpdate('test-agent')).toBe(true);

    const canExecute = pool.canExecute('test-agent');
    expect(canExecute.allowed).toBe(false);
    expect(canExecute.reason).toBe('circular_update');
  }, 15000);

  test('should track execution history', async () => {
    pool.registerAgent('test-agent');

    const executorFn = jest.fn(async () => ({ success: true }));

    await pool.executeAgent('test-agent', executorFn);

    expect(pool.executionHistory.length).toBe(1);

    const execution = pool.executionHistory[0];
    expect(execution.agent).toBe('test-agent');
    expect(execution.success).toBe(true);
    expect(execution.duration).toBeGreaterThan(0);
  });

  test('should trim execution history', async () => {
    pool.registerAgent('test-agent', { cooldown: 50 });
    pool.maxHistorySize = 10;
    pool.circularUpdateThreshold = 20; // Allow more executions for this test
    pool.rateLimitMax = 20; // Allow more executions for this test

    const executorFn = jest.fn(async () => ({ success: true }));

    // Execute 15 times
    for (let i = 0; i < 15; i++) {
      await pool.executeAgent('test-agent', executorFn);
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for cooldown
    }

    expect(pool.executionHistory.length).toBeLessThanOrEqual(10);
  }, 30000);

  test('should get agent statistics', async () => {
    pool.registerAgent('test-agent');

    const executorFn = jest.fn(async () => ({ success: true }));
    await pool.executeAgent('test-agent', executorFn);

    const stats = pool.getAgentStats('test-agent');

    expect(stats.name).toBe('test-agent');
    expect(stats.totalExecutions).toBe(1);
    expect(stats.successfulExecutions).toBe(1);
    expect(stats.failedExecutions).toBe(0);
    expect(stats.successRate).toBe('100.00%');
  });

  test('should get pool statistics', async () => {
    pool.registerAgent('agent-1');
    pool.registerAgent('agent-2');

    const stats = pool.getPoolStats();

    expect(stats.totalAgents).toBe(2);
    expect(stats.idleAgents).toBe(2);
    expect(stats.runningAgents).toBe(0);
    expect(stats.agents['agent-1']).toBeDefined();
    expect(stats.agents['agent-2']).toBeDefined();
  });

  test('should reset agent state', async () => {
    pool.registerAgent('test-agent', { maxRetries: 0, cooldown: 100 });

    const executorFn = jest.fn(async () => {
      throw new Error('Test error');
    });

    try {
      await pool.executeAgent('test-agent', executorFn);
    } catch (error) {
      // Expected to fail
    }

    const agent = pool.getAgent('test-agent');
    expect(agent.status).toBe('failed');

    pool.resetAgent('test-agent');
    expect(agent.status).toBe('idle');
    expect(agent.retryCount).toBe(0);
  }, 10000);

  test('should clear agent history', async () => {
    pool.registerAgent('agent-1');
    pool.registerAgent('agent-2');

    const executorFn = jest.fn(async () => ({ success: true }));

    await pool.executeAgent('agent-1', executorFn);
    await pool.executeAgent('agent-2', executorFn);

    expect(pool.executionHistory.length).toBe(2);

    pool.clearAgentHistory('agent-1');

    expect(pool.executionHistory.length).toBe(1);
    expect(pool.executionHistory[0].agent).toBe('agent-2');
  });

  test('should clear all history', async () => {
    pool.registerAgent('agent-1');
    pool.registerAgent('agent-2');

    const executorFn = jest.fn(async () => ({ success: true }));

    await pool.executeAgent('agent-1', executorFn);
    await pool.executeAgent('agent-2', executorFn);

    expect(pool.executionHistory.length).toBe(2);

    pool.clearAllHistory();

    expect(pool.executionHistory.length).toBe(0);
  });

  test('should unregister agent', async () => {
    pool.registerAgent('test-agent');

    const executorFn = jest.fn(async () => ({ success: true }));
    await pool.executeAgent('test-agent', executorFn);

    expect(pool.agents.has('test-agent')).toBe(true);
    expect(pool.executionHistory.length).toBe(1);

    pool.unregisterAgent('test-agent');

    expect(pool.agents.has('test-agent')).toBe(false);
    expect(pool.executionHistory.length).toBe(0); // History cleared
  });

  test('should handle unregistered agent execution', async () => {
    const executorFn = jest.fn(async () => ({ success: true }));

    await expect(pool.executeAgent('non-existent', executorFn))
      .rejects.toThrow('cannot execute: not_registered');
  });

  test('singleton should return same instance', () => {
    const pool1 = getAgentPool();
    const pool2 = getAgentPool();
    expect(pool1).toBe(pool2);
  });
});
