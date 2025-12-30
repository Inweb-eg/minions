/**
 * ConversationStore
 * -----------------
 * Persists conversation history to disk with CRUD operations.
 * Conversations are grouped by project name or as "general" chat.
 *
 * Part of Gru Agent - Minions Client Interface System
 */

import fs from 'fs/promises';
import path from 'path';
import { createLogger } from '../../foundation/common/logger.js';

export class ConversationStore {
  constructor(config = {}) {
    this.logger = createLogger('ConversationStore');

    this.config = {
      dataDir: config.dataDir || '/app/data/conversations',
      maxConversationsPerProject: config.maxConversationsPerProject || 50,
      ...config
    };

    this.conversations = new Map(); // In-memory cache
    this.isInitialized = false;
  }

  /**
   * Initialize the store
   */
  async initialize() {
    try {
      await fs.mkdir(this.config.dataDir, { recursive: true });
      await this._loadAllConversations();
      this.isInitialized = true;
      this.logger.info(`ConversationStore initialized at ${this.config.dataDir}`);
    } catch (error) {
      this.logger.error(`Failed to initialize: ${error.message}`);
      // Continue with empty store
      this.isInitialized = true;
    }
  }

  /**
   * Load all conversations from disk
   * @private
   */
  async _loadAllConversations() {
    try {
      const files = await fs.readdir(this.config.dataDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      for (const file of jsonFiles) {
        try {
          const content = await fs.readFile(
            path.join(this.config.dataDir, file),
            'utf-8'
          );
          const conversation = JSON.parse(content);
          this.conversations.set(conversation.id, conversation);
        } catch (err) {
          this.logger.warn(`Failed to load conversation ${file}: ${err.message}`);
        }
      }

      this.logger.info(`Loaded ${this.conversations.size} conversations`);
    } catch (error) {
      this.logger.warn(`Could not load conversations: ${error.message}`);
    }
  }

  /**
   * Create a new conversation
   * @param {object} options - Conversation options
   * @returns {object} The created conversation
   */
  async create(options = {}) {
    const conversation = {
      id: this._generateId(),
      projectName: options.projectName || 'General',
      title: options.title || 'New Conversation',
      messages: options.messages || [],
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: 0,
        ...options.metadata
      }
    };

    this.conversations.set(conversation.id, conversation);
    await this._persist(conversation);

    this.logger.info(`Created conversation: ${conversation.id}`);
    return conversation;
  }

  /**
   * Get a conversation by ID
   * @param {string} id - Conversation ID
   * @returns {object|null} The conversation or null
   */
  get(id) {
    return this.conversations.get(id) || null;
  }

  /**
   * Get all conversations
   * @param {object} filter - Optional filter
   * @returns {Array} Array of conversations
   */
  getAll(filter = {}) {
    let results = Array.from(this.conversations.values());

    if (filter.projectName) {
      results = results.filter(c => c.projectName === filter.projectName);
    }

    // Sort by updatedAt descending
    results.sort((a, b) =>
      new Date(b.metadata.updatedAt) - new Date(a.metadata.updatedAt)
    );

    if (filter.limit) {
      results = results.slice(0, filter.limit);
    }

    return results;
  }

  /**
   * Get conversations grouped by project
   * @returns {object} Conversations grouped by project name
   */
  getGroupedByProject() {
    const grouped = {};

    for (const conversation of this.conversations.values()) {
      const project = conversation.projectName || 'General';
      if (!grouped[project]) {
        grouped[project] = [];
      }
      grouped[project].push({
        id: conversation.id,
        title: conversation.title,
        messageCount: conversation.metadata.messageCount,
        updatedAt: conversation.metadata.updatedAt
      });
    }

    // Sort each group by updatedAt
    for (const project of Object.keys(grouped)) {
      grouped[project].sort((a, b) =>
        new Date(b.updatedAt) - new Date(a.updatedAt)
      );
    }

    return grouped;
  }

  /**
   * Update a conversation
   * @param {string} id - Conversation ID
   * @param {object} updates - Fields to update
   * @returns {object|null} Updated conversation or null
   */
  async update(id, updates) {
    const conversation = this.conversations.get(id);
    if (!conversation) {
      return null;
    }

    // Apply updates
    if (updates.title !== undefined) conversation.title = updates.title;
    if (updates.projectName !== undefined) conversation.projectName = updates.projectName;
    if (updates.messages !== undefined) {
      conversation.messages = updates.messages;
      conversation.metadata.messageCount = updates.messages.length;
    }

    conversation.metadata.updatedAt = new Date().toISOString();

    await this._persist(conversation);
    return conversation;
  }

  /**
   * Add a message to a conversation
   * @param {string} id - Conversation ID
   * @param {object} message - Message to add
   * @returns {object|null} Updated conversation or null
   */
  async addMessage(id, message) {
    const conversation = this.conversations.get(id);
    if (!conversation) {
      return null;
    }

    const messageWithTimestamp = {
      ...message,
      timestamp: message.timestamp || new Date().toISOString()
    };

    conversation.messages.push(messageWithTimestamp);
    conversation.metadata.messageCount = conversation.messages.length;
    conversation.metadata.updatedAt = new Date().toISOString();

    // Auto-update title from first user message if still default
    if (conversation.title === 'New Conversation' && message.role === 'user') {
      conversation.title = message.content.substring(0, 50) +
        (message.content.length > 50 ? '...' : '');
    }

    await this._persist(conversation);
    return conversation;
  }

  /**
   * Delete a conversation
   * @param {string} id - Conversation ID
   * @returns {boolean} Success
   */
  async delete(id) {
    const conversation = this.conversations.get(id);
    if (!conversation) {
      return false;
    }

    this.conversations.delete(id);

    try {
      await fs.unlink(path.join(this.config.dataDir, `${id}.json`));
    } catch (err) {
      this.logger.warn(`Failed to delete file for ${id}: ${err.message}`);
    }

    this.logger.info(`Deleted conversation: ${id}`);
    return true;
  }

  /**
   * Delete all conversations for a project
   * @param {string} projectName - Project name
   * @returns {number} Number of deleted conversations
   */
  async deleteByProject(projectName) {
    let count = 0;

    for (const [id, conversation] of this.conversations) {
      if (conversation.projectName === projectName) {
        await this.delete(id);
        count++;
      }
    }

    return count;
  }

  /**
   * Get statistics
   * @returns {object} Store statistics
   */
  getStats() {
    const projects = new Set();
    let totalMessages = 0;

    for (const conversation of this.conversations.values()) {
      projects.add(conversation.projectName);
      totalMessages += conversation.metadata.messageCount;
    }

    return {
      totalConversations: this.conversations.size,
      totalProjects: projects.size,
      totalMessages,
      projects: Array.from(projects)
    };
  }

  /**
   * Persist a conversation to disk
   * @private
   */
  async _persist(conversation) {
    try {
      const filePath = path.join(this.config.dataDir, `${conversation.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(conversation, null, 2));
    } catch (error) {
      this.logger.error(`Failed to persist ${conversation.id}: ${error.message}`);
    }
  }

  /**
   * Generate unique ID
   * @private
   */
  _generateId() {
    return `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Shutdown
   */
  async shutdown() {
    this.conversations.clear();
    this.isInitialized = false;
  }
}

// Singleton instance
let instance = null;

export function getConversationStore(config = {}) {
  if (!instance) {
    instance = new ConversationStore(config);
  }
  return instance;
}

export async function resetConversationStore() {
  if (instance) {
    await instance.shutdown();
    instance = null;
  }
}

export default ConversationStore;
