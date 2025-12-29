/**
 * ProjectManagerAgent (Silas) Tests
 */

import {
  ProjectManagerAgent,
  getProjectManager,
  resetProjectManager,
  AgentState,
  ProjectManagerEvents
} from '../../agents/project-manager-agent/index.js';

describe('ProjectManagerAgent (Silas)', () => {
  let agent;

  beforeEach(() => {
    resetProjectManager();
    agent = new ProjectManagerAgent({
      projectRoot: '/tmp/test-minions',
      projectsDir: 'projects'
    });
  });

  afterEach(async () => {
    if (agent) {
      await agent.shutdown();
    }
  });

  describe('Constructor', () => {
    test('should create agent with correct name and alias', () => {
      expect(agent.name).toBe('ProjectManagerAgent');
      expect(agent.alias).toBe('Silas');
    });

    test('should start in IDLE state', () => {
      expect(agent.state).toBe(AgentState.IDLE);
    });

    test('should initialize sub-components', () => {
      expect(agent.registry).toBeDefined();
      expect(agent.scanner).toBeDefined();
      expect(agent.initializer).toBeDefined();
    });
  });

  describe('Singleton Pattern', () => {
    test('should return same instance from getProjectManager', () => {
      const instance1 = getProjectManager();
      const instance2 = getProjectManager();
      expect(instance1).toBe(instance2);
    });

    test('should reset instance with resetProjectManager', async () => {
      const instance1 = getProjectManager();
      resetProjectManager();
      const instance2 = getProjectManager();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('getStatus', () => {
    test('should return current agent status', () => {
      const status = agent.getStatus();

      expect(status).toEqual({
        name: 'ProjectManagerAgent',
        alias: 'Silas',
        version: '1.0.0',
        state: AgentState.IDLE,
        metrics: expect.any(Object)
      });
    });
  });

  describe('getMetrics', () => {
    test('should return agent metrics', () => {
      const metrics = agent.getMetrics();

      expect(metrics).toHaveProperty('projectsConnected');
      expect(metrics).toHaveProperty('scansCompleted');
      expect(metrics).toHaveProperty('errorsCount');
      expect(metrics).toHaveProperty('state');
      expect(metrics).toHaveProperty('projectCount');
    });
  });

  describe('list', () => {
    test('should return empty array initially', () => {
      const projects = agent.list();
      expect(projects).toEqual([]);
    });
  });

  describe('Events', () => {
    test('should export event types', () => {
      expect(ProjectManagerEvents.PROJECT_CONNECT).toBe('project:connect');
      expect(ProjectManagerEvents.PROJECT_CONNECTED).toBe('project:connected');
      expect(ProjectManagerEvents.PROJECT_SCAN).toBe('project:scan');
      expect(ProjectManagerEvents.PROJECT_ERROR).toBe('project:error');
    });
  });
});
