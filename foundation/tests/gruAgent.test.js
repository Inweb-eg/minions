/**
 * GruAgent Tests
 * ===============
 * Tests for the client interface web dashboard agent.
 */

import { jest } from '@jest/globals';
import EventEmitter from 'events';

// Mock sub-components before imports
const mockWebServer = {
  start: jest.fn().mockResolvedValue({ host: 'localhost', port: 2505 }),
  stop: jest.fn().mockResolvedValue(),
  shutdown: jest.fn().mockResolvedValue(),
  getStatus: jest.fn().mockReturnValue({ running: false }),
  broadcast: jest.fn(),
  sendToClient: jest.fn(),
  on: jest.fn(),
  emit: jest.fn()
};

const mockConversationEngine = {
  initialize: jest.fn().mockResolvedValue(),
  shutdown: jest.fn().mockResolvedValue(),
  chat: jest.fn().mockResolvedValue({ content: 'Hello!', provider: 'mock' }),
  summarize: jest.fn().mockResolvedValue({ features: ['feature1'] }),
  getGreeting: jest.fn().mockReturnValue('Hello, I am Gru!'),
  adapter: {}
};

const mockProjectIntake = {
  shutdown: jest.fn().mockResolvedValue(),
  startNewProject: jest.fn().mockResolvedValue({ success: true }),
  startExistingProject: jest.fn().mockResolvedValue({ success: true }),
  collectProjectInfo: jest.fn().mockResolvedValue({ summary: 'test', detected: {} }),
  detectProjectStructure: jest.fn().mockResolvedValue({ summary: 'test', detected: {} }),
  generateProjectConfig: jest.fn().mockReturnValue({ name: 'test-project', type: 'new' }),
  confirmStructure: jest.fn().mockResolvedValue({ complete: true }),
  discoverProjects: jest.fn().mockResolvedValue([])
};

const mockStatusTracker = {
  shutdown: jest.fn().mockResolvedValue(),
  start: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  reset: jest.fn(),
  update: jest.fn(),
  addError: jest.fn(),
  getStatus: jest.fn().mockReturnValue({ phase: 'IDLE', progress: 0 }),
  on: jest.fn(),
  onLucyEvent: jest.fn(),
  onSilasEvent: jest.fn()
};

const mockConversationStore = {
  initialize: jest.fn().mockResolvedValue(),
  shutdown: jest.fn().mockResolvedValue(),
  getAll: jest.fn().mockReturnValue([]),
  getGroupedByProject: jest.fn().mockReturnValue({}),
  create: jest.fn().mockResolvedValue({ id: 'conv-1' }),
  get: jest.fn().mockReturnValue(null),
  update: jest.fn().mockResolvedValue({}),
  delete: jest.fn().mockResolvedValue(true),
  addMessage: jest.fn().mockResolvedValue()
};

const mockMinionTranslator = {
  initialize: jest.fn().mockResolvedValue(),
  shutdown: jest.fn().mockResolvedValue(),
  getHistory: jest.fn().mockReturnValue([]),
  setEnabled: jest.fn(),
  isEnabled: jest.fn().mockReturnValue(true),
  clearHistory: jest.fn(),
  on: jest.fn()
};

// Mock WebServer module
jest.unstable_mockModule('../../agents/gru-agent/WebServer.js', () => ({
  default: jest.fn(() => mockWebServer)
}));

// Mock ConversationEngine module
jest.unstable_mockModule('../../agents/gru-agent/ConversationEngine.js', () => ({
  default: jest.fn(() => mockConversationEngine)
}));

// Mock ProjectIntake module
jest.unstable_mockModule('../../agents/gru-agent/ProjectIntake.js', () => ({
  default: jest.fn(() => mockProjectIntake)
}));

