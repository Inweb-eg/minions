import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import EnhancedEventBus, {
  getEnhancedEventBus,
  resetEnhancedEventBus,
  MessagePriority,
  BroadcastChannel
} from '../event-bus/EnhancedEventBus.js';
import { resetMemoryStore } from '../memory-store/MemoryStore.js';

describe('EnhancedEventBus', () => {
  let eventBus;

  beforeEach(async () => {
    resetMemoryStore();
    resetEnhancedEventBus();
    eventBus = new EnhancedEventBus({ persistMessages: false });
    await eventBus.initialize();
  });

  afterEach(async () => {
    await eventBus.shutdown();
    resetEnhancedEventBus();
    resetMemoryStore();
  });

  describe('basic publish/subscribe', () => {
    test('should publish and receive events', (done) => {
      eventBus.subscribe('TEST_EVENT', 'subscriber', (data) => {
        expect(data.message).toBe('hello');
        done();
      });

      eventBus.publish('TEST_EVENT', { agent: 'test', message: 'hello' });
    });

    test('should support multiple subscribers', async () => {
      let count = 0;

      eventBus.subscribe('TEST_EVENT', 'sub1', () => { count++; });
      eventBus.subscribe('TEST_EVENT', 'sub2', () => { count++; });

      await eventBus.publish('TEST_EVENT', { agent: 'test' });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(count).toBe(2);
    });

    test('should unsubscribe correctly', async () => {
      let count = 0;

      const unsubscribe = eventBus.subscribe('TEST_EVENT', 'sub', () => { count++; });

      await eventBus.publish('TEST_EVENT', { agent: 'test' });
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(count).toBe(1);

      unsubscribe();

      await eventBus.publish('TEST_EVENT', { agent: 'test' });
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(count).toBe(1);
    });
  });

  describe('priority queuing', () => {
    test('should process critical messages first', async () => {
      const order = [];

      eventBus.subscribe('NORMAL', 'sub', () => { order.push('normal'); });
      eventBus.subscribe('CRITICAL', 'sub', () => { order.push('critical'); });

      // Stop processing to queue up messages
      eventBus.stopProcessing();

      await eventBus.publish('NORMAL', { agent: 'test' }, { priority: MessagePriority.NORMAL });
      await eventBus.publish('CRITICAL', { agent: 'test' }, { priority: MessagePriority.CRITICAL });

      // Resume processing
      eventBus.startProcessing();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Critical should be processed first
      expect(order[0]).toBe('critical');
    });

    test('should provide queue depths', () => {
      const depths = eventBus.getQueueDepths();

      expect(depths).toHaveProperty('CRITICAL');
      expect(depths).toHaveProperty('HIGH');
      expect(depths).toHaveProperty('NORMAL');
      expect(depths).toHaveProperty('LOW');
      expect(depths).toHaveProperty('DEFERRED');
    });
  });

  describe('request-response pattern', () => {
    test('should handle request-response', async () => {
      // Set up responder
      eventBus.subscribe('GET_DATA', 'responder', (data) => {
        return { result: data.id * 2 };
      });

      const response = await eventBus.request('GET_DATA', { agent: 'test', id: 5 });

      expect(response.result).toBe(10);
    });

    test('should timeout on no response', async () => {
      // No responder set up

      await expect(
        eventBus.request('NO_RESPONDER', { agent: 'test' }, { timeout: 100 })
      ).rejects.toThrow('timed out');
    });

    test('should handle response errors', async () => {
      eventBus.subscribe('ERROR_REQUEST', 'responder', () => {
        throw new Error('Handler error');
      });

      await expect(
        eventBus.request('ERROR_REQUEST', { agent: 'test' }, { timeout: 500 })
      ).rejects.toThrow('Handler error');
    });

    test('should track request stats', async () => {
      eventBus.subscribe('STATS_TEST', 'responder', () => ({ ok: true }));

      await eventBus.request('STATS_TEST', { agent: 'test' });

      const stats = eventBus.getStats();
      expect(stats.requestsSent).toBeGreaterThanOrEqual(1);
      expect(stats.requestsCompleted).toBeGreaterThanOrEqual(1);
    });
  });

  describe('broadcast channels', () => {
    test('should broadcast to channel subscribers', async () => {
      const received = [];

      eventBus.subscribeToBroadcast(BroadcastChannel.SYSTEM, 'sub1', (data) => {
        received.push({ sub: 'sub1', data });
      });

      eventBus.subscribeToBroadcast(BroadcastChannel.SYSTEM, 'sub2', (data) => {
        received.push({ sub: 'sub2', data });
      });

      await eventBus.broadcast(BroadcastChannel.SYSTEM, { message: 'hello' });

      expect(received).toHaveLength(2);
      expect(received[0].data.message).toBe('hello');
      expect(received[1].data.message).toBe('hello');
    });

    test('should unsubscribe from broadcast', async () => {
      let count = 0;

      const unsub = eventBus.subscribeToBroadcast(BroadcastChannel.SYSTEM, 'sub', () => {
        count++;
      });

      await eventBus.broadcast(BroadcastChannel.SYSTEM, {});
      expect(count).toBe(1);

      unsub();

      await eventBus.broadcast(BroadcastChannel.SYSTEM, {});
      expect(count).toBe(1);
    });

    test('should have standard broadcast channels', () => {
      expect(BroadcastChannel.SYSTEM).toBeDefined();
      expect(BroadcastChannel.AGENTS).toBeDefined();
      expect(BroadcastChannel.ALERTS).toBeDefined();
      expect(BroadcastChannel.STATUS).toBeDefined();
    });
  });

  describe('event history', () => {
    test('should store event history', async () => {
      await eventBus.publish('EVENT1', { agent: 'test1' });
      await eventBus.publish('EVENT2', { agent: 'test2' });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      const history = eventBus.getHistory();
      expect(history.length).toBeGreaterThanOrEqual(2);
    });

    test('should filter history by event type', async () => {
      await eventBus.publish('TYPE_A', { agent: 'test' });
      await eventBus.publish('TYPE_B', { agent: 'test' });
      await eventBus.publish('TYPE_A', { agent: 'test' });

      await new Promise(resolve => setTimeout(resolve, 100));

      const history = eventBus.getHistory({ eventType: 'TYPE_A' });
      expect(history.every(e => e.type === 'TYPE_A')).toBe(true);
    });

    test('should filter history by priority', async () => {
      await eventBus.publish('HIGH_P', { agent: 'test' }, { priority: MessagePriority.HIGH });
      await eventBus.publish('LOW_P', { agent: 'test' }, { priority: MessagePriority.LOW });

      await new Promise(resolve => setTimeout(resolve, 100));

      const history = eventBus.getHistory({ priority: MessagePriority.HIGH });
      expect(history.every(e => e.priority === MessagePriority.HIGH)).toBe(true);
    });

    test('should clear history', async () => {
      await eventBus.publish('EVENT', { agent: 'test' });
      await new Promise(resolve => setTimeout(resolve, 50));

      eventBus.clearHistory();
      expect(eventBus.getHistory()).toHaveLength(0);
    });
  });

  describe('subscriber tracking', () => {
    test('should track subscribers', () => {
      eventBus.subscribe('EVENT', 'sub1', () => {});
      eventBus.subscribe('EVENT', 'sub2', () => {});

      const subs = eventBus.getSubscribers('EVENT');
      expect(subs).toHaveLength(2);
      expect(subs.map(s => s.name)).toContain('sub1');
      expect(subs.map(s => s.name)).toContain('sub2');
    });

    test('should get all subscribers', () => {
      eventBus.subscribe('EVENT1', 'sub1', () => {});
      eventBus.subscribe('EVENT2', 'sub2', () => {});

      const allSubs = eventBus.getSubscribers();
      expect(allSubs).toHaveProperty('EVENT1');
      expect(allSubs).toHaveProperty('EVENT2');
    });
  });

  describe('statistics', () => {
    test('should track stats', async () => {
      await eventBus.publish('EVENT', { agent: 'test' });
      await new Promise(resolve => setTimeout(resolve, 50));

      const stats = eventBus.getStats();

      expect(stats.messagesPublished).toBeGreaterThanOrEqual(1);
      expect(stats.messagesProcessed).toBeGreaterThanOrEqual(1);
      expect(stats.queueDepths).toBeDefined();
    });
  });

  describe('priority constants', () => {
    test('should have all priority levels', () => {
      expect(MessagePriority.CRITICAL).toBe(0);
      expect(MessagePriority.HIGH).toBe(1);
      expect(MessagePriority.NORMAL).toBe(2);
      expect(MessagePriority.LOW).toBe(3);
      expect(MessagePriority.DEFERRED).toBe(4);
    });
  });

  describe('convenience methods', () => {
    test('publishCritical should use critical priority', async () => {
      let receivedPriority = null;

      eventBus.subscribeToAll('monitor', (data, event) => {
        if (event.type === 'CRITICAL_EVENT') {
          receivedPriority = event.priority;
        }
      });

      await eventBus.publishCritical('CRITICAL_EVENT', { agent: 'test' });
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(receivedPriority).toBe(MessagePriority.CRITICAL);
    });

    test('publishHigh should use high priority', async () => {
      let receivedPriority = null;

      eventBus.subscribeToAll('monitor', (data, event) => {
        if (event.type === 'HIGH_EVENT') {
          receivedPriority = event.priority;
        }
      });

      await eventBus.publishHigh('HIGH_EVENT', { agent: 'test' });
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(receivedPriority).toBe(MessagePriority.HIGH);
    });
  });

  describe('singleton pattern', () => {
    test('getEnhancedEventBus should return same instance', () => {
      resetEnhancedEventBus();
      const bus1 = getEnhancedEventBus({ persistMessages: false });
      const bus2 = getEnhancedEventBus({ persistMessages: false });
      expect(bus1).toBe(bus2);
    });
  });

  describe('error handling', () => {
    test('should handle subscriber errors gracefully', async () => {
      let errorCaught = false;

      eventBus.subscribe('ERROR_OCCURRED', 'error-monitor', () => {
        errorCaught = true;
      });

      eventBus.subscribe('WILL_ERROR', 'faulty', () => {
        throw new Error('Subscriber error');
      });

      await eventBus.publish('WILL_ERROR', { agent: 'test' });
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(errorCaught).toBe(true);
    });
  });
});
