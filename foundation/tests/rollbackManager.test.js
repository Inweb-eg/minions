import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import RollbackManager from '../rollback-manager/RollbackManager.js';
import fs from 'fs/promises';

describe('RollbackManager', () => {
  let manager;
  const testCheckpointsDir = './test-checkpoints';

  beforeAll(async () => {
    manager = new RollbackManager(testCheckpointsDir);
    await manager.initialize();
  });

  afterAll(async () => {
    // Cleanup test directory
    await fs.rm(testCheckpointsDir, { recursive: true, force: true });
  });

  test('should create checkpoint', async () => {
    const checkpointId = await manager.createCheckpoint('test-operation', {
      description: 'Test checkpoint'
    });

    expect(checkpointId).toBeDefined();
    expect(checkpointId).toContain('test-operation');

    const checkpoint = manager.getCheckpoint(checkpointId);
    expect(checkpoint).toBeDefined();
    expect(checkpoint.operation).toBe('test-operation');
    expect(checkpoint.status).toBe('active');
  });

  test('should commit checkpoint', async () => {
    const checkpointId = await manager.createCheckpoint('commit-test');
    await manager.commitCheckpoint(checkpointId);

    const checkpoint = manager.getCheckpoint(checkpointId);
    expect(checkpoint.status).toBe('committed');
    expect(checkpoint.commit_time).toBeDefined();
  });

  test('should list checkpoints', async () => {
    await manager.createCheckpoint('list-test-1');
    await manager.createCheckpoint('list-test-2');

    const checkpoints = manager.listCheckpoints({
      operation: 'list-test-1'
    });

    expect(checkpoints.length).toBeGreaterThan(0);
    expect(checkpoints[0].operation).toBe('list-test-1');
  });

  test('should cleanup old checkpoints', async () => {
    const checkpointId = await manager.createCheckpoint('cleanup-test');
    await manager.commitCheckpoint(checkpointId);

    // Cleanup with very short maxAge (0 = delete all committed)
    const cleaned = await manager.cleanup(0);

    expect(cleaned).toBeGreaterThanOrEqual(1);
  });

  test('should generate unique checkpoint IDs', async () => {
    const id1 = await manager.createCheckpoint('unique-test');
    const id2 = await manager.createCheckpoint('unique-test');

    expect(id1).not.toBe(id2);
  });

  test('should capture git state', async () => {
    const checkpointId = await manager.createCheckpoint('git-test');
    const checkpoint = manager.getCheckpoint(checkpointId);

    expect(checkpoint.git).toBeDefined();
    if (checkpoint.git) {
      expect(checkpoint.git.branch).toBeDefined();
      expect(checkpoint.git.commit).toBeDefined();
    }
  });

  test('should save checkpoint to disk', async () => {
    const checkpointId = await manager.createCheckpoint('save-test');

    // Check file exists
    const filePath = `${testCheckpointsDir}/${checkpointId}.json`;
    const fileExists = await fs.access(filePath).then(() => true).catch(() => false);

    expect(fileExists).toBe(true);
  });

  test('should filter checkpoints by status', async () => {
    const id1 = await manager.createCheckpoint('status-test-1');
    const id2 = await manager.createCheckpoint('status-test-2');
    await manager.commitCheckpoint(id2);

    const activeCheckpoints = manager.listCheckpoints({ status: 'active' });
    const committedCheckpoints = manager.listCheckpoints({ status: 'committed' });

    expect(activeCheckpoints.some(c => c.id === id1)).toBe(true);
    expect(committedCheckpoints.some(c => c.id === id2)).toBe(true);
  });
});
