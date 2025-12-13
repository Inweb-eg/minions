import EventEmitter from 'eventemitter3';
import { createLogger } from '../common/logger.js';
import { getMemoryStore, MemoryNamespace } from '../memory-store/MemoryStore.js';

const logger = createLogger('EnhancedEventBus');

/**
 * Message priority levels
 */
export const MessagePriority = {
  CRITICAL: 0,   // Immediate processing (errors, rollbacks)
  HIGH: 1,       // Important (test failures, blockers)
  NORMAL: 2,     // Standard priority
  LOW: 3,        // Background tasks
  DEFERRED: 4    // Process when idle
};

/**
 * Broadcast channels for system-wide announcements
 */
export const BroadcastChannel = {
  SYSTEM: 'broadcast:system',          // System-wide announcements
  AGENTS: 'broadcast:agents',          // Agent coordination
  ALERTS: 'broadcast:alerts',          // Alert notifications
  STATUS: 'broadcast:status'           // Status updates
};

/**
 * Enhanced Event Bus with priority queuing, request-response patterns,
 * and message persistence for crash recovery
 */
class EnhancedEventBus {
  constructor(options = {}) {
    this.emitter = new EventEmitter();
    this.subscribers = new Map();
    this.eventHistory = [];
    this.maxHistory = options.maxHistory || 1000;

    // Priority queue for messages
    this.priorityQueues = new Map([
      [MessagePriority.CRITICAL, []],
      [MessagePriority.HIGH, []],
      [MessagePriority.NORMAL, []],
      [MessagePriority.LOW, []],
      [MessagePriority.DEFERRED, []]
    ]);

    // Request-response tracking
    this.pendingRequests = new Map();
    this.requestTimeout = options.requestTimeout || 30000; // 30 seconds

    // Message persistence
    this.memoryStore = null;
    this.persistMessages = options.persistMessages !== false;
    this.unprocessedMessages = [];

    // Processing state
    this.isProcessing = false;
    this.processingInterval = null;

    // Broadcast channels
    this.broadcastSubscribers = new Map();

    // Statistics
    this.stats = {
      messagesPublished: 0,
      messagesProcessed: 0,
      requestsSent: 0,
      requestsCompleted: 0,
      requestsTimedOut: 0
    };
  }

  /**
   * Initialize the enhanced event bus
   */
  async initialize() {
    if (this.persistMessages) {
      this.memoryStore = getMemoryStore();
      await this.memoryStore.initialize();

      // Recover unprocessed messages
      await this.recoverMessages();
    }

    // Start priority queue processing
    this.startProcessing();

    logger.info('Enhanced event bus initialized');
  }

  /**
   * Start processing priority queues
   */
  startProcessing() {
    if (this.processingInterval) return;

    this.processingInterval = setInterval(() => {
      this.processQueues();
    }, 10); // Process every 10ms
  }

