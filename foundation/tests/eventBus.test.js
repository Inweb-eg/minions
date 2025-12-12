import { describe, test, expect, beforeEach } from '@jest/globals';
import AgentEventBus, { getEventBus } from '../event-bus/AgentEventBus.js';
import { EventTypes } from '../event-bus/eventTypes.js';

describe('AgentEventBus', () => {
  let eventBus;

  beforeEach(() => {
    eventBus = new AgentEventBus();
  });

  describe('publish and subscribe', () => {
    test('should publish and receive events', (done) => {
      const testData = { agent: 'test-agent', message: 'Hello' };

      eventBus.subscribe(EventTypes.CODE_GENERATED, 'subscriber', (data) => {
        expect(data.agent).toBe('test-agent');
        expect(data.message).toBe('Hello');
        done();
      });

      eventBus.publish(EventTypes.CODE_GENERATED, testData);
    });

    test('should support multiple subscribers for same event', () => {
      let count = 0;
      const testData = { agent: 'test-agent' };

      eventBus.subscribe(EventTypes.CODE_GENERATED, 'subscriber1', () => {
        count++;
      });

      eventBus.subscribe(EventTypes.CODE_GENERATED, 'subscriber2', () => {
        count++;
      });

      eventBus.publish(EventTypes.CODE_GENERATED, testData);

      // Give async callbacks time to execute
      return new Promise(resolve => {
        setTimeout(() => {
          expect(count).toBe(2);
          resolve();
        }, 100);
      });
    });

    test('should handle errors in subscribers gracefully', (done) => {
      let errorEventReceived = false;

      // Subscribe to error events
      eventBus.subscribe(EventTypes.ERROR_OCCURRED, 'error-monitor', () => {
        errorEventReceived = true;
      });

      // Subscribe with a callback that throws
      eventBus.subscribe(EventTypes.CODE_GENERATED, 'faulty-subscriber', () => {
        throw new Error('Test error');
      });

      eventBus.publish(EventTypes.CODE_GENERATED, { agent: 'test' });

      setTimeout(() => {
        expect(errorEventReceived).toBe(true);
        done();
      }, 100);
    });
  });

  describe('event history', () => {
    test('should store event history', () => {
      eventBus.publish(EventTypes.CODE_GENERATED, { agent: 'agent1' });
      eventBus.publish(EventTypes.TESTS_COMPLETED, { agent: 'agent2' });

      const history = eventBus.getHistory();
      expect(history.length).toBe(2);
      expect(history[0].type).toBe(EventTypes.CODE_GENERATED);
      expect(history[1].type).toBe(EventTypes.TESTS_COMPLETED);
    });

    test('should filter history by event type', () => {
      eventBus.publish(EventTypes.CODE_GENERATED, { agent: 'agent1' });
      eventBus.publish(EventTypes.TESTS_COMPLETED, { agent: 'agent2' });
      eventBus.publish(EventTypes.CODE_GENERATED, { agent: 'agent3' });

      const history = eventBus.getHistory({ eventType: EventTypes.CODE_GENERATED });
      expect(history.length).toBe(2);
      expect(history.every(e => e.type === EventTypes.CODE_GENERATED)).toBe(true);
    });

    test('should filter history by agent', () => {
      eventBus.publish(EventTypes.CODE_GENERATED, { agent: 'agent1' });
      eventBus.publish(EventTypes.TESTS_COMPLETED, { agent: 'agent2' });
      eventBus.publish(EventTypes.CODE_GENERATED, { agent: 'agent1' });

      const history = eventBus.getHistory({ agent: 'agent1' });
      expect(history.length).toBe(2);
      expect(history.every(e => e.data.agent === 'agent1')).toBe(true);
    });

    test('should filter history by timestamp', () => {
      const now = Date.now();
      eventBus.publish(EventTypes.CODE_GENERATED, { agent: 'agent1' });

      setTimeout(() => {
        eventBus.publish(EventTypes.TESTS_COMPLETED, { agent: 'agent2' });

        const history = eventBus.getHistory({ since: now + 50 });
        expect(history.length).toBe(1);
        expect(history[0].type).toBe(EventTypes.TESTS_COMPLETED);
      }, 100);
    });

    test('should limit history to max size', () => {
      eventBus.maxHistory = 5;

      for (let i = 0; i < 10; i++) {
        eventBus.publish(EventTypes.CODE_GENERATED, { agent: `agent${i}` });
      }

      const history = eventBus.getHistory();
      expect(history.length).toBe(5);
      // Should keep the most recent 5
      expect(history[0].data.agent).toBe('agent5');
      expect(history[4].data.agent).toBe('agent9');
    });

    test('should clear history', () => {
      eventBus.publish(EventTypes.CODE_GENERATED, { agent: 'agent1' });
      eventBus.publish(EventTypes.TESTS_COMPLETED, { agent: 'agent2' });

      expect(eventBus.getHistory().length).toBe(2);

      eventBus.clearHistory();
      expect(eventBus.getHistory().length).toBe(0);
    });
  });

  describe('subscribers', () => {
    test('should track subscribers', () => {
      eventBus.subscribe(EventTypes.CODE_GENERATED, 'subscriber1', () => {});
      eventBus.subscribe(EventTypes.CODE_GENERATED, 'subscriber2', () => {});

      const subscribers = eventBus.getSubscribers(EventTypes.CODE_GENERATED);
      expect(subscribers.length).toBe(2);
      expect(subscribers[0].name).toBe('subscriber1');
      expect(subscribers[1].name).toBe('subscriber2');
    });

    test('should unsubscribe correctly', () => {
      const unsubscribe = eventBus.subscribe(EventTypes.CODE_GENERATED, 'subscriber1', () => {});

      expect(eventBus.getSubscribers(EventTypes.CODE_GENERATED).length).toBe(1);

      unsubscribe();

      expect(eventBus.getSubscribers(EventTypes.CODE_GENERATED).length).toBe(0);
    });

    test('should support subscribeToAll for monitoring', (done) => {
      let receivedEvents = [];

      eventBus.subscribeToAll('monitor', (data, event) => {
        receivedEvents.push(event.type);
      });

      eventBus.publish(EventTypes.CODE_GENERATED, { agent: 'agent1' });
      eventBus.publish(EventTypes.TESTS_COMPLETED, { agent: 'agent2' });

      setTimeout(() => {
        expect(receivedEvents.length).toBeGreaterThanOrEqual(2);
        expect(receivedEvents).toContain(EventTypes.CODE_GENERATED);
        expect(receivedEvents).toContain(EventTypes.TESTS_COMPLETED);
        done();
      }, 100);
    });
  });

  describe('singleton pattern', () => {
    test('getEventBus should return same instance', () => {
      const bus1 = getEventBus();
      const bus2 = getEventBus();

      expect(bus1).toBe(bus2);
    });
  });

  describe('event structure', () => {
    test('events should have required fields', (done) => {
      eventBus.subscribe(EventTypes.CODE_GENERATED, 'subscriber', (data, event) => {
        expect(event).toHaveProperty('id');
        expect(event).toHaveProperty('type');
        expect(event).toHaveProperty('data');
        expect(event).toHaveProperty('timestamp');
        expect(typeof event.id).toBe('string');
        expect(typeof event.timestamp).toBe('number');
        done();
      });

      eventBus.publish(EventTypes.CODE_GENERATED, { agent: 'test' });
    });

    test('event IDs should be unique', () => {
      const ids = new Set();

      for (let i = 0; i < 100; i++) {
        const id = eventBus.generateEventId();
        ids.add(id);
      }

      expect(ids.size).toBe(100);
    });
  });
});
