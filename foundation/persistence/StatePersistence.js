/**
 * StatePersistence
 * ----------------
 * Automatic state persistence with snapshots, versioning, and recovery.
 * Wraps MemoryStore for enhanced persistence features.
 *
 * @author Kareem Hussein
 * @company Inweb Software Solutions
 */

import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { createLogger } from '../common/logger.js';
import { getEventBus } from '../event-bus/AgentEventBus.js';
import { InfrastructureEvents } from '../event-bus/eventTypes.js';
import { getMemoryStore, MemoryNamespace } from '../memory-store/MemoryStore.js';

const logger = createLogger('StatePersistence');

/**
 * Persistence states
 */
export const PersistenceState = {
  IDLE: 'idle',
  PERSISTING: 'persisting',
  RESTORING: 'restoring',
  ERROR: 'error'
};

/**
 * StatePersistence class
 */
export class StatePersistence extends EventEmitter {
  constructor(options = {}) {
    super();

    this.snapshotDir = options.snapshotDir || './data/snapshots';
    this.autoSaveInterval = options.autoSaveInterval || 60000; // 1 minute
    this.maxSnapshots = options.maxSnapshots || 10;
    this.enableAutoSave = options.enableAutoSave !== false;

    this.state = PersistenceState.IDLE;
    this.memoryStore = null;
    this.eventBus = null;
    this.autoSaveTimer = null;
    this.dirtyKeys = new Set();
    this.lastSaveTime = null;
    this.initialized = false;

    // Track registered state handlers
    this.stateHandlers = new Map(); // name -> { save, restore }

    // Metrics
    this.metrics = {
      totalSaves: 0,
      totalRestores: 0,
      snapshotsCreated: 0,
      snapshotsRestored: 0,
      errors: 0,
      lastSaveDuration: 0
    };
  }

  /**
   * Initialize the persistence system
   */
  async initialize() {
    if (this.initialized) return;

    try {
      this.eventBus = getEventBus();
    } catch (e) {
      logger.warn('EventBus not available');
    }

    this.memoryStore = getMemoryStore();
    await this.memoryStore.initialize();

    // Ensure snapshot directory exists
    if (!fs.existsSync(this.snapshotDir)) {
      fs.mkdirSync(this.snapshotDir, { recursive: true });
    }

    // Start auto-save if enabled
    if (this.enableAutoSave) {
      this.startAutoSave();
    }

    // Handle process signals for graceful shutdown
    this.setupShutdownHandlers();

    this.initialized = true;
    logger.info('StatePersistence initialized', {
      snapshotDir: this.snapshotDir,
      autoSaveInterval: this.autoSaveInterval,
      enableAutoSave: this.enableAutoSave
    });
  }

  /**
   * Register a state handler for a component
   * @param {string} name - Component name
   * @param {object} handler - Handler with save and restore functions
   */
  registerStateHandler(name, handler) {
    if (!handler.save || !handler.restore) {
      throw new Error('State handler must have save and restore functions');
    }

    this.stateHandlers.set(name, handler);
    logger.debug(`Registered state handler: ${name}`);
  }

  /**
   * Unregister a state handler
   * @param {string} name - Component name
   */
  unregisterStateHandler(name) {
    this.stateHandlers.delete(name);
    logger.debug(`Unregistered state handler: ${name}`);
  }

  /**
   * Mark a key as dirty (needs saving)
   * @param {string} namespace - Namespace
   * @param {string} key - Key that changed
   */
  markDirty(namespace, key) {
    this.dirtyKeys.add(`${namespace}:${key}`);
  }

  /**
   * Save state for a specific namespace and key
   * @param {string} namespace - Namespace
   * @param {string} key - Key
   * @param {any} value - Value to save
   * @param {object} options - Save options
   */
  async saveState(namespace, key, value, options = {}) {
    this.state = PersistenceState.PERSISTING;
    const startTime = Date.now();

    try {
      await this.memoryStore.set(namespace, key, value, options);
      this.dirtyKeys.delete(`${namespace}:${key}`);

      this.metrics.totalSaves++;
      this.metrics.lastSaveDuration = Date.now() - startTime;
      this.lastSaveTime = Date.now();

      this.publishEvent(InfrastructureEvents.STATE_PERSISTED, {
        namespace,
        key,
        duration: this.metrics.lastSaveDuration
      });

      logger.debug(`State saved: ${namespace}:${key}`);
    } catch (error) {
      this.state = PersistenceState.ERROR;
      this.metrics.errors++;
      logger.error(`Failed to save state: ${namespace}:${key}`, { error: error.message });
      throw error;
    } finally {
      this.state = PersistenceState.IDLE;
    }
  }

