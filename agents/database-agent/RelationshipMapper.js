/**
 * RelationshipMapper
 * ------------------
 * Maps and validates database relationships between entities.
 * Generates relationship documentation and diagram data.
 *
 * @author Kareem Hussein
 * @company Inweb Software Solutions
 */

import EventEmitter from 'events';
import fs from 'fs/promises';
import path from 'path';
import { createLogger } from '../../foundation/common/logger.js';

const logger = createLogger('RelationshipMapper');

// Relationship types
export const RelationType = {
  ONE_TO_ONE: 'one_to_one',
  ONE_TO_MANY: 'one_to_many',
  MANY_TO_ONE: 'many_to_one',
  MANY_TO_MANY: 'many_to_many'
};

export class RelationshipMapper extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = config;
    this.projectPath = null;
    this.relationships = [];
    this.initialized = false;
  }

  /**
   * Initialize the relationship mapper
   */
  async initialize() {
    this.initialized = true;
    logger.debug('RelationshipMapper initialized');
  }

  /**
   * Set the project path
   * @param {string} projectPath - Path to database directory
   */
  async setProjectPath(projectPath) {
    this.projectPath = projectPath;

    // Load existing relationships if present
    const relPath = path.join(projectPath, 'relationships.json');
    try {
      const content = await fs.readFile(relPath, 'utf-8');
      this.relationships = JSON.parse(content);
      logger.debug(`Loaded ${this.relationships.length} relationships`);
    } catch (error) {
      this.relationships = [];
    }
  }

  /**
   * Map relationships from schema
   * @param {object} schema - Database schema
   */
  async mapFromSchema(schema) {
    const relationships = [];

    if (!schema?.entities) {
      return relationships;
    }

    // Scan all entities for foreign key references
    for (const [entityName, entity] of Object.entries(schema.entities)) {
      for (const [fieldName, field] of Object.entries(entity.fields)) {
        if (field.reference) {
          const relationship = {
            id: `${entityName}_${fieldName}_${field.reference.entity}`,
            name: `${entityName} -> ${field.reference.entity}`,
            from: {
              entity: entityName,
              field: fieldName,
              table: entity.tableName
            },
            to: {
              entity: field.reference.entity,
              field: field.reference.field || 'id',
              table: schema.entities[field.reference.entity]?.tableName
            },
            type: this._inferRelationType(field, schema),
            constraint: field.reference.constraint || 'FOREIGN KEY',
            onDelete: field.reference.onDelete || 'CASCADE',
            onUpdate: field.reference.onUpdate || 'CASCADE',
            description: field.reference.description || '',
            createdAt: new Date().toISOString()
          };

          relationships.push(relationship);
        }
      }
    }

    // Detect many-to-many through join tables
    const joinTableRelationships = this._detectManyToManyRelationships(schema);
    relationships.push(...joinTableRelationships);

    this.relationships = relationships;
    await this.save();

    return relationships;
  }

  /**
   * Infer relationship type from field definition
   */
  _inferRelationType(field, schema) {
    // If field is unique, it's one-to-one
    if (field.unique) {
      return RelationType.ONE_TO_ONE;
    }

    // Check if this appears to be a many-to-one
    if (field.reference) {
      return RelationType.MANY_TO_ONE;
    }

    return RelationType.MANY_TO_ONE;
  }

  /**
   * Detect many-to-many relationships through join tables
   */
  _detectManyToManyRelationships(schema) {
    const relationships = [];

    for (const [entityName, entity] of Object.entries(schema.entities || {})) {
      const fields = Object.values(entity.fields);
      const foreignKeys = fields.filter(f => f.reference);

      // A join table typically has exactly 2 foreign keys and minimal other fields
      if (foreignKeys.length === 2) {
        const nonFKFields = fields.filter(f => !f.reference && !f.primaryKey);

        // Join table usually has only timestamps or minimal fields
        if (nonFKFields.length <= 3) {
          const [fk1, fk2] = foreignKeys;

          relationships.push({
            id: `${fk1.reference.entity}_${fk2.reference.entity}_many_to_many`,
            name: `${fk1.reference.entity} <-> ${fk2.reference.entity}`,
            from: {
              entity: fk1.reference.entity,
              field: fk1.reference.field || 'id'
            },
            to: {
              entity: fk2.reference.entity,
              field: fk2.reference.field || 'id'
            },
            through: {
              entity: entityName,
              table: entity.tableName,
              fromField: fk1.name,
              toField: fk2.name
            },
            type: RelationType.MANY_TO_MANY,
            description: `Many-to-many relationship through ${entityName}`,
            createdAt: new Date().toISOString()
          });
        }
      }
    }

    return relationships;
  }

  /**
   * Add a new relationship
   * @param {object} relationship - Relationship definition
   */
  async add(relationship) {
    const newRelationship = {
      id: relationship.id || `${relationship.from.entity}_${relationship.to.entity}_${Date.now()}`,
      name: relationship.name || `${relationship.from.entity} -> ${relationship.to.entity}`,
      from: relationship.from,
      to: relationship.to,
      type: relationship.type || RelationType.MANY_TO_ONE,
      constraint: relationship.constraint || 'FOREIGN KEY',
      onDelete: relationship.onDelete || 'CASCADE',
      onUpdate: relationship.onUpdate || 'CASCADE',
      description: relationship.description || '',
      createdAt: new Date().toISOString()
    };

    this.relationships.push(newRelationship);
    await this.save();

    this.emit('relationship:added', newRelationship);
    return newRelationship;
  }

  /**
   * Update a relationship
   * @param {string} relationshipId - Relationship ID
   * @param {object} updates - Updates to apply
   */
  async update(relationshipId, updates) {
    const index = this.relationships.findIndex(r => r.id === relationshipId);

    if (index === -1) {
      throw new Error(`Relationship not found: ${relationshipId}`);
    }

    this.relationships[index] = {
      ...this.relationships[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await this.save();
    return this.relationships[index];
  }

  /**
   * Remove a relationship
   * @param {string} relationshipId - Relationship ID
   */
  async remove(relationshipId) {
    const index = this.relationships.findIndex(r => r.id === relationshipId);

    if (index === -1) {
      return false;
    }

    this.relationships.splice(index, 1);
    await this.save();
    return true;
  }

  /**
   * Validate relationships against schema
   */
  async validate() {
    const issues = [];

    // Load current schema
    let schema = null;
    try {
      const schemaPath = path.join(this.projectPath, 'schema.json');
      const content = await fs.readFile(schemaPath, 'utf-8');
      schema = JSON.parse(content);
    } catch (error) {
      return {
        valid: true,
        issues: [{ type: 'no_schema', message: 'No schema file found to validate against' }]
      };
    }

    for (const rel of this.relationships) {
      // Check if source entity exists
      if (!schema.entities[rel.from.entity]) {
        issues.push({
          type: 'missing_entity',
          relationship: rel.id,
          message: `Source entity "${rel.from.entity}" not found in schema`
        });
      }

      // Check if target entity exists
      if (!schema.entities[rel.to.entity]) {
        issues.push({
          type: 'missing_entity',
          relationship: rel.id,
          message: `Target entity "${rel.to.entity}" not found in schema`
        });
      }

      // Check if source field exists
      if (schema.entities[rel.from.entity] && rel.from.field) {
        const entity = schema.entities[rel.from.entity];
        if (!entity.fields[rel.from.field]) {
          issues.push({
            type: 'missing_field',
            relationship: rel.id,
            message: `Source field "${rel.from.field}" not found in entity "${rel.from.entity}"`
          });
        }
      }

      // Check if target field exists
      if (schema.entities[rel.to.entity] && rel.to.field) {
        const entity = schema.entities[rel.to.entity];
        if (!entity.fields[rel.to.field]) {
          issues.push({
            type: 'missing_field',
            relationship: rel.id,
            message: `Target field "${rel.to.field}" not found in entity "${rel.to.entity}"`
          });
        }
      }

      // For many-to-many, check join table
      if (rel.type === RelationType.MANY_TO_MANY && rel.through) {
        if (!schema.entities[rel.through.entity]) {
          issues.push({
            type: 'missing_join_table',
            relationship: rel.id,
            message: `Join table "${rel.through.entity}" not found in schema`
          });
        }
      }
    }

    // Check for circular dependencies
    const circularDeps = this._detectCircularDependencies();
    for (const cycle of circularDeps) {
      issues.push({
        type: 'circular_dependency',
        message: `Circular dependency detected: ${cycle.join(' -> ')}`
      });
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Detect circular dependencies in relationships
   */
  _detectCircularDependencies() {
    const cycles = [];
    const graph = new Map();

    // Build adjacency list
    for (const rel of this.relationships) {
      if (!graph.has(rel.from.entity)) {
        graph.set(rel.from.entity, []);
      }
      graph.get(rel.from.entity).push(rel.to.entity);
    }

    // DFS to find cycles
    const visited = new Set();
    const recursionStack = new Set();

    const dfs = (node, path) => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          const cycle = dfs(neighbor, [...path]);
          if (cycle) return cycle;
        } else if (recursionStack.has(neighbor)) {
          // Found cycle
          const cycleStart = path.indexOf(neighbor);
          return [...path.slice(cycleStart), neighbor];
        }
      }

      recursionStack.delete(node);
      return null;
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        const cycle = dfs(node, []);
        if (cycle) {
          cycles.push(cycle);
        }
      }
    }

    return cycles;
  }

  /**
   * Validate relationship files
   */
  async validateFiles() {
    if (!this.projectPath) {
      return { valid: true, issues: [] };
    }

    const relPath = path.join(this.projectPath, 'relationships.json');

    try {
      await fs.access(relPath);
      const content = await fs.readFile(relPath, 'utf-8');
      JSON.parse(content);

      return {
        valid: true,
        issues: []
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {
          valid: true,
          issues: [{ type: 'missing_file', message: 'relationships.json not found' }]
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
   * Get diagram data for visualization
   */
  async getDiagramData() {
    const nodes = new Map();
    const edges = [];

    // Build nodes from relationships
    for (const rel of this.relationships) {
      // Add source node
      if (!nodes.has(rel.from.entity)) {
        nodes.set(rel.from.entity, {
          id: rel.from.entity,
          label: rel.from.entity,
          type: 'entity'
        });
      }

      // Add target node
      if (!nodes.has(rel.to.entity)) {
        nodes.set(rel.to.entity, {
          id: rel.to.entity,
          label: rel.to.entity,
          type: 'entity'
        });
      }

      // Add join table node for many-to-many
      if (rel.through) {
        if (!nodes.has(rel.through.entity)) {
          nodes.set(rel.through.entity, {
            id: rel.through.entity,
            label: rel.through.entity,
            type: 'join_table'
          });
        }
      }

      // Add edge
      edges.push({
        id: rel.id,
        source: rel.from.entity,
        target: rel.to.entity,
        label: this._getEdgeLabel(rel),
        type: rel.type,
        through: rel.through?.entity
      });
    }

    return {
      nodes: Array.from(nodes.values()),
      edges,
      metadata: {
        generatedAt: new Date().toISOString(),
        totalEntities: nodes.size,
        totalRelationships: edges.length
      }
    };
  }

  /**
   * Get edge label for diagram
   */
  _getEdgeLabel(relationship) {
    const labels = {
      [RelationType.ONE_TO_ONE]: '1:1',
      [RelationType.ONE_TO_MANY]: '1:N',
      [RelationType.MANY_TO_ONE]: 'N:1',
      [RelationType.MANY_TO_MANY]: 'N:N'
    };

    return labels[relationship.type] || '';
  }

  /**
   * Generate Mermaid ERD diagram
   */
  async generateMermaidDiagram() {
    const lines = ['erDiagram'];

    // Get unique entities
    const entities = new Set();
    for (const rel of this.relationships) {
      entities.add(rel.from.entity);
      entities.add(rel.to.entity);
      if (rel.through) {
        entities.add(rel.through.entity);
      }
    }

    // Add relationships
    for (const rel of this.relationships) {
      const cardinality = this._getMermaidCardinality(rel.type);
      lines.push(`    ${rel.from.entity} ${cardinality} ${rel.to.entity} : "${rel.name}"`);
    }

    return lines.join('\n');
  }

  /**
   * Get Mermaid cardinality notation
   */
  _getMermaidCardinality(type) {
    const notations = {
      [RelationType.ONE_TO_ONE]: '||--||',
      [RelationType.ONE_TO_MANY]: '||--o{',
      [RelationType.MANY_TO_ONE]: '}o--||',
      [RelationType.MANY_TO_MANY]: '}o--o{'
    };

    return notations[type] || '||--||';
  }

  /**
   * Get relationship summary
   */
  async getSummary() {
    const byType = {};
    for (const rel of this.relationships) {
      byType[rel.type] = (byType[rel.type] || 0) + 1;
    }

    return {
      total: this.relationships.length,
      byType,
      entities: [...new Set(this.relationships.flatMap(r => [r.from.entity, r.to.entity]))].length
    };
  }

  /**
   * Get all relationships
   */
  getAll() {
    return [...this.relationships];
  }

  /**
   * Get relationships for an entity
   * @param {string} entityName - Entity name
   */
  getForEntity(entityName) {
    return this.relationships.filter(r =>
      r.from.entity === entityName || r.to.entity === entityName
    );
  }

  /**
   * Save relationships to file
   */
  async save() {
    if (!this.projectPath) return;

    const relPath = path.join(this.projectPath, 'relationships.json');
    await fs.writeFile(relPath, JSON.stringify(this.relationships, null, 2));
    logger.debug('Relationships saved');
  }
}

export default RelationshipMapper;