  /**
   * Stop processing priority queues
   */
  stopProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  /**
   * Process priority queues in order
   */
  async processQueues() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      // Process from highest to lowest priority
      for (const priority of [
        MessagePriority.CRITICAL,
        MessagePriority.HIGH,
        MessagePriority.NORMAL,
        MessagePriority.LOW,
        MessagePriority.DEFERRED
      ]) {
        const queue = this.priorityQueues.get(priority);
        while (queue.length > 0) {
          const message = queue.shift();
          await this.processMessage(message);

          // Only process one lower priority message per cycle
          // to ensure high priority messages get through
          if (priority > MessagePriority.HIGH) break;
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single message
   * @param {object} message - Message to process
   */
  async processMessage(message) {
    try {
      // Emit to specific event type subscribers
      this.emitter.emit(message.type, message);

      // Emit to global listeners
      this.emitter.emit('*', message);

      // Store in history
      this.eventHistory.push(message);
      if (this.eventHistory.length > this.maxHistory) {
        this.eventHistory.shift();
      }

      this.stats.messagesProcessed++;

      // Mark as processed in persistence store
      if (this.persistMessages && message.persistenceId) {
        await this.markMessageProcessed(message.persistenceId);
      }

    } catch (error) {
      logger.error(`Error processing message ${message.id}:`, error);
    }
  }

  /**
   * Publish an event with optional priority
   * @param {string} eventType - Event type
   * @param {object} data - Event data
   * @param {object} options - Publish options
   * @param {number} options.priority - Message priority
   * @param {boolean} options.persist - Whether to persist message
   */
  async publish(eventType, data, options = {}) {
    const priority = options.priority ?? MessagePriority.NORMAL;
    const persist = options.persist ?? this.persistMessages;

    const message = {
      type: eventType,
      data,
      timestamp: Date.now(),
      id: this.generateEventId(),
      priority
    };

    // Persist message for crash recovery
    if (persist && this.memoryStore) {
      message.persistenceId = await this.persistMessage(message);
    }

    // Add to priority queue
    const queue = this.priorityQueues.get(priority);
    if (queue) {
      queue.push(message);
    } else {
      // Fallback to normal priority
      this.priorityQueues.get(MessagePriority.NORMAL).push(message);
    }

    this.stats.messagesPublished++;
    logger.debug(`Event queued: ${eventType} (priority: ${priority})`);

    // Process critical messages immediately
    if (priority === MessagePriority.CRITICAL) {
      await this.processQueues();
    }

    return message.id;
  }

  /**
   * Publish with high priority (convenience method)
   */
  async publishCritical(eventType, data) {
    return this.publish(eventType, data, { priority: MessagePriority.CRITICAL });
  }

  /**
   * Publish with high priority (convenience method)
   */
  async publishHigh(eventType, data) {
    return this.publish(eventType, data, { priority: MessagePriority.HIGH });
  }

  /**
   * Request-response pattern
   * Send a request and wait for a response
   * @param {string} requestType - Request event type
   * @param {object} data - Request data
   * @param {object} options - Request options
   * @returns {Promise<any>} Response data
   */
  async request(requestType, data, options = {}) {
    const timeout = options.timeout || this.requestTimeout;
    const requestId = this.generateEventId();

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        this.stats.requestsTimedOut++;
        reject(new Error(`Request ${requestType} timed out after ${timeout}ms`));
      }, timeout);

      // Store pending request
      this.pendingRequests.set(requestId, {
        requestType,
        resolve: (response) => {
          clearTimeout(timeoutId);
          this.pendingRequests.delete(requestId);
          this.stats.requestsCompleted++;
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          this.pendingRequests.delete(requestId);
          reject(error);
        },
        timeoutId
      });

      // Publish request with request ID
      this.publish(requestType, {
        ...data,
        _requestId: requestId,
        _isRequest: true
      }, { priority: options.priority ?? MessagePriority.HIGH });

      this.stats.requestsSent++;
    });
  }

  /**
   * Respond to a request
   * @param {string} requestId - Request ID from the original request
   * @param {any} response - Response data
   * @param {Error} error - Optional error
   */
  respond(requestId, response, error = null) {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      logger.warn(`No pending request found for ${requestId}`);
      return;
    }

    if (error) {
      pending.reject(error);
    } else {
      pending.resolve(response);
    }
  }

  /**
   * Subscribe to an event type
   * @param {string} eventType - Event type to subscribe to
   * @param {string} subscriberName - Subscriber identifier
   * @param {function} callback - Callback function
   * @returns {function} Unsubscribe function
   */
  subscribe(eventType, subscriberName, callback) {
    const handler = async (message) => {
      try {
        // Handle request-response pattern
        if (message.data?._isRequest) {
          const requestId = message.data._requestId;
          const result = await callback(message.data, message);

          // Auto-respond if the callback returned a value
          if (result !== undefined) {
            this.respond(requestId, result);
          }
        } else {
          await callback(message.data, message);
        }
      } catch (error) {
        logger.error(`Error in subscriber ${subscriberName} for ${eventType}:`, error);

        // If this was a request, respond with error
        if (message.data?._isRequest) {
          this.respond(message.data._requestId, null, error);
        }

        // Publish error event
        this.publish('ERROR_OCCURRED', {
          agent: subscriberName,
          error: error.message,
          eventType,
          originalEvent: message
        }, { priority: MessagePriority.HIGH });
      }
    };

    this.emitter.on(eventType, handler);

    // Track subscription
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }
    this.subscribers.get(eventType).push({ name: subscriberName, handler });

    logger.debug(`${subscriberName} subscribed to ${eventType}`);

    // Return unsubscribe function
    return () => {
      this.emitter.off(eventType, handler);
      const subs = this.subscribers.get(eventType);
      const index = subs?.findIndex(s => s.name === subscriberName);
      if (index > -1) {
        subs.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to all events
   */
  subscribeToAll(subscriberName, callback) {
    return this.subscribe('*', subscriberName, callback);
  }

  /**
   * Subscribe to a broadcast channel
   * @param {string} channel - Broadcast channel
   * @param {string} subscriberName - Subscriber identifier
   * @param {function} callback - Callback function
   * @returns {function} Unsubscribe function
   */
  subscribeToBroadcast(channel, subscriberName, callback) {
    if (!this.broadcastSubscribers.has(channel)) {
      this.broadcastSubscribers.set(channel, []);
    }

    const subscriber = { name: subscriberName, callback };
    this.broadcastSubscribers.get(channel).push(subscriber);

    return () => {
      const subs = this.broadcastSubscribers.get(channel);
      const index = subs?.findIndex(s => s.name === subscriberName);
      if (index > -1) {
        subs.splice(index, 1);
      }
    };
  }

  /**
   * Broadcast to a channel
   * @param {string} channel - Broadcast channel
   * @param {object} data - Data to broadcast
   */
  async broadcast(channel, data) {
    const subscribers = this.broadcastSubscribers.get(channel) || [];

    const message = {
      channel,
      data,
      timestamp: Date.now(),
      id: this.generateEventId()
    };

    logger.debug(`Broadcasting to ${channel}: ${subscribers.length} subscribers`);

    for (const subscriber of subscribers) {
      try {
        await subscriber.callback(message.data, message);
      } catch (error) {
        logger.error(`Error in broadcast subscriber ${subscriber.name}:`, error);
      }
    }

    // Also publish as regular event for persistence
    await this.publish(`BROADCAST:${channel}`, data, {
      priority: MessagePriority.HIGH
    });
  }

  /**
   * System-wide broadcast
   */
  async broadcastSystem(data) {
    return this.broadcast(BroadcastChannel.SYSTEM, data);
  }

  // ==================== Message Persistence ====================

  /**
   * Persist a message for crash recovery
   * @param {object} message - Message to persist
   * @returns {string} Persistence ID
   */
  async persistMessage(message) {
    if (!this.memoryStore) return null;

    const persistenceId = `msg_${message.id}`;
    await this.memoryStore.set(
      'pending_messages',
      persistenceId,
      {
        ...message,
        persistedAt: Date.now(),
        processed: false
      },
      { ttl: 24 * 60 * 60 * 1000 } // 24 hours TTL
    );

    return persistenceId;
  }

  /**
   * Mark a message as processed
   * @param {string} persistenceId - Persistence ID
   */
  async markMessageProcessed(persistenceId) {
    if (!this.memoryStore) return;
    await this.memoryStore.delete('pending_messages', persistenceId);
  }

  /**
   * Recover unprocessed messages from persistence
   */
  async recoverMessages() {
    if (!this.memoryStore) return;

    const pending = await this.memoryStore.getAll('pending_messages');
    const messages = Object.values(pending)
      .filter(m => !m.processed)
      .sort((a, b) => a.priority - b.priority || a.timestamp - b.timestamp);

    if (messages.length > 0) {
      logger.info(`Recovering ${messages.length} unprocessed messages`);

      for (const message of messages) {
        const queue = this.priorityQueues.get(message.priority || MessagePriority.NORMAL);
        queue.push(message);
      }
    }
  }

  // ==================== History & Stats ====================

  /**
   * Get event history with optional filters
   */
  getHistory(filter = {}) {
    let history = [...this.eventHistory];

    if (filter.eventType) {
      history = history.filter(e => e.type === filter.eventType);
    }

    if (filter.agent) {
      history = history.filter(e => e.data?.agent === filter.agent);
    }

    if (filter.since) {
      history = history.filter(e => e.timestamp >= filter.since);
    }

    if (filter.priority !== undefined) {
      history = history.filter(e => e.priority === filter.priority);
    }

    return history;
  }

  /**
   * Get subscriber information
   */
  getSubscribers(eventType = null) {
    if (eventType) {
      return this.subscribers.get(eventType) || [];
    }
    return Object.fromEntries(this.subscribers);
  }

  /**
   * Get queue depths
   */
  getQueueDepths() {
    const depths = {};
    for (const [priority, queue] of this.priorityQueues) {
      const priorityName = Object.entries(MessagePriority)
        .find(([, v]) => v === priority)?.[0] || priority;
      depths[priorityName] = queue.length;
    }
    return depths;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      queueDepths: this.getQueueDepths(),
      pendingRequests: this.pendingRequests.size,
      subscriberCount: Array.from(this.subscribers.values())
        .reduce((sum, subs) => sum + subs.length, 0),
      broadcastSubscriberCount: Array.from(this.broadcastSubscribers.values())
        .reduce((sum, subs) => sum + subs.length, 0)
    };
  }

  /**
   * Generate unique event ID
   */
  generateEventId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear event history
   */
  clearHistory() {
    this.eventHistory = [];
  }

  /**
   * Shutdown the event bus
   */
  async shutdown() {
    this.stopProcessing();

    // Clear pending request timeouts
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeoutId);
    }
    this.pendingRequests.clear();

    logger.info('Enhanced event bus shut down');
  }
}

// Singleton instance
let instance = null;

/**
 * Get the singleton EnhancedEventBus instance
 * @param {object} options - Configuration options
 * @returns {EnhancedEventBus} The singleton instance
 */
export function getEnhancedEventBus(options = {}) {
  if (!instance) {
    instance = new EnhancedEventBus(options);
  }
  return instance;
}

/**
 * Reset the singleton (primarily for testing)
 */
export function resetEnhancedEventBus() {
  if (instance) {
    instance.shutdown();
    instance = null;
  }
}

export default EnhancedEventBus;
