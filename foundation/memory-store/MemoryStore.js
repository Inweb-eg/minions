import { createLogger } from '../common/logger.js';
import fs from 'fs';
import path from 'path';

const logger = createLogger('MemoryStore');

/**
 * Namespace constants for organizing memory
 */
export const MemoryNamespace = {
  PROJECT_STATE: 'project_state',
  AGENT_STATE: 'agent_state',
  DECISIONS: 'decisions',
  KNOWLEDGE_BASE: 'knowledge_base',
  PATTERNS: 'patterns',
  EXECUTION_HISTORY: 'execution_history',
  CONFIG: 'config'
};

/**
 * Persistent Memory Store for the Minions system
 * Provides key-value storage with SQLite backend for agent memory persistence
 * Enables agents to remember context across sessions and learn from past decisions
 */
class MemoryStore {
  constructor(options = {}) {
    this.dbPath = options.dbPath || './data/minions-memory.db';
    this.db = null;
    this.initialized = false;
    this.inMemoryFallback = new Map();
    this.useInMemory = options.inMemory || false;

    // Ensure data directory exists
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir) && !this.useInMemory) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  /**
   * Initialize the memory store
   * Sets up SQLite database and creates required tables
   */
  async initialize() {
    if (this.initialized) return;

    try {
      if (this.useInMemory) {
        logger.info('Using in-memory storage (no persistence)');
        this.initialized = true;
        return;
      }

      // Dynamic import for better-sqlite3
      const Database = (await import('better-sqlite3')).default;
      this.db = new Database(this.dbPath);

      // Enable WAL mode for better concurrent access
      this.db.pragma('journal_mode = WAL');

      // Create main key-value store table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS memory (
          namespace TEXT NOT NULL,
          key TEXT NOT NULL,
          value TEXT NOT NULL,
          metadata TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          expires_at INTEGER,
          PRIMARY KEY (namespace, key)
        );

        CREATE INDEX IF NOT EXISTS idx_memory_namespace ON memory(namespace);
        CREATE INDEX IF NOT EXISTS idx_memory_expires ON memory(expires_at);
      `);

      // Create decisions table for tracking agent decisions
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS decisions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          agent TEXT NOT NULL,
          decision_type TEXT NOT NULL,
          context TEXT NOT NULL,
          decision TEXT NOT NULL,
          reasoning TEXT,
          outcome TEXT,
          timestamp INTEGER NOT NULL,
          parent_decision_id INTEGER,
          FOREIGN KEY (parent_decision_id) REFERENCES decisions(id)
        );

        CREATE INDEX IF NOT EXISTS idx_decisions_agent ON decisions(agent);
        CREATE INDEX IF NOT EXISTS idx_decisions_type ON decisions(decision_type);
        CREATE INDEX IF NOT EXISTS idx_decisions_timestamp ON decisions(timestamp);
      `);

      // Create knowledge base table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS knowledge (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category TEXT NOT NULL,
          topic TEXT NOT NULL,
          content TEXT NOT NULL,
          source TEXT,
          confidence REAL DEFAULT 1.0,
          usage_count INTEGER DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge(category);
        CREATE INDEX IF NOT EXISTS idx_knowledge_topic ON knowledge(topic);
      `);

      this.initialized = true;
      logger.info(`Memory store initialized at ${this.dbPath}`);
    } catch (error) {
      logger.warn(`SQLite initialization failed, using in-memory fallback: ${error.message}`);
      this.useInMemory = true;
      this.initialized = true;
    }
  }

  /**
   * Ensure the store is initialized before operations
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  // ==================== Key-Value Operations ====================

  /**
   * Set a value in the memory store
   * @param {string} namespace - Namespace for the key
   * @param {string} key - The key to set
   * @param {any} value - Value to store (will be JSON serialized)
   * @param {object} options - Additional options
   * @param {object} options.metadata - Additional metadata to store
   * @param {number} options.ttl - Time to live in milliseconds
   */
  async set(namespace, key, value, options = {}) {
    await this.ensureInitialized();

    const now = Date.now();
    const serializedValue = JSON.stringify(value);
    const metadata = options.metadata ? JSON.stringify(options.metadata) : null;
    const expiresAt = options.ttl ? now + options.ttl : null;

    if (this.useInMemory) {
      const storeKey = `${namespace}:${key}`;
      this.inMemoryFallback.set(storeKey, {
        value: serializedValue,
        metadata,
        createdAt: now,
        updatedAt: now,
        expiresAt
      });
      return;
    }

    const stmt = this.db.prepare(`
      INSERT INTO memory (namespace, key, value, metadata, created_at, updated_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(namespace, key) DO UPDATE SET
        value = excluded.value,
        metadata = excluded.metadata,
        updated_at = excluded.updated_at,
        expires_at = excluded.expires_at
    `);

    stmt.run(namespace, key, serializedValue, metadata, now, now, expiresAt);
    logger.debug(`Set ${namespace}:${key}`);
  }

  /**
   * Get a value from the memory store
   * @param {string} namespace - Namespace for the key
   * @param {string} key - The key to retrieve
   * @returns {any} The stored value or null if not found/expired
   */
  async get(namespace, key) {
    await this.ensureInitialized();

    const now = Date.now();

    if (this.useInMemory) {
      const storeKey = `${namespace}:${key}`;
      const entry = this.inMemoryFallback.get(storeKey);
      if (!entry) return null;
      if (entry.expiresAt && entry.expiresAt < now) {
        this.inMemoryFallback.delete(storeKey);
        return null;
      }
      return JSON.parse(entry.value);
    }

    const stmt = this.db.prepare(`
      SELECT value, expires_at FROM memory
      WHERE namespace = ? AND key = ?
    `);

    const row = stmt.get(namespace, key);

    if (!row) return null;

    // Check expiration
    if (row.expires_at && row.expires_at < now) {
      await this.delete(namespace, key);
      return null;
    }

    return JSON.parse(row.value);
  }

  /**
   * Delete a value from the memory store
   * @param {string} namespace - Namespace for the key
   * @param {string} key - The key to delete
   */
  async delete(namespace, key) {
    await this.ensureInitialized();

    if (this.useInMemory) {
      const storeKey = `${namespace}:${key}`;
      this.inMemoryFallback.delete(storeKey);
      return;
    }

    const stmt = this.db.prepare('DELETE FROM memory WHERE namespace = ? AND key = ?');
    stmt.run(namespace, key);
    logger.debug(`Deleted ${namespace}:${key}`);
  }

  /**
   * Check if a key exists
   * @param {string} namespace - Namespace for the key
   * @param {string} key - The key to check
   * @returns {boolean} True if the key exists
   */
  async has(namespace, key) {
    const value = await this.get(namespace, key);
    return value !== null;
  }

  /**
   * Get all keys in a namespace
   * @param {string} namespace - Namespace to list
   * @returns {string[]} Array of keys
   */
  async keys(namespace) {
    await this.ensureInitialized();

    if (this.useInMemory) {
      const prefix = `${namespace}:`;
      return Array.from(this.inMemoryFallback.keys())
        .filter(k => k.startsWith(prefix))
        .map(k => k.substring(prefix.length));
    }

    const stmt = this.db.prepare('SELECT key FROM memory WHERE namespace = ?');
    const rows = stmt.all(namespace);
    return rows.map(r => r.key);
  }

  /**
   * Get all entries in a namespace
   * @param {string} namespace - Namespace to retrieve
   * @returns {object} Object with key-value pairs
   */
  async getAll(namespace) {
    await this.ensureInitialized();

    const now = Date.now();

    if (this.useInMemory) {
      const prefix = `${namespace}:`;
      const result = {};
      for (const [key, entry] of this.inMemoryFallback) {
        if (key.startsWith(prefix)) {
          if (!entry.expiresAt || entry.expiresAt >= now) {
            result[key.substring(prefix.length)] = JSON.parse(entry.value);
          }
        }
      }
      return result;
    }

    const stmt = this.db.prepare(`
      SELECT key, value, expires_at FROM memory
      WHERE namespace = ? AND (expires_at IS NULL OR expires_at >= ?)
    `);

    const rows = stmt.all(namespace, now);
    const result = {};
    for (const row of rows) {
      result[row.key] = JSON.parse(row.value);
    }
    return result;
  }

  /**
   * Clear all entries in a namespace
   * @param {string} namespace - Namespace to clear
   */
  async clearNamespace(namespace) {
    await this.ensureInitialized();

    if (this.useInMemory) {
      const prefix = `${namespace}:`;
      for (const key of this.inMemoryFallback.keys()) {
        if (key.startsWith(prefix)) {
          this.inMemoryFallback.delete(key);
        }
      }
      return;
    }

    const stmt = this.db.prepare('DELETE FROM memory WHERE namespace = ?');
    stmt.run(namespace);
    logger.info(`Cleared namespace: ${namespace}`);
  }

  // ==================== Project State Operations ====================

  /**
   * Save project state
   * @param {string} projectId - Project identifier
   * @param {object} state - Project state object
   */
  async saveProjectState(projectId, state) {
    await this.set(MemoryNamespace.PROJECT_STATE, projectId, {
      ...state,
      lastUpdated: Date.now()
    });
  }

  /**
   * Load project state
   * @param {string} projectId - Project identifier
   * @returns {object|null} Project state or null
   */
  async loadProjectState(projectId) {
    return await this.get(MemoryNamespace.PROJECT_STATE, projectId);
  }

  /**
   * Save agent state
   * @param {string} agentName - Agent name
   * @param {object} state - Agent state object
   */
  async saveAgentState(agentName, state) {
    await this.set(MemoryNamespace.AGENT_STATE, agentName, {
      ...state,
      lastUpdated: Date.now()
    });
  }

  /**
   * Load agent state
   * @param {string} agentName - Agent name
   * @returns {object|null} Agent state or null
   */
  async loadAgentState(agentName) {
    return await this.get(MemoryNamespace.AGENT_STATE, agentName);
  }

  // ==================== Knowledge Base Operations ====================

  /**
   * Add knowledge entry
   * @param {string} category - Knowledge category
   * @param {string} topic - Topic within category
   * @param {any} content - Knowledge content
   * @param {object} options - Additional options
   */
  async addKnowledge(category, topic, content, options = {}) {
    await this.ensureInitialized();

    const now = Date.now();

    if (this.useInMemory) {
      const key = `knowledge:${category}:${topic}:${now}`;
      this.inMemoryFallback.set(key, {
        category,
        topic,
        content: JSON.stringify(content),
        source: options.source,
        confidence: options.confidence || 1.0,
        usageCount: 0,
        createdAt: now,
        updatedAt: now
      });
      return;
    }

    const stmt = this.db.prepare(`
      INSERT INTO knowledge (category, topic, content, source, confidence, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      category,
      topic,
      JSON.stringify(content),
      options.source || null,
      options.confidence || 1.0,
      now,
      now
    );

    logger.debug(`Added knowledge: ${category}/${topic}`);
  }

  /**
   * Query knowledge base
   * @param {object} query - Query parameters
   * @param {string} query.category - Category to search
   * @param {string} query.topic - Topic to search
   * @param {number} query.limit - Maximum results
   * @returns {object[]} Array of knowledge entries
   */
  async queryKnowledge(query = {}) {
    await this.ensureInitialized();

    if (this.useInMemory) {
      let results = [];
      for (const [key, entry] of this.inMemoryFallback) {
        if (key.startsWith('knowledge:')) {
          if (query.category && entry.category !== query.category) continue;
          if (query.topic && !entry.topic.includes(query.topic)) continue;
          results.push({
            ...entry,
            content: JSON.parse(entry.content)
          });
        }
      }
      if (query.limit) {
        results = results.slice(0, query.limit);
      }
      return results;
    }

    let sql = 'SELECT * FROM knowledge WHERE 1=1';
    const params = [];

    if (query.category) {
      sql += ' AND category = ?';
      params.push(query.category);
    }

    if (query.topic) {
      sql += ' AND topic LIKE ?';
      params.push(`%${query.topic}%`);
    }

    sql += ' ORDER BY confidence DESC, usage_count DESC';

    if (query.limit) {
      sql += ' LIMIT ?';
      params.push(query.limit);
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);

    return rows.map(row => ({
      id: row.id,
      category: row.category,
      topic: row.topic,
      content: JSON.parse(row.content),
      source: row.source,
      confidence: row.confidence,
      usageCount: row.usage_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  /**
   * Find pattern matches in knowledge base
   * @param {string} pattern - Pattern to search for
   * @returns {object[]} Matching knowledge entries
   */
  async findPatterns(pattern) {
    return await this.queryKnowledge({
      category: 'patterns',
      topic: pattern,
      limit: 10
    });
  }

  // ==================== Query Interface ====================

  /**
   * Query interface for understanding past decisions
   * "Why was this built this way?"
   * @param {string} context - Context to query about
   * @returns {object} Analysis result with decisions and reasoning
   */
  async queryWhyBuiltThisWay(context) {
    await this.ensureInitialized();

    const result = {
      context,
      decisions: [],
      patterns: [],
      knowledge: []
    };

    // Find related decisions
    if (this.useInMemory) {
      for (const [key, entry] of this.inMemoryFallback) {
        if (key.startsWith('decisions:') &&
            entry.context &&
            JSON.stringify(entry.context).includes(context)) {
          result.decisions.push(entry);
        }
      }
    } else {
      const stmt = this.db.prepare(`
        SELECT * FROM decisions
        WHERE context LIKE ?
        ORDER BY timestamp DESC
        LIMIT 20
      `);
      result.decisions = stmt.all(`%${context}%`).map(row => ({
        id: row.id,
        agent: row.agent,
        decisionType: row.decision_type,
        context: JSON.parse(row.context),
        decision: JSON.parse(row.decision),
        reasoning: row.reasoning,
        outcome: row.outcome,
        timestamp: row.timestamp
      }));
    }

    // Find related patterns
    result.patterns = await this.findPatterns(context);

    // Find related knowledge
    result.knowledge = await this.queryKnowledge({ topic: context, limit: 5 });

    return result;
  }

  // ==================== Cleanup Operations ====================

  /**
   * Clean up expired entries
   */
  async cleanupExpired() {
    await this.ensureInitialized();

    const now = Date.now();

    if (this.useInMemory) {
      for (const [key, entry] of this.inMemoryFallback) {
        if (entry.expiresAt && entry.expiresAt < now) {
          this.inMemoryFallback.delete(key);
        }
      }
      return;
    }

    const stmt = this.db.prepare('DELETE FROM memory WHERE expires_at IS NOT NULL AND expires_at < ?');
    const result = stmt.run(now);

    if (result.changes > 0) {
      logger.info(`Cleaned up ${result.changes} expired entries`);
    }
  }

  /**
   * Get statistics about the memory store
   * @returns {object} Statistics object
   */
  async getStats() {
    await this.ensureInitialized();

    if (this.useInMemory) {
      return {
        type: 'in-memory',
        totalEntries: this.inMemoryFallback.size,
        namespaces: {}
      };
    }

    const stats = {
      type: 'sqlite',
      dbPath: this.dbPath,
      namespaces: {}
    };

    const namespaceStmt = this.db.prepare(`
      SELECT namespace, COUNT(*) as count FROM memory GROUP BY namespace
    `);
    for (const row of namespaceStmt.all()) {
      stats.namespaces[row.namespace] = row.count;
    }

    const decisionStmt = this.db.prepare('SELECT COUNT(*) as count FROM decisions');
    stats.decisionsCount = decisionStmt.get().count;

    const knowledgeStmt = this.db.prepare('SELECT COUNT(*) as count FROM knowledge');
    stats.knowledgeCount = knowledgeStmt.get().count;

    return stats;
  }

  /**
   * Close the database connection
   */
  async close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
      logger.info('Memory store closed');
    }
  }
}

// Singleton instance
let instance = null;

/**
 * Get the singleton MemoryStore instance
 * @param {object} options - Configuration options
 * @returns {MemoryStore} The singleton instance
 */
export function getMemoryStore(options = {}) {
  if (!instance) {
    instance = new MemoryStore(options);
  }
  return instance;
}

/**
 * Reset the singleton (primarily for testing)
 */
export function resetMemoryStore() {
  if (instance) {
    instance.close();
    instance = null;
  }
}

export default MemoryStore;
