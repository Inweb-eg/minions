/**
 * SchemaDesigner
 * --------------
 * Designs, validates, and manages database schemas.
 * Generates schema definitions for various database types.
 *
 * @author Kareem Hussein
 * @company Inweb Software Solutions
 */

import EventEmitter from 'events';
import fs from 'fs/promises';
import path from 'path';
import { createLogger } from '../../foundation/common/logger.js';

const logger = createLogger('SchemaDesigner');

// Field type mappings for different databases
const TYPE_MAPPINGS = {
  postgresql: {
    string: 'VARCHAR',
    integer: 'INTEGER',
    float: 'DECIMAL',
    boolean: 'BOOLEAN',
    date: 'DATE',
    datetime: 'TIMESTAMP',
    timestamp: 'TIMESTAMPTZ',
    text: 'TEXT',
    json: 'JSONB',
    array: 'ARRAY',
    enum: 'VARCHAR',
    uuid: 'UUID',
    binary: 'BYTEA'
  },
  mysql: {
    string: 'VARCHAR',
    integer: 'INT',
    float: 'DECIMAL',
    boolean: 'TINYINT(1)',
    date: 'DATE',
    datetime: 'DATETIME',
    timestamp: 'TIMESTAMP',
    text: 'TEXT',
    json: 'JSON',
    array: 'JSON',
    enum: 'ENUM',
    uuid: 'CHAR(36)',
    binary: 'BLOB'
  },
  sqlite: {
    string: 'TEXT',
    integer: 'INTEGER',
    float: 'REAL',
    boolean: 'INTEGER',
    date: 'TEXT',
    datetime: 'TEXT',
    timestamp: 'TEXT',
    text: 'TEXT',
    json: 'TEXT',
    array: 'TEXT',
    enum: 'TEXT',
    uuid: 'TEXT',
    binary: 'BLOB'
  }
};

