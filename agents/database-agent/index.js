/**
 * Minions - DatabaseAgent (Dave)
 * ==============================
 * Named after Dave - the meticulous Database Architect.
 * Designs schemas, manages migrations, optimizes queries,
 * and maintains database documentation.
 *
 * Responsibilities:
 * - database/ folder management (schema.json, migrations/, indexes.json)
 * - Schema design and validation
 * - Migration generation and tracking
 * - Query analysis and optimization
 * - Relationship mapping and documentation
 *
 * @author Kareem Hussein
 * @company Inweb Software Solutions
 */

import EventEmitter from 'events';
import path from 'path';
import fs from 'fs/promises';
import { createLogger } from '../../foundation/common/logger.js';

import SchemaDesigner from './SchemaDesigner.js';
import MigrationManager from './MigrationManager.js';
import QueryAnalyzer from './QueryAnalyzer.js';
import RelationshipMapper from './RelationshipMapper.js';

// Agent States
export const AgentState = {
  IDLE: 'IDLE',
  INITIALIZING: 'INITIALIZING',
  DESIGNING: 'DESIGNING',
  MIGRATING: 'MIGRATING',
  ANALYZING: 'ANALYZING',
  MAPPING: 'MAPPING',
  VALIDATING: 'VALIDATING',
  PAUSED: 'PAUSED',
  ERROR: 'ERROR',
  SHUTDOWN: 'SHUTDOWN'
};

// Database Event Types (also defined in eventTypes.js)
export const DatabaseEvents = {
  // Schema operations
  SCHEMA_DESIGNED: 'database:schema:designed',
  SCHEMA_VALIDATED: 'database:schema:validated',
  SCHEMA_UPDATED: 'database:schema:updated',

  // Migration operations
  MIGRATION_CREATED: 'database:migration:created',
  MIGRATION_STARTED: 'database:migration:started',
  MIGRATION_COMPLETED: 'database:migration:completed',
  MIGRATION_FAILED: 'database:migration:failed',
  MIGRATION_ROLLED_BACK: 'database:migration:rolledback',

  // Query operations
  QUERY_OPTIMIZED: 'database:query:optimized',
  QUERY_ANALYZED: 'database:query:analyzed',
  SLOW_QUERY_DETECTED: 'database:query:slow',

  // Relationship operations
  RELATIONSHIP_MAPPED: 'database:relationship:mapped',
  RELATIONSHIP_VALIDATED: 'database:relationship:validated',

  // General
  DATABASE_ERROR: 'database:error'
};

// Supported database types
export const DatabaseType = {
  POSTGRESQL: 'postgresql',
  MYSQL: 'mysql',
  MONGODB: 'mongodb',
  SQLITE: 'sqlite',
  MSSQL: 'mssql'
};

// Schema field types
export const FieldType = {
  STRING: 'string',
  INTEGER: 'integer',
  FLOAT: 'float',
  BOOLEAN: 'boolean',
  DATE: 'date',
  DATETIME: 'datetime',
  TIMESTAMP: 'timestamp',
  TEXT: 'text',
  JSON: 'json',
  ARRAY: 'array',
  ENUM: 'enum',
  UUID: 'uuid',
  BINARY: 'binary'
};

// Relationship types
export const RelationType = {
  ONE_TO_ONE: 'one_to_one',
  ONE_TO_MANY: 'one_to_many',
  MANY_TO_ONE: 'many_to_one',
  MANY_TO_MANY: 'many_to_many'
};

// Singleton instance
let instance = null;

