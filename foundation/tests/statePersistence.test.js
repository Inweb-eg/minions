/**
 * StatePersistence Tests
 * ======================
 * Tests for the state persistence system
 */

import { jest } from '@jest/globals';

// Mock EventBus
const mockEventBus = {
  subscribe: jest.fn(),
  publish: jest.fn(),
  unsubscribe: jest.fn()
};

jest.unstable_mockModule('../event-bus/AgentEventBus.js', () => ({
  getEventBus: jest.fn(() => mockEventBus),
  AgentEventBus: jest.fn()
}));

// Mock MemoryStore
const mockMemoryStoreData = new Map();
const mockMemoryStore = {
  initialize: jest.fn().mockResolvedValue(undefined),
  get: jest.fn((ns, key) => Promise.resolve(mockMemoryStoreData.get(`${ns}:${key}`) || null)),
  set: jest.fn((ns, key, value) => {
    mockMemoryStoreData.set(`${ns}:${key}`, value);
    return Promise.resolve();
  }),
  getAll: jest.fn((ns) => {
    const result = {};
    for (const [k, v] of mockMemoryStoreData) {
      if (k.startsWith(`${ns}:`)) {
        result[k.replace(`${ns}:`, '')] = v;
      }
    }
    return Promise.resolve(result);
  }),
  delete: jest.fn()
};

jest.unstable_mockModule('../memory-store/MemoryStore.js', () => ({
  getMemoryStore: jest.fn(() => mockMemoryStore),
  MemoryStore: jest.fn(),
  MemoryNamespace: {
    AGENT_STATE: 'agent_state',
    CACHE: 'cache',
    CONVERSATION: 'conversation',
    METRICS: 'metrics',
    CONFIG: 'config'
  }
}));

// Mock fs
const mockFsData = new Map();
const mockFsExistsSync = jest.fn((p) => mockFsData.has(p) || p.endsWith('snapshots'));
const mockFsMkdirSync = jest.fn();
const mockFsWriteFileSync = jest.fn((p, data) => mockFsData.set(p, data));
const mockFsReadFileSync = jest.fn((p) => {
  if (mockFsData.has(p)) return mockFsData.get(p);
  throw new Error('File not found');
});
const mockFsReaddirSync = jest.fn(() => []);
const mockFsStatSync = jest.fn(() => ({
  size: 1024,
  birthtime: new Date(),
  mtimeMs: Date.now()
}));
const mockFsUnlinkSync = jest.fn((p) => mockFsData.delete(p));

jest.unstable_mockModule('fs', () => ({
  default: {
    existsSync: mockFsExistsSync,
    mkdirSync: mockFsMkdirSync,
    writeFileSync: mockFsWriteFileSync,
    readFileSync: mockFsReadFileSync,
    readdirSync: mockFsReaddirSync,
    statSync: mockFsStatSync,
    unlinkSync: mockFsUnlinkSync
  },
  existsSync: mockFsExistsSync,
  mkdirSync: mockFsMkdirSync,
  writeFileSync: mockFsWriteFileSync,
  readFileSync: mockFsReadFileSync,
  readdirSync: mockFsReaddirSync,
  statSync: mockFsStatSync,
  unlinkSync: mockFsUnlinkSync
}));

const {
  StatePersistence,
  PersistenceState,
  getStatePersistence,
  resetStatePersistence
} = await import('../persistence/StatePersistence.js');