export class SchemaDesigner extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = config;
    this.projectPath = null;
    this.schema = null;
    this.initialized = false;
  }

  /**
   * Initialize the schema designer
   */
  async initialize() {
    this.initialized = true;
    logger.debug('SchemaDesigner initialized');
  }

  /**
   * Set the project path
   * @param {string} projectPath - Path to database directory
   */
  async setProjectPath(projectPath) {
    this.projectPath = projectPath;

    // Ensure directory exists
    await fs.mkdir(projectPath, { recursive: true });

    // Load existing schema if present
    const schemaPath = path.join(projectPath, this.config.schemaFile || 'schema.json');
    try {
      const content = await fs.readFile(schemaPath, 'utf-8');
      this.schema = JSON.parse(content);
      logger.debug('Loaded existing schema');
    } catch (error) {
      // No existing schema
      this.schema = this._createEmptySchema();
    }
  }

  /**
   * Create an empty schema structure
   */
  _createEmptySchema() {
    return {
      version: '1.0.0',
      name: 'database_schema',
      databaseType: this.config.defaultDbType || 'postgresql',
      entities: {},
      enums: {},
      indexes: [],
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'Dave'
      }
    };
  }

  /**
   * Design a new schema from requirements
   * @param {object} requirements - Schema requirements
   */
  async design(requirements) {
    logger.info('Designing schema from requirements...');

    const schema = this._createEmptySchema();
    schema.name = requirements.name || schema.name;
    schema.databaseType = requirements.databaseType || schema.databaseType;

    // Process entities
    if (requirements.entities) {
      for (const entityDef of requirements.entities) {
        const entity = this._processEntityDefinition(entityDef);
        schema.entities[entity.name] = entity;
      }
    }

    // Process enums
    if (requirements.enums) {
      for (const enumDef of requirements.enums) {
        schema.enums[enumDef.name] = {
          name: enumDef.name,
          values: enumDef.values,
          description: enumDef.description
        };
      }
    }

    // Auto-generate indexes
    schema.indexes = this._generateIndexes(schema);

    this.schema = schema;
    await this.save();

    this.emit('schema:designed', schema);
    return schema;
  }

  /**
   * Process an entity definition
   */
  _processEntityDefinition(entityDef) {
    const entity = {
      name: entityDef.name,
      tableName: entityDef.tableName || this._toSnakeCase(entityDef.name),
      description: entityDef.description || '',
      fields: {},
      primaryKey: entityDef.primaryKey || 'id',
      timestamps: entityDef.timestamps !== false,
      softDelete: entityDef.softDelete || false
    };

    // Add default ID field if not specified
    if (!entityDef.fields?.find(f => f.name === 'id')) {
      entity.fields.id = {
        name: 'id',
        type: 'uuid',
        primaryKey: true,
        nullable: false,
        defaultValue: 'uuid_generate_v4()'
      };
    }

    // Process fields
    for (const fieldDef of (entityDef.fields || [])) {
      const field = this._processFieldDefinition(fieldDef);
      entity.fields[field.name] = field;
    }

    // Add timestamp fields
    if (entity.timestamps) {
      entity.fields.createdAt = {
        name: 'createdAt',
        columnName: 'created_at',
        type: 'timestamp',
        nullable: false,
        defaultValue: 'CURRENT_TIMESTAMP'
      };
      entity.fields.updatedAt = {
        name: 'updatedAt',
        columnName: 'updated_at',
        type: 'timestamp',
        nullable: false,
        defaultValue: 'CURRENT_TIMESTAMP'
      };
    }

    // Add soft delete field
    if (entity.softDelete) {
      entity.fields.deletedAt = {
        name: 'deletedAt',
        columnName: 'deleted_at',
        type: 'timestamp',
        nullable: true
      };
    }

    return entity;
  }

  /**
   * Process a field definition
   */
  _processFieldDefinition(fieldDef) {
    return {
      name: fieldDef.name,
      columnName: fieldDef.columnName || this._toSnakeCase(fieldDef.name),
      type: fieldDef.type || 'string',
      nullable: fieldDef.nullable !== false,
      unique: fieldDef.unique || false,
      primaryKey: fieldDef.primaryKey || false,
      defaultValue: fieldDef.defaultValue,
      length: fieldDef.length,
      precision: fieldDef.precision,
      scale: fieldDef.scale,
      enumValues: fieldDef.enumValues,
      reference: fieldDef.reference,
      description: fieldDef.description
    };
  }

  /**
   * Generate indexes based on schema analysis
   */
  _generateIndexes(schema) {
    const indexes = [];

    for (const [entityName, entity] of Object.entries(schema.entities)) {
      // Index unique fields
      for (const [fieldName, field] of Object.entries(entity.fields)) {
        if (field.unique && !field.primaryKey) {
          indexes.push({
            name: `idx_${entity.tableName}_${field.columnName}`,
            table: entity.tableName,
            columns: [field.columnName],
            unique: true
          });
        }

        // Index foreign keys
        if (field.reference) {
          indexes.push({
            name: `idx_${entity.tableName}_${field.columnName}`,
            table: entity.tableName,
            columns: [field.columnName],
            unique: false
          });
        }
      }

      // Index timestamp columns for common queries
      if (entity.timestamps) {
        indexes.push({
          name: `idx_${entity.tableName}_created_at`,
          table: entity.tableName,
          columns: ['created_at'],
          unique: false
        });
      }
    }

    return indexes;
  }

  /**
   * Validate a schema
   * @param {object} schema - Schema to validate
   */
  async validate(schema) {
    const errors = [];
    const warnings = [];

    // Validate entities
    for (const [name, entity] of Object.entries(schema.entities || {})) {
      // Check for primary key
      const hasPrimaryKey = Object.values(entity.fields).some(f => f.primaryKey);
      if (!hasPrimaryKey) {
        errors.push(`Entity "${name}" has no primary key`);
      }

      // Check for valid field types
      for (const [fieldName, field] of Object.entries(entity.fields)) {
        if (!this._isValidFieldType(field.type)) {
          errors.push(`Entity "${name}" field "${fieldName}" has invalid type: ${field.type}`);
        }

        // Check foreign key references
        if (field.reference) {
          const refEntity = schema.entities[field.reference.entity];
          if (!refEntity) {
            errors.push(`Entity "${name}" field "${fieldName}" references non-existent entity: ${field.reference.entity}`);
          }
        }
      }
    }

    // Check for enum references
    for (const [name, entity] of Object.entries(schema.entities || {})) {
      for (const [fieldName, field] of Object.entries(entity.fields)) {
        if (field.type === 'enum' && field.enumValues) {
          // Inline enum is fine
        } else if (field.type === 'enum' && field.enumRef) {
          if (!schema.enums[field.enumRef]) {
            errors.push(`Entity "${name}" field "${fieldName}" references non-existent enum: ${field.enumRef}`);
          }
        }
      }
    }

    // Warnings for best practices
    for (const [name, entity] of Object.entries(schema.entities || {})) {
      if (!entity.timestamps) {
        warnings.push(`Entity "${name}" does not have timestamps enabled`);
      }

      const fieldCount = Object.keys(entity.fields).length;
      if (fieldCount > 30) {
        warnings.push(`Entity "${name}" has ${fieldCount} fields - consider normalization`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check if a field type is valid
   */
  _isValidFieldType(type) {
    const validTypes = [
      'string', 'integer', 'float', 'boolean', 'date', 'datetime',
      'timestamp', 'text', 'json', 'array', 'enum', 'uuid', 'binary'
    ];
    return validTypes.includes(type);
  }

  /**
   * Validate the schema file
   */
  async validateFile() {
    if (!this.projectPath) {
      return { valid: true, issues: [] };
    }

    const schemaPath = path.join(this.projectPath, this.config.schemaFile || 'schema.json');

    try {
      await fs.access(schemaPath);
      const content = await fs.readFile(schemaPath, 'utf-8');
      const schema = JSON.parse(content);
      const validation = await this.validate(schema);

      return {
        valid: validation.valid,
        severity: validation.errors.length > 0 ? 'error' : 'warning',
        issues: [...validation.errors, ...validation.warnings].map(msg => ({
          type: 'schema_validation',
          message: msg
        }))
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {
          valid: true,
          severity: 'warning',
          issues: [{ type: 'missing_file', message: 'schema.json not found' }]
        };
      }

      return {
        valid: false,
        severity: 'error',
        issues: [{ type: 'parse_error', message: error.message }]
      };
    }
  }

  /**
   * Update an entity in the schema
   * @param {string} entityName - Entity name
   * @param {object} changes - Changes to apply
   */
  async updateEntity(entityName, changes) {
    if (!this.schema) {
      throw new Error('No schema loaded');
    }

    if (!this.schema.entities[entityName]) {
      throw new Error(`Entity "${entityName}" not found`);
    }

    const entity = this.schema.entities[entityName];

    // Apply changes
    if (changes.addFields) {
      for (const fieldDef of changes.addFields) {
        const field = this._processFieldDefinition(fieldDef);
        entity.fields[field.name] = field;
      }
    }

    if (changes.removeFields) {
      for (const fieldName of changes.removeFields) {
        delete entity.fields[fieldName];
      }
    }

    if (changes.updateFields) {
      for (const fieldUpdate of changes.updateFields) {
        const existing = entity.fields[fieldUpdate.name];
        if (existing) {
          Object.assign(existing, fieldUpdate);
        }
      }
    }

    this.schema.metadata.updatedAt = new Date().toISOString();
    await this.save();

    this.emit('schema:updated', { entity: entityName, changes });
    return entity;
  }

  /**
   * Add a new entity to the schema
   * @param {object} entityDef - Entity definition
   */
  async addEntity(entityDef) {
    if (!this.schema) {
      this.schema = this._createEmptySchema();
    }

    const entity = this._processEntityDefinition(entityDef);
    this.schema.entities[entity.name] = entity;
    this.schema.metadata.updatedAt = new Date().toISOString();

    await this.save();

    this.emit('schema:updated', { entity: entity.name, action: 'added' });
    return entity;
  }

  /**
   * Diff two schemas
   * @param {object} oldSchema - Previous schema
   * @param {object} newSchema - New schema
   */
  async diff(oldSchema, newSchema) {
    const changes = {
      hasChanges: false,
      addedEntities: [],
      removedEntities: [],
      modifiedEntities: []
    };

    // Find added entities
    for (const name of Object.keys(newSchema.entities || {})) {
      if (!oldSchema.entities?.[name]) {
        changes.hasChanges = true;
        changes.addedEntities.push(name);
      }
    }

    // Find removed entities
    for (const name of Object.keys(oldSchema.entities || {})) {
      if (!newSchema.entities?.[name]) {
        changes.hasChanges = true;
        changes.removedEntities.push(name);
      }
    }

    // Find modified entities
    for (const name of Object.keys(newSchema.entities || {})) {
      if (oldSchema.entities?.[name]) {
        const entityDiff = this._diffEntities(oldSchema.entities[name], newSchema.entities[name]);
        if (entityDiff.hasChanges) {
          changes.hasChanges = true;
          changes.modifiedEntities.push({ name, ...entityDiff });
        }
      }
    }

    return changes;
  }

  /**
   * Diff two entities
   */
  _diffEntities(oldEntity, newEntity) {
    const diff = {
      hasChanges: false,
      addedFields: [],
      removedFields: [],
      modifiedFields: []
    };

    // Find added fields
    for (const name of Object.keys(newEntity.fields || {})) {
      if (!oldEntity.fields?.[name]) {
        diff.hasChanges = true;
        diff.addedFields.push({ name, ...newEntity.fields[name] });
      }
    }

    // Find removed fields
    for (const name of Object.keys(oldEntity.fields || {})) {
      if (!newEntity.fields?.[name]) {
        diff.hasChanges = true;
        diff.removedFields.push(name);
      }
    }

    // Find modified fields
    for (const name of Object.keys(newEntity.fields || {})) {
      if (oldEntity.fields?.[name]) {
        const oldField = oldEntity.fields[name];
        const newField = newEntity.fields[name];

        if (JSON.stringify(oldField) !== JSON.stringify(newField)) {
          diff.hasChanges = true;
          diff.modifiedFields.push({
            name,
            old: oldField,
            new: newField
          });
        }
      }
    }

    return diff;
  }

  /**
   * Get the current schema
   */
  async getCurrentSchema() {
    return this.schema;
  }

  /**
   * Get schema summary
   */
  async getSummary() {
    if (!this.schema) {
      return { entities: 0, fields: 0, indexes: 0 };
    }

    let fieldCount = 0;
    for (const entity of Object.values(this.schema.entities)) {
      fieldCount += Object.keys(entity.fields).length;
    }

    return {
      entities: Object.keys(this.schema.entities).length,
      fields: fieldCount,
      indexes: this.schema.indexes?.length || 0,
      enums: Object.keys(this.schema.enums || {}).length,
      databaseType: this.schema.databaseType,
      version: this.schema.version
    };
  }

  /**
   * Generate TypeScript types from schema
   */
  async generateTypes(schema) {
    const lines = [];
    lines.push('// Auto-generated TypeScript types from schema');
    lines.push(`// Generated by Dave at ${new Date().toISOString()}`);
    lines.push('');

    // Generate enum types
    for (const [name, enumDef] of Object.entries(schema.enums || {})) {
      lines.push(`export enum ${name} {`);
      for (const value of enumDef.values) {
        lines.push(`  ${value} = '${value}',`);
      }
      lines.push('}');
      lines.push('');
    }

    // Generate entity interfaces
    for (const [name, entity] of Object.entries(schema.entities)) {
      lines.push(`export interface ${name} {`);

      for (const [fieldName, field] of Object.entries(entity.fields)) {
        const tsType = this._fieldTypeToTypeScript(field);
        const optional = field.nullable ? '?' : '';
        lines.push(`  ${fieldName}${optional}: ${tsType};`);
      }

      lines.push('}');
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Convert field type to TypeScript type
   */
  _fieldTypeToTypeScript(field) {
    const typeMap = {
      string: 'string',
      integer: 'number',
      float: 'number',
      boolean: 'boolean',
      date: 'Date',
      datetime: 'Date',
      timestamp: 'Date',
      text: 'string',
      json: 'Record<string, unknown>',
      array: 'unknown[]',
      enum: field.enumRef || 'string',
      uuid: 'string',
      binary: 'Buffer'
    };

    return typeMap[field.type] || 'unknown';
  }

  /**
   * Export schema to different formats
   * @param {object} schema - Schema to export
   * @param {string} format - Export format
   */
  async export(schema, format) {
    switch (format) {
      case 'json':
        return JSON.stringify(schema, null, 2);

      case 'sql':
        return this._exportToSQL(schema);

      case 'prisma':
        return this._exportToPrisma(schema);

      case 'typeorm':
        return this._exportToTypeORM(schema);

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export schema to SQL DDL
   */
  _exportToSQL(schema) {
    const lines = [];
    const dbType = schema.databaseType || 'postgresql';
    const typeMapping = TYPE_MAPPINGS[dbType] || TYPE_MAPPINGS.postgresql;

    lines.push(`-- Database Schema: ${schema.name}`);
    lines.push(`-- Generated by Dave at ${new Date().toISOString()}`);
    lines.push('');

    // Generate CREATE TABLE statements
    for (const [name, entity] of Object.entries(schema.entities)) {
      lines.push(`CREATE TABLE ${entity.tableName} (`);

      const fieldDefs = [];
      for (const [fieldName, field] of Object.entries(entity.fields)) {
        let def = `  ${field.columnName} ${this._getSQLType(field, typeMapping)}`;

        if (field.primaryKey) {
          def += ' PRIMARY KEY';
        }

        if (!field.nullable && !field.primaryKey) {
          def += ' NOT NULL';
        }

        if (field.unique && !field.primaryKey) {
          def += ' UNIQUE';
        }

        if (field.defaultValue) {
          def += ` DEFAULT ${field.defaultValue}`;
        }

        fieldDefs.push(def);
      }

      lines.push(fieldDefs.join(',\n'));
      lines.push(');');
      lines.push('');
    }

    // Generate indexes
    for (const index of schema.indexes || []) {
      const unique = index.unique ? 'UNIQUE ' : '';
      lines.push(`CREATE ${unique}INDEX ${index.name} ON ${index.table} (${index.columns.join(', ')});`);
    }

    return lines.join('\n');
  }

  /**
   * Get SQL type for a field
   */
  _getSQLType(field, typeMapping) {
    let type = typeMapping[field.type] || 'TEXT';

    if (field.type === 'string' && field.length) {
      type = `${type}(${field.length})`;
    }

    if (field.type === 'float' && field.precision && field.scale) {
      type = `DECIMAL(${field.precision}, ${field.scale})`;
    }

    return type;
  }

  /**
   * Export schema to Prisma format
   */
  _exportToPrisma(schema) {
    const lines = [];

    lines.push('// Prisma schema generated by Dave');
    lines.push('');
    lines.push('generator client {');
    lines.push('  provider = "prisma-client-js"');
    lines.push('}');
    lines.push('');
    lines.push('datasource db {');
    lines.push(`  provider = "${schema.databaseType}"`);
    lines.push('  url      = env("DATABASE_URL")');
    lines.push('}');
    lines.push('');

    // Generate enums
    for (const [name, enumDef] of Object.entries(schema.enums || {})) {
      lines.push(`enum ${name} {`);
      for (const value of enumDef.values) {
        lines.push(`  ${value}`);
      }
      lines.push('}');
      lines.push('');
    }

    // Generate models
    for (const [name, entity] of Object.entries(schema.entities)) {
      lines.push(`model ${name} {`);

      for (const [fieldName, field] of Object.entries(entity.fields)) {
        const prismaType = this._fieldTypeToPrisma(field);
        const optional = field.nullable ? '?' : '';
        const attrs = this._getPrismaAttributes(field, entity.tableName);

        lines.push(`  ${fieldName} ${prismaType}${optional} ${attrs}`);
      }

      lines.push('');
      lines.push(`  @@map("${entity.tableName}")`);
      lines.push('}');
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Convert field type to Prisma type
   */
  _fieldTypeToPrisma(field) {
    const typeMap = {
      string: 'String',
      integer: 'Int',
      float: 'Float',
      boolean: 'Boolean',
      date: 'DateTime',
      datetime: 'DateTime',
      timestamp: 'DateTime',
      text: 'String',
      json: 'Json',
      uuid: 'String',
      binary: 'Bytes'
    };

    if (field.type === 'enum' && field.enumRef) {
      return field.enumRef;
    }

    return typeMap[field.type] || 'String';
  }

  /**
   * Get Prisma field attributes
   */
  _getPrismaAttributes(field, tableName) {
    const attrs = [];

    if (field.primaryKey) {
      attrs.push('@id');
      if (field.type === 'uuid') {
        attrs.push('@default(uuid())');
      }
    }

    if (field.unique && !field.primaryKey) {
      attrs.push('@unique');
    }

    if (field.defaultValue === 'CURRENT_TIMESTAMP') {
      attrs.push('@default(now())');
    }

    if (field.columnName !== field.name) {
      attrs.push(`@map("${field.columnName}")`);
    }

    return attrs.join(' ');
  }

  /**
   * Export to TypeORM entity format
   */
  _exportToTypeORM(schema) {
    const lines = [];

    lines.push('// TypeORM entities generated by Dave');
    lines.push("import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';");
    lines.push('');

    for (const [name, entity] of Object.entries(schema.entities)) {
      lines.push(`@Entity('${entity.tableName}')`);
      lines.push(`export class ${name} {`);

      for (const [fieldName, field] of Object.entries(entity.fields)) {
        if (field.primaryKey) {
          if (field.type === 'uuid') {
            lines.push('  @PrimaryGeneratedColumn("uuid")');
          } else {
            lines.push('  @PrimaryGeneratedColumn()');
          }
        } else if (fieldName === 'createdAt') {
          lines.push('  @CreateDateColumn()');
        } else if (fieldName === 'updatedAt') {
          lines.push('  @UpdateDateColumn()');
        } else {
          const columnOpts = this._getTypeORMColumnOptions(field);
          lines.push(`  @Column(${columnOpts})`);
        }

        const tsType = this._fieldTypeToTypeScript(field);
        lines.push(`  ${fieldName}: ${tsType};`);
        lines.push('');
      }

      lines.push('}');
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Get TypeORM column options
   */
  _getTypeORMColumnOptions(field) {
    const opts = [];

    const typeMap = {
      string: 'varchar',
      integer: 'int',
      float: 'decimal',
      boolean: 'boolean',
      text: 'text',
      json: 'json',
      uuid: 'uuid'
    };

    if (typeMap[field.type]) {
      opts.push(`type: '${typeMap[field.type]}'`);
    }

    if (field.nullable) {
      opts.push('nullable: true');
    }

    if (field.unique) {
      opts.push('unique: true');
    }

    if (field.length) {
      opts.push(`length: ${field.length}`);
    }

    return opts.length > 0 ? `{ ${opts.join(', ')} }` : '';
  }

  /**
   * Import schema from source
   */
  async import(source, format) {
    switch (format) {
      case 'json':
        return JSON.parse(source);

      case 'prisma':
        return this._parsePrismaSchema(source);

      default:
        throw new Error(`Unsupported import format: ${format}`);
    }
  }

  /**
   * Parse Prisma schema (basic implementation)
   */
  _parsePrismaSchema(source) {
    // Basic Prisma schema parser
    const schema = this._createEmptySchema();

    const modelRegex = /model\s+(\w+)\s*{([^}]+)}/g;
    let match;

    while ((match = modelRegex.exec(source)) !== null) {
      const modelName = match[1];
      const modelBody = match[2];

      const entity = {
        name: modelName,
        tableName: this._toSnakeCase(modelName),
        fields: {}
      };

      const fieldRegex = /(\w+)\s+(\w+)(\?)?/g;
      let fieldMatch;

      while ((fieldMatch = fieldRegex.exec(modelBody)) !== null) {
        const fieldName = fieldMatch[1];
        const fieldType = fieldMatch[2];
        const nullable = !!fieldMatch[3];

        if (!fieldName.startsWith('@')) {
          entity.fields[fieldName] = {
            name: fieldName,
            type: this._prismaTypeToFieldType(fieldType),
            nullable
          };
        }
      }

      schema.entities[modelName] = entity;
    }

    return schema;
  }

  /**
   * Convert Prisma type to field type
   */
  _prismaTypeToFieldType(prismaType) {
    const typeMap = {
      String: 'string',
      Int: 'integer',
      Float: 'float',
      Boolean: 'boolean',
      DateTime: 'datetime',
      Json: 'json',
      Bytes: 'binary'
    };

    return typeMap[prismaType] || 'string';
  }

  /**
   * Convert string to snake_case
   */
  _toSnakeCase(str) {
    return str
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');
  }

  /**
   * Save schema to file
   */
  async save() {
    if (!this.projectPath || !this.schema) return;

    const schemaPath = path.join(this.projectPath, this.config.schemaFile || 'schema.json');
    await fs.writeFile(schemaPath, JSON.stringify(this.schema, null, 2));
    logger.debug('Schema saved');
  }
}

export default SchemaDesigner;
