import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock the dependencies
jest.unstable_mockModule('../manager-agent/orchestrator.js', () => ({
  getOrchestrator: jest.fn(() => ({
    registerAgent: jest.fn()
  }))
}));

jest.unstable_mockModule('../../foundation/event-bus/AgentEventBus.js', () => ({
  getEventBus: jest.fn(() => ({
    subscribe: jest.fn(() => jest.fn()),
    publish: jest.fn()
  }))
}));

jest.unstable_mockModule('../flutter-writer-agent/index.js', () => ({
  getFlutterWriterAgent: jest.fn(() => ({
    initialize: jest.fn(),
    configure: jest.fn(),
    generateWidget: jest.fn(async () => ({ success: true, filePath: 'test.dart' }))
  }))
}));

jest.unstable_mockModule('../backend-writer-agent/index.js', () => ({
  getBackendWriterAgent: jest.fn(() => ({
    initialize: jest.fn(),
    configure: jest.fn(),
    generateRoute: jest.fn(async () => ({ success: true, filePath: 'test.js' }))
  }))
}));

jest.unstable_mockModule('../frontend-writer-agent/index.js', () => ({
  getFrontendWriterAgent: jest.fn(() => ({
    initialize: jest.fn(),
    configure: jest.fn(),
    generateComponent: jest.fn(async () => ({ success: true, filePath: 'test.tsx' }))
  }))
}));

describe('WriterAgentsRegistry', () => {
  let registry;
  let mockOrchestrator;
  let mockEventBus;

  beforeEach(async () => {
    // Reset modules for clean state
    jest.resetModules();

    // Import mocked modules
    const orchestratorModule = await import('../manager-agent/orchestrator.js');
    const eventBusModule = await import('../../foundation/event-bus/AgentEventBus.js');

    mockOrchestrator = orchestratorModule.getOrchestrator();
    mockEventBus = eventBusModule.getEventBus();

    // Import the registry
    registry = await import('../writer-agents-registry.js');
  });

  afterEach(() => {
    if (registry && registry.cleanup) {
      registry.cleanup();
    }
  });

  describe('WriterAgentType constants', () => {
    test('should define all writer agent types', () => {
      expect(registry.WriterAgentType.FLUTTER).toBe('flutter-writer');
      expect(registry.WriterAgentType.BACKEND).toBe('backend-writer');
      expect(registry.WriterAgentType.FRONTEND).toBe('frontend-writer');
    });
  });

  describe('registerWriterAgents', () => {
    test('should register all three writer agents with orchestrator', async () => {
      await registry.registerWriterAgents();

      expect(mockOrchestrator.registerAgent).toHaveBeenCalledTimes(3);

      // Verify each agent was registered
      const calls = mockOrchestrator.registerAgent.mock.calls;
      const registeredAgents = calls.map(call => call[0]);

      expect(registeredAgents).toContain('flutter-writer');
      expect(registeredAgents).toContain('backend-writer');
      expect(registeredAgents).toContain('frontend-writer');
    });

    test('should register agents with loader functions', async () => {
      await registry.registerWriterAgents();

      // Each registration should have a loader function
      mockOrchestrator.registerAgent.mock.calls.forEach(call => {
        expect(typeof call[1]).toBe('function');
      });
    });

    test('should register agents with no dependencies', async () => {
      await registry.registerWriterAgents();

      // Each registration should have empty dependencies array
      mockOrchestrator.registerAgent.mock.calls.forEach(call => {
        expect(call[2]).toEqual([]);
      });
    });
  });

  describe('initializeWriterAgents', () => {
    test('should initialize and subscribe to events', async () => {
      await registry.initializeWriterAgents();

      expect(registry.isReady()).toBe(true);
      expect(mockEventBus.subscribe).toHaveBeenCalled();
    });

    test('should not initialize twice', async () => {
      await registry.initializeWriterAgents();
      await registry.initializeWriterAgents();

      // registerAgent should only be called once (3 agents)
      expect(mockOrchestrator.registerAgent).toHaveBeenCalledTimes(3);
    });
  });

  describe('requestCodeGeneration', () => {
    test('should publish code generation request event', async () => {
      await registry.initializeWriterAgents();

      const requestId = registry.requestCodeGeneration('flutter:widget', {
        name: 'TestWidget',
        type: 'stateless'
      });

      expect(requestId).toMatch(/^gen_\d+_[a-z0-9]+$/);
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'code:generation:requested',
        expect.objectContaining({
          type: 'flutter:widget',
          spec: { name: 'TestWidget', type: 'stateless' },
          requestId
        })
      );
    });
  });

  describe('getWriterAgent', () => {
    test('should return flutter writer agent', async () => {
      const agent = await registry.getWriterAgent('flutter-writer');

      expect(agent).toBeDefined();
      expect(agent.initialize).toBeDefined();
    });

    test('should return backend writer agent', async () => {
      const agent = await registry.getWriterAgent('backend-writer');

      expect(agent).toBeDefined();
      expect(agent.initialize).toBeDefined();
    });

    test('should return frontend writer agent', async () => {
      const agent = await registry.getWriterAgent('frontend-writer');

      expect(agent).toBeDefined();
      expect(agent.initialize).toBeDefined();
    });

    test('should throw for unknown agent type', async () => {
      await expect(registry.getWriterAgent('unknown-writer'))
        .rejects.toThrow('Unknown writer agent type: unknown-writer');
    });
  });

  describe('cleanup', () => {
    test('should reset state', async () => {
      await registry.initializeWriterAgents();
      expect(registry.isReady()).toBe(true);

      registry.cleanup();
      expect(registry.isReady()).toBe(false);
    });
  });
});