export class DatabaseAgent extends EventEmitter {
  constructor(config = {}) {
    super();

    this.name = 'DatabaseAgent';
    this.alias = 'Dave';
    this.version = '1.0.0';
    this.state = AgentState.IDLE;
    this.logger = createLogger(this.name);

    // Configuration
    this.config = {
      projectRoot: config.projectRoot || process.cwd(),
      databaseDir: config.databaseDir || 'database',
      migrationsDir: config.migrationsDir || 'database/migrations',
      schemaFile: config.schemaFile || 'schema.json',
      defaultDbType: config.defaultDbType || DatabaseType.POSTGRESQL,
      autoValidate: config.autoValidate !== false,
      generateTypes: config.generateTypes !== false,
      ...config
    };

    // Sub-components
    this.schemaDesigner = new SchemaDesigner(this.config);
    this.migrationManager = new MigrationManager(this.config);
    this.queryAnalyzer = new QueryAnalyzer(this.config);
    this.relationshipMapper = new RelationshipMapper(this.config);

    // Current project context
    this.currentProject = null;
    this.eventBus = null;

    // Metrics
    this.metrics = {
      schemasDesigned: 0,
      migrationsCreated: 0,
      migrationsRun: 0,
      migrationsRolledBack: 0,
      queriesAnalyzed: 0,
      queriesOptimized: 0,
      slowQueriesDetected: 0,
      relationshipsMapped: 0,
      lastActivity: null
    };

    this._setupInternalHandlers();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config = {}) {
    if (!instance) {
      instance = new DatabaseAgent(config);
    }
    return instance;
  }

  /**
   * Reset singleton (for testing)
   */
  static resetInstance() {
    if (instance) {
      instance.removeAllListeners();
      instance = null;
    }
  }

  /**
   * Initialize the agent with optional eventBus connection
   */
  async initialize(eventBus = null) {
    this.state = AgentState.INITIALIZING;
    this.logger.info(`Initializing ${this.name} (${this.alias})...`);

    try {
      if (eventBus) {
        this.eventBus = eventBus;
        this._subscribeToEvents();
      }

      // Initialize sub-components
      await this.schemaDesigner.initialize();
      await this.migrationManager.initialize();
      await this.queryAnalyzer.initialize();
      await this.relationshipMapper.initialize();

      // Wire up sub-component events
      this._wireSubComponents();

      this.state = AgentState.IDLE;
      this.metrics.lastActivity = new Date().toISOString();

      this.emit('initialized', {
        agent: this.name,
        alias: this.alias,
        version: this.version
      });

      this.logger.info(`${this.alias} initialized successfully`);
      return { success: true, agent: this.name };
    } catch (error) {
      this.state = AgentState.ERROR;
      this.logger.error(`Failed to initialize: ${error.message}`);
      this.emit('error', { agent: this.name, error: error.message });
      throw error;
    }
  }

  /**
   * Set the current project context
   * @param {object} project - Project from ProjectManagerAgent
   */
  async setProject(project) {
    this.currentProject = project;
    this.logger.info(`Project context set: ${project.name}`);

    // Update sub-components with project context
    const projectDbPath = path.join(project.workspacePath, this.config.databaseDir);
    const projectMigrationsPath = path.join(project.workspacePath, this.config.migrationsDir);

    await this.schemaDesigner.setProjectPath(projectDbPath);
    await this.migrationManager.setProjectPath(projectMigrationsPath);
    await this.queryAnalyzer.setProjectPath(project.workspacePath);
    await this.relationshipMapper.setProjectPath(projectDbPath);

    return { success: true, project: project.name };
  }

  // ==========================================
  // Schema Design
  // ==========================================

  /**
   * Design a new schema or update existing
   * @param {object} requirements - Schema requirements
   */
  async designSchema(requirements) {
    if (!this.currentProject) {
      throw new Error('No project context set. Call setProject() first.');
    }

    this.state = AgentState.DESIGNING;
    this.logger.info(`Designing schema for: ${this.currentProject.name}`);

    try {
      const schema = await this.schemaDesigner.design(requirements);

      // Validate the designed schema
      if (this.config.autoValidate) {
        const validation = await this.schemaDesigner.validate(schema);
        if (!validation.valid) {
          throw new Error(`Schema validation failed: ${validation.errors.join(', ')}`);
        }
      }

      this.metrics.schemasDesigned++;
      this.metrics.lastActivity = new Date().toISOString();

      this.emit(DatabaseEvents.SCHEMA_DESIGNED, {
        project: this.currentProject.name,
        schema,
        timestamp: new Date().toISOString()
      });

      if (this.eventBus) {
        this.eventBus.publish(DatabaseEvents.SCHEMA_DESIGNED, {
          project: this.currentProject.name,
          schema
        });
      }

      this.state = AgentState.IDLE;
      return schema;
    } catch (error) {
      this.state = AgentState.ERROR;
      this.logger.error(`Schema design failed: ${error.message}`);
      this.emit(DatabaseEvents.DATABASE_ERROR, { error: error.message });
      throw error;
    }
  }