// Mock StatusTracker module
jest.unstable_mockModule('../../agents/gru-agent/StatusTracker.js', () => ({
  default: jest.fn(() => mockStatusTracker),
  Phase: {
    IDLE: 'IDLE',
    CONNECTING: 'CONNECTING',
    ANALYZING: 'ANALYZING',
    COMPLETED: 'COMPLETED',
    ERROR: 'ERROR'
  }
}));

// Mock ConversationStore module
jest.unstable_mockModule('../../agents/gru-agent/ConversationStore.js', () => ({
  getConversationStore: jest.fn(() => mockConversationStore),
  resetConversationStore: jest.fn()
}));

// Mock MinionTranslator module
jest.unstable_mockModule('../../agents/gru-agent/MinionTranslator.js', () => ({
  getMinionTranslator: jest.fn(() => mockMinionTranslator),
  MinionTranslator: {
    getPersonalities: jest.fn().mockReturnValue([])
  }
}));

// Import after mocks
const { GruAgent, getGruAgent, resetGruAgent, AgentState, GruEvents } = await import('../../agents/gru-agent/index.js');

describe('GruAgent', () => {
  let agent;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Reset singleton
    await resetGruAgent();

    // Create fresh instance
    agent = new GruAgent({ port: 3000 });
  });

  afterEach(async () => {
    if (agent) {
      agent.removeAllListeners();
    }
    await resetGruAgent();
  });

  describe('Initialization', () => {
    test('creates with correct identity', () => {
      expect(agent.name).toBe('GruAgent');
      expect(agent.alias).toBe('Gru');
      expect(agent.version).toBe('1.0.0');
    });

    test('starts in IDLE state', () => {
      expect(agent.state).toBe(AgentState.IDLE);
    });

    test('uses default config values', () => {
      const defaultAgent = new GruAgent();
      expect(defaultAgent.config.port).toBe(2505);
      expect(defaultAgent.config.projectRoot).toBe(process.cwd());
    });

    test('accepts custom config', () => {
      const customAgent = new GruAgent({
        port: 8080,
        projectRoot: '/custom/path'
      });

      expect(customAgent.config.port).toBe(8080);
      expect(customAgent.config.projectRoot).toBe('/custom/path');
    });

    test('has all sub-components', () => {
      expect(agent.webServer).toBeDefined();
      expect(agent.conversation).toBeDefined();
      expect(agent.projectIntake).toBeDefined();
      expect(agent.statusTracker).toBeDefined();
      expect(agent.conversationStore).toBeDefined();
      expect(agent.minionTranslator).toBeDefined();
    });

    test('initialize sets up components', async () => {
      const handler = jest.fn();
      agent.on('initialized', handler);

      await agent.initialize();

      expect(mockConversationEngine.initialize).toHaveBeenCalled();
      expect(mockConversationStore.initialize).toHaveBeenCalled();
      expect(mockMinionTranslator.initialize).toHaveBeenCalled();
      expect(handler).toHaveBeenCalled();
      expect(agent.state).toBe(AgentState.IDLE);
    });

    test('initialize handles errors', async () => {
      mockConversationEngine.initialize.mockRejectedValueOnce(new Error('AI unavailable'));

      await expect(agent.initialize()).rejects.toThrow('AI unavailable');
      expect(agent.state).toBe(AgentState.ERROR);
    });
  });

  describe('Singleton Pattern', () => {
    test('getGruAgent returns same instance', () => {
      const instance1 = getGruAgent();
      const instance2 = getGruAgent();

      expect(instance1).toBe(instance2);
    });

    test('resetGruAgent clears instance', async () => {
      const instance1 = getGruAgent();
      await resetGruAgent();
      const instance2 = getGruAgent();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Agent References', () => {
    test('setAgents stores agent references', () => {
      const mockSilas = new EventEmitter();
      const mockLucy = new EventEmitter();
      const mockNefario = {};

      agent.setAgents({
        silas: mockSilas,
        lucy: mockLucy,
        nefario: mockNefario
      });

      expect(agent.silas).toBe(mockSilas);
      expect(agent.lucy).toBe(mockLucy);
      expect(agent.nefario).toBe(mockNefario);
    });

    test('setAgents subscribes to Lucy events', () => {
      const mockLucy = new EventEmitter();

      agent.setAgents({ lucy: mockLucy });

      // Trigger Lucy event
      mockLucy.emit('completion:started', { id: 'test' });

      expect(mockStatusTracker.onLucyEvent).toHaveBeenCalled();
    });

    test('setAgents subscribes to Silas events', () => {
      const mockSilas = new EventEmitter();

      agent.setAgents({ silas: mockSilas });

      // Trigger Silas event
      mockSilas.emit('project:connected', { name: 'test' });

      expect(mockStatusTracker.onSilasEvent).toHaveBeenCalled();
    });
  });

  describe('Learning System', () => {
    test('setLearningSystem stores reference', () => {
      const mockKnowledgeBrain = { on: jest.fn() };

      agent.setLearningSystem(mockKnowledgeBrain);

      expect(agent.knowledgeBrain).toBe(mockKnowledgeBrain);
    });

    test('records learning events', () => {
      const mockKnowledgeBrain = { on: jest.fn() };
      agent.setLearningSystem(mockKnowledgeBrain);

      // Simulate recording event
      agent._recordLearningEvent('test:event', { data: 'test' });

      expect(agent.learningEventLog.length).toBe(1);
      expect(agent.learningEventLog[0].type).toBe('test:event');
    });

    test('limits learning event log to 500 entries', () => {
      const mockKnowledgeBrain = { on: jest.fn() };
      agent.setLearningSystem(mockKnowledgeBrain);

      // Add 600 events
      for (let i = 0; i < 600; i++) {
        agent._recordLearningEvent('test:event', { index: i });
      }

      expect(agent.learningEventLog.length).toBe(500);
    });
  });

  describe('Web Server Control', () => {
    test('start launches web server', async () => {
      const result = await agent.start();

      expect(mockWebServer.start).toHaveBeenCalled();
      expect(result.host).toBe('localhost');
      expect(result.port).toBe(2505);
      expect(agent.state).toBe(AgentState.LISTENING);
    });

    test('start emits GRU_STARTED event', async () => {
      const handler = jest.fn();
      agent.on(GruEvents.GRU_STARTED, handler);

      await agent.start();

      expect(handler).toHaveBeenCalled();
    });

    test('start handles errors', async () => {
      mockWebServer.start.mockRejectedValueOnce(new Error('Port in use'));

      await expect(agent.start()).rejects.toThrow('Port in use');
      expect(agent.state).toBe(AgentState.ERROR);
    });

    test('stop shuts down web server', async () => {
      await agent.start();
      const result = await agent.stop();

      expect(mockWebServer.stop).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(agent.state).toBe(AgentState.IDLE);
    });
  });

  describe('Message Handling', () => {
    test('handleMessage processes chat', async () => {
      const response = await agent.handleMessage('Hello', 'client-1');

      expect(mockConversationEngine.chat).toHaveBeenCalledWith('Hello');
      expect(mockWebServer.sendToClient).toHaveBeenCalledWith('client-1', expect.objectContaining({
        type: 'chat:response'
      }));
      expect(response.content).toBe('Hello!');
    });

    test('handleMessage emits conversation event', async () => {
      const handler = jest.fn();
      agent.on(GruEvents.CONVERSATION_MESSAGE, handler);

      await agent.handleMessage('Hi', 'client-1');

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        clientId: 'client-1',
        userMessage: 'Hi'
      }));
    });

    test('handleMessage handles errors', async () => {
      mockConversationEngine.chat.mockRejectedValueOnce(new Error('AI error'));

      await expect(agent.handleMessage('Hi', 'client-1')).rejects.toThrow('AI error');
      expect(mockWebServer.sendToClient).toHaveBeenCalledWith('client-1', expect.objectContaining({
        type: 'error'
      }));
    });
  });

  describe('Project Flow', () => {
    test('startNewProject initiates new project flow', async () => {
      const handler = jest.fn();
      agent.on(GruEvents.PROJECT_NEW, handler);

      const result = await agent.startNewProject({ name: 'test' }, 'client-1');

      expect(mockProjectIntake.startNewProject).toHaveBeenCalled();
      expect(mockWebServer.sendToClient).toHaveBeenCalledWith('client-1', expect.objectContaining({
        type: 'project:flow',
        flow: 'new'
      }));
      expect(handler).toHaveBeenCalled();
    });

    test('startExistingProject with path triggers scan', async () => {
      const handler = jest.fn();
      agent.on(GruEvents.SCAN_COMPLETE, handler);

      await agent.startExistingProject({ path: '/test/path' }, 'client-1');

      expect(mockProjectIntake.collectProjectInfo).toHaveBeenCalled();
      expect(handler).toHaveBeenCalled();
    });

    test('startExistingProject without path requests path', async () => {
      await agent.startExistingProject({}, 'client-1');

      expect(mockWebServer.sendToClient).toHaveBeenCalledWith('client-1', expect.objectContaining({
        type: 'project:needsPath'
      }));
    });

    test('scanProject detects project structure', async () => {
      const handler = jest.fn();
      agent.on(GruEvents.SCAN_COMPLETE, handler);

      await agent.scanProject('/test/path', 'client-1');

      expect(mockProjectIntake.detectProjectStructure).toHaveBeenCalledWith('/test/path');
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('Plan Management', () => {
    test('requestPlan generates plan', async () => {
      const handler = jest.fn();
      agent.on(GruEvents.PLAN_READY, handler);

      const plan = await agent.requestPlan('client-1');

      expect(mockConversationEngine.summarize).toHaveBeenCalled();
      expect(mockProjectIntake.generateProjectConfig).toHaveBeenCalled();
      expect(agent.currentPlan).toBe(plan);
      expect(handler).toHaveBeenCalled();
    });

    test('requestPlan uses Dr. Nefario when available', async () => {
      const mockNefario = {
        generatePlan: jest.fn().mockResolvedValue({ id: 'plan-1', tasks: [] })
      };
      agent.setAgents({ nefario: mockNefario });

      await agent.requestPlan('client-1');

      expect(mockNefario.generatePlan).toHaveBeenCalled();
    });

    test('approvePlan throws if no plan', async () => {
      await expect(agent.approvePlan('client-1')).rejects.toThrow('No plan to approve');
    });

    test('approvePlan starts execution', async () => {
      await agent.requestPlan('client-1');

      const handler = jest.fn();
      agent.on(GruEvents.PLAN_APPROVED, handler);

      await agent.approvePlan('client-1');

      expect(handler).toHaveBeenCalled();
      expect(agent.state).toBe(AgentState.EXECUTING);
    });
  });

  describe('Execution Control', () => {
    beforeEach(async () => {
      await agent.requestPlan('client-1');
    });

    test('startExecution sets up tracking', async () => {
      await agent.startExecution('client-1');

      expect(mockStatusTracker.start).toHaveBeenCalled();
      expect(agent.state).toBe(AgentState.EXECUTING);
    });

    test('pauseExecution pauses tracking', async () => {
      await agent.startExecution('client-1');
      const result = await agent.pauseExecution('client-1');

      expect(mockStatusTracker.pause).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(agent.state).toBe(AgentState.PAUSED);
    });

    test('resumeExecution resumes tracking', async () => {
      await agent.startExecution('client-1');
      await agent.pauseExecution('client-1');
      const result = await agent.resumeExecution('client-1');

      expect(mockStatusTracker.resume).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(agent.state).toBe(AgentState.EXECUTING);
    });

    test('stopExecution resets everything', async () => {
      await agent.startExecution('client-1');
      const result = await agent.stopExecution('client-1');

      expect(mockStatusTracker.reset).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(agent.state).toBe(AgentState.IDLE);
    });
  });

  describe('Status & Broadcasting', () => {
    test('getStatus returns current state', async () => {
      await agent.initialize();

      const status = agent.getStatus();

      expect(status.name).toBe('GruAgent');
      expect(status.alias).toBe('Gru');
      expect(status.state).toBe(AgentState.IDLE);
      expect(status.server).toBeDefined();
      expect(status.execution).toBeDefined();
    });

    test('broadcastStatus sends to all clients', async () => {
      await agent.initialize();

      const status = agent.broadcastStatus();

      expect(mockWebServer.broadcast).toHaveBeenCalledWith({
        type: 'status:update',
        status
      });
    });
  });

  describe('Shutdown', () => {
    test('shutdown cleans up all components', async () => {
      await agent.initialize();

      const handler = jest.fn();
      agent.on('shutdown', handler);

      await agent.shutdown();

      expect(mockWebServer.shutdown).toHaveBeenCalled();
      expect(mockConversationEngine.shutdown).toHaveBeenCalled();
      expect(mockProjectIntake.shutdown).toHaveBeenCalled();
      expect(mockStatusTracker.shutdown).toHaveBeenCalled();
      expect(mockConversationStore.shutdown).toHaveBeenCalled();
      expect(mockMinionTranslator.shutdown).toHaveBeenCalled();
      expect(agent.state).toBe(AgentState.SHUTDOWN);
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('States', () => {
    test('AgentState has all states', () => {
      expect(AgentState.IDLE).toBe('IDLE');
      expect(AgentState.INITIALIZING).toBe('INITIALIZING');
      expect(AgentState.LISTENING).toBe('LISTENING');
      expect(AgentState.CONVERSING).toBe('CONVERSING');
      expect(AgentState.COLLECTING).toBe('COLLECTING');
      expect(AgentState.SCANNING).toBe('SCANNING');
      expect(AgentState.PLANNING).toBe('PLANNING');
      expect(AgentState.CONFIRMING).toBe('CONFIRMING');
      expect(AgentState.EXECUTING).toBe('EXECUTING');
      expect(AgentState.PAUSED).toBe('PAUSED');
      expect(AgentState.ERROR).toBe('ERROR');
      expect(AgentState.SHUTDOWN).toBe('SHUTDOWN');
    });
  });

  describe('Events', () => {
    test('GruEvents has all event types', () => {
      expect(GruEvents.GRU_START).toBe('gru:start');
      expect(GruEvents.GRU_STARTED).toBe('gru:started');
      expect(GruEvents.CLIENT_CONNECTED).toBe('gru:client:connected');
      expect(GruEvents.CONVERSATION_STARTED).toBe('gru:conversation:started');
      expect(GruEvents.CONVERSATION_MESSAGE).toBe('gru:conversation:message');
      expect(GruEvents.PROJECT_NEW).toBe('gru:project:new');
      expect(GruEvents.PROJECT_EXISTING).toBe('gru:project:existing');
      expect(GruEvents.SCAN_COMPLETE).toBe('gru:scan:complete');
      expect(GruEvents.PLAN_READY).toBe('gru:plan:ready');
      expect(GruEvents.PLAN_APPROVED).toBe('gru:plan:approved');
      expect(GruEvents.EXECUTION_STARTED).toBe('gru:execution:started');
      expect(GruEvents.EXECUTION_PAUSED).toBe('gru:execution:paused');
      expect(GruEvents.EXECUTION_RESUMED).toBe('gru:execution:resumed');
      expect(GruEvents.EXECUTION_STOPPED).toBe('gru:execution:stopped');
      expect(GruEvents.STATUS_UPDATE).toBe('gru:status:update');
      expect(GruEvents.GRU_ERROR).toBe('gru:error');
    });
  });
});