describe('StatePersistence', () => {
  let persistence;

  beforeEach(() => {
    // Clear mocks
    mockMemoryStoreData.clear();
    mockFsData.clear();
    mockEventBus.publish.mockClear();
    mockFsReaddirSync.mockReturnValue([]);
    mockFsExistsSync.mockImplementation((p) => mockFsData.has(p) || p.endsWith('snapshots'));

    // Reset singleton
    resetStatePersistence();

    persistence = new StatePersistence({
      snapshotDir: './test-snapshots',
      autoSaveInterval: 1000,
      enableAutoSave: false,
      maxSnapshots: 5
    });
  });

  afterEach(async () => {
    if (persistence.autoSaveTimer) {
      clearInterval(persistence.autoSaveTimer);
    }
    resetStatePersistence();
  });

  describe('Initialization', () => {
    test('creates with default options', () => {
      const defaultPersistence = new StatePersistence();

      expect(defaultPersistence.snapshotDir).toBe('./data/snapshots');
      expect(defaultPersistence.autoSaveInterval).toBe(60000);
      expect(defaultPersistence.maxSnapshots).toBe(10);
      expect(defaultPersistence.enableAutoSave).toBe(true);
    });

    test('creates with custom options', () => {
      expect(persistence.snapshotDir).toBe('./test-snapshots');
      expect(persistence.autoSaveInterval).toBe(1000);
      expect(persistence.maxSnapshots).toBe(5);
      expect(persistence.enableAutoSave).toBe(false);
    });

    test('initializes in IDLE state', () => {
      expect(persistence.state).toBe(PersistenceState.IDLE);
      expect(persistence.initialized).toBe(false);
    });

    test('initialize sets up system', async () => {
      await persistence.initialize();

      expect(persistence.initialized).toBe(true);
      expect(mockMemoryStore.initialize).toHaveBeenCalled();
    });

    test('initialize creates snapshot directory', async () => {
      mockFsExistsSync.mockReturnValue(false);

      await persistence.initialize();

      expect(mockFsMkdirSync).toHaveBeenCalledWith('./test-snapshots', { recursive: true });
    });

    test('initialize is idempotent', async () => {
      // Clear mock to count calls only from this test
      mockMemoryStore.initialize.mockClear();

      await persistence.initialize();
      await persistence.initialize();

      // Should only call initialize once (idempotent)
      expect(mockMemoryStore.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('State Handlers', () => {
    beforeEach(async () => {
      await persistence.initialize();
    });

    test('registerStateHandler adds handler', () => {
      const handler = {
        save: jest.fn(),
        restore: jest.fn()
      };

      persistence.registerStateHandler('test-component', handler);

      expect(persistence.stateHandlers.size).toBe(1);
      expect(persistence.stateHandlers.has('test-component')).toBe(true);
    });

    test('registerStateHandler throws without save function', () => {
      expect(() => persistence.registerStateHandler('test', { restore: jest.fn() }))
        .toThrow('State handler must have save and restore functions');
    });

    test('registerStateHandler throws without restore function', () => {
      expect(() => persistence.registerStateHandler('test', { save: jest.fn() }))
        .toThrow('State handler must have save and restore functions');
    });

    test('unregisterStateHandler removes handler', () => {
      persistence.registerStateHandler('test', {
        save: jest.fn(),
        restore: jest.fn()
      });

      persistence.unregisterStateHandler('test');

      expect(persistence.stateHandlers.has('test')).toBe(false);
    });
  });

  describe('State Operations', () => {
    beforeEach(async () => {
      await persistence.initialize();
    });

    test('saveState stores value in memory store', async () => {
      await persistence.saveState('test-ns', 'test-key', { data: 'value' });

      expect(mockMemoryStore.set).toHaveBeenCalledWith(
        'test-ns',
        'test-key',
        { data: 'value' },
        {}
      );
    });

    test('saveState updates metrics', async () => {
      await persistence.saveState('ns', 'key', 'value');

      expect(persistence.metrics.totalSaves).toBe(1);
      expect(persistence.metrics.lastSaveDuration).toBeGreaterThanOrEqual(0);
    });

    test('saveState publishes event', async () => {
      await persistence.saveState('ns', 'key', 'value');

      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    test('saveState clears dirty key', async () => {
      persistence.markDirty('ns', 'key');
      expect(persistence.dirtyKeys.has('ns:key')).toBe(true);

      await persistence.saveState('ns', 'key', 'value');

      expect(persistence.dirtyKeys.has('ns:key')).toBe(false);
    });

    test('restoreState retrieves value', async () => {
      mockMemoryStoreData.set('ns:key', 'stored-value');

      const value = await persistence.restoreState('ns', 'key');

      expect(value).toBe('stored-value');
      expect(persistence.metrics.totalRestores).toBe(1);
    });

    test('restoreState returns null for missing key', async () => {
      const value = await persistence.restoreState('ns', 'missing');

      expect(value).toBeNull();
    });

    test('markDirty tracks dirty keys', () => {
      persistence.markDirty('ns1', 'key1');
      persistence.markDirty('ns2', 'key2');

      expect(persistence.dirtyKeys.size).toBe(2);
      expect(persistence.dirtyKeys.has('ns1:key1')).toBe(true);
      expect(persistence.dirtyKeys.has('ns2:key2')).toBe(true);
    });
  });

  describe('Batch Operations', () => {
    beforeEach(async () => {
      await persistence.initialize();
    });

    test('saveAllDirty saves state from all handlers', async () => {
      const handler1 = {
        save: jest.fn().mockResolvedValue({ data: 1 }),
        restore: jest.fn()
      };
      const handler2 = {
        save: jest.fn().mockResolvedValue({ data: 2 }),
        restore: jest.fn()
      };

      persistence.registerStateHandler('handler1', handler1);
      persistence.registerStateHandler('handler2', handler2);
      persistence.markDirty('ns', 'key'); // Need a dirty key to trigger

      await persistence.saveAllDirty();

      expect(handler1.save).toHaveBeenCalled();
      expect(handler2.save).toHaveBeenCalled();
    });

    test('saveAllDirty clears dirty keys', async () => {
      persistence.markDirty('ns', 'key1');
      persistence.markDirty('ns', 'key2');

      await persistence.saveAllDirty();

      expect(persistence.dirtyKeys.size).toBe(0);
    });

    test('saveAllDirty skips if no dirty keys', async () => {
      const handler = {
        save: jest.fn(),
        restore: jest.fn()
      };
      persistence.registerStateHandler('handler', handler);

      await persistence.saveAllDirty();

      expect(handler.save).not.toHaveBeenCalled();
    });

    test('restoreAll restores state for all handlers', async () => {
      mockMemoryStoreData.set('agent_state:handler1', { restored: true });

      const handler1 = {
        save: jest.fn(),
        restore: jest.fn()
      };
      persistence.registerStateHandler('handler1', handler1);

      await persistence.restoreAll();

      expect(handler1.restore).toHaveBeenCalledWith({ restored: true });
    });
  });

  describe('Snapshots', () => {
    beforeEach(async () => {
      await persistence.initialize();
    });

    test('createSnapshot creates snapshot file', async () => {
      const filename = await persistence.createSnapshot('test-snapshot');

      expect(filename).toBe('test-snapshot.json');
      expect(mockFsWriteFileSync).toHaveBeenCalled();
    });

    test('createSnapshot includes handler state', async () => {
      // Clear any previous write calls
      mockFsWriteFileSync.mockClear();

      const handler = {
        save: jest.fn().mockResolvedValue({ key: 'value' }),
        restore: jest.fn()
      };
      persistence.registerStateHandler('myHandler', handler);

      await persistence.createSnapshot('test-snap');

      expect(handler.save).toHaveBeenCalled();

      // Find the snapshot write call
      const writeCall = mockFsWriteFileSync.mock.calls.find(
        call => call[0].includes('test-snap')
      );
      expect(writeCall).toBeDefined();

      const writtenData = JSON.parse(writeCall[1]);
      expect(writtenData.state.myHandler).toEqual({ key: 'value' });
    });

    test('createSnapshot updates metrics', async () => {
      await persistence.createSnapshot();

      expect(persistence.metrics.snapshotsCreated).toBe(1);
    });

    test('restoreFromSnapshot restores state', async () => {
      // Create mock snapshot file
      const snapshotData = JSON.stringify({
        name: 'test',
        timestamp: Date.now(),
        state: {
          myHandler: { data: 'restored' }
        }
      });

      // Set up specific mock for this test
      mockFsExistsSync.mockReturnValue(true);
      mockFsReadFileSync.mockReturnValue(snapshotData);

      const handler = {
        save: jest.fn(),
        restore: jest.fn()
      };
      persistence.registerStateHandler('myHandler', handler);

      await persistence.restoreFromSnapshot('test.json');

      expect(handler.restore).toHaveBeenCalledWith({ data: 'restored' });
      expect(persistence.metrics.snapshotsRestored).toBe(1);
    });

    test('restoreFromSnapshot throws for missing file', async () => {
      // Ensure the file does NOT exist
      mockFsExistsSync.mockReturnValue(false);

      await expect(persistence.restoreFromSnapshot('missing.json'))
        .rejects.toThrow('Snapshot not found');
    });

    test('restoreFromSnapshot handles corrupted file', async () => {
      // Create fresh persistence for isolated test
      const corruptPersistence = new StatePersistence({
        snapshotDir: './corrupt-test',
        enableAutoSave: false
      });
      await corruptPersistence.initialize();

      mockFsExistsSync.mockReturnValue(true);
      mockFsReadFileSync.mockImplementation(() => 'invalid json');

      try {
        await corruptPersistence.restoreFromSnapshot('corrupt.json');
      } catch (e) {
        // Expected to throw
      }

      expect(corruptPersistence.metrics.errors).toBeGreaterThanOrEqual(1);
    });

    test('listSnapshots returns snapshot info', () => {
      mockFsReaddirSync.mockReturnValue(['snap1.json', 'snap2.json']);
      const now = Date.now();
      mockFsReadFileSync.mockImplementation((path) => {
        if (path.includes('snap1')) {
          return JSON.stringify({ name: 'snap1', timestamp: now });
        }
        return JSON.stringify({ name: 'snap2', timestamp: now - 1000 });
      });

      const snapshots = persistence.listSnapshots();

      expect(snapshots.length).toBe(2);
      // Sorted by timestamp descending, so snap1 (higher timestamp) first
      expect(snapshots[0].filename).toBe('snap1.json');
    });

    test('listSnapshots handles missing directory', () => {
      mockFsExistsSync.mockReturnValue(false);

      const snapshots = persistence.listSnapshots();

      expect(snapshots).toEqual([]);
    });

    test('deleteSnapshot removes file', () => {
      mockFsExistsSync.mockReturnValue(true);

      persistence.deleteSnapshot('test.json');

      expect(mockFsUnlinkSync).toHaveBeenCalled();
    });

    test('cleanupOldSnapshots removes excess snapshots', async () => {
      mockFsReaddirSync.mockReturnValue([
        'snap1.json', 'snap2.json', 'snap3.json',
        'snap4.json', 'snap5.json', 'snap6.json'
      ]);
      mockFsReadFileSync.mockImplementation((path) => {
        const match = path.match(/snap(\d)/);
        const num = match ? parseInt(match[1]) : 0;
        return JSON.stringify({
          name: `snap${num}`,
          timestamp: Date.now() - num * 1000
        });
      });
      mockFsExistsSync.mockReturnValue(true);

      await persistence.cleanupOldSnapshots();

      // Should delete 1 snapshot (6 - 5 = 1)
      expect(mockFsUnlinkSync).toHaveBeenCalled();
    });
  });

  describe('Auto-Save', () => {
    beforeEach(async () => {
      await persistence.initialize();
    });

    test('startAutoSave starts timer', () => {
      persistence.startAutoSave();

      expect(persistence.autoSaveTimer).toBeDefined();
    });

    test('stopAutoSave clears timer', () => {
      persistence.startAutoSave();
      persistence.stopAutoSave();

      expect(persistence.autoSaveTimer).toBeNull();
    });

    test('auto-save enabled starts timer on init', async () => {
      const autoSavePersistence = new StatePersistence({
        enableAutoSave: true,
        autoSaveInterval: 10000
      });

      await autoSavePersistence.initialize();

      expect(autoSavePersistence.autoSaveTimer).toBeDefined();

      // Cleanup
      autoSavePersistence.stopAutoSave();
    });
  });

  describe('Status and Metrics', () => {
    beforeEach(async () => {
      await persistence.initialize();
    });

    test('getStatus returns current status', () => {
      persistence.markDirty('ns', 'key');
      persistence.registerStateHandler('handler', {
        save: jest.fn(),
        restore: jest.fn()
      });

      const status = persistence.getStatus();

      expect(status.state).toBe(PersistenceState.IDLE);
      expect(status.initialized).toBe(true);
      expect(status.dirtyKeys).toBe(1);
      expect(status.registeredHandlers).toBe(1);
    });

    test('getMetrics returns metrics', async () => {
      await persistence.saveState('ns', 'key', 'value');

      const metrics = persistence.getMetrics();

      expect(metrics.totalSaves).toBe(1);
      expect(metrics.handlers).toBeDefined();
    });
  });

  describe('Event Emission', () => {
    beforeEach(async () => {
      await persistence.initialize();
    });

    test('emits events on state changes', async () => {
      const eventHandler = jest.fn();
      // The actual event name from InfrastructureEvents
      persistence.on('infra:state:persisted', eventHandler);

      await persistence.saveState('ns', 'key', 'value');

      expect(eventHandler).toHaveBeenCalled();
    });

    test('publishes to event bus', async () => {
      mockEventBus.publish.mockClear();

      await persistence.saveState('ns', 'key', 'value');

      expect(mockEventBus.publish).toHaveBeenCalled();
    });
  });

  describe('Shutdown', () => {
    beforeEach(async () => {
      await persistence.initialize();
    });

    test('shutdown stops auto-save', async () => {
      persistence.startAutoSave();

      await persistence.shutdown();

      expect(persistence.autoSaveTimer).toBeNull();
    });

    test('shutdown clears state', async () => {
      persistence.registerStateHandler('handler', {
        save: jest.fn(),
        restore: jest.fn()
      });
      persistence.markDirty('ns', 'key');

      await persistence.shutdown();

      expect(persistence.stateHandlers.size).toBe(0);
      expect(persistence.dirtyKeys.size).toBe(0);
      expect(persistence.initialized).toBe(false);
    });
  });

  describe('State Transitions', () => {
    beforeEach(async () => {
      await persistence.initialize();
    });

    test('transitions to PERSISTING during save', async () => {
      let capturedState = null;

      // Create one-time capture
      const originalSet = mockMemoryStore.set.getMockImplementation();
      mockMemoryStore.set.mockImplementationOnce(async (ns, key, value, opts) => {
        capturedState = persistence.state;
        mockMemoryStoreData.set(`${ns}:${key}`, value);
        return Promise.resolve();
      });

      await persistence.saveState('ns', 'key', 'value');

      expect(capturedState).toBe(PersistenceState.PERSISTING);
      expect(persistence.state).toBe(PersistenceState.IDLE);
    });

    test('transitions to RESTORING during restore', async () => {
      mockMemoryStoreData.set('ns:key', 'value');

      let capturedState = null;
      mockMemoryStore.get.mockImplementationOnce(async (ns, key) => {
        capturedState = persistence.state;
        return mockMemoryStoreData.get(`${ns}:${key}`) || null;
      });

      await persistence.restoreState('ns', 'key');

      expect(capturedState).toBe(PersistenceState.RESTORING);
      expect(persistence.state).toBe(PersistenceState.IDLE);
    });

    test('transitions to ERROR on failure', async () => {
      mockMemoryStore.set.mockRejectedValueOnce(new Error('Save failed'));

      await expect(persistence.saveState('ns', 'key', 'value')).rejects.toThrow();

      expect(persistence.metrics.errors).toBe(1);
    });
  });
});

describe('Singleton Functions', () => {
  beforeEach(() => {
    resetStatePersistence();
  });

  afterEach(() => {
    resetStatePersistence();
  });

  test('getStatePersistence returns singleton', () => {
    const p1 = getStatePersistence();
    const p2 = getStatePersistence();

    expect(p1).toBe(p2);
  });

  test('getStatePersistence accepts options on first call', () => {
    const p = getStatePersistence({ maxSnapshots: 20 });

    expect(p.maxSnapshots).toBe(20);
  });

  test('resetStatePersistence clears singleton', async () => {
    const p1 = getStatePersistence();
    await p1.initialize();

    resetStatePersistence();

    const p2 = getStatePersistence();
    expect(p1).not.toBe(p2);
  });
});

describe('PersistenceState Enum', () => {
  test('has all states', () => {
    expect(PersistenceState.IDLE).toBe('idle');
    expect(PersistenceState.PERSISTING).toBe('persisting');
    expect(PersistenceState.RESTORING).toBe('restoring');
    expect(PersistenceState.ERROR).toBe('error');
  });
});