  /**
   * Validate existing schema
   * @param {object} schema - Schema to validate (optional, uses current if not provided)
   */
  async validateSchema(schema = null) {
    this.state = AgentState.VALIDATING;

    try {
      const targetSchema = schema || await this.schemaDesigner.getCurrentSchema();
      const validation = await this.schemaDesigner.validate(targetSchema);

      this.emit(DatabaseEvents.SCHEMA_VALIDATED, validation);
      this.state = AgentState.IDLE;

      return validation;
    } catch (error) {
      this.state = AgentState.ERROR;
      throw error;
    }
  }

  /**
   * Update schema with new entity or changes
   * @param {string} entityName - Entity to update
   * @param {object} changes - Changes to apply
   */
  async updateSchema(entityName, changes) {
    this.state = AgentState.DESIGNING;

    try {
      const updated = await this.schemaDesigner.updateEntity(entityName, changes);

      this.emit(DatabaseEvents.SCHEMA_UPDATED, {
        entity: entityName,
        changes,
        timestamp: new Date().toISOString()
      });

      this.state = AgentState.IDLE;
      return updated;
    } catch (error) {
      this.state = AgentState.ERROR;
      throw error;
    }
  }

  /**
   * Get current schema
   */
  async getSchema() {
    return await this.schemaDesigner.getCurrentSchema();
  }

  /**
   * Add a new entity to the schema
   * @param {object} entity - Entity definition
   */
  async addEntity(entity) {
    return await this.schemaDesigner.addEntity(entity);
  }

  // ==========================================
  // Migration Management
  // ==========================================