  /**
   * Restore state for a specific namespace and key
   * @param {string} namespace - Namespace
   * @param {string} key - Key
   * @returns {any} Restored value or null
   */
  async restoreState(namespace, key) {
    this.state = PersistenceState.RESTORING;

    try {
      const value = await this.memoryStore.get(namespace, key);

      if (value !== null) {
        this.metrics.totalRestores++;
        this.publishEvent(InfrastructureEvents.STATE_RESTORED, {
          namespace,
          key
        });
        logger.debug(`State restored: ${namespace}:${key}`);
      }

      return value;
    } catch (error) {
      this.state = PersistenceState.ERROR;
      this.metrics.errors++;
      logger.error(`Failed to restore state: ${namespace}:${key}`, { error: error.message });
      throw error;
    } finally {
      this.state = PersistenceState.IDLE;
    }
  }

  /**
   * Save all dirty state
   */
  async saveAllDirty() {
    if (this.dirtyKeys.size === 0) return;

    logger.debug(`Saving ${this.dirtyKeys.size} dirty keys`);

    // Call all registered state handlers
    for (const [name, handler] of this.stateHandlers) {
      try {
        const state = await handler.save();
        if (state !== undefined) {
          await this.saveState(MemoryNamespace.AGENT_STATE, name, state);
        }
      } catch (error) {
        logger.error(`Failed to save state for handler: ${name}`, { error: error.message });
      }
    }

    this.dirtyKeys.clear();
  }

  /**
   * Restore all state for registered handlers
   */
  async restoreAll() {
    logger.info('Restoring all state from handlers');

    for (const [name, handler] of this.stateHandlers) {
      try {
        const state = await this.restoreState(MemoryNamespace.AGENT_STATE, name);
        if (state !== null) {
          await handler.restore(state);
          logger.debug(`Restored state for handler: ${name}`);
        }
      } catch (error) {
        logger.error(`Failed to restore state for handler: ${name}`, { error: error.message });
      }
    }
  }

  /**
   * Create a snapshot of current state
   * @param {string} name - Snapshot name (optional)
   * @returns {string} Snapshot filename
   */
  async createSnapshot(name = null) {
    const timestamp = Date.now();
    const snapshotName = name || `snapshot-${timestamp}`;
    const filename = `${snapshotName}.json`;
    const filepath = path.join(this.snapshotDir, filename);

    this.state = PersistenceState.PERSISTING;

    try {
      // Collect all state
      const snapshot = {
        name: snapshotName,
        timestamp,
        version: '1.0.0',
        state: {}
      };

      // Get state from all handlers
      for (const [handlerName, handler] of this.stateHandlers) {
        try {
          snapshot.state[handlerName] = await handler.save();
        } catch (error) {
          logger.warn(`Failed to get state from handler ${handlerName} for snapshot`);
        }
      }

      // Get state from memory store namespaces
      for (const namespace of Object.values(MemoryNamespace)) {
        const data = await this.memoryStore.getAll(namespace);
        if (Object.keys(data).length > 0) {
          snapshot.state[`_namespace:${namespace}`] = data;
        }
      }

      // Write snapshot file
      fs.writeFileSync(filepath, JSON.stringify(snapshot, null, 2));

      this.metrics.snapshotsCreated++;
      logger.info(`Snapshot created: ${filename}`);

      // Cleanup old snapshots
      await this.cleanupOldSnapshots();

      return filename;
    } catch (error) {
      this.state = PersistenceState.ERROR;
      this.metrics.errors++;
      logger.error('Failed to create snapshot', { error: error.message });
      throw error;
    } finally {
      this.state = PersistenceState.IDLE;
    }
  }

  /**
   * Restore from a snapshot
   * @param {string} filename - Snapshot filename
   */
  async restoreFromSnapshot(filename) {
    const filepath = path.join(this.snapshotDir, filename);

    if (!fs.existsSync(filepath)) {
      throw new Error(`Snapshot not found: ${filename}`);
    }

    this.state = PersistenceState.RESTORING;

    try {
      const snapshot = JSON.parse(fs.readFileSync(filepath, 'utf8'));

      logger.info(`Restoring from snapshot: ${filename}`, {
        name: snapshot.name,
        timestamp: snapshot.timestamp
      });

      // Restore handler states
      for (const [handlerName, handler] of this.stateHandlers) {
        if (snapshot.state[handlerName]) {
          try {
            await handler.restore(snapshot.state[handlerName]);
            logger.debug(`Restored handler state: ${handlerName}`);
          } catch (error) {
            logger.error(`Failed to restore handler state: ${handlerName}`, { error: error.message });
          }
        }
      }

      // Restore namespace states
      for (const [key, data] of Object.entries(snapshot.state)) {
        if (key.startsWith('_namespace:')) {
          const namespace = key.replace('_namespace:', '');
          for (const [itemKey, value] of Object.entries(data)) {
            await this.memoryStore.set(namespace, itemKey, value);
          }
          logger.debug(`Restored namespace: ${namespace}`);
        }
      }

      this.metrics.snapshotsRestored++;
      this.publishEvent(InfrastructureEvents.STATE_RESTORED, {
        source: 'snapshot',
        filename,
        timestamp: snapshot.timestamp
      });

      logger.info(`Snapshot restored successfully: ${filename}`);
    } catch (error) {
      this.state = PersistenceState.ERROR;
      this.metrics.errors++;

      this.publishEvent(InfrastructureEvents.STATE_CORRUPTED, {
        source: 'snapshot',
        filename,
        error: error.message
      });

      logger.error('Failed to restore from snapshot', { error: error.message });
      throw error;
    } finally {
      this.state = PersistenceState.IDLE;
    }
  }

