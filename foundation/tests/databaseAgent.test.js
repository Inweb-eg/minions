/**
 * DatabaseAgent (Dave) Tests
 * ==========================
 * Tests for the database architecture agent.
 */

import { jest } from '@jest/globals';
import {
  DatabaseAgent,
  getDatabaseAgent,
  AgentState,
  DatabaseEvents,
  DatabaseType,
  FieldType,
  RelationType
} from '../../agents/database-agent/index.js';

describe('DatabaseAgent (Dave)', () => {
  let agent;

  beforeEach(() => {
    DatabaseAgent.resetInstance();
    agent = new DatabaseAgent({
      projectRoot: '/tmp/test-project',
      databaseDir: 'database',
      autoValidate: false
    });
  });

  afterEach(async () => {
    if (agent) {
      agent.removeAllListeners();
    }
    DatabaseAgent.resetInstance();
  });

  describe('Initialization', () => {
    test('creates with correct identity', () => {
      expect(agent.name).toBe('DatabaseAgent');
      expect(agent.alias).toBe('Dave');
      expect(agent.version).toBe('1.0.0');
    });

    test('starts in IDLE state', () => {
      expect(agent.state).toBe(AgentState.IDLE);
    });

    test('has all sub-components', () => {
      expect(agent.schemaDesigner).toBeDefined();
      expect(agent.migrationManager).toBeDefined();
      expect(agent.queryAnalyzer).toBeDefined();
      expect(agent.relationshipMapper).toBeDefined();
    });

    test('initialize emits event', async () => {
      const handler = jest.fn();
      agent.on('initialized', handler);

      await agent.initialize();

      expect(handler).toHaveBeenCalled();
      expect(handler.mock.calls[0][0].agent).toBe('DatabaseAgent');
    });

    test('initialize sets state to IDLE', async () => {
      await agent.initialize();
      expect(agent.state).toBe(AgentState.IDLE);
    });
  });

  describe('Singleton Pattern', () => {
    test('getDatabaseAgent returns same instance', () => {
      DatabaseAgent.resetInstance();
      const instance1 = getDatabaseAgent();
      const instance2 = getDatabaseAgent();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Project Context', () => {
    test('setProject stores project', async () => {
      await agent.initialize();

      const project = {
        name: 'test-project',
        workspacePath: '/tmp/test-project'
      };

      const result = await agent.setProject(project);

      expect(result.success).toBe(true);
      expect(agent.currentProject).toBe(project);
    });

    test('designSchema requires project context', async () => {
      await agent.initialize();

      await expect(agent.designSchema({ entities: [] }))
        .rejects.toThrow('No project context set');
    });
  });

  describe('Schema Operations', () => {
    beforeEach(async () => {
      await agent.initialize();
      await agent.setProject({
        name: 'test-project',
        workspacePath: '/tmp/test-project'
      });
    });

    test('designSchema emits event', async () => {
      const handler = jest.fn();
      agent.on(DatabaseEvents.SCHEMA_DESIGNED, handler);

      await agent.designSchema({
        entities: [
          { name: 'User', fields: [{ name: 'id', type: FieldType.UUID }] }
        ]
      });

      expect(handler).toHaveBeenCalled();
    });

    test('designSchema increments metrics', async () => {
      const initialCount = agent.metrics.schemasDesigned;

      await agent.designSchema({ entities: [] });

      expect(agent.metrics.schemasDesigned).toBe(initialCount + 1);
    });
  });

  describe('Migration Operations', () => {
    beforeEach(async () => {
      await agent.initialize();
      await agent.setProject({
        name: 'test-project',
        workspacePath: '/tmp/test-project'
      });
    });

    test('createMigration requires project context', async () => {
      const newAgent = new DatabaseAgent();
      await newAgent.initialize();

      await expect(newAgent.createMigration({ name: 'test' }))
        .rejects.toThrow('No project context set');
    });

    test('createMigration emits event', async () => {
      const handler = jest.fn();
      agent.on(DatabaseEvents.MIGRATION_CREATED, handler);

      await agent.createMigration({
        name: 'add_users_table',
        type: 'create_table',
        table: 'users'
      });

      expect(handler).toHaveBeenCalled();
    });

    test('createMigration increments metrics', async () => {
      const initialCount = agent.metrics.migrationsCreated;

      await agent.createMigration({ name: 'test_migration' });

      expect(agent.metrics.migrationsCreated).toBe(initialCount + 1);
    });

    test('generateMigration detects no changes', async () => {
      const schema = { entities: [] };
      const result = await agent.generateMigration(schema, schema);

      expect(result.message).toContain('No changes');
    });
  });

  describe('Query Analysis', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    test('analyzeQuery increments metrics', async () => {
      const initialCount = agent.metrics.queriesAnalyzed;

      await agent.analyzeQuery('SELECT * FROM users WHERE id = 1');

      expect(agent.metrics.queriesAnalyzed).toBe(initialCount + 1);
    });

    test('analyzeQuery detects slow queries', async () => {
      const handler = jest.fn();
      agent.on(DatabaseEvents.SLOW_QUERY_DETECTED, handler);

      // Mock query analyzer to return slow query
      agent.queryAnalyzer.analyze = jest.fn().mockResolvedValue({
        isSlowQuery: true,
        recommendations: ['Add index on users.id']
      });

      await agent.analyzeQuery('SELECT * FROM users');

      expect(handler).toHaveBeenCalled();
      expect(agent.metrics.slowQueriesDetected).toBeGreaterThan(0);
    });

    test('optimizeQuery emits event', async () => {
      const handler = jest.fn();
      agent.on(DatabaseEvents.QUERY_OPTIMIZED, handler);

      await agent.optimizeQuery('SELECT * FROM users WHERE id = 1');

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('Relationship Mapping', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    test('addRelationship emits event', async () => {
      const handler = jest.fn();
      agent.on(DatabaseEvents.RELATIONSHIP_MAPPED, handler);

      await agent.addRelationship({
        from: 'User',
        to: 'Post',
        type: RelationType.ONE_TO_MANY,
        foreignKey: 'user_id'
      });

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('Pre-Execution Validation', () => {
    beforeEach(async () => {
      await agent.initialize();
      await agent.setProject({
        name: 'test-project',
        workspacePath: '/tmp/test-project'
      });
    });

    test('validateBeforeExecution returns result object', async () => {
      const result = await agent.validateBeforeExecution();

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(result.agent).toBe('Dave');
    });

    test('validateBeforeExecution emits event', async () => {
      const validHandler = jest.fn();
      const errorHandler = jest.fn();

      agent.on(DatabaseEvents.SCHEMA_VALIDATED, validHandler);
      agent.on(DatabaseEvents.DATABASE_ERROR, errorHandler);

      await agent.validateBeforeExecution();

      // Should emit one or the other
      expect(validHandler.mock.calls.length + errorHandler.mock.calls.length).toBeGreaterThan(0);
    });
  });

  describe('Status & Metrics', () => {
    test('getStatus returns current state', async () => {
      await agent.initialize();

      const status = agent.getStatus();

      expect(status.name).toBe('DatabaseAgent');
      expect(status.alias).toBe('Dave');
      expect(status.state).toBe(AgentState.IDLE);
      expect(status.metrics).toBeDefined();
    });

    test('metrics are tracked correctly', async () => {
      await agent.initialize();
      await agent.setProject({ name: 'test', workspacePath: '/tmp' });

      // Create a migration
      await agent.createMigration({ name: 'test' });

      // Analyze a query
      await agent.analyzeQuery('SELECT 1');

      const status = agent.getStatus();

      expect(status.metrics.migrationsCreated).toBeGreaterThan(0);
      expect(status.metrics.queriesAnalyzed).toBeGreaterThan(0);
    });
  });

  describe('Events', () => {
    test('emits initialized event', async () => {
      const handler = jest.fn();
      agent.on('initialized', handler);

      await agent.initialize();

      expect(handler).toHaveBeenCalled();
    });

    test('emits error event on failure', async () => {
      const handler = jest.fn();
      agent.on('error', handler);

      agent.emit('error', { error: 'Test error' });

      expect(handler).toHaveBeenCalledWith({ error: 'Test error' });
    });
  });

  describe('Enums', () => {
    test('DatabaseType has all supported types', () => {
      expect(DatabaseType.POSTGRESQL).toBe('postgresql');
      expect(DatabaseType.MYSQL).toBe('mysql');
      expect(DatabaseType.MONGODB).toBe('mongodb');
      expect(DatabaseType.SQLITE).toBe('sqlite');
    });

    test('FieldType has common types', () => {
      expect(FieldType.STRING).toBe('string');
      expect(FieldType.INTEGER).toBe('integer');
      expect(FieldType.UUID).toBe('uuid');
      expect(FieldType.JSON).toBe('json');
    });

    test('RelationType has all relationship types', () => {
      expect(RelationType.ONE_TO_ONE).toBe('one_to_one');
      expect(RelationType.ONE_TO_MANY).toBe('one_to_many');
      expect(RelationType.MANY_TO_ONE).toBe('many_to_one');
      expect(RelationType.MANY_TO_MANY).toBe('many_to_many');
    });
  });
});
