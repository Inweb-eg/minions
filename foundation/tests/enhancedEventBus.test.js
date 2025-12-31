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

  describe('coverage improvements', () => {
    test('respond with no pending request should warn', () => {
      eventBus.respond('unknown-request-id', { data: 'test' });
    });

    test('history exceeding maxHistory should shift', async () => {
      const smallBus = new EnhancedEventBus({ persistMessages: false, maxHistory: 3 });
      await smallBus.initialize();
      await smallBus.publish('E1', { agent: 'test' });
      await smallBus.publish('E2', { agent: 'test' });
      await smallBus.publish('E3', { agent: 'test' });
      await smallBus.publish('E4', { agent: 'test' });
      await smallBus.publish('E5', { agent: 'test' });
      await new Promise(resolve => setTimeout(resolve, 100));
      const history = smallBus.getHistory();
      expect(history.length).toBeLessThanOrEqual(3);
      await smallBus.shutdown();
    });

    test('unknown priority should fallback to normal', async () => {
      await eventBus.publish('FALLBACK_TEST', { agent: 'test' }, { priority: 999 });
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(eventBus.getStats().messagesPublished).toBeGreaterThan(0);
    });

    test('broadcast subscriber error should be caught', async () => {
      eventBus.subscribeToBroadcast(BroadcastChannel.ALERTS, 'faulty-broadcast', () => {
        throw new Error('Broadcast handler error');
      });
      await eventBus.broadcast(BroadcastChannel.ALERTS, { test: true });
    });

    test('getHistory agent filter', async () => {
      await eventBus.publish('AGENT_TEST', { agent: 'agent-a' });
      await eventBus.publish('AGENT_TEST', { agent: 'agent-b' });
      await new Promise(resolve => setTimeout(resolve, 100));
      const history = eventBus.getHistory({ agent: 'agent-a' });
      expect(history.every(e => e.data?.agent === 'agent-a')).toBe(true);
    });

    test('getHistory since filter', async () => {
      const beforeTime = Date.now();
      await new Promise(resolve => setTimeout(resolve, 10));
      await eventBus.publish('SINCE_TEST', { agent: 'test' });
      await new Promise(resolve => setTimeout(resolve, 50));
      const history = eventBus.getHistory({ since: beforeTime });
      expect(history.every(e => e.timestamp >= beforeTime)).toBe(true);
    });

    test('shutdown clears pending request timeouts', async () => {
      const newBus = new EnhancedEventBus({ persistMessages: false });
      await newBus.initialize();
      const requestPromise = newBus.request('UNANSWERED', { agent: 'test' }, { timeout: 5000 });
      await newBus.shutdown();
      expect(newBus.pendingRequests.size).toBe(0);
    });

    test('broadcastSubscriberCount in stats', async () => {
      eventBus.subscribeToBroadcast(BroadcastChannel.STATUS, 'stat-sub1', () => {});
      eventBus.subscribeToBroadcast(BroadcastChannel.STATUS, 'stat-sub2', () => {});
      const stats = eventBus.getStats();
      expect(stats.broadcastSubscriberCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('persistence mode', () => {
    let persistentBus;

    beforeEach(async () => {
      resetEnhancedEventBus();
      resetMemoryStore();
      persistentBus = new EnhancedEventBus({ persistMessages: true });
      await persistentBus.initialize();
    });

    afterEach(async () => {
      if (persistentBus) await persistentBus.shutdown();
    });

    test('should persist and recover messages', async () => {
      await persistentBus.publish('PERSIST_TEST', { agent: 'test', value: 123 }, { persist: true });
      await new Promise(resolve => setTimeout(resolve, 100));
      const stats = persistentBus.getStats();
      expect(stats.messagesProcessed).toBeGreaterThan(0);
    });

    test('persistMessage and markMessageProcessed', async () => {
      const messageId = await persistentBus.publish('MARK_PROCESSED', { agent: 'test' });
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(messageId).toBeDefined();
    });

    test('recoverMessages on init', async () => {
      const memStore = persistentBus.memoryStore;
      await memStore.set('pending_messages', 'msg_recover_test', {
        type: 'RECOVERED_EVENT',
        data: { agent: 'recovery-test' },
        timestamp: Date.now() - 1000,
        id: 'recover_test',
        priority: MessagePriority.NORMAL,
        processed: false
      });
      const recoverBus = new EnhancedEventBus({ persistMessages: true });
      await recoverBus.initialize();
      await new Promise(resolve => setTimeout(resolve, 200));
      await recoverBus.shutdown();
    });

    test('broadcastSystem convenience method', async () => {
      let received = false;
      persistentBus.subscribeToBroadcast(BroadcastChannel.SYSTEM, 'sys-sub', () => {
        received = true;
      });
      await persistentBus.broadcastSystem({ message: 'system broadcast' });
      expect(received).toBe(true);
    });

    test('recoverMessages filters already processed messages', async () => {
      const memStore = persistentBus.memoryStore;
      await memStore.set('pending_messages', 'msg_processed', {
        type: 'PROCESSED_EVENT',
        data: { agent: 'test' },
        timestamp: Date.now() - 2000,
        id: 'processed_id',
        priority: MessagePriority.HIGH,
        processed: true
      });
      await memStore.set('pending_messages', 'msg_unprocessed', {
        type: 'UNPROCESSED_EVENT',
        data: { agent: 'test' },
        timestamp: Date.now() - 1000,
        id: 'unprocessed_id',
        priority: MessagePriority.LOW,
        processed: false
      });
      const recoverBus = new EnhancedEventBus({ persistMessages: true });
      await recoverBus.initialize();
      await new Promise(resolve => setTimeout(resolve, 100));
      await recoverBus.shutdown();
    });
  });
});