  /**
   * Create a new migration
   * @param {object} options - Migration options
   */
  async createMigration(options) {
    if (!this.currentProject) {
      throw new Error('No project context set. Call setProject() first.');
    }

    this.state = AgentState.MIGRATING;
    this.logger.info(`Creating migration: ${options.name || 'unnamed'}`);

    try {
      const migration = await this.migrationManager.create(options);

      this.metrics.migrationsCreated++;
      this.metrics.lastActivity = new Date().toISOString();

      this.emit(DatabaseEvents.MIGRATION_CREATED, {
        migration,
        project: this.currentProject.name
      });

      if (this.eventBus) {
        this.eventBus.publish(DatabaseEvents.MIGRATION_CREATED, { migration });
      }

      this.state = AgentState.IDLE;
      return migration;
    } catch (error) {
      this.state = AgentState.ERROR;
      this.logger.error(`Migration creation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate migration from schema diff
   * @param {object} oldSchema - Previous schema
   * @param {object} newSchema - New schema
   */
  async generateMigration(oldSchema, newSchema) {
    this.state = AgentState.MIGRATING;

    try {
      const diff = await this.schemaDesigner.diff(oldSchema, newSchema);

      if (!diff.hasChanges) {
        this.state = AgentState.IDLE;
        return { success: true, message: 'No changes detected', migration: null };
      }

      const migration = await this.migrationManager.generateFromDiff(diff);

      this.metrics.migrationsCreated++;
      this.state = AgentState.IDLE;

      return migration;
    } catch (error) {
      this.state = AgentState.ERROR;
      throw error;
    }
  }

  /**
   * Run pending migrations
   * @param {object} options - Run options
   */
  async runMigrations(options = {}) {
    this.state = AgentState.MIGRATING;
    this.logger.info('Running migrations...');

    this.emit(DatabaseEvents.MIGRATION_STARTED, {
      project: this.currentProject?.name,
      timestamp: new Date().toISOString()
    });

    try {
      const results = await this.migrationManager.run(options);

      this.metrics.migrationsRun += results.executed.length;
      this.metrics.lastActivity = new Date().toISOString();

      this.emit(DatabaseEvents.MIGRATION_COMPLETED, {
        executed: results.executed,
        skipped: results.skipped
      });

      if (this.eventBus) {
        this.eventBus.publish(DatabaseEvents.MIGRATION_COMPLETED, results);
      }

      this.state = AgentState.IDLE;
      return results;
    } catch (error) {
      this.state = AgentState.ERROR;
      this.logger.error(`Migration failed: ${error.message}`);

      this.emit(DatabaseEvents.MIGRATION_FAILED, {
        error: error.message,
        migration: error.migration
      });

      throw error;
    }
  }

  /**
   * Rollback migrations
   * @param {number} steps - Number of migrations to rollback
   */
  async rollbackMigrations(steps = 1) {
    this.state = AgentState.MIGRATING;
    this.logger.info(`Rolling back ${steps} migration(s)...`);

    try {
      const results = await this.migrationManager.rollback(steps);

      this.metrics.migrationsRolledBack += results.rolledBack.length;
      this.metrics.lastActivity = new Date().toISOString();

      this.emit(DatabaseEvents.MIGRATION_ROLLED_BACK, results);

      if (this.eventBus) {
        this.eventBus.publish(DatabaseEvents.MIGRATION_ROLLED_BACK, results);
      }

      this.state = AgentState.IDLE;
      return results;
    } catch (error) {
      this.state = AgentState.ERROR;
      throw error;
    }
  }

  /**
   * Get migration status
   */
  async getMigrationStatus() {
    return await this.migrationManager.getStatus();
  }

  /**
   * Get pending migrations
   */
  async getPendingMigrations() {
    return await this.migrationManager.getPending();
  }

  // ==========================================
  // Query Analysis
  // ==========================================

  /**
   * Analyze a query for performance
   * @param {string} query - Query to analyze
   * @param {object} options - Analysis options
   */
  async analyzeQuery(query, options = {}) {
    this.state = AgentState.ANALYZING;
    this.logger.debug('Analyzing query...');

    try {
      const analysis = await this.queryAnalyzer.analyze(query, options);

      this.metrics.queriesAnalyzed++;
      this.metrics.lastActivity = new Date().toISOString();

      if (analysis.isSlowQuery) {
        this.metrics.slowQueriesDetected++;
        this.emit(DatabaseEvents.SLOW_QUERY_DETECTED, {
          query,
          analysis,
          recommendations: analysis.recommendations
        });
      }

      this.emit(DatabaseEvents.QUERY_ANALYZED, { query, analysis });
      this.state = AgentState.IDLE;

      return analysis;
    } catch (error) {
      this.state = AgentState.ERROR;
      throw error;
    }
  }

  /**
   * Optimize a query
   * @param {string} query - Query to optimize
   */
  async optimizeQuery(query) {
    this.state = AgentState.ANALYZING;

    try {
      const optimization = await this.queryAnalyzer.optimize(query);

      this.metrics.queriesOptimized++;

      this.emit(DatabaseEvents.QUERY_OPTIMIZED, {
        original: query,
        optimized: optimization.optimizedQuery,
        improvements: optimization.improvements
      });

      this.state = AgentState.IDLE;
      return optimization;
    } catch (error) {
      this.state = AgentState.ERROR;
      throw error;
    }
  }

  /**
   * Suggest indexes based on query patterns
   * @param {string[]} queries - Array of queries to analyze
   */
  async suggestIndexes(queries) {
    return await this.queryAnalyzer.suggestIndexes(queries);
  }

  /**
   * Get query statistics
   */
  async getQueryStats() {
    return await this.queryAnalyzer.getStats();
  }

  // ==========================================
  // Relationship Mapping
  // ==========================================

  /**
   * Map relationships in the schema
   */
  async mapRelationships() {
    this.state = AgentState.MAPPING;
    this.logger.info('Mapping database relationships...');

    try {
      const schema = await this.schemaDesigner.getCurrentSchema();
      const relationships = await this.relationshipMapper.mapFromSchema(schema);

      this.metrics.relationshipsMapped = relationships.length;

      this.emit(DatabaseEvents.RELATIONSHIP_MAPPED, {
        count: relationships.length,
        relationships
      });

      this.state = AgentState.IDLE;
      return relationships;
    } catch (error) {
      this.state = AgentState.ERROR;
      throw error;
    }
  }

  /**
   * Add a relationship
   * @param {object} relationship - Relationship definition
   */
  async addRelationship(relationship) {
    const added = await this.relationshipMapper.add(relationship);

    this.emit(DatabaseEvents.RELATIONSHIP_MAPPED, {
      relationship: added
    });

    return added;
  }

  /**
   * Validate relationships against schema
   */
  async validateRelationships() {
    this.state = AgentState.VALIDATING;

    try {
      const validation = await this.relationshipMapper.validate();

      this.emit(DatabaseEvents.RELATIONSHIP_VALIDATED, validation);
      this.state = AgentState.IDLE;

      return validation;
    } catch (error) {
      this.state = AgentState.ERROR;
      throw error;
    }
  }

  /**
   * Get relationship diagram data
   */
  async getRelationshipDiagram() {
    return await this.relationshipMapper.getDiagramData();
  }

  // ==========================================
  // Pre-Execution Validation
  // ==========================================

  /**
   * Validate database files before execution
   * Called by orchestrator before plan execution
   */
  async validateBeforeExecution() {
    this.state = AgentState.VALIDATING;
    this.logger.info('Running pre-execution database validation...');

    const results = {
      valid: true,
      errors: [],
      warnings: [],
      agent: this.alias,
      files: ['database/', 'database/migrations/', 'schema.json']
    };

    try {
      // Validate schema.json
      const schemaValid = await this.schemaDesigner.validateFile();
      if (!schemaValid.valid) {
        if (schemaValid.severity === 'error') {
          results.valid = false;
          results.errors.push(...schemaValid.issues);
        } else {
          results.warnings.push(...schemaValid.issues);
        }
      }

      // Validate migrations
      const migrationsValid = await this.migrationManager.validateFiles();
      if (!migrationsValid.valid) {
        if (migrationsValid.severity === 'error') {
          results.valid = false;
          results.errors.push(...migrationsValid.issues);
        } else {
          results.warnings.push(...migrationsValid.issues);
        }
      }

      // Check for pending migrations
      const pending = await this.migrationManager.getPending();
      if (pending.length > 0) {
        results.warnings.push({
          type: 'pending_migrations',
          message: `${pending.length} pending migrations`,
          migrations: pending.map(m => m.name)
        });
      }

      // Validate relationships
      const relValid = await this.relationshipMapper.validateFiles();
      if (!relValid.valid) {
        results.warnings.push(...relValid.issues);
      }

      this.state = AgentState.IDLE;

      this.emit(results.valid ?
        DatabaseEvents.SCHEMA_VALIDATED :
        DatabaseEvents.DATABASE_ERROR,
        results
      );

      return results;
    } catch (error) {
      this.state = AgentState.ERROR;
      results.valid = false;
      results.errors.push({ type: 'validation_error', message: error.message });
      return results;
    }
  }

  // ==========================================
  // Utility Methods
  // ==========================================

  /**
   * Generate TypeScript types from schema
   */
  async generateTypes() {
    const schema = await this.schemaDesigner.getCurrentSchema();
    return await this.schemaDesigner.generateTypes(schema);
  }

  /**
   * Export schema to different formats
   * @param {string} format - Export format (json, sql, prisma, typeorm)
   */
  async exportSchema(format = 'json') {
    const schema = await this.schemaDesigner.getCurrentSchema();
    return await this.schemaDesigner.export(schema, format);
  }

  /**
   * Import schema from file or format
   * @param {string} source - Source file or content
   * @param {string} format - Source format
   */
  async importSchema(source, format) {
    return await this.schemaDesigner.import(source, format);
  }

  // ==========================================
  // Status & Metrics
  // ==========================================

  /**
   * Get agent status
   */
  getStatus() {
    return {
      name: this.name,
      alias: this.alias,
      version: this.version,
      state: this.state,
      currentProject: this.currentProject?.name || null,
      metrics: { ...this.metrics }
    };
  }

  /**
   * Get database summary for current project
   */
  async getDatabaseSummary() {
    if (!this.currentProject) {
      return null;
    }

    const [schema, migrations, relationships] = await Promise.all([
      this.schemaDesigner.getSummary(),
      this.migrationManager.getSummary(),
      this.relationshipMapper.getSummary()
    ]);

    return {
      project: this.currentProject.name,
      schema,
      migrations,
      relationships,
      metrics: this.metrics
    };
  }

  // ==========================================
  // Shutdown
  // ==========================================

  /**
   * Graceful shutdown
   */
  async shutdown() {
    this.logger.info(`Shutting down ${this.alias}...`);
    this.state = AgentState.SHUTDOWN;

    // Save any pending state
    await this.schemaDesigner.save();
    await this.migrationManager.save();
    await this.relationshipMapper.save();

    // Unsubscribe from events
    if (this.eventBus && this._unsubscribers) {
      this._unsubscribers.forEach(fn => fn());
    }

    this.removeAllListeners();
    this.logger.info(`${this.alias} shutdown complete`);
  }

  // ==========================================
  // Private Methods
  // ==========================================

  _setupInternalHandlers() {
    this.on('error', (data) => {
      this.logger.error(`Error: ${data.error}`);
    });
  }

  _subscribeToEvents() {
    this._unsubscribers = [];

    if (this.eventBus.subscribe) {
      // Subscribe to architecture updates to sync schema
      this._unsubscribers.push(
        this.eventBus.subscribe('ARCHITECTURE_UPDATED', this.alias, async (data) => {
          if (data.database) {
            await this.updateSchema('_architecture', data.database);
          }
        })
      );

      // Subscribe to code generation to detect model changes
      this._unsubscribers.push(
        this.eventBus.subscribe('CODE_GENERATED', this.alias, async (data) => {
          if (data.type === 'model' || data.type === 'schema') {
            this.logger.debug('Model/schema code generated, checking for migrations...');
          }
        })
      );

      // Subscribe to plan approval for validation
      this._unsubscribers.push(
        this.eventBus.subscribe('PLAN_APPROVED', this.alias, async (data) => {
          const validation = await this.validateBeforeExecution();
          this.eventBus.publish(
            validation.valid ? 'VALIDATION_PASSED' : 'VALIDATION_FAILED',
            { agent: this.alias, ...validation }
          );
        })
      );
    }
  }

  _wireSubComponents() {
    // Forward schema designer events
    this.schemaDesigner.on('schema:updated', (data) => {
      this.emit(DatabaseEvents.SCHEMA_UPDATED, data);
    });

    // Forward migration manager events
    this.migrationManager.on('migration:created', (migration) => {
      this.emit(DatabaseEvents.MIGRATION_CREATED, migration);
    });

    this.migrationManager.on('migration:failed', (error) => {
      this.emit(DatabaseEvents.MIGRATION_FAILED, error);
    });

    // Forward query analyzer events
    this.queryAnalyzer.on('slow_query', (data) => {
      this.emit(DatabaseEvents.SLOW_QUERY_DETECTED, data);
    });

    // Forward relationship mapper events
    this.relationshipMapper.on('relationship:added', (rel) => {
      this.emit(DatabaseEvents.RELATIONSHIP_MAPPED, rel);
    });
  }
}

// Factory function
export function getDatabaseAgent(config = {}) {
  return DatabaseAgent.getInstance(config);
}

export default DatabaseAgent;
