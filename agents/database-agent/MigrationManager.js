/**
 * MigrationManager
 * ----------------
 * Manages database migrations: creation, execution, rollback, and tracking.
 * Generates migration files and maintains migration history.
 *
 * @author Kareem Hussein
 * @company Inweb Software Solutions
 */

import EventEmitter from 'events';
import fs from 'fs/promises';
import path from 'path';
import { createLogger } from '../../foundation/common/logger.js';

const logger = createLogger('MigrationManager');

export class MigrationManager extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = config;
    this.projectPath = null;
    this.migrations = [];
    this.history = [];
    this.initialized = false;
  }

  /**
   * Initialize the migration manager
   */
  async initialize() {
    this.initialized = true;
    logger.debug('MigrationManager initialized');
  }

  /**
   * Set the project path
   * @param {string} projectPath - Path to migrations directory
   */
  async setProjectPath(projectPath) {
    this.projectPath = projectPath;

    // Ensure directory exists
    await fs.mkdir(projectPath, { recursive: true });

    // Load existing migrations
    await this._loadMigrations();

    // Load migration history
    await this._loadHistory();
  }

  /**
   * Load existing migrations from disk
   */
  async _loadMigrations() {
    try {
      const files = await fs.readdir(this.projectPath);
      const migrationFiles = files
        .filter(f => f.endsWith('.json') && f !== 'history.json')
        .sort();

      this.migrations = [];
      for (const file of migrationFiles) {
        const content = await fs.readFile(path.join(this.projectPath, file), 'utf-8');
        this.migrations.push({
          filename: file,
          ...JSON.parse(content)
        });
      }

      logger.debug(`Loaded ${this.migrations.length} migrations`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.warn(`Error loading migrations: ${error.message}`);
      }
      this.migrations = [];
    }
  }

  /**
   * Load migration history
   */
  async _loadHistory() {
    try {
      const historyPath = path.join(this.projectPath, 'history.json');
      const content = await fs.readFile(historyPath, 'utf-8');
      this.history = JSON.parse(content);
      logger.debug(`Loaded ${this.history.length} history entries`);
    } catch (error) {
      this.history = [];
    }
  }

  /**
   * Save migration history
   */
  async _saveHistory() {
    const historyPath = path.join(this.projectPath, 'history.json');
    await fs.writeFile(historyPath, JSON.stringify(this.history, null, 2));
  }

  /**
   * Create a new migration
   * @param {object} options - Migration options
   */
  async create(options) {
    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    const name = options.name || 'migration';
    const filename = `${timestamp}_${this._sanitizeName(name)}.json`;

    const migration = {
      id: `${timestamp}_${this._sanitizeName(name)}`,
      name: options.name || 'Unnamed migration',
      description: options.description || '',
      timestamp: new Date().toISOString(),
      createdBy: 'Dave',
      up: options.up || [],
      down: options.down || [],
      checksum: null
    };

    // Calculate checksum
    migration.checksum = this._calculateChecksum(migration);

    // Save migration file
    const filePath = path.join(this.projectPath, filename);
    await fs.writeFile(filePath, JSON.stringify(migration, null, 2));

    this.migrations.push({ filename, ...migration });

    logger.info(`Created migration: ${filename}`);
    this.emit('migration:created', migration);

    return migration;
  }

  /**
   * Generate migration from schema diff
   * @param {object} diff - Schema diff object
   */
  async generateFromDiff(diff) {
    const upOperations = [];
    const downOperations = [];

    // Handle added entities
    for (const entityName of diff.addedEntities || []) {
      upOperations.push({
        type: 'createTable',
        table: entityName,
        description: `Create table ${entityName}`
      });
      downOperations.push({
        type: 'dropTable',
        table: entityName,
        description: `Drop table ${entityName}`
      });
    }

    // Handle removed entities
    for (const entityName of diff.removedEntities || []) {
      upOperations.push({
        type: 'dropTable',
        table: entityName,
        description: `Drop table ${entityName}`
      });
      downOperations.push({
        type: 'createTable',
        table: entityName,
        description: `Recreate table ${entityName}`
      });
    }

    // Handle modified entities
    for (const entityDiff of diff.modifiedEntities || []) {
      // Added fields
      for (const field of entityDiff.addedFields || []) {
        upOperations.push({
          type: 'addColumn',
          table: entityDiff.name,
          column: field.name,
          columnType: field.type,
          nullable: field.nullable,
          description: `Add column ${field.name} to ${entityDiff.name}`
        });
        downOperations.push({
          type: 'dropColumn',
          table: entityDiff.name,
          column: field.name,
          description: `Remove column ${field.name} from ${entityDiff.name}`
        });
      }

      // Removed fields
      for (const fieldName of entityDiff.removedFields || []) {
        upOperations.push({
          type: 'dropColumn',
          table: entityDiff.name,
          column: fieldName,
          description: `Remove column ${fieldName} from ${entityDiff.name}`
        });
        downOperations.push({
          type: 'addColumn',
          table: entityDiff.name,
          column: fieldName,
          description: `Restore column ${fieldName} to ${entityDiff.name}`
        });
      }

      // Modified fields
      for (const fieldDiff of entityDiff.modifiedFields || []) {
        upOperations.push({
          type: 'alterColumn',
          table: entityDiff.name,
          column: fieldDiff.name,
          changes: fieldDiff.new,
          description: `Alter column ${fieldDiff.name} in ${entityDiff.name}`
        });
        downOperations.push({
          type: 'alterColumn',
          table: entityDiff.name,
          column: fieldDiff.name,
          changes: fieldDiff.old,
          description: `Revert column ${fieldDiff.name} in ${entityDiff.name}`
        });
      }
    }

    // Create migration with operations
    const name = this._generateMigrationName(diff);
    return await this.create({
      name,
      description: `Auto-generated migration from schema diff`,
      up: upOperations,
      down: downOperations.reverse()
    });
  }

  /**
   * Generate migration name from diff
   */
  _generateMigrationName(diff) {
    const parts = [];

    if (diff.addedEntities?.length > 0) {
      parts.push(`create_${diff.addedEntities[0]}`);
    }

    if (diff.removedEntities?.length > 0) {
      parts.push(`drop_${diff.removedEntities[0]}`);
    }

    if (diff.modifiedEntities?.length > 0) {
      parts.push(`alter_${diff.modifiedEntities[0].name}`);
    }

    return parts.join('_and_') || 'schema_update';
  }

  /**
   * Run pending migrations
   * @param {object} options - Run options
   */
  async run(options = {}) {
    const pending = await this.getPending();
    const results = {
      executed: [],
      skipped: [],
      errors: []
    };

    if (pending.length === 0) {
      logger.info('No pending migrations');
      return results;
    }

    logger.info(`Running ${pending.length} pending migrations...`);

    for (const migration of pending) {
      try {
        // Validate checksum
        if (options.validateChecksum !== false) {
          const currentChecksum = this._calculateChecksum(migration);
          if (migration.checksum && migration.checksum !== currentChecksum) {
            throw new Error(`Migration ${migration.id} has been modified`);
          }
        }

        // Execute up operations
        logger.info(`Executing migration: ${migration.name}`);

        // In a real implementation, this would connect to the database
        // and execute the operations. For now, we just track the migration.

        // Record in history
        const historyEntry = {
          migrationId: migration.id,
          name: migration.name,
          direction: 'up',
          executedAt: new Date().toISOString(),
          executedBy: 'Dave',
          duration: 0, // Would be actual execution time
          success: true
        };

        this.history.push(historyEntry);
        results.executed.push(migration);

        this.emit('migration:executed', { migration, direction: 'up' });
      } catch (error) {
        logger.error(`Migration ${migration.id} failed: ${error.message}`);
        results.errors.push({ migration, error: error.message });

        const errorEntry = {
          migrationId: migration.id,
          name: migration.name,
          direction: 'up',
          executedAt: new Date().toISOString(),
          executedBy: 'Dave',
          success: false,
          error: error.message
        };

        this.history.push(errorEntry);
        this.emit('migration:failed', { migration, error: error.message });

        if (!options.continueOnError) {
          break;
        }
      }
    }

    await this._saveHistory();
    return results;
  }

  /**
   * Rollback migrations
   * @param {number} steps - Number of migrations to rollback
   */
  async rollback(steps = 1) {
    const results = {
      rolledBack: [],
      errors: []
    };

    // Get last N executed migrations
    const executedMigrations = this.history
      .filter(h => h.success && h.direction === 'up')
      .slice(-steps);

    if (executedMigrations.length === 0) {
      logger.info('No migrations to rollback');
      return results;
    }

    logger.info(`Rolling back ${executedMigrations.length} migration(s)...`);

    for (const historyEntry of executedMigrations.reverse()) {
      try {
        const migration = this.migrations.find(m => m.id === historyEntry.migrationId);

        if (!migration) {
          throw new Error(`Migration ${historyEntry.migrationId} not found`);
        }

        logger.info(`Rolling back: ${migration.name}`);

        // Execute down operations
        // In a real implementation, this would execute the down operations

        // Record in history
        const rollbackEntry = {
          migrationId: migration.id,
          name: migration.name,
          direction: 'down',
          executedAt: new Date().toISOString(),
          executedBy: 'Dave',
          success: true
        };

        this.history.push(rollbackEntry);
        results.rolledBack.push(migration);

        this.emit('migration:rolledback', { migration });
      } catch (error) {
        logger.error(`Rollback failed: ${error.message}`);
        results.errors.push({ migrationId: historyEntry.migrationId, error: error.message });
      }
    }

    await this._saveHistory();
    return results;
  }

  /**
   * Get pending migrations
   */
  async getPending() {
    const executedIds = new Set(
      this.history
        .filter(h => h.success && h.direction === 'up')
        .filter(h => !this.history.some(
          r => r.migrationId === h.migrationId && r.direction === 'down' && r.success
        ))
        .map(h => h.migrationId)
    );

    return this.migrations.filter(m => !executedIds.has(m.id));
  }

  /**
   * Get migration status
   */
  async getStatus() {
    const pending = await this.getPending();
    const executed = this.history.filter(h => h.success && h.direction === 'up').length;
    const rolledBack = this.history.filter(h => h.success && h.direction === 'down').length;
    const failed = this.history.filter(h => !h.success).length;

    return {
      total: this.migrations.length,
      pending: pending.length,
      executed,
      rolledBack,
      failed,
      lastExecution: this.history.length > 0
        ? this.history[this.history.length - 1].executedAt
        : null
    };
  }

  /**
   * Get migration summary
   */
  async getSummary() {
    const status = await this.getStatus();
    return {
      ...status,
      migrations: this.migrations.map(m => ({
        id: m.id,
        name: m.name,
        timestamp: m.timestamp,
        isPending: !this.history.some(h =>
          h.migrationId === m.id && h.success && h.direction === 'up'
        )
      }))
    };
  }

  /**
   * Validate migration files
   */
  async validateFiles() {
    const issues = [];

    for (const migration of this.migrations) {
      // Check for required fields
      if (!migration.id) {
        issues.push({ type: 'missing_field', message: `Migration missing id: ${migration.filename}` });
      }

      if (!migration.up || migration.up.length === 0) {
        issues.push({ type: 'empty_migration', message: `Migration has no up operations: ${migration.filename}` });
      }

      if (!migration.down || migration.down.length === 0) {
        issues.push({ type: 'no_rollback', message: `Migration has no down operations: ${migration.filename}` });
      }

      // Verify checksum
      if (migration.checksum) {
        const currentChecksum = this._calculateChecksum(migration);
        if (migration.checksum !== currentChecksum) {
          issues.push({
            type: 'modified_migration',
            message: `Migration has been modified after creation: ${migration.filename}`
          });
        }
      }
    }

    // Check for gaps in history
    const executedIds = this.history
      .filter(h => h.success && h.direction === 'up')
      .map(h => h.migrationId);

    const allIds = this.migrations.map(m => m.id).sort();

    for (let i = 0; i < executedIds.length; i++) {
      const expectedId = allIds[i];
      if (executedIds[i] !== expectedId) {
        issues.push({
          type: 'migration_gap',
          message: `Migrations may have been run out of order`
        });
        break;
      }
    }

    return {
      valid: issues.filter(i => i.type !== 'no_rollback').length === 0,
      severity: issues.some(i => i.type === 'modified_migration') ? 'error' : 'warning',
      issues
    };
  }

  /**
   * Generate SQL for a migration
   * @param {object} migration - Migration object
   * @param {string} direction - 'up' or 'down'
   * @param {string} dbType - Database type
   */
  generateSQL(migration, direction = 'up', dbType = 'postgresql') {
    const operations = migration[direction] || [];
    const statements = [];

    for (const op of operations) {
      const sql = this._operationToSQL(op, dbType);
      if (sql) {
        statements.push(sql);
      }
    }

    return statements.join('\n\n');
  }

  /**
   * Convert operation to SQL
   */
  _operationToSQL(operation, dbType) {
    switch (operation.type) {
      case 'createTable':
        return `-- ${operation.description}\nCREATE TABLE ${operation.table} (\n  -- Add columns here\n);`;

      case 'dropTable':
        return `-- ${operation.description}\nDROP TABLE IF EXISTS ${operation.table};`;

      case 'addColumn':
        const nullable = operation.nullable ? '' : ' NOT NULL';
        return `-- ${operation.description}\nALTER TABLE ${operation.table} ADD COLUMN ${operation.column} ${operation.columnType}${nullable};`;

      case 'dropColumn':
        return `-- ${operation.description}\nALTER TABLE ${operation.table} DROP COLUMN ${operation.column};`;

      case 'alterColumn':
        return `-- ${operation.description}\n-- ALTER TABLE ${operation.table} ALTER COLUMN ${operation.column} ...;`;

      case 'createIndex':
        const unique = operation.unique ? 'UNIQUE ' : '';
        return `CREATE ${unique}INDEX ${operation.name} ON ${operation.table} (${operation.columns.join(', ')});`;

      case 'dropIndex':
        return `DROP INDEX IF EXISTS ${operation.name};`;

      case 'raw':
        return `-- ${operation.description}\n${operation.sql}`;

      default:
        return `-- Unknown operation: ${operation.type}`;
    }
  }

  /**
   * Calculate checksum for a migration
   */
  _calculateChecksum(migration) {
    const content = JSON.stringify({
      name: migration.name,
      up: migration.up,
      down: migration.down
    });

    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    return Math.abs(hash).toString(16);
  }

  /**
   * Sanitize migration name
   */
  _sanitizeName(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  /**
   * Save current state
   */
  async save() {
    await this._saveHistory();
  }
}

export default MigrationManager;