  /**
   * List available snapshots
   * @returns {object[]} Array of snapshot info
   */
  listSnapshots() {
    if (!fs.existsSync(this.snapshotDir)) {
      return [];
    }

    const files = fs.readdirSync(this.snapshotDir)
      .filter(f => f.endsWith('.json'))
      .map(filename => {
        const filepath = path.join(this.snapshotDir, filename);
        const stat = fs.statSync(filepath);

        try {
          const content = JSON.parse(fs.readFileSync(filepath, 'utf8'));
          return {
            filename,
            name: content.name,
            timestamp: content.timestamp,
            size: stat.size,
            createdAt: stat.birthtime
          };
        } catch (e) {
          return {
            filename,
            name: filename.replace('.json', ''),
            timestamp: stat.mtimeMs,
            size: stat.size,
            createdAt: stat.birthtime,
            corrupted: true
          };
        }
      })
      .sort((a, b) => b.timestamp - a.timestamp);

    return files;
  }

  /**
   * Delete a snapshot
   * @param {string} filename - Snapshot filename
   */
  deleteSnapshot(filename) {
    const filepath = path.join(this.snapshotDir, filename);

    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      logger.info(`Snapshot deleted: ${filename}`);
    }
  }

  /**
   * Cleanup old snapshots beyond maxSnapshots
   */
  async cleanupOldSnapshots() {
    const snapshots = this.listSnapshots();

    if (snapshots.length > this.maxSnapshots) {
      const toDelete = snapshots.slice(this.maxSnapshots);
      for (const snapshot of toDelete) {
        this.deleteSnapshot(snapshot.filename);
      }
      logger.debug(`Cleaned up ${toDelete.length} old snapshots`);
    }
  }

  /**
   * Start auto-save timer
   */
  startAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    this.autoSaveTimer = setInterval(async () => {
      try {
        await this.saveAllDirty();
      } catch (error) {
        logger.error('Auto-save failed', { error: error.message });
      }
    }, this.autoSaveInterval);

    logger.debug(`Auto-save started (interval: ${this.autoSaveInterval}ms)`);
  }

  /**
   * Stop auto-save timer
   */
  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
      logger.debug('Auto-save stopped');
    }
  }

  /**
   * Setup shutdown handlers for graceful state saving
   */
  setupShutdownHandlers() {
    const gracefulShutdown = async (signal) => {
      logger.info(`Received ${signal}, saving state before shutdown...`);

      try {
        await this.saveAllDirty();
        await this.createSnapshot('shutdown');
        logger.info('State saved successfully before shutdown');
      } catch (error) {
        logger.error('Failed to save state on shutdown', { error: error.message });
      }
    };

    // Don't add handlers if we're in a test environment
    if (process.env.NODE_ENV !== 'test') {
      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
      process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    }
  }

  /**
   * Publish event to event bus
   */
  publishEvent(eventType, data) {
    if (this.eventBus) {
      this.eventBus.publish(eventType, {
        ...data,
        timestamp: Date.now()
      });
    }
    this.emit(eventType, data);
  }

  /**
   * Get current status
   * @returns {object} Status object
   */
  getStatus() {
    return {
      state: this.state,
      initialized: this.initialized,
      enableAutoSave: this.enableAutoSave,
      dirtyKeys: this.dirtyKeys.size,
      registeredHandlers: this.stateHandlers.size,
      lastSaveTime: this.lastSaveTime,
      snapshotCount: this.listSnapshots().length
    };
  }

  /**
   * Get metrics
   * @returns {object} Metrics object
   */
  getMetrics() {
    return {
      ...this.metrics,
      state: this.state,
      dirtyKeys: this.dirtyKeys.size,
      handlers: Array.from(this.stateHandlers.keys())
    };
  }

  /**
   * Shutdown the persistence system
   */
  async shutdown() {
    this.stopAutoSave();

    // Final save
    try {
      await this.saveAllDirty();
    } catch (error) {
      logger.error('Failed to save on shutdown', { error: error.message });
    }

    this.stateHandlers.clear();
    this.dirtyKeys.clear();
    this.initialized = false;

    logger.info('StatePersistence shutdown complete');
  }
}

// Singleton instance
let instance = null;

/**
 * Get the StatePersistence singleton
 * @param {object} options - Configuration options
 * @returns {StatePersistence}
 */
export function getStatePersistence(options = {}) {
  if (!instance) {
    instance = new StatePersistence(options);
  }
  return instance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetStatePersistence() {
  if (instance) {
    instance.shutdown();
  }
  instance = null;
}

export default StatePersistence;
