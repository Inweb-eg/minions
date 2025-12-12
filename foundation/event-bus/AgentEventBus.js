import EventEmitter from 'eventemitter3';
import { createLogger } from '../common/logger.js';

const logger = createLogger('EventBus');

/**
 * Centralized event bus for agent communication
 * All agents publish and subscribe through this bus
 */
class AgentEventBus {
  constructor() {
    this.emitter = new EventEmitter();
    this.subscribers = new Map(); // Track subscriptions
    this.eventHistory = []; // Last 1000 events
    this.maxHistory = 1000;
  }

  /**
   * Publish an event to the bus
   * @param {string} eventType - Event type (CODE_GENERATED, TESTS_COMPLETED, etc.)
   * @param {object} data - Event data
   * @param {string} data.agent - Agent name that published the event
   */
  publish(eventType, data) {
    const event = {
      type: eventType,
      data,
      timestamp: Date.now(),
      id: this.generateEventId()
    };

    // Store in history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.shift();
    }

    logger.info(`Event published: ${eventType} from ${data.agent}`);
    this.emitter.emit(eventType, event);

    // Also emit a global event for monitoring
    this.emitter.emit('*', event);
  }

  /**
   * Subscribe to an event type
   * @param {string} eventType - Event type to subscribe to
   * @param {string} subscriberName - Name of subscriber (agent name)
   * @param {function} callback - Callback function
   */
  subscribe(eventType, subscriberName, callback) {
    const handler = async (event) => {
      try {
        await callback(event.data, event);
      } catch (error) {
        logger.error(`Error in subscriber ${subscriberName} for ${eventType}:`, error);
        // Publish error event
        this.publish('ERROR_OCCURRED', {
          agent: subscriberName,
          error: error.message,
          eventType,
          originalEvent: event
        });
      }
    };

    this.emitter.on(eventType, handler);

    // Track subscription
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }
    this.subscribers.get(eventType).push({ name: subscriberName, handler });

    logger.info(`${subscriberName} subscribed to ${eventType}`);

    // Return unsubscribe function
    return () => {
      this.emitter.off(eventType, handler);
      const subs = this.subscribers.get(eventType);
      const index = subs.findIndex(s => s.name === subscriberName);
      if (index > -1) {
        subs.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to all events (for monitoring)
   */
  subscribeToAll(subscriberName, callback) {
    return this.subscribe('*', subscriberName, callback);
  }

  /**
   * Get event history
   */
  getHistory(filter = {}) {
    let history = [...this.eventHistory];

    if (filter.eventType) {
      history = history.filter(e => e.type === filter.eventType);
    }

    if (filter.agent) {
      history = history.filter(e => e.data.agent === filter.agent);
    }

    if (filter.since) {
      history = history.filter(e => e.timestamp >= filter.since);
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
   * Generate unique event ID
   */
  generateEventId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear event history (for testing)
   */
  clearHistory() {
    this.eventHistory = [];
  }
}

// Singleton instance
let instance = null;

export function getEventBus() {
  if (!instance) {
    instance = new AgentEventBus();
  }
  return instance;
}

export default AgentEventBus;
